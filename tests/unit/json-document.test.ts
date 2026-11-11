import { describe, expect, it } from 'vitest';
import { docKindFromName, isJsonName } from '../../src/lib/doc-kind';
import { prepareJson } from '../../src/lib/json-document';

describe('docKindFromName', () => {
  it('derives the kind from the extension, ignoring case', () => {
    expect(docKindFromName('data.json')).toBe('json');
    expect(docKindFromName('DATA.JSON')).toBe('json');
    expect(docKindFromName('tsconfig.jsonc')).toBe('jsonc');
    expect(docKindFromName('notes.md')).toBe('markdown');
  });
  it('reads the pathname of a URL and ignores the query string', () => {
    expect(docKindFromName('https://example.test/a/data.json?raw=1')).toBe('json');
    expect(docKindFromName('https://example.test/a/data.jsonc#top')).toBe('jsonc');
    expect(docKindFromName('https://example.test/a/data.json.html')).toBe('markdown');
  });
  it('flags JSON names only', () => {
    expect(isJsonName('a.json')).toBe(true);
    expect(isJsonName('a.JSONC')).toBe(true);
    expect(isJsonName('a.md')).toBe(false);
  });
});

describe('prepareJson', () => {
  it('reformats minified input with two-space indentation', async () => {
    const result = await prepareJson('{"a":1,"b":[1,2]}', 'json');
    expect(result.error).toBeNull();
    expect(result.text).toBe('{\n  "a": 1,\n  "b": [\n    1,\n    2\n  ]\n}');
  });
  it('returns already formatted input byte-identical', async () => {
    const formatted = '{\n  "a": 1,\n  "b": [\n    1,\n    2\n  ]\n}\n';
    expect(await prepareJson(formatted, 'json')).toEqual({ text: formatted, error: null });
  });
  it('does not format multi-line input even when it is oddly indented', async () => {
    const odd = '{\n"a":    1}';
    expect(await prepareJson(odd, 'json')).toEqual({ text: odd, error: null });
  });
  it('preserves big numbers, key order, duplicate keys, and escapes', async () => {
    const { text } = await prepareJson('{"z":12345678901234567890,"a":1,"a":2,"s":"\\u00e9"}', 'json');
    expect(text).toContain('12345678901234567890');
    expect(text).toContain('"\\u00e9"');
    expect(text.indexOf('"z"')).toBeLessThan(text.indexOf('"a"'));
    expect(text.match(/"a"/g)).toHaveLength(2);
  });
  it('preserves JSONC comments', async () => {
    const { text, error } = await prepareJson('{"a":1, /* note */ "b":2 // end\n}', 'jsonc');
    expect(error).toBeNull();
    expect(text).toContain('/* note */');
    expect(text).toContain('// end');
  });
  it('strips a leading BOM', async () => {
    const { text, error } = await prepareJson('﻿{"a":1}', 'json');
    expect(error).toBeNull();
    expect(text.startsWith('﻿')).toBe(false);
    expect(text).toBe('{\n  "a": 1\n}');
  });
  it('reports empty input', async () => {
    expect((await prepareJson('', 'json')).error).toEqual({ message: 'Empty document', line: 1, column: 1 });
    expect((await prepareJson(' \n\t ', 'jsonc')).error?.message).toBe('Empty document');
  });
  it('reports a 1-based line and column for a missing comma and keeps the text', async () => {
    const source = '{\n  "a": 1\n  "b": 2\n}';
    const result = await prepareJson(source, 'json');
    expect(result.text).toBe(source);
    expect(result.error).toMatchObject({ line: 3, column: 3 });
    expect(result.error?.message).toBeTruthy();
  });
  it('accepts trailing commas and comments for jsonc and rejects them for json', async () => {
    const source = '{\n  "a": [1, 2,], // c\n}';
    expect((await prepareJson(source, 'jsonc')).error).toBeNull();
    expect((await prepareJson(source, 'json')).error).not.toBeNull();
    expect((await prepareJson('{"a":1,}', 'json')).error).not.toBeNull();
    expect((await prepareJson('{"a":1} // c', 'json')).error).not.toBeNull();
  });
});
