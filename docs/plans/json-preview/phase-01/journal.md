<!-- refract-shared-version: 3.0.1 -->

# Phase 1 Journal: JSON document core, setting, and detection

<!-- Created by the worker per worker-contract.md. Append every block; keep earlier sections. -->

## META

- Plan: docs/plans/json-preview/PLAN.md
- Implementation Profile: balanced
- Consultation Profile: n/a
- Review Profile: balanced
- Implementation Job: ead5be8d-cca6-4e7c-8e97-0d590b13616f
- Review Job: bce9645d-7fc4-4fff-bf93-8a47141041cc (retry of d07c5b50-b993-4b5d-ace3-5906eca7abce, which failed transiently with no output)
- Started: 2026-11-11
- Finished: 2026-11-11T18:11:37+07:00

## Implementation Response

<!-- Worker appends each full `# EXTERNAL RESPONSE` block here without overwriting prior blocks. -->

# EXTERNAL RESPONSE
## META
- Phase 1 / Started 2026-11-11 / Finished 2026-11-11T18:11:37+07:00 / Plan dir docs/plans/json-preview
## SUMMARY
Added the JSON document core (`doc-kind.ts`, `json-document.ts`), the `renderJson` setting with its General toggle, and flag-gated JSON detection in the content script and background.
## FILES MODIFIED
| Action | Path | Change |
|---|---|---|
| modify | package.json | add `jsonc-parser` 3.3.1, exact pin |
| modify | pnpm-lock.yaml | lockfile result of the install |
| create | src/lib/doc-kind.ts | `DocKind`, `docKindFromName`, `isJsonName` |
| create | src/lib/json-document.ts | `prepareJson` with lazy `jsonc-parser` import |
| create | tests/unit/json-document.test.ts | coverage for both new modules |
| modify | src/lib/settings-flags.ts | `renderJson` flag |
| modify | src/lib/settings.ts | `renderJson` type, default, schema |
| modify | src/ui/settings/general-tab.tsx | toggle and key union |
| modify | src/i18n/en-US.ts | label and description strings |
| modify | src/entrypoints/detect.content.ts | JSON redirect rule and `matches` |
| modify | src/entrypoints/background.ts | `renderJson` in `isMarkdownLink` and `isValidCapture` |
| modify | tests/unit/settings-flags.test.ts | `renderJson` default and fallback |
| modify | tests/unit/settings.test.ts | `renderJson` default and fallback |
| modify | tests/unit/detect.test.ts | JSON redirect cases |
| modify | tests/unit/background.test.ts | JSON link, capture, and context menu cases |
| modify | docs/plans/json-preview/phase-01/notes.md | Task 1 to 3 blocks and final checks |
| modify | docs/plans/json-preview/phase-01/journal.md | META finish time and this response |
## NOTES
- phase-01/notes.md  (## Task 1, ## Task 2, ## Task 3, ## Final checks)
- Fresh checks: `pnpm typecheck` exit 0; `pnpm lint` exit 0 with 208 warnings and 3 infos; `pnpm test` 45 files, 562 tests passed.
## SPEC COMPLIANCE
- Meets Spec? YES
## CLARIFICATIONS NEEDED
None
## NEXT
TASK_COMPLETE

## Quality Review

Reviewer target `cc/claude-opus-medium`, range `refs/plans/json-preview/phase-01/base..HEAD`.

# CODE QUALITY REVIEW
- Status: PASS_WITH_DEBT
- Findings:
  - Low, non-blocking, `src/entrypoints/background.ts:36`: the context menu always passes `renderJson` as `true`, as PLAN.md task 3 requires. Phase 1 adds no JSON rendering, so on this branch a `.json` link opened from the context menu renders through the Markdown path. Output still passes through `sanitize()`, so this is not a security issue. Resolved when Phase 3 lands `JsonView`.
  - Info, non-blocking, `src/entrypoints/background.ts:38`: the badge title still reads "this link is not a supported Markdown URL" although JSON links are now accepted.
  - Checklist items 1 to 7 all met; every acceptance criterion appears in the new or updated tests.
- Scope checked: the full Phase 1 delta. Working tree left unchanged.

## Review Result

- Spec Status: PASS. Every declared path was touched and no other; every acceptance criterion maps to a test.
- Quality Status: PASS_WITH_DEBT
- Debt:
  - Context-menu JSON links render through the Markdown path until `JsonView` lands. Owner: Coordinator, confirmed at the final audit after Phase 3.
  - Badge title still names Markdown only. Owner: Phase 5, which already edits `src/i18n/en-US.ts`.

## Verification Evidence

Run fresh at checkpoint `ceb9188`, one at a time:

- `pnpm typecheck` -> exit 0.
- `pnpm lint` -> exit 0, 0 errors, 208 warnings, 3 infos. Equal to the `c9c2800` baseline.
- `pnpm test` -> 45 files, 562 tests passed. Baseline was 44 files, 543 tests.

Coordinator-checked invariants: `jsonc-parser` pinned to `3.3.1`; no static import of it anywhere in `src/` or `tests/`; `src/lib/doc-kind.ts` has zero imports; `settings-flags.ts`, `detect.content.ts`, and `background.ts` contain no reference to Zod or `jsonc-parser`.

## Final Checkpoint

- Phase base ref: refs/plans/json-preview/phase-01/base
- Phase implementation ref: refs/plans/json-preview/phase-01/impl
- Plan commit ref: pending
- State checkpoint: temporary commit
