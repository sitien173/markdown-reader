<!-- refract-shared-version: 3.0.1 -->

# Phase 2 Journal: Reader state, loading, and read-only rules

<!-- Created by the worker per worker-contract.md. Append every block; keep earlier sections. -->

## META

- Plan: docs/plans/json-preview/PLAN.md
- Implementation Profile: google
- Consultation Profile: n/a
- Review Profile: balanced
- Implementation Job: pending
- Review Job: pending
- Started: 2026-11-11
- Finished: 2026-11-11

## Implementation Response

<!-- Worker appends each full `# EXTERNAL RESPONSE` block here without overwriting prior blocks. -->

# EXTERNAL RESPONSE
## META
- Phase: 2
- Started: 2026-11-11T18:45:00+07:00
- Finished: 2026-11-11T18:55:00+07:00
- Plan dir: docs/plans/json-preview
## SUMMARY
Implemented reader state `docKind`, read-only controller invariants, command availability rules, JSON file/link discovery across picker, drop, directory, file URL tree, and links, and hidden outline tab in reader sidebar for JSON documents.
## FILES MODIFIED
| Action | Path | Change |
| --- | --- | --- |
| update | src/store/reader-store.ts | Added `docKind` field to `ReaderState` and clamped `mode` in `initialState` |
| update | src/reader/controller.ts | Set `docKind` on all load paths; enforced read-only rules and bypassed draft saver for non-markdown |
| update | src/reader/commands.ts | Added `docKind` to `CommandState`; disabled edit, split, raw, and export-html for non-markdown |
| update | src/source/file-handle.ts | Accepted JSON in picker types and file drop validation |
| update | src/source/directory.ts | Included `.json` / `.jsonc` in tree building and link resolution |
| update | src/source/file-url-tree.ts | Preserved `.json` / `.jsonc` entries in file tree building |
| update | src/render/links.ts | Marked relative JSON / JSONC links with `data-md-link` |
| update | src/entrypoints/reader/App.tsx | Hid Outline tab in `Sidebar` when `docKind !== 'markdown'` and defaulted to Files panel |
| update | src/ui/reader-menu.tsx | Selected `docKind` in `ReaderMenu` command state slice |
| update | src/ui/command-palette.tsx | Selected `docKind` in `CommandPalette` command state slice |
| update | tests/unit/reader-store.test.ts | Added test coverage for `docKind` derivation and mode clamping |
| update | tests/unit/controller.test.ts | Added test coverage for `docKind` updates, read-only guards, and draft saver bypass |
| update | tests/unit/commands.test.ts | Added test coverage for JSON command availability table |
| update | tests/unit/file-handle.test.ts | Added test coverage for JSON file handle and drop acceptance |
| update | tests/unit/directory.test.ts | Added test coverage for directory tree filtering and link resolution with JSON |
| update | tests/unit/file-url-tree.test.ts | Added test coverage for file URL tree filtering with JSON |
| update | tests/unit/links.test.ts | Added test coverage for `data-md-link` on JSON links |
| update | tests/unit/reader-app.test.tsx | Added test coverage for Outline tab hiding for JSON documents |
| update | docs/plans/json-preview/phase-02/notes.md | Recorded decisions, scope, and RED->GREEN test evidence for Tasks 1-4 |
| update | docs/plans/json-preview/phase-02/journal.md | Updated META and appended external response block |
## NOTES
- docs/plans/json-preview/phase-02/notes.md (## Task 1, ## Task 2, ## Task 3, ## Task 4; pnpm typecheck passed; pnpm lint passed with 0 errors, 208 warnings, 3 infos; pnpm test passed with 45 files, 579 passed)
## SPEC COMPLIANCE
- Meets Spec? YES: all 4 tasks implemented with behavioral RED->GREEN test evidence, no edits to json-document.ts, and all Done-When verifications clean.
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

- Phase base ref: refs/plans/json-preview/phase-02/base
- Phase implementation ref: refs/plans/json-preview/phase-02/impl
- Plan commit ref: pending
- State checkpoint: temporary commit
