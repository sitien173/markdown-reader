import { isAllowedUrl } from '../source/url';

export function isMarkdownLink(raw: string): boolean {
  try {
    return isAllowedUrl(raw) && /\.(?:md|markdown)$/i.test(new URL(raw).pathname);
  } catch {
    return false;
  }
}

export function isValidCapture(message: { text?: unknown }, sender: { id?: string; tab?: { url?: string } }, runtimeId: string): boolean {
  const url = sender.tab?.url;
  return sender.id === runtimeId && !!url && typeof message.text === 'string' && isMarkdownLink(url);
}

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(async () => {
    await browser.contextMenus.removeAll();
    browser.contextMenus.create({ id: 'open-markdown-reader', title: 'Open in Markdown Reader', contexts: ['link'] });
  });

  browser.contextMenus.onClicked.addListener(async (info) => {
    if (info.menuItemId !== 'open-markdown-reader') return;
    const url = info.linkUrl;
    if (!url || !isMarkdownLink(url)) {
      await browser.action.setBadgeText({ text: '!' });
      await browser.action.setTitle({ title: 'Markdown Reader: this link is not a supported Markdown URL' });
      return;
    }
    await browser.action.setBadgeText({ text: '' });
    await browser.tabs.create({ url: `${browser.runtime.getURL('/reader.html')}?src=${encodeURIComponent(url)}` });
  });

  browser.runtime.onMessage.addListener(
    (message: { action?: string; url?: string; mode?: string; text?: string }, sender, sendResponse) => {
      void (async () => {
        if (message?.action === 'capture-markdown') {
          if (!isValidCapture(message, sender, browser.runtime.id)) {
            sendResponse({ ok: false });
            return;
          }
          const url = sender.tab!.url!;
          await browser.storage.session.set({ [`markdown-reader:${url}`]: { url, text: message.text, ts: Date.now() } });
          const reader = new URL(browser.runtime.getURL('/reader.html'));
          reader.searchParams.set('src', url);
          if (sender.tab?.id !== undefined) await browser.tabs.update(sender.tab.id, { url: reader.toString() });
          sendResponse({ ok: true });
          return;
        }
        if (!['open-viewer', 'open-editor', 'render-current'].includes(message?.action ?? '')) {
          sendResponse({ ok: false });
          return;
        }
        let url = message.url;
        if (message.action === 'render-current' && !url) {
          const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
          url = tab?.url;
        }
        if (url && !isAllowedUrl(url)) {
          sendResponse({ ok: false });
          return;
        }
        if (message.action === 'render-current' && !url) {
          sendResponse({ ok: false });
          return;
        }
        const mode = message.action === 'open-editor' ? 'edit' : (message.mode ?? 'read');
        if (!['read', 'edit'].includes(mode)) {
          sendResponse({ ok: false });
          return;
        }
        const target = new URL(browser.runtime.getURL('/reader.html'));
        target.searchParams.set('mode', mode);
        if (url) target.searchParams.set('src', url);
        await browser.tabs.create({ url: target.toString() });
        sendResponse({ ok: true });
      })().catch((error) => sendResponse({ ok: false, error: String(error) }));
      return true;
    },
  );
});
