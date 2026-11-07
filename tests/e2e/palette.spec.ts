import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';

type PickerWindow = {
  showOpenFilePicker: () => Promise<unknown[]>;
  showDirectoryPicker: () => Promise<unknown>;
  print: () => void;
  __pickerCalls: number;
  __printCalls: number;
};

const longDoc = ['# Alpha', ...['Beta', 'Gamma', 'Delta'].flatMap((h) => [`## ${h}`, ...Array(40).fill('Filler paragraph text.\n')])].join(
  '\n\n',
);

const readerUrl = (extensionId: string, query = '') => `chrome-extension://${extensionId}/reader.html${query}`;
const palette = (page: Page) => page.getByRole('dialog', { name: 'Command palette' });
const paletteInput = (page: Page) => palette(page).getByRole('combobox');
const highlighted = (page: Page) => palette(page).locator('[data-slot="command-item"][data-highlighted]');
const item = (page: Page, name: string) => palette(page).getByRole('option', { name });

// Counts picker and print calls without opening anything, so a shortcut's reach is observable.
async function stubPickers(page: Page, text = longDoc) {
  await page.evaluate(async (content) => {
    const w = window as unknown as PickerWindow;
    const root = await navigator.storage.getDirectory();
    const handle = await root.getFileHandle('palette.md', { create: true });
    const writable = await handle.createWritable();
    await writable.write(content);
    await writable.close();
    w.__pickerCalls = 0;
    w.__printCalls = 0;
    w.showOpenFilePicker = async () => {
      w.__pickerCalls += 1;
      return [handle];
    };
    w.print = () => {
      w.__printCalls += 1;
    };
  }, text);
}
const counts = (page: Page) =>
  page.evaluate(() => ({
    picker: (window as unknown as PickerWindow).__pickerCalls,
    print: (window as unknown as PickerWindow).__printCalls,
  }));

async function openDocument(page: Page, extensionId: string, query = '') {
  await page.goto(readerUrl(extensionId, query));
  await stubPickers(page);
  await page.getByRole('button', { name: 'Open file' }).click();
  await expect(page.locator('.md-content h1').first()).toHaveText('Alpha', { timeout: 20000 });
}

async function openPalette(page: Page) {
  await page.keyboard.press('Control+k');
  await expect(palette(page)).toBeVisible();
  await expect(paletteInput(page)).toBeFocused();
}

test.describe('open and close', () => {
  test('Ctrl+K opens the palette on a non-Mac platform and focuses the input', async ({ page, extensionId }) => {
    await page.goto(readerUrl(extensionId));
    await expect(page.getByRole('button', { name: 'Command palette' })).toContainText('Ctrl+K');
    await openPalette(page);
    await expect(palette(page).getByText('Actions', { exact: true })).toBeVisible();
  });

  test('Cmd+K opens the palette on macOS', async ({ page, extensionId }) => {
    await page.addInitScript(() => Object.defineProperty(navigator, 'platform', { value: 'MacIntel' }));
    await page.goto(readerUrl(extensionId));
    await expect(page.getByRole('button', { name: 'Command palette' })).toContainText('⌘K');
    await page.keyboard.press('Control+k');
    await expect(palette(page)).toBeHidden();
    await page.keyboard.press('Meta+k');
    await expect(palette(page)).toBeVisible();
  });

  test('the toolbar button opens the palette', async ({ page, extensionId }) => {
    await page.goto(readerUrl(extensionId));
    await page.getByRole('button', { name: 'Command palette' }).click();
    await expect(palette(page)).toBeVisible();
  });

  test('Escape closes the palette and restores focus to the element focused before opening', async ({ page, extensionId }) => {
    await page.goto(readerUrl(extensionId));
    const toggle = page.getByRole('button', { name: 'Toggle sidebar' });
    await toggle.focus();
    await openPalette(page);
    await page.keyboard.press('Escape');
    await expect(palette(page)).toBeHidden();
    await expect(toggle).toBeFocused();
  });

  test('focus stays inside the palette while it is open', async ({ page, extensionId }) => {
    await page.goto(readerUrl(extensionId));
    await openPalette(page);
    for (let i = 0; i < 4; i += 1) {
      await page.keyboard.press('Tab');
      expect(await palette(page).evaluate((dialog) => dialog.contains(document.activeElement))).toBe(true);
    }
    await page.keyboard.press('Shift+Tab');
    expect(await palette(page).evaluate((dialog) => dialog.contains(document.activeElement))).toBe(true);
  });
});

