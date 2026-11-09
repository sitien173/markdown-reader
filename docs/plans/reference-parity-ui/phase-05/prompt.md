# Phase 5: General tab

## Goal & Outcome
- Plan Goal: the popup, a new options page, and a reader dialog share one settings panel. Every setting persists in `storage.local` under `settings:v1`, reaches open reader tabs without reload, and drives render, theme, export, and auto-refresh.
- Phase Outcome: see **Goal** in the Phase Spec below.

## Context & Architecture
- Code root: `/home/ngosi/projects/markdown-reader` | Records root: same | Branch: `main` | Base: `refs/plans/reference-parity-ui/phase-05/base`
- Prior State: Phase 4 done. pnpm typecheck exit 0. pnpm lint exit 0 with 183 warnings. pnpm exec vitest run --maxWorkers=2 425/425 pass. pnpm test:e2e 126 pass.
- Code Context:
  - Stack: WXT 0.21.5 Chrome MV3 extension, React 19, TypeScript, Zustand, `zod/mini` (jitless), shadcn/ui on Base UI (base-nova), markdown-it 15.0.3, DOMPurify, Shiki, Mermaid, Vitest, Playwright, Biome, pnpm.
  - Settings: `src/lib/settings.ts` (`Settings` type with `general`, `appearance`, `plugins`; `defaultSettings`, `parseSettings`, `SETTINGS_KEY`). `src/store/settings-store.ts` `useSettingsStore` with `settings`, `load()`, `update(patch per section)`, `reset()`; settings changes reach reader tabs through its `storage.onChanged` listener. Strings via `t()`/`useT` from `src/i18n/index.ts`; add keys to `src/i18n/en-US.ts`.
  - Settings UI: `src/ui/settings/settings-panel.tsx` (rail + tabs), `general-tab.tsx`, `appearance-tab.tsx`, `plugins-tab.tsx` (full rows, derived All plugins), `about-tab.tsx`, `settings-dialog.tsx` (reader palette command `settings`). Row pattern: label and description left, control right; follow `plugins-tab.tsx`. Controls in `src/components/ui/` (switch, slider, select, textarea, button, dialog...).
  - Render: `src/render/pipeline.ts` `getMarkdownIt(config)` four-entry LRU keyed by `pluginKey`; `src/ui/markdown-view.tsx` takes `plugins` and `pluginKey`, fills `[[TOC]]` placeholders after paint.
  - Reader boot is async. In every e2e test that presses keys or clicks in the reader, first wait for React mount, for example `await page.locator('#root > *').first().waitFor()`.
  - Phase 4 delivered `src/lib/appearance.ts` (`applyAppearance`, root `data-theme`), `src/lib/custom-css.ts`, Zen merged into `reader-store` `focusMode`, export carrying Appearance. `general-tab.tsx` currently shows the open row, recents (max 5), disabled Language select, Reset with `role="alert"` errors, and a file-access dialog.
  - IMPORTANT invariant from Phase 1: do not import Zod (directly or through `src/lib/settings.ts`, which imports `zod/mini`) into `src/entrypoints/background.ts` or `src/entrypoints/detect.content.ts`. Where the Phase Spec says `readSettings()` for those two entrypoints, instead add a plain Zod-free helper, for example `src/lib/settings-flags.ts` exporting `readGeneralFlags()` that reads `browser.storage.local.get(SETTINGS_KEY)` and returns `{ enabled, renderTxt, charsetCompat }` with `typeof` checks and the same defaults as `defaultSettings` (enabled true, renderTxt false, charsetCompat false). Import `SETTINGS_KEY` without pulling Zod: move the constant into the new Zod-free module and re-export it from `settings.ts` so the key literal `settings:v1` still appears exactly once in source. Creating that file and a unit test for it is allowed. Verify with a build that the background and content script bundles in `.output/chrome-mv3/` contain no `zod` code (for example grep for `ZodError` or `zod`), and record the result in notes.
  - `tests/e2e/fixtures.ts` provides `startFixtureServer`. Verify `browser.extension.isAllowedFileSchemeAccess()` against Chrome extension docs before use (`npx ctx7@latest` or official docs) and record the source in notes.
  - The "Auto-refresh web pages" setting is `general.autoRefreshRemote` (default Off); the interval is `general.autoRefreshIntervalSec` (default 1, clamp 0.5..600); auto-refresh is `general.autoRefresh` (default true).
  - Resolution numbers refer to `docs/plans/reference-parity-ui/DESIGN.md`; read DESIGN General rows, Settings Behavior, and Resolutions before task-1.

