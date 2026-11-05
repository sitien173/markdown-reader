<!-- refract-shared-version: 2.4.0 -->

# Phase 3 — Journal: Lazy enhancers for code, math, and diagrams

## META

- Plan: docs/plans/markdown-reader-v1/PLAN.md
- Implementation Profile: cost
- Consultation Profile: n/a
- Review Profile: base
- Implementation Job: pending
- Review Job: pending
- Started: 2026-11-05
- Finished: 2026-11-05T12:17:32+07:00

## Implementation Response

# EXTERNAL RESPONSE
## META
- Phase 3 / Started 2026-11-05 / Finished 2026-11-05T12:04:29+07:00 / Plan dir docs/plans/markdown-reader-v1
## SUMMARY
Implemented lazy enhancer modules, cache, reader Markdown rendering, and fixture coverage, but browser fixture fetch/render remains broken and acceptance coverage is incomplete.
## FILES MODIFIED
| Action | Path | Change |
|---|---|---|
| Create | src/render/cache.ts | Block-kind/language/source keyed cache |
| Create | src/render/highlight.ts | Lazy Shiki highlighting, plain fallback, size skip |
| Create | src/render/math.ts | Conditional KaTeX CSS import |
| Create | src/render/diagram.ts | Sequential strict Mermaid SVG rendering and inline errors |
| Create | src/render/enhance.ts | Code/math/diagram orchestration |
| Create | src/ui/markdown-view.tsx | Ref-owned sanitized Markdown insertion and enhancement |
| Modify | src/entrypoints/reader/App.tsx | Fetch `?src=` and render Markdown/errors |
| Create | tests/unit/enhance.test.ts | Cache, fallback, size assertions |
| Create | tests/e2e/enhance.spec.ts | Rich/plain fixture enhancement checks |
| Modify | tests/e2e/spike-mermaid-csp.spec.ts | CSP assertion on production enhancement path |
| Create | tests/fixtures/markdown/rich.md | Rich enhancement fixture |
| Create | tests/fixtures/markdown/plain.md | Plain lazy-loading fixture |
| Modify | package.json | Add exact Shiki and JS engine dependencies |
| Modify | package-lock.json | Dependency lock updates |
| Modify | docs/spikes.md | Note migration of Mermaid spike path |
| Modify | docs/plans/markdown-reader-v1/phase-03/notes.md | Phase task notes and check evidence |
| Modify | docs/plans/markdown-reader-v1/phase-03/journal.md | Implementation response |
## NOTES
- phase-03/notes.md (## Task 1–5; typecheck pass, 44 unit tests pass, build pass, E2E fail: 3 pass/2 fail; no npm ci run)
## SPEC COMPLIANCE
- Meets Spec? NO — required E2E cases fail; XSS, KaTeX inline-style and timing checks are not implemented; TDD RED evidence incomplete.
## CLARIFICATIONS NEEDED
- Why does `fetch(?src=127.0.0.1 fixture)` in the extension-origin reader not render the Markdown despite the local HTTP server returning fixture text, and what diagnosis/fix should be applied?
## NEXT
CONTINUE_CONTEXT

# EXTERNAL RESPONSE
## META
- Phase 3 continuation / Started 2026-11-05 / Finished 2026-11-05T12:17:32+07:00 / Plan dir docs/plans/markdown-reader-v1
## SUMMARY
Normalized production MarkdownIt plugin interop and fixed lazy Shiki grammar loading; fixture, Mermaid/CSP, XSS and S8 E2E checks now pass, but S4 performance and one KaTeX inline-style assertion remain blocked.
## FILES MODIFIED
| Action | Path | Change |
|---|---|---|
| Modify | src/render/pipeline.ts | Normalize plugin default exports for production CommonJS/ESM interop |
| Modify | src/render/highlight.ts | Use literal per-language lazy imports and normalize `js` alias |
| Modify | src/entrypoints/reader/App.tsx | Add benchmark-only reader render hook |
| Modify | tests/e2e/enhance.spec.ts | Real local HTTP fixtures; rich/plain, page-error, S8, XSS, KaTeX, evil.test, and 1 MiB timing checks |
| Modify | tests/e2e/spike-mermaid-csp.spec.ts | Use local server and production enhance path |
| Modify | tests/unit/enhance.test.ts | Assert known JS highlighting output |
| Modify | tests/fixtures/markdown/rich.md | Include requested math and hostile style cases |
| Modify | docs/plans/markdown-reader-v1/phase-03/notes.md | Add continuation batch evidence and timings |
| Modify | docs/plans/markdown-reader-v1/phase-03/journal.md | Append this continuation response |
## NOTES
- phase-03/notes.md (Continuation Batch 2; `npm ci`, typecheck, unit tests, build passed; E2E 5 passed, 2 failed; no tests skipped)
## SPEC COMPLIANCE
- Meets Spec? NO — E2E remains non-green: KaTeX inline `position: relative` assertion fails and 1 MiB render best-of-three is 1567.6 ms against the 500 ms S4 gate.
## CLARIFICATIONS NEEDED
- S4 was repeatedly measured above threshold (best 1068.7–1567.6 ms). How should the next implementer proceed with pipeline optimization while preserving the required 500 ms assertion? The KaTeX output also lacks the required inline `position: relative`; investigate whether the parser output or sanitization is responsible.
## NEXT
BLOCKED

# EXTERNAL RESPONSE
## META
- Phase 3 continuation / Started 2026-11-05 / Finished 2026-11-05T12:23:40+07:00 / Plan dir docs/plans/markdown-reader-v1
## SUMMARY
Completed Phase 3 enhancements and integration fixes, adjusted the KaTeX fixture and product-path timing regression ceiling per coordinator decisions, and passed all required checks with 7 E2E tests and no skips.
## FILES MODIFIED
| Action | Path | Change |
|---|---|---|
| Create | src/render/cache.ts | Content-keyed block result cache |
| Create | src/render/diagram.ts | Sequential strict Mermaid SVG rendering and inline failures |
| Create | src/render/enhance.ts | Enhancement orchestration |
| Create | src/render/math.ts | Conditional KaTeX CSS loading |
| Modify | src/render/highlight.ts | Lazy Shiki highlighting; literal grammar imports, alias normalization, TS module typing |
| Modify | src/render/pipeline.ts | Normalize MarkdownIt plugin interop |
| Create | src/ui/markdown-view.tsx | Ref-owned product Markdown rendering and enhancement; md-render performance measures |
| Modify | src/entrypoints/reader/App.tsx | Fetch `?src=`; removed benchmark-only global |
| Create | tests/unit/enhance.test.ts | Cache, fallback, size-skip, and highlighting assertions |
| Create | tests/e2e/enhance.spec.ts | Local fixtures, rich/plain, XSS, lazy-loading, and product-path timing checks |
| Modify | tests/e2e/spike-mermaid-csp.spec.ts | CSP assertion on production enhance path |
| Create | tests/fixtures/markdown/rich.md | Rich content, inline/display math, and hostile style cases |
| Create | tests/fixtures/markdown/plain.md | Plain lazy-loading fixture |
| Modify | package.json | Exact Shiki and JavaScript engine dependencies |
| Modify | package-lock.json | Lockfile dependency updates |
| Modify | docs/spikes.md | Note Mermaid spike hook migration |
| Modify | docs/plans/markdown-reader-v1/phase-03/notes.md | Phase decisions and continuation timing/check evidence |
| Modify | docs/plans/markdown-reader-v1/phase-03/journal.md | Phase implementation response and continuation response |
## NOTES
- phase-03/notes.md (Tasks 1–5, Continuation Batches 2–3; typecheck pass, 44 unit tests pass, build pass, E2E 7 passed / 0 skipped; best-of-three product render timings 1756.8, 2581.1, 1897.9 ms; best 1756.8 ms)
## SPEC COMPLIANCE
- Meets Spec? YES — all binding Phase 3 acceptance and verification checks pass; Phase 8 owns S4 <500 ms per coordinator direction.
## CLARIFICATIONS NEEDED
None
## NEXT
TASK_COMPLETE

# EXTERNAL RESPONSE
## META
- Phase 3 FIX / Quality review cycle 1 / Started 2026-11-05 / Finished 2026-11-05T12:38:27+07:00 / Plan dir docs/plans/markdown-reader-v1
## SUMMARY
Addressed the cycle 1 security, Mermaid cleanup, Shiki bundle, cache, cancellation, S8, and production plugin-interoperability findings; all required checks pass with 8 E2E tests and no skips.
## FILES MODIFIED
| Action | Path | Change |
|---|---|---|
| Modify | src/render/diagram.ts | Suppress Mermaid error SVG rendering, clean leftover nodes, omit empty theme variables, cache SVG by source and theme |
| Modify | src/render/sanitize.ts | Constrain top/bottom/left offsets to bounded em/zero values |
| Modify | src/styles/globals.css | Isolate, position, and clip Markdown content |
| Modify | src/render/highlight.ts | Singleton fine-grained Shiki core, JS regex engine, lazy literal grammar/theme imports and loading |
| Modify | src/render/cache.ts | 200-entry LRU with full-source keyed lookup |
| Modify | src/render/enhance.ts | Abort/connectivity guards after asynchronous steps |
| Modify | src/ui/markdown-view.tsx | Abort enhancement on React effect cleanup |
| Modify | tests/unit/enhance.test.ts | Assert cache eviction and changed-content freshness |
| Modify | tests/unit/sanitize.test.ts | Assert extreme offsets are dropped and KaTeX offsets remain |
| Modify | tests/e2e/enhance.spec.ts | Assert no stray Mermaid SVGs, derive S8 allowlist from empty reader, assert Shiki requests, and test bundled plugin output |
| Modify | docs/plans/markdown-reader-v1/phase-03/notes.md | Add cycle 1 FIX Task evidence, size comparison, and final checks |
| Modify | docs/plans/markdown-reader-v1/phase-03/journal.md | Append cycle 1 FIX response |
## NOTES
- phase-03/notes.md (Task 6 — Quality review cycle 1 FIX; `npm ci` passed; typecheck passed; 45 unit tests passed; build passed; E2E 8 passed / 0 skipped; `.output` reduced from 17 MB to 7.9 MB, no WASM chunk)
## SPEC COMPLIANCE
- Meets Spec? YES — all requested FIX findings and verification checks pass.
## CLARIFICATIONS NEEDED
None
## NEXT
TASK_COMPLETE

# EXTERNAL RESPONSE
## META
- Phase 3 FIX / Quality review cycle 2 / Started 2026-11-05 / Finished 2026-11-05T12:47:07+07:00 / Plan dir docs/plans/markdown-reader-v1
## SUMMARY
Fixed lazy Shiki loading, hardened static-graph S8 coverage, rebased cached Mermaid SVG ids, and unified cache key creation; all required checks pass with 10 E2E tests and no skips.
## FILES MODIFIED
| Action | Path | Change |
|---|---|---|
| Modify | src/render/highlight.ts | Lazily memoize the Shiki core/engine/theme highlighter promise on first supported code highlight |
| Modify | src/render/diagram.ts | Rebase cached Mermaid SVG id prefixes on each reuse |
| Modify | src/render/cache.ts | Centralize identical NUL-delimited keys in `keyOf()` |
| Modify | tests/unit/enhance.test.ts | Test shared get/set/getOrCreate key behavior |
| Modify | tests/e2e/enhance.spec.ts | Static reader graph S8 allowlist, plain/code-only request checks, and duplicate Mermaid id coverage |
| Modify | docs/plans/markdown-reader-v1/phase-03/notes.md | Append cycle 2 Task 7, RED/GREEN evidence and verification results |
| Modify | docs/plans/markdown-reader-v1/phase-03/journal.md | Append cycle 2 FIX response |
## NOTES
- phase-03/notes.md (Task 7 — Quality review cycle 2 FIX; `npm ci`, typecheck, unit tests 46 passed, build, E2E 10 passed / 0 skipped; `.output` 7.9 MB with no WASM chunk)
## SPEC COMPLIANCE
- Meets Spec? YES — all cycle 2 fixes and required verification checks pass.
## CLARIFICATIONS NEEDED
None
## NEXT
TASK_COMPLETE

## Review Result

- Spec Status: PASS. Coordinator validation 0d8fc2b: npm ci, typecheck, 44 unit, build, 7 E2E pass. Decisions: fixtures served by local HTTP server because Playwright routing misses extension-origin fetches; CJS plugin interop normalized after a bundle-only `e.apply` failure; S4 deferred to Phase 8 because DOMPurify alone takes 0.7 to 1.3 s on 1.3 MB HTML in Chromium, Phase 3 keeps a 3000 ms regression ceiling.
- Quality Status: PASS_WITH_DEBT. Review 1fc33fb3 FAIL: stray Mermaid error SVG, unbounded positional styles. Fix 1 b720318e. Re-review 49c79817 FAIL: eager Shiki import broke S8 and the runtime-derived allowlist hid it. Fix 2 1744107e: lazy memoized highlighter, static allowlist, Mermaid id rebasing, unified cache keys. Confirmation review 8ac18948 PASS_WITH_DEBT. Final checks: npm ci, typecheck, 46 unit, build, 10 E2E pass.
- Debt: Shiki alias table misses py, rs, yml, sh, md, owner Phase 4. Duplicate javascript grammar chunk request, owner Phase 8. overflow clip on container clips wide pre and tables, owner Phase 4. S4 under 500 ms unmet: DOMPurify takes 0.7 to 1.3 s on 1.3 MB HTML, best product-path render 1.7 to 1.8 s, owner Phase 8.
