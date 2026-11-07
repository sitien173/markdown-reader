import { parseCapturedText } from '../lib/schemas';

export type CapturedText = { url: string; text: string; ts: number };

export function usableCapturedText(entry: unknown, url: string, now = Date.now()): string | undefined {
  const value = parseCapturedText(entry);
  if (!value || value.url !== url) return undefined;
  if (now - value.ts > 30_000 || value.ts > now) return undefined;
  return value.text;
}
