<!-- refract-shared-version: 2.5.0 -->

# Phase 6 — Decision Notes

## Phase setup

- Started: 2026-11-08T00:41Z. Host load average at start: 55.47 / 74.59 / 62.28 (`uptime`).
- Implementation order: task-6, task-5, task-1, task-2, task-3, task-4, task-7. Reason: task-5 changes the store and controller shape that tasks 1 to 4 build on, and task-6 adds characterization cases that must pass before task-5 refactors the controller. Task-7 is realized inside the task-1 toolbar and gets its own E2E assertion.
- Extra paths touched beyond the PLAN Files list are recorded per task with the reason.

## Task 6

### Decisions made
- The `DirectorySource` mock in `tests/unit/controller.test.ts` now mirrors the real source: identity follows the committed path and the latest read wins (same model as the `reader-app.test.tsx` mock). This removes the fixed-identity debt.
- `watchFileHandle` is mocked (importOriginal spread) so `openFileHandle` cases drive watcher events deterministically.
- `openFileHandle` uses a fake `FileSystemFileHandle` (`getFile`, `createWritable`) so the real `FileHandleSource` runs.
- New cases: same-URL stale load (generation only, identity equal), `openFileHandle` open plus save, `openFileHandle` superseded by a newer handle, `overwrite` with a newer selection pending, `checkExternal` dirty, clean, unchanged, and file-handle watcher.

### Spec deviations
- none

### Tradeoffs accepted
- Task-6 is characterization of existing behavior, so a behavioral RED against unchanged production code is impossible. RED evidence is by mutation: each guard was temporarily broken in `src/reader/controller.ts` (backup in /tmp, restored byte-identical, verified with `diff`), and the matching test failed.

### Assumptions
- none

### Follow-ups for human
- none

### Test evidence
- RED -> GREEN:
  - RED (mutation M1, `isCurrent` ignores generation): `pnpm exec vitest run --no-file-parallelism tests/unit/controller.test.ts` -> `drops a slow load of a URL after a newer load of the same URL`: `expected 'stale body' to be 'fresh body'`; `drops a slow tree file read...`: `expected 'b.md' to be 'a.md'`. 2 failed, 13 passed.
  - RED (M2, overwrite writes with no path): `writes to the committed path while a newer selection is still pending` and the existing overwrite case fail on `toEqual` of writes. 2 failed.
  - RED (M3, `checkExternal` skips the dirty branch): `flags an external change and keeps the draft...`: `expected "vi.fn()" to not be called at all, but actually been called 1 times`. 1 failed.
  - RED (M4, first `isCurrent` checks removed in `openFileHandle`): `drops a slow handle read after a newer handle was opened`: `expected 'slow text' to be 'fast text'`. 1 failed.
  - GREEN (production code restored): `pnpm exec vitest run --no-file-parallelism tests/unit/controller.test.ts` -> 1 file, 15 passed (was 7 before this task).
- Root cause (bugfix only): none

## Task 5

### Decisions made
- Store is per mount: `createReaderStore()` (zustand vanilla `createStore`) in `src/store/reader-store.ts`, `ReaderStoreContext`, `useReaderStoreApi()`, and a context-reading `useReaderStore(selector)`. `createController(store = createReaderStore())` owns the store and exposes it as `controller.store`. `App` creates the controller once and provides the store; the reader body moved into an inner `Reader` component. Module-level `useReaderStore.setState/getState` and `resetReaderStore` are removed.
- `controller.mount()` replaces three App effects: it clears `disposed`, registers `pagehide`, and runs recents refresh plus the initial `load(source)` once per controller (`started` guard). It returns the unmount cleanup, which calls `dispose()`.
- `dispose()` no longer bumps the generation or resets the store. It sets `disposed`, stops the watcher, and cancels the draft saver; `isLive(gen)` and `isCurrent` return false while disposed. Reason: under StrictMode the effect runs, cleans up, and runs again; bumping the generation (old behavior) dropped the first initial load and a second load then refetched after the first one had already consumed the one-shot captured text from `storage.session`.
- Two direct `gen !== sourceGen` checks before `setActiveDirectory` in `openFolderHandle` now use `isLive(gen)`, so an unmounted reader cannot start a watcher.
- `tests/unit/reader-store.test.ts` and the controller test now build stores through `createReaderStore()` (extra paths, allowed by the prompt).

