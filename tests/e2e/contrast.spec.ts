import type { Locator, Page } from '@playwright/test';
import { test, expect, startFixtureServer } from './fixtures';

type Rgb = [number, number, number];

// WCAG 2.x relative luminance and contrast ratio.
const channel = (v: number) => (v / 255 <= 0.03928 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4);
const luminance = ([r, g, b]: Rgb) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
const ratio = (a: Rgb, b: Rgb) => {
  const [la, lb] = [luminance(a), luminance(b)];
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};

const TEXT = 4.5; // body text
const UI = 3; // large text and UI borders

const SOURCE = '# Title\n\nBody with a [link](https://example.com/page).\n';

for (const scheme of ['light', 'dark'] as const) {
  test(`${scheme} scheme meets WCAG contrast for every text role`, async ({ page, extensionId }) => {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
    const { origin, close } = await startFixtureServer((_req, res) => {
      res.setHeader('content-type', 'text/markdown; charset=utf-8');
      res.end(SOURCE);
    });
    try {
      await page.goto(`chrome-extension://${extensionId}/reader.html?src=${encodeURIComponent(`${origin}/c.md`)}`);
      await expect(page.locator('.md-content h1')).toHaveText('Title', { timeout: 20000 });
      // Open the palette once so a popover surface is rendered. Every value below is read from :root tokens, not from it.
      await page.getByRole('button', { name: 'Command palette' }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.keyboard.press('Escape');

      const measured = await page.evaluate(() => {
        // Resolve any CSS color to sRGB through a 1x1 canvas, so oklch, color-mix, and named colors all work.
        const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
        if (!ctx) throw new Error('no 2d context');
        // Null for empty or unparseable input. An invalid assignment leaves fillStyle unchanged, so two different
        // sentinels would yield two different pixels if the value did not parse.
        const resolve = (css: string, sentinel: string): number[] => {
          ctx.clearRect(0, 0, 1, 1);
          ctx.fillStyle = sentinel;
          ctx.fillStyle = css;
          ctx.fillRect(0, 0, 1, 1);
          return Array.from(ctx.getImageData(0, 0, 1, 1).data.slice(0, 3));
        };
        const rgb = (css: string): number[] | null => {
          if (!css.trim()) return null;
          const a = resolve(css, '#010203');
          const b = resolve(css, '#fdfcfb');
          return a.every((v, i) => v === b[i]) ? a : null;
        };
        const root = getComputedStyle(document.documentElement);
        const token = (name: string) => rgb(root.getPropertyValue(name).trim());
        const link = document.querySelector('.md-content a');
        const input = document.createElement('input');
        input.setAttribute('data-slot', 'input');
        document.body.append(input);
        const inputBorder = rgb(getComputedStyle(input).borderTopColor);
        input.remove();
        return {
          background: token('--background'),
          foreground: token('--foreground'),
          popover: token('--popover'),
          popoverForeground: token('--popover-foreground'),
          muted: token('--muted'),
          mutedForeground: token('--muted-foreground'),
          primary: token('--primary'),
          primaryForeground: token('--primary-foreground'),
          destructive: token('--destructive'),
          ring: token('--ring'),
          link: link ? rgb(getComputedStyle(link).color) : null,
          inputBorder,
          warningBg: token('--alert-warning-bg'),
          warningForeground: token('--alert-warning-foreground'),
        };
      });
      const m = measured as unknown as Record<string, Rgb | null | undefined>;
      const pairs: Array<[string, Rgb | null | undefined, Rgb | null | undefined, number]> = [
        ['text on background', m.foreground, m.background, TEXT],
        ['text on popover', m.popoverForeground, m.popover, TEXT],
        ['muted text on background', m.mutedForeground, m.background, TEXT],
        ['muted text on muted', m.mutedForeground, m.muted, TEXT],
        ['primary-foreground on primary', m.primaryForeground, m.primary, TEXT],
        ['link on background', m.link, m.background, TEXT],
        ['destructive text on background', m.destructive, m.background, TEXT],
        ['alert warning text on its background', m.warningForeground, m.warningBg, TEXT],
        ['primary on background (focus ring, large text)', m.ring, m.background, UI],
        ['input border on background', m.inputBorder, m.background, UI],
        ['input border on popover', m.inputBorder, m.popover, UI],
      ];
      for (const [name, fg, bg, min] of pairs) {
        expect(fg, `${scheme}: ${name} foreground resolved`).not.toBeNull();
        expect(bg, `${scheme}: ${name} background resolved`).not.toBeNull();
        if (!fg || !bg) continue;
        expect(ratio(fg, bg), `${scheme}: ${name}`).toBeGreaterThanOrEqual(min);
      }
    } finally {
      await close();
    }
  });
}

// Self-contained so Playwright can serialize it: the text color of an element and the color it is composited over,
// layering every ancestor background from the root down so translucent surfaces resolve correctly.
function pairInPage(el: Element): { fg: number[] | null; bg: number[] | null } {
  const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('no 2d context');
  const pixel = (layers: string[]): number[] => {
    ctx.clearRect(0, 0, 1, 1);
    for (const layer of layers) {
      ctx.fillStyle = layer;
      ctx.fillRect(0, 0, 1, 1);
    }
    return Array.from(ctx.getImageData(0, 0, 1, 1).data.slice(0, 3));
  };
  const layers: string[] = [];
  for (let node: Element | null = el; node; node = node.parentElement) {
    const bg = getComputedStyle(node).backgroundColor;
    if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') layers.unshift(bg);
  }
  const fg = getComputedStyle(el).color;
  return { fg: fg ? pixel([fg]) : null, bg: layers.length ? pixel(['#fff', ...layers]) : null };
}

const measure = (locator: Locator) => locator.evaluate(pairInPage);

async function expectContrast(scheme: string, name: string, locator: Locator) {
  await expect(locator, `${scheme}: ${name} is rendered`).toBeVisible();
  const { fg, bg } = await measure(locator);
  expect(fg, `${scheme}: ${name} foreground resolved`).not.toBeNull();
  expect(bg, `${scheme}: ${name} background resolved`).not.toBeNull();
  if (!fg || !bg) return;
  expect(ratio(fg as Rgb, bg as Rgb), `${scheme}: ${name}`).toBeGreaterThanOrEqual(TEXT);
}

const RENDERED_SOURCE = ['# Title', '', '> [!NOTE]', '> A note.', '', '> [!CAUTION]', '> A caution.', '', 'Line seven.', ''].join('\n');

async function startDocServer() {
  return startFixtureServer((req, res) => {
    if (req.url?.endsWith('/missing.md')) {
      res.statusCode = 404;
      res.end('not found');
      return;
    }
    res.setHeader('content-type', 'text/markdown; charset=utf-8');
    res.end(RENDERED_SOURCE);
  });
}

async function openWithPicker(page: Page, text: string) {
  await page.evaluate(async (content) => {
    const root = await navigator.storage.getDirectory();
    const handle = await root.getFileHandle('contrast.md', { create: true });
    const writable = await handle.createWritable();
    await writable.write(content);
    await writable.close();
    (window as unknown as { showOpenFilePicker: () => Promise<unknown[]> }).showOpenFilePicker = async () => [handle];
  }, text);
  await page.getByRole('button', { name: 'Open', exact: true }).click();
  await page.getByRole('menuitem', { name: 'File' }).click();
  await expect(page.locator('.md-content h1').first()).toBeVisible({ timeout: 20000 });
}

for (const scheme of ['light', 'dark'] as const) {
  test(`${scheme} scheme: editor gutters, alert titles, and the error banner meet 4.5:1 as rendered`, async ({ page, extensionId }) => {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
    const { origin, close } = await startDocServer();
    try {
      await page.goto(`chrome-extension://${extensionId}/reader.html?mode=split&src=${encodeURIComponent(`${origin}/r.md`)}`);
      await expect(page.locator('.md-content h1')).toHaveText('Title', { timeout: 20000 });
      await page.locator('.cm-content').click();
      await page.keyboard.press('Control+Home');
      await expectContrast(scheme, 'editor active-line gutter', page.locator('.cm-lineNumbers .cm-activeLineGutter'));
      await expectContrast(scheme, 'editor gutter', page.locator('.cm-lineNumbers .cm-gutterElement', { hasText: /^3$/ }));
      await expectContrast(scheme, 'note alert title', page.locator('.markdown-alert-note .markdown-alert-title'));
      await expectContrast(scheme, 'caution alert title', page.locator('.markdown-alert-caution .markdown-alert-title'));

      await page.getByRole('button', { name: 'Command palette' }).click();
      await page.getByRole('dialog', { name: 'Command palette' }).getByRole('combobox').fill('Open URL');
      await page.keyboard.press('Enter');
      await page.getByLabel('Markdown URL').fill(`${origin}/missing.md`);
      await page.keyboard.press('Enter');
      await expectContrast(scheme, 'error banner', page.locator('[data-slot="status-banner"] [role="alert"] > span'));
    } finally {
      await close();
    }
  });

  test(`${scheme} scheme: toast and tooltip meet 4.5:1 as rendered`, async ({ page, extensionId, context }) => {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
    await page.goto(`chrome-extension://${extensionId}/reader.html?mode=split`);
    await openWithPicker(page, '# Toast fixture\n');
    await page.locator('.cm-content').click();
    await page.keyboard.press('Control+End');
    await page.keyboard.type(' more');
    await page.getByRole('button', { name: 'Save' }).click();
    await expectContrast(scheme, 'toast', page.locator('[data-slot="toast"]'));

    // A recent URL gives the popup a tooltip trigger.
    const { origin, close } = await startDocServer();
    try {
      await page.goto(`chrome-extension://${extensionId}/reader.html?src=${encodeURIComponent(`${origin}/r.md`)}`);
      await expect(page.locator('.md-content h1')).toHaveText('Title', { timeout: 20000 });
      const popup = await context.newPage();
      await popup.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
      await popup.goto(`chrome-extension://${extensionId}/popup.html`);
      await popup.getByRole('region', { name: 'Recent URLs' }).getByRole('button').first().hover();
      await expectContrast(scheme, 'tooltip', popup.locator('[data-slot="tooltip-content"]'));
    } finally {
      await close();
    }
  });
}
