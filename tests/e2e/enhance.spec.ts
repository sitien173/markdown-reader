import { test, expect } from './fixtures';
import fs from 'node:fs';
import path from 'node:path';
import { createServer, type Server } from 'node:http';

let server: Server;
let fixtureUrl = '';
test.beforeAll(async () => {
  server = createServer((request, response) => {
    const name = new URL(request.url ?? '/', 'http://127.0.0.1').pathname.slice(1);
    const file = path.resolve(`tests/fixtures/markdown/${name}`);
    response.writeHead(200, { 'content-type': 'text/markdown' });
    if (name === 'duplicate-diagrams.md') {
      response.end('```mermaid\ngraph TD; A-->B\n```\n\n```mermaid\ngraph TD; A-->B\n```');
    } else if (name === 'code.md') {
      response.end('```js\nconst answer = 42;\n```');
    } else if (name === 'plugin-suite.md') {
      response.end(
        [
          'abbr.md',
          'alert.md',
          'deflist.md',
          'mark.md',
          'sub.md',
          'sup.md',
          'task-lists.md',
          'table.md',
          'strikethrough.md',
          'autolink.md',
          'emoji.md',
        ]
          .map((fixture) => fs.readFileSync(path.resolve('tests/fixtures/markdown', fixture), 'utf8'))
          .join('\n\n'),
      );
    } else {
      response.end(fs.existsSync(file) ? fs.readFileSync(file) : '');
    }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  fixtureUrl = `http://127.0.0.1:${(server.address() as import('node:net').AddressInfo).port}`;
});
test.afterAll(async () => {
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
});

test('rich fixture enhances code, math, and diagrams; plain fixture stays lazy', async ({ page, extensionId }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  const requested: string[] = [];
  page.on('request', (request) => requested.push(request.url()));
  const readerHtmlPath = path.resolve('.output/chrome-mv3/reader.html');
  const readerHtml = fs.readFileSync(readerHtmlPath, 'utf8');
  const staticReferences = [...readerHtml.matchAll(/<(?:script|link)\b[^>]*(?:src|href)="([^"]+)"[^>]*>/g)]
    .map((match) => match[1]!)
    .filter((reference) => reference.endsWith('.js') || reference.endsWith('.css'));
  const staticGraph = new Set(
    staticReferences.map((reference) => new URL(reference, `chrome-extension://${extensionId}/reader.html`).href),
  );
  const isAllowedReaderRequest = (url: string) => {
    if (!url.startsWith(`chrome-extension://${extensionId}/`)) return false;
    const pathName = new URL(url).pathname;
    return (
      pathName.endsWith('/reader.html') ||
      /\/chunks\/(?:reader|globals)-[^/]+\.js$/.test(pathName) ||
      /\/assets\/[^/]+\.css$/.test(pathName) ||
      /\/assets\/inter-.*\.woff2?$/.test(pathName) ||
      staticGraph.has(url)
    );
  };
  requested.length = 0;
  await page.goto(`chrome-extension://${extensionId}/reader.html?src=${encodeURIComponent(`${fixtureUrl}/plain.md`)}`);
  await expect(page.locator('.md-content h1')).toHaveText('Plain fixture');
  expect(pageErrors).toEqual([]);
  expect(requested.filter((url) => url.startsWith(`chrome-extension://${extensionId}/`) && !isAllowedReaderRequest(url))).toEqual([]);
  expect(requested.some((url) => /(?:shiki|shikijs|katex|mermaid|github-light|javascript|typescript)/i.test(url))).toBe(false);
  await page.goto(`chrome-extension://${extensionId}/reader.html?src=${encodeURIComponent(`${fixtureUrl}/rich.md`)}`);
  await expect(page.locator('.md-content svg').first()).toBeVisible({ timeout: 20000 });
  await expect(page.locator('.md-content .markdown-enhance-error')).toContainText('not a valid diagram');
  await expect(page.locator('.md-content svg')).toHaveCount(2);
  expect(
    await page
      .locator('[id^="markdown-diagram-"], [id^="dmarkdown-diagram-"]')
      .evaluateAll((nodes) => nodes.filter((node) => !node.closest('.md-content')).length),
  ).toBe(0);
  expect(requested.some((url) => /chunks\/(?:javascript|github-light|dist|chunk)-.*\.js/.test(url))).toBe(true);
  await expect(page.locator('.md-content .katex').first()).toBeVisible();
  expect(await page.locator('.md-content pre code').count()).toBeGreaterThan(0);
  expect(await page.locator('.md-content .shiki span').count()).toBeGreaterThan(0);
  expect(
    await page
      .locator('.md-content .katex')
      .first()
      .evaluate((node) => getComputedStyle(node).fontFamily),
  ).toContain('KaTeX');
  const styles = await page
    .locator('.md-content .katex [style]')
    .evaluateAll((nodes) => nodes.map((node) => (node as HTMLElement).getAttribute('style') ?? '').join(';'));
  expect(styles).toMatch(/left\s*:/);
  expect(styles).toMatch(/position\s*:\s*relative/);
  expect(styles).toMatch(/background-color\s*:/);
  expect(requested.some((url) => url.includes('evil.test'))).toBe(false);
});

test('identical Mermaid diagrams use unique SVG ids', async ({ page, extensionId }) => {
  await page.goto(`chrome-extension://${extensionId}/reader.html?src=${encodeURIComponent(`${fixtureUrl}/duplicate-diagrams.md`)}`);
  await expect(page.locator('.md-content svg')).toHaveCount(2);
  const ids = await page.locator('.md-content [id]').evaluateAll((nodes) => nodes.map((node) => node.id));
  expect(ids.length).toBeGreaterThan(0);
  expect(new Set(ids).size).toBe(ids.length);
});

test('language-tagged code loads Shiki without KaTeX or Mermaid', async ({ page, extensionId }) => {
  const requested: string[] = [];
  page.on('request', (request) => requested.push(request.url()));
  await page.goto(`chrome-extension://${extensionId}/reader.html?src=${encodeURIComponent(`${fixtureUrl}/code.md`)}`);
  await expect(page.locator('.md-content .shiki')).toBeVisible();
  expect(requested.some((url) => /chunks\/(?:core|javascript|github-light|dist|chunk)-.*\.js/.test(url))).toBe(true);
  expect(requested.some((url) => /(?:katex|mermaid)/i.test(url))).toBe(false);
});

test('bundled MarkdownIt plugins render in Chromium', async ({ page, extensionId }) => {
  await page.goto(`chrome-extension://${extensionId}/reader.html?src=${encodeURIComponent(`${fixtureUrl}/plugin-suite.md`)}`);
  const markdown = page.locator('.md-content');
  await expect(markdown.locator('abbr[title="Hyper Text Markup Language"]')).toBeVisible();
  await expect(markdown.locator('dl dt')).toHaveText('Term');
  await expect(markdown.locator('mark')).toContainText('important');
  await expect(markdown.locator('sub')).toHaveText('2');
  await expect(markdown.locator('sup')).toHaveText('2');
  await expect(markdown.locator('input[type=checkbox]')).toHaveCount(2);
  await expect(markdown.locator('.markdown-alert')).toBeVisible();
  await expect(markdown.locator('table')).toBeVisible();
  await expect(markdown.locator('s')).toContainText('removed');
  await expect(markdown.locator('a[href^="https://example.com"]')).toBeVisible();
  await expect(markdown).toContainText('😄');
});

test('sanitized XSS fixture has no script, handlers, or dialogs', async ({ page, extensionId }) => {
  let dialogs = 0;
  page.on('dialog', async (dialog) => {
    dialogs++;
    await dialog.dismiss();
  });
  await page.goto(`chrome-extension://${extensionId}/reader.html?src=${encodeURIComponent(`${fixtureUrl}/xss.md`)}`);
  await expect(page.locator('.md-content')).toBeVisible();
  expect(dialogs).toBe(0);
  expect(await page.locator('.md-content script').count()).toBe(0);
  expect(
    await page
      .locator('.md-content')
      .evaluate((container) =>
        Array.from(container.querySelectorAll('*')).some((node) =>
          Array.from(node.attributes).some((attribute) => attribute.name.toLowerCase().startsWith('on')),
        ),
      ),
  ).toBe(false);
});

test('javascript Shiki grammar chunk is requested exactly once', async ({ page, extensionId }) => {
  const grammarRequests: string[] = [];
  page.on('request', (request) => {
    if (/\/chunks\/javascript-[^/]+\.js$/.test(new URL(request.url()).pathname)) grammarRequests.push(request.url());
  });
  await page.goto(`chrome-extension://${extensionId}/reader.html?src=${encodeURIComponent(`${fixtureUrl}/code.md`)}`);
  await expect(page.locator('.md-content .shiki')).toBeVisible();
  expect(grammarRequests).toHaveLength(1);
});

for (const scheme of ['light', 'dark'] as const) {
  test(`${scheme} scheme: dual-theme Shiki markup, unique SVG ids, and no leaked Mermaid nodes after a scheme change`, async ({
    page,
    extensionId,
  }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto(`chrome-extension://${extensionId}/reader.html?src=${encodeURIComponent(`${fixtureUrl}/duplicate-diagrams.md`)}`);
    await expect(page.locator('.md-content .md-diagram-screen svg')).toHaveCount(2);
    await expect(page.locator('.md-content .md-diagram-print svg')).toHaveCount(scheme === 'dark' ? 2 : 0);
    const next = scheme === 'dark' ? 'light' : 'dark';
    await page.emulateMedia({ colorScheme: next });
    // A dark screen render keeps a light print copy; the rerender has finished once that matches the new scheme.
    await expect(page.locator('.md-content .md-diagram-print svg')).toHaveCount(next === 'dark' ? 2 : 0);
    await expect(page.locator('.md-content .md-diagram-screen svg')).toHaveCount(2);
    const ids = await page.locator('.md-content [id]').evaluateAll((nodes) => nodes.map((node) => node.id));
    expect(new Set(ids).size).toBe(ids.length);
    await expect
      .poll(() =>
        page
          .locator('[id^="markdown-diagram-"], [id^="dmarkdown-diagram-"]')
          .evaluateAll((nodes) => nodes.filter((node) => !node.closest('.md-content')).length),
      )
      .toBe(0);
    await page.goto(`chrome-extension://${extensionId}/reader.html?src=${encodeURIComponent(`${fixtureUrl}/code.md`)}`);
    await expect(page.locator('.md-content pre.shiki')).toBeVisible();
    expect(await page.locator('.md-content pre.shiki [style*="--shiki-dark:"]').count()).toBeGreaterThan(0);
  });
}
