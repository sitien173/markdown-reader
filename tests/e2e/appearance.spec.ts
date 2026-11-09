import type { Page } from '@playwright/test';
import { test, expect, startFixtureServer } from './fixtures';

const doc = '# Appearance\n\n```js\nconst answer = 42;\n```\n\n```mermaid\ngraph TD\n  A --> B\n```\n';

type Appearance = Record<string, unknown>;
// Writes through storage.local, so the open reader receives the change through its onChanged listener and is never reloaded.
const setAppearance = (page: Page, appearance: Appearance) =>
  page.evaluate(
    (value) =>
      (globalThis as unknown as { chrome: { storage: { local: { set(items: object): Promise<void> } } } }).chrome.storage.local.set({
        'settings:v1': { version: 1, appearance: value },
      }),
    appearance,
  );

async function withDoc(page: Page, extensionId: string, scheme: 'light' | 'dark', run: () => Promise<void>, body = doc) {
  const { origin, close } = await startFixtureServer((_req, res) => {
    res.setHeader('content-type', 'text/markdown; charset=utf-8');
    res.end(body);
  });
  try {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto(`chrome-extension://${extensionId}/reader.html?src=${encodeURIComponent(`${origin}/doc.md`)}`);
    await expect(page.locator('.md-content .shiki').first()).toBeVisible({ timeout: 20000 });
    if (body.includes('mermaid')) await expect(page.locator('.md-content .md-diagram svg').first()).toBeVisible({ timeout: 20000 });
    await run();
  } finally {
    await close();
  }
}

const code = (page: Page) =>
  page.evaluate(() => {
    const pre = document.querySelector('.md-content pre.shiki');
    const token = document.querySelector('.md-content pre.shiki code span');
    return {
      background: pre ? getComputedStyle(pre).backgroundColor : '',
      token: token ? getComputedStyle(token).color : '',
    };
  });
const diagramFill = (page: Page) =>
  page.evaluate(() => {
    const rect = document.querySelector('.md-content .md-diagram svg .node rect');
    return rect ? getComputedStyle(rect).fill : '';
  });

const GITHUB_LIGHT_BG = 'rgb(255, 255, 255)';
const GITHUB_DARK_BG = 'rgb(36, 41, 46)';

test.describe('code theme', () => {
  test('light mode follows the code theme for light mode, and dark mode ignores it', async ({ page, extensionId }) => {
    await withDoc(page, extensionId, 'light', async () => {
      const lightToken = (await code(page)).token;
      expect((await code(page)).background).toBe(GITHUB_LIGHT_BG);
      await setAppearance(page, { codeThemeLight: 'dark' });
      await expect.poll(async () => (await code(page)).background).toBe(GITHUB_DARK_BG);
      expect((await code(page)).token).not.toBe(lightToken);
      await setAppearance(page, { codeThemeLight: 'light', codeThemeDark: 'light' });
      await expect.poll(async () => (await code(page)).background).toBe(GITHUB_LIGHT_BG);
      expect((await code(page)).token).toBe(lightToken);
    });
  });

  test('dark mode follows the code theme for dark mode, and light mode ignores it', async ({ page, extensionId }) => {
    await withDoc(page, extensionId, 'dark', async () => {
      const darkToken = (await code(page)).token;
      expect((await code(page)).background).toBe(GITHUB_DARK_BG);
      await setAppearance(page, { codeThemeDark: 'light' });
      await expect.poll(async () => (await code(page)).background).toBe(GITHUB_LIGHT_BG);
      expect((await code(page)).token).not.toBe(darkToken);
      await setAppearance(page, { codeThemeDark: 'dark', codeThemeLight: 'dark' });
      await expect.poll(async () => (await code(page)).background).toBe(GITHUB_DARK_BG);
    });
  });

  test('forced theme selects the matching code theme value', async ({ page, extensionId }) => {
    await withDoc(page, extensionId, 'dark', async () => {
      await setAppearance(page, { theme: 'light', codeThemeLight: 'dark', codeThemeDark: 'light' });
      await expect.poll(async () => (await code(page)).background).toBe(GITHUB_DARK_BG);
      await setAppearance(page, { theme: 'dark', codeThemeLight: 'dark', codeThemeDark: 'light' });
      await expect.poll(async () => (await code(page)).background).toBe(GITHUB_LIGHT_BG);
    });
  });

  test('changing the code theme does not rerender or change the Mermaid output', async ({ page, extensionId }) => {
    await withDoc(page, extensionId, 'light', async () => {
      const before = await page.locator('.md-content .md-diagram-screen svg').evaluate((svg) => svg.outerHTML);
      const fill = await diagramFill(page);
      await page.evaluate(() => {
        (window as unknown as { __svg: Element | null }).__svg = document.querySelector('.md-content .md-diagram-screen svg');
      });
      await setAppearance(page, { codeThemeLight: 'dark' });
      await expect.poll(async () => (await code(page)).background).toBe(GITHUB_DARK_BG);
      expect(await page.locator('.md-content .md-diagram-screen svg').evaluate((svg) => svg.outerHTML)).toBe(before);
      expect(await diagramFill(page)).toBe(fill);
      expect(
        await page.evaluate(
          () => (window as unknown as { __svg: Element | null }).__svg === document.querySelector('.md-content .md-diagram-screen svg'),
        ),
      ).toBe(true);
    });
  });

  for (const [scheme, key, background] of [
    ['light', 'codeThemeLight', GITHUB_DARK_BG],
    ['dark', 'codeThemeDark', GITHUB_LIGHT_BG],
  ] as const) {
    test(`changing ${key} leaves the Mermaid SVG markup and id unchanged`, async ({ page, extensionId }) => {
      await withDoc(page, extensionId, scheme, async () => {
        const svg = page.locator('.md-content .md-diagram-screen svg');
        const before = await svg.evaluate((el) => ({ id: el.id, html: el.outerHTML }));
        expect(before.id).not.toBe('');
        await setAppearance(page, { [key]: scheme === 'light' ? 'dark' : 'light' });
        await expect.poll(async () => (await code(page)).background).toBe(background);
        expect(await svg.evaluate((el) => ({ id: el.id, html: el.outerHTML }))).toEqual(before);
      });
    });
  }

  test('print stays light with a dark code theme', async ({ page, extensionId }) => {
    await withDoc(page, extensionId, 'light', async () => {
      await setAppearance(page, { codeThemeLight: 'dark' });
      await expect.poll(async () => (await code(page)).background).toBe(GITHUB_DARK_BG);
      await page.emulateMedia({ colorScheme: 'light', media: 'print' });
      expect((await code(page)).background).toBe(GITHUB_LIGHT_BG);
    });
  });
});

