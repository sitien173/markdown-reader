<!-- refract-shared-version: 3.0.0 -->

# Phase 1 Decision Notes

<!-- Created by the worker per worker-contract.md. Append one `## Task <M>` block per task. -->

## Task 1

### Decisions made
- none

### Spec deviations
- none

### Tradeoffs accepted
- none

### Assumptions
- none

### Follow-ups for human
- none

### Test evidence
- RED -> GREEN:
  - RED: `pnpm lint` -> exit 1, 2 errors (unformatted .tgrep/meta.json), 188 warnings, 3 infos
  - GREEN: `pnpm lint` -> exit 0, 0 errors, 188 warnings, 3 infos
- Root cause (bugfix only): Biome checked .tgrep/meta.json which is an untracked search-index file; excluding `!**/.tgrep` in biome.json restores clean lint exit.

## Task 2

### Decisions made
- Used Zod 4 mini functional combinators `z.catch` for per-field resilience across general, appearance, and plugins sections, plus `z.pipe` with `z.transform` for clamping `autoRefreshIntervalSec` (0.5..600) and `maxWidthPx` (500..3000), and `z.string().check(z.maxLength(65536))` with catch fallback for `customCss`.

### Spec deviations
- none

### Tradeoffs accepted
- none

### Assumptions
- none

### Follow-ups for human
- none

### Test evidence
- RED -> GREEN:
  - RED: `pnpm exec vitest run tests/unit/settings.test.ts` -> 8 failed | 1 passed (9 tests) (parses valid raw settings matching the schema failed with AssertionError: expected {} to deeply equal defaultSettings)
  - GREEN: `pnpm exec vitest run tests/unit/settings.test.ts` -> 9 passed (9 tests)
- Root cause (bugfix only): none

## Task 3

### Decisions made
- Implemented `useSettingsStore` with an idempotent `load()` promise, deep-merge `update()`, `reset()`, and a `browser.storage.onChanged` listener that strictly filters on `area === 'local'` and `changes[SETTINGS_KEY]`.

### Spec deviations
- none

### Tradeoffs accepted
- none

### Assumptions
- none

### Follow-ups for human
- none

### Test evidence
- RED -> GREEN:
  - RED: `pnpm exec vitest run tests/unit/settings-store.test.ts` -> 4 failed | 1 passed (5 tests) (load is idempotent failed with AssertionError: expected Promise to be Promise; reset and update failed with fakeSet call count 0; onChanged listener failed with listener count 0)
  - GREEN: `pnpm exec vitest run tests/unit/settings-store.test.ts` -> 5 passed (5 tests)
- Root cause (bugfix only): none

## Task 4

### Decisions made
- `src/entrypoints/reader/main.tsx` exports `bootReader(container)`: awaits `useSettingsStore.getState().load()`, calls `applyLanguage(settings.general.language)`, then `createRoot(container).render`. The module side effect still boots into `#root` and still throws when it is missing.
- `tests/unit/reader-boot.test.ts` mocks `react-dom/client`, `App`, the stylesheet, and `applyLanguage`, and records `load:start`, `load:resolve`, `applyLanguage`, `render` in order.
- Removed a duplicate `TranslationDictionary` type export from `src/i18n/index.ts`; it remains in `src/i18n/en-US.ts`.
- Per `refract ask` answer (a): added `await page.locator('#root > *').first().waitFor();` to `openPalette` in `tests/e2e/palette.spec.ts`. Only a wait was added, no assertion changed. A first attempt waiting on the `Open file` button timed out once a document was open, so it was replaced.

### Spec deviations
- Edited `tests/e2e/palette.spec.ts`, outside the declared file set, with coordinator approval via `refract ask`. Reason: async boot defers first render until after `storage.local` read, so specs that press Ctrl+K right after `page.goto` raced React mounting. Before the wait: 4 to 5 palette failures per run. After: 1.

### Tradeoffs accepted
- none

### Assumptions
- The remaining e2e failure (`palette.spec.ts:96`, focus stays inside the palette) is unrelated to this phase. Evidence: with `main.tsx` restored to `HEAD` and a fresh `pnpm build`, it failed the same way (1 failed, 29 passed in palette.spec.ts). Not verified against a clean base checkout.

