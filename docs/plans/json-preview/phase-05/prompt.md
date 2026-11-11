# Phase 5: JSON toolbar, download, and end-to-end coverage

## Goal & Outcome

Add a view toolbar to `JsonView` so users transform, copy, and download the JSON view without ever changing the source file. Cover every tool end to end in Chromium.

This is the last phase of the `json-preview` plan. Phases 1 through 4 are complete and on the branch already: the JSON document core and `renderJson` setting, reader state and read-only rules, `JsonView` rendering with the parse-error banner, and the pure transforms in `src/lib/json-document.ts`.

## Context & Architecture

Read first:

- `docs/plans/json-preview/DESIGN.md`, in particular decisions 8, 9, and 10.
- `docs/plans/json-preview/PLAN.md`, the Phase 5 section.
- `src/lib/json-document.ts`, which already exports everything you need to transform text. Do not change it.
- `src/ui/json-view.tsx`, the component you are extending.
- `CODING_STANDARDS.md` and `AGENTS.md`.

The pure transforms already exist and are tested. Phase 5 wires them to a UI; it does not reimplement them.

```ts
export type JsonLayout = 'original' | 'beautify' | 'minify';
export type JsonIndent = 2 | 4 | 'tab';
export type JsonViewOptions = { layout: JsonLayout; indent: JsonIndent; sortKeys: boolean; stripComments: boolean; escape: boolean };

export async function transformJson(source: string, kind: 'json' | 'jsonc', options: JsonViewOptions): Promise<{ text: string; hasComments: boolean }>;
export async function unescapeJson(source: string, kind: 'json' | 'jsonc'): Promise<{ text: string; parses: boolean } | null>;
```

`unescapeJson` resolves `null` when the parsed root is not a string. That is the signal for `canUnescape`.

`JsonView` today holds a generation counter and an `AbortController`, writes text with `textContent`, and then calls `enhance()`. Every new async path you add goes under those same guards.

## Invariants & Boundaries

- The source file is never written. No draft, no settings, no storage. Download goes through the browser download only.
- `downloadHtml` output bytes and its file name are unchanged. You are extracting its Blob and anchor code, not altering its behavior.
- Transformed text reaches the DOM only through `textContent` plus the existing sanitized `enhance()` path. Never `innerHTML` with document text.
- Parse-error banner behavior from Phase 3 is unchanged, including the `onParseError(null)` call in the unmount cleanup. Do not remove it.
- No command-palette entries, no keyboard shortcuts, no stored settings. Toolbar state is not remembered across documents.
- Do not touch `src/lib/json-document.ts`, `src/ui/markdown-view.tsx`, or `src/reader/controller.ts`.

## Files

Allowed paths, and nothing else:

| Action | Path |
| --- | --- |
| Create | `src/ui/json-toolbar.tsx` |
| Modify | `src/ui/json-view.tsx` |
| Modify | `src/entrypoints/reader/App.tsx` |
| Modify | `src/export/export.ts` |
| Modify | `src/i18n/en-US.ts` |
| Modify | `src/styles/reader.css` |
| Create | `tests/unit/json-toolbar.test.tsx` |
| Modify | `tests/unit/json-view.test.tsx` |
| Modify | `tests/unit/export.test.ts` |
| Modify | `tests/e2e/json-preview.spec.ts` |
| Modify | `docs/plans/json-preview/phase-05/notes.md` |
| Modify | `docs/plans/json-preview/phase-05/journal.md` |

`src/entrypoints/reader/App.tsx` is an addition to the file list in `PLAN.md`, authorized by the Coordinator. `JsonView` needs the document source to name the download and to decide when to reset toolbar state, and `App.tsx` is the only place that has it. Keep that change to passing the existing `source` value as one new prop. Do not restructure `App.tsx`.

The existing UI primitives are in `src/components/ui/`: `toggle-group.tsx`, `select.tsx`, `toggle.tsx`, `button.tsx`. Use them. Do not add a dependency and do not hand-roll a control that already exists there.

## Tasks

Work in order. Each task is test-first: write the failing test, see it fail for the right reason, then make it pass.

1. **`downloadText` in `src/export/export.ts`.** Extract `downloadText(filename: string, text: string, mime: string): void` from the Blob and anchor code inside `downloadHtml`, and make `downloadHtml` call it. `downloadHtml` keeps its own slug and `.html` suffix logic; only the Blob, object URL, anchor, click, and revoke move.
2. **`src/ui/json-toolbar.tsx`.** A controlled component. Props: `kind: 'json' | 'jsonc'`, `options: JsonViewOptions`, `unescaped: boolean`, `canUnescape: boolean`, `disabled: boolean`, and `onChange`, `onUnescape`, `onRevert`, `onDownload` callbacks. It holds no state of its own. Add every label to `src/i18n/en-US.ts`.
3. **Toolbar state in `src/ui/json-view.tsx`.** Hold the options, run `transformJson` or `unescapeJson` under the existing generation and `AbortController` guards, and render through the existing `textContent` and `enhance()` path. Hide the toolbar under `@media print` in `src/styles/reader.css`.
4. **Extend `tests/e2e/json-preview.spec.ts`.** Cover every use case listed under Done When.

## Behavior rules

These are the rules the tests must pin. They come from DESIGN.md decisions 8 and 9.

