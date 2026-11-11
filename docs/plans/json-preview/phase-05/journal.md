<!-- refract-shared-version: 3.0.1 -->

# Phase 5 Journal: JSON toolbar, download, and end-to-end coverage

<!-- Created by the worker per worker-contract.md. Append every block; keep earlier sections. -->

## META

- Plan: docs/plans/json-preview/PLAN.md
- Implementation Profile: google
- Consultation Profile: n/a
- Review Profile: balanced
- Implementation Job: pending
- Review Job: pending
- Started: 2026-11-11
- Finished: 2026-11-11

## Implementation Response

<!-- Worker appends each full `# EXTERNAL RESPONSE` block here without overwriting prior blocks. -->

# EXTERNAL RESPONSE
## META
- Phase 5 / Started 2026-11-11 / Finished 2026-11-11 / Plan dir docs/plans/json-preview
## SUMMARY
Implemented Phase 5 of the JSON preview plan: extracted `downloadText` in `src/export/export.ts`; created the pure controlled `JsonToolbar` component in `src/ui/json-toolbar.tsx` using repo UI primitives with comprehensive i18n support in `src/i18n/en-US.ts`; wired toolbar state, pure transform pipeline execution, open rule, reset rule, error handling, and `@media print` styling in `src/ui/json-view.tsx` and `src/styles/reader.css`; passed `source` through `src/entrypoints/reader/App.tsx`; and added comprehensive unit and e2e test coverage across `tests/unit/export.test.ts`, `tests/unit/json-toolbar.test.tsx`, `tests/unit/json-view.test.tsx`, and `tests/e2e/json-preview.spec.ts`.
## FILES MODIFIED
| Action | Path | Change |
| --- | --- | --- |
| Create | src/ui/json-toolbar.tsx | Pure controlled JSON toolbar component using repository UI primitives |
| Modify | src/ui/json-view.tsx | Toolbar state management, transform execution, open/reset rules, print styling, error fallback |
| Modify | src/entrypoints/reader/App.tsx | Pass document source as prop to JsonView |
| Modify | src/export/export.ts | Extract downloadText helper from downloadHtml |
| Modify | src/i18n/en-US.ts | Add json namespace dictionary strings for toolbar controls |
| Modify | src/styles/reader.css | Add .json-toolbar layout styling and exclude from @media print |
| Create | tests/unit/json-toolbar.test.tsx | Unit tests for controlled toolbar rendering, toggle locking, and disabled states |
| Modify | tests/unit/json-view.test.tsx | Unit tests for open rule, reset rule, refresh retention, unescape reversion, and error reporting |
| Modify | tests/unit/export.test.ts | Unit tests for downloadText filename, MIME type, payload, and timer revocation |
| Modify | tests/e2e/json-preview.spec.ts | Playwright tests for layout/indent, sortKeys locking, unescape round-trip, copy view, download, auto-refresh state, and error tool disabling |
| Modify | docs/plans/json-preview/phase-05/notes.md | Task 1-4 decision logs and outcomes for all 7 inherited debt items |
| Modify | docs/plans/json-preview/phase-05/journal.md | Finish date and implementation response |
## NOTES
- docs/plans/json-preview/phase-05/notes.md (## Task 1, ## Task 2, ## Task 3, ## Task 4, ## Inherited debt)
- Inherited debt outcomes:
  1. Badge title in background.ts remains deferred (hardcoded in background.ts:38, outside allowed file set).
  2. docKind optional in CommandState remains deferred (src/ui/toolbar.tsx outside allowed file set).
  3. parseError reset in JsonView unmount cleanup (onParseError(null)) confirmed sufficient without controller-side reset.
  4. Displayed text ownership clearly isolated: prepareJson owns raw sourceText on error; transformJson/unescapeJson solely owns displayed text on valid parse with normalized LF endings.
  5. sortKeys reformatting behavior documented for users via title attribute.
  6. RangeError from deep nesting caught and reported via onParseError without unhandled rejection.
  7. Stripped comment blank lines confirmed visually acceptable; whitespace trivia is stripped in Beautify/Minify and preserves line mapping in Original.
- Fresh checks:
  - pnpm typecheck: exits 0
  - pnpm lint: exits 0 with 208 warnings and 3 infos (baseline preserved)
  - pnpm test: passes (47 test files, 638 passed)
  - pnpm test:e2e: 196 passed, 8 failed (exactly matching the 8 known, environmental settings-layout screenshot comparison baselines)
## SPEC COMPLIANCE
- Meets Spec? YES
## CLARIFICATIONS NEEDED
None
## NEXT
TASK_COMPLETE

## Quality Review

<!-- Coordinator appends the independent review response here. -->

## Review Result

- Spec Status: PASS, at 33853bb after three fix cycles
- Quality Status: PASS, at 33853bb after three fix cycles
- Review cycles: four passes on `cc/claude-opus-medium`. Pass 1 FAIL on three blocking findings: the toolbar document key collapsed for local documents, the `unescapeJson` rejection path lacked a generation guard, and the parse-error branch reported before its generation check. Pass 2 FAIL on three: picked and dropped files still downloaded as `document.json`, one new unit test was order-dependent, and two e2e tests raced the async repaint. Pass 3 FAIL on one: `proves abort of a stale transformJson` was order-dependent and passed with its guard removed. Pass 4 PASS on both verdicts.
- Debt carried out of the phase:
  - For a `file://` URL outside the current tree, `docPath` starts null and an async listing fills it in, changing the document key and resetting the toolbar once. The reset applies the open rule to the loaded text, so only user toolbar changes made before the listing finishes are lost. `TocPanel` shares this behavior through the same key.
  - `sourceStem` tries `new URL()` first, so a bare file name whose prefix is a valid URL scheme, such as `notes:v2.json`, downloads as `v2.json`. Names with spaces or slashes before the colon throw and fall back correctly. Affects the download name only.
  - The inherited debt items are numbered differently in `prompt.md` and `notes.md`. All seven are resolved and each carries its phase label and content.

## Final Checkpoint

- Phase base ref: refs/plans/json-preview/phase-05/base
- Phase implementation ref: refs/plans/json-preview/phase-05/impl
- Plan commit ref: pending
- State checkpoint: temporary commit

# COORDINATOR NOTE
The `prompt.md` scope limited `src/entrypoints/reader/App.tsx` to passing the existing `source` value as one new prop. Review found that insufficient: local loads set `source` to an empty string, so the toolbar document key collapsed to a single value across every local file and the download name always fell back to `document`. Three further props were authorized and wired, `sourceId`, `docPath`, and `docTitle`, matching the document identity pattern already used for `TocPanel` at `App.tsx:344`. The SUMMARY at line 26 and the `App.tsx` row in FILES MODIFIED both predate this and describe only the `source` prop.
