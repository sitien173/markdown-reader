# Phase 7: Folder mode and persisted handles

## Goal & Outcome
- Plan Goal: Deliver the Chrome MV3 Markdown Reader extension defined in `docs/plans/markdown-reader-v1/DESIGN.md`: one React reader page rendering local files, folders, and URLs through one sanitized pipeline, with shadcn/ui behavior and TDS look on Tailwind v4.
- Phase Outcome: A user opens a local folder, browses its Markdown tree, follows relative links, and sees tree updates on disk changes.

## Context & Architecture
- Root: `/home/ngosi/projects/markdown-reader` | Branch: `main` | Base: `refs/plans/markdown-reader-v1/phase-07/base`
- Prior State:
  - Phase 1: Spike (b) in `docs/spikes.md`: `FileSystemObserver` is available on the pinned Chromium 156.
  - Phases 2 and 3: `render(text, baseUrl)` and `renderBlocks` in `src/render/pipeline.ts`; link and image URL resolution in `src/render/links.ts`; sanitizer in `src/render/sanitize.ts` allows `http`, `https`, `file` and safe `data:image` only. `src/ui/markdown-view.tsx` assigns HTML through a ref.
  - Phase 4: reader shell `src/entrypoints/reader/App.tsx` with a Tabs sidebar whose "Files" tab is a placeholder; `src/ui/top-bar.tsx`; TDS-restyled shadcn components in `src/components/ui/`.
  - Phase 5: recent URL list in `src/store/recent.ts` using Web Locks.
  - Phase 6: `FileHandleSource` in `src/source/file-handle.ts` with save-back; watchers in `src/source/watch.ts` with `FileSystemObserver` and polling fallback; drafts in `src/store/drafts.ts`; App.tsx guards every async path with a source-generation helper. Keep those guards for folder navigation.
  - Tests: E2E fixtures through the local Node HTTP server in `tests/e2e/fixtures.ts`; Playwright `workers: 1`; Vitest render tests need `// @vitest-environment jsdom`. Baseline: `npm test` 102 pass, `npm run test:e2e` 20 pass. The 1 MiB and Split render timing E2E tests are host-load sensitive; do not change them.
- Read first: the Phase 7 section of `docs/plans/markdown-reader-v1/PLAN.md`; DESIGN.md sections on sources, folder mode, handles, and errors.

## Invariants & Boundaries
- The tree lists only `.md` and `.markdown` files and directories that contain them, recursively.
- Object URLs created for images are revoked on navigation and on unmount. No leaks.
- Relative links that resolve outside the opened folder fall back to source-URL resolution or render disabled. Never read outside the folder handle.
- Pin `idb-keyval` 6.3.0 exactly.
- Reconnect calls `requestPermission()` only from a user click.
- UI: only `tds-*`, `tds-custom-*`, token-valued layout utilities, and TDS typography classes. No Tailwind color, radius, shadow, or font utilities. No hex or oklch outside `src/styles/tds/`. No `dangerouslySetInnerHTML`. Light theme only; visible focus.
- Out of Scope: export, icons, store copy.
- Forbidden: Git state changes, `.env` files, credentials, editing `PLAN.md`, `DESIGN.md`, `.handover.md`, `prompt.md`.

## Files
Allowed production and test paths: everything listed under Phase 7 Files in PLAN.md, plus:
- `src/source/types.ts`, `src/source/watch.ts`, `src/source/file-handle.ts`, `src/store/drafts.ts`, `src/ui/*.tsx`, `src/components/ui/collapsible.tsx` (create or modify for integration)
- `tests/e2e/*.spec.ts` for new specs only, `tests/e2e/fixtures.ts`, `tests/fixtures/**`
- `docs/manual-checklist.md` (create)

Worker-owned phase records:
- `docs/plans/markdown-reader-v1/phase-07/notes.md` (append `## Task <M>` blocks)
- `docs/plans/markdown-reader-v1/phase-07/journal.md` (append `# EXTERNAL RESPONSE` under `## Implementation Response`)

## Tasks
Follow tasks 1 to 4 of the Phase 7 section of PLAN.md exactly. Also fix this carried debt:
- `drop()` in App.tsx must validate the file type, accepting only `.md` and `.markdown`. It must also clear old headings.
- Dropped files currently share the draft key `local:drop`. Give each its own identity: name, size and lastModified.

Notes:
- Use fake `FileSystemDirectoryHandle` and `FileSystemFileHandle` objects in unit tests; record the approach.
- Folder watch uses `FileSystemObserver` on the directory when available, else polling. It unsubscribes on source change and unload.
- Use TDD per task: failing test first, record RED -> GREEN in notes.
- Before writing UI, run `tds rules` and follow it.

## Done When
- Unit with fake handles covers:
  - tree contents, filtering and sorting;
  - add, remove and rename events;
  - relative link and image resolution inside the folder;
  - outside-folder fallback;
  - object URL revoke on navigation.
- Unit: a handle with permission state `prompt` yields a Reconnect entry; Reconnect calls `requestPermission()`.
- Unit: drop rejects non-Markdown files, and two dropped files get distinct draft keys.
- `docs/manual-checklist.md` lists the native-picker steps for folder open, watch, Reconnect, and file save-back.
- `grep -rn dangerouslySetInnerHTML src` prints nothing; `grep -rnE 'oklch|#[0-9a-fA-F]{3,8}\b|dark:|bg-black|shadow-|rounded-' src --include='*.tsx' --include='*.ts' --include='*.css' | grep -v src/styles/tds/` prints nothing.
- Run from the root, each exits 0 with no skipped tests: `npm ci`, `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e`. If only a timing E2E fails under host load, rerun it alone and report both results.

## Rules
Read and follow these bundled contracts:
- Contract: `/home/ngosi/projects/refract/plugin/shared/worker-contract.md`
- Response: `/home/ngosi/projects/refract/plugin/shared/erp.md`
- Notes: `/home/ngosi/projects/refract/plugin/shared/notes-template.md`
- Journal: `/home/ngosi/projects/refract/plugin/shared/journal-template.md`

Role boundary: You are the phase implementer, not Coordinator. Work directly in `/home/ngosi/projects/markdown-reader`. Do not run Git commits, resets, stashes, branch changes, or ref updates. Do not invoke Coordinator skills or submit nested jobs. Use `refract ask "<question>"` for unresolved spec questions, or return `NEXT: BLOCKED` if unavailable.

## Response Format
Append the complete `# EXTERNAL RESPONSE` block to `docs/plans/markdown-reader-v1/phase-07/journal.md`, then return that block and the matching status line from `erp.md`.
