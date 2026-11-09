# Reference-Parity Settings, Reader Shell, and Render Plugins Plan

**Design:** [DESIGN.md](DESIGN.md)
**Context key:** `reference-parity-ui`
**Base:** `refs/plans/reference-parity-ui/base` (`9fde55581fe73a609a5f2949b2069a456bf09acc`)
**Commit:** `feat(ui): add reference-parity settings panel, reader shell, and render plugins`

## Outcome & Scope

Goal: make the popup, a new options page, and a reader dialog share one settings panel. Every setting persists in `storage.local` under `settings:v1`, reaches open reader tabs without reload, and drives the render pipeline, theme, export, and auto-refresh. The reader gains a sidebar, floating controls, code block labels, and heading permalinks. Layout and controls copy the reference snapshots. Visual tokens and branding do not.

Preserved invariants, every phase:

- DOMPurify sanitize on all rendered HTML. Generated ids keep the `user-content-` prefix from `src/render/user-content.ts`.
- Zero network requests from render and export. Mermaid stays CSP-safe.
- XSS fixtures in `tests/fixtures/markdown/xss.md` stay inert.
- Existing `storage.local` keys for drafts, recents, and handles keep their names and formats.
- Existing keyboard shortcut bindings in `src/reader/commands.ts` do not change. No new shortcuts.
- Manifest permissions stay `storage`, `contextMenus`, `tabs`, and host `<all_urls>`. Only `options_ui` and content-script `matches` change.
- New dependencies are limited to `markdown-it-ins` and `markdown-it-multimd-table`.
- S3 and S4 perf budgets stay: under 100 ms per keystroke and under 500 ms to first content.
- Stack stays: WXT 0.21.5, React 19.3.1, TypeScript 7.0.2, Tailwind v4, shadcn base-nova on `@base-ui/react` 1.9.0, Zustand, Zod mini, markdown-it 15.0.3.

Out of scope: account, sign-in, Guest mode, Pro plan, Feedback, PlantUML, folder URL rendering, gear sub-settings on plugins, locales other than en-US, third-party branding, logo, author line, and links.

Resolved ambiguities. Each one is a decision made for this plan. The user should confirm them before Phase 1.

1. Conflict: DESIGN "Defaults preserve pre-plan behavior" and success criterion 9 versus the Settings Behavior rows for TOC, Insert, Front matter, and Multi-markdown table, which default On. Decision: follow the per-row defaults. The four new syntaxes change output only for documents that use them. User confirmed 2026-11-09: the four new syntaxes default On.
2. Conflict: the same criterion versus auto-refresh for http(s). Pre-plan http(s) documents never reload. User decision 2026-11-09: http(s) polling moves to a separate `general.autoRefreshRemote` setting, row "Auto-refresh web pages", default Off. Auto-refresh for files stays On.
3. Front matter at offset 0 changes output for documents that begin with a closed `---` block. Pre-plan, those rendered as a thematic break and paragraph text. Decision: accepted under resolution 1.
4. Outline collapsing. The schema field is added in Phase 1. The row and behavior land in Phase 6. This avoids a non-functional control in Phase 5.
5. The `settings` command is registered in Phase 2, not Phase 6, because the reader dialog needs a trigger. Phase 6 adds the menu group entry and the `about` command.
6. Breaks is stored at `plugins.breaks` in `settings:v1`. Both the General and Plugins rows bind to that one field.
7. Auto-refresh http(s) minimum is 5 s per DESIGN. The reference allows 0.5 s. Decision: keep 5 s.
8. The About line uses `© 2026 Markdown Reader`. DESIGN states the holder name is unconfirmed.
9. Theme resolution. `isDark()` in `src/render/diagram.ts` reads the root `data-theme` attribute when it is `light` or `dark`. Otherwise it reads the `prefers-color-scheme` media query. Auto never sets a fixed value.
10. The snapshot folder is git-ignored. Tests must not read `snapshot/` at run time. Phase 7 copies role structure into `tests/fixtures/popup-roles.json`.
11. Multi-markdown table replaces the core `table` rule. When the Multi-markdown table setting is on, the plan disables the core `table` rule. When off, the core rule is restored. Covered by Phase 3 Task 3.
12. Package compatibility. The latest registry versions are `markdown-it-ins` 4.0.0 and `markdown-it-multimd-table` 4.2.3. Compatibility with `markdown-it` 15.0.3 is not verified. Phase 3 Task 1 verifies it before installation.
13. Lint. Biome reads the repo `.gitignore` only through `vcs.useIgnoreFile`. `.tgrep/` is ignored only by the user's global `~/.gitignore`. Phase 1 Task 1 excludes `.tgrep` in `biome.json`.

