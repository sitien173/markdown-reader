import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useShallow } from 'zustand/react/shallow';
import { EditorPane } from '../../ui/editor-pane';
import type { MarkdownViewHandle } from '../../ui/markdown-view';
import { FolderIcon, FolderUp, ListIcon, PanelLeftIcon, SearchIcon } from 'lucide-react';
import { getParentUrl } from '../../source/file-url-tree';
import { Input } from '../../components/ui/input';
import { ToggleGroup, ToggleGroupItem } from '../../components/ui/toggle-group';
import { t, useT } from '../../i18n';
import { SaveConflictDialog } from '../../ui/save-conflict-dialog';
import { Button } from '../../components/ui/button';
import { Spinner } from '../../components/ui/spinner';
import { applyAppearance } from '../../lib/appearance';
import { applyCustomCss } from '../../lib/custom-css';
import { type Command, createCommands } from '../../reader/commands';
import { createController, type ReaderController } from '../../reader/controller';
import {
  createReaderStore,
  ReaderStoreContext,
  type ReaderStore,
  type SidebarTab,
  selectBanners,
  useReaderStore,
} from '../../store/reader-store';
import { FileTree } from '../../ui/file-tree';
import { RecentSection } from '../../ui/recent-section';
import { type Heading, pluginKey } from '../../render/pipeline';
import { useSettingsStore } from '../../store/settings-store';
import { MarkdownView } from '../../ui/markdown-view';
import { JsonView } from '../../ui/json-view';
import type { JsonParseError } from '../../lib/json-document';
import { Toolbar } from '../../ui/toolbar';
import { ReaderMenu } from '../../ui/reader-menu';
import { AboutDialog } from '../../ui/about-dialog';
import { scrollBehavior, TocPanel } from '../../ui/toc-panel';
import { DropOverlay } from '../../ui/drop-overlay';
import { OpenUrlDialog } from '../../ui/open-url-dialog';
import { StatusBanner } from '../../ui/status-banner';
import { SettingsDialog } from '../../ui/settings/settings-dialog';
import { Welcome } from '../../ui/welcome';
import { notifyToast, Toaster } from '../../components/ui/toast';
import { bindShortcuts } from '../../reader/shortcuts';
import { CommandPalette } from '../../ui/command-palette';
import { downloadHtml, printDocument } from '../../export/export';
import '../../styles/reader.css';
import '../../styles/editor.css';

export default function App() {
  const [controller] = useState(() => createController(createReaderStore(), notifyToast));
  return (
    <ReaderStoreContext.Provider value={controller.store}>
      <Reader controller={controller} />
      <Toaster />
    </ReaderStoreContext.Provider>
  );
}

type RunCommand = (id: string) => void;

const FULLSCREEN_GUARD_MS = 300;

