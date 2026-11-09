# File URL Folder Tree Plan

**Design:** [DESIGN.md](DESIGN.md)
**Context key:** `file-url-folder-tree`
**Base:** `refs/plans/file-url-folder-tree/base` (`ab6c488d9c7cd98df98583336d74705306c0c236`)
**Commit:** `feat(reader): show a lazy folder tree for file URLs with gitignore-aware hiding`

## Outcome & Scope

Opening a local `file://` Markdown file shows a lazy folder tree rooted at its parent folder, with an "Up one level" button. Dot-items, `.gitignore` matches, and Settings patterns are hidden unless "Show hidden and ignored items" is on. The Open folder picker tree applies the same hiding rule.

Preserved invariants: listed in DESIGN.md under Constraints, Invariants, and Non-Goals. In short: the picker tree stays eager with `.md`/`.markdown` filtering and empty-folder pruning; `FileUrlSource` reading and watching stay unchanged; `sourceGen` and `treeGen` keep their meaning.

Out of scope: live listing refresh, `.git/info/exclude`, global git excludes, lazy picker tree, searching unloaded folders, `.txt` files in trees.

Secret handling: no phase reads `.env` or credential files.

## Baseline Evidence

Recorded at `ab6c488` on 2026-11-10.

- `pnpm typecheck`: pass.
- `pnpm lint`: fail, 2 errors, 183 warnings, 3 infos. Both errors are formatter diffs in `.ogrep/lance/**/latest_version_hint.json`, a local search index ignored only by the user's global `~/.gitignore`, which Biome does not read. Phase 1 repairs this.
- `pnpm test`: pass, 40 files, 485 tests, when run alone. A run concurrent with `pnpm test:e2e` reported 10 errors under load average 8.
- `pnpm test:e2e`: 186 passed, 2 failed, about 16.3 minutes. Failures: `tests/e2e/appearance.spec.ts:52:3` and `:65:3`, code theme tests, during a run concurrent with `pnpm test`. A solo rerun of `pnpm exec playwright test tests/e2e/appearance.spec.ts` passed 15 of 15.

Evidence rule for later phases: run verification commands one at a time, never concurrently. If `pnpm test:e2e` fails only in `tests/e2e/appearance.spec.ts` code theme tests, a passing solo rerun of that spec counts as a pass and is recorded in the phase journal.

### Phase 1: Baseline repair, hiding rule, and settings

