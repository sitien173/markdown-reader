# Phase 3: Lazy enhancers for code, math, and diagrams

## Goal & Outcome
- Plan Goal: Deliver the Chrome MV3 Markdown Reader extension defined in `docs/plans/markdown-reader-v1/DESIGN.md`: one React reader page rendering local files, folders, and URLs through one sanitized pipeline.
- Phase Outcome: `enhance(root)` lazily adds Shiki highlighting, KaTeX CSS and fonts, and themed Mermaid SVGs to rendered Markdown, with per-block caching and inline error blocks. The reader page renders `?src=` through `render()` and `enhance()`. Plain documents load none of the heavy chunks.

## Context & Architecture
- Root: `/home/ngosi/projects/markdown-reader` | Branch: `main` | Base: `refs/plans/markdown-reader-v1/phase-03/base`
- Prior State: Phase 1 skeleton: WXT 0.21.5, React 19.3.1, Tailwind 4.3.4, TDS token bridge, Playwright fixture in `tests/e2e/fixtures.ts`. Phase 2: `render(text, baseUrl): { html, headings }` in `src/render/pipeline.ts` with markdown-it plugins and DOMPurify in `src/render/sanitize.ts`. Mermaid fences emit `<pre class="mermaid">` with escaped source; other fences emit `<pre><code class="language-x">`. KaTeX HTML is emitted at parse time by a static import; KaTeX CSS and fonts are not loaded yet. Unit tests that call `render()` use `// @vitest-environment jsdom` because happy-dom 21 breaks DOMPurify. Checks: `npm run typecheck`, `npm test` (42 pass), `npm run build`, `npm run test:e2e` (4 pass).
- `src/entrypoints/reader/App.tsx` currently shows `?src=` as text and contains a Phase 1 `?spike=mermaid` hook that uses `dangerouslySetInnerHTML`; `tests/e2e/spike-mermaid-csp.spec.ts` depends on it.
- Read first: the Phase 3 section of `docs/plans/markdown-reader-v1/PLAN.md`, DESIGN.md sections "Chosen Approach", "Architecture and Data Flow", "Errors and Edge Cases", success criteria S8 and S9, and `docs/spikes.md`.

## Invariants & Boundaries
- Heavy libraries only via dynamic `import()`: Shiki, KaTeX CSS and fonts, Mermaid. Plain documents must request none of those chunks.
- Shiki 4.6.0 fine-grained core with `@shikijs/engine-javascript`, theme `github-light`, grammars loaded per language on demand. No WASM engine, no `wasm-unsafe-eval`, no CSP change.
- Mermaid 12.3.0: `theme: 'base'`, `securityLevel: 'strict'`, `startOnLoad: false`. `themeVariables` are read from computed TDS custom properties at runtime. No hardcoded hex or oklch colors outside `src/styles/tds/`.
- No `dangerouslySetInnerHTML` and no React children inside the Markdown container. HTML is assigned through a ref only, and it always comes from `render()`.
- Plan-wide: MV3, no `eval` or `new Function`, no inline scripts, no runtime CDN requests, light theme only.
- Versions exact, no `^`. Add only what this phase needs: `shiki` or `@shikijs/core` 4.6.0, `@shikijs/engine-javascript` matching 4.6.0, and the language and theme packages it needs.
- Out of Scope: reader shell layout, TOC, file and folder sources, editor, popup, content script. Phase 4 owns sources and the shell.
- Forbidden: Git state changes, `.env` files, credentials, editing `PLAN.md`, `DESIGN.md`, `.handover.md`, `prompt.md`.

## Files
Allowed production and test paths:
- `src/render/enhance.ts`, `src/render/highlight.ts`, `src/render/math.ts`, `src/render/diagram.ts`, `src/render/cache.ts` (create)
- `src/ui/markdown-view.tsx` (create)
- `src/entrypoints/reader/App.tsx` (modify: render `?src=`, remove the `?spike=mermaid` hook)
- `tests/unit/enhance.test.ts`, `tests/e2e/enhance.spec.ts` (create)
- `tests/e2e/spike-mermaid-csp.spec.ts` (modify: assert Mermaid under CSP through the real enhance path instead of the removed hook)
- `tests/fixtures/markdown/rich.md`, `tests/fixtures/markdown/plain.md` (create)
- `package.json`, `package-lock.json` (modify)
- `src/styles/globals.css` (modify only for Markdown container or error-block styling using TDS tokens)
- `docs/spikes.md` (modify only to note that the spike hook moved to the enhance path)

