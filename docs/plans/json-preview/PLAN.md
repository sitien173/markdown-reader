# JSON Preview Plan

**Design:** [DESIGN.md](DESIGN.md)
**Context key:** `json-preview`
**Base:** `refs/plans/json-preview/base` (`29fd219`)
**Commit:** `feat(reader): preview .json and .jsonc documents read-only`

## Outcome & Scope

Open standalone `.json` and `.jsonc` documents in the reader as highlighted, read-only text, with opt-in automatic redirect. All behavior follows [DESIGN.md](DESIGN.md).

Preserved invariants:

- Markdown detection, captured-text loading, rendering, drafts, editing, and export behave exactly as before.
- Stored settings without `general.renderJson` parse unchanged; the flag defaults to `false`.
- `src/lib/settings-flags.ts`, `src/entrypoints/detect.content.ts`, and `src/entrypoints/background.ts` import neither Zod nor `jsonc-parser`.
- JSON text is never altered except by whitespace-only formatting of minified input.

Out of scope: JSON code blocks in Markdown, tree view, editing or saving JSON, JSON5, NDJSON, `.jsonl`, Content-Type or content sniffing for extensionless URLs, a Firefox workaround.

Execution precondition: this plan runs after `docs/plans/file-url-folder-tree` reaches `DONE`. That plan rewrites `src/source/directory.ts`, `src/ui/file-tree.tsx`, `src/reader/controller.ts`, `src/entrypoints/reader/App.tsx`, `src/lib/settings.ts`, `src/ui/settings/general-tab.tsx`, and `src/i18n/en-US.ts`, and adds `!**/.ogrep` to `biome.json`. Before Phase 1, the Coordinator moves `refs/plans/json-preview/base` to the clean HEAD after that plan's commit, re-runs every baseline command below, records the new results here, and re-checks every symbol named in this plan. A renamed or moved symbol is updated in this file before submission.

Secret handling: no phase reads `.env` or credential files.

Run verification commands one at a time, never concurrently. If `pnpm test:e2e` fails only in the `tests/e2e/appearance.spec.ts` code theme tests, a passing solo rerun of that spec counts as a pass and is recorded in the phase journal.

## Baseline Evidence

Recorded at `29fd219`, before `file-url-folder-tree` executes. These results are superseded by the re-baseline required above.

- `pnpm typecheck`: pass.
- `pnpm lint`: fail, 2 errors, 183 warnings, 3 infos. Both errors are formatter diffs in the local untracked index `.ogrep/lance/**/latest_version_hint.json`. `file-url-folder-tree` Phase 1 adds `!**/.ogrep` to `biome.json`, which repairs this baseline.
- `pnpm test`: pass, 40 files, 485 tests.
- `pnpm test:e2e`: pass, 188 tests, 5.9m.

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
- Modify: `src/render/links.ts`
- Modify: `src/entrypoints/reader/App.tsx`
- Modify: `tests/unit/reader-store.test.ts`
- Modify: `tests/unit/controller.test.ts`
- Modify: `tests/unit/commands.test.ts`
- Modify: `tests/unit/file-handle.test.ts`
- Modify: `tests/unit/directory.test.ts`
- Modify: `tests/unit/links.test.ts`
- Modify: `tests/unit/reader-app.test.tsx`
**Tasks:**
1. TDD store and controller: add `docKind: DocKind` to `ReaderState`, initial `'markdown'`, derived from `src` for the initial `mode` so a JSON `src` clamps `mode` to `read`. Every load path in `controller.ts` sets `docKind` through `docKindFromName`. For JSON kinds, `load` skips `usableCapturedText`, `applyText` skips `createDraftSaver` and `loadDraft`, mode is set to `read`, `writable` is `false`, and `setMode` and `edit` return without change.
2. TDD commands: add `docKind` to `CommandState`; `save`, `mode-edit`, `mode-split`, `toggle-raw`, and `export-html` are unavailable for JSON kinds; `print` keeps its current rule. Update the `reader-menu.tsx` and `command-palette.tsx` selectors to include `docKind`.
3. TDD entry points: the picker `types` in `FileHandleSource.pick` add a JSON entry for `.json` and `.jsonc`; `isValidMarkdownFile` and `drop` accept them; tree building and link resolution in `directory.ts`, and the `data-md-link` rule in `links.ts`, treat `.json` and `.jsonc` as reader documents through `isJsonName` from `src/lib/doc-kind.ts`.
4. TDD sidebar: in `App.tsx`, hide the Contents toggle item and show the Files panel while `docKind` is a JSON kind.
**Acceptance Criteria:**
- `tests/unit/controller.test.ts` proves: drop accepts `.json`; captured text is ignored and the URL is read for `.json`; a stored draft is not restored and `dirty` stays `false`; mode switches from `split` to `read` on JSON open; `setMode('edit')` is ignored for JSON; Markdown behavior in existing tests is unchanged.
- `tests/unit/reader-store.test.ts` proves `?src=a.json&mode=edit` starts in `read`.
- `tests/unit/commands.test.ts` proves the availability table for JSON and Markdown.
- `tests/unit/file-handle.test.ts`, `tests/unit/directory.test.ts`, and `tests/unit/links.test.ts` prove JSON acceptance in the picker types, drop check, tree, and link marking.
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
