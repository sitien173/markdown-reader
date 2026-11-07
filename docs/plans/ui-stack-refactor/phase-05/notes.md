<!-- refract-shared-version: 2.5.0 -->

# Phase 5 — Decision Notes

<!--
Worker Notes template. Copy to docs/plans/ui-stack-refactor/phase-05/notes.md, fill the
heading, then append one `## Task 1

### Decisions made
- Dark tokens sit in `@media (prefers-color-scheme: dark) { :root {...} }` after the light `:root`; an explicit `@media print { :root {...} }` after it restores the light values and `color-scheme: light`.
- Dark palette values are new (Apple-style): background `#1c1c1e`, foreground `#f5f5f7`, primary `#4da3ff` with `#0b0b0c` foreground, border `#3a3a3c`, and dark alert tints. Phase 8 owns the contrast check.
- `editor.css`, `reader.css` unchanged: they already read only tokens (editor) or force light (reader print block uses `#ffffff`), so they follow the new token values. Allowed but not needed.
- `src/ui/markdown-view.tsx` guards `window.matchMedia?.(...)` because `tests/unit/directory.test.ts` (outside the allow-list) runs MarkdownView in an environment where `window.matchMedia` is not a function (5 failures without the guard).

### Spec deviations
- none

### Tradeoffs accepted
- Light token values appear three times (light, print, export TS). The unit test below pins them to each other.

### Assumptions
- `@custom-variant dark (@media (prefers-color-scheme: dark))` also matches under print; no `dark:` utility is meant to apply in print and the token block forces light there.

### Follow-ups for human
- Phase 8 contrast review of the dark palette.

### Test evidence
- RED -> GREEN:
  - RED: `pnpm exec vitest run --no-file-parallelism tests/unit/enhance.test.ts tests/unit/export.test.ts` -> `AssertionError: expected ':root {\n  --font-body: system-ui, -a…' to contain 'color-scheme: light dark'` (export CSS test); `AssertionError: expected 0 to be greater than 5` (dark and print token scopes empty in export CSS). 6 failed, 18 passed across both files before implementation.
  - RED (E2E, old build in `.output`): `pnpm exec playwright test tests/e2e/theme.spec.ts` -> 4 failed, 2 passed; light, dark, scheme-change and print tests fail on `expect(locator('.md-content .shiki')/.md-diagram svg).toBeVisible()` ("element(s) not found" for the new `.md-diagram` wrapper). The failure is on the missing wrapper, not on color values, because the old build has no wrapper to read a fill from.
  - GREEN: `pnpm exec vitest run --no-file-parallelism` -> 25 files, 257 tests passed. `pnpm exec playwright test tests/e2e/enhance.spec.ts tests/e2e/export.spec.ts` -> 13 passed. Full `pnpm test:e2e` -> 40 passed, 1 failed (S4, see Task 5).
- Root cause (bugfix only): none

## Task 2

### Decisions made
- `highlight.ts` loads `shiki/themes/github-dark.mjs` next to `github-light.mjs` in the same lazy `Promise.all` and calls `codeToHtml` with `themes: { light, dark }`. Shiki's default `defaultColor: 'light'` and `--shiki-dark` / `--shiki-dark-bg` prefixes are used, so the pre carries light colors and dark values as CSS variables.
- The override lives in `markdown.css` under `@media screen and (prefers-color-scheme: dark)` with `!important`, because Shiki writes colors inline. `screen` keeps print light without a second override. Export reuses this file, so export gets the same rule.
- Highlighting is cached by language and source only, and is never rerun on theme change.

### Spec deviations
- none

### Tradeoffs accepted
- `!important` adds 2 Biome warnings (173 total, cap 218).

### Assumptions
- none

### Follow-ups for human
- none

