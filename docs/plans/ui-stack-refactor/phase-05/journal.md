<!-- refract-shared-version: 2.5.0 -->

# Phase 5 — Journal: Dark mode across shell, content, and export

<!--
Phase Journal template. Copy to docs/plans/ui-stack-refactor/phase-05/journal.md at phase
start, fill the META, then append the full `# EXTERNAL RESPONSE` block (see
erp.md) under `## Implementation Response` after all tasks (and after any `FIX:`
batch). Never overwrite earlier sections.
-->

## META

- Plan: docs/plans/ui-stack-refactor/PLAN.md
- Implementation Profile: balanced
- Consultation Profile: n/a
- Review Profile: balanced
- Implementation Job: n/a
- Review Job: n/a
- Started: 2026-11-07T17:50:00+07:00
- Finished: 2026-11-07T18:25:00+07:00

## Implementation Response

<!-- Worker appends each full `# EXTERNAL RESPONSE` block here without overwriting prior blocks. -->

# EXTERNAL RESPONSE
## META
- Phase 5 / Started 2026-11-07T17:50:00+07:00 / Finished 2026-11-07T18:25:00+07:00 / Plan dir docs/plans/ui-stack-refactor
## SUMMARY
Dark mode now follows `prefers-color-scheme` across shell tokens, editor, dual-theme Shiki, live-rerendered Mermaid, and HTML export, with print forced light and export tokens pinned to `globals.css` by a unit test.
## FILES MODIFIED
| Action | Path | Change |
|---|---|---|
| Modify | src/styles/globals.css | dark custom variant, `color-scheme`, dark tokens, print light block |
| Modify | src/styles/markdown.css | Shiki dark override under `screen and (prefers-color-scheme: dark)` |
| Modify | src/render/highlight.ts | lazy `github-dark` plus `github-light`, dual-theme output |
| Modify | src/render/diagram.ts | source-bearing wrapper, token-based theme variables, epoch-guarded rerender, export render helper |
| Modify | src/ui/markdown-view.tsx | `matchMedia` listener rerendering diagrams only |
| Modify | src/export/export-styles.ts | export CSS built from light and dark token objects, diagram pair CSS |
| Modify | src/export/export.ts | `themeExportDiagrams`, used by `downloadHtml` |
| Modify | tests/unit/enhance.test.ts | dual-theme highlight and diagram theming tests |
| Modify | tests/unit/export.test.ts | dark and print CSS, token parity with `globals.css`, disjoint ids |
| Modify | tests/e2e/theme.spec.ts | light and dark surfaces, live scheme change, print light |
| Modify | tests/e2e/export.spec.ts | export in both schemes, theme switch, disjoint ids |
| Modify | tests/e2e/enhance.spec.ts | both schemes, unique ids, no leaked nodes |
| Modify | docs/plans/ui-stack-refactor/phase-05/notes.md | Task 1 to 5 blocks |
| Modify | docs/plans/ui-stack-refactor/phase-05/journal.md | META and this response |
## NOTES
- phase-05/notes.md (## Task 1 to ## Task 5, ## Housekeeping). Final checks: `pnpm install --frozen-lockfile` ok; `pnpm lint` exit 0, 173 warnings (cap 218); `pnpm typecheck` pass; `pnpm exec vitest run --no-file-parallelism` 25 files, 257 tests passed; `pnpm test:e2e` 40 passed and 1 failed (S4 at load 14 to 26). S4 passes in isolation (perf.spec.ts 4 passed at load 12). Other E2E, including S3, passed in the full run.
## SPEC COMPLIANCE
- Meets Spec? WITH_DEBT - all criteria implemented and passing; the last full `pnpm test:e2e` had one S4 timing failure under host load above 8, and an isolated rerun passes. A quiet-host full run is advised.
## CLARIFICATIONS NEEDED
None
## NEXT
TASK_COMPLETE


## Quality Review

<!-- Coordinator appends the independent review response here. -->

- Review a124bb17 (cc/claude-opus-medium): FAIL. High editor syntax colors light-only in dark; medium dark diagrams in print; low export initialize leaking into queued live render; low sequence-diagram unprefixed ids duplicated.
- FIX 1 (commit f32f51b): CSS-variable HighlightStyle, light print copy of diagrams in dark scheme, serialized Mermaid initialize+render queue.
- Re-review 374db7e1 (cc/claude-opus-medium): PASS_WITH_DEBT. Low active-line contrast below 4.5:1 fixed by coordinator (editor colors #636366, #6cb4ff, #aeaeb2; E2E asserts contrast on .cm-activeLine; RED 4.30, GREEN pass). Low dark-mode diagram latency (two serialized renders per diagram) deferred.
- Fresh checks: lint exit 0, 192 warnings; typecheck pass; vitest --no-file-parallelism 259 pass; test:e2e 42 total, 39 passed at load 68 with 3 timeouts, the 3 failed specs plus S3 rerun at load 9: 17 passed, S4 median 152 ms, S3 median 33.9 ms.

## Review Result

- Spec Status: PENDING
- Quality Status: PENDING
- Debt: none

## Final Checkpoint

- Phase base ref: refs/plans/ui-stack-refactor/phase-05/base
- Phase implementation ref: refs/plans/ui-stack-refactor/phase-05/impl
- Plan commit ref: refs/plans/ui-stack-refactor/impl or `pending`
- State checkpoint: temporary commit, or `n/a (untracked)` when plan artifacts
  are excluded

Phase refs retain review evidence after checkpoint consolidation. The plan ref
names the sole commit retained on the branch.
