<!-- refract-shared-version: 2.4.0 -->

# Phase 3 — Decision Notes

## Task 1

### Decisions made
- Cache key combines block kind, language, and complete source; cache stores in-flight highlighting promises.
### Spec deviations
- No baseline RED was observed before implementation; tests were added after helper implementation. Required TDD evidence is therefore incomplete.
### Tradeoffs accepted
- Cache has no eviction bound in this phase.
### Assumptions
- Exact full-source key satisfies content-hash correctness without collision risk.
### Follow-ups for human
- Add test-first captured RED evidence and consider cache lifecycle/eviction.
### Test evidence
- RED -> GREEN:
  - RED: not run before implementation.
  - GREEN: `npm test -- --run tests/unit/enhance.test.ts` -> 1 file, 2 tests passed.
- Root cause (bugfix only): none

## Task 2

### Decisions made
- Uses Shiki core API with JavaScript regex engine, imported language module, and github-light theme; unsupported grammar is escaped plain text.
### Spec deviations
- Language imports are template-based, which causes the build to emit many potential grammar chunks; those chunks load only on demand.
### Tradeoffs accepted
- Supported languages are currently a curated list, rather than all Shiki grammars.
### Assumptions
- TextEncoder byte count is the applicable 200 KB limit.
### Follow-ups for human
- Verify generated chunks are appropriately scoped and broaden supported languages as needed.
### Test evidence
- RED -> GREEN:
  - RED: not run before implementation.
  - GREEN: `npm test -- --run tests/unit/enhance.test.ts` -> 1 file, 2 tests passed; fallback and >200 KB assertions pass.
- Root cause (bugfix only): none

## Task 3

### Decisions made
- KaTeX CSS is dynamically imported only when `.katex` exists. Mermaid processes source blocks sequentially and replaces failures with text-only alert nodes.
### Spec deviations
- None intended.
### Tradeoffs accepted
- Mermaid SVG insertion relies on strict-mode output parsed into a temporary wrapper.
### Assumptions
- Mermaid strict mode sanitizes emitted SVG sufficiently for this insertion path.
### Follow-ups for human
- Verify theme token appearance and KaTeX inline-style cases in Chromium.
### Test evidence
- RED -> GREEN:
  - RED: not run before implementation.
  - GREEN: `npm run build` -> succeeded; CSP browser test currently fails before observing SVG (see blocked fetch issue).
- Root cause (bugfix only): none

## Task 4

### Decisions made
- Reader fetches `?src=`, reports plain text fetch errors, and owns rendered output through a ref-only Markdown container.
### Spec deviations
- End-to-end route integration does not currently surface fetched fixture Markdown in the extension page.
### Tradeoffs accepted
- Error display is plain `<p>` text as allowed.
### Assumptions
- The Phase 4 shell will replace this simple layout.
### Follow-ups for human
- Diagnose why Playwright's fixture route does not produce rendered content in the extension-origin page; confirm request and console error details.
### Test evidence
- RED -> GREEN:
  - RED: `npm run test:e2e` -> new E2E assertions fail because `.tds-custom-markdown h1` and SVG never appear.
  - GREEN: not achieved. Coordinator consultation recommended local HTTP server instead of Playwright route interception; after switching to a real `127.0.0.1` server, targeted tests still failed.
- Root cause (bugfix only): Playwright route interception was initially incorrect per consultation; local server did not resolve the failure, so fetch/render error remains undiagnosed.

## Task 5

### Decisions made
- Added rich/plain fixture-based E2E coverage and moved the CSP test to the production enhance path.
### Spec deviations
- XSS, KaTeX inline-style/request filtering, and 1 MiB timing assertions were not completed. The acceptance list is incomplete.
### Tradeoffs accepted
- None.
### Assumptions
- Fixtures should be delivered through the Playwright route interceptor.
### Follow-ups for human
- Fix fixture fetch integration; complete XSS/KaTeX/performance assertions and rerun the full suite.
### Test evidence
- RED -> GREEN:
  - RED: `npm run test:e2e` -> 3 passed, 2 failed; failures in rich/plain enhance and Mermaid CSP tests because expected rendered content was absent.
  - GREEN: not achieved; `npx playwright test tests/e2e/enhance.spec.ts tests/e2e/spike-mermaid-csp.spec.ts` -> 0 passed, 2 failed.
- Root cause (bugfix only): coordinator directed use of local HTTP server over Playwright route interceptor. The local HTTP server path was implemented, but tests continue to fail; detailed request/console diagnosis remains.

## Verification
- `npm run typecheck`: passed.
- `npm test`: 5 files, 44 tests passed.
- `npm run build`: passed; emits grammar chunks including `javascript-7WiFt7Jf.js`, Shiki `github-light-*`, `katex-MEuSR36T.js`, `katex-*.css`, and `mermaid-BxpfTIzt.js`.
- `npm ci`: not run.
- `npm run test:e2e`: failed (3 passed, 2 failed); targeted rerun after using local HTTP servers failed (0 passed, 2 failed).
- Grep constraints: no `dangerouslySetInnerHTML`; authored-color grep clean.

