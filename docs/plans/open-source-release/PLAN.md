# Open-Source Release Plan

**Design:** [DESIGN.md](DESIGN.md)
**Context key:** `open-source-release`
**Base:** `refs/plans/open-source-release/base` (`c902a59`)
**Commit:** `ci: add CI, release workflow, and repository policies for open-source release`

## Outcome & Scope

Publish `sitien173/markdown-reader` as a public repository whose `main` is protected by three required checks, with a tag-triggered release workflow and security features enabled.

Phases 1 and 2 change the local repository and are consolidated into the single plan commit above before anything is pushed. Phases 3 to 5 act on GitHub. The Coordinator runs them directly with `gh` and `git`, and asks the user to confirm right before each outward action. After the first push, published history is never rewritten.

Preserved invariants: listed in DESIGN.md. Product code changes only for the Phase 1 regression fixes. Performance budgets in `tests/e2e/perf.spec.ts` stay as they are.

Out of scope: Chrome Web Store publication, code of conduct, CODEOWNERS, merge queue.

## Baseline Evidence

Run at `438c806`, one design commit after base, on 2026-11-10:

- `pnpm typecheck`: exit 0.
- `pnpm lint`: exit 1. Formatting errors in untracked local tool files under `.pi/tasks/`. Source files: 0 errors, 208 warnings.
- `pnpm test`: 44 files, 543 tests passed.
- `pnpm test:e2e`: 183 passed, 6 failed:
  - `tests/e2e/contrast.spec.ts:285` forced light theme: light sidebar search field below 4.5:1.
  - `tests/e2e/contrast.spec.ts:285` forced dark theme: dark sidebar below 4.5:1.
  - `tests/e2e/motion.spec.ts:58` reduced motion: a loaded document with sidebar has non-zero durations.
  - `tests/e2e/motion.spec.ts:102` reduced motion: reader menu has non-zero durations.
  - `tests/e2e/settings-layout.spec.ts:85` options page General tab: 15536 pixels differ.
  - `tests/e2e/settings-layout.spec.ts:91` reader dialog General tab: 10189 pixels differ.

All six touch UI changed by `3532eb2`.

### Phase 1: Green local baseline

