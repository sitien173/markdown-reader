# File URL Folder Tree Design

**Status:** Confirmed 2026-11-10
**Consultation:** Two consults ran: google profile job `2ba9a0e4-59f3-431d-aa81-b0a43251b241`; anthropic profile job `5a0eb451-0ecd-4eae-a487-c5c82ae824c3`. The openai profile job `77d457e3-1ebb-478d-9433-4fa841b8d574` failed with `transient`. Disagreements and their resolution are listed under Chosen Approach.

## Purpose

When the reader opens a local `file://` Markdown URL, the Files tab shows a folder tree automatically. Today it shows "No folder opened." because `load()` in `src/reader/controller.ts` clears `directorySource`, and a tree exists only after the Open folder picker.

## Users and Success Criteria

Users: anyone reading local Markdown files through `file://` URLs with "Allow access to file URLs" enabled.

Success criteria:

1. Opening a `file://` Markdown file roots the tree at the file's parent folder.
2. An "Up one level" button re-roots the tree at the parent folder, repeatedly, up to the filesystem root.
3. Subfolders load on expand, not by a full scan.
4. By default the tree hides dot-items, entries ignored by real `.gitignore` files, and entries matched by Settings patterns.
5. One Settings toggle, "Show hidden and ignored items", reveals all hidden entries.
6. The same hiding rules apply to the Open folder picker tree.
7. Clicking a file inside the current root opens it and keeps the tree root and loaded folders.

## Constraints, Invariants, and Non-Goals

Constraints:

- Folder listing uses Chrome's `file://` directory listing. Verified on 2026-11-10: `fetch('file:///tmp/mdr-spike/')` from `reader.html` returned `response.ok === false` with a full body containing `<script>addRow("sub","sub",1,60,"60 B",...);</script>` rows. Arguments: display name, URL-escaped name, isDir, size, size text, mtime, date text. The format is undocumented by Chrome.
- Adds the `ignore` npm package, version 7.0.14 at design time. Gitignore matching with nesting and negation is not a few lines of code.
- Settings additions use `z.catch` defaults in `src/lib/settings.ts`, so stored settings need no migration.

Invariants:

- The Open folder picker tree keeps its full recursive scan, its `.md`/`.markdown` filter, and its pruning of folders without Markdown.
- Both trees list only `.md` and `.markdown` files.
- Existing `file://` document loading, reading, and watching in `FileUrlSource` stay unchanged.
- Existing race guards `sourceGen` and `treeGen` in `controller.ts` keep their meaning.

Non-goals:

- Live refresh of folder listings, polling, or focus refresh.
- `.git/info/exclude` and global git excludes.
- Lazy loading for the Open folder picker tree.
- Searching or palette-listing files in folders that are not loaded.
- Listing `.txt` files in the tree when "Render .txt as Markdown" is on.

## Chosen Approach

Option A: a separate lazy tree for `file://` URLs, with a shared hiding rule. The Open folder picker tree stays eager and gains the hiding rule.

Rejected alternatives:

- Option B, one lazy model for both trees: bigger diff and a behavior change to the picker tree, which would show folders without Markdown and change first-file selection.
- Full scan for the `file://` tree: rejected by the user; climbing to `$HOME` or `/` would scan huge trees.

Consultation disagreements and resolution:

| Topic | Google consult | Anthropic consult | Decision |
|---|---|---|---|
| Picker tree loading | Switch to lazy to avoid scanning `node_modules` when show-hidden is on | Keep eager; `snapshotDirectory` in `watch.ts` already scans every entry regardless | Keep eager |
| Settings pattern order | Test Settings patterns first; first decisive result wins | Settings patterns only hide; a `!` pattern must not un-hide gitignored entries | Settings patterns only hide |
| Ancestor `.git` search depth | Cap at 8 levels | No cap; one cached listing per level, a cap misses deep repos | No cap |
| Expansion state | `expandedPaths` in the reader store, controlled `Collapsible` | Uncontrolled `Collapsible` with `defaultOpen={children !== null}` | Uncontrolled |
| Listing refresh | Refresh root and expanded listings on window focus | No refresh | No refresh |

## Architecture and Data Flow

New modules:

- `src/source/file-url-tree.ts`
  - `listDirectory(dirUrl)` fetches the listing, ignores `response.ok`, parses each `addRow(...)` argument list with `JSON.parse('[' + args + ']')`, and skips the `..` row. Names for display and matching come from argument 1. Child URLs come from argument 2 as `new URL('./' + raw + (isDir ? '/' : ''), dirUrl)`.
  - `findRepoRoot(dirUrl)` climbs parent listings until it finds an entry named `.git`, either a folder or a file. It returns `null` at the filesystem root.
- `src/source/hidden.ts`: the shared hiding rule, built on `ignore`.

Changed code:

