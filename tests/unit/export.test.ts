// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { buildStandaloneHtml, downloadHtml, printDocument, prepareExportContent } from '../../src/export/export';

describe('export module', () => {
  it('builds standalone HTML with inlined tokens, markdown styles, and KaTeX CSS without scripts or React', () => {
    const content = '<h1 id="hello">Hello</h1><p>Test</p><span class="katex">math</span><svg class="mermaid">diagram</svg><pre class="shiki"><code>code</code></pre>';
    const html = buildStandaloneHtml({ title: 'My Doc', contentHtml: content });

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<title>My Doc</title>');
    expect(html).toContain(content);
    expect(html).toContain('.tds-custom-markdown');
    expect(html).toContain('--surface-neutral-01');
    expect(html).toContain('KaTeX_Main');
    expect(html).toContain('data:font/woff2;base64,');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('react');
    expect(html).not.toContain('tailwind');
  });

  it('sanitizes export body with HTML and SVG profiles removing vectors and preserving Mermaid, KaTeX, and Shiki', () => {
    const malicious = '<script>alert("xss")</script><div onclick="alert(1)">text</div><iframe src="https://evil.test"></iframe><a href="javascript:alert(2)">click</a>';
    const mermaid = '<svg viewBox="0 0 100 100"><path d="M0 0 L10 10"></path><text>flow</text></svg>';
    const katex = '<span class="katex"><span class="katex-html"><span class="mord">x</span></span></span>';
    const shiki = '<pre class="shiki" style="background-color:#24292e;color:#e1e4e8"><code><span style="color:#f97583">const</span> x = 1;</code></pre>';
    const body = `${malicious}\n${mermaid}\n${katex}\n${shiki}`;

    const html = buildStandaloneHtml({ title: 'Sanitized Export', contentHtml: body });

    expect(html).not.toContain('<script');
    expect(html).not.toContain('onclick');
    expect(html).not.toContain('<iframe');
    expect(html).not.toContain('javascript:');
    expect(html).toContain('<svg viewBox="0 0 100 100"');
    expect(html).toContain('<path d="M0 0 L10 10"');
    expect(html).toContain('class="katex"');
    expect(html).toContain('class="shiki"');
    expect(html).toContain('style="color:#f97583"');
  });

  it('replaces remote images with links and inlines blob images as data URLs', async () => {
    const fakeBlobData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const fakeBlobUrl = 'blob:test-image-blob';

    // Mock fetch for blob url
    const origFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url === fakeBlobUrl) {
        return {
          blob: async () => new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' }),
        } as unknown as Response;
      }
      return origFetch(url);
    });

    try {
      const input = [
        '<p><img src="https://example.com/cat.jpg" alt="A cute cat"></p>',
        '<p><img src="http://example.com/dog.png" alt=""></p>',
        '<p><img src="https://example.com/fish.png"></p>',
        `<p><img src="${fakeBlobUrl}" alt="Local photo"></p>`,
      ].join('\n');

      const processed = await prepareExportContent(input);

      expect(processed).toContain('<a href="https://example.com/cat.jpg">A cute cat</a>');
      expect(processed).toContain('<a href="http://example.com/dog.png">http://example.com/dog.png</a>');
      expect(processed).toContain('<a href="https://example.com/fish.png">https://example.com/fish.png</a>');
      expect(processed).not.toContain('<img src="https://example.com');
      expect(processed).not.toContain('<img src="http://example.com');
      expect(processed).not.toContain(fakeBlobUrl);
      expect(processed).toContain('data:image/');
      expect(processed).toContain('alt="Local photo"');
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it('triggers download with blob url and cleanup', () => {
    vi.useFakeTimers();
    try {
      const createObjectURL = vi.fn().mockReturnValue('blob:test-url');
      const revokeObjectURL = vi.fn();
      globalThis.URL.createObjectURL = createObjectURL;
      globalThis.URL.revokeObjectURL = revokeObjectURL;

      const clickSpy = vi.fn();
      const createElementOrig = document.createElement.bind(document);
      vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
        const el = createElementOrig(tagName);
        if (tagName === 'a') {
          el.click = clickSpy;
        }
        return el;
      });

      downloadHtml('Sample Title', '<p>Sample</p>');
      expect(createObjectURL).toHaveBeenCalled();
      expect(clickSpy).toHaveBeenCalled();
      expect(revokeObjectURL).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1000);
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:test-url');
    } finally {
      vi.useRealTimers();
    }
  });

  it('inlines blob images during downloadHtml', async () => {
    const fakeBlobUrl = 'blob:test-image-download';
    const origFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url === fakeBlobUrl) {
        return {
          blob: async () => new Blob([new Uint8Array([10, 20])], { type: 'image/png' }),
        } as unknown as Response;
      }
      return origFetch(url);
    });

    let downloadedBlob: Blob | null = null;
    const origCreateObjectURL = globalThis.URL.createObjectURL;
    globalThis.URL.createObjectURL = vi.fn().mockImplementation((blob: Blob) => {
      downloadedBlob = blob;
      return 'blob:mock-download';
    });

    try {
      await downloadHtml('Blob Doc', `<p><img src="${fakeBlobUrl}" alt="Local"></p>`);
      expect(globalThis.URL.createObjectURL).toHaveBeenCalled();
      expect(downloadedBlob).not.toBeNull();
      const downloadedHtml = await downloadedBlob!.text();
      expect(downloadedHtml).toContain('data:image/');
      expect(downloadedHtml).not.toContain(fakeBlobUrl);
      expect(downloadedHtml).not.toContain('blob:');
    } finally {
      globalThis.fetch = origFetch;
      globalThis.URL.createObjectURL = origCreateObjectURL;
    }
  });

  it('replaces image with alt text when blob inlining fails', async () => {
    const brokenBlobUrl = 'blob:broken-image-blob';
    const origFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    try {
      const input = `<p><img src="${brokenBlobUrl}" alt="A failed diagram"></p><p><img src="${brokenBlobUrl}" alt=""></p>`;
      const processed = await prepareExportContent(input);
      expect(processed).not.toContain(brokenBlobUrl);
      expect(processed).not.toContain('<img');
      expect(processed).toContain('A failed diagram');
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it('removes remote URL vectors: srcset, sizes, picture source, poster, background, svg remote links, and style url()', async () => {
    const input = [
      '<picture><source srcset="https://remote.test/pic.avif" sizes="100vw"><img src="https://remote.test/pic.jpg" srcset="https://remote.test/pic.jpg 1x, https://remote.test/pic-2x.jpg 2x" sizes="50vw" alt="Pic"></picture>',
      '<video poster="https://remote.test/poster.jpg" src="local.mp4"></video>',
      '<table background="https://remote.test/bg.png"><tr><td background="https://remote.test/td.png">cell</td></tr></table>',
      '<svg><image href="https://remote.test/svg-img.png" xlink:href="https://remote.test/svg-img.png" /><use href="https://remote.test/icons.svg#icon" xlink:href="https://remote.test/icons.svg#icon" /><use href="#local-icon" /></svg>',
      '<div style="background-image: url(\'https://remote.test/style-bg.png\'); color: red;">styled</div>',
    ].join('\n');

    const processed = await prepareExportContent(input);

    expect(processed).not.toContain('srcset');
    expect(processed).not.toContain('sizes');
    expect(processed).not.toContain('<source');
    expect(processed).not.toContain('poster=');
    expect(processed).not.toContain('https://remote.test/poster.jpg');
    expect(processed).not.toContain('background=');
    expect(processed).not.toContain('https://remote.test/bg.png');
    expect(processed).not.toContain('https://remote.test/svg-img.png');
    expect(processed).not.toContain('https://remote.test/icons.svg');
    expect(processed).toContain('href="#local-icon"');
    expect(processed).not.toContain('url(');
    expect(processed).not.toContain('https://remote.test/style-bg.png');
    expect(processed).toContain('color: red');

    const standalone = buildStandaloneHtml({ title: 'Vectors', contentHtml: processed });
    expect(standalone).not.toContain('srcset');
    expect(standalone).not.toContain('poster=');
    expect(standalone).not.toContain('background=');
    expect(standalone).not.toContain('poster.jpg');
    expect(standalone).not.toContain('bg.png');
    expect(standalone).not.toContain('svg-img.png');
    expect(standalone).not.toContain('icons.svg');
    expect(standalone).not.toContain('style-bg.png');
    expect(standalone).toContain('<a href="https://remote.test/pic.jpg">Pic</a>');
  });

  it('invokes window.print on printDocument', () => {
    const printSpy = vi.fn();
    window.print = printSpy;
    printDocument();
    expect(printSpy).toHaveBeenCalled();
  });
});
