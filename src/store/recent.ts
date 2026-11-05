import { getRecentHandles, type RecentHandleEntry } from './handles';

export const RECENT_URLS_KEY = 'recentUrls';
export type RecentStorage = { get(key: string): Promise<Record<string, unknown>>; set(value: Record<string, unknown>): Promise<void> };

export async function getRecentUrls(storage: RecentStorage = browser.storage.local): Promise<string[]> {
  const result = await storage.get(RECENT_URLS_KEY);
  const value = result[RECENT_URLS_KEY];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

export async function addRecentUrl(url: string, storage: RecentStorage = browser.storage.local): Promise<void> {
  await navigator.locks.request('recent-urls', async () => {
    const previous = await getRecentUrls(storage);
    await storage.set({ [RECENT_URLS_KEY]: [url, ...previous.filter(item => item !== url)].slice(0, 20) });
  });
}

export type RecentItem =
  | { kind: 'url'; id: string; title: string; url: string }
  | { kind: 'handle'; id: string; title: string; entry: RecentHandleEntry };

export async function getRecentEntries(storage: RecentStorage = browser.storage.local): Promise<RecentItem[]> {
  const urls = await getRecentUrls(storage);
  let handles: RecentHandleEntry[] = [];
  try {
    handles = await getRecentHandles();
  } catch {
    // IDB fallback
  }

  const items: RecentItem[] = [
    ...handles.map(h => ({
      kind: 'handle' as const,
      id: h.id,
      title: h.name,
      entry: h,
    })),
    ...urls.map(u => ({
      kind: 'url' as const,
      id: u,
      title: u,
      url: u,
    })),
  ];

  return items;
}
