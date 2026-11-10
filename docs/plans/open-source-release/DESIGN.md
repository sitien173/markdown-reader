# Open-Source Release Design

**Status:** Confirmed 2026-11-10
**Consultation:** two consult jobs, balanced and openai profiles. Both recommend a `main` ruleset with observed check names, SSH push, `gh release create`, SHA-pinned actions, and CodeQL default setup. The openai job adds `--no-shell` for the Playwright install.

## Purpose

Publish Markdown Reader as a public MIT-licensed GitHub repository. Every change to `main` must pass automated checks, and tagged versions must produce a downloadable extension ZIP.

## Users and Success Criteria

Users: the sole maintainer `sitien173`, outside contributors, and people who install the extension from a release ZIP.

Success criteria:

1. `sitien173/markdown-reader` is public and holds the full 13-commit `main` history plus this plan's commits. No `refs/plans/*` or other local refs are pushed.
2. CI on `main` is green with the three checks `CI Static`, `CI Unit`, and `CI E2E`.
3. A test PR cannot merge until all three checks pass. A direct push and a force push to `main` are rejected.
4. The `v*` tag ruleset blocks tag updates and deletion.
5. The Jekyll docs site in `site/` deploys to GitHub Pages from `pages.yml` and is served at `https://sitien173.github.io/markdown-reader/`.
6. Private vulnerability reporting, Dependabot alerts and security updates, secret scanning with push protection, and CodeQL default setup are enabled.
7. With user approval at that time, pushing `v1.0.0` creates a GitHub Release with `markdown-reader-1.0.0-chrome.zip` and its SHA-256 checksum.

## Constraints, Invariants, and Non-Goals

Constraints:

- `gh` is authenticated as `sitien173` with scopes `admin:public_key`, `gist`, `read:org`, `repo`. It has no `workflow` scope, so workflow files reach GitHub only through `git push` over SSH.
- Toolchain versions come from `package.json`: pnpm from `packageManager`, Node 24.
- The copyright holder in `LICENSE` is `sitien173`.

Invariants:

- Product code and product behavior stay unchanged, except for fixing the 6 E2E regressions from `3532eb2` found at plan base: sidebar contrast in `contrast.spec.ts`, reduced-motion durations in `motion.spec.ts`, and stale General tab screenshots in `settings-layout.spec.ts`. User-approved 2026-11-10. Otherwise only CI files, repository docs, `.gitignore`, and E2E screenshot baselines change.
- Performance budgets in `tests/e2e/perf.spec.ts` are not loosened without explicit user approval.
- `"private": true` stays in `package.json` to prevent npm publication.
- Full history is published unchanged, including the author email `tienngo@ankvn.com`.
- All docs are published, including `docs/plans/` and `CHROMEWEBSTORE.md`.

Non-goals:

- Chrome Web Store upload or publication.
- Code of conduct, CODEOWNERS, merge queue, OS matrix, Playwright browser caching, and Docker-based E2E.

## Chosen Approach

GitHub-hosted CI on `ubuntu-24.04`, where screenshots from CI are the canonical baselines. Repository rulesets enforce PRs and the three required checks with no bypass. A tag-triggered release workflow reuses the CI workflow and publishes with `gh release create`.

Rejected alternatives:

- Playwright Docker container for E2E: more reproducible, but local E2E would need Docker.
- Excluding the screenshot spec from CI: weakens the required E2E check.
- Classic branch protection: rulesets make bypass lists explicit and also cover tags.
- `softprops/action-gh-release`: adds a third-party dependency for one `gh` command.
- Chrome Web Store auto-publish: needs store API credentials as secrets; out of scope.
- Rewriting or squashing history: the user chose to keep full history.

## Architecture and Data Flow

Files:

