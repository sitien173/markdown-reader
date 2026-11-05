<!-- refract-shared-version: 2.4.0 -->

# Phase 5 — Journal: Entry points: auto-render, popup, background, file access

## META

- Plan: docs/plans/markdown-reader-v1/PLAN.md
- Implementation Profile: balanced
- Consultation Profile: n/a
- Review Profile: base
- Implementation Job: pending
- Review Job: pending
- Started: 2026-11-05T13:44:37+07:00
- Finished: 2026-11-05T13:59:39+07:00

## Implementation Response

# EXTERNAL RESPONSE
## META
- Phase / Started / Finished / Plan dir: Phase 5 / 2026-11-05T13:44:37+07:00 / 2026-11-05T13:59:39+07:00 / docs/plans/markdown-reader-v1
## SUMMARY
Implemented Markdown URL auto-rendering, safe worker-managed session handoff, popup quick actions and recent URLs, context-menu handling, and file-access guidance.
## FILES MODIFIED
| Action | Path | Change |
|---|---|---|
| Modified | `src/entrypoints/detect.content.ts` | MIME/path-gated content detection and session handoff message |
| Modified | `src/entrypoints/background.ts` | Context menu, Markdown URL filter, popup actions, session capture, and tab navigation |
| Modified | `src/entrypoints/popup/App.tsx` | Viewer/editor/current-tab actions, recent list, file-access check |
| Modified | `src/entrypoints/reader/App.tsx` | Session text preference, FileUrlSource integration, recent tracking |
| Created | `src/source/file-url.ts` | File URL read with access guidance on failure |
| Created | `src/store/recent.ts` | Recent URL persistence, deduplication, newest-first 20-item cap |
| Created | `src/ui/file-access-dialog.tsx` | TDS Dialog with file URL access steps |
| Created | `tests/unit/recent.test.ts` | Recent list capacity/order/deduplication coverage |
| Created | `tests/unit/background.test.ts` | Context-menu URL filter coverage |
| Created | `tests/unit/detect.test.ts` | Content-type and Markdown-path filter coverage |
| Created | `tests/e2e/entry.spec.ts` | Raw text redirect, HTML exclusion, popup mode, and recents E2E |
| Modified | `docs/plans/markdown-reader-v1/phase-05/notes.md` | Tasks 1–4 decisions and RED/GREEN evidence |
| Modified | `docs/plans/markdown-reader-v1/phase-05/journal.md` | This implementation response |
## NOTES
- `docs/plans/markdown-reader-v1/phase-05/notes.md` (`## Task 1`–`## Task 4`): RED/GREEN evidence and follow-up audit note.
- Fresh checks: `npm ci` passed; `npm run typecheck` passed; `npm test` 10 files / 60 tests passed; `npm run build` passed; `npm run test:e2e` 15 passed, 0 skipped; both required source grep guards found no matches.
## SPEC COMPLIANCE
- Meets Spec? YES — required acceptance and verification checks passed; `tabs` is used for current-tab `tab.url` and tab navigation, documented in notes.
## CLARIFICATIONS NEEDED
None
## NEXT
TASK_COMPLETE

# EXTERNAL RESPONSE
## META
- Phase / Started / Finished / Plan dir: Phase 5 fix cycle 1 / 2026-11-05T14:00:00+07:00 / 2026-11-05T14:30:39+07:00 / docs/plans/markdown-reader-v1
## SUMMARY
Fixed the reported concurrency, capture validation, session staleness, URL scheme validation, popup styling/focus, content-script fallback, and mode validation issues with unit and E2E coverage.
## FILES MODIFIED
| Action | Path | Change |
|---|---|---|
| Modified | `src/store/recent.ts` | Serialized recent URL writes with Web Locks |
| Modified | `src/entrypoints/background.ts` | Validated capture sender/tab URL, shared URL allowlist, scheme and mode checks, rejected-link feedback |
| Modified | `src/entrypoints/reader/App.tsx` | One-time session consumption, TTL/URL checking, isolated recent-store errors |
| Modified | `src/entrypoints/popup/App.tsx` | Shared allowed URL checks and rejected URL feedback; URL truncation hook |
| Modified | `src/entrypoints/popup/main.tsx` | Imported popup stylesheet |
| Modified | `src/entrypoints/detect.content.ts` | Checked capture response and caught rejected messages |
| Modified | `src/source/url.ts` | Shared http/https/file allowlist |
| Created | `src/source/captured-text.ts` | Validated capture URL, timestamp, age, and text |
| Created | `src/styles/popup.css` | Token-based popup layout, URL truncation, and visible focus |
| Modified | `tests/unit/recent.test.ts` | Delayed concurrent-write no-loss test |
| Modified | `tests/unit/background.test.ts` | URL scheme and sender capture validation tests |
| Created | `tests/unit/captured-text.test.ts` | Stale and mismatched session-entry tests |
| Modified | `tests/e2e/fixtures.ts` | Reusable fixture server helper |
| Modified | `tests/e2e/entry.spec.ts` | One-shot capture/refetch distinction, stale/mismatch entries, popup focus-visible assertion |
| Modified | `docs/plans/markdown-reader-v1/phase-05/notes.md` | Appended fix-cycle decisions and test evidence |
| Modified | `docs/plans/markdown-reader-v1/phase-05/journal.md` | Appended this fix-cycle response |
## NOTES
- `docs/plans/markdown-reader-v1/phase-05/notes.md` (`## Fix cycle 1`) records RED/GREEN results and the menu feedback choice.
- `npm ci`, `npm run typecheck`, and `npm test` passed (11 files / 65 tests, no skips). Popup E2E passed. Full E2E: 15 passed, 1 failed, 0 skipped; existing 1 MiB render timing gate measured 5086 ms vs 5000 ms. Required source grep guards printed nothing.
## SPEC COMPLIANCE
- Meets Spec? NO — all review findings are addressed, but the required complete E2E command still fails the existing out-of-scope 1 MiB timing gate.
## CLARIFICATIONS NEEDED
None
## NEXT
CONTINUE_CONTEXT

## Review Result

- Quality review 2: job 6edc69ac-dc4d-4675-94ff-30b3c11b5b09, base, claude-sonnet-5-5. Status: FAIL on one item only: the 1 MiB timing E2E timed out in the reviewer runs.
- All review 1 blocking findings and debt verified fixed.
- Coordinator ruling: environmental. Phase 5 changed no render code; Coordinator full run passed 16 of 16 and two isolated reruns passed at 3714 and 3849 ms under host load average 11 to 25. Final status PASS_WITH_DEBT.
- Debt: undefined TDS typography classes; load-bound timing gate; badge persistence and orphan capture entries.

## Quality Review 1
- Job 2977d84a-eafd-4543-a8d9-4187ae2d7cd6, base, claude-sonnet-5-5. Status: FAIL. Full text: ~/.refract/results/2977d84a-eafd-4543-a8d9-4187ae2d7cd6.md
- Blocking: recent.ts read-modify-write race; capture-markdown trusts message.url and sender; stale session text with no TTL; no early scheme allowlist in menu and popup, no menu feedback.
- Fix cycle 1 submitted.
