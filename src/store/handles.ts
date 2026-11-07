import { parseStoredHandle } from '../lib/schemas';
import { get, set, del, entries, createStore, type UseStore } from 'idb-keyval';

export type StoredHandleType = 'file' | 'folder';

export interface StoredHandleRecord {
  id: string;
  name: string;
  type: StoredHandleType;
  handle: FileSystemHandle;
  lastOpened: number;
}

export interface RecentHandleEntry {
  id: string;
  name: string;
  type: StoredHandleType;
  handle: FileSystemHandle;
  permission: PermissionState;
  requiresReconnect: boolean;
}

const memStore = new Map<string, StoredHandleRecord>();

function getStore(): UseStore | undefined {
  customStore ??= getDbStore();
  return customStore;
}

function getDbStore(): UseStore | undefined {
  if (typeof indexedDB === 'undefined') return undefined;
  try {
    return createStore('markdown-reader-db', 'handles');
  } catch {
    return undefined;
  }
}

let customStore: UseStore | undefined;

export async function storeHandle(name: string, type: StoredHandleType, handle: FileSystemHandle): Promise<void> {
  const id = `${type}:${name}`;
  const record: StoredHandleRecord = {
    id,
    name,
    type,
    handle,
    lastOpened: Date.now(),
  };

  const store = getStore();
  if (store) {
    try {
      await set(id, record, store);
      return;
    } catch {
      // fallback to memory
    }
  }
  memStore.set(id, record);
}

export async function removeStoredHandle(id: string): Promise<void> {
  const store = getStore();
  if (store) {
    try {
      await del(id, store);
    } catch {
      // fallback
    }
  }
  memStore.delete(id);
}

export async function getRecentHandles(): Promise<RecentHandleEntry[]> {
  const records: StoredHandleRecord[] = [];
  const store = getStore();
  if (store) {
    try {
      const all = await entries<string, unknown>(store);
      for (const [, val] of all) {
        const record = parseStoredHandle(val);
        if (record) records.push(record);
      }
    } catch {
      // fallback
    }
  }
  if (records.length === 0) {
    for (const val of memStore.values()) {
      records.push(val);
    }
  }

  records.sort((a, b) => b.lastOpened - a.lastOpened);

  const results: RecentHandleEntry[] = [];
  for (const rec of records.slice(0, 20)) {
    let perm: PermissionState = 'prompt';
    try {
      if (typeof (rec.handle as any).queryPermission === 'function') {
        perm = await (rec.handle as any).queryPermission({ mode: 'read' });
      } else {
        perm = 'granted';
      }
    } catch {
      perm = 'prompt';
    }

    results.push({
      id: rec.id,
      name: rec.name,
      type: rec.type,
      handle: rec.handle,
      permission: perm,
      requiresReconnect: perm === 'prompt' || perm === 'denied',
    });
  }

  return results;
}

export async function requestHandlePermission(handle: FileSystemHandle): Promise<PermissionState> {
  if (typeof (handle as any).requestPermission === 'function') {
    return await (handle as any).requestPermission({ mode: 'read' });
  }
  return 'granted';
}