function Reader({ controller }: { controller: ReaderController }) {
  const viewRef = useRef<MarkdownViewHandle | null>(null);
  // The shell subscribes only to what it renders itself; every panel below selects its own fields.
  const focusMode = useReaderStore((s) => s.focusMode);
  const sidebarOpen = useReaderStore((s) => s.sidebarOpen);
  const mode = useReaderStore((s) => s.mode);
  const patch = controller.store.setState;
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);

  useEffect(() => controller.mount(), [controller]);

  // A layout effect, so the root attributes are current before any passive effect (such as the diagram redraw) reads them.
  const appearance = useSettingsStore((s) => s.settings.appearance);
  useLayoutEffect(() => applyAppearance(document.documentElement, appearance), [appearance]);
  // A stylesheet that fails validation is rejected whole and the previously adopted one stays.
  const { customCssEnabled, customCss } = appearance;
  useEffect(() => void applyCustomCss(document, customCssEnabled ? customCss : ''), [customCssEnabled, customCss]);
  // Zen mode is the stored focus mode: a change to the stored value applies live, and Escape later leaves this session only.
  useEffect(() => patch({ focusMode: appearance.zen }), [appearance.zen, patch]);

  useEffect(() => {
    if (!focusMode) return;
    // Escape in browser fullscreen belongs to fullscreen. Chrome usually consumes it, or exits first and then delivers it, so a fullscreenchange opens a short guard.
    let guardUntil = 0;
    const onFullscreenChange = () => {
      guardUntil = performance.now() + FULLSCREEN_GUARD_MS;
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      if (document.querySelector('[role="dialog"]:not([data-slot="toast"], [data-ending-style]), [role="menu"]:not([data-ending-style])'))
        return;
      if (document.fullscreenElement) {
        void document.exitFullscreen().catch(() => undefined);
        return;
      }
      if (performance.now() < guardUntil) return;
      patch({ focusMode: false });
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      window.removeEventListener('keydown', onKey);
    };
  }, [focusMode, patch]);

  // Leaving focus mode remounts the floating controls; return keyboard focus to the menu button.
  const wasFocusMode = useRef(false);
  useEffect(() => {
    if (wasFocusMode.current && !focusMode) {
      document.querySelector<HTMLButtonElement>(`[aria-label="${t('reader.menu')}"]`)?.focus();
    }
    wasFocusMode.current = focusMode;
  }, [focusMode]);

  // Picker commands call straight through: no await, animation, or state round-trip before the picker opens.
  // Built once per controller, so the toolbar, palette, and shortcut binding keep stable props.
  const commands = useMemo(() => {
    const { store } = controller;
    async function exportHtml() {
      const { mode, docPath, headings } = store.getState();
      if (mode === 'edit') return;
      if (viewRef.current) {
        await viewRef.current.ready();
      }
      const container = document.querySelector<HTMLElement>('[data-slot="markdown"]')?.cloneNode(true) as HTMLElement | undefined;
      // The Copy bars and heading permalinks are reader controls; the exported file has no script to run them.
      for (const el of container?.querySelectorAll('.md-code-bar, .md-permalink') ?? []) el.remove();
      const contentHtml = container ? container.innerHTML : '';
      const title = (docPath ? docPath.split('/').pop() : null)?.replace(/\.md$/i, '') || headings[0]?.text || 'document';
      await downloadHtml(title, contentHtml, useSettingsStore.getState().settings.appearance);
      notifyToast('Exported HTML');
    }
    async function print() {
      if (store.getState().mode === 'edit') return;
      if (viewRef.current) {
        await viewRef.current.ready();
      }
      printDocument();
    }
    return createCommands({
      openFile: () => void controller.openFile(),
      openFolder: () => void controller.openFolder(),
      openUrl: () => store.setState({ urlDialogOpen: true }),
      save: () => void controller.save(),
      setMode: controller.setMode,
      exportHtml: () => void exportHtml(),
      print: () => void print(),
      toggleSidebar: () => store.setState((s) => ({ sidebarOpen: !s.sidebarOpen })),
      toggleFocusMode: () => store.setState((s) => ({ focusMode: !s.focusMode })),
      toggleRaw: () => controller.setMode(store.getState().mode === 'read' ? 'edit' : 'read'),
      toggleFullscreen: () => {
        const refused = () => notifyToast(t('reader.fullscreenRefused'));
        try {
          void (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(refused);
        } catch {
          refused();
        }
      },
      openSettings: () => setSettingsOpen(true),
      openAbout: () => setAboutOpen(true),
      openPalette: () => setPaletteOpen(true),
    });
  }, [controller]);
  useEffect(() => bindShortcuts(() => commands, controller.store.getState), [commands, controller]);
  const run = useCallback<RunCommand>((id) => commands.find((c) => c.id === id)?.run(), [commands]);
  const onSelectTreeFile = useCallback((path: string) => void controller.selectTreeFile(path), [controller]);

  return (
    <main
      className="reader"
      data-focus={focusMode}
      data-sidebar={sidebarOpen ? 'open' : 'closed'}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        void controller.drop(e.dataTransfer.items[0]);
      }}
    >
      {!focusMode && mode !== 'read' && <Toolbar commands={commands} onMode={controller.setMode} />}
      {!focusMode && <FloatingControls commands={commands} />}
      {focusMode && (
        <Button variant="secondary" size="sm" className="reader-focus-exit" onClick={() => patch({ focusMode: false })}>
          Exit focus mode
        </Button>
      )}
      <Banners controller={controller} />
      <ConflictDialog controller={controller} />
      <UrlDialog controller={controller} />
      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        commands={commands}
        onSelectTreeFile={onSelectTreeFile}
        onOpenRecent={controller.handleOpenRecent}
        onRefreshRecents={controller.refreshRecents}
        onAnnouncement={controller.notify}
      />
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      <AboutDialog open={aboutOpen} onOpenChange={setAboutOpen} />
      <DropOverlay />
      <div className="reader-body">
        <Sidebar controller={controller} />
        <Content controller={controller} viewRef={viewRef} run={run} />
      </div>
    </main>
  );
}

