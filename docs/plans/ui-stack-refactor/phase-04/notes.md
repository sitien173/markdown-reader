# Phase 4 Notes

Process note: the first part of this batch was implemented before I had read worker-contract.md, erp.md, prompt.md and PLAN.md Phase 4. I read them afterwards and checked the result against them. Per-task RED commands were not captured during that part, so RED evidence below is limited to what I can state truthfully.

## Task 1

### Decisions made
- shadcn CLI 4.23.0. `components.json` style set to `base-nova`. `@base-ui/react` pinned to 1.9.0.
- Regenerated with `--overwrite`: alert, button, collapsible, dialog, dropdown-menu, input, spinner, tabs, toggle, toggle-group, tooltip. No extra `src/components/ui/*` file was added.
- The generated files imported `cn` from a package named `cn`; I repointed them to `@/lib/utils` and removed the `cn` dependency.
- Removed all `@radix-ui/*` dependencies.
- Removed `tw-animate` enter/exit utility classes (animate-in, fade-in-0, zoom-in-95, slide-in-from-*) from generated overlays. Motion is Phase 8 scope.
- Mode ToggleGroup uses array values with `value={[mode]}` and ignores an empty selection. Tabs use `activateOnFocus`.

### Spec deviations
- none

### Tradeoffs accepted
- Overlays have no enter/exit animation until Phase 8.

### Assumptions
- `asChild` call sites were converted to `render`; `grep -rn asChild src` prints nothing.

### Follow-ups for human
- none

### Test evidence
- RED: not captured (refactor; see process note).
- GREEN: `pnpm exec vitest run --no-file-parallelism` -> 25 files, 251 tests passed.

## Task 2

### Decisions made
- `globals.css` holds base-nova variables with Apple-style light values. `.tds-custom-markdown` renamed `.md-content`, `.tds-custom-md-block` renamed `.md-block`. Typography carried over with identical spacing and size values. reader, popup and editor CSS rewritten on the new tokens.
- Bundled Inter 400, 500, 600 imported in `globals.css`.

### Spec deviations
- none

### Tradeoffs accepted
- none

### Assumptions
- none

### Follow-ups for human
- none

### Test evidence
- RED: not captured (see process note).
- GREEN: `pnpm lint` exit 0, 163 warnings (cap 218). `pnpm typecheck` exit 0.

## Task 3

### Decisions made
- `src/styles/tds/` deleted. `src/export/export-styles.ts` created from the shared Markdown CSS plus the token values it reads. Exported `<main>` uses `.md-content`. The old `TDS_EXPORT_CSS` re-export was removed.
- Added to `tests/e2e/export.spec.ts`: the exported HTML contains `.md-content h1`, has no `@import`, and has no `url(` other than `data:` or a `#` fragment.

### Spec deviations
- none

### Tradeoffs accepted
- The remote-url check allows `url(#id)`. Mermaid SVG gradients use local fragment references, which make no network request. My first version of the check did not allow them and failed on that.

### Assumptions
- none

### Follow-ups for human
- none

### Test evidence
- RED: first run of the added assertion failed: `Expected pattern: not /url\(\s*(?!["']?data:)/i` matched `url(#markdown-diagram-0-...-gradient)`.
- GREEN: `pnpm exec playwright test tests/e2e/export.spec.ts` -> 3 passed.

## Task 4

### Decisions made
- `.tds-*` selectors in tests replaced by roles, labels or `data-slot`. `tests/unit/reader-app.test.tsx` tab activation changed from a mousedown event to a click event for the Base UI Tabs trigger; assertions unchanged.
- `tests/unit/export.test.ts` reads `src/styles/markdown.css` from disk because Vitest replaces CSS imports with an empty string.

### Spec deviations
- `tests/e2e/reader.spec.ts` scroll-spy step changed, per coordinator answer to `refract ask`.
  - Before: scroll `reader-content` to the bottom, then `expect.poll(aria-current text).not.toBe('First')`.
  - After: scroll so `#user-content-second-5` is at the top edge of the scroller, then `expect(tocSeconds.nth(5)).toHaveAttribute('aria-current', 'location')` and `expect([aria-current="location"]).toHaveCount(1)`.
  - Reason: with the bottom scroll, the last-cycle H1 bottom edge lands about 1px inside the observer zone (reader-content top is 110px), so a duplicate "First" wins. The result depends on chrome height. Heading spacing is identical to TDS. The coordinator rejected tuning chrome height and changing `observeHeadings` (Phase 6 rewrites scroll-spy). The new assertion names the exact TOC item, so it is stronger than "not First".
  - The last "Second" (`second-11`) cannot reach the top because the scroller is at its maximum scroll, so the sixth was used.

### Tradeoffs accepted
- none

### Assumptions
- none

### Follow-ups for human
- Phase 6 scroll-spy rewrite should be made independent of duplicate heading text and chrome height.

### Test evidence
- RED: `pnpm test:e2e` (host load about 19) -> `reader.spec.ts:44` failed, `Expected: not "First"`; reproduced alone with `pnpm exec playwright test tests/e2e/reader.spec.ts:44 --workers=1`. Probe showed the intersecting set after the jump was first-10@62, second-10@135, third-10@198, fourth-10@247.
- GREEN: `pnpm exec playwright test tests/e2e/reader.spec.ts --workers=1` -> 4 passed.
- Load-related: `enhance.spec.ts:104` (Mermaid unique ids) timed out at load about 19 and passed alone at load about 14.

## Task 5

### Decisions made
- Save-conflict and file-access dialogs restore focus to Save and to Render current tab after Escape, Cancel and Got it. The 4 `test.fail` cases in `tests/e2e/keyboard.spec.ts` are now plain `test`.

### Spec deviations
- none

### Tradeoffs accepted
- none

### Assumptions
- none

### Follow-ups for human
- none

### Test evidence
- RED: the 4 cases were `test.fail` expected failures at baseline per prompt.md; I did not re-run them in that state.
- GREEN: full `pnpm test:e2e` -> 35 passed, exit 0, no `test.fail` left (`grep -n test.fail tests/e2e/keyboard.spec.ts` prints nothing). Keyboard tests 14 to 21 passed.

## Final checks (fresh)
- `grep -rn "tds-\|@radix-ui" src tests package.json` -> no output. `src/styles/tds` does not exist.
- `pnpm install --frozen-lockfile` -> up to date.
- `pnpm lint` -> exit 0, 163 warnings.
- `pnpm typecheck` -> exit 0.
- `pnpm exec vitest run --no-file-parallelism` -> 25 files, 251 tests passed.
- `pnpm test:e2e` -> 35 passed, exit 0, host load 12.7 to 14.4. S3 median 22.6 ms. S4 first content median 135 ms.
- Finished: 2026-11-07T17:18:39+07:00
