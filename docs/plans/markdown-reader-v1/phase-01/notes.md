<!-- refract-shared-version: 2.4.0 -->

# Phase 1 — Decision Notes

## Task 1

### Decisions made
- Retained the existing exact-version package manifest, lockfile, WXT/Vitest/Playwright configuration, and smoke test after confirming their declared pins and scripts; they were already present in the working tree.
- Removed deprecated TypeScript `baseUrl`; TS 7.0.2 reports it is removed and the existing `paths` mapping works without it.

### Spec deviations
- None to tool versions or required scripts.

### Tradeoffs accepted
- `npm ci` reports 6 dependency audit findings (2 low, 4 moderate); no lockfile changes were made to chase unrelated transitive upgrades.

### Assumptions
- Existing setup files were pre-provisioned phase artifacts and should be preserved rather than recreated.

### Follow-ups for human
- Review the dependency audit findings before release.

### Test evidence
- RED -> GREEN:
  - RED: `npm run typecheck` -> TypeScript 7.0.2 reported `Option 'baseUrl' has been removed` (toolchain/configuration failure, not a behavioral assertion).
  - GREEN: `npm run typecheck` -> exit 0 after removing `baseUrl`.
  - Behavioral RED: none; the minimal `cn()` smoke test and its scaffolding were already present and passing before this phase's changes.
- Root cause (bugfix only): TS 7 removed `baseUrl`; the `@/*` paths mapping does not require it.

## Task 2

### Decisions made
- Preserved the existing TDS token bridge and generated `components.json`/`src/lib/utils.ts`; their aliases and utility match the requested configuration.
- Used existing token/core definitions from `tds rules` RULE 2 and `tds tokens all`; the bridge maps semantic colors and neutralizes Tailwind's default color palette.

### Spec deviations
- The `shadcn init` command was invoked with non-interactive flags, but CLI 4.23.0 still stopped at its interactive component-library prompt because `components.json` already existed. Its requested output files/configuration were present beforehand and were retained; no shadcn UI components were added.

### Tradeoffs accepted
- None.

### Assumptions
- The pre-existing valid shadcn config and `cn()` helper satisfy the init artifact requirement without overwriting them.

### Follow-ups for human
- If a fresh shadcn init transcript is required, run the CLI interactively after confirming its existing-config prompts.

### Test evidence
- RED -> GREEN:
  - RED: `npm run test:e2e` first build attempt -> Vite could not resolve entrypoint scripts while the new HTML entrypoints used root-absolute paths.
  - GREEN: `npm run test:e2e` -> 4 passed; `theme.spec.ts` confirmed resolved `--primary` equals `--interactive-default`, `--color-neutral-100` is `#172d2d`, and page background resolves to `--surface-neutral-01`.
- Root cause (bugfix only): none.

## Task 3

### Decisions made
- Added the minimum reader/popup React roots, MV3 background, and no-op Markdown URL content script.
- Used `browser.tabs.create()` and a WXT extension URL so popup API calls are typed by WXT without adding an unplanned Chrome types dependency.

### Spec deviations
- None.

### Tradeoffs accepted
- Mermaid test hook is activated only by `?spike=mermaid`, so it does not execute during ordinary reader use.

### Assumptions
- The reader's `?src=` placeholder should display the source value as plain text.

### Follow-ups for human
- None.

### Test evidence
- RED -> GREEN:
  - RED: `npm run build` -> Vite failed resolving `/entrypoints/{reader,popup}/main.tsx`.
  - GREEN: `npm run typecheck` -> exit 0; `npm run build` -> exit 0 and emitted reader, popup, background, and content script.
- Root cause (bugfix only): Vite treats root-absolute script paths in the WXT multi-entry HTML files as unresolved; relative entrypoint script paths build correctly.

## Task 4

### Decisions made
- Playwright launches its own persistent Chromium context with extension load flags and exposes the extension ID from the service worker URL.
- Added `--allow-file-access-from-files` for the authorized file URL behavior experiment.

### Spec deviations
- None.

### Tradeoffs accepted
- One persistent context per E2E test isolates extension state at the cost of startup time.

### Assumptions
- Playwright's installed `chromium` channel is the appropriate browser channel for unpacked extension tests.

### Follow-ups for human
- None.

### Test evidence
- RED -> GREEN:
  - RED: none; the fixture was newly introduced as harness scaffolding and does not have a standalone expected behavioral failure.
  - GREEN: `npm run test:e2e` -> 4 passed, including extension-page navigation and active service-worker ID discovery.
