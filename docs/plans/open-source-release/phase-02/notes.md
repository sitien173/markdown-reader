<!-- refract-shared-version: 3.0.1 -->

# Phase 2 Decision Notes

<!-- Created by the worker per worker-contract.md. Append one `## Task <M>` block per task. -->

## Task 1

### Decisions made
- Resolved action tags and 40-character SHAs using `gh api`:
  - `actions/checkout`: tag `v7.0.1`, sha `3d3c42e5aac5ba805825da76410c181273ba90b1`
  - `pnpm/action-setup`: tag `v6.1.1`, sha `73e46992e05b19abd31f2f3c20e0e7370d762115`
  - `actions/setup-node`: tag `v7.1.0`, sha `949feb2413d6458794dcd2491c4babbbce0c15c1`
  - `actions/upload-artifact`: tag `v7.0.2`, sha `cf430e030ddbb5b0abf93d22962f4752f3646cd9`
  - `actions/download-artifact`: tag `v8.0.2`, sha `9000827ccba6bdab643e8b6fd33ac0654aef8333`
  - `actions/configure-pages`: tag `v6.0.0`, sha `45bfe0192ca1faeb007ade9deae92b16b8254a0d`
  - `actions/jekyll-build-pages`: tag `v1.0.13`, sha `44a6e6beabd48582f863aeeb6cb2151cc1716697`
  - `actions/upload-pages-artifact`: tag `v5.0.0`, sha `fc324d3547104276b827a68afc52ff2a11cc49c9`
  - `actions/deploy-pages`: tag `v5.0.1`, sha `368f82528645a54fb793d4d04e342629a3f51346`
- Configured workflows `.github/workflows/ci.yml`, `.github/workflows/release.yml`, and `.github/workflows/pages.yml` with top-level `permissions: contents: read`, `runs-on: ubuntu-24.04`, checkout `persist-credentials: false`, and pinned action SHAs.
- In `release.yml`, configured `verify` job with `fetch-depth: 0` checking tag against `package.json` version and ancestry of `origin/main` via `git merge-base --is-ancestor HEAD origin/main`, reused `ci.yml` via `checks` job, packaged extension with SHA256 checksum, and configured `publish` with `permissions: contents: write` using `gh release create`.

### Spec deviations
- none

### Tradeoffs accepted
- none

### Assumptions
- none

### Follow-ups for human
- none

### Test evidence
- RED -> GREEN:
  - RED: `grep -n 'uses:' .github/workflows/*.yml` -> Unpinned unversioned tags in `pages.yml` (`actions/checkout@v7`, `actions/configure-pages@v6`, `actions/jekyll-build-pages@v1`, `actions/upload-pages-artifact@v5`, `actions/deploy-pages@v5`); `ci.yml` and `release.yml` missing
  - GREEN: `docker run --rm -v "$PWD":/repo -w /repo rhysd/actionlint:latest -color && grep -n 'uses:' .github/workflows/*.yml` -> exit 0 (0 actionlint errors across 3 workflows); all 22 external action references pinned to 40-character SHAs with version comments
- Root cause (bugfix only): none

## Task 2

### Decisions made
- Created `.github/dependabot.yml` configured with weekly checks for npm (grouping minor and patch updates, leaving major updates separate) and weekly checks for github-actions.
- Created `.github/ISSUE_TEMPLATE/config.yml` disabling blank issues and providing a contact link pointing to GitHub private vulnerability reporting at `https://github.com/sitien173/markdown-reader/security/advisories/new`.
- Created GitHub issue forms `.github/ISSUE_TEMPLATE/bug_report.yml` and `.github/ISSUE_TEMPLATE/feature_request.yml`.
- Created `.github/pull_request_template.md` with summary and quality checklist matching CONTRIBUTING.md guidelines.

### Spec deviations
- none

### Tradeoffs accepted
- none

### Assumptions
- none

### Follow-ups for human
- none