function FloatingControls({ commands }: { commands: Command[] }) {
  const sidebarOpen = useReaderStore((s) => s.sidebarOpen);
  const toggleSidebar = commands.find((c) => c.id === 'toggle-sidebar');
  return (
    <>
      <Button
        variant="secondary"
        size="icon"
        className="reader-float reader-float--start"
        aria-label={toggleSidebar?.label}
        aria-pressed={sidebarOpen}
        onClick={() => toggleSidebar?.run()}
      >
        <PanelLeftIcon aria-hidden="true" />
      </Button>
      <ReaderMenu commands={commands} />
    </>
  );
}

function Banners({ controller }: { controller: ReaderController }) {
  const error = useReaderStore((s) => s.error);
  const parseError = useReaderStore((s) => s.parseError);
  const externalChange = useReaderStore((s) => s.externalChange);
  const banners = useMemo(() => selectBanners({ error, parseError, externalChange }), [error, parseError, externalChange]);
  return (
    <StatusBanner
      banners={banners}
      onRetry={() => void controller.load(controller.store.getState().source)}
      onDismissError={controller.dismissError}
      onReload={() => void controller.reloadFromDisk(true)}
    />
  );
}

function ConflictDialog({ controller }: { controller: ReaderController }) {
  const conflict = useReaderStore((s) => s.conflict);
  const patch = controller.store.setState;
  return (
    <SaveConflictDialog
      open={conflict}
      onOverwrite={() => void controller.overwrite()}
      onReload={() => {
        patch({ conflict: false });
        void controller.reloadFromDisk(true);
      }}
      onCancel={() => patch({ conflict: false })}
    />
  );
}

function UrlDialog({ controller }: { controller: ReaderController }) {
  const open = useReaderStore((s) => s.urlDialogOpen);
  return (
    <OpenUrlDialog
      open={open}
      onOpenChange={(next) => controller.store.setState({ urlDialogOpen: next })}
      onOpenUrl={(url) => void controller.load(url)}
    />
  );
}

function Sidebar({ controller }: { controller: ReaderController }) {
  const t = useT();
  const sidebarOpen = useReaderStore((s) => s.sidebarOpen);
  const sidebarTab = useReaderStore((s) => s.sidebarTab);
  const docKind = useReaderStore((s) => s.docKind);
  const isMarkdown = docKind === 'markdown';
  const activeTab: SidebarTab = isMarkdown ? sidebarTab : 'files';
  const [searching, setSearching] = useState(false);
  const [filter, setFilter] = useState('');
  const filterRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (searching) filterRef.current?.focus();
  }, [searching]);
  const selectTab = (tab: SidebarTab) => {
    controller.store.setState({ sidebarTab: tab });
    setFilter('');
  };
  return (
    <aside className="reader-toc" data-slot="reader-toc" inert={!sidebarOpen}>
      <div className="reader-toc-head">
        <ToggleGroup
          aria-label={t('reader.sidebarView')}
          variant="outline"
          spacing={0}
          value={[activeTab]}
          onValueChange={(next) => next[0] && selectTab(next[0] as SidebarTab)}
        >
          <ToggleGroupItem value="files" aria-label={t('reader.files')}>
            <FolderIcon aria-hidden="true" />
          </ToggleGroupItem>
          {isMarkdown && (
            <ToggleGroupItem value="contents" aria-label={t('reader.outline')}>
              <ListIcon aria-hidden="true" />
            </ToggleGroupItem>
          )}
        </ToggleGroup>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t('reader.search')}
          aria-pressed={searching}
          onClick={() => {
            setSearching((open) => !open);
            setFilter('');
          }}
        >
          <SearchIcon aria-hidden="true" />
        </Button>
      </div>
      {searching && (
        <Input
          ref={filterRef}
          aria-label={t('reader.filter')}
          placeholder={t('reader.filter')}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      )}
      {activeTab === 'files' ? <FilesPanel controller={controller} filter={filter} /> : <ContentsPanel filter={filter} />}
    </aside>
  );
}

