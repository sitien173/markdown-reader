import type { Page } from '@playwright/test';
import { test, expect, startFixtureServer } from './fixtures';

const exitButton = (page: Page) => page.getByRole('button', { name: 'Exit focus mode' });
const isFullscreen = (page: Page) => page.evaluate(() => document.fullscreenElement !== null);

async function openZenDoc(page: Page, extensionId: string, origin: string) {
  await page.goto(`chrome-extension://${extensionId}/reader.html?src=${encodeURIComponent(`${origin}/zen.md`)}`);
  await expect(page.locator('.md-content h1')).toHaveText('Zen', { timeout: 20000 });
  await page.evaluate(() =>
    (globalThis as unknown as { chrome: { storage: { local: { set(items: object): Promise<void> } } } }).chrome.storage.local.set({
      'settings:v1': { version: 1, appearance: { zen: true } },
    }),
  );
  await expect(exitButton(page)).toBeVisible();
}

// Runs the palette command from the keyboard, which is the user gesture requestFullscreen needs.
async function toggleFullscreen(page: Page) {
  await page.keyboard.press('Control+k');
  await page.getByRole('dialog', { name: 'Command palette' }).getByRole('combobox').fill('Toggle Fullscreen');
  await page.keyboard.press('Enter');
}

test.describe('Escape in Zen mode', () => {
  let server: Awaited<ReturnType<typeof startFixtureServer>>;
  test.beforeEach(async () => {
    server = await startFixtureServer((_req, res) => {
      res.setHeader('content-type', 'text/markdown; charset=utf-8');
      res.end('# Zen\n\nBody.\n');
    });
  });
  test.afterEach(async () => {
    await server.close();
  });

  test('Escape in browser fullscreen leaves fullscreen and keeps Zen on', async ({ page, extensionId }) => {
    await openZenDoc(page, extensionId, server.origin);
    await toggleFullscreen(page);
    await expect.poll(() => isFullscreen(page)).toBe(true);
    await page.keyboard.press('Escape');
    await expect.poll(() => isFullscreen(page)).toBe(false);
    await expect(exitButton(page)).toBeVisible();
    await expect(page.locator('main.reader')).toHaveAttribute('data-focus', 'true');
  });

  test('Escape in fullscreen with the palette open closes only the palette', async ({ page, extensionId }) => {
    await openZenDoc(page, extensionId, server.origin);
    const palette = page.getByRole('dialog', { name: 'Command palette' });
    const changes = () => page.evaluate(() => (window as unknown as { fullscreenChanges: number }).fullscreenChanges);
    await page.evaluate(() => {
      const w = window as unknown as { fullscreenChanges: number };
      w.fullscreenChanges = 0;
      document.addEventListener('fullscreenchange', () => w.fullscreenChanges++);
    });
    await toggleFullscreen(page);
    await expect.poll(() => isFullscreen(page)).toBe(true);
    // The enter event can arrive after fullscreenElement is set; the baseline is taken once it has.
    await expect.poll(changes).toBe(1);
    // The palette that ran the command must be fully gone: Escape on a closing dialog is not an open-dialog Escape.
    await expect(palette).toHaveCount(0);
    await page.keyboard.press('Control+k');
    await expect(palette).toBeVisible();
    await expect(palette.getByRole('combobox')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(palette).toHaveCount(0);
    // Let any late fullscreenchange or Zen exit land before reading the final state.
    await page.waitForTimeout(500);
    expect(await changes()).toBe(1);
    expect(await isFullscreen(page)).toBe(true);
    await expect(exitButton(page)).toBeVisible();
    await expect(page.locator('main.reader')).toHaveAttribute('data-focus', 'true');
  });

  test('an Escape delivered right after the browser left fullscreen keeps Zen, and a later Escape leaves it', async ({
    page,
    extensionId,
  }) => {
    await openZenDoc(page, extensionId, server.origin);
    await toggleFullscreen(page);
    await expect.poll(() => isFullscreen(page)).toBe(true);
    // exitFullscreen resolves before fullscreenchange is dispatched, so wait for the event to model a browser that exits first.
    await page.evaluate(async () => {
      const left = new Promise<void>((resolve) => document.addEventListener('fullscreenchange', () => resolve(), { once: true }));
      await document.exitFullscreen();
      await left;
    });
    await page.keyboard.press('Escape');
    await expect(exitButton(page)).toBeVisible();
    await page.waitForTimeout(500);
    await page.keyboard.press('Escape');
    await expect(exitButton(page)).toHaveCount(0);
  });

  test('Escape with no fullscreen and no dialog leaves Zen for the session only', async ({ page, extensionId }) => {
    await openZenDoc(page, extensionId, server.origin);
    expect(await isFullscreen(page)).toBe(false);
    await page.keyboard.press('Escape');
    await expect(exitButton(page)).toHaveCount(0);
    await expect(page.locator('main.reader')).toHaveAttribute('data-focus', 'false');
    const stored = await page.evaluate(async () => {
      const { chrome } = globalThis as unknown as {
        chrome: { storage: { local: { get(key: string): Promise<Record<string, { appearance?: { zen?: boolean } }>> } } };
      };
      return (await chrome.storage.local.get('settings:v1'))['settings:v1']?.appearance?.zen;
    });
    expect(stored).toBe(true);
  });
});