## Phase Spec (verbatim from PLAN.md; Files list is the allowed edit set)

**Phase Request:** Make the General tab functional for enablement, `.txt` rendering, auto-refresh, charset compatibility, and the Local file access state. Use cases: (a) a user turns Enable off and auto-redirect stops while the popup actions still work. (b) A user turns Render .txt on and opens a `.txt` file that is `text/plain`. (c) A local file changes on disk and the reader updates within the interval. (d) A user with a dirty draft sees the external-change banner and the draft stays. (e) With Auto-refresh web pages on, an http(s) document updates after a server change. With it off, no poll request is sent. A `304` or network error keeps the current text. (f) A `windows-1252` file renders correctly when Charset compatibility is on. (g) The Local file access row shows the live state and opens the existing file-access dialog on click.
**Goal:** Every General row in DESIGN works, and the reader keeps unsaved edits in every refresh path.
**Depends on:** Phase 4
**Invariants & Boundaries:** Manual open, render, and the context menu still work when Enable is off. Auto-refresh for file URLs, picked files, and folders reuses `src/source/watch.ts`. Existing 1 s polling for `file:` stays the default. http(s) polling runs only when `general.autoRefreshRemote` is on, which defaults Off. It uses `max(interval, 5 s)`, conditional requests with `If-None-Match` or `If-Modified-Since`, and exponential backoff on repeated failure. Charset bypass for `file:` uses decoded bytes, not captured page text. No new manifest permission. The `.txt` redirect happens only when `contentType` is `text/plain`.
**Files:**
- Modify: `src/entrypoints/detect.content.ts`
- Modify: `src/entrypoints/background.ts`
- Modify: `src/source/url.ts`
- Modify: `src/source/watch.ts`
- Create: `src/source/decode.ts`
- Modify: `src/reader/controller.ts`
- Modify: `src/ui/settings/general-tab.tsx`
- Create: `tests/unit/charset.test.ts`
- Create: `tests/unit/auto-refresh.test.ts`
- Create: `tests/e2e/general.spec.ts`
- Modify: `tests/unit/detect.test.ts`
- Modify: `tests/unit/background.test.ts`
- Modify: `tests/unit/watch.test.ts`
- Modify: `tests/unit/controller.test.ts`
**Tasks:**
1. Enable and `.txt`. RED: `tests/unit/detect.test.ts` asserts that `shouldRedirectMarkdown` returns false when Enable is off and when the content type is `text/plain` with a `.txt` path but Render .txt is off. It asserts true for `text/plain` plus `.txt` when on. `tests/unit/background.test.ts` asserts that `isMarkdownLink` accepts `.txt` only when on. GREEN: add `*://*/*.txt` and `file:///*.txt` to the `matches` array in `detect.content.ts`. `detect.content.ts` reads settings with `readSettings()` inside its handler. `background.ts` reads the flag inside `isMarkdownLink` and `isValidCapture`.
2. Charset. RED: `tests/unit/charset.test.ts` asserts the order: BOM, strict UTF-8, HTTP `charset`, then `windows-1252`. It asserts that a UTF-8 file with an invalid byte falls through to `windows-1252`. It asserts that `file:` bypasses captured text when the setting is on. GREEN: `src/source/decode.ts` exports `decodeBytes(bytes: Uint8Array, httpCharset?: string)` built on `TextDecoder` with `fatal: true`. `url.ts` reads `arrayBuffer()` only when the setting is on. Off keeps `text()`.
3. Auto-refresh. RED: `tests/unit/auto-refresh.test.ts` asserts that the interval clamps to 0.5 to 600 s, that no http(s) poll starts while `general.autoRefreshRemote` is off, that an http(s) interval below 5 s runs at 5 s, that a `304` keeps the current text, that a network error keeps current text and doubles the delay up to a cap, and that a dirty draft shows the external-change banner and does not replace the draft. GREEN: `watch.ts` adds an http(s) poller that stores `ETag` and `Last-Modified` and sends conditional headers. `controller.ts` checks the dirty draft before any reload and sets `externalChange` instead of overwriting.
4. General rows. RED: `tests/e2e/general.spec.ts` asserts Enable off stops auto-redirect of a `.md` tab while the popup Render current tab still works. It asserts that Render .txt on renders a `.txt` served by `startFixtureServer` from `tests/e2e/fixtures.ts`. It asserts the Local file access row shows the live state of `browser.extension.isAllowedFileSchemeAccess()` after the API is verified in Chrome docs. It asserts that clicking the row opens the file-access dialog. GREEN: `general-tab.tsx` renders Enable, Local file access, Breaks bound to `plugins.breaks`, Render .txt, Auto-refresh switch, Auto-refresh web pages switch, Auto-refresh interval slider with number field, and Charset compatibility. Outline collapsing is not rendered here.
**Acceptance Criteria:**
- `pnpm exec playwright test tests/e2e/general.spec.ts` passes.
- With Enable off, a `.md` URL opened in the browser is not redirected. Opening the reader from the popup still renders it.
- With Render .txt on, a `text/plain` `.txt` document renders as Markdown. With it off, the same URL is not redirected.
- A file changed on disk shows in the reader within the configured interval when auto-refresh is on, and does not change when it is off.
- A dirty draft receives the external-change banner after a disk change, and the draft text is unchanged.
- With default settings, an open http(s) document sends no poll request. With Auto-refresh web pages on, an http(s) document with a `304` response keeps its text. A `500` response keeps the text and backs off.
- A `windows-1252` fixture decodes to the expected characters when charset compatibility is on.
**Reviewer Checklist:**
- Dirty-draft overwrite. Confirm that no refresh path assigns the store text while a draft is dirty.
- Polling timers stop on unmount and on source change. Confirm `watch.test.ts` checks the cleanup.
- Conditional request headers do not leak to cross-origin URLs. Confirm `fetch` options.
- `.txt` redirect does not match a `text/plain` response for a non-`.txt` path.
- `matches` changes in `detect.content.ts` do not require new host permissions.
- The Local file access row does not request the permission. It only reads state.
- Charset bypass applies only to `file:` sources. Confirm the http path is not bypassed.
**Verification Checks:**
- `pnpm typecheck`
- `pnpm lint`
- `pnpm exec vitest run --maxWorkers=2`
- `pnpm exec playwright test tests/e2e/general.spec.ts`
- `pnpm test:e2e`

