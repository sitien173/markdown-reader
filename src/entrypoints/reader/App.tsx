import { useCallback, useEffect, useRef, useState } from 'react';
import { ToggleGroup, ToggleGroupItem } from '../../components/ui/toggle-group';
import { createDraftSaver, draftKey, loadDraft } from '../../store/drafts';
import { EditorPane } from '../../ui/editor-pane';
import type { MarkdownViewHandle } from '../../ui/markdown-view';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { FileHandleSource, SaveConflictError, isValidMarkdownFile, dropFileIdentity } from '../../source/file-handle';
import { SaveConflictDialog } from '../../ui/save-conflict-dialog';
import { Button } from '../../components/ui/button';
import { FileUrlSource } from '../../source/file-url';
import { isAllowedUrl, UrlSource } from '../../source/url';
import { usableCapturedText } from '../../source/captured-text';
import { addRecentUrl, getRecentEntries, type RecentItem } from '../../store/recent';
import { storeHandle } from '../../store/handles';
import { DirectorySource, type TreeNode, type FileNode } from '../../source/directory';
import { FileTree } from '../../ui/file-tree';
import { RecentSection } from '../../ui/recent-section';
import type { Heading } from '../../render/pipeline';
import { MarkdownView } from '../../ui/markdown-view';
import { TopBar } from '../../ui/top-bar';
import { TocPanel } from '../../ui/toc-panel';
import { Announce } from '../../ui/announce';
import { downloadHtml, printDocument } from '../../export/export';
import '../../styles/reader.css';
import '../../styles/editor.css';

type Mode = 'read' | 'edit' | 'split';
const MODES: Mode[] = ['read', 'edit', 'split'];
function parseMode(raw: string | null): Mode { return MODES.includes(raw as Mode) ? (raw as Mode) : 'read'; }

