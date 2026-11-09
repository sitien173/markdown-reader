# Phase 7: Hardening and release audit

## Goal & Outcome
- Plan Goal: the popup, a new options page, and a reader dialog share one settings panel. Every setting persists in `storage.local` under `settings:v1`, reaches open reader tabs without reload, and drives render, theme, export, and auto-refresh.
- Phase Outcome: see **Goal** in the Phase Spec below. Prior review debt (task-0) is fixed.

## Context & Architecture
- Code root: `/home/ngosi/projects/markdown-reader` | Records root: same | Branch: `main` | Base: `refs/plans/reference-parity-ui/phase-07/base`
- Prior State: Phase 6 done. pnpm typecheck exit 0. pnpm lint exit 0 with 183 warnings. pnpm exec vitest run --maxWorkers=2 478/478 pass. pnpm test:e2e 148 pass.
- Code Context:
  - Stack: WXT 0.21.5 Chrome MV3 extension, React 19, TypeScript, Zustand, `zod/mini` (jitless), shadcn/ui on Base UI (base-nova), markdown-it 15.0.3, DOMPurify, Shiki, Mermaid, Vitest, Playwright, Biome, pnpm.
  - Settings: `src/lib/settings.ts` (`Settings` type with `general`, `appearance`, `plugins`; `defaultSettings`, `parseSettings`, `SETTINGS_KEY`). `src/store/settings-store.ts` `useSettingsStore` with `settings`, `load()`, `update(patch per section)`, `reset()`; settings changes reach reader tabs through its `storage.onChanged` listener. Strings via `t()`/`useT` from `src/i18n/index.ts`; add keys to `src/i18n/en-US.ts`.
  - Settings UI: `src/ui/settings/settings-panel.tsx` (rail + tabs), `general-tab.tsx`, `appearance-tab.tsx`, `plugins-tab.tsx` (full rows, derived All plugins), `about-tab.tsx`, `settings-dialog.tsx` (reader palette command `settings`). Row pattern: label and description left, control right; follow `plugins-tab.tsx`. Controls in `src/components/ui/` (switch, slider, select, textarea, button, dialog...).
  - Render: `src/render/pipeline.ts` `getMarkdownIt(config)` four-entry LRU keyed by `pluginKey`; `src/ui/markdown-view.tsx` takes `plugins` and `pluginKey`, fills `[[TOC]]` placeholders after paint.
  - Reader boot is async. In every e2e test that presses keys or clicks in the reader, first wait for React mount, for example `await page.locator('#root > *').first().waitFor()`.
  - Phases 5 and 6 delivered the General tab (Zod-free `src/lib/settings-flags.ts` for background and detect; do not import Zod there), http(s) polling, and the reader shell: `src/ui/reader-menu.tsx` (Base UI Menu reading the command registry, shows shortcut hints via `formatShortcut`), `src/ui/about-dialog.tsx`, sidebar in `src/ui/toc-panel.tsx` and `src/ui/file-tree.tsx`, compact edit/split header in `src/ui/toolbar.tsx`, code Copy bar and permalinks in `src/render/enhance.ts`. Toggle Fullscreen uses `document.documentElement.requestFullscreen`; Zen is `focusMode` in `src/store/reader-store.ts`; the Escape handler lives in `src/entrypoints/reader/App.tsx` and on Zen exit focuses the Menu button.
  - Existing e2e specs that reach read-mode controls use the floating menu, the Cmd+K palette, or the compact header. Read mode has no mode radiogroup by design.
  - `CHROMEWEBSTORE.md` and `README.md` exist (Coordinator checked). The four popup snapshot files named in task 3 exist under `snapshot/`. Respect the snapshot read restrictions in the Invariants exactly.
  - Phase 7 task 2 edits `src/entrypoints/reader/App.tsx`; that file is allowed for task 2 even though it is not in the Files list. Phase 7 task 1 may edit `src/ui/reader-menu.tsx`, `src/ui/about-dialog.tsx`, `src/ui/toc-panel.tsx`, `src/ui/file-tree.tsx`, `src/styles/markdown.css`, `src/styles/editor.css`, and `src/ui/settings/*.tsx` only to add accessible names or reduced-motion and contrast fixes, recorded in notes.
  - Resolution and success-criterion numbers refer to `docs/plans/reference-parity-ui/DESIGN.md`; read DESIGN Success Criteria 1 to 9 before task-4.

## Phase Spec (verbatim from PLAN.md; Files list is the allowed edit set, plus task-0 files and the Code Context allowances)

