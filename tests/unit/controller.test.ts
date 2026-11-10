import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SaveConflictError } from '../../src/source/file-handle';
import { useSettingsStore } from '../../src/store/settings-store';

type Deferred<T> = { promise: Promise<T>; resolve(value: T): void };
function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

const ctl = vi.hoisted(() => ({
  files: {} as Record<string, string>,
  stamps: {} as Record<string, number>,
  write: undefined as unknown as (text: string, expectedStamp?: number, path?: string) => Promise<number>,
  read: undefined as unknown as (path?: string) => Promise<string>,
  urlRead: undefined as unknown as (url: string) => Promise<string>,
  events: undefined as undefined | { onChange?: () => void },
  fileEvents: undefined as undefined | { onChange?: () => void },
  dirListings: {} as Record<string, Array<{ name: string; url: string; isDir: boolean }>>,
  repoRoots: {} as Record<string, string | null>,
  gitignores: {} as Record<string, string>,
  dirThrows: {} as Record<string, boolean>,
  slowDir: {} as Record<string, Deferred<void>>,
}));

vi.mock('../../src/source/directory', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/source/directory')>();
  class DirectorySource {
    currentPath: string | null = null;
    private readToken = 0;
    constructor(public root: unknown) {}
    async getTree() {
      return Object.keys(ctl.files).map((path) => ({ kind: 'file', name: path, path, handle: {} }));
    }
    // Mirrors the real source: the identity follows the committed path, and the latest read wins.
    get identity() {
      return `folder:root:${this.currentPath ?? ''}`;
    }
    async read(path?: string) {
      const target = path ?? this.currentPath ?? undefined;
      const token = ++this.readToken;
      const value = await ctl.read(target);
      if (token === this.readToken && target) this.currentPath = target;
      return value;
    }
    async diskStamp(path?: string) {
      return ctl.stamps[path ?? this.currentPath ?? 'a.md'] ?? null;
    }
    write(text: string, expectedStamp?: number, path?: string) {
      return ctl.write(text, expectedStamp, path);
    }
    watch(events: { onChange?: () => void }) {
      ctl.events = events;
      return () => undefined;
    }
  }
  return { ...actual, DirectorySource };
});
vi.mock('../../src/source/url', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/source/url')>();
  class UrlSource {
    constructor(public url: string) {}
    read() {
      return ctl.urlRead(this.url);
    }
  }
  return { ...actual, UrlSource };
});
vi.mock('../../src/source/watch', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/source/watch')>();
  return {
    ...actual,
    watchFileHandle: (_handle: unknown, events: { onChange?: () => void }) => {
      ctl.fileEvents = events;
      return () => undefined;
    },
  };
});
vi.mock('../../src/source/file-url', () => {
  class FileUrlSource {
    constructor(public baseUrl: string) {}
    read() {
      return ctl.urlRead(this.baseUrl);
    }
    watch() {
      return () => undefined;
    }
  }
  return { FileUrlSource };
});

vi.mock('../../src/source/file-url-tree', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/source/file-url-tree')>();
  return {
    ...actual,
    findRepoRoot: vi.fn(async (url: string) => {
      const norm = url.endsWith('/') ? url : `${url}/`;
      return ctl.repoRoots[norm] !== undefined ? ctl.repoRoots[norm] : (ctl.repoRoots[url] ?? actual.findRepoRoot(url));
    }),
  };
});

vi.mock('../../src/store/handles', () => ({ storeHandle: vi.fn(async () => undefined) }));
vi.mock('../../src/store/recent', () => ({
  addRecentUrl: vi.fn(async () => undefined),
  getRecentEntries: vi.fn(async () => []),
}));

import { createController, type ReaderController } from '../../src/reader/controller';
let c: ReaderController;
const get = () => c.store.getState();

