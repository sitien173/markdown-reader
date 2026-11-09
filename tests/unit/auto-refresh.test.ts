import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createController, type ReaderController } from '../../src/reader/controller';
import { defaultSettings, type Settings } from '../../src/lib/settings';
import { _resetStoreForTesting, useSettingsStore } from '../../src/store/settings-store';
import { clampIntervalSec, fileIntervalMs, httpIntervalMs } from '../../src/source/watch';

const URL_ = 'https://e.test/doc.md';

function general(patch: Partial<Settings['general']>) {
  useSettingsStore.setState({ settings: { ...defaultSettings, general: { ...defaultSettings.general, ...patch } } });
}

describe('interval clamp', () => {
  it('clamps to 0.5 to 600 seconds and falls back to 1 for non-finite values', () => {
    expect(clampIntervalSec(0.1)).toBe(0.5);
    expect(clampIntervalSec(0)).toBe(0.5);
    expect(clampIntervalSec(2)).toBe(2);
    expect(clampIntervalSec(9999)).toBe(600);
    expect(clampIntervalSec(Number.NaN)).toBe(1);
  });
  it('converts to milliseconds, with http at least 5 seconds', () => {
    expect(fileIntervalMs(0.5)).toBe(500);
    expect(fileIntervalMs(1000)).toBe(600_000);
    expect(httpIntervalMs(0.5)).toBe(5000);
    expect(httpIntervalMs(1)).toBe(5000);
    expect(httpIntervalMs(30)).toBe(30_000);
  });
});

