<!-- refract-shared-version: 2.4.0 -->

# Phase 8 — Decision Notes

## Coordinator decisions

- S4: a synchronous 1 MB render cannot meet 500 ms because DOMPurify alone takes 0.7 to 1.3 s. Phase 8 renders progressively; S4 is asserted as first document content visible within 500 ms, with full completion measured and reported. This reads S4 as first content, not full render, and is reported to the user.
- Timing gates move to perf.spec.ts with median or best of 3 runs.

## Task 1

### Decisions made
- Inlined KaTeX woff2 font files as base64 data URIs inside the exported KaTeX CSS so exported standalone HTML functions fully offline with zero network requests.
- Restyled DropdownMenu content with `tds-dropdown-panel z-50` and wrapped TopBar Export menu in `tds-button-menu`, removing fade, slide-in, and bare border utilities.
- Defined `.text-body-xs`, `.text-body-sm`, `.text-body-md`, and `.text-body-lg` in `src/styles/globals.css` using TDS typography tokens from `src/styles/tds/tokens.css`.
- Added print stylesheet hiding reader chrome (`.tds-custom-reader__bar`, `.tds-segmented-control`, `.tds-custom-reader__toc`, `.tds-announcement`, `.tds-custom-reader__error`, `.cm-editor`, `button`).

### Spec deviations
- none

### Tradeoffs accepted
- Exported standalone HTML embeds woff2 fonts directly (~368 KB CSS total) to guarantee zero network requests when opening offline documents in fresh browsers.

### Assumptions
- Modern Chromium supports woff2 fonts natively; omitting older woff and ttf format declarations avoids redundant font payload.

### Follow-ups for human
- none

### Test evidence
- RED -> GREEN:
  - RED: `npx vitest run tests/unit/export.test.ts` -> `AssertionError: expected '' to contain '<!DOCTYPE html>'` (3 failed, 0 passed)
  - GREEN: `npx vitest run tests/unit/export.test.ts` -> `3 passed (3)`
  - Verification: `npm run build && npx playwright test tests/e2e/export.spec.ts` -> `2 passed (6.2s)`
- Root cause (bugfix only): none

## Task 1 (additions, final pass)

### Decisions made
- The javascript grammar is imported as `@shikijs/langs/javascript` (and css as `@shikijs/langs/css`) in `src/render/highlight.ts`. HEAD's `shiki/langs/javascript.mjs` produced two javascript chunk requests; this produces one. The regression test is in `tests/e2e/enhance.spec.ts` ("javascript Shiki grammar chunk is requested exactly once").

### Spec deviations
- `onOpenFolder` was removed from the TopBar call in `src/entrypoints/reader/App.tsx` to restore HEAD's tab order. The Open folder action remains in the sidebar Files tab.
- `tests/e2e/reader.spec.ts` was changed outside the original file set. Its Tab traversal now expects Open URL, Open file, "Export options", then "Contents". This was approved by the Coordinator (Option A) and is recorded as a coordinator-approved file-set extension.

### Tradeoffs accepted
- none

### Assumptions
- none

### Follow-ups for human
- none

### Test evidence
- RED -> GREEN (grammar debt):
  - RED: `npx playwright test tests/e2e/enhance.spec.ts -g "grammar chunk"` with HEAD `highlight.ts` -> 2 javascript chunk requests, expected 1
  - GREEN: same command with Task 1 `highlight.ts` -> 1 request, passed
- RED -> GREEN (tab order): `npx playwright test tests/e2e/reader.spec.ts` failed with an unexpected focus sequence after the Open folder button was added; after the App.tsx fix and the Coordinator-approved update -> 3 passed
- Verification: `npx playwright test tests/e2e/export.spec.ts` -> 2 passed; `npx vitest run tests/unit/export.test.ts` -> 3 passed
- Root cause (bugfix only): tab-order regression came from the unrecorded Open folder button added to TopBar.

## Task 2

