<!-- refract-shared-version: 3.0.1 -->

# Phase 1 Decision Notes

<!-- Created by the worker per worker-contract.md. Append one `## Task <M>` block per task. -->

## Task 1

### Decisions made
- `docKindFromName` tries `new URL(name).pathname` and falls back to the raw name, so URLs with a query or fragment and bare file names both work. `isJsonName` is `docKindFromName(name) !== 'markdown'`.
- `prepareJson` computes line and column from the BOM-stripped text, and returns that BOM-stripped text on error as well as on success.
- The `jsonc-parser` type is referenced as an inline `import('jsonc-parser').ParseError`, so no static import of the package exists.

### Spec deviations
- none

### Tradeoffs accepted
- On error the returned text is the input minus a leading BOM, not byte-identical to the input. The BOM is invisible and this keeps reported positions aligned with the displayed text.

### Assumptions
- Whitespace-only input reports `Empty document` at line 1, column 1.
- Multi-line input is never reformatted, even when oddly indented.

### Follow-ups for human
- none

### Test evidence
- RED -> GREEN:
  - RED: `pnpm vitest run tests/unit/json-document.test.ts` against inert scaffolding -> 8 failed, 4 passed, for example `AssertionError: expected 'markdown' to be 'json'`, `expected '{"a":1,"b":[1,2]}' to be '{\n  "a": 1,\n ...'`, `expected null to deeply equal { message: 'Empty document', ... }`.
  - GREEN: `pnpm vitest run tests/unit/json-document.test.ts` -> 1 file passed, 12 tests passed.
- Root cause (bugfix only): none

## Task 2

### Decisions made
- Description string: `Also open files that end in .json or .jsonc as highlighted, read-only text.`

### Spec deviations
- none

### Tradeoffs accepted
- none

### Assumptions
- none

### Follow-ups for human
- The new label and description strings are not covered by a UI test; `general-tab.tsx` is only type-checked. Phase scope does not include an e2e change.

### Test evidence
- RED -> GREEN:
  - RED: `pnpm vitest run tests/unit/settings.test.ts tests/unit/settings-flags.test.ts` -> 7 failed, 11 passed, for example `expected { enabled: true, ...(2) } to deeply equal { enabled: true, ...(3) }` and `expected undefined to be false`.
  - GREEN: `pnpm vitest run tests/unit/settings.test.ts tests/unit/settings-flags.test.ts` -> 2 files passed, 18 tests passed.
- Root cause (bugfix only): none

## Task 3

### Decisions made
- `shouldRedirectMarkdown` types `renderJson` as optional (`Partial<Pick<GeneralFlags, 'renderJson'>>`) so existing callers and tests that pass only `enabled` and `renderTxt` stay valid.
- The JSON rule is checked before the `.txt` rule. The paths are disjoint, so Markdown and `.txt` results are unchanged.
- The context menu calls `isMarkdownLink(url, renderTxt, true)`.
- The capture listener reads flags once and passes `flags.renderTxt` and `flags.renderJson`.
- `pnpm format` reflowed the `matches` array in `detect.content.ts` to one entry per line.

### Spec deviations
- none

### Tradeoffs accepted
- none

### Assumptions
- `document.contentType` carries no parameters, so exact-match and `endsWith('+json')` checks suffice.

### Follow-ups for human
- The capture message action is still named `capture-markdown` for JSON documents. Rename is out of scope for this phase.

### Test evidence
- RED -> GREEN:
  - RED: `pnpm vitest run tests/unit/detect.test.ts tests/unit/background.test.ts` -> 5 failed, 12 passed, for example `expected false to be true` for `.json` redirect, JSON link, JSON capture, and `expected "vi.fn()" to be called with arguments` for the context menu.
  - GREEN: `pnpm vitest run tests/unit/detect.test.ts tests/unit/background.test.ts` -> 2 files passed, 17 tests passed.
- Root cause (bugfix only): none

## Final checks

- `pnpm typecheck` -> exit 0.
- `pnpm lint` -> exit 0, 0 errors, 208 warnings, 3 infos (baseline 208 warnings, 3 infos).
- `pnpm test` -> 45 files passed, 562 tests passed (baseline 44 files, 543 tests).
- `jsonc-parser` is `3.3.1` in `package.json` and is reached only by dynamic `import()` in `src/lib/json-document.ts`. `doc-kind.ts` has no imports. `settings-flags.ts`, `detect.content.ts`, and `background.ts` import neither Zod nor `jsonc-parser`.
