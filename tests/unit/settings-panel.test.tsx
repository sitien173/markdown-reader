import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Select } from '../../src/components/ui/select';
import { Slider } from '../../src/components/ui/slider';
import { Switch } from '../../src/components/ui/switch';
import { Textarea } from '../../src/components/ui/textarea';
import { SettingsPanel } from '../../src/ui/settings/settings-panel';

describe('shadcn controls', () => {
  it('exports Switch, Slider, Select, Textarea', () => {
    expect(Switch).toBeDefined();
    expect(Slider).toBeDefined();
    expect(Select).toBeDefined();
    expect(Textarea).toBeDefined();
  });
});

describe('SettingsPanel shell', () => {
  let container: HTMLElement;
  let root: Root;
  let recentUrls: string[] = [];
  let storageSet: ReturnType<typeof vi.fn>;
  beforeEach(async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    recentUrls = Array.from({ length: 7 }, (_, i) => `https://example.com/doc-${7 - i}`);
    storageSet = vi.fn(async () => undefined);
    vi.stubGlobal('browser', {
      runtime: { getManifest: () => ({ version: '9.8.7' }), sendMessage: vi.fn(async () => undefined) },
      storage: {
        local: { get: vi.fn(async (key: string) => (key === 'recentUrls' ? { recentUrls } : {})), set: storageSet },
        onChanged: { addListener: vi.fn() },
      },
      tabs: { query: vi.fn(async () => []) },
    });
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    await act(async () => {
      root.render(<SettingsPanel />);
    });
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });
  const rail = () => [...container.querySelectorAll<HTMLElement>('[role="tab"]')];
  const click = async (el: HTMLElement) => {
    await act(async () => {
      el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
  };

  it('renders four rail buttons with accessible names and General active', () => {
    expect(rail().map((b) => b.getAttribute('aria-label'))).toEqual(['General', 'Appearance', 'Plugins', 'About']);
    expect(rail()[0]?.getAttribute('aria-selected')).toBe('true');
    expect(rail()[1]?.getAttribute('aria-selected')).toBe('false');
  });

  it('moves the active state and shows an H2 in Appearance and Plugins', async () => {
    await click(rail()[1] as HTMLElement);
    expect(rail()[1]?.getAttribute('aria-selected')).toBe('true');
    expect(container.querySelector('h2')?.textContent).toBe('Appearance');
    await click(rail()[2] as HTMLElement);
    expect(container.querySelector('h2')?.textContent).toBe('Plugins');
  });

  it('About shows the icon, H1, manifest version, and copyright with no links', async () => {
    await click(rail()[3] as HTMLElement);
    const img = container.querySelector('img') as HTMLImageElement;
    expect(img.getAttribute('src')).toContain('icons/icon-128.png');
    expect(img.getAttribute('width')).toBe('128');
    expect(container.querySelector('h1')?.textContent).toBe('Markdown Reader');
    expect(container.textContent).toContain('9.8.7');
    expect(container.textContent).toContain('© 2026 Markdown Reader');
    expect(container.querySelector('a')).toBeNull();
  });

  it('General has a disabled single-option Language select and Reset settings last', () => {
    const language = container.querySelector<HTMLElement>('[data-slot="select-trigger"]');
    expect(
      language?.hasAttribute('disabled') || language?.getAttribute('aria-disabled') === 'true' || language?.hasAttribute('data-disabled'),
    ).toBe(true);
    expect(language?.textContent).toContain('English (US)');
    const buttons = [...container.querySelectorAll('[role="tabpanel"] button')];
    expect(buttons.at(-1)?.textContent).toBe('Reset settings');
  });

  it('General lists at most 5 recent URLs, newest first', () => {
    const urls = [...container.querySelectorAll('.popup-recent-url')].map((b) => b.textContent);
    expect(urls).toEqual(recentUrls.slice(0, 5));
    expect(urls).toHaveLength(5);
    expect(urls[0]).toBe('https://example.com/doc-7');
  });

  it('a rejected reset closes the dialog and shows the error in the alert', async () => {
    storageSet.mockRejectedValueOnce(new Error('quota exceeded'));
    const trigger = [...container.querySelectorAll<HTMLElement>('[role="tabpanel"] button')].at(-1) as HTMLElement;
    await click(trigger);
    const confirm = [...document.querySelectorAll<HTMLElement>('[role="alertdialog"] button, [role="dialog"] button')].find(
      (b) => b.textContent === 'Reset',
    ) as HTMLElement;
    expect(confirm).toBeDefined();
    await click(confirm);
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('quota exceeded');
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it('a rejected plugin write shows the error in a role="alert" line', async () => {
    await click(rail()[2] as HTMLElement);
    storageSet.mockRejectedValueOnce(new Error('plugin quota'));
    const toggle = container.querySelector<HTMLElement>('[role="switch"][aria-labelledby="plugin-linkify"]') as HTMLElement;
    await click(toggle);
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('plugin quota');
    storageSet.mockRejectedValueOnce(new Error('all quota'));
    await click(container.querySelector<HTMLElement>('[role="switch"][aria-labelledby="plugin-all"]') as HTMLElement);
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('all quota');
  });
});
