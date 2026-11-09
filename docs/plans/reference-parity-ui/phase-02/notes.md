<!-- refract-shared-version: 3.0.0 -->

# Phase 2 Decision Notes

<!-- Created by the worker per worker-contract.md. Append one `## Task <M>` block per task. -->


## Task 0

### Decisions made
- `load()` rejection now only clears `loadPromise`; state is untouched.
- `update()` restores `current` on a failed write only when `get().settings === next`, then rethrows.
- `reset()` sets state before the write.
- `onChanged` skips `set` when the parsed value deep-equals current settings (JSON compare).
- Added a `pendingWrites` list: an echo that equals a value this store is still writing is ignored. The deep-equal rule alone does not stop an echo of an earlier write from overwriting a later update.

### Spec deviations
- The `pendingWrites` guard goes beyond the literal text of (d); it is needed for the stated goal.

### Tradeoffs accepted
- An external write from another page with a value identical to an in-flight local write is ignored during that window.

### Assumptions
- none

### Follow-ups for human
- none

### Test evidence
- RED -> GREEN:
  - RED: `pnpm exec vitest run tests/unit/settings-store.test.ts` -> 4 failed, 9 passed: rejected load kept `renderTxt` false (expected true); failed write left `renderTxt` true (expected defaults); `reset()` state not defaults before write resolves; echo of earlier write flipped `linkify` back to true.
  - GREEN: `pnpm exec vitest run tests/unit/settings-store.test.ts` -> 13 passed.
- Root cause (bugfix only): load catch reset state to defaults; update/reset ordering and unguarded onChanged set, shown by the four failing tests above.

## Task 1

### Decisions made
- Ran `pnpm exec shadcn add switch slider select textarea`. All four files created; switch, slider, select import from `@base-ui/react`. textarea is a plain element. `components.json` still `base-nova`.
- The generator imported `cn` from the bare specifier `"cn"` and added the unrelated npm package `cn@0.5.2` to `package.json`. I rewrote the four imports to `@/lib/utils` (as the existing components do), reverted `package.json` and `pnpm-lock.yaml` with `git checkout`, and re-ran `pnpm install --frozen-lockfile`. No dependency change remains.
- Ran `biome format` and a `useImportType` fix and an `noArrayIndexKey` ignore on the generated files so `pnpm lint` stays exit 0.

### Spec deviations
- Generated files were edited (imports, formatting). Generated tokens untouched.

### Tradeoffs accepted
- none

### Assumptions
- none

### Follow-ups for human
- `shadcn` 4.23.0 resolves the `@/lib/utils` alias to the `cn` package here; future `shadcn add` runs will repeat this.

### Test evidence
- RED -> GREEN:
  - RED: `pnpm exec vitest run tests/unit/settings-panel.test.tsx` -> `Failed to resolve import "../../src/components/ui/slider"` (import failure; the prompt defines this as the RED).
  - GREEN: `pnpm exec vitest run tests/unit/settings-panel.test.tsx` -> 1 passed.
- Root cause (bugfix only): none

## Task 2

### Decisions made
- Rail uses Base UI `Tabs` (vertical) so state is `aria-selected` on `role="tab"`; each tab has an `aria-label`. Pane is `TabsContent`.
- `SettingRow` lives in `settings-panel.tsx` (no extra file); `general-tab.tsx` imports it, a runtime-safe import cycle.
- About icon src is `/icons/icon-128.png`, alt empty (the H1 names it).
- Language select is Base UI `Select` with `disabled` and one item.

### Spec deviations
- none

### Tradeoffs accepted
- Import cycle `settings-panel` <-> `general-tab` accepted to stay inside the Files list.

### Assumptions
- none

### Follow-ups for human
- none

