// @vitest-environment jsdom
import MarkdownIt from 'markdown-it';
import { describe, expect, it } from 'vitest';
import { frontMatterEnd, frontMatterRule, tocPlaceholderRule } from '../../src/render/local-rules';

function parser() {
  const md = new MarkdownIt({ html: true });
  md.block.ruler.before('table', 'toc_placeholder', tocPlaceholderRule);
  md.block.ruler.before('table', 'front_matter', frontMatterRule);
  return md;
}
const render = (text: string, env: Record<string, unknown> = {}) => parser().render(text, env);

describe('[[TOC]] placeholder', () => {
  it('emits an empty placeholder with a data-toc-placeholder attribute', () => {
    expect(render('# A\n\n[[TOC]]\n\n## B')).toContain('<div class="toc-placeholder" data-toc-placeholder></div>');
  });

  it('emits an empty placeholder when the document has no headings', () => {
    expect(render('[[TOC]]\n\ntext')).toBe('<div class="toc-placeholder" data-toc-placeholder></div>\n<p>text</p>\n');
  });

  it('leaves [[TOC]] inside a paragraph or code block as text', () => {
    expect(render('words [[TOC]] here')).not.toContain('data-toc-placeholder');
    expect(render('```\n[[TOC]]\n```')).not.toContain('data-toc-placeholder');
  });
});

describe('front matter', () => {
  it('renders a closed block at offset 0 as a metadata table', () => {
    const html = render('---\ntitle: Hello\ntags: a, b\n---\n\n# Body');
    expect(html).toContain('<table class="front-matter">');
    expect(html).toContain('<th>title</th><td>Hello</td>');
    expect(html).toContain('<th>tags</th><td>a, b</td>');
    expect(html).toContain('<h1>Body</h1>');
  });

  it('escapes keys and values', () => {
    expect(render('---\nk: <script>x</script>\n---')).not.toContain('<script>');
  });

  it('renders an unclosed opening --- as text and never hides the document', () => {
    const html = render('---\ntitle: Hello\n\n# Body');
    expect(html).not.toContain('front-matter');
    expect(html).toContain('title: Hello');
    expect(html).toContain('<h1>Body</h1>');
  });

  it('does not match a --- block in the middle of the document', () => {
    const html = render('# Top\n\ntext\n\n---\ntitle: Hello\n---\n\nend');
    expect(html).not.toContain('front-matter');
  });

  it('does not match when the parse is of a later slice of the document', () => {
    expect(render('---\ntitle: Hello\n---\n', { partial: true })).not.toContain('front-matter');
  });

  it('does not treat a leading thematic break followed by text as front matter', () => {
    const html = render('---\n\nSome text\n');
    expect(html).not.toContain('front-matter');
    expect(html).toContain('<hr>');
    expect(html).toContain('<p>Some text</p>');
  });

  it('does not match when the file starts with a blank line', () => {
    expect(render('\n---\ntitle: x\n---\n')).not.toContain('front-matter');
  });

  it('frontMatterEnd gives the character offset after a closed block and 0 otherwise', () => {
    expect(frontMatterEnd('---\na: 1\n---\nrest')).toBe('---\na: 1\n---\n'.length);
    expect(frontMatterEnd('---\na: 1\n\nrest')).toBe(0);
    expect(frontMatterEnd('x\n---\na: 1\n---\n')).toBe(0);
    expect(frontMatterEnd('---\r\na: 1\r\n---\r\nrest')).toBe('---\r\na: 1\r\n---\r\n'.length);
  });
});