async function flush() {
  for (let i = 0; i < 5; i++) await new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(async () => {
  ctl.files = { 'a.md': 'A text', 'b.md': 'B text' };
  ctl.stamps = { 'a.md': 100, 'b.md': 200 };
  ctl.read = async (path) => ctl.files[path ?? 'a.md']!;
  ctl.write = async () => 999;
  ctl.urlRead = async (url) => `body of ${url}`;
  ctl.events = undefined;
  ctl.fileEvents = undefined;
  ctl.dirListings = {};
  ctl.repoRoots = {};
  ctl.gitignores = {};
  ctl.dirThrows = {};
  ctl.slowDir = {};
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const norm = url.endsWith('/') ? url : `${url}/`;
      if (ctl.slowDir[norm] || ctl.slowDir[url]) {
        await (ctl.slowDir[norm] ?? ctl.slowDir[url])!.promise;
      }
      if (ctl.dirThrows[norm] || ctl.dirThrows[url]) throw new TypeError('Failed to fetch');
      if (url.endsWith('/.gitignore')) {
        const folder = url.slice(0, -'.gitignore'.length);
        const text = ctl.gitignores[folder] ?? ctl.gitignores[folder.slice(0, -1)] ?? '';
        return new Response(text, { status: 200 });
      }
      const entries = ctl.dirListings[norm] ?? ctl.dirListings[url];
      if (entries) {
        const html = entries
          .map((e) => `<script>addRow(${JSON.stringify(e.name)},${JSON.stringify(e.name)},${e.isDir ? 1 : 0},0,"",0,"");</script>`)
          .join('\n');
        return new Response(html, { status: 200 });
      }
      return new Response('', { status: 200 });
    }),
  );
  const local = { get: vi.fn(async () => ({})), set: vi.fn(async () => undefined), remove: vi.fn(async () => undefined) };
  vi.stubGlobal('browser', { storage: { local, session: { get: vi.fn(async () => ({})), remove: vi.fn(async () => undefined) } } });
  window.history.replaceState(null, '', '/');
  c = createController();
  await c.openFolderHandle({ name: 'root' } as FileSystemDirectoryHandle);
});

describe('controller stale-generation drops', () => {
  it('drops a slow tree file read after a newer selection', async () => {
    const slowB = deferred<string>();
    ctl.read = (path) => (path === 'b.md' ? slowB.promise : Promise.resolve(ctl.files[path ?? 'a.md']!));
    const first = c.selectTreeFile('b.md');
    await c.selectTreeFile('a.md');
    slowB.resolve('B text');
    await first;
    expect(get().docPath).toBe('a.md');
    expect(get().text).toBe('A text');
  });

  it('drops a slow URL load after a newer load', async () => {
    const slow = deferred<string>();
    ctl.urlRead = (url) => (url.endsWith('/one.md') ? slow.promise : Promise.resolve(`body of ${url}`));
    const first = c.load('https://e.test/one.md');
    await c.load('https://e.test/two.md');
    slow.resolve('late one');
    await first;
    expect(get().source).toBe('https://e.test/two.md');
    expect(get().text).toBe('body of https://e.test/two.md');
  });

  it('drops a folder open that was superseded while reading the first file', async () => {
    const slow = deferred<string>();
    ctl.read = () => slow.promise;
    const first = c.openFolderHandle({ name: 'slow' } as FileSystemDirectoryHandle);
    ctl.read = async (path) => ctl.files[path ?? 'a.md']!;
    await c.load('https://e.test/new.md');
    slow.resolve('late folder text');
    await first;
    expect(get().text).toBe('body of https://e.test/new.md');
    expect(get().directorySource).toBeNull();
  });

  it('keeps edits typed while a reload from disk is in flight', async () => {
    const reload = deferred<string>();
    ctl.read = () => reload.promise;
    ctl.stamps['a.md'] = 150;
    const check = c.checkExternal();
    await flush();
    c.edit('typed during reload');
    reload.resolve('disk text');
    await check;
    expect(c.getDraft()).toBe('typed during reload');
    expect(get().text).toBe('A text');
    expect(get().externalChange).toBe(true);
  });
});