### Test evidence
- RED -> GREEN:
  - RED: `test -f .github/dependabot.yml && test -f .github/ISSUE_TEMPLATE/bug_report.yml && test -f .github/ISSUE_TEMPLATE/feature_request.yml && test -f .github/ISSUE_TEMPLATE/config.yml && test -f .github/pull_request_template.md` -> exit 1 (files missing)
  - GREEN: `test -s .github/dependabot.yml && test -s .github/ISSUE_TEMPLATE/bug_report.yml && test -s .github/ISSUE_TEMPLATE/feature_request.yml && test -s .github/ISSUE_TEMPLATE/config.yml && test -s .github/pull_request_template.md` -> exit 0 (all 5 files exist and non-empty)
- Root cause (bugfix only): none

## Task 3

### Decisions made
- Created `SECURITY.md` defining supported versions (latest release only) and vulnerability reporting through GitHub Private Vulnerability Reporting at `https://github.com/sitien173/markdown-reader/security/advisories/new`, without public issue reporting.
- Updated `README.md` to include CI badge for `ci.yml` on `main`, an install-from-release guide using the release ZIP, and documentation links to the docs site and `SECURITY.md`.
- Updated `CONTRIBUTING.md` with protected-branch PR workflow, the three required CI checks (`CI Static`, `CI Unit`, `CI E2E`), squash merge policy, and release tagging steps.
- Updated `AGENTS.md` stating `main` is protected and changes must be done on branches via PRs.
- Updated `site/getting-started.md` and `site/contributing.md` to match install, branch, PR, and release steps while preserving Jekyll Kramdown formatting.

### Spec deviations
- none

### Tradeoffs accepted
- none

### Assumptions
- none

### Follow-ups for human
- none

### Test evidence
- RED -> GREEN:
  - RED: `test -f SECURITY.md && grep -q 'badge.svg' README.md && grep -q 'Install from a release' README.md` -> exit 1 (file missing and content not yet added)
  - GREEN: `test -s SECURITY.md && grep -q 'badge.svg' README.md && grep -q 'Install from a release' README.md && grep -q 'CI Static' CONTRIBUTING.md && grep -q 'branch is protected' AGENTS.md && grep -q 'Install from a release' site/getting-started.md && grep -q 'CI Static' site/contributing.md` -> exit 0
- Root cause (bugfix only): none

## Task 4

### Decisions made
- Ran `pnpm format` to format Markdown and configuration files according to Biome configuration.
- Verified that `pnpm lint` exits 0 with 0 errors, 208 warnings, and 3 infos, matching baseline.

### Spec deviations
- none

### Tradeoffs accepted
- none

### Assumptions
- none

### Follow-ups for human
- none

### Test evidence
- RED -> GREEN:
  - RED: `pnpm lint` -> exit 1 (Found 3 formatting errors across `.github/workflows/release.yml`, `CONTRIBUTING.md`, and `SECURITY.md`)
  - GREEN: `pnpm format && pnpm lint` -> exit 0 (Checked 195 files; 0 errors, 208 warnings, 3 infos)
- Root cause (bugfix only): none

## Task 5

### Decisions made
- Built the Jekyll documentation site using `ghcr.io/actions/jekyll-build-pages:v1.0.13` (the exact container action used by `.github/workflows/pages.yml`), passing authenticated `gh auth token` as `INPUT_TOKEN` to resolve the `just-the-docs` remote theme and GitHub metadata under `sitien173/markdown-reader`.
- Verified in generated HTML and CSS that the logo (`/markdown-reader/assets/images/icon-128.png`), navigation links (`/markdown-reader/`, `/markdown-reader/getting-started.html`, `/markdown-reader/features.html`, `/markdown-reader/privacy.html`, `/markdown-reader/contributing.html`), CSS stylesheets, and JS bundles all resolve under the `/markdown-reader/` base path.
- Exact build command:
  `docker run --rm -v "$PWD":/repo -v /tmp/mr-site:/repo/_site -e GITHUB_WORKSPACE=/repo -e INPUT_SOURCE=site -e INPUT_DESTINATION=_site -e GITHUB_REPOSITORY=sitien173/markdown-reader -e INPUT_TOKEN="$(gh auth token)" ghcr.io/actions/jekyll-build-pages:v1.0.13`

### Spec deviations
- none

### Tradeoffs accepted
- none

### Assumptions
- none

### Follow-ups for human
- none

