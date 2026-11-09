<!-- refract-shared-version: 3.0.0 -->

# Phase 7 Decision Notes

<!-- Created by the worker per worker-contract.md. Append one `## Task <M>` block per task. -->





## Task 0

### Decisions made
- (a) `src/source/watch.ts` redirect-follow fetch now passes `cache: 'no-cache'`.
- (b) `ContentsPanel` in `src/entrypoints/reader/App.tsx` keys `TocPanel` by `loadId`. Heading changes inside one document keep the collapse state.
- (c) `.md-code-bar` in `src/styles/reader.css` has `user-select: none`.
- (d) `tests/unit/reader-render.test.tsx` gains a `ReaderMenu` render spy (`renders.menu`), a read-mode `describe` repeating the "field the shell does not render" check, and a `describe` for the contents panel collapse state.

### Spec deviations
- none

### Tradeoffs accepted
- (c) and (d, read-mode and menu spy) are characterization or CSS-only: the read-mode check passes before and after; no behavioral RED exists for them.

### Assumptions
- The `user-select` rule is verified by review of the CSS, not by a test.

### Follow-ups for human
- none

### Test evidence
- RED -> GREEN:
  - RED: `pnpm exec vitest run tests/unit/watch.test.ts tests/unit/reader-render.test.tsx --maxWorkers=2` -> 2 failed: `watch.test.ts > redirecting document URL > reports a change once when the followed text moves, sending no validators` (expected false to be true on the `cache === 'no-cache'` assertion) and `reader-render.test.tsx > contents panel collapse state > resets collapse state when a new document loads` (expected null not to be null).
  - GREEN: same command -> Test Files 2 passed, Tests 23 passed (23).
- Root cause (bugfix only): (a) the follow fetch used the default cache mode, so an HTTP-cached redirect target could hide changes. (b) `collapsed` state lived in `TocPanel` and survived a document change while heading ids repeat across documents.

## Task 1

### Decisions made
- `tests/e2e/motion.spec.ts`: new describe `reduced motion, new surfaces`: settings panel on every tab in `popup.html` and `options.html`; reader menu, Settings dialog, About dialog, and sidebar closed and open, each asserting zero transition, animation, and smooth-scroll durations.
- `tests/e2e/contrast.spec.ts`: `pairInPage` gained an optional `fgOverride`; new helpers `forceTheme`, `lowContrast` (every visible text owner, input value, and placeholder, or the elements of a selector) and a CDP accessibility-tree check `unnamed` (axe-free). New specs: forced light and dark for the popup and options (every tab, rail icons at 3:1), and for the reader sidebar, search field, Copy bar, menu, Settings dialog (every tab), and About dialog. Named-control specs for popup, options, and the reader.
- GREEN fix: the Auto-refresh interval slider and the Max width slider had no accessible name (the shadcn `Slider` forwards `aria-label` to the root, not the thumb input). `general-tab.tsx` and `appearance-tab.tsx` now render an `sr-only` span and pass `aria-labelledby`, which Base UI forwards to the thumb input. Existing label strings are unchanged. Edit limited to accessible names, as the Code Context allows.
- No CSS or token change was needed: every contrast and motion check passed on the first run, including the Copy button and sidebar search field in forced dark.

### Spec deviations
- "Forced" light or dark on `popup.html` and `options.html` is the OS scheme through `emulateMedia`. Those two entrypoints never call `applyAppearance`, so the stored `appearance.theme` does not reach them. The reader specs force the stored theme with the OS scheme set to the opposite. Fixing the entrypoints needs `src/entrypoints/popup/main.tsx` and `src/entrypoints/options/main.tsx`, which are outside the allowed set.

### Tradeoffs accepted
- Text contrast uses 4.5:1 for every text owner, including large text, and ignores element opacity.

### Assumptions
- none

### Follow-ups for human
- Decide whether the popup and options pages should apply `appearance.theme`. They currently follow the OS scheme only.

### Test evidence
- RED -> GREEN:
  - RED: `pnpm exec playwright test tests/e2e/contrast.spec.ts -g "accessible"` with the `src/ui/settings` change stashed -> 3 failed, each `expect(received).toEqual(expected)` with `Array ["slider"]` for an unnamed slider (popup, options, and reader Settings dialog General tab).
  - GREEN: `pnpm exec playwright test tests/e2e/contrast.spec.ts tests/e2e/motion.spec.ts` -> 25 passed.
- Root cause (bugfix only): unnamed `role=slider` thumb input, shown by the browser accessibility tree.

## Task 2