describe('controller save path', () => {
  it('ignores a late save result for a file that is no longer committed', async () => {
    const writes: Array<{ stamp: number | undefined; path: string | undefined }> = [];
    const firstWrite = deferred<number>();
    ctl.write = (_text, stamp, path) => {
      writes.push({ stamp, path });
      return writes.length === 1 ? firstWrite.promise : Promise.resolve(300);
    };
    c.edit('A edited');
    const saving = c.save();
    await c.selectTreeFile('b.md');
    firstWrite.resolve(999);
    await saving;
    expect(get().dirty).toBe(false);
    c.edit('B edited');
    await c.save();
    expect(writes).toEqual([
      { stamp: 100, path: 'a.md' },
      { stamp: 200, path: 'b.md' },
    ]);
  });

  it('pins the write to the committed path while a newer selection is pending', async () => {
    const slowB = deferred<string>();
    ctl.read = (path) => (path === 'b.md' ? slowB.promise : Promise.resolve(ctl.files[path ?? 'a.md']!));
    const writes: Array<string | undefined> = [];
    ctl.write = async (_text, _stamp, path) => {
      writes.push(path);
      return 300;
    };
    void c.selectTreeFile('b.md');
    c.edit('A edited');
    await c.save();
    slowB.resolve('B text');
    await flush();
    expect(writes).toEqual(['a.md']);
  });

  it('overwrites the committed path with no expected stamp after a conflict', async () => {
    const writes: Array<{ stamp: number | undefined; path: string | undefined }> = [];
    ctl.write = async (_text, stamp, path) => {
      writes.push({ stamp, path });
      if (stamp !== undefined) throw new SaveConflictError();
      return 400;
    };
    await c.selectTreeFile('b.md');
    c.edit('B edited');
    await c.save();
    expect(get().conflict).toBe(true);
    await c.overwrite();
    expect(writes).toEqual([
      { stamp: 200, path: 'b.md' },
      { stamp: undefined, path: 'b.md' },
    ]);
    expect(get().conflict).toBe(false);
    expect(get().dirty).toBe(false);
  });
});

describe('controller dirty-draft refresh paths', () => {
  it('keeps a dirty draft and shows the banner when the watched folder file changes', async () => {
    c.edit('my draft');
    ctl.stamps['a.md'] = 150;
    ctl.files['a.md'] = 'changed on disk';
    ctl.events?.onChange?.();
    await flush();
    expect(c.getDraft()).toBe('my draft');
    expect(get().text).toBe('A text');
    expect(get().externalChange).toBe(true);
  });

  it('reloads a clean document when the watched folder file changes', async () => {
    ctl.stamps['a.md'] = 150;
    ctl.files['a.md'] = 'changed on disk';
    ctl.events?.onChange?.();
    await flush();
    expect(get().text).toBe('changed on disk');
    expect(get().externalChange).toBe(false);
  });

  it('stops the watcher when the controller is disposed', async () => {
    const unwatch = vi.fn();
    const dir = get().directorySource as unknown as { watch: (events: unknown) => () => void };
    dir.watch = () => unwatch;
    const stop = c.mount();
    await c.selectTreeFile('b.md');
    stop();
    expect(unwatch).toHaveBeenCalled();
  });
});

function fakeFileHandle(name: string, initial: string) {
  let text = initial;
  let modified = 1;
  const handle = {
    name,
    kind: 'file',
    getFile: async () => ({ name, lastModified: modified, text: async () => text }),
    createWritable: async () => ({
      write: async (next: string) => {
        text = next;
        modified++;
      },
      close: async () => undefined,
    }),
  };
  return {
    handle: handle as unknown as FileSystemFileHandle,
    text: () => text,
    changeOnDisk: (next: string) => {
      text = next;
      modified++;
    },
  };
}

describe('controller generation guard', () => {
  it('drops a slow load of a URL after a newer load of the same URL', async () => {
    const slow = deferred<string>();
    let calls = 0;
    ctl.urlRead = () => (calls++ === 0 ? slow.promise : Promise.resolve('fresh body'));
    const first = c.load('https://e.test/same.md');
    await flush();
    await c.load('https://e.test/same.md');
    slow.resolve('stale body');
    await first;
    expect(get().text).toBe('fresh body');
    expect(get().loading).toBe(false);
  });
});

describe('controller openFileHandle', () => {
  it('opens a handle as a writable local file and saves through it', async () => {
    const file = fakeFileHandle('notes.md', '# Notes');
    await c.openFileHandle(file.handle);
    expect(get()).toMatchObject({ text: '# Notes', writable: true, source: '', docPath: null, directorySource: null, error: '' });
    c.edit('# Notes edited');
    await c.save();
    expect(file.text()).toBe('# Notes edited');
    expect(get().dirty).toBe(false);
  });

  it('drops a slow handle read after a newer handle was opened', async () => {
    const slowFile = fakeFileHandle('slow.md', 'slow text');
    const slowRead = deferred<void>();
    const original = slowFile.handle.getFile.bind(slowFile.handle);
    let held = true;
    slowFile.handle.getFile = async () => {
      if (held) await slowRead.promise;
      return original();
    };
    const first = c.openFileHandle(slowFile.handle);
    await flush();
    const fast = fakeFileHandle('fast.md', 'fast text');
    await c.openFileHandle(fast.handle);
    held = false;
    slowRead.resolve();
    await first;
    expect(get().text).toBe('fast text');
    c.edit('fast edited');
    await c.save();
    expect(fast.text()).toBe('fast edited');
    expect(slowFile.text()).toBe('slow text');
  });
});

