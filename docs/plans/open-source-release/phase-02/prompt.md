# Phase 2: CI, release, and community files

## Goal & Outcome
- Plan Goal: Publish Markdown Reader as the public GitHub repository `sitien173/markdown-reader`, whose `main` requires three CI checks, with a tag-triggered release workflow, a GitHub Pages docs site, and security features enabled.
- Phase Outcome: Every repository file needed for publication exists locally and passes local checks. Nothing is pushed and no GitHub setting changes.

## Context & Architecture
- Code root: `/home/ngosi/projects/markdown-reader` | Records root: `/home/ngosi/projects/markdown-reader` | Branch: `main` | Base: `refs/plans/open-source-release/phase-02/base`
- Prior State: Phase 1 made `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm test:e2e` all pass. Another session added a Jekyll docs site in `site/` and `.github/workflows/pages.yml`; the user included both in this release. The GitHub repository does not exist yet.
- Spec: read `/home/ngosi/projects/markdown-reader/docs/plans/open-source-release/DESIGN.md`, section "Architecture and Data Flow". Its file table is the exact specification for every file below. Also read `AGENTS.md`, `CODING_STANDARDS.md`, `README.md`, and `CONTRIBUTING.md` before editing.
- Code Context: `package.json` has `"name": "markdown-reader"`, `"version": "1.0.0"`, `"packageManager": "pnpm@11.22.0"`, and `"private": true`. Node is 24. Scripts include `typecheck`, `lint`, `format`, `test`, `test:e2e`, and `build`. `pnpm exec wxt zip` writes the ZIP under `.output/`; confirm its exact file name by running it locally and use that pattern in `release.yml`. Biome formats Markdown but skips `site/`. `site/` uses the `just-the-docs` remote theme and Kramdown attribute lists.
- `gh` is authenticated as `sitien173` and may be used for read-only API calls only.

## Invariants & Boundaries
- Preserve: product code, tests, snapshots, `package.json`, `pnpm-lock.yaml`, `biome.json`, `LICENSE`. `pages.yml` keeps its `on:` triggers and its `pages` concurrency group with `cancel-in-progress: false`.
- Workflow rules for all three workflows: job names in `ci.yml` exactly `CI Static`, `CI Unit`, `CI E2E`; `runs-on: ubuntu-24.04`; top-level `permissions: contents: read`; only `release.yml` job `publish` gets `contents: write`, only `pages.yml` job `deploy` gets `pages: write` and `id-token: write`; `pull_request`, never `pull_request_target`; `actions/checkout` with `persist-credentials: false`; no secrets beyond `GITHUB_TOKEN`; release jobs never cancel in progress; tag and version values pass through `env:` and are double-quoted in shell, never interpolated with `${{ }}` inside `run:`.
- Every `uses:` reference is pinned to a full 40-character commit SHA with the version in a trailing comment, for example `uses: actions/checkout@<sha> # v5.0.0`. Resolve each with `gh api repos/<owner>/<repo>/commits/<tag> --jq .sha`, using the latest release tag of each action, found with `gh api repos/<owner>/<repo>/releases/latest --jq .tag_name`. Record every action, tag, and SHA in notes.
- Out of Scope: `git commit`, `git push`, `git tag`, any `gh` command that writes, `gh repo create`, settings changes, CODEOWNERS, code of conduct, Chrome Web Store.

