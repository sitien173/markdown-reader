# Phase 6: Reader shell

## Goal & Outcome
- Plan Goal: the popup, a new options page, and a reader dialog share one settings panel. Every setting persists in `storage.local` under `settings:v1`, reaches open reader tabs without reload, and drives render, theme, export, and auto-refresh.
- Phase Outcome: see **Goal** in the Phase Spec below. Prior review debt (task-0) is fixed.

## Context & Architecture
- Code root: `/home/ngosi/projects/markdown-reader` | Records root: same | Branch: `main` | Base: `refs/plans/reference-parity-ui/phase-06/base`
- Prior State: Phase 5 done. pnpm typecheck exit 0. pnpm lint exit 0 with 183 warnings. pnpm exec vitest run --maxWorkers=2 469/469 pass. pnpm test:e2e 134 pass.
- Code Context:
  - Stack: WXT 0.21.5 Chrome MV3 extension, React 19, TypeScript, Zustand, `zod/mini` (jitless), shadcn/ui on Base UI (base-nova), markdown-it 15.0.3, DOMPurify, Shiki, Mermaid, Vitest, Playwright, Biome, pnpm.
  - Settings: `src/lib/settings.ts` (`Settings` type with `general`, `appearance`, `plugins`; `defaultSettings`, `parseSettings`, `SETTINGS_KEY`). `src/store/settings-store.ts` `useSettingsStore` with `settings`, `load()`, `update(patch per section)`, `reset()`; settings changes reach reader tabs through its `storage.onChanged` listener. Strings via `t()`/`useT` from `src/i18n/index.ts`; add keys to `src/i18n/en-US.ts`.
  - Settings UI: `src/ui/settings/settings-panel.tsx` (rail + tabs), `general-tab.tsx`, `appearance-tab.tsx`, `plugins-tab.tsx` (full rows, derived All plugins), `about-tab.tsx`, `settings-dialog.tsx` (reader palette command `settings`). Row pattern: label and description left, control right; follow `plugins-tab.tsx`. Controls in `src/components/ui/` (switch, slider, select, textarea, button, dialog...).
  - Render: `src/render/pipeline.ts` `getMarkdownIt(config)` four-entry LRU keyed by `pluginKey`; `src/ui/markdown-view.tsx` takes `plugins` and `pluginKey`, fills `[[TOC]]` placeholders after paint.
  - Reader boot is async. In every e2e test that presses keys or clicks in the reader, first wait for React mount, for example `await page.locator('#root > *').first().waitFor()`.
  - Phase 5 delivered the General tab: `src/lib/settings-flags.ts` (Zod-free `SETTINGS_KEY`, `readGeneralFlags`), `src/source/decode.ts`, http(s) conditional polling in `src/source/watch.ts`, and dirty-draft protection in `src/reader/controller.ts`. Do not import Zod into `background.ts` or `detect.content.ts`.
  - Commands: `src/reader/commands.ts` exports `CommandId` and the registry; `focus-mode` currently has label `Focus mode` and `settings` opens the settings dialog. Toasts: `notifyToast` and `Toaster` from `src/components/ui/toast.tsx`, already mounted in `App.tsx`. Menu primitive: `src/components/ui/dropdown-menu.tsx` (Base UI Menu). Segmented control: `toggle-group.tsx`. Radio group: `radio-group.tsx`. About content: `src/ui/settings/about-tab.tsx`, reuse it in `about-dialog.tsx`.
  - Outline collapsing (PLAN Resolution/decision 4 near PLAN.md line 31): the schema field `general.outlineCollapsing` (default false) exists; its General tab row and behavior land in this phase. Editing `src/ui/settings/general-tab.tsx` to add that one row (and its i18n strings) is allowed.
  - `App.tsx` Escape handling checks for open `[role="dialog"]` and `[role="menu"]`; keep the new menu and About dialog compatible with it.
  - Resolution numbers refer to `docs/plans/reference-parity-ui/DESIGN.md`; read DESIGN Reader shell section (sidebar, content column, menu groups) and Resolutions before task-1.

## Phase Spec (verbatim from PLAN.md; Files list is the allowed edit set, plus task-0 files below)

