import { readFile } from 'node:fs/promises';
import type { Page } from '@playwright/test';
import { test, expect, startFixtureServer } from './fixtures';

const popupUrl = (extensionId: string) => `chrome-extension://${extensionId}/popup.html`;
const readerUrl = (extensionId: string, origin: string) =>
  `chrome-extension://${extensionId}/reader.html?src=${encodeURIComponent(`${origin}/toc-plugins.md`)}`;

async function serveFixture() {
  const markdown = await readFile('tests/fixtures/markdown/toc-plugins.md', 'utf8');
  return startFixtureServer((_req, res) => {
    res.setHeader('content-type', 'text/markdown; charset=utf-8');
    res.end(markdown);
  });
}

async function openPlugins(page: Page, extensionId: string) {
  await page.goto(popupUrl(extensionId));
  await page.getByRole('tab', { name: 'Plugins' }).click();
  await expect(page.getByRole('heading', { name: 'Plugins', level: 2 })).toBeVisible();
}

test('with all plugins on, the fixture renders every plugin feature', async ({ context, page, extensionId }) => {
  const { origin, close } = await serveFixture();
  try {
    await openPlugins(page, extensionId);
    const all = page.getByRole('switch', { name: 'All plugins', exact: true });
    await all.click();
    await expect(all).toBeChecked();

    const reader = await context.newPage();
    await reader.goto(readerUrl(extensionId, origin));
    const content = reader.locator('.md-content');
    await expect(content.locator('h1')).toHaveText('Plugin fixture', { timeout: 20000 });
    await expect(content.locator('[data-toc-placeholder] ul a').first()).toBeVisible();
    await expect(content.locator('[data-toc-placeholder] a')).toHaveText(['Plugin fixture', 'Inserted text', 'Table', 'Math', 'Diagram']);
    await expect(content.locator('table.front-matter th')).toHaveText(['title', 'author']);
    await expect(content.locator('ins')).toHaveText('inserted');
    await expect(content.locator('table:not(.front-matter) th[colspan="2"]')).toHaveCount(1);
    await expect(content.locator('.katex').first()).toBeVisible({ timeout: 20000 });
    await expect(content.locator('svg').first()).toBeVisible({ timeout: 20000 });
  } finally {
    await close();
  }
});

test('turning one plugin off and back on in the popup changes the reader output', async ({ context, page, extensionId }) => {
  const { origin, close } = await serveFixture();
  try {
    await openPlugins(page, extensionId);
    const reader = await context.newPage();
    await reader.goto(readerUrl(extensionId, origin));
    await reader.locator('#root > *').first().waitFor();
    await expect(reader.locator('.md-content ins')).toHaveText('inserted', { timeout: 20000 });

    const insert = page.getByRole('switch', { name: 'Insert', exact: true });
    await insert.click();
    await expect(insert).not.toBeChecked();
    await expect(reader.locator('.md-content ins')).toHaveCount(0);
    await expect(reader.locator('.md-content')).toContainText('++inserted++');

    await insert.click();
    await expect(insert).toBeChecked();
    await expect(reader.locator('.md-content ins')).toHaveText('inserted');

    const toc = page.getByRole('switch', { name: 'TOC', exact: true });
    await toc.click();
    await expect(reader.locator('.md-content [data-toc-placeholder]')).toHaveCount(0);
    await expect(reader.locator('.md-content')).toContainText('[[TOC]]');
    await toc.click();
    await expect(reader.locator('.md-content [data-toc-placeholder] a').first()).toBeVisible();
  } finally {
    await close();
  }
});

test('the All plugins switch sets every plugin and reflects derived state', async ({ page, extensionId }) => {
  await openPlugins(page, extensionId);
  const switches = page.getByRole('tabpanel', { name: 'Plugins' }).getByRole('switch');
  const all = page.getByRole('switch', { name: 'All plugins', exact: true });
  const others = switches.filter({ hasNot: page.getByRole('switch', { name: 'All plugins', exact: true }) });
  await expect(switches).toHaveCount(19);
  await expect(all).not.toBeChecked();

  await all.click();
  await expect(all).toBeChecked();
  for (const sw of await others.all()) await expect(sw).toBeChecked();

  await page.getByRole('switch', { name: 'Mermaid', exact: true }).click();
  await expect(all).not.toBeChecked();

  await page.getByRole('switch', { name: 'Mermaid', exact: true }).click();
  await expect(all).toBeChecked();

  await all.click();
  await expect(all).not.toBeChecked();
  for (const sw of await switches.all()) await expect(sw).not.toBeChecked();
});
