import markdownCss from '../styles/markdown.css?raw';

// Token values from globals.css that markdown.css reads; tests/unit/export.test.ts asserts they match it exactly.
const LIGHT = {
  '--background': '#ffffff',
  '--foreground': '#1d1d1f',
  '--primary': '#0066cc',
  '--muted': '#f5f5f7',
  '--muted-foreground': '#6e6e73',
  '--destructive': '#d70015',
  '--border': '#d9d9de',
  '--input': '#d2d2d7',
  '--ring': '#0066cc',
  '--alert-note-bg': '#eaf3fc',
  '--alert-warning': '#c77c00',
  '--alert-warning-bg': '#fff6e0',
  '--alert-warning-foreground': '#7a4b00',
  '--alert-caution-bg': '#fdeceb',
};
const DARK: typeof LIGHT = {
  '--background': '#1c1c1e',
  '--foreground': '#f5f5f7',
  '--primary': '#4da3ff',
  '--muted': '#2c2c2e',
  '--muted-foreground': '#a1a1a6',
  '--destructive': '#ff6961',
  '--border': '#3a3a3c',
  '--input': '#48484a',
  '--ring': '#4da3ff',
  '--alert-note-bg': '#12263a',
  '--alert-warning': '#f0a030',
  '--alert-warning-bg': '#3a2c0f',
  '--alert-warning-foreground': '#ffd27a',
  '--alert-caution-bg': '#3d1a1a',
};
export const EXPORT_TOKENS = { light: LIGHT, dark: DARK };
const declarations = (tokens: Record<string, string>, indent: string) =>
  Object.entries(tokens)
    .map(([name, value]) => `${indent}${name}: ${value};`)
    .join('\n');

// Standalone export CSS: both color schemes selected by prefers-color-scheme unless data-theme forces one, print forced light, plus the shared Markdown rules.
// Fonts are system stacks only; the exported file loads nothing remote.
export const EXPORT_CSS = `:root {
  color-scheme: light dark;
  --font-body: system-ui, -apple-system, "Inter", sans-serif;
  --font-code: ui-monospace, SFMono-Regular, Menlo, monospace;
  --radius: 0.75rem;
${declarations(LIGHT, '  ')}
}
@media (prefers-color-scheme: dark) {
  :root {
${declarations(DARK, '    ')}
  }
}
@media screen {
  :root[data-theme='light'] {
    color-scheme: light;
${declarations(LIGHT, '    ')}
  }
  :root[data-theme='dark'] {
    color-scheme: dark;
${declarations(DARK, '    ')}
  }
}
@media print {
  :root {
    color-scheme: light;
${declarations(LIGHT, '    ')}
  }
}
/* Appearance defaults; the export root overrides them inline with the stored values. */
:root {
  --md-scale: 1;
  --md-font: var(--font-body);
  --md-max-width: 56rem;
}
body {
  margin: 0;
  padding: 2rem;
  background-color: var(--background);
  color: var(--foreground);
  font-family: var(--font-body);
}
${markdownCss}
.md-diagram--dark {
  display: none;
}
@media screen and (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) .md-diagram--light {
    display: none;
  }
  :root:not([data-theme='light']) .md-diagram--dark {
    display: block;
  }
}
@media screen {
  :root[data-theme='dark'] .md-diagram--light {
    display: none;
  }
  :root[data-theme='dark'] .md-diagram--dark {
    display: block;
  }
}
@media print {
  body {
    padding: 0;
  }
}
`;
