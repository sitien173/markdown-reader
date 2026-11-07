# Phase 2: pnpm and Biome

## Goal & Outcome
- Plan Goal: move the Markdown Reader extension UI to shadcn base-nova on Base UI, remove TDS, add system dark mode, pnpm and Biome, Zustand state, and a redesigned UX, preserving all v1 behavior and gates.
- Phase Outcome: reproducible pnpm install and passing Biome CI with no behavior change.

## Context & Architecture
- Code root and records root: `/home/ngosi/projects/markdown-reader` | Branch: `main` | Base: `refs/plans/ui-stack-refactor/phase-02/base`
- Prior State: Phase 1 done. Baseline: `npm run typecheck` pass; `npx vitest run --no-file-parallelism` 22 files, 208 tests passed; `npm run test:e2e` 35 tests listed, all pass including 4 `test.fail` expected failures in `tests/e2e/keyboard.spec.ts`.
- Tooling: npm with `package-lock.json`. Installed pnpm is 11.22.0 (`/home/ngosi/.nvm/versions/node/v24.18.0/bin/pnpm`), Node 24.18.0. Latest `@biomejs/biome` on npm is 2.6.6. `src/render/highlight.ts` imports `@shikijs/core` and `@shikijs/langs`, which are not declared in `package.json` and currently resolve through npm hoisting.

## Invariants & Boundaries
- Preserve: every dependency version (no drift in the lockfile beyond the additions below), runtime behavior, the race code in `src/entrypoints/reader/App.tsx`, storage formats.
- Out of Scope: Zustand, Zod, Base UI, styling, any refactor. Lint fixes must not change runtime behavior. Prefer disabling a rule with a recorded reason over a behavior-risking rewrite, especially in `App.tsx`, `src/source/*`, `src/render/*`.

## Files
Allowed:
- `package.json` (modify), `package-lock.json` (delete), `pnpm-lock.yaml` (create), `biome.json` (create), `.npmrc` (create only if a build fails without hoisting; record why), `pnpm-workspace.yaml` (create only if pnpm 11 requires it, for example for `onlyBuiltDependencies` or build-script approval; record why)
- `README.md`, `docs/manual-checklist.md`, `CHROMEWEBSTORE.md`, `scripts/*` (replace npm commands only)
- Any `src/` or `tests/` file touched by Biome safe fixes or formatting
Worker-owned records: `/home/ngosi/projects/markdown-reader/docs/plans/ui-stack-refactor/phase-02/notes.md`, `/home/ngosi/projects/markdown-reader/docs/plans/ui-stack-refactor/phase-02/journal.md`
Forbidden: `PLAN.md`, `DESIGN.md`, `.handover.md`, `prompt.md`, other phase folders, anything outside the repository.

## Tasks
- task-1: Set `"packageManager": "pnpm@11.22.0"`. Run `pnpm import` to create `pnpm-lock.yaml` from `package-lock.json`, then delete `package-lock.json` and remove `node_modules` before installing with pnpm. Add `@shikijs/core` and `@shikijs/langs` at exactly `4.6.0`. Change `test:e2e` to `pnpm build && playwright test`. Confirm `pnpm install --frozen-lockfile` and `pnpm build` succeed. Playwright browsers already exist on this host; do not reinstall them unless a test reports a missing browser. Compare resolved versions of direct dependencies before and after (for example `npm ls --depth=0` before, `pnpm ls --depth=0` after) and record the comparison in notes.
- task-2: Add `@biomejs/biome` pinned exactly (2.6.6 unless it fails to install). Create `biome.json`: formatter on, linter with recommended rules, VCS-ignore aware, and excludes `.output`, `.wxt`, `node_modules`, `test-results`, `tests/fixtures`, `docs/plans`. Pick formatter options (quote style, indent, line width) that minimize churn against the current code style, and record the choice. Add scripts `"lint": "biome ci ."` and `"format": "biome format --write ."`. Fix lint errors without behavior change; disable a rule only with a recorded reason in notes.
- task-3: Replace npm commands with pnpm equivalents in `README.md`, `docs/manual-checklist.md`, and any other user-facing doc or script that names them.
- task-4: Last, run `pnpm format`. Before running it, run `git diff --stat > /tmp/ui-stack-phase02-pre-format.txt` and record in notes the exact list of files changed before formatting, so the Coordinator can split tooling and formatting into two commits. Do not commit.

## Done When
- `package-lock.json` is absent and `pnpm install --frozen-lockfile` exits 0.
- `pnpm lint` exits 0.
- From `/home/ngosi/projects/markdown-reader`: `pnpm typecheck` passes; `pnpm exec vitest run --no-file-parallelism` gives 208 passed; `pnpm test:e2e` gives 35 tests, all passing, including the 4 expected failures. A failure that is a timeout under host load above 8 is environmental: rerun it and record the load.

## Rules
Read and follow:
- `/home/ngosi/projects/refract/plugin/shared/worker-contract.md`
- `/home/ngosi/projects/refract/plugin/shared/erp.md`
- `/home/ngosi/projects/refract/plugin/shared/notes-template.md`
- `/home/ngosi/projects/refract/plugin/shared/journal-template.md`

Role boundary: you are the phase implementer, not the Coordinator. Do not run git commit, reset, stash, checkout, or update-ref. Do not submit nested jobs. Use `refract ask "<question>"` for unresolved spec questions, or return `NEXT: BLOCKED`.

## Response Format
Append the complete `# EXTERNAL RESPONSE` block to `/home/ngosi/projects/markdown-reader/docs/plans/ui-stack-refactor/phase-02/journal.md` under `## Implementation Response`, then return that block and the status line from `erp.md`.