const longLine = 'x'.repeat(400);
const layoutDoc = `# Layout\n\nBody text.\n\n\`\`\`js\nconst value = "${longLine}";\n\`\`\`\n\n| ${Array.from({ length: 14 }, (_, i) => `Column header ${i}`).join(' | ')} |\n| ${Array.from({ length: 14 }, () => '---').join(' | ')} |\n| ${Array.from({ length: 14 }, (_, i) => `cell value ${i}`).join(' | ')} |\n`;

const box = (page: Page, selector: string) =>
  page
    .locator(selector)
    .first()
    .evaluate((el) => {
      const rect = el.getBoundingClientRect();
      return { left: rect.left, width: rect.width };
    });
const style = (page: Page, selector: string, property: string) =>
  page
    .locator(selector)
    .first()
    .evaluate((el, prop) => getComputedStyle(el).getPropertyValue(prop), property);

test.describe('text, font, and layout', () => {
  test('text size scales the rendered content and not the sidebar, and applies live', async ({ page, extensionId }) => {
    await withDoc(
      page,
      extensionId,
      'light',
      async () => {
        expect(await style(page, '.md-content', 'font-size')).toBe('16px');
        const sidebar = await style(page, '.reader-toc', 'font-size');
        const h1 = parseFloat(await style(page, '.md-content h1', 'font-size'));
        await setAppearance(page, { textSize: 6 });
        await expect.poll(() => style(page, '.md-content', 'font-size')).toBe('20px');
        expect(parseFloat(await style(page, '.md-content h1', 'font-size'))).toBeCloseTo(h1 * 1.25, 1);
        expect(await style(page, '.reader-toc', 'font-size')).toBe(sidebar);
        await setAppearance(page, { textSize: 1 });
        await expect.poll(() => style(page, '.md-content', 'font-size')).toBe('14px');
      },
      layoutDoc,
    );
  });

  test('font select changes the content font family', async ({ page, extensionId }) => {
    await withDoc(
      page,
      extensionId,
      'light',
      async () => {
        const initial = await style(page, '.md-content p', 'font-family');
        await setAppearance(page, { font: 'serif' });
        await expect.poll(() => style(page, '.md-content p', 'font-family')).toContain('Georgia');
        await expect.poll(() => style(page, '.md-content h1', 'font-family')).toContain('Georgia');
        await setAppearance(page, { font: 'mono' });
        await expect.poll(() => style(page, '.md-content p', 'font-family')).toContain('monospace');
        await setAppearance(page, { font: 'default' });
        await expect.poll(() => style(page, '.md-content p', 'font-family')).toBe(initial);
      },
      layoutDoc,
    );
  });

  test('wrap code lines wraps the pre instead of scrolling', async ({ page, extensionId }) => {
    await withDoc(
      page,
      extensionId,
      'light',
      async () => {
        const scrolls = () => page.locator('.md-content pre.shiki').evaluate((pre) => pre.scrollWidth > pre.clientWidth);
        expect(await scrolls()).toBe(true);
        await setAppearance(page, { wrapCode: true });
        await expect.poll(scrolls).toBe(false);
        await setAppearance(page, { wrapCode: false });
        await expect.poll(scrolls).toBe(true);
      },
      layoutDoc,
    );
  });

  test('wide tables extend past the text column', async ({ page, extensionId }) => {
    await withDoc(
      page,
      extensionId,
      'light',
      async () => {
        const tableWidth = async () => (await box(page, '.md-content table')).width;
        const column = async () => (await box(page, '.md-content')).width;
        expect(await tableWidth()).toBeLessThanOrEqual(await column());
        await setAppearance(page, { wideTables: true });
        await expect.poll(async () => (await tableWidth()) > (await column())).toBe(true);
        await setAppearance(page, { wideTables: false });
        await expect.poll(async () => (await tableWidth()) <= (await column())).toBe(true);
      },
      layoutDoc,
    );
  });

  test('centered off aligns the column left, and custom max width sets the column width', async ({ page, extensionId }) => {
    await page.setViewportSize({ width: 1600, height: 800 });
    await withDoc(
      page,
      extensionId,
      'light',
      async () => {
        const centered = await box(page, '.md-content');
        expect(centered.width).toBe(896);
        await setAppearance(page, { centered: false });
        await expect.poll(async () => (await box(page, '.md-content')).left).toBeLessThan(centered.left);
        await setAppearance(page, { centered: true, customMaxWidth: true, maxWidthPx: 600 });
        await expect.poll(async () => (await box(page, '.md-content')).width).toBe(600);
        await setAppearance(page, { centered: true, customMaxWidth: true, maxWidthPx: 100 });
        await expect.poll(async () => (await box(page, '.md-content')).width).toBe(500);
        await setAppearance(page, { centered: true, customMaxWidth: false });
        await expect.poll(async () => (await box(page, '.md-content')).width).toBe(896);
      },
      layoutDoc,
    );
  });
});

