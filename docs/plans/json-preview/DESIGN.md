# JSON Preview Design

**Status:** Confirmed 2026-11-10
**Consultation:** Two consult jobs agreed on a dedicated `JsonView`, re-fetching JSON by URL, and extension-based kind detection; they split on `jsonc-parser` versus a local stripper, and the user chose `jsonc-parser`.

## Purpose

Open standalone `.json` and `.jsonc` documents in the reader as formatted, syntax-highlighted, read-only text.

## Users and Success Criteria

Users: people who already use Markdown Reader and want to read JSON files with the same themes, auto-refresh, and recents.

Success criteria:

1. With the new General setting on, an `http(s)` or `file://` URL ending in `.json` or `.jsonc` redirects to the reader and shows highlighted JSON.
2. With the setting off, which is the default, no JSON page redirects.
3. Open file, Open URL, drag-drop, and the Open folder tree accept `.json` and `.jsonc` regardless of the setting.
4. Minified input is reformatted. Already formatted input is shown exactly as written.
5. Numbers, key order, duplicate keys, string escapes, and JSONC comments are never altered.
6. Invalid input shows a banner with the parse error, line, and column, and the original text highlighted below it.
7. Edit, split, save, raw toggle, TOC, and Export HTML are unavailable for JSON. Preview, auto-refresh, Copy, recents, and Print work.

## Constraints, Invariants, and Non-Goals

Constraints:

- One new runtime dependency, `jsonc-parser`, pinned to an exact version and loaded with a dynamic import so it stays out of the content-script and background bundles.
- `src/lib/settings-flags.ts` stays Zod-free.

Invariants:

- Markdown loading, rendering, drafts, and redirect behavior are unchanged.
- Captured page text is still used for Markdown.
- Stored settings without the new key parse unchanged and default the flag to `false`.

Non-goals:

- JSON code blocks inside Markdown.
- A collapsible tree view or a raw/tree toggle.
- Editing or saving JSON.
- JSON5, NDJSON, and `.jsonl`.
- Detecting JSON by Content-Type or content sniffing for extensionless URLs.

## Chosen Approach

A dedicated `JsonView` component renders inside the existing `.md-content` wrapper and reuses `enhance()` for highlighting, sanitizing, the code bar, Copy, and the 200 KB highlight cap. `jsonc-parser` parses, reports errors, and formats with whitespace-only edits.

Rejected:

- Fenced block through the Markdown pipeline: backtick runs in strings break the fence, and markdown-it parsing, footnote guards, and heading collection run for no benefit.
- `JsonView` with `JSON.parse` and `JSON.stringify` plus a local JSONC stripper: reformatting rounds large integers and reorders integer-like keys, error messages differ by browser, and the stripper needs about 45 hand-written lines.

## Architecture and Data Flow

1. **Document kind.** `ReaderState` gains `docKind: 'markdown' | 'json' | 'jsonc'`. One helper, `docKindFromName(name)`, derives it from the URL pathname or file name extension. `load`, `openFileHandle`, `drop`, and `selectTreeFile` all set it.
2. **Setting.** `general.renderJson`, default `false`, is added to `GeneralFlags` in `src/lib/settings-flags.ts`, to `Settings`, `defaultSettings`, and the schema in `src/lib/settings.ts`, to `src/ui/settings/general-tab.tsx`, and to `src/i18n/en-US.ts`.
3. **Detection.** `src/entrypoints/detect.content.ts` adds `*://*/*.json`, `*://*/*.jsonc`, `file:///*.json`, and `file:///*.jsonc` to `matches`. It redirects when `enabled` and `renderJson` are on, the pathname ends in `.json` or `.jsonc`, and `document.contentType` is `application/json`, `text/json`, `text/plain`, empty, or ends with `+json`. `isMarkdownLink`, `isValidCapture`, and the context menu in `src/entrypoints/background.ts` accept those extensions.
4. **Loading.** For JSON kinds, `controller.load` ignores captured text and always reads through `FileUrlSource` or `UrlSource`, because Chrome's Pretty-print toolbar and Firefox's JSON viewer alter `innerText`. The picker types and `isValidMarkdownFile` in `src/source/file-handle.ts`, `drop` in `src/reader/controller.ts`, `buildTree` and link resolution in `src/source/directory.ts`, and `resolveLink` in `src/render/links.ts` accept `.json` and `.jsonc`.
5. **Read-only.** For JSON kinds, `applyText` creates no draft saver and restores no draft. Mode is forced to `read`, and `writable` is `false`. `parseMode` usage clamps `?mode=edit` and `?mode=split` to `read`. `CommandState` in `src/reader/commands.ts` gains `docKind`; `save`, `mode-edit`, `mode-split`, `toggle-raw`, and `export-html` become unavailable. `src/ui/reader-menu.tsx` and `src/ui/command-palette.tsx` select `docKind`. The sidebar hides the Contents tab and shows Files.
6. **Rendering.** `Content` in `src/entrypoints/reader/App.tsx` renders `JsonView` instead of `MarkdownView` for JSON kinds. `JsonView`:
   - lazy-loads `jsonc-parser`;
   - strips a leading U+FEFF;
   - parses with `allowTrailingComma` and comments allowed only for `jsonc`;
   - applies `format()` with 2-space indentation only when the trimmed text has no line break and parsing succeeded;
   - mounts `<div data-slot="markdown" class="md-content"><pre><code class="language-json|jsonc">` with the text set through `textContent`;
   - calls `enhance(root, signal)`;
   - implements `MarkdownViewHandle` so print and readiness waits keep working.
   `src/render/highlight.ts` registers `jsonc` in `loadLanguage` and `supported`.
