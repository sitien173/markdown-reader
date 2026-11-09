import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';

type PickerWindow = { showOpenFilePicker: () => Promise<unknown[]>; showDirectoryPicker: () => Promise<unknown> };

type ChromeWindow = {
  chrome: { storage: { local: { get(key: string): Promise<Record<string, unknown>>; set(items: object): Promise<void> } } };
};

const readerUrl = (extensionId: string) => `chrome-extension://${extensionId}/reader.html`;
const sidebar = (page: Page) => page.locator('[data-slot="reader-toc"]');

const outlineDoc = ['# Title', '## Child', '### Grandchild', '# Solo', '## Sub'].join('\n\n');

// A folder with three Markdown files, one in a subfolder, opened through the production folder picker path.
async function openFolder(page: Page) {
  await page.evaluate(async (doc) => {
    const root = await navigator.storage.getDirectory();
    const dir = await root.getDirectoryHandle('shell-folder', { create: true });
    const notes = await dir.getDirectoryHandle('notes', { create: true });
    const files: Array<[FileSystemDirectoryHandle, string, string]> = [
      [dir, 'alpha.md', doc],
      [dir, 'beta.md', '# Beta\n'],
      [notes, 'gamma.md', '# Gamma\n'],
    ];
    for (const [parent, name, body] of files) {
      const writable = await (await parent.getFileHandle(name, { create: true })).createWritable();
      await writable.write(body);
      await writable.close();
    }
    (window as unknown as PickerWindow).showDirectoryPicker = async () => dir;
  }, outlineDoc);
  await page.getByRole('button', { name: 'Open folder' }).first().click();
  await expect(page.locator('.md-content h1').first()).toBeVisible({ timeout: 20000 });
}

test.describe('sidebar', () => {
  test('read mode has no top bar and a left sidebar about 260 px wide', async ({ page, extensionId }) => {
    await page.goto(readerUrl(extensionId));
    await page.locator('#root > *').first().waitFor();
    await openFolder(page);
    await expect(page.locator('[data-slot="reader-bar"]')).toHaveCount(0);
    await expect(page.getByRole('toolbar')).toHaveCount(0);
    const box = await sidebar(page).boundingBox();
    expect(box?.x).toBe(0);
    expect(box?.width).toBeGreaterThan(250);
    expect(box?.width).toBeLessThan(270);
  });

  test('a Files and Outline segmented control with named icons switches the list', async ({ page, extensionId }) => {
    await page.goto(readerUrl(extensionId));
    await page.locator('#root > *').first().waitFor();
    await openFolder(page);
    const group = sidebar(page).getByRole('group', { name: 'Sidebar view' });
    const files = group.getByRole('button', { name: 'Files' });
    const outline = group.getByRole('button', { name: 'Outline' });
    await expect(files.locator('svg')).toHaveCount(1);
    await expect(outline.locator('svg')).toHaveCount(1);
    await expect(outline).toHaveAttribute('aria-pressed', 'true');
    await expect(sidebar(page).getByRole('navigation', { name: 'Table of contents' })).toBeVisible();
    await files.click();
    await expect(files).toHaveAttribute('aria-pressed', 'true');
    await expect(sidebar(page).locator('[data-slot="file-tree"]').first()).toBeVisible();
  });

  test('the search icon reveals a filter that narrows the files and restores them when cleared', async ({ page, extensionId }) => {
    await page.goto(readerUrl(extensionId));
    await page.locator('#root > *').first().waitFor();
    await openFolder(page);
    await sidebar(page).getByRole('button', { name: 'Files' }).click();
    await expect(sidebar(page).getByRole('textbox', { name: 'Filter' })).toHaveCount(0);
    await sidebar(page).getByRole('button', { name: 'Search' }).click();
    const filter = sidebar(page).getByRole('textbox', { name: 'Filter' });
    await expect(filter).toBeFocused();
    const names = sidebar(page).locator('[data-slot="file-tree-file"]');
    await expect(names).toHaveText(['gamma.md', 'alpha.md', 'beta.md']);
    await filter.fill('bet');
    await expect(names).toHaveText(['beta.md']);
    await filter.fill('');
    await expect(names).toHaveCount(3);
  });

  test('outline collapse is off by default and the toggle on a parent hides only its children when enabled', async ({
    page,
    extensionId,
  }) => {
    await page.goto(readerUrl(extensionId));
    await page.locator('#root > *').first().waitFor();
    await openFolder(page);
    await sidebar(page).getByRole('button', { name: 'Files' }).click();
    await sidebar(page).locator('[data-slot="file-tree-file"]', { hasText: 'alpha.md' }).click();
    await expect(page.locator('.md-content h1').first()).toHaveText('Title');
    await sidebar(page).getByRole('button', { name: 'Outline' }).click();
    const nav = sidebar(page).getByRole('navigation', { name: 'Table of contents' });
    await expect(nav.getByRole('button', { name: 'Child', exact: true })).toBeVisible();
    await expect(nav.getByRole('button', { name: /^Collapse / })).toHaveCount(0);
    await page.evaluate(async () => {
      const { chrome } = window as unknown as ChromeWindow;
      const key = 'settings:v1';
      const stored = ((await chrome.storage.local.get(key))[key] ?? { version: 1 }) as { general?: object };
      await chrome.storage.local.set({ [key]: { ...stored, general: { ...stored.general, outlineCollapsing: true } } });
    });
    const collapse = nav.getByRole('button', { name: 'Collapse Title' });
    await expect(collapse).toBeVisible();
    await expect(nav.getByRole('button', { name: 'Collapse Grandchild' })).toHaveCount(0);
    await expect(nav.getByRole('button', { name: 'Collapse Child' })).toBeVisible();
    await collapse.click();
    await expect(nav.getByRole('button', { name: 'Child', exact: true })).toHaveCount(0);
    await expect(nav.getByRole('button', { name: 'Grandchild', exact: true })).toHaveCount(0);
    await expect(nav.getByRole('button', { name: 'Solo', exact: true })).toBeVisible();
    await expect(nav.getByRole('button', { name: 'Expand Title' })).toHaveAttribute('aria-expanded', 'false');
  });
});

