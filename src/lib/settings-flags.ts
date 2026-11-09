// Zod-free: background.ts and detect.content.ts import this instead of settings.ts so no Zod code reaches their bundles.
export const SETTINGS_KEY = 'settings:v1';

export type GeneralFlags = { enabled: boolean; renderTxt: boolean; charsetCompat: boolean };

const flag = (value: unknown, fallback: boolean) => (typeof value === 'boolean' ? value : fallback);

export async function readGeneralFlags(): Promise<GeneralFlags> {
  let general: Record<string, unknown> = {};
  try {
    const raw = (await browser.storage.local.get(SETTINGS_KEY))?.[SETTINGS_KEY];
    const candidate = typeof raw === 'object' && raw !== null ? (raw as { general?: unknown }).general : undefined;
    if (typeof candidate === 'object' && candidate !== null) general = candidate as Record<string, unknown>;
  } catch {
    // storage unavailable: keep defaults
  }
  return {
    enabled: flag(general.enabled, true),
    renderTxt: flag(general.renderTxt, false),
    charsetCompat: flag(general.charsetCompat, false),
  };
}
