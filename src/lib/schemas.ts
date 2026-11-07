import './zod-config';
import * as z from 'zod/mini';
import { isAllowedUrl } from '../source/url';
import type { CapturedText } from '../source/captured-text';
import type { StoredHandleRecord } from '../store/handles';

const capturedTextSchema = z.object({ url: z.string(), text: z.string(), ts: z.number() });
// Matches the pre-Zod check: any object with a `handle` key is listed, so partial records still show as Reconnect entries.
const storedHandleSchema = z.custom<StoredHandleRecord>((value) => typeof value === 'object' && value !== null && 'handle' in value);
const recentUrlSchema = z.string();

export function parseCapturedText(value: unknown): CapturedText | undefined {
  const parsed = capturedTextSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

export function parseStoredHandle(value: unknown): StoredHandleRecord | undefined {
  const parsed = storedHandleSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

export function parseRecentUrls(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => recentUrlSchema.safeParse(item).success) : [];
}

export type OpenUrlResult = { ok: true; url: string } | { ok: false; message: string };

const openUrlSchema = z
  .string()
  .check(z.trim(), z.minLength(1, 'Enter a Markdown URL'))
  .check(z.refine((value) => URL.canParse(value), 'Enter a valid URL'))
  .check(z.refine(isAllowedUrl, 'This URL scheme is not supported'));

/** Open URL dialog check. Reuses isAllowedUrl, so file: stays allowed. */
export function parseOpenUrl(value: string): OpenUrlResult {
  const parsed = openUrlSchema.safeParse(value);
  return parsed.success ? { ok: true, url: parsed.data } : { ok: false, message: parsed.error.issues[0]?.message ?? 'Enter a valid URL' };
}
