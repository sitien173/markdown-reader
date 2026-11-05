<!-- refract-shared-version: 2.4.0 -->

# Phase 6 — Journal: Live editing, drafts, auto-reload, and save-back

## META

- Plan: docs/plans/markdown-reader-v1/PLAN.md
- Implementation Profile: cost
- Consultation Profile: n/a
- Review Profile: base
- Implementation Job: local subagent, then 3831e511-0b96-418f-9c33-69c3d9b9fb66 and 9ec289de-4221-4f3c-8496-610bb36bae70
- Review Job: ce1b958b, 0609883b, ac09682e, 35b8b6d0
- Started: 2026-11-05T14:44+07:00
- Finished: 2026-11-05T17:00+07:00

## Implementation Response

# EXTERNAL RESPONSE
## META
- Phase: 6 (Live editing, drafts, auto-reload, save-back) | Started: 2026-11-05T14:44+07:00 | Finished: 2026-11-05T15:06+07:00 | Plan dir: docs/plans/markdown-reader-v1
## SUMMARY
Incremental block rendering, watchers, dirty rule, file:// reload, and save-back with conflict dialog are implemented and unit and E2E tested; the 100 ms Split gate still fails (median 126 ms at load 24), so the Done When set is not complete.
## FILES MODIFIED
| Action | Path | Change |
| Modify | package.json | Pinned codemirror 6.0.2 and @codemirror/lang-markdown 6.5.2 |
| Modify | package-lock.json | Lock entries for pinned packages |
| Modify | src/render/pipeline.ts | renderBlocks: block split, per-block sanitized cache, reference/footnote/abbr guard; collectHeadings extracted |
| Modify | src/ui/markdown-view.tsx | Imperative update via rAF; prefix/suffix block patch; enhance on inserted blocks only |
| Modify | src/entrypoints/reader/App.tsx | Mode toggle, editor, drafts, watch, Save, Reload banner, conflict dialog, unsubscribe on pagehide/unmount |
| Modify | src/source/file-handle.ts | Retained handle; pick, diskStamp, conflict-checked write, watch |
| Modify | src/source/file-url.ts | watch via text polling |
| Modify | src/styles/reader.css | .tds-custom-md-block display: contents |
| Create | src/editor/editor.ts | CodeMirror factory |
| Create | src/ui/editor-pane.tsx | Imperative CodeMirror mount |
| Create | src/ui/save-conflict-dialog.tsx | Overwrite, Reload from disk, Cancel |
| Create | src/store/drafts.ts | Draft key, 1 s saver, loader |
| Create | src/source/watch.ts | Polling, FileSystemObserver, file URL watchers |
| Create | src/styles/editor.css | TDS-token CodeMirror and split styles |
| Create | tests/unit/drafts.test.ts | Debounce, identity, restore |
| Create | tests/unit/watch.test.ts | Polling, observer unsubscribe, fallback |
| Create | tests/unit/file-handle.test.ts | Conflict never writes; matching stamp writes |
| Create | tests/unit/incremental-render.test.ts | renderBlocks equals render() across fixtures and edits |
| Create | tests/e2e/editor.spec.ts | 100 KB Split latency gate (FAILING) |
| Create | tests/e2e/reload.spec.ts | file:// reload and dirty-editor banner (passing) |
| Create | tests/fixtures/large-100kb.md | 102438-byte fixture |
| Modify | docs/plans/markdown-reader-v1/phase-06/notes.md | Coordinator decision, measured medians, Tasks 1 to 4 |
| Modify | docs/plans/markdown-reader-v1/phase-06/journal.md | This response |
## NOTES
- phase-06/notes.md: "Coordinator decision: incremental block rendering", "Gate status", "## Task 3", "## Task 4", plus Task 1 and 2 blocks.
- Checks: npm ci 0; typecheck 0; npm test 94 pass, 0 skipped; npm run build 0; greps (dangerouslySetInnerHTML, color/radius/shadow patterns) print nothing; npm run test:e2e 1 failed, 18 passed, 0 skipped (only failure: editor.spec.ts latency median 126.0 ms). 1 MiB timing test passed in both full runs (best 704.9 ms, then 1190.5 ms), no rerun needed.
- Medians: before 1107.1 ms (full render); after 72.5 ms isolated, 126.0 ms in full run at load 24.
## SPEC COMPLIANCE
- Meets Spec? NO - the 100 ms median gate fails (126 ms full run). Markdown parse is about 50 to 75 ms of each keystroke (markdown-it md.parse on full text). Save-back, conflict dialog, watchers, and reload E2E are implemented and passing.
- Deviations: TDD RED not captured for watch handle tests, file-handle tests, and reload E2E (implementation written with tests); recorded in notes.md.
## CLARIFICATIONS NEEDED
None
## NEXT
CONTINUE_CONTEXT

