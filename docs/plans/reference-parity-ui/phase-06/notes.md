<!-- refract-shared-version: 3.0.0 -->

# Phase 6 Decision Notes

<!-- Created by the worker per worker-contract.md. Append one `## Task <M>` block per task. -->




## Task 0

### Decisions made
- (a) `UrlSource.read()` fetches with `{ cache: 'no-cache' }`.
- (b) `watchHttpUrl` refetches with `redirect: 'follow'` and no headers when the manual fetch returns `opaqueredirect`. It compares decoded text with the baseline and clears stored validators for that cycle, so validators never go to another origin.
- (c) Charset compatibility description now ends with "Applies when a document is reopened."

### Spec deviations
- (c) is a string change with no behavioral test; no RED exists for it.

### Tradeoffs accepted
- A redirecting URL costs two requests per poll (manual, then follow).

### Assumptions
- none

### Follow-ups for human
- none

### Test evidence
- RED -> GREEN:
  - RED: `pnpm exec vitest run tests/unit/source-url.test.ts tests/unit/watch.test.ts` -> `toHaveBeenCalledWith('https://example.test/a.md', { cache: 'no-cache' })` got no options; redirect test `expected "vi.fn()" to be called 1 times, but got 0 times`. 2 failed, 13 passed.
  - GREEN: `pnpm exec vitest run tests/unit/source-url.test.ts tests/unit/watch.test.ts tests/unit/auto-refresh.test.ts` -> 27 passed.
- Root cause (bugfix only): (a) default fetch cache mode can serve a stale body after the poller advanced its baseline. (b) `redirect: 'manual'` yields an opaque response with `ok` false, which counted as failure.

## Task 1

### Decisions made
- Sidebar view control is `toggle-group.tsx` with two icon buttons named by `aria-label` Files and Outline, inside a group named Sidebar view. The stored `sidebarTab` value stays `contents` for Outline.
- `TocPanel` reads `general.outlineCollapsing` from the settings store. Collapse state is local and keyed by heading id. A filter query disables collapsing so matches show with their parents.
- Scroll-spy waits via `MutationObserver` for headings not yet in the DOM, then observes. This lives in `toc-panel.tsx` because `src/toc/toc.ts` is outside the Files list.
- The Outline collapsing row uses the existing `toggle` helper in `general-tab.tsx`, placed after Breaks.
- The old `Toolbar` still renders in edit and split until task 4 replaces it.
- Sidebar width is `260px` in `reader.css`.
- Added a `reader` section to `en-US.ts`.

### Spec deviations
- none

### Tradeoffs accepted
- Filter text resets when the tab or search state changes.

### Assumptions
- The first file loaded from a picked folder is `notes/gamma.md` in the test fixture, so the outline test selects `alpha.md` first.

### Follow-ups for human
- none

### Test evidence
- RED -> GREEN:
  - RED: `pnpm exec playwright test tests/e2e/reader-shell.spec.ts` -> 4 failed, for example `expect(locator).toHaveCount(expected) failed Expected: 0 Received: 1` on `[data-slot="reader-bar"]`.
  - GREEN: `pnpm exec playwright test tests/e2e/reader-shell.spec.ts` -> 4 passed.
- Root cause (bugfix only): none

## Task 2

### Decisions made
- Added `toggle-raw`, `toggle-fullscreen`, `about` to `CommandId` and the registry, placed after `focus-mode` and around `settings`. `focus-mode` label is now `Zen mode`; its id is unchanged.
- New `CommandDeps`: `toggleRaw`, `toggleFullscreen`, `openAbout`. `toggle-raw` needs a document; the other two are always available.
- The `settings` label stays `Settings`, the existing registry label. The acceptance text says "Setting"; one label string is kept so the menu and palette match.

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
  - RED: `pnpm exec vitest run tests/unit/commands.test.ts` -> 6 failed, for example `expected [ 'open-file', 'open-folder', ...(11) ] to deeply equal [ ...(14) ]`.
  - GREEN: `pnpm exec vitest run tests/unit/commands.test.ts` -> 14 passed.
