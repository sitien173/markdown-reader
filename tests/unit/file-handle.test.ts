// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { SaveConflictDialog } from '../../src/ui/save-conflict-dialog';
import { FileHandleSource, isValidMarkdownFile, SaveConflictError } from '../../src/source/file-handle';

function fakeHandle(lastModified: number) {
  const createWritable = vi.fn(async () => ({ write: vi.fn(async () => {}), close: vi.fn(async () => {}) }));
  const handle = {
    getFile: vi.fn(async () => ({ lastModified, text: async () => 'disk text' })),
    createWritable,
  };
  return { handle: handle as unknown as FileSystemFileHandle, createWritable };
}

describe('FileHandleSource.write', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('never writes when lastModified differs from the expected stamp (conflict is not overwritten)', async () => {
    const { handle, createWritable } = fakeHandle(2000);
    const source = new FileHandleSource(handle);
    await expect(source.write('draft', 1000)).rejects.toBeInstanceOf(SaveConflictError);
    expect(createWritable).not.toHaveBeenCalled();
  });

  it('writes when the stamp matches', async () => {
    const { handle, createWritable } = fakeHandle(1000);
    const source = new FileHandleSource(handle);
    await source.write('draft', 1000);
    expect(createWritable).toHaveBeenCalledTimes(1);
  });

  it('overwrites only when no expected stamp is passed', async () => {
    const { handle, createWritable } = fakeHandle(2000);
    await new FileHandleSource(handle).write('forced');
    expect(createWritable).toHaveBeenCalledTimes(1);
  });

  it('Cancel in SaveConflictDialog calls onCancel and never invokes the overwrite/write path', () => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const onCancel = vi.fn();
    const onOverwrite = vi.fn();
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    act(() => root.render(React.createElement(SaveConflictDialog, { open: true, onCancel, onOverwrite, onReload: vi.fn() })));
    const cancel = [...document.body.querySelectorAll('button')].find((button) => button.textContent === 'Cancel');
    expect(cancel).toBeTruthy();
    act(() => cancel!.click());
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onOverwrite).not.toHaveBeenCalled();
    act(() => root.unmount());
    container.remove();
  });

  it('passes both Markdown and JSON file types to showOpenFilePicker', async () => {
    const showOpenFilePicker = vi.fn(async () => [
      { getFile: async () => ({ lastModified: 100, text: async () => '{}' }), name: 'data.json' } as unknown as FileSystemFileHandle,
    ]);
    vi.stubGlobal('showOpenFilePicker', showOpenFilePicker);
    const source = new FileHandleSource();
    await source.pick();
    expect(showOpenFilePicker).toHaveBeenCalledWith({
      types: [
        { description: 'Markdown files', accept: { 'text/markdown': ['.md', '.markdown'] } },
        { description: 'JSON files', accept: { 'application/json': ['.json', '.jsonc'] } },
      ],
    });
  });

  it('isValidMarkdownFile accepts .json and .jsonc along with markdown files', () => {
    expect(isValidMarkdownFile('data.json')).toBe(true);
    expect(isValidMarkdownFile('config.jsonc')).toBe(true);
    expect(isValidMarkdownFile('readme.md')).toBe(true);
    expect(isValidMarkdownFile('doc.markdown')).toBe(true);
    expect(isValidMarkdownFile('image.png')).toBe(false);
    expect(isValidMarkdownFile('notes.txt')).toBe(false);
  });
});