7. **Auto-refresh and recents.** These use the existing `setActive`, `startWatch`, and `addRecentUrl` with no change.

## Errors and Edge Cases

1. **Parse error.** `JsonView` reports the first error as `parseError: { message, line, column }` in the store. `selectBanners` adds a `{ kind: 'jsonError' }` banner without Retry. The original text renders below it, unformatted and highlighted. The fetch `error` path and its Retry button are unchanged.
2. **BOM.** A leading U+FEFF is stripped before parsing and formatting.
3. **Empty file.** The banner shows "Empty document" above an empty code block.
4. **Large files.** Above 200 KB, `highlight()` returns `null` and `enhance()` keeps plain text with the code bar. Parsing and formatting still run.
5. **Mode carry-over.** Opening a JSON document while in edit or split mode switches to `read`. The earlier mode is not restored for the next Markdown document.
6. **Stale drafts.** A stored draft for a JSON source key is ignored and never sets `dirty`.
7. **Firefox.** If Firefox's JSON viewer prevents the content script from running, auto-redirect fails there and manual entry points still work. Implementation verifies this and documents the result without adding a workaround.
8. **file:// access.** This works as it does for Markdown and needs the browser's "Allow access to file URLs" permission.

## Migration

The new setting defaults to `false` through the schema fallback. Existing stored settings parse unchanged. No data migration is needed.

## Testing

Vitest, in `tests/unit/`:

- `detect.test.ts`: flag on and off, each MIME type, each extension, `text/html` rejected.
- `background.test.ts`: `isMarkdownLink` and `isValidCapture` with `.json` and `.jsonc`.
- `settings.test.ts`, `settings-flags.test.ts`: `renderJson` default and invalid-value fallback.
- New `json-view.test.ts` or `json-format.test.ts`: minified input reformatted, formatted input unchanged, comments and big integers preserved, BOM stripped, empty input, error line and column, trailing commas and comments accepted only for `jsonc`.
- `controller.test.ts`: drop accepts JSON, captured text ignored for JSON, no draft restored, mode forced to `read`.
- `commands.test.ts`: availability for JSON.
- `file-handle.test.ts`, `directory.test.ts`, `links.test.ts`: JSON accepted.
- `reader-render.test.tsx`: banner above the original text.

Playwright, in `tests/e2e/`:

- `file://` JSON fixture with redirect off and on.
- Invalid JSON fixture shows the banner and highlighted text.
- Edit, split, and Export HTML unavailable; Print available.
- Highlighting and Copy.
- Auto-refresh after a fixture change.
- A file above 200 KB renders without highlighting and stays responsive.

## Risks and Open Questions

- **Overlap with `file-url-folder-tree`.** That plan is `ACTIVE` at Phase 0 and modifies `src/lib/settings.ts`, `src/ui/settings/general-tab.tsx`, `src/i18n/en-US.ts`, `src/source/directory.ts`, `src/reader/controller.ts`, `src/entrypoints/reader/App.tsx`, and `src/ui/file-tree.tsx`. Its Phase 2 invariant keeps the picker tree `.md`/`.markdown` only, which conflicts with item 4 of Architecture and Data Flow. Decided 2026-11-10: this plan runs after `file-url-folder-tree` completes and builds on its tree code, including the `file://` tree.
- **Firefox redirect** is unverified; see Errors and Edge Cases item 7.
- **Bundle size** of `jsonc-parser` is unmeasured; the dynamic import keeps it out of the content-script and background bundles.
- **Tree pruning.** Folders that contain only JSON files will appear in the Open folder tree once `buildTree` accepts JSON.
