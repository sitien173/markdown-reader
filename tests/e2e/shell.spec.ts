import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';

type PickerWindow = { showOpenFilePicker: () => Promise<unknown[]>; __handle: FileSystemFileHandle };

const longDoc = ['# Alpha', ...['Beta', 'Gamma', 'Delta'].flatMap((h) => [`## ${h}`, ...Array(40).fill('Filler paragraph text.\n')])].join(
  '\n\n',
);

// Same approach as keyboard.spec: the picker is stubbed with an origin-private file handle, so production open, save, and watch code runs.
async function openWithPicker(page: Page, text: string) {
  await page.evaluate(async (content) => {
    const root = await navigator.storage.getDirectory();
    const handle = await root.getFileHandle('shell.md', { create: true });
    const writable = await handle.createWritable();
    await writable.write(content);
    await writable.close();
    (window as unknown as PickerWindow).__handle = handle;
    (window as unknown as PickerWindow).showOpenFilePicker = async () => [handle];
  }, text);
  await page.getByRole('button', { name: 'Open', exact: true }).click();
  await page.getByRole('menuitem', { name: 'File' }).click();
  await expect(page.locator('.md-content h1').first()).toBeVisible({ timeout: 20000 });
}

test('welcome screen shows with no document and hides the toolbar mode switch', async ({ page, extensionId }) => {
  await page.goto(`chrome-extension://${extensionId}/reader.html`);
  const welcome = page.locator('[data-slot="welcome"]');
  await expect(welcome.getByRole('heading', { name: 'Markdown Reader' })).toBeVisible();
  for (const name of ['Open file', 'Open folder', 'Open URL']) await expect(welcome.getByRole('button', { name })).toBeVisible();
  await expect(page.getByRole('radiogroup', { name: 'Reader mode' })).toHaveCount(0);
});

test('Open URL dialog rejects a disallowed scheme inline and opens an allowed URL', async ({ page, extensionId }) => {
  await page.goto(`chrome-extension://${extensionId}/reader.html`);
  await page.locator('[data-slot="welcome"]').getByRole('button', { name: 'Open URL' }).click();
  const dialog = page.getByRole('dialog', { name: 'Open URL' });
  const field = dialog.getByLabel('Markdown URL');
  await field.fill('javascript:alert(1)');
  await dialog.getByRole('button', { name: 'Open URL' }).click();
  await expect(dialog.getByRole('alert')).toBeVisible();
  await expect(field).toHaveAttribute('aria-invalid', 'true');
  await expect(dialog).toBeVisible();
  await page.route('https://example.test/doc.md', (route) => route.fulfill({ contentType: 'text/markdown', body: '# From dialog\n' }));
  await field.fill('https://example.test/doc.md');
  await dialog.getByRole('button', { name: 'Open URL' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator('.md-content h1')).toHaveText('From dialog');
});

test('sidebar collapses and expands', async ({ page, extensionId }) => {
  await page.goto(`chrome-extension://${extensionId}/reader.html`);
  await openWithPicker(page, longDoc);
  const toggle = page.getByRole('button', { name: 'Toggle sidebar' });
  const reader = page.locator('main.reader');
  await expect(reader).toHaveAttribute('data-sidebar', 'open');
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await toggle.click();
  await expect(reader).toHaveAttribute('data-sidebar', 'closed');
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('[data-slot="reader-toc"]')).toHaveJSProperty('inert', true);
  await toggle.click();
  await expect(reader).toHaveAttribute('data-sidebar', 'open');
  await expect(page.locator('[data-slot="reader-toc"]')).toHaveJSProperty('inert', false);
});

test('scroll-spy marks the heading in view', async ({ page, extensionId }) => {
  await page.goto(`chrome-extension://${extensionId}/reader.html`);
  await openWithPicker(page, longDoc);
  const toc = page.locator('[data-slot="reader-toc"]');
  await expect(toc.locator('[aria-current="location"]')).toHaveText('Alpha');
  await page.locator('[data-slot="reader-content"]').evaluate((el) => {
    const gamma = el.querySelector('#user-content-gamma') as HTMLElement;
    el.scrollTo({ top: el.scrollTop + gamma.getBoundingClientRect().top - el.getBoundingClientRect().top, behavior: 'instant' });
  });
  await expect(toc.locator('[aria-current="location"]')).toHaveText('Gamma');
  await expect(toc.locator('[aria-current="location"]')).toHaveCount(1);
});

