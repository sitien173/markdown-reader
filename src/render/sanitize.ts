import createDOMPurify from 'dompurify';
import { resolveLink } from './links';
import { USER_CONTENT_PREFIX } from './user-content';

const allowedTags = [
  'a', 'abbr', 'b', 'blockquote', 'br', 'caption', 'code', 'del', 'div', 'em', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'hr', 'i', 'img', 'li', 'ol', 'p', 'pre', 's', 'span', 'strong', 'table', 'tbody', 'td', 'tfoot', 'th', 'thead', 'tr', 'ul',
  'details', 'summary', 'kbd', 'mark', 'sub', 'sup', 'dl', 'dt', 'dd', 'input', 'svg', 'path',
  'math', 'semantics', 'annotation', 'mrow', 'mi', 'mo', 'mn', 'msup', 'mfrac', 'msqrt', 'mroot',
  'mtext', 'mspace', 'mstyle', 'merror', 'mpadded', 'mphantom', 'mfenced', 'menclose', 'mtable',
  'mtr', 'mtd', 'maction', 'munderover', 'munder', 'mover', 'mmultiscripts', 'mprescripts', 'none',
];
const extraAttributes = [
  'class', 'id', 'title', 'type', 'disabled', 'checked', 'data-md-link', 'aria-hidden', 'aria-label',
  'role', 'style', 'encoding', 'xmlns', 'viewBox', 'd', 'fill', 'stroke', 'focusable', 'height', 'width',
  'mathvariant', 'display', 'displaystyle', 'scriptlevel', 'stretchy', 'fence', 'separator', 'accent',
  'columnalign', 'rowalign', 'columnspacing', 'rowspacing', 'linethickness', 'notation', 'open', 'target', 'rel',
];
let activeBaseUrl = '';
const purify = createDOMPurify(window);

function normalizeSafeUrl(value: string, name: string, tag: string): string | null {
  const normalized = value.replace(/[\u0000-\u0020\u007f-\u009f]/g, '');
  const scheme = normalized.match(/^([a-z][a-z0-9+.-]*):/i)?.[1]?.toLowerCase();
  if (scheme === 'javascript' || scheme === 'vbscript' || scheme === 'blob') return null;
  if (scheme === 'data' && !(name === 'src' && tag === 'img' && /^data:image\/(?:png|jpeg|gif|webp|bmp|avif);/i.test(normalized))) return null;
  return normalized;
}

const katexStyleProperties = /^(?:height|width|min-width|vertical-align|margin(?:-(?:top|right|bottom|left))?|padding(?:-(?:top|right|bottom|left))?|border-(?:top|right|bottom|left)-width|color|font-size)$/;
const cssLength = /^(?:0|0px|-?(?:[0-4](?:\.\d+)?|5(?:\.0+)?)em)$/;
const cssColor = /^(?:#[0-9a-f]{3,8}|rgba?\([\d.,\s%]+\)|hsla?\([\d.,\s%deg]+\)|[a-z]+)$/i;
const constrainedStyleProperties: [RegExp, RegExp][] = [
  [/^position$/, /^relative$/],
  [/^(?:bottom|left|top)$/, cssLength],
  [/^(?:background-color|border-(?:top|right|bottom|left)-color)$/, cssColor],
  [/^border-(?:top|right|bottom|left)-style$/, /^(?:solid|dashed|dotted|none)$/],
];

function allowedDeclaration(property: string, value: string): boolean {
  if (katexStyleProperties.test(property)) return true;
  return constrainedStyleProperties.some(([name, allowed]) => name.test(property) && allowed.test(value));
}

function filterStyle(value: string): string {
  if (/[\\]/.test(value) || /url\s*\(|image-set\s*\(|expression\s*\(|@import/i.test(value)) return '';
  const style = document.createElement('span').style;
  style.cssText = value;
  const declarations: string[] = [];
  for (let i = 0; i < style.length; i++) {
    const property = style.item(i).toLowerCase();
    const declaration = style.getPropertyValue(property).trim();
    if (!allowedDeclaration(property, declaration) || /url\s*\(|image-set\s*\(|expression\s*\(|@import/i.test(declaration)) continue;
    declarations.push(`${property}: ${declaration}`);
  }
  return declarations.join('; ');
}

purify.addHook('uponSanitizeAttribute', (node, data) => {
  const name = data.attrName.toLowerCase();
  const tag = node.nodeName.toLowerCase();
  if (name.startsWith('on')) { data.keepAttr = false; return; }
  if (tag === 'input' && !['type', 'checked', 'disabled', 'class'].includes(name)) { data.keepAttr = false; return; }
  if (tag === 'input' && name === 'type') {
    if (data.attrValue.toLowerCase() === 'checkbox') data.attrValue = 'checkbox';
    else data.keepAttr = false;
    return;
  }
  if (name === 'style') {
    const filtered = filterStyle(data.attrValue);
    if (!filtered) data.keepAttr = false;
    else data.attrValue = filtered;
    return;
  }
  if (name === 'href' && data.attrValue.startsWith('#') && data.attrValue.length > 1) {
    data.attrValue = `#${USER_CONTENT_PREFIX}${data.attrValue.slice(1)}`;
    return;
  }
  if (!['href', 'src', 'action', 'formaction', 'xlink:href'].includes(name)) return;
  const safe = normalizeSafeUrl(data.attrValue, name, tag);
  if (safe === null) data.keepAttr = false;
  else data.attrValue = safe;
});

purify.addHook('uponSanitizeElement', (node) => {
  const element = node as Element;
  if (element.localName === 'input' && element.getAttribute('type')?.toLowerCase() !== 'checkbox') element.remove();
});

purify.addHook('afterSanitizeAttributes', (node) => {
  resolveLink(node as Element, activeBaseUrl);
});

export function sanitize(html: string, baseUrl = ''): string {
  activeBaseUrl = baseUrl;
  try {
    const clean = purify.sanitize(html, {
      ALLOWED_TAGS: allowedTags,
      ADD_ATTR: extraAttributes,
      ALLOW_DATA_ATTR: true,
      ALLOW_ARIA_ATTR: true,
      FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'style'],
      FORBID_ATTR: ['srcdoc'],
      SANITIZE_NAMED_PROPS: true,
    });
    return clean;
  } finally {
    activeBaseUrl = '';
  }
}
