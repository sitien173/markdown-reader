import { act, forwardRef, StrictMode, useImperativeHandle } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SaveConflictError } from '../../src/source/file-handle';

type Deferred<T> = { promise: Promise<T>; resolve(value: T): void; reject(error: unknown): void };
function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void, reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

// Controls shared with the module mocks below. Tests reassign these per case.
const ctl = vi.hoisted(() => ({
  files: {} as Record<string, string>,
  stamps: {} as Record<string, number>,
  write: undefined as unknown as (text: string, expectedStamp?: number, path?: string) => Promise<number>,
  read: undefined as unknown as (path?: string) => Promise<string>,
  events: undefined as undefined | { onChange?: () => void },
  recents: [] as unknown[],
  permission: undefined as unknown as () => Promise<string>,
  unwatch: undefined as unknown as () => void,
  dirListings: {} as Record<string, Array<{ name: string; url: string; isDir: boolean }>>,
  repoRoots: {} as Record<string, string | null>,
  dirThrows: {} as Record<string, boolean>,
}));

vi.mock('../../src/source/file-url-tree', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/source/file-url-tree')>();
  return {
    ...actual,
    listDirectory: vi.fn(async (url: string) => {
      const norm = url.endsWith('/') ? url : `${url}/`;
      if (ctl.dirThrows?.[norm] || ctl.dirThrows?.[url]) throw new Error('Directory access failed');
      return ctl.dirListings?.[norm] ?? ctl.dirListings?.[url] ?? [];
    }),
    findRepoRoot: vi.fn(async (url: string) => {
      const norm = url.endsWith('/') ? url : `${url}/`;
      return ctl.repoRoots?.[norm] !== undefined ? ctl.repoRoots?.[norm] : (ctl.repoRoots?.[url] ?? null);
    }),
    fetchGitignore: vi.fn(async () => ''),
  };
});

vi.mock('../../src/source/directory', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/source/directory')>();
  class DirectorySource {
    currentPath: string | null = null;
    private readToken = 0;
    constructor(public root: unknown) {}
    async getTree() {
      return Object.keys(ctl.files).map((path) => ({ kind: 'file', name: path, path }));
    }
    get identity() {
      return `folder:root:${this.currentPath ?? ''}`;
    }
    // Mirrors the real source: the latest read wins and commits the path.
    async read(path?: string) {
      const target = path ?? this.currentPath ?? undefined;
      const token = ++this.readToken;
      const value = await ctl.read(target);
      if (token === this.readToken && target) this.currentPath = target;
      return value;
    }
    async diskStamp(path?: string) {
      return ctl.stamps[path ?? this.currentPath ?? ''] ?? null;
    }
    write(text: string, expectedStamp?: number, path?: string) {
      return ctl.write(text, expectedStamp, path);
    }
    watch(events: { onChange?: () => void }) {
      ctl.events = events;
      return ctl.unwatch;
    }
  }
  return { ...actual, DirectorySource };
});
vi.mock('../../src/store/handles', () => ({
  storeHandle: vi.fn(async () => undefined),
  requestHandlePermission: vi.fn(() => ctl.permission()),
}));
vi.mock('../../src/store/recent', () => ({
  addRecentUrl: vi.fn(async () => undefined),
  getRecentEntries: vi.fn(async () => ctl.recents),
}));
vi.mock('../../src/ui/markdown-view', () => ({
  MarkdownView: forwardRef<{ update(text: string): void; ready(): Promise<void> }, { text: string }>(function MarkdownView({ text }, ref) {
    useImperativeHandle(ref, () => ({ update: () => undefined, ready: async () => undefined }));
    return <div data-testid="markdown">{text}</div>;
  }),
}));
vi.mock('../../src/ui/editor-pane', () => ({
  EditorPane: ({ initialText, onChange }: { initialText: string; onChange(text: string): void }) => (
    <textarea data-testid="editor" defaultValue={initialText} onInput={(e) => onChange((e.target as HTMLTextAreaElement).value)} />
  ),
}));

import App from '../../src/entrypoints/reader/App';

let container: HTMLElement;
let root: Root;

async function flush() {
  for (let i = 0; i < 5; i++)
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
}
const byText = (selector: string, text: string) =>
  Array.from(container.ownerDocument.querySelectorAll<HTMLElement>(selector)).find((el) => el.textContent?.trim() === text);
