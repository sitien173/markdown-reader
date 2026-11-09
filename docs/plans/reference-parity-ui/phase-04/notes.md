<!-- refract-shared-version: 3.0.0 -->

# Phase 4 Decision Notes

<!-- Created by the worker per worker-contract.md. Append one `## Task <M>` block per task. -->


## Task 0

### Decisions made
- (a) `settings-store.ts` tracks `lastStored` (parsed JSON key) from the initial read (only when a stored value exists), every `onChanged` event, and each write at issue time. `write` returns early when `next` equals `lastStored`, so no pending echo entry exists for an unchanged value. A failed write resets `lastStored` to unknown. Marking at issue time (not at resolve) keeps A then B-back-to-original writes from being skipped. Load now reads `storage.local.get` directly so it can tell "nothing stored" from "defaults stored"; `readSettings` import dropped from the store.
- (b) `plugins-tab.tsx` shows write failures in a `role="alert"` `popup-error` line, cleared on the next success.
- (c) `markdown-view.tsx` no longer builds `keyPrefix`; `planBlocks` owns the config prefix. The plugin-key reset (clear cache, replaceChildren, new parse state) is unchanged.
- (d) `pipeline.ts` wraps `createMarkdownIt` in `md-parser-build-start/end` marks and an `md-parser-build` measure. The S4 all-plugins toggle log prints it next to the paint time.
- (e) TODO naming `markdown-it-multimd-table` 4.2.3 added at the shim. The colspan test already exists in `tests/unit/pipeline-config.test.ts` ("renders colspan with the setting on...").

### Spec deviations
- none

### Tradeoffs accepted
- A write equal to the last known stored value is skipped, so a stored object that is partial but parses equal to the next value is not normalized on disk.

### Assumptions
- none

### Follow-ups for human
- none

### Test evidence
- RED -> GREEN:
  - RED: `pnpm exec vitest run --maxWorkers=2 tests/unit/settings-store.test.ts tests/unit/settings-panel.test.tsx` -> 2 failed: store test `expected false to be true` (later genuine change dropped as stale echo); panel test `textContent` of missing `[role="alert"]` undefined.
  - GREEN: same command -> 2 files, 26 passed. Full `pnpm exec vitest run --maxWorkers=2` -> 393 passed. `pnpm typecheck` exit 0.
- (c), (d) are behavior-preserving or instrumentation; existing reader-render and incremental tests stayed green. (d) is exercised by `tests/e2e/perf.spec.ts`.
- Root cause (bugfix only): Chrome emits no `onChanged` for an unchanged value, so the pending entry for it lingered 2 s and matched a later identical value from another context.

## Task 1

### Decisions made
- `src/lib/appearance.ts` `applyAppearance(root, appearance)` writes `data-theme` for Light/Dark and removes it for Auto (PLAN resolution 9: Auto never sets a fixed value). Called from a `useLayoutEffect` in `Reader` (`App.tsx`) so the root is current before the passive diagram-redraw effect.
- Forced theme blocks sit in `@media screen` in `globals.css`, `editor.css`, and `export-styles.ts`, so print stays light. `@custom-variant dark` in `globals.css` now follows `data-theme='dark'`, or the system when `data-theme` is absent.
- `isDark()` in `diagram.ts` reads root `data-theme` when `light` or `dark`, else `matchMedia`.
- `markdown-view.tsx` subscribes to `settings.appearance.theme`; a theme change calls `rerenderDiagrams`, and Auto also listens to the system scheme change. The epoch guard in `diagram.ts` is unchanged.
- Export CSS diagram swap rules respect `data-theme`.
- e2e writes settings through `chrome.storage.local`, which also proves live propagation without reload.

### Spec deviations
- none

### Tradeoffs accepted
- The `matchMedia` listener is kept for Auto only; the plan said "replace", but Auto must still follow the system.

### Assumptions
- none

### Follow-ups for human
- none

### Test evidence
- RED -> GREEN:
  - RED: `pnpm exec playwright test tests/e2e/theme.spec.ts` -> 4 new tests failed: `Expected "rgb(255, 255, 255)" Received "rgb(28, 28, 30)"` (Light forced in dark system) and the mirrored Dark case. `tests/unit/export.test.ts` forced-block test: `globals.css light block: expected 0 to be greater than 5`.
  - GREEN: same playwright command -> 10 passed. `pnpm exec vitest run --maxWorkers=2` -> all pass. `pnpm typecheck` exit 0.
- Root cause (bugfix only): none

