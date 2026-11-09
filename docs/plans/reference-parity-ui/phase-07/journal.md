<!-- refract-shared-version: 3.0.0 -->

# Phase 7 Journal: Hardening and release audit

<!-- Created by the worker per worker-contract.md. Append every block; keep earlier sections. -->

## META

- Plan: docs/plans/reference-parity-ui/PLAN.md
- Implementation Profile: balanced
- Consultation Profile: n/a
- Review Profile: balanced
- Implementation Job: pending
- Review Job: pending
- Started: 2026-11-09
- Finished: 2026-11-09T23:25:00+07:00

## Implementation Response

### DESIGN success criteria checklist

| # | Criterion | Proving spec | Status |
|---|---|---|---|
| 1 | Popup with four-tab rail, every in-scope setting | `tests/e2e/popup.spec.ts` (four-tab rail, role tree), `tests/e2e/settings.spec.ts` (popup 520 by 480), `tests/e2e/general.spec.ts`, `tests/e2e/appearance.spec.ts`, `tests/e2e/plugins.spec.ts`, `tests/unit/settings-panel.test.tsx`, `tests/e2e/popup.spec.ts` ("the settings rail is 60 px wide": tablist bounding box width is 60) | Pass |
| 2 | Persist, survive reload, reach open tabs without reload | `tests/unit/settings-store.test.ts` (onChanged and write cases), `tests/e2e/appearance.spec.ts` (stored value applies live, no reload), `tests/e2e/plugins.spec.ts`, `tests/e2e/appearance.spec.ts` ("Zen mode" describe, "starts on when stored, and Escape leaves the session only": stored `appearance.zen` is applied after two `page.reload()` calls) | Pass |
| 3 | Same panel in popup, options, reader dialog | `tests/e2e/settings.spec.ts` (options page, popup, reader dialog), `tests/e2e/contrast.spec.ts` (all three surfaces) | Pass |
| 4 | Sidebar, segmented control, search, floating toggle and menu, no top bar | `tests/e2e/reader-shell.spec.ts` | Pass |
| 5 | Code language label and Copy, aria-hidden permalink | `tests/e2e/reader-shell.spec.ts` (Copy, permalink), `tests/e2e/contrast.spec.ts` (Copy named, forced light and dark) | Pass |
| 6 | Pre-existing features | `tests/e2e/shell.spec.ts`, `editor.spec.ts`, `palette.spec.ts`, `keyboard.spec.ts`, `export.spec.ts`, `reload.spec.ts`, `motion.spec.ts`, `tests/e2e/zen-fullscreen.spec.ts`. Dark mode: `tests/e2e/theme.spec.ts` ("Dark forces dark tokens in a light system and Mermaid redraws in dark", "Auto follows the system and removes data-theme"). Edit and split: `tests/e2e/reader-modes.spec.ts` ("edit mode shows the compact header with title, Save, and the Read, Edit, Split radio group", "split mode shows the same header with Split checked"), `tests/e2e/editor.spec.ts` ("typing in Split, switching to Read, then back to Split preserves edited text"). Open URL, welcome, recents: `tests/e2e/shell.spec.ts` ("welcome screen shows with no document and hides the toolbar mode switch"), `tests/e2e/reader.spec.ts` ("URL source, retry, nested TOC, file picker, and keyboard focus"), `tests/e2e/entry.spec.ts` ("popup actions open the requested reader mode and recent URLs are newest first") | Pass (170 e2e) |
| 7 | S3 and S4 with all plugins and `[[TOC]]` | `tests/e2e/perf.spec.ts` ("S3 with all plugins on and a [[TOC]] document", "S4 with all plugins on") | Pass |
| 8 | Zero network from render and export, XSS inert | `tests/e2e/export.spec.ts`, `tests/e2e/perf.spec.ts` S8 and S9, `tests/e2e/enhance.spec.ts` (sanitized XSS fixture) | Pass |
| 9 | No stored settings equals base | `tests/unit/settings.test.ts` (default settings), `tests/unit/pipeline-config.test.ts`, and every e2e spec that runs with empty storage | Accepted with evidence: `tests/unit/pipeline.test.ts` is unchanged against `refs/plans/reference-parity-ui/base` and passes. The only default-output difference is the four new syntaxes (TOC, Insert, Front matter, Multi-markdown table) defaulting On, user confirmed 2026-11-09 in PLAN.md Resolved ambiguity 1. `tests/unit/settings.test.ts` ("defines default settings with version 1 and all expected fields") proves the defaults. No spec diffs output against the base build |

