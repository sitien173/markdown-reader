import { beforeAll, describe, expect, it, vi } from 'vitest';
let shouldRedirectMarkdown: (
  contentType: string,
  pathname: string,
  flags?: { enabled: boolean; renderTxt: boolean; renderJson?: boolean },
) => boolean;
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
  it('redirects .json and .jsonc only when Enable and Preview .json are on', () => {
    const on = { enabled: true, renderTxt: false, renderJson: true };
    expect(shouldRedirectMarkdown('application/json', '/a.json', on)).toBe(true);
    expect(shouldRedirectMarkdown('application/json', '/A.JSONC', on)).toBe(true);
    expect(shouldRedirectMarkdown('application/json', '/a.json', { ...on, renderJson: false })).toBe(false);
    expect(shouldRedirectMarkdown('application/json', '/a.json', { ...on, enabled: false })).toBe(false);
    expect(shouldRedirectMarkdown('application/json', '/a.json', { enabled: true, renderTxt: true })).toBe(false);
    expect(shouldRedirectMarkdown('application/json', '/a.json')).toBe(false);
  });
  it('accepts each JSON content type and rejects text/html', () => {
    const on = { enabled: true, renderTxt: false, renderJson: true };
    for (const type of ['application/json', 'text/json', 'text/plain', '', 'application/ld+json', 'application/vnd.api+json']) {
      expect(shouldRedirectMarkdown(type, '/a.json', on)).toBe(true);
    }
    expect(shouldRedirectMarkdown('text/html', '/a.json', on)).toBe(false);
    expect(shouldRedirectMarkdown('application/json', '/a.json.html', on)).toBe(false);
    expect(shouldRedirectMarkdown('application/json', '/a', on)).toBe(false);
  });
  it('keeps Markdown and .txt results unchanged when Preview .json is on', () => {
    const on = { enabled: true, renderTxt: true, renderJson: true };
    expect(shouldRedirectMarkdown('text/plain', '/readme.md', on)).toBe(true);
    expect(shouldRedirectMarkdown('application/json', '/readme.md', on)).toBe(false);
    expect(shouldRedirectMarkdown('text/plain', '/notes.txt', on)).toBe(true);
    expect(shouldRedirectMarkdown('application/json', '/notes.txt', on)).toBe(false);
  });
});
