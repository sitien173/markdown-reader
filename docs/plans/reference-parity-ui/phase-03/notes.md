<!-- refract-shared-version: 3.0.0 -->

# Phase 3 Decision Notes

<!-- Created by the worker per worker-contract.md. Append one `## Task <M>` block per task. -->


## Task 0

### Decisions made
- Echo guard keeps each written value as an entry until its own `onChanged` echo arrives; a 2000 ms timer drops entries whose echo never comes (storage skips the event for an unchanged value). A failed write drops its entry at once.
- `load()` compares `get().settings` by reference with the value read at start.
- `reset()` mirrors `update()`: rolls back only if no newer state replaced it.
- Language option label built inside the component via `t('settings.general.languageEnglish')`. A failed reset closes the dialog and shows `error.message` in the existing `role="alert"` paragraph; a successful reset clears it.

### Spec deviations
- none

### Tradeoffs accepted
- (b) splice guard has no dedicated test: the -1 path is not observable through store state. It is covered by the `dropPending` helper.
- 2000 ms fallback is a fixed constant.

### Assumptions
- The `manifest.open_in_tab` meta tag in `src/entrypoints/options/index.html` was left untouched.
- The panel test for 5 recents passed on first run (existing behavior); it is a regression guard, not a RED.

### Follow-ups for human
- none

### Test evidence
- RED -> GREEN:
  - RED: `pnpm exec vitest run tests/unit/settings-store.test.ts` -> 3 failed (echo after set resolves overwrote later update; load() overwrote newer state; reset() did not roll back), 13 passed. `pnpm exec vitest run tests/unit/settings-panel.test.tsx` -> rejected reset left no `role="alert"` element, with an unhandled `quota exceeded` rejection.
  - GREEN: `pnpm exec vitest run tests/unit/settings-panel.test.tsx tests/unit/settings-store.test.ts` -> 23 passed.
- Root cause (bugfix only): echo guard dropped its entry when `set` resolved, before the echo; `load()` and `reset()` had no stale-state guard.

## Task 1

### Decisions made
- Installed `markdown-it-ins@4.0.0` and `markdown-it-multimd-table@4.2.3` (latest; `pnpm view` shows no `peerDependencies` for either; last published 2023-12 and 2023-08, tested upstream against markdown-it 13 and 12).
- `getMarkdownIt(config)` is a four-entry LRU (Map, move-to-end on hit) keyed by `pluginKey(config)`, a 0/1 string over the keys of `defaultSettings.plugins`.
- `render`, `planBlocks`, `renderBlocks`, `planPrefix` take an optional trailing `config` defaulting to `defaultSettings.plugins`.
- `planBlocks` keeps plain keys for the default config and prefixes `<pluginKey>\u0001` for any other config, because `tests/unit/incremental-render.test.ts` (not editable) asserts `full\u0000<source>` and the keys also index the caller's cache.

### Spec deviations
- `markdown-it-multimd-table` 4.2.3 calls `md.utils.assign`, removed in markdown-it 15. The instance gets a per-instance copy of `utils` with `assign: Object.assign` before `md.use`. The shared `utils` object is not mutated.

### Tradeoffs accepted
- `pipeline-config.test.ts` needs `// @vitest-environment jsdom`; the default happy-dom environment does not run DOMPurify correctly.

### Assumptions
- Default settings keep `toc`, `insert`, `frontMatter`, `multimdTable` on, so default output can differ from the pre-plan parser only for `[[TOC]]`, `++x++`, a leading front matter block, and multi-markdown table syntax. Existing `pipeline.test.ts`, `incremental-render.test.ts`, and `prefix-render.test.ts` pass unchanged.

### Follow-ups for human
- Both table and ins plugins are unmaintained upstream; revisit if markdown-it 16 lands.

### Test evidence
- RED -> GREEN:
  - RED: `pnpm exec vitest run tests/unit/pipeline-config.test.ts` (with a `getMarkdownIt` stub that ignored config) -> 15 failed, 1 passed, for example `expected '<p>😄</p>\n' not to match /😄/`, `expected '<pre class="mermaid">graph TD; A--&gt…' not to contain 'class="mermaid"'`, `expected '<p>"q"</p>\n' to contain '“q”'`.
  - GREEN: `pnpm exec vitest run tests/unit/pipeline-config.test.ts tests/unit/local-rules.test.ts` -> 27 passed. Full `pnpm exec vitest run --maxWorkers=2` -> 379 passed after tasks 1 and 2.
- Root cause (bugfix only): none

## Task 2

