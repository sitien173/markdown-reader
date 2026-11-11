# Phase 4: Pure JSON view transforms

## Goal & Outcome

- Plan Goal: open standalone `.json` and `.jsonc` documents in the reader as highlighted, read-only text, with opt-in automatic redirect and view tools.
- Phase Outcome: `transformJson` produces every toolbar view from source text, with number text, string escapes, and duplicate keys byte-exact. No UI exists yet; Phase 5 wires these functions to a toolbar.

## Context & Architecture

- Code root: `WORKTREE_PATH` | Records root: `/home/ngosi/projects/markdown-reader` | Branch: `refract/json-preview/phase-04` | Base: `refs/plans/json-preview/phase-04/base`
- Prior State: Phase 1 is complete and merged into your base. It added:
  - `src/lib/doc-kind.ts`, zero imports, exporting `type DocKind = 'markdown' | 'json' | 'jsonc'`, `docKindFromName`, and `isJsonName`.
  - `src/lib/json-document.ts`, which exports async `prepareJson(text, kind): Promise<{ text: string; error: { message: string; line: number; column: number } | null }>`. It lazy-imports `jsonc-parser` inside the function body with `const { parse, printParseErrorCode, format, applyEdits } = await import('jsonc-parser')`, references the error type as the inline type-only `import('jsonc-parser').ParseError`, strips a leading U+FEFF, and formats with 2-space indentation only when the trimmed text has no line break and parsing succeeded.
  - `tests/unit/json-document.test.ts` with 12 passing tests covering `docKindFromName` and `prepareJson`.
  - `jsonc-parser` pinned to exactly `3.3.1` in `package.json`.
- Code Context: `jsonc-parser` 3.3.1 exports `createScanner`, `SyntaxKind`, `parseTree`, `Node`, `format`, `applyEdits`, `parse`, `printParseErrorCode`, and `ParseError`. Read its typings in `node_modules/jsonc-parser/lib/umd/main.d.ts` before designing the scanner and `parseTree` passes.

## Invariants & Boundaries

- Preserve:
  - `src/lib/json-document.ts` stays pure. It performs no I/O, reads no storage, and touches no DOM.
  - It remains the only module in the repository that imports `jsonc-parser`, and only through dynamic `import()`.
  - `prepareJson` keeps its exact current behavior and signature. Every existing test in `tests/unit/json-document.test.ts` must keep passing unmodified.
  - Number text, string escapes, and duplicate keys stay byte-exact through every transform. Do not round-trip values through `JSON.parse` or `JSON.stringify`, except `JSON.stringify` of the final string in escape.
- Out of Scope:
  - Every UI, store, controller, and rendering change. Create no component and import nothing from `src/ui/`, `src/render/`, `src/store/`, or `src/reader/`.
  - Any file other than the two listed below. Another phase is editing reader, store, source, and UI files in parallel; touching them will cause a merge conflict.
  - Do not read or edit `.env` or any credential file.

## Files

Allowed production and test paths:

- `src/lib/json-document.ts` (modify: add the transform pipeline alongside the existing `prepareJson`)
- `tests/unit/json-document.test.ts` (modify: append transform coverage, leaving the existing cases unchanged)

Worker-owned phase records, written to the records root by absolute path:

- `/home/ngosi/projects/markdown-reader/docs/plans/json-preview/phase-04/notes.md` (append `## Task <M>` blocks)
- `/home/ngosi/projects/markdown-reader/docs/plans/json-preview/phase-04/journal.md` (append `# EXTERNAL RESPONSE` under `## Implementation Response`)

Read-only / Forbidden:

- Do not edit `PLAN.md`, `DESIGN.md`, `.handover.md`, `prompt.md`, any other phase directory, `package.json`, `pnpm-lock.yaml`, or any path not listed above.

## Tasks

- task-1: TDD the types and the layout stage. Export `type JsonLayout = 'original' | 'beautify' | 'minify'`, `type JsonIndent = 2 | 4 | 'tab'`, `type JsonViewOptions = { layout: JsonLayout; indent: JsonIndent; sortKeys: boolean; stripComments: boolean; escape: boolean }`, and async `transformJson(source: string, kind: 'json' | 'jsonc', options: JsonViewOptions): Promise<{ text: string; hasComments: boolean }>`. The pipeline order is strip comments, then sort keys, then layout, then escape. `sortKeys` forces `stripComments`. Beautify uses `format` and `applyEdits` over the whole text with `insertSpaces` and `tabSize` derived from `indent`, and keeps comments. Minify emits scanner tokens with no trivia and no comments, and keeps trailing commas unless Strip comments removed them.
- task-2: TDD the strip and sort stages. Strip removes comment tokens and trailing commas using the scanner. Sort rebuilds objects from `parseTree` node slices of the source, ordering keys by code unit comparison with a stable sort so duplicate keys keep their relative order, recursing through both arrays and objects.
- task-3: TDD escape and unescape. Escape returns `JSON.stringify(text)`. Export async `unescapeJson(source: string, kind: 'json' | 'jsonc'): Promise<{ text: string; parses: boolean } | null>` that returns `null` unless the source parses with no error and its root node is a string, and otherwise returns the decoded value together with whether that decoded value parses as strict JSON.

## Done When

- `tests/unit/json-document.test.ts` proves: each indent value; minify of formatted JSON and of JSONC carrying both line and block comments; strip removes comments and trailing commas; sort keys recursively with duplicate keys in relative order; sort implies strip; `12345678901234567890`, `1.0e+2`, `-0`, and `é` escapes byte-exact through every transform; the pipeline order under sort plus minify plus escape together; an escape then unescape round trip; `unescapeJson` returns `null` for an object root and `parses: false` for a decoded non-JSON string; and `hasComments` is true only while comments remain in the output.
- Sort output for an object that contained comments contains no comments.
- Run from the code root, one at a time, never concurrently:
  - `pnpm typecheck` (Baseline: pass)
  - `pnpm lint` (Baseline: pass, 0 errors, 208 warnings, 3 infos. Leave the warning count no higher than you found it.)
  - `pnpm test` (Baseline: pass, 45 files, 562 tests. Expect your new tests to raise the test count.)

## Rules

Read and follow these bundled contracts:

- Contract: `/home/ngosi/projects/refract/plugin/shared/worker-contract.md`
- Response: `/home/ngosi/projects/refract/plugin/shared/erp.md`
- Notes: `/home/ngosi/projects/refract/plugin/shared/notes-template.md`
- Journal: `/home/ngosi/projects/refract/plugin/shared/journal-template.md`

Project conventions live in `CODING_STANDARDS.md` and `AGENTS.md` at the code root. Read both before writing code.

Role boundary: You are the phase implementer, not Coordinator. Edit code only inside the code root. Write phase records only under the records root path given above. Make no Git commit, no branch change, and no Refract job submission. Leave all Git operations to the Coordinator.

## Response Format

Append the complete `# EXTERNAL RESPONSE` block to `/home/ngosi/projects/markdown-reader/docs/plans/json-preview/phase-04/journal.md`, then return that block and the matching status line from `erp.md`.
