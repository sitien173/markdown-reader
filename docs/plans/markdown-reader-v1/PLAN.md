# Markdown Reader v1 Plan

**Design:** [DESIGN.md](DESIGN.md)
**Context key:** `markdown-reader-v1`
**Base:** `refs/plans/markdown-reader-v1/base` (`ad1fd7009269ecbb36829309eca633164b611f55`)
**Commit:** `feat(extension): markdown reader v1 with live preview, TOC, diagrams, and math`

## Outcome & Scope

Deliver the Chrome MV3 extension defined in DESIGN.md: one React reader page that renders local files, local folders, and URLs through a single sanitized pipeline, with split editing, auto-reload, TOC, lazy Shiki, KaTeX, and Mermaid, export, recent files, and Chrome Web Store preparation. Light theme only. UI uses shadcn/ui behavior with TDS look, on Tailwind v4.

Preserved invariants, all phases:

- Every render passes through `src/render/pipeline.ts`, then `src/render/enhance.ts`. No second rendering path.
- DOMPurify sanitization runs before every DOM insertion of rendered HTML.
- No `eval`, `new Function`, inline `<script>`, or inline event handlers. MV3 only.
- No runtime network request to any CDN. All assets are bundled.
- The service worker keeps no state in global variables.
- Mermaid, KaTeX, and Shiki load only through dynamic `import()` from `enhance.ts`.
- UI is shadcn/ui for behavior and TDS for look. shadcn components keep their Radix logic, keyboard handling, focus, and ARIA; their `cva` class strings are replaced with `tds-*` classes per the DESIGN.md mapping. Custom compositions use the `tds-custom-*` prefix and semantic tokens only. No hardcoded hex in authored CSS or TSX. Light theme only. Before writing UI, run `tds rules`, `tds component <id>` for each component used, and save the returned CSS under `src/styles/tds/`.
- Tailwind utilities in authored markup are layout only, with TDS token values. No Tailwind color, radius, shadow, or font utilities.
- React never reconciles inside the Markdown container; `src/ui/markdown-view.tsx` sets HTML through a ref and calls `enhance()`.
- Library versions are those in DESIGN.md "Chosen Approach" unless a phase records a verified reason to change one.

Out of scope: dark mode, Firefox and Safari, encoding detection, in-place tab rendering, cloud sync, and accounts.

Secret-bearing files: none exist. Workers must not create `.env` files or commit credentials.

## Baseline Evidence

- `npm test` at plan base: fails, `npm error` because no `package.json` exists. Phase 1 repairs the baseline.
- Toolchain at plan base: Node v24.18.0, npm 11.16.0.
- Pinned test and build versions, verified on npm 2026-11-04: wxt 0.21.5, vite 8.3.5, vitest 5.1.0, happy-dom 21.0.4, @playwright/test 1.64.1, typescript 7.0.2. wxt 0.21.5 peers: `vite ^6.3.4 || ^7.0.0 || ^8.0.0-0`, `typescript >=5.4`, `node >=22`.
- Pinned UI versions, verified on npm 2026-11-05: react 19.3.1, react-dom 19.3.1, @types/react 19.3.0, @types/react-dom 19.3.0, @wxt-dev/module-react 1.2.2, tailwindcss 4.3.4, @tailwindcss/vite 4.3.4, shadcn CLI 4.23.0, lucide-react 1.68.0. Peers: @wxt-dev/module-react `vite ^5.4.19 || ^6.3.4 || ^7.0.0 || ^8.0.0-0`, `wxt >=0.19.16`; @tailwindcss/vite `vite ^5.2.0 || ^6 || ^7 || ^8`. Component dependencies are whatever `shadcn add` installs; record them in `package.json`.

### Phase 1: Toolchain, extension skeleton, and platform spikes