**Phase Request:** Verify the whole feature against accessibility, motion, contrast, the Escape and fullscreen interaction, and the reference popup role structure. Ship the docs and the package. Use cases: (a) a user with reduced motion sees no transitions in the new panels. (b) A user in forced dark sees readable text in every new control. (c) A user in browser fullscreen presses Escape and leaves fullscreen, and Zen mode stays on. (d) The popup role tree matches the reference popup snapshots. (e) A release build produces a zip with no new permissions.
**Goal:** The feature passes every DESIGN success criterion, and the release package is audited.
**Depends on:** Phase 6
**Invariants & Boundaries:** Do not read the `snapshot/` folder at test time. Copy the needed role structure into a committed fixture. Do not read the body of `snapshot/markdown_reader_ui_snapshot.yml` or `snapshot/markdown_reader_inpage_about_modal_snapshot.yml` in any task. Permissions in `wxt.config.ts` stay unchanged. Documentation changes describe settings, not third-party features.
**Files:**
- Modify: `tests/e2e/contrast.spec.ts`
- Modify: `tests/e2e/motion.spec.ts`
- Modify: `src/styles/globals.css`
- Modify: `src/styles/reader.css`
- Modify: `src/styles/popup.css`
- Modify: `src/ui/settings/settings-panel.tsx`
- Modify: `README.md`
- Modify: `CHROMEWEBSTORE.md` (confirm it exists first with `ls CHROMEWEBSTORE.md`; if absent, stop and report to the user)
- Create: `tests/fixtures/popup-roles.json`
- Create: `tests/e2e/popup.spec.ts`
- Create: `tests/e2e/zen-fullscreen.spec.ts`
**Tasks:**
1. Accessibility, motion, and contrast. RED: extend `tests/e2e/motion.spec.ts` with reduced-motion checks for the settings panel, the reader menu, the About dialog, and the sidebar. Extend `tests/e2e/contrast.spec.ts` with forced light and dark checks on the popup, options, reader dialog, sidebar, and menu. Add an axe-free check: every rail button, icon button, and copy button has an accessible name. GREEN: fix the failing tokens and transitions in the new CSS. Do not change the base tokens.
2. Escape and fullscreen. RED: `tests/e2e/zen-fullscreen.spec.ts` enters browser fullscreen with Toggle Fullscreen, presses Escape, and asserts that the document is no longer fullscreen and that Zen mode still applies. It also asserts that Escape with no fullscreen and no dialog exits Zen for the session only. GREEN: the Escape handler in `src/entrypoints/reader/App.tsx` skips the Zen exit when `document.fullscreenElement` was set on the previous keydown, or when the browser consumed the event. Use the fullscreenchange event to set a short guard. Record the chosen mechanism in the phase journal.
3. Popup role structure. RED: `tests/e2e/popup.spec.ts` compares the popup accessibility tree for General, Appearance, Plugins, and About with `tests/fixtures/popup-roles.json`. Create `popup-roles.json` once from `snapshot/markdown_reader_popup_general_snapshot.yml`, `snapshot/markdown_reader_popup_appearance_snapshot.yml`, `snapshot/markdown_reader_popup_plugins_snapshot.yml`, and `snapshot/markdown_reader_popup_about_snapshot.yml`. Those four files may be read fully. Record only roles and names, no reference branding text. GREEN: adjust role names and landmarks in `settings-panel.tsx` until the role tree matches within the allowed differences. Record every difference in the journal.
4. Docs, zip, and permissions audit. RED: a checklist in the phase journal lists each DESIGN success criterion and the spec that proves it. GREEN: update `README.md` and `CHROMEWEBSTORE.md` with the settings list and the `.txt` option. Run `pnpm exec wxt zip`. Confirm the manifest inside the zip has the same `permissions` and `host_permissions` as base `refs/plans/reference-parity-ui/base`. Confirm `options_ui` is present.
**Acceptance Criteria:**
- `pnpm exec playwright test tests/e2e/popup.spec.ts` passes against `tests/fixtures/popup-roles.json`.
- `pnpm exec playwright test tests/e2e/zen-fullscreen.spec.ts` passes.
- `pnpm exec wxt zip` exits 0 and produces an archive under `.output/`.
- `git diff refs/plans/reference-parity-ui/base -- wxt.config.ts` shows no change to the `permissions` or `host_permissions` values.
- Reduced motion and contrast specs pass in forced light and dark for every new surface.
- Every DESIGN success criterion from 1 to 9 has a named passing spec in the phase journal.
**Reviewer Checklist:**
- The Escape guard must not hide a real Escape. A test with no fullscreen and no dialog must still exit Zen.
- `popup-roles.json` contains roles and names only. No reference branding, account text, or link text.
- The zip contents do not include `snapshot/`, `tests/`, or `docs/`.
- README and CHROMEWEBSTORE text names only features that exist in the build.
- Contrast passes in forced dark for the Copy button and the sidebar search field.
- Permission diff is empty against the base ref.
**Verification Checks:**
- `pnpm typecheck`
- `pnpm lint`
- `pnpm exec vitest run --maxWorkers=2`
- `pnpm exec playwright test tests/e2e/popup.spec.ts tests/e2e/zen-fullscreen.spec.ts tests/e2e/motion.spec.ts tests/e2e/contrast.spec.ts`
- `pnpm test:e2e`
- `pnpm exec wxt zip`