function ContentsPanel({ filter }: { filter: string }) {
  const headings = useReaderStore((s) => s.headings);
  const sourceId = useReaderStore((s) => s.sourceId);
  const docPath = useReaderStore((s) => s.docPath);
  // Source identity, not loadId: auto-refresh and draft restore bump loadId for the same document.
  return <TocPanel key={`${sourceId}\n${docPath}`} headings={headings} filter={filter} />;
}

function FilesPanel({ controller, filter }: { controller: ReaderController; filter: string }) {
  const { text, directorySource, fileTree, fileAccessError, docPath, treeNodes, recents } = useReaderStore(
    useShallow((s) => ({
      text: s.text,
      directorySource: s.directorySource,
      fileTree: s.fileTree,
      fileAccessError: s.fileAccessError,
      docPath: s.docPath,
      treeNodes: s.treeNodes,
      recents: s.recents,
    })),
  );

  const rootFolderName = useMemo(() => {
    if (!fileTree) return '';
    const pathname = new URL(fileTree.rootUrl).pathname.replace(/\/+$/, '');
    const name = pathname.split('/').pop();
    return name ? decodeURIComponent(name) : '/';
  }, [fileTree]);

  return (
    <>
      {fileTree ? (
        <div className="reader-files-panel">
          <div className="reader-folder-actions flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md bg-muted/60 border border-border/40">
            <div className="flex items-center gap-1.5 min-w-0">
              <FolderIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="text-sm font-medium truncate" title={rootFolderName}>
                {rootFolderName}
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 shrink-0"
              aria-label={t('reader.upOneLevel')}
              title={t('reader.upOneLevel')}
              disabled={getParentUrl(fileTree.rootUrl) === null}
              onClick={() => void controller.goUp()}
            >
              <FolderUp className="size-4" aria-hidden="true" />
            </Button>
          </div>
          <FileTree
            key={`${fileTree.rootUrl}:${fileTree.version ?? 0}`}
            nodes={fileTree.nodes}
            activePath={docPath}
            onSelectFile={(p) => {
              const fileUrl = new URL(p.split('/').map(encodeURIComponent).join('/'), fileTree.rootUrl).href;
              void controller.load(fileUrl);
            }}
            onExpandFolder={(p) => void controller.expandFolder(p)}
            filter={filter}
          />
        </div>
      ) : directorySource ? (
        <div className="reader-files-panel">
          <div className="reader-folder-actions flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md bg-muted/60 border border-border/40">
            <div className="flex items-center gap-1.5 min-w-0">
              <FolderIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="text-sm font-medium truncate" title={directorySource.root.name}>
                {directorySource.root.name}
              </span>
            </div>
            <Button variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={() => void controller.openFolder()}>
              Change
            </Button>
          </div>
          <FileTree nodes={treeNodes} activePath={docPath} onSelectFile={(p) => void controller.selectTreeFile(p)} filter={filter} />
        </div>
      ) : (
        <div className="reader-files-empty">
          <FolderIcon className="size-8 text-muted-foreground/50 mb-1" aria-hidden="true" />
          <p className="text-sm font-medium">No folder opened.</p>
          <p className="text-xs text-muted-foreground">Open a folder to browse its Markdown files.</p>
          {fileAccessError && <p className="text-sm text-destructive">{t('reader.fileAccessHint')}</p>}
          <Button variant="secondary" size="sm" className="mt-1" onClick={() => void controller.openFolder()}>
            Open folder
          </Button>
        </div>
      )}
      {text !== null && (
        <RecentSection
          items={recents}
          onOpenItem={controller.handleOpenRecent}
          onRefresh={controller.refreshRecents}
          onAnnouncement={controller.notify}
        />
      )}
    </>
  );
}

/**
 * Whether the document is shown. The welcome screen hands over to the document through a View Transition when the API
 * exists and motion is allowed; otherwise the update is immediate. Pickers never wait on this: it only delays a paint.
 */
function useDocumentReveal(store: ReaderStore): boolean {
  const [shown, setShown] = useState(() => store.getState().text !== null);
  useEffect(() => {
    let current = store.getState().text !== null;
    setShown(current);
    return store.subscribe((state) => {
      // While a load is in flight the spinner covers the content, so a shown document stays shown until the load ends.
      const next = state.text !== null || (state.loading && current);
      if (next === current) return;
      current = next;
      const start = document.startViewTransition?.bind(document);
      if (!next || !start || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
        setShown(next);
        return;
      }
      // Reads `current` when the callback runs, so a quick close and reopen cannot apply a stale value.
      const transition = start(() => flushSync(() => setShown(current)));
      for (const settled of [transition.ready, transition.finished]) settled.catch(() => undefined);
    });
  }, [store]);
  return shown;
}

