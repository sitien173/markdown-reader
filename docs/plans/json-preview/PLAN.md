# JSON Preview Plan

**Design:** [DESIGN.md](DESIGN.md)
**Context key:** `json-preview`
**Base:** `refs/plans/json-preview/base` (`c9c2800`)
**Commit:** `feat(reader): preview .json and .jsonc documents with view tools`

## Outcome & Scope

Open standalone `.json` and `.jsonc` documents in the reader as highlighted, read-only text, with opt-in automatic redirect, and view tools to beautify, minify, sort keys, strip comments, escape, unescape, copy, and download the current view. All behavior follows [DESIGN.md](DESIGN.md).

Preserved invariants:

- Markdown detection, captured-text loading, rendering, drafts, editing, and export behave exactly as before.
- Stored settings without `general.renderJson` parse unchanged; the flag defaults to `false`.
- `src/lib/settings-flags.ts`, `src/entrypoints/detect.content.ts`, and `src/entrypoints/background.ts` import neither Zod nor `jsonc-parser`.
- The source file is never written. On open, JSON text is altered only by whitespace-only formatting of minified input. Every tool preserves number text, string escapes, and duplicate keys byte-exact.

Out of scope: JSON code blocks in Markdown, tree view, editing JSON or writing to the source file, JSON5, NDJSON, `.jsonl`, Content-Type or content sniffing for extensionless URLs, a Firefox workaround, command-palette entries or shortcuts for JSON tools, remembered toolbar state, Web Worker transforms, unescaping bare escaped text.

Execution precondition: met. `docs/plans/file-url-folder-tree` is `DONE` at `bebf24f`; the plan `base` was moved there and every baseline command and named symbol was re-checked on 2026-11-10. Re-anchored 2026-11-11: `docs/plans/open-source-release` landed 17 further commits on `main`, so the plan `base` moved to `c9c2800` and execution runs on branch `feat/json-preview`.

Secret handling: no phase reads `.env` or credential files.

Run verification commands one at a time, never concurrently. If `pnpm test:e2e` fails only in the `tests/e2e/appearance.spec.ts` code theme tests, a passing solo rerun of that spec counts as a pass and is recorded in the phase journal.

## Baseline Evidence

Re-recorded at `c9c2800` on 2026-11-11, run one at a time. The earlier `bebf24f` figures are superseded.

- `pnpm typecheck`: pass.
- `pnpm lint`: pass, 0 errors, 208 warnings, 3 infos.
- `pnpm test`: pass, 44 files, 543 tests.
- `pnpm test:e2e`: not re-run at `c9c2800`; recorded at `bebf24f` as pass, 189 tests, 6.1m. Phase 3 re-establishes it.

### Phase 1: JSON document core, setting, and detection

**Phase Request:** Add the pure JSON document helpers, the `renderJson` setting, and opt-in redirect of `.json` and `.jsonc` pages. Use cases: derive the document kind from a URL path or file name; parse strict JSON and JSONC with the first error's message, line, and column; reformat minified valid input with whitespace-only edits; leave formatted input byte-identical; strip a leading BOM; report an empty document; toggle "Preview .json files" in General settings; redirect JSON pages only when the flag is on; reject JSON captures in the background when the flag is off.
**Goal:** JSON documents can be classified, parsed, formatted, and redirected, with no reader UI change yet.
**Depends on:** none
**Invariants & Boundaries:** `src/lib/doc-kind.ts` has no imports. `src/lib/json-document.ts` performs no I/O and is the only module that imports `jsonc-parser`. Markdown and `.txt` redirect results are unchanged for every existing test input. No store, controller, or UI change outside the settings tab.
**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Create: `src/lib/doc-kind.ts`
- Create: `src/lib/json-document.ts`
- Create: `tests/unit/json-document.test.ts`
- Modify: `src/lib/settings-flags.ts`
- Modify: `src/lib/settings.ts`
- Modify: `src/ui/settings/general-tab.tsx`
- Modify: `src/i18n/en-US.ts`
- Modify: `src/entrypoints/detect.content.ts`
- Modify: `src/entrypoints/background.ts`
- Modify: `tests/unit/settings-flags.test.ts`
- Modify: `tests/unit/settings.test.ts`
- Modify: `tests/unit/detect.test.ts`
- Modify: `tests/unit/background.test.ts`
**Tasks:**
1. Run `pnpm add jsonc-parser@3.3.1`. TDD `src/lib/doc-kind.ts`:
   - `type DocKind = 'markdown' | 'json' | 'jsonc'`;
   - `docKindFromName(name: string): DocKind` matching `/\.jsonc$/i` and `/\.json$/i` on the name or URL pathname, else `'markdown'`;
   - `isJsonName(name: string): boolean`.
   TDD `src/lib/json-document.ts`:
   - async `prepareJson(text: string, kind: 'json' | 'jsonc'): Promise<{ text: string; error: { message: string; line: number; column: number } | null }>` that lazy-imports `jsonc-parser`, strips a leading U+FEFF, parses with `disallowComments` and `allowTrailingComma` set from `kind`, returns the first error with 1-based line and column and the original text, returns `Empty document` for whitespace-only input, and applies `format` plus `applyEdits` with 2-space indentation only when the trimmed text has no line break.
