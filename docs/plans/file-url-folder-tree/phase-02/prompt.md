# Phase 2: Lazy-capable tree types, file URL listing, and picker tree hiding

## Goal & Outcome
- Plan Goal: Opening a local `file://` Markdown file shows a lazy folder tree rooted at its parent folder, with an "Up one level" button; dot-items, `.gitignore` matches, and Settings patterns are hidden unless "Show hidden and ignored items" is on. The Open folder picker tree applies the same hiding rule.
- Phase Outcome: All non-controller building blocks for the `file://` tree exist and are tested (lazy-capable tree types, `src/source/file-url-tree.ts`), and the Open folder picker tree honors the hiding rule.

## Context & Architecture
- Code root: `/home/ngosi/projects/markdown-reader` | Records root: `/home/ngosi/projects/markdown-reader` | Branch: `main` | Base: `refs/plans/file-url-folder-tree/phase-02/base`
- Prior State: Phase 1 done. `src/source/hidden.ts` exports `createHidingRule({ showHiddenItems, ignorePatterns, chain?: { dirPath, gitignoreText }[] })` returning `(entryPath, isDir) => boolean`. `entryPath` is relative to the chain base, with no leading `./` or `/`, and must never contain `..` (the `ignore` library throws `RangeError` on such paths). `dirPath` is relative to the chain base, `''` for the base. Settings `general.showHiddenItems` (default false) and `general.ignorePatterns` (default `node_modules/`) exist in `src/lib/settings.ts`; the store is `useSettingsStore` in `src/store/settings-store.ts`. Checks pass: typecheck, lint 0 errors, 41 test files / 495 tests.
- Code Context:
  - `src/source/directory.ts`: `FileNode` and `DirectoryNode` currently carry `handle`; `DirectoryNode.children: TreeNode[]`. `buildTree(dirHandle, parentPath)` recurses eagerly, keeps only `.md`/`.markdown`, prunes folders with no Markdown, sorts directories first then name. `DirectorySource.getTree()` calls it.
  - `src/ui/file-tree.tsx`: `FileTree` with `filterTree`; `onSelectFile(path, handle)`; folders use `<Collapsible defaultOpen>`.
  - `src/ui/command-palette.tsx:47` `flattenFiles` recurses `n.children`. (Line ~131 `item.entry.handle` is a recent-item handle, not a tree node; leave it.)
  - `src/reader/controller.ts`: `findFirstFile(node.children)` at ~line 19; `treeGen` race guard ~line 109.
  - `src/entrypoints/reader/App.tsx`: passes `onSelectFile` to `FileTree`.
  - Full design: `/home/ngosi/projects/markdown-reader/docs/plans/file-url-folder-tree/DESIGN.md`. Read "Constraints", "Architecture and Data Flow", "Hiding rule", "Errors and Edge Cases", "Testing".

## Listing format (verified, from DESIGN.md)
`fetch('file:///dir/')` from the extension page returns `response.ok === false` but a full HTML body containing `<script>addRow("name","url-escaped-name",isDir,size,"size text",mtime,"date text");</script>` rows. Argument 1 is the display name (JS string literal, may contain `\u003C` escapes and escaped quotes), argument 2 is the URL-escaped name, argument 3 is 1/0 or true/false for isDir. Parse each argument list with `JSON.parse('[' + args + ']')`, no `eval`/`Function`. Skip the `..` row. Child URL: `new URL('./' + raw + (isDir ? '/' : ''), dirUrl)`. Display and matching use argument 1. Never reject on `response.ok`. A body without `addRow` yields an empty list. Fetch rejection (file access off) propagates as a thrown error.

## Invariants & Boundaries
- Preserve: picker tree stays eager, `.md`/`.markdown` only, prunes folders without Markdown, keeps current sort order. Picker tree output is identical to today when nothing matches the hiding rule. `FileTree` keeps current behavior for fully loaded trees.
- Picker hiding: the chain uses only `.gitignore` files inside the picked root, read via directory handles; Settings patterns are relative to the picked root; rule reads current settings from `useSettingsStore.getState()`. Hidden folders are not descended into.
- Out of Scope: reader store, controller flows, `App.tsx` behavior (only changes the type change forces to compile), Files panel UI for the file URL tree, settings-driven rebuilds (Phase 3). Do not read `.env` or credential files.

