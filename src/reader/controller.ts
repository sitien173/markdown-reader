import { DirectorySource, type FileNode, type TreeNode } from '../source/directory';
import { dropFileIdentity, FileHandleSource, isValidMarkdownFile, SaveConflictError } from '../source/file-handle';
import { usableCapturedText } from '../source/captured-text';
import { FileUrlSource } from '../source/file-url';
import { isAllowedUrl, UrlSource } from '../source/url';
import { fileIntervalMs, httpIntervalMs } from '../source/watch';
import { createDraftSaver, draftKey, loadDraft } from '../store/drafts';
import { storeHandle } from '../store/handles';
import { addRecentUrl, getRecentEntries, type RecentItem } from '../store/recent';
import { useSettingsStore } from '../store/settings-store';
import { createReaderStore, type Mode, type ReaderStore } from '../store/reader-store';

type Active = FileHandleSource | FileUrlSource | UrlSource | DirectorySource;

function findFirstFile(nodes: TreeNode[]): FileNode | null {
  for (const node of nodes) {
    if (node.kind === 'file') return node;
    if (node.kind === 'directory') {
      const found = findFirstFile(node.children);
      if (found) return found;
    }
  }
  return null;
}

const baseName = (path: string) => path.split('/').pop() || path;
function urlTitle(url: string) {
  try {
    return baseName(decodeURIComponent(new URL(url).pathname)) || new URL(url).host;
  } catch {
    return url;
  }
}

const isAbort = (e: unknown) => e instanceof DOMException && e.name === 'AbortError';

/**
 * One controller and one store per App mount; the store is seeded from the URL. Guard state (generation counter, committed source, stamp, watcher)
 * lives in this closure; every awaited resume point re-checks it through isCurrent.
 */
