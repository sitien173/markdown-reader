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
});

describe('store scope', () => {
  it('does not share state between stores', () => {
    const other = createReaderStore();
    store.setState({ dirty: true, docPath: 'a.md' });
    expect(other.getState()).toMatchObject({ dirty: false, docPath: null });
  });
});

describe('banners selector', () => {
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
