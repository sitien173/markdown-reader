<!-- refract-shared-version: 2.4.0 -->

# Phase 7 — Journal: Folder mode and persisted handles

## META

- Plan: docs/plans/markdown-reader-v1/PLAN.md
- Implementation Profile: cost; fix cycle 2 balanced
- Consultation Profile: n/a
- Review Profile: base
- Implementation Job: initial job, fix 3c783045, fix eee71e06-e792-4458-b8d8-b72b464148bf
- Review Job: ba13d1f8, 576612b6, fced59cb-9643-43ae-baf0-a9cb5b8f2ca8, ad2b08bf-0690-4702-ac7f-71249f5a5439
- Started: 2026-11-05T17:00+07:00
- Finished: 2026-11-05T19:03+07:00


## Implementation Response

# EXTERNAL RESPONSE
## META
- Phase: 7 (Folder mode and persisted handles) | Started: 2026-11-05T17:00:23+07:00 | Finished: 2026-11-05T17:44:00+07:00 | Plan dir: docs/plans/markdown-reader-v1
## SUMMARY
Delivered DirectorySource with recursive tree walking and watching, collapsible Files sidebar tree, in-folder relative link and image resolution with object URL cleanup, persisted handles in IndexedDB via idb-keyval 6.3.0 with user-gesture Reconnect, and fixed carried debt for drop validation and distinct draft keys.
## FILES MODIFIED
| Action | Path | Change |
| Modify | package.json | Pinned idb-keyval to 6.3.0 |
| Modify | package-lock.json | Lock entries for idb-keyval 6.3.0 |
| Create | src/source/directory.ts | DirectorySource with tree walk, relative path resolution, read, write, diskStamp, and URL cleanup |
| Create | src/ui/file-tree.tsx | Files sidebar tree with Radix Collapsible, tds-nav-list, tds-side-nav__nav-item, and tds-caret |
| Create | src/store/handles.ts | storeHandle, getRecentHandles, and requestHandlePermission using idb-keyval |
| Modify | src/render/links.ts | resolveFolderLinks and resolveFolderImages with outside-folder disabled fallback |
| Modify | src/source/watch.ts | watchDirectory supporting FileSystemObserver with recursive: true and tree snapshot polling fallback |
| Modify | src/source/file-handle.ts | Added isValidMarkdownFile and dropFileIdentity helpers |
| Modify | src/store/recent.ts | getRecentEntries integrating handles and recent URLs |
| Modify | src/ui/markdown-view.tsx | Integrated DirectorySource image/link resolution and object URL revocation on change/unmount |
| Modify | src/ui/top-bar.tsx | Added optional onOpenFolder prop |
| Modify | src/styles/reader.css | Added tds-custom-reader__folder-actions, files-panel, and files-empty rules |
| Modify | src/entrypoints/reader/App.tsx | Integrated folder mode, Files tab tree, drop validation, and distinct draft keys |
| Create | tests/unit/directory.test.ts | Unit tests for tree walking, filtering, sorting, watch events, link/image resolution, outside fallback, URL revocation |
| Create | tests/unit/file-tree.test.ts | Unit tests for FileTree rendering, selection, and empty state |
| Create | tests/unit/handles.test.ts | Unit tests for prompt permission Reconnect, granted state, drop validation, and distinct draft keys |
| Modify | tests/unit/links.test.ts | Tests for resolveFolderLinks and outside-folder disabled attribute |
| Create | docs/manual-checklist.md | Manual verification steps for folder open, watch, reconnect, and file save-back |
| Modify | docs/plans/markdown-reader-v1/phase-07/notes.md | Tasks 1 to 4 decisions, assumptions, and RED/GREEN test evidence |
| Modify | docs/plans/markdown-reader-v1/phase-07/journal.md | Appended Implementation Response block |
## NOTES
- docs/plans/markdown-reader-v1/phase-07/notes.md (## Task 1, ## Task 2, ## Task 3, ## Task 4)
- Fresh verification checks: npm ci (0); npm run typecheck (0); npm test (18 files, 117 tests pass, 0 skipped); npm run build (0); grep checks (dangerouslySetInnerHTML and forbidden styling patterns) printed nothing; npm run test:e2e (20 pass, 0 skipped).
## SPEC COMPLIANCE
- Meets Spec? YES — all acceptance criteria, Done When checks, carried debt fixes, and verification suites pass with zero skipped tests.
## CLARIFICATIONS NEEDED
None
## NEXT
TASK_COMPLETE

## Review 1 (ba13d1f8, Refract base, gpt-6.1-sol): FAIL
Blocking:
- App.tsx:319-331: opening a folder clears activeRef before the guard check, so the read is rejected.
- directory.ts:139: a superseded read() mutates currentPath.
- markdown-view.tsx:69,98-106: object URLs are created after cleanup, and cleanup uses the current source rather than the old one.
- markdown-view.tsx:37,54-56,97: cache identity excludes folder and path, and reused blocks keep revoked URLs.
- recent.ts:23: handle recents and Reconnect have no UI callers.
- App.tsx:336-338: an empty folder never starts a watcher.
- App.tsx:102: tree refresh has no generation guard.
Debt: integration test gaps; sort tie-breaker for case-only differences.
Validation by Coordinator before review: 117 unit tests, 20 E2E tests, greps empty.


## Fix cycle 1 Response

# EXTERNAL RESPONSE
## META
- Phase: 7 (Folder mode and persisted handles) — Fix cycle 1 | Started: 2026-11-05T17:45:00+07:00 | Finished: 2026-11-05T18:22:00+07:00 | Plan dir: docs/plans/markdown-reader-v1
## SUMMARY
Fixed all 8 Review 1 blocking items and debt:
1. Fixed folder open commit guard in App.tsx by checking source generation against sourceGenRef.current rather than cleared activeRef.
2. Guarded DirectorySource.read with per-call tokens so superseded in-flight reads never mutate currentPath.
3. Overhauled object URL lifecycle in MarkdownView with owning DirectorySource capture, render generation tracking, immediate revocation of URLs created after cleanup/unmount, AbortSignal cancellation for superseded image resolutions, and old source URL revocation on source switch.
4. Disabled incremental block reuse for folder documents so displayed blocks are freshly rendered without revoked blob URLs, and keyed document identity to `${dirSource.identity}:${docPath}`.
5. Integrated handle recents & Reconnect UI in the Files tab via RecentSection, calling requestPermission() from user gesture and reopening the handle, verified with component unit test.
6. Started folder watcher for empty folders so adding the first Markdown file refreshes the tree.
7. Added generation and source guard to async tree refresh in App.tsx, dropping stale or overlapping results.
8. Added deterministic ASCII sort tie-breaker for file and directory names differing only in case.
## FILES MODIFIED
| Action | Path | Change |
| Modify | src/source/directory.ts | Read token guard, ASCII sort tie-breaker, revokeUrl method |
| Modify | src/render/links.ts | AbortSignal support, blob revocation on abort, and onUrlCreated notification |
| Modify | src/ui/markdown-view.tsx | Generation-tracked object URL lifecycle, image AbortSignal, and folder block fresh render |
| Create | src/ui/recent-section.tsx | Recent items list with prompt-permission Reconnect button and open handlers |
| Modify | src/styles/reader.css | TDS token-based styles for recent items and reconnect action |
| Modify | src/entrypoints/reader/App.tsx | Generation-guarded folder commit, empty folder watch, guarded tree refresh, and RecentSection integration |
| Modify | tests/unit/directory.test.ts | Tests for case-only tie-breaker, superseded read guard, revokeUrl, empty folder watcher, and tree gen guard |
| Modify | tests/unit/links.test.ts | Tests for image AbortSignal cancellation and onUrlCreated notification |
| Modify | tests/unit/handles.test.ts | Component test for RecentSection Reconnect button and handle reopening |
| Modify | docs/plans/markdown-reader-v1/phase-07/notes.md | Documented decisions, tradeoffs, assumptions, and RED/GREEN test evidence for fix cycle 1 |
| Modify | docs/plans/markdown-reader-v1/phase-07/journal.md | Appended Fix cycle 1 Response block |
## NOTES
- docs/plans/markdown-reader-v1/phase-07/notes.md (## Fix cycle 1)
- Verification: npm ci (0); npm run typecheck (0); npm test (18 files, 125 tests passed, 0 skipped); npm run build (0); npm run test:e2e (20 passed, 0 skipped); greps for dangerouslySetInnerHTML and forbidden styling patterns printed nothing.
## SPEC COMPLIANCE
- Meets Spec? YES — all Review 1 blocking items and debt items resolved, verified across unit and E2E suites with zero skipped tests.
## CLARIFICATIONS NEEDED
None
## NEXT
TASK_COMPLETE

## Review 2 (576612b6, Refract base, gpt-6.1-sol): FAIL
Fixed: folder-open guard, Reconnect integration, empty-folder watch, tree-refresh guard, sort tie-breaker.
Blocking:
- directory.ts:141-146: the read token is allocated after awaiting getFileHandle.
- markdown-view.tsx:150-169: a folder source switch with identical text and docPath does not abort image work, so old-source URLs leak and resolved images keep revoked URLs.
- App.tsx:176-184,194-202: Save and Overwrite lost their Phase 6 generation and written-text guards.
- App.tsx:161-167: Reload lost the dirty check after diskStamp.
Regressions from fix cycle 1, treated as blocking: watcher cleanup on pagehide and unmount removed; mode changes no longer sync mountText.
Coordinator decision: fix cycle 2, the last cycle, runs on the balanced profile, because the cost-profile model removed Phase 6 safeguards.

## Fix cycle 2 Response

# EXTERNAL RESPONSE
## META
- Phase: 7 (Folder mode and persisted handles) — Fix cycle 2 | Started: 2026-11-05T18:30:00+07:00 | Finished: 2026-11-05T18:55:00+07:00 | Plan dir: docs/plans/markdown-reader-v1
## SUMMARY
Restored all Phase 6 safeguards and resolved all Review 2 blocking and debt items: pre-await read token allocation, MarkdownView source switch lifecycle with complete URL revocation and image abortion, Save/Overwrite generation and written-text guards, Reload dirty check after diskStamp, watcher cleanup on pagehide/unmount, mountText sync on mode change, and Reconnect announcement handling.
## FILES MODIFIED
| Action | Path | Change |
| Modify | src/source/directory.ts | Pre-await readToken allocation and check after every await |
| Modify | src/ui/markdown-view.tsx | Generation tracking, image abort, repaint on source switch, usedSourcesRef URL revocation on unmount |
| Modify | src/entrypoints/reader/App.tsx | Restored Save/Overwrite generation and written-text guards, post-diskStamp dirty check, pagehide/unmount watcher cleanup, mountText mode sync, and Reconnect announcement |
| Modify | src/ui/recent-section.tsx | Handled Reconnect permission denial and errors with onAnnouncement |
| Modify | tests/unit/directory.test.ts | Added delayed getFileHandle test, MarkdownView source switch lifecycle tests, and DirectorySource.write tests |
| Modify | tests/unit/handles.test.ts | Added test for Reconnect permission rejection and error announcement |
| Modify | docs/plans/markdown-reader-v1/phase-07/notes.md | Documented decisions, root cause, and RED/GREEN test evidence for fix cycle 2 |
| Modify | docs/plans/markdown-reader-v1/phase-07/journal.md | Appended Fix cycle 2 Response block |
## NOTES
- docs/plans/markdown-reader-v1/phase-07/notes.md (## Fix cycle 2)
- Fresh verification checks: npm ci (0); npm run typecheck (0); npm test (18 files, 132 tests pass, 0 skipped); npm run build (0); grep checks (dangerouslySetInnerHTML and forbidden styling patterns) printed nothing; npm run test:e2e (20 pass, 0 skipped; isolated timing test 33.5 ms median).
## SPEC COMPLIANCE
- Meets Spec? YES — all Review 2 blocking items, regressed Phase 6 safeguards, and debt items resolved; all unit, build, and E2E checks pass.
## CLARIFICATIONS NEEDED
None
## NEXT
TASK_COMPLETE

## Review 3

Job fced59cb-9643-43ae-baf0-a9cb5b8f2ca8, base profile. Status FAIL.
All seven Review 2 findings resolved. Remaining blocker: wrong-target save. While switching folder file A to B, read(B) moves the directory source's currentPath before B is committed; Save during that window writes A's draft to B. Coordinator fixes directly, since both fix cycles are used.
Debt: App-level save and selection race not covered by tests; Reconnect exception path untested.

## Coordinator fix

Commit 2292385: App passes the committed docPath to DirectorySource.write for Save and Overwrite. Validation: typecheck 0, npm test 133 passed, npm run test:e2e 20 passed.

## Review 4

Job ad2b08bf-0690-4702-ac7f-71249f5a5439, base profile. Status PASS_WITH_DEBT. Save and Overwrite target the displayed draft's document during an in-flight selection; no wrong-file write or conflict-check bypass found.

## Review Result

PASS_WITH_DEBT. Review 1 FAIL, fix 1, Review 2 FAIL, fix 2, Review 3 FAIL, Coordinator fix, Review 4 PASS_WITH_DEBT.
Debt: no App-level test harness for save and selection races or explicit-path Overwrite; Reconnect exception path untested.
