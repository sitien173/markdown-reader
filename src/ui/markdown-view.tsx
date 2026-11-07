import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import { createParseState, planBlocks, planPrefix, type Heading } from '../render/pipeline';
import { enhance } from '../render/enhance';
import { rerenderDiagrams } from '../render/diagram';
import type { DirectorySource } from '../source/directory';
import { resolveFolderLinks, resolveFolderImages } from '../render/links';

export type MarkdownViewHandle = {
  update(text: string): void;
  ready(): Promise<void>;
};
type MountedBlock = { key: string; el: HTMLElement };
// Documents with more new blocks than this mount in timer chunks; the first chunk is sized to fill the viewport.
const PROGRESSIVE_BLOCKS = 40;
const FIRST_CHUNK_CHARS = 24 * 1024;
const CHUNK_CHARS = 128 * 1024;
// A document above PREFIX_TRIGGER_CHARS shows its first PREFIX_CHARS (cut at a safe block boundary) before the full parse.
const PREFIX_TRIGGER_CHARS = 64 * 1024;
const PREFIX_CHARS = 24 * 1024;
const PREFIX_KEY = 'prefix';

export const MarkdownView = forwardRef<
  MarkdownViewHandle,
  {
    text: string;
    baseUrl: string;
    onHeadings?: (headings: Heading[]) => void;
    directorySource?: DirectorySource | null;
    docPath?: string | null;
  }
