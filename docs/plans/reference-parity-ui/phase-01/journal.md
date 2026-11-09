<!-- refract-shared-version: 3.0.0 -->

# Phase 1 Journal: Settings foundation

<!-- Created by the worker per worker-contract.md. Append every block; keep earlier sections. -->

## META

- Plan: docs/plans/reference-parity-ui/PLAN.md
- Implementation Profile: google
- Consultation Profile: n/a
- Review Profile: balanced
- Implementation Job: da584123 (failed replay_blocked), 66cd8f57 (transient), 88e45368, 56137d83, 5e0c054f
- Review Job: 1911c9c9 (transient), d14ed472 FAIL, ed659307 PASS_WITH_DEBT
- Started: 2026-11-09T10:27:48Z
- Finished: 2026-11-09T12:13:54Z

## Implementation Response

# EXTERNAL RESPONSE
## META
- Phase 1 / Started: n/a (resumed batch) / Finished: 2026-11-09 / Plan dir: docs/plans/reference-parity-ui
## SUMMARY
Settings schema, store, i18n, background `t()` title, and awaited reader boot are in place; 96 of 97 e2e pass and `palette.spec.ts:96` fails.
## FILES MODIFIED
| Action | Path | Change |
| modify | biome.json | exclude `.tgrep` |
| create | src/lib/settings.ts | schema, defaults, parse, read |
| create | src/store/settings-store.ts | Zustand store |
| create | src/i18n/en-US.ts, src/i18n/index.ts | dictionary, `t`, `useT`, `applyLanguage` |
| modify | src/entrypoints/reader/main.tsx | exported `bootReader`, awaits load |
| modify | src/entrypoints/background.ts | title via `t()` |
| create | tests/unit/settings.test.ts, settings-store.test.ts, i18n.test.ts, reader-boot.test.ts | new tests |
| modify | tests/unit/background.test.ts | title assertion |
| modify | tests/e2e/palette.spec.ts | wait for mount in `openPalette` (approved via refract ask) |
| modify | docs/plans/reference-parity-ui/phase-01/notes.md, journal.md | records |
## NOTES
- phase-01/notes.md (## Task 1, 2, 3, 4). typecheck 0, lint 0 (188 warnings), vitest 332/332, e2e 96 pass 1 fail.
## SPEC COMPLIANCE
- Meets Spec? NO: `pnpm test:e2e` exits 1 on `palette.spec.ts:96`, which also fails with the original synchronous `main.tsx`.
## CLARIFICATIONS NEEDED
- Is `palette.spec.ts:96` (focus stays inside the palette) a known environment failure, or should this phase fix it? It is outside the declared file set for a source fix.
## NEXT
BLOCKED

<!-- Worker appends each full `# EXTERNAL RESPONSE` block here without overwriting prior blocks. -->

# EXTERNAL RESPONSE
## META
- Phase 1 / Started: n/a (fix batch) / Finished: 2026-11-09 / Plan dir: docs/plans/reference-parity-ui
## SUMMARY
Fixed the pre-existing focus-trap e2e test by polling focus; all four Done When commands now pass.
## FILES MODIFIED
| Action | Path | Change |
|---|---|---|
| modify | tests/e2e/palette.spec.ts | `expect.poll` in focus-trap test (plus earlier mount wait) |
| modify | docs/plans/reference-parity-ui/phase-01/notes.md, journal.md | records |
## NOTES
- phase-01/notes.md (## Task 4, ## Task 4 fix batch). typecheck 0, lint 0 (188 warnings), vitest 332/332, e2e 97 passed.
## SPEC COMPLIANCE
- Meets Spec? YES
## CLARIFICATIONS NEEDED
None
## NEXT
TASK_COMPLETE

# EXTERNAL RESPONSE
## META
- Phase 1 / Started: n/a (fix batch 2) / Finished: 2026-11-09 / Plan dir: docs/plans/reference-parity-ui
## SUMMARY
Fixed the five quality-review findings with RED to GREEN tests; all four Done When commands pass.
## FILES MODIFIED
| Action | Path | Change |
|---|---|---|
| modify | src/entrypoints/reader/main.tsx | catch load failure, always render |
| modify | src/store/settings-store.ts | load fallback and retry, synchronous set in update, reject oversize customCss |
| modify | src/lib/settings.ts | export `CUSTOM_CSS_MAX_LENGTH` |
| modify | src/i18n/index.ts | `t(key: I18nKey)` |
| modify | tests/unit/reader-boot.test.ts, settings-store.test.ts, i18n.test.ts | new tests |
| modify | docs/plans/reference-parity-ui/phase-01/notes.md, journal.md | records |
## NOTES
- phase-01/notes.md (## Fix batch 2). typecheck 0, lint 0 (188 warnings), vitest 337/337, e2e 97 passed.
## SPEC COMPLIANCE
- Meets Spec? YES
## CLARIFICATIONS NEEDED
None
## NEXT
TASK_COMPLETE

## Quality Review

<!-- Coordinator appends the independent review response here. -->

### Review job d14ed472-a095-41ed-89fe-6d476a998364 (retry of transient 1911c9c9)

# CODE QUALITY REVIEW
- Status: FAIL
- Findings:
  - blocking, src/entrypoints/reader/main.tsx, 11, If `browser.storage.local.get` rejects, the `load()` call in `bootReader` rejects too. `createRoot().render()` is then never reached, and `void bootReader(root)` swallows the error. The reader stays blank, which is a regression from the base, where the reader always rendered. Fix: wrap `load()` in try/catch or use `.catch(() => {})`, keep `defaultSettings`, then always call `applyLanguage` and render. Add a reader-boot unit test where `load` rejects and assert that `render` is still called.
  - blocking, src/store/settings-store.ts, 37, `loadPromise` keeps a rejected promise, so every later `load()` call returns the same failure and no retry is possible. Fix: catch inside the async IIFE and fall back to defaults, or set `loadPromise = null` on rejection.
  - non-blocking, src/store/settings-store.ts, 45, Two quick `update()` calls lose a write. Both calls merge from `get().settings` before either `await browser.storage.local.set` resolves, so the second call overwrites the first call's field. An onChanged event that arrives mid-update can also be overwritten by the trailing `set`. Fix: compute `next` and call `set({ settings: next })` before awaiting storage. Better still, chain updates through a module-level promise queue. Add a test that runs two concurrent updates on different fields and asserts both persist.
  - non-blocking, src/lib/settings.ts, 152, The 65536-char cap uses `z.catch(..., '')`. When `update({ appearance: { customCss } })` receives CSS over the cap, the user's whole stylesheet is silently replaced with `''` and that empty value is persisted. Fix: in `update()`, check `patch.appearance?.customCss` length and throw or return an error before merging, so stored CSS is never wiped. Keep the catch fallback only for corrupt stored data.
  - non-blocking, src/i18n/index.ts, 11, `t(key: string)` ignores the declared `I18nKey`, so a mistyped key compiles and returns the raw key at runtime. The phase goal calls for a typed `t()`. Fix: change the signature to `t(key: I18nKey)`.
  - non-blocking, src/i18n/index.ts, 25, `useT()` is a speculative wrapper that returns the module function and has no caller in the delta. Fix: remove it and its test, or keep it only if a later phase in the plan uses it.
  - non-blocking, tests/unit/settings-store.test.ts, 1, No tests cover a storage rejection in `load()` or concurrent `update()` calls. Fix: add both cases alongside the fixes above.
- Scope checked: biome.json, src/lib/settings.ts, src/store/settings-store.ts, src/i18n/en-US.ts, src/i18n/index.ts, src/entrypoints/reader/main.tsx, src/entrypoints/background.ts, tests/unit/settings.test.ts, tests/unit/settings-store.test.ts, tests/unit/i18n.test.ts, tests/unit/reader-boot.test.ts, tests/unit/background.test.ts, tests/e2e/palette.spec.ts.
  - Verified:
    - `pnpm lint` exits 0 with exactly 188 warnings.
    - The 5 changed unit test files pass, 23 tests in total.
    - The onChanged filter checks both area `local` and the exact key `settings:v1`.
    - The `settings:v1` literal appears once in source, at src/lib/settings.ts:4.
    - `breaks` appears only at `plugins.breaks`.
    - background.ts reaches only `i18n/index.ts` and `en-US.ts`, so no Zod import is reachable from it.
    - Per-field fallback works, and `null` `customCss` does not throw.
    - The context menu title is unchanged with no stored settings.

Coordinator decision: fix both blocking findings plus update race, customCss cap, and typed t(). Keep useT because PLAN Phase 1 Task 4 requires it.


### Re-review job ed659307-28f9-4534-8664-7dea04a9fab5 (fix delta a71c17e..6bb911f)

# CODE QUALITY REVIEW
- Status: PASS_WITH_DEBT
- Findings:
  - non-blocking, src/store/settings-store.ts, 43, When `load()` fails, the catch block sets `settings` back to `defaultSettings`. If an `update()` call or an onChanged event changed the store while the read was in flight, that change is discarded. The store already starts at defaults, so the fix is to keep only `loadPromise = null` in the catch block and remove the `set`.
  - non-blocking, src/store/settings-store.ts, 70, `update()` now sets state before writing to storage, but nothing undoes that if `browser.storage.local.set` rejects. The store then shows a value that was never saved. Fix: save `current`, wrap the storage write in try/catch, restore `current` with `set` only if `get().settings === next`, then rethrow.
  - non-blocking, src/store/settings-store.ts, 74, `reset()` still waits for storage before it sets state, which is the opposite order from `update()`. If `reset()` and `update()` overlap, the store can end on defaults while storage ends on the merged value. Fix: in `reset()`, call `set({ settings: next })` before `await browser.storage.local.set`, as `update()` does.
  - non-blocking, src/store/settings-store.ts, 25, In real Chrome, two quick updates each trigger an onChanged event. The event from the first write arrives after the second write has already updated the store, so the second change disappears briefly until its own event arrives. The final state is correct. The stub storage never fires onChanged, so the new concurrency test cannot catch this. Fix: in the listener, skip `set` when the parsed `newValue` deep-equals `get().settings`, or count pending writes and ignore their echoes. Add a test where the stub's `set` fires the onChanged listeners.
- Prior findings:
  1. Resolved. `bootReader` catches a rejected `load()`, then still calls `applyLanguage` and renders. The new test checks the call order `['applyLanguage', 'render']`.
  2. Resolved. A failed `load()` clears `loadPromise`, so the next `load()` call reads storage again. The new test checks the second read and the value it loads.
  3. Resolved for the write-loss case. `update()` sets state before the storage write. The new test runs two updates on different fields and checks that the store and the last stored value both keep each change.
  4. Resolved. `update()` throws before merging when `customCss` is over `CUSTOM_CSS_MAX_LENGTH`. The new test checks that storage is not written and the existing CSS stays. The schema fallback for corrupt stored data is unchanged.
  5. Resolved. The signature is now `t(key: I18nKey)`. The `@ts-expect-error` test is enforced because tsconfig includes `tests/**/*`.
- Commands run:
  - `tsc --noEmit` exits 0.
  - `vitest run tests/unit` passes: 32 files, 337 tests.
  - `pnpm lint` exits 0 with exactly 188 warnings.
- Scope checked: src/entrypoints/reader/main.tsx, src/i18n/index.ts, src/lib/settings.ts, src/store/settings-store.ts, tests/unit/i18n.test.ts, tests/unit/reader-boot.test.ts, tests/unit/settings-store.test.ts.

## Review Result

- Spec Status: PASS
- Quality Status: PASS_WITH_DEBT
- Debt: settings-store races from re-review ed659307 (load catch resets state, update no rollback on storage reject, reset order, onChanged echo flicker). Owner: Phase 2 implementer.

## Final Checkpoint

- Phase base ref: refs/plans/reference-parity-ui/phase-01/base
- Phase implementation ref: refs/plans/reference-parity-ui/phase-01/impl
- Plan commit ref: refs/plans/reference-parity-ui/impl or `pending`
- State checkpoint: temporary commit, or `n/a (untracked)` when plan artifacts
  are excluded

Phase refs retain review evidence after checkpoint consolidation. The plan ref
names the sole commit retained on the branch.
