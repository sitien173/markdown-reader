export function shouldRedirectMarkdown(contentType: string, pathname: string): boolean {
  return ['text/plain', 'text/markdown'].includes(contentType) && /\.(?:md|markdown)$/i.test(pathname);
}

export default defineContentScript({
  matches: ['*://*/*.md', '*://*/*.markdown', 'file:///*.md', 'file:///*.markdown'],
  async main() {
    if (!shouldRedirectMarkdown(document.contentType, location.pathname)) return;
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
