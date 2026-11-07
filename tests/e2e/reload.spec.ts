import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium, type BrowserContext } from '@playwright/test';
import { test, expect } from './fixtures';

const extensionPath = path.resolve('.output/chrome-mv3');

async function launchContext(userDataDir: string): Promise<BrowserContext> {
  return chromium.launchPersistentContext(userDataDir, {
    channel: 'chromium',
    headless: true,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  });
}

async function extensionIdFor(context: BrowserContext): Promise<string> {
  const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
  return new URL(worker.url()).host;
}

// Same approach as the Phase 1 spike: enable "Allow access to file URLs" on the detail page, then restart Chromium.
async function contextWithFileAccess(userDataDir: string): Promise<{ context: BrowserContext; extensionId: string }> {
  const first = await launchContext(userDataDir);
  const extensionId = await extensionIdFor(first);
  const page = await first.newPage();
  await page.goto(`chrome://extensions/?id=${extensionId}`);
  const toggle = page.locator('extensions-detail-view extensions-toggle-row#allow-on-file-urls cr-toggle');
  await expect(toggle).toBeVisible();
  if ((await toggle.getAttribute('aria-checked')) !== 'true') await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await first.close();
  const context = await launchContext(userDataDir);
  return { context, extensionId: await extensionIdFor(context) };
}

test('rewriting a file:// fixture re-renders the reader without user action', async ({ userDataDir }) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'markdown-reader-reload-'));
  const file = path.join(dir, 'live.md');
  await writeFile(file, '# First version\n\nAlpha.\n');
  const { context, extensionId } = await contextWithFileAccess(userDataDir);
  try {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/reader.html?src=${encodeURIComponent(pathToFileURL(file).href)}&mode=read`);
    await expect(page.locator('.md-content h1')).toHaveText('First version', { timeout: 20000 });
    await writeFile(file, '# Second version\n\nBeta.\n');
    await expect(page.locator('.md-content h1')).toHaveText('Second version', { timeout: 20000 });
  } finally {
    await context.close();
    await rm(dir, { recursive: true, force: true });
  }
});

test('a dirty editor shows "File changed on disk: Reload" instead of reloading', async ({ userDataDir }) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'markdown-reader-dirty-'));
  const file = path.join(dir, 'dirty.md');
  await writeFile(file, '# First version\n\nAlpha.\n');
  const { context, extensionId } = await contextWithFileAccess(userDataDir);
  try {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/reader.html?src=${encodeURIComponent(pathToFileURL(file).href)}&mode=split`);
    await expect(page.locator('.md-content h1')).toHaveText('First version', { timeout: 20000 });
    await page.locator('.cm-content').click();
    await page.keyboard.press('Control+End');
    await page.keyboard.type(' edited locally');
    await expect(page.getByRole('status').filter({ hasText: 'Unsaved changes' })).toBeVisible();
    await writeFile(file, '# Changed on disk\n\nBeta.\n');
    const banner = page.getByRole('status').filter({ hasText: 'File changed on disk' });
    await expect(banner).toContainText('File changed on disk', { timeout: 20000 });
    await expect(banner.getByRole('button', { name: 'Reload' })).toBeVisible();
    await expect(page.locator('.md-content h1')).toHaveText('First version');
    await expect(page.locator('.cm-content')).toContainText('edited locally');
    await banner.getByRole('button', { name: 'Reload' }).click();
    await expect(page.locator('.md-content h1')).toHaveText('Changed on disk', { timeout: 20000 });
  } finally {
    await context.close();
    await rm(dir, { recursive: true, force: true });
  }
});
