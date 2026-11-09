# Phase 4: Appearance tab

## Goal & Outcome
- Plan Goal: the popup, a new options page, and a reader dialog share one settings panel. Every setting persists in `storage.local` under `settings:v1`, reaches open reader tabs without reload, and drives render, theme, export, and auto-refresh.
- Phase Outcome: see **Goal** in the Phase Spec below. Prior review debt (task-0) is fixed.

## Context & Architecture
- Code root: `/home/ngosi/projects/markdown-reader` | Records root: same | Branch: `main` | Base: `refs/plans/reference-parity-ui/phase-04/base`
- Prior State: Phase 3 done. pnpm typecheck exit 0. pnpm lint exit 0 with 186 warnings. pnpm exec vitest run --maxWorkers=2 390/390 pass. pnpm test:e2e 107 pass.
- Code Context:
  - Stack: WXT 0.21.5 Chrome MV3 extension, React 19, TypeScript, Zustand, `zod/mini` (jitless), shadcn/ui on Base UI (base-nova), markdown-it 15.0.3, DOMPurify, Shiki, Mermaid, Vitest, Playwright, Biome, pnpm.
  - Settings: `src/lib/settings.ts` (`Settings` type with `general`, `appearance`, `plugins`; `defaultSettings`, `parseSettings`, `SETTINGS_KEY`). `src/store/settings-store.ts` `useSettingsStore` with `settings`, `load()`, `update(patch per section)`, `reset()`; settings changes reach reader tabs through its `storage.onChanged` listener. Strings via `t()`/`useT` from `src/i18n/index.ts`; add keys to `src/i18n/en-US.ts`.
  - Settings UI: `src/ui/settings/settings-panel.tsx` (rail + tabs), `general-tab.tsx`, `appearance-tab.tsx`, `plugins-tab.tsx` (full rows, derived All plugins), `about-tab.tsx`, `settings-dialog.tsx` (reader palette command `settings`). Row pattern: label and description left, control right; follow `plugins-tab.tsx`. Controls in `src/components/ui/` (switch, slider, select, textarea, button, dialog...).
  - Render: `src/render/pipeline.ts` `getMarkdownIt(config)` four-entry LRU keyed by `pluginKey`; `src/ui/markdown-view.tsx` takes `plugins` and `pluginKey`, fills `[[TOC]]` placeholders after paint.
  - Reader boot is async. In every e2e test that presses keys or clicks in the reader, first wait for React mount, for example `await page.locator('#root > *').first().waitFor()`.
- Phase 3 notes: `markdown-it-multimd-table` 4.2.3 needs a per-instance `utils.assign` shim in `pipeline.ts`. Perf tests in `tests/e2e/perf.spec.ts` (S3, S4, and all-plugins variants) log timings.
  - Resolution numbers (for example resolution 9 for `isDark()`) refer to `docs/plans/reference-parity-ui/DESIGN.md`; read DESIGN Settings Behavior and Resolutions before task-1.

