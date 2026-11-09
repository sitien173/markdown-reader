import createDOMPurify from 'dompurify';
import { t } from '../i18n';
import { createBlockCache } from './cache';
import { highlight, highlightCacheKind } from './highlight';
import { enhanceMath } from './math';
import { enhanceDiagrams } from './diagram';

const purify = createDOMPurify(window);
const cache = createBlockCache<Promise<string | null>>(200);
const COPY_LABEL_MS = 2000;

/** Adds a permalink to each heading that has an id. The anchor stays out of the accessibility tree and the tab order, and its `#` is drawn by CSS so heading text is unchanged. */
function addPermalinks(root: HTMLElement) {
  for (const heading of root.querySelectorAll<HTMLElement>('h1[id], h2[id], h3[id], h4[id], h5[id], h6[id]')) {
    if (heading.querySelector(':scope > a.md-permalink')) continue;
    const link = document.createElement('a');
    link.className = 'md-permalink';
    link.href = `#${heading.id}`;
    link.setAttribute('aria-hidden', 'true');
    link.tabIndex = -1;
    heading.append(link);
  }
}

/** Wraps a `pre` with a bar holding the language label and a Copy button that writes `source` to the clipboard. */
function addCodeBar(pre: HTMLElement, language: string, source: string) {
  if (pre.closest('.md-code')) return;
  const wrapper = document.createElement('div');
  wrapper.className = 'md-code';
  const bar = document.createElement('div');
  bar.className = 'md-code-bar';
  const label = document.createElement('span');
  label.className = 'md-code-lang';
  label.textContent = language;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'md-code-copy';
  button.textContent = t('reader.copy');
  button.setAttribute('aria-live', 'polite');
  let reset: ReturnType<typeof setTimeout> | undefined;
  button.addEventListener('click', async () => {
    let result: 'reader.copied' | 'reader.copyFailed' = 'reader.copied';
    try {
      await navigator.clipboard.writeText(source);
    } catch {
      result = 'reader.copyFailed';
    }
    button.textContent = t(result);
    clearTimeout(reset);
    reset = setTimeout(() => {
      button.textContent = t('reader.copy');
    }, COPY_LABEL_MS);
  });
  bar.append(label, button);
  pre.replaceWith(wrapper);
  wrapper.append(bar, pre);
}

export async function enhance(root: HTMLElement, signal?: AbortSignal): Promise<void> {
  if (!root.isConnected || signal?.aborted) return;
  addPermalinks(root);
  const codeBlocks = Array.from(root.querySelectorAll<HTMLElement>('pre > code[class*="language-"]'));
  for (const code of codeBlocks) {
    if (!root.isConnected || signal?.aborted) return;
    const match = Array.from(code.classList).find((name) => name.startsWith('language-'));
    const language = match?.slice('language-'.length) ?? '';
    const source = code.textContent ?? '';
    const html = await cache.getOrCreate(highlightCacheKind(), language, source, () => highlight(source, language));
    if (!root.isConnected || signal?.aborted) return;
    let target = code.parentElement;
    if (html) {
      const replacement = document.createElement('div');
      replacement.innerHTML = purify.sanitize(html);
      const pre = replacement.querySelector('pre');
      if (pre) {
        code.parentElement?.replaceWith(pre);
        target = pre;
      }
    }
    if (target) addCodeBar(target, language, source);
  }
  for (const pre of root.querySelectorAll<HTMLElement>('pre:not(.mermaid)')) {
    if (!pre.closest('.md-code')) addCodeBar(pre, '', pre.querySelector('code')?.textContent ?? pre.textContent ?? '');
  }
  await enhanceMath(root);
  if (!root.isConnected || signal?.aborted) return;
  await enhanceDiagrams(root, signal);
}
