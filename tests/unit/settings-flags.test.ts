import { afterEach, describe, expect, it, vi } from 'vitest';
import { readGeneralFlags, SETTINGS_KEY } from '../../src/lib/settings-flags';
import { SETTINGS_KEY as REEXPORTED_KEY } from '../../src/lib/settings';

function stubStorage(value: unknown) {
  vi.stubGlobal('browser', { storage: { local: { get: vi.fn(async () => (value === undefined ? {} : { [SETTINGS_KEY]: value })) } } });
}

afterEach(() => vi.unstubAllGlobals());

describe('readGeneralFlags', () => {
  it('keeps one settings key shared with settings.ts', () => {
    expect(SETTINGS_KEY).toBe('settings:v1');
    expect(REEXPORTED_KEY).toBe(SETTINGS_KEY);
  });
  it('returns the defaults when nothing is stored', async () => {
    stubStorage(undefined);
    expect(await readGeneralFlags()).toEqual({ enabled: true, renderTxt: false, charsetCompat: false });
  });
  it('reads stored booleans', async () => {
    stubStorage({ general: { enabled: false, renderTxt: true, charsetCompat: true } });
    expect(await readGeneralFlags()).toEqual({ enabled: false, renderTxt: true, charsetCompat: true });
  });
  it('falls back per field on wrong types', async () => {
    stubStorage({ general: { enabled: 'no', renderTxt: 1, charsetCompat: true } });
    expect(await readGeneralFlags()).toEqual({ enabled: true, renderTxt: false, charsetCompat: true });
  });
  it('falls back to defaults when the stored value is not an object', async () => {
    stubStorage('garbage');
    expect(await readGeneralFlags()).toEqual({ enabled: true, renderTxt: false, charsetCompat: false });
  });
  it('returns defaults when storage rejects', async () => {
    vi.stubGlobal('browser', { storage: { local: { get: vi.fn(async () => Promise.reject(new Error('x'))) } } });
    expect(await readGeneralFlags()).toEqual({ enabled: true, renderTxt: false, charsetCompat: false });
  });
});
