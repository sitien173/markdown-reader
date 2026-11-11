import { beforeAll, describe, expect, it, vi } from 'vitest';
let isMarkdownLink: (url: string, renderTxt?: boolean, renderJson?: boolean) => boolean;
let isAllowedUrl: (url: string) => boolean;
let isValidCapture: (
  message: { text?: unknown },
  sender: { id?: string; tab?: { url?: string } },
  runtimeId: string,
  renderTxt?: boolean,
  renderJson?: boolean,
) => boolean;
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
  it('accepts .txt links only when Render .txt is on', () => {
    expect(isMarkdownLink('https://example.test/a.txt')).toBe(false);
    expect(isMarkdownLink('https://example.test/a.txt', false)).toBe(false);
    expect(isMarkdownLink('https://example.test/a.txt?x=1', true)).toBe(true);
    expect(isMarkdownLink('file:///tmp/a.TXT', true)).toBe(true);
    expect(isMarkdownLink('https://example.test/a.txt.html', true)).toBe(false);
  });
  it('accepts a .txt capture only when Render .txt is on', () => {
    const sender = { id: 'extension-id', tab: { url: 'https://example.test/a.txt' } };
    expect(isValidCapture({ text: 'body' }, sender, 'extension-id')).toBe(false);
    expect(isValidCapture({ text: 'body' }, sender, 'extension-id', true)).toBe(true);
  });
  it('accepts .json and .jsonc links only when Preview .json is on', () => {
    expect(isMarkdownLink('https://example.test/a.json')).toBe(false);
    expect(isMarkdownLink('https://example.test/a.json', true, false)).toBe(false);
    expect(isMarkdownLink('https://example.test/a.json?x=1', false, true)).toBe(true);
    expect(isMarkdownLink('file:///tmp/a.JSONC', false, true)).toBe(true);
    expect(isMarkdownLink('https://example.test/a.json.html', false, true)).toBe(false);
    expect(isMarkdownLink('https://example.test/a.md', false, true)).toBe(true);
    expect(isMarkdownLink('https://example.test/a.txt', false, true)).toBe(false);
  });
  it('accepts a .json capture only when Preview .json is on', () => {
    const sender = { id: 'extension-id', tab: { url: 'https://example.test/a.json' } };
    expect(isValidCapture({ text: '{}' }, sender, 'extension-id')).toBe(false);
    expect(isValidCapture({ text: '{}' }, sender, 'extension-id', true, false)).toBe(false);
    expect(isValidCapture({ text: '{}' }, sender, 'extension-id', false, true)).toBe(true);
  });
  it('lets the context menu open .json links regardless of the flag', async () => {
    let clicked: ((info: { menuItemId: string; linkUrl?: string }) => Promise<void>) | undefined;
    const create = vi.fn().mockResolvedValue(undefined);
    const setBadgeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('browser', {
      runtime: {
        id: 'extension-id',
        onInstalled: { addListener: vi.fn() },
        onMessage: { addListener: vi.fn() },
        getURL: (p: string) => `chrome-extension://x${p}`,
      },
      contextMenus: { removeAll: vi.fn(), create: vi.fn(), onClicked: { addListener: vi.fn((cb) => (clicked = cb)) } },
      storage: { local: { get: vi.fn().mockResolvedValue({}) } },
      action: { setBadgeText, setTitle: vi.fn() },
      tabs: { create },
    });
    const bg = (await import('../../src/entrypoints/background')) as unknown as { default?: () => void };
    bg.default?.();
    await clicked?.({ menuItemId: 'open-markdown-reader', linkUrl: 'https://example.test/a.jsonc' });
    expect(create).toHaveBeenCalledWith({ url: 'chrome-extension://x/reader.html?src=https%3A%2F%2Fexample.test%2Fa.jsonc' });
    await clicked?.({ menuItemId: 'open-markdown-reader', linkUrl: 'https://example.test/a.html' });
    expect(create).toHaveBeenCalledTimes(1);
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
  it('registers context menu with title Open in Markdown Reader', async () => {
    let installedCallback: (() => Promise<void>) | undefined;
    const createMock = vi.fn();
    vi.stubGlobal('browser', {
      runtime: {
        id: 'extension-id',
        onInstalled: {
          addListener: vi.fn((cb) => {
            installedCallback = cb;
          }),
        },
        onMessage: { addListener: vi.fn() },
      },
      contextMenus: {
        removeAll: vi.fn().mockResolvedValue(undefined),
        create: createMock,
        onClicked: { addListener: vi.fn() },
      },
    });

    const bg = (await import('../../src/entrypoints/background')) as unknown as { default?: () => void };
    if (typeof bg.default === 'function') {
      bg.default();
    }
    expect(installedCallback).toBeDefined();
    await installedCallback?.();
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'open-markdown-reader',
        title: 'Open in Markdown Reader',
      }),
    );
  });
});
