# Markdown Reader v1 Design

**Status:** Confirmed 2026-11-04; UI stack revised and confirmed 2026-11-05
**Consultation:** skipped - user preferred coordinator solutions; consult job f4616e12-3cd7-4c39-8c2d-f3c8ac813b99 cancelled

## Purpose

A Chrome Manifest V3 extension that opens, renders, edits, and navigates Markdown from local files, local folders, and online URLs, fully offline, with a light-only Trulioo Design System (TDS) interface.

Core features:

1. Local and online Markdown: render `file://` and `http(s)` Markdown, opened files, opened folders, and pasted URLs.
2. Real-time rendering: a split editor with live preview, and auto-reload of opened local files when they change on disk.
3. TOC navigation: sidebar table of contents from multi-level headings, click to jump, scroll-spy.
4. Syntax highlighting for many languages.
5. Charts and formulas: Mermaid diagrams and KaTeX math.

Built-in plugins: GFM tables, task lists, strikethrough, and autolinks; emoji shortcodes; footnotes; GitHub alert callouts (`> [!NOTE]`); `==mark==`; abbreviations; sub and superscript; definition lists; math; Mermaid flowcharts, Gantt, sequence, and other Mermaid types.

Extra scope: editor drafts persisted and save-back to the opened local file; export to HTML and print-to-PDF; recent files list; open a local folder with a recursive Markdown file tree and live watch; Chrome Web Store preparation.

## Users and Success Criteria

Users: developers, writers, and educators who read or write Markdown in Chrome or Edge.

Success criteria:

| ID | Criterion |
|---|---|
| S1 | Navigating to a raw-text `.md` or `.markdown` URL on `file://` or `http(s)` shows the rendered reader view. |
| S2 | The reader opens a local file by button and by drag-and-drop, and opens any URL entered in the URL field. |
| S3 | In Split mode, a 100 KB document's preview updates within 100 ms of a keystroke. |
| S4 | A 1 MB document shows its first content in under 500 ms. Amended 2026-11-05 by the plan owner; the original full-render target was not reachable because DOM insertion and layout of 1 MB of HTML alone took 435 to 769 ms. |
| S5 | An opened local file or folder re-renders after an on-disk change without user action, unless the editor has unsaved changes. |
| S6 | The TOC lists all heading levels, jumps on click, and highlights the current section on scroll. |
| S7 | Every plugin in Purpose renders correctly against its unit fixture. |
| S8 | A plain document triggers no request for the Mermaid, KaTeX, or Shiki chunks. |
| S9 | With networking disabled, every local source renders with all features. |
| S10 | XSS fixtures produce no script execution and no event-handler attributes in the DOM. |
| S11 | `CHROMEWEBSTORE.md` contains listing copy, a justification for every permission, and the privacy disclosure. |

## Constraints, Invariants, and Non-Goals

Constraints:

- Target current stable Chrome and Edge, roughly Chrome 140 and later. Chromium only.
- Manifest V3. No `eval`, no `new Function`, no inline scripts.
- Fully offline: every library, font, and asset is bundled. No CDN at runtime.
- Prefer existing open-source libraries for each use case.
- UI is built in two layers. Behavior: shadcn/ui on React 19, keeping its Radix logic, keyboard handling, focus management, and ARIA. Look: TDS `tds-*` classes and semantic tokens, light theme only. Custom compositions follow the TDS RULE 6 `tds-custom-*` pattern and use semantic tokens only.
- Tailwind v4 utilities are allowed in authored markup for layout only: flex, grid, spacing, and sizing, with TDS token values such as `gap-(--gap-md) p-(--padding-xl)`. No Tailwind color, radius, shadow, or font utilities. This is a user-approved exception to TDS RULE 3, recorded 2026-11-05.
- Raw HTML in Markdown is allowed and sanitized with DOMPurify.

Invariants:

- One rendering path: every source passes through `render/pipeline.ts` then `render/enhance.ts`.
- Sanitization runs on every render before DOM insertion.
- The service worker keeps no state in global variables.
- Heavy libraries load only when the document needs them.
- React never reconciles inside the Markdown container. Rendered HTML is inserted through a ref, then `enhance()` runs on that node.

Non-goals:

- Dark mode. Dropped to comply with TDS RULE 1.
- Firefox and Safari.
- Encoding detection for non-UTF-8 files.
- Rendering in place inside the original tab.
- Cloud sync, collaboration, and accounts.

