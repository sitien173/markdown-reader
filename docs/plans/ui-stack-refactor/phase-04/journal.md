<!-- refract-shared-version: 2.5.0 -->

# Phase 4 — Journal: Base UI primitives and TDS removal at current layout

<!--
Phase Journal template. Copy to docs/plans/ui-stack-refactor/phase-04/journal.md at phase
start, fill the META, then append the full `# EXTERNAL RESPONSE` block (see
erp.md) under `## Implementation Response` after all tasks (and after any `FIX:`
batch). Never overwrite earlier sections.
-->

## META

- Plan: docs/plans/ui-stack-refactor/PLAN.md
- Implementation Profile: balanced
- Consultation Profile: n/a
- Review Profile: balanced
- Implementation Job: 807fcff5-d11c-4c4f-8c8b-a0f185c23454
- Review Job: <Refract job ID or n/a>
- Started: 2026-11-07T16:51:40+07:00
- Finished: <ISO timestamp>

## Implementation Response

<!-- Worker appends each full `# EXTERNAL RESPONSE` block here without overwriting prior blocks. -->

# EXTERNAL RESPONSE
## META
- Phase: 4 (Base UI primitives and TDS removal at current layout) / Started: 2026-11-07T16:51:40+07:00 / Finished: 2026-11-07T17:18:39+07:00 / Plan dir: docs/plans/ui-stack-refactor
## SUMMARY
shadcn base-nova on Base UI 1.9.0 replaces TDS and Radix with an Apple-style light theme at the same layout, focus restoration on both dialogs is fixed, and all gates pass.
## FILES MODIFIED
| Action | Path | Change |
|---|---|---|
| Modify | components.json | style base-nova |
| Modify | package.json, pnpm-lock.yaml | add @base-ui/react 1.9.0, remove @radix-ui/* and cn |
| Modify | src/components/ui/{alert,button,collapsible,dialog,dropdown-menu,input,spinner,tabs,toggle,toggle-group,tooltip}.tsx | regenerated with shadcn CLI 4.23.0 |
| Delete | src/styles/tds/ (21 files) | TDS removed |
| Create | src/export/export-styles.ts | standalone export CSS |
| Modify | src/export/export.ts | use EXPORT_CSS, .md-content |
| Modify | src/styles/{globals,markdown,reader,popup,editor}.css | base-nova tokens, renamed classes |
| Modify | src/ui/{announce,editor-pane,file-access-dialog,file-tree,markdown-view,recent-section,save-conflict-dialog,toc-panel,top-bar}.tsx | Base UI primitives, TDS classes removed, dialog focus restore |
| Modify | src/entrypoints/reader/App.tsx, src/entrypoints/popup/App.tsx | same |
| Modify | tests/e2e/{theme,editor,enhance,entry,export,perf,reader,reload,spike-mermaid-csp,keyboard}.spec.ts | selectors, export checks, scroll-spy deviation, 4 test.fail made plain test |
| Modify | tests/unit/{export,file-tree,reader-app}.test.ts(x) | selector updates |
| Modify | docs/plans/ui-stack-refactor/phase-04/notes.md, journal.md | records |
## NOTES
- phase-04/notes.md (## Task 1 to ## Task 5, Final checks). Fresh: vitest 25 files 251 tests; e2e 35 passed; lint exit 0 with 163 warnings; typecheck exit 0.
- Spec deviation recorded in Task 4: reader.spec.ts scroll-spy step changed per coordinator answer. Process fault recorded: implementation began before the prompt files were read; per-task RED commands were not captured.
## SPEC COMPLIANCE
- Meets Spec? WITH_DEBT - all Done When checks pass fresh; debt is missing RED captures for tasks 1, 2 and 5 and one coordinator-approved test change.
## CLARIFICATIONS NEEDED
None
## NEXT
TASK_COMPLETE

## Quality Review

<!-- Coordinator appends the independent review response here. -->

## Review Result

- Spec Status: PASS (review 41b545ed, cc/claude-opus-medium)
- Quality Status: PASS_WITH_DEBT after fix. Review verdict FAIL on one high finding, fixed by coordinator:
  - High: `@theme { --color-*: initial }` came after `@theme inline`, so no semantic color utility (bg-popover, bg-primary, text-destructive) was generated. Moved the reset above the mappings, kept black and white. New E2E `tests/e2e/theme.spec.ts` asserts the export menu paints `--popover`; it failed before the fix (rgba(0, 0, 0, 0)) and passes after.
  - Low fixed: removed `supports-backdrop-filter:backdrop-blur-xs` from `src/components/ui/dialog.tsx` per plan.
  - Medium deferred to Phase 6: mode switch lost radiogroup/radio semantics (Base UI ToggleGroup renders group with aria-pressed buttons).
  - Low deferred to Phase 5: `src/export/export-styles.ts` duplicates `:root` color values from globals.css.
- Fresh checks after fix: lint exit 0, 163 warnings; typecheck pass; vitest --maxWorkers=2 251 passed; test:e2e 36 passed. Full-parallel vitest timed out under host load 70 to 183 from unrelated processes; 2 workers pass.
- Debt: RED captures missing for tasks 1, 2, 5 (worker); items above.

## Final Checkpoint

- Phase base ref: refs/plans/ui-stack-refactor/phase-04/base
- Phase implementation ref: refs/plans/ui-stack-refactor/phase-04/impl
- Plan commit ref: refs/plans/ui-stack-refactor/impl or `pending`
- State checkpoint: temporary commit, or `n/a (untracked)` when plan artifacts
  are excluded

Phase refs retain review evidence after checkpoint consolidation. The plan ref
names the sole commit retained on the branch.
