# Phase 1: Toolchain, extension skeleton, and platform spikes

## Goal & Outcome
- Plan Goal: Deliver the Chrome MV3 Markdown Reader extension defined in `docs/plans/markdown-reader-v1/DESIGN.md`: one React reader page rendering local files, folders, and URLs through one sanitized pipeline, with shadcn/ui behavior and TDS look on Tailwind v4.
- Phase Outcome: A WXT + React + Tailwind v4 + shadcn-initialized TypeScript project where `npm ci`, `npm run typecheck`, `npm test`, `npm run build`, and `npm run test:e2e` all exit 0 from a clean checkout; the TDS token bridge is in place and asserted by E2E; and the three DESIGN.md "Unverified" points have recorded VERIFIED or REFUTED outcomes in `docs/spikes.md`.

## Context & Architecture
- Root: `/home/ngosi/projects/markdown-reader` | Branch: `main` | Base: `refs/plans/markdown-reader-v1/phase-01/base`
- Prior State: Repository contains only `docs/plans/markdown-reader-v1/` (PLAN.md, DESIGN.md, .handover.md). No `package.json`; `npm test` fails at baseline.
- Toolchain: Node v24.18.0, npm 11.16.0. Playwright browsers already cached in `~/.cache/ms-playwright` (run `npx playwright install chromium` only if the pinned version needs a different build). The `tds` CLI is on PATH (`tds rules`, `tds tokens <category>`, `tds component <id>`).
- Read first: `docs/plans/markdown-reader-v1/DESIGN.md` (sections "Chosen Approach", "Architecture and Data Flow", token bridge table and "Bridge rules", "Risks and Open Questions") and the Phase 1 section of `docs/plans/markdown-reader-v1/PLAN.md`.

## Invariants & Boundaries
- Preserve (plan-wide): MV3 only; no `eval`, `new Function`, inline `<script>`, or inline event handlers; no runtime CDN requests; service worker keeps no state in global variables; light theme only; no hardcoded hex or oklch colors outside `src/styles/tds/`.
- Pinned versions: wxt 0.21.5, vite 8.3.5, vitest 5.1.0, happy-dom 21.0.4, @playwright/test 1.64.1, typescript 7.0.2, react 19.3.1, react-dom 19.3.1, @types/react 19.3.0, @types/react-dom 19.3.0, @wxt-dev/module-react 1.2.2, tailwindcss 4.3.4, @tailwindcss/vite 4.3.4, shadcn CLI 4.23.0, lucide-react 1.68.0. Use exact versions (no `^`). If a pin fails, use the closest working version and record the verified reason in `docs/spikes.md`. If TypeScript 7.0.2 fails `typecheck` with WXT, pin the latest TypeScript 6.x or 5.x that passes and record why.
- Out of Scope: Markdown rendering, product UI, shadcn components (`shadcn add`), icons, popup features beyond one button. Do not modify `DESIGN.md`; record spike results only in `docs/spikes.md`.
- Forbidden: `.env` files or credentials; Git operations.

## Files
Allowed production and test paths:
- `package.json`, `package-lock.json` (create: pinned deps and scripts)
- `tsconfig.json`, `wxt.config.ts`, `vitest.config.ts`, `playwright.config.ts`, `.gitignore`, `components.json` (create)
- `src/entrypoints/reader/index.html`, `src/entrypoints/reader/main.tsx`, `src/entrypoints/reader/App.tsx` (create: React root, reads `?src=` and shows it as text)
- `src/entrypoints/popup/index.html`, `src/entrypoints/popup/main.tsx`, `src/entrypoints/popup/App.tsx` (create: one button opening the reader)
- `src/entrypoints/background.ts` (create: no global state)
- `src/entrypoints/detect.content.ts` (create: match patterns only, logs nothing)
- `src/styles/globals.css`, `src/styles/tds/tokens.css`, `src/lib/utils.ts` (create)
- `tests/unit/smoke.test.ts` (create)
- `tests/e2e/fixtures.ts`, `tests/e2e/theme.spec.ts`, `tests/e2e/spike-file-fetch.spec.ts`, `tests/e2e/spike-fs-observer.spec.ts`, `tests/e2e/spike-mermaid-csp.spec.ts` (create)
- `tests/fixtures/` (create only if a spike needs a fixture file, such as a small `.md` for the file-fetch spike)
- `docs/spikes.md` (create)
- `mermaid` may be added as a devDependency or dependency at 12.3.0 for spike (c).

