# Phase 4: Reader shell, TOC, and URL and file sources

## Goal & Outcome
- Plan Goal: Deliver the Chrome MV3 Markdown Reader extension defined in `docs/plans/markdown-reader-v1/DESIGN.md`: one React reader page rendering local files, folders, and URLs through one sanitized pipeline, with shadcn/ui behavior and TDS look on Tailwind v4.
- Phase Outcome: A user opens a URL or a local file in the reader and reads it with a working TOC, in a TDS-styled shell built from shadcn components.

## Context & Architecture
- Root: `/home/ngosi/projects/markdown-reader` | Branch: `main` | Base: `refs/plans/markdown-reader-v1/phase-04/base`
- Prior State:
  - Phase 1: WXT 0.21.5, React 19.3.1, Tailwind 4.3.4, TDS token bridge in `src/styles/globals.css` and `src/styles/tds/tokens.css`, `components.json` hand-written because `shadcn init` was not run.
  - Phase 2: `render(text, baseUrl): { html, headings }` in `src/render/pipeline.ts`; `Heading = { level, text, id }`; DOMPurify in `src/render/sanitize.ts`; shared link resolver `src/render/links.ts` marks Markdown links with `data-md-link`.
  - Phase 3: `src/ui/markdown-view.tsx` renders via `render()`, assigns HTML through a ref, then `enhance(root, signal)`. Container class `.tds-custom-markdown`. `App.tsx` fetches `?src=` and renders it.
  - Tests: E2E serves fixtures from a local Node HTTP server on 127.0.0.1 because Playwright routing misses extension-origin fetches. Vitest tests calling `render()` need `// @vitest-environment jsdom`. Checks: `npm test` 46 pass, `npm run test:e2e` 10 pass.
- Read first: the Phase 4 section of `docs/plans/markdown-reader-v1/PLAN.md`; DESIGN.md sections on the token bridge, component mapping, content styling, layout, accessibility, and errors.

## Invariants & Boundaries
- Two layers: shadcn/ui for behavior, TDS for look. Keep Radix logic, keyboard handling, focus management, and ARIA. Replace `cva` class strings with TDS classes.
  - Run `tds rules` first and follow it; `tds component <id>` is the source of truth for component CSS and DOM. Save fetched component CSS under `src/styles/tds/`. The TDS loader strips `@import`, so also fetch shared atoms `field-label`, `field-caption`, `field-validation`, and `dropdown-panel`.
  - Import TDS CSS into `globals.css` with `layer(components)` so utilities can override it.
  - Button mapping: `default` to `tds-btn--primary`, `secondary` and `outline` to `tds-btn--secondary`, `destructive` to `tds-btn--danger`, `ghost` to `tds-btn--invisible`; sizes `sm`, `default`, `lg` to `tds-btn--sm`, `--md`, `--lg`; `size="icon"` to `.tds-icon-btn`.
  - Allowed in authored TSX and CSS: `tds-*` and `tds-custom-*` classes, token-valued Tailwind layout utilities such as `gap-(--gap-md) p-(--padding-xl)`, and TDS typography classes such as `text-body-md`. Not allowed: Tailwind color, radius, shadow, or font utilities.
  - Watch token name collisions with Tailwind and shadcn, such as `--radius-md`. Verify computed values in E2E where it matters.
- Light theme only. No dark surfaces. Visible keyboard focus on all controls.
- No hex or oklch outside `src/styles/tds/`. No `dangerouslySetInnerHTML`.
- Fonts bundled via `@fontsource/inter`, pinned exactly. No runtime CDN requests.
- Use `npx shadcn@4.23.0 add <components>` for the ten components. If `shadcn add` cannot run non-interactively, write the components by hand from the shadcn 4.23.0 source shape with the same Radix primitives, and record it in notes. Pin any new Radix packages exactly.
- Out of Scope: editor, file watching, folder mode, export, popup, content script.
- Forbidden: Git state changes, `.env` files, credentials, editing `PLAN.md`, `DESIGN.md`, `.handover.md`, `prompt.md`.

