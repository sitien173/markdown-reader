import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SaveConflictError } from '../../src/source/file-handle';

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
}));

vi.mock('../../src/source/directory', () => {
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
  return { DirectorySource };
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
