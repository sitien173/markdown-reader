# Phase 4: Base UI primitives and TDS removal at current layout

## Goal & Outcome
- Plan Goal: move the Markdown Reader extension UI to shadcn base-nova on Base UI, remove TDS, add system dark mode, pnpm and Biome, Zustand state, and a redesigned UX, preserving all v1 behavior and gates.
- Phase Outcome: no TDS (`tds-` classes, `src/styles/tds/`) and no `@radix-ui/*` remain; the app looks Apple-style in light mode with the same layout, controls, labels, and flows.

## Context & Architecture
- Code root and records root: `/home/ngosi/projects/markdown-reader` | Branch: `main` | Base: `refs/plans/ui-stack-refactor/phase-04/base`
- Prior State: Phases 1 to 3 done. pnpm 11.22.0 (keep `pnpm-workspace.yaml`), Biome 2.6.6 (`pnpm lint` exit 0, 217 warnings; must stay at or below 218), Zustand store `src/store/reader-store.ts`, controller `src/reader/controller.ts`, zod/mini with `src/lib/zod-config.ts`. Baseline: `pnpm typecheck` pass; `pnpm exec vitest run --no-file-parallelism` 25 files, 250 tests; `pnpm test:e2e` 35 tests pass, including 4 `test.fail` expected failures in `tests/e2e/keyboard.spec.ts`.
- Read the full Phase 4 section of `/home/ngosi/projects/markdown-reader/docs/plans/ui-stack-refactor/PLAN.md` and the Theme section of `DESIGN.md` in the same folder. They are authoritative for files, tasks, and acceptance criteria.
- Versions: shadcn CLI 4.23.0 is installed (devDependency). Latest `@base-ui/react` is 1.9.0 (2026-10-09); pin it exactly. Verify Base UI and shadcn base-nova APIs with `npx ctx7@latest library "Base UI" "<question>"` then `npx ctx7@latest docs <id> "<question>"`, or with the installed type declarations. Do not rely on memory for `render` props, ToggleGroup array values, Tabs activation on focus, Dialog `finalFocus`, or Menu APIs.
- Behavioral selectors already use `data-slot="reader-content"` and `data-slot="markdown"` (Phase 1). Typography in `src/styles/markdown.css` includes TDS polish committed in `e100b02`; carry it with new token names.

## Invariants & Boundaries
- Preserve: layout regions, controls, labels, accessible names (role-based selectors in tests keep working), flows, the race protocol, the `onEdit` path, render pipeline and DOMPurify, storage formats.
- Export: zero network requests, no scripts, no `@import`, no remote `url()`.
- Fonts: `system-ui, -apple-system, "Inter", sans-serif` with bundled `@fontsource/inter` 400, 500, 600; mono `ui-monospace, SFMono-Regular, Menlo, monospace`. Offline only.
- Out of Scope: dark mode, toasts, palette, sidebar collapse, new layout, new features. Do not touch `src/reader/controller.ts` or `src/store/*` beyond what a removed TDS class requires.
- Biome warnings at or below 218.

## Files
Allowed: every path listed under Phase 4 Files in `PLAN.md`, plus `tests/e2e/keyboard.spec.ts`, `tests/unit/reader-app.test.tsx` (selector updates only, never weakened assertions), `src/lib/utils.ts` if the CLI regenerates it, and any new `src/components/ui/*` file the CLI adds as a dependency of a listed component (record why).
Worker-owned records: `/home/ngosi/projects/markdown-reader/docs/plans/ui-stack-refactor/phase-04/notes.md`, `/home/ngosi/projects/markdown-reader/docs/plans/ui-stack-refactor/phase-04/journal.md`
Forbidden: `PLAN.md`, `DESIGN.md`, `.handover.md`, `prompt.md`, other phase folders, `biome.json`, `pnpm-workspace.yaml`, anything outside the repository.

## Tasks
- task-1 to task-4: as listed under Phase 4 Tasks in `PLAN.md`. Record the shadcn CLI version and the generated component list in notes.
- task-5 (debt from Phase 1): the save-conflict and file-access dialogs do not return focus to their trigger on close. With Base UI Dialog (for example `finalFocus` or a trigger relationship; verify the API), restore focus to Save and to Render current tab after Escape and after Cancel or Got it. Then change the 4 `test.fail` cases in `tests/e2e/keyboard.spec.ts` to plain `test` and confirm they pass.

## Done When
- `grep -rn "tds-\|@radix-ui" src tests package.json` prints nothing; `src/styles/tds` does not exist.
- Phase 1 keyboard tests pass on Base UI primitives, including the 4 former expected failures.
- Export E2E shows code, math, and diagrams with zero network requests.
- From `/home/ngosi/projects/markdown-reader`: `pnpm install --frozen-lockfile` ok; `pnpm lint` exit 0 with at most 218 warnings; `pnpm typecheck` pass; `pnpm exec vitest run --no-file-parallelism` all pass; `pnpm test:e2e` all pass including the S3 gate. Timeouts under host load above 8 are environmental: rerun and record the load.

## Rules
Read and follow:
- `/home/ngosi/projects/refract/plugin/shared/worker-contract.md`
- `/home/ngosi/projects/refract/plugin/shared/erp.md`
- `/home/ngosi/projects/refract/plugin/shared/notes-template.md`
- `/home/ngosi/projects/refract/plugin/shared/journal-template.md`

Role boundary: you are the phase implementer, not the Coordinator. Do not run git commit, reset, stash, checkout, restore, or update-ref (read-only git such as `git show`, `git diff`, `git log` is fine). Do not submit nested jobs. Use `refract ask "<question>"` for unresolved spec questions, or return `NEXT: BLOCKED`.

## Response Format
Append the complete `# EXTERNAL RESPONSE` block to `/home/ngosi/projects/markdown-reader/docs/plans/ui-stack-refactor/phase-04/journal.md` under `## Implementation Response`, then return that block and the status line from `erp.md`.
