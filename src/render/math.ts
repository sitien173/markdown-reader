export async function enhanceMath(root: ParentNode): Promise<void> {
  if (!root.querySelector('.katex')) return;
  await import('katex/dist/katex.min.css');
}
