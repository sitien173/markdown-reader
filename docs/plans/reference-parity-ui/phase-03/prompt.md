# Phase 3: Configurable render pipeline and Plugins tab

## Goal & Outcome
- Plan Goal: the popup, a new options page, and a reader dialog share one settings panel. Every setting persists in `storage.local` under `settings:v1`, reaches open reader tabs without reload, and drives render, theme, export, and auto-refresh.
- Phase Outcome: the parser instance depends on a plugin config. Render, prefix, block planning, and the Mermaid fence use the same instance. Every plugin in DESIGN Settings Behavior has a Plugins-tab row and an effect. Phase 2 review debt is fixed.

## Context & Architecture
- Code root: `/home/ngosi/projects/markdown-reader` | Records root: same | Branch: `main` | Base: `refs/plans/reference-parity-ui/phase-03/base`
- Prior State: Phase 2 done. `pnpm typecheck` exit 0. `pnpm lint` exit 0 with 188 warnings. `pnpm exec vitest run --maxWorkers=2` 347/347 pass. `pnpm test:e2e` 102 pass.
- Code Context:
  - Stack: WXT 0.21.5 Chrome MV3 extension, React 19, TypeScript, Zustand, `zod/mini` (jitless), shadcn/ui on Base UI (base-nova), markdown-it 15.0.3, DOMPurify sanitizer, Vitest, Playwright, Biome, pnpm.
  - Settings: `src/lib/settings.ts` (`Settings` type; `plugins` section booleans `linkify`, `emoji`, `superscript`, `subscript`, `mark`, `katex`, `mermaid`, `abbreviation`, `definitionList`, `footnote`, `taskList`, `alert`, `typographer`, `breaks`, `toc`, `insert`, `frontMatter`, `multimdTable`). `src/store/settings-store.ts` `useSettingsStore` with `settings`, `load()`, `update(patch per section)`, `reset()`. Strings through `t()`/`useT` from `src/i18n/index.ts`; add keys to `src/i18n/en-US.ts`.
  - Settings UI: `src/ui/settings/settings-panel.tsx` with tabs; `plugins-tab.tsx` is currently only an H2. Row pattern: see `general-tab.tsx` (label and description left, control right). Controls: `src/components/ui/switch.tsx` etc.
  - Reader boot is async. In every e2e test that presses keys or clicks in the reader, first wait for React mount, for example `await page.locator('#root > *').first().waitFor()`. Popup and options pages await settings load before rendering.
  - Settings changes reach reader tabs through the store's `storage.onChanged` listener.

## Invariants & Boundaries
- `render(text, baseUrl)` keeps its two-argument form. A default config argument reproduces the pre-plan parser; `tests/unit/pipeline.test.ts` passes unchanged with default settings.
- The four-entry LRU is keyed by a stable string built from the config. `src/ui/markdown-view.tsx` joins that key to every block key and to the reset condition; reset incremental `parseState` on a plugin-key change.
- Sanitizer gains only `ins`, `caption`, `colspan`, and `rowspan`. `style` and `on*` stay blocked.
- No new network request. Out of scope: PlantUML, gear sub-settings.
- Lint warnings stay at or below 188.

## Files
Allowed production and test paths:
- `package.json`, `pnpm-lock.yaml` (add `markdown-it-ins` and `markdown-it-multimd-table` at verified versions via `pnpm add`; nothing else)
- `src/render/pipeline.ts`, `src/render/plugins.d.ts`, `src/render/sanitize.ts`, `src/ui/markdown-view.tsx`, `src/entrypoints/reader/App.tsx`, `src/ui/settings/plugins-tab.tsx`, `src/i18n/en-US.ts` (modify)
- `src/render/local-rules.ts` (create)
- `src/store/settings-store.ts`, `src/ui/settings/general-tab.tsx`, `tests/unit/settings-store.test.ts`, `tests/unit/settings-panel.test.tsx` (modify: task-0 debt only)
- `tests/unit/pipeline-config.test.ts`, `tests/unit/local-rules.test.ts`, `tests/fixtures/markdown/toc-plugins.md`, `tests/fixtures/large-100kb-toc.md`, `tests/e2e/plugins.spec.ts` (create)
- `tests/unit/sanitize.test.ts`, `tests/unit/pipeline.test.ts` (no assertion changes), `tests/unit/reader-render.test.tsx`, `tests/e2e/perf.spec.ts` (modify)
- If a changed signature forces a type-only update in another test file, record it in notes.

Worker-owned phase records:
- `/home/ngosi/projects/markdown-reader/docs/plans/reference-parity-ui/phase-03/notes.md` (append `## Task <M>` blocks)
- `/home/ngosi/projects/markdown-reader/docs/plans/reference-parity-ui/phase-03/journal.md` (append `# EXTERNAL RESPONSE` under `## Implementation Response`)

Read-only / Forbidden:
- Do not edit `PLAN.md`, `DESIGN.md`, `.handover.md`, `prompt.md`, other phases, or secrets. Do not read `snapshot/`. Do not commit; the Coordinator owns Git.

## Tasks
- task-0: Phase 2 review debt. RED tests first.
  (a) `src/store/settings-store.ts`: the onChanged echo guard drops a pending key as soon as `storage.local.set` resolves, so an echo delivered after that can overwrite a later write. Ignore echoes older than the latest local write, for example with a per-write sequence or by removing the key only when its own echo arrives, with a fallback. Add a stub variant that fires onChanged after `set` resolves.
  (b) Guard `pendingWrites.splice` against `indexOf` returning -1.
  (c) A successful `load()` must not overwrite newer state: record `get().settings` at start and `set` only if it is unchanged.
  (d) `reset()` rolls back on write rejection like `update()`.
  (e) `src/ui/settings/general-tab.tsx`: build the language option label with `t('settings.general.languageEnglish')`. Wrap the confirm-reset call in try/catch, close the dialog, and show the error in the existing `role="alert"` paragraph.
  (f) `tests/unit/settings-panel.test.tsx`: stub `getRecentUrls` with 7 URLs and assert 5 recent buttons render, newest first.
  Keep the `manifest.open_in_tab` meta tag in `src/entrypoints/options/index.html`: WXT overrides the config value without it.
