# Phase 1: Baseline repair, hiding rule, and settings

## Goal & Outcome
- Plan Goal: Opening a local `file://` Markdown file shows a lazy folder tree rooted at its parent folder, with an "Up one level" button; dot-items, `.gitignore` matches, and Settings patterns are hidden unless "Show hidden and ignored items" is on. The Open folder picker tree applies the same hiding rule.
- Phase Outcome: A tested, source-agnostic hiding rule module (`src/source/hidden.ts`) and two new settings (`general.showHiddenItems`, `general.ignorePatterns`) with Settings UI controls exist; `pnpm lint` reports 0 errors.

## Context & Architecture
- Code root: `/home/ngosi/projects/markdown-reader` | Records root: `/home/ngosi/projects/markdown-reader` | Branch: `main` | Base: `refs/plans/file-url-folder-tree/phase-01/base`
- Prior State: Baseline at `ab6c488`: `pnpm typecheck` pass; `pnpm lint` fails with 2 errors, both formatter diffs in `.ogrep/lance/**/latest_version_hint.json` (a local search index Biome should ignore); `pnpm test` pass (40 files, 485 tests) when run alone.
- Code Context:
  - `biome.json` `files.includes` already has `"!**/.tgrep"` (line ~9).
  - `src/lib/settings.ts`: `defaultSettings.general` (line ~10) and `generalSchema` (line ~106) using `z.catch(<schema>, defaultSettings.general.<key>)` per field. Follow this exact pattern.
  - `src/ui/settings/general-tab.tsx`: existing toggle and field controls; follow them. Labels and descriptions live in `src/i18n/en-US.ts`.
  - Full design: `/home/ngosi/projects/markdown-reader/docs/plans/file-url-folder-tree/DESIGN.md`, section "Architecture and Data Flow" > "Hiding rule". Read it.

## Hiding rule semantics (from DESIGN.md, authoritative)
- Rule inputs: `showHiddenItems`, `ignorePatterns` (multi-line gitignore syntax), and an ordered chain of `{ dirPath, gitignoreText }` levels (dirPath relative to the chain base, `''` for the base itself).
- Predicate input: an entry path relative to the chain base and an `isDir` flag. Output: hidden or not.
- With `showHiddenItems` on, nothing is hidden.
- Otherwise hidden when any holds:
  1. The entry's name starts with `.`.
  2. It matches a Settings pattern (evaluated relative to the chain base). Settings patterns only hide; a `!` pattern never un-hides anything, including gitignored entries.
  3. The `.gitignore` chain ignores it: one `ignore` instance per level; test levels deepest first with `ignore().test(pathRelativeToThatLevel)`; the first result with `ignored` or `unignored` true decides. Only levels whose dirPath is an ancestor of the entry apply.
- Folder paths get a trailing `/`. Relative paths never have a leading `./` or `/`.
- No I/O, no browser APIs, no fetch, no file handles in `hidden.ts`. Callers supply `.gitignore` text.

## Invariants & Boundaries
- Preserve: existing stored settings parse unchanged (new fields use `z.catch` defaults). Existing settings UI and tests unchanged in behavior.
- Out of Scope: any tree, directory, controller, store, or `App.tsx` change (Phases 2 and 3). Do not read `.env` or credential files.

## Files
Allowed production and test paths:
- `biome.json` (modify: add `"!**/.ogrep"` next to `"!**/.tgrep"`)
- `package.json`, `pnpm-lock.yaml` (modify: only via `pnpm add ignore@7.0.14`; exact version, no other dependency)
- `src/source/hidden.ts` (create: hiding rule)
- `src/lib/settings.ts` (modify: two new general settings)
- `src/ui/settings/general-tab.tsx` (modify: toggle + multi-line text field)
- `src/i18n/en-US.ts` (modify: labels and descriptions)
- `tests/unit/hidden.test.ts` (create)
- `tests/unit/settings.test.ts` (modify)

Worker-owned phase records:
- `/home/ngosi/projects/markdown-reader/docs/plans/file-url-folder-tree/phase-01/notes.md` (append `## Task <M>` blocks)
- `/home/ngosi/projects/markdown-reader/docs/plans/file-url-folder-tree/phase-01/journal.md` (append `# EXTERNAL RESPONSE` under `## Implementation Response`)

Read-only / Forbidden:
- Do not edit `PLAN.md`, `DESIGN.md`, `.handover.md`, `prompt.md`, other phases, other dependencies, or secrets. Do not commit; the Coordinator owns Git.

## Tasks
- task-1: Add `"!**/.ogrep"` to `files.includes` in `biome.json`. Run `pnpm add ignore@7.0.14` and confirm `package.json` pins exactly `7.0.14`. Verify `pnpm lint` reports 0 errors.
- task-2: TDD `src/source/hidden.ts`. Write `tests/unit/hidden.test.ts` first covering: a dot-item is hidden; a Settings pattern hides an entry; a Settings `!` pattern never un-hides a gitignored entry; a nested `.gitignore` negation overrides a parent rule; folder-only patterns (e.g. `build/`) match folders via trailing `/` and not files of that name; an ancestor `.gitignore` level above the entry folder applies; the `showHiddenItems` toggle reveals everything. RED, then implement minimally, then GREEN.
- task-3: TDD settings: `general.showHiddenItems` boolean default `false`; `general.ignorePatterns` string default `node_modules/`; both with `z.catch` defaults. Tests in `tests/unit/settings.test.ts` prove both defaults and fallback from invalid stored values. Add a toggle labeled "Show hidden and ignored items" and a multi-line patterns text field to `general-tab.tsx` following existing control patterns, with strings in `src/i18n/en-US.ts`.

## Done When
- `pnpm lint` reports 0 errors.
- `tests/unit/hidden.test.ts` covers every use case above and passes.
- `tests/unit/settings.test.ts` proves both defaults and invalid-value fallback.
- The General settings tab renders "Show hidden and ignored items" and the patterns field.
- Run from `/home/ngosi/projects/markdown-reader`, one at a time, never concurrently:
  - `pnpm typecheck` (Baseline: pass)
  - `pnpm lint` (Baseline: 2 errors from `.ogrep`; must become 0 errors)
  - `pnpm test` (Baseline: pass, 40 files, 485 tests)

## Rules
Read and follow these bundled contracts:
- Contract: `/home/ngosi/projects/refract/plugin/shared/worker-contract.md`
- Response: `/home/ngosi/projects/refract/plugin/shared/erp.md`
- Notes: `/home/ngosi/projects/refract/plugin/shared/notes-template.md`
- Journal: `/home/ngosi/projects/refract/plugin/shared/journal-template.md`

Role boundary: You are the phase implementer, not Coordinator. Edit code only in `/home/ngosi/projects/markdown-reader`; write phase records only under `/home/ngosi/projects/markdown-reader/docs/plans/file-url-folder-tree/phase-01/`. Leave Coordinator skills and Refract job submission to the Coordinator.

## Response Format
Append the complete `# EXTERNAL RESPONSE` block to `/home/ngosi/projects/markdown-reader/docs/plans/file-url-folder-tree/phase-01/journal.md`, then return that block and the matching status line from `erp.md`.
