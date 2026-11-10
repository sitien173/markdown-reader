<!-- refract-shared-version: 3.0.0 -->

# Phase 1 Decision Notes

<!-- Created by the worker per worker-contract.md. Append one `## Task 1` block per task. -->

## Task 1

### Decisions made
- none

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
  - RED: `pnpm lint` -> `Found 2 errors.` (Format diffs in `.ogrep/lance/**/latest_version_hint.json`)
  - GREEN: `pnpm lint` -> `Checked 175 files in 382ms. No fixes applied. Found 183 warnings. Found 3 infos.` (0 errors, exit 0)
- Root cause (bugfix only): `.ogrep` search index artifacts were not excluded in `biome.json` `files.includes`. Adding `"!**/.ogrep"` excludes them.

## Task 2

### Decisions made
- Support both `chain` and `levels` properties on `HidingRuleOptions` for gitignore level chain configuration.
- Precompile `ignore()` instances during `createHidingRule` and sort levels by descending directory depth so deepest ancestor levels are evaluated first.

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
  - RED: `pnpm test tests/unit/hidden.test.ts` -> `Tests  7 failed | 1 passed (8)` (AssertionError: expected false to be true in hiding rule assertions)
  - GREEN: `pnpm test tests/unit/hidden.test.ts` -> `Tests  8 passed (8)` (8 passed in 498ms)
- Root cause (bugfix only): none

## Task 3

### Decisions made
- Added `showHiddenItems` (boolean default `false`) and `ignorePatterns` (string default `'node_modules/'`) to `Settings['general']`, `defaultSettings.general`, and `generalSchema` with `z.catch` fallbacks.
- Placed "Show hidden and ignored items" toggle and `IgnorePatternsControl` in `GeneralTab` following established toggle and input control patterns with draft state and onBlur commit.

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
  - RED: `pnpm test tests/unit/settings.test.ts` -> `Tests  3 failed | 8 passed (11)` (AssertionError: missing showHiddenItems/ignorePatterns in defaultSettings.general and undefined fallback)
  - GREEN: `pnpm test tests/unit/settings.test.ts` -> `Tests  11 passed (11)` (11 passed in 1.64s)
- Root cause (bugfix only): none


## Fix 1

### Decisions made
- Fixed dot-item rule in `src/source/hidden.ts` to test only the entry's own name (the last segment of the path), allowing non-dot items under dot-named parent directories (e.g. `.github/docs/readme.md`) to remain visible.
- Removed duplicate `levels` option alias on `HidingRuleOptions`; kept `chain` only.
- Removed unused `isHidden` export and its unit test.
- Removed redundant `?? ''` fallbacks on typed string properties (`ignorePatterns`, `dirPath`, `gitignoreText`).
- Removed `aria-labelledby` from `IgnorePatternsControl` Textarea in `src/ui/settings/general-tab.tsx`, keeping `aria-label={t('settings.general.ignorePatternsField')}` matching `appearance-tab.tsx`.

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
  - RED: `pnpm exec vitest run tests/unit/hidden.test.ts` -> `Tests 1 failed | 7 passed (8)` (AssertionError: expected true to be false for `.github/docs/readme.md`)
  - GREEN: `pnpm exec vitest run tests/unit/hidden.test.ts tests/unit/settings.test.ts` -> `Tests 19 passed (19)` (19 passed in 848ms)
- Root cause (bugfix only): `src/source/hidden.ts` evaluated `segments.some(segment => segment.startsWith('.'))` which hid any path with a dot-named ancestor; fixed to check `entryName.startsWith('.')` where `entryName = cleanPath.slice(cleanPath.lastIndexOf('/') + 1)`.
