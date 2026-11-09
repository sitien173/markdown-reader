import { ChevronRightIcon } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useT } from '../i18n';
import type { Heading } from '../render/pipeline';
import { useSettingsStore } from '../store/settings-store';
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
/** Keeps a node that matches, or has a descendant that matches, so a match is never shown without its parents. */
function filterNodes(nodes: TocNode[], needle: string): TocNode[] {
  return nodes.flatMap((node) => {
    const children = filterNodes(node.children, needle);
    return children.length > 0 || node.text.toLowerCase().includes(needle) ? [{ ...node, children }] : [];
  });
}
type ItemsProps = {
  nodes: TocNode[];
  active: string;
  onActive: (id: string) => void;
  collapsible: boolean;
  collapsed: ReadonlySet<string>;
  onToggle: (id: string) => void;
};
function Items({ nodes, active, onActive, collapsible, collapsed, onToggle }: ItemsProps) {
  const t = useT();
  return (
    <ul className="nav-list">
      {nodes.map((node) => {
        const canCollapse = collapsible && node.children.length > 0;
        const isCollapsed = canCollapse && collapsed.has(node.id);
        return (
          <li key={node.id}>
            <div className="nav-row">
              {canCollapse && (
                <button
                  type="button"
                  className="nav-toggle"
                  aria-label={`${t(isCollapsed ? 'reader.expand' : 'reader.collapse')} ${node.text}`}
                  aria-expanded={!isCollapsed}
                  onClick={() => onToggle(node.id)}
                >
                  <ChevronRightIcon className="nav-caret" aria-hidden="true" data-open={!isCollapsed} />
                </button>
              )}
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
            </div>
            {node.children.length > 0 && !isCollapsed && (
              <Items
                nodes={node.children}
                active={active}
                onActive={onActive}
                collapsible={collapsible}
                collapsed={collapsed}
                onToggle={onToggle}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}
/** Scroll-spy. Headings can render after the TOC fills, so missing elements are awaited before observing. */
function useScrollSpy(headings: Heading[], onActive: (id: string) => void) {
  useEffect(() => {
    onActive('');
    let stop = observeHeadings(headings, onActive);
    const content = document.querySelector('[data-slot="reader-content"]');
    let mutations: MutationObserver | undefined;
    if (content && headings.some((h) => !document.getElementById(h.id))) {
      mutations = new MutationObserver(() => {
        if (!headings.every((h) => document.getElementById(h.id))) return;
        mutations?.disconnect();
        stop();
        stop = observeHeadings(headings, onActive);
      });
      mutations.observe(content, { childList: true, subtree: true });
    }
    return () => {
      mutations?.disconnect();
      stop();
    };
  }, [headings, onActive]);
}
export function TocPanel({ headings, filter = '' }: { headings: Heading[]; filter?: string }) {
  const t = useT();
  const [active, setActive] = useState('');
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const collapsible = useSettingsStore((s) => s.settings.general.outlineCollapsing);
  const nav = useRef<HTMLElement>(null);
  useScrollSpy(headings, setActive);
  useEffect(() => {
    if (!active) return;
    nav.current?.querySelector('[aria-current="location"]')?.scrollIntoView({ block: 'nearest' });
  }, [active]);
  const needle = filter.trim().toLowerCase();
  const nodes = useMemo(() => (needle ? filterNodes(buildToc(headings), needle) : buildToc(headings)), [headings, needle]);
  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  return (
    <nav aria-label="Table of contents" ref={nav}>
      {needle && nodes.length === 0 ? (
        <p className="text-sm">{t('reader.noMatches')}</p>
      ) : (
        <Items
          nodes={nodes}
          active={active}
          onActive={setActive}
          collapsible={collapsible && !needle}
          collapsed={collapsed}
          onToggle={toggle}
        />
      )}
    </nav>
  );
}
