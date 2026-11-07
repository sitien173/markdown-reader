import type { Source } from './types';
import { watchDirectory, type DirectoryWatchEvents } from './watch';
import { SaveConflictError } from './file-handle';

export type FileNode = {
  kind: 'file';
  name: string;
  path: string;
  handle: FileSystemFileHandle;
};

export type DirectoryNode = {
  kind: 'directory';
  name: string;
  path: string;
  handle: FileSystemDirectoryHandle;
  children: TreeNode[];
};

export type TreeNode = FileNode | DirectoryNode;

export type { DirectoryWatchEvents };

export function resolveRelativePath(baseDocPath: string, relativePath: string): { path: string; isOutside: boolean } {
  const clean = relativePath.split(/[?#]/)[0] ?? '';
  if (!clean) return { path: baseDocPath, isOutside: false };

  if (/^[a-z][a-z0-9+.-]*:/i.test(clean)) {
    return { path: clean, isOutside: true };
  }

  const isFromRoot = clean.startsWith('/');
  const baseDir = isFromRoot ? [] : baseDocPath.includes('/') ? baseDocPath.split('/').slice(0, -1) : [];
  const segments = [...baseDir];
  const parts = clean.split('/').filter((p) => p !== '' && p !== '.');

  let isOutside = false;
  for (const part of parts) {
    if (part === '..') {
      if (segments.length === 0) {
        isOutside = true;
      } else {
        segments.pop();
      }
    } else {
      segments.push(part);
    }
  }

  return {
    path: segments.join('/'),
    isOutside,
  };
}

export async function buildTree(dirHandle: FileSystemDirectoryHandle, parentPath = ''): Promise<TreeNode[]> {
  const nodes: TreeNode[] = [];
  for await (const entry of (dirHandle as any).values()) {
    const entryPath = parentPath ? `${parentPath}/${entry.name}` : entry.name;
    if (entry.kind === 'file') {
      if (/\.(?:md|markdown)$/i.test(entry.name)) {
        nodes.push({
          kind: 'file',
          name: entry.name,
          path: entryPath,
          handle: entry as FileSystemFileHandle,
        });
      }
    } else if (entry.kind === 'directory') {
      const children = await buildTree(entry as FileSystemDirectoryHandle, entryPath);
      if (children.length > 0) {
        nodes.push({
          kind: 'directory',
          name: entry.name,
          path: entryPath,
          handle: entry as FileSystemDirectoryHandle,
          children,
        });
      }
    }
  }

  nodes.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'directory' ? -1 : 1;
    const cmp = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    if (cmp !== 0) return cmp;
    return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
  });

  return nodes;
}

export class DirectorySource implements Source {
  readonly baseUrl: string = '';
  readonly root: FileSystemDirectoryHandle;
  currentPath: string | null = null;
  private objectUrls = new Set<string>();

  constructor(root: FileSystemDirectoryHandle, initialPath?: string) {
    this.root = root;
    this.currentPath = initialPath ?? null;
  }

  get identity(): string {
    return `folder:${this.root.name}:${this.currentPath ?? ''}`;
  }

  async getTree(): Promise<TreeNode[]> {
    return buildTree(this.root);
  }

  async getFileHandle(relativePath: string): Promise<FileSystemFileHandle | null> {
    const { path, isOutside } = resolveRelativePath('', relativePath);
    if (isOutside || !path) return null;
    const segments = path.split('/').filter(Boolean);
    if (segments.length === 0) return null;

    let currentDir = this.root;
    for (let i = 0; i < segments.length - 1; i++) {
      try {
        currentDir = await currentDir.getDirectoryHandle(segments[i]!);
      } catch {
        return null;
      }
    }
    try {
      return await currentDir.getFileHandle(segments[segments.length - 1]!);
    } catch {
      return null;
    }
  }

  private readToken = 0;