- `src/source/directory.ts`: `DirectoryNode.children` becomes `TreeNode[] | null`, where `null` means not loaded. `handle` is removed from `FileNode` and `DirectoryNode`; `App.tsx` and `command-palette.tsx` use only `path`. `buildTree` receives the hiding rule and applies it during recursion.
- `src/store/reader-store.ts`: adds `fileTree: { rootUrl, nodes } | null`.
- `src/reader/controller.ts`:
  - `load(url)`: for a `file:` URL inside `fileTree.rootUrl`, keep the tree. For a `file:` URL outside it, rebuild the tree at the file's parent folder. For any other URL, clear it.
  - `expandFolder(path)`: fetch one listing, apply the hiding rule, and set that node's `children`.
  - `goUp()`: re-root at `new URL('..', rootUrl)` and graft the current loaded subtree under its folder name. Disabled when `..` resolves to the same URL.
  - Every async tree step checks the existing `treeGen`.
  - `openFileHandle`, `openFolderHandle`, and `drop()` clear `fileTree`.
  - The existing `useSettingsStore.subscribe` rebuilds the open tree when `showHiddenItems` or `ignorePatterns` changes.
- `src/entrypoints/reader/App.tsx`: `FilesPanel` renders `fileTree` when set, with a header row showing the root folder name and an "Up one level" button. Clicking a file calls `controller.load(url)`.
- `src/ui/file-tree.tsx`: folders use `defaultOpen={children !== null}`; `onOpenChange` calls `expandFolder` for unloaded folders. `filterTree` uses `children ?? []` and keeps an unloaded folder whose own name matches.
- `src/ui/command-palette.tsx`: `flattenFiles` uses `children ?? []`.

Hiding rule:

- New settings under `general`: `showHiddenItems: boolean`, default `false`, labeled "Show hidden and ignored items"; `ignorePatterns: string`, default `node_modules/`, a multi-line gitignore-syntax field. Both appear in `src/ui/settings/general-tab.tsx`.
- With `showHiddenItems` off, an entry is hidden when any condition holds:
  1. Its name starts with `.`.
  2. It matches a Settings pattern. Settings patterns are evaluated relative to the repo root when one is found, otherwise the tree root. They only hide.
  3. The `.gitignore` chain ignores it. The chain is the `.gitignore` files from the entry's folder up to the repo root, or up to the tree root when there is no repo. Each level has its own `ignore` instance; levels are tested deepest first with `test(relPath)`, and the first result with `ignored` or `unignored` decides. Folder paths end with `/`. Relative paths have no leading `./` or `/`.
- With `showHiddenItems` on, nothing is hidden.
- Picker tree: the chain uses only `.gitignore` files inside the picked folder, and Settings patterns are relative to the picked folder.
- `.gitignore` contents are fetched once per folder and cached for the tree's lifetime.

## Errors and Edge Cases

- File URL access off: the root listing fetch throws. The Files tab shows the current "No folder opened." state plus one line saying "Allow access to file URLs" must be enabled. Document loading is unchanged.
- Listing body without `addRow` rows: the folder shows as empty, with no error.
- Expand failure: that folder shows an inline "Could not read folder" message; the rest of the tree is unaffected.
- Races: expand, Up, settings rebuilds, and navigation bump or check `treeGen`; only the latest result applies.
- Navigation outside the root, such as Back or a link to another folder: the tree re-roots at the new file's parent folder.
- Filesystem root: "Up one level" is disabled at `file:///` and `file:///C:/`. For `file://server/share/` paths it is disabled at the share level.
- Climbing to `/` or `$HOME`: one listing fetch per level; subfolders stay unloaded.
- No live refresh: entries added after a folder loads appear after re-rooting or reopening the file.

## Migration

n/a. New settings fields use `z.catch` defaults, so existing stored settings parse unchanged.

## Testing

Unit tests, Vitest, in `tests/unit/`:

- Listing parser: normal rows, `..` skipped, escaped display names such as `\u003C` and quotes, URL-escaped names with `#`, `%`, spaces, and `:`, a body without `addRow`, Up limits for `C:/` and UNC paths.
- `hidden.ts`: dot-items, Settings patterns, a Settings `!` pattern that must not un-hide, folder-only patterns needing a trailing `/`, a nested `.gitignore` negation overriding a parent rule, an ancestor `.gitignore` above the tree root, and the show-hidden toggle.
- `buildTree`: hiding applied, folders without Markdown still pruned.
- Settings schema: new defaults; invalid stored values fall back to defaults.
- `filterTree` and `flattenFiles`: `null` children handled.

End-to-end, Playwright, new `tests/e2e/file-url-tree.spec.ts`, with a temporary fixture folder containing `.git/`, a root `.gitignore`, nested subfolders, a dot-folder, and `node_modules/`:

1. Opening a nested `file://` Markdown file roots the tree at its parent folder.
2. Expanding a folder loads its contents.
3. "Up one level" climbs one level and keeps the loaded subtree.
4. Clicking a file keeps the tree root.
5. Hidden and ignored entries are absent by default and appear when the toggle is on.

Manual: the picker tree's hiding behavior is added to `docs/manual-checklist.md`, since the native picker cannot be automated.

Fresh verification commands:

```
pnpm typecheck
pnpm lint
pnpm test
pnpm test:e2e
```

## Risks and Open Questions

Risks:

- Highest: controller rewiring. `load()`, `drop()`, `openFileHandle`, and `openFolderHandle` each reset tree state, and expand, Up, and settings rebuilds race with `sourceGen` and `treeGen`.
- The `addRow` listing format is undocumented by Chrome and could change. Parser unit tests and the end-to-end test detect a change.
- Brave was not tested. It is expected to share Chromium's listing code, but the listing was verified only in Playwright Chromium.

Open questions: none.
