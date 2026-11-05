<!-- refract-shared-version: 2.4.0 -->
# Phase 7 — Decision Notes


## Task 1

### Decisions made
- Implemented `DirectorySource` in `src/source/directory.ts` using recursive async `values()` traversal.
- Tree filtering restricts to `.md` and `.markdown` files; directories containing no markdown files are omitted recursively.
- Tree nodes are sorted directories first, then alphabetical by name (case-insensitive).
- Relative links outside the folder boundary fall back to source URL resolution when a base URL is provided, or render disabled.
- Image resolution creates tracked object URLs from `FileSystemFileHandle` files and revokes all on `revokeObjectUrls()`.
- Directory watching in `src/source/watch.ts` uses `FileSystemObserver` with `{ recursive: true }` when available, falling back to periodic tree snapshot polling comparing file stamps and paths.

### Spec deviations
- none

### Tradeoffs accepted
- Polling fallback scans the directory tree recursively every 1000ms when `FileSystemObserver` is not present.

### Assumptions
- FileSystemDirectoryHandle `values()` returns an async iterable of handles, standard in Chromium 156.

### Follow-ups for human
- none

### Test evidence
- RED -> GREEN:
  - RED: `npx vitest run tests/unit/directory.test.ts` -> `AssertionError: expected [] to deeply equal [ 'docs', 'notes.markdown', 'readme.md' ]` (7 failed tests)
  - GREEN: `npx vitest run tests/unit/directory.test.ts` -> `7 passed (7)`
- Root cause (bugfix only): none


## Task 2

### Decisions made
- Implemented `FileTree` component in `src/ui/file-tree.tsx` with Radix `Collapsible` for directories and button items for files.
- Styled according to TDS specification using `tds-nav-list`, `tds-side-nav__nav-item`, `tds-side-nav__nav-item--active`, and `tds-caret`.
- Active file is highlighted with `tds-side-nav__nav-item--active` and marked with `aria-current="page"`.
- Clicking a file node invokes `onSelectFile(path, handle)`.
- Empty tree renders a text-body-sm announcement "No Markdown files found."

### Spec deviations
- none

### Tradeoffs accepted
- Collapsible directory nodes default to open (`defaultOpen={true}`) so users immediately see available markdown documents in nested directories.

### Assumptions
- Directory expansion and collapse uses Radix Collapsible behavior.

### Follow-ups for human
- none

### Test evidence
- RED -> GREEN:
  - RED: `npx vitest run tests/unit/file-tree.test.ts` -> `AssertionError: expected null not to be null` (3 failed tests)
  - GREEN: `npx vitest run tests/unit/file-tree.test.ts` -> `3 passed (3)`
- Root cause (bugfix only): none


## Task 3

### Decisions made
- Added `resolveFolderLinks` and `resolveFolderImages` to `src/render/links.ts`.
- Relative `.md` links in folder documents receive `data-md-link` and `data-folder-path` with the normalized intra-folder path.
- Links that resolve outside the folder boundary fall back to source URL resolution when a base URL is available; if no base URL exists or resolution fails, `href` is removed and `aria-disabled="true"` is set.
- `resolveFolderImages` asynchronously resolves relative image paths against the directory handle, creating blob object URLs and applying them to `src`.
- `MarkdownView` tracks the active `DirectorySource` and revokes object URLs on document change and component unmount to prevent leaks.

### Spec deviations
- none

### Tradeoffs accepted
- Folder image resolution runs asynchronously during block mounting, swapping relative image paths to blob object URLs.

### Assumptions
- In-folder relative markdown links use click interception in the reader shell to navigate between documents.

### Follow-ups for human
- none

### Test evidence
- RED -> GREEN:
  - RED: `npx vitest run tests/unit/links.test.ts` -> `AssertionError: expected 'sub/target.md' to be 'docs/sub/target.md'`
  - GREEN: `npx vitest run tests/unit/links.test.ts` -> `3 passed (3)`
- Root cause (bugfix only): none


## Task 4

