import { act, forwardRef, useImperativeHandle } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReaderStore } from '../../src/store/reader-store';

// Render counters and the store of the mounted App, shared with the module mocks below.
const spy = vi.hoisted(() => ({
  store: undefined as unknown as ReaderStore,
  renders: { toolbar: 0, banner: 0, palette: 0, view: 0, toc: 0 },
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
  window.history.replaceState(null, '', '/?mode=read');
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
});
