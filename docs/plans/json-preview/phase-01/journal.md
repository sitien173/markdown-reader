<!-- refract-shared-version: 3.0.1 -->

# Phase 1 Journal: JSON document core, setting, and detection

<!-- Created by the worker per worker-contract.md. Append every block; keep earlier sections. -->

## META

- Plan: docs/plans/json-preview/PLAN.md
- Implementation Profile: balanced
- Consultation Profile: n/a
- Review Profile: balanced
- Implementation Job: pending
- Review Job: pending
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

<!-- Coordinator appends the independent review response here. -->

## Review Result

- Spec Status: PENDING
- Quality Status: PENDING
- Debt: none

## Final Checkpoint

- Phase base ref: refs/plans/json-preview/phase-01/base
- Phase implementation ref: refs/plans/json-preview/phase-01/impl
- Plan commit ref: pending
- State checkpoint: temporary commit