**Phase Request:** Make every verification command pass at a clean checkout. Ignore local tool state so Biome skips it. Use `systematic-debugging` to find the root cause of the contrast and reduced-motion failures introduced by `3532eb2`, and fix them in product CSS or components. Then regenerate only the two General tab screenshots, whose content changed intentionally in `3532eb2` when the Open Editor action and Recent section were removed.
**Goal:** `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm test:e2e` all exit 0 locally.
**Depends on:** none
**Invariants & Boundaries:** Do not weaken assertions, contrast thresholds, or timing budgets in any spec. Do not change other snapshots. Keep the visual design of `3532eb2` except where contrast or reduced motion requires a change. No CI files in this phase.
**Files:**
- Modify: `.gitignore`
- Modify: `src/styles/reader.css`
- Modify, only if the root cause is there: `src/ui/file-tree.tsx`, `src/ui/recent-section.tsx`, `src/ui/toolbar.tsx`, `src/entrypoints/reader/App.tsx`, `src/styles/globals.css`
- Modify: `tests/e2e/settings-layout.spec.ts-snapshots/options-general-linux.png`
- Modify: `tests/e2e/settings-layout.spec.ts-snapshots/dialog-general-linux.png`
**Tasks:**
1. Add `.pi/` to `.gitignore` and confirm `pnpm lint` exits 0.
2. Reproduce the two contrast failures, find the colors that fail, and fix them with design tokens.
3. Reproduce the two motion failures, find the transitions or animations not covered by the reduced-motion rules, and cover them.
4. Run `pnpm build && pnpm exec playwright test settings-layout --update-snapshots -g "General tab"`, then inspect that only the two General tab PNGs changed.
**Acceptance Criteria:**
- All four verification commands exit 0.
- `git diff --stat` shows only the files listed above.
- The regenerated screenshots show the General tab without Open Editor and Recent sections and no other layout change.
**Reviewer Checklist:**
- Fixes address root causes; no spec assertion, threshold, or budget was edited.
- Color changes use existing tokens from `src/styles/globals.css`.
- Reduced-motion coverage matches the existing `@media (prefers-reduced-motion: reduce)` pattern.
**Verification Checks:**
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm test:e2e`

### Phase 2: CI, release, and community files

**Phase Request:** Create the GitHub workflow, Dependabot, issue, PR, and security files exactly as specified in DESIGN.md "Architecture and Data Flow", and update the three docs. Resolve every action SHA with `gh api repos/<owner>/<repo>/commits/<tag> --jq .sha` and pin it with a trailing version comment. Do not push and do not call any `gh` command that writes.
**Goal:** All repository files for publication exist and pass local checks.
**Depends on:** Phase 1
**Invariants & Boundaries:** Job names exactly `CI Static`, `CI Unit`, `CI E2E`. Top-level `permissions: contents: read`; only the release `publish` job gets `contents: write`. `pull_request`, never `pull_request_target`. Checkout uses `persist-credentials: false`. No secrets beyond `GITHUB_TOKEN`. No product code.
**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `.github/workflows/release.yml`
- Create: `.github/dependabot.yml`
- Create: `.github/ISSUE_TEMPLATE/bug_report.yml`
- Create: `.github/ISSUE_TEMPLATE/feature_request.yml`
- Create: `.github/ISSUE_TEMPLATE/config.yml`
- Create: `.github/pull_request_template.md`
- Create: `SECURITY.md`
- Modify: `README.md`
- Modify: `CONTRIBUTING.md`
- Modify: `AGENTS.md`
**Tasks:**
1. Write `ci.yml` and `release.yml`, with the release `verify` job checking tag against `package.json` version and ancestry of `origin/main`.
2. Write `dependabot.yml`, the issue forms, `config.yml`, and the PR template.
3. Write `SECURITY.md`; add the CI badge and install-from-release steps to `README.md`, the PR, squash-merge, and release flow to `CONTRIBUTING.md`, and the protected-`main` rule to `AGENTS.md`.
4. Run `pnpm format` so Biome formats the Markdown.
**Acceptance Criteria:**
- `actionlint` reports no errors for both workflows.
- Every `uses:` line references a 40-character SHA with a version comment.
- `pnpm lint` exits 0.
**Reviewer Checklist:**
- Permissions are least privilege per job; release jobs do not cancel in progress.
- Tag and version values pass through environment variables and are quoted in shell.
- `ci.yml` declares `workflow_call` so `release.yml` can reuse it.
- Docs match the workflow behavior and use the README links that exist.
**Verification Checks:**
- `docker run --rm -v "$PWD":/repo -w /repo rhysd/actionlint:latest -color`
- `pnpm lint`
- `pnpm test`

**Consolidation before Phase 3:** after Phases 1 and 2 pass review, replace their checkpoints with the plan commit, per `references/git-anchors.md`. Commit the plan artifacts in the same commit.

### Phase 3: Publish and green CI

**Phase Request:** Coordinator-run. With user confirmation immediately before, create the public repository and push `main` over SSH. Make CI green on `main`.
**Goal:** `sitien173/markdown-reader` is public and the latest `main` run of `ci.yml` succeeds.
**Depends on:** Phase 2
**Invariants & Boundaries:** Push only `main`: `git push -u origin main`. Never push `refs/plans/*`, `--all`, `--mirror`, or tags. Snapshot baselines change only after the user reviews the CI images. Performance budgets are not changed; a timing failure sets status `BLOCKED` and asks the user.
**Files:**
- Modify, only if CI screenshots differ: `tests/e2e/settings-layout.spec.ts-snapshots/*-linux.png`
- Modify, only if a workflow bug appears: `.github/workflows/ci.yml`
**Tasks:**
1. `gh repo create sitien173/markdown-reader --public --description "<from README tagline>"`, then `git remote add origin git@github.com:sitien173/markdown-reader.git` and `git push -u origin main`.
2. Watch the run with `gh run watch`; on failure, read logs with `gh run view --log-failed`.
3. For screenshot drift, download the `test-results` artifact, show the diffs to the user, and commit approved baselines as `test(e2e): use CI screenshots as baselines`.
**Acceptance Criteria:**
- `gh repo view sitien173/markdown-reader --json visibility --jq .visibility` prints `PUBLIC`.
- `gh run list --branch main --workflow ci.yml --limit 1 --json conclusion --jq '.[0].conclusion'` prints `success`.
- `git ls-remote origin` lists only `HEAD` and `refs/heads/main`.
**Reviewer Checklist:**
- Any baseline change was approved by the user.
**Verification Checks:**
- `gh run list --branch main --workflow ci.yml --limit 1 --json conclusion --jq '.[0].conclusion'`
- `git ls-remote origin`

### Phase 4: Protection and security settings

**Phase Request:** Coordinator-run. Apply the repository settings, rulesets, and security features from DESIGN.md with `gh api`, using check names observed on `main`. Verify with a test PR.
**Goal:** `main` accepts changes only through PRs with all three checks green, and tags `v*` cannot be moved or deleted.
**Depends on:** Phase 3
**Invariants & Boundaries:** Empty bypass lists. Required check contexts copied from `gh api repos/sitien173/markdown-reader/commits/main/check-runs`. No change to workflow files.
**Files:** none in the repository.
**Tasks:**
1. Set merge options: squash only, PR title as squash title, delete branch on merge.
2. Create rulesets `main` and `release-tags`.
3. Enable private vulnerability reporting, Dependabot alerts and security updates, secret scanning and push protection, and CodeQL default setup.
4. Open a test PR from branch `chore/verify-protection` with a one-line doc change; confirm it is blocked until checks pass, then squash-merge it. Confirm a direct `git push origin main` is rejected.
**Acceptance Criteria:**
- `gh api repos/sitien173/markdown-reader/rulesets --jq '.[].name'` lists `main` and `release-tags`.
- The test PR showed required checks pending before merge and merged after they passed.
- A direct push to `main` was rejected by the ruleset.
- `gh api repos/sitien173/markdown-reader --jq '.security_and_analysis'` shows secret scanning and push protection `enabled`.
- `gh api repos/sitien173/markdown-reader/code-scanning/default-setup --jq .state` prints `configured`.
**Reviewer Checklist:**
- Ruleset contexts match the emitted check-run names exactly.
**Verification Checks:**
- `gh api repos/sitien173/markdown-reader/rulesets --jq '.[].name'`
- `gh api repos/sitien173/markdown-reader/code-scanning/default-setup --jq .state`

### Phase 5: First release

**Phase Request:** Coordinator-run, only if the user approves at that time. Tag `v1.0.0` on `main` and push the tag.
**Goal:** A GitHub Release `v1.0.0` exists with the ZIP and its checksum.
**Depends on:** Phase 4
**Invariants & Boundaries:** Tag equals `v` plus the `package.json` version. If the user declines, mark this phase skipped.
**Files:** none in the repository.
**Tasks:**
1. `git tag v1.0.0 origin/main && git push origin v1.0.0`.
2. Watch the release run and verify the assets.
**Acceptance Criteria:**
- `gh release view v1.0.0 --json assets --jq '.assets[].name'` lists `markdown-reader-1.0.0-chrome.zip` and `markdown-reader-1.0.0-chrome.zip.sha256`.
- The downloaded ZIP matches its checksum with `sha256sum -c`.
**Reviewer Checklist:**
- The release run used the reusable CI checks before publishing.
**Verification Checks:**
- `gh release view v1.0.0 --json assets --jq '.assets[].name'`
