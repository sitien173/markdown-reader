import { readResponseText } from './decode';
import type { Source } from './types';
import { watchFileUrl, type WatchEvents } from './watch';

export class FileUrlSource implements Source {
  constructor(
    readonly baseUrl: string,
    private readonly charsetCompat = false,
  ) {}
  async read(): Promise<string> {
    let response: Response;
    try {
      response = await fetch(this.baseUrl);
    } catch {
      throw new Error('Unable to read this file URL. Enable “Allow access to file URLs” for Markdown Reader in chrome://extensions.');
    }
    if (!response.ok) throw new Error(`Unable to read ${this.baseUrl}`);
    return readResponseText(response, this.charsetCompat);
  }
  watch(events: WatchEvents): () => void {
    return watchFileUrl(this.baseUrl, events);
  }
}
