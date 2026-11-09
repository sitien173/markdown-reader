import { test, expect, startFixtureServer } from './fixtures';

const resolveColor = (page: import('@playwright/test').Page, expression: string) =>
  page.evaluate((value) => {
    const probe = document.createElement('span');
    probe.style.color = value;
    document.body.append(probe);
    const resolved = getComputedStyle(probe).color;
    probe.remove();
    return resolved;
  }, expression);

test('Base UI theme tokens resolve on the reader page and no legacy design-system token remains', async ({ page, extensionId }) => {
  await page.goto(`chrome-extension://${extensionId}/reader.html`);
  const primary = await resolveColor(page, 'var(--primary)');
  const ring = await resolveColor(page, 'var(--ring)');
  const background = await resolveColor(page, 'var(--background)');
  expect(primary).toBe('rgb(0, 102, 204)');
  expect(ring).toBe(primary);
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe(background);
  const leftovers = await page.evaluate(() =>
    ['--surface-neutral-01', '--interactive-default', '--color-neutral-100', '--text-default'].filter(
      (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() !== '',
    ),
  );
  expect(leftovers).toEqual([]);
});

test('semantic color utilities generate rules: the export menu paints the popover color', async ({ page, extensionId }) => {
  await page.goto(`chrome-extension://${extensionId}/reader.html`);
  await page.getByRole('button', { name: 'Menu' }).click();
  const menu = page.getByRole('menu');
  await expect(menu).toBeVisible();
  const popover = await resolveColor(page, 'var(--popover)');
  expect(await menu.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(popover);
});

const themedDoc = '# Themed\n\n```js\nconst answer = 42;\n```\n\n```mermaid\ngraph TD\n  A --> B\n```\n';

async function withThemedDoc(
  page: import('@playwright/test').Page,
  extensionId: string,
  scheme: 'light' | 'dark',
  run: () => Promise<void>,
) {
  const { origin, close } = await startFixtureServer((_req, res) => {
    res.setHeader('content-type', 'text/markdown; charset=utf-8');
    res.end(themedDoc);
  });
  try {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto(`chrome-extension://${extensionId}/reader.html?src=${encodeURIComponent(`${origin}/themed.md`)}`);
    await expect(page.locator('.md-content .shiki').first()).toBeVisible({ timeout: 20000 });
    await expect(page.locator('.md-content .md-diagram svg').first()).toBeVisible({ timeout: 20000 });
    await run();
  } finally {
    await close();
  }
}

const surfaces = (page: import('@playwright/test').Page) =>
  page.evaluate(() => {
    const color = (el: Element | null, property: 'color' | 'backgroundColor' | 'fill') => (el ? getComputedStyle(el)[property] : '');
    return {
      body: color(document.body, 'backgroundColor'),
      codeBackground: color(document.querySelector('.md-content pre.shiki'), 'backgroundColor'),
      codeToken: color(document.querySelector('.md-content pre.shiki code span'), 'color'),
      diagramFill: color(document.querySelector('.md-content .md-diagram svg .node rect'), 'fill'),
    };
  });

for (const scheme of ['light', 'dark'] as const) {
  test(`body, code tokens, and Mermaid fill match the ${scheme} scheme on load`, async ({ page, extensionId }) => {
    await withThemedDoc(page, extensionId, scheme, async () => {
      const seen = await surfaces(page);
      expect(seen.body).toBe(await resolveColor(page, 'var(--background)'));
      expect(seen.body).toBe(scheme === 'dark' ? 'rgb(28, 28, 30)' : 'rgb(255, 255, 255)');
      expect(seen.diagramFill).toBe(await resolveColor(page, 'var(--muted)'));
      expect(seen.codeBackground).toBe(scheme === 'dark' ? 'rgb(36, 41, 46)' : 'rgb(255, 255, 255)');
    });
  });
}

test('code token and diagram colors differ between schemes, and a scheme change after load rerenders diagrams without reload', async ({
  page,
  extensionId,
}) => {
  await withThemedDoc(page, extensionId, 'light', async () => {
    await page.evaluate(() => {
      (window as unknown as { __loaded: boolean }).__loaded = true;
    });
    const light = await surfaces(page);
    await page.emulateMedia({ colorScheme: 'dark' });
    await expect.poll(async () => (await surfaces(page)).diagramFill).not.toBe(light.diagramFill);
    const dark = await surfaces(page);
    expect(dark.body).not.toBe(light.body);
    expect(dark.codeToken).not.toBe(light.codeToken);
    expect(dark.diagramFill).toBe(await resolveColor(page, 'var(--muted)'));
    expect(await page.evaluate(() => (window as unknown as { __loaded?: boolean }).__loaded)).toBe(true);
    await expect(page.locator('.md-content .md-diagram-screen svg')).toHaveCount(1);
    await expect(page.locator('.md-content .md-diagram-print svg')).toHaveCount(1);
    expect(
      await page
        .locator('[id^="markdown-diagram-"], [id^="dmarkdown-diagram-"]')
        .evaluateAll((nodes) => nodes.filter((node) => !node.closest('.md-content')).length),
    ).toBe(0);
    await page.emulateMedia({ colorScheme: 'light' });
    await expect.poll(async () => (await surfaces(page)).diagramFill).toBe(light.diagramFill);
  });
});

test('print emulation shows light tokens in the dark scheme', async ({ page, extensionId }) => {
  await withThemedDoc(page, extensionId, 'dark', async () => {
    const dark = await surfaces(page);
    await page.emulateMedia({ colorScheme: 'dark', media: 'print' });
    const printed = await surfaces(page);
    expect(printed.body).toBe('rgb(255, 255, 255)');
    expect(printed.codeToken).not.toBe(dark.codeToken);
    expect(printed.codeBackground).toBe('rgb(255, 255, 255)');
    const printFill = await page.evaluate(() => {
      const visible = Array.from(document.querySelectorAll<SVGElement>('.md-content .md-diagram svg')).filter(
        (svg) => svg.getBoundingClientRect().width > 0,
      );
      return { count: visible.length, fill: getComputedStyle(visible[0]!.querySelector('.node rect')!).fill };
    });
    expect(printFill.count).toBe(1);
    expect(printFill.fill).toBe('rgb(245, 245, 247)');
    expect(printFill.fill).not.toBe(dark.diagramFill);
    expect(await resolveColor(page, 'var(--foreground)')).toBe('rgb(29, 29, 31)');
  });
});

type Appearance = Record<string, unknown>;
// Writes through storage.local, so the open reader receives the change through its onChanged listener and is never reloaded.
const setAppearance = (page: import('@playwright/test').Page, appearance: Appearance) =>
  page.evaluate(
    (value) =>
      (globalThis as unknown as { chrome: { storage: { local: { set(items: object): Promise<void> } } } }).chrome.storage.local.set({
        'settings:v1': { version: 1, appearance: value },
      }),
    appearance,
  );

const LIGHT_BG = 'rgb(255, 255, 255)';
const DARK_BG = 'rgb(28, 28, 30)';

test('Light forces light tokens in a dark system', async ({ page, extensionId }) => {
  await withThemedDoc(page, extensionId, 'dark', async () => {
    expect((await surfaces(page)).body).toBe(DARK_BG);
    const darkFill = (await surfaces(page)).diagramFill;
    await setAppearance(page, { theme: 'light' });
    await expect.poll(async () => (await surfaces(page)).body).toBe(LIGHT_BG);
    expect(await page.evaluate(() => document.documentElement.getAttribute('data-theme'))).toBe('light');
    expect(await resolveColor(page, 'var(--foreground)')).toBe('rgb(29, 29, 31)');
    await expect.poll(async () => (await surfaces(page)).diagramFill).not.toBe(darkFill);
    expect((await surfaces(page)).diagramFill).toBe(await resolveColor(page, 'var(--muted)'));
  });
});

test('Dark forces dark tokens in a light system and Mermaid redraws in dark', async ({ page, extensionId }) => {
  await withThemedDoc(page, extensionId, 'light', async () => {
    const light = await surfaces(page);
    expect(light.body).toBe(LIGHT_BG);
    await setAppearance(page, { theme: 'dark' });
    await expect.poll(async () => (await surfaces(page)).body).toBe(DARK_BG);
    expect(await resolveColor(page, 'var(--foreground)')).toBe('rgb(245, 245, 247)');
    await expect.poll(async () => (await surfaces(page)).diagramFill).not.toBe(light.diagramFill);
    expect((await surfaces(page)).diagramFill).toBe(await resolveColor(page, 'var(--muted)'));
  });
});

test('Auto follows the system and removes data-theme', async ({ page, extensionId }) => {
  await withThemedDoc(page, extensionId, 'light', async () => {
    await setAppearance(page, { theme: 'dark' });
    await expect.poll(async () => (await surfaces(page)).body).toBe(DARK_BG);
    await setAppearance(page, { theme: 'auto' });
    await expect.poll(async () => (await surfaces(page)).body).toBe(LIGHT_BG);
    expect(await page.evaluate(() => document.documentElement.hasAttribute('data-theme'))).toBe(false);
    await page.emulateMedia({ colorScheme: 'dark' });
    await expect.poll(async () => (await surfaces(page)).body).toBe(DARK_BG);
  });
});

test('print stays light when the theme is forced dark', async ({ page, extensionId }) => {
  await withThemedDoc(page, extensionId, 'light', async () => {
    await setAppearance(page, { theme: 'dark' });
    await expect.poll(async () => (await surfaces(page)).body).toBe(DARK_BG);
    await page.emulateMedia({ colorScheme: 'light', media: 'print' });
    expect((await surfaces(page)).body).toBe(LIGHT_BG);
  });
});
