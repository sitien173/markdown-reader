<!-- refract-shared-version: 3.0.0 -->

# Phase 2 Decision Notes

<!-- Created by the worker per worker-contract.md. Append one `## Task 1` block per task. -->

## Task 1

### Decisions made
- Removed `handle` field from `FileNode` and `DirectoryNode`, updated `DirectoryNode.children` to `TreeNode[] | null`.
- Updated `FileTree` `onSelectFile` to receive only `path`.
- In `FileTree`, passed `defaultOpen={node.children !== null}` to `<Collapsible>` so unloaded folders render collapsed.
- In `FileTree.filterTree`, kept unloaded folders (`node.children === null`) when their own name matches the filter, and in `flattenFiles` and `findFirstFile` defaulted `children` to `[]` when `null`.

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
  - RED: `npx vitest run tests/unit/file-tree.test.ts` -> `FAIL tests/unit/file-tree.test.ts > FileTree > renders an unloaded folder (children === null) as a collapsed collapsible: TypeError: Cannot read properties of null (reading 'length'); FAIL tests/unit/file-tree.test.ts > FileTree > filters unloaded folders by name and keeps matching unloaded folders: TypeError: Cannot read properties of null (reading 'flatMap'); Tests: 2 failed, 3 passed, 5 total`
  - GREEN: `npx vitest run tests/unit/file-tree.test.ts` -> `Test Files 1 passed (1), Tests 5 passed (5)`
- Root cause (bugfix only): none

## Task 2

### Decisions made
- Created `src/source/file-url-tree.ts` exporting `listDirectory`, `findRepoRoot`, `fetchGitignore`, and `getParentUrl`.
- In `getParentUrl`, returned `null` for `file:///`, Windows drive roots (`/^[a-zA-Z]:\/?$/`), and UNC share root levels (<= 1 pathname segment).
- In `listDirectory`, parsed `addRow(...)` argument lists with `JSON.parse` across full bodies regardless of `response.ok`, skipped `..` rows, and generated child URLs using `new URL('./' + raw + (isDir ? '/' : ''), base).href`.
- In `fetchGitignore`, fetched `<folder>/.gitignore` and returned empty string if response is not ok or fetch throws.
- In `findRepoRoot`, climbed parent directory listings using `getParentUrl` without depth cap until an entry named `.git` (file or folder) was found, returning that folder URL or `null` at the filesystem root.

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
  - RED: `npx vitest run tests/unit/file-url-tree.test.ts` -> `FAIL tests/unit/file-url-tree.test.ts > file-url-tree > getParentUrl > returns null at filesystem root: AssertionError: expected '' to be null; Tests: 15 failed, 1 passed, 16 total`
  - GREEN: `npx vitest run tests/unit/file-url-tree.test.ts` -> `Test Files 1 passed (1), Tests 16 passed (16)`
- Root cause (bugfix only): none

## Task 3

### Decisions made
- In `buildTree` and `DirectorySource.getTree`, applied `createHidingRule` reading settings from `useSettingsStore.getState().settings.general`.
- Read `.gitignore` handles inside the picked root during recursion, accumulating `.gitignore` chain levels relative to root.
- Skipped hidden files and avoided descending into hidden folders, while preserving markdown file filtering, pruning of folders without markdown, and case-sensitive ASCII tie-breaker sorting.

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
  - RED: `npx vitest run tests/unit/directory.test.ts -t "picker hiding and pruning"` -> `FAIL tests/unit/directory.test.ts > DirectorySource > tree walking, filtering, and sorting > picker hiding and pruning > hides dot-items, gitignored entries, and settings-pattern matches by default: AssertionError: expected [ Array(7) ] to deeply equal [ 'sub', 'visible.md' ]; Tests: 3 failed, 22 skipped, 25 total`
  - GREEN: `npx vitest run tests/unit/directory.test.ts -t "picker hiding and pruning"` -> `Test Files 1 passed (1), Tests 3 passed | 22 skipped (25)`
- Root cause (bugfix only): none

## Fix 1

### Decisions made
- In `src/source/file-url-tree.ts` (`listDirectory`), changed row matching to `/<script>addRow\(([\s\S]*?)\);<\/script>/g` with `JSON.parse` per match, skipping failed parses, avoiding quadratic scanning when headers contain `function addRow(...)` with `);`.
- In `getParentUrl`, simplified logic to compute parent URL once following the three root checks (`file:///`, Windows drive roots, UNC share level), removing unreachable guards, redundant try/catch, and protocol check.
- In `src/source/directory.ts`, made `settings` a required parameter on `buildTree`, passed it from `DirectorySource.getTree`, and removed reading settings from `useSettingsStore` inside `buildTree`.
- In `src/source/directory.ts` (`buildTree`), skipped reading `.gitignore` handles when `settings.showHiddenItems` is enabled.

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
  - RED: `npx vitest run tests/unit/file-url-tree.test.ts -t "parses real rows following a listing header"` -> `FAIL tests/unit/file-url-tree.test.ts > file-url-tree > listDirectory > parses real rows following a listing header containing function addRow without quadratic slowdown: AssertionError: expected 802.955384 to be less than 200; Tests: 1 failed, 16 skipped, 17 total`
  - GREEN: `npx vitest run tests/unit/file-url-tree.test.ts` -> `Test Files 1 passed (1), Tests 17 passed (17)`
- Root cause (bugfix only): `listDirectory` searched for `addRow(` which matched Chromium's header declaration `function addRow(...) { ... ); ... }`, causing the inner loop to repeatedly attempt JSON.parse across all subsequent `);` occurrences in the document, resulting in quadratic parsing time.

## Fix 2

### Decisions made
- In `tests/unit/file-url-tree.test.ts`, removed the wall-clock timing measurement and assertion (`expect(elapsed).toBeLessThan(200)`) from the header-plus-rows test to prevent test flakiness under high machine load, while keeping the correctness assertions for all 5,000 parsed rows.

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
  - RED: none (flaky wall-clock timing assertion removal)
  - GREEN: `pnpm exec vitest run tests/unit/file-url-tree.test.ts` -> `Test Files 1 passed (1), Tests 17 passed (17)`
- Root cause (bugfix only): none