async function click(el: HTMLElement | undefined) {
  if (!el) throw new Error('element not found');
  await act(async () => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  });
  await flush();
}
async function showFilesTab() {
  const tab = container.ownerDocument.querySelector<HTMLElement>('[aria-label="Sidebar view"] [aria-label="Files"]')!;
  await act(async () => {
    tab.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  });
  await flush();
}
const editor = () => container.querySelector<HTMLTextAreaElement>('[data-testid="editor"]')!;
async function type(value: string) {
  await act(async () => {
    const field = editor();
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(field, value);
    field.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
const status = () =>
  Array.from(container.ownerDocument.querySelectorAll('[role="status"], [data-slot="toast-viewport"]'))
    .map((el) => el.textContent)
    .join('|');

async function openFolder() {
  await showFilesTab();
  await click(byText('button', 'Open folder'));
}

beforeEach(async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  ctl.files = { 'a.md': 'A text', 'b.md': 'B text' };
  ctl.stamps = { 'a.md': 100, 'b.md': 200 };
  ctl.read = async (path) => ctl.files[path ?? 'a.md']!;
  ctl.write = async () => 999;
  ctl.events = undefined;
  ctl.recents = [];
  ctl.permission = async () => 'granted';
  ctl.unwatch = vi.fn();
  ctl.dirListings = {};
  ctl.repoRoots = {};
  ctl.dirThrows = {};
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const norm = url.endsWith('/') ? url : `${url}/`;
      if (ctl.dirThrows?.[norm] || ctl.dirThrows?.[url]) throw new TypeError('Directory access failed');
      const entries = ctl.dirListings?.[norm] ?? ctl.dirListings?.[url];
      if (entries) {
        const html = entries
          .map((e) => `<script>addRow(${JSON.stringify(e.name)},${JSON.stringify(e.name)},${e.isDir ? 1 : 0},0,"",0,"");</script>`)
          .join('\n');
        return new Response(html, { status: 200 });
      }
      return new Response(`# Content of ${url}`);
    }),
  );
  const local = { get: vi.fn(async () => ({})), set: vi.fn(async () => undefined), remove: vi.fn(async () => undefined) };
  vi.stubGlobal('browser', { storage: { local, session: { get: vi.fn(async () => ({})), remove: vi.fn(async () => undefined) } } });
  (window as unknown as { showDirectoryPicker: unknown }).showDirectoryPicker = vi.fn(async () => ({ name: 'root' }));
  window.history.replaceState(null, '', '/?mode=split');
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    root.render(<App />);
  });
  await flush();
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
  vi.unstubAllGlobals();
});

describe('reader App race paths', () => {
  it('writes to the committed path and ignores a late save result after selecting another tree file', async () => {
    const writes: Array<{ text: string; stamp: number | undefined; path: string | undefined }> = [];
    const firstWrite = deferred<number>();
    ctl.write = (text, stamp, path) => {
      writes.push({ text, stamp, path });
      return writes.length === 1 ? firstWrite.promise : Promise.resolve(300);
    };
    await openFolder();
    expect(byText('[data-testid="markdown"]', 'A text')).toBeTruthy();

    await type('A edited');
    await click(byText('button', 'Save'));
    expect(writes).toEqual([{ text: 'A edited', stamp: 100, path: 'a.md' }]);

    await click(byText('button', 'b.md'));
    expect(byText('[data-testid="markdown"]', 'B text')).toBeTruthy();

    // The late result for a.md must not replace the stamp that belongs to b.md.
    await act(async () => {
      firstWrite.resolve(999);
    });
    await flush();
    await type('B edited');
    await click(byText('button', 'Save'));
    expect(writes[1]).toEqual({ text: 'B edited', stamp: 200, path: 'b.md' });
  });

  it('keeps edits typed while a reload from disk is in flight', async () => {
    await openFolder();
    const reload = deferred<string>();
    ctl.read = () => reload.promise;
    ctl.stamps['a.md'] = 150;
    await act(async () => {
      ctl.events!.onChange!();
    });
    await flush();

    await type('typed during reload');
    await act(async () => {
      reload.resolve('disk text');
    });
    await flush();

    expect(editor().value).toBe('typed during reload');
    expect(status()).toContain('File changed on disk');
  });

  it('overwrites the committed path with no expected stamp after a conflict', async () => {
    const writes: Array<{ stamp: number | undefined; path: string | undefined }> = [];
    ctl.write = async (_text, stamp, path) => {
      writes.push({ stamp, path });
      if (stamp !== undefined) throw new SaveConflictError();
      return 400;
    };
    await openFolder();
    await click(byText('button', 'b.md'));
    await type('B edited');
    await click(byText('button', 'Save'));
    expect(byText('[role="dialog"] h2', 'File changed on disk')).toBeTruthy();

    await click(byText('[role="dialog"] button', 'Overwrite'));
    expect(writes).toEqual([
      { stamp: 200, path: 'b.md' },
      { stamp: undefined, path: 'b.md' },
    ]);
    expect(container.ownerDocument.querySelector('[role="dialog"]:not([data-slot="toast"])')).toBeNull();
    expect(status()).not.toContain('Unsaved changes');
  });

  it('leaves content and dirty state unchanged when the conflict dialog is cancelled', async () => {
    const write = vi.fn(async () => {
      throw new SaveConflictError();
    });
    ctl.write = write;
    await openFolder();
    await type('A edited');
    await click(byText('button', 'Save'));
    expect(byText('[role="dialog"] button', 'Cancel')).toBeTruthy();

    await click(byText('[role="dialog"] button', 'Cancel'));
    expect(container.ownerDocument.querySelector('[role="dialog"]:not([data-slot="toast"])')).toBeNull();
    expect(write).toHaveBeenCalledTimes(1);
    expect(editor().value).toBe('A edited');
    expect(status()).toContain('Unsaved changes');
    expect(byText('button', 'Save')!.hasAttribute('disabled')).toBe(false);
  });

  it('announces the error when Reconnect throws', async () => {
    ctl.recents = [
      {
        kind: 'handle',
        id: 'h1',
        title: 'notes',
        entry: { id: 'h1', name: 'notes', type: 'folder', handle: {}, permission: 'prompt', requiresReconnect: true },
      },
    ];
    ctl.permission = async () => {
      throw new Error('Permission prompt failed');
    };
    window.history.replaceState(null, '', '/');
    await act(async () => {
      root.render(<App key="recents" />);
    });
    await flush();
    await showFilesTab();

    await click(byText('button', 'Reconnect'));
    expect(status()).toContain('Permission prompt failed');
  });
});