## Task 2

### Decisions made
- `applyAppearance` writes `data-code-light` and `data-code-dark` on the root. `markdown.css` picks the bundled Shiki theme per scheme from those values: dark values show for a dark scheme unless `data-code-dark='light'`, and the dark values also show in a light scheme when `data-code-light='dark'`. Without the attributes the defaults hold (light in light, dark in dark).
- `highlightCacheKind()` in `highlight.ts` returns `code:<light>:<dark>` from the root, and `enhance.ts` uses it as the block cache kind, so a code theme change never reuses a stale highlighted block.
- The four override blocks sit in `@media screen`, so print stays light. Each `!important` carries a `biome-ignore` with the reason (Shiki writes the light colors as inline styles).

### Spec deviations
- none

### Tradeoffs accepted
- The `!important` suppressions keep lint warnings under the Prior State count. A CSS-variable approach would need Shiki `defaultColor: false`, which changes every rendered block and the export.

### Assumptions
- none

### Follow-ups for human
- none

### Test evidence
- RED -> GREEN:
  - RED: the code theme cases in `tests/e2e/appearance.spec.ts` and `tests/unit/appearance.test.ts` were written before the `appearance.ts`, `highlight.ts`, and `markdown.css` changes. The verbatim RED output for this task was not captured before it was truncated in the session, so it is not quoted here.
  - GREEN: `pnpm exec vitest run --maxWorkers=2 tests/unit/appearance.test.ts -t "code theme"` -> 2 passed, 6 skipped. `pnpm exec playwright test tests/e2e/appearance.spec.ts tests/e2e/theme.spec.ts` -> 15 passed.
- Root cause (bugfix only): none

## Task 3

### Decisions made
- `appearance.ts` holds `appearanceRootState(appearance)`, one pure shape used by both the reader and the export: attributes, `--md-scale`, `--md-font`, `--md-max-width`, and the classes `md-wrap-code`, `md-wide-tables`, `md-centered`. `applyAppearance` writes it to the root and removes stale values.
- Text size has six steps: 0.875, 0.9375, 1, 1.0625, 1.125, 1.25 (step 3 is 1). The scale applies to `.md-content` font size only, and `markdown.css` font sizes below it moved from `rem` to `em`, so headings, code, tables, and footnotes scale with it and the sidebar does not.
- Fonts are system stacks only (serif, sans, mono). Default keeps `--font-body`. Max width is clamped to 500-3000 px.
- Zen: `reader-store.ts` starts `focusMode` from `settings.appearance.zen`. Leaving focus mode later changes the session only; the stored value stays.
- `centered` off aligns the column left via `:root:not(.md-centered) .md-content`.

### Spec deviations
- none

### Tradeoffs accepted
- The `rem` to `em` change touches every font size in `markdown.css`. Nested elements with their own `em` size compound, which the e2e text size and layout checks did not show as a problem.

### Assumptions
- Step 3 equals the previous fixed size (1rem), so existing documents look unchanged at the default.

### Follow-ups for human
- none

### Test evidence
- RED -> GREEN:
  - RED: `pnpm exec playwright test tests/e2e/appearance.spec.ts` before the changes -> the "text, font, and layout" and Zen tests failed (7 tests, for example "text size scales the rendered content and not the sidebar, and applies live"). The first run also failed because the spec waited for a Mermaid diagram on a document without one; the spec now waits for it only when the body contains `mermaid`.
  - GREEN: `pnpm exec playwright test tests/e2e/theme.spec.ts tests/e2e/appearance.spec.ts tests/e2e/export.spec.ts tests/e2e/contrast.spec.ts` -> 34 passed.
- Root cause (bugfix only): none

## Task 4

### Decisions made
- `src/lib/custom-css.ts`: `validateCustomCss` rejects any backslash (which covers `u\72l(`, `u\rl(`, `\0075rl(`), `url` followed by optional whitespace and `(`, `image-set(`, and `@import`, case-insensitive. It returns `{ ok: true } | { ok: false; message }`. `applyCustomCss` keeps one adopted `CSSStyleSheet`, replaces it with `replaceSync`, and leaves the previous sheet in place on rejection. Empty CSS removes the sheet. No `<style>` element is added in the reader.
- `appearance-tab.tsx` shows the inline error and keeps the previous applied sheet.
- Export: `buildStandaloneHtml` takes `appearance`, writes the shared root state plus `data-zen` onto `<html>`, and appends an enabled, valid custom CSS `<style id="custom-css">` after the export styles. `<` in custom CSS is written as the CSS escape `\3c `, so stored text cannot close the style element. The export revalidates because a stored value may not have passed the tab. `export-styles.ts` defines the `--md-*` defaults, and print stays light. `downloadHtml` and `App.tsx` pass the stored Appearance.