Worker-owned phase records:
- `docs/plans/markdown-reader-v1/phase-01/notes.md` (append `## Task <M>` blocks)
- `docs/plans/markdown-reader-v1/phase-01/journal.md` (append `# EXTERNAL RESPONSE` under `## Implementation Response`)

Read-only / Forbidden:
- Do not edit `PLAN.md`, `DESIGN.md`, `.handover.md`, `prompt.md`, other phases, or secrets.

## Tasks
- task-1: Scaffold WXT 0.21.5 with `srcDir: 'src'`, TypeScript, Vitest 5.1.0 with happy-dom 21.0.4, Playwright 1.64.1. Scripts: `typecheck` = `wxt prepare && tsc --noEmit`; `test` = `vitest run`; `build` = `wxt build`; `test:e2e` = `npm run build && playwright test`. Add a `postinstall` of `wxt prepare` only if needed for `npm ci` to work. `.gitignore` covers `node_modules/`, `.output/`, `.wxt/`, `test-results/`, `playwright-report/`. `tests/unit/smoke.test.ts` is a real minimal test (for example of `cn()` from `src/lib/utils.ts`). Vitest must not pick up `tests/e2e/**`; Playwright must only use `tests/e2e/**`.
- task-2: React and styling. Add `@wxt-dev/module-react` to `wxt.config.ts` `modules`, and `@tailwindcss/vite` to its Vite plugins. Make `@/*` resolve to `src/*` in Vite and `tsconfig.json`. Run `npx shadcn@4.23.0 init` (non-interactive flags) for Tailwind v4 with aliases `@/components`, `@/components/ui`, `@/lib`, `@/lib/utils`, CSS at `src/styles/globals.css`; it produces `components.json` and `src/lib/utils.ts`. Then replace the generated theme entirely with the token bridge:
  - `src/styles/tds/tokens.css`: TDS token definitions. Run `tds rules` and use RULE 2's token definitions, plus core tokens from `tds tokens all`, as CSS custom properties on `:root`. This is the only place hex values may appear.
  - `src/styles/globals.css`: import `./tds/tokens.css` first, then Tailwind; map shadcn variables per the DESIGN.md table (`--background`, `--card`, `--popover` -> `var(--surface-neutral-01)`; `--foreground`, `--card-foreground`, `--popover-foreground`, `--secondary-foreground`, `--accent-foreground` -> `var(--text-default)`; `--primary` -> `var(--interactive-default)`; `--primary-foreground` -> `var(--text-inverse)`; `--secondary`, `--muted` -> `var(--surface-neutral-02)`; `--muted-foreground` -> `var(--text-description)`; `--accent` -> `var(--surface-hover)`; `--destructive` -> `var(--border-negative)`; `--border` -> `var(--border-subtle)`; `--input` -> `var(--border-strong)`; `--ring` -> `var(--border-focus)`); `@theme inline` sets `--font-sans: var(--font-family);`; `@theme` sets `--color-*: initial;`; do not bridge `--radius` to `--radius-card`; no `.dark` block, no `@custom-variant dark`, and the word `dark` must not appear in the file. Body background uses `var(--background)`.
  - Verify computed values in a browser via the E2E test (task-5), not by inspection only. Watch for TDS core tokens colliding with Tailwind names such as `--color-neutral-100`.