test('focus mode hides toolbar and sidebar and Escape exits it', async ({ page, extensionId }) => {
  await page.goto(`chrome-extension://${extensionId}/reader.html`);
  await openWithPicker(page, longDoc);
  await page.getByRole('button', { name: 'Focus mode' }).click();
  await expect(page.locator('main.reader')).toHaveAttribute('data-focus', 'true');
  await expect(page.locator('[data-slot="reader-bar"]')).toHaveCount(0);
  await expect(page.locator('[data-slot="reader-toc"]')).toBeHidden();
  await page.keyboard.press('Escape');
  await expect(page.locator('main.reader')).toHaveAttribute('data-focus', 'false');
  await expect(page.locator('[data-slot="reader-bar"]')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Focus mode' })).toBeFocused();
});

test('drop overlay appears while a file is dragged over the window', async ({ page, extensionId }) => {
  await page.goto(`chrome-extension://${extensionId}/reader.html`);
  const overlay = page.locator('[data-slot="drop-overlay"]');
  await expect(overlay).toHaveCount(0);
  await page.evaluate(() => {
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(new File(['# Dropped'], 'dropped.md', { type: 'text/markdown' }));
    window.dispatchEvent(new DragEvent('dragenter', { dataTransfer, bubbles: true }));
  });
  await expect(overlay).toBeVisible();
  await expect(overlay).toContainText('Drop a Markdown file');
  await page.evaluate(() => window.dispatchEvent(new DragEvent('dragend', { bubbles: true })));
  await expect(overlay).toHaveCount(0);
});

test('error banner and external-change banner coexist and dismissing the error keeps Reload', async ({ page, extensionId }) => {
  await page.goto(`chrome-extension://${extensionId}/reader.html?mode=split`);
  await openWithPicker(page, '# Shell fixture\n');
  await page.locator('.cm-content').click();
  await page.keyboard.press('Control+End');
  await page.keyboard.type(' edited locally');
  await page.evaluate(async () => {
    const handle = (window as unknown as PickerWindow).__handle;
    await new Promise((resolve) => setTimeout(resolve, 50));
    const writable = await handle.createWritable();
    await writable.write('# Changed on disk\n');
    await writable.close();
  });
  const banners = page.locator('[data-slot="status-banner"]');
  await expect(banners.getByRole('button', { name: 'Reload' })).toBeVisible({ timeout: 20000 });
  await page.evaluate(() => {
    (window as unknown as PickerWindow).showOpenFilePicker = async () => {
      throw new Error('Picker failed');
    };
  });
  await page.getByRole('button', { name: 'Open', exact: true }).click();
  await page.getByRole('menuitem', { name: 'File' }).click();
  const error = banners.getByRole('alert');
  await expect(error).toContainText('Picker failed');
  await expect(banners.getByRole('button', { name: 'Reload' })).toBeVisible();
  await error.getByRole('button', { name: 'Dismiss' }).click();
  await expect(error).toHaveCount(0);
  await expect(banners.getByRole('button', { name: 'Reload' })).toBeVisible();
  await expect(banners).toContainText('File changed on disk');
});

test('a toast appears in the polite live region after save', async ({ page, extensionId }) => {
  await page.goto(`chrome-extension://${extensionId}/reader.html?mode=split`);
  await openWithPicker(page, '# Toast fixture\n');
  await page.locator('.cm-content').click();
  await page.keyboard.press('Control+End');
  await page.keyboard.type(' more');
  await page.getByRole('button', { name: 'Save' }).click();
  const viewport = page.locator('[data-slot="toast-viewport"]');
  await expect(viewport).toHaveAttribute('aria-live', 'polite');
  await expect(viewport.locator('[data-slot="toast"]')).toContainText('Saved');
});

test('Read, Edit, and Split form a radiogroup with arrow-key selection', async ({ page, extensionId }) => {
  await page.goto(`chrome-extension://${extensionId}/reader.html`);
  await openWithPicker(page, longDoc);
  const group = page.getByRole('radiogroup', { name: 'Reader mode' });
  const radios = group.getByRole('radio');
  await expect(radios).toHaveText(['Read', 'Edit', 'Split']);
  const read = group.getByRole('radio', { name: 'Read' });
  const edit = group.getByRole('radio', { name: 'Edit' });
  const split = group.getByRole('radio', { name: 'Split' });
  await expect(read).toHaveAttribute('aria-checked', 'true');
  await expect(edit).toHaveAttribute('aria-checked', 'false');
  await read.focus();
  await page.keyboard.press('ArrowRight');
  await expect(edit).toHaveAttribute('aria-checked', 'true');
  await expect(edit).toBeFocused();
  await expect(read).toHaveAttribute('aria-checked', 'false');
  await page.keyboard.press('ArrowRight');
  await expect(split).toHaveAttribute('aria-checked', 'true');
  await page.keyboard.press('ArrowLeft');
  await expect(edit).toHaveAttribute('aria-checked', 'true');
});
