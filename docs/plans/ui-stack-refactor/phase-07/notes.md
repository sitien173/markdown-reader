<!-- refract-shared-version: 2.5.0 -->

# Phase 7 - Decision Notes

## Task 1

### Decisions made
- `src/components/ui/command.tsx` is hand-written (the shadcn CLI has no Base UI command component). It wraps `Dialog` around an always-open inline `Autocomplete.Root` (`inline open autoHighlight="always" keepHighlight`), grouped items, `Autocomplete.Empty`, and `data-highlighted` styling. APIs verified from `node_modules/@base-ui/react/autocomplete/*.d.ts`.
- `command-palette.tsx` takes a snapshot of store state when the palette opens (`store.getState()` inside the dialog body), so there is no new whole-store subscription. The palette is modal, so the snapshot cannot go stale while open.
- Added registry command `command-palette` (shortcut `Mod+K`, always available) so Cmd/Ctrl+K and the toolbar button route through `commands.ts`. It is excluded from the palette's own Actions list.
- An item runs its command first, in the same handler, then closes the palette. Picker commands therefore keep the user gesture.
- Items that open another dialog (Open URL) set a handoff flag so the palette `finalFocus` does not steal focus back from the new dialog. Other items and Escape restore focus to the pre-open element.
- Recents with `requiresReconnect` request handle permission first (same path as `RecentSection`).
- `scrollToHeading` in `src/ui/toc-panel.tsx` is now exported for the Headings group (allowed: heading jump API only).
- Palette open state is local `useState` in `App.tsx`; `reader-store.ts` is not in the Phase 7 file list.

### Spec deviations
- none

### Tradeoffs accepted
- Folder files group lists every markdown file path from the tree (flat, full path label).

### Assumptions
- Escape closing and focus return rely on Base UI Dialog defaults; verified by E2E.

### Follow-ups for human
- none

### Test evidence
- RED -> GREEN:
  - RED: `pnpm exec vitest run --no-file-parallelism tests/unit/commands.test.ts tests/unit/shortcuts.test.ts` -> 15 failed, 14 passed (for example `AssertionError: expected "vi.fn()" to be called 1 times, but got 0 times` in shortcuts.test.ts, and the command id list mismatch in commands.test.ts), against an inert `shortcuts.ts` stub and no `command-palette` command.
  - GREEN: same command after implementation -> 2 files, 29 passed.
  - E2E: `palette.spec.ts` was written after the palette code. RED was established afterwards by neutering `bindShortcuts` (no command match), rebuilding, and running `pnpm exec playwright test tests/e2e/palette.spec.ts -g "Ctrl\+\\|Ctrl\+O reaches|Ctrl\+K opens the palette on"` -> 3 failed (Ctrl+K palette not visible, Ctrl+O picker count not 1, Ctrl+\ `data-sidebar` stayed `open`). The file was restored (diff-verified) and rebuilt.
  - GREEN: `pnpm exec playwright test tests/e2e/palette.spec.ts` -> 28 passed.
- Root cause (bugfix only): none

## Task 2

### Decisions made
- `shortcuts.ts` derives key bindings from each command's `shortcut` string in the registry (`Mod+K`, `+S`, `+O`, `+\\`, `+P`), so no second table exists. `Mod` is Cmd on macOS (`navigator.platform` matches Mac/iPhone/iPad) and Ctrl elsewhere; the other modifier, Shift, and Alt must be absent.
- Handler order: ignore `isComposing`; ignore text inputs, textarea, select, and contenteditable outside `.cm-editor`; then `preventDefault` and run only if `available(state)`. An unavailable handled shortcut is still `preventDefault`ed so the browser does not open Save or Print for a screen with no document.
- `run()` is called directly in the keydown handler: no await, animation, or state round-trip before `showOpenFilePicker`.
- `formatShortcut` renders hints (`⌘O` or `Ctrl+O`); the toolbar hint now uses it instead of its own platform check.
- `bindShortcuts` is installed once in `App.tsx` with refs to the latest commands and `store.getState`.

