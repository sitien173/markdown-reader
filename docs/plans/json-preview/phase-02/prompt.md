# Phase 2: Reader state, loading, and read-only rules

## Goal & Outcome

- Plan Goal: open standalone `.json` and `.jsonc` documents in the reader as highlighted, read-only text, with opt-in automatic redirect and view tools.
- Phase Outcome: the store holds `docKind` for every loaded document, and JSON documents are read-only through every reader entry point. No rendering change: a JSON document still renders through `MarkdownView` after this phase. Phase 3 replaces that.

## Context & Architecture

- Code root: `WORKTREE_PATH` | Records root: `/home/ngosi/projects/markdown-reader` | Branch: `refract/json-preview/phase-02` | Base: `refs/plans/json-preview/phase-02/base`
- Prior State: Phase 1 is complete and merged into your base. It added:
  - `src/lib/doc-kind.ts`, which has zero imports and exports `type DocKind = 'markdown' | 'json' | 'jsonc'`, `docKindFromName(name: string): DocKind`, and `isJsonName(name: string): boolean`. `docKindFromName` tries `new URL(name).pathname` and falls back to the raw name, so both URLs with a query string and bare file names work.
  - `src/lib/json-document.ts` with async `prepareJson`. Phase 2 does not use it.
  - The `general.renderJson` setting and JSON redirect detection.
- Code Context:
  - `src/store/reader-store.ts`: `ReaderState` includes `mode: Mode` at line 20, `dirty: boolean` and `writable: boolean` at lines 32 and 33. `parseMode(raw: string | null): Mode` is at line 47 and the initial state reads `mode: parseMode(params.get('mode'))` at line 54, with `dirty: false` and `writable: false`.
  - `src/reader/controller.ts`: `createController` at line 52 holds `let saver` at line 56. `applyText(value, id, title?, loading?)` at line 82 calls `createDraftSaver` at line 96 and `loadDraft` at line 98. `load(url)` at line 275 computes `const capturedText = fileSource && charsetCompat ? undefined : usableCapturedText(entry, url)` at line 380. Other entry points: `openFileHandle` 396, `selectTreeFile` 499, `drop` 532 which calls `applyText(value, dropFileIdentity(file), file.name)` at 555, and `setMode(next: Mode)` at 574.
  - `src/reader/commands.ts`: `export type CommandState = Pick<ReaderState, 'text' | 'writable' | 'mode'>` at line 22. Each command has `available(state: CommandState): boolean`. `save` uses `hasDoc(s) && s.writable`; `mode-edit`, `mode-split`, and `toggle-raw` use `hasDoc`; `export-html` and `print` both use `canExport`.
  - `src/source/file-handle.ts`: the picker at line 22 passes `types: [{ description: 'Markdown files', accept: { 'text/markdown': ['.md', '.markdown'] } }]`. `isValidMarkdownFile(filename)` is at line 68.
  - `src/source/directory.ts`: the tree entry filter `/\.(?:md|markdown)$/i.test(entry.name)` is at line 95; link resolution uses the same pattern at lines 282, 293, and 302.
  - `src/source/file-url-tree.ts`: the entry filter `rawEntries.filter((e) => e.isDir || /\.(?:md|markdown)$/i.test(e.name))` is at line 204.
  - `src/render/links.ts`: `data-md-link` is set behind `/\.(?:md|markdown)$/i` at lines 21 and 61.

## Invariants & Boundaries

- Preserve:
  - Every behavior for `docKind === 'markdown'` is byte-for-byte unchanged: loading, captured text, drafts, modes, and command availability. Existing Markdown tests must pass untouched.
  - Print availability is unchanged for both kinds.
  - Folder pruning for folders that contain neither Markdown nor JSON is unchanged. Folders holding only JSON files now appear in trees; that is intended.
  - The source file is never written for a JSON document, and no draft key is ever written for a JSON source.
- Out of Scope:
  - Any rendering change. Do not create `JsonView`, do not touch `src/render/highlight.ts`, and do not add a parse-error banner. Those are Phase 3.
  - Any transform, toolbar, or download work. Those are Phases 4 and 5.
  - `src/lib/json-document.ts` and `tests/unit/json-document.test.ts`. Another phase is editing those files in parallel; touching them will cause a merge conflict.
  - Do not read or edit `.env` or any credential file.

## Files

Allowed production and test paths:

- `src/store/reader-store.ts` (modify: add `docKind` to `ReaderState` and clamp the initial mode)
- `src/reader/controller.ts` (modify: set `docKind` on every load path and apply the read-only rules)
- `src/reader/commands.ts` (modify: add `docKind` to `CommandState` and the availability rules)
- `src/ui/reader-menu.tsx` (modify: include `docKind` in the selector)
- `src/ui/command-palette.tsx` (modify: include `docKind` in the selector)
- `src/source/file-handle.ts` (modify: picker types and `isValidMarkdownFile`)
- `src/source/directory.ts` (modify: tree filter and link resolution)
- `src/source/file-url-tree.ts` (modify: entry filter)
- `src/render/links.ts` (modify: `data-md-link` rule)
- `src/entrypoints/reader/App.tsx` (modify: sidebar tab only)
- `tests/unit/reader-store.test.ts` (modify)
- `tests/unit/controller.test.ts` (modify)
- `tests/unit/commands.test.ts` (modify)
- `tests/unit/file-handle.test.ts` (modify)
- `tests/unit/directory.test.ts` (modify)
- `tests/unit/file-url-tree.test.ts` (modify)
- `tests/unit/links.test.ts` (modify)
- `tests/unit/reader-app.test.tsx` (modify)