### Test evidence
- RED -> GREEN:
  - RED: `docker run --rm -v "$PWD":/repo -v /tmp/mr-site:/repo/_site -e GITHUB_WORKSPACE=/repo -e INPUT_SOURCE=site -e INPUT_DESTINATION=_site -e GITHUB_REPOSITORY=sitien173/markdown-reader ghcr.io/actions/jekyll-build-pages:v1.0.13` -> exit 1 (`Liquid Exception: The GitHub API credentials you provided aren't valid. in /_layouts/default.html`)
  - GREEN: `docker run --rm -v "$PWD":/repo -v /tmp/mr-site:/repo/_site -e GITHUB_WORKSPACE=/repo -e INPUT_SOURCE=site -e INPUT_DESTINATION=_site -e GITHUB_REPOSITORY=sitien173/markdown-reader -e INPUT_TOKEN="$(gh auth token)" ghcr.io/actions/jekyll-build-pages:v1.0.13` -> exit 0 (Generated site with all links and logo starting with `/markdown-reader/`)
- Root cause (bugfix only): none

## Review Fix 1

### Decisions made
- Updated `.github/workflows/ci.yml` concurrency configuration to give tag refs a unique key and disable `cancel-in-progress` for tag refs:
  `group: ${{ github.workflow }}-${{ startsWith(github.ref, 'refs/tags/') && github.run_id || github.event.pull_request.number || github.ref }}`
  `cancel-in-progress: ${{ !startsWith(github.ref, 'refs/tags/') }}`
- Rewrote the release tagging step in `CONTRIBUTING.md` and `site/contributing.md`:
  Added `git switch main && git pull --ff-only origin main`, confirmation of `git log -1` version-bump commit, quoted `VERSION` evaluation and tag commands (`git tag "v$VERSION"`, `git push origin "v$VERSION"`), and noted that release tags cannot be moved or deleted once pushed.

### Spec deviations
- none

### Tradeoffs accepted
- none

### Assumptions
- none

### Follow-ups for human
- none

### Test evidence
- RED -> GREEN:
  - RED: Review findings identified shared concurrency group and `cancel-in-progress: true` on tag runs in `ci.yml`, and missing `pull --ff-only` / unquoted `<version>` syntax in `CONTRIBUTING.md` and `site/contributing.md`
  - GREEN: `docker run --rm -v "$PWD":/repo -w /repo rhysd/actionlint:latest -color && pnpm format && pnpm lint` -> exit 0 (0 actionlint errors; 0 lint errors, 208 warnings, 3 infos)
- Root cause (bugfix only):
  - In `ci.yml`, called workflows inherit `github.workflow` and ref, allowing simultaneous tag runs to share concurrency group and cancel each other. Fixed by keying tags on `github.run_id` and disabling `cancel-in-progress` when `startsWith(github.ref, 'refs/tags/')`.
  - In contribution guides, tagging local `main` without pulling remote squash-merged `main` could tag stale commits, and raw `<version>` in bash commands acts as file redirection. Fixed with pull and quoted variable syntax.

## Review Fix 2

### Decisions made
- Split release step 3 into two discrete steps in `CONTRIBUTING.md` and `site/contributing.md`:
  - Step 3: update and inspect local `main` with `git switch main && git pull --ff-only origin main && git log -1 --oneline`; instructed to stop if any command fails and confirm the printed commit is the merged version-bump PR.
  - Step 4: tag and push only after confirming, with `VERSION="$(node -p "require('./package.json').version")"` and `git tag "v$VERSION" && git push origin "v$VERSION"`, retaining the note that release tags cannot be moved or deleted once pushed.
  - Renumbered existing step 4 to step 5.

### Spec deviations
- none

### Tradeoffs accepted
- none

### Assumptions
- none

### Follow-ups for human
- none

### Test evidence
- RED -> GREEN:
  - RED: Release step 3 was a single pasted block combining switch, pull, log, and tag commands, which did not pause for confirmation if switch/pull failed
  - GREEN: `pnpm format && pnpm lint` -> exit 0 (0 errors, 208 warnings, 3 infos)
- Root cause (bugfix only):
  - A single multi-line script block allowed tag commands to execute without user verification of the squash-merged commit on `main`. Splitting into inspection (step 3) and tag/push (step 4) enforces interactive verification before immutable release tags are created and pushed.
