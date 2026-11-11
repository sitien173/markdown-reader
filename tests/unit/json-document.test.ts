import { describe, expect, it } from 'vitest';
import { docKindFromName, isJsonName } from '../../src/lib/doc-kind';
import { type JsonViewOptions, prepareJson, transformJson, unescapeJson } from '../../src/lib/json-document';

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

const VIEW: JsonViewOptions = { layout: 'original', indent: 2, sortKeys: false, stripComments: false, escape: false };
const view = (over: Partial<JsonViewOptions>) => ({ ...VIEW, ...over });

describe('transformJson layout', () => {
  it('returns the source untouched for the original layout', async () => {
    const source = '{ "a" :1,\n\n"b":  [1,2] }';
    expect(await transformJson(source, 'json', VIEW)).toEqual({ text: source, hasComments: false });
  });
  it('beautifies with 2 spaces, 4 spaces, or tabs', async () => {
    const source = '{"a":{"b":1}}';
    const two = await transformJson(source, 'json', view({ layout: 'beautify', indent: 2 }));
    const four = await transformJson(source, 'json', view({ layout: 'beautify', indent: 4 }));
    const tab = await transformJson(source, 'json', view({ layout: 'beautify', indent: 'tab' }));
    expect(two.text).toBe('{\n  "a": {\n    "b": 1\n  }\n}');
    expect(four.text).toBe('{\n    "a": {\n        "b": 1\n    }\n}');
    expect(tab.text).toBe('{\n\t"a": {\n\t\t"b": 1\n\t}\n}');
  });
  it('beautify keeps comments and reports them', async () => {
    const result = await transformJson('{"a":1, // note\n"b":2}', 'jsonc', view({ layout: 'beautify' }));
    expect(result.text).toContain('// note');
    expect(result.hasComments).toBe(true);
  });
  it('minifies formatted JSON', async () => {
    const source = '{\n  "a": 1,\n  "b": [\n    1,\n    2\n  ]\n}\n';
    expect((await transformJson(source, 'json', view({ layout: 'minify' }))).text).toBe('{"a":1,"b":[1,2]}');
  });
  it('minifies JSONC and drops line and block comments, keeping trailing commas', async () => {
    const source = '{\n  /* block */ "a": 1, // line\n  "b": [1, 2,],\n}';
    const result = await transformJson(source, 'jsonc', view({ layout: 'minify' }));
    expect(result).toEqual({ text: '{"a":1,"b":[1,2,],}', hasComments: false });
  });
  it('keeps number text, escapes, and duplicate keys byte-exact through layouts', async () => {
    const source = '{"n":12345678901234567890,"e":1.0e+2,"z":-0,"s":"\\u00e9é","a":1,"a":2}';
    for (const layout of ['beautify', 'minify'] as const) {
      const { text } = await transformJson(source, 'json', view({ layout }));
      for (const piece of ['12345678901234567890', '1.0e+2', '-0', '"\\u00e9é"']) expect(text).toContain(piece);
      expect(text.match(/"a"/g)).toHaveLength(2);
    }
  });
});

describe('transformJson strip and sort', () => {
  it('strips comments and trailing commas', async () => {
    const source = '{\n  /* block */ "a": 1, // line\n  "b": [1, 2,],\n}';
    const result = await transformJson(source, 'jsonc', view({ stripComments: true }));
    expect(result.hasComments).toBe(false);
    expect(result.text).not.toMatch(/\/\/|\/\*/);
    expect(result.text).toContain('[1, 2]');
    expect(result.text).not.toMatch(/,\s*[}\]]/);
    expect(JSON.parse(result.text)).toEqual({ a: 1, b: [1, 2] });
  });
  it('reports comments only while they remain in the output', async () => {
    const source = '{"a":1 /* c */}';
    expect((await transformJson(source, 'jsonc', VIEW)).hasComments).toBe(true);
    expect((await transformJson(source, 'jsonc', view({ stripComments: true }))).hasComments).toBe(false);
    expect((await transformJson(source, 'jsonc', view({ layout: 'minify' }))).hasComments).toBe(false);
    expect((await transformJson('{"a":"// not a comment"}', 'jsonc', VIEW)).hasComments).toBe(false);
  });
  it('sorts keys recursively through objects and arrays by code unit', async () => {
    const source = '{"b":1,"B":2,"a":[{"y":1,"x":2}],"é":3,"c":{"z":1,"a":2}}';
    const { text } = await transformJson(source, 'json', view({ sortKeys: true, layout: 'minify' }));
    expect(text).toBe('{"B":2,"a":[{"x":2,"y":1}],"b":1,"c":{"a":2,"z":1},"é":3}');
  });
  it('keeps duplicate keys in their relative order', async () => {
    const { text } = await transformJson('{"b":0,"a":1,"b":9,"a":2}', 'json', view({ sortKeys: true, layout: 'minify' }));
    expect(text).toBe('{"a":1,"a":2,"b":0,"b":9}');
  });
  it('sort implies strip, so the output has no comments', async () => {
    const source = '{\n  // lead\n  "b": 1, /* mid */ "a": 2,\n}';
    const result = await transformJson(source, 'jsonc', view({ sortKeys: true, stripComments: false, layout: 'minify' }));
    expect(result).toEqual({ text: '{"a":2,"b":1}', hasComments: false });
    const original = await transformJson(source, 'jsonc', view({ sortKeys: true }));
    expect(original).toEqual({ text: '{\n  "a": 2,\n  "b": 1\n}', hasComments: false });
    expect(await transformJson(source, 'jsonc', view({ sortKeys: true, indent: 4 }))).toEqual({
      text: '{\n    "a": 2,\n    "b": 1\n}',
      hasComments: false,
    });
  });
  it('strip drops the trivia before a removed comment', async () => {
    const source = '{\n  /* block */ "a": 1, // line\n';
    const result = await transformJson(source, 'jsonc', view({ stripComments: true }));
    expect(result).toEqual({ text: '{\n "a": 1,\n', hasComments: false });
  });
  it('keeps number text, escapes, and duplicate keys byte-exact through sort and strip', async () => {
    const source = '{"z":12345678901234567890,"e":1.0e+2,"n":-0,"s":"\\u00e9é","a":1,"a":2}';
    for (const opts of [{ sortKeys: true }, { stripComments: true }]) {
      const { text } = await transformJson(source, 'json', view({ ...opts, layout: 'minify' }));
      for (const piece of ['12345678901234567890', '1.0e+2', '-0', '"\\u00e9é"']) expect(text).toContain(piece);
      expect(text.match(/"a"/g)).toHaveLength(2);
    }
  });
});