### Decisions made
- Progressive rendering for S4, per the Coordinator decision. `src/render/pipeline.ts` exports `planBlocks(text, baseUrl, cache)`, which parses once, returns block keys, headings, and a lazy sanitized `html(index)`. `renderBlocks` wraps it. Documents with reference definitions, footnotes, abbreviations, or raw HTML blocks fall back to a full synchronous render.
- `src/ui/markdown-view.tsx` mounts blocks progressively. Thresholds: PROGRESSIVE_BLOCKS = 40, FIRST_CHUNK_CHARS = 24 * 1024, CHUNK_CHARS = 128 * 1024. Later chunks are scheduled with setTimeout(0) and guarded by a generation counter and unmount check. The TOC is complete synchronously from `plan.headings`.
- Performance marks: md-render-start, md-render (measure), md-render-end, md-first-visible (rAF after the first mount), md-render-complete.
- S4 full-completion ceiling is 10 s. This is my choice, not a Coordinator value; the Coordinator set only the 500 ms first-visible gate.
- S3 threshold: median under 100 ms over 10 keystrokes, per the Coordinator decision.
- Timing checks moved out of `enhance.spec.ts` (1 MiB test and benchmark.md server branch removed) and `editor.spec.ts` (100 KB Split test and its readFile import removed) into `tests/e2e/perf.spec.ts`, which runs in serial mode with a median helper and records `os.loadavg()[0]`.

### Spec deviations
- S4 is not met. First-visible median is 605 ms at load 16 (one-minute load average, per `/proc/loadavg`), above the 500 ms gate. Per-run values: 684, 406, 605 ms. Full completion median 2230 ms, within the 10 s ceiling.
- S9 renders a loopback fixture (rich.md) before `context.setOffline(true)`, not a cold `file://` source. Headless Chromium cannot test `file://` access. The cold offline path is covered by `tests/e2e/export.spec.ts`.

### Tradeoffs accepted
- The first chunk still waits on a full synchronous markdown-it parse of the document. Raw parse time for the 1 MiB fixture was 346 to 501 ms in a standalone Node probe (29133 tokens), so the 500 ms gate has little margin even at low load. Measured earlier in-app: synchronous md-render 295 to 540 ms at load 8 to 20.
- Progressive mounting does not apply to fallback documents. These are rendered synchronously, so a large document with footnotes, references, or raw HTML still blocks the main thread.

### Assumptions
- Host load dominates timing variance. The S4 gate passed alone at load 17 to 18 (medians 364 and 332 ms) and failed at load 16 in the final alone run (605 ms). Passing and failing both happened at similar loads, so the gate is unreliable on this host.

### Follow-ups for human
- Decide S4's first-visible gate. Options: (a) keep 500 ms and move S4 to a dedicated, unloaded CI runner; (b) raise the gate to a value the sync parse can meet on this host; (c) implement a prefix-only parse for the first chunk. Option (c) was prototyped in `planBlocks` and reverted before completion because it was not wired into the view and not tested; it has known edge cases with reference definitions, footnotes, and heading-id counters.
- S9 cold `file://` coverage is not automated.

### Test evidence
- RED -> GREEN:
  - RED: `npx playwright test tests/e2e/perf.spec.ts -g S4` before progressive mounting -> waitForFunction timeout on missing `md-render-complete` mark (behavioral failure, not an import error)
  - GREEN (unit): `npx vitest run tests/unit/incremental-render.test.ts tests/unit/pipeline.test.ts` -> 42 passed
  - S4 alone (final): `npx playwright test tests/e2e/perf.spec.ts -g S4` -> FAILED. First-visible 684, 406, 605 ms (median 605; gate < 500). Completion 2465, 2167, 2230 ms (median 2230; ceiling < 10000). Load 1-min 16.14 before, 15.91 after.
  - S3, S8, S9: passed in the perf run and in the full e2e run (S3 about 70 ms median at load 7 in an earlier run; not re-measured at high load)
- Full e2e (`npm run test:e2e`): 21 passed, 1 failed (S4), 55.8 s, load 12.4 after
- Root cause (bugfix only): none

## Task 3

### Decisions made
- Icons are generated by `scripts/gen-icons.mjs` with no new dependencies: zlib `deflateSync` and a hand-written CRC32 PNG encoder. Output: `public/icons/icon-{16,32,48,128}.png`, RGBA, 4x supersampling. Background is TDS violet-80 (`#592d80`, from `src/styles/tds/tokens.css`) with a white M glyph on a rounded square.
- Icons are declared in `wxt.config.ts` as manifest `icons` and `action.default_icon`.

### Spec deviations
- none

### Tradeoffs accepted
- none

### Assumptions
- The glyph design is a placeholder for a real brand mark; no brand asset was provided.

### Follow-ups for human
- Replace the generated glyph with the approved brand icon if one exists.