test.describe('commands', () => {
  test('lists every command; document commands are disabled, not hidden, without a document', async ({ page, extensionId }) => {
    await page.goto(readerUrl(extensionId));
    await openPalette(page);
    for (const name of ['Open file', 'Open folder', 'Open URL', 'Toggle sidebar'])
      await expect(item(page, name)).not.toHaveAttribute('aria-disabled', 'true');
    for (const name of ['Save', 'Read mode', 'Edit mode', 'Split mode', 'Export HTML', 'Print', 'Focus mode']) {
      await expect(item(page, name)).toBeVisible();
      await expect(item(page, name)).toHaveAttribute('aria-disabled', 'true');
    }
    await expect(item(page, 'Open file')).toContainText('Ctrl+O');
    await expect(item(page, 'Print')).toContainText('Ctrl+P');
  });

  test('typing filters the list and the first match is highlighted', async ({ page, extensionId }) => {
    await openDocument(page, extensionId);
    await openPalette(page);
    await paletteInput(page).fill('split');
    await expect(item(page, 'Split mode')).toBeVisible();
    await expect(item(page, 'Open folder')).toHaveCount(0);
    await expect(highlighted(page)).toHaveText(/Split mode/);
  });

  test('Enter runs the highlighted action and closes the palette', async ({ page, extensionId }) => {
    await openDocument(page, extensionId);
    await openPalette(page);
    await paletteInput(page).fill('split');
    await page.keyboard.press('Enter');
    await expect(palette(page)).toBeHidden();
    await expect(page.getByRole('radio', { name: 'Split' })).toBeChecked();
  });

  test('arrow keys move the highlight and Enter runs the new item', async ({ page, extensionId }) => {
    await openDocument(page, extensionId);
    await openPalette(page);
    await paletteInput(page).fill('mode');
    await expect(highlighted(page)).toHaveText(/Read mode/);
    await page.keyboard.press('ArrowDown');
    await expect(highlighted(page)).toHaveText(/Edit mode/);
    await page.keyboard.press('ArrowDown');
    await expect(highlighted(page)).toHaveText(/Split mode/);
    await page.keyboard.press('ArrowUp');
    await expect(highlighted(page)).toHaveText(/Edit mode/);
    await page.keyboard.press('Enter');
    await expect(page.getByRole('radio', { name: 'Edit' })).toBeChecked();
  });

  test('a disabled item cannot be run', async ({ page, extensionId }) => {
    await page.goto(readerUrl(extensionId));
    await openPalette(page);
    await paletteInput(page).fill('save');
    await item(page, 'Save').click({ force: true });
    await expect(palette(page)).toBeVisible();
  });

  test('shows an empty state when nothing matches', async ({ page, extensionId }) => {
    await page.goto(readerUrl(extensionId));
    await openPalette(page);
    // The empty-state element is the live region; it must stay rendered (not display: none) before text arrives.
    await expect(palette(page).locator('[data-slot="command-empty"]')).not.toHaveCSS('display', 'none');
    await paletteInput(page).fill('zzzzqqqq');
    await expect(palette(page).getByText('No results found.')).toBeVisible();
    await expect(palette(page).getByRole('option')).toHaveCount(0);
  });

  test('clicking an item runs it', async ({ page, extensionId }) => {
    await openDocument(page, extensionId);
    await openPalette(page);
    await item(page, 'Edit mode').click();
    await expect(palette(page)).toBeHidden();
    await expect(page.getByRole('radio', { name: 'Edit' })).toBeChecked();
  });

  test('Open URL from the palette opens the dialog with focus in its field', async ({ page, extensionId }) => {
    await page.goto(readerUrl(extensionId));
    await openPalette(page);
    await item(page, 'Open URL').click();
    const dialog = page.getByRole('dialog', { name: 'Open URL' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel('Markdown URL')).toBeFocused();
  });
});

test.describe('groups', () => {
  test('headings group jumps to the chosen heading', async ({ page, extensionId }) => {
    await openDocument(page, extensionId);
    const content = page.locator('[data-slot="reader-content"]');
    expect(await content.evaluate((el) => el.scrollTop)).toBe(0);
    await openPalette(page);
    await expect(palette(page).getByText('Headings', { exact: true })).toBeVisible();
    await paletteInput(page).fill('Delta');
    await expect(highlighted(page)).toHaveText(/Delta/);
    await page.keyboard.press('Enter');
    await expect(palette(page)).toBeHidden();
    await expect.poll(() => content.evaluate((el) => el.scrollTop)).toBeGreaterThan(200);
  });

  test('recents group lists a recent URL and reopens it', async ({ page, extensionId }) => {
    await page.route('https://example.test/recent.md', (route) => route.fulfill({ contentType: 'text/markdown', body: '# Recent doc\n' }));
    await page.goto(readerUrl(extensionId));
    await page.locator('[data-slot="welcome"]').getByRole('button', { name: 'Open URL' }).click();
    const dialog = page.getByRole('dialog', { name: 'Open URL' });
    await dialog.getByLabel('Markdown URL').fill('https://example.test/recent.md');
    await dialog.getByRole('button', { name: 'Open URL' }).click();
    await expect(page.locator('.md-content h1')).toHaveText('Recent doc');
    await page.goto(readerUrl(extensionId));
    await openPalette(page);
    await expect(palette(page).getByText('Recents', { exact: true })).toBeVisible();
    await paletteInput(page).fill('recent.md');
    await page.keyboard.press('Enter');
    await expect(page.locator('.md-content h1')).toHaveText('Recent doc');
  });

  test('folder files group lists the folder files and opens the chosen one', async ({ page, extensionId }) => {
    await page.goto(readerUrl(extensionId));
    await page.evaluate(async () => {
      const root = await navigator.storage.getDirectory();
      const dir = await root.getDirectoryHandle('palette-folder', { create: true });
      for (const [name, body] of [
        ['one.md', '# Folder one\n'],
        ['two.md', '# Folder two\n'],
      ] as const) {
        const writable = await (await dir.getFileHandle(name, { create: true })).createWritable();
        await writable.write(body);
        await writable.close();
      }
      (window as unknown as PickerWindow).showDirectoryPicker = async () => dir;
    });
    await page.getByRole('button', { name: 'Open folder' }).first().click();
    await expect(page.locator('.md-content h1')).toBeVisible({ timeout: 20000 });
    await openPalette(page);
    await expect(palette(page).getByText('Folder files', { exact: true })).toBeVisible();
    await paletteInput(page).fill('two.md');
    await page.keyboard.press('Enter');
    await expect(page.locator('.md-content h1')).toHaveText('Folder two', { timeout: 20000 });
  });
});

test.describe('shortcuts', () => {
  test('Ctrl+O reaches the file picker with the user gesture and prevents the browser default', async ({ page, extensionId }) => {
    await page.goto(readerUrl(extensionId));
    await stubPickers(page);
    await page.keyboard.press('Control+o');
    await expect.poll(() => counts(page).then((c) => c.picker)).toBe(1);
    await expect(page.locator('.md-content h1').first()).toHaveText('Alpha', { timeout: 20000 });
  });

  test('the palette Open file item reaches the picker', async ({ page, extensionId }) => {
    await page.goto(readerUrl(extensionId));
    await stubPickers(page);
    await openPalette(page);
    await paletteInput(page).fill('open file');
    await page.keyboard.press('Enter');
    await expect.poll(() => counts(page).then((c) => c.picker)).toBe(1);
    await expect(page.locator('.md-content h1').first()).toHaveText('Alpha', { timeout: 20000 });
  });

  test('Ctrl+\\ toggles the sidebar', async ({ page, extensionId }) => {
    await page.goto(readerUrl(extensionId));
    const reader = page.locator('main.reader');
    await expect(reader).toHaveAttribute('data-sidebar', 'open');
    await page.keyboard.press('Control+\\');
    await expect(reader).toHaveAttribute('data-sidebar', 'closed');
    await page.keyboard.press('Control+\\');
    await expect(reader).toHaveAttribute('data-sidebar', 'open');
  });

  test('Ctrl+P calls window.print for a document and the Print command stays in the palette and toolbar', async ({ page, extensionId }) => {
    await openDocument(page, extensionId);
    await page.keyboard.press('Control+p');
    await expect.poll(() => counts(page).then((c) => c.print)).toBe(1);
    await page.getByRole('button', { name: 'Export options' }).click();
    await page.getByRole('menuitem', { name: 'Print' }).click();
    await expect.poll(() => counts(page).then((c) => c.print)).toBe(2);
    await openPalette(page);
    await paletteInput(page).fill('print');
    await page.keyboard.press('Enter');
    await expect.poll(() => counts(page).then((c) => c.print)).toBe(3);
  });

  test('Ctrl+P without a document does nothing', async ({ page, extensionId }) => {
    await page.goto(readerUrl(extensionId));
    await stubPickers(page);
    await page.keyboard.press('Control+p');
    await page.waitForTimeout(300);
    expect((await counts(page)).print).toBe(0);
  });

  test('Ctrl+S saves from inside the CodeMirror editor', async ({ page, extensionId }) => {
    await openDocument(page, extensionId, '?mode=split');
    await page.locator('.cm-content').click();
    await page.keyboard.press('Control+End');
    await page.keyboard.type(' saved by shortcut');
    await expect(page.getByRole('button', { name: 'Save' })).toBeEnabled();
    await page.keyboard.press('Control+s');
    await expect(page.getByRole('button', { name: 'Save' })).toBeDisabled();
    const onDisk = await page.evaluate(async () => {
      const root = await navigator.storage.getDirectory();
      return (await (await root.getFileHandle('palette.md')).getFile()).text();
    });
    expect(onDisk).toContain('saved by shortcut');
  });

  test('Ctrl+K opens the palette from inside the editor', async ({ page, extensionId }) => {
    await openDocument(page, extensionId, '?mode=split');
    await page.locator('.cm-content').click();
    await page.keyboard.press('Control+k');
    await expect(palette(page)).toBeVisible();
  });

  test('shortcuts do not fire while typing in the Open URL dialog input', async ({ page, extensionId }) => {
    await page.goto(readerUrl(extensionId));
    await stubPickers(page);
    await page.locator('[data-slot="welcome"]').getByRole('button', { name: 'Open URL' }).click();
    const field = page.getByRole('dialog', { name: 'Open URL' }).getByLabel('Markdown URL');
    await expect(field).toBeFocused();
    for (const combo of ['Control+o', 'Control+k', 'Control+\\', 'Control+p']) await page.keyboard.press(combo);
    await page.waitForTimeout(300);
    expect(await counts(page)).toEqual({ picker: 0, print: 0 });
    await expect(palette(page)).toHaveCount(0);
    await expect(page.locator('main.reader')).toHaveAttribute('data-sidebar', 'open');
  });

  test('shortcuts do not fire while focus is on a button inside the Open URL dialog', async ({ page, extensionId }) => {
    await page.goto(readerUrl(extensionId));
    await stubPickers(page);
    await page.locator('[data-slot="welcome"]').getByRole('button', { name: 'Open URL' }).click();
    const dialog = page.getByRole('dialog', { name: 'Open URL' });
    await dialog.getByRole('button', { name: 'Cancel' }).focus();
    for (const combo of ['Control+o', 'Control+k', 'Control+\\', 'Control+p']) await page.keyboard.press(combo);
    await page.waitForTimeout(300);
    expect(await counts(page)).toEqual({ picker: 0, print: 0 });
    await expect(palette(page)).toHaveCount(0);
    await expect(page.locator('main.reader')).toHaveAttribute('data-sidebar', 'open');
    await expect(dialog).toBeVisible();
  });

  test('shortcuts do not fire while typing in the palette input', async ({ page, extensionId }) => {
    await page.goto(readerUrl(extensionId));
    await stubPickers(page);
    await openPalette(page);
    await page.keyboard.press('Control+o');
    await page.waitForTimeout(300);
    expect((await counts(page)).picker).toBe(0);
  });

  test('keydown events during IME composition are ignored', async ({ page, extensionId }) => {
    await page.goto(readerUrl(extensionId));
    await page.evaluate(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, isComposing: true, bubbles: true, cancelable: true }));
    });
    await page.waitForTimeout(200);
    await expect(palette(page)).toHaveCount(0);
  });

  test('a handled shortcut calls preventDefault', async ({ page, extensionId }) => {
    await page.goto(readerUrl(extensionId));
    const prevented = await page.evaluate(() => {
      const results: boolean[] = [];
      for (const key of ['s', 'o', '\\', 'p', 'k']) {
        const e = new KeyboardEvent('keydown', { key, ctrlKey: true, bubbles: true, cancelable: true });
        (window as unknown as PickerWindow).showOpenFilePicker = async () => [];
        document.body.dispatchEvent(e);
        results.push(e.defaultPrevented);
      }
      return results;
    });
    expect(prevented).toEqual([true, true, true, true, true]);
  });
});

