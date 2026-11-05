import { readFile } from 'node:fs/promises';
import os from 'node:os';
import { test, expect, startFixtureServer } from './fixtures';

// Timing gates are load-tolerant: each gate uses the median of several runs, and this file runs serially (workers: 1).
const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
};
const loadNote = () => `host load average (1 min): ${os.loadavg()[0]!.toFixed(1)}`;

const paragraph = 'A realistic paragraph with **bold text**, a [link](https://example.test), and ordinary prose for a reader.\n\n';
const benchmarkMarkdown = `# Benchmark document\n\n${paragraph.repeat(Math.ceil(1024 * 1024 / paragraph.length))}`;

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
      await expect(page.locator('.tds-custom-markdown h1')).toHaveText('Benchmark document', { timeout: 30000 });
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
  console.log(`S4 first content visible (ms) per run: ${firstVisible.map((v) => v.toFixed(0)).join(', ')}; median ${median(firstVisible).toFixed(0)}`);
  console.log(`S4 full completion (ms) per run: ${completion.map((v) => v.toFixed(0)).join(', ')}; median ${median(completion).toFixed(0)}; ${loadNote()}`);
  expect(median(firstVisible)).toBeLessThan(500);
  expect(median(completion)).toBeLessThan(10000);
});

test('S3: typing in Split on a 100 KB document updates the preview within 100 ms (median of 10 keystrokes)', async ({ page, extensionId }) => {
  const markdown = await readFile('tests/fixtures/large-100kb.md', 'utf8');
  const { origin, close } = await startFixtureServer((_req, res) => { res.setHeader('content-type', 'text/markdown; charset=utf-8'); res.end(markdown); });
  try {
    await page.goto(`chrome-extension://${extensionId}/reader.html?src=${encodeURIComponent(`${origin}/large-100kb.md`)}&mode=split`);
    await expect(page.locator('.tds-custom-markdown h1')).toHaveText('Large fixture', { timeout: 20000 });
    await page.evaluate(() => {
      const w = window as unknown as { __marks: number[]; __before: number };
      w.__marks = [];
      // Timestamp the keystroke in the page so CDP round-trip time under host load is not counted as preview latency.
      document.addEventListener('keydown', () => { w.__before = performance.now(); }, true);
      new MutationObserver(() => w.__marks.push(performance.now())).observe(document.querySelector('.tds-custom-markdown')!, { subtree: true, childList: true, characterData: true });
    });
    await page.locator('.cm-content').click();
    await page.keyboard.press('Control+End');
    const latencies: number[] = [];
    for (let i = 0; i < 10; i++) {
      const before = await page.evaluate(() => (window as unknown as { __marks: number[] }).__marks.length);
      await page.keyboard.type('k');
      await page.waitForFunction((count) => (window as unknown as { __marks: number[] }).__marks.length > count, before);
      latencies.push(await page.evaluate((count) => { const w = window as unknown as { __marks: number[]; __before: number }; return w.__marks[count]! - w.__before; }, before));
    }
    console.log(`S3 keystroke to preview DOM update (ms): ${latencies.map((v) => v.toFixed(1)).join(', ')}; median ${median(latencies).toFixed(1)}; ${loadNote()}`);
    expect(median(latencies)).toBeLessThan(100);
  } finally {
    await close();
  }
});

test('S8: a plain document triggers no request for the Mermaid, KaTeX, or Shiki chunks', async ({ page, extensionId }) => {
  const plain = await readFile('tests/fixtures/markdown/plain.md', 'utf8');
  const { origin, close } = await startFixtureServer((_req, res) => { res.setHeader('content-type', 'text/markdown; charset=utf-8'); res.end(plain); });
  const requested: string[] = [];
  page.on('request', (request) => requested.push(request.url()));
  try {
    await page.goto(`chrome-extension://${extensionId}/reader.html?src=${encodeURIComponent(`${origin}/plain.md`)}`);
    await expect(page.locator('.tds-custom-markdown h1')).toHaveText('Plain fixture');
    await page.waitForLoadState('networkidle');
    expect(requested.some((url) => /(?:shiki|shikijs|katex|mermaid|github-light|javascript|typescript)/i.test(url))).toBe(false);
  } finally {
    await close();
  }
});

test('S9: a local document with math, code, and a diagram renders while all network is blocked', async ({ page, context, extensionId }) => {
  const rich = await readFile('tests/fixtures/markdown/rich.md', 'utf8');
  const { origin, close } = await startFixtureServer((_req, res) => { res.setHeader('content-type', 'text/markdown; charset=utf-8'); res.end(rich); });
  try {
    await page.goto(`chrome-extension://${extensionId}/reader.html?src=${encodeURIComponent(`${origin}/rich.md`)}`);
    await expect(page.locator('.tds-custom-markdown .katex').first()).toBeVisible({ timeout: 20000 });
    await expect(page.locator('.tds-custom-markdown .shiki').first()).toBeVisible();
    await expect(page.locator('.tds-custom-markdown svg').first()).toBeVisible({ timeout: 20000 });

    // Cut all network, then re-mount the preview by switching to Edit and back to Read; the rendered features must come from loaded code only.
    await context.setOffline(true);
    const networkRequests: string[] = [];
    page.on('request', (request) => { if (!request.url().startsWith(`chrome-extension://${extensionId}/`)) networkRequests.push(request.url()); });
    await page.locator('.tds-segmented-control__item', { hasText: 'Edit' }).click();
    await expect(page.locator('.cm-editor')).toBeVisible();
    await expect(page.locator('.tds-custom-markdown')).toHaveCount(0);
    await page.locator('.tds-segmented-control__item', { hasText: 'Read' }).click();
    await expect(page.locator('.tds-custom-markdown .katex').first()).toBeVisible({ timeout: 20000 });
    await expect(page.locator('.tds-custom-markdown .shiki').first()).toBeVisible();
    await expect(page.locator('.tds-custom-markdown svg').first()).toBeVisible({ timeout: 20000 });
    expect(networkRequests).toEqual([]);
  } finally {
    await context.setOffline(false);
    await close();
  }
});
