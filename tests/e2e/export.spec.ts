import { readFile } from 'node:fs/promises';
import { test, expect, startFixtureServer } from './fixtures';

for (const scheme of ['light', 'dark'] as const) {
  test(`exported HTML opened in a fresh page with network blocked shows code, math, and diagrams with zero network requests (${scheme})`, async ({
    page,
    context,
    extensionId,
  }) => {
    const richMarkdown = await readFile('tests/fixtures/markdown/rich.md', 'utf8');
    const tinyPng = Buffer.from([
      137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0, 31, 21, 196, 137, 0, 0, 0, 10,
      73, 68, 65, 84, 120, 156, 99, 0, 1, 0, 0, 5, 0, 1, 13, 10, 45, 180, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130,
    ]);

    const { origin, close } = await startFixtureServer((req, res) => {
      if (req.url === '/remote.png') {
        res.setHeader('content-type', 'image/png');
        res.end(tinyPng);
        return;
      }
      res.setHeader('content-type', 'text/markdown; charset=utf-8');
      res.end(
        `${richMarkdown}\n\n![Remote image](${origin}/remote.png)\n\n<img src="${origin}/remote.png" srcset="${origin}/remote.png 1x, ${origin}/remote.png 2x" alt="Srcset remote">\n`,
      );
    });

    try {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto(`chrome-extension://${extensionId}/reader.html?src=${encodeURIComponent(`${origin}/rich.md`)}`);
      await expect(page.locator('.md-content h1')).toHaveText('Rich fixture', { timeout: 20000 });
      await expect(page.locator('.md-content svg').first()).toBeVisible({ timeout: 20000 });
      await expect(page.locator('.md-content .katex').first()).toBeVisible();
      await expect(page.locator('.md-content .shiki').first()).toBeVisible();
      await expect(page.locator(`.md-content img[src="${origin}/remote.png"]`).first()).toBeVisible();

      // Open Export menu and trigger download
      const exportButton = page.getByRole('button', { name: 'Export' });
      await exportButton.click();
      const downloadPromise = page.waitForEvent('download');
      await page.getByRole('menuitem', { name: 'Export HTML' }).click();
      const download = await downloadPromise;
      const downloadPath = await download.path();
      expect(downloadPath).toBeTruthy();
      const exportedHtml = await readFile(downloadPath!, 'utf8');

      // The embedded Markdown rules come from the shared stylesheet and load nothing remote
      expect(exportedHtml).toContain('.md-content h1');
      expect(exportedHtml).not.toMatch(/@import/);
      expect(exportedHtml).not.toMatch(/url\(\s*(?!["']?(?:data:|#))/i);

      // Fresh page with all network blocked
      const freshPage = await context.newPage();
      const requests: string[] = [];
      freshPage.on('request', (req) => requests.push(req.url()));
      await freshPage.route('**/*', (route) => route.abort());
      await freshPage.emulateMedia({ colorScheme: scheme });

      await freshPage.setContent(exportedHtml, { waitUntil: 'load' });

      // Assert highlighted Shiki markup, math, and diagram are present and visible
      await expect(freshPage.locator('.md-content pre.shiki')).toBeVisible();
      await expect(freshPage.locator('.md-content pre.shiki code span[style*="color"]').first()).toBeVisible();
      await expect(freshPage.locator('.md-content .katex').first()).toBeVisible();
      await expect(freshPage.locator('.md-content svg:visible').first()).toBeVisible();
      expect(exportedHtml).not.toMatch(/<script/i);

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
}

test('exported HTML switches theme under colorScheme emulation and keeps SVG ids disjoint', async ({ page, context, extensionId }) => {
  const { origin, close } = await startFixtureServer((_req, res) => {
    res.setHeader('content-type', 'text/markdown; charset=utf-8');
    res.end('# Themed export\n\n```js\nconst answer = 42;\n```\n\n```mermaid\ngraph TD\n  A --> B\n```\n');
  });
  try {
    await page.goto(`chrome-extension://${extensionId}/reader.html?src=${encodeURIComponent(`${origin}/doc.md`)}`);
    await expect(page.locator('.md-content .md-diagram svg')).toBeVisible({ timeout: 20000 });
    await page.getByRole('button', { name: 'Export options' }).click();
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('menuitem', { name: 'Export HTML' }).click();
    const exportedHtml = await readFile((await (await downloadPromise).path())!, 'utf8');
    expect(exportedHtml).not.toMatch(/<script/i);

    const fresh = await context.newPage();
    const requests: string[] = [];
    fresh.on('request', (req) => requests.push(req.url()));
    await fresh.route('**/*', (route) => route.abort());
    await fresh.setContent(exportedHtml, { waitUntil: 'load' });

    const ids = await fresh.locator('[id]').evaluateAll((nodes) => nodes.map((node) => node.id));
    expect(new Set(ids).size).toBe(ids.length);
    await expect(fresh.locator('.md-diagram--light svg')).toHaveCount(1);
    await expect(fresh.locator('.md-diagram--dark svg')).toHaveCount(1);

    const probe = () =>
      fresh.evaluate(() => {
        const visible = (selector: string) => {
          const el = document.querySelector(selector);
          return !!el && getComputedStyle(el).display !== 'none';
        };
        return {
          body: getComputedStyle(document.body).backgroundColor,
          token: getComputedStyle(document.querySelector('pre.shiki code span')!).color,
          light: visible('.md-diagram--light'),
          dark: visible('.md-diagram--dark'),
        };
      });
    await fresh.emulateMedia({ colorScheme: 'light' });
    const light = await probe();
    await fresh.emulateMedia({ colorScheme: 'dark' });
    const dark = await probe();
    expect(light).toMatchObject({ body: 'rgb(255, 255, 255)', light: true, dark: false });
    expect(dark).toMatchObject({ body: 'rgb(28, 28, 30)', light: false, dark: true });
    expect(dark.token).not.toBe(light.token);
    await fresh.emulateMedia({ colorScheme: 'dark', media: 'print' });
    expect(await probe()).toMatchObject({ body: 'rgb(255, 255, 255)', token: light.token, light: true, dark: false });
    expect(requests).toHaveLength(0);
    await fresh.close();
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
    await expect(page.locator('.md-content h1')).toHaveText('Editable doc');
    await page.getByRole('radio', { name: 'Edit', exact: true }).click();
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
    await expect(page.locator('.md-content h1')).toHaveText('Printable Document', { timeout: 20000 });

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

    const barDisplay = await page.locator('[data-slot="reader-bar"]').evaluate((el) => getComputedStyle(el).display);
    expect(barDisplay).toBe('none');

    const tocDisplay = await page.locator('[data-slot="reader-toc"]').evaluate((el) => getComputedStyle(el).display);
    expect(tocDisplay).toBe('none');

    const markdownOverflow = await page.locator('.md-content').evaluate((el) => getComputedStyle(el).overflow);
    expect(markdownOverflow).toBe('visible');
  } finally {
    await close();
  }
});