## Files
Allowed production and test paths:
- `.github/workflows/ci.yml` (create: per DESIGN.md)
- `.github/workflows/release.yml` (create: per DESIGN.md; `verify` job checks the tag equals `v` plus the `package.json` version and that the tagged commit is an ancestor of `origin/main`, which needs a checkout with `fetch-depth: 0`)
- `.github/workflows/pages.yml` (modify: apply the workflow rules above only)
- `.github/dependabot.yml` (create: per DESIGN.md)
- `.github/ISSUE_TEMPLATE/bug_report.yml`, `.github/ISSUE_TEMPLATE/feature_request.yml`, `.github/ISSUE_TEMPLATE/config.yml` (create: issue forms; `config.yml` sets `blank_issues_enabled: false` and links security reports to `https://github.com/sitien173/markdown-reader/security/advisories/new`)
- `.github/pull_request_template.md` (create: summary plus a checklist matching `CONTRIBUTING.md`)
- `SECURITY.md` (create: supported version is the latest release; report through GitHub private vulnerability reporting at the URL above; never in a public issue)
- `README.md` (modify: CI badge for `ci.yml` on `main` under the title; an install-from-release path using the ZIP from GitHub Releases; link `SECURITY.md` and the docs site `https://sitien173.github.io/markdown-reader/` in Documentation)
- `CONTRIBUTING.md` (modify: branch and PR flow, the three required checks, squash merge, release steps: bump `package.json` version, merge, tag `v<version>` on `main`, push the tag)
- `AGENTS.md` (modify: `main` is protected; work on a branch and open a PR)
- `site/contributing.md`, `site/getting-started.md` (modify only to stay consistent with the new PR, release, and install steps; match existing Kramdown style by hand)

Worker-owned phase records:
- `/home/ngosi/projects/markdown-reader/docs/plans/open-source-release/phase-02/notes.md` (append `## Task <M>` blocks)
- `/home/ngosi/projects/markdown-reader/docs/plans/open-source-release/phase-02/journal.md` (append `# EXTERNAL RESPONSE` under `## Implementation Response`)

Read-only / Forbidden:
- Do not edit `PLAN.md`, `DESIGN.md`, `.handover.md`, `prompt.md`, other phases, dependencies, or secrets. Delete `.output/` ZIP artifacts you create only if they are untracked build output.

## Tasks
- task-1: Resolve action SHAs. Write `ci.yml` and `release.yml`; update `pages.yml`. RED: before writing, `docker run --rm -v "$PWD":/repo -w /repo rhysd/actionlint:latest -color` on the current tree, record result. GREEN: actionlint reports no errors for all three workflows, and `grep -n 'uses:' .github/workflows/*.yml` shows only 40-character SHAs with version comments.
- task-2: Write `dependabot.yml`, the three issue template files, and the PR template.
- task-3: Write `SECURITY.md`; update `README.md`, `CONTRIBUTING.md`, `AGENTS.md`; update `site/contributing.md` and `site/getting-started.md` only where they would contradict the new flow.
- task-4: Run `pnpm format`, then `pnpm lint` exits 0 with at most 208 warnings.
- task-5: Build the site: `docker run --rm -v "$PWD/site":/srv/jekyll -v /tmp/mr-site:/srv/jekyll/_site jekyll/jekyll:4 jekyll build --baseurl /markdown-reader` or the closest working image; the `github-pages` gem in `site/Gemfile` may require a different image, so report the exact command used. Confirm in the generated HTML that the logo and internal links start with `/markdown-reader/`. If the site cannot build locally, record why in notes and say so in the ERP.

## Done When
- `git status --porcelain` lists only allowed paths plus this phase's records.
- Run from `/home/ngosi/projects/markdown-reader`:
  - `docker run --rm -v "$PWD":/repo -w /repo rhysd/actionlint:latest -color` (Baseline: not run; target exit 0)
  - `pnpm lint` (Baseline: exit 0, 208 warnings, 3 infos)
  - `pnpm test` (Baseline: 44 files, 543 passed)

## Rules
Read and follow these bundled contracts:
- Contract: `/home/ngosi/projects/refract/plugin/shared/worker-contract.md`
- Response: `/home/ngosi/projects/refract/plugin/shared/erp.md`
- Notes: `/home/ngosi/projects/refract/plugin/shared/notes-template.md`
- Journal: `/home/ngosi/projects/refract/plugin/shared/journal-template.md`

Role boundary: You are the phase implementer, not Coordinator. Edit code only in `/home/ngosi/projects/markdown-reader`; write phase records only under `/home/ngosi/projects/markdown-reader/docs/plans/open-source-release/phase-02/`. Leave Coordinator skills and Refract job submission to the Coordinator.

## Response Format
Append the complete `# EXTERNAL RESPONSE` block to `/home/ngosi/projects/markdown-reader/docs/plans/open-source-release/phase-02/journal.md`, then return that block and the matching status line from `erp.md`.
