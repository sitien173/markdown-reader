// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { buildStandaloneHtml, downloadHtml, printDocument, prepareExportContent, themeExportDiagrams } from '../../src/export/export';
import { EXPORT_CSS, EXPORT_TOKENS } from '../../src/export/export-styles';
import { readFileSync } from 'node:fs';
import type { Appearance } from '../../src/lib/appearance';
import { defaultSettings } from '../../src/lib/settings';

const mermaidMock = vi.hoisted(() => ({ initialize: vi.fn(), render: vi.fn() }));
vi.mock('mermaid', () => ({ default: mermaidMock }));

// Vitest replaces CSS imports with an empty string, so the Markdown rules are read from disk here.
const markdownCss = readFileSync('src/styles/markdown.css', 'utf8');
const globalsCss = readFileSync('src/styles/globals.css', 'utf8');

// Declarations of the first rule whose selector is `:root` inside the given at-rule prelude (or at top level).
function rootTokens(css: string, atRule?: string): Record<string, string> {
  let scope = css;
  if (atRule) {
    const start = css.indexOf(atRule);
    if (start < 0) return {};
    scope = css.slice(start);
  }
  const block = /:root\s*\{([^}]*)\}/.exec(scope)?.[1] ?? '';
  return Object.fromEntries([...block.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => [m[1] ?? '', (m[2] ?? '').trim()]));
}

// Declarations of the `:root[data-theme='<theme>']` rule.
function forcedTokens(css: string, theme: 'light' | 'dark'): Record<string, string> {
  const start = css.search(new RegExp(`:root\\[data-theme=['"]${theme}['"]\\]`));
  if (start < 0) return {};
  const block = /\{([^}]*)\}/.exec(css.slice(start))?.[1] ?? '';
  return Object.fromEntries([...block.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => [m[1] ?? '', (m[2] ?? '').trim()]));
}