**Phase Request:** Repair the lint baseline. Add the `ignore` dependency. Create the shared hiding rule module described in DESIGN.md, Architecture and Data Flow, Hiding rule. Add the `showHiddenItems` and `ignorePatterns` settings with Settings UI controls. Use cases: a dot-item is hidden; a Settings pattern hides an entry; a Settings `!` pattern never un-hides a gitignored entry; a nested `.gitignore` negation overrides a parent rule; folder-only patterns match folders via a trailing `/`; the toggle reveals everything.
**Goal:** A tested, source-agnostic hiding rule and its two settings exist; lint passes.
**Depends on:** none
**Invariants & Boundaries:** `src/source/hidden.ts` performs no I/O; callers supply `.gitignore` contents and relative paths. Settings parse existing stored values unchanged through `z.catch` defaults. No tree or controller changes in this phase.
**Files:**
- Modify: `biome.json`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Create: `src/source/hidden.ts`
- Modify: `src/lib/settings.ts`
- Modify: `src/ui/settings/general-tab.tsx`
- Modify: `src/i18n/en-US.ts`
- Create: `tests/unit/hidden.test.ts`
- Modify: `tests/unit/settings.test.ts`
**Tasks:**
1. Add `"!**/.ogrep"` to `files.includes` in `biome.json`, next to `"!**/.tgrep"`. Add `ignore` at the exact version `7.0.14` with `pnpm add ignore@7.0.14`.
2. TDD `src/source/hidden.ts`: a rule built from `showHiddenItems`, `ignorePatterns`, and an ordered chain of `{ dirPath, gitignoreText }` levels. It exposes a predicate taking an entry path relative to the chain's base and an `isDir` flag. Semantics are exactly as in DESIGN.md: dot-prefix, Settings patterns hide only, `.gitignore` levels tested deepest first with `ignore().test()`, first `ignored` or `unignored` result decides, trailing `/` for folders, no leading `./` or `/`.
3. TDD settings: `general.showHiddenItems` boolean default `false`; `general.ignorePatterns` string default `node_modules/`; both with `z.catch` defaults in `src/lib/settings.ts`. Add a toggle and a multi-line text field to `general-tab.tsx` following existing control patterns, with labels and descriptions in `src/i18n/en-US.ts`.
**Acceptance Criteria:**
- `pnpm lint` reports 0 errors.
- `tests/unit/hidden.test.ts` covers every use case in the Phase Request and passes.
- `tests/unit/settings.test.ts` proves both defaults and fallback from invalid stored values.
- The General settings tab renders "Show hidden and ignored items" and the patterns field.
**Reviewer Checklist:**
- Settings `!` patterns cannot un-hide.
- No I/O or browser API in `hidden.ts`.
- `ignore` pinned to `7.0.14`; no other dependency added.
- No change outside the listed files.
**Verification Checks:**
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`

### Phase 2: Lazy-capable tree types, file URL listing, and picker tree hiding

**Phase Request:** Make tree nodes support unloaded folders, add the `file://` listing module, and apply the hiding rule to the Open folder picker tree. Use cases: parse a Chrome listing; build child URLs from URL-escaped names; detect the filesystem root for Up; find the repo root through a `.git` folder or file; picker tree hides dot-items, gitignored entries, and Settings-pattern matches while still pruning folders without Markdown; filter and command palette tolerate unloaded folders.
**Goal:** All non-controller building blocks for the `file://` tree exist and are tested, and the picker tree honors the hiding rule.
**Depends on:** Phase 1
**Invariants & Boundaries:** Picker tree stays eager, `.md`/`.markdown` only, prunes folders without Markdown, keeps current sort order. `FileTree` keeps current behavior for fully loaded trees. No store, controller-flow, or `App.tsx` changes beyond what the type change forces to compile.
**Files:**
- Modify: `src/source/directory.ts`
- Create: `src/source/file-url-tree.ts`
- Modify: `src/ui/file-tree.tsx`
- Modify: `src/ui/command-palette.tsx`
- Modify: `src/reader/controller.ts`
- Modify: `src/entrypoints/reader/App.tsx`
- Create: `tests/unit/file-url-tree.test.ts`
- Modify: `tests/unit/directory.test.ts`
- Modify: `tests/unit/file-tree.test.ts`
- Modify: `tests/unit/reader-app.test.tsx`
**Tasks:**
1. TDD types: `DirectoryNode.children` becomes `TreeNode[] | null`; remove `handle` from `FileNode` and `DirectoryNode`; `FileTree` `onSelectFile` takes only `path`. Update `filterTree` and `flattenFiles` to use `children ?? []`, and keep an unloaded folder whose own name matches the filter. `controller.ts` and `App.tsx` change only as needed to compile.
2. TDD `src/source/file-url-tree.ts`: `listDirectory(dirUrl)` and `findRepoRoot(dirUrl)` per DESIGN.md, plus a helper to fetch a folder's `.gitignore` text and a helper that returns the parent URL or `null` at `file:///`, `file:///C:/`, and the UNC share level. Unit tests mock `fetch` with real `addRow` bodies, including escaped names, the `..` row, and a body without `addRow`.
3. TDD picker hiding: `buildTree` and `DirectorySource.getTree` apply the hiding rule, reading `.gitignore` files inside the picked root via handles, with Settings patterns relative to the picked root. The rule reads current settings from `useSettingsStore`.
**Acceptance Criteria:**
- Parser, URL, parent-limit, and repo-root tests pass.
- `tests/unit/directory.test.ts` proves picker hiding and that folders without Markdown are still pruned.
- `tests/unit/file-tree.test.ts` proves `null` children render as a collapsed folder and filtering does not crash on them.
- Existing unit tests pass unchanged except for removed `handle` fields in fixtures.
**Reviewer Checklist:**
- Child URLs use argument 2 with a `./` prefix; display and matching use argument 1.
- `response.ok` is not used to reject listings.
- No `eval` or `Function` in the parser.
- Picker tree output is identical to today when nothing matches the hiding rule.
**Verification Checks:**
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`

### Phase 3: File URL tree in the reader

**Phase Request:** Wire the `file://` tree into the store, controller, and Files panel. Use cases: opening a nested `file://` file roots the tree at its parent; expanding loads one listing; Up re-roots and keeps the loaded subtree; clicking a file inside the root keeps the tree; navigating outside the root re-roots; picker, file handle, and drop flows clear the file tree; settings changes rebuild the open tree; file access off shows the empty state with the access hint; expand failure shows an inline message.
**Goal:** The feature works end to end in the built extension.
**Depends on:** Phase 2
**Invariants & Boundaries:** `FileUrlSource` reading and watching unchanged. `sourceGen` semantics unchanged. Every async tree step checks `treeGen`. No listing polling or focus refresh.
**Files:**
- Modify: `src/store/reader-store.ts`
- Modify: `src/reader/controller.ts`
- Modify: `src/entrypoints/reader/App.tsx`
- Modify: `src/ui/file-tree.tsx`
- Modify: `src/i18n/en-US.ts`
- Modify: `tests/unit/controller.test.ts`
- Modify: `tests/unit/reader-store.test.ts`
- Modify: `tests/unit/reader-app.test.tsx`
- Create: `tests/e2e/file-url-tree.spec.ts`
- Modify: `docs/manual-checklist.md`
**Tasks:**
1. TDD store and controller: add `fileTree: { rootUrl, nodes } | null`; implement the `load()` keep-or-re-root rule, `expandFolder(path)`, `goUp()`, clearing in `openFileHandle`, `openFolderHandle`, and `drop()`, and settings-driven rebuild in the existing `useSettingsStore.subscribe`. Cover races with `treeGen` in `tests/unit/controller.test.ts`.
2. TDD UI: `FilesPanel` renders `fileTree` with a header showing the root folder name and an "Up one level" button, disabled at the root; file clicks call `controller.load(url)`; folders use `defaultOpen={children !== null}` and call `expandFolder` from `onOpenChange`; the access-off hint and inline expand error render as DESIGN.md specifies.
3. End to end: create `tests/e2e/file-url-tree.spec.ts` with a temporary fixture folder holding `.git/`, a root `.gitignore`, nested subfolders, a dot-folder, and `node_modules/`, covering the five scenarios in DESIGN.md Testing. Add picker hiding steps to `docs/manual-checklist.md`.
**Acceptance Criteria:**
- `tests/e2e/file-url-tree.spec.ts` passes all five DESIGN.md scenarios.
- Controller unit tests prove keep-or-re-root, Up grafting, clearing on other sources, and stale-result rejection.
- Full unit and end-to-end suites pass under the Baseline evidence rule.
**Reviewer Checklist:**
- Every `await` in tree code is followed by a `treeGen` check before `set`.
- `load()` for non-file URLs clears `fileTree`.
- Up is disabled exactly at `file:///`, `file:///C:/`, and the UNC share level.
- No listing refresh timer or focus listener added.
**Verification Checks:**
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm test:e2e`
