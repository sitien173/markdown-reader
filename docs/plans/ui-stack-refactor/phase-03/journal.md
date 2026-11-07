<!-- refract-shared-version: 2.5.0 -->

# Phase 3 — Journal: Reader store, controller, and boundary validation

<!--
Phase Journal template. Copy to docs/plans/ui-stack-refactor/phase-03/journal.md at phase
start, fill the META, then append the full `# EXTERNAL RESPONSE` block (see
erp.md) under `## Implementation Response` after all tasks (and after any `FIX:`
batch). Never overwrite earlier sections.
-->

## META

- Plan: docs/plans/ui-stack-refactor/PLAN.md
- Implementation Profile: balanced (google target agy-sonnet failed transient: d7c2f83c)
- Consultation Profile: n/a
- Review Profile: balanced
- Implementation Job: c7c21fd4-e6a2-40d9-920f-46ec010a2696
- Review Job: e3956bbd-5307-4e8d-bced-044850251d00
- Started: 2026-11-07T16:10:49+07:00
- Finished: 2026-11-07T16:50:28+07:00

## Implementation Response

<!-- Worker appends each full `# EXTERNAL RESPONSE` block here without overwriting prior blocks. -->

# EXTERNAL RESPONSE
## META
- Phase 3 / Started 2026-11-07T16:10:49+07:00 / Finished 2026-11-07T16:36:56+07:00 / Plan dir docs/plans/ui-stack-refactor
## SUMMARY
Reader App is now a view over a Zustand store and a per-mount controller with the guard protocol intact, and the three storage boundaries are validated with jitless `zod/mini`.
## FILES MODIFIED
| Action | Path | Change |
|---|---|---|
| modify | package.json | add exact `zustand` 5.0.16 and `zod` 4.6.7 |
| modify | pnpm-lock.yaml | lockfile for the two dependencies |
| create | src/lib/schemas.ts | zod/mini schemas and parse helpers for captured text, handle records, recent URLs |
| create | src/store/reader-store.ts | Zustand store, reset, banner selector |
| create | src/reader/controller.ts | async source logic and guards moved out of App |
| modify | src/entrypoints/reader/App.tsx | selectors plus controller calls; no sourceGenRef |
| modify | src/entrypoints/reader/main.tsx | jitless config before render |
| modify | src/entrypoints/popup/main.tsx | jitless config before render |
| modify | src/source/captured-text.ts | validate via schema |
| modify | src/store/handles.ts | validate stored records via schema |
| modify | src/store/recent.ts | validate recent URL list via schema |
| create | tests/unit/schemas.test.ts | boundary, fallback and jitless tests |
| create | tests/unit/reader-store.test.ts | store and banner selector tests |
| create | tests/unit/controller.test.ts | stale-generation and pinned-path tests |
| modify | tests/unit/reader-app.test.tsx | directory mock models committed path and identity |
| modify | docs/plans/ui-stack-refactor/phase-03/notes.md | task notes and evidence |
| modify | docs/plans/ui-stack-refactor/phase-03/journal.md | META Finished and this response |
## NOTES
- phase-03/notes.md (## Task 1, ## Task 2, ## Task 3, ## Task 4, ## Final checks)
- Fresh checks: lint exit 0 with 217 warnings; typecheck pass; vitest 25 files, 252 tests pass; e2e 35 pass including the 4 expected failures and the S3 gate (median 43.5 ms at load 13.8).
## SPEC COMPLIANCE
- Meets Spec? WITH_DEBT: all Done When checks pass; debt is that single clauses of isCurrent and the jitless test have no failing mutation, and one forbidden command was run (see notes Task 1).
## CLARIFICATIONS NEEDED
None. For awareness: I ran `git checkout -- pnpm-workspace.yaml` once to remove an exclusion line pnpm had added; the file equals HEAD.
## NEXT
TASK_COMPLETE

## Quality Review

<!-- Coordinator appends the independent review response here. -->

## Review Result

- Spec Status: PENDING
- Quality Status: PENDING
- Debt: none

## Final Checkpoint

- Phase base ref: refs/plans/ui-stack-refactor/phase-03/base
- Phase implementation ref: refs/plans/ui-stack-refactor/phase-03/impl
- Plan commit ref: refs/plans/ui-stack-refactor/impl or `pending`
- State checkpoint: temporary commit, or `n/a (untracked)` when plan artifacts
  are excluded

Phase refs retain review evidence after checkpoint consolidation. The plan ref
names the sole commit retained on the branch.

## Quality Review

- Job e3956bbd-5307-4e8d-bced-044850251d00 (balanced, cc/claude-opus-medium): PASS_WITH_DEBT. No guard dropped; keystroke path and DOM unchanged.
- Medium: `getRecentHandles` became stricter than base. Fixed by the coordinator: `storedHandleSchema` now matches the base predicate (any object with a `handle` key); tests updated to pin base behavior.
- Low: jitless config ran after schema construction. Fixed: `src/lib/zod-config.ts` side-effect module, imported first by `schemas.ts` and by reader and popup `main.tsx`. The jitless test no longer configures Zod itself.
- Low: shared module-level store and reset during render; two App instances would share one store. Debt.
- Low: controller tests lack path-based identity and stale `drop`, `openFileHandle`, `overwrite`, `checkExternal` cases. Debt.
- Worker ran a forbidden `git checkout -- pnpm-workspace.yaml`; the file equals base. No other side effects.

## Review Result

- Spec: PASS after fix. Quality: PASS_WITH_DEBT.

## Final Checkpoint

- `pnpm lint` exit 0, 217 warnings; `pnpm typecheck` pass; vitest 25 files, 250 tests; `pnpm test:e2e` 35 passed at load 12.9; background.js contains no zod.