**Task Guide Input:** Repository and infrastructure setup: scaffold a WXT TypeScript extension with React, Tailwind v4, shadcn/ui init, and the TDS token bridge, plus build, typecheck, unit, and E2E scripts; create minimal reader, popup, background, and content-script entrypoints; write three Playwright spike tests that prove or refute platform assumptions. No product UI.
**Goal:** `npm run typecheck`, `npm test`, `npm run build`, and `npm run test:e2e` exist and pass, and the three DESIGN.md unverified points have recorded outcomes.
**Invariants & Boundaries:** No Markdown rendering features yet. No UI beyond placeholder pages. No shadcn components added yet. Spikes must not change DESIGN.md; record results in `docs/spikes.md` only.
**Files:**
- Create: `package.json`, `package-lock.json`, `tsconfig.json`, `wxt.config.ts`, `vitest.config.ts`, `playwright.config.ts`, `.gitignore`, `components.json`
- Create: `src/entrypoints/reader/index.html`, `src/entrypoints/reader/main.tsx`, `src/entrypoints/reader/App.tsx`
- Create: `src/entrypoints/popup/index.html`, `src/entrypoints/popup/main.tsx`, `src/entrypoints/popup/App.tsx`
- Create: `src/styles/globals.css`, `src/styles/tds/tokens.css`, `src/lib/utils.ts`
- Create: `tests/e2e/theme.spec.ts`
- Create: `src/entrypoints/background.ts`, `src/entrypoints/detect.content.ts`
- Create: `tests/unit/smoke.test.ts`
- Create: `tests/e2e/fixtures.ts`, `tests/e2e/spike-file-fetch.spec.ts`, `tests/e2e/spike-fs-observer.spec.ts`, `tests/e2e/spike-mermaid-csp.spec.ts`
- Create: `docs/spikes.md`
**Tasks:**
1. Scaffold WXT 0.21.5 with `srcDir: 'src'`, TypeScript, Vitest 5.1.0 with happy-dom 21.0.4, Playwright 1.64.1. Scripts: `typecheck` runs `wxt prepare && tsc --noEmit`; `test` runs `vitest run`; `build` runs `wxt build`; `test:e2e` runs `npm run build && playwright test`. If TypeScript 7.0.2 fails `typecheck` with WXT, pin the latest TypeScript 6.x or 5.x that passes and record why in `docs/spikes.md`. `.gitignore` covers `node_modules/`, `.output/`, `.wxt/`, `test-results/`, `playwright-report/`.
2. React and styling: add @wxt-dev/module-react to `wxt.config.ts` modules and @tailwindcss/vite to its Vite plugins. Make `@/*` resolve to `src/*` in both Vite and `tsconfig.json`. Run `shadcn init` for Tailwind v4 with aliases `@/components`, `@/components/ui`, `@/lib`, `@/lib/utils`, and CSS at `src/styles/globals.css`. Replace the generated theme with the DESIGN.md token bridge: `src/styles/tds/tokens.css` from `tds rules` RULE 2 and `tds tokens all` core tokens, imported first; shadcn variables mapped to TDS semantic tokens; `--font-sans: var(--font-family)` in `@theme inline`; `--color-*: initial` in `@theme`; no `.dark` block or `@custom-variant dark`.
3. Minimal entrypoints: reader page is a React root that reads `?src=` and shows it as text; popup with one button that opens the reader; background with no global state; content script that matches `*://*/*.md`, `*://*/*.markdown`, `file:///*.md`, `file:///*.markdown` and logs nothing yet. Manifest name "Markdown Reader", permissions `storage`, `contextMenus`, `tabs`, host permissions `<all_urls>`. No icons yet.
4. `tests/e2e/fixtures.ts`: Playwright fixture launching Chromium persistent context with `--disable-extensions-except` and `--load-extension` pointing at `.output/chrome-mv3`, exposing `extensionId`. E2E launches its own Chromium; this is a user-approved exception to Brave attach mode.
5. `theme.spec.ts`: on the reader page, assert computed `--primary` equals computed `--interactive-default`, computed `--color-neutral-100` equals the TDS core value from `tds tokens colors`, and `body` background equals computed `--surface-neutral-01`.
6. Spikes, each a passing test that asserts the observed behavior, with the result written to `docs/spikes.md` as VERIFIED or REFUTED plus the chosen fallback: (a) the reader page `fetch()`es a `file://` fixture path when file access is granted; (b) `'FileSystemObserver' in self` in the reader page; (c) the reader page dynamically imports `mermaid` and renders `graph TD; A-->B` to an `<svg>` with no CSP console error.
**Acceptance Criteria:**
- All four Verification Checks exit 0 from a clean checkout after `npm ci`.
- `.output/chrome-mv3/manifest.json` has `manifest_version` 3 and the listed permissions.
- `docs/spikes.md` records a VERIFIED or REFUTED outcome for each of the three spikes, with the Chromium version used.
- `theme.spec.ts` passes.
- `grep -rn 'dark' src/styles/globals.css` prints nothing.
**Reviewer Checklist:**
- Versions in `package.json` match the pins or have a recorded reason.
- Spike tests assert real behavior, not just absence of exceptions.
- No inline scripts in HTML entrypoints.
- Generated shadcn theme fully replaced; no oklch or hex colors outside `src/styles/tds/`.
**Verification Checks:**
- `npm ci`
- `npm run typecheck`
- `npm test`
- `npm run build`
- `npm run test:e2e`