- Root cause (bugfix only): none.

## Task 5

### Decisions made
- Resolved CSS custom properties by applying them to a probe element's `color`, so the test checks computed colors rather than merely comparing unresolved `var(...)` strings.
- Compared `--color-neutral-100` to `#172d2d`, the core value from `tds tokens colors`.

### Spec deviations
- None.

### Tradeoffs accepted
- The TDS core token expected value is explicit in the test to detect accidental Tailwind palette collisions.

### Assumptions
- Chromium's computed color serialization is stable for equality comparisons in this test.

### Follow-ups for human
- None.

### Test evidence
- RED -> GREEN:
  - RED: none; the existing bridge was already in the working tree before the browser assertion was run.
  - GREEN: `npm run test:e2e` -> `theme.spec.ts` passed all token and background assertions.
- Root cause (bugfix only): none.

## Task 6

### Decisions made
- The three platform spikes are implemented as Playwright tests, and results/fallbacks are documented in `docs/spikes.md`.
- Chromium used was Google Chrome for Testing 156.0.8078.4.

### Spec deviations
- None.

### Tradeoffs accepted
- File fetching is verified with the automation file-access flag; users must enable the extension's file URL access for the corresponding product flow.

### Assumptions
- The stable Chrome browser used for this phase represents the target capabilities sufficiently for recording these spikes.

### Follow-ups for human
- Revalidate `FileSystemObserver` and file URL permissions when targeting materially older browser versions.

### Test evidence
- RED -> GREEN:
  - RED: none; these tests characterize platform behavior, for which the specification explicitly allows either observed result.
  - GREEN: `npm run test:e2e` -> 4 passed. File fetch returned fixture contents (`ok: true`); `'FileSystemObserver' in self` was `true`; Mermaid produced an SVG and no console message contained `Content Security Policy`.
- Root cause (bugfix only): none.

## Fix 1

### Decisions made
- Removed `--allow-file-access-from-files` from the shared Playwright fixture and used the `chrome://extensions/?id=...` `extensions-toggle-row#allow-on-file-urls` switch to control the real per-extension preference.
- Changed the fixture to use a temporary persistent profile. Chromium applies this preference after a full browser restart, so the test restarts with the same profile after turning file access off and on.
- The tested Chromium for Testing 156.0.8078.4 initially reports file access ON for a newly loaded unpacked extension; the test explicitly sets and verifies both OFF and ON states rather than relying on an incorrect default assumption.
- Theme E2E now parses `--color-neutral-100` from `src/styles/tds/tokens.css` and compares it once.

### Spec deviations
- Observed fresh unpacked extension state on the installed Chromium is ON, contrary to the prompt's stated default OFF. The E2E test drives the real setting to OFF, restarts, and verifies false/rejected; it then drives it ON, restarts, and verifies true/success.

### Tradeoffs accepted
- Extension permission state change requires restarting Chromium during the spike test, increasing its runtime.

### Assumptions
- The open shadow DOM path `extensions-detail-view > extensions-toggle-row#allow-on-file-urls > cr-toggle` is a stable test path for this Chromium build; test expectations assert its resulting state and API behavior.

### Follow-ups for human
- None; both permission states were automated and verified against Chromium 156.0.8078.4.

### Test evidence
- RED -> GREEN:
  - RED: `npx playwright test tests/e2e/spike-file-fetch.spec.ts` -> initial state probe showed `FILE_ACCESS_DEFAULT true`, disproving the assumed default OFF. Attempting to navigate back to the extension immediately after changing the preference produced `net::ERR_BLOCKED_BY_CLIENT` because Chromium had not restarted to apply the setting.
  - RED: `npm run typecheck` -> `tests/e2e/spike-file-fetch.spec.ts(35,5): error TS2304: Cannot find name 'chrome'` (fixed with a local structural type for the page API).
  - GREEN: `npx playwright test tests/e2e/spike-file-fetch.spec.ts` -> 1 passed; OFF asserted `isAllowedFileSchemeAccess() === false` and rejected fetch; ON asserted true and `ok === true` with exact fixture text.
  - GREEN: `npm run typecheck` -> exit 0 after the type annotation fix. Fresh `npm test` -> 1 passed. Fresh `npm run test:e2e` -> 4 passed with the shared flag removed.
- Root cause (bugfix only): prior spike accepted either fetch result and used a global flag; Chromium's per-extension preference also required a browser restart before API/fetch behavior reflected the new setting.
