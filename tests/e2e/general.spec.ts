import type { Page } from '@playwright/test';
import { test, expect, startFixtureServer } from './fixtures';

type ChromeStorage = {
  chrome: {
    storage: { local: { get(key: string): Promise<Record<string, unknown>>; set(items: object): Promise<void> } };
    extension: { isAllowedFileSchemeAccess(): Promise<boolean> };
  };
};

// Writes through storage.local, the key the popup writes, so every page sees it without a reload.
const setGeneral = (page: Page, general: Record<string, unknown>) =>
  page.evaluate(
    (value) => (globalThis as unknown as ChromeStorage).chrome.storage.local.set({ 'settings:v1': { version: 1, general: value } }),
    general,
  );
const readGeneral = (page: Page) =>
  page.evaluate(async () => {
    const stored = await (globalThis as unknown as ChromeStorage).chrome.storage.local.get('settings:v1');
    return (stored['settings:v1'] as { general: Record<string, unknown> }).general;
  });

// Chrome keeps connections alive, so close them or server.close() waits for the browser.
async function startServer(handler: Parameters<typeof startFixtureServer>[0]) {
  const fixture = await startFixtureServer(handler);
  return {
    ...fixture,
    close: () => {
      fixture.server.closeAllConnections();
      return fixture.close();
    },
  };
}

const ext = (extensionId: string, file: string) => `chrome-extension://${extensionId}/${file}`;

test('Enable off stops auto-redirect of a .md tab while Render current tab still works', async ({ context, extensionId }) => {
  const { origin, close } = await startServer((_req, res) => {
    res.setHeader('content-type', 'text/plain');
    res.end('# Served markdown');
  });
  try {
    const popup = await context.newPage();
    await popup.goto(ext(extensionId, 'popup.html'));
    await setGeneral(popup, { enabled: false });
    const doc = await context.newPage();
    await doc.goto(`${origin}/doc.md`);
    await doc.waitForTimeout(1500);
    await expect(doc).toHaveURL(`${origin}/doc.md`);
    // The doc tab is now the active tab, so the popup's Render current tab acts on it.
    const opened = context.waitForEvent('page');
    await popup.getByRole('button', { name: 'Render current tab' }).click();
    const reader = await opened;
    await expect(reader).toHaveURL(/reader\.html\?mode=read&src=/);
    await expect(reader.locator('.md-content h1')).toHaveText('Served markdown');
    await setGeneral(popup, { enabled: true });
    await doc.goto(`${origin}/doc.md`);
    await expect(doc).toHaveURL(new RegExp(`chrome-extension://${extensionId}/reader\\.html\\?src=`));
  } finally {
    await close();
  }
});

test('Render .txt redirects a text/plain .txt URL only when on', async ({ context, extensionId }) => {
  const { origin, close } = await startServer((req, res) => {
    res.setHeader('content-type', req.url === '/page.txt' ? 'text/html' : 'text/plain');
    res.end(req.url === '/page.txt' ? '<!doctype html><h1>Html</h1>' : '# Text heading');
  });
  try {
    const settings = await context.newPage();
    await settings.goto(ext(extensionId, 'options.html'));
    const doc = await context.newPage();
    await doc.goto(`${origin}/notes.txt`);
    await doc.waitForTimeout(1500);
    await expect(doc).toHaveURL(`${origin}/notes.txt`);
    await setGeneral(settings, { renderTxt: true });
    await doc.goto(`${origin}/notes.txt`);
    await expect(doc).toHaveURL(new RegExp(`chrome-extension://${extensionId}/reader\\.html\\?src=`));
    await expect(doc.locator('.md-content h1')).toHaveText('Text heading');
    await doc.goto(`${origin}/page.txt`);
    await doc.waitForTimeout(1500);
    await expect(doc).toHaveURL(`${origin}/page.txt`);
  } finally {
    await close();
  }
});

