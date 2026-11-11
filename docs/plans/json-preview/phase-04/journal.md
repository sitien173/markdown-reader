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
