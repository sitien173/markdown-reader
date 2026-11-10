// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { RecentSection } from '../../src/ui/recent-section';
import type { RecentItem } from '../../src/store/recent';

describe('RecentSection', () => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

  it('renders recent items with truncation, title attribute, and tooltip trigger', () => {
    const longTitle = 'https://example.com/very/long/path/to/my-document-with-extended-filename.md';
    const items: RecentItem[] = [{ kind: 'url', id: 'u1', title: longTitle, url: longTitle }];
    const onOpenItem = vi.fn();

    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);

    act(() => {
      root.render(<RecentSection items={items} onOpenItem={onOpenItem} />);
    });

    const btn = container.querySelector('button.nav-item');
    expect(btn).not.toBeNull();
    expect(btn?.getAttribute('title')).toBe(longTitle);

    const span = btn?.querySelector('span.truncate');
    expect(span).not.toBeNull();
    expect(span?.textContent).toBe(longTitle);

    const tooltipTrigger = container.querySelector('[data-slot="tooltip-trigger"]');
    expect(tooltipTrigger).not.toBeNull();

    act(() => {
      (btn as HTMLButtonElement).click();
    });
    expect(onOpenItem).toHaveBeenCalledWith(items[0]);

    act(() => root.unmount());
    container.remove();
  });
});
