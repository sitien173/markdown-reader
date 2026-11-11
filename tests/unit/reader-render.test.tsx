// @vitest-environment jsdom
import { act, forwardRef, useImperativeHandle } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultSettings } from '../../src/lib/settings';
import { pluginKey, planBlocks, type PluginConfig } from '../../src/render/pipeline';
import type { ReaderStore } from '../../src/store/reader-store';
import { useSettingsStore } from '../../src/store/settings-store';

// Render counters and the store of the mounted App, shared with the module mocks below.
const spy = vi.hoisted(() => ({
  store: undefined as unknown as ReaderStore,
  renders: { toolbar: 0, banner: 0, palette: 0, view: 0, toc: 0, menu: 0 },
}));

vi.mock('../../src/store/reader-store', async (importActual) => {
  const actual = await importActual<typeof import('../../src/store/reader-store')>();
  return {
    ...actual,
    createReaderStore: () => {
      spy.store = actual.createReaderStore();
      return spy.store;
    },
  };
});
vi.mock('../../src/ui/toolbar', async (importActual) => {
  const actual = await importActual<typeof import('../../src/ui/toolbar')>();
  return {
    Toolbar: (props: Parameters<typeof actual.Toolbar>[0]) => {
      spy.renders.toolbar++;
      return <actual.Toolbar {...props} />;
    },
  };
});
vi.mock('../../src/ui/status-banner', async (importActual) => {
  const actual = await importActual<typeof import('../../src/ui/status-banner')>();
  return {
    StatusBanner: (props: Parameters<typeof actual.StatusBanner>[0]) => {
      spy.renders.banner++;
      return <actual.StatusBanner {...props} />;
    },
  };
});
vi.mock('../../src/ui/command-palette', async (importActual) => {
  const actual = await importActual<typeof import('../../src/ui/command-palette')>();
  return {
    CommandPalette: (props: Parameters<typeof actual.CommandPalette>[0]) => {
      spy.renders.palette++;
      return <actual.CommandPalette {...props} />;
    },
  };
});
vi.mock('../../src/ui/reader-menu', async (importActual) => {
  const actual = await importActual<typeof import('../../src/ui/reader-menu')>();
  return {
    ReaderMenu: (props: Parameters<typeof actual.ReaderMenu>[0]) => {
      spy.renders.menu++;
      return <actual.ReaderMenu {...props} />;
    },
  };
});
vi.mock('../../src/ui/toc-panel', async (importActual) => {
  const actual = await importActual<typeof import('../../src/ui/toc-panel')>();
  return {
    ...actual,
    TocPanel: (props: Parameters<typeof actual.TocPanel>[0]) => {
      spy.renders.toc++;
      return <actual.TocPanel {...props} />;
    },
  };
});
vi.mock('../../src/ui/markdown-view', () => ({
  MarkdownView: forwardRef<{ update(text: string): void; ready(): Promise<void> }, { text: string }>(function MarkdownView({ text }, ref) {
    spy.renders.view++;
    useImperativeHandle(ref, () => ({ update: () => undefined, ready: async () => undefined }));
    return <div data-testid="markdown">{text}</div>;
  }),
}));
vi.mock('../../src/ui/editor-pane', () => ({ EditorPane: () => <textarea data-testid="editor" /> }));
vi.mock('../../src/store/handles', () => ({
  storeHandle: vi.fn(async () => undefined),
  requestHandlePermission: vi.fn(async () => 'granted'),
}));
vi.mock('../../src/store/recent', () => ({
  addRecentUrl: vi.fn(async () => undefined),
  getRecentEntries: vi.fn(async () => []),
}));

import App from '../../src/entrypoints/reader/App';

let container: HTMLElement;
let root: Root;

async function flush() {
  for (let i = 0; i < 3; i++)
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
}
const snapshot = () => ({ ...spy.renders });

