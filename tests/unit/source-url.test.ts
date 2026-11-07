// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UrlSource } from '../../src/source/url';

afterEach(() => vi.unstubAllGlobals());
describe('UrlSource', () => {
  it('returns successful response text', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('# hello')));
    await expect(new UrlSource('https://example.test/a.md').read()).resolves.toBe('# hello');
  });
  it('reports non-success status and network errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 404 })));
    await expect(new UrlSource('https://example.test/a.md').read()).rejects.toThrow('HTTP 404');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    await expect(new UrlSource('https://example.test/a.md').read()).rejects.toThrow('Unable to fetch');
  });
});