describe('export module', () => {
  it('builds standalone HTML with inlined tokens, markdown styles, and KaTeX CSS without scripts or React', () => {
    const content =
      '<h1 id="hello">Hello</h1><p>Test</p><span class="katex">math</span><svg class="mermaid">diagram</svg><pre class="shiki"><code>code</code></pre>';
    const html = buildStandaloneHtml({ title: 'My Doc', contentHtml: content });

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<title>My Doc</title>');
    expect(html).toContain(content);
    expect(html).toContain('<main class="md-content">');
    expect(html).toContain('--foreground');
    expect(html).toContain('KaTeX_Main');
    expect(html).toContain('data:font/woff2;base64,');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('react');
    expect(html).not.toContain('tailwind');
  });

  it('keeps export CSS offline and defines every token the Markdown rules read', () => {
    expect(EXPORT_CSS).not.toMatch(/@import/);
    expect(EXPORT_CSS).not.toMatch(/url\(/);
    // --shiki-* are set inline by Shiki, not by tokens.
    const used = new Set([...markdownCss.matchAll(/var\((--(?!shiki)[\w-]+)/g)].map((m) => m[1]));
    const defined = new Set([...EXPORT_CSS.matchAll(/^\s*(--[\w-]+):/gm)].map((m) => m[1]));
    expect([...used].filter((name) => !defined.has(name))).toEqual([]);
  });

  it('sanitizes export body with HTML and SVG profiles removing vectors and preserving Mermaid, KaTeX, and Shiki', () => {
    const malicious =
      '<script>alert("xss")</script><div onclick="alert(1)">text</div><iframe src="https://evil.test"></iframe><a href="javascript:alert(2)">click</a>';
    const mermaid = '<svg viewBox="0 0 100 100"><path d="M0 0 L10 10"></path><text>flow</text></svg>';
    const katex = '<span class="katex"><span class="katex-html"><span class="mord">x</span></span></span>';
    const shiki =
      '<pre class="shiki" style="background-color:#24292e;color:#e1e4e8"><code><span style="color:#f97583">const</span> x = 1;</code></pre>';
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
    const fakeBlobData =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
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

  it('embeds dark tokens, forces light under print, and overrides Shiki colors by media query', () => {
    expect(EXPORT_CSS).toContain('color-scheme: light dark');
    expect(EXPORT_CSS).toMatch(/@media \(prefers-color-scheme: dark\)/);
    expect(EXPORT_CSS).toMatch(/@media print/);
    expect(markdownCss).toMatch(/@media screen and \(prefers-color-scheme: dark\)[^}]*--shiki-dark/);
    expect(EXPORT_CSS).not.toMatch(/@import|url\(/);
    expect(rootTokens(EXPORT_CSS, '@media (prefers-color-scheme: dark) {')['--background']).not.toBe(
      rootTokens(EXPORT_CSS)['--background'],
    );
  });

  it('keeps export tokens identical to globals.css for light, dark, and print', () => {
    for (const scope of [undefined, '@media (prefers-color-scheme: dark) {', '@media print'] as const) {
      const source = rootTokens(globalsCss, scope);
      const exported = rootTokens(EXPORT_CSS, scope);
      expect(Object.keys(exported).length).toBeGreaterThan(5);
      for (const [name, value] of Object.entries(exported)) expect(source[name], `${scope ?? 'light'} ${name}`).toBe(value);
    }
    expect(rootTokens(globalsCss, '@media print')['--background']).toBe(rootTokens(globalsCss)['--background']);
  });

  it('keeps the forced theme blocks identical to the light and dark tokens in globals.css and export CSS', () => {
    const light = rootTokens(globalsCss);
    const dark = rootTokens(globalsCss, '@media (prefers-color-scheme: dark) {');
    for (const [css, label] of [
      [globalsCss, 'globals.css'],
      [EXPORT_CSS, 'export CSS'],
    ] as const) {
      for (const [theme, expected] of [
        ['light', EXPORT_TOKENS.light],
        ['dark', EXPORT_TOKENS.dark],
      ] as const) {
        const forced = forcedTokens(css, theme);
        expect(Object.keys(forced).length, `${label} ${theme} block`).toBeGreaterThan(5);
        for (const [name, value] of Object.entries(expected)) expect(forced[name], `${label} ${theme} ${name}`).toBe(value);
      }
    }
    for (const [name, value] of Object.entries(EXPORT_TOKENS.light)) expect(light[name]).toBe(value);
    for (const [name, value] of Object.entries(EXPORT_TOKENS.dark)) expect(dark[name]).toBe(value);
    // Forced themes apply on screen only, so print stays light.
    expect(EXPORT_CSS).toMatch(/@media screen \{\s*:root\[data-theme='dark'\]/);
  });

  it('exports each diagram in a light and a dark copy with disjoint SVG ids', async () => {
    mermaidMock.render.mockImplementation(async (id: string) => ({
      svg: `<svg id="${id}"><defs><marker id="${id}_arrow"></marker></defs><title>${mermaidMock.initialize.mock.calls.at(-1)![0].themeVariables.background}</title></svg>`,
    }));
    const html = await themeExportDiagrams(
      '<p>x</p><div data-md-diagram="graph TD; A-->B"><svg id="live"></svg></div><div data-md-diagram="graph TD; C-->D"><svg id="live2"></svg></div>',
    );
    const doc = new DOMParser().parseFromString(html, 'text/html');
    expect(doc.querySelectorAll('.md-diagram--light svg')).toHaveLength(2);
    expect(doc.querySelectorAll('.md-diagram--dark svg')).toHaveLength(2);
    const ids = [...doc.querySelectorAll('[id]')].map((node) => node.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(doc.querySelector('.md-diagram--light title')?.textContent).not.toBe(doc.querySelector('.md-diagram--dark title')?.textContent);
    expect(html).not.toContain('<script');
    expect(html).not.toContain('id="live"');
  });
});

describe('Appearance in the standalone export', () => {
  const appearance = (patch: Partial<Appearance>): Appearance => ({ ...defaultSettings.appearance, ...patch });
  const build = (patch: Partial<Appearance>) => buildStandaloneHtml({ title: 'T', contentHtml: '<p>x</p>', appearance: appearance(patch) });
  const root = (html: string) => /<html[^>]*>/.exec(html)?.[0] ?? '';

  it('carries every Appearance value on the root and keeps the defaults when none is passed', () => {
    const html = build({
      theme: 'dark',
      codeThemeLight: 'dark',
      codeThemeDark: 'light',
      textSize: 6,
      font: 'serif',
      wrapCode: true,
      wideTables: true,
      centered: false,
      zen: true,
      customMaxWidth: true,
      maxWidthPx: 1400,
    });
    const tag = root(html);
    for (const part of [
      'data-theme="dark"',
      'data-code-light="dark"',
      'data-code-dark="light"',
      'data-zen="true"',
      '--md-scale:1.25',
      '--md-max-width:1400px',
    ]) {
      expect(tag).toContain(part);
    }
    expect(tag).toContain('--md-font:ui-serif');
    expect(tag).toMatch(/class="md-wrap-code md-wide-tables"/);

    const plain = root(buildStandaloneHtml({ title: 'T', contentHtml: '<p>x</p>' }));
    expect(plain).not.toContain('data-theme');
    expect(plain).toContain('class="md-centered"');
    expect(plain).toContain('data-zen="false"');
    expect(plain).not.toContain('--md-font');
    expect(plain).not.toContain('--md-max-width');
  });

  it('copies enabled custom CSS after the export styles, and drops it when off, empty, or rejected', () => {
    const css = '.md-content h1 { color: red; }';
    const html = build({ customCssEnabled: true, customCss: css });
    expect(html).toContain(css);
    expect(html.indexOf(css)).toBeGreaterThan(html.indexOf('</style>'));
    expect(build({ customCssEnabled: false, customCss: css })).not.toContain(css);
    expect(build({ customCssEnabled: true, customCss: '  ' })).not.toContain('id="custom-css"');
    const rejected = 'p { background: url(https://example.test/x.png); }';
    expect(build({ customCssEnabled: true, customCss: rejected })).not.toContain('example.test');
  });

  it('cannot be closed early by custom CSS text', () => {
    const html = build({ customCssEnabled: true, customCss: '/* </style><script>alert(1)</script> */ p { color: red; }' });
    expect(html).not.toContain('<script>');
    expect(html.match(/<\/style>/g)).toHaveLength(2);
  });

  it('keeps the export tokens, and print light, when the theme is forced dark', () => {
    expect(EXPORT_CSS).toMatch(/@media print\s*\{\s*:root\s*\{\s*color-scheme: light;/);
  });
});
