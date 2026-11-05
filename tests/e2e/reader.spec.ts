import { test, expect } from './fixtures';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
let server: Server, url = '', missingCalls = 0;
test.beforeAll(async () => { missingCalls = 0; server = createServer((req, res) => { if (req.url === '/missing.md' && missingCalls++ === 0) { res.writeHead(404); res.end('not found'); return; } if (req.url === '/outline.md') { res.setHeader('content-type','text/markdown'); res.end('# First\n\n## Second\n\n### Third\n\n#### Fourth\n\n##### Fifth\n\n###### Sixth\n\n'.repeat(12)); return; } if (req.url === '/footnotes.md') { res.setHeader('content-type','text/markdown'); res.end('# Notes\n\nA reference[^note].\n\n'.repeat(20) + '\n[^note]: Footnote target\n'); return; } if (req.url === '/link.md') { res.setHeader('content-type','text/markdown'); res.end('# Linked document\n\n[target](./target.md)\n\n[unsafe](javascript:alert(1))'); return; } if (req.url === '/target.md') { res.setHeader('content-type','text/markdown'); res.end('# Target document'); return; } res.setHeader('content-type','text/markdown'); res.end('# From URL\n\n[Next](./outline.md)'); }); await new Promise<void>(r => server.listen(0,'127.0.0.1',r)); url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`; });
test.afterAll(async () => { await new Promise<void>(r => server.close(() => r())); });
test('URL source, retry, nested TOC, file picker, and keyboard focus', async ({ page, extensionId }) => {
 await page.goto(`chrome-extension://${extensionId}/reader.html`);
 await page.getByLabel('Markdown URL').fill(`${url}/doc.md`); await page.getByRole('button',{name:'Open URL'}).click(); await expect(page.locator('.tds-custom-markdown h1')).toHaveText('From URL');
 await page.getByLabel('Markdown URL').fill(`${url}/missing.md`); await page.getByRole('button',{name:'Open URL'}).click(); await expect(page.getByRole('alert')).toContainText('HTTP 404'); await page.getByRole('alert').getByRole('button',{name:'Retry'}).click(); await expect(page.locator('.tds-custom-markdown h1')).toHaveText('From URL');
 await page.getByLabel('Markdown URL').fill(`${url}/outline.md`); await page.getByRole('button',{name:'Open URL'}).click(); await expect(page.locator('.tds-custom-markdown h6').first()).toBeVisible(); for (let n=1;n<=6;n++) await expect(page.locator('.tds-custom-reader__toc')).toContainText(['First','Second','Third','Fourth','Fifth','Sixth'][n-1]!);
 await page.locator('.tds-custom-reader__toc').getByRole('button',{name:'Sixth'}).last().click(); const target = page.locator('#user-content-sixth-11'); await expect.poll(() => target.evaluate(el => { const c = el.closest('.tds-custom-reader__content')!; const wanted = Math.min(c.scrollTop + el.getBoundingClientRect().top - c.getBoundingClientRect().top - 24, c.scrollHeight - c.clientHeight); return c.scrollTop > 0 && Math.abs(c.scrollTop - wanted) < 4; })).toBe(true); const content = page.locator('.tds-custom-reader__content'); await content.evaluate(el => el.scrollTo({ top: 0, behavior: 'instant' })); await expect(page.locator('[aria-current="location"]')).toHaveText('First'); await content.evaluate(el => el.scrollTo({ top: el.scrollHeight, behavior: 'instant' })); await expect.poll(() => page.locator('[aria-current="location"]').textContent()).not.toBe('First');
 await page.evaluate(() => { (window as any).showOpenFilePicker = async () => [{ getFile: async () => new File(['# Local file'], 'local.md', {type:'text/markdown'}) }]; }); await page.getByRole('button',{name:'Open file'}).click(); await expect(page.locator('.tds-custom-markdown h1').first()).toHaveText('Local file');
 await page.getByLabel('Markdown URL').focus(); await expect(page.getByLabel('Markdown URL')).toHaveCSS('outline-style','solid');
});

test('fragment links stay in the reader, resolved links update src, and unsafe links cannot navigate', async ({ page, extensionId }) => {
 await page.goto(`chrome-extension://${extensionId}/reader.html`);
 const input = page.getByLabel('Markdown URL');
 await input.fill(`${url}/footnotes.md`); await page.getByRole('button', { name: 'Open URL' }).click();
 await expect(page.locator('.tds-custom-markdown')).toContainText('Footnote target');
 const before = page.url();
 await page.locator('.tds-custom-markdown a[href^="#"]').first().click();
 expect(page.url()).toBe(before);
 const target = page.locator('.tds-custom-markdown li[id*="fn"]');
 await expect(target.first()).toBeInViewport();
 await input.fill(`${url}/link.md`); await page.getByRole('button', { name: 'Open URL' }).click();
 const unsafe = page.getByRole('link', { name: 'unsafe' });
 if (await unsafe.count()) { await expect(unsafe).not.toHaveAttribute('href', /^javascript:/); await unsafe.click(); }
 expect(page.url()).toContain('link.md');
 await page.getByRole('link', { name: 'target' }).click();
 await expect(page.locator('.tds-custom-markdown h1')).toHaveText('Target document');
 expect(page.url()).toContain(`src=${encodeURIComponent(`${url}/target.md`)}`);
});

test('Tab traversal exposes visible focus on URL, file, and sidebar tabs', async ({ page, extensionId }) => {
 await page.goto(`chrome-extension://${extensionId}/reader.html`);
 const focused = async () => page.evaluate(() => { const el = document.activeElement as HTMLElement; const style = getComputedStyle(el); return (style.outlineStyle !== 'none' && style.outlineWidth !== '0px') || style.boxShadow !== 'none'; });
 const expected = [page.getByRole('button', { name: 'Open URL' }), page.getByRole('button', { name: 'Open file' }), page.getByRole('button', { name: 'Export options' }), page.getByRole('tab', { name: 'Contents' })];
 await page.getByLabel('Markdown URL').focus();
 for (const control of expected) {
   await page.keyboard.press('Tab');
   await expect(control).toBeFocused();
   expect(await focused(), `visible focus on ${await control.textContent()}`).toBe(true);
 }
 await page.keyboard.press('ArrowRight');
 const filesTab = page.getByRole('tab', { name: 'Files' });
 await expect(filesTab).toBeFocused();
 expect(await focused(), 'visible focus on Files tab').toBe(true);
});

test('Open folder stays reachable from the Files tab after leaving the top bar', async ({ page, extensionId }) => {
 await page.goto(`chrome-extension://${extensionId}/reader.html`);
 await page.getByRole('tab', { name: 'Files' }).click();
 await expect(page.getByRole('button', { name: 'Open folder' })).toBeVisible();
 await expect(page.getByRole('button', { name: 'Open folder' })).toHaveCount(1);
});
