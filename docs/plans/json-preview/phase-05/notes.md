<!-- refract-shared-version: 3.0.1 -->

# Phase 5 Decision Notes

<!-- Created by the worker per worker-contract.md. Append one `## Task <M>` block per task, then one `## Inherited debt` block. -->

## Task 1: downloadText extraction

- Extracted `downloadText(filename: string, text: string, mime: string): void` from `downloadHtml` in `src/export/export.ts`.
- Blob creation, Object URL generation, temporary anchor appending, click triggering, removal, and delayed URL revocation (1000ms timeout) are centralized in `downloadText`.
- `downloadHtml` retains its own slug generation and `.html` suffix logic, calling `downloadText` with the final standalone HTML string and MIME type `text/html;charset=utf-8`.
- Added unit test `it('triggers downloadText with filename, text, MIME type, and revokes URL after timeout')` in `tests/unit/export.test.ts` verifying filename, payload, MIME type, and timer-driven URL revocation while preserving all existing `downloadHtml` test assertions.

## Task 2: Controlled JsonToolbar component

- Created `src/ui/json-toolbar.tsx` as a pure controlled component accepting `kind`, `options`, `unescaped`, `canUnescape`, `disabled`, `parses`, `onChange`, `onUnescape`, `onRevert`, and `onDownload`.
- Built exclusively with repository UI primitives: `ToggleGroup` and `ToggleGroupItem` from `src/components/ui/toggle-group.tsx`, `Select`, `SelectTrigger`, `SelectValue`, `SelectContent`, and `SelectItem` from `src/components/ui/select.tsx`, `Toggle` from `src/components/ui/toggle.tsx`, and `Button` from `src/components/ui/button.tsx`.
- Layout control offers `original`, `beautify`, and `minify` options.
- Indent control offers `2 spaces`, `4 spaces`, and `Tab`, disabled when layout is not beautify or when decoded unescaped text fails parsing.
- Sort keys toggle includes tooltip/title clarifying that sorting reformats the layout.
- Strip comments toggle is rendered strictly for `kind === 'jsonc'`, and is shown checked and disabled/locked while `sortKeys` is true.
- Escape toggle remains accessible even if unescaped text fails JSON parsing.
- Unescape / Revert action renders only when `canUnescape || unescaped`.
- Added i18n dictionary entries under `json` in `src/i18n/en-US.ts` for all toolbar labels and descriptions.
- Created `tests/unit/json-toolbar.test.tsx` verifying: Strip comments hidden for JSON, Strip comments checked and locked under Sort keys, every view tool disabled on parse error while Download stays active, Unescape shown only when `canUnescape`, Revert shown when `unescaped`, and only Escape remaining enabled when decoded text does not parse.

## Task 3: JsonView toolbar state and pipeline wiring

- Integrated `JsonToolbar` into `src/ui/json-view.tsx` above the code container within the `.md-content` root element.
- Initialized toolbar state according to the open rule: Beautify with 2-space indentation when trimmed source has no line breaks, Original layout otherwise, with toggles defaulting to off.
- Document reset rule: opening a different document resets options and unescape state to the open rule, while same-source text updates (auto-refresh) preserve toolbar state. Reverts out of unescaped mode across auto-refresh if the new root is no longer a string.
- Asynchronous pipeline execution is guarded by `genRef` generation counter and `AbortController` signal, ensuring stale transforms never overwrite newer states or resolve newer `ready()` waits.
- Document parse errors reported by `prepareJson` disable view tools, display the original source text with line/column banner, and direct Download/Copy to the original text.
- Catches runtime rejections (such as `RangeError` from deep nesting) from `transformJson` and `unescapeJson` and routes them to `onParseError({ message, line: 1, column: 1 })`.
- Transformed text reaches DOM strictly through `textContent` and the sanitized `enhance()` pipeline.
- Maintained `onParseError(null)` cleanup in unmount effect.
- Download names files `<stem>.json`, or `<stem>.jsonc` when comments remain in view (`hasComments === true`).
- Added `source={source}` pass-through in `src/entrypoints/reader/App.tsx`.
- Styled `.json-toolbar` in `src/styles/reader.css` and added `.json-toolbar` to the print exclusion rule (`display: none !important`).
- Extended `tests/unit/json-view.test.tsx` with unit tests for open rule, reset on new source, preserved state on refresh, unescape reversion on refresh, stale transform abort, and rejected `transformJson` reporting.

