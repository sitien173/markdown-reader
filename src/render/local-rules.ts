import type { StateBlock } from 'markdown-it';

// Both rules emit html_block tokens marked `meta.local`, so they render without renderer rules
// and do not make a block depend on the rest of the document.
const localHtml = (state: StateBlock, from: number, to: number, html: string) => {
  const token = state.push('html_block', '', 0);
  token.map = [from, to];
  token.content = html;
  token.meta = { local: true };
  state.line = to;
};

export function tocPlaceholderRule(state: StateBlock, start: number, _end: number, silent: boolean): boolean {
  if ((state.sCount[start] ?? 0) - state.blkIndent >= 4) return false;
  const first = (state.bMarks[start] ?? 0) + (state.tShift[start] ?? 0);
  if (state.src.slice(first, state.eMarks[start]).trim() !== '[[TOC]]') return false;
  if (silent) return true;
  localHtml(state, start, start + 1, '<div class="toc-placeholder" data-toc-placeholder></div>\n');
  return true;
}

const FENCE = /^---[ \t]*$/;
const FRONT_MATTER = /^---[ \t]*\r?\n(?:[\s\S]*?\r?\n)?---[ \t]*(?:\r?\n|$)/;

/** Character offset just past a closed `---` front matter block at offset 0 of the document, or 0 when there is none. */
export function frontMatterEnd(text: string): number {
  return FRONT_MATTER.exec(text)?.[0].length ?? 0;
}

/** Matches only at offset 0 of the whole document, so an `env.partial` parse of a later slice never matches. */
export function frontMatterRule(state: StateBlock, start: number, end: number, silent: boolean): boolean {
  if (start !== 0 || state.bMarks[0] !== 0 || state.tShift[0] !== 0 || state.level !== 0 || state.parentType !== 'root') return false;
  if ((state.env as { partial?: boolean } | null)?.partial) return false;
  const line = (index: number) => state.src.slice(state.bMarks[index], state.eMarks[index]);
  if (!FENCE.test(line(0))) return false;
  let close = 1;
  while (close < end && !FENCE.test(line(close))) close++;
  if (close >= end) return false;
  if (silent) return true;
  const rows: Array<[string, string]> = [];
  for (let index = 1; index < close; index++) {
    const text = line(index).trim();
    if (!text) continue;
    const pair = /^([^:\s][^:]*):\s*(.*)$/.exec(text);
    const last = rows.at(-1);
    if (pair) rows.push([(pair[1] ?? '').trim(), pair[2] ?? '']);
    else if (last) last[1] += ` ${text}`;
    else rows.push(['', text]);
  }
  const esc = state.md.utils.escapeHtml;
  const body = rows.map(([key, value]) => `<tr><th>${esc(key)}</th><td>${esc(value)}</td></tr>`).join('');
  localHtml(state, 0, close + 1, `<table class="front-matter"><tbody>${body}</tbody></table>\n`);
  return true;
}