describe('transformJson escape and unescapeJson', () => {
  it('escapes the final text as one JSON string', async () => {
    const result = await transformJson('{"a":"x"}', 'json', view({ escape: true }));
    expect(result.text).toBe('"{\\"a\\":\\"x\\"}"');
    expect(result.hasComments).toBe(false);
  });
  it('applies strip, sort, layout, then escape in that order', async () => {
    const source = '{\n  "b": 1, // c\n  "a": 12345678901234567890,\n}';
    const { text } = await transformJson(source, 'jsonc', view({ sortKeys: true, layout: 'minify', escape: true }));
    expect(text).toBe(JSON.stringify('{"a":12345678901234567890,"b":1}'));
  });
  it('runs layout before escape, so beautify newlines are escaped', async () => {
    const { text } = await transformJson('{"a":1}', 'json', view({ layout: 'beautify', escape: true }));
    expect(text).toBe(JSON.stringify('{\n  "a": 1\n}'));
    expect(text).toContain('\\n');
  });
  it('runs layout after sort, so sorted output is indented', async () => {
    const { text } = await transformJson('{"b":1,"a":2}', 'json', view({ sortKeys: true, layout: 'beautify' }));
    expect(text).toBe('{\n  "a": 2,\n  "b": 1\n}');
  });
  it('normalizes CRLF and CR to LF in every view', async () => {
    const source = '{\r\n  "b": 1,\r\n  "a": 2\r\n}';
    for (const opts of [
      {},
      { layout: 'beautify' },
      { layout: 'minify' },
      { sortKeys: true },
      { sortKeys: true, layout: 'beautify' },
    ] as const) {
      expect((await transformJson(source, 'json', view(opts))).text).not.toContain('\r');
    }
    expect((await transformJson(source, 'json', view({ layout: 'beautify' }))).text).toBe('{\n  "b": 1,\n  "a": 2\n}');
    expect((await transformJson('{\r"a":1}', 'json', view({ layout: 'beautify' }))).text).toBe('{\n  "a": 1\n}');
  });
  it('round trips escape then unescape byte-exact', async () => {
    const source = '{"n":1.0e+2,"z":-0,"s":"\\u00e9é","a":1,"a":2}';
    const escaped = await transformJson(source, 'json', view({ escape: true }));
    expect(await unescapeJson(escaped.text, 'json')).toEqual({ text: source, parses: true });
  });
  it('returns null unless the root is a string without parse errors', async () => {
    expect(await unescapeJson('{"a":1}', 'json')).toBeNull();
    expect(await unescapeJson('[1]', 'json')).toBeNull();
    expect(await unescapeJson('42', 'json')).toBeNull();
    expect(await unescapeJson('"abc', 'json')).toBeNull();
    expect(await unescapeJson('"a" "b"', 'json')).toBeNull();
    expect(await unescapeJson('', 'json')).toBeNull();
  });
  it('reports whether the decoded string parses as strict JSON', async () => {
    expect(await unescapeJson('"not json"', 'json')).toEqual({ text: 'not json', parses: false });
    expect(await unescapeJson('"{\\"a\\":1,}"', 'json')).toEqual({ text: '{"a":1,}', parses: false });
    expect(await unescapeJson('"[1,2]"', 'json')).toEqual({ text: '[1,2]', parses: true });
  });
  it('strips a BOM before deciding whether the decoded text parses', async () => {
    expect(await unescapeJson('"\\ufeff[1]"', 'json')).toEqual({ text: '\uFEFF[1]', parses: true });
    expect(await unescapeJson('""', 'json')).toEqual({ text: '', parses: false });
  });
  it('agrees with prepareJson on non-breaking space, which the jsonc-parser scanner rejects', async () => {
    const decoded = '[1,\u00A02]';
    expect(await unescapeJson('"[1,\\u00a02]"', 'json')).toEqual({ text: decoded, parses: false });
    expect((await prepareJson(decoded, 'json')).error).not.toBeNull();
  });
  it('allows comments around a string root for jsonc only', async () => {
    expect(await unescapeJson('/* c */ "x"', 'jsonc')).toEqual({ text: 'x', parses: false });
    expect(await unescapeJson('/* c */ "x"', 'json')).toBeNull();
  });
});
