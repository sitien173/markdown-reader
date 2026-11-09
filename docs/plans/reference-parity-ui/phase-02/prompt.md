# Phase 2: Shared SettingsPanel shell

## Goal & Outcome
- Plan Goal: the popup, a new options page, and a reader dialog share one settings panel. Every setting persists in `storage.local` under `settings:v1`, reaches open reader tabs without reload, and drives render, theme, export, and auto-refresh.
- Phase Outcome: the same `SettingsPanel` renders in the popup, the options page, and a reader dialog. Appearance and Plugins contain only H2 headings in this phase. Phase 1 store-race debt is fixed.

## Context & Architecture
- Code root: `/home/ngosi/projects/markdown-reader` | Records root: same | Branch: `main` | Base: `refs/plans/reference-parity-ui/phase-02/base`
- Prior State: Phase 1 done. `pnpm typecheck` exit 0. `pnpm lint` exit 0 with 188 warnings. `pnpm exec vitest run --maxWorkers=2` 337/337 pass. `pnpm test:e2e` 97 pass.
- Code Context:
  - Stack: WXT 0.21.5 Chrome MV3 extension, React 19, TypeScript, Zustand, `zod/mini` (jitless), shadcn/ui on Base UI (`components.json` style base-nova), Vitest, Playwright, Biome, pnpm.
  - Phase 1 delivered: `src/lib/settings.ts` (`SETTINGS_KEY`, `settingsSchema`, `defaultSettings`, `parseSettings`, `readSettings`, `CUSTOM_CSS_MAX_LENGTH`, `Settings` type with `general`, `appearance`, `plugins` sections). `src/store/settings-store.ts` (`useSettingsStore` with `settings`, `load()`, `update(patch per section)`, `reset()`; `update` throws on oversized `customCss`). `src/i18n/index.ts` (`t(key: I18nKey)`, `useT`, `applyLanguage`) and `src/i18n/en-US.ts`. Use `t()`/`useT` for all new UI strings and add keys to `en-US.ts`.
  - Reader boot is async: `src/entrypoints/reader/main.tsx` exports `bootReader`, which awaits settings load before `createRoot`. In every e2e test that presses keys or clicks in the reader, first wait for React mount, for example `await page.locator('#root > *').first().waitFor()`. Popup and options entrypoints should also await `useSettingsStore.getState().load()` before render.
  - Existing popup: `src/entrypoints/popup/App.tsx` and `main.tsx`; existing palette commands in `src/reader/commands.ts`; existing e2e fixtures in `tests/e2e/`.

## Invariants & Boundaries
- No setting in this phase changes rendered output. The General tab carries only the open row (Open viewer, Open editor, Render current tab), recents (max 5, newest first), the disabled Language select with one option `English (US)`, and Reset settings last. Breaks, Enable, Local file access, Render .txt, auto-refresh, and charset rows wait for Phase 5.
- The About tab has no `<a>` elements. Popup size is 520 by 480 px. Do not change `src/styles/globals.css` tokens.
- Popup sends the same runtime messages as before: `open-viewer`, `open-editor`, `render-current`. Keep the `role="alert"` error paragraph, the file-access dialog, and URL scheme errors.
- The reader dialog and the popup panel share one component and one store. No second copy of settings state.
- Out of Scope: any new dependency beyond what `pnpm exec shadcn add switch slider select textarea` adds; render changes; Phase 3+ rows.

## Files
Allowed production and test paths:
- `src/components/ui/switch.tsx`, `slider.tsx`, `select.tsx`, `textarea.tsx` (create via `pnpm exec shadcn add switch slider select textarea`; if shadcn adds a package, `package.json` and `pnpm-lock.yaml` changes from that command only are allowed)
- `src/ui/settings/settings-panel.tsx`, `general-tab.tsx`, `appearance-tab.tsx`, `plugins-tab.tsx`, `about-tab.tsx`, `settings-dialog.tsx` (create)
- `src/entrypoints/options/index.html`, `main.tsx`, `App.tsx` (create)
- `src/entrypoints/popup/App.tsx`, `src/entrypoints/popup/main.tsx`, `src/styles/popup.css`, `wxt.config.ts`, `src/reader/commands.ts`, `src/entrypoints/reader/App.tsx` (modify)
- `src/i18n/en-US.ts` (modify: new strings)
- `src/store/settings-store.ts` (modify: task-0 debt only)
- `tests/unit/settings-panel.test.tsx`, `tests/e2e/settings.spec.ts` (create); `tests/e2e/entry.spec.ts`, `tests/unit/settings-store.test.ts` (modify)
- Other existing e2e specs: modify only to add a React-mount wait if the panel change requires it; no assertion changes.

Worker-owned phase records:
- `/home/ngosi/projects/markdown-reader/docs/plans/reference-parity-ui/phase-02/notes.md` (append `## Task <M>` blocks)
- `/home/ngosi/projects/markdown-reader/docs/plans/reference-parity-ui/phase-02/journal.md` (append `# EXTERNAL RESPONSE` under `## Implementation Response`)

