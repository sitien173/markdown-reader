<!-- refract-shared-version: 2.5.0 -->

# Phase 1 — Journal: Baseline, characterization tests, and selector hooks

<!--
Phase Journal template. Copy to docs/plans/ui-stack-refactor/phase-01/journal.md at phase
start, fill the META, then append the full `# EXTERNAL RESPONSE` block (see
erp.md) under `## Implementation Response` after all tasks (and after any `FIX:`
batch). Never overwrite earlier sections.
-->

## META

- Plan: docs/plans/ui-stack-refactor/PLAN.md
- Implementation Profile: balanced (google target agy-sonnet failed transient twice: 7f38e635, fbb5e728)
- Consultation Profile: n/a
- Review Profile: balanced
- Implementation Job: 7965cc7b-aedc-49da-9371-46caea291303
- Review Job: 1e2baeb4-1cb6-476d-8558-e3c0f0b760de
- Started: 2026-11-07T14:42:07+07:00
- Finished: 2026-11-07T15:43:50+07:00

## Implementation Response

<!-- Worker appends each full `# EXTERNAL RESPONSE` block here without overwriting prior blocks. -->

# EXTERNAL RESPONSE
## META
- Phase 1 / Started 2026-11-07T14:42:07+07:00 / Finished 2026-11-07T15:36:00+07:00 / Plan dir docs/plans/ui-stack-refactor
## SUMMARY
Behavioral `.tds-*` lookups replaced by `data-slot` selectors, five App race tests added with RED evidence per guard, and a keyboard E2E spec added; typecheck, vitest and E2E are green.
## FILES MODIFIED
| Action | Path | Change |
|---|---|---|
| modify | vitest.config.ts | include `.tsx` unit tests |
| modify | src/ui/markdown-view.tsx | `data-slot="markdown"`; scroller lookup uses `[data-slot="reader-content"]` |
| modify | src/toc/toc.ts | content lookup uses `[data-slot="reader-content"]` |
| modify | src/ui/toc-panel.tsx | content lookup uses data-slot; scroll logic extracted to `scrollToHeading` |
| modify | src/entrypoints/reader/App.tsx | `data-slot="reader-content"`; export reads `[data-slot="markdown"]`; click handler extracted to `onContentClick` |
| modify | tests/e2e/enhance.spec.ts | line 54 narrowed to leaked Mermaid artifacts |
| create | tests/unit/reader-app.test.tsx | 5 App race and wiring tests |
| create | tests/e2e/keyboard.spec.ts | 6 keyboard and focus tests, 2 are `test.fail` for a v1 focus-return gap |
| modify | docs/plans/ui-stack-refactor/phase-01/notes.md | Task 1 to 4 blocks |
| modify | docs/plans/ui-stack-refactor/phase-01/journal.md | this response |
## NOTES
- phase-01/notes.md  (## Task 1, ## Task 2, ## Task 3, ## Task 4). Fresh checks: `npm run typecheck` exit 0; `npx vitest run --no-file-parallelism` 22 files, 208 tests passed (load 7.25); `npm run test:e2e` 33 passed including 2 expected failures (load 13.0); `grep -rn "querySelector\|closest" src | grep "tds-"` prints nothing. Baseline at load 7 to 11: typecheck pass, vitest 203 passed, E2E 27 passed.
## SPEC COMPLIANCE
- Meets Spec? WITH_DEBT  - all Done When checks pass; file-access dialog has no Cancel button, and focus does not return to the trigger after either dialog closes in v1 (pinned with `test.fail`, recorded in Task 4 notes).
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

- Phase base ref: refs/plans/ui-stack-refactor/phase-01/base
- Phase implementation ref: refs/plans/ui-stack-refactor/phase-01/impl
- Plan commit ref: refs/plans/ui-stack-refactor/impl or `pending`
- State checkpoint: temporary commit, or `n/a (untracked)` when plan artifacts
  are excluded

Phase refs retain review evidence after checkpoint consolidation. The plan ref
names the sole commit retained on the branch.

## Quality Review

- Job 1e2baeb4-1cb6-476d-8558-e3c0f0b760de (balanced, pi-openai-codex/sol-medium): PASS_WITH_DEBT.
- Medium: whole-test `test.fail` in `tests/e2e/keyboard.spec.ts` masked the Cancel and Got it focus paths. Fixed by the coordinator: one expected-failure case per dismissal path, dialog closure asserted before the focus check. `npx playwright test tests/e2e/keyboard.spec.ts`: 8 passed, including 4 expected failures.
- Low: the directory mock in `tests/unit/reader-app.test.tsx` never updates `currentPath`. Logged as debt for Phase 3.

## Review Result

- Spec: PASS. Quality: PASS_WITH_DEBT.

## Final Checkpoint

- `npm run typecheck`: pass. `npx vitest run --no-file-parallelism`: 22 files, 208 tests passed. `npm run test:e2e`: 33 passed at load 13.5.
