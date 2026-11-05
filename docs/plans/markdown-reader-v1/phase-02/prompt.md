# Phase 2: Render pipeline and plugins

## Goal & Outcome
- Plan Goal: Deliver the Chrome MV3 Markdown Reader extension defined in `docs/plans/markdown-reader-v1/DESIGN.md`: one React reader page rendering local files, folders, and URLs through one sanitized pipeline.
- Phase Outcome: A pure function `render(text: string, baseUrl: string): { html: string; headings: Heading[] }` in `src/render/pipeline.ts` that runs markdown-it with every DESIGN.md plugin, sanitizes with DOMPurify, rewrites links, and returns heading data. Every plugin has a fixture and a test; at least 10 XSS vectors are neutralized; a 1 MB document renders in under 400 ms in Vitest.

## Context & Architecture
- Root: `/home/ngosi/projects/markdown-reader` | Branch: `main` | Base: `refs/plans/markdown-reader-v1/phase-02/base`
- Prior State: Phase 1 delivered a WXT 0.21.5 + React 19.3.1 + Tailwind 4.3.4 skeleton with TDS token bridge. Scripts: `npm run typecheck`, `npm test` (Vitest 5.1.0, happy-dom 21.0.4, includes `tests/unit/**/*.{test,spec}.ts`), `npm run build`, `npm run test:e2e`. `@/*` resolves to `src/*`. TypeScript 7.0.2, strict. All Phase 1 checks pass.
- Code Context: No `src/render/` yet. This phase is pure library code; it does not touch UI or entrypoints.
- Read first: `docs/plans/markdown-reader-v1/DESIGN.md` ("Chosen Approach" versions, "Architecture and Data Flow", "Errors and Edge Cases") and the Phase 2 section of `docs/plans/markdown-reader-v1/PLAN.md`.

## Invariants & Boundaries
- Preserve: all Phase 1 checks keep passing. Do not modify Phase 1 files other than `package.json` and `package-lock.json`.
- `render()` is pure: no `chrome.*` calls, no DOM mutation outside DOMPurify's own internal use, deterministic output for the same input.
- Sanitization runs inside `render()`; no plugin output reaches the return value without passing DOMPurify.
- No syntax highlighting, no browser math rendering step, no Mermaid rendering in this phase:
  - Math: `@vscode/markdown-it-katex` emits KaTeX HTML at parse time. Coordinator decision: the `katex` JS used by this plugin is a static import of the pipeline; the plan's lazy-load rule for KaTeX applies to KaTeX CSS and fonts, which Phase 3 loads. Do not import KaTeX CSS here.
  - Mermaid: fences with info `mermaid` emit `<pre class="mermaid">` containing the HTML-escaped source, nothing else.
  - Other code fences emit `<pre><code class="language-x">` with escaped source (markdown-it default).
- Versions, exact (no `^`): markdown-it 15.0.3, markdown-it-emoji 3.1.0, markdown-it-footnote 4.0.0, markdown-it-anchor 10.0.0, markdown-it-mark 4.0.0, markdown-it-abbr 2.0.0, markdown-it-sub 2.0.0, markdown-it-sup 2.0.0, markdown-it-deflist 4.0.0, markdown-it-task-lists 2.1.1, markdown-it-github-alerts 1.0.1, @vscode/markdown-it-katex 1.1.2, katex 0.19.1, dompurify 3.4.17. Type packages (for example `@types/markdown-it`) as exact-pinned devDependencies only if needed for typecheck; where a plugin has no types, add a minimal local `declare module` in `src/render/` and list it in notes.
- Out of Scope: `enhance.ts`, UI, entrypoint changes, Shiki, Mermaid runtime, CSS.
- Forbidden: Git state changes, `.env` files, editing `PLAN.md`, `DESIGN.md`, `.handover.md`, `prompt.md`.

## Files
Allowed production and test paths:
- `src/render/pipeline.ts` (create: markdown-it instance with plugins, `render()`, `Heading` type `{ level: number; text: string; id: string }`)
- `src/render/sanitize.ts` (create: DOMPurify config and `sanitize(html)`)
- `src/render/links.ts` (create: relative `href` and `src` rewriting against `baseUrl`, `data-md-link`, external link attributes)
- `src/render/*.d.ts` (create only if a plugin lacks types)
- `tests/unit/pipeline.test.ts`, `tests/unit/sanitize.test.ts`, `tests/unit/links.test.ts` (create)
- `tests/fixtures/markdown/*.md` (create: one fixture per plugin plus GFM tables, strikethrough, autolinks, and XSS vectors)
- `package.json`, `package-lock.json` (modify: add the pinned dependencies)

Worker-owned phase records:
- `docs/plans/markdown-reader-v1/phase-02/notes.md` (append `## Task <M>` blocks)
- `docs/plans/markdown-reader-v1/phase-02/journal.md` (append `# EXTERNAL RESPONSE` under `## Implementation Response`)

Read-only / Forbidden:
- Do not edit `PLAN.md`, `DESIGN.md`, `.handover.md`, `prompt.md`, other phases, or Phase 1 source files.