2. TDD settings: `general.renderJson` boolean default `false` in `GeneralFlags` and `readGeneralFlags`, and in `Settings`, `defaultSettings`, and the schema with the same fallback pattern as `renderTxt`. Add a toggle next to "Render .txt as Markdown" in `general-tab.tsx` with label and description in `en-US.ts`.
3. TDD detection: `shouldRedirectMarkdown` accepts `renderJson` and returns `true` for `.json` or `.jsonc` pathnames when `enabled` and `renderJson` are on and the content type is `application/json`, `text/json`, `text/plain`, empty, or ends with `+json`. Add `*://*/*.json`, `*://*/*.jsonc`, `file:///*.json`, `file:///*.jsonc` to `matches`. `isMarkdownLink` and `isValidCapture` take `renderJson` and accept those extensions only when it is `true`; the background listener passes the stored flag. The context menu accepts `.json` and `.jsonc` links regardless of the flag.
**Acceptance Criteria:**
- `tests/unit/json-document.test.ts` proves: kind derivation for `.json`, `.JSON`, `.jsonc`, URL with query, and `.md`; minified input reformatted; formatted input returned byte-identical; `12345678901234567890`, key order, duplicate keys, `\u00e9` escapes, and JSONC comments preserved; BOM stripped; empty input error; error line and column for a missing comma; trailing comma and comments accepted for `jsonc` and rejected for `json`.
- `tests/unit/settings-flags.test.ts` and `tests/unit/settings.test.ts` prove the `false` default and fallback from a non-boolean stored value.
- `tests/unit/detect.test.ts` and `tests/unit/background.test.ts` prove flag on and off, each MIME type, `text/html` rejected, and unchanged Markdown and `.txt` results.
**Reviewer Checklist:**
- `jsonc-parser` is pinned to exactly `3.3.1` and imported only by dynamic `import()` inside `src/lib/json-document.ts`.
- `settings-flags.ts`, `detect.content.ts`, and `background.ts` import nothing new beyond `src/lib/doc-kind.ts`, and the built content-script and background bundles contain no `jsonc-parser` code.
- Formatting runs only on successfully parsed, single-line input.
**Verification Checks:**
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`

### Phase 2: Reader state, loading, and read-only rules

**Phase Request:** Make every reader entry point load JSON documents into the store as read-only. Use cases: Open file picker offers `.json` and `.jsonc`; drag-drop accepts them; the Open folder tree and `file://` tree list them and open them on click; links to `.json` files inside Markdown open in the reader; `load` re-fetches JSON by URL and ignores captured text; no draft is saved or restored; mode becomes `read` on open and `setMode('edit')` or `setMode('split')` is ignored; `?mode=edit` with a JSON `src` opens in `read`; save, edit, split, raw toggle, and Export HTML are unavailable while Print stays available.
**Goal:** The store holds `docKind` for every loaded document, and JSON documents are read-only through every path.
**Depends on:** Phase 1
**Invariants & Boundaries:** Markdown loading, captured-text use, drafts, modes, and command availability are unchanged for `docKind === 'markdown'`. Folders containing only JSON files now appear in trees; pruning of folders with neither Markdown nor JSON is unchanged. No rendering change in this phase; `App.tsx` changes only for the sidebar tab.
**Files:**
- Modify: `src/store/reader-store.ts`
- Modify: `src/reader/controller.ts`
- Modify: `src/reader/commands.ts`
- Modify: `src/ui/reader-menu.tsx`
- Modify: `src/ui/command-palette.tsx`
- Modify: `src/source/file-handle.ts`
- Modify: `src/source/directory.ts`
- Modify: `src/source/file-url-tree.ts`
- Modify: `src/render/links.ts`
- Modify: `src/entrypoints/reader/App.tsx`
- Modify: `tests/unit/reader-store.test.ts`
- Modify: `tests/unit/controller.test.ts`
- Modify: `tests/unit/commands.test.ts`
- Modify: `tests/unit/file-handle.test.ts`
- Modify: `tests/unit/directory.test.ts`
- Modify: `tests/unit/file-url-tree.test.ts`
- Modify: `tests/unit/links.test.ts`
- Modify: `tests/unit/reader-app.test.tsx`
**Tasks:**
1. TDD store and controller: add `docKind: DocKind` to `ReaderState`, initial `'markdown'`, derived from `src` for the initial `mode` so a JSON `src` clamps `mode` to `read`. Every load path in `controller.ts` sets `docKind` through `docKindFromName`. For JSON kinds, `load` skips `usableCapturedText`, `applyText` skips `createDraftSaver` and `loadDraft`, mode is set to `read`, `writable` is `false`, and `setMode` and `edit` return without change.
2. TDD commands: add `docKind` to `CommandState`; `save`, `mode-edit`, `mode-split`, `toggle-raw`, and `export-html` are unavailable for JSON kinds; `print` keeps its current rule. Update the `reader-menu.tsx` and `command-palette.tsx` selectors to include `docKind`.
3. TDD entry points: the picker `types` in `FileHandleSource.pick` add a JSON entry for `.json` and `.jsonc`; `isValidMarkdownFile` and `drop` accept them; tree building and link resolution in `directory.ts`, the entry filter in `file-url-tree.ts`, and the `data-md-link` rule in `links.ts`, treat `.json` and `.jsonc` as reader documents through `isJsonName` from `src/lib/doc-kind.ts`.
4. TDD sidebar: in `App.tsx`, hide the Contents toggle item and show the Files panel while `docKind` is a JSON kind.
**Acceptance Criteria:**
- `tests/unit/controller.test.ts` proves: drop accepts `.json`; captured text is ignored and the URL is read for `.json`; a stored draft is not restored and `dirty` stays `false`; mode switches from `split` to `read` on JSON open; `setMode('edit')` is ignored for JSON; Markdown behavior in existing tests is unchanged.
- `tests/unit/reader-store.test.ts` proves `?src=a.json&mode=edit` starts in `read`.
- `tests/unit/commands.test.ts` proves the availability table for JSON and Markdown.
- `tests/unit/file-handle.test.ts`, `tests/unit/directory.test.ts`, `tests/unit/file-url-tree.test.ts`, and `tests/unit/links.test.ts` prove JSON acceptance in the picker types, drop check, picker tree, `file://` tree, and link marking.
- `tests/unit/reader-app.test.tsx` proves the Contents toggle is absent for a JSON document.
**Reviewer Checklist:**
- Every load path sets `docKind`; none leaves a stale kind from the previous document.
- No draft key is written for a JSON source.
- Print availability is unchanged.
**Verification Checks:**
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`

### Phase 3: JsonView rendering, error banner, and end-to-end coverage

**Phase Request:** Render JSON documents with a dedicated view and verify the feature end to end in Chromium. Use cases: valid JSON renders highlighted with the current code theme and a Copy bar; minified JSON renders formatted; JSONC with comments renders highlighted with the `jsonc` grammar; invalid JSON shows a banner with message, line, and column above the original highlighted text; an empty file shows the banner; a file above 200 KB renders plain text with the Copy bar; auto-refresh re-renders after the file changes; Print works.
**Goal:** JSON documents render through `JsonView` with parse-error reporting.
**Depends on:** Phase 2
**Invariants & Boundaries:** `MarkdownView`, the render pipeline, and `enhance()` behavior for Markdown are unchanged. The fetch-error banner keeps its Retry button. Firefox behavior is not tested here; the Coordinator records a manual Firefox check of auto-redirect in the phase journal, without adding a workaround.
**Files:**
- Create: `src/ui/json-view.tsx`
- Modify: `src/render/highlight.ts`
- Modify: `src/store/reader-store.ts`
- Modify: `src/ui/status-banner.tsx`
- Modify: `src/entrypoints/reader/App.tsx`
- Create: `tests/unit/json-view.test.tsx`
- Modify: `tests/unit/reader-store.test.ts`
- Modify: `tests/unit/reader-render.test.tsx`
- Create: `tests/e2e/json-preview.spec.ts`
**Tasks:**
1. TDD highlighting: register `jsonc` in `loadLanguage` and `supported` in `src/render/highlight.ts`.
2. TDD `src/ui/json-view.tsx`: a `forwardRef` component implementing `MarkdownViewHandle` that awaits `prepareJson`, reports the error through an `onParseError` prop, mounts `<div data-slot="markdown" className="md-content"><pre><code className="language-json|jsonc">` with `textContent`, and calls `enhance(root, signal)` with an `AbortController` cancelled on unmount and text change. `ready()` resolves after `enhance` settles.
3. TDD banner: add `parseError: { message: string; line: number; column: number } | null` to `ReaderState`, cleared on every load. `selectBanners` adds `{ kind: 'jsonError'; message: string }` after `error`. `StatusBanner` renders it without Retry, as `<message> (line <line>, column <column>)`, or only the message for an empty document.
4. In `Content` in `App.tsx`, render `JsonView` for JSON kinds with `onParseError` writing `parseError`, keep `MarkdownView` otherwise, and use the `Loading` label without the word Markdown for JSON kinds. Add `tests/e2e/json-preview.spec.ts` using `startFixtureServer` and `file://` fixtures written to a temp directory: redirect off and on through the setting, minified formatting, JSONC highlighting, invalid banner, empty file, file above 200 KB, Copy, edit and Export HTML unavailable, Print available, and auto-refresh after a fixture change.
**Acceptance Criteria:**
- `tests/unit/json-view.test.tsx` proves highlighted output, formatted minified output, byte-identical formatted input, error callback, and abort on unmount.
- `tests/unit/reader-render.test.tsx` proves the JSON error banner appears above the original text and has no Retry button, and the fetch-error banner still has Retry.
- `tests/e2e/json-preview.spec.ts` passes every listed use case in Chromium.
**Reviewer Checklist:**
- Text reaches the DOM only through `textContent` or the existing sanitized `enhance()` path.
- No heading or TOC data is produced for JSON documents.
- Abort handling prevents a slow `prepareJson` or `enhance` from writing into a newer document.
**Verification Checks:**
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm test:e2e`

### Phase 4: Pure JSON view transforms

**Phase Request:** Add the pure transform pipeline behind the JSON tools. Use cases: beautify with 2 spaces, 4 spaces, or tab; minify; sort object keys recursively; strip comments and trailing commas from JSONC; escape the result as one JSON string literal; unescape a document whose root is a JSON string; report whether the output still contains comments for the download extension.
**Goal:** `transformJson` produces every toolbar view from source text with byte-exact numbers, escapes, and duplicate keys.
**Depends on:** Phase 1
**Invariants & Boundaries:** `src/lib/json-document.ts` stays pure, performs no I/O, and remains the only module that imports `jsonc-parser`, by dynamic `import()`. `prepareJson` behavior and its Phase 1 tests are unchanged. No UI change.
**Files:**
- Modify: `src/lib/json-document.ts`
- Modify: `tests/unit/json-document.test.ts`
**Tasks:**
1. TDD types and layout: export `JsonLayout = 'original' | 'beautify' | 'minify'`, `JsonIndent = 2 | 4 | 'tab'`, `JsonViewOptions = { layout: JsonLayout; indent: JsonIndent; sortKeys: boolean; stripComments: boolean; escape: boolean }`, and async `transformJson(source: string, kind: 'json' | 'jsonc', options: JsonViewOptions): Promise<{ text: string; hasComments: boolean }>`. Pipeline order: strip comments, sort keys, layout, escape. `sortKeys` forces `stripComments`. Beautify uses `format` and `applyEdits` with `insertSpaces` and `tabSize` from `indent`, over the whole text, keeping comments. Minify emits scanner tokens with no trivia and no comments, keeping trailing commas unless stripped.
2. TDD strip and sort: strip removes comment tokens and trailing commas using the scanner. Sort rebuilds objects from `parseTree` node slices of the source, ordering keys by code unit comparison with a stable sort so duplicate keys keep their relative order, recursively through arrays and objects.
3. TDD escape and unescape: escape returns `JSON.stringify(text)`. Export async `unescapeJson(source: string, kind: 'json' | 'jsonc'): Promise<{ text: string; parses: boolean } | null>` returning `null` unless the source parses with no error and the root node is a string; otherwise the decoded value and whether it parses as strict JSON.
**Acceptance Criteria:**
- `tests/unit/json-document.test.ts` proves: each indent; minify of formatted JSON and of JSONC with line and block comments; strip removes comments and trailing commas; sort keys recursively with duplicate keys in relative order; sort implies strip; `12345678901234567890`, `1.0e+2`, `-0`, and `\u00e9` byte-exact through every transform; pipeline order with sort plus minify plus escape; escape then unescape round trip; `unescapeJson` returns `null` for an object root and `parses: false` for a decoded non-JSON string; `hasComments` true only while comments remain.
**Reviewer Checklist:**
- No transform round-trips values through `JSON.parse` or `JSON.stringify`, except `JSON.stringify` of the final string in escape.
- Sort output for an object with comments contains no comments.
- `jsonc-parser` is still imported only inside `src/lib/json-document.ts`.
**Verification Checks:**
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`

