# Phase 1: JSON document core, setting, and detection

## Goal & Outcome

- Plan Goal: open standalone `.json` and `.jsonc` documents in the reader as highlighted, read-only text, with opt-in automatic redirect and view tools.
- Phase Outcome: JSON documents can be classified, parsed, formatted, and redirected. No reader UI changes in this phase beyond one General settings toggle.

## Context & Architecture

- Code root: `/home/ngosi/projects/markdown-reader` | Records root: `/home/ngosi/projects/markdown-reader` | Branch: `feat/json-preview` | Base: `refs/plans/json-preview/base`
- Prior State: baseline at `c9c2800`. `pnpm typecheck` passes. `pnpm lint` passes with 0 errors, 208 warnings, 3 infos. `pnpm test` passes with 44 files and 543 tests. No phase of this plan has run.
- Code Context:
  - `src/lib/settings-flags.ts` is deliberately Zod-free. It exports `SETTINGS_KEY = 'settings:v1'`, `type GeneralFlags = { enabled: boolean; renderTxt: boolean; charsetCompat: boolean }`, a private `flag(value, fallback)` coercer, and `readGeneralFlags(): Promise<GeneralFlags>` reading `browser.storage.local`.
  - `src/lib/settings.ts` holds the `Settings` type, `defaultSettings`, and a Zod schema using the pattern `renderTxt: z.catch(z.boolean(), defaultSettings.general.renderTxt)`.
  - `src/ui/settings/general-tab.tsx` has a `toggle(key)` helper driven by a union of general boolean keys; `{toggle('renderTxt')}` sits at line 225 and the key union at line 133.
  - `src/i18n/en-US.ts` has `renderTxt: 'Render .txt as Markdown'` and `renderTxtDescription: 'Also redirect plain text files that end in .txt.'`.
  - `src/entrypoints/detect.content.ts` exports `shouldRedirectMarkdown(contentType, pathname, flags: Pick<GeneralFlags, 'enabled' | 'renderTxt'>)` and a `defineContentScript` whose `matches` is `['*://*/*.md', '*://*/*.markdown', '*://*/*.txt', 'file:///*.md', 'file:///*.markdown', 'file:///*.txt']`.
  - `src/entrypoints/background.ts` exports `isMarkdownLink(raw, renderTxt = false)` and `isValidCapture(message, sender, runtimeId, renderTxt = false)`. Both are called with `(await readGeneralFlags()).renderTxt`. A context-menu path also calls `isMarkdownLink`.

## Invariants & Boundaries

- Preserve:
  - `src/lib/doc-kind.ts` has no imports at all.
  - `src/lib/json-document.ts` performs no I/O and is the only module that imports `jsonc-parser`, by dynamic `import()` only.
  - `src/lib/settings-flags.ts`, `src/entrypoints/detect.content.ts`, and `src/entrypoints/background.ts` import neither Zod nor `jsonc-parser`. Their only new import may be `src/lib/doc-kind.ts`.
  - Markdown and `.txt` redirect results stay identical for every existing test input.
  - Stored settings without `general.renderJson` parse unchanged; the flag defaults to `false`.
  - The source file is never written. Formatting is whitespace-only and runs only on successfully parsed, single-line input.
- Out of Scope: any store, controller, reader UI, rendering, or toolbar change. Those are Phases 2 to 5. Do not read or edit `.env` or any credential file.

## Files

Allowed production and test paths:

- `package.json` (modify: add the `jsonc-parser` dependency pinned to exactly `3.3.1`)
- `pnpm-lock.yaml` (modify: lockfile result of the install)
- `src/lib/doc-kind.ts` (create: dependency-free document-kind helpers)
- `src/lib/json-document.ts` (create: pure JSON parse and format helpers)
- `tests/unit/json-document.test.ts` (create: unit coverage for both new modules)
- `src/lib/settings-flags.ts` (modify: add `renderJson` to `GeneralFlags` and `readGeneralFlags`)
- `src/lib/settings.ts` (modify: add `renderJson` to `Settings`, `defaultSettings`, and the schema)
- `src/ui/settings/general-tab.tsx` (modify: add the toggle next to `renderTxt`)
- `src/i18n/en-US.ts` (modify: add the label and description strings)
- `src/entrypoints/detect.content.ts` (modify: redirect rule and `matches`)
- `src/entrypoints/background.ts` (modify: accept JSON extensions behind the flag)
- `tests/unit/settings-flags.test.ts` (modify)
- `tests/unit/settings.test.ts` (modify)
- `tests/unit/detect.test.ts` (modify)
- `tests/unit/background.test.ts` (modify)

Worker-owned phase records:

- `/home/ngosi/projects/markdown-reader/docs/plans/json-preview/phase-01/notes.md` (append `## Task <M>` blocks)
- `/home/ngosi/projects/markdown-reader/docs/plans/json-preview/phase-01/journal.md` (append `# EXTERNAL RESPONSE` under `## Implementation Response`)

Read-only / Forbidden:

