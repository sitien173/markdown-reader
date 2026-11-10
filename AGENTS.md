# AGENTS.md

Markdown Reader is a Chrome MV3 extension built with WXT, React 19, and TypeScript. `README.md` covers features, commands, and layout. `CODING_STANDARDS.md` holds the conventions; read it before writing code.

## Done means

A change is done when all of these pass:

```sh
pnpm typecheck && pnpm lint && pnpm test
```

Add `pnpm test:e2e` when the change touches UI, entry points, or extension behavior. It builds first, then loads `.output/chrome-mv3` in Chromium.

`pnpm lint` exits 0 with existing warnings. Leave the warning count no higher than you found it. Biome also formats Markdown, so run `pnpm format` after editing docs.

## Gotchas

- **WXT globals:** `browser`, `defineBackground`, and `defineContentScript` are auto-imported by WXT. Run `pnpm typecheck` once to generate `.wxt/` types.
- **Zod-free bundles:** `src/entrypoints/background.ts` and `src/entrypoints/detect.content.ts` read settings through `src/lib/settings-flags.ts`. Never import `src/lib/settings.ts` or `zod` from them.
- **Adding a setting:** update the `Settings` type, `defaultSettings`, and the schema in `src/lib/settings.ts`; the string in `src/i18n/en-US.ts`; the tab in `src/ui/settings/`; and `tests/unit/settings.test.ts`. Stored data stays under `settings:v1`, so unknown or invalid values must fall back to defaults.
- **Rendered HTML:** everything reaching the DOM goes through `sanitize()` in `src/render/sanitize.ts`. Treat allow-list edits as security changes and add an XSS test case.
- **CSP:** MV3 forbids remote code. Bundle every dependency; Mermaid loads by bundled dynamic import, as verified in `docs/spikes.md`.
- **Permissions:** a new permission in `wxt.config.ts` needs a justification in `CHROMEWEBSTORE.md`.
- **Visual snapshots:** `tests/e2e/settings-layout.spec.ts` compares Linux screenshots. Update them only for intended layout changes, with `pnpm exec playwright test settings-layout --update-snapshots` after a build.
- **Headless limits:** native pickers and saving to disk cannot run headless. Add steps to `docs/manual-checklist.md` instead.

## Plans

Multi-phase features live in `docs/plans/<feature>/` as `DESIGN.md`, `PLAN.md`, and `.handover.md`. Before resuming a feature, read its `.handover.md` for status and next action. `docs/plans/json-preview/` is drafted and awaiting approval; it is not implemented.

## Commits

Conventional Commits with a scope, such as `feat(reader): ...` or `docs(plans): ...`. One logical change per commit.
