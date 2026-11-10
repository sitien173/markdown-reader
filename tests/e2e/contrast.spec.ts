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
      await page.keyboard.press('Control+k');
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
function pairInPage(el: Element, fgOverride?: string): { fg: number[] | null; bg: number[] | null } {
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
  const fg = fgOverride ?? getComputedStyle(el).color;
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
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('menuitem', { name: 'Open file' }).click();
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

      await page.keyboard.press('Control+k');
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

    // The navbar file name gives a tooltip trigger.
    await page.locator('.reader-title-text').hover();
    await expectContrast(scheme, 'tooltip', page.locator('[data-slot="tooltip-content"]'));
  });
}

// Forced theme: the OS scheme says the opposite, so only the stored Appearance setting can make the surface right.
const forceTheme = async (page: Page, theme: 'light' | 'dark') => {
  await page.emulateMedia({ colorScheme: theme === 'light' ? 'dark' : 'light', reducedMotion: 'reduce' });
  await page.evaluate(
    (value) =>
      (globalThis as unknown as { chrome: { storage: { local: { set(items: object): Promise<void> } } } }).chrome.storage.local.set({
        'settings:v1': { version: 1, appearance: { theme: value } },
      }),
    theme,
  );
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
};

// Every visible text node owner and placeholder under the scope, with its text color and composited background.
async function lowContrast(scope: Locator, min = TEXT, only?: string) {
  await expect(scope.first()).toBeVisible();
  const pairs = await scope.first().evaluate(
    (root, { src, only }) => {
      const pair = new Function(`return ${src}`)() as (el: Element, fg?: string) => { fg: number[] | null; bg: number[] | null };
      const rendered = (el: Element) => {
        const style = getComputedStyle(el);
        return (
          style.visibility !== 'hidden' &&
          style.display !== 'none' &&
          el.getClientRects().length > 0 &&
          !el.closest('[aria-hidden="true"], [inert]')
        );
      };
      const out: Array<{ name: string; fg: number[] | null; bg: number[] | null }> = [];
      if (only) {
        for (const el of root.querySelectorAll(only)) if (rendered(el)) out.push({ name: `${el.getAttribute('aria-label')}`, ...pair(el) });
        return out;
      }
      for (const el of [root, ...root.querySelectorAll('*')]) {
        if (!rendered(el) || (el as HTMLButtonElement).disabled) continue;
        const name = `${el.tagName.toLowerCase()}[${el.getAttribute('data-slot') ?? el.getAttribute('aria-label') ?? el.className}]`;
        const ownText = [...el.childNodes].some((node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim());
        if (ownText) out.push({ name: `${name} "${el.textContent?.trim().slice(0, 24)}"`, ...pair(el) });
        const entry =
          el instanceof HTMLTextAreaElement ||
          (el instanceof HTMLInputElement && /^(text|number|search|url|email|password)$/.test(el.type));
        if (entry) {
          if (el.value) out.push({ name: `${name} value`, ...pair(el) });
          if (el.placeholder && !el.value)
            out.push({ name: `${name} placeholder`, ...pair(el, getComputedStyle(el, '::placeholder').color) });
        }
      }
      return out;
    },
    { src: pairInPage.toString(), only },
  );
  expect(pairs.length, 'text found in scope').toBeGreaterThan(0);
  return pairs.filter(({ fg, bg }) => !fg || !bg || ratio(fg as Rgb, bg as Rgb) < min).map(({ name }) => name);
}

const SURFACE_DOC = ['# Title', '', '## Section', '', '```js', 'const a = 1;', '```', '', 'Body text.', ''].join('\n');

async function openSurfaceDoc(page: Page, extensionId: string, origin: string) {
  await page.goto(`chrome-extension://${extensionId}/reader.html?src=${encodeURIComponent(`${origin}/s.md`)}`);
  await expect(page.locator('.md-content h1')).toHaveText('Title', { timeout: 20000 });
  await expect(page.locator('.md-code-bar button')).toBeVisible();
}

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`forced ${scheme} theme on the new surfaces`, () => {
    for (const surface of ['popup', 'options'] as const) {
      test(`${surface} text meets 4.5:1 on every tab`, async ({ page, extensionId }) => {
        // The popup and options entrypoints do not apply the stored theme, so the OS scheme is what forces them.
        await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
        await page.goto(`chrome-extension://${extensionId}/${surface}.html`);
        await page.locator('#root > *').first().waitFor();
        for (const name of ['General', 'Appearance', 'Plugins', 'About']) {
          await page.getByRole('tab', { name }).click();
          expect(await lowContrast(page.getByRole('tabpanel')), `${scheme} ${surface} ${name}`).toEqual([]);
        }
        expect(await lowContrast(page.getByRole('tablist'), UI, '[role="tab"]'), `${scheme} ${surface} rail icons`).toEqual([]);
      });
    }

    test('reader dialog, menu, sidebar, search field, and Copy button meet 4.5:1', async ({ page, extensionId }) => {
      const { origin, close } = await startFixtureServer((_req, res) => {
        res.setHeader('content-type', 'text/markdown; charset=utf-8');
        res.end(SURFACE_DOC);
      });
      try {
        await openSurfaceDoc(page, extensionId, origin);
        await forceTheme(page, scheme);
        const sidebar = page.locator('[data-slot="reader-toc"]');
        expect(await lowContrast(sidebar), `${scheme} sidebar`).toEqual([]);
        await sidebar.getByRole('button', { name: 'Search' }).click();
        expect(await lowContrast(sidebar), `${scheme} sidebar search field`).toEqual([]);
        expect(await lowContrast(page.locator('.md-code-bar')), `${scheme} Copy bar`).toEqual([]);

        await page.getByRole('button', { name: 'Menu' }).click();
        expect(await lowContrast(page.getByRole('menu')), `${scheme} menu`).toEqual([]);
        await page.getByRole('menuitem', { name: 'Settings' }).click();
        const dialog = page.getByRole('dialog', { name: 'Settings' });
        for (const name of ['General', 'Appearance', 'Plugins', 'About']) {
          await dialog.getByRole('tab', { name }).click();
          expect(await lowContrast(dialog.getByRole('tabpanel')), `${scheme} dialog ${name}`).toEqual([]);
        }
        await page.keyboard.press('Escape');
        await page.getByRole('button', { name: 'Menu' }).click();
        await page.getByRole('menuitem', { name: 'About' }).click();
        expect(await lowContrast(page.getByRole('dialog', { name: 'About' })), `${scheme} About dialog`).toEqual([]);
      } finally {
        await close();
      }
    });
  });
}

