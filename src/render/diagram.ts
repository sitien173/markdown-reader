import { createBlockCache } from './cache';
import { EXPORT_TOKENS } from '../export/export-styles';

const diagramCache = createBlockCache<{ id: string; svg: string }>(200);
export type ThemeVariables = Record<string, string | boolean>;
type Mermaid = typeof import('mermaid')['default'];
const TOKENS: [string, string][] = [
  ['primaryColor', '--muted'],
  ['primaryTextColor', '--foreground'],
  ['primaryBorderColor', '--input'],
  ['lineColor', '--muted-foreground'],
  ['background', '--background'],
];
// Bumped by every theme rerender; a render that started under an earlier value is stale.
let themeEpoch = 0;

export function mermaidThemeVariables(read: (token: string) => string, dark: boolean): ThemeVariables {
  const colors = TOKENS.map(([key, token]) => [key, read(token).trim()] as const).filter(([, value]) => value);
  return { ...Object.fromEntries(colors), darkMode: dark };
}
function lightThemeVariables(): ThemeVariables {
  return mermaidThemeVariables((token) => EXPORT_TOKENS.light[token as keyof typeof EXPORT_TOKENS.light] ?? '', false);
}
const isDark = () => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
function currentThemeVariables(): ThemeVariables {
  const style = getComputedStyle(document.documentElement);
  return mermaidThemeVariables((token) => style.getPropertyValue(token), isDark());
}
const discardTemporaryNodes = (id: string) => {
  document.getElementById(`d${id}`)?.remove();
  document.getElementById(id)?.remove();
};
// Mermaid config is global, so initialize and render run as one queued step; live, print and export renders cannot mix themes.
let renderQueue: Promise<unknown> = Promise.resolve();
export function renderDiagramSvg(mermaid: Mermaid, source: string, themeVariables: ThemeVariables, id: string): Promise<string> {
  const run = async () => {
    mermaid.initialize({ theme: 'base', securityLevel: 'strict', startOnLoad: false, suppressErrorRendering: true, themeVariables });
    try {
      return (await mermaid.render(id, source)).svg;
    } finally {
      discardTemporaryNodes(id);
    }
  };
  const result = renderQueue.then(run, run);
  renderQueue = result.catch(() => {});
  return result;
}
// Renders with the theme at call time. Returns undefined when the theme changed meanwhile, so the result is dropped.
async function renderForCurrentTheme(mermaid: Mermaid, source: string, index: number, light = false): Promise<string | undefined> {
  const epoch = themeEpoch;
  const themeVariables = light ? lightThemeVariables() : currentThemeVariables();
  const keyTheme = JSON.stringify(themeVariables);
  const id = `markdown-diagram-${index}-${Math.random().toString(36).slice(2)}`;
  const cached = diagramCache.get('mermaid', keyTheme, source);
  if (cached) return cached.svg.replaceAll(cached.id, id);
  const svg = await renderDiagramSvg(mermaid, source, themeVariables, id);
  if (epoch !== themeEpoch) return undefined;
  diagramCache.set('mermaid', keyTheme, source, { id, svg });
  return svg;
}
function parseSvg(svg: string): SVGElement {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = svg;
  const svgNode = wrapper.querySelector('svg');
  if (!svgNode) throw new Error('Diagram did not produce SVG');
  return svgNode;
}
function diagramCopy(kind: 'screen' | 'print', svg: string): HTMLElement {
  const copy = document.createElement('div');
  copy.className = `md-diagram-${kind}`;
  copy.append(parseSvg(svg));
  return copy;
}
async function renderScreenCopy(mermaid: Mermaid, source: string, index: number): Promise<HTMLElement | undefined> {
  const svg = await renderForCurrentTheme(mermaid, source, index);
  return svg === undefined ? undefined : diagramCopy('screen', svg);
}
// Mermaid bakes colors into the SVG, so in a dark scheme a second light render is kept for print; markdown.css swaps them under @media print.
// It runs after every screen copy is on the page, so the extra render never delays what the reader sees.
async function addPrintCopies(mermaid: Mermaid, placed: { diagram: HTMLElement; source: string }[], signal?: AbortSignal): Promise<void> {
  for (const [index, { diagram, source }] of placed.entries()) {
    if (signal?.aborted || !isDark()) return;
    try {
      const svg = await renderForCurrentTheme(mermaid, source, index, true);
      // Dropped when the theme changed meanwhile or a rerender already gave this diagram a print copy.
      if (svg === undefined || signal?.aborted || !diagram.isConnected || diagram.querySelector('.md-diagram-print')) continue;
      diagram.append(diagramCopy('print', svg));
    } catch {
      // Without a print copy the screen copy prints.
    }
  }
}

export async function enhanceDiagrams(root: ParentNode, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted || !('isConnected' in root) || !(root as Node).isConnected) return;
  const blocks = Array.from(root.querySelectorAll<HTMLElement>('pre.mermaid'));
  if (!blocks.length) return;
  const { default: mermaid } = await import('mermaid');
  if (signal?.aborted || !(root as Node).isConnected) return;
  const placed: { diagram: HTMLElement; source: string }[] = [];
  for (const [index, block] of blocks.entries()) {
    if (signal?.aborted || !(root as Node).isConnected) return;
    const source = block.textContent ?? '';
    try {
      let screen: HTMLElement | undefined;
      while (screen === undefined) {
        screen = await renderScreenCopy(mermaid, source, index);
        if (signal?.aborted || !(root as Node).isConnected) return;
      }
      const diagram = document.createElement('div');
      diagram.className = 'md-diagram';
      diagram.setAttribute('data-md-diagram', source);
      diagram.append(screen);
      block.replaceWith(diagram);
      placed.push({ diagram, source });
    } catch (error) {
      const failure = document.createElement('div');
      failure.className = 'markdown-enhance-error';
      failure.setAttribute('role', 'alert');
      failure.textContent = `Diagram error: ${error instanceof Error ? error.message : 'Unable to render diagram'}\n${source}`;
      block.replaceWith(failure);
    }
  }
  await addPrintCopies(mermaid, placed, signal);
}

// Rerenders only the diagrams already on the page, from the source kept on each wrapper.
export async function rerenderDiagrams(root: ParentNode, signal?: AbortSignal): Promise<void> {
  const epoch = ++themeEpoch;
  const diagrams = Array.from(root.querySelectorAll<HTMLElement>('[data-md-diagram]'));
  if (!diagrams.length) return;
  const { default: mermaid } = await import('mermaid');
  const placed: { diagram: HTMLElement; source: string }[] = [];
  for (const [index, diagram] of diagrams.entries()) {
    if (signal?.aborted || epoch !== themeEpoch) return;
    const source = diagram.getAttribute('data-md-diagram') ?? '';
    try {
      const screen = await renderScreenCopy(mermaid, source, index);
      if (screen === undefined || signal?.aborted || epoch !== themeEpoch) return;
      if (diagram.isConnected) {
        // The light print copy does not depend on the scheme, so it stays; a light scheme prints its screen copy.
        const previous = diagram.querySelector('.md-diagram-screen');
        if (previous) previous.replaceWith(screen);
        else diagram.prepend(screen);
        if (!isDark()) diagram.querySelector('.md-diagram-print')?.remove();
        placed.push({ diagram, source });
      }
    } catch {
      // Keep the previous render when the new theme cannot be drawn.
    }
  }
  await addPrintCopies(mermaid, placed, signal);
}