export default function App() {
 const initial = new URLSearchParams(window.location.search).get('src') ?? '';
 const [mode, setModeState] = useState<Mode>(parseMode(new URLSearchParams(window.location.search).get('mode')));
 const [mountText, setMountText] = useState('');
 const [loadId, setLoadId] = useState(0);
 const [dirty, setDirty] = useState(false);
 const draftRef = useRef('');
 const dirtyRef = useRef(false);
 const viewRef = useRef<MarkdownViewHandle | null>(null);
 const saverRef = useRef<ReturnType<typeof createDraftSaver> | null>(null);
 const sourceIdRef = useRef('');
 const sourceGenRef = useRef(0);
 const treeGenRef = useRef(0);
 const activeRef = useRef<FileHandleSource | FileUrlSource | DirectorySource | null>(null);
 const watchRef = useRef<(() => void) | null>(null);
 const stampRef = useRef<number | null>(null);
 const [writable, setWritable] = useState(false), [externalChange, setExternalChange] = useState(false), [conflict, setConflict] = useState(false), [notice, setNotice] = useState('');
 const [source, setSource] = useState(initial), [text, setText] = useState<string | null>(null), [error, setError] = useState(''), [loading, setLoading] = useState(false), [headings, setHeadings] = useState<Heading[]>([]);
 const [directorySource, setDirectorySource] = useState<DirectorySource | null>(null);
 const [docPath, setDocPath] = useState<string | null>(null);
 const docPathRef = useRef(docPath);
 docPathRef.current = docPath;
 const [treeNodes, setTreeNodes] = useState<TreeNode[]>([]);
 const [recents, setRecents] = useState<RecentItem[]>([]);

 const refreshRecents = useCallback(async () => {
  try {
    const items = await getRecentEntries();
    setRecents(items);
  } catch {
    // IDB or storage error fallback
  }
 }, []);

 useEffect(() => {
  void refreshRecents();
 }, [refreshRecents]);

 function isCurrent(gen: number, active: FileHandleSource | FileUrlSource | DirectorySource | null, id: string) {
  return gen === sourceGenRef.current && active === activeRef.current && id === sourceIdRef.current;
 }

 function applyText(value: string, id: string) {
  sourceIdRef.current = id;
  draftRef.current = value;
  dirtyRef.current = false;
  setDirty(false);
  setText(value);
  setMountText(value);
  setLoadId(n => n + 1);
  saverRef.current?.cancel();
  const storageKey = draftKey(id);
  saverRef.current = createDraftSaver(browser.storage.local, storageKey, 1000);
  const gen = sourceGenRef.current;
  void loadDraft(browser.storage.local, storageKey).then(draft => {
    if (gen !== sourceGenRef.current || sourceIdRef.current !== id) return;
    if (dirtyRef.current) return;
    if (draft === undefined || draft === value) return;
    draftRef.current = draft;
    dirtyRef.current = true;
    setDirty(true);
    setText(draft);
    setMountText(draft);
    setLoadId(n => n + 1);
  }).catch(() => undefined);
 }

 function setActive(active: FileHandleSource | FileUrlSource | null) {
  watchRef.current?.();
  watchRef.current = null;
  activeRef.current = active;
  setWritable(active instanceof FileHandleSource);
  setExternalChange(false);
  setNotice('');
  if (!active) return;
  watchRef.current = active.watch({
    onChange: () => void checkExternal(),
    onDeleted: () => setNotice('The file was deleted from disk. Your draft is still in the editor.'),
  });
 }

 function setActiveDirectory(dirSource: DirectorySource, filePath: string | null) {
  watchRef.current?.();
  watchRef.current = null;
  activeRef.current = dirSource;
  setWritable(Boolean(filePath));
  setExternalChange(false);
  setNotice('');
  watchRef.current = dirSource.watch({
    onTreeChange: () => {
      const treeGen = ++treeGenRef.current;
      void dirSource.getTree().then(t => {
        if (treeGen !== treeGenRef.current || activeRef.current !== dirSource) return;
        setTreeNodes(t);
      }).catch(() => undefined);
    },
    onChange: () => void checkExternal(),
    onDeleted: () => setNotice('The folder was deleted or is no longer accessible.'),
  });
 }

 async function checkExternal() {
  const active = activeRef.current;
  if (!active) return;
  const gen = sourceGenRef.current, id = sourceIdRef.current;
  if (active instanceof FileHandleSource || active instanceof DirectorySource) {
   const stamp = await active.diskStamp();
   if (!isCurrent(gen, active, id)) return;
   if (stamp === stampRef.current) return;
  }
  if (dirtyRef.current) { setExternalChange(true); return; }
  await reloadFromDisk(false);
 }

 async function reloadFromDisk(discardDraft: boolean) {
  const active = activeRef.current;
  if (!active) return;
  const id = sourceIdRef.current;
  const gen = sourceGenRef.current;
  if (discardDraft) {
    const discarded = draftRef.current;
    saverRef.current?.cancel();
    await browser.storage.local.remove(draftKey(id));
    if (!isCurrent(gen, active, id)) return;
    // Edits typed while the draft was being removed are newer than the reload request; keep them.
    if (draftRef.current !== discarded) { setExternalChange(true); return; }
    dirtyRef.current = false;
    setDirty(false);
  }
  const value = await active.read();
  if (gen !== sourceGenRef.current || active !== activeRef.current || id !== sourceIdRef.current) return;
  if (dirtyRef.current) { setExternalChange(true); return; }
  if (active instanceof FileHandleSource || active instanceof DirectorySource) {
    const stamp = await active.diskStamp();
    if (!isCurrent(gen, active, id)) return;
    if (dirtyRef.current) { setExternalChange(true); return; }
    stampRef.current = stamp;
  }
  setExternalChange(false);
  setNotice('');
  applyText(value, id);
 }

 async function save() {
  const active = activeRef.current;
  if (!(active instanceof FileHandleSource || active instanceof DirectorySource) || stampRef.current === null) return;
  const written = draftRef.current;
  const gen = sourceGenRef.current, id = sourceIdRef.current;
  try {
    const stamp = await active.write(written, stampRef.current, docPathRef.current ?? undefined);
    if (!isCurrent(gen, active, id)) return;
    stampRef.current = stamp;
    if (draftRef.current === written) {
      dirtyRef.current = false;
      setDirty(false);
      setConflict(false);
      setExternalChange(false);
      setNotice('');
      saverRef.current?.cancel();
      await browser.storage.local.remove(draftKey(id));
      if (!isCurrent(gen, active, id)) return;
    }
  } catch (e) {
    if (!isCurrent(gen, active, id)) return;
    if (e instanceof SaveConflictError) setConflict(true);
    else setError(e instanceof Error ? e.message : 'Unable to save the file');
  }
 }

 async function overwrite() {
  const active = activeRef.current;
  if (!(active instanceof FileHandleSource || active instanceof DirectorySource)) return;
  setConflict(false);
  const written = draftRef.current;
  const gen = sourceGenRef.current, id = sourceIdRef.current;
  try {
    const stamp = await active.write(written, undefined, docPathRef.current ?? undefined);
    if (!isCurrent(gen, active, id)) return;
    stampRef.current = stamp;
    if (draftRef.current === written) {
      dirtyRef.current = false;
      setDirty(false);
      setExternalChange(false);
      setNotice('');
      saverRef.current?.cancel();
      await browser.storage.local.remove(draftKey(id));
      if (!isCurrent(gen, active, id)) return;
    }
  } catch (e) {
    if (isCurrent(gen, active, id)) setError(e instanceof Error ? e.message : 'Unable to save the file');
  }
 }

 useEffect(() => {
  const stop = () => { watchRef.current?.(); watchRef.current = null; };
  window.addEventListener('pagehide', stop);
  return () => { window.removeEventListener('pagehide', stop); stop(); };
 }, []);

 const onEdit = useCallback((value: string) => {
  draftRef.current = value;
  viewRef.current?.update(value);
  if (!dirtyRef.current) { dirtyRef.current = true; setDirty(true); }
  saverRef.current?.update(value);
 }, []);

 const setMode = useCallback((next: Mode) => {
  if (next !== 'edit') setMountText(draftRef.current);
  setText(draftRef.current);
  setModeState(next);
  const url = new URL(window.location.href);
  url.searchParams.set('mode', next);
  window.history.replaceState(null, '', url.toString());
 }, []);

 const load = useCallback(async (url: string) => {
  const gen = ++sourceGenRef.current;
  const loadId = url;
  sourceIdRef.current = url;
  let parsed: URL;
  try { parsed = new URL(url); } catch {
    setError('Invalid URL');
    setText(null);
    return;
  }
  if (!isAllowedUrl(url)) {
    setError('This URL scheme is not supported');
    setText(null);
    return;
  }
  watchRef.current?.(); watchRef.current = null;
  activeRef.current = null; setWritable(false); setExternalChange(false); setNotice('');
  setDirectorySource(null);
  setDocPath(null);
  setHeadings([]);
  setSource(url);
  window.history.replaceState(null, '', `?src=${encodeURIComponent(url)}&mode=${mode}`);
  setLoading(true);
  setError('');
  setText(null);
  try {
    const key = `markdown-reader:${url}`;
    const saved = await browser.storage.session.get(key);
    if (!isCurrent(gen, null, loadId)) return;
    const entry = saved[key];
    await browser.storage.session.remove(key);
    if (!isCurrent(gen, null, loadId)) return;
    const capturedText = usableCapturedText(entry, url);
    const fileSource = parsed.protocol === 'file:' ? new FileUrlSource(url) : null;
    const value = capturedText ?? await (fileSource ?? new UrlSource(url)).read();
    if (!isCurrent(gen, null, loadId)) return;
    setLoading(false);
    applyText(value, url);
    setActive(fileSource);
    void addRecentUrl(url).then(() => refreshRecents()).catch(() => undefined);
  } catch (e) {
    if (isCurrent(gen, null, loadId)) setError(e instanceof Error ? e.message : 'Unable to fetch Markdown');
  } finally {
    if (gen === sourceGenRef.current) setLoading(false);
  }
 }, [mode, refreshRecents]);

 useEffect(() => { if (initial) void load(initial); }, []);

 async function openFileHandle(handle: FileSystemFileHandle) {
  const gen = ++sourceGenRef.current;
  setLoading(false);
  const previous = activeRef.current, previousId = sourceIdRef.current;
  try {
    const picked = new FileHandleSource(handle);
    const value = await picked.read();
    if (!isCurrent(gen, previous, previousId)) return;
    const stamp = await picked.diskStamp();
    if (!isCurrent(gen, previous, previousId)) return;
    watchRef.current?.(); watchRef.current = null;
    activeRef.current = null; setWritable(false); setExternalChange(false); setNotice('');
    setDirectorySource(null);
    setDocPath(null);
    stampRef.current = stamp;
    setActive(picked);
    setSource('');
    applyText(value, picked.identity);
    setError('');
    setHeadings([]);
    void storeHandle(handle.name, 'file', handle).catch(() => undefined);
    void refreshRecents();
  } catch (e) {
    if (gen === sourceGenRef.current && !(e instanceof DOMException && e.name === 'AbortError')) {
      setError(e instanceof Error ? e.message : 'Unable to open file');
    }
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
    if (!(e instanceof DOMException && e.name === 'AbortError')) {
      setError(e instanceof Error ? e.message : 'Unable to open file');
    }
  }
 }

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

 async function openFolderHandle(handle: FileSystemDirectoryHandle) {
  const gen = ++sourceGenRef.current;
  setLoading(false);
  const previous = activeRef.current, previousId = sourceIdRef.current;
  try {
    void storeHandle(handle.name, 'folder', handle).catch(() => undefined);
    const dirSource = new DirectorySource(handle);
    const tree = await dirSource.getTree();
    if (!isCurrent(gen, previous, previousId)) return;

    const first = findFirstFile(tree);
    watchRef.current?.(); watchRef.current = null;
    activeRef.current = null; setWritable(false); setExternalChange(false); setNotice('');

    setDirectorySource(dirSource);
    setTreeNodes(tree);
    setSource('');
    setError('');
    setHeadings([]);

    if (first) {
      const textValue = await dirSource.read(first.path);
      if (gen !== sourceGenRef.current) return;
      const stamp = await dirSource.diskStamp(first.path);
      if (gen !== sourceGenRef.current) return;
      stampRef.current = stamp;
      setDocPath(first.path);
      setActiveDirectory(dirSource, first.path);
      applyText(textValue, dirSource.identity);
    } else {
      setDocPath(null);
      setActiveDirectory(dirSource, null);
      applyText('', `folder:${handle.name}:empty`);
    }
    void refreshRecents();
  } catch (e) {
    if (gen === sourceGenRef.current && !(e instanceof DOMException && e.name === 'AbortError')) {
      setError(e instanceof Error ? e.message : 'Unable to open folder');
    }
  }
 }

 async function openFolder() {
  const picker = (window as unknown as { showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker;
  if (!picker) {
    setError('Directory picker is not available');
    return;
  }
  try {
    const handle = await picker();
    await openFolderHandle(handle);
  } catch (e) {
    if (!(e instanceof DOMException && e.name === 'AbortError')) {
      setError(e instanceof Error ? e.message : 'Unable to open folder');
    }
  }
 }

 async function selectTreeFile(filePath: string) {
  if (!directorySource) return;
  const gen = ++sourceGenRef.current;
  const previous = activeRef.current, previousId = sourceIdRef.current;
  try {
    const textValue = await directorySource.read(filePath);
    if (!isCurrent(gen, previous, previousId)) return;
    const stamp = await directorySource.diskStamp(filePath);
    if (!isCurrent(gen, previous, previousId)) return;
    stampRef.current = stamp;
    setDocPath(filePath);
    setActiveDirectory(directorySource, filePath);
    applyText(textValue, directorySource.identity);
    setHeadings([]);
    setError('');
  } catch (e) {
    if (isCurrent(gen, previous, previousId)) {
      setError(e instanceof Error ? e.message : 'Unable to open file');
    }
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

 async function drop(event: React.DragEvent) {
  event.preventDefault();
  const item = event.dataTransfer.items[0];
  if (!item) return;
  const gen = ++sourceGenRef.current;
  setLoading(false);
  const previous = activeRef.current, previousId = sourceIdRef.current;
  try {
    const file = await FileHandleSource.fromDrop(item);
    if (!isCurrent(gen, previous, previousId)) return;
    if (file) {
      if (!isValidMarkdownFile(file.name)) {
        setError('Only Markdown files (.md, .markdown) are supported');
        return;
      }
      const value = await file.text();
      if (!isCurrent(gen, previous, previousId)) return;
      watchRef.current?.(); watchRef.current = null;
      activeRef.current = null; setWritable(false); setExternalChange(false); setNotice('');
      setActive(null);
      setDirectorySource(null);
      setDocPath(null);
      setHeadings([]);
      const identity = dropFileIdentity(file);
      applyText(value, identity);
      setSource('');
      setError('');
    }
  } catch (e) {
    if (isCurrent(gen, previous, previousId)) setError(e instanceof Error ? e.message : 'Unable to open file');
  }
 }

  async function handleExportHtml() {
    if (mode === 'edit') return;
    if (viewRef.current) {
      await viewRef.current.ready();
    }
    const container = document.querySelector<HTMLElement>('.tds-custom-markdown');
    const contentHtml = container ? container.innerHTML : '';
    const title = (docPath ? docPath.split('/').pop() : null)?.replace(/\.md$/i, '') || headings[0]?.text || 'document';
    await downloadHtml(title, contentHtml);
  }

  async function handlePrint() {
    if (mode === 'edit') return;
    if (viewRef.current) {
      await viewRef.current.ready();
    }
    printDocument();
  }

 return <main className="tds-custom-reader" onDragOver={e => e.preventDefault()} onDrop={e => void drop(e)}><TopBar source={source} onNavigate={url => void load(url)} onOpenFile={() => void openFile()} onExportHtml={() => void handleExportHtml()} onPrint={() => void handlePrint()} exportDisabled={mode === 'edit'} />{text !== null && <ToggleGroup type="single" className="tds-segmented-control" aria-label="Reader mode" value={mode} onValueChange={v => { if (v) setMode(v as Mode); }}>{MODES.map(m => <ToggleGroupItem key={m} value={m} className="tds-segmented-control__item">{m.charAt(0).toUpperCase() + m.slice(1)}</ToggleGroupItem>)}</ToggleGroup>}{writable && text !== null && <Button variant="secondary" disabled={!dirty} onClick={() => void save()}>Save</Button>}{dirty && <div className="tds-announcement" role="status"><span>Unsaved draft</span></div>}{externalChange && <div className="tds-announcement" role="status"><span>File changed on disk: </span><Button variant="secondary" onClick={() => void reloadFromDisk(true)}>Reload</Button></div>}{notice && <div className="tds-announcement" role="status"><span>{notice}</span></div>}<SaveConflictDialog open={conflict} onOverwrite={() => void overwrite()} onReload={() => { setConflict(false); void reloadFromDisk(true); }} onCancel={() => setConflict(false)} />{error && <Announce message={error} onRetry={() => void load(source)} />}<div className="tds-custom-reader__body"><aside className="tds-custom-reader__toc"><Tabs defaultValue="contents"><TabsList className="tds-tabs"><TabsTrigger className="tds-tab-item" value="contents">Contents</TabsTrigger><TabsTrigger className="tds-tab-item" value="files">Files</TabsTrigger></TabsList><TabsContent value="contents"><TocPanel headings={headings} /></TabsContent><TabsContent value="files">{directorySource ? <div className="tds-custom-reader__files-panel"><div className="tds-custom-reader__folder-actions"><Button variant="secondary" onClick={() => void openFolder()}>Open folder</Button></div><FileTree nodes={treeNodes} activePath={docPath} onSelectFile={p => void selectTreeFile(p)} /></div> : <div className="tds-custom-reader__files-empty"><p className="text-body-sm">No folder opened.</p><Button variant="secondary" onClick={() => void openFolder()}>Open folder</Button></div>}<RecentSection items={recents} onOpenItem={handleOpenRecent} onRefresh={refreshRecents} onAnnouncement={setNotice} /></TabsContent></Tabs></aside><section className="tds-custom-reader__content" onClick={e => { const link = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[data-md-link], a[href^="#"]'); if (!link) return; e.preventDefault(); if (link.hasAttribute('data-md-link')) { const folderPath = link.getAttribute('data-folder-path'); if (folderPath && directorySource) { void selectTreeFile(folderPath); return; } if (link.href) { void load(link.href); return; } } const id = decodeURIComponent(link.getAttribute('href')!.slice(1)); if (id) document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }); }}>{loading ? <div className="tds-spinner tds-spinner--md" role="status" aria-label="Loading Markdown" /> : text !== null ? <div className={`tds-custom-reader__panes tds-custom-reader__panes--${mode}`}>{mode !== 'read' && <EditorPane key={loadId} initialText={draftRef.current} onChange={onEdit} />}{mode !== 'edit' && <MarkdownView ref={viewRef} text={mountText} baseUrl={source} onHeadings={setHeadings} directorySource={directorySource} docPath={docPath} />}</div> : null}</section></div></main>;
}