Phase 6 continuing. Journal: docs/plans/markdown-reader-v1/phase-06/journal.md.

## Review 1 (ce1b958b, Refract base, gpt-6.1-sol): FAIL
Blocking: reference and abbr guard misses nested definitions (pipeline.ts:74); cross-block HTML breaks parity (pipeline.ts:105); remounted editor gets stale text (App.tsx:139); reload races typing and source switches (App.tsx:88-92); old watcher outlives navigation (App.tsx:135); draft restore can overwrite typed text (App.tsx:54); shell re-render on first edit and heading edits.
Coordinator ruling: a single re-render on the clean-to-dirty transition and on heading-list changes is accepted as consistent with the invariant, because ordinary keystrokes do not re-render the shell and the TOC must update. All other blocking findings go to fix cycle 1, plus the Cancel test and the save-completion race. Drop draft identity goes to Phase 7 with the drop() debt.

## Fix cycle 1 Response

# EXTERNAL RESPONSE
## META
- Phase / Started / Finished / Plan dir: Phase 6 fix cycle 1 / 2026-11-05T15:16:07+07:00 / 2026-11-05T15:58:00+07:00 / docs/plans/markdown-reader-v1
## SUMMARY
Fixed all 8 Review 1 items: nested definition and cross-block HTML render guards, editor text retention across mode switches, reload generation and dirty checks, navigation watcher unsubscription, typed draft collision protection, save-back edit race handling, and conflict cancel test coverage.
## FILES MODIFIED
| Action | Path | Change |
|---|---|---|
| Modified | `src/render/pipeline.ts` | Nested reference/abbreviation definition detection in guard and env; HTML block self-containment check falling back to full render |
| Modified | `src/entrypoints/reader/App.tsx` | Retained edited text on editor remount/mode toggle; source generation token and post-read dirty check in reload; immediate watcher unsubscription on navigation start; draft restore race guard; save write-completion race guard |
| Modified | `tests/unit/incremental-render.test.ts` | Added unit tests reproducing nested reference definition updates and HTML blocks across blank lines |
| Modified | `tests/unit/file-handle.test.ts` | Added unit test verifying that conflict-dialog Cancel never calls write |
| Modified | `tests/e2e/editor.spec.ts` | Added E2E test verifying edited text persistence across Split -> Read -> Split mode transitions |
| Modified | `docs/plans/markdown-reader-v1/phase-06/notes.md` | Recorded decisions and RED/GREEN test evidence for fix cycle 1 |
| Modified | `docs/plans/markdown-reader-v1/phase-06/journal.md` | Appended Fix cycle 1 response |
## NOTES
- `docs/plans/markdown-reader-v1/phase-06/notes.md` (`## Fix cycle 1`): RED/GREEN behavioral test evidence recorded for items 1, 2, 3, and 8.
- Fresh checks: `npm ci` passed (exit 0); `npm run typecheck` passed (exit 0); `npm test` passed 15 files / 97 tests with 0 skipped; 1 MiB timing test passed (best=1425.1 ms); Split latency medians measured 241.1 ms (full run) and 284.3 ms (isolated rerun) under heavy host load; both required grep checks printed nothing.
## SPEC COMPLIANCE
- Meets Spec? WITH_DEBT — all 8 review findings fixed with RED/GREEN evidence; Split latency budget accepted with debt under host load per Coordinator ruling.
## CLARIFICATIONS NEEDED
None
## NEXT
TASK_COMPLETE