## Boundaries
- Allowed edits: the Files list above, `src/i18n/en-US.ts`, `src/lib/settings.ts` (only to move `SETTINGS_KEY`), and the Zod-free settings helper with its unit test described in Code Context. If a changed signature forces a type-only update in another test file, make it and record it in notes. Do not add dependencies unless the Files list includes `package.json`.
- Lint warnings stay at or below the Prior State count.
- Worker-owned phase records: `/home/ngosi/projects/markdown-reader/docs/plans/reference-parity-ui/phase-05/notes.md` (append `## Task <M>` blocks) and `/home/ngosi/projects/markdown-reader/docs/plans/reference-parity-ui/phase-05/journal.md` (append `# EXTERNAL RESPONSE` under `## Implementation Response`).
- Read-only / Forbidden: do not edit `PLAN.md`, `DESIGN.md`, `.handover.md`, `prompt.md`, other phases, or secrets. Do not read `snapshot/`. Do not commit; the Coordinator owns Git.

## Done When
- Every task GREEN; every Acceptance Criterion holds; every Verification Check passes fresh from `/home/ngosi/projects/markdown-reader` (run `pnpm build` before playwright if needed). Record exit codes, counts, and lint warning count in notes.

## Rules
Read and follow these bundled contracts:
- Contract: `/home/ngosi/projects/refract/plugin/shared/worker-contract.md`
- Response: `/home/ngosi/projects/refract/plugin/shared/erp.md`
- Notes: `/home/ngosi/projects/refract/plugin/shared/notes-template.md`
- Journal: `/home/ngosi/projects/refract/plugin/shared/journal-template.md`

Role boundary: You are the phase implementer, not Coordinator. Edit code only in `/home/ngosi/projects/markdown-reader`; write phase records only under `/home/ngosi/projects/markdown-reader/docs/plans/reference-parity-ui/phase-05/`. Leave Coordinator skills, Git commits, and Refract job submission to the Coordinator.

## Response Format
Append the complete `# EXTERNAL RESPONSE` block to `/home/ngosi/projects/markdown-reader/docs/plans/reference-parity-ui/phase-05/journal.md`, then return that block and the matching status line from `erp.md`.
