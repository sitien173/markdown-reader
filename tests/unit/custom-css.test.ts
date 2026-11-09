import { describe, expect, it } from 'vitest';
import { applyCustomCss, validateCustomCss } from '../../src/lib/custom-css';

const rejected = [
  ['url(', 'a { background: url(x.png) }'],
  ['url with a space', 'a { background: url (x.png) }'],
  ['uppercase URL', 'a { background: URL(x.png) }'],
  ['url with a newline', 'a { background: url\n(x.png) }'],
  ['escaped url', 'a { background: u\\72l(x.png) }'],
  ['backslash escape u\\rl(', 'a { background: u\\rl(x.png) }'],
  ['hex escape \\0075rl(', 'a { background: \\0075rl(x.png) }'],
  ['image-set(', 'a { background: image-set("x.png" 1x) }'],
  ['spaced image-set', 'a { background: image-set ("x.png" 1x) }'],
  ['image\\-set(', 'a { background: image\\-set("x.png" 1x) }'],
  ['vendor image-set', 'a { background: -webkit-image-set("x.png" 1x) }'],
  ['@import', '@import "x.css";'],
  ['uppercase @IMPORT', '@IMPORT "x.css";'],
  ['@ import spacing', '@import\n"x.css";'],
  ['backslash in a selector', '.a\\:b { color: red }'],
] as const;

describe('validateCustomCss', () => {
  for (const [name, css] of rejected) {
    it(`rejects ${name} with a message`, () => {
      const result = validateCustomCss(css);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.message.length).toBeGreaterThan(0);
    });
  }

  it('accepts plain rules', () => {
    expect(validateCustomCss('.md-content { color: #123; }\na:hover { text-decoration: none }')).toEqual({ ok: true });
    expect(validateCustomCss('')).toEqual({ ok: true });
  });
});

describe('applyCustomCss', () => {
  it('replaces one adopted sheet on every apply and keeps the previous sheet on rejection', () => {
    expect(applyCustomCss(document, 'p { color: red }')).toEqual({ ok: true });
    expect(document.adoptedStyleSheets).toHaveLength(1);
    const sheet = document.adoptedStyleSheets[0];
    expect(sheet?.cssRules).toHaveLength(1);

    expect(applyCustomCss(document, 'p { color: blue } b { color: red }')).toEqual({ ok: true });
    expect(document.adoptedStyleSheets).toHaveLength(1);
    expect(document.adoptedStyleSheets[0]?.cssRules).toHaveLength(2);

    const kept = document.adoptedStyleSheets[0];
    const result = applyCustomCss(document, 'p { background: url(x.png) }');
    expect(result.ok).toBe(false);
    expect(document.adoptedStyleSheets).toEqual([kept]);
    expect(kept?.cssRules).toHaveLength(2);
  });

  it('removes the sheet for empty CSS and adds no style element', () => {
    applyCustomCss(document, 'p { color: red }');
    applyCustomCss(document, '');
    expect(document.adoptedStyleSheets).toHaveLength(0);
    expect(document.querySelectorAll('style')).toHaveLength(0);
  });
});
