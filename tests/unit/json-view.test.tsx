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
});
