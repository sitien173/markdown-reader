import { readResponseText } from './decode';
import type { Source } from './types';
import { watchHttpUrl, type WatchEvents } from './watch';

export function isAllowedUrl(raw: string): boolean {
  try {
    return ['http:', 'https:', 'file:'].includes(new URL(raw).protocol);
  } catch {
    return false;
  }
}
export class UrlSource implements Source {
  constructor(
    readonly baseUrl: string,
    private readonly charsetCompat = false,
  ) {}
  async read(): Promise<string> {
    let response: Response;
    try {
      response = await fetch(this.baseUrl, { cache: 'no-cache' });
    } catch {
      throw new Error(`Unable to fetch ${this.baseUrl}`);
    }
    if (!response.ok) throw new Error(`HTTP ${response.status} while fetching ${this.baseUrl}`);
    return readResponseText(response, this.charsetCompat);
  }
  watch(events: WatchEvents): () => void {
    return watchHttpUrl(this.baseUrl, events);
  }
}
