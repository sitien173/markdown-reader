# Phase 8: Motion, accessibility, and release audit

## Goal & Outcome
- Plan Goal: move the Markdown Reader extension UI to shadcn base-nova on Base UI, remove TDS, add system dark mode, pnpm and Biome, Zustand state, and a redesigned UX, preserving all v1 behavior and gates.
- Phase Outcome: restrained CSS motion that respects reduced motion, verified contrast in both themes, a release-ready build and docs, and the remaining plan debt closed (Biome rule downgrades restored, render performance of the shell, shortcut modality, dark-mode diagram latency).

## Context & Architecture
- Code root and records root: `/home/ngosi/projects/markdown-reader` | Branch: `main` | Base: `refs/plans/ui-stack-refactor/phase-08/base`
- Prior State: Phases 1 to 7 done. shadcn base-nova on `@base-ui/react` 1.9.0 (components in `src/components/ui/`); tokens in `src/styles/globals.css` via `prefers-color-scheme` (keep `@theme { --color-*: initial }` above `@theme inline`); per-mount Zustand store via `ReaderStoreContext` (`src/store/reader-store.ts`); controller `src/reader/controller.ts`; command registry `src/reader/commands.ts`; shortcuts `src/reader/shortcuts.ts`; palette `src/ui/command-palette.tsx` and `src/components/ui/command.tsx`; Mermaid rendering with a serialized queue and a light print copy in `src/render/diagram.ts`. The coordinator already removed the pnpm `minimumReleaseAgeExclude` entries in the base commit.
- Baseline at phase base: `pnpm lint` exit 0 with 206 warnings (HARD CAP 218; this phase must lower it, never raise it; avoid non-null assertions `!`); `pnpm typecheck` pass; `pnpm exec vitest run --no-file-parallelism` 300 tests pass; `pnpm test:e2e` 82 tests pass.
- Read the full Phase 8 section of `/home/ngosi/projects/markdown-reader/docs/plans/ui-stack-refactor/PLAN.md` and the "Users and Success Criteria", "Constraints, Invariants, and Non-Goals", "Architecture and Data Flow", "Errors and Edge Cases", and "Testing" sections of `DESIGN.md` in the same folder. They are authoritative.
- Verify Base UI animation attributes (`data-starting-style`, `data-ending-style`, `data-open`, `data-closed`) and the View Transitions API usage from installed type declarations in `node_modules/@base-ui/react` or `npx ctx7@latest library "Base UI" "<question>"`. Do not rely on memory.

## Invariants & Boundaries
- No Motion library and no new runtime dependencies. No animation on Markdown content updates or the preview. Transitions use transform and opacity only, are short (about 100 to 200 ms), interruptible, and never block input. Everything is disabled under `prefers-reduced-motion: reduce`. The View Transition from welcome to document must fall back to an immediate update when `document.startViewTransition` is absent, and must not delay file or folder pickers (pickers still open synchronously from the user gesture).
- Race protocol, `onEdit` to `viewRef.update` bypassing React state, render pipeline and DOMPurify, storage keys and formats, lazy Shiki/KaTeX/Mermaid, dark mode, export (zero network, no script), toasts, banners, palette, shortcuts unchanged except where a task below changes them. S3, S4, S8, S9 gates hold. Manifest permissions unchanged.
- Restoring Biome rules must not weaken code: fix the violations; use a scoped `overrides` entry in `biome.json` only when a violation is intentional, with a one-line reason recorded in notes.

## Files
Allowed: every path listed under Phase 8 Files in `PLAN.md`, plus: `biome.json` (task-4 only), any `src/**` or `tests/**` file that needs a fix for a restored Biome rule (task-4, minimal edits), `src/ui/command-palette.tsx`, `src/reader/commands.ts` (task-5), `src/reader/shortcuts.ts` and `tests/unit/shortcuts.test.ts` (task-6), `src/render/diagram.ts` and its unit tests (task-7), `src/ui/welcome.tsx` (View Transition), `tests/e2e/fixtures.ts` (helpers only), `tests/e2e/palette.spec.ts` and `tests/e2e/theme.spec.ts` (new assertions only). Record why for each extra path in notes.
Worker-owned records: `/home/ngosi/projects/markdown-reader/docs/plans/ui-stack-refactor/phase-08/notes.md`, `/home/ngosi/projects/markdown-reader/docs/plans/ui-stack-refactor/phase-08/journal.md`
Forbidden: `PLAN.md`, `DESIGN.md`, `.handover.md`, `prompt.md`, other phase folders, `pnpm-workspace.yaml`, `package.json` dependencies, `pnpm-lock.yaml`, `wxt.config.ts` permissions, anything outside the repository.

