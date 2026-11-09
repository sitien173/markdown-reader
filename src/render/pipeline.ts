import MarkdownIt from 'markdown-it';
import * as emoji from 'markdown-it-emoji';
import footnote from 'markdown-it-footnote';
import anchor from 'markdown-it-anchor';
import mark from 'markdown-it-mark';
import abbr from 'markdown-it-abbr';
import sub from 'markdown-it-sub';
import sup from 'markdown-it-sup';
import deflist from 'markdown-it-deflist';
import taskLists from 'markdown-it-task-lists';
import githubAlerts from 'markdown-it-github-alerts';
import ins from 'markdown-it-ins';
import multimdTable from 'markdown-it-multimd-table';
import katex from '@vscode/markdown-it-katex';
import { defaultSettings, type Settings } from '../lib/settings';
import { frontMatterEnd, frontMatterRule, tocPlaceholderRule } from './local-rules';
import { sanitize } from './sanitize';
import { USER_CONTENT_PREFIX } from './user-content';

export type PluginConfig = Settings['plugins'];
type MarkdownItInstance = InstanceType<typeof MarkdownIt>;

export type Heading = { level: number; text: string; id: string };

function plainText(token: { children?: any[] | null; content: string }): string {
  if (!token.children) return token.content;
  return token.children
    .map((child: any) => {
      if (child.type === 'text' || child.type === 'code_inline' || child.type === 'image') return child.content;
      return child.children ? plainText(child) : '';
    })
    .join('');
}

function normalizePlugin<T>(pluginModule: T | { default?: T }): T {
  return ((pluginModule as { default?: T }).default ?? pluginModule) as T;
}

const defaultPlugins = defaultSettings.plugins;
const pluginNames = Object.keys(defaultPlugins) as Array<keyof PluginConfig>;
/** Stable string for a plugin config; it keys the parser cache and every block key. */
export const pluginKey = (config: PluginConfig): string => pluginNames.map((name) => (config[name] ? '1' : '0')).join('');

function createMarkdownIt(config: PluginConfig): MarkdownItInstance {
  performance.mark('md-parser-build-start');
  const md = new MarkdownIt({ html: true, linkify: config.linkify, typographer: config.typographer, breaks: config.breaks });
  md.enable(['table', 'strikethrough']);
  if (config.emoji) md.use(emoji.full);
  if (config.footnote) md.use(normalizePlugin(footnote));
  md.use(normalizePlugin(anchor));
  if (config.mark) md.use(normalizePlugin(mark));
  if (config.insert) md.use(normalizePlugin(ins));
  if (config.abbreviation) md.use(normalizePlugin(abbr));
  if (config.subscript) md.use(normalizePlugin(sub));
  if (config.superscript) md.use(normalizePlugin(sup));
  if (config.definitionList) md.use(normalizePlugin(deflist));
  if (config.taskList) md.use(normalizePlugin(taskLists), { enabled: false, label: true });
  if (config.alert) md.use(normalizePlugin(githubAlerts));
  if (config.katex) md.use(normalizePlugin(katex));
  if (config.multimdTable) {
    // The plugin replaces the core table rule. It calls `md.utils.assign`, which markdown-it 15 removed; this instance gets a copy of utils that has it.
    md.utils = { ...md.utils, assign: Object.assign } as typeof md.utils;
    // TODO: drop this shim when markdown-it-multimd-table (4.2.3) stops calling `md.utils.assign`.
    md.use(normalizePlugin(multimdTable));
  }
  if (config.toc) md.block.ruler.before('table', 'toc_placeholder', tocPlaceholderRule);
  if (config.frontMatter) md.block.ruler.before('table', 'front_matter', frontMatterRule);
  if (config.mermaid) {
    const defaultFence = md.renderer.rules.fence;
    md.renderer.rules.fence = (tokens, index, options, env, self) => {
      const token = tokens[index];
      if (token?.info.trim().split(/\s+/)[0] === 'mermaid') {
        return `<pre class="mermaid">${md.utils.escapeHtml(token.content)}</pre>\n`;
      }
      return defaultFence ? defaultFence(tokens, index, options, env, self) : self.renderToken(tokens, index, options);
    };
  }
  performance.mark('md-parser-build-end');
  performance.measure('md-parser-build', 'md-parser-build-start', 'md-parser-build-end');
  return md;
}

const CACHE_SIZE = 4;
const instances = new Map<string, MarkdownItInstance>();

