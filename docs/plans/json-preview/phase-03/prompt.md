# Phase 3: JsonView rendering, error banner, and end-to-end coverage

## Goal & Outcome

- Plan Goal: open standalone `.json` and `.jsonc` documents in the reader as highlighted, read-only text, with opt-in automatic redirect and view tools.
- Phase Outcome: a JSON document renders through a new `JsonView` component instead of `MarkdownView`, with a parse-error banner carrying message, line, and column, and the whole feature is covered end to end in Chromium. No toolbar yet; Phase 5 adds it.

## Context & Architecture

- Code root: `/home/ngosi/projects/markdown-reader` | Records root: `/home/ngosi/projects/markdown-reader` | Branch: `feat/json-preview` | Base: `refs/plans/json-preview/phase-03/base`
- Prior State: Phases 1, 2, and 4 are complete and in your base.
  - Phase 1 added `src/lib/doc-kind.ts` (zero imports; exports `type DocKind = 'markdown' | 'json' | 'jsonc'`, `docKindFromName(name)`, `isJsonName(name)`), `src/lib/json-document.ts`, the `general.renderJson` setting, and JSON redirect detection in `src/entrypoints/detect.content.ts` and `src/entrypoints/background.ts`.
  - Phase 2 added `docKind: DocKind` to `ReaderState`, set it on every load path in `src/reader/controller.ts`, made JSON read-only (`mode: 'read'`, `writable: false`, no draft saved or restored, captured text ignored), made `save`, `mode-edit`, `mode-split`, `toggle-raw`, and `export-html` unavailable for JSON in `src/reader/commands.ts`, accepted `.json` and `.jsonc` in the picker, drop, both trees, and `data-md-link`, and hid the Contents toggle for JSON in `src/entrypoints/reader/App.tsx`.
  - Phase 4 added the pure transform pipeline to `src/lib/json-document.ts`. Phase 3 does not use it; Phase 5 does.
- Code Context:
  - `src/lib/json-document.ts` exports `interface JsonParseError { message: string; line: number; column: number }`, `interface PreparedJson { text: string; error: JsonParseError | null }`, and `async prepareJson(text: string, kind: 'json' | 'jsonc'): Promise<PreparedJson>`. It strips a leading U+FEFF, returns `{ text: source, error: { message: 'Empty document', line: 1, column: 1 } }` for whitespace-only input, returns the first parse error with 1-based line and column alongside the original text, and otherwise returns the text, reformatted with 2-space indentation only when the trimmed text contains no line break. It lazy-imports `jsonc-parser`.
  - `src/ui/markdown-view.tsx` exports `type MarkdownViewHandle = { update(text: string): void; ready(): Promise<void> }`. `MarkdownView` is a `forwardRef` that renders exactly one element: `<div ref={container} data-slot="markdown" className="md-content" />`. It holds `controller = useRef(new AbortController())`, calls `enhance(target, controller.current.signal)`, and aborts that controller on unmount.
  - `src/render/enhance.ts` exports `async function enhance(root: HTMLElement, signal?: AbortSignal): Promise<void>`. It finds `pre > code` elements, highlights them through `highlight()`, sanitizes the result, and adds the code bar with Copy.
  - `src/render/highlight.ts`: `loadLanguage(language)` is a `switch` over language names returning a dynamic `import()`; `case 'json': loaded = import('shiki/langs/json.mjs')`. `const supported = new Set<BundledLanguage>([...])` lists the same names. `highlight(source, language)` returns `null` above 200 KB, and falls back to `<pre><code>escaped</code></pre>` for an unsupported language. `shiki/langs/jsonc.mjs` exists in `node_modules`.
  - `src/store/reader-store.ts`: `ReaderState` at line 20 starts with `docKind: DocKind`. `type Banner = { kind: 'error'; message: string } | { kind: 'externalChange' } | null` is at line 11. `initialState()` is at line 53. `selectBanners(state: Pick<ReaderState, 'error' | 'externalChange'>): NonNullable<Banner>[]` is at line 109 and pushes `error` first, then `externalChange`.
  - `src/ui/status-banner.tsx` renders `banners.map(...)` with a destructive `Alert` plus Retry and Dismiss for `error`, and a `role="status"` `Alert` plus Reload for `externalChange`.
  - `src/entrypoints/reader/App.tsx`: `Banners` at line 232 computes `selectBanners({ error, externalChange })` from two `useReaderStore` selectors. `Content` at line 464 selects `mode, mountText, loadId, source, loading, directorySource, docPath`, renders `<Spinner aria-label="Loading Markdown" />` while `loading`, and otherwise renders the `reader-panes` div with `EditorPane` for `mode !== 'read'` and `MarkdownView ref={viewRef}` for `mode !== 'edit'`. `viewRef` is declared at line 62 as `useRef<MarkdownViewHandle | null>(null)` and awaited through `viewRef.current.ready()` at lines 125 and 138 before print and export.
  - `tests/e2e/fixtures.ts` exports the extended `test`, `expect`, and `startFixtureServer(handler)` returning `{ server, origin, close }`. `tests/e2e/reload.spec.ts` shows the `file://` pattern: `mkdtemp` a temp dir, write the fixture, launch a persistent context twice to enable "Allow access to file URLs" on `chrome://extensions/?id=<id>`, then open `pathToFileURL(file)`.

