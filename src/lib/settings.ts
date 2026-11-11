import './zod-config';
import * as z from 'zod/mini';
import { SETTINGS_KEY } from './settings-flags';

export { SETTINGS_KEY };
export const CUSTOM_CSS_MAX_LENGTH = 65536;

export type Settings = {
  version: 1;
  general: {
    enabled: boolean;
    outlineCollapsing: boolean;
    renderTxt: boolean;
    renderJson: boolean;
    autoRefresh: boolean;
    autoRefreshRemote: boolean;
    autoRefreshIntervalSec: number;
    charsetCompat: boolean;
    language: 'en-US';
    showHiddenItems: boolean;
    ignorePatterns: string;
  };
  appearance: {
    textSize: number;
    font: 'default' | 'serif' | 'sans' | 'mono';
    theme: 'auto' | 'light' | 'dark';
    codeThemeLight: 'light' | 'dark';
    codeThemeDark: 'light' | 'dark';
    wrapCode: boolean;
    wideTables: boolean;
    zen: boolean;
    centered: boolean;
    customMaxWidth: boolean;
    maxWidthPx: number;
    customCssEnabled: boolean;
    customCss: string;
  };
  plugins: {
    linkify: boolean;
    emoji: boolean;
    superscript: boolean;
    subscript: boolean;
    mark: boolean;
    katex: boolean;
    mermaid: boolean;
    abbreviation: boolean;
    definitionList: boolean;
    footnote: boolean;
    taskList: boolean;
    alert: boolean;
    typographer: boolean;
    breaks: boolean;
    toc: boolean;
    insert: boolean;
    frontMatter: boolean;
    multimdTable: boolean;
  };
};

export const defaultSettings: Settings = {
  version: 1,
  general: {
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
  },
  appearance: {
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
  },
  plugins: {
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
  },
};

const generalSchema = z.object({
  enabled: z.catch(z.boolean(), defaultSettings.general.enabled),
  outlineCollapsing: z.catch(z.boolean(), defaultSettings.general.outlineCollapsing),
  renderTxt: z.catch(z.boolean(), defaultSettings.general.renderTxt),
  renderJson: z.catch(z.boolean(), defaultSettings.general.renderJson),
  autoRefresh: z.catch(z.boolean(), defaultSettings.general.autoRefresh),
  autoRefreshRemote: z.catch(z.boolean(), defaultSettings.general.autoRefreshRemote),
  autoRefreshIntervalSec: z.catch(
    z.pipe(
      z.number(),
      z.transform((v) => (Number.isFinite(v) ? Math.min(600, Math.max(0.5, v)) : defaultSettings.general.autoRefreshIntervalSec)),
    ),
    defaultSettings.general.autoRefreshIntervalSec,
  ),
  charsetCompat: z.catch(z.boolean(), defaultSettings.general.charsetCompat),
  language: z.catch(z.literal('en-US'), defaultSettings.general.language),
  showHiddenItems: z.catch(z.boolean(), defaultSettings.general.showHiddenItems),
  ignorePatterns: z.catch(z.string(), defaultSettings.general.ignorePatterns),
});

const appearanceSchema = z.object({
  textSize: z.catch(
    z.pipe(
      z.number(),
      z.transform((v) => (Number.isFinite(v) ? Math.min(6, Math.max(1, Math.round(v))) : defaultSettings.appearance.textSize)),
    ),
    defaultSettings.appearance.textSize,
  ),
  font: z.catch(z.enum(['default', 'serif', 'sans', 'mono']), defaultSettings.appearance.font),
  theme: z.catch(z.enum(['auto', 'light', 'dark']), defaultSettings.appearance.theme),
  codeThemeLight: z.catch(z.enum(['light', 'dark']), defaultSettings.appearance.codeThemeLight),
  codeThemeDark: z.catch(z.enum(['light', 'dark']), defaultSettings.appearance.codeThemeDark),
  wrapCode: z.catch(z.boolean(), defaultSettings.appearance.wrapCode),
  wideTables: z.catch(z.boolean(), defaultSettings.appearance.wideTables),
  zen: z.catch(z.boolean(), defaultSettings.appearance.zen),
  centered: z.catch(z.boolean(), defaultSettings.appearance.centered),
  customMaxWidth: z.catch(z.boolean(), defaultSettings.appearance.customMaxWidth),
  maxWidthPx: z.catch(
    z.pipe(
      z.number(),
      z.transform((v) => (Number.isFinite(v) ? Math.min(3000, Math.max(500, v)) : defaultSettings.appearance.maxWidthPx)),
    ),
    defaultSettings.appearance.maxWidthPx,
  ),
  customCssEnabled: z.catch(z.boolean(), defaultSettings.appearance.customCssEnabled),
  customCss: z.catch(z.string().check(z.maxLength(CUSTOM_CSS_MAX_LENGTH)), defaultSettings.appearance.customCss),
});

const pluginsSchema = z.object({
  linkify: z.catch(z.boolean(), defaultSettings.plugins.linkify),
  emoji: z.catch(z.boolean(), defaultSettings.plugins.emoji),
  superscript: z.catch(z.boolean(), defaultSettings.plugins.superscript),
  subscript: z.catch(z.boolean(), defaultSettings.plugins.subscript),
  mark: z.catch(z.boolean(), defaultSettings.plugins.mark),
  katex: z.catch(z.boolean(), defaultSettings.plugins.katex),
  mermaid: z.catch(z.boolean(), defaultSettings.plugins.mermaid),
  abbreviation: z.catch(z.boolean(), defaultSettings.plugins.abbreviation),
  definitionList: z.catch(z.boolean(), defaultSettings.plugins.definitionList),
  footnote: z.catch(z.boolean(), defaultSettings.plugins.footnote),
  taskList: z.catch(z.boolean(), defaultSettings.plugins.taskList),
  alert: z.catch(z.boolean(), defaultSettings.plugins.alert),
  typographer: z.catch(z.boolean(), defaultSettings.plugins.typographer),
  breaks: z.catch(z.boolean(), defaultSettings.plugins.breaks),
  toc: z.catch(z.boolean(), defaultSettings.plugins.toc),
  insert: z.catch(z.boolean(), defaultSettings.plugins.insert),
  frontMatter: z.catch(z.boolean(), defaultSettings.plugins.frontMatter),
  multimdTable: z.catch(z.boolean(), defaultSettings.plugins.multimdTable),
});

export const settingsSchema = z.object({
  version: z.catch(z.literal(1), 1),
  general: z.catch(generalSchema, () => defaultSettings.general),
  appearance: z.catch(appearanceSchema, () => defaultSettings.appearance),
  plugins: z.catch(pluginsSchema, () => defaultSettings.plugins),
});

export function parseSettings(raw: unknown): Settings {
  if (typeof raw !== 'object' || raw === null) {
    return defaultSettings;
  }
  const parsed = settingsSchema.safeParse(raw);
  return parsed.success ? (parsed.data as Settings) : defaultSettings;
}

export async function readSettings(): Promise<Settings> {
  const stored = await browser.storage.local.get(SETTINGS_KEY);
  return parseSettings(stored?.[SETTINGS_KEY]);
}