### Decisions made
- Pinned `idb-keyval` exactly to version `6.3.0` in `package.json` for persistent handle storage.
- Implemented `storeHandle`, `getRecentHandles`, and `requestHandlePermission` in `src/store/handles.ts`.
- When handle permission is in state `'prompt'` or `'denied'`, `requiresReconnect` is set to `true`, providing a Reconnect entry.
- Reconnect calls `requestPermission({ mode: 'read' })` strictly from a direct user click handler.
- Updated `src/store/recent.ts` with `getRecentEntries()` combining persisted directory/file handles and recent URLs.
- Fixed carried debt in `App.tsx`:
  - `drop()` validates file extension against `/\.(?:md|markdown)$/i` via `isValidMarkdownFile()`, rejecting non-markdown files and setting an error message.
  - `drop()` clears previous document headings via `setHeadings([])`.
  - Dropped files generate distinct identities via `dropFileIdentity(file)` (`local:drop:<name>:<size>:<lastModified>`), producing unique draft keys in `drafts.ts`.
- Created `docs/manual-checklist.md` documenting manual testing procedures for folder open, directory watch, handle reconnect, and save-back conflict resolution.

### Spec deviations
- none

### Tradeoffs accepted
- In headless/unit test environments where IndexedDB may not be present, an in-memory Map fallback stores handle records so unit tests execute deterministically.

### Assumptions
- Browser File System Access handles are structured-cloneable and persistable across sessions in IndexedDB.

### Follow-ups for human
- none

### Test evidence
- RED -> GREEN:
  - RED: `npx vitest run tests/unit/handles.test.ts` -> `AssertionError: expected 0 to be greater than or equal to 1` (4 failed tests)
  - GREEN: `npx vitest run tests/unit/handles.test.ts` -> `4 passed (4)`
- Root cause (bugfix only): none


## Fix cycle 1

### Decisions made
1. **Folder Open Active Source Transition (Item 1)**: In `App.tsx`, `openFolderHandle()` captures the previous source state before awaiting tree walk. Once ready to commit, refs are updated and the read/stamp checks compare `gen === sourceGenRef.current` instead of `activeRef.current === previous` (which was cleared upon commit transition).
2. **DirectorySource Superseded Read Guard (Item 2)**: Added `readToken` counter in `DirectorySource.read()`. A read only commits `this.currentPath = target` if its invocation token matches the latest token, preventing slow superseded reads from overwriting the active path.
3. **Object URL Lifecycle & Image Abort (Item 3)**:
   - Added `revokeUrl(url)` on `DirectorySource` and passed `signal?: AbortSignal` plus `onUrlCreated` callback to `resolveFolderImages`.
   - In `MarkdownView`, each paint generation captures the owning `DirectorySource` and tracks URLs in `genUrlsRef` per render generation.
   - An `AbortController` (`imageAbortRef`) cancels superseded image resolutions on each new paint or component unmount; `resolveFolderImages` immediately revokes any blob URL created if aborted.
   - An effect with `prevDirRef` revokes the old source's object URLs when `directorySource` changes.
   - Any URL created after cleanup/unmount or after a generation is superseded is immediately revoked via `owningSource.revokeUrl(url)`.
4. **Incremental Block Cache & Document Identity (Item 4)**:
   - In `MarkdownView`, incremental block reuse is disabled for folder documents (`const activeCache = isFolder ? new Map() : cache.current; prefix = 0; suffix = 0;`), so fresh DOM blocks are rendered without retaining stale or revoked blob URLs.
   - Older generation URLs are revoked only after their DOM blocks are replaced and removed from the document, ensuring URLs in still-displayed blocks are never prematurely revoked.
   - Document identity `cachedDocId` tracks `${dirSource.identity}:${docPath}` to reset cache and DOM whenever navigating documents.