- Root cause (bugfix only): none

## Task 3

### Decisions made
- `reader-menu.tsx` renders seven groups: Toggle Raw; Toggle Fullscreen; Print and Export HTML; Open file; Open folder; Open URL and Command palette; Settings and About. That is ten items and six separators. Labels and `available` come from the registry.
- Floating sidebar toggle (top left) and menu button (top right) are fixed-position buttons in `App.tsx` and `reader-menu.tsx`. They are hidden in Zen mode, where the existing Exit button remains. The sidebar toggle label is read from the `toggle-sidebar` command.
- `enhance.ts` wraps each `pre` (except `pre.mermaid`) in `div.md-code` with a bar holding the language label and a Copy button. Copy writes the source text captured before highlighting. A rejected write shows `Copy failed`. Labels go through `t()`.
- Heading permalink: `a.md-permalink` with `aria-hidden="true"`, `tabIndex -1`, `href="#<heading id>"`. The `#` is a CSS pseudo-element so heading text content is unchanged and existing `toHaveText` assertions hold.
- Export removes `.md-code-bar` and `.md-permalink` from a clone before building the HTML. Print hides them in `reader.css`.
- `about-dialog.tsx` wraps `AboutTab` in a dialog named About with the built-in Close button.
- Edited `tests/unit/shortcuts.test.ts` for type only: the `CommandDeps` mock gained the three new deps.
- `reader.css`: removed `.reader-bar-end` and `.reader-kbd`, orphaned by the compact header.

### Spec deviations
- none

### Tradeoffs accepted
- Zen mode has no floating menu; its commands stay reachable from Cmd+K.
- Plain `pre` blocks get their Copy bar after all language blocks finish highlighting.

### Assumptions
- DESIGN groups give ten menu items. "Print or Export HTML" in the acceptance list is read as the Print and Export HTML group.
- `context.grantPermissions` without an origin is the only way to grant clipboard read for the extension page; with the extension origin Playwright refuses it as an opaque origin.

### Follow-ups for human
- none

### Test evidence
- RED -> GREEN:
  - RED: `pnpm exec playwright test tests/e2e/reader-shell.spec.ts` -> 5 failed of 9, for example `locator('.md-code').first().locator('.md-code-lang')` element not found, `a.md-permalink` not found, no Menu button. `pnpm exec vitest run tests/unit/enhance.test.ts` -> 3 failed (language label undefined, no permalink).
  - GREEN: `pnpm exec playwright test tests/e2e/reader-shell.spec.ts` -> 9 passed. `pnpm exec vitest run tests/unit/enhance.test.ts tests/unit/commands.test.ts tests/unit/shortcuts.test.ts` -> 58 passed.
- Root cause (bugfix only): none

## Task 4

### Decisions made
- `toolbar.tsx` is now the compact header for edit and split: title, dirty dot, Save, and the `Reader mode` radiogroup. The dirty dot reads `dirty` from the reader store.
- Toggle Raw is `controller.setMode` with edit when the mode is read, otherwise read.
- Fullscreen calls `document.documentElement.requestFullscreen()`, or `exitFullscreen()` when active. A rejection or synchronous throw calls `notifyToast(t('reader.fullscreenRefused'))`.
- The header's inline padding clears the floating toggle and menu button.

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
  - RED: `pnpm exec playwright test tests/e2e/reader-modes.spec.ts` -> 1 failed of 5: `locator('[data-slot="reader-bar"]').getByRole('button', { name: 'Open' })` Expected: 0 Received: 1. The other four already held after task 3.
  - GREEN: `pnpm exec playwright test tests/e2e/reader-modes.spec.ts tests/e2e/reader-shell.spec.ts` -> 14 passed.
- Root cause (bugfix only): none

## Cross-spec selector updates (approved by coordinator)

