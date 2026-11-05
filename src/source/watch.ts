export type WatchEvents = { onChange: () => void; onDeleted: () => void };
export type PollOptions = WatchEvents & { stamp: () => Promise<string | number | null>; intervalMs: number };

// Polls a stamp and reports each move once. A null stamp means the file is missing. Returns an unsubscribe.
export function watchPolling({ stamp, onChange, onDeleted, intervalMs }: PollOptions): () => void {
  let last: string | number | null | undefined;
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const sample = () => stamp().catch(() => null);
  const tick = async () => {
    const next = await sample();
    if (stopped) return;
    if (next === null) { if (last !== null) onDeleted(); }
    else if (last !== undefined && last !== null && next !== last) onChange();
    last = next;
    if (!stopped) timer = setTimeout(tick, intervalMs);
  };
  void (async () => { last = await sample(); if (!stopped) timer = setTimeout(tick, intervalMs); })();
  return () => { stopped = true; clearTimeout(timer); };
}

type ObserverRecord = { type: string; relativePathComponents?: string[] };
type FileSystemObserverLike = {
  observe(target: FileSystemHandle, options?: { recursive?: boolean }): Promise<void>;
  disconnect(): void;
};
type FileSystemObserverConstructor = new (callback: (records: ObserverRecord[]) => void) => FileSystemObserverLike;

// Uses FileSystemObserver when the browser provides it, else polls lastModified every second.
export function watchFileHandle(handle: FileSystemFileHandle, events: WatchEvents): () => void {
  let stopped = false;
  let stopPolling: (() => void) | undefined;
  let observer: FileSystemObserverLike | undefined;
  const poll = () => {
    if (!stopped && !stopPolling) {
      stopPolling = watchPolling({
        stamp: async () => (await handle.getFile()).lastModified,
        onChange: events.onChange,
        onDeleted: events.onDeleted,
        intervalMs: 1000,
      });
    }
  };
  const Observer = (globalThis as { FileSystemObserver?: FileSystemObserverConstructor }).FileSystemObserver;
  if (typeof Observer === 'function') {
    observer = new Observer((records) => {
      if (records.some((record) => record.type === 'disappeared')) events.onDeleted();
      else if (records.some((record) => record.type === 'modified')) events.onChange();
    });
    observer.observe(handle).catch(() => { observer?.disconnect(); observer = undefined; poll(); });
  } else {
    poll();
  }
  return () => { stopped = true; observer?.disconnect(); stopPolling?.(); };
}

export type DirectoryWatchEvents = {
  onTreeChange?: () => void;
  onChange?: () => void;
  onDeleted?: () => void;
};

async function snapshotDirectory(dir: FileSystemDirectoryHandle, parent = ''): Promise<Map<string, number> | null> {
  const map = new Map<string, number>();
  try {
    for await (const entry of (dir as any).values()) {
      const p = parent ? `${parent}/${entry.name}` : entry.name;
      if (entry.kind === 'file') {
        try {
          const file = await (entry as FileSystemFileHandle).getFile();
          map.set(p, file.lastModified);
        } catch {
          // ignore transient read errors
        }
      } else if (entry.kind === 'directory') {
        const sub = await snapshotDirectory(entry as FileSystemDirectoryHandle, p);
        if (sub) {
          for (const [subPath, stamp] of sub) map.set(subPath, stamp);
        }
      }
    }
    return map;
  } catch {
    return null;
  }
}

export function watchDirectory(
  handle: FileSystemDirectoryHandle,
  activeFilePath: () => string | null,
  events: DirectoryWatchEvents,
  intervalMs = 1000
): () => void {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let observer: FileSystemObserverLike | undefined;
  let lastSnapshot: Map<string, number> | null = null;

  const compareSnapshots = (prev: Map<string, number>, next: Map<string, number>) => {
    let treeChanged = false;
    let activeChanged = false;
    const active = activeFilePath();

    if (prev.size !== next.size) {
      treeChanged = true;
    } else {
      for (const [path] of prev) {
        if (!next.has(path)) {
          treeChanged = true;
          break;
        }
      }
    }

    if (!treeChanged) {
      for (const [path, stamp] of next) {
        if (prev.get(path) !== stamp) {
          if (path === active) {
            activeChanged = true;
          }
        }
      }
    } else {
      if (active && next.get(active) !== prev.get(active)) {
        activeChanged = true;
      }
    }

    if (treeChanged) events.onTreeChange?.();
    if (activeChanged) events.onChange?.();
  };

  const poll = () => {
    const tick = async () => {
      if (stopped) return;
      const next = await snapshotDirectory(handle);
      if (stopped) return;
      if (next === null) {
        if (lastSnapshot !== null) events.onDeleted?.();
      } else {
        if (lastSnapshot !== null) {
          compareSnapshots(lastSnapshot, next);
        }
      }
      lastSnapshot = next;
      if (!stopped) timer = setTimeout(tick, intervalMs);
    };
    void tick();
  };

  const Observer = (globalThis as { FileSystemObserver?: FileSystemObserverConstructor }).FileSystemObserver;
  if (typeof Observer === 'function') {
    observer = new Observer((records) => {
      let treeChanged = false;
      let activeChanged = false;
      const active = activeFilePath();
      for (const record of records) {
        if (record.type === 'disappeared' || record.type === 'appeared' || (record as any).type === 'moved') {
          treeChanged = true;
        } else if (record.type === 'modified') {
          const path = record.relativePathComponents?.join('/');
          if (!path || path === active) {
            activeChanged = true;
          } else {
            treeChanged = true;
          }
        }
      }
      if (treeChanged) events.onTreeChange?.();
      if (activeChanged) events.onChange?.();
    });
    observer.observe(handle, { recursive: true }).catch(() => {
      observer?.disconnect();
      observer = undefined;
      poll();
    });
  } else {
    poll();
  }

  return () => {
    stopped = true;
    clearTimeout(timer);
    observer?.disconnect();
  };
}

// File URLs have no lastModified through fetch, so the watcher compares the text itself.
export function watchFileUrl(url: string, events: WatchEvents): () => void {
  return watchPolling({
    stamp: async () => {
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) return null;
      return response.text();
    },
    onChange: events.onChange,
    onDeleted: events.onDeleted,
    intervalMs: 1000,
  });
}