function Content({
  controller,
  viewRef,
  run,
}: {
  controller: ReaderController;
  viewRef: React.RefObject<MarkdownViewHandle | null>;
  run: RunCommand;
}) {
  const { docKind, mode, mountText, loadId, source, sourceId, loading, directorySource, docPath, docTitle } = useReaderStore(
    useShallow((s) => ({
      docKind: s.docKind,
      mode: s.mode,
      mountText: s.mountText,
      loadId: s.loadId,
      source: s.source,
      sourceId: s.sourceId,
      loading: s.loading,
      directorySource: s.directorySource,
      docPath: s.docPath,
      docTitle: s.docTitle,
    })),
  );
  const plugins = useSettingsStore(useShallow((s) => s.settings.plugins));
  const pluginConfigKey = useMemo(() => pluginKey(plugins), [plugins]);
  const hasText = useDocumentReveal(controller.store);
  const setHeadings = useCallback((headings: Heading[]) => controller.store.setState({ headings }), [controller]);
  const onParseError = useCallback(
    (parseError: JsonParseError | null) => {
      controller.store.setState({ parseError });
    },
    [controller],
  );
  const onEdit = useCallback(
    (value: string) => {
      controller.edit(value);
      viewRef.current?.update(value);
    },
    [controller, viewRef],
  );

  function onContentClick(e: React.MouseEvent) {
    const link = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[data-md-link], a[href^="#"]');
    if (!link) return;
    e.preventDefault();
    if (link.hasAttribute('data-md-link')) {
      const folderPath = link.getAttribute('data-folder-path');
      if (folderPath && directorySource) {
        void controller.selectTreeFile(folderPath);
        return;
      }
      if (link.href) {
        void controller.load(link.href);
        return;
      }
    }
    const id = decodeURIComponent(link.getAttribute('href')?.slice(1) ?? '');
    if (id) document.getElementById(id)?.scrollIntoView({ behavior: scrollBehavior() });
  }

  const isJson = docKind === 'json' || docKind === 'jsonc';

  return (
    // Delegated handler for Markdown links, which are natively keyboard-operable; the section itself is not interactive.
    // biome-ignore lint/a11y/noStaticElementInteractions: event delegation for links inside rendered Markdown
    // biome-ignore lint/a11y/useKeyWithClickEvents: links handle their own keyboard activation, which bubbles as click
    <section data-slot="reader-content" className="reader-content" onClick={onContentClick}>
      {loading ? (
        <Spinner aria-label={isJson ? 'Loading' : 'Loading Markdown'} />
      ) : hasText ? (
        <div className={`reader-panes reader-panes--${mode}`}>
          {mode !== 'read' && <EditorPane key={loadId} initialText={controller.getDraft()} onChange={onEdit} />}
          {mode !== 'edit' &&
            (isJson ? (
              <JsonView
                ref={viewRef}
                text={mountText}
                kind={docKind}
                source={source}
                sourceId={sourceId}
                docPath={docPath}
                docTitle={docTitle}
                onParseError={onParseError}
              />
            ) : (
              <MarkdownView
                ref={viewRef}
                text={mountText}
                baseUrl={source}
                onHeadings={setHeadings}
                directorySource={directorySource}
                docPath={docPath}
                plugins={plugins}
                pluginKey={pluginConfigKey}
              />
            ))}
        </div>
      ) : (
        <ConnectedWelcome controller={controller} run={run} />
      )}
    </section>
  );
}

function ConnectedWelcome({ controller, run }: { controller: ReaderController; run: RunCommand }) {
  const recents = useReaderStore((s) => s.recents);
  return (
    <Welcome
      recents={recents}
      onOpenFile={() => run('open-file')}
      onOpenFolder={() => run('open-folder')}
      onOpenUrl={() => run('open-url')}
      onOpenRecent={controller.handleOpenRecent}
      onRefreshRecents={controller.refreshRecents}
      onAnnouncement={controller.notify}
    />
  );
}