## Invariants & Boundaries

- Preserve:
  - `MarkdownView`, `src/render/pipeline.ts`, `src/render/enhance.ts`, and `enhance()` behavior for Markdown are unchanged. Do not edit `src/ui/markdown-view.tsx`.
  - The fetch-error banner keeps its Retry and Dismiss buttons and its current wording.
  - Every Markdown path still renders through `MarkdownView` and produces headings and TOC data exactly as today.
  - Phase 2 read-only behavior is unchanged. This phase writes no draft, no setting, and never writes the source file.
  - Text reaches the DOM only through `textContent` or the existing sanitized `enhance()` path. Never assign `innerHTML` from document text.
- Out of Scope:
  - The JSON toolbar, `transformJson`, `unescapeJson`, Download, and `src/export/export.ts`. Those are Phase 5. Do not create `src/ui/json-toolbar.tsx`.
  - Any change to `src/lib/json-document.ts`, `tests/unit/json-document.test.ts`, `src/reader/controller.ts`, `src/reader/commands.ts`, or the detection entry points.
  - A Firefox workaround. The Coordinator records the manual Firefox check separately.
  - Do not read or edit `.env` or any credential file.

## Files

Allowed production and test paths:

- `src/ui/json-view.tsx` (create: the `JsonView` component)
- `src/render/highlight.ts` (modify: register `jsonc` in `loadLanguage` and `supported`)
- `src/store/reader-store.ts` (modify: add `parseError` to `ReaderState` and the `jsonError` banner to `Banner` and `selectBanners`)
- `src/ui/status-banner.tsx` (modify: render the `jsonError` banner)
- `src/entrypoints/reader/App.tsx` (modify: render `JsonView` for JSON kinds, pass `onParseError`, feed `parseError` into `Banners`, and change the loading label for JSON)
- `tests/unit/json-view.test.tsx` (create)
- `tests/unit/reader-store.test.ts` (modify)
- `tests/unit/reader-render.test.tsx` (modify)
- `tests/e2e/json-preview.spec.ts` (create)

Worker-owned phase records, written to the records root by absolute path:

- `/home/ngosi/projects/markdown-reader/docs/plans/json-preview/phase-03/notes.md` (append `## Task <M>` blocks)
- `/home/ngosi/projects/markdown-reader/docs/plans/json-preview/phase-03/journal.md` (append `# EXTERNAL RESPONSE` under `## Implementation Response`)

Read-only / Forbidden:

- Do not edit `PLAN.md`, `DESIGN.md`, `.handover.md`, `prompt.md`, any other phase directory, or any path not listed above.

## Tasks

