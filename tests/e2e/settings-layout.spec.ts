import type { Locator, Page } from '@playwright/test';
import { test, expect } from './fixtures';

const url = (extensionId: string, page: string) => `chrome-extension://${extensionId}/${page}`;
const tabs = ['General', 'Appearance', 'Plugins', 'About'];
const longRecentUrl = `file:///home/user/Downloads/${'nested-folder/'.repeat(8)}report.md`;

type ChromeWindow = Window & { chrome: { storage: { local: { set(items: object): Promise<void> } } } };

async function boxOf(locator: Locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error('element has no bounding box');
  return box;
}

async function openDialog(page: Page, extensionId: string) {
  await page.goto(url(extensionId, 'reader.html'));
  await page.locator('#root > *').first().waitFor();
  await page.keyboard.press('Control+K');
  await page.getByRole('dialog', { name: 'Command palette' }).getByRole('option', { name: 'Settings' }).click();
  const dialog = page.getByRole('dialog', { name: 'Settings' });
  await expect(dialog).toBeVisible();
  // Measure after the open transition: it scales the dialog from 95%.
  await dialog.evaluate((el) => Promise.all(el.getAnimations().map((animation) => animation.finished)));
  return dialog;
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
});

test('settings rail stacks its tabs in a column', async ({ page, extensionId }) => {
  await page.goto(url(extensionId, 'options.html'));
  await expect(page.getByRole('tablist', { name: 'Settings sections' })).toHaveCSS('flex-direction', 'column');
});

test('settings rail spans the full panel height', async ({ page, extensionId }) => {
  await page.goto(url(extensionId, 'options.html'));
  const railBox = await boxOf(page.getByRole('tablist', { name: 'Settings sections' }));
  const mainBox = await boxOf(page.locator('main'));
  expect(railBox.height).toBeGreaterThanOrEqual(mainBox.height - 2);
});

test('reader dialog tab panel scrolls within the dialog height', async ({ page, extensionId }) => {
  const dialog = await openDialog(page, extensionId);
  const dialogBox = await boxOf(dialog);
  const panelBox = await boxOf(dialog.getByRole('tabpanel'));
  expect(panelBox.height).toBeLessThanOrEqual(dialogBox.height);
});

test('text size slider draws a visible track', async ({ page, extensionId }) => {
  await page.goto(url(extensionId, 'options.html'));
  await page.getByRole('tab', { name: 'Appearance' }).click();
  await expect(page.locator('[data-slot="slider-track"]').first()).toHaveCSS('height', '4px');
});

test('settings panel border uses the border token', async ({ page, extensionId }) => {
  await page.goto(url(extensionId, 'options.html'));
  await expect(page.locator('main')).toHaveCSS('border-top-color', 'rgb(217, 217, 222)');
});

test('reader dialog keeps General controls inside the dialog with a long recent URL', async ({ page, extensionId }) => {
  await page.goto(url(extensionId, 'reader.html'));
  await page.evaluate((recent) => (window as unknown as ChromeWindow).chrome.storage.local.set({ recentUrls: [recent] }), longRecentUrl);
  const dialog = await openDialog(page, extensionId);
  await expect(dialog.getByRole('button', { name: longRecentUrl })).toBeVisible();
  const dialogBox = await boxOf(dialog);
  const switchBox = await boxOf(dialog.getByRole('switch', { name: 'Enable', exact: true }));
  expect(switchBox.x + switchBox.width).toBeLessThanOrEqual(dialogBox.x + dialogBox.width);
});

test('Render current tab appears on the options page but not in the reader dialog', async ({ page, extensionId }) => {
  await page.goto(url(extensionId, 'options.html'));
  await expect(page.getByRole('button', { name: 'Render current tab' })).toBeVisible();
  const dialog = await openDialog(page, extensionId);
  await expect(dialog.getByRole('button', { name: 'Open viewer' })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Render current tab' })).toHaveCount(0);
});

for (const page_ of ['options.html', 'popup.html']) {
  test(`${page_} shows the full Render current tab label`, async ({ page, extensionId }) => {
    await page.goto(url(extensionId, page_));
    const button = page.getByRole('button', { name: 'Render current tab' });
    await expect(button).toBeVisible();
    expect(await button.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(0);
  });
}

for (const name of tabs) {
  test(`options page ${name} tab matches its screenshot`, async ({ page, extensionId }) => {
    await page.goto(url(extensionId, 'options.html'));
    await page.getByRole('tab', { name }).click();
    await expect(page.locator('main')).toHaveScreenshot(`options-${name.toLowerCase()}.png`);
  });

  test(`reader dialog ${name} tab matches its screenshot`, async ({ page, extensionId }) => {
    const dialog = await openDialog(page, extensionId);
    await dialog.getByRole('tab', { name }).click();
    await expect(dialog).toHaveScreenshot(`dialog-${name.toLowerCase()}.png`);
  });
}
