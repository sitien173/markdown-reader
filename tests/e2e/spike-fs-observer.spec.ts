import { test, expect } from './fixtures';

test('records FileSystemObserver availability in the extension page', async ({ page, extensionId }) => {
  await page.goto(`chrome-extension://${extensionId}/reader.html`);
  const available = await page.evaluate(() => 'FileSystemObserver' in self);
  expect(typeof available).toBe('boolean');
  console.log(`FILESYSTEM_OBSERVER_SPIKE ${available}`);
});
