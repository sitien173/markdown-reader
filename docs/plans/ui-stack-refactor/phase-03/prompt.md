# Phase 3: Reader store, controller, and boundary validation

## Goal & Outcome
- Plan Goal: move the Markdown Reader extension UI to shadcn base-nova on Base UI, remove TDS, add system dark mode, pnpm and Biome, Zustand state, and a redesigned UX, preserving all v1 behavior and gates.
- Phase Outcome: `src/entrypoints/reader/App.tsx` becomes a view over a Zustand store and a controller module with unchanged behavior and pixel-identical UI; storage boundaries are validated with `zod/mini`.

## Context & Architecture
- Code root and records root: `/home/ngosi/projects/markdown-reader` | Branch: `main` | Base: `refs/plans/ui-stack-refactor/phase-03/base`
- Prior State: Phases 1 and 2 done. Package manager pnpm 11.22.0 (`pnpm-workspace.yaml` exists and must stay). Biome 2.6.6: `pnpm lint` exits 0 with 218 warnings. Baseline: `pnpm typecheck` pass; `pnpm exec vitest run --no-file-parallelism` 22 files, 208 tests; `pnpm test:e2e` 35 tests pass, including 4 `test.fail` expected failures in `tests/e2e/keyboard.spec.ts`.
- Code Context: `src/entrypoints/reader/App.tsx` (about 700 lines after formatting) holds all reader state in `useState` and refs, and the async source logic with the race protocol: `sourceGenRef` generation counter, `isCurrent(gen, active, id)`, `activeRef`, `sourceIdRef`, `docPathRef`, `stampRef`, `watchRef`, `draftRef`, `viewRef`. Saves are pinned to the committed path. `onEdit` writes to `draftRef` and calls `viewRef.current.update` without React state; keep that. Storage readers: `src/source/captured-text.ts` (`usableCapturedText`), `src/store/handles.ts` (`getRecentHandles`), `src/store/recent.ts` (`getRecentUrls`). Phase 1 race tests: `tests/unit/reader-app.test.tsx` mocks `source/directory`, `store/handles`, `store/recent`, `ui/markdown-view`, `ui/editor-pane`.
- Versions: latest `zod` is 4.6.7 (published 2026-10-12). Latest `zustand` is 5.1.0, possibly published within pnpm 11's minimum release age window. Pin the newest version that installs without new `minimumReleaseAgeExclude` entries, and record which.
- MV3 CSP forbids `eval` and `new Function`. Zod compiles validators with `new Function` unless `z.config({ jitless: true })` runs first. Verify the `zod/mini` API (`z.config`, `z.object`, `z.string`, `z.array`, `z.optional`, `safeParse`) against the installed package's type declarations or with `npx ctx7@latest docs /colinhacks/zod "zod mini jitless config"`.

## Invariants & Boundaries
- Preserve: DOM output, class names, and appearance; the race protocol (every awaited resume point checks generation and source identity; saves use the committed path); the `onEdit` path outside React state; `chrome.storage` and IndexedDB keys and formats; fallbacks for malformed storage.
- Kept outside the store: draft text, editor and view instances, watchers, abort controllers, render caches.
- Guard refs move into controller module scope (or a controller instance created once per App mount; record the choice).
- No Zod in `src/entrypoints/background.ts` or `src/entrypoints/detect.content.ts`, directly or through imports. Check that `src/source/captured-text.ts` and the store modules are not imported by those entrypoints; if they are, validate in a reader-only wrapper instead.
- No store subscription may re-render App on every keystroke. Draft and dirty updates on keystrokes must not cause extra renders compared with today.
- Biome warning count must not exceed 218. Any new code must not add warnings.
- Out of Scope: visual changes, Base UI, new features, sidebar or focus-mode UI (store fields only).