## Baseline Evidence

Measured at `368c213` on `main`, clean tree, 2026-11-09. `368c213` adds only the design. Product code matches `9fde555`.

- `pnpm typecheck`: exit 0. `wxt prepare` and `tsc --noEmit` pass.
- `pnpm lint`: exit 1. Biome reports `Found 2 errors`, `Found 188 warnings`, and `Found 3 infos`. The reported formatting error is `.tgrep/meta.json`, a search-index file outside git. Phase 1 Task 1 repairs this. Warnings do not fail `biome ci`. The warning count must not rise above 188.
- `pnpm exec vitest run --maxWorkers=2`: exit 0. 28 of 28 files passed. 313 of 313 tests passed. 0 failed. 0 skipped. Duration 37.49 s.
- `pnpm test:e2e`: exit 0. Build passed. Playwright reported 97 passed, 0 failed, 0 skipped, 5.0 min. Includes `perf.spec.ts` S3, S4, S8, and S9, export zero network, XSS, contrast, and motion.
- Plain `pnpm test` (full-parallel vitest): not run in this planning session. The prior plan recorded a host-load timeout in this form. Use `pnpm exec vitest run --maxWorkers=2`.
- Generated artifacts `.output/`, `.wxt/`, `test-results/`, and `playwright-report/` are git-ignored in the repo `.gitignore`. `.tgrep/` and `snapshot/` are ignored only by the global ignore file.

### Phase 1: Settings foundation

