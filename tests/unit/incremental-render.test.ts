// @vitest-environment jsdom
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createParseState, render, renderBlocks, type ParseState } from '../../src/render/pipeline';

const BASE = 'https://example.com/docs/readme.md';
const markdownDir = resolve('tests/fixtures/markdown');
const documents = readdirSync(markdownDir)
  .filter((name) => name.endsWith('.md'))
  .sort()
  .map((name) => readFileSync(resolve(markdownDir, name), 'utf8'));
const large = readFileSync(resolve('tests/fixtures/large-100kb.md'), 'utf8');

// Deterministic edit steps, applied cumulatively so the block cache is reused across steps.
const steps: Array<(text: string) => string> = [
  (text) => `${text}\n\nAppended paragraph with **bold** and a [link](other.md).\n`,
  (text) => {
    const lines = text.split('\n');
    const mid = Math.floor(lines.length / 2);
    return [...lines.slice(0, mid), '## Inserted heading', '', ...lines.slice(mid)].join('\n');
  },
  (text) => `${text}\n## Inserted heading\n`,
  (text) => {
    const lines = text.split('\n');
    return lines.filter((_, index) => index !== Math.floor(lines.length / 3)).join('\n');
  },
  (text) => text.replace('\n', '\n\n```js\nconst value = 1;\n```\n\n'),
];

function expectIncrementalMatchesFull(source: string, cache: Map<string, string>) {
  const incremental = renderBlocks(source, BASE, cache);
  const full = render(source, BASE);
  expect(incremental.blocks.map((block) => block.html).join('')).toBe(full.html);
  expect(incremental.headings).toEqual(full.headings);
}