/** Four-entry LRU of parser instances keyed by `pluginKey`. */
export function getMarkdownIt(config: PluginConfig = defaultPlugins): MarkdownItInstance {
  const key = pluginKey(config);
  let md = instances.get(key);
  if (md) instances.delete(key);
  else md = createMarkdownIt(config);
  instances.set(key, md);
  const oldest = instances.keys().next().value;
  if (instances.size > CACHE_SIZE && oldest !== undefined) instances.delete(oldest);
  return md;
}

export function render(text: string, baseUrl: string, config: PluginConfig = defaultPlugins): { html: string; headings: Heading[] } {
  const md = getMarkdownIt(config);
  const env = {};
  const tokens = md.parse(text, env);
  const headings = collectHeadings(tokens);
  const html = md.renderer.render(tokens, md.options, env);
  return { html: sanitize(html, baseUrl), headings };
}

function collectHeadings(tokens: any[]): Heading[] {
  const headings: Heading[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!;
    if (token.type !== 'heading_open') continue;
    const inline = tokens[i + 1];
    const id = token.attrGet('id');
    if (id && inline)
      headings.push({ level: Number(token.tag.slice(1)), text: plainText(inline).trim(), id: `${USER_CONTENT_PREFIX}${String(id)}` });
  }
  return headings;
}

export type RenderedBlock = { key: string; html: string };
// keys and headings are known after parsing; html(index) sanitizes one block on demand so callers can render progressively.
export type BlockPlan = { keys: string[]; headings: Heading[]; html(index: number): string };