describe('reader App store scope and StrictMode', () => {
  it("keeps state per mount: a second App instance does not see the first one's document", async () => {
    await openFolder();
    expect(byText('[data-testid="markdown"]', 'A text')).toBeTruthy();

    const second = document.createElement('div');
    document.body.append(second);
    const secondRoot = createRoot(second);
    await act(async () => {
      secondRoot.render(<App />);
    });
    await flush();
    expect(second.querySelector('[data-testid="markdown"]')).toBeNull();
    expect(container.querySelector('[data-testid="markdown"]')?.textContent).toBe('A text');

    await act(async () => {
      secondRoot.unmount();
    });
    second.remove();
    expect(container.querySelector('[data-testid="markdown"]')?.textContent).toBe('A text');
  });

  it('loads the initial source once under StrictMode and keeps the loaded state', async () => {
    const url = 'https://e.test/doc.md';
    const fetchMock = vi.fn(async () => new Response('# Fetched body'));
    vi.stubGlobal('fetch', fetchMock);
    const sessionGet = vi.fn(async () => ({}));
    const local = { get: vi.fn(async () => ({})), set: vi.fn(async () => undefined), remove: vi.fn(async () => undefined) };
    vi.stubGlobal('browser', { storage: { local, session: { get: sessionGet, remove: vi.fn(async () => undefined) } } });
    window.history.replaceState(null, '', `/?src=${encodeURIComponent(url)}&mode=read`);
    await act(async () => {
      root.render(
        <StrictMode>
          <App key="strict" />
        </StrictMode>,
      );
    });
    await flush();
    expect(sessionGet).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[data-testid="markdown"]')?.textContent).toBe('# Fetched body');
  });

  it('stops the watcher on unmount under StrictMode and keeps it while mounted', async () => {
    await act(async () => {
      root.render(
        <StrictMode>
          <App key="strict-watch" />
        </StrictMode>,
      );
    });
    await flush();
    await openFolder();
    expect(ctl.events).toBeDefined();
    expect(ctl.unwatch).not.toHaveBeenCalled();
    await act(async () => {
      root.render(<div />);
    });
    expect(ctl.unwatch).toHaveBeenCalled();
  });
});