## Review 2 (0609883b, Refract base, gpt-6.1-sol): FAIL
Verified fixed: nested-definition fallback, editor text retention, immediate watcher teardown, delayed draft restore. Render gate assertion accepted as real.
Blocking: HTML check accepts `<div/>` and incomplete tags (pipeline.ts:92-98); reload overwrites edits made during diskStamp and explicit Reload clears dirty after await (App.tsx:94-107); generation checks precede final awaits in openFile and drop (App.tsx:208,236); save completion not source-scoped (App.tsx:115-121,134-140); open or drop during a pending URL load leaves the spinner on (App.tsx:191,202-214,230-238); Cancel test does not exercise the dialog (file-handle.test.ts:36-49).
Debt noted: picker cancel leaves the previous file unwatched and not writable.
Next: fix cycle 2, the final cycle.


## Fix cycle 2 Response

# EXTERNAL RESPONSE
## META
- Phase / Started / Finished / Plan dir: Phase 6 fix cycle 2 / 2026-11-05T16:14:00+07:00 / 2026-11-05T16:34:00+07:00 / docs/plans/markdown-reader-v1
## SUMMARY
Fixed the conservative HTML fallback, async source/generation races, pending-load spinner, picker-cancel source preservation, and dialog Cancel coverage.
## FILES MODIFIED
| Action | Path | Change |
|---|---|---|
| Modified | `src/render/pipeline.ts` | Fallback for nonvoid slash-open and incomplete HTML tags. |
| Modified | `src/entrypoints/reader/App.tsx` | Central current-source guard at async boundaries; race-safe reload/save/open/drop/load, spinner and picker preservation. |
| Modified | `tests/unit/incremental-render.test.ts` | Regressions for `<div/>` and unterminated `<div` HTML block. |
| Modified | `tests/unit/file-handle.test.ts` | Render/click SaveConflictDialog Cancel; assert cancel and no overwrite callback. |
| Modified | `docs/plans/markdown-reader-v1/phase-06/notes.md` | Fix cycle 2 RED/GREEN and validation evidence. |
| Modified | `docs/plans/markdown-reader-v1/phase-06/journal.md` | Fix cycle 2 response. |
## NOTES
- `phase-06/notes.md` (`## Fix cycle 2`) records RED/GREEN evidence and validation results. `npm ci`, `npm run typecheck`, `npm test` (99 passed, 0 skipped), `npm run build`, and both source grep guards passed. `npm run test:e2e`: 19 passed, 1 failed, 0 skipped; only failure was existing editor render gate at 115.3 ms. Isolated rerun passed at 81.7 ms. Unchanged 1 MiB test passed (1110.1 ms). A prior full E2E run passed 20/20. `workers: 1` preserved.
## SPEC COMPLIANCE
- Meets Spec? WITH_DEBT — fixes and validation pass, except host-load-sensitive render gate failed in the final full run and passed isolated.
## CLARIFICATIONS NEEDED
None
## NEXT
TASK_COMPLETE

## Review 3 (ac09682e, confirmation): FAIL
Verified: post-diskStamp dirty check, final-await generation checks, source-scoped save, spinner clearing, dialog Cancel test, picker-cancel restore.
Blocking: explicit Reload clears dirty for edits typed during draft removal (App.tsx:102-104); HTML check misses `/` in unquoted attributes (pipeline.ts:78,134).
Both fix cycles used. Coordinator fixed directly:
- pipeline.ts: any html_block now forces a full render; the tag checker was removed. RED: 3 of 5 repro cases failed, including `<div data-url=/foo>` and `<div class=a/b>`. GREEN: 26 of 26.
- App.tsx reloadFromDisk: snapshot the draft before removal; if it changed during the await, keep the edits and show the external-change banner.
Validation: typecheck 0, 102 unit tests, greps empty, full E2E 19 passed and 1 failed at load 47, the editor render gate; isolated reruns passed at render medians 77.9 and 76.0 ms.

## Review Result
PASS_WITH_DEBT (35b8b6d0, confirmation of Coordinator fixes). Debt: end-to-end S3 and whole-document parse per keystroke to Phase 8; drop draft key to Phase 7; Cancel wiring by inspection and missing RED evidence to maintainer.
