# Phase 6: Live editing, drafts, auto-reload, and save-back

## Goal & Outcome
- Plan Goal: Deliver the Chrome MV3 Markdown Reader extension defined in `docs/plans/markdown-reader-v1/DESIGN.md`: one React reader page rendering local files, folders, and URLs through one sanitized pipeline, with shadcn/ui behavior and TDS look on Tailwind v4.
- Phase Outcome: Typing updates the preview within budget, and opened local files reload on disk change.

## Context & Architecture
- Root: `/home/ngosi/projects/markdown-reader` | Branch: `main` | Base: `refs/plans/markdown-reader-v1/phase-06/base`
- Prior State:
  - Phase 1: WXT 0.21.5 MV3. Spike (b) in `docs/spikes.md`: `FileSystemObserver` is available on the pinned Chromium 156. Spike (a): `file://` fetch works only with "Allow access to file URLs" enabled; the E2E toggles it through chrome://extensions with a restart.
  - Phases 2 and 3: `render(text, baseUrl)` in `src/render/pipeline.ts`; lazy `enhance(root, signal)`; `src/ui/markdown-view.tsx` assigns HTML through a ref. Render of 1 MiB takes seconds because of DOMPurify; a 100 KB fixture is the editing budget target.
  - Phase 4: reader shell `src/entrypoints/reader/App.tsx`, `src/ui/top-bar.tsx`, TOC, `FileHandleSource` in `src/source/file-handle.ts`, TDS-restyled shadcn components in `src/components/ui/` including ToggleGroup, Dialog, Button. `tds-segmented-control` CSS is in `src/styles/tds/`.
  - Phase 5: `FileUrlSource` in `src/source/file-url.ts`; popup opens the reader with `?mode=read|edit`, validated in background; the reader does not yet read `?mode=`.
  - Tests: E2E fixtures via the local Node HTTP server helper in `tests/e2e/fixtures.ts`; Playwright `workers: 1`; Vitest render tests need `// @vitest-environment jsdom`. Baseline: `npm test` 65 pass, `npm run test:e2e` 16 pass. The existing 1 MiB timing E2E is host-load sensitive; do not change it.
- Read first: the Phase 6 section of `docs/plans/markdown-reader-v1/PLAN.md`; DESIGN.md sections on modes, editor, drafts, watching, save-back, and errors.

## Invariants & Boundaries
- Preview updates through `render()` and `enhance()` only. Editor changes reach `markdown-view` through a ref, not React state; batch per animation frame. Keystrokes cause no React re-render of the shell.
- No auto-reload while the editor is dirty. Drafts never overwrite disk without an explicit save.
- Watching uses `FileSystemObserver` when available, else 1 s `lastModified` polling. Watchers are unsubscribed on source change and page unload.
- Pin `codemirror` 6.0.2 and `@codemirror/lang-markdown` 6.5.2 exactly; pin any other new packages exactly.
- UI: only `tds-*`, `tds-custom-*`, token-valued layout utilities, and TDS typography classes. No Tailwind color, radius, shadow, or font utilities. No hex or oklch outside `src/styles/tds/`. No `dangerouslySetInnerHTML`. Light theme only; visible focus. Style CodeMirror with TDS tokens in CSS.
- Out of Scope: folder mode, persisted handles, export.
- Forbidden: Git state changes, `.env` files, credentials, editing `PLAN.md`, `DESIGN.md`, `.handover.md`, `prompt.md`.

## Files
Allowed production and test paths: everything listed under Phase 6 Files in PLAN.md, plus:
- `src/source/types.ts`, `src/ui/*.tsx`, `src/components/ui/toggle-group.tsx`, `src/components/ui/toggle.tsx` (modify for integration)
- `src/styles/editor.css` (create)
- `tests/e2e/fixtures.ts`, `tests/fixtures/**` (extend helpers and fixtures, including a 100 KB fixture)

Worker-owned phase records:
- `docs/plans/markdown-reader-v1/phase-06/notes.md` (append `## Task <M>` blocks)
- `docs/plans/markdown-reader-v1/phase-06/journal.md` (append `# EXTERNAL RESPONSE` under `## Implementation Response`)

## Tasks
Follow tasks 1 to 4 of the Phase 6 section of PLAN.md exactly. Notes:
- The reader honors `?mode=read|edit|split` on load; `edit` from the popup opens Edit mode.
- For the `file://` reload E2E, reuse the Phase 1 spike approach for enabling file access, write the fixture to a temp directory, rewrite it, and assert re-render without user action.
- For handle-based tests, an in-page fake `FileSystemFileHandle` is acceptable; record the approach.
- Use TDD per task: failing test first, record RED -> GREEN in notes.

## Done When
- E2E: typing in Split mode on a 100 KB fixture updates the preview within 100 ms, median of 10 keystrokes. Log the measured values.
- E2E: rewriting a `file://` fixture on disk re-renders the reader without user action.
- E2E: a dirty editor shows "File changed on disk: Reload" instead of reloading.
- Unit: conflict path never writes when `lastModified` differs and the user cancels; drafts save after 1 s idle and restore by source identity; watchers unsubscribe.
- `grep -rn dangerouslySetInnerHTML src` prints nothing; `grep -rnE 'oklch|#[0-9a-fA-F]{3,8}\b|dark:|bg-black|shadow-|rounded-' src --include='*.tsx' --include='*.ts' --include='*.css' | grep -v src/styles/tds/` prints nothing.
- Run from the root, each exits 0 with no skipped tests: `npm ci`, `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e`.

## Rules
Read and follow these bundled contracts:
- Contract: `/home/ngosi/projects/refract/plugin/shared/worker-contract.md`
- Response: `/home/ngosi/projects/refract/plugin/shared/erp.md`
- Notes: `/home/ngosi/projects/refract/plugin/shared/notes-template.md`
- Journal: `/home/ngosi/projects/refract/plugin/shared/journal-template.md`

Role boundary: You are the phase implementer, not Coordinator. Work directly in `/home/ngosi/projects/markdown-reader`. Do not run Git commits, resets, stashes, branch changes, or ref updates. Do not invoke Coordinator skills or submit nested jobs. Use `refract ask "<question>"` for unresolved spec questions, or return `NEXT: BLOCKED` if unavailable.

## Response Format
Append the complete `# EXTERNAL RESPONSE` block to `docs/plans/markdown-reader-v1/phase-06/journal.md`, then return that block and the matching status line from `erp.md`.