describe('reader App file-url tree UI', () => {
  const docsUrl = 'file:///workspace/project/docs/';
  const subUrl = 'file:///workspace/project/docs/sub/';

  it('renders root folder name and Up button in FilesPanel, disabled at filesystem root', async () => {
    ctl.dirListings[docsUrl] = [{ name: 'readme.md', url: `${docsUrl}readme.md`, isDir: false }];
    window.history.replaceState(null, '', `/?src=${encodeURIComponent(`${docsUrl}readme.md`)}&mode=read`);
    await act(async () => {
      root.render(<App key="file-tree-header" />);
    });
    await flush();
    await showFilesTab();

    expect(byText('.reader-folder-actions span', 'docs')).toBeTruthy();
    const upBtn = container.querySelector<HTMLButtonElement>('button[aria-label="Up one level"]');
    expect(upBtn).toBeTruthy();
    expect(upBtn?.disabled).toBe(false);

    // Now test at filesystem root
    const rootFsUrl = 'file:///';
    ctl.dirListings[rootFsUrl] = [{ name: 'root.md', url: `${rootFsUrl}root.md`, isDir: false }];
    window.history.replaceState(null, '', `/?src=${encodeURIComponent(`${rootFsUrl}root.md`)}&mode=read`);
    await act(async () => {
      root.render(<App key="file-tree-fs-root" />);
    });
    await flush();
    await showFilesTab();

    const upBtnAtRoot = container.querySelector<HTMLButtonElement>('button[aria-label="Up one level"]');
    expect(upBtnAtRoot).toBeTruthy();
    expect(upBtnAtRoot?.disabled).toBe(true);
  });

  it('loads clicked file from fileTree', async () => {
    ctl.dirListings[docsUrl] = [
      { name: 'readme.md', url: `${docsUrl}readme.md`, isDir: false },
      { name: 'other.md', url: `${docsUrl}other.md`, isDir: false },
    ];
    window.history.replaceState(null, '', `/?src=${encodeURIComponent(`${docsUrl}readme.md`)}&mode=read`);
    await act(async () => {
      root.render(<App key="file-click" />);
    });
    await flush();
    await showFilesTab();

    await click(byText('button', 'other.md'));
    expect(byText('[data-testid="markdown"]', `# Content of ${docsUrl}other.md`)).toBeTruthy();
  });

  it('expands unloaded folder on open and renders children', async () => {
    ctl.dirListings[docsUrl] = [
      { name: 'readme.md', url: `${docsUrl}readme.md`, isDir: false },
      { name: 'sub', url: subUrl, isDir: true },
    ];
    ctl.dirListings[subUrl] = [{ name: 'nested.md', url: `${subUrl}nested.md`, isDir: false }];
    window.history.replaceState(null, '', `/?src=${encodeURIComponent(`${docsUrl}readme.md`)}&mode=read`);
    await act(async () => {
      root.render(<App key="folder-expand" />);
    });
    await flush();
    await showFilesTab();

    expect(byText('span', 'nested.md')).toBeFalsy();
    const toggleBtn = container.querySelector<HTMLButtonElement>('button[aria-label="Toggle sub"]');
    expect(toggleBtn).toBeTruthy();
    await click(toggleBtn!);
    expect(byText('span', 'nested.md')).toBeTruthy();
  });

  it('renders inline error when expandFolder fails', async () => {
    ctl.dirListings[docsUrl] = [
      { name: 'readme.md', url: `${docsUrl}readme.md`, isDir: false },
      { name: 'sub', url: subUrl, isDir: true },
    ];
    ctl.dirThrows[subUrl] = true;
    window.history.replaceState(null, '', `/?src=${encodeURIComponent(`${docsUrl}readme.md`)}&mode=read`);
    await act(async () => {
      root.render(<App key="expand-error" />);
    });
    await flush();
    await showFilesTab();

    const toggleBtn = container.querySelector<HTMLButtonElement>('button[aria-label="Toggle sub"]');
    await click(toggleBtn!);
    expect(byText('[data-slot="file-tree-error"]', 'Could not read folder')).toBeTruthy();
  });

  it('shows file access hint when file access is off', async () => {
    ctl.dirThrows[docsUrl] = true;
    window.history.replaceState(null, '', `/?src=${encodeURIComponent(`${docsUrl}readme.md`)}&mode=read`);
    await act(async () => {
      root.render(<App key="access-off" />);
    });
    await flush();
    await showFilesTab();

    expect(byText('p', 'No folder opened.')).toBeTruthy();
    expect(byText('p', 'Allow access to file URLs must be enabled.')).toBeTruthy();
  });

  it('hides the Contents toggle and shows the Files panel for a JSON document', async () => {
    window.history.replaceState(null, '', '/?src=https%3A%2F%2Fexample.com%2Fdoc.json&mode=read');
    await act(async () => {
      root.render(<App key="json-sidebar" />);
    });
    await flush();

    // Contents toggle item is absent
    const contentsToggle = container.ownerDocument.querySelector('[aria-label="Sidebar view"] [aria-label="Outline"]');
    expect(contentsToggle).toBeNull();

    // Files toggle item is present
    const filesToggle = container.ownerDocument.querySelector('[aria-label="Sidebar view"] [aria-label="Files"]');
    expect(filesToggle).not.toBeNull();

    // Files panel is rendered
    expect(container.ownerDocument.querySelector('.reader-files-empty')).not.toBeNull();
  });

  it('shows both Contents and Files toggles for a Markdown document', async () => {
    window.history.replaceState(null, '', '/?src=https%3A%2F%2Fexample.com%2Fdoc.md&mode=read');
    await act(async () => {
      root.render(<App key="md-sidebar" />);
    });
    await flush();

    const contentsToggle = container.ownerDocument.querySelector('[aria-label="Sidebar view"] [aria-label="Outline"]');
    expect(contentsToggle).not.toBeNull();

    const filesToggle = container.ownerDocument.querySelector('[aria-label="Sidebar view"] [aria-label="Files"]');
    expect(filesToggle).not.toBeNull();
  });
});
