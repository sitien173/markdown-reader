// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { getRecentHandles, requestHandlePermission, storeHandle } from '../../src/store/handles';
import { draftKey } from '../../src/store/drafts';
import { dropFileIdentity, isValidMarkdownFile } from '../../src/source/file-handle';
import { RecentSection } from '../../src/ui/recent-section';
import type { RecentItem } from '../../src/store/recent';

describe('persisted handles and reconnect', () => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

  it('yields a Reconnect entry when a handle has permission state prompt', async () => {
    const fakeHandle = {
      name: 'my-project',
      kind: 'directory',
      queryPermission: vi.fn(async () => 'prompt' as PermissionState),
      requestPermission: vi.fn(async () => 'granted' as PermissionState),
    } as unknown as FileSystemHandle;

    await storeHandle('my-project', 'folder', fakeHandle);

    const recents = await getRecentHandles();
    expect(recents.length).toBeGreaterThanOrEqual(1);
    const entry = recents.find((r) => r.name === 'my-project');
    expect(entry).toBeDefined();
    expect(entry!.permission).toBe('prompt');
    expect(entry!.requiresReconnect).toBe(true);

    // Reconnect calls requestPermission()
    const newState = await requestHandlePermission(entry!.handle);
    expect((fakeHandle as any).requestPermission).toHaveBeenCalledTimes(1);
    expect(newState).toBe('granted');
  });

  it('yields granted without reconnect when handle permission is already granted', async () => {
    const fakeHandle = {
      name: 'notes.md',
      kind: 'file',
      queryPermission: vi.fn(async () => 'granted' as PermissionState),
      requestPermission: vi.fn(async () => 'granted' as PermissionState),
    } as unknown as FileSystemHandle;

    await storeHandle('notes.md', 'file', fakeHandle);

    const recents = await getRecentHandles();
    const entry = recents.find((r) => r.name === 'notes.md');
    expect(entry).toBeDefined();
    expect(entry!.permission).toBe('granted');
    expect(entry!.requiresReconnect).toBe(false);
  });

  it('renders RecentSection with Reconnect button for prompt state, and clicking it requests permission and reopens', async () => {
    const fakeHandle = {
      name: 'my-project',
      kind: 'directory',
      queryPermission: vi.fn(async () => 'prompt' as PermissionState),
      requestPermission: vi.fn(async () => 'granted' as PermissionState),
    } as unknown as FileSystemHandle;

    const onOpenItem = vi.fn();
    const onRefresh = vi.fn();

    const items: RecentItem[] = [
      {
        kind: 'handle',
        id: 'folder:my-project',
        title: 'my-project',
        entry: {
          id: 'folder:my-project',
          name: 'my-project',
          type: 'folder',
          handle: fakeHandle,
          permission: 'prompt',
          requiresReconnect: true,
        },
      },
    ];

    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(React.createElement(RecentSection, { items, onOpenItem, onRefresh }));
    });

    const button = container.querySelector('button');
    expect(button).not.toBeNull();
    expect(button!.textContent).toBe('Reconnect');

    await act(async () => {
      button!.click();
    });

    expect((fakeHandle as any).requestPermission).toHaveBeenCalledTimes(1);
    expect(onOpenItem).toHaveBeenCalledWith(items[0]);
    expect(onRefresh).toHaveBeenCalledTimes(1);

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('handles Reconnect permission rejection and errors with an announcement instead of failing silently', async () => {
    const fakeHandleRejected = {
      name: 'denied-folder',
      kind: 'directory',
      queryPermission: vi.fn(async () => 'prompt' as PermissionState),
      requestPermission: vi.fn(async () => 'denied' as PermissionState),
    } as unknown as FileSystemHandle;

    const onOpenItem = vi.fn();
    const onAnnouncement = vi.fn();

    const items: RecentItem[] = [
      {
        kind: 'handle',
        id: 'folder:denied-folder',
        title: 'denied-folder',
        entry: {
          id: 'folder:denied-folder',
          name: 'denied-folder',
          type: 'folder',
          handle: fakeHandleRejected,
          permission: 'prompt',
          requiresReconnect: true,
        },
      },
    ];

    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(React.createElement(RecentSection, { items, onOpenItem, onAnnouncement }));
    });

    const button = container.querySelector('button');
    expect(button).not.toBeNull();

    await act(async () => {
      button!.click();
    });

    expect(onOpenItem).not.toHaveBeenCalled();
    expect(onAnnouncement).toHaveBeenCalledTimes(1);
    expect(onAnnouncement).toHaveBeenCalledWith(expect.stringContaining('denied-folder'));

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});

describe('carried debt: drop validation and distinct draft keys', () => {
  it('validates file type accepting only .md and .markdown', () => {
    expect(isValidMarkdownFile('README.md')).toBe(true);
    expect(isValidMarkdownFile('notes.markdown')).toBe(true);
    expect(isValidMarkdownFile('DOCUMENT.MD')).toBe(true);
    expect(isValidMarkdownFile('IMAGE.PNG')).toBe(false);
    expect(isValidMarkdownFile('script.js')).toBe(false);
    expect(isValidMarkdownFile('notes.txt')).toBe(false);
    expect(isValidMarkdownFile('no-extension')).toBe(false);
  });

  it('generates distinct draft keys for two dropped files', () => {
    const file1 = { name: 'doc1.md', size: 100, lastModified: 1000 };
    const file2 = { name: 'doc2.md', size: 200, lastModified: 2000 };
    const file3 = { name: 'doc1.md', size: 100, lastModified: 3000 }; // modified version

    const id1 = dropFileIdentity(file1);
    const id2 = dropFileIdentity(file2);
    const id3 = dropFileIdentity(file3);

    expect(id1).not.toBe(id2);
    expect(id1).not.toBe(id3);
    expect(id2).not.toBe(id3);

    const key1 = draftKey(id1);
    const key2 = draftKey(id2);
    const key3 = draftKey(id3);

    expect(key1).not.toBe(key2);
    expect(key1).not.toBe(key3);
    expect(key2).not.toBe(key3);

    // Assert prefix and format
    expect(key1).toContain('markdown-reader:draft:local:drop:doc1.md:100:1000');
  });
});