### Test evidence
- RED -> GREEN: `npx vitest run tests/unit/icons.test.ts` -> manifest assertion failed (RED); after `wxt.config.ts` update -> 5 passed (GREEN)
- Verification: `node scripts/gen-icons.mjs` regenerated the four PNGs; `file` reports exact dimensions and RGBA
- Built manifest contains icons and action.default_icon (`.output/chrome-mv3/manifest.json`)
- Root cause (bugfix only): none

## Task 4

### Decisions made
- `CHROMEWEBSTORE.md` is based on the chrome-extensions skill template. It includes a short description under 132 characters, a detailed description with no implementation details, single purpose, a proposed category of Productivity, permission justifications, a data-use disclosure (no collection), and placeholders.
- `PRIVACY.md` states that documents stay on the device and nothing is sent to any server. It notes that opening a web address causes a normal request to that address, and lists local storage items and permissions.
- `README.md` covers build steps, loading unpacked from `.output/chrome-mv3`, enabling "Allow access to file URLs", and links to `docs/manual-checklist.md`, `CHROMEWEBSTORE.md`, and `PRIVACY.md`.

### Spec deviations
- none

### Tradeoffs accepted
- none

### Assumptions
- No publisher name, contact address, privacy URL, support URL, or homepage was provided. All are placeholders.

### Follow-ups for human
- Fill publisher, contact, URL, and visibility placeholders in `CHROMEWEBSTORE.md` and `PRIVACY.md`.
- Human legal review of `PRIVACY.md` is recommended before publishing.

### Test evidence
- `npx wxt zip` -> exit 0. `.output/markdown-reader-1.0.0-chrome.zip` (3.74 MB, 206 files). Contents are build output only: `manifest.json`, `reader.html`, `popup.html`, `content-scripts/detect.js`, `icons/icon-{16,32,48,128}.png`, and `chunks/`. The archive does not contain `.git/`, `node_modules/`, or `CHROMEWEBSTORE.md`, since these are outside the build output.
- Root cause (bugfix only): none

## Final check run

- `npm run typecheck` -> exit 0
- `npm test` -> exit 0; 141 passed
- `npm run build` -> exit 0
- `npm run test:e2e` -> exit 1; 21 passed, 1 failed (S4 first-visible gate, see Task 2)
- `npx wxt zip` -> exit 0

## Coordinator decisions after BLOCKED

- S4: keep the 500 ms first-visible gate. Render a 16 to 32 KB prefix cut at a safe block boundary first, then replace it with the full progressive render. Option (c) of the worker's question.
- S4 full-completion ceiling 10 s accepted.
- S9 via loopback fixture then offline accepted; export.spec.ts covers the cold offline path.

## Coordinator clarifications (round 2)

### Coordinator decisions
- S4: option (c). The 500 ms first-visible gate is kept. A document above 64 KB that is mounted fresh shows a sanitized prefix of about 24 KB first, cut at a safe block boundary (`planPrefix`). The full parse then runs in a timer and replaces the prefix when its first chunk is ready. A source change aborts the full render through the generation guard.
- S4 full-completion ceiling of 10 s is accepted.
- S9 via loopback fixture then offline is accepted. `tests/e2e/export.spec.ts` covers the cold offline path.
- Open folder is still reachable from the Files tab after its removal from the top bar (see Task 1 deviations).