**Phase Request:** Add the typed settings model, its persistence store, and the i18n foundation. No settings UI ships in this phase. Use cases: (a) a stored object with one corrupt field loads with that field defaulted and every other field kept. (b) A change written by one tab reaches the store of another tab. (c) A draft save every 1 s does not wake the settings store. (d) The reader reads settings before its first render. (e) The context-menu title is read through `t()`. Defaults in this phase reproduce pre-plan behavior for existing syntax, per resolution 1.
**Goal:** One validated `settings:v1` object, one store, and a `t()` dictionary, with the reader loading settings before its first render.
**Depends on:** none
**Invariants & Boundaries:** Keep the draft, recent, and handle keys unchanged. No UI beyond `document.documentElement.lang`. Do not add a Zod import to `src/entrypoints/background.ts` or `src/entrypoints/detect.content.ts`. Those two read settings with a plain helper from `src/lib/settings.ts`, or read only the context-menu strings. Use `zod/mini` as `src/lib/schemas.ts` already does, with `src/lib/zod-config.ts` loaded first. Out of scope: any popup change, any new manifest key.
**Files:**
- Modify: `biome.json`
- Create: `src/lib/settings.ts`
- Create: `src/store/settings-store.ts`
- Create: `src/i18n/en-US.ts`
- Create: `src/i18n/index.ts`
- Modify: `src/entrypoints/reader/main.tsx`
- Modify: `src/entrypoints/background.ts`
- Create: `tests/unit/settings.test.ts`
- Create: `tests/unit/settings-store.test.ts`
- Create: `tests/unit/i18n.test.ts`
- Modify: `tests/unit/background.test.ts`
**Tasks:**
1. Baseline repair. RED: `pnpm lint` exits 1 at base, recorded in Baseline Evidence. GREEN: add `"!**/.tgrep"` to `files.includes` in `biome.json`. Re-run `pnpm lint` and record exit code and warning count. Do not add rule downgrades.
2. Schema. RED: `tests/unit/settings.test.ts` asserts defaults, version `1`, and the field list in DESIGN Settings Behavior. It asserts per-field fallback for a corrupt `plugins.linkify` and a non-number `general.autoRefreshIntervalSec`. It asserts clamping of the interval to 0.5 to 600, custom max width to 500 to 3000, and `customCss` rejection above 65536 characters. Layout: `{ version: 1, general: {...}, appearance: {...}, plugins: {...} }`. Use `z.catch` per field after verifying the Zod 4 mini API in the Zod docs. GREEN: implement `src/lib/settings.ts` exporting `settingsSchema`, `defaultSettings`, `parseSettings(raw: unknown)`, and `readSettings()`. Storage key constant `SETTINGS_KEY = 'settings:v1'`.
3. Store. RED: `tests/unit/settings-store.test.ts` uses a fake `storage.local` and a fake `storage.onChanged`. It asserts that a change under `settings:v1` updates the store and that a change under `drafts:*` or any other key does not call `set`. It asserts `reset()` writes defaults. GREEN: `src/store/settings-store.ts` exports a Zustand store with `load()`, `update(patch)`, `reset()`. `load()` runs once. The `onChanged` listener checks `area === 'local'` and `changes[SETTINGS_KEY]` before reacting.
4. i18n and reader boot. RED: `tests/unit/i18n.test.ts` asserts `t('contextMenu.open')` returns `Open in Markdown Reader` and that `applyLanguage('en-US')` sets `lang="en-US"`. `tests/unit/background.test.ts` asserts the context-menu title still equals the pre-plan string. GREEN: `src/i18n/en-US.ts` holds a typed `as const` dictionary. `src/i18n/index.ts` exports `t`, `useT`, and `applyLanguage`. `src/entrypoints/background.ts` reads the title through `t()`. `src/entrypoints/reader/main.tsx` awaits `useSettingsStore.getState().load()` before `createRoot`.
**Acceptance Criteria:**
- `pnpm lint` exits 0 with at most 188 warnings.
- `tests/unit/settings.test.ts` passes and covers each field fallback named in Task 2.
- Writing `settings:v1` to a stub `storage.local` changes the store within one event. Writing `drafts:x` does not.
- The reader DOM first render happens after `load()` resolves, verified by a unit test that records call order.
- With no stored settings, the context-menu title and every existing render output are unchanged.
**Reviewer Checklist:**
- The `onChanged` filter checks both the area and the exact key `settings:v1`. A prefix match would receive every draft save every 1 s.
- Per-field fallback. A corrupt object must not throw. A value of `null` for `customCss` must not throw.
- `customCss` cap applies to the stored value, not only to the textarea.
- No new Zod import in `background.ts` or `detect.content.ts`.
- `breaks` lives only at `plugins.breaks`.
- Storage key `settings:v1` appears once in the source. Other modules import the constant.
**Verification Checks:**
- `pnpm typecheck`
- `pnpm lint`
- `pnpm exec vitest run --maxWorkers=2`
- `pnpm test:e2e`

### Phase 2: Shared SettingsPanel shell

