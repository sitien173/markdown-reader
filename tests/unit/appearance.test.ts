// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { applyAppearance, clampMaxWidth, textScale } from '../../src/lib/appearance';
import { defaultSettings } from '../../src/lib/settings';
import { highlightCacheKind } from '../../src/render/highlight';
import { createReaderStore } from '../../src/store/reader-store';
import { _resetStoreForTesting, useSettingsStore } from '../../src/store/settings-store';

const base = defaultSettings.appearance;
const root = () => document.documentElement;

beforeEach(() => {
  _resetStoreForTesting();
  root().removeAttribute('style');
  root().removeAttribute('class');
  for (const name of ['data-theme', 'data-code-light', 'data-code-dark']) root().removeAttribute(name);
});

describe('code theme', () => {
  it('changes the highlight cache key when either code theme value changes', () => {
    applyAppearance(root(), base);
    const initial = highlightCacheKind();
    applyAppearance(root(), { ...base, codeThemeLight: 'dark' });
    const light = highlightCacheKind();
    applyAppearance(root(), { ...base, codeThemeDark: 'light' });
    const dark = highlightCacheKind();
    expect(new Set([initial, light, dark]).size).toBe(3);
  });

  it('writes both code theme values on the root', () => {
    applyAppearance(root(), { ...base, codeThemeLight: 'dark', codeThemeDark: 'light' });
    expect(root().getAttribute('data-code-light')).toBe('dark');
    expect(root().getAttribute('data-code-dark')).toBe('light');
  });
});

describe('text, font, and layout', () => {
  it('maps the six text steps to their scales with step 3 at 1.0', () => {
    expect([1, 2, 3, 4, 5, 6].map(textScale)).toEqual([0.875, 0.9375, 1.0, 1.0625, 1.125, 1.25]);
    expect(textScale(base.textSize)).toBe(1.0);
    applyAppearance(root(), { ...base, textSize: 6 });
    expect(root().style.getPropertyValue('--md-scale')).toBe('1.25');
  });

  it('clamps the custom max width to 500..3000 and defaults to 1000', () => {
    expect(clampMaxWidth(100)).toBe(500);
    expect(clampMaxWidth(500)).toBe(500);
    expect(clampMaxWidth(3000)).toBe(3000);
    expect(clampMaxWidth(9000)).toBe(3000);
    expect(clampMaxWidth(Number.NaN)).toBe(1000);
    applyAppearance(root(), { ...base, customMaxWidth: true, maxWidthPx: 1400 });
    expect(root().style.getPropertyValue('--md-max-width')).toBe('1400px');
    applyAppearance(root(), { ...base, customMaxWidth: false });
    expect(root().style.getPropertyValue('--md-max-width')).toBe('');
  });

  it('sets the font stack, and removes it for Default', () => {
    applyAppearance(root(), { ...base, font: 'serif' });
    expect(root().style.getPropertyValue('--md-font')).toContain('serif');
    applyAppearance(root(), { ...base, font: 'default' });
    expect(root().style.getPropertyValue('--md-font')).toBe('');
  });

  it('toggles the wrap, wide table, and centered root classes', () => {
    applyAppearance(root(), { ...base, wrapCode: true, wideTables: true, centered: false });
    expect([...root().classList].sort()).toEqual(['md-wide-tables', 'md-wrap-code']);
    applyAppearance(root(), { ...base, centered: true });
    expect([...root().classList]).toEqual(['md-centered']);
  });
});

describe('Zen mode', () => {
  it('starts the reader in focus mode when zen is stored, and Escape leaves the session only', () => {
    useSettingsStore.setState({ settings: { ...defaultSettings, appearance: { ...base, zen: true } } });
    const store = createReaderStore();
    expect(store.getState().focusMode).toBe(true);
    store.setState({ focusMode: false });
    expect(store.getState().focusMode).toBe(false);
    expect(useSettingsStore.getState().settings.appearance.zen).toBe(true);
  });

  it('starts without focus mode by default', () => {
    expect(createReaderStore().getState().focusMode).toBe(false);
  });
});
