<!-- refract-shared-version: 3.0.1 -->

# Phase 4 Decision Notes

<!-- Created by the worker per worker-contract.md. Append one `## Task <M>` block per task. -->

## Task 1

### Decisions made
- Added inert `transformJson` stub (returns source unchanged) so RED fails on assertions, then implemented layout.
- Local numeric constants replace `SyntaxKind`, which is a const enum and cannot be read through a dynamic import.
- `hasComments` is computed by scanning the final output, so comments inside string literals and escaped output report false.
- A leading U+FEFF is stripped, matching `prepareJson`.

### Spec deviations
- none

### Tradeoffs accepted
- none

### Assumptions
- `kind` is accepted but unused by `transformJson`; the pipeline handles both kinds with the same JSONC-tolerant scanner.

### Follow-ups for human
- none

### Test evidence
- RED -> GREEN:
  - RED: `pnpm vitest run tests/unit/json-document.test.ts` -> 4 failed, 14 passed; e.g. `expected '{"a":{"b":1}}' to be '{\n  "a": {\n    "b": 1\n  }\n}'`
  - GREEN: `pnpm vitest run tests/unit/json-document.test.ts` -> 18 passed
- Root cause (bugfix only): none

## Task 2

### Decisions made
- Strip tokenizes with the scanner, drops comment tokens, and drops a comma whose next non-trivia token is `}` or `]`.
- Sort uses `parseTree` slices of the already stripped text and `Array.prototype.sort` (stable) on decoded key names with `<`/`>` (code unit order). Sort is skipped when the tree has parse errors.

### Spec deviations
- none

### Tradeoffs accepted
- Sort emits compact text. When `sortKeys` is on and layout is `original`, the result is beautified with `options.indent`, because original whitespace cannot be kept. The prompt leaves this case open.
- Stripping a line comment leaves the whitespace before it.

### Assumptions
- none

### Follow-ups for human
- Phase 5 may want `original` plus `sortKeys` to be surfaced as beautified in the UI.

### Test evidence
- RED -> GREEN:
  - RED: `pnpm vitest run tests/unit/json-document.test.ts` -> 5 failed, 19 passed; e.g. `expected '{"b":0,"a":1,"b":9,"a":2}' to be '{"a":1,"a":2,"b":0,"b":9}'`
  - GREEN: `pnpm vitest run tests/unit/json-document.test.ts` -> 24 passed
- Root cause (bugfix only): none

## Task 3

### Decisions made
- Escape is `JSON.stringify(text)` on the final text. `unescapeJson` uses `parseTree` with `disallowComments` for json and `allowTrailingComma` for jsonc, and returns null on any error or non-string root.
- Added inert `unescapeJson` stub returning null for RED.

### Spec deviations
- none

### Tradeoffs accepted
- none

### Assumptions
- none

### Follow-ups for human
- Environment: `pnpm typecheck` generates `.wxt/`; an earlier run via the `rtk` wrapper failed and `tsc` left 163 untracked `.js` files in the worktree. I confirmed all were untracked, newly created `.js` files and deleted them. `git status` now shows only the two allowed files.

### Test evidence
- RED -> GREEN:
  - RED: `pnpm vitest run tests/unit/json-document.test.ts` -> 5 failed, 25 passed; e.g. `expected null to deeply equal { text: 'not json', parses: false }`
  - GREEN: `pnpm vitest run tests/unit/json-document.test.ts` -> 30 passed
- Final checks, run one at a time from the code root:
  - `pnpm typecheck` -> pass
  - `pnpm lint` -> exit 0, 208 warnings, 3 infos (baseline)
  - `pnpm test` -> 45 files, 580 passed (baseline 562)
- Root cause (bugfix only): none

## Review fixes

Review cycle 1, PASS_WITH_DEBT, seven findings. All edits are in `src/lib/json-document.ts` and `tests/unit/json-document.test.ts`. `prepareJson` and the 12 pre-existing tests are unchanged.

1. Medium, pipeline order: added `runs layout before escape` (beautify plus escape equals `JSON.stringify` of the beautified text) and `runs layout after sort` (sortKeys plus beautify gives indented output). The existing order test is kept.
2. Low, sort plus original: the test now asserts the exact output `'{\n  "a": 2,\n  "b": 1\n}'`, and `'{\n    "a": 2,\n    "b": 1\n}'` at indent 4.
3. Low, line endings: `transformJson` normalizes `\r\n?` to `\n` after the BOM strip, so every view outputs LF. `eol: '\n'` stays and is a no-op for text with a line break. New test covers CRLF and lone CR across original, beautify, minify, sort, and sort plus beautify.
4. Low, strip: a `Trivia` token directly before a removed comment is dropped. `'{\n  /* block */ "a": 1, // line\n'` now strips to `'{\n "a": 1,\n'`. Test asserts the exact output.
5. Low, `parses`: `unescapeJson` now strips the BOM and uses `parseTree` with `disallowComments: true`, requiring a root and no errors. A BOM test is added.
   - Deviation from the finding: `jsonc-parser` 3.3.1 does not treat NBSP, `\v`, or `\f` as whitespace. Its `isWhiteSpace` accepts only space and tab, and `parseTree` reports `InvalidSymbol` for them. `JSON.parse` and the pipeline therefore already agreed on those characters. Only the BOM mismatch was real. The NBSP test asserts `parses: false` and that `prepareJson` also reports an error.
6. Info, constants: added `EOF = 17` and `LINE_BREAK = 14`. The three bare `17` literals are replaced. The trivia range check is replaced by explicit `isComment` and `isTrivia` helpers listing the kinds. Lookahead behavior is unchanged because the range already included `LINE_BREAK`.
7. Info, docs: the `transformJson` doc comment now states that LF is enforced, that the source must already parse, that `sortKeys` silently returns its input unchanged on a parse error, and that `kind` is reserved and unused.

### Record only: deep nesting
Very deep nesting raises `RangeError` from both `prepareJson` and `transformJson`, because `jsonc-parser` and the rebuild recursion both recurse. This predates Phase 4. No code change. Phase 5 must catch a rejected promise from either function and show the parse-error banner.

### Test evidence
- RED against the previous source: 3 failed (strip trivia, CRLF, BOM), 33 passed. The order, sort-original, and NBSP tests pin existing behavior and pass on both versions.
- GREEN: `pnpm vitest run tests/unit/json-document.test.ts` -> 36 passed.
- Final checks, run one at a time from the repository root:
  - `pnpm typecheck` -> pass
  - `pnpm lint` -> exit 0, 208 warnings, 3 infos
  - `pnpm test` -> 45 files, 608 passed (previously 602)