// Reference definitions, footnotes, and abbreviation definitions make a block's output depend on other blocks.
const FULL_RENDER_GUARD = /^[ \t>*+-]*(?:\d+[.)])?[ \t>*+-]*\[[^\]\n]+\]:|\[\^|^[ \t>*+-]*(?:\d+[.)])?[ \t>*+-]*\*\[/m;

type BlockGroup = { tokens: any[]; env: any; start: number; end: number };
// The previous parse, kept between keystrokes so an edit re-parses only the blocks around it.
export type ParseState = { lines: string[]; groups: BlockGroup[] | null; parsedLines: number };
export function createParseState(): ParseState {
  return { lines: [], groups: null, parsedLines: 0 };
}

const isNonLocal = (tokens: any[]) => tokens.some((token) => token.type === 'html_block' && !token.meta?.local);
const headingTokens = (groups: BlockGroup[]) =>
  groups.flatMap((group) =>
    group.tokens.flatMap((token, index) => (token.type === 'heading_open' ? [[token, group.tokens[index + 1]] as [any, any]] : [])),
  );
const signature = (group: BlockGroup) => group.tokens.map((token) => `${token.type}:${token.tag}:${token.markup}`).join(',');

// Parses lines[from, to) on its own and splits it into top-level blocks with absolute line ranges.
function parseGroups(md: MarkdownItInstance, lines: string[], from: number, to: number): { groups: BlockGroup[]; local: boolean } | null {
  // A slice that starts past line 0 must not match front matter, which only exists at offset 0 of the document.
  const env: any = from > 0 ? { partial: true } : {};
  const tokens = md.parse(lines.slice(from, to).join('\n'), env) as any[];
  const local =
    !(env.references && Object.keys(env.references).length > 0) &&
    !(env.abbreviations && Object.keys(env.abbreviations).length > 0) &&
    !isNonLocal(tokens);
  const raw: any[][] = [];
  let current: any[] = [];
  for (const token of tokens) {
    if (token.level === 0 && token.nesting !== -1 && current.length > 0) {
      raw.push(current);
      current = [];
    }
    current.push(token);
  }
  if (current.length > 0) raw.push(current);
  const groups: BlockGroup[] = [];
  for (const group of raw) {
    const mapped = group.filter((token) => token.map);
    if (mapped.length === 0) return null;
    groups.push({
      tokens: group,
      env,
      start: from + Math.min(...mapped.map((token) => token.map[0])),
      end: from + Math.max(...mapped.map((token) => token.map[1])),
    });
  }
  return { groups, local };
}

// Re-parses the changed lines plus two unchanged blocks on each side, and keeps the previous blocks elsewhere.
// Returns null when the edit may change other blocks: changed headings renumber slugs, HTML blocks wrap later blocks,
// and a region whose last two blocks no longer match the old ones (for example an unclosed fence) has not resynced.
function reparse(md: MarkdownItInstance, config: PluginConfig, state: ParseState, lines: string[]): BlockGroup[] | null {
  const old = state.lines;
  const groups = state.groups!;
  const limit = Math.min(old.length, lines.length);
  let head = 0;
  while (head < limit && old[head] === lines[head]) head++;
  if (head === old.length && head === lines.length) {
    state.parsedLines = 0;
    return groups;
  }
  // Front matter is decided by the whole document: an edit that opens, closes, or changes it re-parses everything.
  if (config.frontMatter && (old[0]?.startsWith('---') || lines[0]?.startsWith('---'))) {
    const oldEnd = frontMatterEnd(old.join('\n'));
    const newEnd = frontMatterEnd(lines.join('\n'));
    if (oldEnd !== newEnd || (oldEnd > 0 && head < old.join('\n').slice(0, oldEnd).split('\n').length - 1)) return null;
  }
  let tail = 0;
  while (tail < limit - head && old[old.length - 1 - tail] === lines[lines.length - 1 - tail]) tail++;
  const changeEnd = old.length - tail;
  const delta = lines.length - old.length;
  let first = groups.findIndex((group) => group.end >= head);
  if (first === -1) first = groups.length;
  let last = -1;
  for (let index = groups.length - 1; index >= 0; index--)
    if (groups[index]!.start <= changeEnd) {
      last = index;
      break;
    }
  // Two unchanged blocks on each side: block rules look ahead past a block's own lines, so the second block
  // after the edit proves the parse has resynced. The region runs up to the next kept block, or to the end.
  const before = Math.max(first - 2, 0);
  const after = Math.max(last + 2, before);
  const regionStart = before < groups.length ? Math.min(groups[before]!.start, head) : head;
  const regionEnd = after + 1 < groups.length ? groups[after + 1]!.start + delta : lines.length;
  const parsed = parseGroups(md, lines, regionStart, regionEnd);
  if (!parsed || !parsed.local) return null;
  // Heading ids come from a document-wide slug table, so the region keeps its old ids only when its headings are unchanged.
  const oldHeadings = headingTokens(groups.slice(before, after + 1));
  const newHeadings = headingTokens(parsed.groups);
  if (
    oldHeadings.length !== newHeadings.length ||
    oldHeadings.some(([, inline], index) => inline.content !== newHeadings[index]![1].content)
  )
    return null;
  newHeadings.forEach(([token], index) => {
    token.attrSet('id', oldHeadings[index]![0].attrGet('id'));
  });
  if (after + 1 < groups.length) {
    const matches = (offset: number) => {
      const resynced = parsed.groups.at(-offset);
      const previous = groups[after + 1 - offset]!;
      return (
        resynced !== undefined &&
        resynced.start === previous.start + delta &&
        resynced.end === previous.end + delta &&
        signature(resynced) === signature(previous)
      );
    };
    if (!matches(1) || !matches(2)) return null;
  }
  state.parsedLines = regionEnd - regionStart;
  const shifted = groups.slice(after + 1).map((group) => ({ ...group, start: group.start + delta, end: group.end + delta }));
  return [...groups.slice(0, before), ...parsed.groups, ...shifted];
}

// Splits the document into top-level blocks. Each block is rendered and sanitized on its own and cached by
// source text plus heading ids, so a keystroke re-renders only the blocks it changed. With a parse state,
// a keystroke also re-parses only the blocks around the edit.
export function planBlocks(
  text: string,
  baseUrl: string,
  cache: Map<string, string>,
  state?: ParseState,
  config: PluginConfig = defaultPlugins,
): BlockPlan {
  const md = getMarkdownIt(config);
  // Block keys also index the caller's cache, so another config must not reuse them; the default config keeps the plain keys.
  const configKey = pluginKey(config);
  const prefix = configKey === pluginKey(defaultPlugins) ? '' : `${configKey}\u0001`;
  const fallback = (): BlockPlan => {
    if (state) {
      state.groups = null;
      state.lines = [];
    }
    const full = render(text, baseUrl, config);
    return { keys: [`${prefix}full\u0000${text}`], headings: full.headings, html: () => full.html };
  };
  if (FULL_RENDER_GUARD.test(text)) return fallback();
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  let groups = state?.groups ? reparse(md, config, state, lines) : null;
  if (!groups) {
    const parsed = parseGroups(md, lines, 0, lines.length);
    // Reference and abbreviation definitions and raw HTML blocks make a block's output depend on other blocks.
    if (!parsed || !parsed.local) return fallback();
    groups = parsed.groups;
    if (state) state.parsedLines = lines.length;
  }
  if (state) {
    state.lines = lines;
    state.groups = groups;
  }
  const keys: string[] = [];
  const renderers: Array<() => string> = [];
  for (const group of groups) {
    const ids = group.tokens
      .filter((token) => token.type === 'heading_open')
      .map((token) => String(token.attrGet('id') ?? ''))
      .join(',');
    const key = `${prefix}${lines.slice(group.start, group.end).join('\n')}\u0000${ids}`;
    keys.push(key);
    renderers.push(() => {
      let html = cache.get(key);
      if (html === undefined) {
        if (cache.size > 4000) cache.clear();
        html = sanitize(md.renderer.render(group.tokens, md.options, group.env), baseUrl);
        cache.set(key, html);
      }
      return html;
    });
  }
  return { keys, headings: collectHeadings(groups.flatMap((group) => group.tokens)), html: (index) => renderers[index]!() };
}

export function renderBlocks(
  text: string,
  baseUrl: string,
  cache: Map<string, string>,
  state?: ParseState,
  config: PluginConfig = defaultPlugins,
): { blocks: RenderedBlock[]; headings: Heading[] } {
  const plan = planBlocks(text, baseUrl, cache, state, config);
  return { blocks: plan.keys.map((key, index) => ({ key, html: plan.html(index) })), headings: plan.headings };
}

// Finds the start of a blank line at or after minChars that lies outside every fenced code block, math block and HTML block,
// so the text before it can be parsed on its own. Returns -1 when no such line exists.
export function findSafeBoundary(text: string, minChars: number): number {
  let fence: { char: string; length: number } | null = null;
  let math = false;
  // 'comment' ends at -->, a tag name ends at its closing tag, 'block' ends at the next blank line.
  let html: string | null = null;
  let start = 0;
  while (start <= text.length) {
    const newline = text.indexOf('\n', start);
    const end = newline === -1 ? text.length : newline;
    const line = text.slice(start, end);
    const trimmed = line.trim();
    const lower = line.toLowerCase();
    // A blank line ends a plain HTML block; that blank line is still a valid boundary, so the blank-line check below runs for it.
    if (html === 'block' && trimmed === '') html = null;
    if (fence) {
      const close = /^ {0,3}(`{3,}|~{3,})\s*$/.exec(line);
      if (close && close[1]![0] === fence.char && close[1]!.length >= fence.length) fence = null;
    } else if (math) {
      if (trimmed.endsWith('$$')) math = false;
    } else if (html) {
      if (html !== 'block' && (html === 'comment' ? line.includes('-->') : lower.includes(`</${html}`))) html = null;
    } else if (trimmed === '') {
      if (start >= minChars && start > 0 && start < text.length) return start;
    } else {
      const opener = /^ {0,3}(`{3,}|~{3,})/.exec(line);
      if (opener) {
        fence = { char: opener[1]![0]!, length: opener[1]!.length };
      } else if (trimmed.startsWith('$$')) {
        if (!(trimmed.length >= 4 && trimmed.endsWith('$$'))) math = true;
      } else if (/^ {0,3}<!--/.test(line)) {
        if (!line.includes('-->')) html = 'comment';
      } else if (/^ {0,3}<(script|pre|style|textarea)[\s>]/i.test(line)) {
        html = /<(script|pre|style|textarea)/i.exec(line)![1]!.toLowerCase();
        if (lower.includes(`</${html}`)) html = null;
      } else if (/^ {0,3}<\/?[A-Za-z][A-Za-z0-9-]*(\s|\/?>|$)/.test(line)) {
        html = 'block';
      }
    }
    if (newline === -1) break;
    start = newline + 1;
  }
  return -1;
}

// Renders only the leading part of a large document, cut at a safe boundary past minChars, so something can be shown before the full parse.
export function planPrefix(
  text: string,
  baseUrl: string,
  minChars: number,
  config: PluginConfig = defaultPlugins,
): { end: number; html: string; headings: Heading[] } | null {
  if (text.length <= minChars) return null;
  // The prefix must contain a front matter block whole, or it would render as text before the full parse.
  const end = findSafeBoundary(text, config.frontMatter ? Math.max(minChars, frontMatterEnd(text)) : minChars);
  if (end <= 0) return null;
  const prefix = render(text.slice(0, end), baseUrl, config);
  return { end, html: prefix.html, headings: prefix.headings };
}