### Phase 2: Render pipeline and plugins

**Task Guide Input:** Non-UI library code: implement the pure Markdown-to-sanitized-HTML pipeline with markdown-it and every DESIGN.md plugin, heading extraction, and relative link rewriting, test-first with fixtures.
**Goal:** `render(text, baseUrl)` returns `{ html, headings }` with every plugin working and XSS fixtures neutralized.
**Invariants & Boundaries:** Pure function, no DOM mutation outside DOMPurify's internal use, no chrome.* calls. No highlighting, math rendering in the browser, or Mermaid rendering yet; math emits KaTeX HTML via the plugin, Mermaid fences emit `<pre class="mermaid">` with escaped source, code fences emit `<pre><code class="language-x">`.
**Files:**
- Create: `src/render/pipeline.ts`, `src/render/sanitize.ts`, `src/render/links.ts`
- Create: `tests/unit/pipeline.test.ts`, `tests/unit/sanitize.test.ts`, `tests/unit/links.test.ts`, `tests/fixtures/markdown/*.md`
- Modify: `package.json`, `package-lock.json`
**Tasks:**
1. markdown-it 15.0.3 with `html: true`, `linkify: true`, `typographer: false`, plus markdown-it-emoji, markdown-it-footnote, markdown-it-anchor, markdown-it-mark, markdown-it-abbr, markdown-it-sub, markdown-it-sup, markdown-it-deflist, markdown-it-task-lists, markdown-it-github-alerts, @vscode/markdown-it-katex, at DESIGN.md versions. One fixture and test per plugin, plus GFM tables and strikethrough.
2. Heading extraction from markdown-it-anchor: `{ level, text, id }[]` for levels 1 to 6, unique ids for duplicate titles.
3. DOMPurify 3.4.17 config that keeps KaTeX MathML and HTML output, `<details>`, `<summary>`, `<kbd>`, task-list checkboxes, footnote anchors, and alert markup; strips scripts, event handlers, `javascript:` and `data:` URLs except `data:image/*`. XSS fixture set of at least 10 vectors.
4. `links.ts`: rewrite relative `href` and `src` against `baseUrl`; mark `.md` and `.markdown` links with `data-md-link`; add `rel="noopener"` and `target="_blank"` to external links.
**Acceptance Criteria:**
- Each plugin fixture produces its expected HTML structure in tests.
- Every XSS fixture output contains no `<script`, no `on*=` attribute, no `javascript:` URL.
- A 1 MB fixture generated in-test renders through `render()` in under 400 ms in Vitest.
**Reviewer Checklist:**
- KaTeX output survives sanitization intact.
- Mermaid source is HTML-escaped inside the `<pre>`.
- No plugin is configured in a way that bypasses sanitization.
**Verification Checks:**
- `npm run typecheck`
- `npm test`
- `npm run build`

### Phase 3: Lazy enhancers for code, math, and diagrams

