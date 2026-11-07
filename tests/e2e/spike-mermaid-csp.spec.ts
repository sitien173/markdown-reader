import { test, expect } from './fixtures';
import { createServer } from 'node:http';

test('Mermaid renders through the real enhancement path under the extension page CSP', async ({ page, extensionId }) => {
  const cspErrors: string[] = [];
  page.on('console', (message) => {
    if (message.text().includes('Content Security Policy')) cspErrors.push(message.text());
  });
  const server = createServer((_request, response) => {
    response.writeHead(200, { 'content-type': 'text/markdown' });
    response.end(['```mermaid', 'graph TD; A-->B', '```'].join('\n'));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${(server.address() as import('node:net').AddressInfo).port}/doc.md`;
  await page.goto(`chrome-extension://${extensionId}/reader.html?src=${encodeURIComponent(url)}`);
  await expect(page.locator('.md-content svg')).toBeVisible({ timeout: 15000 });
  expect(cspErrors).toEqual([]);
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
});