- task-1: TDD highlighting. Add `case 'jsonc': loaded = import('shiki/langs/jsonc.mjs');` to `loadLanguage` and `'jsonc'` to `supported` in `src/render/highlight.ts`, following the existing pattern exactly.
- task-2: TDD `src/ui/json-view.tsx`. Create a `forwardRef` component implementing `MarkdownViewHandle` with props `{ text: string; kind: 'json' | 'jsonc'; onParseError(error: JsonParseError | null): void }`. It awaits `prepareJson(text, kind)`, reports the error (or `null`) through `onParseError`, and mounts `<div data-slot="markdown" className="md-content"><pre><code className="language-json">` or `language-jsonc`, with the prepared text set through `textContent`, then calls `enhance(root, signal)` with an `AbortController` that is aborted on unmount and before each new text or kind. `ready()` resolves after the pending `prepareJson` and `enhance` settle. A stale `prepareJson` result must never write into the DOM, call `onParseError`, or resolve a newer `ready()`. `prepareJson` can reject, for example with `RangeError` on deeply nested input; catch a rejection and report it through `onParseError` as `{ message: <error message>, line: 1, column: 1 }`, rendering the original text below.
- task-3: TDD the banner. Add `parseError: JsonParseError | null` to `ReaderState` with initial value `null`, and extend `Banner` with `{ kind: 'jsonError'; message: string; line: number; column: number }`. `selectBanners` takes `parseError` as well and pushes the `jsonError` banner after `error`. The controller is out of scope, so clear `parseError` from `JsonView` by reporting `null` on every successful parse; the `Banners` component must therefore read `parseError` from the store. `StatusBanner` renders the `jsonError` banner with no Retry and no Dismiss, as `<message> (line <line>, column <column>)`, and as the message alone when the message is `Empty document`.
- task-4: Wire `src/entrypoints/reader/App.tsx`. In `Content`, select `docKind`; for a JSON kind render `JsonView` with `ref={viewRef}`, `text={mountText}`, `kind={docKind}`, and `onParseError` writing `parseError` into the store; otherwise keep `MarkdownView` unchanged. Use `aria-label="Loading"` on the spinner for JSON kinds and keep `"Loading Markdown"` for Markdown. Add `parseError` to the `Banners` selectors and pass it to `selectBanners`.
- task-5: Create `tests/e2e/json-preview.spec.ts` covering, in Chromium: a `.json` page does not redirect while `general.renderJson` is off; it redirects once the setting is on; minified input shows formatted; a `.jsonc` fixture with comments renders highlighted; invalid JSON shows the banner with line and column above the original text; an empty file shows the banner; a file above 200 KB renders as plain text with the code bar; the code-bar Copy works; edit and Export HTML are unavailable while Print is available; and auto-refresh re-renders after the fixture changes on disk.

## Done When

- `tests/unit/json-view.test.tsx` proves: valid JSON mounts highlighted output; minified input is formatted; already formatted input is byte-identical; a parse error reaches `onParseError` with its line and column while the original text still renders; a rejected `prepareJson` is reported rather than thrown; and unmount aborts so a late result writes nothing.
- `tests/unit/reader-store.test.ts` proves `parseError` starts `null` and `selectBanners` places the `jsonError` banner after `error`.
- `tests/unit/reader-render.test.tsx` proves the JSON error banner renders above the original text and has no Retry button, and that the fetch-error banner still has Retry.
- `tests/e2e/json-preview.spec.ts` passes every case in task-5.
- Run from the code root, one at a time, never concurrently:
  - `pnpm typecheck` (Baseline: pass)
  - `pnpm lint` (Baseline: exit 0, 0 errors, 208 warnings, 3 infos. Leave the warning count no higher than you found it.)
  - `pnpm test` (Baseline: pass, 45 files, 609 tests. Expect your new tests to raise the counts.)
  - `pnpm test:e2e` (Baseline: last recorded pass at `bebf24f`, 189 tests, about 6 minutes. It builds first, then loads `.output/chrome-mv3` in Chromium. If it fails only in the `tests/e2e/appearance.spec.ts` code theme tests, a passing solo rerun of that spec counts as a pass; record that in `notes.md`.)

## Rules

Read and follow these bundled contracts:

- Contract: `/home/ngosi/projects/refract/plugin/shared/worker-contract.md`
- Response: `/home/ngosi/projects/refract/plugin/shared/erp.md`
- Notes: `/home/ngosi/projects/refract/plugin/shared/notes-template.md`
- Journal: `/home/ngosi/projects/refract/plugin/shared/journal-template.md`

Project conventions live in `CODING_STANDARDS.md` and `AGENTS.md` at the code root. Read both before writing code. `browser`, `defineBackground`, and `defineContentScript` are auto-imported by WXT; do not import them.

Role boundary: You are the phase implementer, not Coordinator. Edit code only inside the code root. Write phase records only under the records root path given above. Make no Git commit, no branch change, and no Refract job submission. Leave all Git operations to the Coordinator.

## Response Format

Append the complete `# EXTERNAL RESPONSE` block to `/home/ngosi/projects/markdown-reader/docs/plans/json-preview/phase-03/journal.md`, then return that block and the matching status line from `erp.md`.