## Carried debt this phase owns
- Shiki alias table in `src/render/highlight.ts` misses `py`, `rs`, `yml`, `sh`, `md`. Add them with a unit test.
- `.tds-custom-markdown` has `overflow: clip`, which clips wide `pre` and tables. In `markdown.css`, give `pre` and table wrappers `overflow: auto; max-width: 100%` while keeping the container's isolation so content cannot paint over the shell.
- DOM clobbering: sanitized `id` and `name` values create `window` named properties. Enable DOMPurify `SANITIZE_NAMED_PROPS: true`, which prefixes ids with `user-content-`, and keep heading and footnote anchors working: the `headings` returned by `render()` must carry the final ids, and fragment links `#x` must be rewritten to `#user-content-x` consistently. Test that `id="mermaid"` does not create `window.mermaid` and that footnote and TOC links still resolve.

## Files
Allowed production and test paths: everything listed under Phase 4 Files in PLAN.md, plus:
- `src/render/highlight.ts`, `src/render/sanitize.ts`, `src/render/links.ts`, `src/render/pipeline.ts` (modify only for carried debt)
- `tests/unit/sanitize.test.ts`, `tests/unit/enhance.test.ts`, `tests/unit/pipeline.test.ts`, `tests/unit/links.test.ts` (modify for carried debt)
- `tests/fixtures/markdown/*.md` (create fixtures as needed)
- `tests/e2e/*.spec.ts` (modify existing specs only if shell changes break selectors)
- `components.json`, `src/lib/utils.ts` (modify if `shadcn add` requires it)

Worker-owned phase records:
- `docs/plans/markdown-reader-v1/phase-04/notes.md` (append `## Task <M>` blocks)
- `docs/plans/markdown-reader-v1/phase-04/journal.md` (append `# EXTERNAL RESPONSE` under `## Implementation Response`)

## Tasks
Follow tasks 1 to 4 of the Phase 4 section of PLAN.md exactly, then the carried debt items. Notes:
- `FileHandleSource.read()` uses `showOpenFilePicker` and drag-and-drop `DataTransferItem.getAsFileSystemHandle()`. E2E may stub `window.showOpenFilePicker` with an in-page fake handle returning a `File`; record the approach.
- `UrlSource` maps fetch failures and non-2xx statuses to a `tds-announcement` with Retry.
- Set `<base>` from the source URL; `data-md-link` clicks open the target in the reader with `?src=`.
- `toc.ts` builds nested list data from headings and runs an `IntersectionObserver` scroll-spy; unit-test the nesting.
- Use TDD per task: failing test first, record RED -> GREEN in notes.

## Done When
- E2E: entering a local test-server URL renders it; a 404 shows an announcement with Retry; Retry refetches.
- E2E: TOC lists all heading levels of a fixture, click scrolls to the heading, and the active item changes on scroll.
- E2E: Open file through the stubbed picker renders the file; keyboard focus is visible on top-bar controls.
- `grep -rnE '#[0-9a-fA-F]{3,8}\b' src/styles/markdown.css src/styles/reader.css src/ui src/components` prints nothing.
- `grep -rn dangerouslySetInnerHTML src` prints nothing; the no-hex grep across `src` excluding `src/styles/tds/` prints nothing.
- Run from the root, each exits 0 with no skipped tests: `npm ci`, `npm run typecheck`, `npm test` (Baseline: 46 pass), `npm run build`, `npm run test:e2e` (Baseline: 10 pass).

## Rules
Read and follow these bundled contracts:
- Contract: `/home/ngosi/projects/refract/plugin/shared/worker-contract.md`
- Response: `/home/ngosi/projects/refract/plugin/shared/erp.md`
- Notes: `/home/ngosi/projects/refract/plugin/shared/notes-template.md`
- Journal: `/home/ngosi/projects/refract/plugin/shared/journal-template.md`

Role boundary: You are the phase implementer, not Coordinator. Work directly in `/home/ngosi/projects/markdown-reader`. Do not run Git commits, resets, stashes, branch changes, or ref updates. Do not invoke Coordinator skills or submit nested jobs. Use `refract ask "<question>"` for unresolved spec questions, or return `NEXT: BLOCKED` if unavailable.

## Response Format
Append the complete `# EXTERNAL RESPONSE` block to `docs/plans/markdown-reader-v1/phase-04/journal.md`, then return that block and the matching status line from `erp.md`.
