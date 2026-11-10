# Phase 3: File URL tree in the reader

## Goal & Outcome
- Plan Goal: Opening a local `file://` Markdown file shows a lazy folder tree rooted at its parent folder, with an "Up one level" button; dot-items, `.gitignore` matches, and Settings patterns are hidden unless "Show hidden and ignored items" is on. The Open folder picker tree applies the same hiding rule.
- Phase Outcome: The `file://` tree is wired into the reader store, controller, and Files panel, and works end to end in the built extension.

## Context & Architecture
- Code root: `/home/ngosi/projects/markdown-reader` | Records root: `/home/ngosi/projects/markdown-reader` | Branch: `main` | Base: `refs/plans/file-url-folder-tree/phase-03/base`
- Prior State (Phases 1 and 2 done, committed):
  - `src/source/hidden.ts`: `createHidingRule({ showHiddenItems, ignorePatterns, chain?: { dirPath, gitignoreText }[] })` -> `(entryPath, isDir) => boolean`. `entryPath` and `dirPath` are relative to the chain base, no leading `./` or `/`, never `..` (the `ignore` lib throws RangeError on `..`). Only the entry's own name is checked for a leading dot.
  - `src/source/file-url-tree.ts`: `listDirectory(dirUrl)` -> `{ name, url, isDir }[]` (throws when fetch rejects, e.g. file access off; empty list for a body without rows); `findRepoRoot(dirUrl)` -> repo folder URL or `null`; `fetchGitignore(folderUrl)` -> text or `''`; `getParentUrl(dirUrl)` -> parent URL or `null` at `file:///`, `file:///C:/`, UNC share level.
  - `src/source/directory.ts`: `FileNode { kind:'file', name, path }`, `DirectoryNode { kind:'directory', name, path, children: TreeNode[] | null }` (`null` = not loaded). `buildTree(dirHandle, parentPath, chain, settings)`; `DirectorySource.getTree()` reads settings from `useSettingsStore`.
  - `src/ui/file-tree.tsx`: `FileTree({ nodes, activePath, onSelectFile(path), filter })`; folders render `<Collapsible defaultOpen={node.children !== null}>`; `filterTree` keeps unloaded folders whose own name matches.
  - Settings `general.showHiddenItems` and `general.ignorePatterns` exist.
  - Checks at base: typecheck pass, lint exit 0, `pnpm test` 42 files / 519 tests pass.