## Chosen Approach

Approach A: a single extension reader page renders everything. A content script on Markdown URLs hands raw text to `reader.html` and redirects the tab there. Read, Edit, Split, and Folder are modes of the same page.

Stack, verified on npm 2026-11-04:

| Use case | Library and version |
|---|---|
| Build | wxt 0.21.5, TypeScript |
| UI runtime | react 19.3.1, react-dom 19.3.1, @wxt-dev/module-react 1.2.2 |
| Styling | tailwindcss 4.3.4, @tailwindcss/vite 4.3.4, TDS component CSS and semantic tokens |
| Components | shadcn CLI 4.23.0; components copied into `src/components/ui/` with their dependencies, such as radix-ui 1.8.1, class-variance-authority 0.7.1, clsx 2.1.1, tailwind-merge 3.7.0 |
| Icons | lucide-react 1.68.0, the shadcn default. TDS search returned no icon set. |
| Parser | markdown-it 15.0.3 |
| Plugins | markdown-it-emoji 3.1.0, markdown-it-footnote 4.0.0, markdown-it-anchor 10.0.0, markdown-it-mark 4.0.0, markdown-it-abbr 2.0.0, markdown-it-sub 2.0.0, markdown-it-sup 2.0.0, markdown-it-deflist 4.0.0, markdown-it-task-lists 2.1.1, markdown-it-github-alerts 1.0.1 |
| Math | katex 0.19.1, @vscode/markdown-it-katex 1.1.2 |
| Diagrams | mermaid 12.3.0 |
| Highlighting | shiki 4.6.0 with @shikijs/engine-javascript 4.6.0, theme `github-light` |
| Sanitizing | dompurify 3.4.17 |
| Editor | codemirror 6.0.2, @codemirror/lang-markdown 6.5.2 |
| Handle storage | idb-keyval 6.3.0 |
| Font | @fontsource/inter 5.3.0 |
| Tests | Vitest, happy-dom, Playwright |

Versions for Vitest, happy-dom, and Playwright are pinned at plan time. UI runtime, styling, and component versions verified on npm 2026-11-05.

Rejected alternatives:

- B, render in place: `raw.githubusercontent.com` sends `content-security-policy: default-src 'none'; style-src 'unsafe-inline'; sandbox`, which blocks bundled fonts and images; editor and folder modes still need a reader page.
- Plain DOM UI, the 2026-11-04 choice: replaced on 2026-11-05 to get shadcn/ui focus management, keyboard handling, and ARIA for menus, dialogs, tabs, and the segmented control.
- C, all-in-one editor such as Vditor 4.0.1 or Cherry Markdown 0.11.12: ships its own class names and dark themes against TDS RULE 3, Vditor loads sub-libraries from a CDN by default, and neither provides folder watch or File System Access save-back.

## Architecture and Data Flow

Extension surfaces:

| Surface | Role |
|---|---|
| `content/detect.ts` | Matches `file://` and `http(s)` URLs ending in `.md` or `.markdown`. If `document.contentType` is `text/plain` or `text/markdown`, stores `{url, text}` in `chrome.storage.session` and redirects to `reader.html?src=<url>`. Otherwise does nothing. |
| `background.ts` | Handles popup and context menu messages and opens reader tabs. No state in variables. |
| `popup.html` | React app. TDS buttons: Open viewer, Open editor, Render current tab, Recent files. |
| `reader.html` | Single React app page with modes Read, Edit, Split, and Folder. |

Reader modules:

- `render/pipeline.ts`: pure function from Markdown text and base URL to sanitized HTML plus heading data. markdown-it with plugins, then DOMPurify.
- `render/enhance.ts`: post-render pass. Finds code, math, and Mermaid nodes and lazy-imports Shiki, KaTeX CSS, and Mermaid only when present. Caches results by block content hash.
- `source/`: interface `Source { read(): Promise<string>; watch(onChange): Unsubscribe; write?(text) }` with implementations:
  - `UrlSource`: fetch and re-fetch.
  - `FileUrlSource`: read and poll a `file://` URL.
  - `FileHandleSource`: `FileSystemFileHandle`; watch with `FileSystemObserver`, else poll `lastModified` every second; write-back.
  - `DirectorySource`: walk a `FileSystemDirectoryHandle` into a tree; watch for adds, removes, and renames.