### Follow-ups for human
- Decide whether `palette.spec.ts:96` is a pre-existing environment failure or a regression. The prompt baseline says 97 e2e pass.

### Test evidence
- RED -> GREEN:
  - RED: `pnpm exec vitest run tests/unit/reader-boot.test.ts` with `load()` not awaited in `bootReader` -> 1 failed (`load:resolve` missing before `applyLanguage`/`render`)
  - GREEN: `pnpm exec vitest run tests/unit/reader-boot.test.ts` -> 1 passed
  - i18n and background title tests: `tests/unit/i18n.test.ts`, `tests/unit/background.test.ts` pass in the full run.
- Final checks:
  - `pnpm typecheck` -> exit 0
  - `pnpm lint` -> exit 0, 188 warnings, 3 infos
  - `pnpm exec vitest run --maxWorkers=2` -> 332 passed (332)
  - `pnpm test:e2e` -> 96 passed, 1 failed (`tests/e2e/palette.spec.ts:96`), exit 1
- Root cause (bugfix only): none

## Task 4 (fix batch: focus-trap e2e)

### Decisions made
- In `tests/e2e/palette.spec.ts`, test `focus stays inside the palette while it is open`, replaced both synchronous `expect(await palette(page).evaluate(...)).toBe(true)` lines with `await expect.poll(() => palette(page).evaluate(...)).toBe(true)`. No source change.

### Spec deviations
- `tests/e2e/palette.spec.ts` is outside the declared file set. Edited with Coordinator approval: the failure is pre-existing (reproduced 4/4 at phase base). Tab lands on Base UI's focus-guard span, which redirects focus asynchronously; the test sampled `document.activeElement` before the redirect.

### Tradeoffs accepted
- none

### Assumptions
- none

### Follow-ups for human
- none

### Test evidence
- RED -> GREEN:
  - RED: `pnpm test:e2e` -> 96 passed, 1 failed (`palette.spec.ts:96`)
  - GREEN: `pnpm test:e2e` -> 97 passed
- Final checks: `pnpm typecheck` exit 0; `pnpm lint` exit 0, 188 warnings; vitest 332/332; `pnpm test:e2e` 97 passed.
- Root cause (bugfix only): the test sampled focus before Base UI's asynchronous focus-guard redirect.

## Fix batch 2

### Decisions made
- `bootReader` wraps `load()` in try/catch and proceeds with `defaultSettings`, then always `applyLanguage` and render.
- `load()` catches a storage failure, sets `defaultSettings`, and clears `loadPromise` so a later call retries. It resolves, so the store stays usable.
- `update()` computes `next`, calls `set({ settings: next })`, then awaits `storage.local.set`. A second concurrent call merges from the first.
- `update()` with `appearance.customCss` over 65536 characters throws `Error('customCss exceeds 65536 characters')` before any state change or write. Chosen over silently ignoring the field so the caller sees the rejection. The schema catch fallback for corrupt stored data is unchanged.
- Added `CUSTOM_CSS_MAX_LENGTH` export in `src/lib/settings.ts`; the schema and the store use it, so 65536 appears once.
- `t(key: I18nKey)`; `useT` kept.

### Spec deviations
- none

### Tradeoffs accepted
- `update()` now updates in-memory state before the storage write resolves; a failed write leaves state ahead of storage until the next `onChanged` or `load()`.

### Assumptions
- none

### Follow-ups for human
- Callers of `update()` in later phases must handle the customCss rejection.

### Test evidence
- RED -> GREEN:
  - RED: `pnpm exec vitest run tests/unit/settings-store.test.ts tests/unit/reader-boot.test.ts` -> 4 failed | 6 passed (load rejection cached; concurrent update lost renderTxt; oversize customCss resolved; render never ran when load rejected)
  - GREEN: same command -> 10 passed
  - i18n: `// @ts-expect-error` test on `t('contextMenu.opne')`; `pnpm typecheck` exit 0 proves the key is rejected.
- Final checks: `pnpm typecheck` exit 0; `pnpm lint` exit 0, 188 warnings; vitest 337/337; `pnpm test:e2e` 97 passed.
- Root cause (bugfix only): cached rejected promise; state set after await; unvalidated customCss patch; untyped key.