### Decisions made
- `tocPlaceholderRule` and `frontMatterRule` emit `html_block` tokens with `meta.local = true`, so they render without renderer rules; `isNonLocal` in `pipeline.ts` ignores such tokens, which keeps incremental rendering.
- `frontMatterRule` requires line 0 at character offset 0, `level` 0, parent `root`, and no `env.partial`. `parseGroups` sets `env.partial` for any slice starting past line 0.
- `reparse` returns null (full re-parse) when front matter opens, closes, or changes, or when the edit is inside it. `planPrefix` extends `minChars` to the end of a closed front matter block so the prefix never cuts it. `planPrefix` also returns `headings`.
- Front matter rows come from `key: value` lines; other lines append to the previous value. No YAML library.
- `markdown-view.tsx` `fillToc` builds nested `ul/li/a` DOM nodes from `buildToc`, with `href="#<heading id>"`, after the first chunk, after each progressive chunk, and after the prefix paint.

### Spec deviations
- none

### Tradeoffs accepted
- `fillToc` rebuilds every placeholder on each paint instead of diffing.

### Assumptions
- Only the exact line `[[TOC]]` (trimmed, not indented 4 or more) is a placeholder.
- No CSS file is in the Files list, so the metadata table and TOC list use existing markdown styles.

### Follow-ups for human
- Front matter table and TOC list have no dedicated styling.

### Test evidence
- RED -> GREEN:
  - RED: `pnpm exec vitest run tests/unit/local-rules.test.ts` (rules stubbed to return false) -> 5 failed, 6 passed, for example `expected '<p>[[TOC]]</p>\n<p>text</p>\n' to be '<div class="toc-placeholder" data-toc-placeholder></div>…'` and `expected +0 to be 13`.
  - GREEN: `pnpm exec vitest run tests/unit/local-rules.test.ts` -> 11 passed.
- Root cause (bugfix only): none

## Task 3

### Decisions made
- `ins` added to the tag allowlist; `colspan` and `rowspan` added to `extraAttributes`. `caption` was already allowed.
- `plugins.d.ts` declares both modules. The multi-markdown plugin replaces the core `table` rule through `ruler.at('table')`; with the setting off the core rule remains.

### Spec deviations
- none

### Tradeoffs accepted
- `colspan` and `rowspan` already pass DOMPurify defaults; they are listed explicitly as the plan requires.

### Assumptions
- The "core table rule disabled" test compares the `table` entry in `md.block.ruler.__rules__` across configs.

### Follow-ups for human
- none

### Test evidence
- RED -> GREEN:
  - RED: `pnpm exec vitest run tests/unit/sanitize.test.ts tests/unit/pipeline-config.test.ts` -> 3 failed, 46 passed: `expected '<p>added</p>\n' to contain '<ins>added</ins>'`, `expected undefined to be 'added'`, `expected undefined to be false`. The multi-markdown tests passed on first run because task 1 had already installed the plugin.
  - GREEN: same command -> 49 passed.
- Root cause (bugfix only): none

## Task 4

### Decisions made
- `markdown-view.tsx` takes a `pluginKey` prop, prefixes it to every key from `planBlocks` and `planPrefix`, and compares it in the cache reset condition; the reader `App.tsx` passes config and key from the settings store.
- `plugins-tab.tsx` renders the DESIGN rows. All plugins is derived from the individual flags and sets every flag on or off. The Breaks row binds to `plugins.breaks`.
- The store keeps its echo-guard behavior from task 0, so a popup toggle reaches the open reader through one storage event.
- `tests/fixtures/large-100kb-toc.md` is 102206 bytes with front matter, `[[TOC]]`, and 478 sections that use the plugin syntaxes.
- The S4 all-plugins test records the parser build and first paint after a Mermaid toggle (227 ms in the final run) in the perf output.

### Spec deviations
- none

### Tradeoffs accepted
- Perf gates keep the existing load-tolerant medians. Host load average was 3.1 to 3.8 during runs.

### Assumptions
- `plugins.spec.ts` selects switches by accessible name with `exact: true`; the Plugins tab exposes 19 switches including All plugins.

### Follow-ups for human
- The reader `App.tsx` and `markdown-view.tsx` contain pre-existing non-null assertion warnings that were left alone.

### Test evidence
- RED -> GREEN:
  - RED: `tests/unit/reader-render.test.tsx` had three behavioral failures before the `pluginKey` prop and key prefix existed. Exact failure text was not retained in this record.
  - GREEN: `pnpm exec vitest run --maxWorkers=2` -> 35 files, 390 passed. `pnpm exec playwright test tests/e2e/plugins.spec.ts tests/e2e/perf.spec.ts` -> `plugins.spec.ts` 3 passed; `perf.spec.ts` 6 passed. `pnpm test:e2e` -> 107 passed.
  - Timings (final run): S3 all plugins and `[[TOC]]` median 25.9 ms; S4 all plugins first content median 88 ms (104, 84, 88).
- Root cause (bugfix only): the first S4 rebuild measurement in the new test waited for a render that had already finished. The test now records the `md-render-end` count before the toggle.

## Final checks
- `pnpm typecheck` exit 0.
- `pnpm lint` exit 0, 186 warnings (baseline 188), 0 errors.