### Spec deviations
- none

### Tradeoffs accepted
- Shortcuts are ignored while the palette input is focused, including Mod+K, so Mod+K does not toggle the palette closed. Escape closes it.

### Assumptions
- none

### Follow-ups for human
- none

### Test evidence
- RED -> GREEN:
  - RED and GREEN: see Task 1 (`tests/unit/shortcuts.test.ts` covers mapping for Cmd on macOS and Ctrl elsewhere, modifier rules, composition, input/textarea/select/contenteditable filtering, CodeMirror pass-through, preventDefault, unavailable command, cleanup).
- Root cause (bugfix only): none

## Task 3

### Decisions made
- `tests/e2e/palette.spec.ts` has 28 tests: open via Ctrl+K, Cmd+K (platform stubbed to `MacIntel` with `addInitScript`), and toolbar; filter; first match highlighted; arrow keys; Enter; click; disabled items without a document (visible, `aria-disabled`, not runnable); empty state; Escape focus restore; focus trap; Open URL handoff; Headings jump (scrollTop > 200); Recents (URL); Folder files (OPFS directory behind a `showDirectoryPicker` stub); Ctrl+O picker path and palette Open file path; Ctrl+\ ; Ctrl+P (window.print stubbed, also via menu and palette); Ctrl+P without a document; Ctrl+S inside CodeMirror writes the file; Ctrl+K inside the editor; no shortcut in the Open URL input or palette input; IME composition ignored; preventDefault on all five; focus mode from the palette.
- Chromium evidence: Playwright drives keys through CDP into the page, so headless Chromium did not consume Ctrl+O, Ctrl+P, Ctrl+S, or Ctrl+K before the page. Every shortcut assertion therefore runs as a real keypress. A real headed browser may still claim a shortcut (for example Ctrl+P in some builds); the command stays reachable by palette and toolbar, and both paths are asserted for Print and Open file.
- Mac Cmd+K is asserted by overriding `navigator.platform`; Meta+K on the Linux host does not open the palette, and the test asserts that Ctrl+K does nothing on the Mac stub.

### Spec deviations
- `tests/e2e/shell.spec.ts` needed no change: no test asserted the disabled placeholder.

### Tradeoffs accepted
- none

### Assumptions
- none

### Follow-ups for human
- Phase 8 contrast and motion audit should include the palette dialog (transitions are not styled in this phase).

### Test evidence
- RED -> GREEN: see Task 1 for E2E RED.
  - GREEN: `pnpm test:e2e` -> 82 passed (54 baseline + 28 palette), including S3 median 28.6 ms and S4 first content median 217 ms.

## Extra paths touched (why)
- `src/ui/toc-panel.tsx`: export `scrollToHeading` for the Headings group.
- `tests/e2e/reader.spec.ts`: enabling the palette button adds a Tab stop between Export options and Contents, so `reader.spec.ts:125` failed at the Contents step. Coordinator approved via `refract ask` a one-line insertion of the `Command palette` button at its real DOM position; the visible-focus assertion applies to it like the other stops. No step removed or loosened.
- `src/entrypoints/reader/App.tsx`, `src/ui/toolbar.tsx`, `src/reader/commands.ts`: in the PLAN file list.

## Final verification (from /home/ngosi/projects/markdown-reader)
- `pnpm install --frozen-lockfile`: Already up to date.
- `grep -rn "cmdk\|@radix-ui" package.json pnpm-lock.yaml`: no output.
- `pnpm lint`: exit 0, 206 warnings (cap 218). A new `useImportType` warning in `command.tsx` was fixed; the 3 format errors in new test files were fixed with `biome format --write` on those files only.
- `pnpm typecheck`: pass.
- `pnpm exec vitest run --no-file-parallelism`: 27 files, 300 tests passed.
- `pnpm test:e2e`: 82 passed. First full run had 81 passed and 1 failed (the Tab traversal case above); rerun after the approved fix passed. Host load average was 11 to 15 on 8 cores; no timeouts.
