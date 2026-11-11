import { Buffer } from 'node:buffer';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { type BrowserContext, chromium } from '@playwright/test';
import { expect, startFixtureServer, test } from './fixtures';

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

let origin = '';
let closeServer: (() => Promise<void>) | undefined;
const largeData = JSON.stringify({ data: 'x'.repeat(210 * 1024) }, null, 2);

test.beforeAll(async () => {
  const fixture = await startFixtureServer((req, res) => {
    if (req.url === '/sample.json') {
      res.setHeader('content-type', 'application/json');
      res.end('{"hello":"world"}');
      return;
    }
    if (req.url === '/minified.json') {
      res.setHeader('content-type', 'application/json');
      res.end('{"a":1,"b":2}');
      return;
    }
    if (req.url === '/comments.jsonc') {
      res.setHeader('content-type', 'application/json');
      res.end('// leading comment\n{\n  /* inline */ "key": "value" // trailing\n}\n');
      return;
    }
    if (req.url === '/invalid.json') {
      res.setHeader('content-type', 'application/json');
      res.end('{\n  "name": \n}');
      return;
    }
    if (req.url === '/empty.json') {
      res.setHeader('content-type', 'application/json');
      res.end('');
      return;
    }
    if (req.url === '/large.json') {
      res.setHeader('content-type', 'application/json');
      res.end(largeData);
      return;
    }
    if (req.url === '/simple.json') {
      res.setHeader('content-type', 'application/json');
      res.end('{\n  "title": "preview"\n}');
      return;
    }
    if (req.url === '/escaped.json') {
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify(JSON.stringify({ unescaped: true, count: 42 })));
      return;
    }
    res.writeHead(404);
    res.end();
  });
  origin = fixture.origin;
  closeServer = fixture.close;
});

test.afterAll(async () => {
  await closeServer?.();
});

test('a .json page does not redirect while general.renderJson is off and redirects once enabled', async ({ context, extensionId }) => {
  const doc = await context.newPage();
  await doc.goto(`${origin}/sample.json`);
  await doc.waitForLoadState('networkidle');
  await doc.waitForTimeout(1000);
  expect(doc.url()).toBe(`${origin}/sample.json`);
  // The raw payload is still on screen, so no redirect happened
  expect(await doc.locator('body').textContent()).toContain('hello');

  type LocalStorage = {
    chrome: {
      storage: {
        local: {
          get(k: string): Promise<Record<string, unknown>>;
          set(v: Record<string, unknown>): Promise<void>;
        };
      };
    };
  };
  const helper = await context.newPage();
  await helper.goto(`chrome-extension://${extensionId}/reader.html`);
  await helper.evaluate(async () => {
    const key = 'settings:v1';
    const storage = (globalThis as unknown as LocalStorage).chrome.storage.local;
    const current = ((await storage.get(key))[key] ?? { version: 1 }) as {
      version: number;
      general?: Record<string, unknown>;
    };
    await storage.set({
      [key]: {
        ...current,
        general: {
          ...(current.general ?? {}),
          renderJson: true,
        },
      },
    });
  });
  await helper.close();

  await doc.goto(`${origin}/sample.json`);
  await expect(doc).toHaveURL(new RegExp(`chrome-extension://${extensionId}/reader\\.html\\?src=`));
  await expect(doc.locator('.md-content')).toBeVisible({ timeout: 20000 });
  await expect(doc.locator('.md-code-lang')).toHaveText('json');
});

test('minified input shows formatted', async ({ page, extensionId }) => {
  await page.goto(`chrome-extension://${extensionId}/reader.html?src=${encodeURIComponent(`${origin}/minified.json`)}`);
  await expect(page.locator('.md-content')).toBeVisible({ timeout: 20000 });
  await expect(page.locator('.md-content')).toContainText('{\n  "a": 1,\n  "b": 2\n}');
});

test('a .jsonc fixture with comments renders highlighted', async ({ page, extensionId }) => {
  await page.goto(`chrome-extension://${extensionId}/reader.html?src=${encodeURIComponent(`${origin}/comments.jsonc`)}`);
  await expect(page.locator('.md-content .shiki')).toBeVisible({ timeout: 20000 });
  await expect(page.locator('.md-code-lang')).toHaveText('jsonc');
  await expect(page.locator('.md-content')).toContainText('// leading comment');
  await expect(page.locator('.md-content')).toContainText('/* inline */');
});