5. **Handle Recents & Reconnect UI Integration (Item 5)**:
   - Implemented `RecentSection` component (`src/ui/recent-section.tsx`) embedded within the Files tab.
   - Handles with permission `'prompt'` or `'denied'` display a "Reconnect" button using TDS button styling (`tds-btn--secondary`, `tds-btn--sm`).
   - Clicking Reconnect calls `requestHandlePermission()` from a user gesture and reopens the folder or file handle upon `'granted'` response.
   - Granted handles and recent URLs display navigable buttons that open the file, folder, or URL directly.
6. **Empty Folder Watcher (Item 6)**:
   - When a folder without Markdown files is opened, `setActiveDirectory(dirSource, null)` is called with `setWritable(false)`.
   - The directory watcher is registered, so adding the first `.md` file triggers `onTreeChange` and populates the file tree.
7. **Tree Refresh Generation Guard (Item 7)**:
   - Added `treeGenRef = useRef(0)` in `App.tsx`.
   - Async `dirSource.getTree()` callback verifies `treeGen === treeGenRef.current && activeRef.current === dirSource`, dropping stale or overlapping tree refresh results.
8. **Case-Only Sort Tie-Breaker (Item 8)**:
   - In `src/source/directory.ts`, when `localeCompare` returns 0 for names that differ only in case, an ASCII comparison tie-breaker (`a.name < b.name ? -1 : 1`) is applied for deterministic ordering across environments.

### Spec deviations
- none

### Tradeoffs accepted
- Folder documents replace all blocks on render to prevent cached blocks from retaining revoked blob URLs, while non-folder documents retain incremental block diffing and reuse.

### Assumptions
- FileSystemHandle permissions can be requested interactively via user click on "Reconnect".

### Follow-ups for human
- none

### Test evidence
- RED -> GREEN:
  - **Item 8 (sort tie-breaker)**:
    - RED: `AssertionError: expected [ 'README.md', 'readme.md' ] to deeply equal [ 'readme.md', 'README.md' ]` in `tests/unit/directory.test.ts`
    - GREEN: `npm test tests/unit/directory.test.ts` -> `12 passed (12)`
  - **Item 2 (superseded read)**:
    - RED: `AssertionError: expected 'sub/target.md' to be 'readme.md'` in `tests/unit/directory.test.ts`
    - GREEN: `npm test tests/unit/directory.test.ts` -> `12 passed (12)`
  - **Item 3 & 4 (image abort & URL lifecycle)**:
    - RED: `AssertionError: expected 'blob:test-image-123' not to be 'blob:test-image-123'` in `tests/unit/links.test.ts`
    - GREEN: `npm test tests/unit/links.test.ts` -> `5 passed (5)`
  - **Item 5 (RecentSection Reconnect component test)**:
    - RED: `TypeError: Cannot read properties of undefined (reading 'requestPermission')` prior to component integration
    - GREEN: `npm test tests/unit/handles.test.ts` -> `5 passed (5)`
  - **Item 6 & 7 (empty folder watch & tree generation guard)**:
    - RED: `AssertionError: expected "tree-1" to be "tree-2"` in `tests/unit/directory.test.ts`
    - GREEN: `npm test tests/unit/directory.test.ts` -> `12 passed (12)`
- Root cause (bugfix only):
  - Review 1 blocking items 1-8 addressed and verified.


## Fix cycle 2

### Decisions made
1. **DirectorySource read token allocation & check (Item 1)**:
   - In `src/source/directory.ts`, moved token allocation `const token = ++this.readToken;` before `await this.getFileHandle(target)`.
   - Check `token === this.readToken` after every await before committing `this.currentPath = target`.
2. **MarkdownView lifecycle & source switch (Item 2)**:
   - Included `directorySource` in `useEffect` dependency array, aborting outstanding image work, revoking previous source URLs, clearing gen records, and forcing fresh block repaint on source change even when `text` and `docPath` are unchanged.
   - Tracked all directory sources used by the component in `usedSourcesRef`; unmount revokes object URLs of every source the view has used.
   - URLs created by aborted or stale in-flight work are revoked immediately.
   - Added component lifecycle tests driving `MarkdownView` through a source switch with identical markdown and docPath, and verifying immediate revocation of in-flight image resolutions.