- task-3: Minimal entrypoints. Reader page: React root that reads `?src=` and shows it as plain text (no rendering). Popup: one button that opens the reader page in a new tab. Background: `defineBackground` with no global mutable state. Content script `detect.content.ts`: matches `*://*/*.md`, `*://*/*.markdown`, `file:///*.md`, `file:///*.markdown`, does nothing yet. Manifest via `wxt.config.ts`: name "Markdown Reader", permissions `storage`, `contextMenus`, `tabs`, host permissions `<all_urls>`, no icons. No inline scripts in any HTML entrypoint.
- task-4: `tests/e2e/fixtures.ts`: Playwright fixture launching Chromium persistent context (`chromium.launchPersistentContext('', {...})`) with `--disable-extensions-except=<abs .output/chrome-mv3>` and `--load-extension=<same>`, exposing `extensionId` from the service worker URL. It launches its own Chromium; this is a user-approved exception to Brave attach mode. Use the `chromium` channel needed for extensions to load in headless mode, and record the Chromium version in `docs/spikes.md`.
- task-5: `tests/e2e/theme.spec.ts`: on the reader page, assert computed `--primary` equals computed `--interactive-default` (both resolved, non-empty); computed `--color-neutral-100` equals the TDS core value from `tds tokens colors`; `body` computed `background-color` equals the color that `--surface-neutral-01` resolves to (resolve via a probe element if needed).
- task-6: Spikes. Each is a passing test asserting the observed behavior, and `docs/spikes.md` records VERIFIED or REFUTED, the evidence, the Chromium version, and the chosen fallback for later phases:
  - (a) `spike-file-fetch.spec.ts`: the reader page `fetch()`es a `file://` fixture path when file access is granted. Granting file access for an unpacked extension in automation may need `chrome://extensions` toggling or the `--allow-file-access-from-files` style flags; investigate. If it cannot work, assert the observed failure and record REFUTED with the DESIGN.md fallback (content script passes `document.body.textContent`).
  - (b) `spike-fs-observer.spec.ts`: evaluate `'FileSystemObserver' in self` in the reader page; assert the observed boolean and record it. Fallback if absent: poll `getFile().lastModified` every second.
  - (c) `spike-mermaid-csp.spec.ts`: the reader page dynamically imports `mermaid` (12.3.0) and renders `graph TD; A-->B` to an `<svg>` with no CSP console error. The dynamic import must be bundled code, not a CDN. Implement the spike hook so it does not ship as product UI (for example, a dedicated spike code path triggered only by a query parameter such as `?spike=mermaid`, or a separate unlisted page under `src/entrypoints/`; if you add a new entrypoint file, list it in notes as a scope addition with reason). Assert the SVG exists and no console message contains `Content Security Policy`.
- Follow TDD where meaningful: write the E2E or unit assertion first, observe failure, then implement.

## Done When
- `.output/chrome-mv3/manifest.json` has `manifest_version` 3, permissions `storage`, `contextMenus`, `tabs`, and host permission `<all_urls>`.
- `docs/spikes.md` has VERIFIED or REFUTED for all three spikes, with the Chromium version.
- `theme.spec.ts` passes.
- `grep -rn 'dark' src/styles/globals.css` prints nothing.
- No oklch or hex colors outside `src/styles/tds/`: `grep -rnE 'oklch|#[0-9a-fA-F]{3,8}\b' src --include='*.css' --include='*.tsx' --include='*.ts' | grep -v 'src/styles/tds/'` prints nothing.
- Run from `/home/ngosi/projects/markdown-reader`, each exits 0 (Baseline: all fail, no `package.json`):
  - `rm -rf node_modules && npm ci`
  - `npm run typecheck`
  - `npm test`
  - `npm run build`
  - `npm run test:e2e`

## Rules
Read and follow these bundled contracts:
- Contract: `/home/ngosi/projects/refract/plugin/shared/worker-contract.md`
- Response: `/home/ngosi/projects/refract/plugin/shared/erp.md`
- Notes: `/home/ngosi/projects/refract/plugin/shared/notes-template.md`
- Journal: `/home/ngosi/projects/refract/plugin/shared/journal-template.md`

Role boundary: You are the phase implementer, not Coordinator. Work directly in `/home/ngosi/projects/markdown-reader`. Do not run Git commits, resets, stashes, branch changes, or ref updates. Do not invoke Coordinator skills or submit nested jobs. Use `refract ask "<question>"` for unresolved spec questions, or return `NEXT: BLOCKED` if unavailable.

## Response Format
Append the complete `# EXTERNAL RESPONSE` block to `docs/plans/markdown-reader-v1/phase-01/journal.md`, then return that block and the matching status line from `erp.md`.
