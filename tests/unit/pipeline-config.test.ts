// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { defaultSettings } from '../../src/lib/settings';
import { getMarkdownIt, pluginKey, render, type PluginConfig } from '../../src/render/pipeline';

const on = defaultSettings.plugins;
const off = (...names: Array<keyof PluginConfig>): PluginConfig => ({ ...on, ...Object.fromEntries(names.map((name) => [name, false])) });
const html = (text: string, config: PluginConfig) =>
  (render as (t: string, b: string, c: PluginConfig) => { html: string })(text, '', config).html;

describe('plugin config drives the parser', () => {
  const cases: Array<[keyof PluginConfig, string, RegExp]> = [
    ['emoji', ':smile:', /😄/],
    ['subscript', 'H~2~O', /<sub>2<\/sub>/],
    ['superscript', 'x^2^', /<sup>2<\/sup>/],
    ['mark', '==hit==', /<mark>hit<\/mark>/],
    ['abbreviation', '*[HTML]: Hyper Text\n\nThe HTML spec', /<abbr/],
    ['definitionList', 'Term\n: Definition', /<dl>/],
    ['footnote', 'Text[^1]\n\n[^1]: Note', /footnote/],
    ['taskList', '- [x] done', /type="checkbox"/],
    ['alert', '> [!NOTE]\n> Careful', /markdown-alert/],
  ];
  for (const [name, source, effect] of cases) {
    it(`${name} on has its effect and off removes it`, () => {
      expect(html(source, on)).toMatch(effect);
      expect(html(source, off(name))).not.toMatch(effect);
    });
  }

  it('katex off leaves $x$ as text', () => {
    expect(html('$x$', on)).toContain('katex');
    const result = html('$x$', off('katex'));
    expect(result).not.toContain('katex');
    expect(result).toContain('$x$');
  });

  it('mermaid off keeps the source as a code block', () => {
    const source = '```mermaid\ngraph TD; A-->B\n```';
    expect(html(source, on)).toContain('<pre class="mermaid">');
    const result = html(source, off('mermaid'));
    expect(result).not.toContain('class="mermaid"');
    expect(result).toContain('<pre><code class="language-mermaid">');
  });

  it('linkify off leaves a bare URL unlinked', () => {
    expect(html('see https://example.com now', on)).toContain('<a ');
    expect(html('see https://example.com now', off('linkify'))).not.toContain('<a ');
  });

  it('typographer and breaks follow the config', () => {
    expect(html('"q"', { ...on, typographer: true })).toContain('“q”');
    expect(html('"q"', on)).not.toContain('“');
    expect(html('a\nb', { ...on, breaks: true })).toContain('<br');
    expect(html('a\nb', on)).not.toContain('<br');
  });
});

describe('parser instance cache', () => {
  it('returns the same instance for equal settings', () => {
    expect(getMarkdownIt({ ...on })).toBe(getMarkdownIt({ ...on }));
    expect(pluginKey({ ...on })).toBe(pluginKey({ ...on }));
  });

  it('uses a different key for a different config', () => {
    expect(pluginKey(off('emoji'))).not.toBe(pluginKey(on));
  });

  it('holds at most 4 instances', () => {
    const [head, ...rest]: Array<keyof PluginConfig> = ['emoji', 'mark', 'katex', 'footnote', 'alert'];
    const first = getMarkdownIt(off(head as keyof PluginConfig));
    for (const name of rest) getMarkdownIt(off(name));
    expect(getMarkdownIt(off(head as keyof PluginConfig))).not.toBe(first);
  });
});

describe('insert and multi-markdown table', () => {
  it('insert renders ++text++ as ins and is off when disabled', () => {
    expect(html('++added++', on)).toContain('<ins>added</ins>');
    expect(html('++added++', off('insert'))).not.toContain('<ins>');
  });

  const table =
    '|             |          Grouping           ||\nFirst Header  | Second Header | Third Header |\n ------------ | :-----------: | -----------: |\nContent       |          *Long Cell*        ||\nContent       |   **Cell**    |         Cell |';

  it('renders colspan with the setting on and no multi-markdown table when off', () => {
    expect(html(table, on)).toMatch(/<th[^>]*colspan="2"/);
    expect(html(table, off('multimdTable'))).not.toContain('colspan');
  });

  it('replaces the core table rule only when the setting is on', () => {
    const rule = (config: PluginConfig) =>
      (getMarkdownIt(config).block.ruler as unknown as { __rules__: Array<{ name: string; fn: unknown }> }).__rules__.find(
        (entry) => entry.name === 'table',
      )?.fn;
    const core = rule(off('multimdTable'));
    expect(core).toBe(rule(off('multimdTable', 'emoji')));
    expect(rule(on)).not.toBe(core);
    expect(rule(off('multimdTable'))).toBe(core);
  });
});
