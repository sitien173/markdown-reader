# Phase 1: Settings foundation

## Goal & Outcome
- Plan Goal: the popup, a new options page, and a reader dialog share one settings panel. Every setting persists in `storage.local` under `settings:v1`, reaches open reader tabs without reload, and drives render, theme, export, and auto-refresh.
- Phase Outcome: one validated `settings:v1` object, one Zustand store, and a `t()` dictionary, with the reader loading settings before its first render. No settings UI ships in this phase.

## Context & Architecture
- Code root: `/home/ngosi/projects/markdown-reader` | Records root: `/home/ngosi/projects/markdown-reader` | Branch: `main` | Base: `refs/plans/reference-parity-ui/phase-01/base`
- Prior State: baseline at plan base. `pnpm typecheck` exit 0. `pnpm lint` exit 1 only because Biome formats `.tgrep/meta.json`, a search-index file outside git; 188 warnings. `pnpm exec vitest run --maxWorkers=2` 313/313 pass. `pnpm test:e2e` 97 pass.
- Code Context:
  - Stack: WXT 0.21.5 Chrome MV3 extension, React 19, TypeScript, Zustand, `zod/mini` (jitless), Vitest, Playwright, Biome, pnpm.
  - `src/lib/zod-config.ts` sets `z.config({ jitless: true })`; import it before any schema module. `src/lib/schemas.ts` shows the house style: `import './zod-config'; import * as z from 'zod/mini';`.
  - Existing stores in `src/store/` (`reader-store.ts`, `drafts.ts`, `recent.ts`, `handles.ts`). Drafts save to `storage.local` about every 1 s under `drafts:*` keys; that is why the settings listener must filter on the exact key.
  - `src/entrypoints/reader/main.tsx` calls `createRoot(root).render(...)` synchronously today.
  - `src/entrypoints/background.ts` line 19 creates the context menu with literal title `Open in Markdown Reader`.
  - Existing tests in `tests/unit/` use Vitest with fakes for `browser.storage`; follow `tests/unit/background.test.ts` and `tests/unit/drafts.test.ts` patterns.

### Settings fields (from DESIGN Settings Behavior)
Layout `{ version: 1, general: {...}, appearance: {...}, plugins: {...} }`. Defaults:
- general: `enabled` true, `outlineCollapsing` false, `renderTxt` false, `autoRefresh` true, `autoRefreshRemote` false, `autoRefreshIntervalSec` 1 (clamp 0.5 to 600), `charsetCompat` false, `language` `'en-US'` (only allowed value).
- appearance: `textSize` step 1..6 default 3, `font` `'default' | 'serif' | 'sans' | 'mono'` default `'default'`, `theme` `'auto' | 'light' | 'dark'` default `'auto'`, `codeThemeLight` `'light' | 'dark'` default `'light'`, `codeThemeDark` `'light' | 'dark'` default `'dark'`, `wrapCode` false, `wideTables` false, `zen` false, `centered` true, `customMaxWidth` false, `maxWidthPx` 1000 (clamp 500 to 3000), `customCssEnabled` false, `customCss` `''` (string; values above 65536 characters rejected and defaulted; `null` falls back to `''` without throwing).
- plugins (booleans): `linkify`, `emoji`, `superscript`, `subscript`, `mark`, `katex`, `mermaid`, `abbreviation`, `definitionList`, `footnote`, `taskList`, `alert` default true; `typographer` false; `breaks` false; `toc`, `insert`, `frontMatter`, `multimdTable` default true. `breaks` lives only at `plugins.breaks`.
- Resolution 1 (user confirmed): the four new syntaxes `toc`, `insert`, `frontMatter`, `multimdTable` default On. Resolution 2: http(s) polling is the separate `general.autoRefreshRemote`, default Off.

## Invariants & Boundaries
- Preserve: draft, recent, and handle `storage.local` keys and formats. Context-menu title string unchanged. Every existing render output unchanged. Keyboard shortcuts unchanged. Manifest unchanged.
- Do not add a Zod import to `src/entrypoints/background.ts` or `src/entrypoints/detect.content.ts`. They read the context-menu string through `t()` only, which must not pull Zod in. If `readSettings()` is ever needed there, it must be a plain helper; not required this phase.
- Storage key literal `settings:v1` appears exactly once in source, as `SETTINGS_KEY` in `src/lib/settings.ts`. Other modules import it.
- Out of Scope: any popup change, any settings UI, any new manifest key, any new dependency.