export function createController(store: ReaderStore = createReaderStore(), notify: (message: string) => void = () => undefined) {
  const set = store.setState;
  const state = store.getState;
  let draft = '';
  let saver: ReturnType<typeof createDraftSaver> | null = null;
  let sourceId = '';
  let sourceGen = 0;
  let treeGen = 0;
  let active: Active | null = null;
  let unwatch: (() => void) | null = null;
  let stamp: number | null = null;
  let disposed = false;
  let started = false;

  function isLive(gen: number) {
    return !disposed && gen === sourceGen;
  }

  function isCurrent(gen: number, expected: Active | null, id: string) {
    return isLive(gen) && expected === active && id === sourceId;
  }

  function stopWatch() {
    unwatch?.();
    unwatch = null;
  }

  function applyText(value: string, id: string, title?: string, loading?: boolean) {
    sourceId = id;
    draft = value;
    set((s) => ({
      dirty: false,
      text: value,
      mountText: value,
      loadId: s.loadId + 1,
      sourceId: id,
      docTitle: title ?? s.docTitle,
      ...(loading === undefined ? {} : { loading }),
    }));
    saver?.cancel();
    const storageKey = draftKey(id);
    saver = createDraftSaver(browser.storage.local, storageKey, 1000);
    const gen = sourceGen;
    void loadDraft(browser.storage.local, storageKey)
      .then((stored) => {
        if (gen !== sourceGen || sourceId !== id) return;
        if (state().dirty) return;
        if (stored === undefined || stored === value) return;
        draft = stored;
        set((s) => ({ dirty: true, text: stored, mountText: stored, loadId: s.loadId + 1 }));
      })
      .catch(() => undefined);
  }

  /** Starts the watcher that fits the active source and the current auto-refresh settings. */
  function startWatch() {
    stopWatch();
    const current = active;
    if (!current) return;
    const { autoRefresh, autoRefreshRemote, autoRefreshIntervalSec } = useSettingsStore.getState().settings.general;
    const intervalMs = fileIntervalMs(autoRefreshIntervalSec);
    const onChange = () => {
      if (useSettingsStore.getState().settings.general.autoRefresh) void checkExternal();
    };
    if (current instanceof DirectorySource) {
      unwatch = current.watch({
        intervalMs,
        onTreeChange: () => {
          const gen = ++treeGen;
          void current
            .getTree()
            .then((t) => {
              if (gen !== treeGen || active !== current) return;
              set({ treeNodes: t });
            })
            .catch(() => undefined);
        },
        onChange,
        onDeleted: () => notify('The folder was deleted or is no longer accessible.'),
      });
    } else if (current instanceof FileHandleSource) {
      unwatch = current.watch({
        intervalMs,
        onChange,
        onDeleted: () => notify('The file was deleted from disk. Your draft is still in the editor.'),
      });
    } else if (current instanceof FileUrlSource) {
      if (autoRefresh)
        unwatch = current.watch({
          intervalMs,
          onChange,
          onDeleted: () => notify('The file was deleted from disk. Your draft is still in the editor.'),
        });
    } else if (autoRefresh && autoRefreshRemote) {
      unwatch = current.watch({ intervalMs: httpIntervalMs(autoRefreshIntervalSec), onChange, onDeleted: () => undefined });
    }
  }

  function setActive(next: FileHandleSource | FileUrlSource | UrlSource | null) {
    stopWatch();
    active = next;
    set({ writable: next instanceof FileHandleSource, externalChange: false });
    startWatch();
  }

  function setActiveDirectory(dirSource: DirectorySource, filePath: string | null) {
    stopWatch();
    active = dirSource;
    set({ writable: Boolean(filePath), externalChange: false });
    startWatch();
  }

  async function refreshRecents() {
    try {
      set({ recents: await getRecentEntries() });
    } catch {
      // IDB or storage error fallback
    }
  }

  async function checkExternal() {
    const current = active;
    if (!current) return;
    const gen = sourceGen,
      id = sourceId;
    if (current instanceof FileHandleSource || current instanceof DirectorySource) {
      const diskStamp = await current.diskStamp();
      if (!isCurrent(gen, current, id)) return;
      if (diskStamp === stamp) return;
    }
    if (state().dirty) {
      set({ externalChange: true });
      return;
    }
    await reloadFromDisk(false);
  }

  async function reloadFromDisk(discardDraft: boolean) {
    const current = active;
    if (!current) return;
    const id = sourceId;
    const gen = sourceGen;
    if (discardDraft) {
      const discarded = draft;
      saver?.cancel();
      await browser.storage.local.remove(draftKey(id));
      if (!isCurrent(gen, current, id)) return;
      // Edits typed while the draft was being removed are newer than the reload request; keep them.
      if (draft !== discarded) {
        set({ externalChange: true });
        return;
      }
      set({ dirty: false });
    }
    const value = await current.read();
    if (gen !== sourceGen || current !== active || id !== sourceId) return;
    if (state().dirty) {
      set({ externalChange: true });
      return;
    }
    if (current instanceof FileHandleSource || current instanceof DirectorySource) {
      const diskStamp = await current.diskStamp();
      if (!isCurrent(gen, current, id)) return;
      if (state().dirty) {
        set({ externalChange: true });
        return;
      }
      stamp = diskStamp;
    }
    set({ externalChange: false });
    applyText(value, id);
  }

  async function save() {
    const current = active;
    if (!(current instanceof FileHandleSource || current instanceof DirectorySource) || stamp === null) return;
    const written = draft;
    const gen = sourceGen,
      id = sourceId;
    try {
      const next = await current.write(written, stamp, state().docPath ?? undefined);
      if (!isCurrent(gen, current, id)) return;
      stamp = next;
      if (draft === written) {
        set({ dirty: false, conflict: false, externalChange: false });
        notify('Saved');
        saver?.cancel();
        await browser.storage.local.remove(draftKey(id));
        if (!isCurrent(gen, current, id)) return;
      }
    } catch (e) {
      if (!isCurrent(gen, current, id)) return;
      if (e instanceof SaveConflictError) set({ conflict: true });
      else set({ error: e instanceof Error ? e.message : 'Unable to save the file' });
    }
  }

  async function overwrite() {
    const current = active;
    if (!(current instanceof FileHandleSource || current instanceof DirectorySource)) return;
    set({ conflict: false });
    const written = draft;
    const gen = sourceGen,
      id = sourceId;
    try {
      const next = await current.write(written, undefined, state().docPath ?? undefined);
      if (!isCurrent(gen, current, id)) return;
      stamp = next;
      if (draft === written) {
        set({ dirty: false, externalChange: false });
        notify('Saved');
        saver?.cancel();
        await browser.storage.local.remove(draftKey(id));
        if (!isCurrent(gen, current, id)) return;
      }
    } catch (e) {
      if (isCurrent(gen, current, id)) set({ error: e instanceof Error ? e.message : 'Unable to save the file' });
    }
  }

  async function load(url: string) {
    const gen = ++sourceGen;
    const loadId = url;
    sourceId = url;
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      set({ error: 'Invalid URL', text: null });
      return;
    }
    if (!isAllowedUrl(url)) {
      set({ error: 'This URL scheme is not supported', text: null });
      return;
    }
    stopWatch();
    active = null;
    set({ writable: false, externalChange: false, directorySource: null, docPath: null, headings: [], source: url });
    window.history.replaceState(null, '', `?src=${encodeURIComponent(url)}&mode=${state().mode}`);
    set({ loading: true, error: '', text: null });
    try {
      const key = `markdown-reader:${url}`;
      const saved = await browser.storage.session.get(key);
      if (!isCurrent(gen, null, loadId)) return;
      const entry = saved[key];
      await browser.storage.session.remove(key);
      if (!isCurrent(gen, null, loadId)) return;
      const { charsetCompat } = useSettingsStore.getState().settings.general;
      const fileSource = parsed.protocol === 'file:' ? new FileUrlSource(url, charsetCompat) : null;
      // Captured page text is already decoded by the browser, so charset compatibility re-reads the file bytes instead.
      const capturedText = fileSource && charsetCompat ? undefined : usableCapturedText(entry, url);
      const source = fileSource ?? new UrlSource(url, charsetCompat);
      const value = capturedText ?? (await source.read());
      if (!isCurrent(gen, null, loadId)) return;
      applyText(value, url, urlTitle(url), false);
      setActive(source);
      void addRecentUrl(url)
        .then(() => refreshRecents())
        .catch(() => undefined);
    } catch (e) {
      if (isCurrent(gen, null, loadId)) set({ error: e instanceof Error ? e.message : 'Unable to fetch Markdown' });
    } finally {
      if (gen === sourceGen) set({ loading: false });
    }
  }

  async function openFileHandle(handle: FileSystemFileHandle) {
    const gen = ++sourceGen;
    set({ loading: false });
    const previous = active,
      previousId = sourceId;
    try {
      const picked = new FileHandleSource(handle);
      const value = await picked.read();
      if (!isCurrent(gen, previous, previousId)) return;
      const diskStamp = await picked.diskStamp();
      if (!isCurrent(gen, previous, previousId)) return;
      stopWatch();
      active = null;
      set({ writable: false, externalChange: false, directorySource: null, docPath: null });
      stamp = diskStamp;
      setActive(picked);
      set({ source: '' });
      applyText(value, picked.identity, handle.name);
      set({ error: '', headings: [] });
      void storeHandle(handle.name, 'file', handle).catch(() => undefined);
      void refreshRecents();
    } catch (e) {
      if (gen === sourceGen && !isAbort(e)) set({ error: e instanceof Error ? e.message : 'Unable to open file' });
    }
  }

  async function openFile() {
    try {
      const picked = new FileHandleSource();
      await picked.pick();
      const handle = (picked as any).handle as FileSystemFileHandle | undefined;
      if (handle) {
        await openFileHandle(handle);
      }
    } catch (e) {
      if (!isAbort(e)) set({ error: e instanceof Error ? e.message : 'Unable to open file' });
    }
  }

  async function openFolderHandle(handle: FileSystemDirectoryHandle) {
    const gen = ++sourceGen;
    set({ loading: false });
    const previous = active,
      previousId = sourceId;
    try {
      void storeHandle(handle.name, 'folder', handle).catch(() => undefined);
      const dirSource = new DirectorySource(handle);
      const tree = await dirSource.getTree();
      if (!isCurrent(gen, previous, previousId)) return;

      const first = findFirstFile(tree);
      stopWatch();
      active = null;
      set({
        writable: false,
        externalChange: false,
        directorySource: dirSource,
        treeNodes: tree,
        source: '',
        error: '',
        headings: [],
      });

      if (first) {
        const textValue = await dirSource.read(first.path);
        if (!isLive(gen)) return;
        const diskStamp = await dirSource.diskStamp(first.path);
        if (!isLive(gen)) return;
        stamp = diskStamp;
        set({ docPath: first.path });
        setActiveDirectory(dirSource, first.path);
        applyText(textValue, dirSource.identity, baseName(first.path));
      } else {
        set({ docPath: null });
        setActiveDirectory(dirSource, null);
        applyText('', `folder:${handle.name}:empty`, handle.name);
      }
      void refreshRecents();
    } catch (e) {
      if (gen === sourceGen && !isAbort(e)) set({ error: e instanceof Error ? e.message : 'Unable to open folder' });
    }
  }

  async function openFolder() {
    const picker = (window as unknown as { showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker;
    if (!picker) {
      set({ error: 'Directory picker is not available' });
      return;
    }
    try {
      const handle = await picker();
      await openFolderHandle(handle);
    } catch (e) {
      if (!isAbort(e)) set({ error: e instanceof Error ? e.message : 'Unable to open folder' });
    }
  }

  async function selectTreeFile(filePath: string) {
    const directorySource = state().directorySource;
    if (!directorySource) return;
    const gen = ++sourceGen;
    const previous = active,
      previousId = sourceId;
    try {
      const textValue = await directorySource.read(filePath);
      if (!isCurrent(gen, previous, previousId)) return;
      const diskStamp = await directorySource.diskStamp(filePath);
      if (!isCurrent(gen, previous, previousId)) return;
      stamp = diskStamp;
      set({ docPath: filePath });
      setActiveDirectory(directorySource, filePath);
      applyText(textValue, directorySource.identity, baseName(filePath));
      set({ headings: [], error: '' });
    } catch (e) {
      if (isCurrent(gen, previous, previousId)) set({ error: e instanceof Error ? e.message : 'Unable to open file' });
    }
  }

  async function handleOpenRecent(item: RecentItem) {
    if (item.kind === 'handle') {
      if (item.entry.type === 'folder') {
        await openFolderHandle(item.entry.handle as FileSystemDirectoryHandle);
      } else {
        await openFileHandle(item.entry.handle as FileSystemFileHandle);
      }
    } else {
      await load(item.url);
    }
  }

  async function drop(item: DataTransferItem | undefined) {
    if (!item) return;
    const gen = ++sourceGen;
    set({ loading: false });
    const previous = active,
      previousId = sourceId;
    try {
      const file = await FileHandleSource.fromDrop(item);
      if (!isCurrent(gen, previous, previousId)) return;
      if (file) {
        if (!isValidMarkdownFile(file.name)) {
          set({ error: 'Only Markdown files (.md, .markdown) are supported' });
          return;
        }
        const value = await file.text();
        if (!isCurrent(gen, previous, previousId)) return;
        stopWatch();
        active = null;
        set({ writable: false, externalChange: false });
        setActive(null);
        set({ directorySource: null, docPath: null, headings: [] });
        applyText(value, dropFileIdentity(file), file.name);
        set({ source: '', error: '' });
      }
    } catch (e) {
      if (isCurrent(gen, previous, previousId)) set({ error: e instanceof Error ? e.message : 'Unable to open file' });
    }
  }

  function dismissError() {
    set({ error: '' });
  }

  /** Keystroke path: no React state beyond the one-time dirty flip. */
  function edit(value: string) {
    draft = value;
    if (!state().dirty) set({ dirty: true });
    saver?.update(value);
  }

  function setMode(next: Mode) {
    if (next !== 'edit') set({ mountText: draft });
    set({ text: draft, mode: next });
    const url = new URL(window.location.href);
    url.searchParams.set('mode', next);
    window.history.replaceState(null, '', url.toString());
  }

  /** Stops the watcher and draft saver and drops in-flight work. Safe to follow with mount(), as StrictMode does. */
  function dispose() {
    disposed = true;
    stopWatch();
    saver?.cancel();
  }

  /** Starts the mount: recents and the initial source load once per controller, plus pagehide cleanup. Returns the unmount cleanup. */
  function mount() {
    disposed = false;
    window.addEventListener('pagehide', stopWatch);
    const unsubscribe = useSettingsStore.subscribe((next, prev) => {
      const a = next.settings.general;
      const b = prev.settings.general;
      if (
        a.autoRefresh !== b.autoRefresh ||
        a.autoRefreshRemote !== b.autoRefreshRemote ||
        a.autoRefreshIntervalSec !== b.autoRefreshIntervalSec
      )
        startWatch();
    });
    if (!started) {
      started = true;
      void refreshRecents();
      const initial = state().source;
      if (initial) void load(initial);
    }
    return () => {
      window.removeEventListener('pagehide', stopWatch);
      unsubscribe();
      dispose();
    };
  }

  return {
    store,
    notify,
    mount,
    dismissError,
    load,
    openFile,
    openFileHandle,
    openFolder,
    openFolderHandle,
    selectTreeFile,
    save,
    overwrite,
    reloadFromDisk,
    checkExternal,
    drop,
    handleOpenRecent,
    refreshRecents,
    edit,
    setMode,
    getDraft: () => draft,
  };
}

export type ReaderController = ReturnType<typeof createController>;
