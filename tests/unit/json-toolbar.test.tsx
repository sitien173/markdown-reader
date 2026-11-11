// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { JsonViewOptions } from '../../src/lib/json-document';
import { JsonToolbar } from '../../src/ui/json-toolbar';

const defaultOptions: JsonViewOptions = {
  layout: 'original',
  indent: 2,
  sortKeys: false,
  stripComments: false,
  escape: false,
};

describe('JsonToolbar component', () => {
  let container: HTMLElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    vi.restoreAllMocks();
  });

  it('hides Strip comments for kind="json"', async () => {
    await act(async () => {
      root.render(
        <JsonToolbar
          kind="json"
          options={defaultOptions}
          unescaped={false}
          canUnescape={false}
          disabled={false}
          onChange={vi.fn()}
          onUnescape={vi.fn()}
          onRevert={vi.fn()}
          onDownload={vi.fn()}
        />,
      );
    });
    const stripButton = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('Strip comments'));
    expect(stripButton).toBeUndefined();
  });

  it('shows Strip comments for kind="jsonc"', async () => {
    await act(async () => {
      root.render(
        <JsonToolbar
          kind="jsonc"
          options={defaultOptions}
          unescaped={false}
          canUnescape={false}
          disabled={false}
          onChange={vi.fn()}
          onUnescape={vi.fn()}
          onRevert={vi.fn()}
          onDownload={vi.fn()}
        />,
      );
    });
    const stripButton = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('Strip comments'));
    expect(stripButton).toBeDefined();
    expect(stripButton?.disabled).toBe(false);
  });

  it('locks and checks Strip comments under Sort keys', async () => {
    await act(async () => {
      root.render(
        <JsonToolbar
          kind="jsonc"
          options={{ ...defaultOptions, sortKeys: true, stripComments: false }}
          unescaped={false}
          canUnescape={false}
          disabled={false}
          onChange={vi.fn()}
          onUnescape={vi.fn()}
          onRevert={vi.fn()}
          onDownload={vi.fn()}
        />,
      );
    });
    const stripButton = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('Strip comments'));
    expect(stripButton).toBeDefined();
    expect(stripButton?.disabled).toBe(true);
    expect(stripButton?.getAttribute('aria-pressed')).toBe('true');
  });

  it('disables every view tool on parse error (disabled=true)', async () => {
    await act(async () => {
      root.render(
        <JsonToolbar
          kind="jsonc"
          options={defaultOptions}
          unescaped={false}
          canUnescape={true}
          disabled={true}
          onChange={vi.fn()}
          onUnescape={vi.fn()}
          onRevert={vi.fn()}
          onDownload={vi.fn()}
        />,
      );
    });

    const buttons = Array.from(container.querySelectorAll('button'));
    const originalBtn = buttons.find((b) => b.textContent === 'Original');
    const beautifyBtn = buttons.find((b) => b.textContent === 'Beautify');
    const minifyBtn = buttons.find((b) => b.textContent === 'Minify');
    const sortBtn = buttons.find((b) => b.textContent?.includes('Sort keys'));
    const stripBtn = buttons.find((b) => b.textContent?.includes('Strip comments'));
    const escapeBtn = buttons.find((b) => b.textContent?.includes('Escape'));
    const unescapeBtn = buttons.find((b) => b.textContent?.includes('Unescape'));
    const downloadBtn = buttons.find((b) => b.textContent?.includes('Download'));

    expect(originalBtn?.disabled).toBe(true);
    expect(beautifyBtn?.disabled).toBe(true);
    expect(minifyBtn?.disabled).toBe(true);
    expect(sortBtn?.disabled).toBe(true);
    expect(stripBtn?.disabled).toBe(true);
    expect(escapeBtn?.disabled).toBe(true);
    expect(unescapeBtn?.disabled).toBe(true);
    // Download remains enabled to allow downloading original text on parse error
    expect(downloadBtn?.disabled).toBe(false);
  });

  it('shows Unescape only when canUnescape is true and unescaped is false', async () => {
    await act(async () => {
      root.render(
        <JsonToolbar
          kind="json"
          options={defaultOptions}
          unescaped={false}
          canUnescape={false}
          disabled={false}
          onChange={vi.fn()}
          onUnescape={vi.fn()}
          onRevert={vi.fn()}
          onDownload={vi.fn()}
        />,
      );
    });
    expect(Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('Unescape'))).toBeUndefined();

    await act(async () => {
      root.render(
        <JsonToolbar
          kind="json"
          options={defaultOptions}
          unescaped={false}
          canUnescape={true}
          disabled={false}
          onChange={vi.fn()}
          onUnescape={vi.fn()}
          onRevert={vi.fn()}
          onDownload={vi.fn()}
        />,
      );
    });
    const unescapeBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('Unescape'));
    expect(unescapeBtn).toBeDefined();
    expect(unescapeBtn?.disabled).toBe(false);
  });

  it('shows Revert button when unescaped is true', async () => {
    const onRevert = vi.fn();
    await act(async () => {
      root.render(
        <JsonToolbar
          kind="json"
          options={defaultOptions}
          unescaped={true}
          canUnescape={false}
          disabled={false}
          onChange={vi.fn()}
          onUnescape={vi.fn()}
          onRevert={onRevert}
          onDownload={vi.fn()}
        />,
      );
    });
    const revertBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('Revert'));
    expect(revertBtn).toBeDefined();
    await act(async () => {
      revertBtn?.click();
    });
    expect(onRevert).toHaveBeenCalledTimes(1);
  });

  it('leaves only Escape enabled when unescaped decoded text does not parse', async () => {
    await act(async () => {
      root.render(
        <JsonToolbar
          kind="json"
          options={defaultOptions}
          unescaped={true}
          canUnescape={false}
          disabled={false}
          parses={false}
          onChange={vi.fn()}
          onUnescape={vi.fn()}
          onRevert={vi.fn()}
          onDownload={vi.fn()}
        />,
      );
    });

    const buttons = Array.from(container.querySelectorAll('button'));
    const originalBtn = buttons.find((b) => b.textContent === 'Original');
    const sortBtn = buttons.find((b) => b.textContent?.includes('Sort keys'));
    const escapeBtn = buttons.find((b) => b.textContent?.includes('Escape'));
    const revertBtn = buttons.find((b) => b.textContent?.includes('Revert'));

    expect(originalBtn?.disabled).toBe(true);
    expect(sortBtn?.disabled).toBe(true);
    expect(escapeBtn?.disabled).toBe(false);
    expect(revertBtn?.disabled).toBe(false);
  });
});
