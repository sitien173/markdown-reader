import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';

type PickerWindow = { showOpenFilePicker: () => Promise<unknown[]> };

const readerUrl = (extensionId: string, query = '') => `chrome-extension://${extensionId}/reader.html${query}`;
const header = (page: Page) => page.locator('[data-slot="reader-bar"]');

// Opens a writable document through Mod+O with the picker stubbed, so no top bar control is needed.
async function openDoc(page: Page) {
  await page.evaluate(async () => {
    const root = await navigator.storage.getDirectory();
    const handle = await root.getFileHandle('modes-doc.md', { create: true });
    const writable = await handle.createWritable();
    await writable.write('# Modes doc\n\nBody.\n');
    await writable.close();
    (window as unknown as PickerWindow).showOpenFilePicker = async () => [handle];
  });
  await page.keyboard.press('Control+o');
  await expect(page.locator('.md-content h1, .cm-content').first()).toBeVisible({ timeout: 20000 });
}

async function openMenuItem(page: Page, name: string) {
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('menuitem', { name }).click();
}

test.describe('edit and split header', () => {
  test('edit mode shows the compact header with title, Save, and the Read, Edit, Split radio group', async ({ page, extensionId }) => {
    await page.goto(readerUrl(extensionId, '?mode=edit'));
    await page.locator('#root > *').first().waitFor();
    await openDoc(page);
    await expect(header(page)).toBeVisible();
    await expect(header(page).getByText('modes-doc.md')).toBeVisible();
    await expect(header(page).getByRole('button', { name: 'Save' })).toBeVisible();
    const group = header(page).getByRole('radiogroup', { name: 'Reader mode' });
    await expect(group.getByRole('radio')).toHaveText(['Read', 'Edit', 'Split']);
    await expect(group.getByRole('radio', { name: 'Edit' })).toHaveAttribute('aria-checked', 'true');
    await expect(group.getByRole('radio', { name: 'Read' })).toHaveAttribute('aria-checked', 'false');
    for (const name of ['Open', 'Export options', 'Command palette', 'Toggle sidebar']) {
      await expect(header(page).getByRole('button', { name })).toHaveCount(0);
    }
    await expect(page.getByRole('button', { name: 'Toggle sidebar' })).toHaveCount(1);
  });

  test('the dirty dot follows the store after an edit and clears after Save', async ({ page, extensionId }) => {
    await page.goto(readerUrl(extensionId, '?mode=edit'));
    await page.locator('#root > *').first().waitFor();
    await openDoc(page);
    await expect(header(page).locator('.reader-dirty-dot')).toHaveCount(0);
    await page.locator('.cm-content').click();
    await page.keyboard.type('more');
    await expect(header(page).locator('.reader-dirty-dot')).toHaveCount(1);
    await header(page).getByRole('button', { name: 'Save' }).click();
    await expect(header(page).locator('.reader-dirty-dot')).toHaveCount(0);
  });

  test('split mode shows the same header with Split checked', async ({ page, extensionId }) => {
    await page.goto(readerUrl(extensionId, '?mode=split'));
    await page.locator('#root > *').first().waitFor();
    await openDoc(page);
    const group = header(page).getByRole('radiogroup', { name: 'Reader mode' });
    await expect(group.getByRole('radio', { name: 'Split' })).toHaveAttribute('aria-checked', 'true');
    await group.getByRole('radio', { name: 'Read' }).click();
    await expect(header(page)).toHaveCount(0);
  });
});

test.describe('menu commands', () => {
  test('Toggle Raw switches between read and edit', async ({ page, extensionId }) => {
    await page.goto(readerUrl(extensionId));
    await page.locator('#root > *').first().waitFor();
    await openDoc(page);
    await expect(header(page)).toHaveCount(0);
    await openMenuItem(page, 'Toggle Raw');
    await expect(header(page).getByRole('radio', { name: 'Edit' })).toHaveAttribute('aria-checked', 'true');
    await openMenuItem(page, 'Toggle Raw');
    await expect(header(page)).toHaveCount(0);
  });

  test('a refused fullscreen request shows a toast', async ({ page, extensionId }) => {
    await page.goto(readerUrl(extensionId));
    await page.locator('#root > *').first().waitFor();
    await page.evaluate(() => {
      document.documentElement.requestFullscreen = () => Promise.reject(new TypeError('Fullscreen is not allowed'));
    });
    await openMenuItem(page, 'Toggle Fullscreen');
    await expect(page.getByText('The browser refused the fullscreen request.')).toBeVisible();
  });
});
