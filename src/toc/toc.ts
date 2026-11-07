import type { Heading } from '../render/pipeline';
export type TocNode = Heading & { children: TocNode[] };
export function buildToc(headings: Heading[]): TocNode[] {
  const roots: TocNode[] = [],
    stack: TocNode[] = [];
  for (const heading of headings) {
    const node: TocNode = { ...heading, children: [] };
    while (stack.length && stack[stack.length - 1]!.level >= node.level) stack.pop();
    if (stack.length) stack[stack.length - 1]!.children.push(node);
    else roots.push(node);
    stack.push(node);
  }
  return roots;
}
/** Scroll-spy: the active heading is the first one, in document order, inside the top band of the content scroller. Returns a disconnect function. */
export function observeHeadings(headings: Heading[], onActive: (id: string) => void): () => void {
  if (typeof IntersectionObserver === 'undefined') return () => {};
  const content = document.querySelector('[data-slot="reader-content"]');
  if (!content) return () => {};
  const inBand = new Set<string>();
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const id = (entry.target as HTMLElement).id;
        if (entry.isIntersecting) inBand.add(id);
        else inBand.delete(id);
      }
      const first = headings.find((h) => inBand.has(h.id));
      if (first) onActive(first.id);
    },
    { root: content, rootMargin: '0px 0px -75% 0px' },
  );
  headings.forEach((h) => {
    const el = document.getElementById(h.id);
    if (el) observer.observe(el);
  });
  return () => observer.disconnect();
}
