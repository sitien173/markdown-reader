// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { render } from '../../src/render/pipeline';

const fixture = (name: string) => readFileSync(resolve('tests/fixtures/markdown', name), 'utf8');

describe('Markdown render pipeline', () => {
  const examples: [string, string, RegExp][] = [
    ['emoji', 'emoji.md', /😄/],
    ['footnote', 'footnote.md', /class="footnotes-list"[\s\S]*href="#fn/],
    ['mark', 'mark.md', /<mark>/],
    ['abbr', 'abbr.md', /<abbr[^>]*title="Hyper Text Markup Language"/],
    ['sub', 'sub.md', /<sub>/],
    ['sup', 'sup.md', /<sup>/],
    ['definition list', 'deflist.md', /<dl>[\s\S]*<dt>[\s\S]*<dd>/],
    ['task list', 'task-lists.md', /<input[^>]*checked[^>]*disabled[^>]*type="checkbox"/],
    ['GitHub alert', 'alert.md', /markdown-alert markdown-alert-note[\s\S]*Note/],
    ['KaTeX', 'math.md', /class="katex"[\s\S]*<math[\s\S]*class="katex-html"/],
    ['table', 'table.md', /<table>/],
    ['strikethrough', 'strikethrough.md', /<s>/],
    ['autolink', 'autolink.md', /href="https:\/\/example\.com/],
    ['mermaid fence', 'mermaid.md', /<pre class="mermaid">A--&gt;B &lt;script&gt;alert\(1\)&lt;\/script&gt;\s*<\/pre>/],
  ];
  it.each(examples)('renders %s fixture', (_name, file, expected) => {
    expect(render(fixture(file), 'https://example.com/docs/readme.md').html.replaceAll('user-content-', '')).toMatch(expected);
  });

  it('extracts heading levels and stable unique ids from each render', () => {
    const text = '# Intro\n## Intro\n### Three\n#### Four\n##### Five\n###### Six';
    const first = render(text, 'https://example.com/');
    const second = render(text, 'https://example.com/');
    expect(first.headings.map(({ level, text, id }) => [level, text, id])).toEqual([
      [1, 'Intro', 'user-content-intro'],
      [2, 'Intro', 'user-content-intro-1'],
      [3, 'Three', 'user-content-three'],
      [4, 'Four', 'user-content-four'],
      [5, 'Five', 'user-content-five'],
      [6, 'Six', 'user-content-six'],
    ]);
    expect(second.headings).toEqual(first.headings);
  });

  it('renders a realistic 256 KiB document at scale', async () => {
    const section = (withMath: boolean) =>
      `# Heading\n\n## Subheading\n\n### Detail\n\nA **bold** paragraph with *emphasis*, [relative](./doc.md), [external](https://other.test/), and [local](guide.md) links.\n\nAnother paragraph with ${withMath ? 'inline math $e=mc^2$ and block math $$x^2+y^2=z^2$$' : 'ordinary inline text'} and a footnote[^note].\n\n- bullet one\n- bullet two\n\n1. ordered one\n2. ordered two\n\n- [ ] task item\n\n| a | b |\n|---|---|\n| x | y |\n\n\`\`\`ts\nconst value = 1;\n\`\`\`\n\n[^note]: Footnote content.\n\n> [!NOTE]\n> An alert paragraph.\n\n`;
    const sectionSize = section(false);
    const count = Math.ceil((256 * 1024) / sectionSize.length);
    const text = section(true) + section(false).repeat(count - 1);
    const start = performance.now();
    const result = render(text, 'https://example.com/');
    console.info(`256 KiB structured render: ${(performance.now() - start).toFixed(1)} ms`);
    expect(text.length).toBeGreaterThanOrEqual(256 * 1024);
    expect(result.headings).toHaveLength(count * 3);
    expect(result.html.match(/<table>/g)).toHaveLength(count);
    expect(result.html).not.toMatch(/<script/i);
  }, 60000);
});
