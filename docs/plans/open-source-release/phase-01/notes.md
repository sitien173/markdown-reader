<!-- refract-shared-version: 3.0.1 -->

# Phase 1 Decision Notes

<!-- Created by the worker per worker-contract.md. Append one `## Task <M>` block per task. -->

## Task 1

### Decisions made
- Added `.pi/` to `.gitignore`. Biome honors `.gitignore` via its `"vcs"` configuration, so `biome.json` did not need modification.

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
  - RED: `pnpm lint` -> Failed with exit code 1; Checked 189 files; Found 3 errors (formatting differences in `.pi/tasks/01a1c4dc-378c-76f8-9df0-4ab13d6d5f98-1486059/b0268bc4e.json`, `b07f69725.json`, `bb2a88dd7.json`), 208 warnings, 3 infos.
  - GREEN: `pnpm lint` -> Exited with code 0; Checked 186 files in 382ms; Found 208 warnings, 3 infos.
- Root cause (bugfix only): Biome checked untracked local tool files under `.pi/tasks/` because `.pi/` was not listed in repository `.gitignore`. Adding `.pi/` ignored those files in Biome without modifying `biome.json`.

## Task 2

### Decisions made
- Replaced `color: var(--primary)` with `color: var(--foreground)` in `.nav-item--active` and `.nav-item--active:hover` in `src/styles/reader.css`. This ensures text contrast over the tinted background meets the 4.5:1 WCAG AA threshold in both light and dark themes using the existing `var(--foreground)` token, while leaving `.nav-item--active .nav-file-icon` as `var(--primary)`.

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
  - RED: `pnpm build && pnpm exec playwright test contrast -g "sidebar"` -> 2 failed: `tests/e2e/contrast.spec.ts:285:5 › forced light theme on the new surfaces › reader dialog, menu, sidebar, search field, and Copy button meet 4.5:1` failed on `button[nav-item nav-item--active] "Title"`, and `tests/e2e/contrast.spec.ts:285:5 › forced dark theme on the new surfaces › reader dialog, menu, sidebar, search field, and Copy button meet 4.5:1` failed on `button[nav-item nav-item--active] "Title"` and `button[nav-item] "Section"`; 1 passed (7.6s).
  - GREEN: `pnpm build && pnpm exec playwright test contrast -g "sidebar"` -> 3 passed (10.8s).
- Root cause (bugfix only): In commit `3532eb2`, `.nav-item--active` used `color: var(--primary)` against `background: color-mix(in srgb, var(--primary) 12%, transparent)` over `var(--muted)`. In light mode, `#0066cc` on `#d7e4f2` yielded 4.28:1 (< 4.5:1). In dark mode, `#4da3ff` on `#303a47` yielded 4.40:1 (< 4.5:1). Additionally, `.nav-item` lacked reduced-motion overrides, causing theme changes in dark mode to sample mid-transition text color (`#86868b`, 3.85:1). Updating `.nav-item--active` color to `var(--foreground)` achieves 10.6:1 (light) and 11.2:1 (dark).

## Task 3

### Decisions made
- Added `.nav-item` to the `@media (prefers-reduced-motion: reduce)` block in `src/styles/reader.css` alongside `.reader-body, .reader-toc, .reader-content, .nav-caret`.

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
  - RED: `pnpm build && pnpm exec playwright test motion` -> 2 failed: `tests/e2e/motion.spec.ts:58:3 › reduced motion › a loaded document, sidebar included, has zero durations and no View Transition starts` failed with `["button[nav-item nav-item--active]", "button[nav-item]"]`, and `tests/e2e/motion.spec.ts:102:3 › reduced motion, new surfaces › the reader menu, the Settings dialog, the About dialog, and the sidebar have zero durations` failed with `["button[nav-item nav-item--active]", "button[nav-item]"]`; 8 passed (18.0s).
  - GREEN: `pnpm build && pnpm exec playwright test motion` -> 10 passed (26.9s).
- Root cause (bugfix only): Commit `3532eb2` added `transition: background-color 120ms ease, color 120ms ease;` to `.nav-item` in `src/styles/reader.css`. Because rules in `src/styles/reader.css` out-rank the global reset in `src/styles/globals.css`, `.nav-item` retained a non-zero transition duration under `prefers-reduced-motion: reduce`. Adding `.nav-item` to the reduced-motion block in `src/styles/reader.css` sets `transition: none`.

## Task 4

### Decisions made
- Regenerated the two visual regression snapshots for the General tab (`tests/e2e/settings-layout.spec.ts-snapshots/options-general-linux.png` and `tests/e2e/settings-layout.spec.ts-snapshots/dialog-general-linux.png`) to reflect the intentional removal of the Open Editor action and Recent section in commit `3532eb2`.

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
  - RED: `pnpm exec playwright test settings-layout -g "General tab"` -> 2 failed: `tests/e2e/settings-layout.spec.ts:85:3 › options page General tab matches its screenshot` (15536 pixels differ) and `tests/e2e/settings-layout.spec.ts:91:3 › reader dialog General tab matches its screenshot` (10189 pixels differ).
  - GREEN: `pnpm build && pnpm exec playwright test settings-layout --update-snapshots -g "General tab"` -> 2 passed (4.1s).
- Root cause (bugfix only): Commit `3532eb2` intentionally removed the Open Editor action button and the Recent section from `src/ui/settings/general-tab.tsx`, leaving the visual snapshot files stale. Verified via visual inspection of both regenerated PNG files:
  - `dialog-general-linux.png`: Displays General tab controls (Open viewer, Enable, Local file access, Breaks, Outline collapsing, Render .txt as Markdown, Auto-refresh) with left navigation rail and close button; Open Editor button and Recent section are absent; layout, spacing, and controls are intact without other changes.
  - `options-general-linux.png`: Displays General tab controls (Open viewer, Render current tab, Enable, Local file access, Breaks, Outline collapsing, Render .txt as Markdown, Auto-refresh) with left navigation rail; Open Editor button and Recent section are absent; layout, spacing, and controls are intact without other changes.