## Files
Allowed production and test paths:
- `biome.json` (modify: add `"!**/.tgrep"` to `files.includes`)
- `src/lib/settings.ts` (create: `SETTINGS_KEY`, `settingsSchema`, `defaultSettings`, `parseSettings(raw: unknown)`, `readSettings()`, `Settings` type)
- `src/store/settings-store.ts` (create: Zustand store with `settings`, `load()`, `update(patch)`, `reset()`)
- `src/i18n/en-US.ts` (create: typed `as const` dictionary)
- `src/i18n/index.ts` (create: `t`, `useT`, `applyLanguage`)
- `src/entrypoints/reader/main.tsx` (modify: await `useSettingsStore.getState().load()` and `applyLanguage` before `createRoot`)
- `src/entrypoints/background.ts` (modify: context-menu title through `t('contextMenu.open')`)
- `tests/unit/settings.test.ts` (create)
- `tests/unit/settings-store.test.ts` (create)
- `tests/unit/i18n.test.ts` (create)
- `tests/unit/background.test.ts` (modify: assert title unchanged)
- A unit test verifying reader boot order may live in `tests/unit/settings-store.test.ts` or a new `tests/unit/reader-boot.test.ts` (create allowed).

Worker-owned phase records:
- `/home/ngosi/projects/markdown-reader/docs/plans/reference-parity-ui/phase-01/notes.md` (append `## Task <M>` blocks)
- `/home/ngosi/projects/markdown-reader/docs/plans/reference-parity-ui/phase-01/journal.md` (append `# EXTERNAL RESPONSE` under `## Implementation Response`)

Read-only / Forbidden:
- Do not edit `PLAN.md`, `DESIGN.md`, `.handover.md`, `prompt.md`, other phases, dependencies, `package.json`, `pnpm-lock.yaml`, or secrets. Do not read `snapshot/`. Do not commit; the Coordinator owns Git.

## Tasks
- task-1: Baseline repair. RED: `pnpm lint` exits 1. GREEN: add `"!**/.tgrep"` to `files.includes` in `biome.json`. Re-run `pnpm lint`; record exit code and warning count. No rule downgrades.
- task-2: Schema. RED: `tests/unit/settings.test.ts` asserts defaults, `version: 1`, the field list above, per-field fallback for a corrupt `plugins.linkify` and a non-number `general.autoRefreshIntervalSec`, clamping of the interval to 0.5..600 and max width to 500..3000, `customCss` rejection above 65536 characters, and `customCss: null` not throwing. Verify the Zod 4 mini API for `z.catch` (and clamping approach) against docs (`npx ctx7@latest library Zod "zod mini catch"` then `docs`) before using it. GREEN: implement `src/lib/settings.ts`. `readSettings()` reads `browser.storage.local.get(SETTINGS_KEY)` and returns `parseSettings`.
- task-3: Store. RED: `tests/unit/settings-store.test.ts` with fake `storage.local` and fake `storage.onChanged` asserts a change under `settings:v1` in area `local` updates the store; a change under `drafts:x` or any other key, or another area, does not call `set`; `reset()` writes defaults; `update(patch)` deep-merges per section and writes. GREEN: `src/store/settings-store.ts`. `load()` runs once (idempotent; second call reuses the first promise). Listener checks `area === 'local'` and `changes[SETTINGS_KEY]`.
- task-4: i18n and reader boot. RED: `tests/unit/i18n.test.ts` asserts `t('contextMenu.open')` returns `Open in Markdown Reader` and `applyLanguage('en-US')` sets `document.documentElement.lang` to `en-US`. `tests/unit/background.test.ts` asserts the context-menu title still equals `Open in Markdown Reader`. A unit test records call order and asserts the reader first render happens after `load()` resolves (extract a small exported boot function if needed). GREEN: dictionary, `t`, `useT`, `applyLanguage`; background reads title through `t()`; reader `main.tsx` awaits load then applies language then renders.

## Done When
- `pnpm lint` exits 0 with at most 188 warnings.
- `tests/unit/settings.test.ts` passes and covers each field fallback named in task-2.
- Writing `settings:v1` to a stub `storage.local` changes the store within one event. Writing `drafts:x` does not.
- Reader first render happens after `load()` resolves, proven by a unit test that records call order.
- With no stored settings, the context-menu title and every existing render output are unchanged.
- Run from `/home/ngosi/projects/markdown-reader`:
  - `pnpm typecheck` (Baseline: exit 0)
  - `pnpm lint` (Baseline: exit 1 from `.tgrep`; target exit 0, warnings at most 188)
  - `pnpm exec vitest run --maxWorkers=2` (Baseline: 313/313 pass)
  - `pnpm test:e2e` (Baseline: 97 pass)

## Rules
Read and follow these bundled contracts:
- Contract: `/home/ngosi/projects/refract/plugin/shared/worker-contract.md`
- Response: `/home/ngosi/projects/refract/plugin/shared/erp.md`
- Notes: `/home/ngosi/projects/refract/plugin/shared/notes-template.md`
- Journal: `/home/ngosi/projects/refract/plugin/shared/journal-template.md`

Role boundary: You are the phase implementer, not Coordinator. Edit code only in `/home/ngosi/projects/markdown-reader`; write phase records only under `/home/ngosi/projects/markdown-reader/docs/plans/reference-parity-ui/phase-01/`. Leave Coordinator skills, Git commits, and Refract job submission to the Coordinator.

## Response Format
Append the complete `# EXTERNAL RESPONSE` block to `/home/ngosi/projects/markdown-reader/docs/plans/reference-parity-ui/phase-01/journal.md`, then return that block and the matching status line from `erp.md`.
