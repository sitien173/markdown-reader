export type DraftStorage = {
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
};
const PREFIX = 'markdown-reader:draft:';
export function draftKey(sourceId: string): string { return PREFIX + sourceId; }
export function createDraftSaver(storage: DraftStorage, key: string, delayMs: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending: string | undefined;
  const flush = () => { clearTimeout(timer); timer = undefined; if (pending !== undefined) { void storage.set({ [key]: pending }); pending = undefined; } };
  return {
    update(text: string) { pending = text; clearTimeout(timer); timer = setTimeout(flush, delayMs); },
    flush,
    cancel() { clearTimeout(timer); timer = undefined; pending = undefined; },
  };
}
export async function loadDraft(storage: DraftStorage, key: string): Promise<string | undefined> {
  const value = (await storage.get(key))[key];
  return typeof value === 'string' ? value : undefined;
}