**Phase Request:** Replace the reader's top bar in read mode with a sidebar, floating controls, and a menu, and add the outline and code block features. Use cases: (a) a user filters the Files list by typing in the search field. (b) A user collapses a heading with children in the Outline. (c) A user scrolls and the matching outline heading highlights. (d) A user opens the floating menu and chooses Toggle Raw, Toggle Fullscreen, Print or Export HTML, Open file, Open folder, Open URL, Command palette, Setting, or About. (e) A user copies a code block with one click. (f) A user hovers a heading and copies its `#` permalink. (g) In edit or split mode, a compact header shows the title, the dirty dot, Save, and the Read, Edit, Split radio group.
**Goal:** The read mode layout matches DESIGN. Edit and split modes keep every existing action.
**Depends on:** Phase 5
**Invariants & Boundaries:** Existing shortcut bindings do not change. The `focus-mode` command is relabeled Zen mode. The menu and the Cmd+K palette both read the same command registry in `src/reader/commands.ts`. Radio semantics for the mode switch stay on `role="radio"` with `aria-checked`. The `aria-hidden` permalink does not appear in the accessibility tree. Code Copy uses `navigator.clipboard.writeText`. Phase 6 adds no permission.
**Files:**
- Modify: `src/entrypoints/reader/App.tsx`
- Modify: `src/reader/commands.ts`
- Modify: `src/ui/toc-panel.tsx`
- Modify: `src/ui/file-tree.tsx`
- Modify: `src/ui/toolbar.tsx`
- Modify: `src/render/enhance.ts`
- Modify: `src/store/reader-store.ts`
- Modify: `src/styles/reader.css`
- Create: `src/ui/reader-menu.tsx`
- Create: `src/ui/about-dialog.tsx`
- Create: `tests/e2e/reader-shell.spec.ts`
- Create: `tests/e2e/reader-modes.spec.ts`
- Modify: `tests/unit/commands.test.ts`
- Modify: `tests/unit/enhance.test.ts`
- Modify: `tests/e2e/shell.spec.ts`
- Modify: `tests/e2e/enhance.spec.ts`
**Tasks:**
1. Sidebar. RED: `tests/e2e/reader-shell.spec.ts` asserts that read mode has no top bar, a left sidebar about 260 px wide, a Files and Outline segmented control with named icons, and a search icon that reveals a filter field. It asserts that typing in the filter narrows the visible files. It asserts that the outline collapse toggle on a parent heading hides its children and that the default is off. GREEN: `toc-panel.tsx` renders nested headings with scroll-spy and collapse. `file-tree.tsx` takes a filter prop. `reader.css` sets the sidebar width. Outline collapsing reads `general.outlineCollapsing` from the settings store.
2. Commands. RED: `tests/unit/commands.test.ts` asserts that `toggle-raw`, `toggle-fullscreen`, `settings`, and `about` exist with labels, that `focus-mode` has label Zen mode, and that no new shortcut is bound. GREEN: add the four ids to `CommandId` in `commands.ts`. `settings` already exists from Phase 2. Add `about`, `toggle-raw`, and `toggle-fullscreen`. Keep existing bindings.
3. Floating controls. RED: `reader-shell.spec.ts` asserts a floating sidebar toggle at top left and a floating menu button at top right. It asserts the menu groups in DESIGN order. It asserts that copying a code block changes the button label to Copied and writes the text to the clipboard. It asserts a heading permalink is `aria-hidden` and that its target `href` is the heading id. GREEN: `reader-menu.tsx` uses Base UI Menu with groups. `enhance.ts` adds the language label and Copy button to `pre` blocks, and the permalink anchor to headings. `about-dialog.tsx` renders the About tab content with a close button.
4. Edit and split header. RED: `tests/e2e/reader-modes.spec.ts` asserts that edit mode shows the compact header with title, dirty dot after a change, Save, and a radiogroup with Read, Edit, and Split. It asserts that Toggle Raw switches read and edit. It asserts that a refused fullscreen request shows a toast. GREEN: `toolbar.tsx` renders the compact header in edit and split. Toggle Raw calls the mode command. Fullscreen uses `document.documentElement.requestFullscreen`. A rejection calls the existing toast.
**Acceptance Criteria:**
- In read mode, `tests/e2e/reader-shell.spec.ts` finds no element with role `toolbar` in the top area.
- The Files filter narrows the visible list by name. Clearing it restores the list.
- Outline collapse hides children only for headings that have children.
- The floating menu lists Toggle Raw, Toggle Fullscreen, Print or Export HTML, Open file, Open folder, Open URL, Command palette, Setting, and About in that order.
- Code Copy writes the exact code text. Verified by reading the clipboard in Playwright.
- Heading permalink anchors have `aria-hidden="true"`.
- Edit and split headers show a radiogroup with `aria-checked` on the active radio.
- A refused fullscreen request shows a toast with a message from `t()`.
**Reviewer Checklist:**
- The `aria-hidden` permalink is not focusable. Confirm `tabindex` is absent or `-1`.
- Scroll-spy observes headings that are rendered after an async TOC fill.
- Command registry is the single source for the menu and the palette. No duplicate label strings.
- Keyboard shortcuts for existing commands still match `commands.test.ts`.
- Copy button works when the clipboard API is refused. It shows a failure label and does not throw.
- Zen mode relabel does not change the `focus-mode` id.
- Edit mode dirty dot reads the store, not the DOM.
**Verification Checks:**
- `pnpm typecheck`
- `pnpm lint`
- `pnpm exec vitest run --maxWorkers=2`
- `pnpm exec playwright test tests/e2e/reader-shell.spec.ts tests/e2e/reader-modes.spec.ts tests/e2e/shell.spec.ts tests/e2e/enhance.spec.ts`
- `pnpm test:e2e`