test.describe('custom CSS', () => {
  test('rejected custom CSS shows an inline alert and keeps the previous stylesheet applied', async ({ page, extensionId }) => {
    await withDoc(page, extensionId, 'light', async () => {
      await setAppearance(page, { customCssEnabled: true });
      await page.getByRole('button', { name: 'Menu' }).click();
      await page.getByRole('menuitem', { name: 'Settings' }).click();
      const settings = page.getByRole('dialog', { name: 'Settings' });
      await settings.getByRole('tab', { name: 'Appearance' }).click();
      const field = settings.getByRole('textbox', { name: 'Custom CSS stylesheet' });
      const h1 = page.locator('.md-content h1');

      await field.fill('.md-content h1 { color: rgb(1, 2, 3); }');
      await settings.getByRole('button', { name: 'Apply' }).click();
      await expect(h1).toHaveCSS('color', 'rgb(1, 2, 3)');
      await expect(settings.getByRole('alert')).toHaveCount(0);

      await field.fill('body { background: url(x) }');
      await settings.getByRole('button', { name: 'Apply' }).click();
      await expect(settings.getByRole('alert')).toBeVisible();
      await expect(field).toHaveAttribute('aria-invalid', 'true');
      await expect(h1).toHaveCSS('color', 'rgb(1, 2, 3)');
    });
  });
});

test.describe('Zen mode', () => {
  const zenOn = (page: Page) => expect(page.getByRole('button', { name: 'Exit focus mode' })).toBeVisible();
  const zenOff = (page: Page) => expect(page.getByRole('button', { name: 'Exit focus mode' })).toHaveCount(0);
  const storedZen = (page: Page) =>
    page.evaluate(async () => {
      const stored = await (
        globalThis as unknown as {
          chrome: { storage: { local: { get(key: string): Promise<Record<string, { appearance?: { zen?: boolean } }>> } } };
        }
      ).chrome.storage.local.get('settings:v1');
      return stored['settings:v1']?.appearance?.zen;
    });

  test('starts on when stored, and Escape leaves the session only', async ({ page, extensionId }) => {
    await withDoc(
      page,
      extensionId,
      'light',
      async () => {
        await setAppearance(page, { zen: true });
        await zenOn(page);
        await page.reload();
        await page.locator('#root > *').first().waitFor();
        await zenOn(page);
        await page.keyboard.press('Escape');
        await zenOff(page);
        expect(await storedZen(page)).toBe(true);
        await page.reload();
        await page.locator('#root > *').first().waitFor();
        await zenOn(page);
      },
      layoutDoc,
    );
  });

  test('the stored value applies live in both directions', async ({ page, extensionId }) => {
    await withDoc(
      page,
      extensionId,
      'light',
      async () => {
        await zenOff(page);
        await setAppearance(page, { zen: true });
        await zenOn(page);
        await setAppearance(page, { zen: false });
        await zenOff(page);
      },
      layoutDoc,
    );
  });
});
