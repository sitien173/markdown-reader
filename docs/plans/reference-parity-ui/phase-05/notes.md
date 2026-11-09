<!-- refract-shared-version: 3.0.0 -->

# Phase 5 Decision Notes

<!-- Created by the worker per worker-contract.md. Append one `## Task <M>` block per task. -->



## Task 1

### Decisions made
- Added the Zod-free module `src/lib/settings-flags.ts` with `SETTINGS_KEY` and `readGeneralFlags()` (`typeof` checks; defaults enabled true, renderTxt false, charsetCompat false; storage errors return defaults). `src/lib/settings.ts` imports and re-exports `SETTINGS_KEY`, so the literal `settings:v1` appears once in `src`.
- `shouldRedirectMarkdown(contentType, pathname, flags)` takes the flags as a third argument with the pre-phase defaults. `main()` in `detect.content.ts` calls `readGeneralFlags()` and passes the result.
- `isMarkdownLink(raw, renderTxt = false)` and `isValidCapture(message, sender, runtimeId, renderTxt = false)` take the flag as a parameter. The background handlers (context menu click, `capture-markdown`) read `readGeneralFlags()` and pass `renderTxt`. This keeps both functions synchronous and unit-testable.
- Enable off is enforced only in the content script. The background context menu, popup actions, and `render-current` ignore `enabled`, per the invariant.

### Spec deviations
- The Phase Spec says `background.ts` reads the flag inside `isMarkdownLink` and `isValidCapture`. Storage reads are async, so the flag is read in the handlers and passed in. Behavior is the same.
- Added `tests/unit/settings-flags.test.ts` for the new helper, as the prompt allows.

### Tradeoffs accepted
- Two storage reads per capture or context-menu click in the background. Local storage reads are cheap and the paths are user-triggered.

### Assumptions
- A `.txt` capture is validated against `renderTxt` at capture time, so turning the setting off between navigation and capture rejects the capture and leaves the raw page open.

### Follow-ups for human
- none

### Test evidence
- RED -> GREEN:
  - RED: `pnpm exec vitest run tests/unit/detect.test.ts tests/unit/background.test.ts` -> 4 failed, 7 passed, for example `AssertionError: expected true to be false` at `detect.test.ts:19` (Enable off still redirects) and `expected false to be true` at `detect.test.ts:26` (`.txt` with Render .txt on not redirected).
  - GREEN: `pnpm exec vitest run tests/unit/detect.test.ts tests/unit/background.test.ts tests/unit/settings-flags.test.ts tests/unit/settings.test.ts` -> 4 files passed, 26 tests passed.
- Root cause (bugfix only): none

## Task 2

### Decisions made
- `src/source/decode.ts` exports `decodeBytes(bytes, httpCharset?)`: BOM (UTF-8, UTF-16LE, UTF-16BE), strict UTF-8, HTTP charset, then `windows-1252`. Each step uses `TextDecoder` with `fatal: true` except the last, which accepts every byte. An unknown or failing HTTP charset label falls through.
- Also exported `charsetFromContentType` and `readResponseText(response, charsetCompat)`. `UrlSource` and `FileUrlSource` call `readResponseText`, which keeps `text()` when the setting is off and reads `arrayBuffer()` when on.
- `controller.load` reads `general.charsetCompat` from `useSettingsStore` (loaded before the reader mounts). For `file:` with the setting on it skips captured page text and reads the file bytes. `http(s)` sources keep captured text.

### Spec deviations
- Edited `src/source/file-url.ts`, which is not in the Files list. Reason: file: charset decoding must happen in `FileUrlSource.read`. Approved through `refract ask` before the edit; the change is the constructor flag and the shared helper call only.

### Tradeoffs accepted
- The `file:` watcher still compares `response.text()` as UTF-8. It only detects change, so a charset mismatch cannot hide an edit. Reloads decode through `read()`.

### Assumptions
- The captured text for `.txt` or `.md` pages is decoded by the browser with its own charset detection, which is why the bypass exists.

### Follow-ups for human
- none

### Test evidence
- RED -> GREEN:
  - RED: `pnpm exec vitest run tests/unit/charset.test.ts` (inert `decodeBytes` using a plain `TextDecoder`) -> 7 failed, for example `AssertionError: expected '��h\u0000i\u0000' to be 'hi'`.
  - GREEN: `pnpm exec vitest run tests/unit/charset.test.ts tests/unit/source-url.test.ts tests/unit/controller.test.ts` -> 3 files passed, 29 tests passed.
- Root cause (bugfix only): none

## Task 3

