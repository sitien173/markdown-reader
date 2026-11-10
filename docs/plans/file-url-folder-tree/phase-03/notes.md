<!-- refract-shared-version: 3.0.0 -->

# Phase 3 Decision Notes

<!-- Created by the worker per worker-contract.md. Append one `## Task 1` block per task. -->

## Task 1

### Decisions made
- Extended `src/source/file-url-tree.ts` with helper methods `buildFileTreeLevel`, `fetchGitignoreChain`, `prefixTreeNodes`, `getRelPath`, `normalizeDirUrl`, and `GitignoreCache` to encapsulate tree listing, gitignore climbing/caching, and subtree grafting cleanly outside the controller.
- Nodes store both relative paths (`path`) and original URLs (`url`) to allow O(1) URL lookups while preserving relative paths for highlighting and UI trees.
- Store tracks `fileTree: FileTreeState | null` and `fileAccessError: boolean` for distinguishing missing folder vs file-access-denied states.

### Spec deviations
- none

### Tradeoffs accepted
- none

### Assumptions
- none

### Follow-ups for human
- none

### Test evidence
- RED -> GREEN:
  - RED: `pnpm vitest run tests/unit/controller.test.ts` -> `AssertionError: expected null not to be null` at `expect(get().fileTree).not.toBeNull()` and `TypeError: c.expandFolder is not a function` (7 failed | 18 passed)
  - GREEN: `pnpm vitest run tests/unit/controller.test.ts` -> 25 passed (25)
- Root cause (bugfix only): none

## Task 2

### Decisions made
- Rendered fileTree header in FilesPanel with root folder name extracted from rootUrl pathname and Up button using FolderUp icon and aria-label "Up one level".
- Disabled "Up one level" button exactly when `getParentUrl(fileTree.rootUrl)` is null.
- Extended `FileTree` with `onExpandFolder` callback and inline error display for folders with failed expansion.
- Added `reader.upOneLevel`, `reader.fileAccessHint`, and `reader.couldNotReadFolder` i18n strings in `src/i18n/en-US.ts`.
- Displayed `reader.fileAccessHint` under "No folder opened." when `fileAccessError` is true.

### Spec deviations
- none

### Tradeoffs accepted
- none

### Assumptions
- none

### Follow-ups for human
- none

### Test evidence
- RED -> GREEN:
  - RED: `pnpm vitest run tests/unit/reader-app.test.tsx` -> `AssertionError: expected undefined to be truthy` at `expect(byText('.reader-folder-actions span', 'docs')).toBeTruthy()` (5 failed | 8 passed)
  - GREEN: `pnpm vitest run tests/unit/reader-app.test.tsx` -> 13 passed (13)
- Root cause (bugfix only): none

## Task 3

### Decisions made
- Created `tests/e2e/file-url-tree.spec.ts` creating a temporary Git repo fixture folder in `os.tmpdir()` at runtime with `.git/`, `.gitignore`, `.dot-folder`, `node_modules`, and nested markdown documents.
- Covered all five scenarios: (1) nested file roots tree at parent; (2) expanding folder loads contents; (3) Up button climbs level and grafts loaded subtree; (4) file click keeps tree root; (5) hidden and ignored items hidden by default and appear when "Show hidden and ignored items" setting toggle is enabled.
- Added picker hiding verification steps to `docs/manual-checklist.md`.
- Handled Chrome file:// fetch response properties in `fetchGitignore` (`res.status === 0` treated as successful file read).

### Spec deviations
- none

### Tradeoffs accepted
- none

### Assumptions
- none

### Follow-ups for human
- none

### Test evidence
- RED -> GREEN:
  - RED: `pnpm exec playwright test tests/e2e/file-url-tree.spec.ts` -> `Error: expect(locator).toHaveCount(expected) failed` at `expect(tree.getByRole('button', { name: 'ignored.md', exact: true })).toHaveCount(0)` (Received 1, Expected 0; 1 failed)
  - GREEN: `pnpm exec playwright test tests/e2e/file-url-tree.spec.ts` -> 1 passed (5.1s)
- Root cause (bugfix only): `getRelPath(targetUrl, baseUrl)` sliced off trailing slash from `targetUrl` before prefix testing, causing directory URLs matching `baseUrl` (such as repo root) to fail the prefix test and return the absolute path rather than `''`. This prevented the ancestor `.gitignore` at repo root from matching descendant files. Fixed `getRelPath` to test without stripping prefix slashes prematurely and support `res.status === 0` in `fetchGitignore`.

## Fix 1

