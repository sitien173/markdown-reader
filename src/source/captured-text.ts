export type CapturedText = { url: string; text: string; ts: number };

export function usableCapturedText(entry: unknown, url: string, now = Date.now()): string | undefined {
  if (!entry || typeof entry !== 'object') return undefined;
  const value = entry as Partial<CapturedText>;
  if (value.url !== url || typeof value.text !== 'string' || typeof value.ts !== 'number') return undefined;
  if (now - value.ts > 30_000 || value.ts > now) return undefined;
  return value.text;
}
