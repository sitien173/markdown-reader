import type { Settings } from './settings';

export type Appearance = Settings['appearance'];
export type ThemeSetting = Appearance['theme'];

/** The root `data-theme` value. Auto never sets a fixed value, so it returns null and the attribute is removed. */
export const themeAttribute = (theme: ThemeSetting): 'light' | 'dark' | null => (theme === 'auto' ? null : theme);

/** Content scale for each of the six text size steps. Step 3 is the default at 1.0. */
export const TEXT_SCALES = [0.875, 0.9375, 1.0, 1.0625, 1.125, 1.25];
export const textScale = (step: number): number => TEXT_SCALES[Math.min(6, Math.max(1, Math.round(step))) - 1] ?? 1.0;

export const MAX_WIDTH_DEFAULT_PX = 1000;
export const clampMaxWidth = (px: number): number => (Number.isFinite(px) ? Math.min(3000, Math.max(500, px)) : MAX_WIDTH_DEFAULT_PX);

/** System font stacks only, so nothing loads remotely. Default keeps the stylesheet's own body font. */
export const FONT_STACKS: Record<Exclude<Appearance['font'], 'default'>, string> = {
  serif: 'ui-serif, Georgia, Cambria, "Times New Roman", serif',
  sans: 'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  mono: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
};

const CLASSES = ['md-wrap-code', 'md-wide-tables', 'md-centered'] as const;

/** Everything the Appearance settings put on the document root. The reader and the standalone export both read this one shape. */
export function appearanceRootState(appearance: Appearance) {
  const theme = themeAttribute(appearance.theme);
  const attributes: Record<string, string> = {
    'data-code-light': appearance.codeThemeLight,
    'data-code-dark': appearance.codeThemeDark,
  };
  if (theme) attributes['data-theme'] = theme;
  const properties: Record<string, string> = { '--md-scale': String(textScale(appearance.textSize)) };
  if (appearance.font !== 'default') properties['--md-font'] = FONT_STACKS[appearance.font];
  if (appearance.customMaxWidth) properties['--md-max-width'] = `${clampMaxWidth(appearance.maxWidthPx)}px`;
  const classes = [
    appearance.wrapCode && 'md-wrap-code',
    appearance.wideTables && 'md-wide-tables',
    appearance.centered && 'md-centered',
  ].filter((name): name is (typeof CLASSES)[number] => Boolean(name));
  return { attributes, properties, classes };
}

/** Writes the Appearance settings on the document root. Only the root carries them; the editor and export read their own tokens. */
export function applyAppearance(root: HTMLElement, appearance: Appearance): void {
  const { attributes, properties, classes } = appearanceRootState(appearance);
  if (!attributes['data-theme']) root.removeAttribute('data-theme');
  for (const [name, value] of Object.entries(attributes)) root.setAttribute(name, value);
  for (const name of ['--md-scale', '--md-font', '--md-max-width']) {
    const value = properties[name];
    if (value) root.style.setProperty(name, value);
    else root.style.removeProperty(name);
  }
  for (const name of CLASSES) root.classList.toggle(name, classes.includes(name));
}
