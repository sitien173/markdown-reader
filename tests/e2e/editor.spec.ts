import { test, expect, startFixtureServer } from './fixtures';

test('typing in Split, switching to Read, then back to Split preserves edited text', async ({ page, extensionId }) => {
  const { origin, close } = await startFixtureServer((_req, res) => {
    res.setHeader('content-type', 'text/markdown; charset=utf-8');
    res.end('# Initial title\n\nInitial body.\n');
  });
  try {
    await page.goto(`chrome-extension://${extensionId}/reader.html?src=${encodeURIComponent(`${origin}/doc.md`)}&mode=split`);
    await expect(page.locator('.tds-custom-markdown h1')).toHaveText('Initial title', { timeout: 20000 });
    await page.locator('.cm-content').click();
    await page.keyboard.press('Control+End');
    await page.keyboard.type('\n\nAppended typed text.');
    await expect(page.locator('.cm-content')).toContainText('Appended typed text.');

    // Switch to Read mode
    await page.locator('.tds-segmented-control__item', { hasText: 'Read' }).click();
    await expect(page.locator('.cm-content')).toHaveCount(0);

    // Switch back to Split mode
    await page.locator('.tds-segmented-control__item', { hasText: 'Split' }).click();
    await expect(page.locator('.cm-content')).toBeVisible();
    await expect(page.locator('.cm-content')).toContainText('Appended typed text.');
  } finally {
    await close();
  }
});