### Reviewer notes
- Escape guard mechanism: see notes.md Task 2. Escape with `document.fullscreenElement` set calls `exitFullscreen()` and keeps Zen; a `fullscreenchange` event opens a 300 ms guard; any other Escape with no dialog or menu still exits Zen.
- Popup role differences against the reference: see notes.md Task 3 and `tests/fixtures/popup-roles.json`.
- Popup and options pages follow the OS scheme only and ignore `appearance.theme`. Fixing it needs `src/entrypoints/popup/main.tsx` and `src/entrypoints/options/main.tsx`, outside the allowed set.
- Known follow-up, not built: popup and options pages do not apply `appearance.theme`. DESIGN success criterion 2 scopes live settings to reader tabs.
- Fix batch: the Contents panel keeps outline collapse across auto-refresh and draft restore. See the last `# EXTERNAL RESPONSE` below.

# EXTERNAL RESPONSE
## META
- Phase 7 / Started 2026-11-09 / Finished 2026-11-09T23:25:00+07:00 / Plan dir docs/plans/reference-parity-ui
## SUMMARY
Fixed the four task-0 review items, added reduced-motion, contrast, accessible-name, Escape-in-fullscreen, and popup role-tree specs with the fixes they exposed, updated README and CHROMEWEBSTORE, and audited the zip: permissions equal base and `options_ui` is present.
## FILES MODIFIED
| Action | Path | Change |
|---|---|---|
| Modify | src/source/watch.ts | Redirect-follow fetch uses `cache: 'no-cache'` |
| Modify | src/entrypoints/reader/App.tsx | `TocPanel` keyed by `loadId`; Zen Escape guard with fullscreen exit and `fullscreenchange` guard |
| Modify | src/styles/reader.css | `user-select: none` on `.md-code-bar` |
| Modify | src/ui/settings/general-tab.tsx | Accessible name for the interval slider |
| Modify | src/ui/settings/appearance-tab.tsx | Accessible name for the max width slider |
| Modify | tests/unit/watch.test.ts | Asserts `cache: 'no-cache'` |
| Modify | tests/unit/reader-render.test.tsx | `ReaderMenu` spy, read-mode check, contents panel collapse reset test |
| Modify | tests/e2e/motion.spec.ts | Reduced-motion checks for new surfaces |
| Modify | tests/e2e/contrast.spec.ts | Forced light and dark contrast and accessible-name checks |
| Create | tests/e2e/popup.spec.ts | Popup role tree against the fixture |
| Create | tests/e2e/zen-fullscreen.spec.ts | Escape, fullscreen, and Zen specs |
| Create | tests/fixtures/popup-roles.json | Roles and names only |
| Modify | README.md | Settings section |
| Modify | CHROMEWEBSTORE.md | Settings and .txt paragraph |
| Modify | docs/plans/reference-parity-ui/phase-07/notes.md | Task 0 to 4 blocks |
| Modify | docs/plans/reference-parity-ui/phase-07/journal.md | Checklist and this response |
## NOTES
- phase-07/notes.md (## Task 0, ## Task 1, ## Task 2, ## Task 3, ## Task 4)
- Fresh checks: typecheck exit 0; lint exit 0 with 183 warnings; vitest 482/482 (40 files); build exit 0; targeted playwright 33 passed; `pnpm test:e2e` 168 passed, 0 failed, 0 skipped; `wxt zip` exit 0.
## SPEC COMPLIANCE
- Meets Spec? WITH_DEBT: every check passes; no spec asserts the 60 px rail width of criterion 1, criterion 9 is proved indirectly, popup and options ignore `appearance.theme`, and the Escape fullscreen path was not observed in headed Chrome.
## CLARIFICATIONS NEEDED
None
## NEXT
TASK_COMPLETE


# EXTERNAL RESPONSE
## META
- Phase 7 fix batch / Date 2026-11-09 / Plan dir docs/plans/reference-parity-ui / No commit made
## SUMMARY
Fixed the Contents panel losing outline collapse on auto-refresh, made Escape close only an open dialog or palette in fullscreen, corrected the theme wording in README and CHROMEWEBSTORE, added the 60 px rail width assertion, and strengthened the journal checklist for criteria 1, 2, 6, and 9.
## FILES MODIFIED
| Action | Path | Change |
|---|---|---|
| Modify | src/store/reader-store.ts | New `sourceId: string` field, initial `''` |
| Modify | src/reader/controller.ts | `applyText` writes `sourceId: id` with the existing `set` |
| Modify | src/entrypoints/reader/App.tsx | `TocPanel` keyed by `sourceId` and `docPath`; open dialog or menu check moved above the `fullscreenElement` branch |
| Modify | tests/unit/reader-render.test.tsx | Collapse cases (loadId bump keeps, source change resets, split edit keeps) and fullscreen-with-dialog case |
| Modify | tests/e2e/zen-fullscreen.spec.ts | Escape in fullscreen with the palette open closes only the palette |
| Modify | tests/e2e/popup.spec.ts | Rail width is 60 px |
| Modify | README.md, CHROMEWEBSTORE.md | Theme wording |
| Modify | docs/plans/reference-parity-ui/phase-07/notes.md | Fix batch block, including the 300 ms swallow line |
| Modify | docs/plans/reference-parity-ui/phase-07/journal.md | Checklist rows 1, 2, 6, 9, reviewer notes, this response |
## NOTES
- RED to GREEN, item 1: with the old `App.tsx`, "keeps collapse state when loadId bumps for the same source" failed (`expected null not to be null`). After the change, 14 of 14 pass in `reader-render.test.tsx`. The old case "resets collapse state when a new document loads" now bumps `sourceId` and is renamed "resets collapse state when the source changes".
- RED to GREEN, item 2: with the old `App.tsx`, the unit case failed (`exitFullscreen` called once while a dialog was open). The e2e case passes on old and new code because Chrome marks the palette Escape as handled, so it is a regression guard, not a RED.
- Item 4 has no RED. It asserts existing behavior and passed on first run at exactly 60.
- Key choice: `sourceId` alone would not reset on file switches inside a folder, since they share the directory identity, so the key also includes `docPath`.
- The request said "DESIGN Resolution 1". The user-confirmed default-On decision is in PLAN.md "Resolved ambiguities" item 1, and the journal cites that.
- One test run overlapped with a background `pnpm build` and failed the new e2e case. It was discarded. The spec passed 3 of 3 alone, and every check below ran sequentially.
- Fresh checks: typecheck exit 0; lint exit 0, 0 errors, 183 warnings, 3 infos; vitest 40 files, 485 tests passed (Prior State: 482); targeted playwright (popup, zen-fullscreen, motion, contrast) 35 passed (Prior State: 33); `pnpm test:e2e` foreground 170 passed in 5.0 min, 0 failed (Prior State: 168); `wxt zip` exit 0, `.output/markdown-reader-1.0.0-chrome.zip`, 4074866 bytes.
- Zip audit: `permissions` `['storage','contextMenus','tabs']`, `host_permissions` `['<all_urls>']`, `options_ui` `{page: options.html, open_in_tab: true}`; 0 entries matching `snapshot/`, `tests/`, `docs/`.
- Known follow-up, not built: popup and options pages do not apply `appearance.theme`. The Escape fullscreen path was not observed in headed Chrome.
## SPEC COMPLIANCE
- Meets Spec? YES for the six fix items. Remaining debt: popup and options ignore `appearance.theme` (DESIGN success criterion 2 scopes live settings to reader tabs), and headed Chrome Escape was not observed.
## CLARIFICATIONS NEEDED
None
## NEXT
TASK_COMPLETE

# EXTERNAL RESPONSE
## META
- Phase 7 deflake / Date 2026-11-10 / Plan dir docs/plans/reference-parity-ui / No commit made
## SUMMARY
Fixed the flaky `tests/e2e/zen-fullscreen.spec.ts` case "Escape in fullscreen with the palette open closes only the palette". The root cause was in the test, so `App.tsx` is unchanged in this batch.
## FILES MODIFIED
| Action | Path | Change |
|---|---|---|
| Modify | tests/e2e/zen-fullscreen.spec.ts | Settle waits and a `fullscreenchange` counter in the one case |
| Modify | docs/plans/reference-parity-ui/phase-07/notes.md | Deflake block |
| Modify | docs/plans/reference-parity-ui/phase-07/journal.md | This response |
## NOTES
- Root cause: the palette that ran Toggle Fullscreen was still closing when the test pressed Ctrl+K and Escape. The app ignores a closing dialog by design, so Escape exited fullscreen. Reproduced under CPU load at 2 of 12 failures, same `Expected: true Received: false`. It did not reproduce on an idle machine.
- Fix keeps what the case proves: the palette closes, the document stays fullscreen with no `fullscreenchange` after the enter event, and Zen stays on (`data-focus` true, Exit button visible).
- Verification: the case passed 20 of 20 under the load that failed 2 of 12. The whole spec passed 80 of 80 with `--repeat-each=20`.
- Fresh checks: typecheck exit 0; lint exit 0, 0 errors, 183 warnings; vitest 40 files, 485 passed.
- `pnpm test:e2e` foreground: the first run failed 1 of 170 in `tests/e2e/entry.spec.ts:52` (popup first Tab, General tab not focused). It passed 15 of 15 in isolation. The second full run passed 170 of 170 in 5.4 min. That test and its cause are untouched by this batch and are recorded as a separate unfixed flake in notes.md.
## SPEC COMPLIANCE
- Meets Spec? YES for the deflake. Debt: the `entry.spec.ts:52` flake, unconfirmed cause.
## CLARIFICATIONS NEEDED
None
## NEXT
TASK_COMPLETE

## Review Result

- Spec Status: PASS. Changed files match the Files list plus task-0 files and Code Context allowances; fix batch added minimal `sourceId` in `src/store/reader-store.ts` and `src/reader/controller.ts` (Coordinator-approved). Zip audit: permissions `storage`, `contextMenus`, `tabs`; host `<all_urls>`; equal to base; `options_ui` present; no `snapshot/`, `tests/`, `docs/` entries; no Zod in background or detect bundles.
- Quality Status: PASS_WITH_DEBT. Review 3d26de94 PASS_WITH_DEBT; fix batch 86b6820f and deflake 389df012; re-review 8fbf413f PASS_WITH_DEBT with no new defects.
- Coordinator validation at 4eb56b1: typecheck 0, lint 0 (183 warnings), vitest 485/485, e2e 170/170, zen-fullscreen and entry specs 90/90 with --repeat-each=10, wxt zip exit 0.
- Accepted debt (backlog for a later plan; no owner phase remains):
  1. Popup and options pages ignore `appearance.theme` (not required by DESIGN; docs say the theme applies in the reader).
  2. Success criterion 9 is proven indirectly (pre-plan pipeline.test.ts unchanged; four new syntaxes default On per PLAN Resolved ambiguities item 1).
  3. `tests/unit/reader-render.test.tsx` ~263 does not restore `document.exitFullscreen` in afterEach.
  4. `tests/e2e/entry.spec.ts:52` failed once under load during the deflake run; passed 10/10 on repeat and in full runs. Cause unconfirmed.
  5. Escape in fullscreen not observed in headed Chrome.

## Final Checkpoint

- Phase base ref: refs/plans/reference-parity-ui/phase-07/base
- Phase implementation ref: refs/plans/reference-parity-ui/phase-07/impl
- Plan commit ref: refs/plans/reference-parity-ui/impl
- State checkpoint: consolidated into one commit on main

## Final Plan Audit

- Status: PASS. All DESIGN success criteria, invariants, resolved ambiguities and phase acceptance criteria MET; none UNMET.
- Criterion 9: accepted per PLAN Resolved ambiguities 1 and 3; DESIGN.md criterion 9 annotated.
- Phase 4 inline custom CSS error: closed by job e7615933, e2e `tests/e2e/appearance.spec.ts:247`; appearance spec 75/75 with --repeat-each=5; typecheck 0, lint 0 (183 warnings), build 0.
- Phase 6 collapse-reset deviation accepted: TocPanel keyed by source and path keeps collapse across auto-refresh and resets on source change.
