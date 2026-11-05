import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDraftSaver, draftKey, loadDraft } from '../../src/store/drafts';

function fakeStorage() {
  const data: Record<string, unknown> = {};
  return {
    data,
    get: vi.fn(async (key: string) => ({ [key]: data[key] })),
    set: vi.fn(async (items: Record<string, unknown>) => { Object.assign(data, items); }),
  };
}

describe('draft saver', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('saves the latest text once after 1 s of idle time', async () => {
    const storage = fakeStorage();
    const saver = createDraftSaver(storage, draftKey('https://example.com/a.md'), 1000);
    saver.update('first');
    vi.advanceTimersByTime(600);
    saver.update('second');
    vi.advanceTimersByTime(999);
    expect(storage.set).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(storage.set).toHaveBeenCalledTimes(1);
    expect(storage.set).toHaveBeenCalledWith({ [draftKey('https://example.com/a.md')]: 'second' });
  });

  it('restores a draft only for the same source identity', async () => {
    const storage = fakeStorage();
    const saver = createDraftSaver(storage, draftKey('https://example.com/a.md'), 1000);
    saver.update('draft text');
    vi.advanceTimersByTime(1000);
    expect(await loadDraft(storage, draftKey('https://example.com/a.md'))).toBe('draft text');
    expect(await loadDraft(storage, draftKey('https://example.com/b.md'))).toBeUndefined();
  });

  it('keys drafts by source identity, not by text', () => {
    expect(draftKey('https://example.com/a.md')).not.toBe(draftKey('https://example.com/b.md'));
    expect(draftKey('https://example.com/a.md')).toBe(draftKey('https://example.com/a.md'));
  });
});
