// @vitest-environment jsdom
import { act, createRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { highlight } from '../../src/render/highlight';
import * as jsonDocument from '../../src/lib/json-document';
import * as enhanceModule from '../../src/render/enhance';
import { JsonView } from '../../src/ui/json-view';
import type { MarkdownViewHandle } from '../../src/ui/markdown-view';

describe('jsonc highlighting', () => {
  it('highlights jsonc source with comments', async () => {
    const html = await highlight('// a comment\n{"name": "value"}', 'jsonc');
    expect(html).toContain('shiki');
    expect(html).toContain('comment');
  });
});

describe('JsonView component', () => {
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

  it('proves valid JSON mounts highlighted output', async () => {
    const ref = createRef<MarkdownViewHandle>();
    const onParseError = vi.fn();
    await act(async () => {
      root.render(<JsonView ref={ref} text={'{\n  "a": 1\n}'} kind="json" onParseError={onParseError} />);
    });
    await act(async () => {
      await ref.current?.ready();
    });
    expect(container.querySelector('.shiki')).not.toBeNull();
    expect(container.querySelector('.md-code-lang')?.textContent).toBe('json');
    expect(onParseError).toHaveBeenCalledWith(null);
  });

  it('proves minified input is formatted', async () => {
    const ref = createRef<MarkdownViewHandle>();
    const onParseError = vi.fn();
    await act(async () => {
      root.render(<JsonView ref={ref} text='{"a":1,"b":2}' kind="json" onParseError={onParseError} />);
    });
    await act(async () => {
      await ref.current?.ready();
    });
    expect(container.textContent).toContain('{\n  "a": 1,\n  "b": 2\n}');
  });

  it('proves already formatted input is byte-identical', async () => {
    const ref = createRef<MarkdownViewHandle>();
    const onParseError = vi.fn();
    const formatted = '{\n    "a":   1\n}';
    await act(async () => {
      root.render(<JsonView ref={ref} text={formatted} kind="json" onParseError={onParseError} />);
    });
    await act(async () => {
      await ref.current?.ready();
    });
    expect(container.querySelector('code')?.textContent).toBe(formatted);
  });

  it('proves a parse error reaches onParseError with its line and column while the original text still renders', async () => {
    const ref = createRef<MarkdownViewHandle>();
    const onParseError = vi.fn();
    const broken = '{\n  "a": \n}';
    await act(async () => {
      root.render(<JsonView ref={ref} text={broken} kind="json" onParseError={onParseError} />);
    });
    await act(async () => {
      await ref.current?.ready();
    });
    expect(onParseError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.any(String),
        line: 3,
        column: 1,
      }),
    );
    expect(container.textContent).toContain(broken);
  });

  it('proves a rejected prepareJson is reported rather than thrown', async () => {
    vi.spyOn(jsonDocument, 'prepareJson').mockRejectedValueOnce(new RangeError('Maximum call stack size exceeded'));
    const ref = createRef<MarkdownViewHandle>();
    const onParseError = vi.fn();
    const deep = '{"nested": 1}';
    await act(async () => {
      root.render(<JsonView ref={ref} text={deep} kind="json" onParseError={onParseError} />);
    });
    await act(async () => {
      await ref.current?.ready();
    });
    expect(onParseError).toHaveBeenCalledWith({
      message: 'Maximum call stack size exceeded',
      line: 1,
      column: 1,
    });
    expect(container.textContent).toContain(deep);
  });

  it('proves unmount aborts so a late result writes nothing', async () => {
    let resolvePrepare: (value: jsonDocument.PreparedJson) => void = () => {};
    const preparePromise = new Promise<jsonDocument.PreparedJson>((resolve) => {
      resolvePrepare = resolve;
    });
    vi.spyOn(jsonDocument, 'prepareJson').mockReturnValue(preparePromise);

    const ref = createRef<MarkdownViewHandle>();
    const onParseError = vi.fn();
    await act(async () => {
      root.render(<JsonView ref={ref} text='{"slow": true}' kind="json" onParseError={onParseError} />);
    });

    // Unmount before prepareJson resolves
    await act(async () => {
      root.unmount();
    });

    // Resolve now
    resolvePrepare({ text: '{"slow": true}', error: null });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    // Unmount clears the banner, and the late result adds nothing after it
    expect(onParseError).toHaveBeenCalledTimes(1);
    expect(onParseError).toHaveBeenCalledWith(null);
  });

  it('proves unmount aborts the enhance signal', async () => {
    const captured: { signal?: AbortSignal } = {};
    vi.spyOn(enhanceModule, 'enhance').mockImplementation((_root, signal) => {
      captured.signal = signal;
      return new Promise<void>(() => {});
    });

    const ref = createRef<MarkdownViewHandle>();
    const onParseError = vi.fn();
    await act(async () => {
      root.render(<JsonView ref={ref} text='{"a": 1}' kind="json" onParseError={onParseError} />);
    });
    // Let prepareJson resolve so enhance runs and captures the signal
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    expect(captured.signal).toBeDefined();
    expect(captured.signal?.aborted).toBe(false);

    await act(async () => {
      root.unmount();
    });

    expect(captured.signal?.aborted).toBe(true);
  });

  it('proves update(text) updates the view', async () => {
    const ref = createRef<MarkdownViewHandle>();
    const onParseError = vi.fn();
    await act(async () => {
      root.render(<JsonView ref={ref} text={'{\n  "a": 1\n}'} kind="json" onParseError={onParseError} />);
    });
    await act(async () => {
      await ref.current?.ready();
    });
    expect(container.textContent).toContain('"a": 1');

    await act(async () => {
      ref.current?.update('{\n  "b": 2\n}');
    });
    await act(async () => {
      await ref.current?.ready();
    });
    expect(container.textContent).toContain('"b": 2');
    expect(onParseError).toHaveBeenLastCalledWith(null);
  });

  it('proves a stale prepareJson result does not overwrite DOM or resolve newer ready()', async () => {
    let resolveFirst: (v: jsonDocument.PreparedJson) => void = () => {};
    let resolveSecond: (v: jsonDocument.PreparedJson) => void = () => {};
    const firstPromise = new Promise<jsonDocument.PreparedJson>((res) => {
      resolveFirst = res;
    });
    const secondPromise = new Promise<jsonDocument.PreparedJson>((res) => {
      resolveSecond = res;
    });

    vi.spyOn(jsonDocument, 'prepareJson')
      .mockImplementationOnce(() => firstPromise)
      .mockImplementationOnce(() => secondPromise);

    const ref = createRef<MarkdownViewHandle>();
    const onParseError = vi.fn();

    await act(async () => {
      root.render(<JsonView ref={ref} text='{"first": 1}' kind="json" onParseError={onParseError} />);
    });
    await act(async () => {
      root.render(<JsonView ref={ref} text='{"second": 2}' kind="json" onParseError={onParseError} />);
    });

    let readyResolved = false;
    const readyPromise = ref.current?.ready().then(() => {
      readyResolved = true;
    });

    // Resolve first (stale)
    resolveFirst({ text: '{\n  "first": 1\n}', error: null });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    // Newer ready must NOT have resolved yet
    expect(readyResolved).toBe(false);
    expect(onParseError).not.toHaveBeenCalledWith(null);

    // Resolve second (latest)
    resolveSecond({ text: '{\n  "second": 2\n}', error: null });
    await act(async () => {
      await readyPromise;
    });

    expect(readyResolved).toBe(true);
    expect(container.textContent).toContain('"second": 2');
    expect(container.textContent).not.toContain('"first": 1');
  });

  it('proves the open rule sets Beautify 2 spaces for single-line and Original for multiline', async () => {
    const ref = createRef<MarkdownViewHandle>();
    const onParseError = vi.fn();
    // Single line
    await act(async () => {
      root.render(<JsonView ref={ref} text='{"single": 1}' kind="json" onParseError={onParseError} />);
    });
    await act(async () => {
      await ref.current?.ready();
    });
    const beautifyBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Beautify');
    expect(beautifyBtn?.getAttribute('aria-pressed')).toBe('true');
    expect(container.querySelector('code')?.textContent).toBe('{\n  "single": 1\n}');

    // Multiline
    await act(async () => {
      root.render(<JsonView ref={ref} text={'{\n    "multi": 2\n}'} kind="json" onParseError={onParseError} />);
    });
    await act(async () => {
      await ref.current?.ready();
    });
    const originalBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Original');
    expect(originalBtn?.getAttribute('aria-pressed')).toBe('true');
    expect(container.querySelector('code')?.textContent).toBe('{\n    "multi": 2\n}');
  });

  it('proves opening a different document resets the toolbar to the open rule', async () => {
    const ref = createRef<MarkdownViewHandle>();
    const onParseError = vi.fn();
    await act(async () => {
      root.render(<JsonView ref={ref} source="docA.json" text={'{\n  "a": 1\n}'} kind="json" onParseError={onParseError} />);
    });
    await act(async () => {
      await ref.current?.ready();
    });

    const minifyBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Minify');
    expect(minifyBtn).toBeDefined();
    await act(async () => {
      minifyBtn?.click();
    });
    await act(async () => {
      await ref.current?.ready();
    });
    expect(minifyBtn?.getAttribute('aria-pressed')).toBe('true');
    expect(container.querySelector('code')?.textContent).toBe('{"a":1}');

    await act(async () => {
      root.render(<JsonView ref={ref} source="docB.json" text={'{\n  "b": 2\n}'} kind="json" onParseError={onParseError} />);
    });
    await act(async () => {
      await ref.current?.ready();
    });

    const originalBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Original');
    expect(originalBtn?.getAttribute('aria-pressed')).toBe('true');
    expect(container.querySelector('code')?.textContent).toBe('{\n  "b": 2\n}');
  });

  it('proves auto-refresh with the same source keeps toolbar state', async () => {
    const ref = createRef<MarkdownViewHandle>();
    const onParseError = vi.fn();
    await act(async () => {
      root.render(<JsonView ref={ref} source="live.json" text={'{\n  "a": 1\n}'} kind="json" onParseError={onParseError} />);
    });
    await act(async () => {
      await ref.current?.ready();
    });

    const minifyBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Minify');
    expect(minifyBtn).toBeDefined();
    await act(async () => {
      minifyBtn?.click();
    });
    await act(async () => {
      await ref.current?.ready();
    });
    expect(container.querySelector('code')?.textContent).toBe('{"a":1}');

    await act(async () => {
      root.render(<JsonView ref={ref} source="live.json" text={'{\n  "a": 2\n}'} kind="json" onParseError={onParseError} />);
    });
    await act(async () => {
      await ref.current?.ready();
    });

    const newMinifyBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Minify');
    expect(newMinifyBtn?.getAttribute('aria-pressed')).toBe('true');
    expect(container.querySelector('code')?.textContent).toBe('{"a":2}');
  });

  it('proves unescape is reverted on refresh when the root is no longer a string', async () => {
    const ref = createRef<MarkdownViewHandle>();
    const onParseError = vi.fn();
    const stringSource = '"{\\"hello\\":\\"world\\"}"';
    await act(async () => {
      root.render(<JsonView ref={ref} source="unescape.json" text={stringSource} kind="json" onParseError={onParseError} />);
    });
    await act(async () => {
      await ref.current?.ready();
    });

    const unescapeBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('Unescape'));
    expect(unescapeBtn).toBeDefined();
    await act(async () => {
      unescapeBtn?.click();
    });
    await act(async () => {
      await ref.current?.ready();
    });

    expect(Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('Revert'))).toBeDefined();
    expect(container.querySelector('code')?.textContent).toContain('"hello": "world"');

    await act(async () => {
      root.render(
        <JsonView ref={ref} source="unescape.json" text={'{\n  "notAString": true\n}'} kind="json" onParseError={onParseError} />,
      );
    });
    await act(async () => {
      await ref.current?.ready();
    });

    expect(Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('Revert'))).toBeUndefined();
    expect(container.querySelector('code')?.textContent).toContain('"notAString": true');
  });

  it('proves abort of a stale transformJson', async () => {
    let resolveFirst: (v: { text: string; hasComments: boolean }) => void = () => {};
    let resolveSecond: (v: { text: string; hasComments: boolean }) => void = () => {};
    const firstPromise = new Promise<{ text: string; hasComments: boolean }>((res) => {
      resolveFirst = res;
    });
    const secondPromise = new Promise<{ text: string; hasComments: boolean }>((res) => {
      resolveSecond = res;
    });

    vi.spyOn(jsonDocument, 'transformJson')
      .mockImplementationOnce(() => firstPromise)
      .mockImplementationOnce(() => secondPromise);

    const ref = createRef<MarkdownViewHandle>();
    const onParseError = vi.fn();

    await act(async () => {
      root.render(<JsonView ref={ref} text='{"first": 1}' kind="json" onParseError={onParseError} />);
    });
    await act(async () => {
      root.render(<JsonView ref={ref} text='{"second": 2}' kind="json" onParseError={onParseError} />);
    });

    let readyResolved = false;
    const readyPromise = ref.current?.ready().then(() => {
      readyResolved = true;
    });

    // Resolve first (stale)
    resolveFirst({ text: '{"first": 1}', hasComments: false });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(readyResolved).toBe(false);

    // Resolve second (latest)
    resolveSecond({ text: '{"second": 2}', hasComments: false });
    await act(async () => {
      await readyPromise;
    });

    expect(readyResolved).toBe(true);
    expect(container.querySelector('code')?.textContent).toBe('{"second": 2}');
  });

  it('proves a rejected transformJson is reported rather than thrown', async () => {
    vi.spyOn(jsonDocument, 'transformJson').mockRejectedValueOnce(new RangeError('Maximum call stack size exceeded'));
    const ref = createRef<MarkdownViewHandle>();
    const onParseError = vi.fn();
    const deep = '{"nested": 1}';
    await act(async () => {
      root.render(<JsonView ref={ref} text={deep} kind="json" onParseError={onParseError} />);
    });
    await act(async () => {
      await ref.current?.ready();
    });
    expect(onParseError).toHaveBeenCalledWith({
      message: 'Maximum call stack size exceeded',
      line: 1,
      column: 1,
    });
    expect(container.textContent).toContain(deep);
  });
});
