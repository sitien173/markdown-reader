import type { Source } from './types';
import { watchFileHandle, type WatchEvents } from './watch';

export class SaveConflictError extends Error {
  constructor() { super('File changed on disk'); this.name = 'SaveConflictError'; }
}

type PickerWindow = Window & { showOpenFilePicker?: (options?: unknown) => Promise<FileSystemFileHandle[]> };

export class FileHandleSource implements Source {
  readonly baseUrl = '';
  private handle: FileSystemFileHandle | undefined;
  constructor(handle?: FileSystemFileHandle) { this.handle = handle; }
  async pick(): Promise<void> {
    const picker = (window as PickerWindow).showOpenFilePicker;
    if (!picker) throw new Error('File picker is not available');
    const [handle] = await picker({ types: [{ description: 'Markdown files', accept: { 'text/markdown': ['.md', '.markdown'] } }] });
    if (!handle) throw new Error('No file selected');
    this.handle = handle;
  }
  async read(): Promise<string> {
    if (!this.handle) await this.pick();
    return (await this.handle!.getFile()).text();
  }
  // Draft identity for a picked or dropped file. Stable across reopen only by file name.
  get identity(): string { return `local:${this.handle?.name ?? 'picker'}`; }
  async diskStamp(): Promise<number | null> {
    if (!this.handle) return null;
    try { return (await this.handle.getFile()).lastModified; } catch { return null; }
  }
  // Writes only when the file still has the expected lastModified. Pass no expected stamp to overwrite.
  async write(text: string, expectedStamp?: number): Promise<number> {
    if (!this.handle) throw new Error('No file handle to save to');
    if (expectedStamp !== undefined && (await this.handle.getFile()).lastModified !== expectedStamp) throw new SaveConflictError();
    const writable = await this.handle.createWritable();
    try { await writable.write(text); } finally { await writable.close(); }
    return (await this.handle.getFile()).lastModified;
  }
  watch(events: WatchEvents): () => void {
    if (!this.handle) return () => {};
    return watchFileHandle(this.handle, events);
  }
  static async fromDrop(item: DataTransferItem): Promise<File | null> {
    const getHandle = (item as DataTransferItem & { getAsFileSystemHandle?: () => Promise<FileSystemHandle | null> }).getAsFileSystemHandle;
    if (getHandle) { const handle = await getHandle.call(item); if (handle?.kind === 'file') return await (handle as FileSystemFileHandle).getFile(); }
    return item.getAsFile();
  }
}


export function isValidMarkdownFile(filename: string): boolean {
  return /\.(?:md|markdown)$/i.test(filename);
}

export function dropFileIdentity(file: { name: string; size: number; lastModified: number }): string {
  return `local:drop:${file.name}:${file.size}:${file.lastModified}`;
}
