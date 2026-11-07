import { useEffect, useRef, useState } from 'react';
import type { Heading } from '../render/pipeline';
import { buildToc, observeHeadings, type TocNode } from '../toc/toc';
/** Explicit `behavior: 'smooth'` ignores the CSS reset, so scripted scrolling checks the preference itself. */
export const scrollBehavior = (): ScrollBehavior => (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth');
export function scrollToHeading(id: string) {
  const target = document.getElementById(id);
  const content = document.querySelector('[data-slot="reader-content"]');
  if (target && content)
    content.scrollTo({
      top: content.scrollTop + target.getBoundingClientRect().top - content.getBoundingClientRect().top - 24,
      behavior: scrollBehavior(),
    });
}
function Items({ nodes, active, onActive }: { nodes: TocNode[]; active: string; onActive: (id: string) => void }) {
  return (
    <ul className="nav-list">
      {nodes.map((node) => (
        <li key={node.id}>
          <button
            type="button"
            className={`nav-item${active === node.id ? ' nav-item--active' : ''}`}
            aria-current={active === node.id ? 'location' : undefined}
            onClick={() => {
              onActive(node.id);
              scrollToHeading(node.id);
            }}
          >
            {node.text}
          </button>
          {node.children.length > 0 && <Items nodes={node.children} active={active} onActive={onActive} />}
        </li>
      ))}
    </ul>
  );
}
export function TocPanel({ headings }: { headings: Heading[] }) {
  const [active, setActive] = useState('');
  const nav = useRef<HTMLElement>(null);
  useEffect(() => {
    setActive('');
    return observeHeadings(headings, setActive);
  }, [headings]);
  useEffect(() => {
    if (!active) return;
    nav.current?.querySelector('[aria-current="location"]')?.scrollIntoView({ block: 'nearest' });
  }, [active]);
  return (
    <nav aria-label="Table of contents" ref={nav}>
      <Items nodes={buildToc(headings)} active={active} onActive={setActive} />
    </nav>
  );
}