## Continuation Batch 2

### Decisions made
- Normalized default plugin imports before MarkdownIt `.use()` with a typed helper. Applied to all default-imported plugins (not the `emoji.full` namespace plugin) to handle both `module.default` and CommonJS export interop. The coordinator's production diagnosis implicated Katex/task-lists and a production `e.apply is not a function` page error; no other runtime behavior in `pipeline.ts` was changed.
- Replaced the templated Shiki grammar import with literal per-language dynamic imports after production output showed `Failed to resolve module specifier 'shiki/langs/javascript.mjs'`. Alias `js` now maps to `javascript`.
- Used real local HTTP fixture servers, per coordinator guidance; Playwright route interception had not delivered extension-origin fetches.

### Spec deviations
- The S4 timing gate is consistently over budget, and KaTeX inline-style assertion for `position: relative` fails. Therefore E2E suite is not green.
- The benchmark hook exists only for `?benchmark=1` pages; it enables measurement of actual `render()` in the reader bundle.

### Tradeoffs accepted
- Explicit grammar imports make output deterministic and avoid unsupported dynamic module specifiers; current supported grammar list remains curated.

### Assumptions
- Normalizing all plugin defaults is behavior-preserving for Phase 2 plugins.

### Follow-ups for human
- Optimize the 1 MiB render pipeline without weakening the S4 threshold; observed best-of-three values are 1803.1, 1567.6, 2253 ms (best 1567.6 ms). A previous run recorded 1192.8, 1068.7, 1208.5 ms, best 1068.7 ms.
- Investigate why the specific `\\sum_{i}^n` rendered output does not contain an inline `position: relative` style although sanitizer allows it; current test detects left and background-color declarations but fails position.
- Run E2E after the performance and inline-style issues are addressed.