**Phase Request:** Build the settings panel once and mount it in three hosts. Use cases: (a) a user opens the popup and sees a 60 px icon rail with General, Appearance, Plugins, and About. (b) The General tab opens the viewer, the editor, or renders the current tab. (c) Recents show up to 5 URLs, and Reset settings asks for confirmation. (d) A user opens the options page from the browser and sees the same panel centered. (e) A user opens the reader Setting dialog from the Cmd+K palette. Existing popup behavior stays: open actions, file-access dialog, and URL scheme errors.
**Goal:** The same `SettingsPanel` renders in the popup, the options page, and a reader dialog. Appearance and Plugins contain only H2 headings in this phase.
**Depends on:** Phase 1
**Invariants & Boundaries:** No setting in this phase changes rendered output. The General tab carries only the open row, recents, the disabled Language select, and Reset. Breaks, Enable, Local file access, Render .txt, auto-refresh, and charset rows wait for Phase 5. The About tab has no links. Popup size is 520 by 480 px. Do not change `src/styles/globals.css` tokens.
**Files:**
- Create: `src/components/ui/switch.tsx`, `src/components/ui/slider.tsx`, `src/components/ui/select.tsx`, `src/components/ui/textarea.tsx` (generated by `pnpm exec shadcn add switch slider select textarea`)
- Create: `src/ui/settings/settings-panel.tsx`
- Create: `src/ui/settings/general-tab.tsx`
- Create: `src/ui/settings/appearance-tab.tsx`
- Create: `src/ui/settings/plugins-tab.tsx`
- Create: `src/ui/settings/about-tab.tsx`
- Create: `src/ui/settings/settings-dialog.tsx`
- Create: `src/entrypoints/options/index.html`
- Create: `src/entrypoints/options/main.tsx`
- Create: `src/entrypoints/options/App.tsx`
- Modify: `src/entrypoints/popup/App.tsx`
- Modify: `src/entrypoints/popup/main.tsx`
- Modify: `src/styles/popup.css`
- Modify: `wxt.config.ts`
- Modify: `src/reader/commands.ts`
- Modify: `src/entrypoints/reader/App.tsx`
- Create: `tests/unit/settings-panel.test.tsx`
- Create: `tests/e2e/settings.spec.ts`
- Modify: `tests/e2e/entry.spec.ts`
**Tasks:**
1. Controls. RED: `tests/unit/settings-panel.test.tsx` imports `Switch`, `Slider`, `Select`, and `Textarea` from `src/components/ui/` and fails on missing files. GREEN: run `pnpm exec shadcn add switch slider select textarea`. Confirm each file imports from `@base-ui/react`. Confirm `components.json` still says base-nova. Do not edit generated tokens.
2. Panel shell. RED: `settings-panel.test.tsx` asserts four rail buttons with accessible names General, Appearance, Plugins, and About, that each rail button has `aria-pressed` or the Base UI tab state for the active tab, and that the Appearance and Plugins panes render an H2. GREEN: `settings-panel.tsx` renders a 60 px rail and a scrolling pane. Rows use a label and description on the left and a control on the right. About renders a 128 px icon from the existing `icons/icon-128.png` asset in `public/`, the H1 `Markdown Reader`, the manifest version read with `browser.runtime.getManifest().version`, and the line `© 2026 Markdown Reader`. No links.
3. Hosts. RED: `tests/e2e/settings.spec.ts` asserts that `chrome-extension://<id>/options.html` shows the panel and that the reader dialog opens from the palette command `settings`. GREEN: `wxt.config.ts` gets `options_ui: { page: 'options.html', open_in_tab: true }` through the WXT manifest key. Verify the generated `.output/chrome-mv3/manifest.json` after `pnpm build` contains it. `src/entrypoints/popup/App.tsx` hosts the panel with the Phase 2 General rows. `src/reader/commands.ts` gets one new `settings` command. `src/entrypoints/reader/App.tsx` opens `settings-dialog.tsx` from that command. `src/styles/popup.css` sets 520 by 480 px.
4. Popup behavior. RED: extend `tests/e2e/entry.spec.ts` with the existing open-viewer, open-editor, recent-newest-first, file-access dialog, and URL scheme error tests as they are now, plus an assertion that each still passes after the panel wrap. GREEN: move the existing popup actions into General. Keep the `role="alert"` error paragraph. Reset settings opens a confirm dialog and writes defaults on confirm.
**Acceptance Criteria:**
- `pnpm build` produces `.output/chrome-mv3/manifest.json` with `options_ui.page` equal to `options.html` and `open_in_tab` equal to `true`.
- The popup viewport is 520 by 480 px in `tests/e2e/settings.spec.ts`.
- The popup shows four rail buttons with accessible names General, Appearance, Plugins, and About.
- The General tab shows Open viewer, Open editor, Render current tab, a recent list of at most 5 items, a disabled Language select with one option `English (US)`, and Reset settings last.
- The file-access dialog and URL scheme errors behave as in `entry.spec.ts`.
- The reader Setting dialog opens from the palette and closes on Escape.
**Reviewer Checklist:**
- The popup sends the same runtime messages as before: `open-viewer`, `open-editor`, `render-current`.
- The reader dialog and the popup panel share one component and one store. No second copy of the settings state.
- Reset settings confirm dialog returns focus to its trigger.
- The options page works with `open_in_tab` true and false. Record the chosen value.
- About shows no `<a>` element.
**Verification Checks:**
- `pnpm typecheck`
- `pnpm lint`
- `pnpm exec vitest run --maxWorkers=2`
- `pnpm exec playwright test tests/e2e/settings.spec.ts tests/e2e/entry.spec.ts`
- `pnpm test:e2e`