## Task 0: prior review debt (do first, RED then GREEN)
Files for task-0: `src/source/url.ts`, `src/source/watch.ts`, `src/ui/settings/general-tab.tsx`, `src/i18n/en-US.ts`, `tests/unit/watch.test.ts`, `tests/unit/auto-refresh.test.ts`, and the existing url source unit test if one exists.
(a) `src/source/url.ts` `read()` uses the default fetch cache mode, so after the poller detects an http(s) change the reload can return a stale cached body while the poller has already advanced its baseline. Fetch with `cache: 'no-cache'` in `read()` (or hand the polled text to the reload). Add a unit test asserting the fetch option.
(b) `src/source/watch.ts` (~line 249) polls with `redirect: 'manual'`, so any redirecting document URL (http to https, GitHub `/raw/` to `raw.githubusercontent.com`) returns `opaqueredirect`, counts as failure, and backs off silently to 300 s. On `response.type === 'opaqueredirect'`, poll again with `redirect: 'follow'` and without `If-None-Match`/`If-Modified-Since`, and detect change by comparing the decoded text with the baseline. Validators must still never be sent to another origin. Add unit tests for a redirecting URL that changes and one that does not.
(c) `general.charsetCompat` applies only when a document is reopened. Update the Charset compatibility row description string in `en-US.ts` to say so.

## Boundaries
- Allowed edits: the Files list above, task-0 files, `src/i18n/en-US.ts`, and the Outline collapsing row in `src/ui/settings/general-tab.tsx`. If a changed signature forces a type-only update in another test file, make it and record it in notes. Do not add dependencies unless the Files list includes `package.json`.
- Lint warnings stay at or below the Prior State count.
- Worker-owned phase records: `/home/ngosi/projects/markdown-reader/docs/plans/reference-parity-ui/phase-06/notes.md` (append `## Task <M>` blocks) and `/home/ngosi/projects/markdown-reader/docs/plans/reference-parity-ui/phase-06/journal.md` (append `# EXTERNAL RESPONSE` under `## Implementation Response`).
- Read-only / Forbidden: do not edit `PLAN.md`, `DESIGN.md`, `.handover.md`, `prompt.md`, other phases, or secrets. Do not read `snapshot/`. Do not commit; the Coordinator owns Git.

## Done When
- Every task and task-0 GREEN; every Acceptance Criterion holds; every Verification Check passes fresh from `/home/ngosi/projects/markdown-reader` (run `pnpm build` before playwright if needed). Record exit codes, counts, and lint warning count in notes.

## Rules
Read and follow these bundled contracts:
- Contract: `/home/ngosi/projects/refract/plugin/shared/worker-contract.md`
- Response: `/home/ngosi/projects/refract/plugin/shared/erp.md`
- Notes: `/home/ngosi/projects/refract/plugin/shared/notes-template.md`
- Journal: `/home/ngosi/projects/refract/plugin/shared/journal-template.md`

Role boundary: You are the phase implementer, not Coordinator. Edit code only in `/home/ngosi/projects/markdown-reader`; write phase records only under `/home/ngosi/projects/markdown-reader/docs/plans/reference-parity-ui/phase-06/`. Leave Coordinator skills, Git commits, and Refract job submission to the Coordinator.

## Response Format
Append the complete `# EXTERNAL RESPONSE` block to `/home/ngosi/projects/markdown-reader/docs/plans/reference-parity-ui/phase-06/journal.md`, then return that block and the matching status line from `erp.md`.