- **Open rule.** Layout starts as Beautify with 2 spaces when the trimmed source has no line break, otherwise Original. Every toggle starts off.
- **Reset rule.** Opening a different document resets the toolbar to the open rule. A text change at the same source, which is what auto-refresh does, keeps toolbar state.
- **Sort keys.** Implies Strip comments. The toolbar shows Strip comments checked and locked while Sort keys is on.
- **Strip comments.** Hidden entirely for `kind === 'json'`, since a `.json` document has no comments to strip.
- **Unescape.** Offered only when the parsed root is a string, which is when `unescapeJson` resolves non-`null`. The decoded string becomes the pipeline input with kind `json`, and the button becomes Revert. If the decoded text does not parse, show it as plain text and leave only Escape enabled.
- **Unescape across refresh.** Auto-refresh keeps toolbar state, but if the new source root is no longer a string, revert out of the unescaped view.
- **Parse error.** Every tool is disabled, and Copy and Download use the original text.
- **Download name.** `<source stem>.json`, or `<source stem>.jsonc` while the view still contains comments. `transformJson` returns `hasComments` for exactly this.
- **Copy.** The existing code-bar Copy added by `enhance()` copies the displayed text. Confirm it already does; do not duplicate it.

## Inherited debt you own

These came out of earlier phases and are yours to resolve or to explicitly re-own with a reason. Record the outcome of each in `notes.md`.

1. **Phase 1.** The badge title in `src/entrypoints/background.ts` still reads "this link is not a supported Markdown URL" although JSON links are now accepted. You already edit `src/i18n/en-US.ts`. If the string lives there, fix the wording. If fixing it needs `background.ts` itself, which is outside your file set, leave it and say so.
2. **Phase 2.** `docKind` is optional in `CommandState` because `src/ui/toolbar.tsx` sat outside the Phase 2 file set. `src/ui/toolbar.tsx` is also outside your file set. Report whether making it required is still blocked.
3. **Phase 4.** A comment occupying a whole line leaves a blank line after stripping. Judge it against the rendered view. If it looks wrong on screen, say so; the fix would live in `src/lib/json-document.ts`, which you must not touch, so this is a report, not a change.
4. **Phase 4, important.** CRLF sources are normalized to LF by `transformJson`, while `prepareJson(...).text` keeps CRLF. **Never mix the two texts in one view.** Once the toolbar is driving the view, the displayed text must come from one source of truth. State in `notes.md` which function owns the displayed text in each state.
5. **Phase 4.** `sortKeys` under the `original` layout returns beautified output, because sorting rebuilds the text. Reflect this in the toolbar wording so the user is not surprised.
6. **Phase 4.** Deeply nested input raises `RangeError` from `transformJson` and `unescapeJson`. Catch the rejection and report it through the existing `onParseError` path, exactly as Phase 3 already does for `prepareJson`. Add a test.
7. **Phase 3.** `PLAN.md` Phase 3 task 3 worded `parseError` as "cleared on every load", which would live in `src/reader/controller.ts`. `JsonView` clears it on unmount instead. Confirm the toolbar and download paths need no controller-side reset, and say so explicitly.

## Done When

All four suites pass fresh, run one at a time:

- `pnpm typecheck` exits 0.
- `pnpm lint` exits 0 with no more than 208 warnings and 3 infos. That is the baseline; do not raise it.
- `pnpm test` passes. The baseline is 46 files and 624 tests.
- `pnpm test:e2e` passes. The baseline is 189 passed with 8 failed, where all 8 failures are `tests/e2e/settings-layout.spec.ts` screenshot comparisons. `AGENTS.md` documents those as rendered on the `CI E2E` runner and divergent on local system fonts. **They are known and environmental. Do not try to fix them and do not update those snapshots.** Every other test must pass.

Acceptance criteria:

- `tests/unit/export.test.ts` proves `downloadText` file name, MIME type, and URL revocation, and the existing `downloadHtml` tests pass unchanged.
- `tests/unit/json-toolbar.test.tsx` proves Strip comments hidden for `json`, Strip comments locked under Sort keys, every tool disabled on parse error, and Unescape shown only when `canUnescape`.
- `tests/unit/json-view.test.tsx` proves the open rule, reset on a new source, kept state on refresh, Unescape reverted on refresh when the root is no longer a string, abort of a stale transform, and a rejected `transformJson` reported rather than thrown.
- `tests/e2e/json-preview.spec.ts` covers layout and indent changing the view, Sort keys locking Strip comments, Escape and Unescape round trip, Copy copying the view, Download file name and content through the Playwright `download` event, auto-refresh keeping toolbar state, and a parse error disabling the tools.

Every new test must genuinely fail if the production code it covers is removed. A test that passes either way is not coverage.

## Rules

- Test-first. Write the test, run it, see it fail for the right reason, then make it pass.
- Touch only the paths listed above.
- Do not change `src/lib/json-document.ts`. If you believe a transform is wrong, report it instead of editing it.
- Match the surrounding code style. Keep comment density as it is in the files you edit.
- Run `pnpm format` after editing Markdown.
- Append one `## Task <N>` block per task to `docs/plans/json-preview/phase-05/notes.md`, and a block for the inherited debt outcomes.
- Do not commit. The Coordinator commits.
- If a requirement here contradicts `PLAN.md` or `DESIGN.md`, stop and report it under CLARIFICATIONS NEEDED rather than choosing silently.

## Response Format

Return exactly the `# EXTERNAL RESPONSE` block defined in the worker contract, with META, SUMMARY, FILES MODIFIED, NOTES, SPEC COMPLIANCE, CLARIFICATIONS NEEDED, and NEXT. Append the same block to `docs/plans/json-preview/phase-05/journal.md` under `## Implementation Response` without overwriting anything already there.