describe('controller overwrite', () => {
  it('writes to the committed path while a newer selection is still pending', async () => {
    const writes: Array<{ stamp: number | undefined; path: string | undefined }> = [];
    ctl.write = async (_text, stamp, path) => {
      writes.push({ stamp, path });
      if (stamp !== undefined) throw new SaveConflictError();
      return 400;
    };
    await c.selectTreeFile('b.md');
    c.edit('B edited');
    await c.save();
    expect(get().conflict).toBe(true);
    const slowA = deferred<string>();
    ctl.read = (path) => (path === 'a.md' ? slowA.promise : Promise.resolve(ctl.files[path ?? 'a.md']!));
    const pending = c.selectTreeFile('a.md');
    await c.overwrite();
    expect(writes).toEqual([
      { stamp: 200, path: 'b.md' },
      { stamp: undefined, path: 'b.md' },
    ]);
    slowA.resolve('A text');
    await pending;
  });
});

describe('controller checkExternal', () => {
  it('flags an external change and keeps the draft when the document is dirty', async () => {
    const read = vi.fn(async () => 'disk text');
    ctl.read = read;
    c.edit('local draft');
    ctl.stamps['a.md'] = 150;
    await c.checkExternal();
    expect(get().externalChange).toBe(true);
    expect(get().text).toBe('A text');
    expect(c.getDraft()).toBe('local draft');
    expect(read).not.toHaveBeenCalled();
  });

  it('reloads silently when the document is clean and the disk stamp changed', async () => {
    ctl.files['a.md'] = 'disk text';
    ctl.stamps['a.md'] = 150;
    await c.checkExternal();
    expect(get().externalChange).toBe(false);
    expect(get().text).toBe('disk text');
    expect(c.getDraft()).toBe('disk text');
  });

  it('does nothing when the disk stamp is unchanged', async () => {
    const read = vi.fn(async () => 'disk text');
    ctl.read = read;
    await c.checkExternal();
    expect(read).not.toHaveBeenCalled();
    expect(get().externalChange).toBe(false);
  });

  it('detects a change reported by a file handle watcher', async () => {
    const file = fakeFileHandle('watched.md', 'v1');
    await c.openFileHandle(file.handle);
    c.edit('v1 draft');
    file.changeOnDisk('v2');
    ctl.fileEvents!.onChange!();
    await flush();
    expect(get().externalChange).toBe(true);
    expect(get().text).toBe('v1');
  });
});

