# Phase 1: Baseline, characterization tests, and selector hooks

## Goal & Outcome
- Plan Goal: move the Markdown Reader extension UI to shadcn base-nova on Base UI, remove the Trulioo Design System (TDS), add system dark mode, pnpm and Biome, Zustand state, and a redesigned UX, while preserving all v1 behavior and performance gates.
- Phase Outcome: a green, trustworthy test suite that pins current reader behavior (race paths and keyboard behavior) and no longer depends on `.tds-*` class names for behavior. No visual change.

## Context & Architecture
- Code root: `/home/ngosi/projects/markdown-reader` | Records root: `/home/ngosi/projects/markdown-reader` | Branch: `main` | Base: `refs/plans/ui-stack-refactor/phase-01/base`
- Prior State: v1 complete. Baseline at plan base was unreliable because the host load average was 66 to 132 on 8 cores from unrelated jobs: typecheck passed; vitest had worker start timeouts; Playwright E2E had 11 timeouts and 3 not run. No failure showed a content assertion mismatch.
- Code Context: reader UI in `src/entrypoints/reader/App.tsx` (about 495 lines, race guards `sourceGenRef`, `isCurrent()`, `sourceIdRef`, `activeRef`, `stampRef`, saves pinned to committed path; JSX on one dense line near the end). Behavioral TDS lookups: `src/ui/markdown-view.tsx:90` (`closest('.tds-custom-reader__content')`), `src/toc/toc.ts:15` (`querySelector('.tds-custom-reader__content')`), `src/ui/toc-panel.tsx`, and the export container query `document.querySelector('.tds-custom-markdown')` in `App.tsx` `handleExportHtml`. Markdown container rendered at `src/ui/markdown-view.tsx:324`. Vitest uses happy-dom (`vitest.config.ts`); jsdom 30 is installed and used by render tests where DOMPurify needs it. Playwright runs the built extension with `workers: 1`. Package manager is npm in this phase.
- Prior v1 debt this phase addresses: "no App-level test harness for save and selection races or explicit-path Overwrite", "Reconnect exception path untested", "conflict Cancel App wiring verified by inspection only" (see `docs/plans/markdown-reader-v1/.handover.md`).

## Invariants & Boundaries
- Preserve: rendered appearance, all `.tds-*` class names on elements (styling still depends on them), production behavior, render pipeline, sanitization, race guards, storage formats, dependencies.
- Out of Scope: styles, `src/components/ui/*`, dependency changes, pnpm, Biome, Zustand, Base UI, any redesign. Later phases own them.

## Files
Allowed production and test paths:
- `vitest.config.ts` (modify: include `tests/unit/**/*.{test,spec}.{ts,tsx}`)
- `src/ui/markdown-view.tsx` (modify: add `data-slot="markdown"` on the Markdown container; replace the `.tds-custom-reader__content` lookup)
- `src/toc/toc.ts` (modify: replace the `.tds-custom-reader__content` lookup)
- `src/ui/toc-panel.tsx` (modify: replace any behavioral `.tds-*` lookup)
- `src/entrypoints/reader/App.tsx` (modify: add `data-slot="reader-content"` on the content section; export reads the Markdown container through a ref or `[data-slot="markdown"]`)
- `tests/e2e/enhance.spec.ts` (modify: line 54 assertion narrowed to leaked Mermaid artifacts instead of any SVG outside Markdown)
- `tests/unit/reader-app.test.tsx` (create)
- `tests/e2e/keyboard.spec.ts` (create)
- Fixing a genuine low-load baseline failure may touch the failing test or its source file; record why in notes.

Worker-owned phase records:
- `/home/ngosi/projects/markdown-reader/docs/plans/ui-stack-refactor/phase-01/notes.md` (append `## Task <M>` blocks)
- `/home/ngosi/projects/markdown-reader/docs/plans/ui-stack-refactor/phase-01/journal.md` (append `# EXTERNAL RESPONSE` under `## Implementation Response`)

Read-only / Forbidden:
- Do not edit `PLAN.md`, `DESIGN.md`, `.handover.md`, `prompt.md`, other phases, `package.json`, lockfiles, or anything outside the repository.

## Tasks
- task-1: Baseline. Check `uptime`. When the 1-minute load average is below 8, run `npm run typecheck`, `npx vitest run --no-file-parallelism`, and `npm run test:e2e`; record counts in notes. If load stays at or above 8 for 20 minutes, run anyway and record the load next to each result. A failure that reproduces on rerun with an assertion mismatch (not a timeout or closed browser) is a real bug: write the RED evidence and fix it. Environmental timeouts are recorded, not patched.
- task-2: Selector hooks. Add `data-slot="reader-content"` and `data-slot="markdown"`. Replace every behavioral `.tds-*` lookup listed above with a ref or `[data-slot=...]` selector. Narrow `tests/e2e/enhance.spec.ts:54`. Acceptance: `grep -rn "querySelector\|closest" src | grep "tds-"` prints nothing.
- task-3: App race tests in `tests/unit/reader-app.test.tsx`. Render the reader `App` with `react-dom/client` in happy-dom (use `// @vitest-environment jsdom` per file if happy-dom fails). Mock source and store modules with `vi.mock` and deferred promises. Cover: (a) selecting a tree file while a save is in flight writes to the committed path, not the newly selected one; (b) edits made during a reload are not lost; (c) explicit-path Overwrite after a conflict writes the committed path; (d) conflict Cancel leaves content and dirty state unchanged; (e) a Reconnect exception surfaces an announcement. Assert observable outcomes (write target, rendered text, announcement text). For each test, temporarily disable the guard it covers, confirm the test fails, restore the guard, and record the RED output in notes.
- task-4: `tests/e2e/keyboard.spec.ts`: sidebar tabs, ArrowRight moves focus and activates the Files panel; Export menu opens with Enter and Escape closes it and returns focus to the trigger; save-conflict and file-access dialogs close on Escape and on Cancel and return focus. Reuse helpers in `tests/e2e/fixtures.ts`. If a behavior is not reachable in v1, record it and test what exists.

## Done When
- `grep -rn "querySelector\|closest" src | grep "tds-"` prints nothing.
- New unit and E2E tests pass; each race test failed with its guard disabled.
- Existing specs pass unchanged except `enhance.spec.ts:54`.
- Run from `/home/ngosi/projects/markdown-reader`:
  - `npm run typecheck` (Baseline: pass)
  - `npx vitest run --no-file-parallelism` (Baseline: record in task-1)
  - `npm run test:e2e` (Baseline: record in task-1)

## Rules
Read and follow these bundled contracts:
- Contract: `/home/ngosi/projects/refract/plugin/shared/worker-contract.md`
- Response: `/home/ngosi/projects/refract/plugin/shared/erp.md`
- Notes: `/home/ngosi/projects/refract/plugin/shared/notes-template.md`
- Journal: `/home/ngosi/projects/refract/plugin/shared/journal-template.md`

Role boundary: You are the phase implementer, not Coordinator. Edit code only in `/home/ngosi/projects/markdown-reader`; write phase records only under the records root. Do not run Git commits, resets, stashes, branch changes, or ref updates. Do not invoke Coordinator skills or submit nested jobs. Use `refract ask "<question>"` for unresolved spec questions, or return `NEXT: BLOCKED` if unavailable.

## Response Format
Append the complete `# EXTERNAL RESPONSE` block to `/home/ngosi/projects/markdown-reader/docs/plans/ui-stack-refactor/phase-01/journal.md`, then return that block and the matching status line from `erp.md`.