test('focus mode from the palette hides the toolbar and Escape exits', async ({ page, extensionId }) => {
  await openDocument(page, extensionId);
  await openPalette(page);
  await paletteInput(page).fill('focus');
  await page.keyboard.press('Enter');
  await expect(page.locator('main.reader')).toHaveAttribute('data-focus', 'true');
  await page.keyboard.press('Escape');
  await expect(page.locator('main.reader')).toHaveAttribute('data-focus', 'false');
});

test('Escape right after choosing Focus mode exits it while the palette is still closing', async ({ page, extensionId }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await openDocument(page, extensionId);
  // Hold the palette exit open so the closing popup is still in the DOM when Escape is pressed.
  await page.addStyleTag({
    content: '[role="dialog"][data-slot="dialog-content"][data-ending-style] { transition-duration: 2s !important; }',
  });
  // Reading the style forces the recalc that starts the held exit transition. Base UI still occasionally unmounts a popup
  // whose exit did not start in time, so retry the setup until the closing popup is observed.
  await page.evaluate(() => {
    new MutationObserver(() => {
      const closing = document.querySelector('[role="dialog"][data-ending-style]');
      if (closing) getComputedStyle(closing).opacity;
    }).observe(document.body, { subtree: true, childList: true, attributes: true });
  });
  const reader = page.locator('main.reader');
  const closing = page.locator('[role="dialog"][data-ending-style]');
  let held = false;
  for (let attempt = 0; attempt < 4 && !held; attempt++) {
    await openPalette(page);
    await paletteInput(page).fill('focus');
    await item(page, 'Focus mode').click();
    await expect(reader).toHaveAttribute('data-focus', 'true');
    held = (await closing.count()) === 1;
    if (!held) {
      await page.getByRole('button', { name: 'Exit focus mode' }).click();
      await expect(reader).toHaveAttribute('data-focus', 'false');
    }
  }
  expect(held, 'the closing palette popup is still mounted when Escape is pressed').toBe(true);
  await page.keyboard.press('Escape');
  await expect(reader).toHaveAttribute('data-focus', 'false', { timeout: 1000 });
});