Control paths only; assertions unchanged unless listed under Spec deviations.

### Spec deviations
- `tests/e2e/general.spec.ts`: the absence assertion for `Outline collapsing` is now a presence assertion (switch, not checked). Cause: plan sequencing. PLAN.md line 31 lands the row in Phase 6; Phase 5 asserted absence because the row did not exist yet.
- `tests/e2e/reader.spec.ts` (fragment links test): the link selector now excludes `.md-permalink`. Cause: the new heading permalinks are `a[href^="#"]` and precede the footnote links. Assertions unchanged.
- `tests/e2e/export.spec.ts` (Export is disabled in Edit mode): the Menu button is always enabled, so the test opens the menu and asserts the `Export HTML` item is disabled. Same behavior proved.
- `tests/e2e/export.spec.ts` (Print stylesheet): reader chrome hidden under print media is now checked on `.reader-float`, since the read-mode `reader-bar` no longer exists.

- `tests/e2e/palette.spec.ts` (Ctrl+K and Cmd+K tests): the shortcut hint is now read from the floating menu `Command palette` item instead of the removed toolbar button. `src/ui/reader-menu.tsx` renders each item's registry shortcut through `formatShortcut`. Open and close checks unchanged. Approved by coordinator.
- `tests/e2e/reader-shell.spec.ts` (menu order test): the expected item texts now include the shortcut hints (`PrintCtrl+P`, `Open fileCtrl+O`, `Command paletteCtrl+K`), a consequence of the approved menu hints.
- `tests/e2e/shell.spec.ts` (focus mode test): focus return is asserted on the `Menu` button, not the removed `Focus mode` button. The test enters Split mode first so the reader bar exists to be hidden and restored; `App.tsx` already focuses the Menu button on exit, so no app change was needed. Approved by coordinator.
- `tests/e2e/shell.spec.ts` (radiogroup test): enters Split mode through the palette, then asserts the compact header radiogroup with `Split` checked initially instead of `Read`. Remaining arrow-key assertions unchanged. Approved by coordinator.
- `tests/unit/reader-app.test.tsx`: `showFilesTab` selects the `Sidebar view` toggle's `Files` button. Assertions unchanged. Approved by coordinator.
- `tests/unit/reader-render.test.tsx`: the Files selector change was not needed there. Its setup URL changed from `?mode=read` to `?mode=split` because the Toolbar renders only outside read mode, and the toolbar render-scope assertions are kept. Not covered by the coordinator's wording; recorded for review.

### Selector reroutes
- `reader.spec.ts`, `contrast.spec.ts`, `shell.spec.ts`: Open menu paths became Menu then `Open file` / `Open URL`.
- `export.spec.ts`, `theme.spec.ts`, `palette.spec.ts`, `motion.spec.ts`, `keyboard.spec.ts`: Export options trigger became the `Menu` button.
- `contrast.spec.ts`, `motion.spec.ts`: Command palette button became Control+K.
- `palette.spec.ts`, `shell.spec.ts`: `Focus mode` became `Zen mode`; the toolbar palette button test opens the palette from Menu.
- `reader.spec.ts`, `keyboard.spec.ts`: sidebar Contents/Files tabs became the `Sidebar view` toggle buttons Outline/Files.
- `editor.spec.ts`, `perf.spec.ts`: Read to Split/Edit through the palette commands.

### Fresh verification (final)
- `pnpm typecheck`: exit 0.
- `pnpm lint`: 0 errors, 183 warnings (limit 183).
- `pnpm exec vitest run --maxWorkers=2`: 40 files, 478 tests passed.
- `pnpm exec playwright test tests/e2e/reader-shell.spec.ts tests/e2e/reader-modes.spec.ts tests/e2e/shell.spec.ts tests/e2e/enhance.spec.ts`: 31 passed.
- `pnpm test:e2e` (build plus full suite, foreground): 148 passed, 0 failed.