## Files
Allowed production and test paths:
- `src/source/directory.ts` (modify: `children: TreeNode[] | null`, remove `handle` from nodes, apply hiding rule in `buildTree`/`getTree`)
- `src/source/file-url-tree.ts` (create: `listDirectory`, `findRepoRoot`, `.gitignore` fetch helper, parent URL helper)
- `src/ui/file-tree.tsx` (modify: `onSelectFile(path)`, `children ?? []`, unloaded-folder filtering)
- `src/ui/command-palette.tsx` (modify: `flattenFiles` uses `children ?? []`)
- `src/reader/controller.ts` (modify: compile-only changes)
- `src/entrypoints/reader/App.tsx` (modify: compile-only changes)
- `tests/unit/file-url-tree.test.ts` (create)
- `tests/unit/directory.test.ts`, `tests/unit/file-tree.test.ts`, `tests/unit/reader-app.test.tsx` (modify)

Worker-owned phase records:
- `/home/ngosi/projects/markdown-reader/docs/plans/file-url-folder-tree/phase-02/notes.md` (append `## Task <M>` blocks)
- `/home/ngosi/projects/markdown-reader/docs/plans/file-url-folder-tree/phase-02/journal.md` (append `# EXTERNAL RESPONSE` under `## Implementation Response`)

Read-only / Forbidden:
- Do not edit `PLAN.md`, `DESIGN.md`, `.handover.md`, `prompt.md`, other phases, dependencies, or secrets. Do not commit; the Coordinator owns Git.

## Tasks
- task-1: TDD types. `DirectoryNode.children` becomes `TreeNode[] | null` (`null` = not loaded). Remove `handle` from `FileNode` and `DirectoryNode`; `FileTree` `onSelectFile` takes only `path`. `filterTree` and `flattenFiles` use `children ?? []`; `filterTree` keeps an unloaded folder whose own name matches the filter. `controller.ts` and `App.tsx` change only as needed to compile (any place that used a node `handle` must resolve via path, e.g. `DirectorySource` already has `getFileHandle(path)`). Tests in `tests/unit/file-tree.test.ts` prove `null` children render as a collapsed folder and filtering does not crash on them. Existing fixtures drop `handle` fields only.
- task-2: TDD `src/source/file-url-tree.ts`: `listDirectory(dirUrl)` returning entries with display `name`, `url`, `isDir`; `findRepoRoot(dirUrl)` climbing parent listings until an entry named `.git` (folder or file) is found, returning that folder URL or `null` at the filesystem root (no depth cap); a helper fetching a folder's `.gitignore` text (empty string when absent); a parent URL helper returning `null` at `file:///`, `file:///C:/` (drive root), and the UNC share level `file://server/share/`. Unit tests mock `fetch` with real `addRow` bodies: normal rows, `..` skipped, escaped display names (`\u003C`, quotes), URL-escaped names with `#`, `%`, spaces, `:`, a body without `addRow`, `response.ok === false` still parsed, parent limits.
- task-3: TDD picker hiding: `buildTree` and `DirectorySource.getTree` apply the hiding rule, reading `.gitignore` files inside the picked root via handles, Settings patterns relative to the picked root, settings from `useSettingsStore.getState()`. `tests/unit/directory.test.ts` proves dot-items, gitignored entries, and Settings-pattern matches are hidden, the toggle shows them, and folders without Markdown are still pruned.

## Done When
- Parser, URL, parent-limit, and repo-root tests pass.
- `tests/unit/directory.test.ts` proves picker hiding and pruning.
- `tests/unit/file-tree.test.ts` proves `null` children render collapsed and filtering tolerates them.
- Existing unit tests pass unchanged except removed `handle` fields in fixtures.
- Run from `/home/ngosi/projects/markdown-reader`, one at a time, never concurrently:
  - `pnpm typecheck` (Baseline: pass)
  - `pnpm lint` (Baseline: exit 0, 0 errors)
  - `pnpm test` (Baseline: 41 files, 495 tests pass)

## Rules
Read and follow these bundled contracts:
- Contract: `/home/ngosi/projects/refract/plugin/shared/worker-contract.md`
- Response: `/home/ngosi/projects/refract/plugin/shared/erp.md`
- Notes: `/home/ngosi/projects/refract/plugin/shared/notes-template.md`
- Journal: `/home/ngosi/projects/refract/plugin/shared/journal-template.md`

Role boundary: You are the phase implementer, not Coordinator. Edit code only in `/home/ngosi/projects/markdown-reader`; write phase records only under `/home/ngosi/projects/markdown-reader/docs/plans/file-url-folder-tree/phase-02/`. Leave Coordinator skills and Refract job submission to the Coordinator.

## Response Format
Append the complete `# EXTERNAL RESPONSE` block to `/home/ngosi/projects/markdown-reader/docs/plans/file-url-folder-tree/phase-02/journal.md`, then return that block and the matching status line from `erp.md`.