**Task Guide Input:** Client library code with light visual output: implement `enhance(root)` that lazy-loads Shiki with the JavaScript regex engine, KaTeX CSS and fonts, and Mermaid themed from TDS tokens, with per-block caching and inline error blocks.
**Goal:** Rendered documents gain highlighted code, styled math, and SVG diagrams, and plain documents load none of those chunks.
**Invariants & Boundaries:** Heavy libraries only via dynamic `import()`. Shiki uses `@shikijs/engine-javascript`, theme `github-light`, grammars loaded per language on demand. No hardcoded hex: Mermaid `themeVariables` are read from computed TDS custom properties at runtime.
**Files:**
- Create: `src/render/enhance.ts`, `src/render/highlight.ts`, `src/render/math.ts`, `src/render/diagram.ts`, `src/render/cache.ts`
- Create: `tests/unit/enhance.test.ts`, `tests/e2e/enhance.spec.ts`, `tests/fixtures/markdown/rich.md`, `tests/fixtures/markdown/plain.md`
- Create: `src/ui/markdown-view.tsx`
- Modify: `src/entrypoints/reader/App.tsx`, `package.json`, `package-lock.json`
**Tasks:**
1. `cache.ts`: content-hash keyed cache so unchanged blocks reuse prior output across re-renders.
2. `highlight.ts`: Shiki 4.6.0 fine-grained core with JS engine; unknown languages fall back to plain text; blocks over 200 KB skipped.
3. `math.ts` loads KaTeX CSS and fonts only when `.katex` nodes exist. `diagram.ts` renders `pre.mermaid` with Mermaid 12.3.0 `theme: 'base'`, `securityLevel: 'strict'`, `startOnLoad: false`; invalid diagrams render an inline error with the source.
4. Wire reader page: `markdown-view.tsx` renders `?src=` text through `render()`, sets the HTML through a ref, then calls `enhance()` on that node. E2E asserts S8 by listening to requests while loading `plain.md` and `rich.md`.
**Acceptance Criteria:**
- `rich.md` shows Shiki-highlighted spans, KaTeX output, and at least one Mermaid `<svg>`.
- `plain.md` triggers no request whose URL contains a Shiki, KaTeX, or Mermaid chunk.
- An invalid Mermaid block shows an error and the next block still renders.
**Reviewer Checklist:**
- No WASM engine or `wasm-unsafe-eval` CSP change.
- Mermaid `securityLevel` is `strict`.
- Cache cannot leak stale output when block content changes.
- No `dangerouslySetInnerHTML` or React children inside the Markdown container.
**Verification Checks:**
- `npm run typecheck`
- `npm test`
- `npm run build`
- `npm run test:e2e`

### Phase 4: Reader shell, TOC, and URL and file sources

