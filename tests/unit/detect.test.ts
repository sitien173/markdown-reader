import { beforeAll, describe, expect, it, vi } from 'vitest';
let shouldRedirectMarkdown: (contentType: string, pathname: string) => boolean;
beforeAll(async () => {
  vi.stubGlobal('defineContentScript', (config: unknown) => config);
  ({ shouldRedirectMarkdown } = await import('../../src/entrypoints/detect.content'));
});

describe('Markdown navigation detector', () => {
  it('redirects only raw Markdown content on Markdown paths', () => {
    expect(shouldRedirectMarkdown('text/plain', '/readme.md')).toBe(true);
    expect(shouldRedirectMarkdown('text/markdown', '/guide.MARKDOWN')).toBe(true);
    expect(shouldRedirectMarkdown('text/html', '/readme.md')).toBe(false);
    expect(shouldRedirectMarkdown('text/plain', '/readme.md.html')).toBe(false);
    expect(shouldRedirectMarkdown('application/json', '/readme.md')).toBe(false);
  });
});
