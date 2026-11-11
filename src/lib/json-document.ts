export interface JsonParseError {
  message: string;
  line: number;
  column: number;
}

export interface PreparedJson {
  text: string;
  error: JsonParseError | null;
}

function position(text: string, offset: number): { line: number; column: number } {
  const before = text.slice(0, offset).split(/\r\n|\r|\n/);
  return { line: before.length, column: (before[before.length - 1]?.length ?? 0) + 1 };
}

/** Strips a BOM, reports the first parse error, and reformats single-line input. Never changes content, only whitespace. */
export async function prepareJson(text: string, kind: 'json' | 'jsonc'): Promise<PreparedJson> {
  const source = text.replace(/^﻿/, '');
  if (!source.trim()) return { text: source, error: { message: 'Empty document', line: 1, column: 1 } };
  const { parse, printParseErrorCode, format, applyEdits } = await import('jsonc-parser');
  const errors: import('jsonc-parser').ParseError[] = [];
  parse(source, errors, { disallowComments: kind === 'json', allowTrailingComma: kind === 'jsonc' });
  const first = errors[0];
  if (first) return { text: source, error: { message: printParseErrorCode(first.error), ...position(source, first.offset) } };
  if (/[\r\n]/.test(source.trim())) return { text: source, error: null };
  return { text: applyEdits(source, format(source, undefined, { tabSize: 2, insertSpaces: true })), error: null };
}

export type JsonLayout = 'original' | 'beautify' | 'minify';
export type JsonIndent = 2 | 4 | 'tab';
export type JsonViewOptions = {
  layout: JsonLayout;
  indent: JsonIndent;
  sortKeys: boolean;
  stripComments: boolean;
  escape: boolean;
};

// jsonc-parser declares SyntaxKind as a const enum, which cannot be read through a dynamic import.
const LINE_COMMENT = 12;
const BLOCK_COMMENT = 13;
const TRIVIA = 15;
const CLOSE_BRACE = 2;
const CLOSE_BRACKET = 4;
const COMMA = 5;

type Jsonc = typeof import('jsonc-parser');

function hasCommentTokens({ createScanner }: Jsonc, text: string): boolean {
  const scanner = createScanner(text, false);
  for (let kind = scanner.scan(); kind !== 17; kind = scanner.scan()) if (kind === LINE_COMMENT || kind === BLOCK_COMMENT) return true;
  return false;
}

function strip({ createScanner }: Jsonc, text: string): string {
  const scanner = createScanner(text, false);
  const tokens: { kind: number; start: number; end: number }[] = [];
  for (let kind = scanner.scan(); kind !== 17; kind = scanner.scan())
    tokens.push({ kind, start: scanner.getTokenOffset(), end: scanner.getPosition() });
  let out = '';
  tokens.forEach(({ kind, start, end }, i) => {
    if (kind === LINE_COMMENT || kind === BLOCK_COMMENT) return;
    if (kind === COMMA) {
      let next = tokens[i + 1];
      for (let j = i + 2; next && next.kind >= LINE_COMMENT && next.kind <= TRIVIA; j++) next = tokens[j];
      if (next?.kind === CLOSE_BRACE || next?.kind === CLOSE_BRACKET) return;
    }
    out += text.slice(start, end);
  });
  return out;
}

/** Rebuilds objects from slices of the source so values are never re-serialized. Input must be comment free. */
function sortKeys({ parseTree }: Jsonc, text: string): string {
  const errors: import('jsonc-parser').ParseError[] = [];
  const root = parseTree(text, errors, { allowTrailingComma: true });
  if (!root || errors.length) return text;
  const rebuild = (node: import('jsonc-parser').Node): string => {
    const children = node.children ?? [];
    if (node.type === 'array') return `[${children.map(rebuild).join(',')}]`;
    if (node.type !== 'object') return text.slice(node.offset, node.offset + node.length);
    const props = children.flatMap((prop) => {
      const [key, value] = prop.children ?? [];
      return key && value
        ? [{ name: String(key.value), text: `${text.slice(key.offset, key.offset + key.length)}:${rebuild(value)}` }]
        : [];
    });
    props.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    return `{${props.map((prop) => prop.text).join(',')}}`;
  };
  return rebuild(root);
}

function minify({ createScanner }: Jsonc, text: string): string {
  const scanner = createScanner(text, true);
  let out = '';
  for (let kind = scanner.scan(); kind !== 17; kind = scanner.scan()) out += text.slice(scanner.getTokenOffset(), scanner.getPosition());
  return out;
}

/** Builds one toolbar view of a JSON document. Number text, string escapes, and duplicate keys stay byte-exact. */
export async function transformJson(
  source: string,
  _kind: 'json' | 'jsonc',
  options: JsonViewOptions,
): Promise<{ text: string; hasComments: boolean }> {
  const jsonc = await import('jsonc-parser');
  let text = source.replace(/^\uFEFF/, '');
  if (options.stripComments || options.sortKeys) text = strip(jsonc, text);
  // Sorting emits compact text, so the original layout falls back to beautify.
  if (options.sortKeys) text = sortKeys(jsonc, text);
  const layout = options.sortKeys && options.layout === 'original' ? 'beautify' : options.layout;
  if (layout === 'beautify') {
    const edits = jsonc.format(text, undefined, {
      tabSize: options.indent === 'tab' ? 2 : options.indent,
      insertSpaces: options.indent !== 'tab',
      eol: '\n',
    });
    text = jsonc.applyEdits(text, edits);
  } else if (layout === 'minify') text = minify(jsonc, text);
  if (options.escape) text = JSON.stringify(text);
  return { text, hasComments: hasCommentTokens(jsonc, text) };
}

/** Decodes a JSON string document into its value, or returns null when the root is not a string. */
export async function unescapeJson(source: string, kind: 'json' | 'jsonc'): Promise<{ text: string; parses: boolean } | null> {
  const { parseTree } = await import('jsonc-parser');
  const errors: import('jsonc-parser').ParseError[] = [];
  const root = parseTree(source.replace(/^\uFEFF/, ''), errors, {
    disallowComments: kind === 'json',
    allowTrailingComma: kind === 'jsonc',
  });
  if (errors.length || root?.type !== 'string') return null;
  const text = String(root.value);
  try {
    JSON.parse(text);
    return { text, parses: true };
  } catch {
    return { text, parses: false };
  }
}