- task-1: Parser instance cache. Before installing, verify `markdown-it-ins` and `markdown-it-multimd-table` peer ranges against `markdown-it` 15.0.3 with `pnpm view <pkg> peerDependencies` and the package README; record versions in notes. RED: `tests/unit/pipeline-config.test.ts` asserts that each boolean plugin off removes its effect: `:emoji:`, `H~2~`, `x^2^`, `==mark==`, abbreviation, definition list, footnote, task list, and a github alert. It asserts KaTeX off leaves `$x$` as text, Mermaid off produces no `pre.mermaid` (source stays a code block), and linkify off leaves a bare URL unlinked. It asserts the cache holds at most 4 instances (call `getMarkdownIt` with five distinct configs) and that two configs with equal settings return the same instance. GREEN: `getMarkdownIt(config)` in `src/render/pipeline.ts` builds the instance from the config. KaTeX is gated by not calling `md.use(katex)`. Mermaid is gated inside the fence rule. Typographer, breaks, and linkify are `MarkdownIt` options.
- task-2: Local rules. RED: `tests/unit/local-rules.test.ts` asserts that `[[TOC]]` emits an empty placeholder with a `data-toc-placeholder` attribute and that a document with no headings produces an empty placeholder. It asserts front matter matches only at offset 0 of the full document and only when closed; an unclosed opening `---` renders as text; a mid-document `---` block does not match; a file beginning with a thematic break followed by text does not become front matter. GREEN: `src/render/local-rules.ts` exports `tocPlaceholderRule` and `frontMatterRule`, installed only when the TOC and Front matter settings are on. `src/ui/markdown-view.tsx` fills each placeholder after every paint (including prefix and progressive paths) with HTML built from `buildToc` in `src/toc/toc.ts`, reading `headings` from the plan. Front matter renders as a compact metadata table through the existing sanitizer.
- task-3: Sanitizer and table plugin. RED: `tests/unit/sanitize.test.ts` asserts `ins`, `caption`, `colspan`, `rowspan` survive, and `onerror`, `style` on `ins`, and `javascript:` hrefs still do not. `pipeline-config.test.ts` asserts a multi-markdown table with `colspan` renders, and that the core `table` rule is disabled when the setting is on and restored when off. GREEN: `src/render/plugins.d.ts` declares both modules. `pipeline.ts` adds `ins` through `markdown-it-ins` and multimd table through its default export, disabling core `table` only in that case. `sanitize.ts` adds the four names to the allowlist. Keep `ADD_ATTR` changes narrow.
- task-4: Block keys, reset, Plugins rows, and perf. RED: `tests/unit/reader-render.test.tsx` asserts that changing one plugin flag replaces every mounted block, and that a `planBlocks` key differs when the plugin key differs. `tests/e2e/perf.spec.ts` gets a new test named `S3 with all plugins on and a [[TOC]] document` using `tests/fixtures/large-100kb-toc.md` (median per-keystroke under 100 ms) and a new test named `S4 with all plugins on` (first content under 500 ms). Record parser build time on a toggle change in the perf output. `tests/e2e/plugins.spec.ts`: with all plugins on, `tests/fixtures/markdown/toc-plugins.md` renders a TOC list, a metadata table, an `ins` element, a multi-markdown table, KaTeX, and a Mermaid pre block; turning one plugin off and back on in the popup changes the reader output within one storage event; the All plugins switch turns every plugin on or off and reflects derived state. GREEN: `markdown-view.tsx` takes a `pluginKey` prop, prefixes it to every key from `planBlocks` and `planPrefix`, and includes it in the reset condition. Reader `App.tsx` passes config from the store. `plugins-tab.tsx` renders the rows from DESIGN with All plugins derived. The Breaks row binds to `plugins.breaks`.

## Done When
- All tasks GREEN and the acceptance criteria above hold.
- Run from `/home/ngosi/projects/markdown-reader`:
  - `pnpm typecheck` (Baseline: exit 0)
  - `pnpm lint` (Baseline: exit 0, 188 warnings; target warnings at most 188)
  - `pnpm exec vitest run --maxWorkers=2` (Baseline: 347/347 pass)
  - `pnpm exec playwright test tests/e2e/plugins.spec.ts tests/e2e/perf.spec.ts` (after `pnpm build` if needed)
  - `pnpm test:e2e` (Baseline: 102 pass)

## Rules
Read and follow these bundled contracts:
- Contract: `/home/ngosi/projects/refract/plugin/shared/worker-contract.md`
- Response: `/home/ngosi/projects/refract/plugin/shared/erp.md`
- Notes: `/home/ngosi/projects/refract/plugin/shared/notes-template.md`
- Journal: `/home/ngosi/projects/refract/plugin/shared/journal-template.md`

Role boundary: You are the phase implementer, not Coordinator. Edit code only in `/home/ngosi/projects/markdown-reader`; write phase records only under `/home/ngosi/projects/markdown-reader/docs/plans/reference-parity-ui/phase-03/`. Leave Coordinator skills, Git commits, and Refract job submission to the Coordinator.

## Response Format
Append the complete `# EXTERNAL RESPONSE` block to `/home/ngosi/projects/markdown-reader/docs/plans/reference-parity-ui/phase-03/journal.md`, then return that block and the matching status line from `erp.md`.
