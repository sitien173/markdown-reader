import { isJsonName } from '../lib/doc-kind';
import { type GeneralFlags, readGeneralFlags } from '../lib/settings-flags';

const isJsonContentType = (contentType: string) =>
  ['application/json', 'text/json', 'text/plain', ''].includes(contentType) || contentType.endsWith('+json');

export function shouldRedirectMarkdown(
  contentType: string,
  pathname: string,
  flags: Pick<GeneralFlags, 'enabled' | 'renderTxt'> & Partial<Pick<GeneralFlags, 'renderJson'>> = { enabled: true, renderTxt: false },
): boolean {
  if (!flags.enabled) return false;
  if (flags.renderJson && isJsonName(pathname) && isJsonContentType(contentType)) return true;
  if (flags.renderTxt && contentType === 'text/plain' && /\.txt$/i.test(pathname)) return true;
  return ['text/plain', 'text/markdown'].includes(contentType) && /\.(?:md|markdown)$/i.test(pathname);
}

export default defineContentScript({
  matches: [
    '*://*/*.md',
    '*://*/*.markdown',
    '*://*/*.txt',
    'file:///*.md',
    'file:///*.markdown',
    'file:///*.txt',
    '*://*/*.json',
    '*://*/*.jsonc',
    'file:///*.json',
    'file:///*.jsonc',
  ],
  async main() {
    if (!shouldRedirectMarkdown(document.contentType, location.pathname, await readGeneralFlags())) return;
    const url = location.href;
    const text = document.body?.innerText ?? document.documentElement?.innerText ?? '';
    try {
      const response = await browser.runtime.sendMessage({ action: 'capture-markdown', url, text });
      if (!response?.ok) console.warn('Markdown capture was rejected; leaving the raw page open');
    } catch (error) {
      console.warn('Markdown capture failed; leaving the raw page open', error);
    }
  },
});
