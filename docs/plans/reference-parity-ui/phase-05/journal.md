<!-- refract-shared-version: 3.0.0 -->

# Phase 5 Journal: General tab

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
- Phase: 5 (General tab) / Started: 2026-11-09 / Finished: 2026-11-09T21:35:00+07:00 / Plan dir: docs/plans/reference-parity-ui
## SUMMARY
The General tab now drives Enable, Render .txt, charset compatibility, file and http(s) auto-refresh, and a read-only Local file access row, with dirty drafts preserved in every refresh path.
## FILES MODIFIED
| Action | Path | Change |
|---|---|---|
| Create | src/lib/settings-flags.ts | Zod-free SETTINGS_KEY and readGeneralFlags for background and detect |
| Create | src/source/decode.ts | decodeBytes, charsetFromContentType, readResponseText |
| Modify | src/lib/settings.ts | SETTINGS_KEY moved to settings-flags |
| Modify | src/entrypoints/background.ts | Enable and .txt gating, isMarkdownLink |
| Modify | src/entrypoints/detect.content.ts | shouldRedirectMarkdown with Enable and Render .txt, .txt matches |
| Modify | src/source/url.ts | Charset decode, http(s) watch, conditional polling |
| Modify | src/source/file-url.ts | Charset decode, file: bypass of captured text |
| Modify | src/source/watch.ts | clampIntervalSec, backoff, watchHttpUrl, intervalMs |
| Modify | src/reader/controller.ts | startWatch gated on settings, dirty-draft banner on all paths |
| Modify | src/ui/settings/general-tab.tsx | Working General rows and Local file access state |
| Modify | src/i18n/en-US.ts | General row strings |
| Create | tests/unit/charset.test.ts | Decode order and fallback |
| Create | tests/unit/auto-refresh.test.ts | Clamp, no poll by default, 5 s floor, 304, backoff, dirty draft |
| Create | tests/unit/settings-flags.test.ts | Zod-free flag reader |
| Create | tests/e2e/general.spec.ts | 8 General tab end-to-end tests |
| Modify | tests/unit/detect.test.ts | Enable and .txt cases |
| Modify | tests/unit/background.test.ts | isMarkdownLink .txt cases |
| Modify | tests/unit/watch.test.ts | Interval and polling cases |
| Modify | tests/unit/controller.test.ts | Watch gating and dirty draft cases |
| Modify | docs/plans/reference-parity-ui/phase-05/notes.md | Task 1 to 4 blocks |
| Modify | docs/plans/reference-parity-ui/phase-05/journal.md | This response |
## NOTES
- phase-05/notes.md  (## Task 1, ## Task 2, ## Task 3, ## Task 4)
- Fresh checks: typecheck exit 0; lint exit 0 with 183 warnings; vitest 40 files, 469/469; general.spec.ts 8 passed; test:e2e 134 passed.
## SPEC COMPLIANCE
- Meets Spec? YES
## CLARIFICATIONS NEEDED
None
## NEXT
TASK_COMPLETE

## Review Result

- Spec Status: PASS. Changed files match the Files list plus `src/i18n/en-US.ts`, `src/lib/settings.ts` (SETTINGS_KEY move), the Zod-free `src/lib/settings-flags.ts` with its test, and `src/source/file-url.ts` (Coordinator-approved for `file:` charset decoding). Built `background.js` and `content-scripts/detect.js` contain no Zod. Manifest permissions unchanged; only `*.txt` content-script matches added.
- Quality Status: PASS_WITH_DEBT (review 86dda087; first attempt 22865d2e failed transient).
- Coordinator validation at fceff49: typecheck 0, lint 0 (183 warnings), vitest 469/469, e2e 134 passed.
- Debt (owner: Phase 6 implementer, task-0):
  1. `src/source/url.ts` `read()` uses default fetch cache, so a reload after a detected http change can return a stale cached body. Use `cache: 'no-cache'` or reuse the polled text.
  2. `src/source/watch.ts` http poll uses `redirect: 'manual'`, so any redirecting URL (http to https, GitHub /raw/) fails every poll and backs off silently. Handle `opaqueredirect` by re-polling with `redirect: 'follow'` and no validators, comparing text.
  3. `charsetCompat` applies only on reopen; say so in the General row description.
  4. Correction to phase-05/notes.md Task 4 tradeoff: `general-tab.tsx` does re-read file access on window focus and dialog close.

## Final Checkpoint

- Phase base ref: refs/plans/reference-parity-ui/phase-05/base
- Phase implementation ref: refs/plans/reference-parity-ui/phase-05/impl
- Plan commit ref: pending
- State checkpoint: temporary commit