describe('http auto-refresh through the controller', () => {
  let c: ReaderController;
  let fetchMock: ReturnType<typeof vi.fn>;
  // A small server model: validators are honored, and `fail` simulates a network error or a 500.
  const server = { body: 'v1', etag: '"1"', fail: null as null | 'network' | 'status' };
  const requests: Array<{ ifNoneMatch: string | null; ifModifiedSince: string | null }> = [];

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    _resetStoreForTesting();
    window.history.replaceState(null, '', '/');
    Object.assign(server, { body: 'v1', etag: '"1"', fail: null });
    requests.length = 0;
    fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      requests.push({ ifNoneMatch: headers.get('If-None-Match'), ifModifiedSince: headers.get('If-Modified-Since') });
      if (server.fail === 'network') throw new TypeError('offline');
      if (server.fail === 'status') return new Response('boom', { status: 500 });
      const responseHeaders = { ETag: server.etag, 'Last-Modified': 'Mon, 01 Jan 2024 00:00:00 GMT' };
      if (headers.get('If-None-Match') === server.etag) return new Response(null, { status: 304, headers: responseHeaders });
      return new Response(server.body, { status: 200, headers: responseHeaders });
    });
    vi.stubGlobal('fetch', fetchMock);
    const local = { get: vi.fn(async () => ({})), set: vi.fn(async () => undefined), remove: vi.fn(async () => undefined) };
    vi.stubGlobal('browser', { storage: { local, session: { get: vi.fn(async () => ({})), remove: vi.fn(async () => undefined) } } });
    c = createController();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    _resetStoreForTesting();
  });

  const advance = (ms: number) => vi.advanceTimersByTimeAsync(ms);

  async function open() {
    const stop = c.mount();
    await c.load(URL_);
    await advance(0);
    return stop;
  }

  it('sends no poll request while Auto-refresh web pages is off', async () => {
    general({ autoRefreshRemote: false });
    const stop = await open();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await advance(120_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    stop();
  });

  it('sends no poll request while Auto-refresh is off, even with web pages on', async () => {
    general({ autoRefresh: false, autoRefreshRemote: true });
    const stop = await open();
    await advance(120_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    stop();
  });

  it('runs an interval below 5 s at 5 s', async () => {
    general({ autoRefreshRemote: true, autoRefreshIntervalSec: 1 });
    const stop = await open();
    const baseline = fetchMock.mock.calls.length;
    await advance(4999);
    expect(fetchMock).toHaveBeenCalledTimes(baseline);
    await advance(1);
    expect(fetchMock).toHaveBeenCalledTimes(baseline + 1);
    stop();
  });

  it('keeps the current text on a 304 and sends validators', async () => {
    general({ autoRefreshRemote: true });
    const stop = await open();
    await advance(5000);
    const last = requests.at(-1);
    expect(last?.ifNoneMatch).toBe('"1"');
    expect(last?.ifModifiedSince).toBe('Mon, 01 Jan 2024 00:00:00 GMT');
    expect(c.store.getState().text).toBe('v1');
    expect(c.store.getState().externalChange).toBe(false);
    stop();
  });

  it('keeps the current text on a network error and doubles the delay up to a cap', async () => {
    general({ autoRefreshRemote: true });
    const stop = await open();
    server.fail = 'network';
    await advance(5000);
    const delays: number[] = [];
    // Each failed poll waits twice as long as the one before: 10 s, 20 s, 40 s, then the 300 s cap.
    for (const expected of [10_000, 20_000, 40_000, 80_000, 160_000, 300_000, 300_000]) {
      const before = fetchMock.mock.calls.length;
      await advance(expected - 1);
      expect(fetchMock).toHaveBeenCalledTimes(before);
      await advance(1);
      expect(fetchMock).toHaveBeenCalledTimes(before + 1);
      delays.push(expected);
    }
    expect(delays).toHaveLength(7);
    expect(c.store.getState().text).toBe('v1');
    stop();
  });

  it('keeps the text and backs off on a 500, then recovers the base delay', async () => {
    general({ autoRefreshRemote: true });
    const stop = await open();
    server.fail = 'status';
    await advance(5000);
    const before = fetchMock.mock.calls.length;
    await advance(9999);
    expect(fetchMock).toHaveBeenCalledTimes(before);
    server.fail = null;
    await advance(1);
    expect(fetchMock).toHaveBeenCalledTimes(before + 1);
    const afterRecovery = fetchMock.mock.calls.length;
    await advance(5000);
    expect(fetchMock).toHaveBeenCalledTimes(afterRecovery + 1);
    expect(c.store.getState().text).toBe('v1');
    stop();
  });

  it('replaces the text when the server changes and the draft is clean', async () => {
    general({ autoRefreshRemote: true });
    const stop = await open();
    Object.assign(server, { body: 'v2', etag: '"2"' });
    await advance(5000);
    expect(c.store.getState().text).toBe('v2');
    stop();
  });

  it('shows the external-change banner and keeps a dirty draft', async () => {
    general({ autoRefreshRemote: true });
    const stop = await open();
    c.edit('my unsaved edit');
    Object.assign(server, { body: 'v2', etag: '"2"' });
    await advance(5000);
    expect(c.store.getState().externalChange).toBe(true);
    expect(c.getDraft()).toBe('my unsaved edit');
    expect(c.store.getState().text).toBe('v1');
    stop();
  });

  it('starts and stops polling when the setting changes while open', async () => {
    general({ autoRefreshRemote: false });
    const stop = await open();
    await advance(60_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    general({ autoRefreshRemote: true });
    await advance(0);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    general({ autoRefreshRemote: false });
    await advance(120_000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    stop();
  });
});

describe('file URL auto-refresh through the controller', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    _resetStoreForTesting();
  });

  it('keeps a dirty draft and does not poll when Auto-refresh is off', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    _resetStoreForTesting();
    window.history.replaceState(null, '', '/');
    let body = 'disk 1';
    const fetchMock = vi.fn(async () => new Response(body));
    vi.stubGlobal('fetch', fetchMock);
    const local = { get: vi.fn(async () => ({})), set: vi.fn(async () => undefined), remove: vi.fn(async () => undefined) };
    vi.stubGlobal('browser', { storage: { local, session: { get: vi.fn(async () => ({})), remove: vi.fn(async () => undefined) } } });
    general({ autoRefresh: true });
    const c = createController();
    const stop = c.mount();
    await c.load('file:///tmp/a.md');
    c.edit('draft');
    body = 'disk 2';
    await vi.advanceTimersByTimeAsync(2000);
    expect(c.store.getState().externalChange).toBe(true);
    expect(c.getDraft()).toBe('draft');
    expect(c.store.getState().text).toBe('disk 1');
    stop();

    const c2 = createController();
    general({ autoRefresh: false });
    const stop2 = c2.mount();
    await c2.load('file:///tmp/b.md');
    const before = fetchMock.mock.calls.length;
    await vi.advanceTimersByTimeAsync(10_000);
    expect(fetchMock.mock.calls.length).toBe(before);
    stop2();
  });
});