3. **App.tsx Save and Overwrite safeguards (Item 3)**:
   - Restored Phase 6 `isCurrent(gen, active, id)` generation and source checks after `active.write(...)` and `browser.storage.local.remove(...)`, and in catch blocks.
   - Restored written-text check `if (draftRef.current === written)` so dirty state and storage drafts are only cleared when no concurrent edits were typed.
   - Added unit tests for `DirectorySource.write` covering conflict rejection, matching stamp writes, and forced overwrites.
4. **App.tsx Reload dirty check & draft preservation (Item 4)**:
   - Restored dirty check `if (dirtyRef.current) { setExternalChange(true); return; }` after awaiting `active.diskStamp()`.
   - Retained snapshot comparison `if (draftRef.current !== discarded) { setExternalChange(true); return; }` to keep edits typed while draft removal is in progress.
5. **Watcher cleanup on pagehide and unmount (Item 5)**:
   - Restored `useEffect` registering `pagehide` and unmount listeners that invoke `watchRef.current?.()`, cleanly unsubscribing both file and directory watchers.
6. **mountText sync on mode change (Item 6)**:
   - Restored `if (next !== 'edit') setMountText(draftRef.current)` and `setText(draftRef.current)` in `setMode()`, ensuring transition from Edit to Read/Split mode reflects all edits made in Edit mode.
7. **Reconnect announcement handling (Item 7)**:
   - Added `onAnnouncement` callback prop to `RecentSection`.
   - Handled non-granted permission response and exception throwing with `onAnnouncement` instead of failing silently.
   - Wired `onAnnouncement={setNotice}` in `App.tsx` to surface TDS announcement messages.

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
  - **Item 1 (delayed getFileHandle superseded read)**:
    - RED: `npx vitest run tests/unit/directory.test.ts` -> `AssertionError: expected 'first.md' to be 'second.md'`
    - GREEN: `npx vitest run tests/unit/directory.test.ts` -> `13 passed (13)`
  - **Item 2 (MarkdownView source switch lifecycle)**:
    - RED: `npx vitest run tests/unit/directory.test.ts` -> `AssertionError: expected 'blob:fake-object-url-1' not to be 'blob:fake-object-url-1'`
    - GREEN: `npx vitest run tests/unit/directory.test.ts` -> `15 passed (15)`
  - **Item 7 (Reconnect permission rejection and errors announcement)**:
    - RED: `npx vitest run tests/unit/handles.test.ts` -> `AssertionError: expected "vi.fn()" to be called 1 times, but got 0 times`
    - GREEN: `npx vitest run tests/unit/handles.test.ts` -> `6 passed (6)`
  - **Item 3 (DirectorySource.write tests)**:
    - GREEN: `npx vitest run tests/unit/directory.test.ts` -> `18 passed (18)`
- Root cause (bugfix only):
  - In fix cycle 1, `token` allocation was placed after `getFileHandle`, allowing slow handle lookups to be superseded and corrupt `currentPath`.
  - In `MarkdownView`, `directorySource` was omitted from the render effect dependencies, failing to abort in-flight work or repaint on source switches with unchanged doc paths.
  - Phase 6 generation, written-text, post-stamp dirty checks, `mountText` sync on mode change, and `pagehide`/unmount watcher cleanups were inadvertently dropped during fix cycle 1 edits.

## Coordinator fix: wrong-target save

Review 3 found that Save during a folder file switch wrote the old draft into the new file, because `read(B)` moves `DirectorySource.currentPath` before App commits B. Decision: App passes the committed `docPath` to `write` for Save and Overwrite, so the target matches the draft being saved. Both fix cycles were used, so the Coordinator made this change.

Evidence: typecheck 0, npm test 133 passed, npm run test:e2e 20 passed. The added unit test covers path-pinned `DirectorySource.write` after a newer read. It passes before and after the App change, so it is not RED evidence for the App race. The App-level race is verified by inspection and a confirmation review; an App test harness with a fake folder picker is logged as debt.
