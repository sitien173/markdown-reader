import { test, expect, startFixtureServer } from './fixtures';

let origin = '';
let closeServer: (() => Promise<void>) | undefined;
let docCalls = 0;
test.beforeAll(async () => {
  docCalls = 0;
  const fixture = await startFixtureServer((req, res) => {
    if (req.url === '/page.md') {
      res.setHeader('content-type', 'text/html');
      res.end('<!doctype html><title>HTML fixture</title><h1>Not Markdown</h1>');
      return;
    }
    res.setHeader('content-type', 'text/plain');
    if (req.url === '/doc.md' && docCalls++ === 0) res.end('# Captured one-shot body');
    else res.end('# Refetched body must not render');
  });
  origin = fixture.origin;
  closeServer = fixture.close;
});
test.afterAll(async () => {
  await closeServer?.();
});

test('plain Markdown navigations redirect with captured text while HTML at .md does not', async ({ page, extensionId }) => {
  await page.goto(`${origin}/doc.md`);
  await expect(page).toHaveURL(new RegExp(`chrome-extension://${extensionId}/reader\\.html\\?src=`));
  await expect(page.locator('.md-content h1')).toHaveText('Captured one-shot body');
  await page.goto(`${origin}/page.md`);
  await expect(page).toHaveURL(`${origin}/page.md`);
  await expect(page.getByRole('heading', { name: 'Not Markdown' })).toBeVisible();
});

test('stale and other-URL session text are ignored', async ({ page, extensionId }) => {
  await page.goto(`chrome-extension://${extensionId}/reader.html`);
  await page.evaluate(async ({ key, entry }) => (window as any).chrome.storage.session.set({ [key]: entry }), {
    key: `markdown-reader:${origin}/stale.md`,
    entry: { url: `${origin}/stale.md`, text: '# Stale captured content', ts: Date.now() - 31_000 },
  });
  await page.goto(`chrome-extension://${extensionId}/reader.html?src=${encodeURIComponent(`${origin}/stale.md`)}`);
  await expect(page.locator('.md-content h1')).toHaveText('Refetched body must not render');

  await page.goto(`chrome-extension://${extensionId}/reader.html`);
  await page.evaluate(async ({ key, entry }) => (window as any).chrome.storage.session.set({ [key]: entry }), {
    key: `markdown-reader:${origin}/mismatch.md`,
    entry: { url: `${origin}/other.md`, text: '# Wrong URL captured content', ts: Date.now() },
  });
  await page.goto(`chrome-extension://${extensionId}/reader.html?src=${encodeURIComponent(`${origin}/mismatch.md`)}`);
  await expect(page.locator('.md-content h1')).toHaveText('Refetched body must not render');
});

test('popup actions open the requested reader mode', async ({ context, extensionId }) => {
  const first = context.pages()[0] ?? (await context.newPage());
  await first.goto(`chrome-extension://${extensionId}/reader.html?src=${encodeURIComponent(`${origin}/one.md`)}`);
  await expect(first.locator('.md-content h1')).toHaveText('Refetched body must not render');
  const second = await context.newPage();
  await second.goto(`chrome-extension://${extensionId}/reader.html?src=${encodeURIComponent(`${origin}/two.md`)}`);
  await expect(second.locator('.md-content h1')).toHaveText('Refetched body must not render');

  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  const popupButton = popup.getByRole('button', { name: 'Open viewer' });
  await popup.bringToFront();
  // The rail tab, then the scrollable pane, are tab stops before the first action.
  await popup.keyboard.press('Tab');
  await expect(popup.getByRole('tab', { name: 'General' })).toBeFocused();
  await popup.keyboard.press('Tab');
  await expect(popup.getByRole('tabpanel')).toBeFocused();
  await popup.keyboard.press('Tab');
  await expect(popupButton).toBeFocused();
  await expect(popupButton).toHaveCSS('outline-style', 'solid');
  const opened = context.waitForEvent('page');
  await popupButton.click();
  const viewer = await opened;
  await expect(viewer).toHaveURL(/reader\.html\?mode=read/);
  await viewer.close();
});

test('popup shows a role=alert error when the current tab cannot be rendered', async ({ context, extensionId }) => {
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await popup.getByRole('button', { name: 'Render current tab' }).click();
  await expect(popup.getByRole('alert')).toHaveText('This page URL cannot be opened.');
});

test('Reset settings confirms, writes defaults, and returns focus to its trigger', async ({ context, extensionId }) => {
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  type Stored = { general: { renderTxt: boolean } };
  type ChromeWindow = {
    chrome: { storage: { local: { get(key: string): Promise<Record<string, unknown>>; set(items: object): Promise<void> } } };
  };
  const readRenderTxt = () =>
    popup.evaluate(async () => {
      const stored = await (window as unknown as ChromeWindow).chrome.storage.local.get('settings:v1');
      return (stored['settings:v1'] as Stored).general.renderTxt;
    });
  await popup.evaluate(() =>
    (window as unknown as ChromeWindow).chrome.storage.local.set({ 'settings:v1': { version: 1, general: { renderTxt: true } } }),
  );
  const trigger = popup.getByRole('button', { name: 'Reset settings' });
  await trigger.click();
  const dialog = popup.getByRole('dialog', { name: 'Reset all settings?' });
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  expect(await readRenderTxt()).toBe(true);

  await trigger.click();
  await dialog.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await expect.poll(readRenderTxt).toBe(false);
});