// Axe-free: the browser's own accessibility tree, through CDP, so names come from the real computation.
const NAMED_ROLES = new Set([
  'button',
  'tab',
  'switch',
  'combobox',
  'slider',
  'checkbox',
  'radio',
  'textbox',
  'searchbox',
  'spinbutton',
  'menuitem',
  'link',
]);

async function unnamed(page: Page): Promise<string[]> {
  const cdp = await page.context().newCDPSession(page);
  try {
    const { nodes } = (await cdp.send('Accessibility.getFullAXTree')) as {
      nodes: Array<{ ignored?: boolean; role?: { value: string }; name?: { value: string } }>;
    };
    return nodes
      .filter((node) => !node.ignored && NAMED_ROLES.has(node.role?.value ?? '') && !node.name?.value?.trim())
      .map((node) => node.role?.value ?? '');
  } finally {
    await cdp.detach();
  }
}

test.describe('accessible names', () => {
  for (const surface of ['popup', 'options']) {
    test(`every rail tab, icon button, and control in ${surface}.html is named`, async ({ page, extensionId }) => {
      await page.goto(`chrome-extension://${extensionId}/${surface}.html`);
      await page.locator('#root > *').first().waitFor();
      expect(await page.getByRole('tab').count()).toBe(4);
      // The max width slider only renders while the custom width switch is on.
      await page.evaluate(() =>
        (globalThis as unknown as { chrome: { storage: { local: { set(items: object): Promise<void> } } } }).chrome.storage.local.set({
          'settings:v1': { version: 1, appearance: { customMaxWidth: true } },
        }),
      );
      for (const name of ['General', 'Appearance', 'Plugins', 'About']) {
        await page.getByRole('tab', { name }).click();
        expect(await unnamed(page), `${surface} ${name}`).toEqual([]);
      }
    });
  }

  test('the reader sidebar, menu, dialogs, and Copy buttons are named', async ({ page, extensionId }) => {
    const { origin, close } = await startFixtureServer((_req, res) => {
      res.setHeader('content-type', 'text/markdown; charset=utf-8');
      res.end(SURFACE_DOC);
    });
    try {
      await openSurfaceDoc(page, extensionId, origin);
      await page.getByRole('button', { name: 'Copy' }).waitFor();
      await page.locator('[data-slot="reader-toc"]').getByRole('button', { name: 'Search' }).click();
      expect(await unnamed(page), 'reader').toEqual([]);
      await page.getByRole('button', { name: 'Menu' }).click();
      expect(await unnamed(page), 'menu').toEqual([]);
      await page.getByRole('menuitem', { name: 'Settings' }).click();
      const dialog = page.getByRole('dialog', { name: 'Settings' });
      for (const name of ['General', 'Appearance', 'Plugins', 'About']) {
        await dialog.getByRole('tab', { name }).click();
        expect(await unnamed(page), `settings dialog ${name}`).toEqual([]);
      }
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: 'Menu' }).click();
      await page.getByRole('menuitem', { name: 'About' }).click();
      expect(await unnamed(page), 'About dialog').toEqual([]);
    } finally {
      await close();
    }
  });
});
