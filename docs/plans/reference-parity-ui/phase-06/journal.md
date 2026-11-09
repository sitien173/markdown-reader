<!-- refract-shared-version: 3.0.0 -->

# Phase 6 Journal: Reader shell

<!-- Created by the worker per worker-contract.md. Append every block; keep earlier sections. -->

## META

- Plan: docs/plans/reference-parity-ui/PLAN.md
- Implementation Profile: balanced
- Consultation Profile: n/a
- Review Profile: balanced
- Implementation Job: pending
- Review Job: pending
- Started: 2026-11-09
- Finished: 2026-11-09

## Implementation Response

# EXTERNAL RESPONSE
## META
- Phase: 6 (Reader shell) / Started: 2026-11-09 / Finished: 2026-11-09 / Plan dir: docs/plans/reference-parity-ui
## SUMMARY
Phase 6 delivered the floating menu with registry shortcut hints, the compact edit/split header, the Zen exit focus return, the Outline collapsing setting, and aligned the unit and e2e specs with the moved read-mode controls.
## FILES MODIFIED
| Action | Path | Change |
|---|---|---|
| Modified | src/entrypoints/reader/App.tsx | Reader shell layout, floating controls, sidebar toggle group, focus return |
| Modified | src/i18n/en-US.ts | Shell strings |
| Modified | src/reader/commands.ts | Command registry updates for menu and modes |
| Modified | src/render/enhance.ts | Heading permalinks and code copy |
| Modified | src/source/url.ts | Phase 6 task changes |
| Modified | src/source/watch.ts | Phase 6 task changes |
| Modified | src/styles/reader.css | Reader shell styles |
| Modified | src/ui/file-tree.tsx | Shell integration |
| Modified | src/ui/settings/general-tab.tsx | Outline collapsing switch |
| Modified | src/ui/toc-panel.tsx | Outline panel update |
| Modified | src/ui/toolbar.tsx | Compact header for edit and split |
| Created | src/ui/reader-menu.tsx | Floating menu with shortcut hints |
| Created | src/ui/about-dialog.tsx | About dialog |
| Created | tests/e2e/reader-shell.spec.ts | Shell e2e coverage |
| Created | tests/e2e/reader-modes.spec.ts | Mode radiogroup e2e coverage |
| Modified | tests/e2e/contrast.spec.ts, editor.spec.ts, export.spec.ts, general.spec.ts, keyboard.spec.ts, motion.spec.ts, palette.spec.ts, perf.spec.ts, reader.spec.ts, shell.spec.ts, theme.spec.ts | Moved-control reroutes and approved deviations |
| Modified | tests/unit/commands.test.ts, enhance.test.ts, reader-app.test.tsx, reader-render.test.tsx, shortcuts.test.ts, source-url.test.ts, watch.test.ts | Task tests and approved selector changes |
| Modified | docs/plans/reference-parity-ui/phase-06/notes.md | Task blocks, spec deviations, final verification |
| Modified | docs/plans/reference-parity-ui/phase-06/journal.md | META finish date and this response |
## NOTES
- phase-06/notes.md (## Task 0 to ## Task 4, ## Cross-spec selector updates)
- Fresh checks: typecheck exit 0; lint 0 errors and 183 warnings; vitest 478 passed in 40 files; targeted playwright 31 passed; pnpm test:e2e 148 passed, 0 failed.
## SPEC COMPLIANCE
- Meets Spec? WITH_DEBT: all checks pass; spec deviations listed in notes.md, including the unrequested `reader-render.test.tsx` setup change from `?mode=read` to `?mode=split`, need coordinator review.
## CLARIFICATIONS NEEDED
None
## NEXT
TASK_COMPLETE

## Review Result

- Spec Status: PASS. Changed files match the Files list plus task-0 files (`src/source/url.ts`, `src/source/watch.ts`, `tests/unit/watch.test.ts`, `tests/unit/source-url.test.ts`), `src/i18n/en-US.ts`, the Outline collapsing row in `general-tab.tsx` (PLAN line 31), and Coordinator-approved test-reach changes in existing specs (contrast, editor, export, general, keyboard, motion, palette, perf, reader, shell, theme e2e; reader-app, reader-render, shortcuts unit). Assertions kept except general.spec Outline collapsing absence flipped to presence, palette hint read from the menu item, shell focus target moved to the Menu button, and reader-render setup moved to split mode. Manifest permissions unchanged.
- Quality Status: PASS_WITH_DEBT (review 9610953e).
- Coordinator validation at f3c8192: typecheck 0, lint 0 (183 warnings), vitest 478/478, e2e 148 passed.
- Implementation jobs: fece1a30 (stopped on clarifications), 5f8edfa5 (stopped on clarifications), eb69c394 (worker compacted and returned without work), b432e4cd (completed).
- Debt (owner: Phase 7 implementer, task-0):
  1. `src/source/watch.ts` ~255: redirect-follow poll uses default cache; pass `cache: 'no-cache'` and assert in watch.test.ts.
  2. `src/ui/toc-panel.tsx` ~107: collapsed set survives document change; reset on `loadId` change (not on heading edits).
  3. `src/styles/reader.css` ~64: `.md-code-bar` needs `user-select: none`.
  4. `tests/unit/reader-render.test.tsx`: add a ReaderMenu render spy and a read-mode describe repeating the no-rerender check.

## Final Checkpoint

- Phase base ref: refs/plans/reference-parity-ui/phase-06/base
- Phase implementation ref: refs/plans/reference-parity-ui/phase-06/impl
- Plan commit ref: pending
- State checkpoint: temporary commit