Worker-owned phase records:
- `docs/plans/markdown-reader-v1/phase-03/notes.md` (append `## Task <M>` blocks)
- `docs/plans/markdown-reader-v1/phase-03/journal.md` (append `# EXTERNAL RESPONSE` under `## Implementation Response`)

## Tasks
- task-1: `cache.ts`: a content-hash keyed cache so unchanged blocks reuse prior output across re-renders. The key must include everything that affects output: block kind, language, and full source. Changed content must never return stale output. Unit test.
- task-2: `highlight.ts`: Shiki fine-grained core with the JS regex engine; unknown languages fall back to plain text; blocks over 200 KB are skipped. Unit test fallback and the size skip.
- task-3: `math.ts` loads KaTeX CSS and fonts only when `.katex` nodes exist. `diagram.ts` renders each `pre.mermaid` in order; an invalid diagram becomes an inline error block that shows the source as text, and the next block still renders. Mermaid SVG output is inserted into the DOM only from Mermaid's strict-mode output.
- task-4: `enhance(root)` runs highlight, math, and diagram passes and uses the cache. `markdown-view.tsx` takes Markdown text and a base URL, calls `render()`, assigns `html` through a ref, then calls `enhance()` on that node. `App.tsx`: when `?src=` is present, `fetch()` it, render the text through `markdown-view`, and show a plain text error on fetch failure. Remove the `?spike=mermaid` hook and update `spike-mermaid-csp.spec.ts` to assert an SVG renders from a Mermaid fence with no `Content Security Policy` console message.
- task-5: `tests/e2e/enhance.spec.ts`. Serve fixtures to the reader with Playwright routing on an `http://` URL passed as `?src=`, for example `http://fixtures.test/rich.md`. Assert:
  - `rich.md` shows Shiki-highlighted spans, KaTeX output with KaTeX CSS applied, and at least one Mermaid `<svg>`; an invalid Mermaid block shows an error and the following block still renders.
  - S8: while loading `plain.md`, no request URL contains a Shiki, KaTeX, or Mermaid chunk. Identify chunk names from the build output and record them in notes.
  - XSS in Chromium: a document of hostile vectors from `tests/fixtures/markdown/xss.md` produces no dialog, no `script` element, and no `on*` attribute inside the container.
  - KaTeX styles in Chromium: `\hat{a}`, `\sum_{i}^n`, and `\colorbox{red}{x}` keep `left`, `position: relative`, and `background-color` in their inline styles. A raw `<span style="background:url(http://evil.test/a)">` produces no request to `evil.test`.
  - Timing: generate a realistic ~1 MiB Markdown document in the page, as in the Phase 2 256 KiB test but at 1 MiB, and time `render()` in the reader page with `performance.now()`. Take the best of 3 runs after one warm-up and print the timings. Assert under 500 ms, which is S4. If it consistently exceeds that, do not weaken it silently: record the measured numbers in notes and return `NEXT: BLOCKED` with the numbers.
- Use TDD per task: write the failing test, observe a behavioral failure, implement, record RED -> GREEN in notes.

## Done When
- Each acceptance item in task-5 passes in E2E, and unit tests cover cache, highlight fallback, and size skip.
- `grep -rn dangerouslySetInnerHTML src` prints nothing.
- `grep -rnE 'oklch|#[0-9a-fA-F]{3,8}\b' src --include='*.css' --include='*.tsx' --include='*.ts' | grep -v 'src/styles/tds/'` prints nothing.
- Run from `/home/ngosi/projects/markdown-reader`, each exits 0 with no skipped tests:
  - `npm ci` (Baseline: exits 0)
  - `npm run typecheck` (Baseline: exits 0)
  - `npm test` (Baseline: 42 pass)
  - `npm run build` (Baseline: exits 0)
  - `npm run test:e2e` (Baseline: 4 pass)

## Rules
Read and follow these bundled contracts:
- Contract: `/home/ngosi/projects/refract/plugin/shared/worker-contract.md`
- Response: `/home/ngosi/projects/refract/plugin/shared/erp.md`
- Notes: `/home/ngosi/projects/refract/plugin/shared/notes-template.md`
- Journal: `/home/ngosi/projects/refract/plugin/shared/journal-template.md`

Role boundary: You are the phase implementer, not Coordinator. Work directly in `/home/ngosi/projects/markdown-reader`. Do not run Git commits, resets, stashes, branch changes, or ref updates. Do not invoke Coordinator skills or submit nested jobs. Use `refract ask "<question>"` for unresolved spec questions, or return `NEXT: BLOCKED` if unavailable.

## Response Format
Append the complete `# EXTERNAL RESPONSE` block to `docs/plans/markdown-reader-v1/phase-03/journal.md`, then return that block and the matching status line from `erp.md`.
