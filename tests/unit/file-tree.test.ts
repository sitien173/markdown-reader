// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { FileTree } from '../../src/ui/file-tree';
import type { TreeNode } from '../../src/source/directory';

describe('FileTree', () => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

  const nodes: TreeNode[] = [
    {
      kind: 'directory',
      name: 'docs',
      path: 'docs',
      children: [
        {
          kind: 'file',
          name: 'guide.md',
          path: 'docs/guide.md',
        },
      ],
    },
    {
      kind: 'file',
      name: 'readme.md',
      path: 'readme.md',
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

  it('calls onSelectFile with path when a file is clicked', () => {
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
    expect(onSelectFile).toHaveBeenCalledWith('readme.md');

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

  it('renders an unloaded folder (children === null) as a collapsed collapsible', () => {
    const onSelectFile = vi.fn();
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);

    const unloadedNodes = [
      {
        kind: 'directory' as const,
        name: 'unloaded',
        path: 'unloaded',
        children: null,
      },
    ];

    act(() => {
      root.render(React.createElement(FileTree, { nodes: unloadedNodes as any, onSelectFile }));
    });

    const toggle = container.querySelector('[data-slot="file-tree-toggle"]');
    expect(toggle).not.toBeNull();
    expect(toggle?.getAttribute('aria-expanded')).toBe('false');

    act(() => root.unmount());
    container.remove();
  });

  it('filters unloaded folders by name and keeps matching unloaded folders', () => {
    const onSelectFile = vi.fn();
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);

    const mixedNodes = [
      {
        kind: 'directory' as const,
        name: 'target-folder',
        path: 'target-folder',
        children: null,
      },
      {
        kind: 'directory' as const,
        name: 'other-folder',
        path: 'other-folder',
        children: null,
      },
    ];

    act(() => {
      root.render(React.createElement(FileTree, { nodes: mixedNodes as any, filter: 'target', onSelectFile }));
    });

    const items = container.querySelectorAll('[data-slot="file-tree-toggle"]');
    expect(items.length).toBe(1);
    expect(items[0]?.textContent).toContain('target-folder');

    act(() => root.unmount());
    container.remove();
  });

  it('renders inline error message when folder expansion failed with error flag', () => {
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);

    const errorNodes: TreeNode[] = [
      {
        kind: 'directory',
        name: 'broken-folder',
        path: 'broken-folder',
        children: [],
        error: true,
      },
    ];

    act(() => {
      root.render(React.createElement(FileTree, { nodes: errorNodes, activePath: null, onSelectFile: vi.fn() }));
    });

    const errorEl = container.querySelector('[data-slot="file-tree-error"]');
    expect(errorEl).not.toBeNull();
    expect(errorEl?.textContent).toBe('Could not read folder');

    act(() => root.unmount());
    container.remove();
  });
});