test('invalid JSON shows the banner with line and column above the original text', async ({ page, extensionId }) => {
  await page.goto(`chrome-extension://${extensionId}/reader.html?src=${encodeURIComponent(`${origin}/invalid.json`)}`);
  const banner = page.locator('[data-slot="status-banner"]');
  await expect(banner).toBeVisible({ timeout: 20000 });
  await expect(banner).toContainText('(line 3, column 1)');
  await expect(banner.getByRole('button', { name: 'Retry' })).toHaveCount(0);
  await expect(banner.getByRole('button', { name: 'Dismiss' })).toHaveCount(0);

  const content = page.locator('[data-slot="reader-content"]');
  await expect(content).toContainText('{\n  "name": \n}');
});

test('an empty file shows the banner', async ({ page, extensionId }) => {
  await page.goto(`chrome-extension://${extensionId}/reader.html?src=${encodeURIComponent(`${origin}/empty.json`)}`);
  const banner = page.locator('[data-slot="status-banner"]');
  await expect(banner).toBeVisible({ timeout: 20000 });
  await expect(banner).toHaveText('Empty document');
  await expect(banner.getByRole('button', { name: 'Retry' })).toHaveCount(0);
});

test('a file above 200 KB renders as plain text with the code bar, and code-bar Copy works', async ({ context, page, extensionId }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto(`chrome-extension://${extensionId}/reader.html?src=${encodeURIComponent(`${origin}/large.json`)}`);
  await expect(page.locator('.md-content')).toBeVisible({ timeout: 20000 });
  await expect(page.locator('.md-content .shiki')).toHaveCount(0);
  await expect(page.locator('.md-code-bar')).toBeVisible();
  await expect(page.locator('.md-code-lang')).toHaveText('json');

  const copyBtn = page.locator('.md-code-copy');
  await expect(copyBtn).toHaveText('Copy');
  await copyBtn.click();
  await expect(copyBtn).toHaveText('Copied');

  const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboardText.length).toBe(largeData.length);
});

test('edit and Export HTML are unavailable while Print is available', async ({ page, extensionId }) => {
  await page.goto(`chrome-extension://${extensionId}/reader.html?src=${encodeURIComponent(`${origin}/simple.json`)}`);
  await expect(page.locator('.md-content')).toBeVisible({ timeout: 20000 });

  await page.getByRole('button', { name: 'Menu' }).click();
  await expect(page.getByRole('menuitem', { name: 'Export HTML' })).toBeDisabled();
  await expect(page.getByRole('menuitem', { name: 'Print' })).toBeEnabled();
  await page.keyboard.press('Escape');

  await page.keyboard.press('Control+k');
  const palette = page.getByRole('dialog', { name: 'Command palette' });
  await expect(palette).toBeVisible();

  await palette.getByRole('combobox').fill('Edit mode');
  await expect(palette.getByRole('option', { name: 'Edit mode' })).toHaveAttribute('aria-disabled', 'true');

  await palette.getByRole('combobox').fill('Export HTML');
  await expect(palette.getByRole('option', { name: 'Export HTML' })).toHaveAttribute('aria-disabled', 'true');

  await palette.getByRole('combobox').fill('Print');
  await expect(palette.getByRole('option', { name: 'Print' })).not.toHaveAttribute('aria-disabled', 'true');
});