## Phase Spec (verbatim from PLAN.md; Files list is the allowed edit set, plus task-0 files below)
**Phase Request:** Add the Appearance tab with theme, code theme, text size, font, wrapping, tables, centering, custom width, Zen mode, and custom CSS. Use cases: (a) a user forces dark mode in a light-system browser and Mermaid redraws in dark. (b) A user picks the dark code theme in light mode. (c) A user raises the text size and the change applies to open tabs. (d) A user pastes a stylesheet that uses `url(` and sees an inline error while the previous CSS stays. (e) A user exports a document and the file keeps the Appearance settings, but print stays light. (f) Zen mode starts on when stored, and Escape leaves the session only.
**Goal:** Every Appearance row in DESIGN works live in the reader and in export. Dark-mode export does not regress.
**Depends on:** Phase 3
**Invariants & Boundaries:** Auto keeps the `prefers-color-scheme` rules so exports follow the system theme. Code themes stay limited to bundled `github-light` and `github-dark`. The highlight cache key includes both code theme values. Zen mode merges into the existing `focusMode` in `src/store/reader-store.ts`. Escape still closes dialogs first. Custom CSS applies through `adoptedStyleSheets` and never through an inline style element in the document. Export copies the custom CSS and every Appearance value into `buildStandaloneHtml` output.
**Files:**
- Create: `src/lib/appearance.ts`
- Create: `src/lib/custom-css.ts`
- Modify: `src/styles/globals.css`
- Modify: `src/styles/markdown.css`
- Modify: `src/styles/editor.css`
- Modify: `src/export/export-styles.ts`
- Modify: `src/export/export.ts`
- Modify: `src/render/diagram.ts`
- Modify: `src/render/highlight.ts`
- Modify: `src/ui/markdown-view.tsx`
- Modify: `src/ui/settings/appearance-tab.tsx`
- Modify: `src/store/reader-store.ts`
- Modify: `src/entrypoints/reader/App.tsx`
- Create: `tests/unit/appearance.test.ts`
- Create: `tests/unit/custom-css.test.ts`
- Create: `tests/e2e/appearance.spec.ts`
- Modify: `tests/unit/export.test.ts`
- Modify: `tests/e2e/theme.spec.ts`
- Modify: `tests/e2e/export.spec.ts`
**Tasks:**
1. Theme. RED: `tests/e2e/theme.spec.ts` asserts Light forces light tokens with `colorScheme` set to dark, Dark forces dark tokens with `colorScheme` set to light, and Auto follows the system. `tests/unit/export.test.ts` asserts `EXPORT_TOKENS` still equals the `globals.css` light and dark token values. GREEN: `src/lib/appearance.ts` writes `data-theme` on `document.documentElement` from the settings value. Add `[data-theme='light']` and `[data-theme='dark']` selectors in `globals.css`, `markdown.css`, and `editor.css` beside the existing `prefers-color-scheme` blocks. `isDark()` in `diagram.ts` follows resolution 9. A change to the theme calls `rerenderDiagrams` from `markdown-view.tsx`. Replace the `matchMedia` listener in `markdown-view.tsx` with a subscription to the theme value.
2. Code theme. RED: `tests/unit/appearance.test.ts` asserts that the highlight cache key changes when either code theme value changes. `tests/e2e/appearance.spec.ts` asserts that the code block color follows the selected light and dark values in each mode. GREEN: `highlight.ts` includes both values in its cache key. Bundled Shiki dual-theme output stays. `markdown.css` selects `--shiki-light` or `--shiki-dark` from root data attributes set by `appearance.ts`. No rerender is needed for code theme changes.
3. Text, font, layout, and Zen. RED: `appearance.test.ts` asserts the six text steps map to 0.875, 0.9375, 1.0, 1.0625, 1.125, and 1.25 with step 3 at 1.0 as default. It asserts custom max width clamping 500 to 3000 and default 1000. It asserts Zen merges with `focusMode`: a stored `zen: true` sets `focusMode` true on load, and Escape clears `focusMode` but not the stored value. GREEN: `appearance.ts` sets `--md-scale`, `--md-font`, `--md-max-width`, and root classes for wrap code, wide tables, and centered. `appearance-tab.tsx` renders Text size slider, Font select, Theme select, code theme selects, wrap, wide tables, Zen, centered, and custom max width switch with slider and number field.
4. Custom CSS and export. RED: `tests/unit/custom-css.test.ts` asserts rejection with a message for `url(`, `image-set(`, `@import`, and a backslash, case-insensitive and with whitespace variants such as `u\72l(` and `url (`. It asserts acceptance of plain rules. `tests/e2e/export.spec.ts` asserts that an exported file with Zen off, a custom width, and custom CSS keeps all three and loads with zero network requests. GREEN: `custom-css.ts` returns `{ ok: true } | { ok: false; message }`. The textarea in `appearance-tab.tsx` shows the inline error and keeps the previous applied sheet. Apply uses `document.adoptedStyleSheets`. `export-styles.ts` and `export.ts` carry the Appearance values as CSS custom properties and the custom CSS. Print stays light.
**Acceptance Criteria:**
- `tests/unit/custom-css.test.ts` passes for each rejected token and for a backslash in a selector.
- A rejected stylesheet shows an inline error. The previously applied `adoptedStyleSheets` entry remains.
- The export of a dark-mode document has the same token values as the in-app dark theme. Verified by `tests/unit/export.test.ts` and `tests/e2e/export.spec.ts`.
- Changing the code theme does not change Mermaid output.
- Escape on a Zen session returns to a normal layout while the stored `zen` value stays true.
- Contrast checks in `tests/e2e/contrast.spec.ts` pass in forced light and dark.
**Reviewer Checklist:**
- Custom CSS filter bypass. Test escaped forms such as `u\rl(`, `@IMPORT`, `image\-set(`, and `\0075rl(`. A backslash rejection covers the escapes.
- `adoptedStyleSheets` replaces the sheet each apply and does not accumulate.
- Dark export regression. Compare the export token values to `globals.css` dark block. The `prefers-color-scheme` rule still applies in Auto export.
- The Mermaid epoch guard drops a stale render when the theme changes twice quickly.
- `data-theme` written on the root only. Editor and export read their own tokens.
- Zen merge. Escape exits the session only and does not write the stored value.
- Text size applies to the rendered content, not the sidebar or the popup.
**Verification Checks:**
- `pnpm typecheck`
- `pnpm lint`
- `pnpm exec vitest run --maxWorkers=2`
- `pnpm exec playwright test tests/e2e/theme.spec.ts tests/e2e/appearance.spec.ts tests/e2e/export.spec.ts tests/e2e/contrast.spec.ts`
- `pnpm test:e2e`

