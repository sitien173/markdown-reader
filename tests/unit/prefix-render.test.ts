// @vitest-environment jsdom
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { findSafeBoundary, planPrefix, render } from '../../src/render/pipeline';
import { sanitize } from '../../src/render/sanitize';

const BASE = 'https://example.com/docs/readme.md';

describe('findSafeBoundary', () => {
  it('returns a boundary for a document with a safe blank line past minChars', () => {
    const text = 'First paragraph.\n\nSecond paragraph.\n\nThird paragraph.\n';
    expect(findSafeBoundary(text, 10)).toBe(text.indexOf('\n\nSecond') + 1);
  });

  it('returns -1 when no blank line past minChars is outside a block', () => {
    expect(findSafeBoundary('short', 1000)).toBe(-1);
  });

  it('never cuts inside a fenced code block', () => {
    const text = 'Intro.\n\n```js\nline one\n\nline two\n```\n\nTail.\n';
    expect(findSafeBoundary(text, 10)).toBe(text.indexOf('Tail') - 1);
  });

  it('never cuts inside a tilde fence', () => {
    const text = 'Intro.\n\n~~~\nline one\n\nline two\n~~~\n\nTail.\n';
    expect(findSafeBoundary(text, 10)).toBe(text.indexOf('Tail') - 1);
  });

  it('never cuts inside a math block', () => {
    const text = 'Intro.\n\n$$\na\n\nb\n$$\n\nAfter.\n';
    expect(findSafeBoundary(text, 10)).toBe(text.indexOf('After') - 1);
  });

  it('never cuts inside a raw-text HTML block that spans blank lines', () => {
    const text = 'Intro.\n\n<pre>\nline\n\nmid\n</pre>\n\nOut.\n';
    expect(findSafeBoundary(text, 10)).toBe(text.indexOf('Out') - 1);
  });

  it('ends a plain HTML block at its blank line, as CommonMark does', () => {
    const text = 'Intro.\n\n<div>\n\nInside\n</div>\n\nOut.\n';
    expect(findSafeBoundary(text, 10)).toBe(text.indexOf('<div>') + '<div>\n'.length);
  });

  it('never cuts inside an HTML comment that spans blank lines', () => {
    const text = 'Intro.\n\n<!--\n\nnote\n-->\n\nNext.\n';
    expect(findSafeBoundary(text, 10)).toBe(text.indexOf('Next') - 1);
  });
});

describe('planPrefix', () => {
  it('returns null for documents at or below the limit', () => {
    expect(planPrefix('# Small\n\nText.\n', BASE, 1024)).toBeNull();
  });

  it('renders a sanitized prefix that ends at a safe boundary', () => {
    const text = `Intro <script>alert(1)</script>\n\n${'Paragraph with **bold** text.\n\n'.repeat(200)}`;
    const prefix = planPrefix(text, BASE, 1024);
    expect(prefix).not.toBeNull();
    expect(prefix!.end).toBeGreaterThanOrEqual(1024);
    expect(text.slice(prefix!.end).startsWith('\n')).toBe(true);
    expect(prefix!.html).toBe(sanitize(prefix!.html, BASE));
    expect(prefix!.html).not.toContain('<script');
  });
});

describe('prefix boundary on real documents', () => {
  const markdownDir = resolve('tests/fixtures/markdown');
  const documents = readdirSync(markdownDir).filter((name) => name.endsWith('.md')).sort().map((name) => readFileSync(resolve(markdownDir, name), 'utf8'));
  const benchmark = `# Benchmark document\n\n${'A realistic paragraph with **bold text**, a [link](https://example.test), and ordinary prose for a reader.\n\n'.repeat(Math.ceil(1024 * 1024 / 120))}`;

  it.each([...documents, benchmark].map((text, index) => [index, text] as const))('document %i: prefix ends at a block boundary and its fragment is sanitized', (_index, text) => {
    const prefix = planPrefix(text, BASE, 16 * 1024);
    if (prefix === null) return;
    expect(prefix.html).toBe(sanitize(prefix.html, BASE));
    expect(prefix.html).toBe(render(text.slice(0, prefix.end), BASE).html);
  });
});