### Decisions made
- Mechanism, in the Zen Escape effect of `src/entrypoints/reader/App.tsx`: (1) an Escape keydown while `document.fullscreenElement` is set calls `document.exitFullscreen()` and does not exit Zen. Chrome normally consumes that key; this also makes the headless run deterministic, where CDP key events do not reach the browser's fullscreen exit. (2) A `fullscreenchange` listener opens a 300 ms guard (`FULLSCREEN_GUARD_MS`); an Escape inside the guard does not exit Zen. (3) Any other Escape with no dialog or menu still exits Zen for the session.
- `tests/e2e/zen-fullscreen.spec.ts`: three specs: Escape in fullscreen leaves fullscreen and keeps Zen; an Escape right after the browser left fullscreen keeps Zen and a later Escape leaves it; Escape with no fullscreen and no dialog leaves Zen and keeps the stored value.

### Spec deviations
- The spec wording "was set on the previous keydown" is implemented as "is set at this keydown", because the event that follows a browser-side exit arrives with `fullscreenElement` already null and is covered by the `fullscreenchange` guard instead.

### Tradeoffs accepted
- An Escape that reaches the page before the `fullscreenchange` event and after `fullscreenElement` became null would exit Zen. `exitFullscreen()` resolves before the event, so this order is possible in a synthetic test. Real Chrome behavior for this order was not observed; the event arrived first in the probe runs.

### Assumptions
- Real Chrome consumes Escape for fullscreen exit, so path (1) rarely runs outside tests. Not verified in a headed browser.

### Follow-ups for human
- Manual check in headed Chrome: Zen on, Toggle Fullscreen, Escape once.

### Test evidence
- RED -> GREEN:
  - RED: `pnpm exec playwright test tests/e2e/zen-fullscreen.spec.ts` -> 1 failed: `Escape in browser fullscreen leaves fullscreen and keeps Zen on`, `Expected: false, Received: true` on `document.fullscreenElement !== null` after Escape. The guard spec failed with `expect(locator).toBeVisible() failed` (Zen exited) when the guard line was removed.
  - GREEN: `pnpm exec playwright test tests/e2e/zen-fullscreen.spec.ts --repeat-each=8` -> 24 passed. `tests/e2e/appearance.spec.ts` plus the new spec: 16 passed.
- Root cause (bugfix only): the Zen Escape handler ignored fullscreen, so one key press exited Zen and, in the test browser, left fullscreen on.

## Task 3

### Decisions made
- `tests/fixtures/popup-roles.json` holds roles and names only, normalized once from the four popup snapshots. Reference placeholders in another language, account, plan, version, and branding text are not copied. Reference switches are unnamed generic nodes and are not listed. Radio groups and select textboxes are stored as role `choice`; our `combobox` and `radio` map to `choice`, `spinbutton` to `textbox`.
- `tests/e2e/popup.spec.ts` reads the fixture, walks the CDP accessibility tree of `popup.html`, checks one `main` landmark and the four-tab rail order, and per tab diffs the reference entries against ours. The fixture pins the recorded `missing` and `extra` lists per tab.
- No change to `settings-panel.tsx` was needed: the landmark, rail, and headings already match.

### Spec deviations
- Rail items are `tab` in a `tablist` in ours and `button` in a `list` in the reference. Kept, since the existing specs and the ARIA tab pattern depend on it.
- Differences recorded (also in the fixture):
  - General, extra: buttons Open viewer, Open editor, Render current tab, "Local file access: Allowed"; heading 2 Recent; slider "Auto-refresh interval slider".
  - Appearance, missing: slider, textbox, and choice for Custom max width (ours renders them only while the switch is on, and has no unit select); button "Apply CSS". Extra: button "Apply".
  - Plugins: none.
  - About, missing: two links (DESIGN non-goal).
  - Theme and code-theme controls are selects (`combobox`) in ours and radio groups in the reference.

### Tradeoffs accepted
- The comparison covers roles heading, button, slider, textbox, spinbutton, combobox, radio, and link. Switches are not compared.

### Assumptions
- none

### Follow-ups for human
- none

### Test evidence
- RED -> GREEN:
  - RED: `pnpm exec playwright test tests/e2e/popup.spec.ts` with empty `missing` and `extra` -> 3 failed, 2 passed. General: `extra` held six entries; Appearance: `missing` held `button:Apply CSS`, `choice:*`, `slider:*`, `textbox:*`; About: `missing` held `link:*` twice.
  - GREEN: same command with the differences recorded -> 5 passed.
- Root cause (bugfix only): none

## Task 4