### Test evidence
- RED -> GREEN:
  - RED: `pnpm exec vitest run tests/unit/settings-panel.test.tsx` with an inert `SettingsPanel` returning null -> 4 failed, 1 passed: `expected [] to deeply equal [ 'General', 'Appearance', ... ]`.
  - GREEN: `pnpm exec vitest run tests/unit/settings-panel.test.tsx` -> 5 passed.
- Root cause (bugfix only): none

## Task 3

### Decisions made
- `open_in_tab` chosen: `true`. WXT overrides the `wxt.config.ts` manifest key with the options entrypoint default (`false`); the built manifest showed `"open_in_tab":false`. Added `<meta name="manifest.open_in_tab" content="true" />` to `src/entrypoints/options/index.html`; the build now shows `"options_ui":{"open_in_tab":true,"page":"options.html"}`. The `wxt.config.ts` key stays as the prompt requires.
- Popup/options mains await `useSettingsStore.load()` before render.
- New palette command `settings` (label `Settings`) with dep `openSettings`.
- Reader `App.tsx` mounts `SettingsDialog`. Palette handoff code was not changed (`command-palette.tsx` is outside Files); the e2e shows the dialog opens and Escape closes it.
- Options page and popup both import `popup.css`; the options host is centered with Tailwind classes.

### Spec deviations
- `tests/unit/commands.test.ts` and `tests/unit/shortcuts.test.ts` were edited to add `openSettings`; both fail typecheck or assertions otherwise. Neither is listed in Files.

### Tradeoffs accepted
- The embedded (`open_in_tab` false) card inside chrome://extensions was not exercised; the e2e loads `options.html` directly, which is identical in both modes.

### Assumptions
- none

### Follow-ups for human
- none

### Test evidence
- RED -> GREEN:
  - RED: `pnpm exec playwright test tests/e2e/settings.spec.ts -g "options page"` with `src/entrypoints/options` moved away and rebuilt -> 1 failed (`browserContext.waitForEvent: Target page, context or browser has been closed`; no options page to load). Weak signal; the popup-size and dialog tests were written before their code but not run red separately.
  - GREEN: `pnpm exec playwright test tests/e2e/settings.spec.ts tests/e2e/entry.spec.ts` -> 8 passed.
- Root cause (bugfix only): none

## Task 4

### Decisions made
- Popup actions, recents (max 5), Language, and Reset moved into `general-tab.tsx`; the `role="alert"` paragraph, file-access dialog, and URL scheme checks are kept with the same messages.
- Reset uses `Dialog` plus `DialogTrigger`, so focus returns to the trigger on close.
- Existing Tab-focus assertion in `entry.spec.ts` now expects two earlier tab stops (General rail tab, then the tabpanel) before Open viewer. That is an assertion change.

### Spec deviations
- The Tab-order assertion changed (see above); the panel wrap adds two tab stops.
- The prompt names existing file-access dialog and URL-scheme tests; `entry.spec.ts` had none. I added a `role="alert"` test (Render current tab on the popup page itself) and a Reset test. A file-access dialog e2e is not added: it needs an active `file:` tab without file access, which the fixture cannot create.

### Tradeoffs accepted
- none

### Assumptions
- none

### Follow-ups for human
- none

### Test evidence
- RED -> GREEN:
  - RED: `pnpm exec playwright test tests/e2e/settings.spec.ts tests/e2e/entry.spec.ts` after the panel wrap -> 1 failed: `getByRole('button', { name: 'Open viewer' })` Expected focused, Received inactive (old Tab count).
  - GREEN: same command -> 8 passed.
- Root cause (bugfix only): none

## Final checks
- `pnpm typecheck` exit 0.
- `pnpm lint` exit 0, 188 warnings (baseline 188).
- `pnpm exec vitest run --maxWorkers=2` 347/347 pass (baseline 337, +10 new).
- `pnpm test:e2e` 102 pass (baseline 97, +5 new).
- `.output/chrome-mv3/manifest.json` has `options_ui` `{"open_in_tab":true,"page":"options.html"}`.
