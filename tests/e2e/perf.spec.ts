import { readFile } from 'node:fs/promises';
import os from 'node:os';
import type { Page } from '@playwright/test';
import { test, expect, startFixtureServer } from './fixtures';

// Read mode has no mode switch, so a mode is reached through the Cmd+K palette command.
async function runPaletteCommand(page: Page, name: string) {
  await page.keyboard.press('Control+k');
  const dialog = page.getByRole('dialog', { name: 'Command palette' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('combobox').fill(name);
  await page.keyboard.press('Enter');
  await expect(dialog).toBeHidden();
}

// Timing gates are load-tolerant: each gate uses the median of several runs, and this file runs serially (workers: 1).
const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
};
const loadNote = () => `host load average (1 min): ${os.loadavg()[0]!.toFixed(1)}`;

const paragraph = 'A realistic paragraph with **bold text**, a [link](https://example.test), and ordinary prose for a reader.\n\n';
const benchmarkMarkdown = `# Benchmark document\n\n${paragraph.repeat(Math.ceil((1024 * 1024) / paragraph.length))}`;

test.describe.configure({ mode: 'serial' });

test('S4: 1 MiB document shows first content within 500 ms of render start; full completion measured', async ({ page, extensionId }) => {
  test.setTimeout(180000);
  const { origin, close } = await startFixtureServer((_req, res) => {
    res.setHeader('content-type', 'text/markdown; charset=utf-8');
    res.end(benchmarkMarkdown);
  });
  const firstVisible: number[] = [];
  const completion: number[] = [];
  try {
    const url = `chrome-extension://${extensionId}/reader.html?src=${encodeURIComponent(`${origin}/benchmark.md`)}`;
    for (let run = 0; run < 3; run++) {
      await page.goto(url);
      await expect(page.locator('.md-content h1')).toHaveText('Benchmark document', { timeout: 30000 });
      await page.waitForFunction(() => performance.getEntriesByName('md-render-complete').length > 0, undefined, { timeout: 60000 });
      const timings = await page.evaluate(() => {
        const at = (name: string) => performance.getEntriesByName(name).at(-1)?.startTime ?? NaN;
        const start = at('md-render-start');
        // The first md-first-visible mark is the prefix paint; the full render emits later ones.
        const firstVisible = performance.getEntriesByName('md-first-visible')[0]?.startTime ?? NaN;
        return { firstVisible: firstVisible - start, complete: at('md-render-complete') - start };
      });
      firstVisible.push(timings.firstVisible);
      completion.push(timings.complete);
    }
  } finally {
    await close();
  }
  console.log(
    `S4 first content visible (ms) per run: ${firstVisible.map((v) => v.toFixed(0)).join(', ')}; median ${median(firstVisible).toFixed(0)}`,
  );
  console.log(
    `S4 full completion (ms) per run: ${completion.map((v) => v.toFixed(0)).join(', ')}; median ${median(completion).toFixed(0)}; ${loadNote()}`,
  );
  expect(median(firstVisible)).toBeLessThan(500);
  expect(median(completion)).toBeLessThan(10000);
});

test('S3: typing in Split on a 100 KB document updates the preview within 100 ms (median of 10 keystrokes)', async ({
  page,
  extensionId,
}) => {
  const markdown = await readFile('tests/fixtures/large-100kb.md', 'utf8');
  const { origin, close } = await startFixtureServer((_req, res) => {
    res.setHeader('content-type', 'text/markdown; charset=utf-8');
    res.end(markdown);
  });
  try {
    await page.goto(`chrome-extension://${extensionId}/reader.html?src=${encodeURIComponent(`${origin}/large-100kb.md`)}&mode=split`);
    await expect(page.locator('.md-content h1')).toHaveText('Large fixture', { timeout: 20000 });
    await page.evaluate(() => {
      const w = window as unknown as { __marks: number[]; __before: number };
      w.__marks = [];
      // Timestamp the keystroke in the page so CDP round-trip time under host load is not counted as preview latency.
      document.addEventListener(
        'keydown',
        () => {
          w.__before = performance.now();
        },
        true,
      );
      new MutationObserver(() => w.__marks.push(performance.now())).observe(document.querySelector('.md-content')!, {
        subtree: true,
        childList: true,
        characterData: true,
      });
    });
    await page.locator('.cm-content').click();
    await page.keyboard.press('Control+End');
    const latencies: number[] = [];
    for (let i = 0; i < 10; i++) {
      const before = await page.evaluate(() => (window as unknown as { __marks: number[] }).__marks.length);
      await page.keyboard.type('k');
      await page.waitForFunction((count) => (window as unknown as { __marks: number[] }).__marks.length > count, before);
      latencies.push(
        await page.evaluate((count) => {
          const w = window as unknown as { __marks: number[]; __before: number };
          return w.__marks[count]! - w.__before;
        }, before),
      );
    }
    console.log(
      `S3 keystroke to preview DOM update (ms): ${latencies.map((v) => v.toFixed(1)).join(', ')}; median ${median(latencies).toFixed(1)}; ${loadNote()}`,
    );
    expect(median(latencies)).toBeLessThan(100);
  } finally {
    await close();
  }
});

// Turns every plugin on through storage, the same key the popup writes.
async function enableAllPlugins(page: import('@playwright/test').Page, extensionId: string) {
  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  await page.getByRole('tab', { name: 'Plugins' }).click();
  const all = page.getByRole('switch', { name: 'All plugins', exact: true });
  if (!(await all.isChecked())) await all.click();
  await expect(all).toBeChecked();
}

test('S3 with all plugins on and a [[TOC]] document', async ({ context, page, extensionId }) => {
  const markdown = await readFile('tests/fixtures/large-100kb-toc.md', 'utf8');
  const { origin, close } = await startFixtureServer((_req, res) => {
    res.setHeader('content-type', 'text/markdown; charset=utf-8');
    res.end(markdown);
  });
  try {
    await enableAllPlugins(page, extensionId);
    const reader = await context.newPage();
    await reader.goto(`chrome-extension://${extensionId}/reader.html?src=${encodeURIComponent(`${origin}/large-100kb-toc.md`)}&mode=split`);
    await expect(reader.locator('.md-content h1')).toHaveText('Large TOC fixture', { timeout: 30000 });
    await expect(reader.locator('.md-content [data-toc-placeholder] a').first()).toBeVisible({ timeout: 30000 });
    await reader.evaluate(() => {
      const w = window as unknown as { __marks: number[]; __before: number };
      w.__marks = [];
      document.addEventListener(
        'keydown',
        () => {
          w.__before = performance.now();
        },
        true,
      );
      new MutationObserver(() => w.__marks.push(performance.now())).observe(document.querySelector('.md-content') ?? document.body, {
        subtree: true,
        childList: true,
        characterData: true,
      });
    });
    await reader.locator('.cm-content').click();
    await reader.keyboard.press('Control+End');
    const latencies: number[] = [];
    for (let i = 0; i < 10; i++) {
      const before = await reader.evaluate(() => (window as unknown as { __marks: number[] }).__marks.length);
      await reader.keyboard.type('k');
      await reader.waitForFunction((count) => (window as unknown as { __marks: number[] }).__marks.length > count, before);
      latencies.push(
        await reader.evaluate((count) => {
          const w = window as unknown as { __marks: number[]; __before: number };
          return (w.__marks[count] ?? NaN) - w.__before;
        }, before),
      );
    }
    console.log(
      `S3 all plugins and [[TOC]] keystroke to preview DOM update (ms): ${latencies.map((v) => v.toFixed(1)).join(', ')}; median ${median(latencies).toFixed(1)}; ${loadNote()}`,
    );
    expect(median(latencies)).toBeLessThan(100);
  } finally {
    await close();
  }
});

test('S4 with all plugins on', async ({ context, page, extensionId }) => {
  test.setTimeout(180000);
  const { origin, close } = await startFixtureServer((_req, res) => {
    res.setHeader('content-type', 'text/markdown; charset=utf-8');
    res.end(benchmarkMarkdown);
  });
  const firstVisible: number[] = [];
  try {
    await enableAllPlugins(page, extensionId);
    const reader = await context.newPage();
    const url = `chrome-extension://${extensionId}/reader.html?src=${encodeURIComponent(`${origin}/benchmark.md`)}`;
    for (let run = 0; run < 3; run++) {
      await reader.goto(url);
      await expect(reader.locator('.md-content h1')).toHaveText('Benchmark document', { timeout: 30000 });
      await reader.waitForFunction(() => performance.getEntriesByName('md-render-complete').length > 0, undefined, { timeout: 60000 });
      firstVisible.push(
        await reader.evaluate(() => {
          const start = performance.getEntriesByName('md-render-start').at(-1)?.startTime ?? NaN;
          return (performance.getEntriesByName('md-first-visible')[0]?.startTime ?? NaN) - start;
        }),
      );
    }
    // Parser build time after a toggle change: the first render with a new plugin config pays for a new parser instance.
    const toggle = page.getByRole('switch', { name: 'Mermaid', exact: true });
    const endsBefore = await reader.evaluate(() => performance.getEntriesByName('md-render-end').length);
    await toggle.click();
    await expect(toggle).not.toBeChecked();
    await reader.waitForFunction((count) => performance.getEntriesByName('md-render-end').length > count, endsBefore, { timeout: 60000 });
    const rebuild = await reader.evaluate(() => {
      const build = performance.getEntriesByName('md-parser-build').at(-1)?.duration ?? NaN;
      const end = performance.getEntriesByName('md-render-end').at(-1)?.startTime ?? NaN;
      const begin = performance.getEntriesByName('md-render-start').at(-1)?.startTime ?? NaN;
      return { parse: end - begin, build };
    });
    console.log(
      `S4 all plugins first content visible (ms) per run: ${firstVisible.map((v) => v.toFixed(0)).join(', ')}; median ${median(firstVisible).toFixed(0)}`,
    );
    console.log(
      `S4 parser build (md-parser-build) and first paint after a plugin toggle (ms): ${rebuild.build.toFixed(1)}, ${rebuild.parse.toFixed(0)}; ${loadNote()}`,
    );
  } finally {
    await close();
  }
  expect(median(firstVisible)).toBeLessThan(500);
});

test('S8: a plain document triggers no request for the Mermaid, KaTeX, or Shiki chunks', async ({ page, extensionId }) => {
  const plain = await readFile('tests/fixtures/markdown/plain.md', 'utf8');
  const { origin, close } = await startFixtureServer((_req, res) => {
    res.setHeader('content-type', 'text/markdown; charset=utf-8');
    res.end(plain);
  });
  const requested: string[] = [];
  page.on('request', (request) => requested.push(request.url()));
  try {
    await page.goto(`chrome-extension://${extensionId}/reader.html?src=${encodeURIComponent(`${origin}/plain.md`)}`);
    await expect(page.locator('.md-content h1')).toHaveText('Plain fixture');
    await page.waitForLoadState('networkidle');
    expect(requested.some((url) => /(?:shiki|shikijs|katex|mermaid|github-light|javascript|typescript)/i.test(url))).toBe(false);
  } finally {
    await close();
  }
});

test('S9: a local document with math, code, and a diagram renders while all network is blocked', async ({ page, context, extensionId }) => {
  const rich = await readFile('tests/fixtures/markdown/rich.md', 'utf8');
  const { origin, close } = await startFixtureServer((_req, res) => {
    res.setHeader('content-type', 'text/markdown; charset=utf-8');
    res.end(rich);
  });
  try {
    await page.goto(`chrome-extension://${extensionId}/reader.html?src=${encodeURIComponent(`${origin}/rich.md`)}`);
    await expect(page.locator('.md-content .katex').first()).toBeVisible({ timeout: 20000 });
    await expect(page.locator('.md-content .shiki').first()).toBeVisible();
    await expect(page.locator('.md-content svg').first()).toBeVisible({ timeout: 20000 });

    // Cut all network, then re-mount the preview by switching to Edit and back to Read; the rendered features must come from loaded code only.
    await context.setOffline(true);
    const networkRequests: string[] = [];
    page.on('request', (request) => {
      if (!request.url().startsWith(`chrome-extension://${extensionId}/`)) networkRequests.push(request.url());
    });
    await runPaletteCommand(page, 'Edit mode');
    await expect(page.locator('.cm-editor')).toBeVisible();
    await expect(page.locator('.md-content')).toHaveCount(0);
    await page.getByRole('radio', { name: 'Read', exact: true }).click();
    await expect(page.locator('.md-content .katex').first()).toBeVisible({ timeout: 20000 });
    await expect(page.locator('.md-content .shiki').first()).toBeVisible();
    await expect(page.locator('.md-content svg').first()).toBeVisible({ timeout: 20000 });
    expect(networkRequests).toEqual([]);
  } finally {
    await context.setOffline(false);
    await close();
  }
});
