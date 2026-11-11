<!-- refract-shared-version: 3.0.1 -->

# Phase 4 Journal: Pure JSON view transforms

<!-- Created by the worker per worker-contract.md. Append every block; keep earlier sections. -->

## META

- Plan: docs/plans/json-preview/PLAN.md
- Implementation Profile: balanced
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
- Phase 4 / Started 2026-11-11 / Finished 2026-11-11 / Plan dir docs/plans/json-preview
## SUMMARY
Added `transformJson`, its types, and `unescapeJson` to `src/lib/json-document.ts` with 18 new tests covering layout, strip, sort, and escape.
## FILES MODIFIED
| Action | Path | Change |
| --- | --- | --- |
| Modify | src/lib/json-document.ts | Add types, `transformJson`, `unescapeJson` |
| Modify | tests/unit/json-document.test.ts | Append transform coverage |
| Modify | docs/plans/json-preview/phase-04/notes.md | Task 1 to 3 blocks |
| Modify | docs/plans/json-preview/phase-04/journal.md | META finish time and this response |
## NOTES
- phase-04/notes.md  (## Task 1, ## Task 2, ## Task 3)
- Fresh checks: typecheck pass; lint exit 0 with 208 warnings, 3 infos; test 45 files, 580 passed
## SPEC COMPLIANCE
- Meets Spec? YES
## CLARIFICATIONS NEEDED
None
## NEXT
TASK_COMPLETE

## Quality Review

<!-- Coordinator appends the independent review response here. -->

## Review Result

- Spec Status: PENDING
- Quality Status: PENDING
- Debt: none

## Final Checkpoint

- Phase base ref: refs/plans/json-preview/phase-04/base
- Phase implementation ref: refs/plans/json-preview/phase-04/impl
- Plan commit ref: pending
- State checkpoint: temporary commit

### Review Fix Cycle 1 Response

# EXTERNAL RESPONSE
## META
- Phase 4 / Started 2026-11-11 / Finished 2026-11-11 / Plan dir docs/plans/json-preview
## SUMMARY
Fixed all seven review findings in `src/lib/json-document.ts` and its tests; the NBSP and `\v` claim in finding 5 is wrong for `jsonc-parser` 3.3.1, so only the BOM mismatch was fixed.
## FILES MODIFIED
| Action | Path | Change |
| --- | --- | --- |
| Modify | src/lib/json-document.ts | LF normalization, strip drops trivia before comments, `parses` via `parseTree`, `EOF` and `LINE_BREAK` constants, explicit trivia kinds, doc comment |
| Modify | tests/unit/json-document.test.ts | Order, exact sort fallback, strip, CRLF, BOM, and NBSP tests |
| Modify | docs/plans/json-preview/phase-04/notes.md | `## Review fixes` block and deep-nesting note |
| Modify | docs/plans/json-preview/phase-04/journal.md | This response |
## NOTES
- phase-04/notes.md  (## Review fixes)
- Fresh checks: typecheck pass; lint exit 0 with 208 warnings, 3 infos; test 45 files, 608 passed
## SPEC COMPLIANCE
- Meets Spec? YES
## CLARIFICATIONS NEEDED
None
## NEXT
TASK_COMPLETE

### Review Fix Cycle 2 Response

# EXTERNAL RESPONSE
## META
- Phase 4 / Started 2026-11-11T19:10:00+07:00 / Finished 2026-11-11T19:17:00+07:00 / Plan dir docs/plans/json-preview
## SUMMARY
Strip now drops the trivia before a removed comment only for a trailing comment, so a leading comment keeps its original indentation.
## FILES MODIFIED
| Action | Path | Change |
| --- | --- | --- |
| Modify | src/lib/json-document.ts | `isTrailingComment` helper; strip keeps the preceding trivia of a leading comment and always drops the trivia after a comment |
| Modify | tests/unit/json-document.test.ts | Corrected expected indent in the strip trivia test; added leading-indent and trailing-space test |
| Modify | docs/plans/json-preview/phase-04/notes.md | `## Review fixes, cycle 2` block |
| Modify | docs/plans/json-preview/phase-04/journal.md | This response |
## NOTES
- phase-04/notes.md  (## Review fixes, cycle 2)
- Fresh checks: typecheck pass; lint exit 0 with 208 warnings, 3 infos; test 45 files, 609 passed
## SPEC COMPLIANCE
- Meets Spec? WITH_DEBT: whole-line comment leaves a blank line, and CRLF source bytes differ from the original view; both accepted and recorded in notes.md
## CLARIFICATIONS NEEDED
None
## NEXT
TASK_COMPLETE

## Quality Review

Reviewer target `cc/claude-opus-medium`, range `refs/plans/json-preview/phase-04/base..35f66da`, then a re-review of `35f66da..0d52b60`.

The first review returned PASS_WITH_DEBT with seven findings: a pipeline-order test that passed under three different orderings, an untested sort-plus-original fallback, an ineffective `eol` option leaving line endings inconsistent across views, stray whitespace left by strip, `parses` computed with a different parser from the rest of the pipeline, a bare EOF literal with an order-dependent trivia range check, and an incomplete doc comment. Two fix cycles followed. The re-review confirmed six resolved and one partial; cycle 2 closed the remaining item.

Coordinator-verified dispute: the implementer rejected part of finding 5, which claimed `jsonc-parser` accepts NBSP and `\v` where `JSON.parse` does not. A direct probe of the installed `jsonc-parser` 3.3.1 confirmed the implementer: NBSP, `\v`, and `\f` all raise a parse error there exactly as in `JSON.parse`. Only the BOM divergence was real, and that is what was fixed.

Coordinator-verified cycle 2: probing `transformJson` with `stripComments` under the `original` layout gives `'{\n  "a": 1\n}'` for a leading block comment, preserving the two-space indent, and `'{\n  "a": 1\n}'` for a trailing line comment, leaving no trailing space.

## Review Result

- Spec Status: PASS. The phase touched only `src/lib/json-document.ts` and `tests/unit/json-document.test.ts`; `prepareJson` and the 12 pre-existing tests are unchanged; `jsonc-parser` is still reached only by dynamic `import()`; byte-exactness holds for number text, string escapes, and duplicate key order.
- Quality Status: PASS_WITH_DEBT, after two fix cycles.
- Debt:
  - A comment occupying a whole line leaves a blank line after stripping: `'{\n  // c\n  "a": 1\n}'` becomes `'{\n\n  "a": 1\n}'`. Cosmetic. Owner: Phase 5, to judge against the rendered view.
  - CRLF sources are normalized to LF, so the `original` view and the escape output differ from the source bytes, and `prepareJson(...).text` keeps CRLF and therefore does not match the `transformJson` original view. Only whitespace and comment text can differ, since a raw CR inside a string fails to parse. Owner: Phase 5, which must not mix the two texts.
  - `sortKeys` with the `original` layout returns beautified output using `options.indent`, because sorting rebuilds the text and cannot preserve the original whitespace. Accepted at phase design time, now pinned by an exact-output test. Owner: Phase 5, to reflect in the toolbar wording.
  - Deeply nested input raises `RangeError` from both `prepareJson` and `transformJson`, since `jsonc-parser` and the rebuild both recurse. Predates this phase. Owner: Phase 5, which must catch a rejected promise from either function and show the parse-error banner.

## Verification Evidence

Run fresh at the final checkpoint, one at a time:

- `pnpm typecheck` -> exit 0.
- `pnpm lint` -> exit 0, 0 errors, 208 warnings, 3 infos. Equal to the `c9c2800` baseline.
- `pnpm test` -> 45 files, 609 tests passed. Phase 2 left 584.

## Final Checkpoint

- Phase base ref: refs/plans/json-preview/phase-04/base
- Phase implementation ref: refs/plans/json-preview/phase-04/impl
- Plan commit ref: pending
- State checkpoint: temporary commits 35f66da, 0d52b60, and this one
