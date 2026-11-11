import { beforeEach, describe, expect, it } from 'vitest';
import { createReaderStore, parseMode, type ReaderStore, selectBanners } from '../../src/store/reader-store';

let store: ReaderStore;
const get = () => store.getState();

beforeEach(() => {
  window.history.replaceState(null, '', '/');
  store = createReaderStore();
});

describe('reader store', () => {
  it('starts with documented defaults', () => {
    expect(get()).toMatchObject({
      docKind: 'markdown',
      mode: 'read',
      source: '',
      docPath: null,
      loading: false,
      headings: [],
      recents: [],
      sidebarOpen: true,
      sidebarTab: 'contents',
      focusMode: false,
      error: '',
      parseError: null,
      externalChange: false,
      conflict: false,
      dirty: false,
      writable: false,
      docTitle: '',
      urlDialogOpen: false,
      text: null,
      fileTree: null,
      fileAccessError: false,
    });
  });

  it('keeps the status flags independent', () => {
    store.setState({ dirty: true, conflict: true });
    expect(get()).toMatchObject({ dirty: true, conflict: true, error: '', externalChange: false, writable: false });
  });

  it('a new store starts from defaults and reads mode and src from the URL', () => {
    store.setState({ dirty: true, error: 'x', headings: [{ id: 'a', text: 'A', level: 1 }], docPath: 'a.md' });
    window.history.replaceState(null, '', '/?mode=split&src=https%3A%2F%2Fe.test%2Fa.md');
    store = createReaderStore();
    expect(get()).toMatchObject({ mode: 'split', source: 'https://e.test/a.md', dirty: false, error: '', headings: [], docPath: null });
  });

  it('falls back to read for an unknown mode', () => {
    expect(parseMode('bogus')).toBe('read');
    expect(parseMode(null)).toBe('read');
    expect(parseMode('edit')).toBe('edit');
  });

  it('derives docKind from src and clamps mode to read for JSON files', () => {
    window.history.replaceState(null, '', '/?src=a.json&mode=edit');
    store = createReaderStore();
    expect(get()).toMatchObject({ docKind: 'json', mode: 'read', source: 'a.json' });

    window.history.replaceState(null, '', '/?src=config.jsonc&mode=split');
    store = createReaderStore();
    expect(get()).toMatchObject({ docKind: 'jsonc', mode: 'read', source: 'config.jsonc' });

    window.history.replaceState(null, '', '/?src=doc.md&mode=edit');
    store = createReaderStore();
    expect(get()).toMatchObject({ docKind: 'markdown', mode: 'edit', source: 'doc.md' });
  });
});

describe('store scope', () => {
  it('does not share state between stores', () => {
    const other = createReaderStore();
    store.setState({ dirty: true, docPath: 'a.md' });
    expect(other.getState()).toMatchObject({ dirty: false, docPath: null });
  });
});

describe('banners selector', () => {
  it('lists error then jsonError then external change when all are set', () => {
    store.setState({
      externalChange: true,
      error: 'Boom',
      parseError: { message: 'Invalid token', line: 1, column: 2 },
    });
    expect(selectBanners(get())).toEqual([
      { kind: 'error', message: 'Boom' },
      { kind: 'jsonError', message: 'Invalid token', line: 1, column: 2 },
      { kind: 'externalChange' },
    ]);
  });
  it('lists error then external change when both are set', () => {
    store.setState({ externalChange: true, error: 'Boom' });
    expect(selectBanners(get())).toEqual([{ kind: 'error', message: 'Boom' }, { kind: 'externalChange' }]);
  });
  it('keeps the external change after the error is cleared', () => {
    store.setState({ externalChange: true, error: 'Boom' });
    store.setState({ error: '' });
    expect(selectBanners(get())).toEqual([{ kind: 'externalChange' }]);
  });
  it('is empty when nothing is wrong', () => {
    expect(selectBanners(get())).toEqual([]);
  });
});