beforeEach(async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const local = { get: vi.fn(async () => ({})), set: vi.fn(async () => undefined), remove: vi.fn(async () => undefined) };
  vi.stubGlobal('browser', { storage: { local, session: { get: vi.fn(async () => ({})), remove: vi.fn(async () => undefined) } } });
  window.history.replaceState(null, '', '/?mode=split');
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    root.render(<App />);
  });
  await flush();
  await act(async () => {
    spy.store.setState({ text: '# A', mountText: '# A', source: 'file:///a.md', docTitle: 'a.md' });
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

describe('reader shell render scope', () => {
  it('renders the document before the scope checks run', () => {
    expect(container.querySelector('[data-testid="markdown"]')?.textContent).toBe('# A');
    expect(spy.renders.toolbar).toBeGreaterThan(0);
  });

  it('a headings-only write re-renders only the contents panel', async () => {
    const before = snapshot();
    await act(async () => {
      spy.store.setState({ headings: [{ id: 'a', text: 'A', level: 1 }] });
    });
    await flush();
    expect(spy.renders.toc).toBeGreaterThan(before.toc);
    expect({ ...spy.renders, toc: 0 }).toEqual({ ...before, toc: 0 });
  });

  it('a write to a field the shell does not render re-renders nothing', async () => {
    const before = snapshot();
    await act(async () => {
      spy.store.setState({ loadId: 0, treeNodes: [] });
    });
    await flush();
    expect(snapshot()).toEqual(before);
  });

  it('an error write re-renders the banner but not the toolbar or the document', async () => {
    const before = snapshot();
    await act(async () => {
      spy.store.setState({ error: 'Boom' });
    });
    await flush();
    expect(spy.renders.banner).toBeGreaterThan(before.banner);
    expect(spy.renders.toolbar).toBe(before.toolbar);
    expect(spy.renders.view).toBe(before.view);
  });

  it('proves the JSON error banner renders above the original text and has no Retry button, and that the fetch-error banner still has Retry', async () => {
    await act(async () => {
      spy.store.setState({
        text: '{"broken": }',
        mountText: '{"broken": }',
        parseError: { message: 'Unexpected token', line: 1, column: 11 },
      });
    });
    await flush();

    const bannerContainer = container.querySelector('[data-slot="status-banner"]');
    const contentContainer = container.querySelector('[data-slot="reader-content"]');
    expect(bannerContainer).not.toBeNull();
    expect(contentContainer).not.toBeNull();
    expect(
      Boolean(
        bannerContainer && contentContainer && bannerContainer.compareDocumentPosition(contentContainer) & Node.DOCUMENT_POSITION_FOLLOWING,
      ),
    ).toBe(true);
    expect(bannerContainer?.textContent).toContain('Unexpected token (line 1, column 11)');
    expect(bannerContainer?.querySelector('button')).toBeNull();

    await act(async () => {
      spy.store.setState({
        parseError: null,
        error: 'Failed to fetch',
      });
    });
    await flush();

    expect(bannerContainer?.textContent).toContain('Failed to fetch');
    const retryBtn = Array.from(bannerContainer?.querySelectorAll('button') ?? []).find((b) => b.textContent === 'Retry');
    expect(retryBtn).toBeDefined();
  });
});

describe('JSON preview rendering in App', () => {
  it('shows Spinner with aria-label="Loading" for JSON document when loading', async () => {
    await act(async () => {
      spy.store.setState({ docKind: 'json', loading: true });
    });
    await flush();

    const spinner = container.querySelector('[aria-label="Loading"]');
    expect(spinner).not.toBeNull();
    expect(container.querySelector('[aria-label="Loading Markdown"]')).toBeNull();
  });

  it('renders JsonView for JSON document and writes parseError into store', async () => {
    await act(async () => {
      spy.store.setState({
        docKind: 'json',
        loading: false,
        text: '{"a": 1,}',
        mountText: '{"a": 1,}',
        source: 'file:///data.json',
      });
    });
    await flush();

    expect(container.querySelector('[data-testid="markdown"]')).toBeNull();
    expect(container.querySelector('.md-content')).not.toBeNull();
    await vi.waitFor(() => {
      expect(spy.store.getState().parseError).toEqual(
        expect.objectContaining({
          line: 1,
          column: 9,
        }),
      );
    });
  });
});

describe('reader shell render scope in read mode', () => {
  beforeEach(async () => {
    await act(async () => root.unmount());
    root = createRoot(container);
    window.history.replaceState(null, '', '/?mode=read');
    await act(async () => {
      root.render(<App />);
    });
    await flush();
    await act(async () => {
      spy.store.setState({ text: '# A', mountText: '# A', source: 'file:///a.md', docTitle: 'a.md' });
    });
    await flush();
  });

  it('renders the menu before the scope check runs', () => {
    expect(spy.renders.menu).toBeGreaterThan(0);
  });

  it('a write to a field the shell does not render re-renders nothing', async () => {
    const before = snapshot();
    await act(async () => {
      spy.store.setState({ loadId: 0, treeNodes: [] });
    });
    await flush();
    expect(snapshot()).toEqual(before);
  });
});

describe('contents panel collapse state', () => {
  const nested = [
    { id: 'a', text: 'Alpha', level: 1 },
    { id: 'b', text: 'Beta', level: 2 },
  ];
  const collapseButton = () => container.querySelector<HTMLButtonElement>('button[aria-label="Collapse Alpha"]');
  beforeEach(async () => {
    await act(async () => {
      useSettingsStore.setState({
        settings: { ...defaultSettings, general: { ...defaultSettings.general, outlineCollapsing: true } },
      });
      spy.store.setState({ headings: nested });
    });
    await flush();
    await act(async () => {
      collapseButton()?.click();
    });
  });

  it('keeps collapse state when only the headings change', async () => {
    expect(container.querySelector('button[aria-label="Expand Alpha"]')).not.toBeNull();
    await act(async () => {
      spy.store.setState({ headings: nested.map((h) => ({ ...h })) });
    });
    await flush();
    expect(container.querySelector('button[aria-label="Expand Alpha"]')).not.toBeNull();
  });

  it('keeps collapse state when loadId bumps for the same source', async () => {
    await act(async () => {
      spy.store.setState({ loadId: spy.store.getState().loadId + 1, headings: nested.map((h) => ({ ...h })) });
    });
    await flush();
    expect(container.querySelector('button[aria-label="Expand Alpha"]')).not.toBeNull();
  });

  it('resets collapse state when the source changes', async () => {
    expect(container.querySelector('button[aria-label="Expand Alpha"]')).not.toBeNull();
    await act(async () => {
      spy.store.setState({ sourceId: 'file:b', loadId: spy.store.getState().loadId + 1, headings: nested.map((h) => ({ ...h })) });
    });
    await flush();
    expect(collapseButton()).not.toBeNull();
  });

  it('keeps collapse state across split-mode edits', async () => {
    await act(async () => {
      spy.store.setState({ text: '# Alpha\n\n## Beta\n\nmore', dirty: true, headings: nested.map((h) => ({ ...h })) });
    });
    await flush();
    expect(container.querySelector('button[aria-label="Expand Alpha"]')).not.toBeNull();
  });
});

describe('Escape in fullscreen with a dialog open', () => {
  afterEach(() => {
    delete (document as { fullscreenElement?: unknown }).fullscreenElement;
    document.querySelector('[data-testid="stub-dialog"]')?.remove();
  });

  async function pressEscape() {
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
  }

  it('leaves fullscreen alone and keeps focus mode while a dialog is open', async () => {
    const exit = vi.fn(async () => undefined);
    Object.defineProperty(document, 'fullscreenElement', { value: document.body, configurable: true });
    document.exitFullscreen = exit;
    await act(async () => spy.store.setState({ focusMode: true }));
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    dialog.dataset.testid = 'stub-dialog';
    document.body.append(dialog);
    await pressEscape();
    expect(exit).not.toHaveBeenCalled();
    expect(spy.store.getState().focusMode).toBe(true);
    dialog.remove();
    await pressEscape();
    expect(exit).toHaveBeenCalledTimes(1);
  });
});

describe('plugin config reaches the document', () => {
  const on = defaultSettings.plugins;
  let host: HTMLElement;
  let hostRoot: Root;
  beforeEach(() => {
    host = document.createElement('div');
    document.body.append(host);
    hostRoot = createRoot(host);
  });
  afterEach(async () => {
    await act(async () => hostRoot.unmount());
    host.remove();
  });
  async function mountView(text: string, plugins: PluginConfig) {
    const { MarkdownView } = await vi.importActual<typeof import('../../src/ui/markdown-view')>('../../src/ui/markdown-view');
    const draw = (config: PluginConfig) =>
      act(async () => {
        hostRoot.render(<MarkdownView text={text} baseUrl="file:///a.md" plugins={config} pluginKey={pluginKey(config)} />);
      });
    await draw(plugins);
    return draw;
  }

  it('changing one plugin flag replaces every mounted block', async () => {
    const draw = await mountView('one\n\ntwo\n\nthree', on);
    const before = [...host.querySelectorAll('.md-block')];
    expect(before).toHaveLength(3);
    await draw({ ...on, emoji: false });
    const after = [...host.querySelectorAll('.md-block')];
    expect(after).toHaveLength(3);
    expect(after.filter((block) => before.includes(block))).toEqual([]);
  });

  it('a planBlocks key differs when the plugin key differs', () => {
    const keys = (plugins: PluginConfig) => planBlocks('one\n\ntwo', 'file:///a.md', new Map(), undefined, plugins).keys;
    const a = keys(on);
    const b = keys({ ...on, emoji: false });
    const c = keys({ ...on, emoji: false, mark: false });
    expect(a).not.toEqual(b);
    expect(b).not.toEqual(c);
    expect(a).not.toEqual(c);
  });

  it('fills [[TOC]] from the headings and refills when they change', async () => {
    const draw = await mountView('[[TOC]]\n\n# Alpha\n\n## Beta', on);
    const links = () => [...host.querySelectorAll('[data-toc-placeholder] a')].map((a) => a.textContent);
    expect(links()).toEqual(['Alpha', 'Beta']);
    expect(host.querySelector('[data-toc-placeholder] ul ul a')?.textContent).toBe('Beta');
    expect(host.querySelector('[data-toc-placeholder] a')?.getAttribute('href')).toBe('#user-content-alpha');
    await draw({ ...on, toc: false });
    expect(host.querySelector('[data-toc-placeholder]')).toBeNull();
  });
});
