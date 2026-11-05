import { test, expect, startFixtureServer } from './fixtures';

let origin = '';
let closeServer: (() => Promise<void>) | undefined;
let docCalls = 0;
test.beforeAll(async () => {
  docCalls = 0;
  const fixture = await startFixtureServer((req, res) => {
    if (req.url === '/page.md') { res.setHeader('content-type', 'text/html'); res.end('<!doctype html><title>HTML fixture</title><h1>Not Markdown</h1>'); return; }
    res.setHeader('content-type', 'text/plain');
    if (req.url === '/doc.md' && docCalls++ === 0) res.end('# Captured one-shot body');
    else res.end('# Refetched body must not render');
  });
  origin = fixture.origin;
  closeServer = fixture.close;
});
test.afterAll(async () => { await closeServer?.(); });

test('plain Markdown navigations redirect with captured text while HTML at .md does not', async ({ page, extensionId }) => {
  await page.goto(`${origin}/doc.md`);
  await expect(page).toHaveURL(new RegExp(`chrome-extension://${extensionId}/reader\\.html\\?src=`));
  await expect(page.locator('.tds-custom-markdown h1')).toHaveText('Captured one-shot body');
  await page.goto(`${origin}/page.md`);
  await expect(page).toHaveURL(`${origin}/page.md`);
  await expect(page.getByRole('heading', { name: 'Not Markdown' })).toBeVisible();
});

test('stale and other-URL session text are ignored', async ({ page, extensionId }) => {
  await page.goto(`chrome-extension://${extensionId}/reader.html`);
  await page.evaluate(async ({ key, entry }) => (window as any).chrome.storage.session.set({ [key]: entry }), {
    key: `markdown-reader:${origin}/stale.md`, entry: { url: `${origin}/stale.md`, text: '# Stale captured content', ts: Date.now() - 31_000 },
  });
  await page.goto(`chrome-extension://${extensionId}/reader.html?src=${encodeURIComponent(`${origin}/stale.md`)}`);
  await expect(page.locator('.tds-custom-markdown h1')).toHaveText('Refetched body must not render');

  await page.goto(`chrome-extension://${extensionId}/reader.html`);
  await page.evaluate(async ({ key, entry }) => (window as any).chrome.storage.session.set({ [key]: entry }), {
    key: `markdown-reader:${origin}/mismatch.md`, entry: { url: `${origin}/other.md`, text: '# Wrong URL captured content', ts: Date.now() },
  });
  await page.goto(`chrome-extension://${extensionId}/reader.html?src=${encodeURIComponent(`${origin}/mismatch.md`)}`);
  await expect(page.locator('.tds-custom-markdown h1')).toHaveText('Refetched body must not render');
});

test('popup actions open the requested reader mode and recent URLs are newest first', async ({ context, extensionId }) => {
  const first = context.pages()[0] ?? await context.newPage();
  await first.goto(`chrome-extension://${extensionId}/reader.html?src=${encodeURIComponent(`${origin}/one.md`)}`);
  await expect(first.locator('.tds-custom-markdown h1')).toHaveText('Refetched body must not render');
  const second = await context.newPage();
  await second.goto(`chrome-extension://${extensionId}/reader.html?src=${encodeURIComponent(`${origin}/two.md`)}`);
  await expect(second.locator('.tds-custom-markdown h1')).toHaveText('Refetched body must not render');

  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  const popupButton = popup.getByRole('button', { name: 'Open viewer' });
  await popup.bringToFront();
  await popup.keyboard.press('Tab');
  await expect(popupButton).toBeFocused();
  await expect(popupButton).toHaveCSS('outline-style', 'solid');
  const opened = context.waitForEvent('page');
  await popupButton.click();
  const viewer = await opened;
  await expect(viewer).toHaveURL(/reader\.html\?mode=read/);
  await viewer.close();

  const popup2 = await context.newPage();
  await popup2.goto(`chrome-extension://${extensionId}/popup.html`);
  const openedEdit = context.waitForEvent('page');
  await popup2.getByRole('button', { name: 'Open editor' }).click();
  const editor = await openedEdit;
  await expect(editor).toHaveURL(/reader\.html\?mode=edit/);
  await editor.close();
  await expect(popup2.getByRole('region', { name: 'Recent URLs' })).toContainText(`${origin}/two.md`);
  const recentText = await popup2.getByRole('region', { name: 'Recent URLs' }).innerText();
  expect(recentText.indexOf('/two.md')).toBeLessThan(recentText.indexOf('/one.md'));
});