### Test evidence
- RED -> GREEN:
  - RED: `pnpm exec vitest run --no-file-parallelism tests/unit/enhance.test.ts` -> `AssertionError: expected '<pre class="shiki github-light" style…' to contain '--shiki-dark:'`
  - GREEN: same command after implementation -> 12 passed. E2E `enhance.spec.ts` dual-theme test asserts `--shiki-dark:` in the rendered DOM in both schemes.
- Root cause (bugfix only): none

## Task 3

### Decisions made
- `diagram.ts` wraps each rendered diagram in `div.md-diagram[data-md-diagram="<source>"]`. Theme colors are read from the new tokens (`--muted`, `--foreground`, `--input`, `--muted-foreground`, `--background`) plus `darkMode`. The old code read TDS token names that no longer exist, so Mermaid had received no theme variables since Phase 4.
- A module-level `themeEpoch` is bumped by each `rerenderDiagrams` call. A render that began under an earlier epoch returns undefined, is not cached, and is dropped. `enhanceDiagrams` retries such a block with the new theme. Temporary Mermaid nodes (`d<id>`, `<id>`) are removed in a `finally`, before the SVG is inserted.
- `markdown-view.tsx` subscribes to `matchMedia('(prefers-color-scheme: dark)')` `change`, calls `rerenderDiagrams` with the view's abort signal, and tracks the promise in `activeEnhancers` so `ready()` waits for it.
- `renderDiagramSvg` and `mermaidThemeVariables` are exported from `diagram.ts` for export reuse. This is a `src/render/*` helper change needed by the diagram work.

### Spec deviations
- The spec says "read theme colors as hex from computed values". Custom properties return their authored value, which is hex in `globals.css`, so `getPropertyValue` is used without a probe element.

### Tradeoffs accepted
- Export calls `mermaid.initialize` without bumping the epoch. A theme change racing an in-flight export could mix config into one live render. The window is the export duration; not guarded.

### Assumptions
- Failed diagrams (error div) are not themed and keep no source wrapper.

### Follow-ups for human
- none

### Test evidence
- RED -> GREEN:
  - RED: `pnpm exec vitest run --no-file-parallelism tests/unit/enhance.test.ts` -> `TypeError: Cannot read properties of null (reading 'getAttribute')` (no `[data-md-diagram]` wrapper) and `AssertionError: expected [] to have a length of 1 but got +0` (stale-result test, stub `rerenderDiagrams` did nothing).
  - GREEN: same command -> 12 passed. E2E `theme.spec.ts` (6 tests) passes in the full run, including body, code token and Mermaid fill per scheme and the live scheme change without reload.
- Root cause (bugfix only): none

## Task 4

### Decisions made
- `EXPORT_CSS` is built from `EXPORT_TOKENS` (light, dark) in `export-styles.ts`; it emits light `:root`, dark under `@media (prefers-color-scheme: dark)`, and light under `@media print`.
- `themeExportDiagrams` in `export.ts` replaces each `[data-md-diagram]` with `.md-diagram--light` and `.md-diagram--dark` copies rendered with ids `export-diagram-<n>-light|dark`; CSS hides the dark copy except under `screen` plus dark scheme. `downloadHtml` runs it only when the content has a diagram, so the sync path for other documents is unchanged. No script is added.
- If a diagram fails to render for export, its live SVG stays.

### Spec deviations
- none

### Tradeoffs accepted
- Exported diagrams are rendered again in both themes; the live SVG is discarded. Cost: two Mermaid renders per diagram per export.

### Assumptions
- none

### Follow-ups for human
- none

### Test evidence
- RED -> GREEN:
  - RED: `pnpm exec vitest run --no-file-parallelism tests/unit/export.test.ts` -> `AssertionError: expected  to have a length of 2 but got +0` (`.md-diagram--light svg`, stub `themeExportDiagrams`). E2E on old build: `pnpm exec playwright test tests/e2e/export.spec.ts tests/e2e/enhance.spec.ts -g "switches theme|scheme:|\(dark\)"` -> 3 failed (`toHaveCount` Expected 2 Received 0; `toBeVisible` element(s) not found), 1 passed (the pre-existing flow in dark, which needs no new behavior).
  - GREEN: unit 257 passed; `pnpm exec playwright test tests/e2e/enhance.spec.ts tests/e2e/export.spec.ts` -> 13 passed (export flow in light and dark, scheme switch with `colorScheme` emulation, disjoint ids, print light, zero requests, no `<script`).
