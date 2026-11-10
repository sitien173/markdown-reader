// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Toolbar } from '../../src/ui/toolbar';
import { createReaderStore, ReaderStoreContext } from '../../src/store/reader-store';
import type { Command } from '../../src/reader/commands';

describe('Toolbar navbar', () => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

  const mockCommands: Command[] = [{ id: 'save', label: 'Save', available: () => true, run: vi.fn() }];

  it('renders docTitle with max-width control, title attribute, and tooltip trigger', () => {
    const store = createReaderStore();
    const longTitle = 'very-long-filename-that-needs-truncation-in-the-top-navbar.md';
    store.setState({ text: '# Hello', docTitle: longTitle, dirty: false });

    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <ReaderStoreContext.Provider value={store}>
          <Toolbar commands={mockCommands} onMode={vi.fn()} />
        </ReaderStoreContext.Provider>,
      );
    });

    const titleEl = container.querySelector('.reader-title-text');
    expect(titleEl).not.toBeNull();
    expect(titleEl?.textContent).toBe(longTitle);
    expect(titleEl?.getAttribute('title')).toBe(longTitle);
    expect(titleEl?.className).toContain('truncate');

    const tooltipTrigger = container.querySelector('[data-slot="tooltip-trigger"]');
    expect(tooltipTrigger).not.toBeNull();

    act(() => root.unmount());
    container.remove();
  });
});
