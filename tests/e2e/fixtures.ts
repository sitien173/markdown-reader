import { test as base, chromium, type BrowserContext, type Page } from '@playwright/test';
import path from 'node:path';
import os from 'node:os';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer, type Server, type RequestListener } from 'node:http';
import type { AddressInfo } from 'node:net';

const extensionPath = path.resolve('.output/chrome-mv3');
type Fixtures = { context: BrowserContext; page: Page; extensionId: string; userDataDir: string };

export const test = base.extend<Fixtures>({
  userDataDir: async ({}, use) => {
    const userDataDir = await mkdtemp(path.join(os.tmpdir(), 'markdown-reader-playwright-'));
    await use(userDataDir);
    await rm(userDataDir, { recursive: true, force: true });
  },
  context: async ({ userDataDir }, use) => {
    const context = await chromium.launchPersistentContext(userDataDir, {
      channel: 'chromium',
      headless: true,
      args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
    });
    await use(context);
    await context.close();
  },
  extensionId: async ({ context }, use) => {
    let worker = context.serviceWorkers()[0];
    if (!worker) worker = await context.waitForEvent('serviceworker');
    const extensionId = new URL(worker.url()).host;
    await use(extensionId);
  },
  page: async ({ context }, use) => {
    const page = await context.newPage();
    await use(page);
  },
});

export async function startFixtureServer(
  handler: RequestListener,
): Promise<{ server: Server; origin: string; close: () => Promise<void> }> {
  const server = createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return { server, origin, close: () => new Promise<void>((resolve) => server.close(() => resolve())) };
}

export { expect } from '@playwright/test';