  async read(relativePath?: string): Promise<string> {
    const target = relativePath ?? this.currentPath;
    if (!target) throw new Error('No file selected to read');
    const token = ++this.readToken;
    const handle = await this.getFileHandle(target);
    if (!handle) throw new Error(`File not found: ${target}`);
    const file = await handle.getFile();
    const text = await file.text();
    if (token === this.readToken) {
      this.currentPath = target;
    }
    return text;
  }

  async diskStamp(relativePath?: string): Promise<number | null> {
    const target = relativePath ?? this.currentPath;
    if (!target) return null;
    const handle = await this.getFileHandle(target);
    if (!handle) return null;
    try {
      return (await handle.getFile()).lastModified;
    } catch {
      return null;
    }
  }

  async write(text: string, expectedStamp?: number, relativePath?: string): Promise<number> {
    const target = relativePath ?? this.currentPath;
    if (!target) throw new Error('No file selected to save');
    const handle = await this.getFileHandle(target);
    if (!handle) throw new Error(`File not found: ${target}`);
    if (expectedStamp !== undefined && (await handle.getFile()).lastModified !== expectedStamp) {
      throw new SaveConflictError();
    }
    const writable = await handle.createWritable();
    try {
      await writable.write(text);
    } finally {
      await writable.close();
    }
    return (await handle.getFile()).lastModified;
  }

  watch(events: DirectoryWatchEvents): () => void {
    return watchDirectory(this.root, () => this.currentPath, events);
  }

  revokeObjectUrls(): void {
    for (const url of this.objectUrls) {
      URL.revokeObjectURL(url);
    }
    this.objectUrls.clear();
  }

  revokeUrl(url: string): void {
    if (this.objectUrls.has(url)) {
      URL.revokeObjectURL(url);
      this.objectUrls.delete(url);
    }
  }

  async resolveImage(src: string, fromPath?: string, fallbackBaseUrl?: string): Promise<{ src: string; disabled?: boolean }> {
    if (/^(?:https?:|data:|blob:)/i.test(src)) {
      return { src };
    }
    const docPath = fromPath ?? this.currentPath ?? '';
    const { path, isOutside } = resolveRelativePath(docPath, src);

    if (isOutside) {
      if (fallbackBaseUrl) {
        try {
          return { src: new URL(src, fallbackBaseUrl).href };
        } catch {
          return { src: '', disabled: true };
        }
      }
      return { src: '', disabled: true };
    }

    const handle = await this.getFileHandle(path);
    if (!handle) {
      if (fallbackBaseUrl) {
        try {
          return { src: new URL(src, fallbackBaseUrl).href };
        } catch {
          return { src: '', disabled: true };
        }
      }
      return { src: '', disabled: true };
    }

    try {
      const file = await handle.getFile();
      const objectUrl = URL.createObjectURL(file);
      this.objectUrls.add(objectUrl);
      return { src: objectUrl };
    } catch {
      return { src: '', disabled: true };
    }
  }

  resolveLink(
    href: string,
    fromPath?: string,
    fallbackBaseUrl?: string,
  ): {
    href: string;
    isMd: boolean;
    target?: string;
    disabled?: boolean;
    folderPath?: string;
  } {
    if (href.startsWith('#')) {
      return { href, isMd: false };
    }
    if (/^[a-z][a-z0-9+.-]*:/i.test(href)) {
      const isMd = /\.(?:md|markdown)$/i.test(href);
      return { href, isMd, target: '_blank' };
    }

    const docPath = fromPath ?? this.currentPath ?? '';
    const { path, isOutside } = resolveRelativePath(docPath, href);

    if (isOutside) {
      if (fallbackBaseUrl) {
        try {
          const resolved = new URL(href, fallbackBaseUrl).href;
          const isMd = /\.(?:md|markdown)$/i.test(new URL(resolved).pathname);
          return { href: resolved, isMd };
        } catch {
          return { href: '', isMd: false, disabled: true };
        }
      }
      return { href: '', isMd: false, disabled: true };
    }

    const isMd = /\.(?:md|markdown)$/i.test(path);
    return {
      href: path,
      isMd,
      folderPath: path,
    };
  }
}