Worker-owned phase records, written to the records root by absolute path:

- `/home/ngosi/projects/markdown-reader/docs/plans/json-preview/phase-02/notes.md` (append `## Task <M>` blocks)
- `/home/ngosi/projects/markdown-reader/docs/plans/json-preview/phase-02/journal.md` (append `# EXTERNAL RESPONSE` under `## Implementation Response`)

Read-only / Forbidden:

- Do not edit `PLAN.md`, `DESIGN.md`, `.handover.md`, `prompt.md`, any other phase directory, or any path not listed above.

## Tasks

- task-1: TDD the store and controller. Add `docKind: DocKind` to `ReaderState` with initial value `'markdown'`, derived from the `src` URL parameter so that a JSON `src` clamps the initial `mode` to `read`. Every load path in `src/reader/controller.ts` sets `docKind` through `docKindFromName`, leaving no stale kind from the previous document. For JSON kinds: `load` skips `usableCapturedText` and always reads through the source; `applyText` creates no `createDraftSaver` and calls no `loadDraft`; `mode` is set to `read`; `writable` is `false`; and `setMode` and the edit path return without changing state.
- task-2: TDD commands. Add `docKind` to `CommandState`. Make `save`, `mode-edit`, `mode-split`, `toggle-raw`, and `export-html` unavailable for JSON kinds. Leave `print` with its current rule. Update the `useStore` selectors in `src/ui/reader-menu.tsx` and `src/ui/command-palette.tsx` to include `docKind`.
- task-3: TDD the entry points. Add a JSON entry to the picker `types` in `FileHandleSource.pick` covering `.json` and `.jsonc`. Make `isValidMarkdownFile` and the `drop` path accept them. Make tree building and link resolution in `src/source/directory.ts`, the entry filter in `src/source/file-url-tree.ts`, and the `data-md-link` rule in `src/render/links.ts` treat `.json` and `.jsonc` as reader documents, through `isJsonName` from `src/lib/doc-kind.ts` rather than new inline regexes.
- task-4: TDD the sidebar. In `src/entrypoints/reader/App.tsx`, hide the Contents toggle item and show the Files panel while `docKind` is a JSON kind. Change nothing else in that file.

## Done When

- `tests/unit/controller.test.ts` proves: `drop` accepts `.json`; captured text is ignored and the URL is read for `.json`; a stored draft is not restored and `dirty` stays `false`; mode switches from `split` to `read` on JSON open; `setMode('edit')` is ignored for JSON; and existing Markdown behavior is unchanged.
- `tests/unit/reader-store.test.ts` proves `?src=a.json&mode=edit` starts in `read`.
- `tests/unit/commands.test.ts` proves the full availability table for both JSON and Markdown.
- `tests/unit/file-handle.test.ts`, `tests/unit/directory.test.ts`, `tests/unit/file-url-tree.test.ts`, and `tests/unit/links.test.ts` prove JSON acceptance in the picker types, the drop check, the picker tree, the `file://` tree, and link marking.
- `tests/unit/reader-app.test.tsx` proves the Contents toggle is absent for a JSON document.
- Run from the code root, one at a time, never concurrently:
  - `pnpm typecheck` (Baseline: pass)
  - `pnpm lint` (Baseline: pass, 0 errors, 208 warnings, 3 infos. Leave the warning count no higher than you found it.)
  - `pnpm test` (Baseline: pass, 45 files, 562 tests. Expect your new tests to raise the counts.)

## Rules

Read and follow these bundled contracts:

- Contract: `/home/ngosi/projects/refract/plugin/shared/worker-contract.md`
- Response: `/home/ngosi/projects/refract/plugin/shared/erp.md`
- Notes: `/home/ngosi/projects/refract/plugin/shared/notes-template.md`
- Journal: `/home/ngosi/projects/refract/plugin/shared/journal-template.md`

Project conventions live in `CODING_STANDARDS.md` and `AGENTS.md` at the code root. Read both before writing code. `browser`, `defineBackground`, and `defineContentScript` are auto-imported by WXT; do not import them.

Role boundary: You are the phase implementer, not Coordinator. Edit code only inside the code root. Write phase records only under the records root path given above. Make no Git commit, no branch change, and no Refract job submission. Leave all Git operations to the Coordinator.

## Response Format

Append the complete `# EXTERNAL RESPONSE` block to `/home/ngosi/projects/markdown-reader/docs/plans/json-preview/phase-02/journal.md`, then return that block and the matching status line from `erp.md`.