**Task Guide Input:** UI and client implementation with shadcn/ui behavior and TDS look: add and restyle the shadcn components, build the reader page layout, the TDS-token Markdown content stylesheet, the TOC sidebar with scroll-spy, the Source interface with UrlSource and FileHandleSource read, the URL field, Open file, and drag-and-drop.
**Goal:** A user opens a URL or a local file in the reader and reads it with a working TOC.
**Invariants & Boundaries:** TDS rules apply in full, with the layout-utility exception. Load the `tds-cli` and `shadcn` skills first. No editor, watch, folder, export, or popup work yet. Fonts bundled via @fontsource/inter.
**Files:**
- Create: `src/styles/tds/*.css`, `src/styles/markdown.css`, `src/styles/reader.css`
- Create: `src/components/ui/button.tsx`, `src/components/ui/toggle-group.tsx`, `src/components/ui/input.tsx`, `src/components/ui/tabs.tsx`, `src/components/ui/dropdown-menu.tsx`, `src/components/ui/collapsible.tsx`, `src/components/ui/alert.tsx`, `src/components/ui/spinner.tsx`, `src/components/ui/dialog.tsx`, `src/components/ui/tooltip.tsx`
- Create: `src/source/types.ts`, `src/source/url.ts`, `src/source/file-handle.ts`
- Create: `src/toc/toc.ts`, `src/ui/toc-panel.tsx`, `src/ui/announce.tsx`, `src/ui/top-bar.tsx`
- Create: `tests/unit/toc.test.ts`, `tests/unit/source-url.test.ts`, `tests/e2e/reader.spec.ts`
- Modify: `src/styles/globals.css`, `src/entrypoints/reader/index.html`, `src/entrypoints/reader/App.tsx`, `src/ui/markdown-view.tsx`, `package.json`, `package-lock.json`
**Tasks:**
1. `src/styles/tds/`: component CSS from `tds component` for button, icon-button, segmented-control, text-input, tabs, tab-item, nav-list, nav-item, caret, announcement, spinner, dialog, button-menu, dropdown-panel, action-list-item, tooltip, plus shared atoms field-label, field-caption, field-validation. Import each into `globals.css` with `layer(components)`. `shadcn add` the ten components listed under Files, then replace their `cva` and class strings with the TDS classes in the DESIGN.md mapping, keeping Radix props and ARIA. `markdown.css` scoped under `.tds-custom-markdown` per DESIGN.md content styling, including alert token mapping and print rules.
2. Reader layout in React: `top-bar.tsx`, sidebar with Tabs for Contents and Files, main content in `markdown-view.tsx`; layout through token-valued Tailwind utilities; `tds-announcement` errors with Retry; `tds-spinner` while loading.
3. `Source` interface and `UrlSource` with fetch errors mapped to announcements; `FileHandleSource.read()` from `showOpenFilePicker` and drag-and-drop `DataTransferItem.getAsFileSystemHandle()`; URL field submits to `UrlSource`; `<base>` set from source URL; `data-md-link` clicks open in the reader.
4. `toc.ts`: nested list data from headings and an `IntersectionObserver` scroll-spy. `toc-panel.tsx` renders it with `tds-nav-list`; click scrolls to the heading; the active item is marked.
**Acceptance Criteria:**
- E2E: entering a local test-server URL renders it; a 404 shows an announcement with Retry.
- E2E: TOC lists all heading levels of a fixture, click scrolls, and the active item changes on scroll.
- `grep -rnE '#[0-9a-fA-F]{3,8}\b' src/styles/markdown.css src/styles/reader.css src/ui src/components` prints nothing.
**Reviewer Checklist:**
- Only `tds-*`, `tds-custom-*`, and token-valued layout utilities in authored TSX and CSS.
- No Tailwind color, radius, shadow, or font utilities in TSX. TDS RULE 7 typography classes such as `text-body-md` are allowed.
- shadcn components keep Radix keyboard handling and ARIA after restyling.
- Rendered output checked per component where Radix DOM differs from TDS DOM.
- No dark surfaces.
- Keyboard focus visible on all controls.
**Verification Checks:**
- `npm run typecheck`
- `npm test`
- `npm run build`
- `npm run test:e2e`

### Phase 5: Entry points: auto-render, popup, background, file access

**Task Guide Input:** Extension wiring with small shadcn/ui and TDS UI: content-script detection and redirect, FileUrlSource, popup quick actions, background message handling and context menu, file-access guidance dialog, recent URL list.
**Goal:** Navigating to a raw `.md` URL shows the reader, and the popup offers working quick actions.
**Invariants & Boundaries:** Service worker without global state; async and await only; `return true` for async `onMessage` responses. Content script does nothing on non-text pages.
**Files:**
- Modify: `src/entrypoints/detect.content.ts`, `src/entrypoints/background.ts`, `src/entrypoints/popup/index.html`, `src/entrypoints/popup/App.tsx`, `src/entrypoints/reader/App.tsx`, `wxt.config.ts`
- Create: `src/source/file-url.ts`, `src/store/recent.ts`, `src/ui/file-access-dialog.tsx`
- Create: `tests/unit/recent.test.ts`, `tests/e2e/entry.spec.ts`
**Tasks:**
1. Content script: when `document.contentType` is `text/plain` or `text/markdown`, store `{url, text}` in `chrome.storage.session` and redirect to `reader.html?src=<url>`. Reader prefers session text, then refetches. `FileUrlSource` uses the Phase 1 spike outcome for `file://` reads.
2. Background: context menu "Open in Markdown Reader" for links ending in `.md` or `.markdown`, with user feedback; handles popup messages; opens reader tabs.
3. Popup: Open viewer, Open editor, Render current tab, recent list, using the Phase 4 Button. "Render current tab" on `file://` with access disabled opens the file-access Dialog.
4. `recent.ts`: last 20 URLs in `chrome.storage.local`, deduplicated, newest first.
**Acceptance Criteria:**
- E2E: navigating to `http://127.0.0.1:<port>/doc.md` served as `text/plain` lands on the reader with rendered content.
- E2E: an HTML page at a `.md` path is not redirected.
- E2E: popup buttons open the reader in the expected mode.
**Reviewer Checklist:**
- No global mutable state in `background.ts`.
- `tabs` permission justified by `tab.url` use.
- Redirect cannot loop.
**Verification Checks:**
- `npm run typecheck`
- `npm test`
- `npm run build`
- `npm run test:e2e`