| Path | Content |
| --- | --- |
| `.github/workflows/ci.yml` | Triggers: `pull_request`, `push` to `main`, `workflow_call`. Top-level `permissions: contents: read`. Concurrency keyed by workflow and PR number or ref, with `cancel-in-progress`. Three jobs on `ubuntu-24.04`: `CI Static` runs `pnpm typecheck` and `pnpm lint`; `CI Unit` runs `pnpm test`; `CI E2E` runs `pnpm exec playwright install --with-deps --no-shell chromium`, then `pnpm test:e2e`, then uploads `test-results/` on failure. Setup per job: checkout with `persist-credentials: false`, `pnpm/action-setup` reading `packageManager`, `actions/setup-node` with Node 24 and `cache: pnpm`, `pnpm install --frozen-lockfile`. |
| `.github/workflows/release.yml` | Trigger: `push` of tags `v*`. Job `verify`: tag equals `v` plus the `package.json` version, and the tagged commit is an ancestor of `origin/main`. Job `checks`: calls `ci.yml`. Job `package`: `pnpm exec wxt zip`, checks the ZIP exists, writes `<zip>.sha256`, uploads both as an artifact. Job `publish`: `permissions: contents: write`, downloads the artifact, runs `gh release create "$TAG" <zip> <sha256> --verify-tag --generate-notes` with `GH_TOKEN` set to `GITHUB_TOKEN`. No cancellation for releases. |
| `.github/workflows/pages.yml` | Added by `80ef5e1` with the docs site from `dbd09e0`; user included it in this release 2026-11-10. Brought up to the same rules as `ci.yml`: SHA-pinned actions, `ubuntu-24.04`, checkout with `persist-credentials: false`, top-level `permissions: contents: read`, and `pages: write` plus `id-token: write` only on the `deploy` job. Triggers and the `pages` concurrency group stay. |
| `.github/dependabot.yml` | `npm` weekly, one group for minor and patch updates; majors stay separate. `github-actions` weekly, one group. |
| `.github/ISSUE_TEMPLATE/bug_report.yml`, `feature_request.yml`, `config.yml` | Issue forms. `config.yml` turns off blank issues and links security reports to private vulnerability reporting. |
| `.github/pull_request_template.md` | Summary and a checklist matching `CONTRIBUTING.md`. |
| `SECURITY.md` | Supported version: latest release. Report through GitHub private vulnerability reporting. |
| `README.md` | CI badge; install from a release ZIP. |
| `CONTRIBUTING.md` | Branch and PR flow, required checks, squash merge, release steps. |
| `AGENTS.md` | `main` is protected; work on a branch and open a PR. |

Every `uses:` reference is pinned to a full commit SHA, with the version in a trailing comment. Each SHA is resolved with `gh api` at implementation time.

GitHub settings, applied with `gh api` after the first green run on `main`:

- Repository: public, no auto-init, squash merge only, squash commit title from the PR title, delete head branches on merge.
- Ruleset `main`: target `refs/heads/main`; `pull_request` with `required_approving_review_count: 0`; `required_status_checks` with `strict_required_status_checks_policy: true` and contexts taken from the observed check-run names and app ID; `non_fast_forward`; `deletion`; empty bypass list.
- Ruleset `release-tags`: target `refs/tags/v*`; `update`; `deletion`; empty bypass list.
- Pages: `build_type: workflow`, enabled right after the first push, then `pages.yml` is rerun.
- Security: private vulnerability reporting, Dependabot alerts, Dependabot security updates, secret scanning, secret scanning push protection, CodeQL default setup for `javascript-typescript`.

Order:

1. Commit docs and `LICENSE` on `main`. Done in `c902a59`.
2. Commit the `.github/` files and doc updates on `main`.
3. Create the empty repository and push `main` over SSH with `git push -u origin main`.
4. Enable Pages with `build_type: workflow` and rerun `pages.yml`, whose first run fails because Pages is not yet enabled. Fix CI with direct pushes while `main` is unprotected. Download the CI screenshot artifacts, review them, commit them as baselines.
5. Apply the rulesets and security settings using the observed check names.
6. Open a test PR and confirm merge is blocked until the checks pass; confirm a direct push to `main` is rejected.
7. Ask the user before pushing `v1.0.0`.

## Errors and Edge Cases

- Required-check name mismatch: the ruleset waits on a check that never reports, and every PR blocks. Mitigation: read names from `gh api repos/sitien173/markdown-reader/commits/main/check-runs` before creating the ruleset.
- Screenshot drift on runners: `CI E2E` fails on the first run. Mitigation: step 4 reviews and commits CI baselines.
- Performance budget failures on runners: stop and ask the user; budgets are not loosened silently.
- Pages workflow fails on the first push: Pages cannot be enabled before the repository exists, and `GITHUB_TOKEN` cannot enable it. Mitigation: enable Pages through `gh api` and rerun the workflow.
- Site links break under the `/markdown-reader/` base path. Mitigation: build the site locally with the `jekyll-build-pages` image before pushing and check the generated links.
- Push rejected for workflow files: happens only over HTTPS with the current token. Mitigation: push over SSH.
- Tag not matching `package.json` version, or a tag on a commit outside `main`: `verify` fails and nothing is published.
- An empty bypass list also binds the maintainer. A broken required check blocks every merge until the ruleset is edited through `gh api` or the web UI.

## Migration

n/a. No stored data or product behavior changes.

## Testing

- Before pushing: `pnpm typecheck && pnpm lint && pnpm test && pnpm test:e2e` pass locally. Workflow YAML is checked with `actionlint` through Docker.
- After pushing: CI green on `main`; test PR blocked until green; direct push rejected; settings verified with `gh api` reads.
- Release: run only with user approval; verify the release assets and checksum.

## Risks and Open Questions

- Publishing is irreversible in practice: clones and caches may persist after the repository is made private or deleted. Gitleaks found no leaks across 179 commits on all local refs.
- The author email `tienngo@ankvn.com` becomes public. The user accepted this.
- The organization should confirm that `sitien173` may release this work under MIT.
- Zero required approvals means checks are enforced but there is no independent review. This fits a sole maintainer.
- Open: whether to cut `v1.0.0` after setup. Asked at step 7.
