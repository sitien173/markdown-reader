import { compareTreeNodes, type TreeNode } from './directory';
import { createHidingRule, type GitignoreLevel } from './hidden';

export interface FileUrlEntry {
  name: string;
  url: string;
  isDir: boolean;
}

export function normalizeDirUrl(dirUrl: string): string {
  return dirUrl.endsWith('/') ? dirUrl : `${dirUrl}/`;
}

/**
 * Returns the parent directory URL, or null at filesystem roots
 * (file:///, file:///C:/, and the UNC share level file://server/share/).
 */
export function getParentUrl(dirUrl: string): string | null {
  const url = new URL(dirUrl);

  if (url.host === '') {
    const pathname = url.pathname;
    if (pathname === '/' || pathname === '') {
      return null;
    }
    if (/^\/[a-zA-Z]:\/?$/.test(pathname)) {
      return null;
    }
  } else {
    // UNC paths, e.g. file://server/share/
    const segments = url.pathname.split('/').filter(Boolean);
    if (segments.length <= 1) {
      return null;
    }
  }

  const base = normalizeDirUrl(url.href);
  return new URL('..', base).href;
}

/**
 * Lists the directory at dirUrl by parsing Chrome's directory listing HTML.
 * Never rejects on response.ok === false; fetch rejection propagates.
 */
export async function listDirectory(dirUrl: string): Promise<FileUrlEntry[]> {
  const base = normalizeDirUrl(dirUrl);
  const res = await fetch(dirUrl);
  const text = await res.text();

  const entries: FileUrlEntry[] = [];
  const rowRegex = /<script>addRow\(([\s\S]*?)\);<\/script>/g;
  for (const match of text.matchAll(rowRegex)) {
    const argsStr = match[1];
    let parsed: unknown[];
    try {
      parsed = JSON.parse(`[${argsStr}]`);
    } catch {
      continue;
    }

    const name = String(parsed[0]);
    const raw = String(parsed[1]);
    const isDir = Boolean(parsed[2]);

    if (name === '..' || raw === '..') {
      continue;
    }

    const childUrl = new URL(`./${raw}${isDir ? '/' : ''}`, base).href;
    entries.push({
      name,
      url: childUrl,
      isDir,
    });
  }

  return entries;
}

/**
 * Fetches .gitignore in the given folder URL. Returns empty string when absent.
 */
export async function fetchGitignore(folderUrl: string): Promise<string> {
  const base = normalizeDirUrl(folderUrl);
  const url = new URL('./.gitignore', base).href;
  try {
    const res = await fetch(url);
    // Chrome file:// fetches return status 0 (and response.ok false) on success.
    if (!res.ok && res.status !== 0) return '';
    const text = await res.text();
    // Directory listings in Chrome contain addRow script calls; ignore if .gitignore is a folder.
    if (text.includes('<script>addRow(')) return '';
    return text;
  } catch {
    return '';
  }
}

/**
 * Climbs parent directory listings until an entry named .git is found.
 * Returns that repo folder URL, or null at the filesystem root.
 */
export async function findRepoRoot(dirUrl: string, initialEntries?: FileUrlEntry[]): Promise<string | null> {
  let current: string | null = normalizeDirUrl(dirUrl);
  let entriesToCheck = initialEntries;

  while (current) {
    try {
      const entries = entriesToCheck ?? (await listDirectory(current));
      entriesToCheck = undefined;
      const hasGit = entries.some((e) => e.name === '.git');
      if (hasGit) {
        return current;
      }
    } catch {
      // Fetch error or unreadable directory; climb up
    }
    current = getParentUrl(current);
  }

  return null;
}

export function getRelPath(targetUrl: string, baseUrl: string): string {
  const base = normalizeDirUrl(baseUrl);
  const normTarget = normalizeDirUrl(targetUrl);
  if (normTarget === base) {
    return '';
  }
  if (targetUrl.startsWith(base)) {
    return decodeURIComponent(targetUrl.slice(base.length)).replace(/\/+$/, '');
  }
  throw new Error(`Target "${targetUrl}" is not under base "${baseUrl}"`);
}

export function prefixTreeNodes(nodes: TreeNode[], prefix: string): TreeNode[] {
  return nodes.map((node) => {
    const nextPath = `${prefix}/${node.path}`;
    if (node.kind === 'directory') {
      return {
        ...node,
        path: nextPath,
        children: node.children ? prefixTreeNodes(node.children, prefix) : null,
      };
    }
    return {
      ...node,
      path: nextPath,
    };
  });
}

export class GitignoreCache {
  private cache = new Map<string, string>();
  async get(folderUrl: string): Promise<string> {
    const norm = normalizeDirUrl(folderUrl);
    let text = this.cache.get(norm);
    if (text === undefined) {
      text = await fetchGitignore(norm);
      this.cache.set(norm, text);
    }
    return text;
  }
  clear(): void {
    this.cache.clear();
  }
}

async function fetchGitignoreChain(folderUrl: string, chainBaseUrl: string, cache: GitignoreCache): Promise<GitignoreLevel[]> {
  const normBase = normalizeDirUrl(chainBaseUrl);
  let current: string | null = normalizeDirUrl(folderUrl);
  const chain: GitignoreLevel[] = [];

  while (current) {
    if (!current.startsWith(normBase)) {
      break;
    }
    const dirPath = getRelPath(current, normBase);
    const gitignoreText = await cache.get(current);
    if (gitignoreText) {
      chain.push({ dirPath, gitignoreText });
    }
    if (current === normBase) {
      break;
    }
    current = getParentUrl(current);
  }

  return chain;
}

export async function buildFileTreeLevel(
  folderUrl: string,
  rootUrl: string,
  chainBaseUrl: string,
  cache: GitignoreCache,
  settings: { showHiddenItems: boolean; ignorePatterns: string },
  preloadedEntries?: FileUrlEntry[],
): Promise<TreeNode[]> {
  const normFolder = normalizeDirUrl(folderUrl);
  const rawEntries = preloadedEntries ?? (await listDirectory(normFolder));

  // Keep folders and .md/.markdown files
  let filtered = rawEntries.filter((e) => e.isDir || /\.(?:md|markdown)$/i.test(e.name));

  if (!settings.showHiddenItems) {
    const chain = await fetchGitignoreChain(normFolder, chainBaseUrl, cache);
    const isHidden = createHidingRule({
      showHiddenItems: false,
      ignorePatterns: settings.ignorePatterns,
      chain,
    });
    filtered = filtered.filter((e) => {
      const relPath = getRelPath(e.url, chainBaseUrl);
      return !isHidden(relPath, e.isDir);
    });
  }

  const nodes: TreeNode[] = filtered.map((entry) => {
    const path = getRelPath(entry.url, rootUrl);
    if (entry.isDir) {
      return {
        kind: 'directory',
        name: entry.name,
        path,
        children: null,
      };
    }
    return {
      kind: 'file',
      name: entry.name,
      path,
    };
  });

  nodes.sort(compareTreeNodes);

  return nodes;
}
