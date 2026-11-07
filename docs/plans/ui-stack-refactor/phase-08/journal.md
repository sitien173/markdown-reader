<!-- refract-shared-version: 2.5.0 -->

# Phase 8 — Journal: Motion, accessibility, and release audit

<!--
Phase Journal template. Copy to docs/plans/ui-stack-refactor/phase-08/journal.md at phase
start, fill the META, then append the full `# EXTERNAL RESPONSE` block (see
erp.md) under `## Implementation Response` after all tasks (and after any `FIX:`
batch). Never overwrite earlier sections.
-->

## META

- Plan: docs/plans/ui-stack-refactor/PLAN.md
- Implementation Profile: <name or default>
- Consultation Profile: <name, default, or n/a>
- Review Profile: <name or default>
- Implementation Job: <Refract job ID or n/a>
- Review Job: <Refract job ID or n/a>
- Started: <ISO timestamp>
- Finished: <ISO timestamp>

## Implementation Response

<!-- Worker appends each full `# EXTERNAL RESPONSE` block here without overwriting prior blocks. -->

# EXTERNAL RESPONSE
## META
- Phase: 8 (Motion, accessibility, and release audit)
- Started: not recorded
- Finished: 2026-11-08
- Plan dir: docs/plans/ui-stack-refactor
## SUMMARY
Added reduced-motion-aware CSS transitions and a welcome-to-document View Transition, contrast and motion specs, release audit and docs, and closed the four debt tasks (Biome rules restored, shell re-render fix, shortcut modal guard, dark diagram latency).
## FILES MODIFIED
| Action | Path | Change |
| --- | --- | --- |
| Modify | biome.json | Removed the 10 rule downgrades |
| Modify | src/components/ui/dialog.tsx, dropdown-menu.tsx, tooltip.tsx, toast.tsx | Enter and exit transitions on starting and ending style, opacity and scale or translate only |
| Modify | src/styles/globals.css, src/styles/reader.css | Reduced-motion rules, view-transition duration, `--control-border` |
| Modify | src/entrypoints/reader/App.tsx | Per-field selectors, View Transition with fallback, biome-ignore with reasons |
| Modify | src/reader/commands.ts, src/reader/shortcuts.ts | Stable registry, modal-open guard |
| Modify | src/ui/command-palette.tsx, toolbar.tsx, editor-pane.tsx, file-tree.tsx, markdown-view.tsx, toc-panel.tsx | Selectors, stable callbacks, lint fixes |
| Modify | src/store/handles.ts, src/store/reader-store.ts, src/render/pipeline.ts, src/render/sanitize.ts | Lint fixes, widened selectBanners parameter type |
| Modify | src/render/diagram.ts | Screen copy inserted before print copies |
| Modify | tests/unit/controller.test.ts, enhance.test.ts, shortcuts.test.ts | Lint fix, new RED to GREEN tests |
| Modify | tests/e2e/palette.spec.ts, tests/e2e/theme.spec.ts | Modal shortcut test, one test title renamed |
| Create | tests/e2e/motion.spec.ts, tests/e2e/contrast.spec.ts, tests/unit/reader-render.test.tsx | New specs |
| Modify | README.md, CHROMEWEBSTORE.md | Features, keyboard, appearance, reduced motion text |
| Modify | docs/plans/ui-stack-refactor/phase-08/notes.md, journal.md | Records |
## NOTES
- phase-08/notes.md (## Task 1 to ## Task 7)
- Fresh checks: `pnpm install --frozen-lockfile` ok; `pnpm lint` exit 0, 188 warnings (cap 206); `pnpm typecheck` pass; `pnpm exec vitest run --no-file-parallelism` 28 files, 313 tests pass; `pnpm test:e2e` 91 passed (load average 8 to 13); `pnpm exec wxt zip` exit 0 (4.04 MB).
- Audit: no remote loader in built output; permissions `storage`, `contextMenus`, `tabs`, `<all_urls>`, `wxt.config.ts` identical to base.
## SPEC COMPLIANCE
- Meets Spec? WITH_DEBT - every check passes except the literal TDS grep, which still prints `src/export/export.ts:9` (random base64 in an embedded KaTeX font); also no pre-implementation RED was recorded for tasks 1 and 2, and the E2E for task 6 was written after the fix.
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

- Phase base ref: refs/plans/ui-stack-refactor/phase-08/base
- Phase implementation ref: refs/plans/ui-stack-refactor/phase-08/impl
- Plan commit ref: refs/plans/ui-stack-refactor/impl or `pending`
- State checkpoint: temporary commit, or `n/a (untracked)` when plan artifacts
  are excluded

Phase refs retain review evidence after checkpoint consolidation. The plan ref
names the sole commit retained on the branch.

# EXTERNAL RESPONSE
## META
- Phase: 8 fix for review b0a8c338
- Finished: 2026-11-08
- Plan dir: docs/plans/ui-stack-refactor
## SUMMARY
Fixed the welcome flash during URL navigation, the focus-mode Escape guard, the active-line gutter contrast, and the contrast spec helper. Each fix has a recorded RED and GREEN in notes.md.
## FILES MODIFIED
| Action | Path | Change |
| --- | --- | --- |
| Modify | src/reader/controller.ts | `loading: false` is committed in the same write as the loaded text |
| Modify | src/entrypoints/reader/App.tsx | A shown document stays shown while loading; Escape guard ignores closing dialogs and menus |
| Modify | src/styles/editor.css | Active-line gutter uses `--foreground` |
| Modify | tests/e2e/motion.spec.ts | New test: welcome never mounts on document to document navigation |
| Modify | tests/e2e/palette.spec.ts | New test: Escape while the palette is closing exits focus mode |
| Modify | tests/e2e/contrast.spec.ts | Rendered-element pairs, null-returning `rgb()`, corrected comment |
| Modify | phase-08/notes.md, phase-08/journal.md | Records |
## NOTES
- Fix 1 RED: 1 mount, expected 0. GREEN: motion.spec.ts 7 passed.
- Fix 2 RED: 4 of 4 runs, `data-focus` stayed "true". GREEN: 6 of 6 runs.
- Fix 3 RED: active-line gutter 4.3041 light, 4.4121 dark. GREEN: contrast.spec.ts 6 passed.
- Checks: install ok; lint exit 0 with 188 warnings; typecheck ok; vitest 313 passed; wxt zip ok; e2e 96 passed and 1 failed (`enhance.spec.ts:169`, load average 8), and that spec passed 3 of 3 alone.
- Not fixed: review findings 5 and 6.
## SPEC COMPLIANCE
- Meets Spec? WITH_DEBT. The full e2e run was not clean because of one load-related timeout; no second full run was done. The Fix 4 helper change has no separate RED run.
## CLARIFICATIONS NEEDED
None
## NEXT
TASK_COMPLETE

## Coordinator: review b0a8c338 (PASS_WITH_DEBT) and fix c6114332

- Medium findings 1 to 3 (welcome flash during URL navigation, focus-mode Escape guard matching closing dialogs, active-line gutter contrast 4.30 and 4.41) fixed by job c6114332 with recorded RED and GREEN. Low finding 4 (rgb helper and comment) fixed. Findings 5 and 6 accepted as debt.
- Coordinator verification at load 7 to 8: install frozen ok; lint exit 0, 188 warnings; typecheck ok; vitest 313 pass; wxt zip exit 0; test:e2e 97 passed.
- The earlier palette focus-mode flake is explained by finding 2, not by useEffect timing; the coordinator probe test that tried to reproduce it was removed before the checkpoint.
