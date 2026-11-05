import { readFile } from 'node:fs/promises';
import { test, expect, startFixtureServer } from './fixtures';

test('exported HTML opened in a fresh page with network blocked shows code, math, and diagrams with zero network requests', async ({ page, context, extensionId }) => {
  const richMarkdown = await readFile('tests/fixtures/markdown/rich.md', 'utf8');
  const tinyPng = Buffer.from([
    137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82,
    0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0, 31, 21, 196,
    137, 0, 0, 0, 10, 73, 68, 65, 84, 120, 156, 99, 0, 1, 0, 0,
    5, 0, 1, 13, 10, 45, 180, 0, 0, 0, 0, 73, 69, 78, 68,
    174, 66, 96, 130
  ]);

  const { origin, close } = await startFixtureServer((req, res) => {
    if (req.url === '/remote.png') {
      res.setHeader('content-type', 'image/png');
      res.end(tinyPng);
      return;
    }
    res.setHeader('content-type', 'text/markdown; charset=utf-8');
    res.end(`${richMarkdown}\n\n![Remote image](${origin}/remote.png)\n\n<img src="${origin}/remote.png" srcset="${origin}/remote.png 1x, ${origin}/remote.png 2x" alt="Srcset remote">\n`);
  });

  try {
    await page.goto(`chrome-extension://${extensionId}/reader.html?src=${encodeURIComponent(`${origin}/rich.md`)}`);
    await expect(page.locator('.tds-custom-markdown h1')).toHaveText('Rich fixture', { timeout: 20000 });
    await expect(page.locator('.tds-custom-markdown svg').first()).toBeVisible({ timeout: 20000 });
    await expect(page.locator('.tds-custom-markdown .katex').first()).toBeVisible();
    await expect(page.locator('.tds-custom-markdown .shiki').first()).toBeVisible();
    await expect(page.locator(`.tds-custom-markdown img[src="${origin}/remote.png"]`).first()).toBeVisible();

    // Open Export menu and trigger download
    const exportButton = page.getByRole('button', { name: 'Export' });
    await exportButton.click();
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('menuitem', { name: 'Export HTML' }).click();
    const download = await downloadPromise;
    const downloadPath = await download.path();
    expect(downloadPath).toBeTruthy();
    const exportedHtml = await readFile(downloadPath!, 'utf8');

    // Fresh page with all network blocked
    const freshPage = await context.newPage();
    const requests: string[] = [];
    freshPage.on('request', (req) => requests.push(req.url()));
    await freshPage.route('**/*', (route) => route.abort());

    await freshPage.setContent(exportedHtml, { waitUntil: 'load' });

    // Assert highlighted Shiki markup, math, and diagram are present and visible
    await expect(freshPage.locator('.tds-custom-markdown pre.shiki')).toBeVisible();
    await expect(freshPage.locator('.tds-custom-markdown pre.shiki code span[style*="color"]').first()).toBeVisible();
    await expect(freshPage.locator('.tds-custom-markdown .katex').first()).toBeVisible();
    await expect(freshPage.locator('.tds-custom-markdown svg').first()).toBeVisible();

    // Assert remote images replaced with links to URL with alt text
    const remoteLink = freshPage.locator(`a[href="${origin}/remote.png"]`).first();
    await expect(remoteLink).toBeVisible();
    await expect(remoteLink).toHaveText('Remote image');
    const srcsetLink = freshPage.locator(`a[href="${origin}/remote.png"]`).nth(1);
    await expect(srcsetLink).toBeVisible();
    await expect(srcsetLink).toHaveText('Srcset remote');

    // Assert no remote img src or srcset survived
    await expect(freshPage.locator(`img[src*="${origin}/remote.png"]`)).toHaveCount(0);
    await expect(freshPage.locator('img[srcset]')).toHaveCount(0);
    await expect(freshPage.locator('source')).toHaveCount(0);

    // Zero network requests
    expect(requests).toHaveLength(0);
    await freshPage.close();
  } finally {
    await close();
  }
});

test('Export is disabled in Edit mode', async ({ page, extensionId }) => {
  const { origin, close } = await startFixtureServer((_req, res) => {
    res.setHeader('content-type', 'text/markdown; charset=utf-8');
    res.end('# Editable doc\n\nSome text.\n');
  });
  try {
    await page.goto(`chrome-extension://${extensionId}/reader.html?src=${encodeURIComponent(`${origin}/doc.md`)}`);
    await expect(page.locator('.tds-custom-markdown h1')).toHaveText('Editable doc');
    await page.locator('.tds-segmented-control__item', { hasText: 'Edit' }).click();
    const exportButton = page.getByRole('button', { name: 'Export' });
    await expect(exportButton).toBeDisabled();
  } finally {
    await close();
  }
});

test('Print calls window.print() and a print stylesheet hides reader chrome', async ({ page, extensionId }) => {
  const markdown = '# Printable Document\n\nSome text content.\n';
  const { origin, close } = await startFixtureServer((_req, res) => {
    res.setHeader('content-type', 'text/markdown; charset=utf-8');
    res.end(markdown);
  });

  try {
    await page.goto(`chrome-extension://${extensionId}/reader.html?src=${encodeURIComponent(`${origin}/doc.md`)}`);
    await expect(page.locator('.tds-custom-markdown h1')).toHaveText('Printable Document', { timeout: 20000 });

    await page.evaluate(() => {
      (window as unknown as { __printed: boolean }).__printed = false;
      window.print = () => {
        (window as unknown as { __printed: boolean }).__printed = true;
      };
    });

    const exportButton = page.getByRole('button', { name: 'Export' });
    await exportButton.click();
    await page.getByRole('menuitem', { name: 'Print' }).click();

    const printed = await page.evaluate(() => (window as unknown as { __printed: boolean }).__printed);
    expect(printed).toBe(true);

    // Emulate print media and assert reader chrome is hidden
    await page.emulateMedia({ media: 'print' });

    const barDisplay = await page.locator('.tds-custom-reader__bar').evaluate((el) => getComputedStyle(el).display);
    expect(barDisplay).toBe('none');

    const tocDisplay = await page.locator('.tds-custom-reader__toc').evaluate((el) => getComputedStyle(el).display);
    expect(tocDisplay).toBe('none');

    const markdownOverflow = await page.locator('.tds-custom-markdown').evaluate((el) => getComputedStyle(el).overflow);
    expect(markdownOverflow).toBe('visible');
  } finally {
    await close();
  }
});