- Root cause (bugfix only): none

## Task 5

### Decisions made
- Chose the unit-test option: `tests/unit/export.test.ts` parses `:root` blocks of `globals.css` and `EXPORT_CSS` for light, `@media (prefers-color-scheme: dark) {` and `@media print` scopes and requires every exported token to equal the `globals.css` value, and the print block to equal light.
- The token-coverage test now ignores `--shiki-*` variables, which Shiki sets inline.

### Spec deviations
- none

### Tradeoffs accepted
- none

### Assumptions
- none

### Follow-ups for human
- S4 (`perf.spec.ts:18`) failed in two full `pnpm test:e2e` runs at host load 14 to 26 and once in isolation at load 25 (received 557.9 ms). It passed in isolation at load 16, 19 and 12 (the last with S3, S8, S9 in the same file, 4 passed). This phase does not touch the first-content path: Shiki and Mermaid load after paint and the S4 document is plain Markdown. Treated as environmental per the prompt; a full `pnpm test:e2e` on a quiet host is still advised.

### Test evidence
- RED -> GREEN:
  - RED: `pnpm exec vitest run --no-file-parallelism tests/unit/export.test.ts` -> `AssertionError: expected 0 to be greater than 5` for the dark and print scopes.
  - GREEN: `pnpm exec vitest run --no-file-parallelism` -> 25 files, 257 tests passed. `pnpm lint` exit 0, 173 warnings. `pnpm typecheck` pass. `pnpm install --frozen-lockfile` ok. Load average during final run 14 to 26.
- Root cause (bugfix only): none

## Housekeeping
- `mcp__auggie__codebase_search` created an ignored `.tgrep/` index in the repo root. Biome formatted its `meta.json` and failed lint with 2 errors, so I deleted `.tgrep/` (ignored by the global gitignore, tool-generated).

## FIX 1

Source: review a124bb17 (FAIL). Fix job 30096545 (cc/claude-sonnet-medium) ended `failed` with failure_kind `replay_blocked` after 17 min and returned no response. Coordinator kept its tree changes after reading the full diff and ran the checks.

### Decisions made
- High, editor syntax colors: `src/editor/editor.ts` adds a non-fallback `HighlightStyle` whose colors are CSS variables (`--cm-accent`, `--cm-subtle`, `--cm-code`) set in `src/styles/editor.css` with dark values under `prefers-color-scheme: dark` and light values under print. It overrides basicSetup's fallback `defaultHighlightStyle`. `@codemirror/language` 6.13.1 and `@lezer/highlight` 1.2.5 are declared because pnpm does not expose transitive deps; both were already in the lockfile at those versions.
- Medium, print diagrams: in a dark scheme each diagram keeps a second light render (`.md-diagram-print`, light tokens from `EXPORT_TOKENS.light`); `markdown.css` shows it only under `@media print`.
- Low, export theme leak: `renderDiagramSvg` serializes `initialize` plus `render` through one queue, so live, print and export renders cannot interleave theme configs.

### Spec deviations
- none

### Evidence
- RED: not captured (worker run ended without notes).
- GREEN: new tests `tests/e2e/editor.spec.ts` (4.5:1 contrast both schemes), `tests/e2e/theme.spec.ts` print diagram fill, `tests/unit/enhance.test.ts` render serialization and print copy all pass.

### Debt
- Low (review finding 4): Mermaid sequence diagrams emit unprefixed ids (`actor0`, `root-0`), so exported light and dark copies, and live screen and print copies in dark mode, repeat them. No `url(#...)` references them.
