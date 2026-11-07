import type { Page } from '@playwright/test';
import { test, expect, startFixtureServer } from './fixtures';

const readerUrl = (extensionId: string, query = '') => `chrome-extension://${extensionId}/reader.html${query}`;

// Longest duration in a computed `a, b, c` list, in milliseconds.
const longest = (list: string) =>
  Math.max(...list.split(',').map((part) => (part.trim().endsWith('ms') ? parseFloat(part) : parseFloat(part) * 1000)));

// Every element and pseudo-element on the page, including portaled popups, with any non-zero transition or animation duration.
async function movingElements(page: Page) {
  return page.evaluate(() => {
    const parse = (list: string) =>
      Math.max(...list.split(',').map((part) => (part.trim().endsWith('ms') ? parseFloat(part) : parseFloat(part) * 1000)));
    const offenders: string[] = [];
    for (const el of document.querySelectorAll('*')) {
      for (const pseudo of [null, '::before', '::after']) {
        const style = getComputedStyle(el, pseudo);
        if (parse(style.transitionDuration) > 0 || parse(style.animationDuration) > 0 || style.scrollBehavior === 'smooth') {
          offenders.push(`${el.tagName.toLowerCase()}${pseudo ?? ''}[${el.getAttribute('data-slot') ?? el.className}]`);
        }
      }
    }
    return offenders;
  });
}

test.describe('reduced motion', () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
  });

  test('no element transitions or animates on the welcome screen', async ({ page, extensionId }) => {
    await page.goto(readerUrl(extensionId));
    await expect(page.locator('[data-slot="welcome"]')).toBeVisible();
    expect(await movingElements(page)).toEqual([]);
  });

  test('menus, dialogs, and the palette have zero durations', async ({ page, extensionId }) => {
    await page.goto(readerUrl(extensionId));
    await page.getByRole('button', { name: 'Export options' }).click();
    await expect(page.getByRole('menu')).toBeVisible();
    expect(await movingElements(page)).toEqual([]);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu')).toHaveCount(0);

    await page.locator('[data-slot="welcome"]').getByRole('button', { name: 'Open URL' }).click();
    await expect(page.getByRole('dialog', { name: 'Open URL' })).toBeVisible();
    expect(await movingElements(page)).toEqual([]);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);

    await page.getByRole('button', { name: 'Command palette' }).click();
    await expect(page.getByRole('dialog', { name: 'Command palette' })).toBeVisible();
    expect(await movingElements(page)).toEqual([]);
  });

  test('a loaded document, sidebar included, has zero durations and no View Transition starts', async ({ page, extensionId }) => {
    await page.addInitScript(() => {
      const w = window as unknown as { __transitions: number };
      w.__transitions = 0;
      const original = document.startViewTransition?.bind(document);
      document.startViewTransition = ((...args: Parameters<NonNullable<typeof original>>) => {
        w.__transitions += 1;
        return original?.(...args);
      }) as typeof document.startViewTransition;
    });
    const { origin, close } = await startFixtureServer((_req, res) => {
      res.setHeader('content-type', 'text/markdown; charset=utf-8');
      res.end('# Calm\n\n## Section\n\nText [jump](#section)\n');
    });
    try {
      await page.goto(readerUrl(extensionId, `?src=${encodeURIComponent(`${origin}/calm.md`)}`));
      await expect(page.locator('.md-content h1')).toHaveText('Calm', { timeout: 20000 });
      expect(await movingElements(page)).toEqual([]);
      expect(await page.evaluate(() => (window as unknown as { __transitions: number }).__transitions)).toBe(0);
    } finally {
      await close();
    }
  });
});

test.describe('motion allowed', () => {
  test('dialogs and menus do transition, so the reduced-motion check can see motion', async ({ page, extensionId }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto(readerUrl(extensionId));
    await page.locator('[data-slot="welcome"]').getByRole('button', { name: 'Open URL' }).click();
    const popup = page.locator('[data-slot="dialog-content"]');
    await expect(popup).toBeVisible();
    const style = await popup.evaluate((el) => {
      const s = getComputedStyle(el);
      return { duration: s.transitionDuration, property: s.transitionProperty };
    });
    expect(longest(style.duration)).toBeGreaterThan(0);
    expect(longest(style.duration)).toBeLessThanOrEqual(200);
    // Transform and opacity only.
    expect(style.property.split(',').map((p) => p.trim())).toEqual(['opacity', 'scale']);
  });

  test('the welcome screen hands over to the document through a View Transition', async ({ page, extensionId }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.addInitScript(() => {
      const w = window as unknown as { __transitions: number };
      w.__transitions = 0;
      const original = document.startViewTransition.bind(document);
      document.startViewTransition = ((...args: Parameters<typeof original>) => {
        w.__transitions += 1;
        return original(...args);
      }) as typeof document.startViewTransition;
    });
    const { origin, close } = await startFixtureServer((_req, res) => {
      res.setHeader('content-type', 'text/markdown; charset=utf-8');
      res.end('# Fade\n');
    });
    try {
      await page.goto(readerUrl(extensionId, `?src=${encodeURIComponent(`${origin}/fade.md`)}`));
      await expect(page.locator('.md-content h1')).toHaveText('Fade', { timeout: 20000 });
      expect(await page.evaluate(() => (window as unknown as { __transitions: number }).__transitions)).toBe(1);
    } finally {
      await close();
    }
  });

  test('the welcome screen never mounts while navigating from one document to another', async ({ page, extensionId }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    const { origin, close } = await startFixtureServer((req, res) => {
      res.setHeader('content-type', 'text/markdown; charset=utf-8');
      if (req.url?.endsWith('/b.md')) setTimeout(() => res.end('# Second\n'), 150);
      else res.end('# First\n\n[next](b.md)\n');
    });
    try {
      await page.goto(readerUrl(extensionId, `?src=${encodeURIComponent(`${origin}/a.md`)}`));
      await expect(page.locator('.md-content h1')).toHaveText('First', { timeout: 20000 });
      await page.evaluate(() => {
        const w = window as unknown as { __welcomeMounts: number };
        w.__welcomeMounts = 0;
        new MutationObserver((records) => {
          for (const record of records) {
            for (const node of record.addedNodes) {
              if (node instanceof Element && (node.matches('[data-slot="welcome"]') || node.querySelector('[data-slot="welcome"]'))) {
                w.__welcomeMounts += 1;
              }
            }
          }
        }).observe(document.body, { childList: true, subtree: true });
      });
      await page.locator('.md-content a', { hasText: 'next' }).click();
      await expect(page.locator('.md-content h1')).toHaveText('Second', { timeout: 20000 });
      expect(await page.evaluate(() => (window as unknown as { __welcomeMounts: number }).__welcomeMounts)).toBe(0);
    } finally {
      await close();
    }
  });

  test('without the View Transitions API the document still appears immediately', async ({ page, extensionId }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.addInitScript(() => {
      // @ts-expect-error simulate a browser without the API
      document.startViewTransition = undefined;
    });
    const { origin, close } = await startFixtureServer((_req, res) => {
      res.setHeader('content-type', 'text/markdown; charset=utf-8');
      res.end('# Plain\n');
    });
    try {
      await page.goto(readerUrl(extensionId, `?src=${encodeURIComponent(`${origin}/plain.md`)}`));
      await expect(page.locator('.md-content h1')).toHaveText('Plain', { timeout: 20000 });
    } finally {
      await close();
    }
  });
});
