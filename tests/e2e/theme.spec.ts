import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test, expect } from './fixtures';

const tdsTokens = readFileSync(path.resolve('src/styles/tds/tokens.css'), 'utf8');
const expectedNeutral = tdsTokens.match(/^\s*--color-neutral-100:\s*([^;]+);/m)?.[1]?.trim();
if (!expectedNeutral) throw new Error('Could not find --color-neutral-100 in TDS tokens');

 test('TDS tokens resolve through the shadcn bridge on the reader page', async ({ page, extensionId }) => {
  await page.goto(`chrome-extension://${extensionId}/reader.html`);
  const values = await page.evaluate(() => {
    const style = getComputedStyle(document.documentElement);
    const probe = document.createElement('span');
    probe.style.color = 'var(--surface-neutral-01)';
    document.body.append(probe);
    const surface = getComputedStyle(probe).color;
    probe.remove();
    return {
      primary: (() => { const item = document.createElement('span'); item.style.color = 'var(--primary)'; document.body.append(item); const value = getComputedStyle(item).color; item.remove(); return value; })(),
      interactive: (() => { const item = document.createElement('span'); item.style.color = 'var(--interactive-default)'; document.body.append(item); const value = getComputedStyle(item).color; item.remove(); return value; })(),
      neutral100: style.getPropertyValue('--color-neutral-100').trim(),
      surface,
      background: getComputedStyle(document.body).backgroundColor,
    };
  });
  expect(values.primary).not.toBe('');
  expect(values.primary).toBe(values.interactive);
  expect(values.neutral100).toBe(expectedNeutral);
  expect(values.background).toBe(values.surface);
});
