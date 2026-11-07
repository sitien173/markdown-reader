import { beforeAll, describe, expect, it, vi } from 'vitest';
let isMarkdownLink: (url: string) => boolean;
let isAllowedUrl: (url: string) => boolean;
let isValidCapture: (message: { text?: unknown }, sender: { id?: string; tab?: { url?: string } }, runtimeId: string) => boolean;
beforeAll(async () => {
  vi.stubGlobal('defineBackground', (callback: () => unknown) => callback);
  ({ isMarkdownLink, isValidCapture } = await import('../../src/entrypoints/background'));
  ({ isAllowedUrl } = await import('../../src/source/url'));
});

describe('context menu link filter', () => {
  it('accepts .md and .markdown URLs regardless of query and case', () => {
    expect(isMarkdownLink('https://example.test/a.md?raw=1')).toBe(true);
    expect(isMarkdownLink('https://example.test/a.MARKDOWN#top')).toBe(true);
  });
  it('rejects other paths and invalid URLs', () => {
    expect(isMarkdownLink('https://example.test/a.md.html')).toBe(false);
    expect(isMarkdownLink('not a URL')).toBe(false);
  });
  it('allows only http, https, and file URLs', () => {
    expect(isAllowedUrl('https://example.test/a')).toBe(true);
    expect(isAllowedUrl('file:///tmp/a.md')).toBe(true);
    for (const url of ['ftp://example.test/a.md', 'javascript:alert(1)', 'chrome://settings']) expect(isAllowedUrl(url)).toBe(false);
  });
  it('validates capture sender identity and tab URL and Markdown path', () => {
    const sender = { id: 'extension-id', tab: { url: 'https://example.test/doc.md' } };
    expect(isValidCapture({ text: 'body' }, sender, 'extension-id')).toBe(true);
    expect(isValidCapture({ text: 'body' }, { ...sender, id: 'other' }, 'extension-id')).toBe(false);
    expect(isValidCapture({ text: 'body' }, { id: 'extension-id', tab: {} }, 'extension-id')).toBe(false);
    expect(isValidCapture({ text: 'body' }, { id: 'extension-id', tab: { url: 'https://example.test/page.html' } }, 'extension-id')).toBe(
      false,
    );
    expect(isValidCapture({ text: 'body' }, { id: 'extension-id', tab: { url: 'ftp://example.test/doc.md' } }, 'extension-id')).toBe(false);
  });
});
