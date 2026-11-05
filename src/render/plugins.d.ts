declare module 'markdown-it-emoji' {
  import type MarkdownIt from 'markdown-it';
  const emoji: (md: MarkdownIt, options?: unknown) => void;
  export const full: typeof emoji;
  export const bare: typeof emoji;
  export const light: typeof emoji;
  export default emoji;
}
declare module 'markdown-it-footnote' {
  import type MarkdownIt from 'markdown-it';
  const plugin: (md: MarkdownIt, options?: unknown) => void;
  export default plugin;
}
declare module 'markdown-it-mark' { import type MarkdownIt from 'markdown-it'; const plugin: (md: MarkdownIt) => void; export default plugin; }
declare module 'markdown-it-abbr' { import type MarkdownIt from 'markdown-it'; const plugin: (md: MarkdownIt) => void; export default plugin; }
declare module 'markdown-it-sub' { import type MarkdownIt from 'markdown-it'; const plugin: (md: MarkdownIt) => void; export default plugin; }
declare module 'markdown-it-sup' { import type MarkdownIt from 'markdown-it'; const plugin: (md: MarkdownIt) => void; export default plugin; }
declare module 'markdown-it-deflist' { import type MarkdownIt from 'markdown-it'; const plugin: (md: MarkdownIt) => void; export default plugin; }
declare module 'markdown-it-task-lists' { import type MarkdownIt from 'markdown-it'; const plugin: (md: MarkdownIt, options?: { enabled?: boolean; label?: boolean }) => void; export default plugin; }
