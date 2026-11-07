// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { FileTree } from '../../src/ui/file-tree';
import type { TreeNode } from '../../src/source/directory';

describe('FileTree', () => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

  const fakeFileHandle = {
    kind: 'file' as const,
    name: 'guide.md',
    getFile: async () => new File(['# Guide'], 'guide.md'),
  } as unknown as FileSystemFileHandle;

  const fakeDirHandle = {
    kind: 'directory' as const,
    name: 'docs',
  } as unknown as FileSystemDirectoryHandle;

  const nodes: TreeNode[] = [
    {
      kind: 'directory',
      name: 'docs',
      path: 'docs',
      handle: fakeDirHandle,
      children: [
        {
          kind: 'file',
          name: 'guide.md',
          path: 'docs/guide.md',
          handle: fakeFileHandle,
        },
      ],
    },
    {
      kind: 'file',
      name: 'readme.md',
      path: 'readme.md',
      handle: { ...fakeFileHandle, name: 'readme.md' } as unknown as FileSystemFileHandle,
    },
  ];

  it('renders tree items with the file-tree list, toggles, and the active file', () => {
    const onSelectFile = vi.fn();
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);

    act(() => {
      root.render(React.createElement(FileTree, { nodes, activePath: 'readme.md', onSelectFile }));
    });

    const list = container.querySelector('[data-slot="file-tree"]');
    expect(list).not.toBeNull();

    const items = container.querySelectorAll('[data-slot="file-tree-toggle"], [data-slot="file-tree-file"]');
    expect(items.length).toBeGreaterThanOrEqual(3);

    const toggle = container.querySelector('[data-slot="file-tree-toggle"]');
    expect(toggle?.getAttribute('aria-label')).toBe('Toggle docs');

    const activeItem = container.querySelector('[aria-current="page"]');
    expect(activeItem).not.toBeNull();
    expect(activeItem?.textContent).toContain('readme.md');
    expect(activeItem?.getAttribute('aria-current')).toBe('page');

    act(() => root.unmount());
    container.remove();
  });

  it('calls onSelectFile with path and handle when a file is clicked', () => {
    const onSelectFile = vi.fn();
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);

    act(() => {
      root.render(React.createElement(FileTree, { nodes, onSelectFile }));
    });

    const buttons = [...container.querySelectorAll('button')];
    const readmeBtn = buttons.find((b) => b.textContent?.includes('readme.md'));
    expect(readmeBtn).toBeTruthy();

    act(() => {
      readmeBtn!.click();
    });

    expect(onSelectFile).toHaveBeenCalledTimes(1);
    expect(onSelectFile).toHaveBeenCalledWith('readme.md', expect.anything());

    act(() => root.unmount());
    container.remove();
  });

  it('renders an empty state when no markdown files exist', () => {
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);

    act(() => {
      root.render(React.createElement(FileTree, { nodes: [], onSelectFile: vi.fn() }));
    });

    expect(container.textContent).toContain('No Markdown files');

    act(() => root.unmount());
    container.remove();
  });
});
