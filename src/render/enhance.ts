import createDOMPurify from 'dompurify';
import { createBlockCache } from './cache';
import { highlight } from './highlight';
import { enhanceMath } from './math';
import { enhanceDiagrams } from './diagram';

const purify = createDOMPurify(window);
const cache = createBlockCache<Promise<string | null>>(200);
export async function enhance(root: HTMLElement, signal?: AbortSignal): Promise<void> {
  if (!root.isConnected || signal?.aborted) return;
  const codeBlocks = Array.from(root.querySelectorAll<HTMLElement>('pre > code[class*="language-"]'));
  for (const code of codeBlocks) {
    if (!root.isConnected || signal?.aborted) return;
    const match = Array.from(code.classList).find((name) => name.startsWith('language-'));
    const language = match?.slice('language-'.length) ?? '';
    const source = code.textContent ?? '';
    const html = await cache.getOrCreate('code', language, source, () => highlight(source, language));
    if (!root.isConnected || signal?.aborted) return;
    if (html) {
      const replacement = document.createElement('div');
      replacement.innerHTML = purify.sanitize(html);
      const pre = replacement.querySelector('pre');
      if (pre) code.parentElement?.replaceWith(pre);
    }
  }
  await enhanceMath(root);
  if (!root.isConnected || signal?.aborted) return;
  await enhanceDiagrams(root, signal);
}