### Phase 5: JSON toolbar, download, and end-to-end coverage

**Phase Request:** Add the JSON toolbar to `JsonView` with copy and download of the current view, and cover it end to end in Chromium. Use cases: choose Original, Beautify, or Minify; choose 2 spaces, 4 spaces, or tab for Beautify; toggle Sort keys, Strip comments, and Escape; Strip comments is hidden for `.json` and checked and locked while Sort keys is on; Unescape replaces the view and becomes Revert; the code-bar Copy copies the current view; Download saves `<stem>.json`, or `<stem>.jsonc` while comments remain; minified input opens as Beautify with 2 spaces and other input as Original; opening another document resets the toolbar; auto-refresh keeps it and reverts Unescape when the root is no longer a string; a parse error disables every tool and Copy and Download use the original text; the toolbar is hidden in Print.
**Goal:** Users transform, copy, and download the JSON view without changing the source.
**Depends on:** Phase 3, Phase 4
**Invariants & Boundaries:** `downloadHtml` output and file names are unchanged. Highlighting still runs through `enhance()` with `textContent` input. Parse-error banner behavior from Phase 3 is unchanged. No command-palette entries, shortcuts, or stored settings.
**Files:**
- Create: `src/ui/json-toolbar.tsx`
- Modify: `src/ui/json-view.tsx`
- Modify: `src/export/export.ts`
- Modify: `src/i18n/en-US.ts`
- Modify: `src/styles/reader.css`
- Create: `tests/unit/json-toolbar.test.tsx`
- Modify: `tests/unit/json-view.test.tsx`
- Modify: `tests/unit/export.test.ts`
- Modify: `tests/e2e/json-preview.spec.ts`
**Tasks:**
1. TDD download: extract `downloadText(filename: string, text: string, mime: string): void` from the Blob and anchor code in `downloadHtml` in `src/export/export.ts`, and make `downloadHtml` call it.
2. TDD `src/ui/json-toolbar.tsx`: a controlled component taking `kind`, `options: JsonViewOptions`, `unescaped: boolean`, `canUnescape: boolean`, `disabled: boolean`, and change, unescape, revert, and download callbacks. Use the existing `ToggleGroup`, `Select`, `Toggle`, and `Button` components from `src/components/ui/`, and add labels to `en-US.ts`.
3. TDD `JsonView`: hold toolbar state, initialize it from the source per the open rule, reset it when the source name changes, keep it across same-source text changes, run `transformJson` or `unescapeJson` under the existing `AbortController`, and render the result through the existing `textContent` and `enhance()` path. Download names the file from the source stem and `hasComments`. Hide the toolbar under `@media print` in `src/styles/reader.css`.
4. Extend `tests/e2e/json-preview.spec.ts`: layout and indent change the view, Sort keys locks Strip comments, Escape and Unescape round trip, Copy copies the view, Download file name and content through the Playwright `download` event, auto-refresh keeps toolbar state, and a parse error disables the tools.
**Acceptance Criteria:**
- `tests/unit/export.test.ts` proves `downloadText` file name, MIME type, and URL revocation, and existing `downloadHtml` tests pass unchanged.
- `tests/unit/json-toolbar.test.tsx` proves Strip comments hidden for `json`, locked under Sort keys, all tools disabled on parse error, and Unescape shown only when `canUnescape`.
- `tests/unit/json-view.test.tsx` proves the open rule, reset on new source, kept state on refresh, Unescape revert on refresh, and abort of a stale transform.
- `tests/e2e/json-preview.spec.ts` passes every listed use case in Chromium.
**Reviewer Checklist:**
- Transformed text reaches the DOM only through `textContent` or the existing sanitized `enhance()` path.
- A slow transform cannot overwrite the view of a newer document or newer toolbar state.
- No code path writes to the source file, a draft, or settings.
**Verification Checks:**
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm test:e2e`
