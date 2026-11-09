import { create } from 'zustand';
import { CUSTOM_CSS_MAX_LENGTH, defaultSettings, parseSettings, type Settings, SETTINGS_KEY } from '../lib/settings';

export type SettingsPatch = {
  general?: Partial<Settings['general']>;
  appearance?: Partial<Settings['appearance']>;
  plugins?: Partial<Settings['plugins']>;
};

export type SettingsStore = {
  settings: Settings;
  load: () => Promise<void>;
  update: (patch: SettingsPatch) => Promise<void>;
  reset: () => Promise<void>;
};

const sameSettings = (a: Settings, b: Settings) => a === b || JSON.stringify(a) === JSON.stringify(b);

/** Written values whose `onChanged` echo has not arrived yet; the echo must not overwrite newer state. */
type PendingWrite = { key: string; timer?: ReturnType<typeof setTimeout> };
const pendingWrites: PendingWrite[] = [];
/** An echo normally arrives right after `set` resolves; storage skips it for an unchanged value, so the entry expires. */
const ECHO_TIMEOUT_MS = 2000;

function dropPending(entry: PendingWrite) {
  clearTimeout(entry.timer);
  const index = pendingWrites.indexOf(entry);
  if (index !== -1) pendingWrites.splice(index, 1);
}

/** The last value known to be in storage, from the initial read, an `onChanged` event, or the latest write issued. Unknown after a failed write. */
let lastStored: string | undefined;

async function write(next: Settings) {
  const key = JSON.stringify(next);
  // Chrome sends no `onChanged` event for an unchanged value, so a pending entry for it would linger and swallow a later genuine change.
  if (key === lastStored) return;
  lastStored = key;
  const entry: PendingWrite = { key };
  pendingWrites.push(entry);
  try {
    await browser.storage.local.set({ [SETTINGS_KEY]: next });
  } catch (error) {
    dropPending(entry);
    lastStored = undefined;
    throw error;
  }
  if (pendingWrites.includes(entry)) entry.timer = setTimeout(() => dropPending(entry), ECHO_TIMEOUT_MS);
}

let loadPromise: Promise<void> | null = null;
let listenerAttached = false;

function ensureListener(set: (state: Partial<SettingsStore> | ((state: SettingsStore) => Partial<SettingsStore>)) => void) {
  if (listenerAttached) return;
  if (typeof browser !== 'undefined' && browser.storage?.onChanged?.addListener) {
    listenerAttached = true;
    browser.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local' && changes[SETTINGS_KEY]) {
        const next = parseSettings(changes[SETTINGS_KEY].newValue);
        const key = JSON.stringify(next);
        const echo = pendingWrites.find((entry) => entry.key === key);
        if (echo) dropPending(echo);
        // While newer writes are pending, `lastStored` is the latest write issued, not this older echo.
        if (pendingWrites.length === 0) lastStored = key;
        if (echo) return;
        set((state) => (sameSettings(state.settings, next) ? state : { settings: next }));
      }
    });
  }
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  settings: defaultSettings,
  load: () => {
    if (loadPromise) return loadPromise;
    loadPromise = (async () => {
      ensureListener(set);
      const before = get().settings;
      try {
        const raw = (await browser.storage.local.get(SETTINGS_KEY))?.[SETTINGS_KEY];
        const loaded = parseSettings(raw);
        if (raw !== undefined) lastStored ??= JSON.stringify(loaded);
        if (get().settings === before) set({ settings: loaded });
      } catch {
        loadPromise = null;
      }
    })();
    return loadPromise;
  },
  update: async (patch: SettingsPatch) => {
    if ((patch.appearance?.customCss?.length ?? 0) > CUSTOM_CSS_MAX_LENGTH) {
      throw new Error(`customCss exceeds ${CUSTOM_CSS_MAX_LENGTH} characters`);
    }
    const current = get().settings;
    const merged: Settings = {
      ...current,
      general: {
        ...current.general,
        ...(patch.general ?? {}),
      },
      appearance: {
        ...current.appearance,
        ...(patch.appearance ?? {}),
      },
      plugins: {
        ...current.plugins,
        ...(patch.plugins ?? {}),
      },
    };
    const next = parseSettings(merged);
    set({ settings: next });
    try {
      await write(next);
    } catch (error) {
      if (get().settings === next) set({ settings: current });
      throw error;
    }
  },
  reset: async () => {
    const current = get().settings;
    const next = defaultSettings;
    set({ settings: next });
    try {
      await write(next);
    } catch (error) {
      if (get().settings === next) set({ settings: current });
      throw error;
    }
  },
}));

export function _resetStoreForTesting() {
  loadPromise = null;
  listenerAttached = false;
  lastStored = undefined;
  for (const entry of [...pendingWrites]) dropPending(entry);
  useSettingsStore.setState({ settings: defaultSettings });
}
