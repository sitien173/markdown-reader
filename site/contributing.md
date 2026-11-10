---
title: Contributing
nav_order: 5
---

# Contributing to Markdown Reader

This guide covers how to set up, change, test, and commit. Code conventions are in `CODING_STANDARDS.md`; read it before writing code.

## Set up

1. Install Node.js 24 and pnpm 11. The exact pnpm version is pinned in the `packageManager` field of `package.json`.
2. Install dependencies and generate WXT types:

   ```sh
   pnpm install --frozen-lockfile
   pnpm typecheck
   ```

3. Build and load the extension as described in [Getting started](getting-started.html).

## Choose the size of the change

- **Small change:** a bug fix, a copy change, or a single-module edit. Make the change, add a test, and commit.
- **Feature or risky change:** anything that spans several modules, changes stored data, touches the sanitizer, or adds a permission. Write a design and a phased plan first in `docs/plans/<feature>/` as `DESIGN.md` and `PLAN.md`. The existing folders in `docs/plans/` show the format.

## Make the change

- Follow `CODING_STANDARDS.md`.
- Keep each change focused. Do not reformat or refactor unrelated code.
- When you touch code listed under Known Inconsistencies in `CODING_STANDARDS.md`, fix it in place.
- Put new UI strings in `src/i18n/en-US.ts`.
- When you add a setting, update its type, default, and schema in `src/lib/settings.ts`, its string, its settings tab in `src/ui/settings/`, and `tests/unit/settings.test.ts`.

### Changes that need extra care

| Area                                 | Requirement                                                                                                 |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| `src/render/sanitize.ts`             | Add a case to `tests/unit/sanitize.test.ts` or `tests/fixtures/markdown/xss.md` for every allow-list change |
| Permissions in `wxt.config.ts`       | Add the justification to `CHROMEWEBSTORE.md`                                                                |
| Data the extension stores or sends   | Check that `PRIVACY.md` stays accurate                                                                      |
| Background script and content script | Keep them free of Zod; read settings through `src/lib/settings-flags.ts`                                    |
| New dependencies                     | Bundle them; the MV3 CSP forbids remote code                                                                |

## Test

Run these before every commit:

```sh
pnpm typecheck
pnpm lint
pnpm test
```

- `pnpm lint` must exit 0. Do not raise the existing warning count. Biome also formats Markdown, so run `pnpm format` after editing docs.
- Add or update a unit test in `tests/unit/` for every behavior change.
- For UI, entry point, or extension behavior changes, also run `pnpm test:e2e`. It builds the extension first.
- Update the visual snapshots of `tests/e2e/settings-layout.spec.ts` only for intended layout changes.
- For native file pickers or saving to disk, follow `docs/manual-checklist.md`, and add steps there for new behavior that cannot run headless.

## Commit

Use [Conventional Commits](https://www.conventionalcommits.org/) with a scope. Types used in this repository are `feat`, `fix`, `docs`, `style`, and `chore`.

```text
feat(reader): show a lazy folder tree for file URLs
fix(settings): repair settings panel layout in options page
docs(plans): add json-preview design
```

- One logical change per commit.
- Keep the summary line short and in the imperative mood.
- Do not commit build output or local tool state such as `.output/`, `.wxt/`, `coverage/`, or `test-results/`. They are covered by `.gitignore`.

## Update the docs

- `README.md` for user-visible features, commands, or setup steps.
- `CODING_STANDARDS.md` in the same commit as any change to `biome.json` or to a convention.
- `AGENTS.md` for gotchas that AI coding agents need.
- The feature's `.handover.md` when you stop partway through a planned feature.