## Task 4: End-to-end Chromium coverage in tests/e2e/json-preview.spec.ts

- Added `/escaped.json` fixture to the e2e fixture server.
- Extended `tests/e2e/json-preview.spec.ts` with 7 comprehensive tests:
  1. `toolbar layout and indent change the view`: tests Original, Beautify (2 spaces, 4 spaces, Tab), and Minify.
  2. `Sort keys locks and checks Strip comments on JSONC`: tests locking and stripping behavior.
  3. `Escape and Unescape round trip`: tests unescaping JSON string, toggling escape, and reverting.
  4. `code-bar Copy copies the current view`: tests that code-bar Copy captures the transformed (minified) view to the clipboard.
  5. `Download saves view with correct name and content`: verifies filename extension switching (`.jsonc` vs `.json`) based on comment presence and validates downloaded file contents via Playwright `download` event streams.
  6. `auto-refresh keeps toolbar state`: verifies that file changes on disk trigger auto-refresh while preserving active toolbar toggles.
  7. `a parse error disables the tools and Download uses original text`: verifies that invalid JSON disables view tools while Download remains enabled and exports original raw text.

## Inherited debt

1. **Phase 1: Badge title in background.ts**: The string `"Markdown Reader: this link is not a supported Markdown URL"` is hardcoded inline at `src/entrypoints/background.ts:38`, not in `src/i18n/en-US.ts`. Because `src/entrypoints/background.ts` is outside the authorized file set for Phase 5, fixing the wording requires modifying `background.ts` and remains deferred.
2. **Phase 2: docKind optional in CommandState**: Making `docKind` required in `CommandState` is blocked because `src/ui/toolbar.tsx` is outside the Phase 5 authorized file set.
3. **Phase 3: parseError reset location**: Confirmed that `JsonView` clearing `parseError` on unmount (`onParseError(null)`) is sufficient and correct. Toolbar and download paths do not require controller-side reset because state is scoped per document and resets when navigating between sources.
4. **Phase 4: Single source of truth for displayed text**: Ownership is strictly divided:
   - On parse error: `prepareJson` error path owns the view and displays the exact original `sourceText` (preserving original line breaks and formatting under the error banner).
   - On valid parse: `transformJson` (or `unescapeJson` when in unescaped mode) is the sole source of truth for the displayed text across every layout (Original, Beautify, Minify) and toggle. Line endings are consistently normalized to LF, avoiding any mixing of CRLF and LF texts.
5. **Phase 4: sortKeys under original layout**: Sorting keys requires AST reconstruction and inherently emits formatted/compact output. Reflected in toolbar UX by providing `title={t('json.sortKeysDescription')}` ("Sort keys (formats as beautified)") on the Sort keys toggle.
6. **Phase 4: RangeError on deeply nested input**: Wrapped both `transformJson` and `unescapeJson` in try/catch blocks within `JsonView`. Any caught rejection reports `{ message, line: 1, column: 1 }` via `onParseError` and displays the source text without throwing uncaught exceptions. Verified by unit test.
7. **Phase 4: Blank line left after comment stripping**: Observed rendered view in Chromium. When comments occupying whole lines are stripped, Beautify and Minify layouts remove extraneous whitespace completely. Under Original layout with Strip comments only, blank lines remain where line comments were located, preserving line position correlation. Visually acceptable in code blocks; any AST-level trivia adjustment would belong in `src/lib/json-document.ts`, which is outside the Phase 5 file set.
