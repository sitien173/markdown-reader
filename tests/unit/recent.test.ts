import { afterEach, describe, expect, it, vi } from 'vitest';
import { addRecentUrl, getRecentUrls, RECENT_URLS_KEY } from '../../src/store/recent';

describe('recent URLs', () => {
  const data: Record<string, unknown> = {};
  const local = {
    get: vi.fn(async (key: string) => ({ [key]: data[key] })),
    set: vi.fn(async (value: Record<string, unknown>) => {
      Object.assign(data, value);
    }),
  };
  afterEach(() => {
    vi.clearAllMocks();
    delete data[RECENT_URLS_KEY];
  });
  it('does not lose entries when concurrent writes race', async () => {
    const state: Record<string, unknown> = {};
    const delayed = {
      get: async (key: string) => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        return { [key]: state[key] };
      },
      set: async (value: Record<string, unknown>) => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        Object.assign(state, value);
      },
    };
    let tail = Promise.resolve();
    vi.stubGlobal('navigator', {
      locks: {
        request: async (_name: string, callback: () => Promise<void>) => {
          const current = tail.then(callback);
          tail = current.catch(() => undefined);
          return current;
        },
      },
    });
    await Promise.all(Array.from({ length: 8 }, (_, i) => addRecentUrl(`https://example.test/${i}.md`, delayed)));
    expect(await getRecentUrls(delayed)).toHaveLength(8);
  });
  it('deduplicates URLs, puts newest first, and keeps at most 20', async () => {
    for (let i = 0; i < 22; i++) await addRecentUrl(`https://example.test/${i}.md`, local);
    await addRecentUrl('https://example.test/5.md', local);
    const recent = await getRecentUrls(local);
    expect(recent).toHaveLength(20);
    expect(recent[0]).toBe('https://example.test/5.md');
    expect(recent.filter((url) => url === 'https://example.test/5.md')).toHaveLength(1);
    expect(recent).not.toContain('https://example.test/0.md');
  });
});