- `toc/`: sidebar from heading data; scroll-spy with `IntersectionObserver`.
- `store/`: drafts and recent URLs in `chrome.storage.local`; file and folder handles in IndexedDB via idb-keyval.
- `export/`: standalone HTML with inlined CSS; PDF via `window.print()` and a print stylesheet.
- `ui/`: React components for the shell, TOC panel, file tree, and dialogs. `ui/markdown-view.tsx` owns the Markdown container: it sets sanitized HTML through a ref and calls `enhance()` in an effect.
- `components/ui/`: shadcn components restyled with TDS classes.
- `editor/`: CodeMirror mounted imperatively into a ref.

Data flow:

1. Entry point to `Source` to text.
2. Text to `pipeline` to HTML, DOM swap, `enhance`, TOC update.
3. Edit or Split: CodeMirror change, debounce on `requestAnimationFrame`, step 2. The preview update bypasses React state, so typing does not re-render the shell. Draft saved after 1 s idle.
4. Watch event: `read()`, step 2, scroll position kept.
5. Relative links to `.md` inside a folder or URL source open in the reader. Relative images in Folder mode resolve to object URLs from the directory handle. A `<base>` element preserves URL-relative resolution.

Permissions: `storage`, `contextMenus`, `tabs`; host permission `<all_urls>`; user-enabled file URL access.

UI, shadcn behavior with TDS look:

| Need | shadcn component | TDS look |
|---|---|---|
| Mode switch | `toggle-group` | `tds-segmented-control` |
| URL field | `input` | `tds-text-input`, `tds-text-input__field`, `tds-field-label` |
| Open file, Open folder, Export, Recent | `button` with `size="icon"` | `tds-icon-btn` |
| Popup and dialog actions | `button` | `tds-btn`; `default` to `--primary`, `secondary` and `outline` to `--secondary`, `destructive` to `--danger`, `ghost` to `--invisible`; sizes `sm`, `default`, `lg` to `--sm`, `--md`, `--lg` |
| Recent and Export menus | `dropdown-menu` | `tds-button-menu`, `tds-dropdown-panel`, `tds-action-list-item` |
| Sidebar Contents and Files | `tabs` | `tds-tabs`, `tds-tab-item` |
| TOC and file tree entries | none; tree nodes use `collapsible` | `tds-nav-list`, `tds-side-nav__nav-item`, `tds-caret` |
| Errors | `alert` | `tds-announcement` |
| Loading | `spinner` | `tds-spinner` |
| File-access guide, save conflict | `dialog` | `tds-dialog`, `__header`, `__body`, `__footer` |
| Icon-button labels | `tooltip` | `tds-tooltip` |

Token bridge in `src/styles/globals.css`: TDS token definitions load first, then shadcn variables point at TDS semantic tokens.

| shadcn | TDS |
|---|---|
| `--background`, `--card`, `--popover` | `--surface-neutral-01` |
| `--foreground`, `--card-foreground`, `--popover-foreground`, `--secondary-foreground`, `--accent-foreground` | `--text-default` |
| `--primary` | `--interactive-default` |
| `--primary-foreground` | `--text-inverse` |
| `--secondary`, `--muted` | `--surface-neutral-02` |
| `--muted-foreground` | `--text-description` |
| `--accent` | `--surface-hover` |
| `--destructive` | `--border-negative` |
| `--border` | `--border-subtle` |
| `--input` | `--border-strong` |
| `--ring` | `--border-focus` |

Bridge rules:

- `@theme inline` sets `--font-sans: var(--font-family);`.
- No `.dark` block and no `@custom-variant dark`.
- `@theme` sets `--color-*: initial;` so Tailwind's palette cannot shadow TDS core tokens such as `--color-neutral-100`.
- `--radius` is not bridged to `--radius-card`, which would form a cycle through shadcn's `--radius-lg: var(--radius)`. Component radii come from TDS component CSS.
- TDS component CSS is saved under `src/styles/tds/` and imported with `layer(components)` so layout utilities can override it.
- The TDS loader strips `@import`, so shared atoms `field-label`, `field-caption`, `field-validation`, and `dropdown-panel` are fetched separately.

Content styling:

