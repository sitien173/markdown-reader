export type DocKind = 'markdown' | 'json' | 'jsonc';

export function docKindFromName(name: string): DocKind {
  let path = name;
  try {
    path = new URL(name).pathname;
  } catch {
    // not a URL: treat it as a file name
  }
  if (/\.jsonc$/i.test(path)) return 'jsonc';
  return /\.json$/i.test(path) ? 'json' : 'markdown';
}

export function isJsonName(name: string): boolean {
  return docKindFromName(name) !== 'markdown';
}
