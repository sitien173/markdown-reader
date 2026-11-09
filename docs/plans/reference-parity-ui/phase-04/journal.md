<!-- refract-shared-version: 3.0.0 -->

# Phase 4 Journal: Appearance tab

<!-- Created by the worker per worker-contract.md. Append every block; keep earlier sections. -->

## META

- Plan: docs/plans/reference-parity-ui/PLAN.md
- Implementation Profile: balanced
- Consultation Profile: n/a
- Review Profile: balanced
- Implementation Job: 270266bd (partial tasks 0-1), db3f9ba7
- Review Job: pending
- Started: 2026-11-09
- Finished: 2026-11-09

## Implementation Response

# EXTERNAL RESPONSE
## META
- Phase: 4 (Appearance tab), tasks 0-4
- Started: 2026-11-09
- Finished: 2026-11-09T20:48:13+07:00
- Plan dir: docs/plans/reference-parity-ui
## SUMMARY
Phase 4 delivered the review-debt fixes, the Appearance tab theme, code theme, text, font, layout, Zen, and custom CSS settings, and the standalone export that carries them, with all five Verification Checks passing fresh.
## FILES MODIFIED
| Action | Path | Change |
|---|---|---|
| Modified | src/entrypoints/reader/App.tsx | Applies Appearance on the root; passes stored Appearance to export |
| Modified | src/export/export-styles.ts | Forced theme blocks, `--md-*` defaults, print stays light |
| Modified | src/export/export.ts | Root attributes, classes, properties, and validated custom CSS in the export |
| Modified | src/i18n/en-US.ts | Appearance and plugin error strings |
| Modified | src/render/diagram.ts | `isDark()` reads root `data-theme` before `matchMedia` |
| Modified | src/render/enhance.ts | Code block cache kind from `highlightCacheKind()` |
| Modified | src/render/highlight.ts | `highlightCacheKind()` carries both code themes |
| Modified | src/render/pipeline.ts | `md-parser-build` measure; multimd-table TODO |
| Modified | src/store/reader-store.ts | `focusMode` starts from stored Zen |
| Modified | src/store/settings-store.ts | Skip unchanged writes; no stale pending echo |
| Modified | src/styles/editor.css | Forced theme tokens on screen |
| Modified | src/styles/globals.css | Forced theme blocks; dark variant follows `data-theme` |
| Modified | src/styles/markdown.css | Text scale, font, width, layout classes, code theme selection |
| Modified | src/ui/markdown-view.tsx | Theme-driven diagram redraw; single block key prefix |
| Modified | src/ui/settings/appearance-tab.tsx | Appearance controls and custom CSS inline error |
| Modified | src/ui/settings/plugins-tab.tsx | Write failures shown in a `role="alert"` line |
| Created | src/lib/appearance.ts | Shared Appearance root state and `applyAppearance` |
| Created | src/lib/custom-css.ts | Custom CSS validation and adopted stylesheet apply |
| Modified | tests/e2e/export.spec.ts | Export keeps Zen off, width, custom CSS, zero requests |
| Modified | tests/e2e/perf.spec.ts | Logs `md-parser-build` next to paint time |
| Modified | tests/e2e/theme.spec.ts | Forced theme, Auto, and print cases |
| Created | tests/e2e/appearance.spec.ts | Code theme, text, font, layout, Zen cases |
| Modified | tests/unit/export.test.ts | Appearance in export; quote-agnostic forced block check |
| Modified | tests/unit/settings-panel.test.tsx | Plugins tab error alert |
| Modified | tests/unit/settings-store.test.ts | Unchanged write leaves no pending entry |
| Created | tests/unit/appearance.test.ts | Root state, scale, clamp, code theme cache kind |
| Created | tests/unit/custom-css.test.ts | Rejection variants, acceptance, sheet replace and keep |
| Modified | docs/plans/reference-parity-ui/phase-04/notes.md | Task 2, 3, 4 blocks and phase verification |
| Modified | docs/plans/reference-parity-ui/phase-04/journal.md | This response |
## NOTES
- phase-04/notes.md (## Task 0, ## Task 1, ## Task 2, ## Task 3, ## Task 4, ## Phase verification)
- `pnpm typecheck` exit 0. `pnpm lint` exit 0, 183 warnings (limit 186). `pnpm exec vitest run --maxWorkers=2` 37 files, 424 passed. Targeted playwright 34 passed. `pnpm test:e2e` 124 passed.
- Task 1 decision kept: the `matchMedia` listener stays for Auto only.
- Verbatim RED output for task 2 and for the first task 3 and 4 e2e runs was not captured; notes.md says so.
- `tests/e2e/entry.spec.ts:52` failed once in a first full e2e run, passed 3 of 3 alone, and the rerun passed 124 of 124.
## SPEC COMPLIANCE
- Meets Spec? WITH_DEBT: all checks pass fresh; RED output for task 2 and part of tasks 3 and 4 was not preserved verbatim, and one existing popup focus test flaked once.
## CLARIFICATIONS NEEDED
None
## NEXT
TASK_COMPLETE

# EXTERNAL RESPONSE
## META
- Phase: 4 (Appearance tab), fix batch after quality review FAIL
- Started: 2026-11-09
- Finished: 2026-11-09
- Plan dir: docs/plans/reference-parity-ui
## SUMMARY
The blocking store race is fixed with a RED then GREEN unit test, both sliders now persist on commit, and an e2e guard covers Mermaid stability for both code theme keys; all four checks pass fresh. Nothing is committed.
## FILES MODIFIED
| Action | Path | Change |
|---|---|---|
| Modified | src/store/settings-store.ts | Listener sets `lastStored` only when `pendingWrites` is empty |
| Modified | src/ui/settings/appearance-tab.tsx | Text size and Max width sliders: draft in `onValueChange`, persist in `onValueCommitted` |
| Modified | tests/unit/settings-store.test.ts | A, O, echo A, write A, echo O convergence test |
| Modified | tests/e2e/appearance.spec.ts | Mermaid SVG markup and id unchanged for `codeThemeLight` and `codeThemeDark` |
| Modified | docs/plans/reference-parity-ui/phase-04/notes.md | Fix batch block |
| Modified | docs/plans/reference-parity-ui/phase-04/journal.md | This response |
## NOTES
- phase-04/notes.md (## Fix batch (quality review FAIL))
- RED: store test failed before the fix with `expected false to be true` (storage held O, memory held A). GREEN: 19 passed in that file.
- Finding 3 had no RED because the behavior already held; the new e2e tests are regression guards.
- Finding 2 has no new automated test; no existing test drags a slider.
- `pnpm typecheck` exit 0. `pnpm lint` exit 0, 183 warnings (limit 183). `pnpm exec vitest run --maxWorkers=2` 37 files, 425 passed. `pnpm test:e2e` 126 passed.
## SPEC COMPLIANCE
- Meets Spec? WITH_DEBT: finding 3 has no RED run and finding 2 has no automated test.
## CLARIFICATIONS NEEDED
None
## NEXT
TASK_COMPLETE

## Review Result

- Spec Status: PASS. Changed files match the Files list plus task-0 files and `src/i18n/en-US.ts`; `src/render/enhance.ts` was edited for the highlight cache key (accepted decision). Every Acceptance Criterion has a passing test; the Mermaid-stability criterion was added in the fix batch.
- Quality Status: PASS. First review (local Opus subagent; refract MCP was disconnected) returned FAIL: settings-store onChanged set `lastStored` from an older echo while newer writes were pending (blocking), sliders persisted every drag tick, no Mermaid-stability e2e. Fix job a72509ef (9be90b2) addressed all three; re-review PASS with no findings.
- Coordinator validation at 9be90b2: typecheck 0, lint 0 (183 warnings), vitest 425/425, e2e 126 passed.
- Debt: none.

## Final Checkpoint

- Phase base ref: refs/plans/reference-parity-ui/phase-04/base
- Phase implementation ref: refs/plans/reference-parity-ui/phase-04/impl
- Plan commit ref: pending
- State checkpoint: temporary commit
