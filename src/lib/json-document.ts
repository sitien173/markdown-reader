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
