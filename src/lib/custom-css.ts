export type CustomCssResult = { ok: true } | { ok: false; message: string };

// Each pattern allows whitespace before the parenthesis. A backslash is rejected outright, which also covers every escaped spelling of the others.
const FORBIDDEN: [RegExp, string][] = [
  [/\\/, 'Custom CSS cannot contain a backslash.'],
  [/url\s*\(/i, 'Custom CSS cannot use url().'],
  [/image-set\s*\(/i, 'Custom CSS cannot use image-set().'],
  [/@import/i, 'Custom CSS cannot use @import.'],
];

export function validateCustomCss(css: string): CustomCssResult {
  for (const [pattern, message] of FORBIDDEN) if (pattern.test(css)) return { ok: false, message };
  return { ok: true };
}

let sheet: CSSStyleSheet | undefined;

/** Adopts the stylesheet on the document. One sheet is replaced on each apply; a rejected stylesheet leaves the previous one in place. */
export function applyCustomCss(doc: Document, css: string): CustomCssResult {
  const result = validateCustomCss(css);
  if (!result.ok) return result;
  if (!css.trim() && !sheet) return result;
  const others = doc.adoptedStyleSheets.filter((adopted) => adopted !== sheet);
  if (!css.trim()) {
    sheet = undefined;
    doc.adoptedStyleSheets = others;
    return result;
  }
  sheet ??= new CSSStyleSheet();
  sheet.replaceSync(css);
  doc.adoptedStyleSheets = [...others, sheet];
  return result;
}