- Decisions:
  - B1: In `goUp`, recompute `fileTreeRepoRoot` via `findRepoRoot(parentUrl)` when `parentUrl` is not inside `fileTreeRepoRoot`, and clear `gitignoreCache`. Base for hiding becomes the new repo root or new tree root. Made `getRelPath` strict: throws when target is outside base, handles trailing slashes/equality, and removed the `try`/pathname fallback. Made `fetchGitignoreChain` stop at `normBase` and never climb above it.
  - B2: Captured load generation `gen = sourceGen` and checked `tGen === treeGen && gen === sourceGen && rGen === reRootGen` after each await in the re-root promise. In the "inside" branch, incremented `reRootGen` to cancel pending re-roots without cancelling in-flight folder expands.
  - N1: Removed `await treePromise` from `load()`; document loading timing is unchanged. In `treePromise`, fetched `listDirectory(parentUrl)` first, checked for `.git` to avoid duplicate climb, and passed preloaded entries to `findRepoRoot` and `buildFileTreeLevel` to eliminate redundant network fetches.
  - N2: Set `fileAccessError: true` only when root `listDirectory` fetch rejects.
  - N3: Added `error?: boolean` to `DirectoryNode` in `src/source/directory.ts`, removed `as any` casts, and rendered `t('reader.couldNotReadFolder')` in `FileTree`.
  - N4: Removed unused file node `url` field and cast from `src/source/file-url-tree.ts`.
  - N5: Exported `compareTreeNodes` comparator from `src/source/directory.ts` and reused it across `file-url-tree.ts` and `controller.ts`.
  - N6: Removed extra `lister`/`fetcher` parameters from `buildFileTreeLevel` and `GitignoreCache`, unexported `fetchGitignoreChain`, used `normalizeDirUrl` consistently, and removed unnecessary `try`/`catch` around `new URL(fileTree.rootUrl)` in `App.tsx`.
  - N7: Added `version?: number` to `FileTreeState` and remount key `${fileTree.rootUrl}:${fileTree.version ?? 0}` on `<FileTree>` in `App.tsx` on settings rebuild so expanded folders do not remain open and empty.
  - N8: Added one-line comments explaining `res.status === 0` and `addRow` directory check in `fetchGitignore`.
- RED -> GREEN:
  - RED: `pnpm vitest run tests/unit/file-url-tree.test.ts` -> `AssertionError: expected [Function] to throw an error` for outside-base `getRelPath`
  - GREEN: `pnpm vitest run tests/unit/file-url-tree.test.ts` -> 19 passed (30ms)
  - RED: `pnpm vitest run tests/unit/file-tree.test.ts` -> `AssertionError: expected false to be true` for `couldNotReadFolder` rendering
  - GREEN: `pnpm vitest run tests/unit/file-tree.test.ts` -> 6 passed (168ms)
  - RED: `pnpm vitest run tests/unit/controller.test.ts` -> 3 failed (B1: full URL passed instead of relative path on goUp out of repo; B2: pending re-root replaced docPath after newer load inside tree; N1: load timed out waiting for treePromise)
  - GREEN: `pnpm vitest run tests/unit/controller.test.ts` -> 28 passed (194ms)
  - GREEN: `pnpm vitest run tests/unit/reader-app.test.tsx` -> 13 passed (1425ms)
  - GREEN: `pnpm test` -> 42 files / 537 tests passed
  - GREEN: `pnpm typecheck` -> exit 0
  - GREEN: `NO_COLOR=1 pnpm lint` -> exit 0

## Fix 2

- Decisions:
  - R1: In `load()`, computed tree inputs using a normalized URL (`fileUrl`) with hash and search stripped (`const u = new URL(url); u.hash = ''; u.search = ''; const fileUrl = u.href;`), and wrapped all synchronous tree setup in `try / catch` so tree computation errors never throw or fail document loading. Used `fileUrl` for `isInside`, `parentUrl`, and `docRelPath`, ensuring that non-canonical URLs (with spaces, localhost, or fragments) root correctly without throwing and `docPath` has no hash.
  - R2: Stored `repoRoot?: string | null` in `FileTreeState` alongside `rootUrl` in `src/store/reader-store.ts` and removed the controller-level `fileTreeRepoRoot` variable. Each tree state carries its own base, preventing race conditions where in-flight folder expansions mix roots. In `goUp`, stored found repo root in a local variable, verified `gen === treeGen`, and committed atomically into `FileTreeState`.
  - R3: In `goUp`, re-searched the repo root only when `currentTree.repoRoot !== null` and `parentUrl` is outside it. When `currentTree.repoRoot === null`, climbing already reached the filesystem root finding no repo, avoiding redundant ancestor listings.
  - R4: Removed `reRootGen` increments from `goUp` and settings rebuild. In re-root, removed `tGen === treeGen` check so settings changes and `goUp` on the shown tree do not drop a pending re-root for a newly loaded document. Re-root checks `gen === sourceGen && rGen === reRootGen` so the newest action that commits wins and the tree always contains the current document.
- RED -> GREEN:
  - RED: `pnpm vitest run tests/unit/controller.test.ts` -> 3 failed (`loads document and roots tree correctly for URLs with spaces, localhost, and fragments without throwing`: `Error: Target "file:///workspace/repo/docs/a b/x.md" is not under base "file:///workspace/repo/docs/a%20b/"`; `stores repoRoot on fileTree and avoids redundant findRepoRoot on goUp`: `AssertionError: expected undefined to be 'file:///workspace/repo/'`; `keeps pending re-root winning over settings rebuild`: `AssertionError: expected 'file:///workspace/repo/docs/' to be 'file:///workspace/other/'`)
  - GREEN: `pnpm vitest run tests/unit/controller.test.ts` -> 31 passed (251ms)
  - GREEN: `pnpm typecheck` -> exit 0
  - GREEN: `NO_COLOR=1 pnpm lint` -> exit 0
  - GREEN: `pnpm test` -> 42 files / 540 tests passed (28.87s)
  - GREEN: `pnpm build && pnpm exec playwright test tests/e2e/file-url-tree.spec.ts` -> 1 passed (3.6s)