describe('controller file-url folder tree', () => {
  const docsUrl = 'file:///workspace/repo/docs/';
  const subUrl = 'file:///workspace/repo/docs/sub/';
  const otherUrl = 'file:///workspace/other/';

  beforeEach(() => {
    ctl.dirListings[docsUrl] = [
      { name: 'readme.md', url: `${docsUrl}readme.md`, isDir: false },
      { name: 'sub', url: subUrl, isDir: true },
      { name: 'image.png', url: `${docsUrl}image.png`, isDir: false },
      { name: '.dotfile.md', url: `${docsUrl}.dotfile.md`, isDir: false },
    ];
    ctl.dirListings[subUrl] = [{ name: 'nested.md', url: `${subUrl}nested.md`, isDir: false }];
    ctl.dirListings[otherUrl] = [{ name: 'other.md', url: `${otherUrl}other.md`, isDir: false }];
    ctl.repoRoots[docsUrl] = 'file:///workspace/repo/';
  });

  it('roots tree at parent folder on load, keeps tree on load inside root, and re-roots outside root', async () => {
    await c.load(`${docsUrl}readme.md`);
    await flush();

    expect(get().fileTree).not.toBeNull();
    expect(get().fileTree?.rootUrl).toBe(docsUrl);
    expect(get().docPath).toBe('readme.md');
    expect(get().fileTree?.nodes.map((n) => n.name)).toEqual(['sub', 'readme.md']);
    expect((get().fileTree?.nodes.find((n) => n.name === 'sub') as any)?.children).toBeNull();

    // Load file inside the current root: tree root is kept
    await c.load(`${docsUrl}sub/nested.md`);
    await flush();
    expect(get().fileTree?.rootUrl).toBe(docsUrl);
    expect(get().docPath).toBe('sub/nested.md');

    // Load file outside the current root: re-roots tree
    await c.load(`${otherUrl}other.md`);
    await flush();
    expect(get().fileTree?.rootUrl).toBe(otherUrl);
    expect(get().docPath).toBe('other.md');
  });

  it('expands a folder on expandFolder and sets inline error on failure', async () => {
    await c.load(`${docsUrl}readme.md`);
    await flush();
    await (c as any).expandFolder('sub');

    const subNode = get().fileTree?.nodes.find((n) => n.name === 'sub') as any;
    expect(subNode.children).toEqual([{ kind: 'file', name: 'nested.md', path: 'sub/nested.md' }]);

    // Error on failed expand
    ctl.dirThrows[subUrl] = true;
    await (c as any).expandFolder('sub');
    const failedSubNode = get().fileTree?.nodes.find((n) => n.name === 'sub') as any;
    expect(failedSubNode.error).toBe(true);
  });

  it('re-roots at parent and grafts loaded subtree on goUp', async () => {
    const repoUrl = 'file:///workspace/repo/';
    ctl.dirListings[repoUrl] = [
      { name: 'docs', url: docsUrl, isDir: true },
      { name: 'root.md', url: `${repoUrl}root.md`, isDir: false },
    ];

    await c.load(`${docsUrl}readme.md`);
    await flush();
    await (c as any).expandFolder('sub');

    await (c as any).goUp();
    expect(get().fileTree?.rootUrl).toBe(repoUrl);
    expect(get().docPath).toBe('docs/readme.md');

    const docsFolder = get().fileTree?.nodes.find((n) => n.name === 'docs') as any;
    expect(docsFolder).toBeDefined();
    expect(docsFolder.path).toBe('docs');
    expect(docsFolder.children.map((n: any) => n.path)).toEqual(['docs/sub', 'docs/readme.md']);
    const graftedSub = docsFolder.children.find((n: any) => n.name === 'sub');
    expect(graftedSub.children[0].path).toBe('docs/sub/nested.md');
  });

  it('no-ops on goUp when getParentUrl returns null', async () => {
    const rootFsUrl = 'file:///';
    ctl.dirListings[rootFsUrl] = [{ name: 'file.md', url: `${rootFsUrl}file.md`, isDir: false }];

    await c.load(`${rootFsUrl}file.md`);
    await flush();
    expect(get().fileTree?.rootUrl).toBe(rootFsUrl);

    await (c as any).goUp();
    expect(get().fileTree?.rootUrl).toBe(rootFsUrl);
  });

  it('clears fileTree on openFileHandle, openFolderHandle, drop, and non-file load', async () => {
    await c.load(`${docsUrl}readme.md`);
    await flush();
    expect(get().fileTree).not.toBeNull();

    // openFileHandle clears fileTree
    const fakeFile = fakeFileHandle('test.md', 'content');
    await c.openFileHandle(fakeFile.handle);
    expect(get().fileTree).toBeNull();

    // Reopen fileTree
    await c.load(`${docsUrl}readme.md`);
    await flush();
    expect(get().fileTree).not.toBeNull();

    // openFolderHandle clears fileTree
    await c.openFolderHandle({ name: 'root' } as FileSystemDirectoryHandle);
    expect(get().fileTree).toBeNull();

    // Reopen fileTree
    await c.load(`${docsUrl}readme.md`);
    await flush();
    expect(get().fileTree).not.toBeNull();

    // drop clears fileTree
    const item = {
      kind: 'file',
      getAsFileSystemHandle: async () => fakeFile.handle,
    } as unknown as DataTransferItem;
    await c.drop(item);
    expect(get().fileTree).toBeNull();

    // Reopen fileTree
    await c.load(`${docsUrl}readme.md`);
    await flush();
    expect(get().fileTree).not.toBeNull();

    // non-file load clears fileTree
    await c.load('https://example.com/test.md');
    expect(get().fileTree).toBeNull();
  });

  it('rebuilds fileTree and refreshes picker tree on settings change', async () => {
    const unmount = c.mount();
    try {
      await c.load(`${docsUrl}readme.md`);
      await flush();
      expect(get().fileTree?.nodes.some((n) => n.name === '.dotfile.md')).toBe(false);

      // Toggle showHiddenItems
      await useSettingsStore.getState().update({ general: { showHiddenItems: true } });
      await flush();
      expect(get().fileTree?.nodes.some((n) => n.name === '.dotfile.md')).toBe(true);

      // Switch to directorySource and verify picker refresh
      await c.openFolderHandle({ name: 'root' } as FileSystemDirectoryHandle);
      ctl.files['new.md'] = 'new file';
      await useSettingsStore.getState().update({ general: { showHiddenItems: false } });
      await flush();
      expect(get().treeNodes.some((n) => n.name === 'new.md')).toBe(true);
    } finally {
      unmount();
    }
  });

  it('rejects stale expand result via treeGen after a re-root', async () => {
    await c.load(`${docsUrl}readme.md`);
    await flush();

    const slowExpand = deferred<void>();
    ctl.slowDir[subUrl] = slowExpand;

    // Start expanding sub
    const pendingExpand = (c as any).expandFolder('sub');

    // While in flight, re-root by loading a file in otherUrl
    await c.load(`${otherUrl}other.md`);
    await flush();
    expect(get().fileTree?.rootUrl).toBe(otherUrl);

    // Resolve late expand
    slowExpand.resolve();
    await pendingExpand;

    // Tree in otherUrl was NOT modified by the stale expand
    expect(get().fileTree?.rootUrl).toBe(otherUrl);
    expect(get().fileTree?.nodes.map((n) => n.name)).toEqual(['other.md']);
  });

  it('recomputes repo root on goUp when leaving the repo and passes relative paths only', async () => {
    const parentUrl = 'file:///workspace/';
    const repoUrl = 'file:///workspace/repo/';
    ctl.repoRoots[repoUrl] = repoUrl;
    ctl.repoRoots[parentUrl] = null;
    ctl.dirListings[repoUrl] = [{ name: 'root.md', url: `${repoUrl}root.md`, isDir: false }];
    ctl.dirListings[parentUrl] = [
      { name: 'repo', url: repoUrl, isDir: true },
      { name: 'sibling.md', url: `${parentUrl}sibling.md`, isDir: false },
    ];

    await c.load(`${repoUrl}root.md`);
    await flush();
    expect(get().fileTree?.rootUrl).toBe(repoUrl);

    await (c as any).goUp();
    expect(get().fileTree?.rootUrl).toBe(parentUrl);
    expect(get().docPath).toBe('repo/root.md');
    // All node paths must be relative, never full URLs
    for (const node of get().fileTree!.nodes) {
      expect(node.path.startsWith('file://')).toBe(false);
    }
  });

  it('drops pending re-root when a newer load occurs inside the current tree', async () => {
    await c.load(`${docsUrl}readme.md`);
    await flush();
    expect(get().fileTree?.rootUrl).toBe(docsUrl);
    expect(get().docPath).toBe('readme.md');

    const slowOtherList = deferred<void>();
    ctl.slowDir[otherUrl] = slowOtherList;

    // Start load outside current tree (triggers re-root)
    void c.load(`${otherUrl}other.md`);

    // While re-root is pending, load file inside old tree
    ctl.dirListings[docsUrl] = [
      { name: 'readme.md', url: `${docsUrl}readme.md`, isDir: false },
      { name: 'second.md', url: `${docsUrl}second.md`, isDir: false },
    ];
    await c.load(`${docsUrl}second.md`);
    expect(get().fileTree?.rootUrl).toBe(docsUrl);
    expect(get().docPath).toBe('second.md');

    // Resolve late re-root for otherUrl
    slowOtherList.resolve();
    await flush();

    // Re-root must NOT have overwritten the tree
    expect(get().fileTree?.rootUrl).toBe(docsUrl);
    expect(get().docPath).toBe('second.md');
  });

  it('does not delay document loading while tree promise is in flight', async () => {
    const slowTree = deferred<void>();
    ctl.slowDir[otherUrl] = slowTree;

    const loadPromise = c.load(`${otherUrl}other.md`);
    await loadPromise;

    // Document text and loading state must be updated immediately
    expect(get().text).toBe('body of file:///workspace/other/other.md');
    expect(get().loading).toBe(false);

    slowTree.resolve();
    await flush();
    expect(get().fileTree?.rootUrl).toBe(otherUrl);
  });

  it('loads document and roots tree correctly for URLs with spaces, localhost, and fragments without throwing', async () => {
    const spaceUrl = 'file:///workspace/repo/docs/a%20b/';
    ctl.dirListings[spaceUrl] = [{ name: 'x.md', url: `${spaceUrl}x.md`, isDir: false }];
    ctl.repoRoots[spaceUrl] = 'file:///workspace/repo/';

    // Test with raw space in path
    await c.load('file:///workspace/repo/docs/a b/x.md');
    await flush();
    expect(get().text).toBe('body of file:///workspace/repo/docs/a b/x.md');
    expect(get().fileTree?.rootUrl).toBe(spaceUrl);
    expect(get().docPath).toBe('x.md');

    // Test with localhost
    await c.load('file://localhost/workspace/repo/docs/readme.md');
    await flush();
    expect(get().text).toBe('body of file://localhost/workspace/repo/docs/readme.md');
    expect(get().fileTree?.rootUrl).toBe(docsUrl);
    expect(get().docPath).toBe('readme.md');

    // Test with fragment/hash
    await c.load(`${docsUrl}readme.md#heading-1`);
    await flush();
    expect(get().text).toBe(`body of ${docsUrl}readme.md#heading-1`);
    expect(get().fileTree?.rootUrl).toBe(docsUrl);
    expect(get().docPath).toBe('readme.md');
  });

  it('stores repoRoot on fileTree and avoids redundant findRepoRoot on goUp', async () => {
    const parentUrl = 'file:///workspace/';
    const repoUrl = 'file:///workspace/repo/';
    ctl.repoRoots[repoUrl] = repoUrl;
    ctl.repoRoots[parentUrl] = null;
    ctl.dirListings[repoUrl] = [{ name: 'root.md', url: `${repoUrl}root.md`, isDir: false }];
    ctl.dirListings[parentUrl] = [
      { name: 'repo', url: repoUrl, isDir: true },
      { name: 'sibling.md', url: `${parentUrl}sibling.md`, isDir: false },
    ];

    await c.load(`${repoUrl}root.md`);
    await flush();
    expect(get().fileTree?.repoRoot).toBe(repoUrl);

    // Up leaves repo: searches repo root and updates fileTree.repoRoot to null
    await (c as any).goUp();
    expect(get().fileTree?.rootUrl).toBe(parentUrl);
    expect(get().fileTree?.repoRoot).toBeNull();

    // Another goUp from parentUrl when repoRoot is null must NOT call findRepoRoot again
    const rootFsUrl = 'file:///';
    ctl.dirListings[rootFsUrl] = [{ name: 'workspace', url: parentUrl, isDir: true }];
    const findRepoRootSpy = vi.spyOn(await import('../../src/source/file-url-tree'), 'findRepoRoot');
    findRepoRootSpy.mockClear();

    await (c as any).goUp();
    expect(findRepoRootSpy).not.toHaveBeenCalled();
    findRepoRootSpy.mockRestore();
  });

  it('keeps pending re-root winning over settings rebuild', async () => {
    const unmount = c.mount();
    try {
      await c.load(`${docsUrl}readme.md`);
      await flush();
      expect(get().fileTree?.rootUrl).toBe(docsUrl);

      const slowOther = deferred<void>();
      ctl.slowDir[otherUrl] = slowOther;

      // Start re-root by loading other.md
      void c.load(`${otherUrl}other.md`);

      // While re-root is pending, change a setting
      await useSettingsStore.getState().update({ general: { showHiddenItems: true } });
      await flush();

      // Resolve the pending re-root
      slowOther.resolve();
      await flush();

      // The new document's tree must be shown, not the old root
      expect(get().fileTree?.rootUrl).toBe(otherUrl);
      expect(get().docPath).toBe('other.md');
    } finally {
      unmount();
    }
  });

  it('drops a goUp started on the old tree when a re-root finishes first', async () => {
    await c.load(`${docsUrl}readme.md`);
    await flush();
    expect(get().fileTree?.rootUrl).toBe(docsUrl);

    const slowOther = deferred<void>();
    ctl.slowDir[otherUrl] = slowOther;
    const slowRepo = deferred<void>();
    ctl.slowDir['file:///workspace/repo/'] = slowRepo;

    void c.load(`${otherUrl}other.md`);
    const up = (c as any).goUp();

    slowOther.resolve();
    await flush();
    expect(get().fileTree?.rootUrl).toBe(otherUrl);

    slowRepo.resolve();
    await up;
    await flush();

    expect(get().fileTree?.rootUrl).toBe(otherUrl);
    expect(get().docPath).toBe('other.md');
  });
});