## Task 0: prior review debt (do first, RED then GREEN)
Files for task-0: `src/source/watch.ts`, `tests/unit/watch.test.ts`, `src/ui/toc-panel.tsx`, `src/entrypoints/reader/App.tsx` (only if keying TocPanel by `loadId` happens there), `src/styles/reader.css`, `tests/unit/reader-render.test.tsx`, and a toc-panel unit or e2e test.
(a) `src/source/watch.ts` (~line 255): the redirect-follow poll fetch uses the default cache mode, so a redirect target with `max-age` (for example raw.githubusercontent.com) can hide changes. Pass `cache: 'no-cache'` and assert it in `tests/unit/watch.test.ts`.
(b) `src/ui/toc-panel.tsx` (~line 107): the `collapsed` set survives a document change, and heading ids repeat across documents. Reset it when `loadId` changes (for example key `TocPanel` by `loadId` in `ContentsPanel`). Do not reset on every `headings` change, which would undo collapse state during split-mode edits. Add a test.
(c) `src/styles/reader.css` (~line 64): add `user-select: none` to `.md-code-bar` so selecting page text across a code block does not copy the language label and "Copy".
(d) `tests/unit/reader-render.test.tsx`: add a `ReaderMenu` render spy and a short read-mode `describe` that repeats the "a write to a field the shell does not render re-renders nothing" check.

## Boundaries
- Allowed edits: the Files list above, task-0 files, `src/i18n/en-US.ts`, and the Code Context allowances. Existing specs may change only in how they reach controls, with assertions kept; ask before changing an assertion. If a changed signature forces a type-only update in another test file, make it and record it in notes. Do not add dependencies unless the Files list includes `package.json`.
- Lint warnings stay at or below the Prior State count.
- Worker-owned phase records: `/home/ngosi/projects/markdown-reader/docs/plans/reference-parity-ui/phase-07/notes.md` (append `## Task <M>` blocks) and `/home/ngosi/projects/markdown-reader/docs/plans/reference-parity-ui/phase-07/journal.md` (append `# EXTERNAL RESPONSE` under `## Implementation Response`).
- Read-only / Forbidden: do not edit `PLAN.md`, `DESIGN.md`, `.handover.md`, `prompt.md`, other phases, or secrets. Do not read `snapshot/`. Do not commit; the Coordinator owns Git.

## Done When
- Every task and task-0 GREEN; every Acceptance Criterion holds; every Verification Check passes fresh from `/home/ngosi/projects/markdown-reader` (run `pnpm build` before playwright if needed). Record exit codes, counts, and lint warning count in notes.

## Rules
Read and follow these bundled contracts:
- Contract: `/home/ngosi/projects/refract/plugin/shared/worker-contract.md`
- Response: `/home/ngosi/projects/refract/plugin/shared/erp.md`
- Notes: `/home/ngosi/projects/refract/plugin/shared/notes-template.md`
- Journal: `/home/ngosi/projects/refract/plugin/shared/journal-template.md`

Role boundary: You are the phase implementer, not Coordinator. Edit code only in `/home/ngosi/projects/markdown-reader`; write phase records only under `/home/ngosi/projects/markdown-reader/docs/plans/reference-parity-ui/phase-07/`. Leave Coordinator skills, Git commits, and Refract job submission to the Coordinator.

## Response Format
Append the complete `# EXTERNAL RESPONSE` block to `/home/ngosi/projects/markdown-reader/docs/plans/reference-parity-ui/phase-07/journal.md`, then return that block and the matching status line from `erp.md`.
