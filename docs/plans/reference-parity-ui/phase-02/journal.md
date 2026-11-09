<!-- refract-shared-version: 3.0.0 -->

# Phase 2 Journal: Shared SettingsPanel shell

<!-- Created by the worker per worker-contract.md. Append every block; keep earlier sections. -->

## META

- Plan: docs/plans/reference-parity-ui/PLAN.md
- Implementation Profile: balanced
- Consultation Profile: n/a
- Review Profile: balanced
- Implementation Job: b4890cb2
- Review Job: ecb54626 PASS_WITH_DEBT
- Started: 2026-11-09
- Finished: 2026-11-09T12:26:20Z

## Implementation Response

# EXTERNAL RESPONSE
## META
- Phase 2 / Started 2026-11-09 / Finished 2026-11-09T12:26:20Z / Plan dir docs/plans/reference-parity-ui
## SUMMARY
Shared SettingsPanel (General, Appearance, Plugins, About) now renders in the popup, a new options page, and a reader dialog opened by the `settings` palette command, and the Phase 1 store-race debt is fixed.
## FILES MODIFIED
| Action | Path | Change |
|---|---|---|
| modify | src/store/settings-store.ts | task-0: load retry, rollback on failed write, reset order, onChanged echo guard |
| modify | tests/unit/settings-store.test.ts | task-0 tests |
| create | src/components/ui/switch.tsx, slider.tsx, select.tsx, textarea.tsx | shadcn controls; `cn` import fixed to `@/lib/utils` |
| create | src/ui/settings/settings-panel.tsx, general-tab.tsx, appearance-tab.tsx, plugins-tab.tsx, about-tab.tsx, settings-dialog.tsx | panel shell and tabs |
| create | src/entrypoints/options/index.html, main.tsx, App.tsx | options page host |
| modify | src/entrypoints/popup/App.tsx, main.tsx | popup hosts the panel, awaits settings load |
| modify | src/styles/popup.css | 520 by 480 px |
| modify | wxt.config.ts | `options_ui` key |
| modify | src/reader/commands.ts | `settings` command, `openSettings` dep |
| modify | src/entrypoints/reader/App.tsx | mounts SettingsDialog |
| modify | src/i18n/en-US.ts | settings strings |
| create | tests/unit/settings-panel.test.tsx, tests/e2e/settings.spec.ts | new tests |
| modify | tests/e2e/entry.spec.ts | Tab order, alert test, Reset test |
| modify | tests/unit/commands.test.ts, tests/unit/shortcuts.test.ts | add `openSettings` (outside Files list) |
| modify | docs/plans/reference-parity-ui/phase-02/notes.md, journal.md | records |
## NOTES
- phase-02/notes.md (## Task 0, ## Task 1, ## Task 2, ## Task 3, ## Task 4, ## Final checks)
- Fresh checks: typecheck exit 0; lint exit 0 with 188 warnings; vitest 347/347; `pnpm test:e2e` 102 pass; settings and entry specs 8 pass; built manifest has `options_ui` page `options.html`, `open_in_tab` true.
## SPEC COMPLIANCE
- Meets Spec? WITH_DEBT: all checks pass; debt is the weak task-3 RED evidence, the edited Tab-order assertion, two test files edited outside Files, no e2e for the file-access dialog, and the `cn` package that shadcn added and I removed (see notes).
## CLARIFICATIONS NEEDED
None
## NEXT
TASK_COMPLETE

## Spec Review

Coordinator: PASS. Validation at cb19dbf: typecheck 0, lint 0 (188 warnings), vitest 347/347, e2e 102 passed, manifest options_ui page options.html open_in_tab true. commands.test.ts and shortcuts.test.ts edited outside Files list only to add openSettings dep; accepted.

## Quality Review

# CODE QUALITY REVIEW
- Status: PASS_WITH_DEBT
- Findings:
  - non-blocking, src/store/settings-store.ts, 27, The echo guard only works while a write is still pending. `write()` removes the key in `finally` as soon as `storage.local.set` resolves. If Chrome delivers the onChanged echo after that, an echo of write A can briefly overwrite state that already includes a later write B. The new test stub fires the listeners before its `set` resolves, so it does not cover this ordering. Fix: drop the key only when its own echo arrives, with a timeout as a fallback, or tag each write with a sequence number and ignore echoes older than the latest local write. Add a stub variant that fires onChanged after `set` resolves.
  - non-blocking, src/store/settings-store.ts, 28, `pendingWrites.splice(pendingWrites.indexOf(key), 1)` removes the last entry when `indexOf` returns -1. That can happen after `_resetStoreForTesting` clears the array while a write is in flight. Fix: `const i = pendingWrites.indexOf(key); if (i !== -1) pendingWrites.splice(i, 1);`.
  - non-blocking, src/store/settings-store.ts, 56, A successful `load()` still runs `set({ settings: await readSettings() })` unconditionally. A read that started before an in-flight `update()` or onChanged event can replace newer state with the stale stored value, and the echo guard then hides the correction. Every host awaits `load()` before rendering, so users cannot hit this today. Fix: record the settings reference when `load()` starts and call `set` only if `get().settings` is still that reference.
  - non-blocking, src/store/settings-store.ts, 94, `reset()` sets state before writing but has no rollback, while `update()` now does. If the write rejects, the store shows defaults that storage does not hold. Fix: mirror `update()`: save `current`, and in a catch block restore it when `get().settings === next`, then rethrow.
  - non-blocking, src/ui/settings/general-tab.tsx, 22, The language option label is hardcoded as `'English (US)'`, and the key `settings.general.languageEnglish` exists but is never used. Fix: build `languages` inside the component with `label: t('settings.general.languageEnglish')`.
  - non-blocking, src/ui/settings/general-tab.tsx, 53, `confirmReset` is called through `void`. If `reset()` rejects, the dialog stays open with no feedback and the rejection goes unhandled. Fix: wrap the call in try/catch, close the dialog, and show the error in the existing `role="alert"` paragraph.
  - non-blocking, src/entrypoints/options/index.html, 3, `<meta name="manifest.open_in_tab">` repeats `options_ui` from `wxt.config.ts`. The built manifest is correct, but there are now two sources for one value. Fix: keep `options_ui` in `wxt.config.ts` and remove the meta tag.
  - non-blocking, tests/unit/settings-panel.test.tsx, 75, No test covers the "recents max 5" acceptance criterion. Fix: stub `getRecentUrls` to return 7 URLs and assert that 5 recent buttons render, newest first.
- Checked and correct:
  - Rollback restores `current` only when `get().settings === next`, and tests cover both the plain rejection and a rejection after a newer update.
  - `load()` rejection now only clears `loadPromise`. Its test proves in-flight update state is kept and a retry reads storage again.
  - `reset()` sets state before awaiting storage.
  - The echo guard compares settings with `JSON.stringify`. Both sides come from `parseSettings`, so key order is stable.
  - The popup sends the same `open-viewer`, `open-editor`, and `render-current` messages. The `role="alert"` paragraph, URL scheme errors, and file-access dialog are kept.
  - The popup, options page, and reader dialog use one `SettingsPanel` and one store.
  - The Reset trigger regains focus after both Cancel and confirm, verified in e2e.
  - About has no `<a>`, and a unit test asserts it.
  - No new dependencies: `package.json`, `pnpm-lock.yaml`, and `components.json` are unchanged, and the style is still base-nova.
  - The new controls import `@base-ui/react`, except `textarea`, which is a plain element in base-nova.
  - The only change to generated code is one justified `biome-ignore` in `slider.tsx`.
  - The built manifest has `options_ui: {"open_in_tab": true, "page": "options.html"}`.
  - The `entry.spec` Tab-order change is correct. The General tab and the focusable tab panel now come before Open viewer, and the outline assertion is unchanged.
  - The new tests check behavior: aria-selected state, headings, the manifest version, the absence of links, storage contents after Reset, and focus return.
- Scope checked: src/store/settings-store.ts, src/ui/settings/{settings-panel,general-tab,appearance-tab,plugins-tab,about-tab,settings-dialog}.tsx, src/components/ui/{switch,slider,select,textarea}.tsx, src/entrypoints/options/{index.html,main.tsx,App.tsx}, src/entrypoints/popup/{App.tsx,main.tsx}, src/entrypoints/reader/App.tsx, src/reader/commands.ts, src/i18n/en-US.ts, src/styles/popup.css, wxt.config.ts, tests/unit/{settings-store,settings-panel,commands,shortcuts}.test.ts*, tests/e2e/{entry,settings}.spec.ts, .output/chrome-mv3/manifest.json.
## Review Result

- Spec Status: PASS
- Quality Status: PASS_WITH_DEBT
- Debt: ecb54626 findings except the open_in_tab meta tag (kept: WXT overrides config to false without it). Owner: Phase 3 implementer task-0.

## Final Checkpoint

- Phase base ref: refs/plans/reference-parity-ui/phase-02/base
- Phase implementation ref: refs/plans/reference-parity-ui/phase-02/impl
- Plan commit ref: pending
- State checkpoint: temporary commit
