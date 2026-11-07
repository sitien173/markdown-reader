import { test, expect, startFixtureServer } from './fixtures';

test('typing in Split, switching to Read, then back to Split preserves edited text', async ({ page, extensionId }) => {
  const { origin, close } = await startFixtureServer((_req, res) => {
    res.setHeader('content-type', 'text/markdown; charset=utf-8');
    res.end('# Initial title\n\nInitial body.\n');
  });
  try {
    await page.goto(`chrome-extension://${extensionId}/reader.html?src=${encodeURIComponent(`${origin}/doc.md`)}&mode=split`);
    await expect(page.locator('.md-content h1')).toHaveText('Initial title', { timeout: 20000 });
    await page.locator('.cm-content').click();
    await page.keyboard.press('Control+End');
    await page.keyboard.type('\n\nAppended typed text.');
    await expect(page.locator('.cm-content')).toContainText('Appended typed text.');

    // Switch to Read mode
    await page.getByRole('radio', { name: 'Read', exact: true }).click();
    await expect(page.locator('.cm-content')).toHaveCount(0);

    // Switch back to Split mode
    await page.getByRole('radio', { name: 'Split', exact: true }).click();
    await expect(page.locator('.cm-content')).toBeVisible();
    await expect(page.locator('.cm-content')).toContainText('Appended typed text.');
  } finally {
    await close();
  }
});

const luminance = (rgb: string) => {
  const [r, g, b] = rgb
    .match(/\d+(\.\d+)?/g)!
    .slice(0, 3)
    .map((v) => {
      const c = Number(v) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
};
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
};

test('editor syntax colors follow the scheme and meet 4.5:1 against the editor background', async ({ page, extensionId }) => {
  const { origin, close } = await startFixtureServer((_req, res) => {
    res.setHeader('content-type', 'text/markdown; charset=utf-8');
    res.end('# Title\n\n[link](https://example.com/x)\n');
  });
  try {
    const seen: Record<string, { mark: string; url: string; background: string; activeLine: string }> = {};
    for (const scheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto(`chrome-extension://${extensionId}/reader.html?src=${encodeURIComponent(`${origin}/doc.md`)}&mode=split`);
      await expect(page.locator('.cm-content')).toContainText('example.com');
      seen[scheme] = await page.evaluate(() => {
        const spanWith = (text: string) =>
          Array.from(document.querySelectorAll('.cm-content span')).find((el) => el.children.length === 0 && el.textContent === text)!;
        return {
          mark: getComputedStyle(spanWith('#')).color,
          url: getComputedStyle(spanWith('https://example.com/x')).color,
          background: getComputedStyle(document.querySelector('.cm-editor')!).backgroundColor,
          activeLine: getComputedStyle(document.querySelector('.cm-activeLine')!).backgroundColor,
        };
      });
      expect(contrast(seen[scheme]!.mark, seen[scheme]!.background), `${scheme} heading mark`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(seen[scheme]!.url, seen[scheme]!.background), `${scheme} url`).toBeGreaterThanOrEqual(4.5);
      // The cursor line uses --accent as background; syntax colors must stay readable there too.
      expect(contrast(seen[scheme]!.mark, seen[scheme]!.activeLine), `${scheme} heading mark on active line`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(seen[scheme]!.url, seen[scheme]!.activeLine), `${scheme} url on active line`).toBeGreaterThanOrEqual(4.5);
    }
    expect(seen.dark!.mark).not.toBe(seen.light!.mark);
    expect(seen.dark!.url).not.toBe(seen.light!.url);
  } finally {
    await close();
  }
});
