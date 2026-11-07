import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useShallow } from 'zustand/react/shallow';
import { EditorPane } from '../../ui/editor-pane';
import type { MarkdownViewHandle } from '../../ui/markdown-view';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { SaveConflictDialog } from '../../ui/save-conflict-dialog';
import { Button } from '../../components/ui/button';
import { Spinner } from '../../components/ui/spinner';
import { createCommands } from '../../reader/commands';
import { createController, type ReaderController } from '../../reader/controller';
import { createReaderStore, ReaderStoreContext, type ReaderStore, selectBanners, useReaderStore } from '../../store/reader-store';
import { FileTree } from '../../ui/file-tree';
import { RecentSection } from '../../ui/recent-section';
import type { Heading } from '../../render/pipeline';
import { MarkdownView } from '../../ui/markdown-view';
import { Toolbar } from '../../ui/toolbar';
import { scrollBehavior, TocPanel } from '../../ui/toc-panel';
import { DropOverlay } from '../../ui/drop-overlay';
import { OpenUrlDialog } from '../../ui/open-url-dialog';
import { StatusBanner } from '../../ui/status-banner';
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

function Reader({ controller }: { controller: ReaderController }) {
  const viewRef = useRef<MarkdownViewHandle | null>(null);
  // The shell subscribes only to what it renders itself; every panel below selects its own fields.
  const focusMode = useReaderStore((s) => s.focusMode);
  const sidebarOpen = useReaderStore((s) => s.sidebarOpen);
  const patch = controller.store.setState;
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => controller.mount(), [controller]);

  useEffect(() => {
    if (!focusMode) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      if (document.querySelector('[role="dialog"]:not([data-slot="toast"], [data-ending-style]), [role="menu"]:not([data-ending-style])'))
        return;
      patch({ focusMode: false });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [focusMode, patch]);

  // Leaving focus mode remounts the toolbar; return keyboard focus to the button that entered it.
  const wasFocusMode = useRef(false);
  useEffect(() => {
    if (wasFocusMode.current && !focusMode) {
      document.querySelector<HTMLButtonElement>('[data-slot="reader-bar"] [aria-label="Focus mode"]')?.focus();
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
      const container = document.querySelector<HTMLElement>('[data-slot="markdown"]');
      const contentHtml = container ? container.innerHTML : '';
      const title = (docPath ? docPath.split('/').pop() : null)?.replace(/\.md$/i, '') || headings[0]?.text || 'document';
      await downloadHtml(title, contentHtml);
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
      {!focusMode && <Toolbar commands={commands} onMode={controller.setMode} />}
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
      <DropOverlay />
      <div className="reader-body">
        <Sidebar controller={controller} />
        <Content controller={controller} viewRef={viewRef} run={run} />
      </div>
    </main>
  );
}

function Banners({ controller }: { controller: ReaderController }) {
  const error = useReaderStore((s) => s.error);
  const externalChange = useReaderStore((s) => s.externalChange);
  const banners = useMemo(() => selectBanners({ error, externalChange }), [error, externalChange]);
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
  const sidebarOpen = useReaderStore((s) => s.sidebarOpen);
  const sidebarTab = useReaderStore((s) => s.sidebarTab);
  return (
    <aside className="reader-toc" data-slot="reader-toc" inert={!sidebarOpen}>
      <Tabs value={sidebarTab} onValueChange={(tab) => controller.store.setState({ sidebarTab: tab === 'files' ? 'files' : 'contents' })}>
        <TabsList variant="line" activateOnFocus>
          <TabsTrigger value="contents">Contents</TabsTrigger>
          <TabsTrigger value="files">Files</TabsTrigger>
        </TabsList>
        <TabsContent value="contents">
          <ContentsPanel />
        </TabsContent>
        <TabsContent value="files">
          <FilesPanel controller={controller} />
        </TabsContent>
      </Tabs>
    </aside>
  );
}

function ContentsPanel() {
  const headings = useReaderStore((s) => s.headings);
  return <TocPanel headings={headings} />;
}

function FilesPanel({ controller }: { controller: ReaderController }) {
  const { text, directorySource, docPath, treeNodes, recents } = useReaderStore(
    useShallow((s) => ({
      text: s.text,
      directorySource: s.directorySource,
      docPath: s.docPath,
      treeNodes: s.treeNodes,
      recents: s.recents,
    })),
  );
  return (
    <>
      {directorySource ? (
        <div className="reader-files-panel">
          <div className="reader-folder-actions">
            <Button variant="secondary" onClick={() => void controller.openFolder()}>
              Open folder
            </Button>
          </div>
          <FileTree nodes={treeNodes} activePath={docPath} onSelectFile={(p) => void controller.selectTreeFile(p)} />
        </div>
      ) : (
        <div className="reader-files-empty">
          <p className="text-sm">No folder opened.</p>
          <Button variant="secondary" onClick={() => void controller.openFolder()}>
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
  const { mode, mountText, loadId, source, loading, directorySource, docPath } = useReaderStore(
    useShallow((s) => ({
      mode: s.mode,
      mountText: s.mountText,
      loadId: s.loadId,
      source: s.source,
      loading: s.loading,
      directorySource: s.directorySource,
      docPath: s.docPath,
    })),
  );
  const hasText = useDocumentReveal(controller.store);
  const setHeadings = useCallback((headings: Heading[]) => controller.store.setState({ headings }), [controller]);
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

  return (
    // Delegated handler for Markdown links, which are natively keyboard-operable; the section itself is not interactive.
    // biome-ignore lint/a11y/noStaticElementInteractions: event delegation for links inside rendered Markdown
    // biome-ignore lint/a11y/useKeyWithClickEvents: links handle their own keyboard activation, which bubbles as click
    <section data-slot="reader-content" className="reader-content" onClick={onContentClick}>
      {loading ? (
        <Spinner aria-label="Loading Markdown" />
      ) : hasText ? (
        <div className={`reader-panes reader-panes--${mode}`}>
          {mode !== 'read' && <EditorPane key={loadId} initialText={controller.getDraft()} onChange={onEdit} />}
          {mode !== 'edit' && (
            <MarkdownView
              ref={viewRef}
              text={mountText}
              baseUrl={source}
              onHeadings={setHeadings}
              directorySource={directorySource}
              docPath={docPath}
            />
          )}
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