### Phase 3: Configurable render pipeline and Plugins tab

**Phase Request:** Make each Markdown plugin switchable from the Plugins tab, with live updates in the reader. Use cases: (a) a user turns off Mermaid and a mermaid fence renders as plain code. (b) A user turns off KaTeX and math shows as text. (c) A user toggles any plugin and every mounted block re-renders with the new output. (d) A `[[TOC]]` line becomes a table of contents filled from the headings. (e) A closed front matter block at the top of a file renders as a metadata table. (f) A multi-markdown table and `++inserted++` text render. (g) The All plugins switch turns every plugin on or off and reflects the derived state.
**Goal:** The parser instance depends on a plugin config. Render, prefix, block planning, and the Mermaid fence use the same instance. Every plugin in DESIGN Settings Behavior has a row and an effect.
**Depends on:** Phase 2
**Invariants & Boundaries:** `render(text, baseUrl)` keeps its two-argument form. A default config argument reproduces the pre-plan parser. The four-entry LRU is keyed by a stable string built from the config. `src/ui/markdown-view.tsx` joins that key to every block key and to the reset condition. Sanitizer gains only `ins`, `caption`, `colspan`, and `rowspan`. No new network request. Out of scope: PlantUML, gear sub-settings.
**Files:**
- Modify: `package.json` (add `markdown-it-ins` and `markdown-it-multimd-table` at verified versions)
- Modify: `pnpm-lock.yaml`
- Modify: `src/render/pipeline.ts`
- Create: `src/render/local-rules.ts`
- Modify: `src/render/plugins.d.ts`
- Modify: `src/render/sanitize.ts`
- Modify: `src/ui/markdown-view.tsx`
- Modify: `src/entrypoints/reader/App.tsx`
- Modify: `src/ui/settings/plugins-tab.tsx`
- Create: `tests/unit/pipeline-config.test.ts`
- Create: `tests/unit/local-rules.test.ts`
- Create: `tests/fixtures/markdown/toc-plugins.md`
- Create: `tests/fixtures/large-100kb-toc.md`
- Create: `tests/e2e/plugins.spec.ts`
- Modify: `tests/unit/sanitize.test.ts`
- Modify: `tests/unit/pipeline.test.ts`
- Modify: `tests/unit/reader-render.test.tsx`
- Modify: `tests/e2e/perf.spec.ts`
**Tasks:**
1. Parser instance cache. Before installing, verify `markdown-it-ins` and `markdown-it-multimd-table` peer ranges against `markdown-it` 15.0.3 with `pnpm view <pkg> peerDependencies` and the package README. RED: `tests/unit/pipeline-config.test.ts` asserts that each boolean plugin off removes its effect: `:emoji:`, `H~2~`, `x^2^`, `==mark==`, abbreviation, definition list, footnote, task list, and a github alert. It asserts KaTeX off leaves `$x$` as text, Mermaid off produces no `pre.mermaid`, and linkify off leaves a bare URL unlinked. It asserts the cache holds at most 4 instances and that two configs with equal settings return the same instance. GREEN: `getMarkdownIt(config)` in `src/render/pipeline.ts` builds the instance from the config. KaTeX is gated by not calling `md.use(katex)`. Mermaid is gated inside the fence rule. Typographer, breaks, and linkify are `MarkdownIt` options.
2. Local rules. RED: `tests/unit/local-rules.test.ts` asserts that `[[TOC]]` emits an empty placeholder with a `data-toc-placeholder` attribute and that a document with no headings produces an empty placeholder. It asserts front matter matches only at offset 0 of the full document and only when closed. It asserts that an unclosed opening `---` renders as text and that a mid-document `---` block does not match. GREEN: `src/render/local-rules.ts` exports `tocPlaceholderRule` and `frontMatterRule`, installed only when the TOC and Front matter settings are on. `src/ui/markdown-view.tsx` fills each placeholder after paint with HTML built from `buildToc` in `src/toc/toc.ts`. The view reads `headings` from the plan. Front matter renders as a compact metadata table with the existing sanitizer.
3. Sanitizer and table plugin. RED: `tests/unit/sanitize.test.ts` asserts that `ins`, `caption`, `colspan`, and `rowspan` survive, and that `onerror`, `style` on `ins`, and `javascript:` hrefs still do not. `tests/unit/pipeline-config.test.ts` asserts that a multi-markdown table with `colspan` renders, and that the core `table` rule is disabled when the setting is on and restored when off. GREEN: `src/render/plugins.d.ts` declares both modules. `pipeline.ts` adds `ins` through `markdown-it-ins` and multimd table through its default export, disabling core `table` in that case. `sanitize.ts` adds the four names to the allowlist. Keep `ADD_ATTR` changes narrow.
4. Block keys, reset, Plugins rows, and perf. RED: `tests/unit/reader-render.test.tsx` asserts that changing one plugin flag replaces every mounted block, and that a `planBlocks` key differs when the plugin key differs. `tests/e2e/perf.spec.ts` gets a new S3 test named `S3 with all plugins on and a [[TOC]] document` using `tests/fixtures/large-100kb-toc.md`, and a new S4 test named `S4 with all plugins on`. GREEN: `markdown-view.tsx` takes a `pluginKey` prop, prefixes it to every key from `planBlocks` and `planPrefix`, and includes it in the reset condition. `plugins-tab.tsx` renders the rows from DESIGN with All plugins derived. Breaks row binds to `plugins.breaks`.
**Acceptance Criteria:**
- With all plugins on, `tests/fixtures/markdown/toc-plugins.md` renders a TOC list, a metadata table, an `ins` element, a multi-markdown table, KaTeX, and a Mermaid pre block.
- Turning one plugin off and back on in the popup changes the reader output within one storage event. Verified in `tests/e2e/plugins.spec.ts`.
- With default settings, `tests/unit/pipeline.test.ts` passes unchanged.
- `tests/e2e/perf.spec.ts` S3 with all plugins and a `[[TOC]]` document has median per-keystroke time under 100 ms. S4 with all plugins has first content under 500 ms.
- The four-entry cache never holds a fifth parser instance. Verified by a unit test that calls `getMarkdownIt` with five distinct configs.
- `pnpm lint` warnings stay at or below 188.
**Reviewer Checklist:**
- Block-key invalidation. A toggle that does not change the key leaves stale HTML in mounted blocks.
- The incremental `parseState` groups carry the old plugin set. Reset `parseState` on a plugin-key change.
- The prefix render path uses the same config as the block path.
- The `[[TOC]]` placeholder is filled after every paint, including the prefix and progressive paths.
- Sanitizer allowlist grows by four names only. `style` and `on*` attributes stay blocked.
- Front matter at offset 0 only. A file beginning with a thematic break followed by text must not turn into front matter.
- Core `table` rule disabled only when multi-markdown table is on.
- Mermaid off keeps the source as a code block, not as `pre.mermaid`.
- Parser build time on a toggle change is measured and recorded in the perf output.
**Verification Checks:**
- `pnpm typecheck`
- `pnpm lint`
- `pnpm exec vitest run --maxWorkers=2`
- `pnpm exec playwright test tests/e2e/plugins.spec.ts tests/e2e/perf.spec.ts`
- `pnpm test:e2e`

### Phase 4: Appearance tab

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

### Phase 5: General tab

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

### Phase 6: Reader shell

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

### Phase 7: Hardening and release audit

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