- Do not edit `PLAN.md`, `DESIGN.md`, `.handover.md`, `prompt.md`, other phase directories, or any path not listed above.

## Tasks

- task-1: Run `pnpm add jsonc-parser@3.3.1` and confirm `package.json` pins the exact version with no range prefix. Then TDD `src/lib/doc-kind.ts` exporting `type DocKind = 'markdown' | 'json' | 'jsonc'`, `docKindFromName(name: string): DocKind` matching `/\.jsonc$/i` first and then `/\.json$/i` against the name or URL pathname and returning `'markdown'` otherwise, and `isJsonName(name: string): boolean`. Then TDD `src/lib/json-document.ts` exporting async `prepareJson(text: string, kind: 'json' | 'jsonc'): Promise<{ text: string; error: { message: string; line: number; column: number } | null }>` that lazy-imports `jsonc-parser` inside the function body, strips a leading U+FEFF, parses with `disallowComments` and `allowTrailingComma` derived from `kind`, returns the first error with 1-based `line` and `column` alongside the original text, returns the error message `Empty document` for whitespace-only input, and applies `format` plus `applyEdits` with 2-space indentation only when the trimmed text contains no line break and parsing succeeded.
- task-2: TDD the setting. Add `renderJson: boolean` defaulting to `false` to `GeneralFlags` and `readGeneralFlags` in `src/lib/settings-flags.ts`, and to `Settings`, `defaultSettings`, and the Zod schema in `src/lib/settings.ts` using the same `z.catch` fallback pattern as `renderTxt`. Add the toggle next to "Render .txt as Markdown" in `src/ui/settings/general-tab.tsx`, including the key union, with `renderJson` and `renderJsonDescription` strings in `src/i18n/en-US.ts`. The label is "Preview .json files".
- task-3: TDD detection. `shouldRedirectMarkdown` accepts `renderJson` in its flags and returns `true` for a `.json` or `.jsonc` pathname when `enabled` and `renderJson` are both on and the content type is `application/json`, `text/json`, `text/plain`, the empty string, or ends with `+json`. Add `*://*/*.json`, `*://*/*.jsonc`, `file:///*.json`, and `file:///*.jsonc` to `matches`. `isMarkdownLink` and `isValidCapture` in `src/entrypoints/background.ts` take `renderJson` and accept those extensions only when it is `true`; the capture listener passes the stored flag. The context menu accepts `.json` and `.jsonc` links regardless of the flag.

## Done When

- `tests/unit/json-document.test.ts` proves: kind derivation for `.json`, `.JSON`, `.jsonc`, a URL with a query string, and `.md`; minified input reformatted; already formatted input returned byte-identical; `12345678901234567890`, key order, duplicate keys, `é` escapes, and JSONC comments preserved; a leading BOM stripped; the empty-input error; error line and column for a missing comma; trailing commas and comments accepted for `jsonc` and rejected for `json`.
- `tests/unit/settings-flags.test.ts` and `tests/unit/settings.test.ts` prove the `false` default and the fallback from a non-boolean stored value.
- `tests/unit/detect.test.ts` and `tests/unit/background.test.ts` prove the flag on and off, each accepted MIME type, `text/html` rejected, and unchanged Markdown and `.txt` results.
- `jsonc-parser` is pinned to exactly `3.3.1` and reached only through dynamic `import()` inside `src/lib/json-document.ts`.
- Run from `/home/ngosi/projects/markdown-reader`, one at a time, never concurrently:
  - `pnpm typecheck` (Baseline: pass)
  - `pnpm lint` (Baseline: pass, 0 errors, 208 warnings, 3 infos. Leave the warning count no higher than you found it.)
  - `pnpm test` (Baseline: pass, 44 files, 543 tests. Expect the new tests to raise both counts.)

## Rules

Read and follow these bundled contracts:

- Contract: `/home/ngosi/projects/refract/plugin/shared/worker-contract.md`
- Response: `/home/ngosi/projects/refract/plugin/shared/erp.md`
- Notes: `/home/ngosi/projects/refract/plugin/shared/notes-template.md`
- Journal: `/home/ngosi/projects/refract/plugin/shared/journal-template.md`

Project conventions live in `/home/ngosi/projects/markdown-reader/CODING_STANDARDS.md` and `/home/ngosi/projects/markdown-reader/AGENTS.md`. Read both before writing code. `browser`, `defineBackground`, and `defineContentScript` are auto-imported by WXT; do not import them.

Role boundary: You are the phase implementer, not Coordinator. Edit code only in `/home/ngosi/projects/markdown-reader`; write phase records only under `/home/ngosi/projects/markdown-reader/docs/plans/json-preview/phase-01/`. Make no Git commit, no branch change, and no Refract job submission. Leave all Git operations to the Coordinator.

## Response Format

Append the complete `# EXTERNAL RESPONSE` block to `/home/ngosi/projects/markdown-reader/docs/plans/json-preview/phase-01/journal.md`, then return that block and the matching status line from `erp.md`.