## Tasks
- task-1 to task-3: as listed under Phase 8 Tasks in `PLAN.md`. Follow TDD: write each test first and record its RED output in notes before implementing. For task-3, record the `wxt zip` output, the remote-URL scan command and result, and a manifest permissions diff against `refs/plans/ui-stack-refactor/base` in the journal. README and CHROMEWEBSTORE text must describe only shipped behavior; do not invent screenshots, describe them as text placeholders if the docs reference images.
- task-4 (debt from Phase 2): `biome.json` downgrades 10 rules to `warn` (`useExhaustiveDependencies`, `noAssignInExpressions`, `useIterableCallbackReturn`, `noControlCharactersInRegex`, `useKeyWithClickEvents`, `noStaticElementInteractions`, `noNoninteractiveElementToInteractiveRole`, `useFocusableInteractive`, `noSvgWithoutTitle`, `useButtonType`). Remove those downgrades so the recommended severity applies, fix the resulting violations (currently 7 useExhaustiveDependencies, 4 noAssignInExpressions, 1 noControlCharactersInRegex), or add narrowly scoped overrides with reasons. `pnpm lint` must exit 0 and the warning count must not exceed 206.
- task-5 (debt from Phases 6 and 7): `Reader` in `src/entrypoints/reader/App.tsx` subscribes to the whole store with `useReaderStore((s) => s)`, so every store write re-renders the toolbar, sidebar, panes, and banner; the palette `useMemo` in `command-palette.tsx` never hits because `commands` is rebuilt each render and `onHandoff` is inline. Replace with per-field selectors or `useShallow` (installed zustand), make `commands` and callbacks stable, and keep behavior identical. Add a unit test that proves a store write to a field the shell does not render (or a headings-only change) does not re-render unrelated shell parts, or document an equivalent render-count assertion.
- task-6 (debt from Phase 7): shortcuts still fire while the Open URL dialog (or another modal dialog other than the palette) is open when focus is on a dialog button: Ctrl+O loads behind the dialog, Ctrl+K stacks the palette. Skip shortcuts while a modal dialog is open; unit test in `tests/unit/shortcuts.test.ts` and one E2E assertion.
- task-7 (debt from Phase 5): in dark scheme each Mermaid diagram renders twice (screen copy and light print copy) through one serialized queue, so diagrams appear later. Insert the screen copy as soon as it renders and add the print copy afterward, without breaking print output or export. Add or extend a unit test that asserts the screen copy is in the DOM before the print copy render resolves.

## Done When
- `motion.spec.ts` and `contrast.spec.ts` pass; S3, S4, S8, S9 in `perf.spec.ts` pass; `pnpm exec wxt zip` exits 0.
- `grep -rn "tds\|radix\|TDS" src tests README.md CHROMEWEBSTORE.md` prints nothing.
- `biome.json` has none of the task-4 downgrades.
- From `/home/ngosi/projects/markdown-reader`: `pnpm install --frozen-lockfile` ok; `pnpm lint` exit 0 with at most 206 warnings; `pnpm typecheck` pass; `pnpm exec vitest run --no-file-parallelism` all pass; `pnpm test:e2e` all pass. The host is shared and often loaded: on timeouts check `uptime`, rerun the failing specs, and record the load.

## Rules
Read and follow:
- `/home/ngosi/projects/refract/plugin/shared/worker-contract.md`
- `/home/ngosi/projects/refract/plugin/shared/erp.md`
- `/home/ngosi/projects/refract/plugin/shared/notes-template.md`
- `/home/ngosi/projects/refract/plugin/shared/journal-template.md`

Read this prompt and PLAN.md before editing any file. Write notes as you go (per task), not only at the end. Do not stop until every task and every Done When check is complete. Role boundary: you are the phase implementer, not the Coordinator. Do not run git commit, reset, stash, checkout, restore, or update-ref (read-only git such as `git show`, `git diff`, `git log` is fine). Do not submit nested jobs. Use `refract ask "<question>"` for unresolved spec questions, or return `NEXT: BLOCKED`.

## Response Format
Append the complete `# EXTERNAL RESPONSE` block to `/home/ngosi/projects/markdown-reader/docs/plans/ui-stack-refactor/phase-08/journal.md` under `## Implementation Response`, then return that block and the status line from `erp.md`.
