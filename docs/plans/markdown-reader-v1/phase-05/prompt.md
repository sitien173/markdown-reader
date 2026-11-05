# Phase 5: Entry points: auto-render, popup, background, file access

## Goal & Outcome
- Plan Goal: Deliver the Chrome MV3 Markdown Reader extension defined in `docs/plans/markdown-reader-v1/DESIGN.md`: one React reader page rendering local files, folders, and URLs through one sanitized pipeline, with shadcn/ui behavior and TDS look on Tailwind v4.
- Phase Outcome: Navigating to a raw `.md` URL shows the reader, and the popup offers working quick actions.

## Context & Architecture
- Root: `/home/ngosi/projects/markdown-reader` | Branch: `main` | Base: `refs/plans/markdown-reader-v1/phase-05/base`
- Prior State:
  - Phase 1: WXT 0.21.5 MV3 with `reader`, `popup`, `background.ts`, `detect.content.ts` entrypoints. Spike (a) in `docs/spikes.md`: `file://` fetch from the extension page works only when the user enables "Allow access to file URLs"; the E2E test toggles it through chrome://extensions and needs a restart.
  - Phase 2: `render(text, baseUrl)` in `src/render/pipeline.ts`, DOMPurify sanitizer, link resolver.
  - Phase 3: lazy enhancers; `src/ui/markdown-view.tsx`.
  - Phase 4: reader shell in `src/entrypoints/reader/App.tsx` with `load(url)` allowing only `http:`, `https:`, `file:`; `?src=` handling; `UrlSource` and `FileHandleSource` in `src/source/`; TDS-restyled shadcn components in `src/components/ui/` including Button, Dialog, Alert; `tds-announcement` with Retry.
  - Tests: E2E fixtures are served by a local Node HTTP server on 127.0.0.1 because Playwright routing misses extension-origin fetches; reuse the existing fixture server helper in `tests/e2e/fixtures.ts`. Playwright runs with `workers: 1`. Vitest render tests need `// @vitest-environment jsdom`. Baseline: `npm test` 56 pass, `npm run test:e2e` 13 pass.
- Read first: the Phase 5 section of `docs/plans/markdown-reader-v1/PLAN.md`; DESIGN.md sections on entry points, permissions, file access, and errors.

## Invariants & Boundaries
- Service worker keeps no global mutable state. Use async and await only. `onMessage` listeners that respond asynchronously `return true`.
- Content script does nothing unless `document.contentType` is `text/plain` or `text/markdown` and the URL path ends in `.md` or `.markdown`. Redirect must not loop: the reader page is never a redirect source.
- Request only permissions DESIGN.md lists; justify `tabs` by `tab.url` use in notes.
- UI uses the Phase 4 TDS-restyled components. Only `tds-*`, `tds-custom-*`, token-valued layout utilities, and TDS typography classes. No Tailwind color, radius, shadow, or font utilities. No hex or oklch outside `src/styles/tds/`. No `dangerouslySetInnerHTML`. Light theme only; visible focus.
- Out of Scope: editor, watching, folder mode, export.
- Forbidden: Git state changes, `.env` files, credentials, editing `PLAN.md`, `DESIGN.md`, `.handover.md`, `prompt.md`.

## Files
Allowed production and test paths: everything listed under Phase 5 Files in PLAN.md, plus:
- `src/source/*.ts` and `src/ui/*.tsx` (modify for integration only)
- `tests/e2e/fixtures.ts` and `tests/fixtures/**` (extend helpers and fixtures)
- `src/styles/reader.css`, `src/styles/popup.css` (create or modify)

Worker-owned phase records:
- `docs/plans/markdown-reader-v1/phase-05/notes.md` (append `## Task <M>` blocks)
- `docs/plans/markdown-reader-v1/phase-05/journal.md` (append `# EXTERNAL RESPONSE` under `## Implementation Response`)

## Tasks
Follow tasks 1 to 4 of the Phase 5 section of PLAN.md exactly. Notes:
- The fixture server must be able to serve a `.md` path as `text/plain` and an HTML page at a `.md` path as `text/html`.
- Popup E2E: open `chrome-extension://<id>/popup.html` in a tab and click its buttons; assert the reader opens in the expected mode via `?mode=` or equivalent.
- Context menu: unit-test the link filter; E2E is optional.
- Use TDD per task: failing test first, record RED -> GREEN in notes.

## Done When
- E2E: navigating to `http://127.0.0.1:<port>/doc.md` served as `text/plain` lands on the reader with rendered content.
- E2E: an HTML page at a `.md` path is not redirected.
- E2E: popup buttons open the reader in the expected mode; the recent list shows opened URLs newest first.
- Unit: `recent.ts` keeps at most 20, deduplicated, newest first.
- `grep -rn dangerouslySetInnerHTML src` prints nothing; `grep -rnE 'oklch|#[0-9a-fA-F]{3,8}\b|dark:|bg-black|shadow-|rounded-' src --include='*.tsx' --include='*.ts' --include='*.css' | grep -v src/styles/tds/` prints nothing.
- Run from the root, each exits 0 with no skipped tests: `npm ci`, `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e`.

## Rules
Read and follow these bundled contracts:
- Contract: `/home/ngosi/projects/refract/plugin/shared/worker-contract.md`
- Response: `/home/ngosi/projects/refract/plugin/shared/erp.md`
- Notes: `/home/ngosi/projects/refract/plugin/shared/notes-template.md`
- Journal: `/home/ngosi/projects/refract/plugin/shared/journal-template.md`

Role boundary: You are the phase implementer, not Coordinator. Work directly in `/home/ngosi/projects/markdown-reader`. Do not run Git commits, resets, stashes, branch changes, or ref updates. Do not invoke Coordinator skills or submit nested jobs. Use `refract ask "<question>"` for unresolved spec questions, or return `NEXT: BLOCKED` if unavailable.

## Response Format
Append the complete `# EXTERNAL RESPONSE` block to `docs/plans/markdown-reader-v1/phase-05/journal.md`, then return that block and the matching status line from `erp.md`.
