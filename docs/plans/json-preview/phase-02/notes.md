<!-- refract-shared-version: 3.0.1 -->

# Phase 2 Decision Notes

<!-- Created by the worker per worker-contract.md. Append one `## Task <M>` block per task. -->

## Task 1

### Decisions made
- Derived `docKind` in `initialState()` from the `src` URL parameter with fallback to `'markdown'`.
- Clamped initial `mode` to `'read'` when `docKind !== 'markdown'`.
- In `controller.applyText`, checked `state().docKind !== 'markdown'` to set `mode: 'read'`, `writable: false`, cancel any existing saver, and bypass `createDraftSaver` and `loadDraft`.
- In `controller.load`, forced `capturedText = undefined` for non-markdown documents so that the URL is fetched directly through the source.
- In `controller.save`, `overwrite`, `setMode`, and `edit`, short-circuited when `state().docKind !== 'markdown'`.
- Updated all load entry points (`load`, `openFileHandle`, `openFolderHandle`, `selectTreeFile`, `drop`) to set `docKind` via `docKindFromName`.

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
  - RED: `pnpm vitest run tests/unit/reader-store.test.ts` -> `AssertionError: expected { docKind: 'markdown', …(24) } to match object { docKind: 'json', mode: 'read', …(1) }`
  - RED: `pnpm vitest run tests/unit/controller.test.ts` -> `AssertionError: expected 'markdown' to be 'json' (6 failed | 32 passed)`
  - GREEN: `pnpm vitest run tests/unit/reader-store.test.ts tests/unit/controller.test.ts` -> `Test Files 2 passed (2), Tests 47 passed (47)`
- Root cause (bugfix only): none

## Task 2

### Decisions made
- Extended `CommandState` with `docKind?: ReaderState['docKind']`.
- Updated commands `save`, `mode-edit`, `mode-split`, `toggle-raw`, and `export-html` to require `docKind === 'markdown'` (or undefined in legacy callers).
- Preserved `print` availability based on `canExport` (active for read/split modes with a document).
- Updated `useReaderStore` shallow selectors in `ReaderMenu` (`src/ui/reader-menu.tsx`) and `CommandPalette` (`src/ui/command-palette.tsx`) to select `docKind`.

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
  - RED: `pnpm vitest run tests/unit/commands.test.ts` -> `AssertionError: expected true to be false (2 failed | 15 passed)`
  - GREEN: `pnpm vitest run tests/unit/commands.test.ts` -> `Test Files 1 passed (1), Tests 17 passed (17)`
- Root cause (bugfix only): none

## Task 3

### Decisions made
- Added JSON entry (`{ description: 'JSON files', accept: { 'application/json': ['.json', '.jsonc'] } }`) to `FileHandleSource.pick` types.
- Updated `isValidMarkdownFile` in `src/source/file-handle.ts` to accept `.json` and `.jsonc` using `isJsonName`.
- Updated `DirectorySource.getTree` and `DirectorySource.resolveLink` in `src/source/directory.ts` to include `.json` and `.jsonc` files using `isJsonName`.
- Updated `buildFileTreeLevel` in `src/source/file-url-tree.ts` to preserve `.json` and `.jsonc` entries using `isJsonName`.
- Updated `resolveLink` and `resolveFolderLinks` in `src/render/links.ts` to assign `data-md-link` to links targeting `.json` and `.jsonc` files using `isJsonName`.

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
  - RED: `pnpm vitest run tests/unit/file-handle.test.ts tests/unit/directory.test.ts tests/unit/file-url-tree.test.ts tests/unit/links.test.ts` -> `AssertionError: expected false to be true (6 failed | 54 passed)`
  - GREEN: `pnpm vitest run tests/unit/file-handle.test.ts tests/unit/directory.test.ts tests/unit/file-url-tree.test.ts tests/unit/links.test.ts` -> `Test Files 4 passed (4), Tests 60 passed (60)`
- Root cause (bugfix only): none

## Task 4

### Decisions made
- Read `docKind` from reader store inside `Sidebar` component in `src/entrypoints/reader/App.tsx`.
- Derived `isMarkdown = docKind === 'markdown'` and `activeTab: SidebarTab = isMarkdown ? sidebarTab : 'files'`.
- Conditionalized rendering of `<ToggleGroupItem value="contents" ...>` on `isMarkdown`.
- Set `ToggleGroup` `value={[activeTab]}` so only `'files'` is active when non-markdown.
- Conditionalized active panel on `activeTab === 'files'` so `<FilesPanel>` is always rendered for non-markdown docs.

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
  - RED: `pnpm vitest run tests/unit/reader-app.test.tsx` -> `AssertionError: expected <button ... aria-label="Outline"> to be null (1 failed | 13 passed)`
  - GREEN: `pnpm vitest run tests/unit/reader-app.test.tsx` -> `Test Files 1 passed (1), Tests 15 passed (15)`
- Root cause (bugfix only): none


## Review fixes

Review-fix cycle 1, from the independent quality review (FAIL).

### Fixes
- Fix 1 (High), `tests/unit/controller.test.ts`: the captured-text test now stores a schema-valid session entry `{ url, text, ts }` and asserts the URL body is read for a `.json` URL. Added a control case with the same entry shape for a `.md` URL that asserts the captured text is used.
- Fix 2 (Medium), `tests/unit/controller.test.ts`: added three tests. `openFileHandle` with a `.json` handle gives `writable === false` and `mode === 'read'`, and `save()` never calls `createWritable`. `selectTreeFile` on a `.json` entry gives `docKind === 'json'` and `writable === false`, then a `.md` entry gives `docKind === 'markdown'` and `writable === true`. No `browser.storage.local.set` call uses a `markdown-reader:draft:` key while a JSON source is open, with a Markdown control in the same test showing the probe does record a draft key.
- Fix 3 (Low), `src/reader/controller.ts`: drop guard is now `!isValidMarkdownFile(file.name)`. The `isJsonName` import was removed because nothing else used it.
- Fix 4 (Low), `tests/unit/links.test.ts`: added a `resolveFolderLinks` case for `sub/data.json` asserting `data-md-link` and `data-folder-path` equal to `docs/sub/data.json`.

### Negative-case evidence for Fix 1
- Temporarily changed `src/reader/controller.ts:391` to drop `|| kind !== 'markdown'`.
- `pnpm vitest run tests/unit/controller.test.ts` -> `1 failed | 41 passed`; failing test `ignores captured session text and reads the URL for JSON documents`, `AssertionError: expected 'captured text should be ignored' to be 'fetched url body of https://example.c…'`.
- Guard restored; line 391 is byte-identical to the checkpoint and the suite passes.

### Recorded for the record
- `tests/unit/directory.test.ts:118` changed an existing Markdown test from `not-md.json` to `not-md.txt`. Folders holding only JSON now appear in trees by design, and the pruning assertion keeps the same meaning.

### Accepted debt, not acted on
- Making `docKind` required in `CommandState` (needs `src/ui/toolbar.tsx`, outside the phase file set).
- Factoring the repeated `docKind` patch in the load paths into a helper.
- The double `new URL(resolved).pathname` parse in `src/source/directory.ts:294`.

### Checks
- `pnpm typecheck`: pass.
- `pnpm lint`: 0 errors, 208 warnings, 3 infos.
- `pnpm test`: 584 passed (was 579).
