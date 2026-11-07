import type { Source } from './types';

export function isAllowedUrl(raw: string): boolean {
  try {
    return ['http:', 'https:', 'file:'].includes(new URL(raw).protocol);
  } catch {
    return false;
  }
}
export class UrlSource implements Source {
  constructor(readonly baseUrl: string) {}
  async read(): Promise<string> {
    let response: Response;
    try {
      response = await fetch(this.baseUrl);
    } catch {
      throw new Error(`Unable to fetch ${this.baseUrl}`);
    }
    if (!response.ok) throw new Error(`HTTP ${response.status} while fetching ${this.baseUrl}`);
    return response.text();
  }
}
