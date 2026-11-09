import { beforeAll, describe, expect, it, vi } from 'vitest';
let shouldRedirectMarkdown: (contentType: string, pathname: string, flags?: { enabled: boolean; renderTxt: boolean }) => boolean;
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

  it('does not redirect when Enable is off', () => {
    const flags = { enabled: false, renderTxt: true };
    expect(shouldRedirectMarkdown('text/plain', '/readme.md', flags)).toBe(false);
    expect(shouldRedirectMarkdown('text/markdown', '/guide.markdown', flags)).toBe(false);
    expect(shouldRedirectMarkdown('text/plain', '/notes.txt', flags)).toBe(false);
  });
  it('redirects .txt only for text/plain and only when Render .txt is on', () => {
    expect(shouldRedirectMarkdown('text/plain', '/notes.txt', { enabled: true, renderTxt: false })).toBe(false);
    expect(shouldRedirectMarkdown('text/plain', '/notes.txt')).toBe(false);
    expect(shouldRedirectMarkdown('text/plain', '/NOTES.TXT', { enabled: true, renderTxt: true })).toBe(true);
    expect(shouldRedirectMarkdown('text/markdown', '/notes.txt', { enabled: true, renderTxt: true })).toBe(false);
    expect(shouldRedirectMarkdown('text/html', '/notes.txt', { enabled: true, renderTxt: true })).toBe(false);
  });
  it('does not redirect a text/plain response for a non-.txt path', () => {
    expect(shouldRedirectMarkdown('text/plain', '/notes', { enabled: true, renderTxt: true })).toBe(false);
    expect(shouldRedirectMarkdown('text/plain', '/notes.txt.html', { enabled: true, renderTxt: true })).toBe(false);
  });
});
