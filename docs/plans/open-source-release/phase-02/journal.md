<!-- refract-shared-version: 3.0.1 -->

# Phase 2 Journal: CI, release, and community files

<!-- Created by the worker per worker-contract.md. Append every block; keep earlier sections. -->

## META

- Plan: docs/plans/open-source-release/PLAN.md
- Implementation Profile: balanced
- Consultation Profile: n/a
- Review Profile: balanced
- Implementation Job: n/a
- Review Job: n/a
- Started: 2026-11-10T18:23:02+07:00
- Finished: 2026-11-10T18:49:30+07:00

## Implementation Response

# EXTERNAL RESPONSE
## META
- Phase: 2
- Started: 2026-11-10T18:23:02+07:00
- Finished: 2026-11-10T18:39:00+07:00
- Plan dir: docs/plans/open-source-release
## SUMMARY
Created GitHub workflows, Dependabot, issue forms, PR template, security policy, and updated community documentation and Pages workflow with pinned action SHAs.
## FILES MODIFIED
| Action | Path | Change |
| CREATE | .github/workflows/ci.yml | CI workflow with static, unit, and E2E jobs |
| CREATE | .github/workflows/release.yml | Tag-triggered release workflow verifying tag ancestry, running CI, packaging ZIP and checksum, publishing via gh release |
| MODIFY | .github/workflows/pages.yml | Pinned action SHAs, ubuntu-24.04 runner, persist-credentials: false, restricted write permissions to deploy job |
| CREATE | .github/dependabot.yml | Weekly updates for npm (minor/patch grouped) and github-actions |
| CREATE | .github/ISSUE_TEMPLATE/config.yml | Issue config disabling blank issues and linking security reports to private advisory URL |
| CREATE | .github/ISSUE_TEMPLATE/bug_report.yml | Issue form for bug reports |
| CREATE | .github/ISSUE_TEMPLATE/feature_request.yml | Issue form for feature requests |
| CREATE | .github/pull_request_template.md | Pull request template with summary and quality checklist matching CONTRIBUTING.md |
| CREATE | SECURITY.md | Security policy specifying latest release support and private vulnerability reporting |
| MODIFY | README.md | Added CI badge, install-from-release instructions, and documentation links |
| MODIFY | CONTRIBUTING.md | Added protected-main PR flow, 3 required CI checks, squash merge policy, and release steps |
| MODIFY | AGENTS.md | Documented protected-main branch policy requiring work on branches via PRs |
| MODIFY | site/contributing.md | Aligned PR, required checks, and release steps in docs site |
| MODIFY | site/getting-started.md | Added install-from-release instructions in docs site |
| MODIFY | docs/plans/open-source-release/phase-02/notes.md | Recorded decisions, action SHAs, RED and GREEN test evidence for Tasks 1-5 |
| MODIFY | docs/plans/open-source-release/phase-02/journal.md | Recorded phase metadata and implementation response |
## NOTES
- docs/plans/open-source-release/phase-02/notes.md (## Task 1, ## Task 2, ## Task 3, ## Task 4, ## Task 5)
  - actionlint: exit 0 (0 errors across 3 workflows)
  - pnpm lint: exit 0 (0 errors, 208 warnings, 3 infos)
  - pnpm test: exit 0 (44 test files, 543 passed)
## SPEC COMPLIANCE
- Meets Spec? YES: All required files created/updated per DESIGN.md and prompt.md, action SHAs pinned, and verification checks pass.
## CLARIFICATIONS NEEDED
None
## NEXT
TASK_COMPLETE

# EXTERNAL RESPONSE
## META
- Phase / Started / Finished / Plan dir
- Phase: 2 (Review Fix 1)
- Started: 2026-11-10T18:41:26+07:00
- Finished: 2026-11-10T18:49:30+07:00
- Plan dir: docs/plans/open-source-release
## SUMMARY
Updated ci.yml concurrency to avoid canceling tag-triggered runs and updated CONTRIBUTING.md and site/contributing.md release tagging steps.
## FILES MODIFIED
| Action | Path | Change |
| MODIFY | .github/workflows/ci.yml | Unique concurrency group for tags using run_id and cancel-in-progress disabled for tags |
| MODIFY | CONTRIBUTING.md | Release steps updated to switch/pull main, verify commit, and use quoted tag variable |
| MODIFY | site/contributing.md | Release steps updated to switch/pull main, verify commit, and use quoted tag variable |
| MODIFY | docs/plans/open-source-release/phase-02/notes.md | Recorded decisions and test evidence for Review Fix 1 |
| MODIFY | docs/plans/open-source-release/phase-02/journal.md | Appended review fix external response |
## NOTES
- docs/plans/open-source-release/phase-02/notes.md (## Review Fix 1)
  - actionlint: exit 0 (0 errors across 3 workflows)
  - pnpm lint: exit 0 (0 errors, 208 warnings, 3 infos)
## SPEC COMPLIANCE
- Meets Spec? YES: Both review findings resolved; actionlint and Biome lint/format checks pass.
## CLARIFICATIONS NEEDED
None
## NEXT
TASK_COMPLETE

# EXTERNAL RESPONSE
## META
- Phase / Started / Finished / Plan dir
- Phase: 2 (Review Fix 2)
- Started: 2026-11-10T18:47:45+07:00
- Finished: 2026-11-10T18:49:30+07:00
- Plan dir: docs/plans/open-source-release
## SUMMARY
Split release tagging instructions into separate inspect and tag steps in CONTRIBUTING.md and site/contributing.md.
## FILES MODIFIED
| Action | Path | Change |
| MODIFY | CONTRIBUTING.md | Split step 3 into inspect and tag steps with confirmation requirement |
| MODIFY | site/contributing.md | Split step 3 into inspect and tag steps with confirmation requirement |
| MODIFY | docs/plans/open-source-release/phase-02/notes.md | Recorded decisions and test evidence for Review Fix 2 |
| MODIFY | docs/plans/open-source-release/phase-02/journal.md | Appended review fix 2 external response |
## NOTES
- docs/plans/open-source-release/phase-02/notes.md (## Review Fix 2)
  - pnpm lint: exit 0 (0 errors, 208 warnings, 3 infos)
## SPEC COMPLIANCE
- Meets Spec? YES: Release steps in both contribution guides split into distinct inspect and tag/push steps; Biome lint/format checks pass.
## CLARIFICATIONS NEEDED
None
## NEXT
TASK_COMPLETE

## Quality Review

<!-- Coordinator appends the independent review response here. -->

## Review Result

- Spec Status: PASS
- Quality Status: PASS
- Debt: none

Round 1 found release CI runs could cancel each other through the shared concurrency group, and tagging could use a stale local `main`. Round 2 found the tag block still ran after a failed update. Both fixed and re-reviewed. Fresh checks at close: actionlint exit 0; `pnpm lint` exit 0 with 208 warnings; `pnpm test` 44 files, 543 passed. All nine action SHAs match their version tags through `gh api`.

## Final Checkpoint

- Phase base ref: refs/plans/open-source-release/phase-02/base
- Phase implementation ref: refs/plans/open-source-release/phase-02/impl
- Plan commit ref: refs/plans/<slug>/impl or `pending`
- State checkpoint: temporary commit, or `n/a (untracked)` when plan artifacts
  are excluded

Phase refs retain review evidence after checkpoint consolidation. The plan ref
names the sole commit retained on the branch.
