import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultSettings, SETTINGS_KEY } from '../../src/lib/settings';
import { _resetStoreForTesting, useSettingsStore } from '../../src/store/settings-store';

describe('settings store', () => {
  let fakeLocalData: Record<string, unknown>;
  let changedListeners: Array<(changes: Record<string, { oldValue?: unknown; newValue?: unknown }>, area: string) => void>;
  let fakeGet: ReturnType<typeof vi.fn>;
  let fakeSet: ReturnType<typeof vi.fn>;
  let fakeAddListener: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fakeLocalData = {};
    changedListeners = [];
    fakeGet = vi.fn(async (key: string) => ({ [key]: fakeLocalData[key] }));
    fakeSet = vi.fn(async (items: Record<string, unknown>) => {
      Object.assign(fakeLocalData, items);
    });
    fakeAddListener = vi.fn((listener) => {
      changedListeners.push(listener);
    });

    vi.stubGlobal('browser', {
      storage: {
        local: {
          get: fakeGet,
          set: fakeSet,
        },
        onChanged: {
          addListener: fakeAddListener,
          removeListener: vi.fn(),
        },
      },
    });

    _resetStoreForTesting();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('load is idempotent and reuses the initial promise', async () => {
    const store = useSettingsStore.getState();
    const p1 = store.load();
    const p2 = store.load();
    expect(p1).toBe(p2);
    await p1;
    expect(fakeGet).toHaveBeenCalledTimes(1);
  });

  it('updates the store when storage.onChanged fires for settings:v1 in local area', async () => {
    await useSettingsStore.getState().load();

    const updatedSettings = {
      ...defaultSettings,
      general: { ...defaultSettings.general, enabled: false },
    };

    expect(changedListeners.length).toBeGreaterThan(0);
    for (const listener of changedListeners) {
      listener({ [SETTINGS_KEY]: { newValue: updatedSettings } }, 'local');
    }

    expect(useSettingsStore.getState().settings.general.enabled).toBe(false);
  });

  it('does not update the store when storage.onChanged fires for drafts:x or other areas', async () => {
    await useSettingsStore.getState().load();

    const subscriber = vi.fn();
    const unsub = useSettingsStore.subscribe(subscriber);

    // Change under drafts:x in local area
    for (const listener of changedListeners) {
      listener({ 'drafts:doc-1': { newValue: 'draft content' } }, 'local');
    }

    // Change under settings:v1 in sync area (not local)
    for (const listener of changedListeners) {
      listener({ [SETTINGS_KEY]: { newValue: { ...defaultSettings, general: { ...defaultSettings.general, enabled: false } } } }, 'sync');
    }

    expect(subscriber).not.toHaveBeenCalled();
    expect(useSettingsStore.getState().settings).toEqual(defaultSettings);

    unsub();
  });

  it('reset() writes defaults to storage.local and updates the store', async () => {
    await useSettingsStore.getState().load();

    // First change some state
    useSettingsStore.setState({
      settings: { ...defaultSettings, general: { ...defaultSettings.general, enabled: false } },
    });

    await useSettingsStore.getState().reset();

    expect(fakeSet).toHaveBeenCalledWith({ [SETTINGS_KEY]: defaultSettings });
    expect(useSettingsStore.getState().settings).toEqual(defaultSettings);
  });

  it('update(patch) deep-merges per section and writes to storage.local and updates the store', async () => {
    await useSettingsStore.getState().load();

    await useSettingsStore.getState().update({
      general: { autoRefreshIntervalSec: 5 },
      plugins: { linkify: false },
    });

    const expectedSettings = {
      ...defaultSettings,
      general: { ...defaultSettings.general, autoRefreshIntervalSec: 5 },
      plugins: { ...defaultSettings.plugins, linkify: false },
    };

    expect(fakeSet).toHaveBeenCalledWith({ [SETTINGS_KEY]: expectedSettings });
    expect(useSettingsStore.getState().settings.general.autoRefreshIntervalSec).toBe(5);
    expect(useSettingsStore.getState().settings.plugins.linkify).toBe(false);
    expect(useSettingsStore.getState().settings.general.enabled).toBe(true);
  });

  it('load() falls back to defaults on a storage failure and a later call retries', async () => {
    fakeGet.mockRejectedValueOnce(new Error('storage down'));
    await useSettingsStore.getState().load();
    expect(useSettingsStore.getState().settings).toEqual(defaultSettings);

    fakeLocalData[SETTINGS_KEY] = { ...defaultSettings, general: { ...defaultSettings.general, enabled: false } };
    await useSettingsStore.getState().load();
    expect(fakeGet).toHaveBeenCalledTimes(2);
    expect(useSettingsStore.getState().settings.general.enabled).toBe(false);
  });

  it('concurrent update() calls on different fields both persist', async () => {
    await useSettingsStore.getState().load();
    const { update } = useSettingsStore.getState();

    await Promise.all([update({ general: { renderTxt: true } }), update({ plugins: { linkify: false } })]);

    const settings = useSettingsStore.getState().settings;
    expect(settings.general.renderTxt).toBe(true);
    expect(settings.plugins.linkify).toBe(false);
    const last = fakeSet.mock.calls.at(-1)?.[0][SETTINGS_KEY] as typeof defaultSettings;
    expect(last.general.renderTxt).toBe(true);
    expect(last.plugins.linkify).toBe(false);
  });

  it('update() rejects customCss above 65536 characters and keeps the stored stylesheet', async () => {
    await useSettingsStore.getState().load();
    await useSettingsStore.getState().update({ appearance: { customCss: 'a { color: red }' } });
    fakeSet.mockClear();

    await expect(useSettingsStore.getState().update({ appearance: { customCss: 'x'.repeat(65537) } })).rejects.toThrow(/65536/);

    expect(fakeSet).not.toHaveBeenCalled();
    expect(useSettingsStore.getState().settings.appearance.customCss).toBe('a { color: red }');
  });

  it('a rejected load() keeps in-flight update state and a later load() retries', async () => {
    let rejectGet: (e: Error) => void = () => {};
    fakeGet.mockImplementationOnce(
      () =>
        new Promise((_, rej) => {
          rejectGet = rej;
        }),
    );
    const loading = useSettingsStore.getState().load();
    await useSettingsStore.getState().update({ general: { renderTxt: true } });
    rejectGet(new Error('storage down'));
    await loading;
    expect(useSettingsStore.getState().settings.general.renderTxt).toBe(true);
    await useSettingsStore.getState().load();
    expect(fakeGet).toHaveBeenCalledTimes(2);
  });

  it('update() restores the previous settings when the write rejects and nothing else changed', async () => {
    await useSettingsStore.getState().load();
    fakeSet.mockRejectedValueOnce(new Error('quota'));
    await expect(useSettingsStore.getState().update({ general: { renderTxt: true } })).rejects.toThrow('quota');
    expect(useSettingsStore.getState().settings).toEqual(defaultSettings);
  });

  it('update() keeps a newer state when its own write rejects after another update', async () => {
    await useSettingsStore.getState().load();
    let rejectFirst: (e: Error) => void = () => {};
    fakeSet.mockImplementationOnce(
      () =>
        new Promise((_, rej) => {
          rejectFirst = rej;
        }),
    );
    const first = useSettingsStore.getState().update({ general: { renderTxt: true } });
    await useSettingsStore.getState().update({ plugins: { linkify: false } });
    rejectFirst(new Error('quota'));
    await expect(first).rejects.toThrow('quota');
    expect(useSettingsStore.getState().settings.plugins.linkify).toBe(false);
    expect(useSettingsStore.getState().settings.general.renderTxt).toBe(true);
  });

  it('reset() sets state before the storage write resolves', async () => {
    await useSettingsStore.getState().load();
    await useSettingsStore.getState().update({ general: { renderTxt: true } });
    let release: () => void = () => {};
    fakeSet.mockImplementationOnce(
      () =>
        new Promise<void>((res) => {
          release = res;
        }),
    );
    const pending = useSettingsStore.getState().reset();
    expect(useSettingsStore.getState().settings).toEqual(defaultSettings);
    release();
    await pending;
  });

  it('an onChanged echo of an earlier write does not overwrite a later update', async () => {
    fakeSet.mockImplementation(async (items: Record<string, unknown>) => {
      const old = fakeLocalData[SETTINGS_KEY];
      Object.assign(fakeLocalData, items);
      await new Promise((r) => setTimeout(r, 0));
      for (const l of changedListeners) l({ [SETTINGS_KEY]: { oldValue: old, newValue: items[SETTINGS_KEY] } }, 'local');
    });
    await useSettingsStore.getState().load();
    const seen: boolean[] = [];
    useSettingsStore.subscribe((s) => seen.push(s.settings.plugins.linkify));
    const a = useSettingsStore.getState().update({ general: { renderTxt: true } });
    const b = useSettingsStore.getState().update({ plugins: { linkify: false } });
    await Promise.all([a, b]);
    expect(useSettingsStore.getState().settings.plugins.linkify).toBe(false);
    expect(seen.filter((v, i) => i > 0 && v && seen[i - 1] === false)).toEqual([]);
  });

  it('an onChanged echo delivered after set() resolves does not overwrite a later update', async () => {
    const echoes: Array<() => void> = [];
    fakeSet.mockImplementation(async (items: Record<string, unknown>) => {
      const old = fakeLocalData[SETTINGS_KEY];
      Object.assign(fakeLocalData, items);
      echoes.push(() => {
        for (const l of changedListeners) l({ [SETTINGS_KEY]: { oldValue: old, newValue: items[SETTINGS_KEY] } }, 'local');
      });
    });
    await useSettingsStore.getState().load();
    await useSettingsStore.getState().update({ general: { renderTxt: true } });
    await useSettingsStore.getState().update({ plugins: { linkify: false } });
    echoes[0]!();
    const settings = useSettingsStore.getState().settings;
    expect(settings.plugins.linkify).toBe(false);
    expect(settings.general.renderTxt).toBe(true);
  });

  it('writing A again after the echo of A, while the write of O is pending, converges storage and memory to A', async () => {
    const echoes: Array<() => void> = [];
    fakeSet.mockImplementation(async (items: Record<string, unknown>) => {
      const old = fakeLocalData[SETTINGS_KEY];
      Object.assign(fakeLocalData, items);
      echoes.push(() => {
        for (const l of changedListeners) l({ [SETTINGS_KEY]: { oldValue: old, newValue: items[SETTINGS_KEY] } }, 'local');
      });
    });
    await useSettingsStore.getState().load();
    await useSettingsStore.getState().update({ plugins: { linkify: true } });
    await useSettingsStore.getState().update({ plugins: { linkify: false } });
    echoes[0]?.();
    await useSettingsStore.getState().update({ plugins: { linkify: true } });
    for (const echo of echoes.slice(1)) echo();
    const stored = fakeLocalData[SETTINGS_KEY] as typeof defaultSettings;
    expect(stored.plugins.linkify).toBe(true);
    expect(useSettingsStore.getState().settings.plugins.linkify).toBe(true);
  });

  it('a successful load() does not overwrite state changed while it was reading', async () => {
    let release: () => void = () => {};
    fakeGet.mockImplementationOnce(
      () =>
        new Promise((res) => {
          release = () => res({});
        }),
    );
    const loading = useSettingsStore.getState().load();
    await useSettingsStore.getState().update({ general: { renderTxt: true } });
    release();
    await loading;
    expect(useSettingsStore.getState().settings.general.renderTxt).toBe(true);
  });

  it('reset() restores the previous settings when the write rejects', async () => {
    await useSettingsStore.getState().load();
    await useSettingsStore.getState().update({ general: { renderTxt: true } });
    fakeSet.mockRejectedValueOnce(new Error('quota'));
    await expect(useSettingsStore.getState().reset()).rejects.toThrow('quota');
    expect(useSettingsStore.getState().settings.general.renderTxt).toBe(true);
  });

  it('a write that leaves the stored value unchanged registers no echo entry that could drop a later change from another context', async () => {
    fakeLocalData[SETTINGS_KEY] = defaultSettings;
    await useSettingsStore.getState().load();
    await useSettingsStore.getState().update({ general: { enabled: true } });
    const other = { ...defaultSettings, general: { ...defaultSettings.general, enabled: false } };
    for (const l of changedListeners) l({ [SETTINGS_KEY]: { oldValue: defaultSettings, newValue: other } }, 'local');
    expect(useSettingsStore.getState().settings.general.enabled).toBe(false);
    for (const l of changedListeners) l({ [SETTINGS_KEY]: { oldValue: other, newValue: defaultSettings } }, 'local');
    expect(useSettingsStore.getState().settings.general.enabled).toBe(true);
  });

  it('a write back to the original value still persists while an earlier write is in flight', async () => {
    fakeLocalData[SETTINGS_KEY] = defaultSettings;
    await useSettingsStore.getState().load();
    const first = useSettingsStore.getState().update({ general: { renderTxt: true } });
    const second = useSettingsStore.getState().update({ general: { renderTxt: false } });
    await Promise.all([first, second]);
    expect(fakeSet).toHaveBeenCalledTimes(2);
    expect((fakeLocalData[SETTINGS_KEY] as typeof defaultSettings).general.renderTxt).toBe(false);
  });
});
