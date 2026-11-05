// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render } from '../../src/render/pipeline';
import { sanitize } from '../../src/render/sanitize';

const vectors = readFileSync(resolve('tests/fixtures/markdown/xss.md'), 'utf8').split('\n---VECTOR---\n').filter(Boolean);
describe('sanitize', () => {
  it('uses DOMPurify to walk descendants and remove unknown and forbidden elements', async () => {
    const { default: createDOMPurify } = await import('dompurify');
    const observed: string[] = [];
    const purify = createDOMPurify(window);
    purify.addHook('uponSanitizeElement', (node) => observed.push(node.nodeName.toLowerCase()));
    const clean = purify.sanitize('<div><p>text<custom-x>unknown</custom-x><style>body{color:red}</style></p></div>', { ALLOWED_TAGS: ['div', 'p'] });
    expect(clean).toBe('<div><p>textunknown</p></div>');
    expect(observed).toContain('custom-x');
    expect(observed).toContain('style');
    expect(observed.length).toBeGreaterThan(3);
  });

  it('preserves supported semantic and KaTeX markup', () => {
    const html = sanitize('<details><summary>More</summary><kbd>Esc</kbd></details><span class="katex-html" style="color:red" aria-hidden="true"><math><semantics><mrow><mi>x</mi><mo>=</mo><mn>1</mn><annotation encoding="application/x-tex">x=1</annotation></semantics></math></span><input type="checkbox" disabled checked><a id="fn1" href="#fnref1" data-md-link="">note</a>');
    expect(html).toContain('<details>'); expect(html).toContain('<summary>'); expect(html).toContain('<kbd>');
    expect(html).toContain('<math>'); expect(html).toContain('<annotation encoding="application/x-tex">');
    expect(html).toContain('class="katex-html"'); expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('type="checkbox"'); expect(html).toContain('disabled=""'); expect(html).toContain('checked=""');
    expect(html).toContain('data-md-link=""'); expect(html).toContain('id="user-content-fn1"');
    expect(html).toContain('href="#user-content-fnref1"');
  });

  it('prefixes named properties and keeps local fragment references aligned', () => {
    const html = sanitize('<h1 id="mermaid">Diagram</h1><a name="mermaid">name</a><a href="#mermaid">jump</a>');
    document.body.innerHTML = html;
    expect(html).toContain('id="user-content-mermaid"');
    expect(html).toContain('name="user-content-mermaid"');
    expect(html).toContain('href="#user-content-mermaid"');
    expect((window as Window & { mermaid?: unknown }).mermaid).toBeUndefined();
  });

  it('removes javascript Markdown links from navigation', () => {
    const html = render('[x](javascript:a.md)', '').html;
    const link = new DOMParser().parseFromString(html, 'text/html').querySelector('a');
    expect(link === null || !link.hasAttribute('href')).toBe(true);
  });

  it('drops extreme positioned offsets while retaining KaTeX offsets', () => {
    const html = sanitize('<div style="position:relative;top:-5000px;left:99999px">hostile</div>');
    expect(html).not.toMatch(/top\s*:/i);
    expect(html).not.toMatch(/left\s*:/i);
    const katex = render('$\\rule{1em}{2pt}$ $\\hat{a}$ $\\sum_{i}^n$ $\\colorbox{red}{x}$', '').html;
    expect(katex).toMatch(/bottom: -?[\d.]+em/);
    expect(katex).toMatch(/left: -?[\d.]+em/);
    expect(katex).toContain('position: relative');
  });

  it('keeps KaTeX positioning, color, and border styles', () => {
    const html = render('$\\rule{1em}{2pt}$ $\\hat{a}$ $\\sum_{i}^n$ $\\colorbox{red}{x}$ $\\fcolorbox{blue}{red}{y}$', '').html;
    expect(html).toMatch(/bottom: -?[\d.]+em/);
    expect(html).toMatch(/left: -?[\d.]+em/);
    expect(html).toContain('position: relative');
    expect(html).toMatch(/background-color: (red|rgb\(255, 0, 0\))/);
    expect(html).toMatch(/border-(top-)?color: (blue|rgb\(0, 0, 255\))/);
    expect(html).toMatch(/border-(top-)?style: solid/);
  });

  it('rejects CSS comment, escape, and entity bypasses', () => {
    for (const style of ['back/**/ground:u\\rl(https://evil.test/a)', 'background:u\\72l(https://evil.test/a)', 'width:expr/**/ession(alert(1))', 'background:&#x75;rl(https://evil.test/a)', 'position:absolute;bottom:0', 'background-color:var(--x)']) {
      const html = sanitize(`<span style="${style}">x</span>`);
      expect(html).not.toMatch(/url\(|expression|position|var\(/i);
    }
  });

  it('filters style declarations and removes non-checkbox inputs', () => {
    const html = sanitize('<div style="background:url(https://evil.test/p.gif)">urlcase</div><div style="position:fixed;top:0;left:0;width:100vw;height:100vh">positioncase</div><input type="image" src="https://evil.test/a.png">');
    expect(html).not.toMatch(/url\(/i);
    expect(html).not.toMatch(/position\s*:/i);
    expect(html).not.toContain('<input');
  });

  it('keeps raster data images but rejects data documents and SVG images', () => {
    const html = sanitize('<img src="data:image/png;base64,iVBORw0KGgo="><a href="data:text/html,hello">html</a><img src="data:image/svg+xml,%3Csvg%3E">');
    const doc = new DOMParser().parseFromString(html, 'text/html');
    expect(doc.querySelector('img')?.getAttribute('src')).toBe('data:image/png;base64,iVBORw0KGgo=');
    expect(doc.querySelector('a')?.hasAttribute('href')).toBe(false);
    expect(doc.querySelectorAll('img')[1]?.hasAttribute('src')).toBe(false);
  });

  it.each(vectors.map((value, i) => [i + 1, value] as const))('neutralizes XSS vector %i', (_i, markdown) => {
    const html = render(markdown, 'https://reader.example/').html;
    const document = new DOMParser().parseFromString(html, 'text/html');
    for (const tag of ['script', 'iframe', 'object', 'embed', 'form', 'style']) expect(document.querySelector(tag)).toBeNull();
    expect(document.documentElement.outerHTML).not.toMatch(/expression\s*\(/i);
    expect(document.documentElement.outerHTML).not.toMatch(/url\s*\(/i);
    for (const element of document.querySelectorAll('*')) {
      for (const attribute of element.attributes) {
        expect(attribute.name.toLowerCase()).not.toMatch(/^on[a-z]+$/);
        expect(attribute.name.toLowerCase()).not.toBe('srcdoc');
      }
      for (const name of ['href', 'src', 'action', 'xlink:href', 'formaction']) {
        const value = element.getAttribute(name);
        if (!value) continue;
        const normalized = value.trim().toLowerCase();
        if (/^(?:javascript|vbscript|data):/.test(normalized)) {
          expect(normalized).toMatch(/^data:image\/(?:png|jpeg|gif|webp|bmp|avif)(?:;|,)/);
          expect(element.localName).toBe('img');
          expect(name).toBe('src');
        }
      }
    }
  });

  it('removes authored blob: URLs from href and src', () => {
    const html = sanitize('<a href="blob:https://example.com/uuid">link</a><img src="blob:https://example.com/uuid" alt="photo">');
    expect(html).not.toContain('blob:');
    const doc = new DOMParser().parseFromString(html, 'text/html');
    expect(doc.querySelector('a')?.hasAttribute('href')).toBe(false);
    expect(doc.querySelector('img')?.hasAttribute('src')).toBe(false);
  });

  it('scheme matrix follows DOMPurify default', () => {
    const allowed = [
      'https://example.com/page',
      'http://example.com/page',
      'mailto:user@example.com',
      'tel:+1234567890',
    ];
    for (const url of allowed) {
      const html = sanitize(`<a href="${url}">link</a>`);
      const doc = new DOMParser().parseFromString(html, 'text/html');
      expect(doc.querySelector('a')?.getAttribute('href')).toBe(url);
    }

    const disallowed = [
      'blob:https://example.com/uuid',
      'javascript:alert(1)',
      'vbscript:alert(1)',
    ];
    for (const url of disallowed) {
      const html = sanitize(`<a href="${url}">link</a><img src="${url}">`);
      expect(html).not.toContain(url);
      const doc = new DOMParser().parseFromString(html, 'text/html');
      expect(doc.querySelector('a')?.hasAttribute('href')).toBe(false);
      expect(doc.querySelector('img')?.hasAttribute('src')).toBe(false);
    }
  });
});