- Code Context:
  - `src/store/reader-store.ts`: `ReaderState` has `directorySource`, `treeNodes`; initial state ~line 66.
  - `src/reader/controller.ts`: `sourceGen`/`treeGen` (lines ~47-48); `load(url)` (~261) currently sets `directorySource: null`; `openFileHandle` (~307), `openFolderHandle` (~346), `selectTreeFile` (~404), `drop` (~437); `mount()` (~493) has `useSettingsStore.subscribe` reacting to auto-refresh settings; returned API object (~519).
  - `src/entrypoints/reader/App.tsx` `FilesPanel` (~338): shows `FileTree` when `directorySource`, else "No folder opened." + Open folder button.
  - E2E template for `file://` with extension file access: `tests/e2e/spike-file-fetch.spec.ts` (launchPersistentContext with the built extension at `.output/chrome-mv3`, `setFileAccess` via chrome://extensions toggle, `extensionIdFor`). Also see `tests/e2e/fixtures.ts`.
  - Full design: `/home/ngosi/projects/markdown-reader/docs/plans/file-url-folder-tree/DESIGN.md`. Read "Architecture and Data Flow", "Hiding rule", "Errors and Edge Cases", "Testing".

## Behavior to implement (DESIGN.md, authoritative)
- Store: `fileTree: { rootUrl: string; nodes: TreeNode[] } | null`, default `null`. Node `path` values for this tree are relative to `rootUrl` (e.g. `sub/a.md`); keep enough to map a node back to its URL (`new URL(path, rootUrl)` with proper escaping, or store URLs; your choice, documented in notes).
- `load(url)`: for a `file:` URL inside `fileTree.rootUrl`, keep the tree (root and loaded folders). For a `file:` URL outside it (or no tree), build the tree at the file's parent folder. For any non-file URL, clear `fileTree`. Document loading itself is unchanged.
- Building a level: `listDirectory`, keep only folders and `.md`/`.markdown` files, apply the hiding rule, sort directories first then name (same comparator as `buildTree`), folders get `children: null`. Hiding chain: `.gitignore` files from the entry's folder up to the repo root (`findRepoRoot`), or up to the tree root when there is no repo; Settings patterns relative to the repo root when found, else the tree root. `.gitignore` text fetched once per folder and cached for the tree's lifetime (cache cleared on re-root to a different repo/tree or settings rebuild is acceptable).
- `expandFolder(path)`: fetch one listing, apply hiding, set that node's `children`. On failure, mark the folder with an inline "Could not read folder" message (rest of the tree unaffected).
- `goUp()`: re-root at `getParentUrl(rootUrl)` and graft the current loaded subtree under its folder name (re-prefix paths). No-op/disabled when `getParentUrl` returns `null`.
- Every async tree step bumps or checks `treeGen` after each `await` before `set`; only the latest result applies.
- `openFileHandle`, `openFolderHandle`, and `drop()` clear `fileTree`.
- The existing `useSettingsStore.subscribe` rebuilds the open `fileTree` (root listing plus re-listing loaded folders, or root only; your choice) when `showHiddenItems` or `ignorePatterns` changes. Also refresh the picker tree (`directorySource.getTree()` guarded by `treeGen`) on the same change so the toggle applies to it without reopening.
- UI `FilesPanel`: when `fileTree` is set, render a header row showing the root folder name and an "Up one level" button (lucide icon + accessible label "Up one level"), disabled exactly when `getParentUrl(rootUrl)` is `null`; render `FileTree` with `fileTree.nodes`; file clicks call `controller.load(url)`; folders call `controller.expandFolder(path)` from `onOpenChange` when unloaded (extend `FileTree` with an optional `onExpandFolder(path)` prop or equivalent). Active file highlighting uses the current doc's path relative to `rootUrl`.
- File access off: the root listing throws; Files tab shows the existing "No folder opened." state plus one line saying "Allow access to file URLs" must be enabled (string in `src/i18n/en-US.ts`). Document loading unchanged.
- No listing polling, refresh timer, or focus listener.

## Invariants & Boundaries
- Preserve: `FileUrlSource` reading and watching unchanged. `sourceGen` semantics unchanged. Picker tree flows unchanged except clearing `fileTree` and the settings-driven refresh. Existing e2e and unit tests keep passing.
- Out of Scope: live refresh, `.git/info/exclude`, global excludes, lazy picker tree, searching unloaded folders, `.txt` in trees. Do not read `.env` or credential files.

## Files
Allowed production and test paths:
- `src/store/reader-store.ts` (modify: `fileTree` state)
- `src/reader/controller.ts` (modify: tree building, load keep-or-re-root, expandFolder, goUp, clearing, settings rebuild)
- `src/entrypoints/reader/App.tsx` (modify: FilesPanel rendering)
- `src/ui/file-tree.tsx` (modify: expand callback, inline error display)
- `src/i18n/en-US.ts` (modify: new strings)
- `tests/unit/controller.test.ts`, `tests/unit/reader-store.test.ts`, `tests/unit/reader-app.test.tsx` (modify)
- `tests/e2e/file-url-tree.spec.ts` (create)
- `docs/manual-checklist.md` (modify: picker hiding steps)
- If a new small helper module is clearly warranted for tree-building logic, `src/source/file-url-tree.ts` may be extended; record the reason in notes.

Worker-owned phase records:
- `/home/ngosi/projects/markdown-reader/docs/plans/file-url-folder-tree/phase-03/notes.md` (append `## Task <M>` blocks)
- `/home/ngosi/projects/markdown-reader/docs/plans/file-url-folder-tree/phase-03/journal.md` (append `# EXTERNAL RESPONSE` under `## Implementation Response`)

Read-only / Forbidden:
- Do not edit `PLAN.md`, `DESIGN.md`, `.handover.md`, `prompt.md`, other phases, dependencies, or secrets. Do not commit; the Coordinator owns Git.

## Tasks
- task-1: TDD store and controller per "Behavior to implement". `tests/unit/controller.test.ts` proves keep-or-re-root, Up grafting, clearing on `openFileHandle`/`openFolderHandle`/`drop`/non-file `load`, settings rebuild, and stale-result rejection via `treeGen` (e.g. an expand resolving after a re-root is ignored).
- task-2: TDD UI: FilesPanel header with root folder name and Up button (disabled at root), file clicks call `controller.load(url)`, unloaded folders call `expandFolder` on open, access-off hint, inline expand error. Cover in `tests/unit/reader-app.test.tsx`.
- task-3: End to end: create `tests/e2e/file-url-tree.spec.ts` with a temporary fixture folder (created in the OS temp dir at test time) containing `.git/` (folder), a root `.gitignore`, nested subfolders with `.md` files, a dot-folder, and `node_modules/`. Scenarios: (1) opening a nested `file://` Markdown file roots the tree at its parent folder; (2) expanding a folder loads its contents; (3) "Up one level" climbs one level and keeps the loaded subtree; (4) clicking a file keeps the tree root; (5) hidden and ignored entries are absent by default and appear when the "Show hidden and ignored items" toggle is on. Add picker hiding steps to `docs/manual-checklist.md`.

## Done When
- `tests/e2e/file-url-tree.spec.ts` passes all five scenarios.
- Controller unit tests prove keep-or-re-root, Up grafting, clearing on other sources, and stale-result rejection.
- Run from `/home/ngosi/projects/markdown-reader`, one at a time, never concurrently:
  - `pnpm typecheck` (Baseline: pass)
  - `pnpm lint` (Baseline: exit 0)
  - `pnpm test` (Baseline: 42 files, 519 tests pass)
  - `pnpm build && pnpm exec playwright test tests/e2e/file-url-tree.spec.ts` (new; must pass)
  - `pnpm test:e2e` (Baseline: ~188 tests, about 16 minutes; if it fails only in `tests/e2e/appearance.spec.ts` code theme tests, a passing solo rerun of that spec counts as a pass; record it)

## Rules
Read and follow these bundled contracts:
- Contract: `/home/ngosi/projects/refract/plugin/shared/worker-contract.md`
- Response: `/home/ngosi/projects/refract/plugin/shared/erp.md`
- Notes: `/home/ngosi/projects/refract/plugin/shared/notes-template.md`
- Journal: `/home/ngosi/projects/refract/plugin/shared/journal-template.md`

Role boundary: You are the phase implementer, not Coordinator. Edit code only in `/home/ngosi/projects/markdown-reader`; write phase records only under `/home/ngosi/projects/markdown-reader/docs/plans/file-url-folder-tree/phase-03/`. Leave Coordinator skills and Refract job submission to the Coordinator.

## Response Format
Append the complete `# EXTERNAL RESPONSE` block to `/home/ngosi/projects/markdown-reader/docs/plans/file-url-folder-tree/phase-03/journal.md`, then return that block and the matching status line from `erp.md`.
