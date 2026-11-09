import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
let server: Server,
  url = '',
  missingCalls = 0;
test.beforeAll(async () => {
  missingCalls = 0;
  server = createServer((req, res) => {
    if (req.url === '/missing.md' && missingCalls++ === 0) {
      res.writeHead(404);
      res.end('not found');
      return;
    }
    if (req.url === '/outline.md') {
      res.setHeader('content-type', 'text/markdown');
      res.end('# First\n\n## Second\n\n### Third\n\n#### Fourth\n\n##### Fifth\n\n###### Sixth\n\n'.repeat(12));
      return;
    }
    if (req.url === '/footnotes.md') {
      res.setHeader('content-type', 'text/markdown');
      res.end('# Notes\n\nA reference[^note].\n\n'.repeat(20) + '\n[^note]: Footnote target\n');
      return;
    }
    if (req.url === '/link.md') {
      res.setHeader('content-type', 'text/markdown');
      res.end('# Linked document\n\n[target](./target.md)\n\n[unsafe](javascript:alert(1))');
      return;
    }
    if (req.url === '/target.md') {
      res.setHeader('content-type', 'text/markdown');
      res.end('# Target document');
      return;
    }
    res.setHeader('content-type', 'text/markdown');
    res.end('# From URL\n\n[Next](./outline.md)');
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
test.afterAll(async () => {
  await new Promise<void>((r) => server.close(() => r()));
});
async function openUrl(page: Page, href: string) {
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('menuitem', { name: 'Open URL' }).click();
  const dialog = page.getByRole('dialog', { name: 'Open URL' });
  await dialog.getByLabel('Markdown URL').fill(href);
  await dialog.getByRole('button', { name: 'Open URL' }).click();
}

test('URL source, retry, nested TOC, file picker, and keyboard focus', async ({ page, extensionId }) => {
  await page.goto(`chrome-extension://${extensionId}/reader.html`);
  await openUrl(page, `${url}/doc.md`);
  await expect(page.locator('.md-content h1')).toHaveText('From URL');
  await openUrl(page, `${url}/missing.md`);
  await expect(page.getByRole('alert')).toContainText('HTTP 404');
  await page.getByRole('alert').getByRole('button', { name: 'Retry' }).click();
  await expect(page.locator('.md-content h1')).toHaveText('From URL');
  await openUrl(page, `${url}/outline.md`);
  await expect(page.locator('.md-content h6').first()).toBeVisible();
  for (let n = 1; n <= 6; n++)
    await expect(page.locator('[data-slot="reader-toc"]')).toContainText(['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth'][n - 1]!);
  await page.locator('[data-slot="reader-toc"]').getByRole('button', { name: 'Sixth' }).last().click();
  const target = page.locator('#user-content-sixth-11');
  await expect
    .poll(() =>
      target.evaluate((el) => {
        const c = el.closest('[data-slot="reader-content"]')!;
        const wanted = Math.min(
          c.scrollTop + el.getBoundingClientRect().top - c.getBoundingClientRect().top - 24,
          c.scrollHeight - c.clientHeight,
        );
        return c.scrollTop > 0 && Math.abs(c.scrollTop - wanted) < 4;
      }),
    )
    .toBe(true);
  const content = page.locator('[data-slot="reader-content"]');
  await content.evaluate((el) => el.scrollTo({ top: 0, behavior: 'instant' }));
  await expect(page.locator('[aria-current="location"]')).toHaveText('First');
  // Put the sixth "Second" heading at the top edge of the scroller so the result does not depend on chrome height.
  await content.evaluate((el) => {
    const second = el.querySelector('#user-content-second-5')!;
    el.scrollTo({ top: el.scrollTop + second.getBoundingClientRect().top - el.getBoundingClientRect().top, behavior: 'instant' });
  });
  const tocSeconds = page.locator('[data-slot="reader-toc"]').getByRole('button', { name: 'Second' });
  await expect(tocSeconds.nth(5)).toHaveAttribute('aria-current', 'location');
  await expect(page.locator('[aria-current="location"]')).toHaveCount(1);
  await page.evaluate(() => {
    (window as any).showOpenFilePicker = async () => [
      { getFile: async () => new File(['# Local file'], 'local.md', { type: 'text/markdown' }) },
    ];
  });
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('menuitem', { name: 'Open file' }).click();
  await expect(page.locator('.md-content h1').first()).toHaveText('Local file');
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('menuitem', { name: 'Open URL' }).click();
  await page.getByLabel('Markdown URL').focus();
  await expect(page.getByLabel('Markdown URL')).toHaveCSS('outline-style', 'solid');
});

test('fragment links stay in the reader, resolved links update src, and unsafe links cannot navigate', async ({ page, extensionId }) => {
  await page.goto(`chrome-extension://${extensionId}/reader.html`);
  await openUrl(page, `${url}/footnotes.md`);
  await expect(page.locator('.md-content')).toContainText('Footnote target');
  const before = page.url();
  await page.locator('.md-content a[href^="#"]:not(.md-permalink)').first().click();
  expect(page.url()).toBe(before);
  const target = page.locator('.md-content li[id*="fn"]');
  await expect(target.first()).toBeInViewport();
  await openUrl(page, `${url}/link.md`);
  const unsafe = page.getByRole('link', { name: 'unsafe' });
  if (await unsafe.count()) {
    await expect(unsafe).not.toHaveAttribute('href', /^javascript:/);
    await unsafe.click();
  }
  expect(page.url()).toContain('link.md');
  await page.getByRole('link', { name: 'target' }).click();
  await expect(page.locator('.md-content h1')).toHaveText('Target document');
  expect(page.url()).toContain(`src=${encodeURIComponent(`${url}/target.md`)}`);
});

test('Tab traversal exposes visible focus on URL, file, and sidebar tabs', async ({ page, extensionId }) => {
  await page.goto(`chrome-extension://${extensionId}/reader.html`);
  const focused = async () =>
    page.evaluate(() => {
      const el = document.activeElement as HTMLElement;
      const style = getComputedStyle(el);
      return (style.outlineStyle !== 'none' && style.outlineWidth !== '0px') || style.boxShadow !== 'none';
    });
  const expected = [
    page.getByRole('button', { name: 'Menu' }),
    page.getByRole('group', { name: 'Sidebar view' }).getByRole('button', { name: 'Files' }),
  ];
  await page.getByRole('button', { name: 'Toggle sidebar' }).focus();
  for (const control of expected) {
    await page.keyboard.press('Tab');
    await expect(control).toBeFocused();
    expect(await focused(), `visible focus on ${await control.getAttribute('aria-label')}`).toBe(true);
  }
  await page.keyboard.press('ArrowRight');
  const outlineButton = page.getByRole('group', { name: 'Sidebar view' }).getByRole('button', { name: 'Outline' });
  await expect(outlineButton).toBeFocused();
  expect(await focused(), 'visible focus on Outline button').toBe(true);
});

test('Open folder stays reachable from the Files tab after leaving the top bar', async ({ page, extensionId }) => {
  await page.goto(`chrome-extension://${extensionId}/reader.html`);
  await page.getByRole('group', { name: 'Sidebar view' }).getByRole('button', { name: 'Files' }).click();
  const filesPanel = page.locator('[data-slot="reader-toc"]').getByRole('button', { name: 'Open folder' });
  await expect(filesPanel).toBeVisible();
  await expect(filesPanel).toHaveCount(1);
});
