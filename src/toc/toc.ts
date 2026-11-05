import type { Heading } from '../render/pipeline';
export type TocNode = Heading & { children: TocNode[] };
export function buildToc(headings: Heading[]): TocNode[] {
  const roots: TocNode[] = [], stack: TocNode[] = [];
  for (const heading of headings) {
    const node: TocNode = { ...heading, children: [] };
    while (stack.length && stack[stack.length - 1]!.level >= node.level) stack.pop();
    if (stack.length) stack[stack.length - 1]!.children.push(node); else roots.push(node);
    stack.push(node);
  }
  return roots;
}
export function observeHeadings(headings: Heading[], onActive: (id: string) => void): () => void {
  if (typeof IntersectionObserver === 'undefined') return () => {};
  const content = document.querySelector('.tds-custom-reader__content');
  if (!content) return () => {};
  const observer = new IntersectionObserver(entries => { const visible = entries.filter(e => e.isIntersecting).sort((a,b)=>Math.abs(a.boundingClientRect.top)-Math.abs(b.boundingClientRect.top))[0]; if (visible) onActive((visible.target as HTMLElement).id); }, { root: content, rootMargin: '0px 0px -75% 0px' });
  headings.forEach(h => { const el = document.getElementById(h.id); if (el) observer.observe(el); });
  return () => observer.disconnect();
}