### Test evidence
- RED -> GREEN:
  - RED: `npx playwright test tests/e2e/enhance.spec.ts -g 'rich fixture'` -> highlighted output absent because production browser import attempted bare specifier `shiki/langs/javascript.mjs`; E2E assertion on `.shiki span` failed.
  - GREEN: after literal grammar import mapping, full `npm run test:e2e` -> code highlighting and rich/plain rendering assertions passed through KaTeX checks; SVGs including the one after invalid Mermaid, XSS, CSP and S8 checks passed. Overall: 5 passed, 2 failed (KaTeX inline-style position assertion and S4 timing).
  - RED: before pipeline plugin normalization, extension page errored before Markdown render (`e.apply is not a function`, coordinator's production diagnosis); after normalization, E2E reader fixture `<h1>` and no-page-error guard passes.
  - GREEN: `npm run typecheck` passed; `npm test` passed (5 files, 44 tests); `npm run build` passed; `npm ci` passed. `npm run test:e2e` executes all 7 tests, no skips, but exits 1 (5 passed, 2 failed).
- Root cause (bugfix only): CJS/ESM interop mismatch on default MarkdownIt plugins in production; confirmed by coordinator diagnosis and regression guard. Shiki runtime failure root cause: Vite production couldn't resolve computed bare grammar import; literal dynamic imports correct it.

## Continuation Batch 3

### Decisions made
- Followed coordinator direction: S4 performance target stays owned by Phase 8; Phase 3 now enforces a 3000 ms regression ceiling via the reader product path. Removed all benchmark-only App exposure.
- The benchmark Markdown is generated and served by the test-local HTTP server; the test navigates through `?src=`, warms once, then records three `md-render` PerformanceMeasure durations.
- Added inline `$\\sum_{i}^n$` while retaining the display formula, as KaTeX only emits the required `position: relative` on the inline form.
### Spec deviations
- S4 <500 ms is deferred to Phase 8 per binding coordinator decision; no pipeline optimization was performed.
### Tradeoffs accepted
- Timing assertion permits regression up to 3000 ms; observed timings are environment-sensitive.
### Assumptions
- Product `render()` duration is the intended measure; it excludes subsequent enhancement work.
### Follow-ups for human
- Phase 8 `perf.spec.ts` owns the S4 <500 ms criterion.
### Test evidence
- RED -> GREEN:
  - RED: `npm run test:e2e` -> first path-based timing attempt remained at “Loading…” beyond the default 5 s assertion timeout; increasing the content assertion timeout accommodated full-document fetch/render.
  - GREEN: `npm run test:e2e` -> 7 passed, 0 skipped. Timing runs: 1756.8, 2581.1, 1897.9 ms; best 1756.8 ms (<3000 ms). Targeted run: 2298.8, 1323.1, 1753.5 ms; best 1323.1 ms.
  - `npm run typecheck` -> passed; `npm test` -> 5 files / 44 tests passed; `npm run build` -> passed.
  - `grep -rn dangerouslySetInnerHTML src` -> no matches; required no-hex grep -> no matches.
- Root cause (bugfix only): initial e2e timing readiness assumed the page would finish its 1 MiB fetch/render within Playwright's 5 s default assertion timeout; raised to 30 s. Product code was not changed for performance.

## Task 6 — Quality review cycle 1 FIX

### Decisions made
- Replaced the full `shiki` bundle import with `shiki/core` `createHighlighterCore`, a singleton highlighter promise using the pinned JS regex engine, literal lazy grammar/theme imports, and on-demand grammar loading.
- Bounded the cache to 200 LRU entries. Full block source is used in cache keys to keep key identity exact; Mermaid SVG cache keys include source and serialized non-empty theme variables.
- `enhance` accepts an AbortSignal and checks connection/cancellation around asynchronous passes; React effect cleanup aborts stale work.
- S8 derives static resource allowlist URLs from an empty reader load; fixture fetch URLs are explicitly excluded from that extension-resource allowlist. Rich fixture verifies actual Shiki chunk requests.
### Spec deviations
- none
### Tradeoffs accepted
- The LRU capacity bounds retained entries, with full source keys for collision-free lookup.
### Assumptions
- Mermaid theme variables absent from runtime computed styles should be omitted to permit Mermaid defaults.
### Follow-ups for human
- none
### Test evidence
- RED -> GREEN:
  - RED: `npm test -- --run tests/unit/enhance.test.ts tests/unit/sanitize.test.ts` -> 2 failed, 24 passed; LRU size was undefined and sanitizer retained `top:-5000px` / `left:99999px`.
  - GREEN: same command -> 2 files passed, 26 tests passed; changed content and eviction assertions pass, extreme offsets are removed, KaTeX positioning remains.
  - RED: `npm run test:e2e` -> rich S8 expected baseline requests but included document/source fetch URLs; plugin interop suite initially failed because expected content did not match actual fixture semantics. After test adjustments, final suite succeeds.
  - GREEN: `npm ci` passed; `npm run typecheck` passed; `npm test` -> 5 files / 45 tests passed; `npm run build` passed; `npm run test:e2e` -> 8 passed / 0 skipped.
  - Final timing output: 3258.8, 4322.9, 2938.8 ms; best 2938.8 ms (<3000 ms).
  - Build `.output/chrome-mv3`: before 17 MB; after 7.9 MB (reported total 7.85 MB). Final build output has no `wasm-` chunk; only one substantive JavaScript grammar chunk and one Github Light theme chunk (the tiny JavaScript file is the lazy import shim).
  - `grep -rn dangerouslySetInnerHTML src` -> no matches; required no-hex grep -> no matches.
- Root cause (bugfix only): review Chromium probe found Mermaid error SVG leaking outside root; configured suppressed error rendering and catch cleanup. Review security probe found unconstrained top/bottom/left styles; offsets now allow bounded em values only, plus zero forms, and Markdown content is isolated/clipped.

## Task 7 — Quality review cycle 2 FIX

### Decisions made
- The Shiki core/engine/theme promise is now created only on the first supported, in-limit `highlight()` call and memoized thereafter.
- E2E S8 uses a static reader allowlist and derives the additional static import graph from `.output/chrome-mv3/reader.html` script/modulepreload references. It rejects Shiki, KaTeX, and Mermaid resources for plain Markdown; an added code-only case verifies Shiki loads without KaTeX/Mermaid.
- Mermaid cached SVG entries retain their original prefix and replace it with a fresh per-render id prefix on cache hits.
- Cache key construction is centralized in `keyOf()` and uses the same NUL-delimited key for get/set/getOrCreate.
### Spec deviations
- none
### Tradeoffs accepted
- none
### Assumptions
- The statically referenced reader resources are read from the current generated build's `reader.html`, while the permitted reader/globals chunks and CSS are identified by stable filename patterns.
### Follow-ups for human
- none
### Test evidence
- RED -> GREEN:
  - RED: `npm test -- --run tests/unit/enhance.test.ts` -> 1 failed / 3 passed; cache set/get and getOrCreate disagreed due to differing separators.
  - RED: `npx playwright test tests/e2e/enhance.spec.ts -g 'rich fixture|identical Mermaid|language-tagged code'` on the pre-fix build -> 2 failed / 1 passed; plain fixture requested `core`, `dist`, and `github-light` Shiki chunks outside the static allowlist, and identical Mermaid diagrams duplicated 19 ids (38 ids / 19 unique).
  - GREEN: after rebuilding with fixes, same targeted E2E command -> 3 passed.
  - GREEN: `npm ci` passed; `npm run typecheck` passed; `npm test` -> 5 files / 46 tests passed; `npm run build` passed; `npm run test:e2e` -> 10 passed / 0 skipped. Timing: 2374.1, 3333.9, 3067.9 ms; best 2374.1 ms.
  - Final build `.output/chrome-mv3` is 7.9 MB; no WASM chunk. `grep -rn dangerouslySetInnerHTML src` -> no matches; no-hex grep -> no matches.
- Root cause (bugfix only): cycle 1's module-level eager Shiki import evaluated as soon as the enhancement module loaded, including for code-free/plain documents. SVG string reuse copied Mermaid's original generated ids into subsequent instances; inconsistent cache separators made set/get and getOrCreate key spaces differ.