### Spec deviations
- none

### Tradeoffs accepted
- Export drops invalid custom CSS silently rather than failing the export; the tab already showed the error when it was entered.

### Assumptions
- none

### Follow-ups for human
- Two files were reformatted by `biome format` and then restored by hand (CSS selector quotes), and `tests/unit/export.test.ts` `forcedTokens` now accepts either quote style because Biome formats CSS with double quotes.
- `tests/e2e/entry.spec.ts:52` failed once in one full e2e run (`getByRole('tab', { name: 'General' })` not focused after Tab). It passed 3 of 3 alone and the next full run passed 124 of 124. No file in this phase changes popup focus; treat it as an existing timing flake.

### Test evidence
- RED -> GREEN:
  - RED: `pnpm exec vitest run tests/unit/export.test.ts` with `src/export/export.ts` at `HEAD` -> 3 failed, 14 passed: `expected '<html lang="en">' to contain 'data-theme="dark"'`, `expected '<!DOCTYPE html>...' to contain '.md-content h1 { color: red; }'`, `expected [ '</style>' ] to have a length of 2 but got 1`. `tests/unit/custom-css.test.ts` and the new export e2e were written before `custom-css.ts` and the export changes; their verbatim RED output was not captured.
  - GREEN: `pnpm exec vitest run --maxWorkers=2` -> 37 files, 424 passed. `pnpm exec playwright test tests/e2e/export.spec.ts -g "keeps Zen off"` -> 1 passed.
- Root cause (bugfix only): none

## Phase verification (fresh, from /home/ngosi/projects/markdown-reader)
- `pnpm typecheck` -> exit 0.
- `pnpm lint` -> exit 0, 183 warnings (Prior State 186), 3 infos.
- `pnpm exec vitest run --maxWorkers=2` -> 37 files, 424 passed (Prior State 390).
- `pnpm exec playwright test tests/e2e/theme.spec.ts tests/e2e/appearance.spec.ts tests/e2e/export.spec.ts tests/e2e/contrast.spec.ts` -> exit 0, 34 passed.
- `pnpm test:e2e` -> exit 0, 124 passed (Prior State 107). A first run had 1 failure (`entry.spec.ts:52`, see Task 4 follow-ups); the rerun passed.

## Fix batch (quality review FAIL)
### Changes
- `src/store/settings-store.ts`: the `onChanged` listener drops the matching pending entry, then sets `lastStored` only when `pendingWrites` is empty. While newer writes are pending, `lastStored` stays the latest write issued, so `write(A)` after an older echo of A is no longer skipped as unchanged.
- `src/ui/settings/appearance-tab.tsx`: Text size and Max width sliders keep a local draft in `onValueChange` and persist from `onValueCommitted`. Prop verified in `node_modules/@base-ui/react/slider/root/SliderRoot.d.ts:173` (`onValueCommitted?: (value, eventDetails) => void`).
- `tests/unit/settings-store.test.ts`: added the A, O, echo A, write A, echo O test.
- `tests/e2e/appearance.spec.ts`: added one test per key (`codeThemeLight` in light, `codeThemeDark` in dark) asserting the Mermaid SVG `id` and `outerHTML` are unchanged.
### Test evidence
- RED: `pnpm exec vitest run tests/unit/settings-store.test.ts` before the store fix -> 1 failed, 18 passed: `expected false to be true` on `stored.plugins.linkify` (storage held O, memory held A).
- GREEN: same file after the fix -> 19 passed.
- Item 3 had no RED. The behavior already held, so the new e2e tests are regression guards and passed on first run (3 passed with the existing Mermaid test).
- Item 2 has no new automated test. No existing test drags a slider; the slider change is covered only by typecheck and the existing suite.
- A first lint run gave 184 warnings: a `noNonNullAssertion` in the new unit test. Replaced `echoes[0]!()` with `echoes[0]?.()`; lint then gave 183.
### Fresh verification
- `pnpm typecheck` -> exit 0.
- `pnpm lint` -> exit 0, 183 warnings (limit 183), 3 infos.
- `pnpm exec vitest run --maxWorkers=2` -> 37 files, 425 passed.
- `pnpm test:e2e` -> exit 0, 126 passed.