test('Local file access row shows the live state and opens the file-access dialog', async ({ page, extensionId }) => {
  await page.goto(ext(extensionId, 'popup.html'));
  const allowed = await page.evaluate(() => (globalThis as unknown as ChromeStorage).chrome.extension.isAllowedFileSchemeAccess());
  const row = page.getByRole('button', { name: /Local file access/ });
  await expect(row).toContainText(allowed ? 'Allowed' : 'Not allowed');
  await row.click();
  await expect(page.getByRole('dialog', { name: 'Enable file access' })).toBeVisible();
  await page.getByRole('button', { name: 'Got it' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('General rows are present and write to settings', async ({ page, extensionId }) => {
  await page.goto(ext(extensionId, 'options.html'));
  for (const name of ['Enable', 'Breaks', 'Render .txt as Markdown', 'Auto-refresh', 'Auto-refresh web pages', 'Charset compatibility']) {
    await expect(page.getByRole('switch', { name, exact: true })).toBeVisible();
  }
  await expect(page.getByRole('switch', { name: 'Outline collapsing', exact: true })).not.toBeChecked();
  await expect(page.getByRole('switch', { name: 'Enable', exact: true })).toBeChecked();
  await expect(page.getByRole('switch', { name: 'Auto-refresh web pages' })).not.toBeChecked();
  await page.getByRole('switch', { name: 'Enable', exact: true }).click();
  await expect.poll(async () => (await readGeneral(page)).enabled).toBe(false);
  await page.getByRole('switch', { name: 'Render .txt as Markdown' }).click();
  await expect.poll(async () => (await readGeneral(page)).renderTxt).toBe(true);
  await page.getByRole('switch', { name: 'Auto-refresh web pages' }).click();
  await expect.poll(async () => (await readGeneral(page)).autoRefreshRemote).toBe(true);
  await page.getByRole('switch', { name: 'Charset compatibility' }).click();
  await expect.poll(async () => (await readGeneral(page)).charsetCompat).toBe(true);
  const field = page.getByRole('spinbutton', { name: 'Auto-refresh interval in seconds' });
  await field.fill('0.1');
  await field.press('Enter');
  await expect.poll(async () => (await readGeneral(page)).autoRefreshIntervalSec).toBe(0.5);
  await field.fill('900');
  await field.press('Enter');
  await expect.poll(async () => (await readGeneral(page)).autoRefreshIntervalSec).toBe(600);
});

test('Breaks in General and Plugins share one stored value', async ({ page, extensionId }) => {
  await page.goto(ext(extensionId, 'options.html'));
  const breaks = page.getByRole('switch', { name: 'Breaks', exact: true });
  await expect(breaks).not.toBeChecked();
  await breaks.click();
  await page.getByRole('tab', { name: 'Plugins' }).click();
  await expect(page.getByRole('switch', { name: 'Breaks', exact: true })).toBeChecked();
});

test('Charset compatibility decodes a windows-1252 file', async ({ context, extensionId }) => {
  const { origin, close } = await startServer((_req, res) => {
    res.setHeader('content-type', 'text/markdown');
    res.end(Buffer.concat([Buffer.from('# caf'), Buffer.from([0xe9])]));
  });
  try {
    const settings = await context.newPage();
    await settings.goto(ext(extensionId, 'options.html'));
    const reader = await context.newPage();
    const src = `${ext(extensionId, 'reader.html')}?src=${encodeURIComponent(`${origin}/legacy.md`)}`;
    await reader.goto(src);
    await expect(reader.locator('.md-content h1')).toContainText('caf�');
    await setGeneral(settings, { charsetCompat: true });
    await reader.goto(src);
    await expect(reader.locator('.md-content h1')).toHaveText('café');
  } finally {
    await close();
  }
});

test.describe('http auto-refresh', () => {
  test.setTimeout(60_000);

  async function serve() {
    const state = { body: '# Version one', etag: '"1"', requests: 0, conditional: 0, status: 0 };
    const fixture = await startServer((req, res) => {
      state.requests++;
      if (state.status) {
        res.statusCode = state.status;
        res.end('error');
        return;
      }
      if (req.headers['if-none-match'] === state.etag) {
        state.conditional++;
        res.statusCode = 304;
        res.end();
        return;
      }
      res.setHeader('content-type', 'text/markdown');
      res.setHeader('etag', state.etag);
      res.end(state.body);
    });
    return { ...fixture, state };
  }

  test('sends no poll request by default', async ({ page, extensionId }) => {
    const { origin, close, state } = await serve();
    try {
      await page.goto(`${ext(extensionId, 'reader.html')}?src=${encodeURIComponent(`${origin}/doc.md`)}`);
      await expect(page.locator('.md-content h1')).toHaveText('Version one');
      await page.waitForTimeout(7000);
      expect(state.requests).toBe(1);
    } finally {
      await close();
    }
  });

  test('updates after a server change, keeps text on 304 and on 500', async ({ context, extensionId }) => {
    const { origin, close, state } = await serve();
    try {
      const settings = await context.newPage();
      await settings.goto(ext(extensionId, 'options.html'));
      await setGeneral(settings, { autoRefreshRemote: true });
      const page = await context.newPage();
      await page.goto(`${ext(extensionId, 'reader.html')}?src=${encodeURIComponent(`${origin}/doc.md`)}`);
      await expect(page.locator('.md-content h1')).toHaveText('Version one');
      await expect.poll(() => state.conditional, { timeout: 15_000 }).toBeGreaterThan(0);
      await expect(page.locator('.md-content h1')).toHaveText('Version one');
      state.status = 500;
      const failing = state.requests;
      await page.waitForTimeout(6000);
      expect(state.requests).toBeGreaterThan(failing);
      await expect(page.locator('.md-content h1')).toHaveText('Version one');
      state.status = 0;
      Object.assign(state, { body: '# Version two', etag: '"2"' });
      await expect(page.locator('.md-content h1')).toHaveText('Version two', { timeout: 30_000 });
    } finally {
      await close();
    }
  });
});
