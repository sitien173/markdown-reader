<!-- refract-shared-version: 3.0.1 -->

# Phase 3 Journal: JsonView rendering, error banner, and end-to-end coverage

<!-- Created by the worker per worker-contract.md. Append every block; keep earlier sections. -->

## META

- Plan: docs/plans/json-preview/PLAN.md
- Implementation Profile: balanced
- Consultation Profile: n/a
- Review Profile: balanced
- Implementation Job: pending
- Review Job: pending
- Started: 2026-11-11T19:38:35+07:00
- Finished: 2026-11-11T20:20:00+07:00

## Implementation Response

# EXTERNAL RESPONSE
## META
- Phase: 3
- Started: 2026-11-11T19:38:35+07:00
- Finished: 2026-11-11T20:20:00+07:00
- Plan dir: docs/plans/json-preview
## SUMMARY
Implemented JsonView rendering for JSON/JSONC documents, parse error banner with line and column reporting, store and app integration, comprehensive unit tests, and full end-to-end Chromium test coverage.
## FILES MODIFIED
| Action | Path | Change |
| Create | src/ui/json-view.tsx | JsonView component with prepareJson, enhance, error reporting, and MarkdownViewHandle |
| Modify | src/render/highlight.ts | Added jsonc language registration in loadLanguage and supported set |
| Modify | src/store/reader-store.ts | Added parseError to ReaderState, initialState, and jsonError banner to selectBanners |
| Modify | src/ui/status-banner.tsx | Rendered jsonError banner with message and line/column without retry or dismiss |
| Modify | src/entrypoints/reader/App.tsx | Rendered JsonView for JSON kinds, wired onParseError, Banners selectors, and Loading spinner |
| Create | tests/unit/json-view.test.tsx | Unit tests for highlighting, JsonView rendering, formatting, error reporting, and abort |
| Modify | tests/unit/reader-store.test.ts | Unit tests for parseError default and selectBanners ordering |
| Modify | tests/unit/reader-render.test.tsx | Unit tests for status banner rendering and App wiring |
| Create | tests/e2e/json-preview.spec.ts | End-to-end test suite for JSON preview in Chromium |
| Modify | docs/plans/json-preview/phase-03/notes.md | Phase 3 task decision notes and verification evidence |
| Modify | docs/plans/json-preview/phase-03/journal.md | Appended external response block |
## NOTES
- phase-03/notes.md (## Task 1, ## Task 2, ## Task 3, ## Task 4, ## Task 5, ## Final checks)
## SPEC COMPLIANCE
- Meets Spec? YES: Every acceptance criterion passes with behavioral RED->GREEN evidence and clean verification checks.
## CLARIFICATIONS NEEDED
None
## NEXT
TASK_COMPLETE

## Quality Review

Reviewer target `cc/claude-opus-medium`, range `refs/plans/json-preview/phase-03/base..952709e`. Job `dacd49c4-06ea-4809-8d78-040729792a32`; the first submit on `codex/terra-high` failed transiently, as on every earlier phase.

The review returned FAIL on one blocking finding and three weak-test findings.

The blocking finding confirmed a stale banner the Coordinator had raised independently. `JsonView` is the only writer of `parseError`, reporting `null` only on a successful parse, and its unmount cleanup only bumped the generation and aborted. `src/reader/controller.ts` never resets the field: `load`, `openFileHandle`, and the directory path reset `error` and `headings` only. Every way of leaving a JSON document unmounts `JsonView`, so opening an invalid `.json` and then any Markdown document left a parse-error banner with no Dismiss button over unrelated content.

The three non-blocking findings were all tests that passed regardless of the behavior they claimed to prove: an `innerHTML` emptiness check that `root.unmount()` satisfies on its own, leaving the abort untested; a banner-ordering test that never asserted the document text and ran under `docKind: 'markdown'`; and a redirect-off end-to-end check gated only on a fixed one-second wait.

### Review Fix Cycle 1

Fixed in `6306674`, by the Coordinator rather than a worker, since the review specified each change precisely.

| Finding | Fix |
| --- | --- |
| Blocking, stale banner | `JsonView` unmount cleanup calls `onParseErrorRef.current(null)` |
| Untested abort | New test spies on `enhance`, captures the `AbortSignal`, and asserts `aborted` after unmount |
| Banner ordering | Added an assertion that the document still shows the source text |
| Redirect timing | Added `waitForLoadState('networkidle')` and a payload assertion |

The reviewer's gating alternative, `isJson ? parseError : null` in `Banners`, was rejected as recommended: it hides the symptom and leaves stale state in the store.

Two reviewer suggestions were adapted rather than taken literally. The banner-ordering test keeps `docKind: 'markdown'` with an injected `parseError`, because switching it to `'json'` would let the real `JsonView` overwrite the injected error asynchronously and make the exact message assertion racy. The JSON path it would have covered is instead exercised by the new stale-banner regression test, which uses `vi.waitFor` and is therefore timing-safe.

Each fix was verified by mutation. Reverting the `onParseError(null)` line fails both `proves unmount aborts so a late result writes nothing` and `clears parseError when the reader leaves a JSON document so no stale banner survives`. Removing `abortRef.current?.abort()` fails `proves unmount aborts the enhance signal`.

## Review Result

- Spec Status: PASS. All four acceptance criteria hold. `JsonView` renders `.json` and `.jsonc` through `textContent` plus the sanitized `enhance()` path with no `innerHTML` from document text, produces no heading or TOC data, and guards stale results against both the DOM write and `onParseError`. `src/ui/markdown-view.tsx` is untouched.
- Quality Status: PASS, after one fix cycle.
- Debt:
  - The 8 `tests/e2e/settings-layout.spec.ts` screenshot comparisons fail locally. `AGENTS.md` documents these as rendered on the `CI E2E` runner and divergent on local system fonts. This phase touched no settings UI, and the failures predate it. Owner: the `CI E2E` run on the pull request, which is the authority for these snapshots.
  - `PLAN.md` Phase 3 task 3 words the requirement as `parseError` being "cleared on every load", which would live in `src/reader/controller.ts`. The unmount cleanup covers every observable path for this phase, so the controller was left alone rather than expanding the phase file set. Owner: Phase 5, to confirm the toolbar and download paths need no controller-side reset.

## Verification Evidence

Run fresh at `6306674`, one at a time:

- `pnpm typecheck` -> exit 0.
- `pnpm lint` -> exit 0, 0 errors, 208 warnings, 3 infos. Equal to the `c9c2800` baseline.
- `pnpm test` -> 46 files, 624 tests passed. Phase 4 left 609.
- `pnpm test:e2e` -> 189 passed, 8 failed, all 8 being the `settings-layout.spec.ts` snapshots recorded as debt above. All `json-preview.spec.ts` tests passed.

## Final Checkpoint

- Phase base ref: refs/plans/json-preview/phase-03/base
- Phase implementation ref: refs/plans/json-preview/phase-03/impl -> 6306674
- Plan commit ref: pending
- State checkpoint: temporary commits 952709e and 6306674
