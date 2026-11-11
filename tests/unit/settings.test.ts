import { describe, expect, it, vi } from 'vitest';
import { defaultSettings, parseSettings, readSettings, SETTINGS_KEY, settingsSchema } from '../../src/lib/settings';

describe('settings schema and parsing', () => {
  it('defines default settings with version 1 and all expected fields', () => {
    expect(settingsSchema).toBeDefined();
    expect(defaultSettings.version).toBe(1);

    // General defaults
    expect(defaultSettings.general).toEqual({
      enabled: true,
      outlineCollapsing: false,
      renderTxt: false,
      renderJson: false,
      autoRefresh: true,
      autoRefreshRemote: false,
      autoRefreshIntervalSec: 1,
      charsetCompat: false,
      language: 'en-US',
      showHiddenItems: false,
      ignorePatterns: 'node_modules/',
    });

    // Appearance defaults
    expect(defaultSettings.appearance).toEqual({
      textSize: 3,
      font: 'default',
      theme: 'auto',
      codeThemeLight: 'light',
      codeThemeDark: 'dark',
      wrapCode: false,
      wideTables: false,
      zen: false,
      centered: true,
      customMaxWidth: false,
      maxWidthPx: 1000,
      customCssEnabled: false,
      customCss: '',
    });

    // Plugins defaults
    expect(defaultSettings.plugins).toEqual({
      linkify: true,
      emoji: true,
      superscript: true,
      subscript: true,
      mark: true,
      katex: true,
      mermaid: true,
      abbreviation: true,
      definitionList: true,
      footnote: true,
      taskList: true,
      alert: true,
      typographer: false,
      breaks: false,
      toc: true,
      insert: true,
      frontMatter: true,
      multimdTable: true,
    });
  });

  it('parses valid raw settings matching the schema', () => {
    const parsed = parseSettings(defaultSettings);
    expect(parsed).toEqual(defaultSettings);
  });

  it('applies per-field fallback for corrupt plugins.linkify while preserving other fields', () => {
    const raw = {
      ...defaultSettings,
      plugins: {
        ...defaultSettings.plugins,
        linkify: 'corrupt-value',
        emoji: false,
      },
    };
    const parsed = parseSettings(raw);
    expect(parsed.plugins.linkify).toBe(true);
    expect(parsed.plugins.emoji).toBe(false);
  });

  it('applies per-field fallback for non-number general.autoRefreshIntervalSec', () => {
    const raw = {
      ...defaultSettings,
      general: {
        ...defaultSettings.general,
        autoRefreshIntervalSec: 'not-a-number',
        enabled: false,
      },
    };
    const parsed = parseSettings(raw);
    expect(parsed.general.autoRefreshIntervalSec).toBe(1);
    expect(parsed.general.enabled).toBe(false);
  });

  it('applies per-field fallback for invalid general.showHiddenItems', () => {
    const raw = {
      ...defaultSettings,
      general: {
        ...defaultSettings.general,
        showHiddenItems: 'invalid-boolean',
        enabled: false,
      },
    };
    const parsed = parseSettings(raw);
    expect(parsed.general.showHiddenItems).toBe(false);
    expect(parsed.general.enabled).toBe(false);
  });

  it('applies per-field fallback for invalid general.ignorePatterns', () => {
    const raw = {
      ...defaultSettings,
      general: {
        ...defaultSettings.general,
        ignorePatterns: 12345,
        enabled: false,
      },
    };
    const parsed = parseSettings(raw);
    expect(parsed.general.ignorePatterns).toBe('node_modules/');
    expect(parsed.general.enabled).toBe(false);
  });

  it('defaults renderJson to false and falls back from a non-boolean stored value', () => {
    expect(parseSettings({ general: {} }).general.renderJson).toBe(false);
    expect(parseSettings({ general: { renderJson: 'yes' } }).general.renderJson).toBe(false);
    expect(parseSettings({ general: { renderJson: true } }).general.renderJson).toBe(true);
  });

  it('clamps autoRefreshIntervalSec to 0.5..600', () => {
    expect(parseSettings({ general: { autoRefreshIntervalSec: 0.1 } }).general.autoRefreshIntervalSec).toBe(0.5);
    expect(parseSettings({ general: { autoRefreshIntervalSec: 1000 } }).general.autoRefreshIntervalSec).toBe(600);
    expect(parseSettings({ general: { autoRefreshIntervalSec: 10 } }).general.autoRefreshIntervalSec).toBe(10);
  });

  it('clamps maxWidthPx to 500..3000', () => {
    expect(parseSettings({ appearance: { maxWidthPx: 300 } }).appearance.maxWidthPx).toBe(500);
    expect(parseSettings({ appearance: { maxWidthPx: 5000 } }).appearance.maxWidthPx).toBe(3000);
    expect(parseSettings({ appearance: { maxWidthPx: 1200 } }).appearance.maxWidthPx).toBe(1200);
  });

  it('rejects customCss above 65536 characters and defaults to empty string', () => {
    const tooLong = 'a'.repeat(65537);
    const parsed = parseSettings({ appearance: { customCss: tooLong } });
    expect(parsed.appearance.customCss).toBe('');
  });

  it('does not throw when customCss is null and falls back to empty string', () => {
    expect(() => {
      const parsed = parseSettings({ appearance: { customCss: null } });
      expect(parsed.appearance.customCss).toBe('');
    }).not.toThrow();
  });

  it('readSettings reads from browser.storage.local using SETTINGS_KEY', async () => {
    const mockGet = vi.fn().mockResolvedValue({
      [SETTINGS_KEY]: {
        version: 1,
        general: { enabled: false },
      },
    });
    vi.stubGlobal('browser', {
      storage: {
        local: {
          get: mockGet,
        },
      },
    });

    const settings = await readSettings();
    expect(mockGet).toHaveBeenCalledWith(SETTINGS_KEY);
    expect(settings.general.enabled).toBe(false);
    expect(settings.general.autoRefreshIntervalSec).toBe(1);
  });
});