## Files
Allowed:
- `package.json`, `pnpm-lock.yaml` (modify: add `zustand` and `zod`, exact versions)
- `src/store/reader-store.ts`, `src/reader/controller.ts`, `src/lib/schemas.ts` (create)
- `src/entrypoints/reader/App.tsx`, `src/entrypoints/reader/main.tsx`, `src/entrypoints/popup/main.tsx`, `src/source/captured-text.ts`, `src/store/handles.ts`, `src/store/recent.ts` (modify)
- `tests/unit/reader-store.test.ts`, `tests/unit/controller.test.ts`, `tests/unit/schemas.test.ts` (create)
- `tests/unit/reader-app.test.tsx` (modify only to improve the directory mock fidelity listed in debt below; never weaken assertions)
Worker-owned records: `/home/ngosi/projects/markdown-reader/docs/plans/ui-stack-refactor/phase-03/notes.md`, `/home/ngosi/projects/markdown-reader/docs/plans/ui-stack-refactor/phase-03/journal.md`
Forbidden: `PLAN.md`, `DESIGN.md`, `.handover.md`, `prompt.md`, other phase folders, `biome.json`, anything outside the repository.

## Tasks
- task-1: Add `zustand` and `zod` pinned exactly. Create `src/lib/schemas.ts` importing only from `zod/mini`. Call `z.config({ jitless: true })` in reader and popup `main.tsx` before render (import order must guarantee it runs before any schema parses). Validate the captured-text record in `usableCapturedText`, stored handle metadata in `getRecentHandles`, and the stored recent-URL list in `getRecentUrls`; invalid data yields exactly the same fallback as today. RED tests first in `tests/unit/schemas.test.ts`, including malformed inputs for each boundary.
- task-2: Create `src/store/reader-store.ts` with mode, source, document path, loading, headings, recents, sidebar open and tab, focus mode, and separate status flags `error`, `externalChange`, `conflict`, `dirty`, `writable`, plus `notice`. Add a derived banner selector ordered error first, then external change. Export a way to reset the store for tests. Tests in `tests/unit/reader-store.test.ts`.
- task-3: Create `src/reader/controller.ts` with `load`, `openFile`, `openFileHandle`, `openFolder`, `openFolderHandle`, `selectTreeFile`, `save`, `overwrite`, `reloadFromDisk`, `checkExternal`, `drop`, and `handleOpenRecent`, moved from `App.tsx` with the guard protocol intact. `App.tsx` subscribes with selectors and calls controller actions; it keeps no `sourceGenRef` and no async source logic. `tests/unit/controller.test.ts` covers stale-generation drops and the pinned save path, with RED evidence by disabling each guard.
- task-4: Keep `tests/unit/reader-app.test.tsx` passing without weakening assertions. Debt from Phase 1: its directory mock never updates `currentPath` or path-dependent identity; model committed-path changes so tree selection is realistic, then confirm the five race tests still fail with their guards disabled (record RED).

## Done When
- `grep -n "sourceGenRef" src/entrypoints/reader/App.tsx` prints nothing; App has no awaited source calls.
- `grep -rn "zod" src/entrypoints/background.ts src/entrypoints/detect.content.ts` prints nothing.
- Run from `/home/ngosi/projects/markdown-reader`: `pnpm lint` exit 0 with at most 218 warnings; `pnpm typecheck` pass; `pnpm exec vitest run --no-file-parallelism` all pass (208 plus new); `pnpm test:e2e` 35 pass, including the S3 gate in `tests/e2e/perf.spec.ts` and the 4 expected failures. Timeouts under host load above 8 are environmental: rerun and record the load.

## Rules
Read and follow:
- `/home/ngosi/projects/refract/plugin/shared/worker-contract.md`
- `/home/ngosi/projects/refract/plugin/shared/erp.md`
- `/home/ngosi/projects/refract/plugin/shared/notes-template.md`
- `/home/ngosi/projects/refract/plugin/shared/journal-template.md`

Role boundary: you are the phase implementer, not the Coordinator. Do not run git commit, reset, stash, checkout, or update-ref. Do not submit nested jobs. Use `refract ask "<question>"` for unresolved spec questions, or return `NEXT: BLOCKED`.

## Response Format
Append the complete `# EXTERNAL RESPONSE` block to `/home/ngosi/projects/markdown-reader/docs/plans/ui-stack-refactor/phase-03/journal.md` under `## Implementation Response`, then return that block and the status line from `erp.md`.