### Decisions made
- `watch.ts` exports `clampIntervalSec` (0.5 to 600, non-finite gives 1), `fileIntervalMs`, `httpIntervalMs` (at least 5 s), and `watchHttpUrl(url, events)`. The poller makes one unconditional baseline request at start, then polls with `If-None-Match` and `If-Modified-Since` taken from the last 200. A 304 keeps the text. A network error or non-2xx status keeps the text and doubles the delay (base, 2x, 4x, ...) up to 300 s. Any success resets the delay. Stop clears the timer and aborts the in-flight request.
- Fetch uses `redirect: 'manual'`, so conditional headers go only to the document URL and never follow a redirect to another origin. A redirect reply is a non-2xx opaque response and backs off.
- `WatchEvents` and `DirectoryWatchEvents` gained an optional `intervalMs`. `watchFileHandle` (polling fallback), `watchFileUrl`, and `watchDirectory` (polling fallback) use it, with 1000 ms as the default. `file-handle.ts` and `directory.ts` pass events through unchanged, so they need no edit.
- `UrlSource.watch` calls `watchHttpUrl`. The controller now keeps the `UrlSource` as `active` for http(s) so Reload from the banner works there too.
- `controller.ts` adds `startWatch()`, which picks the watcher from the active source type and live settings: folder and picked file always watch (the deleted notice and tree updates stay), with `onChange` gated on `general.autoRefresh` at call time; `file:` URL polling starts only when Auto-refresh is on; http(s) polling starts only when Auto-refresh and Auto-refresh web pages are both on. `mount()` subscribes to the settings store and restarts the watcher when those three fields change. The subscription ends with the mount cleanup.
- The dirty-draft check already existed in `checkExternal` and `reloadFromDisk` (`state().dirty` gives `externalChange: true` and no `applyText`). It now covers the http path too, and tests cover file URL, folder, and http.

### Spec deviations
- The first RED run used a queue-based fetch stub. After GREEN I replaced that stub with a small server model (validators honored, `fail` switch) because the queue made the delay assertions depend on request order. The behaviors asserted are the same. The first RED run showed 9 failures against inert `clampIntervalSec` and `watchHttpUrl` scaffolding, including `expected 0.1 to be 0.5`, `expected 1000000 to be 600000`, `expected 'v1' to be 'v2'`, and `expected 16 to be 6` (a `file:` URL still polled while Auto-refresh was off).

### Tradeoffs accepted
- The http baseline request happens at open, not one interval later, so a change right after open is not missed. It is a poll request, so it is sent only when both switches are on.
- If the baseline text differs from the loaded text only by whitespace handling, no change is reported, because the baseline is the first poll, not the loaded text.

### Assumptions
- Chrome does not add its own cache validators when the script sets conditional headers, so a 304 reaches the script.
- Turning Auto-refresh off keeps the folder tree watcher and the deleted notices. Only text reloads stop.

### Follow-ups for human
- A same-origin redirect on the document URL (for example http to https) stops http polling from detecting changes because redirects are not followed. The first load still follows it. Say so if you want redirects followed for same-origin targets.

### Test evidence
- RED -> GREEN:
  - RED: `pnpm exec vitest run tests/unit/auto-refresh.test.ts` -> 9 failed, 2 passed (see deviation note for assertions).
  - GREEN: `pnpm exec vitest run tests/unit/watch.test.ts tests/unit/controller.test.ts tests/unit/auto-refresh.test.ts` -> 3 files passed, 40 tests passed.
- Root cause (bugfix only): none

## Task 4

### Decisions made
- `general-tab.tsx` now has working rows for Enable, Render .txt, Auto-refresh, Auto-refresh web pages, interval, Charset compatibility, Breaks (shared stored value with Plugins), and a read-only Local file access row. The row only calls `browser.extension.isAllowedFileSchemeAccess()` and never requests the permission. A rejected or throwing call shows the off state.
- The state call is wrapped in `Promise.resolve().then(...)` so a synchronous throw also lands in the rejection path.
- `tests/e2e/general.spec.ts` has 8 tests covering Enable off with popup render, Render .txt on and off, the file access row, row persistence, shared Breaks value, windows-1252 decoding, and the http(s) poll rules (no request by default, update, 304, 500).

### Spec deviations
- none

### Tradeoffs accepted
- The file access row reads state once on mount. It does not refresh if the user changes the toggle in the extension page while Settings stays open.

### Assumptions
- `isAllowedFileSchemeAccess` is available in the extension page context in Chrome. The e2e test confirms it returns a boolean there.

### Follow-ups for human
- none

### Test evidence
- RED -> GREEN: general.spec.ts failed against the inert rows before the rows were wired, then passed after.
- Fresh final checks from `/home/ngosi/projects/markdown-reader` on 2026-11-09:
  - `pnpm typecheck` exit 0.
  - `pnpm lint` exit 0, 183 warnings (Prior State 183), 3 infos.
  - `pnpm exec vitest run --maxWorkers=2` 40 files, 469/469 passed.
  - `pnpm build` exit 0, then `pnpm exec playwright test tests/e2e/general.spec.ts` 8 passed.
  - `pnpm test:e2e` 134 passed (Prior State 126).
- Root cause (bugfix only): none