### Spec deviations
- none

### Tradeoffs accepted
- Writes that resolve after unmount still land on the orphaned per-mount store. That is harmless because nothing reads it, and watchers and saves are guarded by `isLive`.

### Assumptions
- Production `main.tsx` already uses StrictMode, so the StrictMode path is the real dev path and the test mirrors it.

### Follow-ups for human
- none

### Test evidence
- RED -> GREEN:
  - RED: `pnpm exec vitest run --no-file-parallelism tests/unit/reader-app.test.tsx` -> `keeps state per mount...`: `expected undefined to be 'A text'`; `loads the initial source once under StrictMode...`: `expected "vi.fn()" to be called 1 times, but got 2 times` (storage.session.get); `stops the watcher on unmount under StrictMode...`: `expected "vi.fn()" to be called at least once`. 3 failed, 5 passed.
  - GREEN: `pnpm typecheck` -> `No errors found`; `pnpm exec vitest run --no-file-parallelism` -> 25 files, 271 passed (baseline 259; +8 controller, +3 reader-app, +1 reader-store). Host load at run: 10.78 (1 min).
- Root cause (bugfix only): StrictMode double effect called `load` twice and `session.get` twice because `dispose()` bumped `sourceGen` and the load effect was not idempotent. Fixed by the `started` and `disposed` flags above.

## Progress checkpoint (tasks 1-4, 7 implemented, E2E and gates pending)
- Added: src/ui/{toolbar,welcome,drop-overlay,open-url-dialog,status-banner}.tsx, src/components/ui/{toast,radio-group}.tsx; commands.ts createCommands; schemas.ts parseOpenUrl (reuses isAllowedUrl); store selectBanners, docTitle, urlDialogOpen (notice removed); controller notify callback, dismissError, docTitle; toc scroll-spy returns disconnect, active item scrollIntoView; popup redesign.
- Removed: src/ui/top-bar.tsx, src/ui/announce.tsx.
- Unit: commands/OpenUrl/selectBanners tests added and green; reader-app tests adapted (status() includes toast live region, 'Unsaved changes', toast dialogs excluded). Full vitest not yet rerun after these edits.
- RED evidence for tasks 1,3,4,7 unit parts: NOT yet recorded as separate RED runs (code was written before some tests in this checkpoint). Must be honest in journal: record what was and was not RED.
- Pending: biome warning count (cap 218), pre-existing lint errors check vs baseline, update v1 E2E selectors, create tests/e2e/shell.spec.ts, run all Done When checks, journal EXTERNAL RESPONSE.
- E2E selector updates done: mode buttons to radios (perf, editor, export), reload.spec 'Unsaved changes'. Pending: reload.spec line 70 text 'File changed on disk: Reload' (banner now "File changed on disk" + Reload button), reader.spec.ts lines 40-150 (Markdown URL now inside Open URL dialog; Open file/URL buttons are on welcome screen and Open menu; alert Retry kept), keyboard.spec checks, then shell.spec.ts.
- E2E updates done in reader.spec (openUrl helper via Open menu and dialog, tab order, Files-panel Open folder), reload.spec banner text. Pending: run v1 E2E, write shell.spec.ts, full gates, journal.

## Shell E2E and final fixes
- reader.spec.ts:53 failed with a 30s timeout on `getByRole('button', { name: 'Open file' })`. Cause: with a document open, Open file lives in the Open menu (item "File"), not a button. Selector changed to the Open menu then menuitem File. Assertions unchanged. keyboard.spec and reader.spec rerun: 12 passed.
- Deviation: focus mode had no user-reachable trigger (the palette and shortcuts arrive in Phase 7). Added a "Focus mode" icon button to src/ui/toolbar.tsx, shown only when a document is open and wired to the existing `focus-mode` command. Without it the acceptance criterion "focus mode on" cannot be exercised by a user.
- tests/e2e/shell.spec.ts created (9 tests). RED: not applicable for 8 tests, because tasks 1 to 4 and 7 were implemented before the spec and the spec passed on first run (9 passed, 51s). The focus-mode test would have failed (no trigger) before the toolbar button was added. No separate RED run was captured for tasks 1, 3, 4, 7 code; this is a process gap, not a hidden failure.