### Phase 6: Live editing, drafts, auto-reload, and save-back

**Task Guide Input:** UI and client implementation with shadcn/ui and TDS: CodeMirror 6 Edit and Split modes with live preview, draft persistence, file watching for handles and file URLs, save-back with conflict dialog, dirty-editor reload rule.
**Goal:** Typing updates the preview within budget, and opened local files reload on disk change.
**Invariants & Boundaries:** Preview updates through `render()` and `enhance()` only. No auto-reload while the editor is dirty. Watching uses `FileSystemObserver` when the Phase 1 spike verified it, else 1 s `lastModified` polling.
**Files:**
- Create: `src/editor/editor.ts`, `src/store/drafts.ts`, `src/source/watch.ts`
- Create: `src/ui/editor-pane.tsx`, `src/ui/save-conflict-dialog.tsx`
- Modify: `src/source/file-handle.ts`, `src/source/file-url.ts`, `src/entrypoints/reader/App.tsx`, `src/ui/top-bar.tsx`, `src/ui/markdown-view.tsx`, `src/styles/reader.css`, `package.json`, `package-lock.json`
- Create: `tests/unit/drafts.test.ts`, `tests/unit/watch.test.ts`, `tests/e2e/editor.spec.ts`, `tests/e2e/reload.spec.ts`
**Tasks:**
1. CodeMirror 6.0.2 with @codemirror/lang-markdown 6.5.2, mounted imperatively by `editor-pane.tsx` into a ref; the ToggleGroup with `tds-segmented-control` switches Read, Edit, Split; editor changes call `markdown-view` through a ref, not React state; preview re-render batched per animation frame; scroll position kept.
2. Drafts saved to `chrome.storage.local` after 1 s idle, restored on reopen, keyed by source identity.
3. `watch.ts` with observer and polling strategies; `FileHandleSource.watch` and `FileUrlSource.watch`; deleted-file announcement; dirty editor shows "File changed on disk: Reload".
4. `FileHandleSource.write` with `lastModified` conflict check and `save-conflict-dialog.tsx`: Overwrite, Reload from disk, Cancel.
**Acceptance Criteria:**
- E2E: typing in Split mode on a 100 KB fixture updates the preview within 100 ms, median of 10 keystrokes.
- E2E: rewriting a `file://` fixture on disk re-renders the reader without user action.
- Unit: conflict path never writes when `lastModified` differs and the user cancels.
**Reviewer Checklist:**
- Watchers are unsubscribed on source change and page unload.
- Drafts never overwrite disk without explicit save.
- Keystrokes cause no React re-render of the shell.
**Verification Checks:**
- `npm run typecheck`
- `npm test`
- `npm run build`
- `npm run test:e2e`

### Phase 7: Folder mode and persisted handles

