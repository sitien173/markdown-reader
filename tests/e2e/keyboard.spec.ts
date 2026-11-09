import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';

test('ArrowLeft on the Outline button moves focus to Files and Space activates its panel', async ({ page, extensionId }) => {
  await page.goto(`chrome-extension://${extensionId}/reader.html`);
  await page.locator('#root > *').first().waitFor();
  const group = page.getByRole('group', { name: 'Sidebar view' });
  const contents = group.getByRole('button', { name: 'Outline' });
  const files = group.getByRole('button', { name: 'Files' });
  await contents.focus();
  await expect(contents).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('ArrowLeft');
  await expect(files).toBeFocused();
  await page.keyboard.press('Space');
  await expect(files).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-slot="reader-toc"]')).toContainText('No folder opened.');
  await page.keyboard.press('ArrowRight');
  await expect(contents).toBeFocused();
  await page.keyboard.press('Space');
  await expect(contents).toHaveAttribute('aria-pressed', 'true');
});

test('Floating menu opens with Enter, closes with Escape, and returns focus to the trigger', async ({ page, extensionId }) => {
  await page.goto(`chrome-extension://${extensionId}/reader.html`);
  const trigger = page.getByRole('button', { name: 'Menu' });
  await page.locator('#root > *').first().waitFor();
  await trigger.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('menu')).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Export HTML' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu')).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

type PickerWindow = { showOpenFilePicker: () => Promise<unknown[]>; __handle: FileSystemFileHandle };

// v1 has no write path that headless Chromium can drive with a real picker, so the picker is stubbed with an origin-private
// file handle. It is a real FileSystemFileHandle, so save and conflict detection run through production code.
async function openSaveConflict(page: Page, extensionId: string) {
  await page.goto(`chrome-extension://${extensionId}/reader.html?mode=split`);
  await page.evaluate(async () => {
    const root = await navigator.storage.getDirectory();
    const handle = await root.getFileHandle('conflict.md', { create: true });
    const writable = await handle.createWritable();
    await writable.write('# Conflict fixture\n');
    await writable.close();
    (window as unknown as PickerWindow).__handle = handle;
    (window as unknown as PickerWindow).showOpenFilePicker = async () => [handle];
  });
  await page.getByRole('button', { name: 'Open file' }).click();
  await expect(page.locator('.md-content h1')).toHaveText('Conflict fixture', { timeout: 20000 });
  await page.locator('.cm-content').click();
  await page.keyboard.press('Control+End');
  await page.keyboard.type(' edited locally');
  const save = page.getByRole('button', { name: 'Save' });
  await expect(save).toBeEnabled();
  await page.evaluate(async () => {
    const handle = (window as unknown as PickerWindow).__handle;
    await new Promise((resolve) => setTimeout(resolve, 50));
    const writable = await handle.createWritable();
    await writable.write('# Changed on disk\n');
    await writable.close();
  });
  await save.click();
  const dialog = page.getByRole('dialog', { name: 'File changed on disk' });
  await expect(dialog).toBeVisible();
  return { save, dialog };
}

async function openFileAccess(page: Page, extensionId: string) {
  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  await page.evaluate(() => {
    const api = (globalThis as unknown as { chrome: { tabs: { query: unknown }; extension: { isAllowedFileSchemeAccess: unknown } } })
      .chrome;
    api.tabs.query = () => Promise.resolve([{ url: 'file:///tmp/example.md' }]);
    api.extension.isAllowedFileSchemeAccess = () => Promise.resolve(false);
  });
  const trigger = page.getByRole('button', { name: 'Render current tab' });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: 'Enable file access' });
  await expect(dialog).toBeVisible();
  return { trigger, dialog };
}

test('save-conflict dialog closes on Escape and on Cancel without changing the draft', async ({ page, extensionId }) => {
  const { save, dialog } = await openSaveConflict(page, extensionId);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('.cm-content')).toContainText('edited locally');
  await expect(save).toBeEnabled();

  await save.click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('.cm-content')).toContainText('edited locally');
  await expect(save).toBeEnabled();
});

test('file-access dialog closes on Escape and on Got it', async ({ page, extensionId }) => {
  const { trigger, dialog } = await openFileAccess(page, extensionId);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);

  await trigger.click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Got it' }).click();
  await expect(dialog).toHaveCount(0);
});

// Base UI Dialog returns focus on close; each dismissal path is its own case so one failure cannot mask the others.
for (const how of ['Escape', 'Cancel'] as const) {
  test(`save-conflict dialog returns focus to Save after ${how}`, async ({ page, extensionId }) => {
    const { save, dialog } = await openSaveConflict(page, extensionId);
    if (how === 'Escape') await page.keyboard.press('Escape');
    else await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(save).toBeFocused({ timeout: 2000 });
  });
}

for (const how of ['Escape', 'Got it'] as const) {
  test(`file-access dialog returns focus to Render current tab after ${how}`, async ({ page, extensionId }) => {
    const { trigger, dialog } = await openFileAccess(page, extensionId);
    if (how === 'Escape') await page.keyboard.press('Escape');
    else await dialog.getByRole('button', { name: 'Got it' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused({ timeout: 2000 });
  });
}
