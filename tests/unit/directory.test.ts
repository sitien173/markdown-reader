// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { buildTree, DirectorySource, type TreeNode } from '../../src/source/directory';
import { SaveConflictError } from '../../src/source/file-handle';
import { MarkdownView, type MarkdownViewHandle } from '../../src/ui/markdown-view';
import { useSettingsStore } from '../../src/store/settings-store';

class FakeFileSystemFileHandle {
  readonly kind = 'file' as const;
  constructor(
    public name: string,
    private content: string,
    public lastModified: number = Date.now(),
  ) {}

  async getFile(): Promise<File> {
    return new File([this.content], this.name, {
      type: 'text/markdown',
      lastModified: this.lastModified,
    });
  }

  async createWritable(): Promise<FileSystemWritableFileStream> {
    let written = '';
    return {
      write: async (data: any) => {
        written = String(data);
      },
      close: async () => {
        this.content = written;
        this.lastModified = Date.now() + 100;
      },
    } as unknown as FileSystemWritableFileStream;
  }
}

class FakeFileSystemDirectoryHandle {
  readonly kind = 'directory' as const;
  private entries = new Map<string, FakeFileSystemFileHandle | FakeFileSystemDirectoryHandle>();

  constructor(public name: string) {}

  setFile(name: string, content: string, lastModified = Date.now()): FakeFileSystemFileHandle {
    const handle = new FakeFileSystemFileHandle(name, content, lastModified);
    this.entries.set(name, handle);
    return handle;
  }

  setDirectory(name: string): FakeFileSystemDirectoryHandle {
    const handle = new FakeFileSystemDirectoryHandle(name);
    this.entries.set(name, handle);
    return handle;
  }

  removeEntry(name: string): void {
    this.entries.delete(name);
  }

  async *values(): AsyncIterable<FakeFileSystemFileHandle | FakeFileSystemDirectoryHandle> {
    for (const entry of this.entries.values()) {
      yield entry;
    }
  }

  async getFileHandle(name: string): Promise<FileSystemFileHandle> {
    const entry = this.entries.get(name);
    if (!entry || entry.kind !== 'file') throw new Error(`File not found: ${name}`);
    return entry as unknown as FileSystemFileHandle;
  }

  async getDirectoryHandle(name: string): Promise<FileSystemDirectoryHandle> {
    const entry = this.entries.get(name);
    if (!entry || entry.kind !== 'directory') throw new Error(`Directory not found: ${name}`);
    return entry as unknown as FileSystemDirectoryHandle;
  }
}

