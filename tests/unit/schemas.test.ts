import { describe, expect, it, vi } from 'vitest';
import { usableCapturedText } from '../../src/source/captured-text';
import { parseCapturedText, parseRecentUrls, parseStoredHandle } from '../../src/lib/schemas';
import { getRecentUrls } from '../../src/store/recent';

const handle = { name: 'n', kind: 'file' };

describe('captured text schema', () => {
  it('accepts a complete record and keeps its fields', () => {
    expect(parseCapturedText({ url: 'u', text: 't', ts: 5, extra: 1 })).toEqual({ url: 'u', text: 't', ts: 5 });
  });
  it.each([
    null,
    undefined,
    'x',
    7,
    [],
    {},
    { url: 'u', text: 't' },
    { url: 'u', text: 1, ts: 5 },
    { url: 1, text: 't', ts: 5 },
    { url: 'u', text: 't', ts: '5' },
  ])('rejects malformed record %j', (bad) => {
    expect(parseCapturedText(bad)).toBeUndefined();
    expect(usableCapturedText(bad, 'u', 10)).toBeUndefined();
  });
  it('returns the text through usableCapturedText for a valid fresh record', () => {
    expect(usableCapturedText({ url: 'u', text: 'body', ts: 5 }, 'u', 10)).toBe('body');
  });
});

describe('stored handle schema', () => {
  const valid = { id: 'file:n', name: 'n', type: 'file', handle, lastOpened: 3 };
  it('accepts a complete record and keeps the handle reference', () => {
    expect(parseStoredHandle(valid)?.handle).toBe(handle);
  });
  it.each([null, 'x', 1, {}])('rejects a value without a handle key %j', (bad) => {
    expect(parseStoredHandle(bad)).toBeUndefined();
  });
  // Pre-Zod behavior: any object with a handle key is listed, so partial records still appear as Reconnect entries.
  it.each([{ ...valid, handle: undefined }, { ...valid, id: 1 }, { handle }])('keeps a partial record with a handle key %j', (partial) => {
    expect(parseStoredHandle(partial)).toBe(partial);
  });
});

describe('recent URL list schema', () => {
  it('keeps strings and drops other items', () => {
    expect(parseRecentUrls(['a', 1, null, 'b', {}])).toEqual(['a', 'b']);
  });
  it.each([undefined, null, 'a', 5, { 0: 'a' }])('falls back to an empty list for %j', (bad) => {
    expect(parseRecentUrls(bad)).toEqual([]);
  });
  it('is used by getRecentUrls for malformed storage', async () => {
    const storage = { get: vi.fn(async () => ({ recentUrls: ['a', 2, 'b'] })), set: vi.fn() };
    expect(await getRecentUrls(storage as never)).toEqual(['a', 'b']);
    expect(await getRecentUrls({ get: async () => ({ recentUrls: 'bad' }), set: vi.fn() } as never)).toEqual([]);
  });
});

describe('jitless validation', () => {
  async function evalCalls() {
    vi.resetModules();
    const schemas = await import('../../src/lib/schemas');
    const Original = globalThis.Function;
    const calls = vi.fn();
    globalThis.Function = new Proxy(Original, {
      construct(target, args) {
        calls();
        return Reflect.construct(target, args);
      },
    });
    try {
      schemas.parseCapturedText({ url: 'u', text: 't', ts: 1 });
      schemas.parseStoredHandle({ id: 'a', name: 'a', type: 'file', handle, lastOpened: 1 });
    } finally {
      globalThis.Function = Original;
    }
    return calls.mock.calls.length;
  }
  it('never calls new Function once jitless is configured', async () => {
    expect(await evalCalls()).toBe(0);
  });
});