Read-only / Forbidden:
- Do not edit `PLAN.md`, `DESIGN.md`, `.handover.md`, `prompt.md`, other phases, or secrets. Do not read `snapshot/`. Do not commit; the Coordinator owns Git.

## Tasks
- task-0: Phase 1 debt in `src/store/settings-store.ts`. RED tests in `tests/unit/settings-store.test.ts` first. (a) `load()` rejection must not reset settings to defaults over in-flight `update`/`onChanged` state; only clear the cached promise so a later `load()` retries. (b) `update()` keeps setting state before the storage write, but if `storage.local.set` rejects, restore the previous settings only when `get().settings` is still the value it set, then rethrow. (c) `reset()` sets state before awaiting storage, like `update()`. (d) An `onChanged` echo of an earlier write must not briefly overwrite a later update: skip `set` when the parsed new value deep-equals current settings; add a test whose stub `set` fires `onChanged` listeners.
- task-1: Controls. RED: `tests/unit/settings-panel.test.tsx` imports `Switch`, `Slider`, `Select`, `Textarea` from `src/components/ui/` and fails on missing files. GREEN: run `pnpm exec shadcn add switch slider select textarea`. Confirm each file imports from `@base-ui/react` and `components.json` still says base-nova. Do not edit generated tokens.
- task-2: Panel shell. RED: `settings-panel.test.tsx` asserts four rail buttons with accessible names General, Appearance, Plugins, About; the active rail button has `aria-pressed` or the Base UI tab state; Appearance and Plugins panes render an H2. GREEN: `settings-panel.tsx` renders a 60 px rail and a scrolling pane. Rows: label and description left, control right. About renders a 128 px icon from `public/icons/icon-128.png`, H1 `Markdown Reader`, version from `browser.runtime.getManifest().version`, and the line `© 2026 Markdown Reader`. No links.
- task-3: Hosts. RED: `tests/e2e/settings.spec.ts` asserts `chrome-extension://<id>/options.html` shows the panel, the popup viewport is 520 by 480 px, and the reader dialog opens from the palette command `settings` and closes on Escape. GREEN: `wxt.config.ts` gets `options_ui: { page: 'options.html', open_in_tab: true }` through the WXT manifest key; verify `.output/chrome-mv3/manifest.json` after `pnpm build` contains it. Popup hosts the panel with Phase 2 General rows. `src/reader/commands.ts` gets one new `settings` command. Reader `App.tsx` opens `settings-dialog.tsx` from it. `src/styles/popup.css` sets 520 by 480 px. Check that the options page also works with `open_in_tab` false and record the chosen value in notes.
- task-4: Popup behavior. RED: extend `tests/e2e/entry.spec.ts` so the existing open-viewer, open-editor, recent-newest-first, file-access dialog, and URL scheme error tests still pass after the panel wrap. GREEN: move popup actions into General. Keep the `role="alert"` paragraph. Reset settings opens a confirm dialog, writes defaults on confirm, and returns focus to its trigger on close.

## Done When
- `pnpm build` produces `.output/chrome-mv3/manifest.json` with `options_ui.page` `options.html` and `open_in_tab` `true`.
- All Acceptance Criteria above and every task GREEN; task-0 tests pass.
- Run from `/home/ngosi/projects/markdown-reader`:
  - `pnpm typecheck` (Baseline: exit 0)
  - `pnpm lint` (Baseline: exit 0, 188 warnings; target exit 0, warnings at most 188)
  - `pnpm exec vitest run --maxWorkers=2` (Baseline: 337/337 pass)
  - `pnpm exec playwright test tests/e2e/settings.spec.ts tests/e2e/entry.spec.ts` (after `pnpm build` if the e2e setup needs it)
  - `pnpm test:e2e` (Baseline: 97 pass)

## Rules
Read and follow these bundled contracts:
- Contract: `/home/ngosi/projects/refract/plugin/shared/worker-contract.md`
- Response: `/home/ngosi/projects/refract/plugin/shared/erp.md`
- Notes: `/home/ngosi/projects/refract/plugin/shared/notes-template.md`
- Journal: `/home/ngosi/projects/refract/plugin/shared/journal-template.md`

Role boundary: You are the phase implementer, not Coordinator. Edit code only in `/home/ngosi/projects/markdown-reader`; write phase records only under `/home/ngosi/projects/markdown-reader/docs/plans/reference-parity-ui/phase-02/`. Leave Coordinator skills, Git commits, and Refract job submission to the Coordinator.

## Response Format
Append the complete `# EXTERNAL RESPONSE` block to `/home/ngosi/projects/markdown-reader/docs/plans/reference-parity-ui/phase-02/journal.md`, then return that block and the matching status line from `erp.md`.
