import { createBlockCache } from './cache';

const diagramCache = createBlockCache<{ id: string; svg: string }>(200);
type ThemeVariables = Record<string, string>;
export async function enhanceDiagrams(root: ParentNode, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted || !('isConnected' in root) || !(root as Node).isConnected) return;
  const blocks = Array.from(root.querySelectorAll<HTMLElement>('pre.mermaid'));
  if (!blocks.length) return;
  const { default: mermaid } = await import('mermaid');
  if (signal?.aborted || !(root as Node).isConnected) return;
  const style = getComputedStyle(document.documentElement);
  const entries: [string, string][] = [
    ['primaryColor', '--surface-selected'], ['primaryTextColor', '--text-default'], ['primaryBorderColor', '--border-subtle'],
    ['lineColor', '--text-description'], ['background', '--surface-neutral-01'],
  ];
  const themeVariables: ThemeVariables = Object.fromEntries(entries.map(([key, token]) => [key, style.getPropertyValue(token).trim()]).filter(([, value]) => value));
  mermaid.initialize({ theme: 'base', securityLevel: 'strict', startOnLoad: false, suppressErrorRendering: true, themeVariables });
  for (const [index, block] of blocks.entries()) {
    if (signal?.aborted || !(root as Node).isConnected) return;
    const source = block.textContent ?? '';
    const id = `markdown-diagram-${index}-${Math.random().toString(36).slice(2)}`;
    try {
      const keyTheme = JSON.stringify(themeVariables);
      const cachedSvg = diagramCache.get('mermaid', keyTheme, source);
      const rendered = cachedSvg ?? { id, svg: (await mermaid.render(id, source)).svg };
      if (signal?.aborted || !(root as Node).isConnected) { document.getElementById(`d${id}`)?.remove(); document.getElementById(id)?.remove(); return; }
      if (cachedSvg === undefined) diagramCache.set('mermaid', keyTheme, source, rendered);
      const output = cachedSvg ? rendered.svg.replaceAll(rendered.id, id) : rendered.svg;
      const wrapper = document.createElement('div');
      wrapper.innerHTML = output;
      const svgNode = wrapper.querySelector('svg');
      if (!svgNode) throw new Error('Diagram did not produce SVG');
      block.replaceWith(svgNode);
    } catch (error) {
      document.getElementById(`d${id}`)?.remove();
      document.getElementById(id)?.remove();
      const failure = document.createElement('div');
      failure.className = 'markdown-enhance-error';
      failure.setAttribute('role', 'alert');
      failure.textContent = `Diagram error: ${error instanceof Error ? error.message : 'Unable to render diagram'}\n${source}`;
      block.replaceWith(failure);
    }
  }
}
