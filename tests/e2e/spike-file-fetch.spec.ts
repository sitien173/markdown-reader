import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium, type BrowserContext, type Page } from '@playwright/test';
import { test, expect } from './fixtures';

const extensionPath = path.resolve('.output/chrome-mv3');
const fixturePath = path.resolve('tests/fixtures/local-file.md');
const fixtureText = readFileSync(fixturePath, 'utf8');
const fixtureUrl = pathToFileURL(fixturePath).href;

async function launchContext(userDataDir: string): Promise<BrowserContext> {
  return chromium.launchPersistentContext(userDataDir, {
    channel: 'chromium',
    headless: true,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  });
}

async function setFileAccess(page: Page, extensionId: string, enabled: boolean) {
  await page.goto(`chrome://extensions/?id=${extensionId}`);
  const toggle = page.locator('extensions-detail-view extensions-toggle-row#allow-on-file-urls cr-toggle');
  await expect(toggle).toBeVisible();
  if ((await toggle.getAttribute('aria-checked')) !== String(enabled)) await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', String(enabled));
}

async function extensionIdFor(context: BrowserContext) {
  const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
  return new URL(worker.url()).host;
}

async function allowedFileAccess(page: Page) {
  return page.evaluate(() => new Promise<boolean>((resolve) => {
    const extensionApi = (window as unknown as Window & {
      chrome: { extension: { isAllowedFileSchemeAccess(callback: (allowed: boolean) => void): void } };
    }).chrome.extension;
    extensionApi.isAllowedFileSchemeAccess(resolve);
  }));
}

async function assertAccessAndFetch(page: Page, extensionId: string, allowed: boolean) {
  await page.goto(`chrome-extension://${extensionId}/reader.html`);
  expect(await allowedFileAccess(page)).toBe(allowed);
  if (!allowed) {
    const denied = await page.evaluate(async (url) => {
      try {
        const response = await fetch(url);
        return { rejected: false, ok: response.ok, text: await response.text() };
      } catch {
        return { rejected: true };
      }
    }, fixtureUrl);
    expect(denied.rejected).toBe(true);
    return;
  }
  const result = await page.evaluate(async (url) => {
    const response = await fetch(url);
    return { ok: response.ok, text: await response.text() };
  }, fixtureUrl);
  expect(result.ok).toBe(true);
  expect(result.text).toBe(fixtureText);
}

test('file URL fetch follows the extension Allow access to file URLs setting', async ({ context, page, extensionId, userDataDir }) => {
  let activeContext = context;
  let activePage = page;
  try {
    // Chromium for Testing initializes unpacked extensions with this setting on.
    // Use the real detail-page toggle, then restart Chromium to apply it.
    await setFileAccess(activePage, extensionId, false);
    await activeContext.close();
    activeContext = await launchContext(userDataDir);
    const offId = await extensionIdFor(activeContext);
    expect(offId).toBe(extensionId);
    activePage = await activeContext.newPage();
    await assertAccessAndFetch(activePage, offId, false);

    await setFileAccess(activePage, offId, true);
    await activeContext.close();
    activeContext = await launchContext(userDataDir);
    const onId = await extensionIdFor(activeContext);
    expect(onId).toBe(extensionId);
    activePage = await activeContext.newPage();
    await assertAccessAndFetch(activePage, onId, true);
  } finally {
    if (activeContext !== context) await activeContext.close();
  }
});
