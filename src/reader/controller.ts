import { compareTreeNodes, DirectorySource, type FileNode, type TreeNode } from '../source/directory';
import { dropFileIdentity, FileHandleSource, isValidMarkdownFile, SaveConflictError } from '../source/file-handle';
import { usableCapturedText } from '../source/captured-text';
import { FileUrlSource } from '../source/file-url';
import { isAllowedUrl, UrlSource } from '../source/url';
import { fileIntervalMs, httpIntervalMs } from '../source/watch';
import { createDraftSaver, draftKey, loadDraft } from '../store/drafts';
import { storeHandle } from '../store/handles';
import { addRecentUrl, getRecentEntries, type RecentItem } from '../store/recent';
import { useSettingsStore } from '../store/settings-store';
import {
  buildFileTreeLevel,
  type FileUrlEntry,
  findRepoRoot,
  getParentUrl,
  getRelPath,
  GitignoreCache,
  listDirectory,
  normalizeDirUrl,
  prefixTreeNodes,
} from '../source/file-url-tree';
import { createReaderStore, type Mode, type ReaderStore } from '../store/reader-store';
import { docKindFromName } from '../lib/doc-kind';

type Active = FileHandleSource | FileUrlSource | UrlSource | DirectorySource;

function findFirstFile(nodes: TreeNode[]): FileNode | null {
  for (const node of nodes) {
    if (node.kind === 'file') return node;
    if (node.kind === 'directory') {
      const found = findFirstFile(node.children ?? []);
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
  let reRootGen = 0;
  let treeVersion = 0;
  let active: Active | null = null;
  let unwatch: (() => void) | null = null;
  let stamp: number | null = null;
  const gitignoreCache = new GitignoreCache();
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
    const isMarkdown = state().docKind === 'markdown';
    set((s) => ({
      dirty: false,
      text: value,
      mountText: value,
      loadId: s.loadId + 1,
      sourceId: id,
      docTitle: title ?? s.docTitle,
      ...(!isMarkdown ? { mode: 'read', writable: false } : {}),
      ...(loading === undefined ? {} : { loading }),
    }));
    saver?.cancel();
    saver = null;
    if (!isMarkdown) return;
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
    set({ writable: state().docKind === 'markdown' && next instanceof FileHandleSource, externalChange: false });
    startWatch();
  }

  function setActiveDirectory(dirSource: DirectorySource, filePath: string | null) {
    stopWatch();
    active = dirSource;
    const isMarkdown = (filePath ? docKindFromName(filePath) : state().docKind) === 'markdown';
    set({ writable: isMarkdown && Boolean(filePath), externalChange: false });
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
    if (state().docKind !== 'markdown') return;
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
    if (state().docKind !== 'markdown') return;
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

    const isFile = parsed.protocol === 'file:';
    let fileTreeDocPath: string | null = null;
    if (isFile) {
      try {
        const u = new URL(url);
        u.hash = '';
        u.search = '';
        const fileUrl = u.href;
        const currentTree = state().fileTree;
        const isInside = currentTree && fileUrl.startsWith(normalizeDirUrl(currentTree.rootUrl));
        if (isInside) {
          ++reRootGen;
          fileTreeDocPath = getRelPath(fileUrl, currentTree.rootUrl);
          set({ docPath: fileTreeDocPath, fileAccessError: false });
        } else {
          const parentUrl = new URL('.', fileUrl).href;
          const docRelPath = getRelPath(fileUrl, parentUrl);
          const rGen = ++reRootGen;
          void (async () => {
            let rootEntries: FileUrlEntry[];
            try {
              rootEntries = await listDirectory(parentUrl);
            } catch {
              if (gen !== sourceGen || rGen !== reRootGen) return;
              ++treeGen;
              set({ fileTree: null, fileAccessError: true, docPath: null });
              return;
            }
            if (gen !== sourceGen || rGen !== reRootGen) return;

            let repoRoot: string | null = null;
            try {
              repoRoot = await findRepoRoot(parentUrl, rootEntries);
            } catch {
              // ignore climb errors
            }
            if (gen !== sourceGen || rGen !== reRootGen) return;

            try {
              gitignoreCache.clear();
              const chainBase = repoRoot ?? parentUrl;
              const settings = useSettingsStore.getState().settings.general;
              const nodes = await buildFileTreeLevel(parentUrl, parentUrl, chainBase, gitignoreCache, settings, rootEntries);
              if (gen !== sourceGen || rGen !== reRootGen) return;
              // Invalidates expands, Up and rebuilds still running on the old tree.
              ++treeGen;
              set({
                fileTree: { rootUrl: parentUrl, nodes, repoRoot },
                fileAccessError: false,
                docPath: docRelPath,
              });
            } catch {
              if (gen !== sourceGen || rGen !== reRootGen) return;
              ++treeGen;
              set({ fileTree: null, fileAccessError: false, docPath: null });
            }
          })();
        }
      } catch {
        fileTreeDocPath = null;
      }
    } else {
      ++treeGen;
      ++reRootGen;
      set({ fileTree: null, fileAccessError: false });
    }

    stopWatch();
    active = null;
    const kind = docKindFromName(url);
    set({
      docKind: kind,
      ...(kind !== 'markdown' ? { mode: 'read' } : {}),
      writable: false,
      externalChange: false,
      directorySource: null,
      docPath: fileTreeDocPath,
      headings: [],
      source: url,
    });
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
      const capturedText = (fileSource && charsetCompat) || kind !== 'markdown' ? undefined : usableCapturedText(entry, url);
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
      ++treeGen;
      ++reRootGen;
      const kind = docKindFromName(handle.name);
      set({
        docKind: kind,
        ...(kind !== 'markdown' ? { mode: 'read' } : {}),
        writable: false,
        externalChange: false,
        directorySource: null,
        docPath: null,
        fileTree: null,
        fileAccessError: false,
      });
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
      ++treeGen;
      ++reRootGen;
      set({
        writable: false,
        externalChange: false,
        directorySource: dirSource,
        treeNodes: tree,
        source: '',
        error: '',
        headings: [],
        fileTree: null,
        fileAccessError: false,
      });

      if (first) {
        const textValue = await dirSource.read(first.path);
        if (!isLive(gen)) return;
        const diskStamp = await dirSource.diskStamp(first.path);
        if (!isLive(gen)) return;
        stamp = diskStamp;
        const kind = docKindFromName(first.path);
        set({
          docKind: kind,
          ...(kind !== 'markdown' ? { mode: 'read' } : {}),
          docPath: first.path,
        });
        setActiveDirectory(dirSource, first.path);
        applyText(textValue, dirSource.identity, baseName(first.path));
      } else {
        set({ docKind: 'markdown', docPath: null });
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
      const kind = docKindFromName(filePath);
      set({
        docKind: kind,
        ...(kind !== 'markdown' ? { mode: 'read' } : {}),
        docPath: filePath,
      });
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
          set({ error: 'Only Markdown and JSON files are supported' });
          return;
        }
        const value = await file.text();
        if (!isCurrent(gen, previous, previousId)) return;
        stopWatch();
        active = null;
        ++treeGen;
        ++reRootGen;
        const kind = docKindFromName(file.name);
        set({
          docKind: kind,
          ...(kind !== 'markdown' ? { mode: 'read' } : {}),
          writable: false,
          externalChange: false,
        });
        setActive(null);
        set({ directorySource: null, docPath: null, headings: [], fileTree: null, fileAccessError: false });
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
    if (state().docKind !== 'markdown') return;
    draft = value;
    if (!state().dirty) set({ dirty: true });
    saver?.update(value);
  }

  function setMode(next: Mode) {
    if (state().docKind !== 'markdown') return;
    if (next !== 'edit') set({ mountText: draft });
    set({ text: draft, mode: next });
    const url = new URL(window.location.href);
    url.searchParams.set('mode', next);
    window.history.replaceState(null, '', url.toString());
  }

  async function expandFolder(path: string) {
    const currentTree = state().fileTree;
    if (!currentTree) return;
    const gen = treeGen;
    const rootUrl = currentTree.rootUrl;
    const chainBase = currentTree.repoRoot ?? rootUrl;
    const folderUrl = new URL(`${path.split('/').map(encodeURIComponent).join('/')}/`, rootUrl).href;
    const settings = useSettingsStore.getState().settings.general;

    try {
      const children = await buildFileTreeLevel(folderUrl, rootUrl, chainBase, gitignoreCache, settings);
      if (gen !== treeGen || !state().fileTree || state().fileTree?.rootUrl !== rootUrl) return;
      const updateNodes = (nodes: TreeNode[]): TreeNode[] => {
        return nodes.map((node) => {
          if (node.path === path && node.kind === 'directory') {
            return { ...node, children, error: undefined };
          }
          if (node.kind === 'directory' && node.children && path.startsWith(`${node.path}/`)) {
            return { ...node, children: updateNodes(node.children) };
          }
          return node;
        });
      };
      set({
        fileTree: {
          rootUrl,
          nodes: updateNodes(state().fileTree!.nodes),
          repoRoot: currentTree.repoRoot,
          version: currentTree.version,
        },
      });
    } catch {
      if (gen !== treeGen || !state().fileTree || state().fileTree?.rootUrl !== rootUrl) return;
      const markError = (nodes: TreeNode[]): TreeNode[] => {
        return nodes.map((node) => {
          if (node.path === path && node.kind === 'directory') {
            return { ...node, children: [], error: true };
          }
          if (node.kind === 'directory' && node.children && path.startsWith(`${node.path}/`)) {
            return { ...node, children: markError(node.children) };
          }
          return node;
        });
      };
      set({
        fileTree: {
          rootUrl,
          nodes: markError(state().fileTree!.nodes),
          repoRoot: currentTree.repoRoot,
          version: currentTree.version,
        },
      });
    }
  }

  async function goUp() {
    const currentTree = state().fileTree;
    if (!currentTree) return;
    const parentUrl = getParentUrl(currentTree.rootUrl);
    if (!parentUrl) return;
    const gen = ++treeGen;

    const folderName = decodeURIComponent(currentTree.rootUrl.slice(parentUrl.length)).replace(/\/+$/, '');
    let newRepoRoot: string | null = currentTree.repoRoot ?? null;
    if (newRepoRoot !== null && !parentUrl.startsWith(normalizeDirUrl(newRepoRoot))) {
      const foundRepoRoot = await findRepoRoot(parentUrl);
      if (gen !== treeGen) return;
      newRepoRoot = foundRepoRoot;
      gitignoreCache.clear();
    }
    const chainBase = newRepoRoot ?? parentUrl;
    const settings = useSettingsStore.getState().settings.general;

    try {
      const parentNodes = await buildFileTreeLevel(parentUrl, parentUrl, chainBase, gitignoreCache, settings);
      if (gen !== treeGen) return;

      const rePrefixedChildren = prefixTreeNodes(currentTree.nodes, folderName);
      let grafted = false;
      const graftedNodes = parentNodes.map((node) => {
        if (node.kind === 'directory' && node.name === folderName) {
          grafted = true;
          return { ...node, children: rePrefixedChildren };
        }
        return node;
      });

      if (!grafted) {
        graftedNodes.push({
          kind: 'directory',
          name: folderName,
          path: folderName,
          children: rePrefixedChildren,
        });
        graftedNodes.sort(compareTreeNodes);
      }

      const currentDocPath = state().docPath;
      const nextDocPath = currentDocPath ? `${folderName}/${currentDocPath}` : null;
      set({
        fileTree: { rootUrl: parentUrl, nodes: graftedNodes, repoRoot: newRepoRoot },
        docPath: nextDocPath,
      });
    } catch {
      // Ignore parent listing error
    }
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
      if (a.showHiddenItems !== b.showHiddenItems || a.ignorePatterns !== b.ignorePatterns) {
        if (active instanceof DirectorySource) {
          const gen = ++treeGen;
          const currentActive = active;
          void currentActive
            .getTree()
            .then((t) => {
              if (gen !== treeGen || active !== currentActive) return;
              set({ treeNodes: t });
            })
            .catch(() => undefined);
        }
        const currentTree = state().fileTree;
        if (currentTree) {
          gitignoreCache.clear();
          const gen = ++treeGen;
          const rootUrl = currentTree.rootUrl;
          const chainBase = currentTree.repoRoot ?? rootUrl;
          void buildFileTreeLevel(rootUrl, rootUrl, chainBase, gitignoreCache, a)
            .then((nodes) => {
              if (gen !== treeGen || !state().fileTree || state().fileTree?.rootUrl !== rootUrl) return;
              set({ fileTree: { rootUrl, nodes, repoRoot: currentTree.repoRoot, version: ++treeVersion } });
            })
            .catch(() => undefined);
        }
      }
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
    expandFolder,
    goUp,
  };
}

export type ReaderController = ReturnType<typeof createController>;