>(function MarkdownView({ text, baseUrl, onHeadings, directorySource, docPath }, handle) {
  const container = useRef<HTMLDivElement>(null);
  const baseRef = useRef(baseUrl);
  baseRef.current = baseUrl;
  const dirRef = useRef(directorySource);
  dirRef.current = directorySource;
  const prevDirRef = useRef(directorySource);
  const usedSourcesRef = useRef(new Set<DirectorySource>());
  if (directorySource) {
    usedSourcesRef.current.add(directorySource);
  }
  const cachedSourceRef = useRef<DirectorySource | null | undefined>(directorySource);
  const docPathRef = useRef(docPath);
  docPathRef.current = docPath;
  const headingsRef = useRef(onHeadings);
  headingsRef.current = onHeadings;
  const lastHeadings = useRef('');
  const frame = useRef(0);
  const pending = useRef<string | null>(null);
  const controller = useRef(new AbortController());
  const cache = useRef(new Map<string, string>());
  const parseState = useRef(createParseState());
  const docIdentity = directorySource ? `${directorySource.identity}:${docPath ?? ''}` : baseUrl;
  const cachedDocId = useRef(docIdentity);
  const mounted = useRef<MountedBlock[]>([]);
  const renderGen = useRef(0);
  const genUrlsRef = useRef<Map<number, { source: DirectorySource; urls: Set<string> }>>(new Map());
  const imageAbortRef = useRef<AbortController | null>(null);
  const unmountedRef = useRef(false);
  const chunkTimer = useRef(0);
  const mountedComplete = useRef(true);
  const activeEnhancers = useRef<Set<Promise<unknown>>>(new Set());
  const activeImageResolutions = useRef<Set<Promise<unknown>>>(new Set());
  const renderCompleteResolvers = useRef<Array<() => void>>([]);

  const notifyRenderComplete = useCallback(() => {
    mountedComplete.current = true;
    performance.mark('md-render-complete');
    const waiting = renderCompleteResolvers.current.slice();
    renderCompleteResolvers.current = [];
    for (const r of waiting) r();
  }, []);

  const trackEnhance = useCallback((target: HTMLElement) => {
    const p = enhance(target, controller.current.signal);
    activeEnhancers.current.add(p);
    p.finally(() => {
      activeEnhancers.current.delete(p);
    });
  }, []);

  const paint = useCallback(
    (value: string) => {
      const el = container.current;
      if (!el) return;
      const isFolder = Boolean(dirRef.current);
      const currentDocId = dirRef.current ? `${dirRef.current.identity}:${docPathRef.current ?? ''}` : baseRef.current;
      if (cachedSourceRef.current !== dirRef.current || cachedDocId.current !== currentDocId) {
        cachedSourceRef.current = dirRef.current;
        cachedDocId.current = currentDocId;
        cache.current.clear();
        mounted.current = [];
        el.replaceChildren();
      }
      const scroller = el.closest<HTMLElement>('[data-slot="reader-content"]') ?? el.parentElement;
      const scrollTop = scroller?.scrollTop ?? 0;
      const owningSource = dirRef.current;
      performance.mark('md-render-start');

      const mountRange = (
        source: { keys: string[]; html(index: number): string },
        end: number,
        from: number,
        budget: number,
        insertBefore: HTMLElement | null,
        targetGen: number,
        activeImgController: AbortController,
      ) => {
        const inserted: MountedBlock[] = [];
        let bytes = 0;
        let index = from;
        while (index < end && bytes < budget) {
          const html = source.html(index);
          bytes += html.length;
          const block = document.createElement('div');
          block.className = 'md-block';
          block.innerHTML = html;
          if (owningSource) {
            const anchors = block.querySelectorAll('a[href]');
            for (const a of anchors) {
              resolveFolderLinks(a, docPathRef.current ?? '', baseRef.current);
            }
            const imgPromise = resolveFolderImages(
              block,
              owningSource,
              docPathRef.current ?? '',
              baseRef.current,
              activeImgController.signal,
              (url) => {
                if (unmountedRef.current || targetGen !== renderGen.current) {
                  owningSource.revokeUrl(url);
                  return;
                }
                const record = genUrlsRef.current.get(targetGen);
                if (record) {
                  record.urls.add(url);
                } else {
                  owningSource.revokeUrl(url);
                }
              },
            );
            activeImageResolutions.current.add(imgPromise);
            imgPromise.finally(() => {
              activeImageResolutions.current.delete(imgPromise);
            });
          }
          el.insertBefore(block, insertBefore);
          inserted.push({ key: source.keys[index]!, el: block });
          index++;
        }
        return { inserted, next: index };
      };

      const renderFull = (source: string) => {
        const gen = ++renderGen.current;
        imageAbortRef.current?.abort();
        const imgController = new AbortController();
        imageAbortRef.current = imgController;
        if (owningSource) {
          genUrlsRef.current.set(gen, { source: owningSource, urls: new Set<string>() });
          // Clean up older generation URLs whose blocks are no longer displayed (including prefix)
          for (const [g, rec] of genUrlsRef.current.entries()) {
            if (g < gen) {
              for (const u of rec.urls) {
                rec.source.revokeUrl(u);
              }
              genUrlsRef.current.delete(g);
            }
          }
        }
        window.clearTimeout(chunkTimer.current);
        chunkTimer.current = 0;

        const activeCache = isFolder ? new Map<string, string>() : cache.current;
        const plan = planBlocks(source, baseRef.current, activeCache, parseState.current);
        const keys = plan.keys;

        // Patch blocks: for folder documents, disable incremental reuse so no stale blob URLs are retained.
        // A partly mounted document is reused by prefix only, because its tail is not in the DOM yet.
        const old = mounted.current;
        let prefix = 0;
        let suffix = 0;
        if (!isFolder) {
          while (prefix < old.length && prefix < keys.length && old[prefix]!.key === keys[prefix]) prefix++;
          if (mountedComplete.current) {
            while (
              suffix < old.length - prefix &&
              suffix < keys.length - prefix &&
              old[old.length - 1 - suffix]!.key === keys[keys.length - 1 - suffix]
            )
              suffix++;
          }
        }
        // A large change mounts progressively: the unchanged tail is re-mounted in order so the DOM stays a prefix of the document.
        const progressive = keys.length - prefix - suffix > PROGRESSIVE_BLOCKS;
        if (progressive) suffix = 0;
        const end = keys.length - suffix;
        const kept = old.slice(0, prefix);
        const tail = old.slice(old.length - suffix);
        const before = tail[0]?.el ?? null;
        for (const stale of old.slice(prefix, old.length - suffix)) stale.el.remove();

        // The first chunk fills the viewport; later chunks are mounted from timers and abandoned when the source generation changes.
        const first = mountRange(plan, end, prefix, progressive ? FIRST_CHUNK_CHARS : Infinity, before, gen, imgController);
        mounted.current = [...kept, ...first.inserted, ...tail];
        mountedComplete.current = first.next >= end;
        const continueMount = (from: number) => {
          chunkTimer.current = window.setTimeout(() => {
            chunkTimer.current = 0;
            if (gen !== renderGen.current || unmountedRef.current) return;
            const next = mountRange(plan, end, from, CHUNK_CHARS, null, gen, imgController);
            mounted.current.push(...next.inserted);
            for (const block of next.inserted) trackEnhance(block.el);
            if (next.next < end) {
              continueMount(next.next);
            } else {
              notifyRenderComplete();
            }
          }, 0);
        };
        if (!mountedComplete.current) continueMount(first.next);

        // Report headings only when they change, so typing in a paragraph does not re-render the shell.
        const headingKey = JSON.stringify(plan.headings);
        if (headingKey !== lastHeadings.current) {
          lastHeadings.current = headingKey;
          headingsRef.current?.(plan.headings);
        }
        if (scroller) scroller.scrollTop = scrollTop;
        for (const block of first.inserted) trackEnhance(block.el);
        performance.mark('md-render-end');
        performance.measure('md-render', 'md-render-start', 'md-render-end');
        requestAnimationFrame(() => performance.mark('md-first-visible'));
        if (mountedComplete.current) notifyRenderComplete();
      };

      // A large document opened fresh shows its first part before the full parse. The full render then replaces it, and it is skipped if the source changed.
      const head =
        mounted.current.length === 0 && value.length > PREFIX_TRIGGER_CHARS ? planPrefix(value, baseRef.current, PREFIX_CHARS) : null;
      if (!head) {
        renderFull(value);
        return;
      }
      const prefixGen = ++renderGen.current;
      imageAbortRef.current?.abort();
      const prefixImgController = new AbortController();
      imageAbortRef.current = prefixImgController;
      if (owningSource) {
        genUrlsRef.current.set(prefixGen, { source: owningSource, urls: new Set<string>() });
      }
      window.clearTimeout(chunkTimer.current);
      chunkTimer.current = 0;

      el.replaceChildren();
      const shown = mountRange({ keys: [PREFIX_KEY], html: () => head.html }, 1, 0, Infinity, null, prefixGen, prefixImgController);
      mounted.current = shown.inserted;
      mountedComplete.current = false;
      if (scroller) scroller.scrollTop = scrollTop;
      performance.mark('md-render-end');
      // Queue the full render from the frame callback so the prefix paints before the long parse starts.
      requestAnimationFrame(() => {
        performance.mark('md-first-visible');
        if (prefixGen !== renderGen.current || unmountedRef.current) return;
        chunkTimer.current = window.setTimeout(() => {
          chunkTimer.current = 0;
          if (prefixGen !== renderGen.current || unmountedRef.current) return;
          renderFull(value);
        }, 0);
      });
    },
    [notifyRenderComplete, trackEnhance],
  );

  useImperativeHandle(
    handle,
    () => ({
      update(value: string) {
        pending.current = value;
        if (frame.current) return;
        frame.current = requestAnimationFrame(() => {
          frame.current = 0;
          const latest = pending.current;
          pending.current = null;
          if (latest !== null) paint(latest);
        });
      },
      async ready(): Promise<void> {
        if (frame.current) {
          cancelAnimationFrame(frame.current);
          frame.current = 0;
          const latest = pending.current;
          pending.current = null;
          if (latest !== null) paint(latest);
        }
        if (!mountedComplete.current) {
          await new Promise<void>((resolve) => {
            renderCompleteResolvers.current.push(resolve);
          });
        }
        while (activeImageResolutions.current.size > 0) {
          await Promise.all(Array.from(activeImageResolutions.current).map((p) => p.catch(() => {})));
        }
        while (activeEnhancers.current.size > 0) {
          await Promise.all(Array.from(activeEnhancers.current).map((p) => p.catch(() => {})));
        }
      },
    }),
    [paint],
  );

  // baseUrl and docPath only trigger the repaint; paint reads them through baseRef and docPathRef.
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional re-run triggers
  useEffect(() => {
    if (prevDirRef.current !== directorySource) {
      imageAbortRef.current?.abort();
      activeImageResolutions.current.clear();
      prevDirRef.current?.revokeObjectUrls();
      for (const [, rec] of genUrlsRef.current.entries()) {
        for (const u of rec.urls) {
          rec.source.revokeUrl(u);
        }
      }
      genUrlsRef.current.clear();
      prevDirRef.current = directorySource;
    }
    paint(text);
  }, [text, baseUrl, docPath, directorySource, paint]);

  // A system theme change redraws only the diagrams; Shiki and KaTeX switch by CSS alone.
  useEffect(() => {
    const query = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!query) return;
    const onChange = () => {
      const el = container.current;
      if (!el) return;
      const p = rerenderDiagrams(el, controller.current.signal);
      activeEnhancers.current.add(p);
      p.finally(() => {
        activeEnhancers.current.delete(p);
      });
    };
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    unmountedRef.current = false;
    if (controller.current.signal.aborted) controller.current = new AbortController();
    const enhanceAbort = controller.current;
    return () => {
      unmountedRef.current = true;
      cancelAnimationFrame(frame.current);
      window.clearTimeout(chunkTimer.current);
      imageAbortRef.current?.abort();
      activeImageResolutions.current.clear();
      enhanceAbort.abort();
      for (const src of usedSourcesRef.current) {
        src.revokeObjectUrls();
      }
    };
  }, []);

  return <div ref={container} data-slot="markdown" className="md-content" />;
});