- `markdown.css` is plain CSS, not Tailwind utilities, so export can inline it.
- `markdown.css` scoped under `.tds-custom-markdown`, semantic tokens only. Headings use `--font-family-display`; code uses `--font-family-mono` on `--surface-neutral-02`.
- Plugin-generated classes are styled under the scoped container. Alerts map NOTE to `--surface-selected`, WARNING to `--surface-intermediate`, CAUTION to `--surface-negative`, TIP to `--surface-positive`.
- Shiki colors come from the `github-light` theme file.
- Mermaid uses `theme: 'base'` with `themeVariables` read at runtime from computed TDS custom properties.
- KaTeX uses its bundled CSS and fonts.
- Inter bundled. Tobias falls back to Georgia per `--font-family-display`; licensed Tobias files may be added later. Mono falls back to the system monospace font.

## Errors and Edge Cases

| Case | Behavior |
|---|---|
| File URL access disabled | Popup "Render current tab" checks `chrome.extension.isAllowedFileSchemeAccess()` and shows a `tds-dialog` with enable steps. |
| `.md` URL serves HTML | Content script does nothing. |
| Fetch fails | `tds-announcement` with status, URL, and Retry. |
| Offline | Rendering works; URL fetches fail as above. |
| Watched file deleted | Announcement "File no longer exists"; last render kept; watch stops. |
| Handle permission lost after restart | Recent entry shows Reconnect; click calls `requestPermission()`. |
| Save-back conflict | Compare `lastModified` before write; dialog offers Overwrite, Reload from disk, Cancel. |
| Dirty editor and disk change | No auto-reload; announcement offers Reload. |
| Invalid Mermaid or KaTeX | Inline error with source for that block; rest renders. |
| File over 5 MB | Renders; Shiki skipped for blocks over 200 KB. |
| Malicious HTML | DOMPurify strips scripts, handlers, `javascript:` URLs; links get `rel="noopener"`. |
| Relative link outside opened folder | Resolves against source URL; unresolvable links shown disabled. |
| Non-UTF-8 file | Decoded as UTF-8 with replacement characters. |

## Migration

n/a. New repository with no prior release or data.

## Testing

| Layer | Tool | Covers |
|---|---|---|
| Unit | Vitest, happy-dom | Plugin output, sanitizer XSS fixtures, heading and TOC data, relative link rewriting, source watchers with fake handles, stores with mocked `chrome.storage` |
| Extension E2E | Playwright launching Chromium with `--load-extension=.output/chrome-mv3` | Raw `.md` redirect, URL fetch from a local test server, `file://` auto-reload, split editor live update, TOC jump and scroll-spy, lazy chunk loading, export, popup |
| Performance | Playwright timing | S3, S4, S8 |
| Phase 1 spikes | Playwright | The three unverified points under Risks |

Native pickers and save-back cannot be driven by Playwright. They are unit-tested with fake handles and covered by a manual checklist in the README.

User-approved exception to CLAUDE.md section 11: automated E2E launches its own Chromium to load the unpacked build. Interactive manual checks use Brave attach mode.

## Risks and Open Questions

Unverified, to be proven by Phase 1 spikes:

1. A `chrome-extension://` page can `fetch()` a `file://` URL when file URL access is enabled. Fallback: content script passes `document.body.textContent`; auto-reload for `file://` navigations is then limited.
2. `FileSystemObserver` is available in stable Chrome. Fallback: poll `getFile().lastModified` every second.
3. Mermaid 12.3.0 runs under the default MV3 extension page CSP.

Risks:

- Chrome Web Store review of `<all_urls>`. Mitigation: specific justification in `CHROMEWEBSTORE.md`.
- File URL access requires a manual user toggle; first-run guidance mitigates.
- Bundle size from Mermaid and Shiki grammars. Mitigation: lazy chunks and per-language grammar loading.
- Library output colors from Shiki themes are outside TDS tokens.
- Tobias font licensing; fallback is Georgia.
- Name collisions between TDS core tokens and Tailwind or shadcn variables, such as `--color-neutral-100` and `--radius-md`. Mitigation: bridge rules above, and Phase 1 asserts computed values in E2E.
- React, Radix, and Tailwind add reader bundle weight. Mitigation: Mermaid, KaTeX, and Shiki stay lazy; S3 and S4 gates unchanged.
- shadcn markup inside `tds-*` classes may need structural changes where Radix and TDS DOM differ, such as dropdown panels. Mitigation: keep Radix behavior, adapt class placement, check rendered output per component.