### Decisions made
- `README.md` gains a `## Settings` section: the panel in popup, options page, and reader dialog; `settings:v1`; General, Appearance, Plugins, and About lists, including Render .txt (off by default). Every name comes from `src/i18n/en-US.ts`.
- `CHROMEWEBSTORE.md` gains one paragraph in the detailed description with the same settings and the `.txt` option. The permission table is unchanged.
- `pnpm exec biome format --write` on `tests/e2e/contrast.spec.ts`, `tests/e2e/popup.spec.ts`, `tests/e2e/zen-fullscreen.spec.ts` only. `pnpm lint` had exited 1 with 3 format errors in those files.
- Checklist of DESIGN criteria and proving specs is in `journal.md`.

### Spec deviations
- none

### Tradeoffs accepted
- Criterion 9 is proved by the default-settings unit test plus the pre-existing e2e specs that run with no stored settings. No single spec compares rendered output against the base build.

### Assumptions
- none

### Follow-ups for human
- Criterion 1 names a 60 px icon rail. No spec asserts that width. `tests/e2e/settings.spec.ts` asserts the popup size (520 by 480) and `tests/e2e/popup.spec.ts` asserts the four-tab rail order only.
- `CHROMEWEBSTORE.md` still holds placeholders (publisher, support, privacy URL, screenshots). Staff must fill them before submission.

### Test evidence
- RED -> GREEN:
  - RED: `pnpm lint` -> exit 1, `Found 3 errors` (format, in the three new spec files), `Found 183 warnings`.
  - GREEN: after formatting those three files, `pnpm lint` -> exit 0, `Found 183 warnings`, `Found 3 infos`.
- Root cause (bugfix only): new spec files were not formatted with Biome.

### Fresh verification (all from /home/ngosi/projects/markdown-reader)
| Check | Exit | Result |
|---|---|---|
| `pnpm typecheck` | 0 | clean |
| `pnpm lint` | 0 | 183 warnings (Prior State: 183) |
| `pnpm exec vitest run --maxWorkers=2` | 0 | 40 files, 482 tests passed (Prior State: 478) |
| `pnpm build` | 0 | built |
| `pnpm exec playwright test tests/e2e/popup.spec.ts tests/e2e/zen-fullscreen.spec.ts tests/e2e/motion.spec.ts tests/e2e/contrast.spec.ts` | 0 | 33 passed |
| `pnpm test:e2e` (foreground) | 0 | 168 passed in 5.0 min, 0 failed, 0 skipped (Prior State: 148) |
| `pnpm exec wxt zip` | 0 | `.output/markdown-reader-1.0.0-chrome.zip`, 4074873 bytes |

### Zip and permissions audit
- Manifest in the zip: `permissions` `['storage','contextMenus','tabs']`, `host_permissions` `['<all_urls>']`, `options_ui` `{page: options.html, open_in_tab: true}`.
- `git diff refs/plans/reference-parity-ui/base -- wxt.config.ts` adds only the `options_ui` line. `permissions` and `host_permissions` are unchanged. `wxt.config.ts` is not modified in the working tree.
- Zip entries matching `snapshot/`, `tests/`, or `docs/`: 0.

## Fix batch
- A real Escape within 300 ms of a Toggle Fullscreen exit is swallowed by design (the `fullscreenchange` guard, `FULLSCREEN_GUARD_MS`).
- Escape with a dialog, palette, or menu open now closes only that surface, also in fullscreen: the open-surface check runs before the `fullscreenElement` branch. Proof is `tests/unit/reader-render.test.tsx` ("Escape in fullscreen with a dialog open"). The e2e case in `tests/e2e/zen-fullscreen.spec.ts` passes on old and new code because Chrome marks the palette Escape as handled, so it is a regression guard, not a RED.
- `TocPanel` is keyed by `sourceId` (new store field set in `applyText`) plus `docPath`, not `loadId`.

## Deflake: zen-fullscreen palette Escape case
- Root cause is in the test, not in `App.tsx`. `toggleFullscreen` returned while its own palette was still closing. The next Ctrl+K and Escape then raced that closing dialog, which the app correctly treats as not open (`data-ending-style` is excluded), so Escape exited fullscreen. Reproduced only under CPU load: 2 of 12 failed with 6 busy loops, 0 of 42 on an idle machine.
- Fix: wait for the toggle palette to be gone, wait for the palette to be visible with the combobox focused before Escape, and prove "fullscreen stays" with a `fullscreenchange` counter (baseline 1, the enter event) plus a 500 ms settle instead of one immediate read. An earlier counter version failed once because the enter event can arrive after `fullscreenElement` is set; the baseline is now taken after that event.
- Separate flake seen once in a full run, not fixed here: `tests/e2e/entry.spec.ts:52` ("popup actions open the requested reader mode and recent URLs are newest first") failed at the first Tab expecting the General tab focused. It passed 15 of 15 in isolation and in the next full run. Same class of cause (keypress before focus settles), not confirmed.
