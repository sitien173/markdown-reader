# Phase 1: Green local baseline

## Goal & Outcome
- Plan Goal: Publish Markdown Reader as a public GitHub repository whose `main` requires three CI checks to pass.
- Phase Outcome: `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm test:e2e` all exit 0 at this checkout, so CI can be required on the first push.

## Context & Architecture
- Code root: `/home/ngosi/projects/markdown-reader` | Records root: `/home/ngosi/projects/markdown-reader` | Branch: `main` | Base: `refs/plans/open-source-release/phase-01/base`
- Prior State: Commit `3532eb2` changed the reader sidebar, file tree, recent section, toolbar, and General settings tab. Since then, 6 of 189 Playwright tests fail. `pnpm lint` exits 1 only because Biome formats untracked local tool files under `.pi/tasks/`. These are ignored by git through a global gitignore but Biome still scans them. Source files have 0 lint errors and 208 warnings.
- Failing tests at base:
  - `tests/e2e/contrast.spec.ts:285` forced light theme: light sidebar search field below 4.5:1.
  - `tests/e2e/contrast.spec.ts:285` forced dark theme: dark sidebar below 4.5:1.
  - `tests/e2e/motion.spec.ts:58` reduced motion: a loaded document with sidebar has non-zero durations.
  - `tests/e2e/motion.spec.ts:102` reduced motion: reader menu has non-zero durations.
  - `tests/e2e/settings-layout.spec.ts:85` options page General tab: screenshot differs.
  - `tests/e2e/settings-layout.spec.ts:91` reader dialog General tab: screenshot differs.
- Code Context: Reduced-motion rules live in `@media (prefers-reduced-motion: reduce)` blocks at `src/styles/globals.css:223` and `src/styles/reader.css:398`. Design tokens for colors are in `src/styles/globals.css`. `3532eb2` added sidebar, file-tree, recent-item, and toolbar styles in `src/styles/reader.css` and markup in `src/ui/file-tree.tsx`, `src/ui/recent-section.tsx`, `src/ui/toolbar.tsx`, `src/entrypoints/reader/App.tsx`. Inspect `git show 3532eb2` first. `3532eb2` intentionally removed the Open Editor action and Recent section from the General tab, so those two screenshots are stale.
- Read `/home/ngosi/projects/markdown-reader/AGENTS.md` and `CODING_STANDARDS.md` before editing.

## Invariants & Boundaries
- Preserve: every spec assertion, contrast threshold, timing budget, and snapshot other than the two General tab PNGs. Keep the visual design of `3532eb2` except where contrast or reduced motion requires a change. Product behavior unchanged otherwise.
- Out of Scope: CI files, `.github/`, docs, dependencies, `package.json`, `pnpm-lock.yaml`, `biome.json`, any spec file under `tests/`. Do not run `git commit`, `git push`, or any `gh` command.

## Files
Allowed production and test paths:
- `.gitignore` (modify: add `.pi/`)
- `biome.json` (modify only if Biome does not honor `.gitignore`; then add `.pi` to its ignore and say why in notes)
- `src/styles/reader.css` (modify: contrast and reduced-motion fixes)
- `src/styles/globals.css`, `src/ui/file-tree.tsx`, `src/ui/recent-section.tsx`, `src/ui/toolbar.tsx`, `src/entrypoints/reader/App.tsx` (modify only if the root cause is there)
- `tests/e2e/settings-layout.spec.ts-snapshots/options-general-linux.png` (regenerate)
- `tests/e2e/settings-layout.spec.ts-snapshots/dialog-general-linux.png` (regenerate)

Worker-owned phase records:
- `/home/ngosi/projects/markdown-reader/docs/plans/open-source-release/phase-01/notes.md` (append `## Task <M>` blocks)
- `/home/ngosi/projects/markdown-reader/docs/plans/open-source-release/phase-01/journal.md` (append `# EXTERNAL RESPONSE` under `## Implementation Response`)

Read-only / Forbidden:
- Do not edit `PLAN.md`, `DESIGN.md`, `.handover.md`, `prompt.md`, other phases, dependencies, or secrets.

## Tasks
- task-1: RED `pnpm lint` exits 1 on `.pi/tasks`. Add `.pi/` to `.gitignore`. GREEN `pnpm lint` exits 0 with no more than 208 warnings.
- task-2: RED `pnpm build && pnpm exec playwright test contrast -g "sidebar"` fails. Find the exact selectors and colors below 4.5:1 in light and dark sidebar and sidebar search field. Fix with existing tokens. GREEN the same command passes.
- task-3: RED `pnpm build && pnpm exec playwright test motion` fails. Find each element with non-zero transition or animation duration under reduced motion, from the failure output. Cover them in the reduced-motion block following the existing pattern. GREEN the same command passes.
- task-4: `pnpm build && pnpm exec playwright test settings-layout --update-snapshots -g "General tab"`. Confirm with `git status` that only the two General tab PNGs changed under `tests/`. View both images and describe them in notes: General tab without Open Editor and Recent, no other layout change.

## Done When
- `git diff --stat` lists only allowed paths.
- Run from `/home/ngosi/projects/markdown-reader`:
  - `pnpm typecheck` (Baseline: exit 0)
  - `pnpm lint` (Baseline: exit 1 on `.pi/tasks`; target exit 0, warnings at most 208)
  - `pnpm test` (Baseline: 44 files, 543 tests passed)
  - `pnpm test:e2e` (Baseline: 183 passed, 6 failed; target all passed)

## Rules
Read and follow these bundled contracts:
- Contract: `/home/ngosi/projects/refract/plugin/shared/worker-contract.md`
- Response: `/home/ngosi/projects/refract/plugin/shared/erp.md`
- Notes: `/home/ngosi/projects/refract/plugin/shared/notes-template.md`
- Journal: `/home/ngosi/projects/refract/plugin/shared/journal-template.md`

Role boundary: You are the phase implementer, not Coordinator. Edit code only in `/home/ngosi/projects/markdown-reader`; write phase records only under `/home/ngosi/projects/markdown-reader/docs/plans/open-source-release/phase-01/`. Leave Coordinator skills and Refract job submission to the Coordinator.

## Response Format
Append the complete `# EXTERNAL RESPONSE` block to `/home/ngosi/projects/markdown-reader/docs/plans/open-source-release/phase-01/journal.md`, then return that block and the matching status line from `erp.md`.