describe('incremental block rendering', () => {
  it.each(documents.map((text, index) => [index, text] as const))('fixture %i matches full render across edits', (_index, text) => {
    const cache = new Map<string, string>();
    let current = text;
    expectIncrementalMatchesFull(current, cache);
    for (const step of steps) {
      current = step(current);
      expectIncrementalMatchesFull(current, cache);
    }
  });

  it('matches full render for the 100 KB fixture after a series of edits', () => {
    const cache = new Map<string, string>();
    let current = large;
    expectIncrementalMatchesFull(current, cache);
    for (const step of steps) {
      current = step(current);
      expectIncrementalMatchesFull(current, cache);
    }
    expect(renderBlocks(current, BASE, cache).blocks.length).toBeGreaterThan(100);
  }, 120000);

  it('keeps heading ids unique when a duplicate heading is added', () => {
    const cache = new Map<string, string>();
    const source = '# Title\n\nText\n\n# Title\n\nMore\n';
    expectIncrementalMatchesFull(source, cache);
    expectIncrementalMatchesFull(`${source}\n# Title\n`, cache);
    const ids = renderBlocks(`${source}\n# Title\n`, BASE, cache).headings.map((heading) => heading.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('detects reference definitions nested in blockquotes across edits', () => {
    const cache = new Map<string, string>();
    renderBlocks('[x]\n\n> [x]: /first', BASE, cache);
    const updated = renderBlocks('[x]\n\n> [x]: /second', BASE, cache);
    expect(updated.blocks.map((block) => block.html).join('')).toContain('https://example.com/second');
    expect(updated.blocks.map((block) => block.html).join('')).not.toContain('https://example.com/first');
    expectIncrementalMatchesFull('[x]\n\n> [x]: /second', cache);
  });

  it.each(['<div/>', '<div\n\nhello', '<div data-url=/foo>\n\nhello', '<div class=a/b>\n\nhello', '<div>ok</div>'])(
    'falls back to full render for any HTML block %s',
    (source) => {
      const cache = new Map<string, string>();
      const incremental = renderBlocks(source, BASE, cache);
      const full = render(source, BASE);
      expect(incremental.blocks).toHaveLength(1);
      expect(incremental.blocks[0]!.key).toBe(`full\u0000${source}`);
      expect(incremental.blocks.map((block) => block.html).join('')).toBe(full.html);
    },
  );

  it('falls back to full render when an HTML block spans blank lines', () => {
    const cache = new Map<string, string>();
    const source = '<div>\n\nhello\n\n</div>';
    expectIncrementalMatchesFull(source, cache);
  });

  it('matches full render for a 1 MiB document, so the mounted HTML after completion equals render()', () => {
    const paragraph = 'A realistic paragraph with **bold text**, a [link](https://example.test), and ordinary prose for a reader.\n\n';
    const benchmark = `# Benchmark document\n\n${paragraph.repeat(Math.ceil((1024 * 1024) / paragraph.length))}`;
    expectIncrementalMatchesFull(benchmark, new Map<string, string>());
  }, 60000);
});

describe('incremental parsing with retained parse state', () => {
  // Edits that stress block locality: list merging, fences that swallow the rest, setext headings, tables, quotes.
  const localEdits: Array<(text: string) => string> = [
    (text) => `${text}k`,
    (text) => `${text}\n\nTail paragraph.`,
    (text) => {
      const lines = text.split('\n');
      const at = Math.floor(lines.length / 2);
      return [...lines.slice(0, at), 'inserted line', ...lines.slice(at)].join('\n');
    },
    (text) => {
      const lines = text.split('\n');
      const at = Math.floor(lines.length / 3);
      return [...lines.slice(0, at), '', '- item one', '', '- item two', '', ...lines.slice(at)].join('\n');
    },
    (text) => {
      const lines = text.split('\n');
      const at = Math.floor(lines.length / 4);
      return [...lines.slice(0, at), '```', ...lines.slice(at)].join('\n');
    },
    (text) => `${text}\n\`\`\`\n`,
    (text) => {
      const lines = text.split('\n');
      const at = Math.floor(lines.length / 5);
      return [...lines.slice(0, at), '---', ...lines.slice(at)].join('\n');
    },
    (text) => {
      const lines = text.split('\n');
      const at = Math.floor(lines.length / 2);
      return [...lines.slice(0, at), '| a | b |', '| - | - |', '| 1 | 2 |', ...lines.slice(at)].join('\n');
    },
    (text) => {
      const lines = text.split('\n');
      const at = Math.floor(lines.length / 2);
      return [...lines.slice(0, at), '> quoted', 'lazy continuation', ...lines.slice(at)].join('\n');
    },
    (text) => {
      const lines = text.split('\n');
      return lines.filter((_, index) => index !== Math.floor(lines.length / 2)).join('\n');
    },
    (text) => text.replace(/\n\n/, '\n'),
    (text) => {
      const lines = text.split('\n');
      const at = Math.floor(lines.length / 2);
      return [...lines.slice(0, at), '    indented code', '', '    more code', ...lines.slice(at)].join('\n');
    },
    (text) => {
      const lines = text.split('\n');
      const at = Math.floor(lines.length / 2);
      return [...lines.slice(0, at), '## Late heading', ...lines.slice(at)].join('\n');
    },
  ];

  function expectStatefulMatchesFull(source: string, cache: Map<string, string>, state: ParseState) {
    const incremental = renderBlocks(source, BASE, cache, state);
    const full = render(source, BASE);
    expect(incremental.blocks.map((block) => block.html).join('')).toBe(full.html);
    expect(incremental.headings).toEqual(full.headings);
  }

  it.each([...documents, large].map((text, index) => [index, text] as const))(
    'document %i matches full render across local edits',
    (_index, text) => {
      const cache = new Map<string, string>();
      const state = createParseState();
      let current = text;
      expectStatefulMatchesFull(current, cache, state);
      for (const edit of localEdits) {
        current = edit(current);
        expectStatefulMatchesFull(current, cache, state);
      }
    },
    120000,
  );

  // Fresh caches per step, so cached HTML cannot mask a wrong parse.
  it.each([
    ['definition list lookahead past the region', ['term\n> a\n\n## h\n: def\n\nend\n', 'term\n: def\n\n## h\n: def\n\nend\n']],
    ['unclosed fence at the end keeps its trailing lines', ['a\n\n```\nx\n', 'b\n\n```\nx\n']],
    ['edit before a fence that later closes', ['a\n\n```\nx\n\ny\n```\n\nz\n', 'a b\n\n```\nx\n\ny\n```\n\nz\n']],
  ] as const)('%s', (_name, sequence) => {
    const state = createParseState();
    for (const source of sequence) expectStatefulMatchesFull(source, new Map<string, string>(), state);
  });

  it('reparses only the lines around a paragraph edit in the 100 KB fixture', () => {
    const cache = new Map<string, string>();
    const state = createParseState();
    renderBlocks(large, BASE, cache, state);
    expect(state.parsedLines).toBeGreaterThan(1000);
    renderBlocks(`${large}k`, BASE, cache, state);
    expect(state.parsedLines).toBeLessThan(20);
    const lines = `${large}k`.split('\n');
    const at = lines.findIndex((line, index) => index > lines.length / 2 && line.startsWith('Lorem'));
    lines[at] = `${lines[at]} typed`;
    renderBlocks(lines.join('\n'), BASE, cache, state);
    expect(state.parsedLines).toBeLessThan(20);
  });
});
