import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { watchFileHandle, watchFileUrl, watchHttpUrl, watchPolling } from '../../src/source/watch';

describe('polling watcher', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('reports a change once when lastModified moves, then stops after unsubscribe', async () => {
    let stamp = 1000;
    const onChange = vi.fn();
    const onDeleted = vi.fn();
    const stop = watchPolling({ stamp: async () => stamp, onChange, onDeleted, intervalMs: 1000 });
    await vi.advanceTimersByTimeAsync(1000);
    expect(onChange).not.toHaveBeenCalled();
    stamp = 2000;
    await vi.advanceTimersByTimeAsync(1000);
    expect(onChange).toHaveBeenCalledTimes(1);
    stop();
    stamp = 3000;
    await vi.advanceTimersByTimeAsync(5000);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it('announces deletion when the stamp becomes null', async () => {
    let stamp: number | null = 1000;
    const onDeleted = vi.fn();
    const stop = watchPolling({ stamp: async () => stamp, onChange: vi.fn(), onDeleted, intervalMs: 1000 });
    stamp = null;
    await vi.advanceTimersByTimeAsync(1000);
    expect(onDeleted).toHaveBeenCalledTimes(1);
    stop();
  });
});

describe('handle watcher', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('disconnects the FileSystemObserver on unsubscribe and reports modifications', async () => {
    const disconnect = vi.fn();
    let deliver: (records: Array<{ type: string }>) => void = () => {};
    class FakeObserver {
      constructor(callback: (records: Array<{ type: string }>) => void) {
        deliver = callback;
      }
      observe = vi.fn(async () => {});
      disconnect = disconnect;
    }
    vi.stubGlobal('FileSystemObserver', FakeObserver);
    const onChange = vi.fn();
    const stop = watchFileHandle({ getFile: async () => ({ lastModified: 1 }) } as unknown as FileSystemFileHandle, {
      onChange,
      onDeleted: vi.fn(),
    });
    deliver([{ type: 'modified' }]);
    expect(onChange).toHaveBeenCalledTimes(1);
    stop();
    expect(disconnect).toHaveBeenCalledTimes(1);
  });

  it('falls back to lastModified polling without FileSystemObserver and stops on unsubscribe', async () => {
    vi.stubGlobal('FileSystemObserver', undefined);
    let modified = 1000;
    const onChange = vi.fn();
    const stop = watchFileHandle({ getFile: async () => ({ lastModified: modified }) } as unknown as FileSystemFileHandle, {
      onChange,
      onDeleted: vi.fn(),
    });
    await vi.advanceTimersByTimeAsync(1000);
    modified = 2000;
    await vi.advanceTimersByTimeAsync(1000);
    expect(onChange).toHaveBeenCalledTimes(1);
    stop();
    modified = 3000;
    await vi.advanceTimersByTimeAsync(5000);
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});

describe('http watcher', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('requests only the document URL without following redirects, and sends validators only after the first reply', async () => {
    const fetchMock = vi.fn(async () => new Response('a', { headers: { ETag: '"x"' } }));
    vi.stubGlobal('fetch', fetchMock);
    const stop = watchHttpUrl('https://e.test/doc.md', { onChange: vi.fn(), onDeleted: vi.fn(), intervalMs: 5000 });
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(5000);
    const calls = fetchMock.mock.calls as unknown as Array<[string, RequestInit]>;
    expect(calls.map(([url]) => url)).toEqual(['https://e.test/doc.md', 'https://e.test/doc.md']);
    expect(calls.every(([, init]) => init.redirect === 'manual')).toBe(true);
    expect(calls[0]?.[1].headers).toBeUndefined();
    expect(calls[1]?.[1].headers).toEqual({ 'If-None-Match': '"x"' });
    stop();
  });

  it('reports a change once when the text moves', async () => {
    let body = 'a';
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(body)),
    );
    const onChange = vi.fn();
    const stop = watchHttpUrl('https://e.test/doc.md', { onChange, onDeleted: vi.fn(), intervalMs: 5000 });
    await vi.advanceTimersByTimeAsync(5000);
    expect(onChange).not.toHaveBeenCalled();
    body = 'b';
    await vi.advanceTimersByTimeAsync(5000);
    await vi.advanceTimersByTimeAsync(5000);
    expect(onChange).toHaveBeenCalledTimes(1);
    stop();
  });

  describe('redirecting document URL', () => {
    const opaque = () => ({ type: 'opaqueredirect', ok: false, status: 0, headers: new Headers() }) as unknown as Response;
    const setup = (body: () => string) => {
      const fetchMock = vi.fn(async (_url: string, init: RequestInit) =>
        init.redirect === 'follow' ? new Response(body(), { headers: { ETag: '"y"' } }) : opaque(),
      );
      vi.stubGlobal('fetch', fetchMock);
      return fetchMock;
    };

    it('reports a change once when the followed text moves, sending no validators', async () => {
      let body = 'a';
      const fetchMock = setup(() => body);
      const onChange = vi.fn();
      const stop = watchHttpUrl('http://e.test/doc.md', { onChange, onDeleted: vi.fn(), intervalMs: 5000 });
      await vi.advanceTimersByTimeAsync(5000);
      expect(onChange).not.toHaveBeenCalled();
      body = 'b';
      await vi.advanceTimersByTimeAsync(5000);
      await vi.advanceTimersByTimeAsync(5000);
      expect(onChange).toHaveBeenCalledTimes(1);
      const calls = fetchMock.mock.calls as unknown as Array<[string, RequestInit]>;
      expect(calls.some(([, init]) => init.redirect === 'follow')).toBe(true);
      expect(calls.filter(([, init]) => init.redirect === 'follow').every(([, init]) => init.cache === 'no-cache')).toBe(true);
      expect(calls.every(([, init]) => init.headers === undefined)).toBe(true);
      stop();
    });

    it('does not report a change when the followed text is unchanged', async () => {
      setup(() => 'a');
      const onChange = vi.fn();
      const stop = watchHttpUrl('http://e.test/doc.md', { onChange, onDeleted: vi.fn(), intervalMs: 5000 });
      await vi.advanceTimersByTimeAsync(5000);
      await vi.advanceTimersByTimeAsync(5000);
      await vi.advanceTimersByTimeAsync(5000);
      expect(onChange).not.toHaveBeenCalled();
      expect(vi.getTimerCount()).toBe(1);
      stop();
    });
  });

  it('stops polling and aborts the in-flight request on unsubscribe', async () => {
    let signal: AbortSignal | undefined;
    const fetchMock = vi.fn((_url: string, init: RequestInit) => {
      signal = init.signal as AbortSignal;
      return new Promise<Response>(() => undefined);
    });
    vi.stubGlobal('fetch', fetchMock);
    const stop = watchHttpUrl('https://e.test/doc.md', { onChange: vi.fn(), onDeleted: vi.fn(), intervalMs: 5000 });
    await vi.advanceTimersByTimeAsync(0);
    expect(signal?.aborted).toBe(false);
    stop();
    expect(signal?.aborted).toBe(true);
    await vi.advanceTimersByTimeAsync(600_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('clears the pending timer on unsubscribe between polls', async () => {
    const fetchMock = vi.fn(async () => new Response('a'));
    vi.stubGlobal('fetch', fetchMock);
    const stop = watchHttpUrl('https://e.test/doc.md', { onChange: vi.fn(), onDeleted: vi.fn(), intervalMs: 5000 });
    await vi.advanceTimersByTimeAsync(0);
    expect(vi.getTimerCount()).toBe(1);
    stop();
    expect(vi.getTimerCount()).toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('configured intervals', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('polls a file URL at the configured interval and stops on unsubscribe', async () => {
    const fetchMock = vi.fn(async () => new Response('a'));
    vi.stubGlobal('fetch', fetchMock);
    const stop = watchFileUrl('file:///tmp/a.md', { onChange: vi.fn(), onDeleted: vi.fn(), intervalMs: 3000 });
    await vi.advanceTimersByTimeAsync(0);
    const before = fetchMock.mock.calls.length;
    await vi.advanceTimersByTimeAsync(2999);
    expect(fetchMock).toHaveBeenCalledTimes(before);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchMock).toHaveBeenCalledTimes(before + 1);
    stop();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetchMock).toHaveBeenCalledTimes(before + 1);
  });
  it('polls a file handle at the configured interval when FileSystemObserver is missing', async () => {
    vi.stubGlobal('FileSystemObserver', undefined);
    const getFile = vi.fn(async () => ({ lastModified: 1 }));
    const stop = watchFileHandle({ getFile } as unknown as FileSystemFileHandle, {
      onChange: vi.fn(),
      onDeleted: vi.fn(),
      intervalMs: 2500,
    });
    await vi.advanceTimersByTimeAsync(0);
    const before = getFile.mock.calls.length;
    await vi.advanceTimersByTimeAsync(2499);
    expect(getFile).toHaveBeenCalledTimes(before);
    await vi.advanceTimersByTimeAsync(1);
    expect(getFile).toHaveBeenCalledTimes(before + 1);
    stop();
  });
});