describe('DirectorySource', () => {
  let createdUrls: string[] = [];
  let revokedUrls: string[] = [];

  beforeEach(() => {
    createdUrls = [];
    revokedUrls = [];
    let counter = 0;
    vi.spyOn(URL, 'createObjectURL').mockImplementation((_blob: Blob | MediaSource) => {
      const url = `blob:fake-object-url-${++counter}`;
      createdUrls.push(url);
      return url;
    });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation((url: string) => {
      revokedUrls.push(url);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('tree walking, filtering, and sorting', () => {
    it('filters out non-markdown files and empty directories, sorting directories first', async () => {
      const root = new FakeFileSystemDirectoryHandle('root');
      root.setFile('readme.md', '# Readme');
      root.setFile('notes.markdown', '# Notes');
      root.setFile('ignore.txt', 'not markdown');
      root.setFile('image.png', 'binary');

      const docsDir = root.setDirectory('docs');
      docsDir.setFile('guide.md', '# Guide');
      docsDir.setFile('other.pdf', 'pdf');

      const subDir = docsDir.setDirectory('advanced');
      subDir.setFile('internals.markdown', '# Internals');

      const emptyDir = root.setDirectory('empty-dir');
      emptyDir.setFile('not-md.json', '{}');

      const source = new DirectorySource(root as unknown as FileSystemDirectoryHandle);
      const tree = await source.getTree();

      // Root should have 'docs' directory and 'notes.markdown', 'readme.md' files.
      // 'empty-dir' should be completely omitted.
      expect(tree.map((n) => n.name)).toEqual(['docs', 'notes.markdown', 'readme.md']);
      expect(tree[0]?.kind).toBe('directory');
      expect(tree[1]?.kind).toBe('file');
      expect(tree[2]?.kind).toBe('file');

      // Check nested children of docs
      const docsNode = tree[0] as { kind: 'directory'; children: TreeNode[] };
      expect(docsNode.children.map((n) => n.name)).toEqual(['advanced', 'guide.md']);
      expect(docsNode.children[0]?.kind).toBe('directory');
      expect(docsNode.children[1]?.kind).toBe('file');

      // Check nested children of advanced
      const advancedNode = docsNode.children[0] as { kind: 'directory'; children: TreeNode[] };
      expect(advancedNode.children.map((n) => n.name)).toEqual(['internals.markdown']);
    });

    it('deterministically sorts names that differ only in case using ASCII tie-breaker', async () => {
      const root = new FakeFileSystemDirectoryHandle('root');
      root.setFile('readme.md', '# lower');
      root.setFile('README.md', '# UPPER');
      const source = new DirectorySource(root as unknown as FileSystemDirectoryHandle);
      const tree = await source.getTree();
      expect(tree.map((n) => n.name)).toEqual(['README.md', 'readme.md']);
    });

    describe('picker hiding and pruning', () => {
      beforeEach(() => {
        useSettingsStore.setState({
          settings: {
            ...useSettingsStore.getState().settings,
            general: {
              ...useSettingsStore.getState().settings.general,
              showHiddenItems: false,
              ignorePatterns: 'node_modules/',
            },
          },
        });
      });

      afterEach(() => {
        useSettingsStore.setState({
          settings: {
            ...useSettingsStore.getState().settings,
            general: {
              ...useSettingsStore.getState().settings.general,
              showHiddenItems: false,
              ignorePatterns: 'node_modules/',
            },
          },
        });
      });

      it('hides dot-items, gitignored entries, and settings-pattern matches by default', async () => {
        const root = new FakeFileSystemDirectoryHandle('root');
        root.setFile('visible.md', '# Visible');
        root.setFile('.hidden.md', '# Hidden');
        root.setFile('.gitignore', 'ignored.md\nignored-folder/\n');
        root.setFile('ignored.md', '# Ignored');

        const dotFolder = root.setDirectory('.dotfolder');
        dotFolder.setFile('inside-dot.md', '# Inside');

        const ignoredFolder = root.setDirectory('ignored-folder');
        ignoredFolder.setFile('nested.md', '# Nested');

        const nodeModules = root.setDirectory('node_modules');
        nodeModules.setFile('dep.md', '# Dep');

        const sub = root.setDirectory('sub');
        sub.setFile('normal.md', '# Normal');
        sub.setFile('sub-ignored.md', '# Sub ignored');
        sub.setFile('.gitignore', 'sub-ignored.md\n');

        const emptyDir = root.setDirectory('empty-dir');
        emptyDir.setFile('not-md.txt', 'not markdown');

        const source = new DirectorySource(root as unknown as FileSystemDirectoryHandle);
        const tree = await source.getTree();

        expect(tree.map((n) => n.name)).toEqual(['sub', 'visible.md']);
        const subNode = tree[0] as { kind: 'directory'; children: TreeNode[] };
        expect(subNode.children.map((n) => n.name)).toEqual(['normal.md']);
      });

      it('reveals all hidden items when showHiddenItems is enabled, while still pruning empty folders', async () => {
        useSettingsStore.setState({
          settings: {
            ...useSettingsStore.getState().settings,
            general: {
              ...useSettingsStore.getState().settings.general,
              showHiddenItems: true,
              ignorePatterns: 'node_modules/',
            },
          },
        });

        const root = new FakeFileSystemDirectoryHandle('root');
        root.setFile('visible.md', '# Visible');
        root.setFile('.hidden.md', '# Hidden');
        root.setFile('.gitignore', 'ignored.md\n');
        root.setFile('ignored.md', '# Ignored');

        const dotFolder = root.setDirectory('.dotfolder');
        dotFolder.setFile('inside-dot.md', '# Inside');

        const nodeModules = root.setDirectory('node_modules');
        nodeModules.setFile('dep.md', '# Dep');

        const emptyDir = root.setDirectory('empty-dir');
        emptyDir.setFile('not-md.txt', 'not markdown');

        const source = new DirectorySource(root as unknown as FileSystemDirectoryHandle);
        const tree = await source.getTree();

        expect(tree.map((n) => n.name)).toEqual(['.dotfolder', 'node_modules', '.hidden.md', 'ignored.md', 'visible.md']);
        // emptyDir must still be pruned
        expect(tree.some((n) => n.name === 'empty-dir')).toBe(false);
      });

      it('respects custom settings ignorePatterns', async () => {
        useSettingsStore.setState({
          settings: {
            ...useSettingsStore.getState().settings,
            general: {
              ...useSettingsStore.getState().settings.general,
              showHiddenItems: false,
              ignorePatterns: 'custom-ignore/\n*.draft.md',
            },
          },
        });

        const root = new FakeFileSystemDirectoryHandle('root');
        root.setFile('regular.md', '# Regular');
        root.setFile('notes.draft.md', '# Draft');

        const customIgnore = root.setDirectory('custom-ignore');
        customIgnore.setFile('doc.md', '# Doc');

        const source = new DirectorySource(root as unknown as FileSystemDirectoryHandle);
        const tree = await source.getTree();

        expect(tree.map((n) => n.name)).toEqual(['regular.md']);
      });

      it('buildTree can be called directly with required settings', async () => {
        const root = new FakeFileSystemDirectoryHandle('root');
        root.setFile('doc.md', '# Doc');
        const tree = await buildTree(root as unknown as FileSystemDirectoryHandle, '', [], {
          showHiddenItems: false,
          ignorePatterns: 'node_modules/',
        });
        expect(tree.map((n) => n.name)).toEqual(['doc.md']);
      });

      it('skips reading .gitignore when showHiddenItems is on', async () => {
        const root = new FakeFileSystemDirectoryHandle('root');
        root.setFile('doc.md', '# Doc');
        root.setFile('.gitignore', 'ignored.md\n');
        const getFileHandleSpy = vi.spyOn(root, 'getFileHandle');

        await buildTree(root as unknown as FileSystemDirectoryHandle, '', [], {
          showHiddenItems: true,
          ignorePatterns: 'node_modules/',
        });

        expect(getFileHandleSpy).not.toHaveBeenCalledWith('.gitignore');
      });
    });
  });

  describe('superseded reads', () => {
    it('does not mutate currentPath for a superseded read', async () => {
      const root = new FakeFileSystemDirectoryHandle('root');
      let resolveFirst!: () => void;
      const firstGetFilePromise = new Promise<File>((r) => {
        resolveFirst = () => r(new File(['# First'], 'first.md'));
      });
      const firstHandle = {
        kind: 'file' as const,
        name: 'first.md',
        getFile: () => firstGetFilePromise,
      };
      const secondHandle = {
        kind: 'file' as const,
        name: 'second.md',
        getFile: async () => new File(['# Second'], 'second.md'),
      };
      (root as any).getFileHandle = vi.fn(async (name: string) => {
        return name === 'first.md' ? firstHandle : secondHandle;
      });

      const source = new DirectorySource(root as unknown as FileSystemDirectoryHandle, 'initial.md');
      const read1 = source.read('first.md');
      expect(source.currentPath).toBe('initial.md');
      const text2 = await source.read('second.md');
      expect(text2).toBe('# Second');
      expect(source.currentPath).toBe('second.md');

      resolveFirst();
      const text1 = await read1;
      expect(text1).toBe('# First');
      expect(source.currentPath).toBe('second.md');
    });

    it('does not mutate currentPath when read is superseded during delayed getFileHandle', async () => {
      const root = new FakeFileSystemDirectoryHandle('root');
      let resolveFirstHandle!: () => void;
      const firstHandlePromise = new Promise<any>((r) => {
        resolveFirstHandle = () =>
          r({
            kind: 'file' as const,
            name: 'first.md',
            getFile: async () => new File(['# First'], 'first.md'),
          });
      });
      const secondHandle = {
        kind: 'file' as const,
        name: 'second.md',
        getFile: async () => new File(['# Second'], 'second.md'),
      };
      (root as any).getFileHandle = vi.fn(async (name: string) => {
        return name === 'first.md' ? firstHandlePromise : secondHandle;
      });

      const source = new DirectorySource(root as unknown as FileSystemDirectoryHandle, 'initial.md');
      const read1 = source.read('first.md');
      const text2 = await source.read('second.md');
      expect(text2).toBe('# Second');
      expect(source.currentPath).toBe('second.md');

      resolveFirstHandle();
      const text1 = await read1;
      expect(text1).toBe('# First');
      expect(source.currentPath).toBe('second.md');
    });
  });

  describe('relative link and image resolution inside folder', () => {
    it('resolves relative markdown links to folder paths and marks them as markdown links', () => {
      const root = new FakeFileSystemDirectoryHandle('root');
      const source = new DirectorySource(root as unknown as FileSystemDirectoryHandle, 'docs/intro.md');

      const res1 = source.resolveLink('guide.md');
      expect(res1.isMd).toBe(true);
      expect(res1.folderPath).toBe('docs/guide.md');

      const res2 = source.resolveLink('../readme.markdown');
      expect(res2.isMd).toBe(true);
      expect(res2.folderPath).toBe('readme.markdown');
    });

    it('resolves relative images to object URLs and creates object URL', async () => {
      const root = new FakeFileSystemDirectoryHandle('root');
      const assets = root.setDirectory('assets');
      assets.setFile('diagram.png', 'pngdata');

      const source = new DirectorySource(root as unknown as FileSystemDirectoryHandle, 'readme.md');
      const res = await source.resolveImage('./assets/diagram.png');

      expect(res.disabled).toBeFalsy();
      expect(res.src).toMatch(/^blob:fake-object-url-/);
      expect(createdUrls.length).toBe(1);
    });

    it('revokes all created object URLs on revokeObjectUrls', async () => {
      const root = new FakeFileSystemDirectoryHandle('root');
      root.setFile('pic.png', 'data');
      const source = new DirectorySource(root as unknown as FileSystemDirectoryHandle, 'readme.md');

      await source.resolveImage('pic.png');
      expect(createdUrls.length).toBe(1);

      source.revokeObjectUrls();
      expect(revokedUrls).toEqual(createdUrls);
    });

    it('revokes specific object URL and removes it from tracking', async () => {
      const root = new FakeFileSystemDirectoryHandle('root');
      root.setFile('image.png', 'binary data');
      const source = new DirectorySource(root as unknown as FileSystemDirectoryHandle, 'readme.md');

      const resolved = await source.resolveImage('image.png');
      expect(resolved.src).toContain('blob:');
      expect(createdUrls).toContain(resolved.src);
      expect(revokedUrls).not.toContain(resolved.src);

      source.revokeUrl(resolved.src);
      expect(revokedUrls).toContain(resolved.src);
    });
  });

  describe('outside folder fallback', () => {
    it('falls back to source URL resolution if baseUrl is provided, or renders disabled', () => {
      const root = new FakeFileSystemDirectoryHandle('root');
      const source = new DirectorySource(root as unknown as FileSystemDirectoryHandle, 'readme.md');

      // Resolving above root without fallback base URL renders disabled
      const resDisabled = source.resolveLink('../outside.md');
      expect(resDisabled.disabled).toBe(true);

      // With fallback base URL
      const resFallback = source.resolveLink('../outside.md', undefined, 'https://example.com/repo/readme.md');
      expect(resFallback.href).toBe('https://example.com/outside.md');
      expect(resFallback.disabled).toBeFalsy();
    });

    it('falls back for outside images or renders disabled', async () => {
      const root = new FakeFileSystemDirectoryHandle('root');
      const source = new DirectorySource(root as unknown as FileSystemDirectoryHandle, 'readme.md');

      const resDisabled = await source.resolveImage('../outside.png');
      expect(resDisabled.disabled).toBe(true);

      const resFallback = await source.resolveImage('../outside.png', undefined, 'https://example.com/repo/readme.md');
      expect(resFallback.src).toBe('https://example.com/outside.png');
    });
  });

  describe('watch events: add, remove, and rename', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('reports tree changes on add, remove, and rename, and reports file change on modify', async () => {
      const root = new FakeFileSystemDirectoryHandle('root');
      const activeFile = root.setFile('active.md', '# Initial', 1000);

      const source = new DirectorySource(root as unknown as FileSystemDirectoryHandle, 'active.md');
      const onTreeChange = vi.fn();
      const onChange = vi.fn();
      const onDeleted = vi.fn();

      const unsubscribe = source.watch({ onTreeChange, onChange, onDeleted });

      // Initial tick
      await vi.advanceTimersByTimeAsync(1000);
      expect(onTreeChange).not.toHaveBeenCalled();

      // Add file
      root.setFile('new.md', '# New', 1001);
      await vi.advanceTimersByTimeAsync(1000);
      expect(onTreeChange).toHaveBeenCalledTimes(1);

      // Rename file (remove old, set new)
      root.removeEntry('new.md');
      root.setFile('renamed.md', '# Renamed', 1002);
      await vi.advanceTimersByTimeAsync(1000);
      expect(onTreeChange).toHaveBeenCalledTimes(2);

      // Modify active file
      activeFile.lastModified = 2000;
      await vi.advanceTimersByTimeAsync(1000);
      expect(onChange).toHaveBeenCalledTimes(1);

      // Remove file
      root.removeEntry('renamed.md');
      await vi.advanceTimersByTimeAsync(1000);
      expect(onTreeChange).toHaveBeenCalledTimes(3);

      unsubscribe();
    });

    it('starts watcher for an empty folder so adding the first file reports tree change', async () => {
      const root = new FakeFileSystemDirectoryHandle('empty-root');
      const source = new DirectorySource(root as unknown as FileSystemDirectoryHandle);
      const onTreeChange = vi.fn();
      const onChange = vi.fn();
      const onDeleted = vi.fn();

      const unsubscribe = source.watch({ onTreeChange, onChange, onDeleted });
      await vi.advanceTimersByTimeAsync(1000);
      expect(onTreeChange).not.toHaveBeenCalled();

      // Add the first markdown file
      root.setFile('first.md', '# First File', 1000);
      await vi.advanceTimersByTimeAsync(1000);
      expect(onTreeChange).toHaveBeenCalledTimes(1);

      unsubscribe();
    });

    it('drops stale or overlapping async tree refresh results with generation guard', async () => {
      let treeGen = 0;
      let committedTree: string = '';
      const refreshTree = async (gen: number, delayMs: number, resultName: string) => {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        if (gen === treeGen) {
          committedTree = resultName;
        }
      };

      // Call 1 started with gen 1, slow (100ms)
      const gen1 = ++treeGen;
      const p1 = refreshTree(gen1, 100, 'tree-1');

      // Call 2 started with gen 2, fast (20ms)
      const gen2 = ++treeGen;
      const p2 = refreshTree(gen2, 20, 'tree-2');

      await vi.advanceTimersByTimeAsync(20);
      await p2;
      expect(committedTree).toBe('tree-2');

      await vi.advanceTimersByTimeAsync(80);
      await p1;
      // Stale call 1 must not overwrite tree-2
      expect(committedTree).toBe('tree-2');
    });
  });

  describe('DirectorySource.write', () => {
    it('throws SaveConflictError when expectedStamp does not match diskStamp', async () => {
      const root = new FakeFileSystemDirectoryHandle('root');
      root.setFile('doc.md', '# Original', 1000);
      const source = new DirectorySource(root as unknown as FileSystemDirectoryHandle, 'doc.md');

      await expect(source.write('# New', 2000)).rejects.toBeInstanceOf(SaveConflictError);
    });

    it('writes when expectedStamp matches diskStamp', async () => {
      const root = new FakeFileSystemDirectoryHandle('root');
      root.setFile('doc.md', '# Original', 1000);
      const source = new DirectorySource(root as unknown as FileSystemDirectoryHandle, 'doc.md');

      const newStamp = await source.write('# Updated', 1000);
      expect(newStamp).toBeGreaterThan(0);
      const content = await source.read('doc.md');
      expect(content).toBe('# Updated');
    });

    it('overwrites unconditionally when expectedStamp is omitted', async () => {
      const root = new FakeFileSystemDirectoryHandle('root');
      root.setFile('doc.md', '# Original', 1000);
      const source = new DirectorySource(root as unknown as FileSystemDirectoryHandle, 'doc.md');

      const newStamp = await source.write('# Forced Overwrite');
      expect(newStamp).toBeGreaterThan(0);
      const content = await source.read('doc.md');
      expect(content).toBe('# Forced Overwrite');
    });

    it('writes to the given path after a newer read moved currentPath', async () => {
      const root = new FakeFileSystemDirectoryHandle('root');
      root.setFile('a.md', '# A', 1000);
      root.setFile('b.md', '# B', 1000);
      const source = new DirectorySource(root as unknown as FileSystemDirectoryHandle, 'a.md');

      await source.read('b.md');
      await source.write('# A edited', 1000, 'a.md');
      expect(await source.read('a.md')).toBe('# A edited');
      expect(await source.read('b.md')).toBe('# B');
    });
  });

  describe('MarkdownView source switch lifecycle', () => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

    it('starts new generation, aborts outstanding work, repaints on source switch, and revokes all URLs on unmount', async () => {
      const rootA = new FakeFileSystemDirectoryHandle('folder-a');
      rootA.setFile('image.png', 'img-data-a');
      const sourceA = new DirectorySource(rootA as unknown as FileSystemDirectoryHandle, 'doc.md');

      const rootB = new FakeFileSystemDirectoryHandle('folder-b');
      rootB.setFile('image.png', 'img-data-b');
      const sourceB = new DirectorySource(rootB as unknown as FileSystemDirectoryHandle, 'doc.md');

      const container = document.createElement('div');
      document.body.append(container);
      const root = createRoot(container);

      // Render with sourceA, identical markdown text and docPath
      const markdown = '# Test\n\n![diagram](image.png)';
      act(() => {
        root.render(
          React.createElement(MarkdownView, {
            text: markdown,
            baseUrl: '',
            docPath: 'doc.md',
            directorySource: sourceA,
          }),
        );
      });

      // Allow image resolution microtasks to finish
      await act(async () => {
        await new Promise((r) => setTimeout(r, 20));
      });

      const img1 = container.querySelector('img');
      expect(img1).not.toBeNull();
      const urlA = img1?.getAttribute('src');
      expect(urlA).toMatch(/^blob:fake-object-url-/);
      expect(revokedUrls).not.toContain(urlA);

      // Now switch source to sourceB with IDENTICAL text and docPath
      act(() => {
        root.render(
          React.createElement(MarkdownView, {
            text: markdown,
            baseUrl: '',
            docPath: 'doc.md',
            directorySource: sourceB,
          }),
        );
      });

      await act(async () => {
        await new Promise((r) => setTimeout(r, 20));
      });

      // urlA must be revoked because source was switched
      expect(revokedUrls).toContain(urlA);

      const img2 = container.querySelector('img');
      expect(img2).not.toBeNull();
      const urlB = img2?.getAttribute('src');
      expect(urlB).toMatch(/^blob:fake-object-url-/);
      expect(urlB).not.toBe(urlA);
      // urlB must NOT be revoked yet
      expect(revokedUrls).not.toContain(urlB);

      // Now unmount the view: should revoke URLs of EVERY source used (both sourceA and sourceB)
      act(() => {
        root.unmount();
      });

      expect(revokedUrls).toContain(urlA);
      expect(revokedUrls).toContain(urlB);
    });

    it('revokes immediately URLs created by in-flight image work aborted by source switch', async () => {
      const rootA = new FakeFileSystemDirectoryHandle('folder-a');
      rootA.setFile('image.png', 'img-data-a');
      const sourceA = new DirectorySource(rootA as unknown as FileSystemDirectoryHandle, 'doc.md');

      let finishInFlightA!: () => void;
      const inFlightA = new Promise<void>((r) => {
        finishInFlightA = r;
      });
      const origResolveA = sourceA.resolveImage.bind(sourceA);
      vi.spyOn(sourceA, 'resolveImage').mockImplementation(async (src, fromPath, fallback) => {
        const res = await origResolveA(src, fromPath, fallback);
        await inFlightA;
        return res;
      });

      const rootB = new FakeFileSystemDirectoryHandle('folder-b');
      rootB.setFile('image.png', 'img-data-b');
      const sourceB = new DirectorySource(rootB as unknown as FileSystemDirectoryHandle, 'doc.md');

      const container = document.createElement('div');
      document.body.append(container);
      const root = createRoot(container);

      // Render with sourceA
      act(() => {
        root.render(
          React.createElement(MarkdownView, {
            text: '# Test\n\n![diagram](image.png)',
            baseUrl: '',
            docPath: 'doc.md',
            directorySource: sourceA,
          }),
        );
      });

      // Switch to sourceB while sourceA image work is still in flight
      act(() => {
        root.render(
          React.createElement(MarkdownView, {
            text: '# Test\n\n![diagram](image.png)',
            baseUrl: '',
            docPath: 'doc.md',
            directorySource: sourceB,
          }),
        );
      });

      // Now complete sourceA's delayed resolution
      finishInFlightA();

      await act(async () => {
        await new Promise((r) => setTimeout(r, 20));
      });

      // The URL created by sourceA must be revoked immediately
      const activeUrl = container.querySelector('img')?.getAttribute('src');
      expect(activeUrl).toMatch(/^blob:fake-object-url-/);
      expect(revokedUrls).not.toContain(activeUrl);

      for (const url of createdUrls) {
        if (url !== activeUrl) {
          expect(revokedUrls).toContain(url);
        }
      }

      act(() => {
        root.unmount();
      });
      expect(revokedUrls).toContain(activeUrl);
    });

    it('revokes prefix image object URLs when full render replaces prefix and when detached prefix work finishes', async () => {
      const rootFolder = new FakeFileSystemDirectoryHandle('folder-prefix');
      rootFolder.setFile('image.png', 'img-data-prefix');
      const source = new DirectorySource(rootFolder as unknown as FileSystemDirectoryHandle, 'doc.md');

      const container = document.createElement('div');
      document.body.append(container);
      const root = createRoot(container);

      // Document larger than 64 KB (PREFIX_TRIGGER_CHARS) with image in first block
      const largeDoc =
        '# Prefix Doc\n\n![prefix diagram](image.png)\n\n' + 'Paragraph of plain text content that takes up space.\n\n'.repeat(2000);

      act(() => {
        root.render(
          React.createElement(MarkdownView, {
            text: largeDoc,
            baseUrl: '',
            docPath: 'doc.md',
            directorySource: source,
          }),
        );
      });

      await act(async () => {
        await new Promise((r) => setTimeout(r, 50));
      });

      // In act(), React flushes microtasks and timers, so both prefix and renderFull have run.
      // Verify that the prefix image URL (the first created URL) was revoked on replacement by renderFull!
      expect(createdUrls.length).toBeGreaterThanOrEqual(2);
      const prefixUrl = createdUrls[0];
      const fullUrl = createdUrls[createdUrls.length - 1];

      // Prefix URL MUST be revoked
      expect(revokedUrls).toContain(prefixUrl);
      // Full render's active URL must NOT be revoked yet
      expect(revokedUrls).not.toContain(fullUrl);

      act(() => {
        root.unmount();
      });
      // After unmount, fullUrl is also revoked
      expect(revokedUrls).toContain(fullUrl);
      container.remove();
    }, 60000);

    it('revokes immediately URLs created by detached prefix work that finishes after prefix replacement', async () => {
      const rootFolder = new FakeFileSystemDirectoryHandle('folder-detached');
      rootFolder.setFile('image.png', 'img-data-detached');
      const source = new DirectorySource(rootFolder as unknown as FileSystemDirectoryHandle, 'doc.md');

      let finishPrefixWork!: () => void;
      const prefixGate = new Promise<void>((r) => {
        finishPrefixWork = r;
      });
      let calls = 0;
      const origResolve = source.resolveImage.bind(source);
      vi.spyOn(source, 'resolveImage').mockImplementation(async (src, fromPath, fallback) => {
        calls++;
        const res = await origResolve(src, fromPath, fallback);
        if (calls === 1) {
          // Pause prefix image resolution
          await prefixGate;
        }
        return res;
      });

      const container = document.createElement('div');
      document.body.append(container);
      const root = createRoot(container);

      const largeDoc = '# Prefix Doc\n\n![prefix diagram](image.png)\n\n' + 'Paragraph of plain text content.\n\n'.repeat(2000);

      act(() => {
        root.render(
          React.createElement(MarkdownView, {
            text: largeDoc,
            baseUrl: '',
            docPath: 'doc.md',
            directorySource: source,
          }),
        );
      });

      // At this point, prefix has mounted and prefix image work is paused.
      // Wait until renderFull has replaced the prefix and resolved its own image:
      await act(async () => {
        await vi.waitFor(() => expect(calls).toBeGreaterThanOrEqual(2), { timeout: 20000 });
      });

      // The first created URL (from the paused prefix resolution)
      const prefixCreatedUrl = createdUrls[0];

      // Finish prefix work after prefix has been replaced
      finishPrefixWork();

      // Detached prefix work must be revoked!
      await act(async () => {
        await vi.waitFor(() => expect(revokedUrls).toContain(prefixCreatedUrl), { timeout: 5000 });
      });

      act(() => {
        root.unmount();
      });
      container.remove();
    }, 30000);

    it('ready() awaits folder image resolution so image src is resolved', async () => {
      const rootDir = new FakeFileSystemDirectoryHandle('folder');
      rootDir.setFile('photo.png', 'fake-png-bytes');
      const source = new DirectorySource(rootDir as unknown as FileSystemDirectoryHandle, 'doc.md');

      let resolveSlowImage!: () => void;
      const slowImagePromise = new Promise<void>((r) => {
        resolveSlowImage = r;
      });
      const origResolve = source.resolveImage.bind(source);
      vi.spyOn(source, 'resolveImage').mockImplementation(async (src, fromPath, fallback) => {
        await slowImagePromise;
        return origResolve(src, fromPath, fallback);
      });

      const container = document.createElement('div');
      document.body.appendChild(container);
      const root = createRoot(container);
      const viewRef = React.createRef<MarkdownViewHandle>();

      act(() => {
        root.render(
          React.createElement(MarkdownView, {
            ref: viewRef,
            text: '# Doc\n\n![My Photo](photo.png)',
            baseUrl: '',
            docPath: 'doc.md',
            directorySource: source,
          }),
        );
      });

      let readyResolved = false;
      const readyPromise = viewRef.current!.ready().then(() => {
        readyResolved = true;
      });

      // Advance microtasks / event loop while image resolution is still pending
      await new Promise((r) => setTimeout(r, 20));
      expect(readyResolved).toBe(false);
      const imgBefore = container.querySelector('img');
      expect(imgBefore?.getAttribute('src')).toBe('photo.png');

      // Allow slow image to complete
      resolveSlowImage();
      await act(async () => {
        await readyPromise;
      });

      // Now ready() has resolved and image src must be resolved to blob URL!
      expect(readyResolved).toBe(true);
      const imgAfter = container.querySelector('img');
      expect(imgAfter?.getAttribute('src')).toMatch(/^blob:/);

      act(() => {
        root.unmount();
      });
      container.remove();
    });
  });
});