## Task 0: prior review debt (do first, RED then GREEN)
Files for task-0: `src/store/settings-store.ts`, `src/ui/settings/plugins-tab.tsx`, `src/render/pipeline.ts`, `src/ui/markdown-view.tsx`, `tests/e2e/perf.spec.ts`, `tests/unit/settings-store.test.ts`, `tests/unit/pipeline-config.test.ts`, `tests/unit/settings-panel.test.tsx`.
(a) `settings-store.ts`: Chrome sends no onChanged event when a write leaves the stored value unchanged, so that write's pending echo entry lingers up to 2 s and can drop a later genuine change from another context. Before `write`, compare `next` with the last value seen from storage (or `readSettings`); if equal, do not register a pending entry (or skip the write). Add a test.
(b) `plugins-tab.tsx` lines around 16 and 33: `.catch(() => undefined)` hides write failures. Show the error in a `role="alert"` line, as `general-tab.tsx` does for Reset. Add a unit test.
(c) Block keys get the config prefix twice (in `planBlocks` in `pipeline.ts` and as `keyPrefix` in `markdown-view.tsx`). Keep the `planBlocks` prefix and drop the view `keyPrefix`; keep the reset on plugin-key change. Existing reader-render tests must still pass.
(d) `perf.spec.ts`: parser build time on a toggle is not isolated. Wrap parser construction (`createMarkdownIt` or equivalent) in `performance.mark`/`performance.measure` named `md-parser-build`, and log that measure in the perf output next to the paint time.
(e) `pipeline.ts`: add a `TODO` naming `markdown-it-multimd-table` 4.2.3 at the `utils.assign` shim, and ensure a unit test builds a parser with `multimdTable` on and renders a colspan table (add one in `pipeline-config.test.ts` if missing).

## Boundaries
- Allowed edits: the Files list above, task-0 files, and `src/i18n/en-US.ts`. If a changed signature forces a type-only update in another test file, make it and record it in notes. Do not add dependencies unless the Files list includes `package.json`.
- Lint warnings stay at or below the Prior State count.
- Worker-owned phase records: `/home/ngosi/projects/markdown-reader/docs/plans/reference-parity-ui/phase-04/notes.md` (append `## Task <M>` blocks) and `/home/ngosi/projects/markdown-reader/docs/plans/reference-parity-ui/phase-04/journal.md` (append `# EXTERNAL RESPONSE` under `## Implementation Response`).
- Read-only / Forbidden: do not edit `PLAN.md`, `DESIGN.md`, `.handover.md`, `prompt.md`, other phases, or secrets. Do not read `snapshot/`. Do not commit; the Coordinator owns Git.

## Done When
- Every task and task-0 GREEN; every Acceptance Criterion holds; every Verification Check passes fresh from `/home/ngosi/projects/markdown-reader` (run `pnpm build` before playwright if needed). Record exit codes, counts, and lint warning count in notes.

## Rules
Read and follow these bundled contracts:
- Contract: `/home/ngosi/projects/refract/plugin/shared/worker-contract.md`
- Response: `/home/ngosi/projects/refract/plugin/shared/erp.md`
- Notes: `/home/ngosi/projects/refract/plugin/shared/notes-template.md`
- Journal: `/home/ngosi/projects/refract/plugin/shared/journal-template.md`

Role boundary: You are the phase implementer, not Coordinator. Edit code only in `/home/ngosi/projects/markdown-reader`; write phase records only under `/home/ngosi/projects/markdown-reader/docs/plans/reference-parity-ui/phase-04/`. Leave Coordinator skills, Git commits, and Refract job submission to the Coordinator.

## Response Format
Append the complete `# EXTERNAL RESPONSE` block to `/home/ngosi/projects/markdown-reader/docs/plans/reference-parity-ui/phase-04/journal.md`, then return that block and the matching status line from `erp.md`.
