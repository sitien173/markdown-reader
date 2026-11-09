import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createController } from '../../src/reader/controller';
import { defaultSettings } from '../../src/lib/settings';
import { decodeBytes } from '../../src/source/decode';
import { FileUrlSource } from '../../src/source/file-url';
import { UrlSource } from '../../src/source/url';
import { _resetStoreForTesting, useSettingsStore } from '../../src/store/settings-store';

const bytes = (...values: number[]): Uint8Array<ArrayBuffer> => Uint8Array.from(values) as Uint8Array<ArrayBuffer>;
const ascii = (text: string) => [...text].map((c) => c.charCodeAt(0));

describe('decodeBytes order', () => {
  it('uses a UTF-8 BOM first and strips it', () => {
    expect(decodeBytes(bytes(0xef, 0xbb, 0xbf, ...ascii('a')), 'windows-1252')).toBe('a');
  });
  it('uses a UTF-16 BOM before strict UTF-8', () => {
    expect(decodeBytes(bytes(0xff, 0xfe, 0x68, 0x00, 0x69, 0x00))).toBe('hi');
    expect(decodeBytes(bytes(0xfe, 0xff, 0x00, 0x68, 0x00, 0x69))).toBe('hi');
  });
  it('decodes valid UTF-8 without a BOM before the HTTP charset', () => {
    expect(decodeBytes(new TextEncoder().encode('café ✓'), 'windows-1252')).toBe('café ✓');
  });
  it('falls to the HTTP charset when the bytes are not valid UTF-8', () => {
    expect(decodeBytes(bytes(0x82, 0xa0), 'shift_jis')).toBe('あ');
  });
  it('falls to windows-1252 when there is no usable HTTP charset', () => {
    expect(decodeBytes(bytes(...ascii('caf'), 0xe9))).toBe('café');
    expect(decodeBytes(bytes(...ascii('caf'), 0xe9), 'not-a-charset')).toBe('café');
  });
  it('sends a UTF-8 file with an invalid byte to windows-1252', () => {
    expect(decodeBytes(bytes(...ascii('# Title '), 0x93, ...ascii('quoted'), 0x94), 'utf-8')).toBe('# Title “quoted”');
  });
});

describe('response readers', () => {
  afterEach(() => vi.unstubAllGlobals());

  function stubFetch(body: Uint8Array<ArrayBuffer>, contentType?: string) {
    const response = new Response(new Blob([body]), contentType ? { headers: { 'Content-Type': contentType } } : undefined);
    const arrayBuffer = vi.spyOn(response, 'arrayBuffer');
    const text = vi.spyOn(response, 'text');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));
    return { arrayBuffer, text };
  }

  it('UrlSource keeps text() when charset compatibility is off', async () => {
    const spies = stubFetch(new TextEncoder().encode('# hi'));
    await expect(new UrlSource('https://e.test/a.md').read()).resolves.toBe('# hi');
    expect(spies.text).toHaveBeenCalled();
    expect(spies.arrayBuffer).not.toHaveBeenCalled();
  });
  it('UrlSource reads bytes and honors the HTTP charset when on', async () => {
    const spies = stubFetch(bytes(0x82, 0xa0), 'text/markdown; charset=Shift_JIS');
    await expect(new UrlSource('https://e.test/a.md', true).read()).resolves.toBe('あ');
    expect(spies.arrayBuffer).toHaveBeenCalled();
    expect(spies.text).not.toHaveBeenCalled();
  });
  it('FileUrlSource keeps text() when off and decodes windows-1252 bytes when on', async () => {
    const off = stubFetch(new TextEncoder().encode('# plain'));
    await expect(new FileUrlSource('file:///tmp/a.md').read()).resolves.toBe('# plain');
    expect(off.arrayBuffer).not.toHaveBeenCalled();
    const on = stubFetch(bytes(...ascii('caf'), 0xe9));
    await expect(new FileUrlSource('file:///tmp/a.md', true).read()).resolves.toBe('café');
    expect(on.text).not.toHaveBeenCalled();
  });
});

describe('controller captured text', () => {
  const captured = (url: string) => ({ [`markdown-reader:${url}`]: { url, text: 'captured text', ts: Date.now() } });

  beforeEach(() => {
    _resetStoreForTesting();
    window.history.replaceState(null, '', '/');
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    _resetStoreForTesting();
  });

  function setup(url: string, charsetCompat: boolean) {
    useSettingsStore.setState({ settings: { ...defaultSettings, general: { ...defaultSettings.general, charsetCompat } } });
    const local = { get: vi.fn(async () => ({})), set: vi.fn(async () => undefined), remove: vi.fn(async () => undefined) };
    const session = { get: vi.fn(async () => captured(url)), remove: vi.fn(async () => undefined) };
    vi.stubGlobal('browser', { storage: { local, session } });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(new Blob([bytes(...ascii('caf'), 0xe9)]))),
    );
    return createController();
  }

  it('bypasses captured text for file: URLs when on and decodes the file bytes', async () => {
    const url = 'file:///tmp/a.md';
    const c = setup(url, true);
    await c.load(url);
    expect(c.store.getState().text).toBe('café');
    c.mount()();
  });
  it('keeps captured text for file: URLs when off', async () => {
    const url = 'file:///tmp/a.md';
    const c = setup(url, false);
    await c.load(url);
    expect(c.store.getState().text).toBe('captured text');
    c.mount()();
  });
  it('does not bypass captured text for http URLs when on', async () => {
    const url = 'https://e.test/a.md';
    const c = setup(url, true);
    await c.load(url);
    expect(c.store.getState().text).toBe('captured text');
    expect(fetch).not.toHaveBeenCalled();
  });
});
