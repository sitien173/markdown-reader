<!-- refract-shared-version: 3.0.1 -->

# Phase 3 Decision Notes

<!-- Created by the worker per worker-contract.md. Append one `## Task <M>` block per task. -->


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
  - RED: `pnpm vitest run tests/unit/json-view.test.tsx` -> `AssertionError: expected '<pre><code>// a comment\n{&quot;name&…' to contain 'shiki'`
  - GREEN: `pnpm vitest run tests/unit/json-view.test.tsx` -> `1 passed (1)`
- Root cause (bugfix only): none


## Task 2

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
  - RED: `pnpm vitest run tests/unit/json-view.test.tsx` -> `AssertionError: expected null not to be null`
  - GREEN: `pnpm vitest run tests/unit/json-view.test.tsx` -> `9 passed (9)`
- Root cause (bugfix only): none


## Task 3

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
  - RED: `pnpm vitest run tests/unit/reader-store.test.ts` -> `AssertionError: expected { docKind: 'markdown', …(24) } to match object { docKind: 'markdown', …(20) }` and `AssertionError: expected [ …(2) ] to deeply equal [ …(3) ]`
  - GREEN: `pnpm vitest run tests/unit/reader-store.test.ts` -> `10 passed (10)`
  - RED: `pnpm vitest run tests/unit/reader-render.test.tsx` -> `AssertionError: expected null not to be null`
  - GREEN: `pnpm vitest run tests/unit/reader-render.test.tsx` -> `15 passed (15)`
- Root cause (bugfix only): none


## Task 4

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
  - RED: `pnpm vitest run tests/unit/reader-render.test.tsx` -> `AssertionError: expected null not to be null` and `AssertionError: expected <div data-testid="markdown"></div> to be null`
  - GREEN: `pnpm vitest run tests/unit/reader-render.test.tsx` -> `17 passed (17)`
- Root cause (bugfix only): none


## Task 5

### Decisions made
- Created `tests/e2e/json-preview.spec.ts` covering all required scenarios in Chromium using `startFixtureServer` and the `contextWithFileAccess` helper pattern from `tests/e2e/reload.spec.ts`.
- Verified redirection control via `general.renderJson` flag in `chrome.storage.local`.
- Covered minified formatting, JSONC comment highlighting, invalid JSON error banner and position reporting, empty document handling, large file (>200 KB) fallback with copy functionality, menu/palette command availability (`print` available; `mode-edit` and `export-html` unavailable), and disk file auto-refresh.

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
  - RED: `pnpm playwright test tests/e2e/json-preview.spec.ts` -> initially 0 tests existed before writing the specification.
  - GREEN: `pnpm playwright test tests/e2e/json-preview.spec.ts` -> `8 passed (23.5s)`
- Root cause (bugfix only): none


## Final checks

- `pnpm typecheck` -> exit 0.
- `pnpm lint` -> exit 0, 0 errors, 208 warnings, 3 infos (baseline preserved at 208 warnings, 3 infos).
- `pnpm test` -> 46 files passed, 622 tests passed (baseline 45 files, 609 tests).
- `pnpm test:e2e` -> 189 tests passed (9.5m). All functional tests passed, including all 8 `tests/e2e/json-preview.spec.ts` tests and all `tests/e2e/appearance.spec.ts` tests (solo rerun: 15 passed, 35.1s). The only 8 failures in the full run were local font differences in `settings-layout.spec.ts` visual snapshots.