test('auto-refresh re-renders after the fixture changes on disk', async ({ userDataDir }) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'markdown-reader-json-reload-'));
  const file = path.join(dir, 'live.json');
  await writeFile(file, '{\n  "version": 1\n}\n');
  const { context, extensionId } = await contextWithFileAccess(userDataDir);
  try {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/reader.html?src=${encodeURIComponent(pathToFileURL(file).href)}&mode=read`);
    await expect(page.locator('.md-content')).toContainText('"version": 1', { timeout: 20000 });
    await writeFile(file, '{\n  "version": 2\n}\n');
    await expect(page.locator('.md-content')).toContainText('"version": 2', { timeout: 20000 });
  } finally {
    await context.close();
    await rm(dir, { recursive: true, force: true });
  }
});

test('toolbar layout and indent change the view', async ({ page, extensionId }) => {
  await page.goto(`chrome-extension://${extensionId}/reader.html?src=${encodeURIComponent(`${origin}/sample.json`)}`);
  await expect(page.locator('.md-content')).toBeVisible({ timeout: 20000 });
  const toolbar = page.locator('[data-slot="json-toolbar"]');
  await expect(toolbar).toBeVisible();

  // Initial: Beautify with 2 spaces (open rule for single-line)
  await expect(toolbar.getByRole('button', { name: 'Beautify' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.md-content pre code')).toHaveText('{\n  "hello": "world"\n}');

  // Change indent to 4 spaces
  await toolbar.locator('[data-slot="select-trigger"]').click();
  await page.getByRole('option', { name: '4 spaces' }).click();
  await expect(page.locator('.md-content pre code')).toHaveText('{\n    "hello": "world"\n}');

  // Change indent to tab
  await toolbar.locator('[data-slot="select-trigger"]').click();
  await page.getByRole('option', { name: 'Tab' }).click();
  await expect(page.locator('.md-content pre code')).toHaveText('{\n\t"hello": "world"\n}');

  // Minify
  await toolbar.getByRole('button', { name: 'Minify' }).click();
  await expect(page.locator('.md-content pre code')).toHaveText('{"hello":"world"}');

  // Original
  await toolbar.getByRole('button', { name: 'Original' }).click();
  await expect(page.locator('.md-content pre code')).toHaveText('{"hello":"world"}');
});

test('Sort keys locks and checks Strip comments on JSONC', async ({ page, extensionId }) => {
  await page.goto(`chrome-extension://${extensionId}/reader.html?src=${encodeURIComponent(`${origin}/comments.jsonc`)}`);
  await expect(page.locator('.md-content')).toBeVisible({ timeout: 20000 });
  const toolbar = page.locator('[data-slot="json-toolbar"]');

  const stripToggle = toolbar.getByRole('button', { name: 'Strip comments' });
  const sortToggle = toolbar.getByRole('button', { name: 'Sort keys' });

  await expect(stripToggle).toBeVisible();
  await expect(stripToggle).toBeEnabled();
  await expect(stripToggle).toHaveAttribute('aria-pressed', 'false');

  await sortToggle.click();
  await expect(sortToggle).toHaveAttribute('aria-pressed', 'true');
  await expect(stripToggle).toHaveAttribute('aria-pressed', 'true');
  await expect(stripToggle).toBeDisabled();

  // Content has sorted keys and comments removed. The repaint is async, so these must retry.
  const code = page.locator('.md-content pre code');
  await expect(code).not.toContainText('// leading comment');
  await expect(code).not.toContainText('/* inline */');
});

test('Escape and Unescape round trip', async ({ page, extensionId }) => {
  await page.goto(`chrome-extension://${extensionId}/reader.html?src=${encodeURIComponent(`${origin}/escaped.json`)}`);
  await expect(page.locator('.md-content')).toBeVisible({ timeout: 20000 });
  const toolbar = page.locator('[data-slot="json-toolbar"]');

  const unescapeBtn = toolbar.getByRole('button', { name: 'Unescape' });
  await expect(unescapeBtn).toBeVisible();

  // Unescape
  await unescapeBtn.click();
  const revertBtn = toolbar.getByRole('button', { name: 'Revert' });
  await expect(revertBtn).toBeVisible();
  await expect(page.locator('.md-content pre code')).toContainText('"unescaped": true');

  // Escape toggle
  const escapeToggle = toolbar.getByRole('button', { name: 'Escape' });
  await escapeToggle.click();
  await expect(escapeToggle).toHaveAttribute('aria-pressed', 'true');
  // The view repaints through transformJson and enhance, so wait on the text rather than reading it once
  await expect(page.locator('.md-content pre code')).toHaveText(/^\s*"/);

  // Toggle Escape off
  await escapeToggle.click();
  await expect(escapeToggle).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('.md-content pre code')).toContainText('"unescaped": true');

  // Revert back to original escaped string literal
  await revertBtn.click();
  await expect(toolbar.getByRole('button', { name: 'Unescape' })).toBeVisible();
});

test('code-bar Copy copies the current view', async ({ context, page, extensionId }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto(`chrome-extension://${extensionId}/reader.html?src=${encodeURIComponent(`${origin}/simple.json`)}`);
  await expect(page.locator('.md-content')).toBeVisible({ timeout: 20000 });

  const toolbar = page.locator('[data-slot="json-toolbar"]');
  await toolbar.getByRole('button', { name: 'Minify' }).click();
  await expect(page.locator('.md-content pre code')).toHaveText('{"title":"preview"}');

  const copyBtn = page.locator('.md-code-copy');
  await copyBtn.click();
  await expect(copyBtn).toHaveText('Copied');

  const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboardText).toBe('{"title":"preview"}');
});

test('Download saves view with correct name and content', async ({ page, extensionId }) => {
  await page.goto(`chrome-extension://${extensionId}/reader.html?src=${encodeURIComponent(`${origin}/comments.jsonc`)}`);
  await expect(page.locator('.md-content')).toBeVisible({ timeout: 20000 });
  const toolbar = page.locator('[data-slot="json-toolbar"]');

  // While comments remain: filename is .jsonc. Wait for the first paint, since hasComments starts false.
  const code = page.locator('.md-content pre code');
  await expect(code).toContainText('// leading comment');
  const downloadPromise = page.waitForEvent('download');
  await toolbar.getByRole('button', { name: 'Download' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('comments.jsonc');

  // Minify removes comments: filename becomes .json
  await toolbar.getByRole('button', { name: 'Minify' }).click();
  await expect(code).not.toContainText('// leading comment');
  const downloadPromise2 = page.waitForEvent('download');
  await toolbar.getByRole('button', { name: 'Download' }).click();
  const download2 = await downloadPromise2;
  expect(download2.suggestedFilename()).toBe('comments.json');

  const stream = await download2.createReadStream();
  const chunks: Buffer[] = [];
  if (stream) {
    for await (const chunk of stream) {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }
  }
  const downloadedContent = Buffer.concat(chunks).toString('utf8');
  expect(downloadedContent).toBe('{"key":"value"}');
});

test('auto-refresh keeps toolbar state', async ({ userDataDir }) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'markdown-reader-json-toolbar-state-'));
  const file = path.join(dir, 'live-state.json');
  await writeFile(file, '{\n  "count": 1\n}\n');
  const { context, extensionId } = await contextWithFileAccess(userDataDir);
  try {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/reader.html?src=${encodeURIComponent(pathToFileURL(file).href)}&mode=read`);
    await expect(page.locator('.md-content')).toBeVisible({ timeout: 20000 });

    const toolbar = page.locator('[data-slot="json-toolbar"]');
    const minifyBtn = toolbar.getByRole('button', { name: 'Minify' });
    await minifyBtn.click();
    await expect(page.locator('.md-content pre code')).toHaveText('{"count":1}');

    // Change file content on disk
    await writeFile(file, '{\n  "count": 2\n}\n');
    await expect(page.locator('.md-content pre code')).toHaveText('{"count":2}', { timeout: 20000 });

    // Toolbar Minify state remains active
    await expect(minifyBtn).toHaveAttribute('aria-pressed', 'true');
  } finally {
    await context.close();
    await rm(dir, { recursive: true, force: true });
  }
});

test('a parse error disables the tools and Download uses original text', async ({ page, extensionId }) => {
  await page.goto(`chrome-extension://${extensionId}/reader.html?src=${encodeURIComponent(`${origin}/invalid.json`)}`);
  await expect(page.locator('[data-slot="status-banner"]')).toBeVisible({ timeout: 20000 });
  const toolbar = page.locator('[data-slot="json-toolbar"]');

  await expect(toolbar.getByRole('button', { name: 'Original' })).toBeDisabled();
  await expect(toolbar.getByRole('button', { name: 'Beautify' })).toBeDisabled();
  await expect(toolbar.getByRole('button', { name: 'Minify' })).toBeDisabled();
  await expect(toolbar.getByRole('button', { name: 'Sort keys' })).toBeDisabled();
  await expect(toolbar.getByRole('button', { name: 'Escape' })).toBeDisabled();

  const downloadBtn = toolbar.getByRole('button', { name: 'Download' });
  await expect(downloadBtn).toBeEnabled();

  const downloadPromise = page.waitForEvent('download');
  await downloadBtn.click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('invalid.json');

  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  if (stream) {
    for await (const chunk of stream) {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }
  }
  const downloadedContent = Buffer.concat(chunks).toString('utf8');
  expect(downloadedContent).toBe('{\n  "name": \n}');
});