const codeDoc = ['# Doc', '## Section', '```js\nconst a = 1;\nconst b = "two";\n```', 'Text.'].join('\n\n');

// Opens a document through the Mod+O shortcut with the file picker stubbed, so no top bar control is needed.
async function openDoc(page: Page, text: string) {
  await page.evaluate(async (content) => {
    const root = await navigator.storage.getDirectory();
    const handle = await root.getFileHandle('shell-doc.md', { create: true });
    const writable = await handle.createWritable();
    await writable.write(content);
    await writable.close();
    (window as unknown as PickerWindow).showOpenFilePicker = async () => [handle];
  }, text);
  await page.keyboard.press('Control+o');
  await expect(page.locator('.md-content h1').first()).toBeVisible({ timeout: 20000 });
}

test.describe('floating controls and menu', () => {
  test('the sidebar toggle floats at top left and the menu button at top right', async ({ page, extensionId }) => {
    await page.goto(readerUrl(extensionId));
    await page.locator('#root > *').first().waitFor();
    const toggle = await page.getByRole('button', { name: 'Toggle sidebar' }).boundingBox();
    const menu = await page.getByRole('button', { name: 'Menu' }).boundingBox();
    const width = page.viewportSize()?.width ?? 0;
    expect(toggle?.x).toBeLessThan(40);
    expect(toggle?.y).toBeLessThan(40);
    expect(width - ((menu?.x ?? 0) + (menu?.width ?? 0))).toBeLessThan(40);
    expect(menu?.y).toBeLessThan(40);
  });

  test('the menu lists the commands in DESIGN group order and opens About and Settings', async ({ page, extensionId }) => {
    await page.goto(readerUrl(extensionId));
    await page.locator('#root > *').first().waitFor();
    await openDoc(page, codeDoc);
    await page.getByRole('button', { name: 'Menu' }).click();
    const menu = page.getByRole('menu');
    await expect(menu.getByRole('menuitem')).toHaveText([
      'Toggle Raw',
      'Toggle Fullscreen',
      'PrintCtrl+P',
      'Export HTML',
      'Open fileCtrl+O',
      'Open folder',
      'Open URL',
      'Command paletteCtrl+K',
      'Settings',
      'About',
    ]);
    await expect(menu.getByRole('separator')).toHaveCount(6);
    await menu.getByRole('menuitem', { name: 'About' }).click();
    const about = page.getByRole('dialog', { name: 'About' });
    await expect(about.getByRole('heading', { name: 'Markdown Reader' })).toBeVisible();
    await about.getByRole('button', { name: 'Close' }).click();
    await expect(about).toBeHidden();
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('menuitem', { name: 'Settings' }).click();
    await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible();
  });
});

test.describe('code blocks and headings', () => {
  test('Copy writes the exact code text and the label becomes Copied', async ({ page, context, extensionId }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto(readerUrl(extensionId));
    await page.locator('#root > *').first().waitFor();
    await openDoc(page, codeDoc);
    const block = page.locator('.md-code').first();
    await expect(block.locator('.md-code-lang')).toHaveText('js');
    await block.getByRole('button', { name: 'Copy' }).click();
    await expect(block.getByRole('button', { name: 'Copied' })).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('const a = 1;\nconst b = "two";\n');
  });

  test('a refused clipboard shows a failure label and does not throw', async ({ page, extensionId }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(readerUrl(extensionId));
    await page.locator('#root > *').first().waitFor();
    await openDoc(page, codeDoc);
    await page.evaluate(() => {
      navigator.clipboard.writeText = () => Promise.reject(new DOMException('denied', 'NotAllowedError'));
    });
    const block = page.locator('.md-code').first();
    await block.getByRole('button', { name: 'Copy' }).click();
    await expect(block.getByRole('button', { name: 'Copy failed' })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('a heading permalink is aria-hidden, not focusable, and targets the heading id', async ({ page, extensionId }) => {
    await page.goto(readerUrl(extensionId));
    await page.locator('#root > *').first().waitFor();
    await openDoc(page, codeDoc);
    const heading = page.locator('.md-content h2').first();
    const link = heading.locator('a.md-permalink');
    await expect(link).toHaveAttribute('aria-hidden', 'true');
    await expect(link).toHaveAttribute('href', `#${await heading.getAttribute('id')}`);
    const tabindex = await link.getAttribute('tabindex');
    expect(tabindex === null || tabindex === '-1').toBe(true);
    await expect(page.getByRole('link', { name: '#' })).toHaveCount(0);
  });
});
