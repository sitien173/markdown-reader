import { createContext, useContext } from 'react';
import { createStore, type StoreApi, useStore } from 'zustand';
import type { Heading } from '../render/pipeline';
import type { DirectorySource, TreeNode } from '../source/directory';
import type { RecentItem } from './recent';
import { useSettingsStore } from './settings-store';

export type Mode = 'read' | 'edit' | 'split';
export type SidebarTab = 'contents' | 'files';
export type Banner = { kind: 'error'; message: string } | { kind: 'externalChange' } | null;

export interface FileTreeState {
  rootUrl: string;
  nodes: TreeNode[];
  version?: number;
  repoRoot?: string | null;
}

export interface ReaderState {
  mode: Mode;
  source: string;
  docPath: string | null;
  loading: boolean;
  headings: Heading[];
  recents: RecentItem[];
  sidebarOpen: boolean;
  sidebarTab: SidebarTab;
  focusMode: boolean;
  error: string;
  externalChange: boolean;
  conflict: boolean;
  dirty: boolean;
  writable: boolean;
  docTitle: string;
  urlDialogOpen: boolean;
  text: string | null;
  mountText: string;
  loadId: number;
  sourceId: string;
  directorySource: DirectorySource | null;
  treeNodes: TreeNode[];
  fileTree: FileTreeState | null;
  fileAccessError: boolean;
}

export const MODES: Mode[] = ['read', 'edit', 'split'];
export function parseMode(raw: string | null): Mode {
  return MODES.includes(raw as Mode) ? (raw as Mode) : 'read';
}

function initialState(): ReaderState {
  const params = new URLSearchParams(window.location.search);
  return {
    mode: parseMode(params.get('mode')),
    source: params.get('src') ?? '',
    docPath: null,
    loading: false,
    headings: [],
    recents: [],
    sidebarOpen: true,
    sidebarTab: 'contents',
    // Zen mode: the stored Appearance value is the start state. Leaving focus mode later changes this session only.
    focusMode: useSettingsStore.getState().settings.appearance.zen,
    error: '',
    externalChange: false,
    conflict: false,
    dirty: false,
    writable: false,
    docTitle: '',
    urlDialogOpen: false,
    text: null,
    mountText: '',
    loadId: 0,
    sourceId: '',
    directorySource: null,
    treeNodes: [],
    fileTree: null,
    fileAccessError: false,
  };
}

export type ReaderStore = StoreApi<ReaderState>;

/** One store per App mount, so two readers (or a StrictMode remount) never share state. */
export function createReaderStore(): ReaderStore {
  return createStore<ReaderState>(() => initialState());
}

export const ReaderStoreContext = createContext<ReaderStore | null>(null);

export function useReaderStoreApi(): ReaderStore {
  const store = useContext(ReaderStoreContext);
  if (!store) throw new Error('useReaderStoreApi must be used inside ReaderStoreContext');
  return store;
}

export function useReaderStore<T>(selector: (state: ReaderState) => T): T {
  return useStore(useReaderStoreApi(), selector);
}

/** Every persistent condition, highest priority first. Conditions coexist, so dismissing the error leaves the external-change prompt. */
export function selectBanners(state: Pick<ReaderState, 'error' | 'externalChange'>): NonNullable<Banner>[] {
  const banners: NonNullable<Banner>[] = [];
  if (state.error) banners.push({ kind: 'error', message: state.error });
  if (state.externalChange) banners.push({ kind: 'externalChange' });
  return banners;
}
