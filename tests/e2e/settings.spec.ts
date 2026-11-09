import { test, expect } from './fixtures';

const url = (extensionId: string, page: string) => `chrome-extension://${extensionId}/${page}`;

test('options page shows the settings panel', async ({ page, extensionId }) => {
  await page.goto(url(extensionId, 'options.html'));
  const rail = page.getByRole('tablist', { name: 'Settings sections' });
  await expect(rail.getByRole('tab')).toHaveCount(4);
  for (const name of ['General', 'Appearance', 'Plugins', 'About']) await expect(rail.getByRole('tab', { name })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reset settings' })).toBeVisible();
});

test('popup is 520 by 480 px and shows the panel', async ({ page, extensionId }) => {
  await page.setViewportSize({ width: 800, height: 700 });
  await page.goto(url(extensionId, 'popup.html'));
  await expect(page.getByRole('tab', { name: 'General' })).toBeVisible();
  const box = await page.locator('.popup').boundingBox();
  expect(box?.width).toBe(520);
  expect(box?.height).toBe(480);
});

test('reader dialog opens from the settings palette command and closes on Escape', async ({ page, extensionId }) => {
  await page.goto(url(extensionId, 'reader.html'));
  await page.locator('#root > *').first().waitFor();
  await page.keyboard.press('Control+K');
  const palette = page.getByRole('dialog', { name: 'Command palette' });
  await expect(palette).toBeVisible();
  await palette.getByRole('option', { name: 'Settings' }).click();
  const dialog = page.getByRole('dialog', { name: 'Settings' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('tab', { name: 'About' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
});
