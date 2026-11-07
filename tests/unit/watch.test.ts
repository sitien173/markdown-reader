import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { watchFileHandle, watchPolling } from '../../src/source/watch';

describe('polling watcher', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('reports a change once when lastModified moves, then stops after unsubscribe', async () => {
    let stamp = 1000;
    const onChange = vi.fn();
    const onDeleted = vi.fn();
    const stop = watchPolling({ stamp: async () => stamp, onChange, onDeleted, intervalMs: 1000 });
    await vi.advanceTimersByTimeAsync(1000);
    expect(onChange).not.toHaveBeenCalled();
    stamp = 2000;
    await vi.advanceTimersByTimeAsync(1000);
    expect(onChange).toHaveBeenCalledTimes(1);
    stop();
    stamp = 3000;
    await vi.advanceTimersByTimeAsync(5000);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it('announces deletion when the stamp becomes null', async () => {
    let stamp: number | null = 1000;
    const onDeleted = vi.fn();
    const stop = watchPolling({ stamp: async () => stamp, onChange: vi.fn(), onDeleted, intervalMs: 1000 });
    stamp = null;
    await vi.advanceTimersByTimeAsync(1000);
    expect(onDeleted).toHaveBeenCalledTimes(1);
    stop();
  });
});

describe('handle watcher', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('disconnects the FileSystemObserver on unsubscribe and reports modifications', async () => {
    const disconnect = vi.fn();
    let deliver: (records: Array<{ type: string }>) => void = () => {};
    class FakeObserver {
      constructor(callback: (records: Array<{ type: string }>) => void) {
        deliver = callback;
      }
      observe = vi.fn(async () => {});
      disconnect = disconnect;
    }
    vi.stubGlobal('FileSystemObserver', FakeObserver);
    const onChange = vi.fn();
    const stop = watchFileHandle({ getFile: async () => ({ lastModified: 1 }) } as unknown as FileSystemFileHandle, {
      onChange,
      onDeleted: vi.fn(),
    });
    deliver([{ type: 'modified' }]);
    expect(onChange).toHaveBeenCalledTimes(1);
    stop();
    expect(disconnect).toHaveBeenCalledTimes(1);
  });

  it('falls back to lastModified polling without FileSystemObserver and stops on unsubscribe', async () => {
    vi.stubGlobal('FileSystemObserver', undefined);
    let modified = 1000;
    const onChange = vi.fn();
    const stop = watchFileHandle({ getFile: async () => ({ lastModified: modified }) } as unknown as FileSystemFileHandle, {
      onChange,
      onDeleted: vi.fn(),
    });
    await vi.advanceTimersByTimeAsync(1000);
    modified = 2000;
    await vi.advanceTimersByTimeAsync(1000);
    expect(onChange).toHaveBeenCalledTimes(1);
    stop();
    modified = 3000;
    await vi.advanceTimersByTimeAsync(5000);
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
