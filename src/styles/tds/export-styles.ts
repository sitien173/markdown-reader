export const TDS_EXPORT_CSS = `:root {
  --font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-family-display: "Tobias", Georgia, "Times New Roman", serif;
  --font-family-mono: "SF Mono", "JetBrains Mono", "DM Mono", "Fira Code", monospace;
  --surface-neutral-01: #ffffff;
  --surface-neutral-02: #f4f6f4;
  --surface-neutral-03: #e8ede8;
  --surface-selected: #e6f8f4;
  --surface-intermediate: #fff4db;
  --surface-negative: #fff1f1;
  --surface-positive: #eaf7f0;
  --text-default: #172d2d;
  --text-description: #526660;
  --text-caption: #617269;
  --text-link: #006b5c;
  --border-subtle: #dde2de;
  --border-strong: #c5cec8;
  --border-divider: #e8ede8;
  --padding-xs: 4px;
  --padding-sm: 8px;
  --padding-md: 12px;
  --padding-lg: 16px;
  --padding-xl: 24px;
  --padding-2xl: 32px;
  --radius-md: 6px;
}
body {
  margin: 0;
  padding: var(--padding-2xl);
  background-color: var(--surface-neutral-01);
  color: var(--text-default);
  font-family: var(--font-family);
}
.tds-custom-markdown {
  color: var(--text-default);
  font-family: var(--font-family);
  line-height: 1.65;
  overflow: clip;
}
.tds-custom-markdown h1,
.tds-custom-markdown h2,
.tds-custom-markdown h3,
.tds-custom-markdown h4,
.tds-custom-markdown h5,
.tds-custom-markdown h6 {
  font-family: var(--font-family-display);
  scroll-margin-top: var(--padding-2xl);
}
.tds-custom-markdown pre,
.tds-custom-markdown .table-wrapper,
.tds-custom-markdown table {
  overflow: auto;
  max-width: 100%;
}
.tds-custom-markdown pre,
.tds-custom-markdown code {
  font-family: var(--font-family-mono);
}
.tds-custom-markdown pre {
  background: var(--surface-neutral-02);
  padding: var(--padding-lg);
}
.tds-custom-markdown a {
  color: var(--text-link);
}
.tds-custom-markdown blockquote {
  border-inline-start: 3px solid var(--border-strong);
  padding-inline-start: var(--padding-lg);
}
.tds-custom-markdown img {
  max-width: 100%;
}
.tds-custom-md-block {
  display: contents;
}
.tds-custom-markdown .markdown-alert {
  padding: var(--padding-md);
  margin-bottom: var(--padding-md);
  border-left: 4px solid var(--border-strong);
}
.tds-custom-markdown .markdown-alert-note { background-color: var(--surface-selected); }
.tds-custom-markdown .markdown-alert-warning { background-color: var(--surface-intermediate); }
.tds-custom-markdown .markdown-alert-caution { background-color: var(--surface-negative); }
.tds-custom-markdown .markdown-alert-tip { background-color: var(--surface-positive); }
@media print {
  body {
    padding: 0;
  }
  .tds-custom-markdown {
    overflow: visible;
  }
}
`;