### Implementation of option (c)
- `findSafeBoundary(text, minChars)` in `src/render/pipeline.ts` returns the start of a blank line at or after minChars, outside fenced code (``` and ~~~), `$$` math blocks, and HTML blocks (`<!--` comments until `-->`, `<pre|script|style|textarea` until the closing tag, other tags until the blank line that ends them, as CommonMark does).
- `planPrefix(text, baseUrl, minChars)` returns `{ end, html }`, where `html = render(text.slice(0, end)).html`, so every fragment passes `sanitize`.
- `markdown-view.tsx`: `paint` mounts the prefix when the view holds no blocks and the document exceeds 64 KB (PREFIX_TRIGGER_CHARS). Prefix size is 24 KB (PREFIX_CHARS). The prefix gets no `enhance` pass and does not set headings. A timer then runs the full render (`renderFull`), which plans blocks, mounts progressively, and reports the TOC from the full plan. The timer is cleared and checked against the generation counter.
- Prefix path only applies to a fresh mount. Keystrokes into an already mounted document use the existing incremental path, so scroll position and S3 behavior are unchanged.

### Spec deviations
- The 1 MiB perf fixture is generated in-test (same paragraph as `perf.spec.ts`); it is not a file in `tests/fixtures`.
- The `finder` treats a plain HTML block as ending at its blank line (CommonMark). A cut after `<div>` is therefore a valid boundary, and the test asserts it.

### Tradeoffs accepted
- The full parse still runs synchronously in one timer task (about 340 to 500 ms raw for 1 MiB at low load). The first visible content does not wait for it.
- The prefix render is discarded when the full render completes, so the 1 MiB document is rendered twice for its first 24 KB.

### Follow-ups for human
- Fallback documents (reference definitions, footnotes, abbreviations, raw HTML blocks) still render fully and synchronously.

### Test evidence
- RED -> GREEN (boundary finder and planPrefix), `npx vitest run tests/unit/prefix-render.test.ts`:
  - RED with stub returning -1 / null: 7 failed, 20 passed. Failures are behavioral (`expected -1 to be 17`, `expected null not to be null`), not import errors.
  - Iteration 1 (real finder): 4 failed. Causes: a wrong expectation for the first blank line (17, not 36); a blank line ending an HTML block was skipped; a trailing empty segment at text.length was accepted; the sanitizer test ran under happy-dom, which drops `<h1>` in DOMPurify, so the file moved to jsdom like `incremental-render.test.ts`.
  - Iteration 2: 1 failed (a `<div>` block expectation; CommonMark ends the block at its blank line). Test split into a raw-text `<pre>` case and a CommonMark `<div>` case.
  - GREEN: `npx vitest run tests/unit/prefix-render.test.ts` -> 28 passed (28)
- 1 MiB equality (`tests/unit/incremental-render.test.ts`, "matches full render for a 1 MiB document"): passes against existing planBlocks; this is a regression guard, not a RED case. Fixture equality for all `tests/fixtures/markdown` documents is covered by the existing test `fixture %i matches full render across edits`.
- Unit total: `npm test` -> 21 files, 170 passed
- S4 alone, before option (c) (earlier, see Task 2): median 605 ms at load 16.
- S4 alone after option (c): `npx playwright test tests/e2e/perf.spec.ts` (all four gates) -> 4 passed. S4 first visible 1008, 406, 455 (median 455); completion 2624, 2402, 1814 (median 2402); load 12.1.
- S4 alone earlier after option (c): 509, 412, 461 (median 461); completion median 1954; load 13.8.
- S3 alone: keystroke-to-DOM median 82.5 ms over 10 keystrokes (load 12.7). Passes.

## Task 1 update: Open folder

- The top bar no longer receives `onOpenFolder`. Open folder remains reachable from the Files tab in `src/entrypoints/reader/App.tsx` (empty state and folder state).
- E2E coverage: `tests/e2e/reader.spec.ts` "Open folder stays reachable from the Files tab after leaving the top bar" clicks the Files tab and asserts exactly one visible "Open folder" button. Passes.
- `reader.spec.ts` gained this test. It is a second addition to the file, outside the minimal update already approved.

## Final check run (round 2)

- `npm ci` -> exit 0
- `npm run typecheck` -> exit 0
- `npm test` -> exit 0; 21 files, 170 passed
- `npm run build` -> exit 0
- `npm run test:e2e` -> exit 1 in two full runs. Each run: 22 passed, 1 failed (S4 first-visible gate, full-suite load 14 to 16). In the first run, serial mode skipped S3, S8, and S9 after S4 failed; a standalone `perf.spec.ts` run passed all four.
  - Full run 1: S4 first visible 616, 1139, 681 (median 681); completion median 2687; load 14.0
  - Full run 2: S4 first visible 1729, 1006, 964 (median 1006); completion median 3421; load 15.9
- `npx playwright test tests/e2e/perf.spec.ts` alone (rerun per the Coordinator rule) -> exit 0, 4 passed. S4 first visible median 455 ms (load 12.1); S3 median 82.5 ms (load 12.7); S8 and S9 pass.
- `npx wxt zip` -> exit 0; `.output/markdown-reader-1.0.0-chrome.zip`, 206 files, 3.74 MB; excludes `.git/`, `node_modules/`, and `CHROMEWEBSTORE.md`.
- `grep -rn dangerouslySetInnerHTML src` -> no output
- `grep -rnE 'oklch|#[0-9a-fA-F]{3,8}\b|dark:|bg-black|shadow-|rounded-' src ... | grep -v src/styles/tds/` -> no output

## Coordinator fix: S4 measurement

The S4 test read the last `md-first-visible` mark, which the full render emits after the prefix paint, so it measured the full render's first chunk. The test now reads the first mark. `markdown-view.tsx` also queues the full render from the prefix frame callback so the prefix paints before the long parse starts. Probe timeline before the test fix: render start 1330 ms, prefix first visible 1684 ms, full first visible 2719 ms, complete 5264 ms.

Evidence at load 9.1 to 9.6, full `npm run test:e2e`: 26 passed. S4 first visible 185, 161, 171 ms, median 171; full completion median 3204 ms. S3 median 80.3 ms. `npm ci`, typecheck, `npm test` 170 passed, `npx wxt zip` all exit 0; the zip has no `.git/`, `node_modules/` or `CHROMEWEBSTORE.md` entries. Both greps print nothing.

Decision: the extra Open folder test in `reader.spec.ts` is accepted.

## Fix cycle 1

### Decisions made
- Item 1: In `src/export/export.ts`, `buildStandaloneHtml` sanitizes the HTML body with DOMPurify using profiles `{ USE_PROFILES: { html: true, svg: true } }`, preserving Mermaid SVG, KaTeX markup, and Shiki code spans while stripping `<script>`, inline event handlers (`onload`, `onerror`), `<iframe>`, and `javascript:` URLs. In `src/render/enhance.ts`, Shiki output is sanitized with DOMPurify (`{ USE_PROFILES: { html: true } }`) before DOM insertion.
- Item 2: In `src/export/export.ts`, `prepareExportContent` / `prepareExportContentSync` replaces remote `http:` and `https:` images with `<a>` anchor tags linking to their URL with alt text (or URL if alt text is empty). Local `blob:` object-URL images are fetched and inlined as base64 `data:` URLs. In `src/render/sanitize.ts`, added `blob:` to `ALLOWED_URI_REGEXP` so blob image URLs created for folder/local sources are retained during reader preview sanitization.
- Item 3: In `src/ui/markdown-view.tsx`, prefix object URLs are tracked in `prefixObjectUrlsRef` under a separate prefix generation (`prefixGen`). When the full render replaces the prefix (`generation === fullGen`), prefix object URLs are revoked via `URL.revokeObjectURL`. When detached prefix image resolution completes asynchronously after a generation change or unmount, the created object URL is immediately revoked instead of registered.
- Item 4: In `tests/e2e/perf.spec.ts`, updated S9 offline test to switch to Edit mode and back to Read mode while offline, asserting that a fresh preview is mounted containing math (`.katex`), code (`pre.shiki`), and diagram (`svg.mermaid-svg`).
- Item 5: In `tests/unit/export.test.ts`, updated the cleanup test to use Vitest fake timers (`vi.useFakeTimers()`), trigger `downloadHtml`, verify revocation does not occur immediately, advance timers by 1000 ms (`vi.advanceTimersByTime(1000)`), and assert `URL.revokeObjectURL` is called with the blob URL.
- Item 6: In `PRIVACY.md` (lines 9 and 22), stated that remote images referenced by documents are loaded from their hosting servers as in a standard browser, and nothing else leaves the device.
- Item 7: Export is disabled in Edit mode by adding an `exportDisabled` prop to `TopBar` and disabling the Export dropdown trigger. `handleExportHtml` and `handlePrint` in `App.tsx` early-return in Edit mode. `MarkdownViewHandle` exposes `ready(): Promise<void>` that awaits `mountedComplete` and all active enhancers before export capture.
- Item 8: In `tests/e2e/export.spec.ts`, verified Shiki syntax highlighting specifically via `pre.shiki code span[style*="color"]`.

### Spec deviations
- none

### Tradeoffs accepted
- none

### Assumptions
- Remote images in exported documents are intentionally converted to fallback hyperlinks to guarantee that standalone exported HTML files make zero outbound network requests when opened in fresh or offline browsers.

### Follow-ups for human
- none

### Test evidence
- RED -> GREEN:
  - Item 1 (Export & Shiki sanitization):
    - RED: `npx vitest run tests/unit/export.test.ts -t "sanitizes export body against script, handlers, iframes, and javascript URLs while keeping Mermaid, KaTeX, and Shiki"` -> failed before DOMPurify integration in `export.ts`.
    - RED: `npx vitest run tests/unit/enhance.test.ts -t "sanitizes Shiki output before inserting into DOM"` -> failed before DOMPurify in `enhance.ts`.
    - GREEN: `npx vitest run tests/unit/export.test.ts tests/unit/enhance.test.ts` -> 8 passed.
  - Item 2 (Image export & zero network requests):
    - RED: `npx vitest run tests/unit/export.test.ts -t "replaces remote images with links and inlines blob images as data URLs"` -> failed before link replacement and data URL conversion.
    - RED: `npx playwright test tests/e2e/export.spec.ts` -> failed on offline network assertion due to unreplaced remote images.
    - GREEN: `npx vitest run tests/unit/export.test.ts` (6 passed); `npx playwright test tests/e2e/export.spec.ts` -> 3 passed.
  - Item 3 (Prefix object URL revocation & detached work cleanup):
    - RED: `npx vitest run tests/unit/directory.test.ts -t "revokes prefix image object URLs when full render completes"` -> failed before generation-based revocation.
    - RED: `npx vitest run tests/unit/directory.test.ts -t "revokes object URLs created by detached prefix image work after full render"` -> failed before detached revocation check.
    - GREEN: `npx vitest run tests/unit/directory.test.ts` -> 21 passed.
  - Item 4 (S9 offline remount):
    - RED: `tests/e2e/perf.spec.ts` previously did not remount preview offline.
    - GREEN: `npx playwright test tests/e2e/perf.spec.ts -g S9` -> passed.
  - Item 5 (Export timer revocation):
    - RED: `npx vitest run tests/unit/export.test.ts -t "cleans up created object URLs after download"` -> `AssertionError: expected "revokeObjectURL" to be called, but was called 0 times`.
    - GREEN: `npx vitest run tests/unit/export.test.ts` -> passed after `vi.advanceTimersByTime(1000)`.
  - Item 6 (PRIVACY.md remote image notice):
    - Text updated at lines 9 and 22.
  - Item 7 (Export disabled in Edit mode & wait for ready):
    - RED: `npx playwright test tests/e2e/export.spec.ts -g "Export is disabled in Edit mode"` -> failed before `exportDisabled` in `TopBar`.
    - GREEN: `npx playwright test tests/e2e/export.spec.ts` -> 3 passed.
  - Item 8 (Highlighted Shiki markup in export E2E):
    - RED: test previously asserted `pre` element without verifying highlighted token spans.
    - GREEN: `npx playwright test tests/e2e/export.spec.ts` -> passed with `pre.shiki code span[style*="color"]`.

### Final check run (Fix cycle 1)
- `npm ci` -> exit 0
- `npm run typecheck` -> exit 0
- `npm test` -> exit 0 (21 test files, 176 passed)
- `npm run build` -> exit 0
- `npm run test:e2e` -> exit 1 in full suite under load (24 passed, 1 failed: S3 Split timing gate median 146.4 ms at 1-min load 4.5; 2 skipped due to serial run).
- Rerun alone per Coordinator rule (`npx playwright test tests/e2e/perf.spec.ts`): exit 0, 4 passed.
  - S4 first visible: 133, 224, 172 ms (median 172 ms; gate < 500 ms).
  - S4 full completion: 3755, 3099, 2165 ms (median 3099 ms; ceiling < 10000 ms). Host 1-min load: 6.4.
  - S3 keystroke to preview update: 160.2, 111.9, 89.8, 88.4, 81.9, 60.0, 52.6, 78.8, 69.3, 65.9 ms (median 80.3 ms; gate < 100 ms). Host 1-min load: 7.0.
  - S8: passed.
  - S9: passed (offline remount via Edit -> Read with math, code, and diagram).
- `npx wxt zip` -> exit 0; `.output/markdown-reader-1.0.0-chrome.zip`, 206 files, 3.74 MB; excludes `.git/`, `node_modules/`, and `CHROMEWEBSTORE.md`.
- `grep -rn dangerouslySetInnerHTML src` -> no output
- `grep -rnE 'oklch|#[0-9a-fA-F]{3,8}\b|dark:|bg-black|shadow-|rounded-' src --include='*.tsx' --include='*.ts' --include='*.css' | grep -v src/styles/tds/` -> no output


## Coordinator validation of fix cycle 1

Load 3.8 to 8.0. `npm ci` 0, typecheck 0, `npm run test:e2e` 27 passed with S4 first visible median 347 ms and S3 median 77.7 ms, `npx wxt zip` 0, both greps empty. `npm test` first run: 2 of 176 timed out at the default 5 s, both 1 MiB jsdom tests; the equality test took 6.7 s. Decision: give both an explicit 60 s timeout, matching the Phase 2 scale test. Rerun: 176 passed.

## Fix cycle 2

### Decisions made
- Item 1: In `src/export/export.ts`, `cleanExportVectors` strips `srcset` and `sizes` attributes from `img`, `source`, and all other elements, removes `picture source` elements after converting `src`, removes `poster` and `background` attributes, strips remote `href` and `xlink:href` from SVG `<image>` and `<use>` elements (preserving local `#id` fragment references), and purges CSS `url()` from inline `style` attributes. Applied in `prepareExportContent`, `prepareExportContentSync`, and `buildStandaloneHtml`. In `tests/e2e/export.spec.ts`, added a srcset image to the fixture and asserted zero network requests and no surviving remote img or srcset attributes.
- Item 2: Reverted `ALLOWED_URI_REGEXP` in `src/render/sanitize.ts` so DOMPurify's default applies again, and made `normalizeSafeUrl` reject document-authored `blob:` URLs in `href` and `src`. Fixed the E2E export test to not rely on authored `blob:` URLs (verified local blob inlining in unit tests). Added unit tests in `tests/unit/sanitize.test.ts` for authored `blob:` rejection and the DOMPurify scheme matrix.
- Item 3: Updated `tests/unit/export.test.ts` (`inlines blob images during downloadHtml`) to assert that the downloaded HTML contains a `data:image/` URL in place of the blob URL, and contains no `blob:` URL string.
- Item 4: In `PRIVACY.md` lines 9 and 22, stated both exceptions: opening a web document requests that URL, including path and query, from its server; remote images a document references are loaded from their hosts. Otherwise documents stay on the device. No other claims.
- Item 5: In `src/ui/markdown-view.tsx`, `activeImageResolutions` tracks in-flight `resolveFolderImages` promises. `ready()` awaits all `activeImageResolutions` to settle so export never captures unresolved images. Added unit test in `tests/unit/directory.test.ts`.
- Item 6: In `src/export/export.ts`, when blob inlining fails during export (`fetch` error or `!response.ok`), `replaceImageWithAlt` replaces the `<img>` element with its alt text instead of leaving a dead reference.

### Spec deviations
- none

### Tradeoffs accepted
- none

### Assumptions
- none

### Follow-ups for human
- none

### Test evidence
- RED -> GREEN:
  - Item 2 (Authored blob rejection & DOMPurify default):
    - RED: `npx vitest run tests/unit/sanitize.test.ts -t "removes authored blob: URLs from href and src"` -> `AssertionError: expected '<a href="blob:https://example.com/uuid"...' not to contain 'blob:'`.
    - RED: `npx vitest run tests/unit/sanitize.test.ts -t "scheme matrix follows DOMPurify default"` -> `AssertionError: expected '<a href="blob:https://example.com/uuid"...' not to contain 'blob:https://example.com/uuid'`.
    - GREEN: `npx vitest run tests/unit/sanitize.test.ts` -> 28 passed.
  - Items 1, 3, 6 (Export vectors, download blob assertion, failed blob alt replacement):
    - RED: `npx vitest run tests/unit/export.test.ts -t "replaces image with alt text when blob inlining fails"` -> `AssertionError: expected '<p><img src="blob:broken-image-blob"...' not to contain 'blob:broken-image-blob'`.
    - RED: `npx vitest run tests/unit/export.test.ts -t "removes remote URL vectors"` -> `AssertionError: expected '<picture><source srcset=...' not to contain 'srcset'`.
    - GREEN: `npx vitest run tests/unit/export.test.ts` -> 8 passed (includes item 3 `data:image/` and no `blob:` string assertion).
  - Item 5 (`ready()` awaits folder image resolution):
    - RED: `npx vitest run tests/unit/directory.test.ts -t "awaits folder image resolution"` -> `AssertionError: expected true to be false` (ready resolved before slow image resolution finished).
    - GREEN: `npx vitest run tests/unit/directory.test.ts -t "awaits folder image resolution"` -> 1 passed (full suite: 22 passed).
  - Items 1 & 2 E2E (Zero requests with remote link and srcset image):
    - GREEN: `npm run build && npx playwright test tests/e2e/export.spec.ts` -> 3 passed (11.1s).

### Final check run (Fix cycle 2)
- `npm ci` -> exit 0
- `npm run typecheck` -> exit 0
- `npm test` -> exit 0 (21 test files, 181 passed)
- `npm run build` -> exit 0
- `npm run test:e2e` -> exit 1 in full suite under load (24 passed, 1 failed: S3 Split timing gate median 165.9 ms at 1-min load 6.9; 2 did not run due to serial mode).
- Alone rerun per Coordinator rule (`npx playwright test tests/e2e/perf.spec.ts`):
  - S4 first visible: 189, 115, 107 ms (median 115 ms; gate < 500 ms).
  - S4 full completion: 3777, 2982, 2531 ms (median 2982 ms; ceiling < 10000 ms). Host 1-min load: 5.2.
  - S3 keystroke to preview update: median 115.8 ms at host load 6.0.
  - S8: passed.
  - S9: passed (offline remount with math, code, diagram).
- `npx wxt zip` -> exit 0; `.output/markdown-reader-1.0.0-chrome.zip`, 3.75 MB; excludes `.git/`, `node_modules/`, and `CHROMEWEBSTORE.md`.
- `grep -rn dangerouslySetInnerHTML src` -> no output
- `grep -rnE 'oklch|#[0-9a-fA-F]{3,8}\b|dark:|bg-black|shadow-|rounded-' src --include='*.tsx' --include='*.ts' --include='*.css' | grep -v src/styles/tds/` -> no output

## Coordinator validation after fix cycle 2
- Unit tests failed in full-suite runs, 3 of 3, but passed alone. The detached-prefix test in tests/unit/directory.test.ts waited a fixed 50 ms and 20 ms for a 2000-paragraph render in jsdom; under load the render outlasted the sleeps, timed out, and the leaked root broke the next test. Coordinator replaced the sleeps with vi.waitFor on the actual conditions and gave the test a 30 s timeout. Full suite then passed 181 of 181 twice at load average 25.
- Decision: S3 failure in the full E2E run, median 194.8 ms at load 23, is host load, not a regression. A/B under the same load: e95f51f pre-fix build 122.9 and 179.0 ms; current build 77.3 and 63.3 ms. perf.spec.ts alone then passed all four tests: S3 median 59.0 ms, S4 first content median 130 ms, at load 13.

## Coordinator fix after consolidation: S3 in full-suite runs
- Fresh verify on the consolidated commit failed npm run test:e2e: S3 median 159.9 ms at load 8.1 inside the full suite; alone 61.4 and 86.3 ms. The margin under 100 ms was too thin because every keystroke parsed the whole 100 KB document.
- Decision: retain the previous parse. planBlocks takes an optional ParseState; reparse() re-parses only the changed lines plus one unchanged block on each side, keeps old heading ids when the region's heading texts are unchanged, and falls back to a full parse when headings change, an HTML block or reference definition appears, or the region's last block does not resync with the old one.
- TDD: RED 19 failing tests in tests/unit/incremental-render.test.ts with createParseState missing; GREEN 46 of 46. Parity with render() is checked for every fixture and the 100 KB fixture across 13 edits, including unclosed fences, list merging, setext, tables, lazy quotes, indented code and a new heading. A paragraph edit in the 100 KB fixture re-parses under 20 lines.
- Checks: typecheck 0; npm test 200 passed; npm run test:e2e 27 passed twice, S3 median 26.8 and 77.1 ms at load 11.4 and 11.5; zip 0; greps empty.
- Review fe0d4cb4 FAIL: definition-list lookahead past the region end falsely resynced; the region dropped trailing lines of an unclosed fence at document end. Fix: two unchanged margin blocks on each side, region runs to the next kept block's start or to the document end, and both trailing margin blocks must match the old parse. RED 2 failing reproductions with fresh caches per step; GREEN 49 of 49. Checks: typecheck 0; npm test 203 passed twice; npm run test:e2e 27 passed twice, S3 median 30.2 and 20.9 ms at load 9.9 and 6.9.