## Tasks
- task-1: Test-first per plugin. markdown-it 15.0.3 with `html: true`, `linkify: true`, `typographer: false`, plus emoji, footnote, anchor, mark, abbr, sub, sup, deflist, task-lists, github-alerts, and @vscode/markdown-it-katex. One fixture and one test per plugin asserting its expected HTML structure after sanitization (for example: footnote `section.footnotes` and `sup.footnote-ref a[href^="#fn"]`; task list `input[type=checkbox]` disabled and checked state preserved; alert `.markdown-alert.markdown-alert-note` with its title; KaTeX `.katex` with `math` MathML and `.katex-html`; deflist `dl/dt/dd`; abbr `abbr[title]`; mark, sub, sup tags; emoji shortcode replaced with the Unicode emoji). Plus GFM tables, `~~strikethrough~~` to `<s>`, and linkified bare URLs. Mermaid fence test asserts `<pre class="mermaid">` with escaped source (for example `A-->B` becomes `A--&gt;B`, and `<script>` inside the fence is escaped text, not a tag).
- task-2: Heading extraction via markdown-it-anchor: return `{ level, text, id }[]` for levels 1 to 6 in document order, with unique ids for duplicate titles (for example `intro`, `intro-1`). Text is plain text without markup. Test levels 1-6 and duplicates. Note that markdown-it instance state must not leak between `render()` calls (slug uniqueness must reset per render); test two consecutive renders produce the same ids.
- task-3: `sanitize.ts` with DOMPurify 3.4.17. In Vitest, DOMPurify uses happy-dom's `window`; in the extension it uses the page `window`. Config keeps KaTeX MathML and HTML output (MathML tags and attributes such as `semantics`, `annotation encoding`, `mrow`, `mi`, `mo`, `mn`, `msup`, `mfrac`, `aria-hidden`, `style` on `.katex-html` spans as KaTeX emits them), `<details>`, `<summary>`, `<kbd>`, task-list `input type=checkbox` with `disabled` and `checked`, footnote anchors and ids, alert markup including its SVG icon if the plugin emits one, `data-md-link`. Strips `<script>`, all `on*` attributes, `javascript:`, `vbscript:`, and `data:` URLs except `data:image/*` (for example `data:image/png`, `data:image/svg+xml` is NOT allowed since SVG can carry script; decide and record). Write an XSS fixture set of at least 10 vectors (script tag, img onerror, svg onload, `javascript:` href with entity and case obfuscation, iframe srcdoc, `data:text/html` link, form action, `<a href="jav&#x09;ascript:">`, style-based `expression()`, `<math><mtext><table><mglyph><style><img src=x onerror>` mutation-XSS style, Markdown link `[x](javascript:alert(1))`, raw `<object>` and `<embed>`). For each, assert output contains no `<script`, no `on[a-z]+=` attribute, and no `javascript:` URL (case-insensitive, after entity decoding by parsing the output with DOMParser and inspecting attributes).
- task-4: `links.ts`: after sanitization (or as a DOMPurify `afterSanitizeAttributes` hook, which keeps a single parse), rewrite relative `href` and `src` against `baseUrl` using `new URL(value, baseUrl)`; leave fragment-only links (`#x`) unchanged so TOC and footnotes work; mark links whose resolved pathname ends in `.md` or `.markdown` with `data-md-link`; add `rel="noopener noreferrer"` and `target="_blank"` to external links (`http(s)` links whose origin differs from the `baseUrl` origin, and all `http(s)` links when `baseUrl` is `file:` or empty). Unparseable URLs are left unchanged. Test relative, absolute, fragment, `.md`, external, and `file://` base cases.
- task-5: Performance: a test generates a ~1 MB Markdown string in-test (mixed headings, paragraphs, lists, tables, code fences, some math) and asserts `render()` completes in under 400 ms (measure with `performance.now()`, take the best of 3 runs after one warm-up, and print the timings).
- Use TDD per task: write the failing test, observe a behavioral failure, implement, record RED -> GREEN in notes.

## Done When
- Each plugin fixture produces its expected HTML structure in tests.
- Every XSS fixture output contains no `<script`, no `on*=` attribute, and no `javascript:` URL.
- The 1 MB fixture renders through `render()` in under 400 ms in Vitest.
- Run from `/home/ngosi/projects/markdown-reader`, each exits 0:
  - `npm ci` (Baseline: exits 0)
  - `npm run typecheck` (Baseline: exits 0)
  - `npm test` (Baseline: 1 test passes)
  - `npm run build` (Baseline: exits 0)
  - `npm run test:e2e` (Baseline: 4 passed; must still pass)

## Rules
Read and follow these bundled contracts:
- Contract: `/home/ngosi/projects/refract/plugin/shared/worker-contract.md`
- Response: `/home/ngosi/projects/refract/plugin/shared/erp.md`
- Notes: `/home/ngosi/projects/refract/plugin/shared/notes-template.md`
- Journal: `/home/ngosi/projects/refract/plugin/shared/journal-template.md`

Role boundary: You are the phase implementer, not Coordinator. Work directly in `/home/ngosi/projects/markdown-reader`. Do not run Git commits, resets, stashes, branch changes, or ref updates. Do not invoke Coordinator skills or submit nested jobs. Use `refract ask "<question>"` for unresolved spec questions, or return `NEXT: BLOCKED` if unavailable.

## Response Format
Append the complete `# EXTERNAL RESPONSE` block to `docs/plans/markdown-reader-v1/phase-02/journal.md`, then return that block and the matching status line from `erp.md`.
