# Phase 5: Dark mode across shell, content, and export

## Goal & Outcome
- Plan Goal: move the Markdown Reader extension UI to shadcn base-nova on Base UI, remove TDS, add system dark mode, pnpm and Biome, Zustand state, and a redesigned UX, preserving all v1 behavior and gates.
- Phase Outcome: every surface (shell, editor, Shiki code, Mermaid diagrams, KaTeX, HTML export) follows `prefers-color-scheme`, including live changes after load; print is always light.

## Context & Architecture
- Code root and records root: `/home/ngosi/projects/markdown-reader` | Branch: `main` | Base: `refs/plans/ui-stack-refactor/phase-05/base`
- Prior State: Phases 1 to 4 done. shadcn base-nova on `@base-ui/react` 1.9.0; TDS and Radix removed; light tokens in `src/styles/globals.css` (`:root`); export CSS in `src/export/export-styles.ts`; `.md-content` scopes Markdown styles. The palette reset `@theme { --color-*: initial }` must stay ABOVE `@theme inline` (Phase 4 review high finding; `tests/e2e/theme.spec.ts` guards it). `globals.css` currently has `@custom-variant dark (&:is(.dark *));`, which this phase replaces.
- Baseline: `pnpm lint` exit 0 with 163 warnings (cap 218); `pnpm typecheck` pass; `pnpm exec vitest run --no-file-parallelism` 25 files, 251 tests; `pnpm test:e2e` 36 pass.
- Read the full Phase 5 section of `/home/ngosi/projects/markdown-reader/docs/plans/ui-stack-refactor/PLAN.md` and the Theme section of `DESIGN.md` in the same folder. They are authoritative for files, tasks, and acceptance criteria.
- Verify APIs before use: Shiki dual themes (`codeToHtml` with `themes: { light, dark }`, `defaultColor`, CSS variable prefix) via the installed `shiki` / `@shikijs/core` type declarations or `npx ctx7@latest library Shiki "<question>"`; Mermaid `initialize` theme variables and `render` id handling via installed types. Playwright `colorScheme` and `page.emulateMedia({ colorScheme, media: 'print' })`.

## Invariants & Boundaries
- No theme toggle and no `.dark` class. No script in exported HTML. Export: zero network requests, no `@import`, no remote `url()`.
- Sanitization (DOMPurify) unchanged. Shiki, KaTeX, Mermaid stay lazy-loaded. Highlighting does not rerun on theme change. S3, S4, S8, S9 gates unchanged.
- Race protocol, `onEdit` path, storage formats, and `src/reader/controller.ts` / `src/store/*` unchanged.
- Out of Scope: layout changes, toasts, palette, sidebar, new features.
- Biome warnings at or below 218. Do not edit `biome.json`.

## Files
Allowed: every path listed under Phase 5 Files in `PLAN.md`, plus `src/render/*` helpers directly needed by highlight or diagram changes and `tests/unit/*` for those helpers (record why in notes).
Worker-owned records: `/home/ngosi/projects/markdown-reader/docs/plans/ui-stack-refactor/phase-05/notes.md`, `/home/ngosi/projects/markdown-reader/docs/plans/ui-stack-refactor/phase-05/journal.md`
Forbidden: `PLAN.md`, `DESIGN.md`, `.handover.md`, `prompt.md`, other phase folders, `biome.json`, `pnpm-workspace.yaml`, `package.json` dependency changes unless a dark theme module is missing (record why), anything outside the repository.

## Tasks
- task-1 to task-4: as listed under Phase 5 Tasks in `PLAN.md`. Follow TDD: capture the RED output of each new or changed test in notes before implementing.
- task-5 (debt from Phase 4): `src/export/export-styles.ts` duplicates the `:root` color values of `src/styles/globals.css`. When adding dark tokens, either derive export tokens from one source or add a unit test asserting the light and dark values match `globals.css` exactly.

## Done When
- E2E in both schemes: body background, code token colors, and Mermaid fill differ between light and dark and match the active scheme.
- Emulating a scheme change after load rerenders diagrams without reloading the page; earlier-theme results are discarded.
- Exported HTML contains no `<script>`, makes zero network requests, and switches theme under `colorScheme` emulation; exported SVG ids are disjoint between theme copies.
- Print emulation shows light tokens in dark scheme.
- From `/home/ngosi/projects/markdown-reader`: `pnpm install --frozen-lockfile` ok; `pnpm lint` exit 0 with at most 218 warnings; `pnpm typecheck` pass; `pnpm exec vitest run --no-file-parallelism` all pass; `pnpm test:e2e` all pass including the S3 gate. Timeouts under host load above 8 are environmental: check `uptime`, rerun, and record the load.

## Rules
Read and follow:
- `/home/ngosi/projects/refract/plugin/shared/worker-contract.md`
- `/home/ngosi/projects/refract/plugin/shared/erp.md`
- `/home/ngosi/projects/refract/plugin/shared/notes-template.md`
- `/home/ngosi/projects/refract/plugin/shared/journal-template.md`

Read this prompt and PLAN.md before editing any file. Role boundary: you are the phase implementer, not the Coordinator. Do not run git commit, reset, stash, checkout, restore, or update-ref (read-only git such as `git show`, `git diff`, `git log` is fine). Do not submit nested jobs. Use `refract ask "<question>"` for unresolved spec questions, or return `NEXT: BLOCKED`.

## Response Format
Append the complete `# EXTERNAL RESPONSE` block to `/home/ngosi/projects/markdown-reader/docs/plans/ui-stack-refactor/phase-05/journal.md` under `## Implementation Response`, then return that block and the status line from `erp.md`.