**Task Guide Input:** UI and client implementation with shadcn/ui and TDS: DirectorySource with recursive Markdown tree and live watch, Files sidebar tree, relative links and images inside a folder, recent file and folder handles in IndexedDB with Reconnect.
**Goal:** A user opens a local folder, browses its Markdown tree, follows relative links, and sees tree updates on disk changes.
**Invariants & Boundaries:** Tree lists only `.md` and `.markdown` files and directories containing them. Object URLs created for images are revoked on navigation.
**Files:**
- Create: `src/source/directory.ts`, `src/ui/file-tree.tsx`, `src/store/handles.ts`
- Modify: `src/render/links.ts`, `src/store/recent.ts`, `src/entrypoints/reader/App.tsx`, `src/ui/top-bar.tsx`, `src/styles/reader.css`, `package.json`, `package-lock.json`
- Create: `tests/unit/directory.test.ts`, `tests/unit/handles.test.ts`, `tests/unit/file-tree.test.ts`
**Tasks:**
1. `DirectorySource`: walk to a tree, resolve relative paths, watch for adds, removes, and renames using the Phase 1 outcome.
2. Files tab tree with Collapsible nodes styled `tds-nav-list`, `tds-side-nav__nav-item`, `tds-caret`; click opens the file; tree refreshes on watch events.
3. Folder-relative `.md` links open within the folder; relative images resolve to object URLs.
4. `handles.ts` with idb-keyval 6.3.0; recent list includes handles; Reconnect calls `requestPermission()` on click.
**Acceptance Criteria:**
- Unit with fake handles: tree contents, add, remove, and rename events, relative link and image resolution.
- Unit: handle permission `prompt` state yields a Reconnect entry.
- `docs/manual-checklist.md` lists the native-picker steps for folder open, watch, and Reconnect.
**Reviewer Checklist:**
- No object URL leaks.
- Links outside the folder fall back to source-URL resolution or render disabled.
**Verification Checks:**
- `npm run typecheck`
- `npm test`
- `npm run build`
- `npm run test:e2e`

### Phase 8: Export, performance gates, and store readiness

**Task Guide Input:** Mixed: export to standalone HTML and print-to-PDF; performance E2E gates; generated icons; CHROMEWEBSTORE.md, privacy policy text, README with manual checklist link.
**Goal:** The extension is release-ready with measured performance and complete store documentation.
**Invariants & Boundaries:** Store copy describes user benefits without implementation details. Every permission has a specific justification.
**Files:**
- Create: `src/export/export.ts`, `scripts/gen-icons.mjs`, `public/icons/icon-16.png`, `public/icons/icon-32.png`, `public/icons/icon-48.png`, `public/icons/icon-128.png`
- Create: `tests/e2e/export.spec.ts`, `tests/e2e/perf.spec.ts`
- Create: `CHROMEWEBSTORE.md`, `PRIVACY.md`, `README.md`
- Modify: `src/entrypoints/reader/App.tsx`, `src/ui/top-bar.tsx`, `wxt.config.ts`, `package.json`, `package-lock.json`
**Tasks:**
1. Export HTML with inlined styles, rendered SVG, and KaTeX CSS; Print via `window.print()` with print stylesheet; Export menu is the DropdownMenu styled `tds-button-menu`. Exported HTML contains no React runtime or Tailwind utilities; it inlines `markdown.css`, the TDS tokens it uses, and KaTeX CSS.
2. `perf.spec.ts`: S4 1 MB first content under 500 ms, amended 2026-11-05; S3 re-asserted; S8 re-asserted; S9 offline render with network blocked.
3. Icons generated at exact pixel sizes and referenced in the manifest.
4. `CHROMEWEBSTORE.md` per the chrome-extensions skill template, `PRIVACY.md`, and `README.md` with build, load-unpacked, file-access steps, and link to `docs/manual-checklist.md`.
**Acceptance Criteria:**
- E2E: exported HTML opened in a fresh page shows highlighted code, math, and diagrams with no network requests.
- Perf spec passes S3, S4, S8, S9.
- `CHROMEWEBSTORE.md` justifies `storage`, `contextMenus`, `tabs`, `<all_urls>`, and file URL access.
- `npx wxt zip` produces a ZIP excluding `.git/`, `node_modules/`, and `CHROMEWEBSTORE.md`.
**Reviewer Checklist:**
- Icon files exist at declared dimensions.
- No implementation details in store copy.
**Verification Checks:**
- `npm run typecheck`
- `npm test`
- `npm run build`
- `npm run test:e2e`
- `npx wxt zip`
