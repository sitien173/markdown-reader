<!-- refract-shared-version: 2.4.0 -->

# Phase 5 — Decision Notes

## Task 1

### Decisions made
- The content script hands `{url, text}` to the service worker by runtime message; the worker saves it to `storage.session` and uses `tabs.update` to navigate. Direct navigation from the text document was blocked by Chromium (`ERR_BLOCKED_BY_CLIENT`), and content-script access to `storage.session` was denied under its default access level.
- Reader consumes captured text once, then falls back to `FileUrlSource` for `file:` URLs and `UrlSource` otherwise. The Phase 1 file-fetch spike supports this approach.
### Spec deviations
- Redirect navigation is performed by the service worker via `tabs.update`, rather than `location.replace`, because the Chromium E2E reproduction showed direct extension URL navigation from a text page was blocked. URL still targets the reader and no reader URL is a redirect source.
### Tradeoffs accepted
- none
### Assumptions
- Content script only extracts text from matching raw Markdown pages and the service worker is available for the capture message.
### Follow-ups for human
- none
### Test evidence
- RED -> GREEN:
  - RED: `npm test -- --run tests/unit/detect.test.ts` -> `expected false to be true` for raw text at `/readme.md`.
  - GREEN: `npm test -- --run tests/unit/detect.test.ts` -> 1 test passed; only allowed MIME types and Markdown suffixes pass.
  - Integration RED: `npm run test:e2e -- --grep 'plain Markdown navigations'` -> expected reader extension URL; received original `doc.md`, and direct navigation reproduction showed `ERR_BLOCKED_BY_CLIENT`.
  - Integration GREEN: `npm run test:e2e -- --grep 'plain Markdown navigations'` -> 1 passed; raw text redirects and HTML at `.md` remains in place.
- Root cause (bugfix only): direct page-script redirect to the extension origin was blocked; delegating tab navigation and session write to the privileged service worker fixes the reproduction.

## Task 2

### Decisions made
- Context-menu link validation parses the URL and checks the pathname suffix case-insensitively, excluding query/fragment text.
- Context-menu action opens an extension reader tab for matching `.md`/`.markdown` links.
### Spec deviations
- none
### Tradeoffs accepted
- Context-menu feedback is the opened reader tab; no extra notification permission was introduced.
### Assumptions
- `tabs` permission is needed to read active tab `tab.url` for popup Render current tab and to update/create tabs for popup/context-menu actions.
### Follow-ups for human
- none
### Test evidence
- RED -> GREEN:
  - RED: `npm test -- --run tests/unit/recent.test.ts tests/unit/background.test.ts` -> link-filter assertion failed (`expected false to be true`); the recent store returned `[]`, failing the 20-entry assertion.
  - GREEN: `npm run typecheck && npm test -- --run tests/unit/recent.test.ts tests/unit/background.test.ts` -> typecheck passed; 2 files/3 tests passed.
- Root cause (bugfix only): initial inert link-filter and recent-store scaffolds did not implement required behavior; replaced with URL validation and storage-backed capped dedupe.

## Task 3

### Decisions made
- Popup actions message the background worker; Open viewer and Open editor request `mode=read` and `mode=edit`. Render current tab reads `tab.url` and routes disabled `file://` access to the TDS Dialog.
- Recent URL storage deduplicates and keeps the 20 latest, newest first.
### Spec deviations
- none
### Tradeoffs accepted
- Recent entries display their URLs directly as Button actions for quick re-opening.
### Assumptions
- Chrome's `extension.isAllowedFileSchemeAccess()` API is available in the popup context.
### Follow-ups for human
- none
### Test evidence
- RED -> GREEN:
  - RED: `npm test -- --run tests/unit/recent.test.ts tests/unit/background.test.ts` -> recent list was empty and filter returned false for valid Markdown links.
  - GREEN: `npm run test:e2e -- --grep 'popup actions'` (covered in complete E2E run) -> popup opened reader with `mode=read` and `mode=edit`; recent URLs appeared newest first. Full E2E: 15 passed, 0 skipped.
- Root cause (bugfix only): initial scaffolds had no storage or routing behavior; implemented local storage, popup messaging, and service worker tab creation.

## Task 4

### Decisions made
- Async runtime message listeners always return `true`, including session capture and popup actions.
- Allowed host permissions remain `<all_urls>`; no permissions beyond the Design's `storage`, `contextMenus`, and `tabs` were added.
### Spec deviations
- none
### Tradeoffs accepted
- none
### Assumptions
- Context menu registration on extension install is sufficient; Chrome persists the registered menu item.
### Follow-ups for human
- `npm ci` reports 8 dependency audit findings (4 low, 4 moderate); no automatic package updates were applied.
### Test evidence
- RED -> GREEN:
  - RED: `npm run test:e2e -- --grep 'plain Markdown navigations'` -> initial assertion did not reach reader; documented in Task 1 root cause.
  - GREEN: fresh full verification after implementation `npm ci && npm run typecheck && npm test && npm run build && npm run test:e2e` -> typecheck passed; 10 files/60 unit tests passed; build passed; E2E 15 passed, 0 skipped. Both required source grep guards returned no matches.
- Root cause (bugfix only): addressed with service-worker tab update and no additional changes were necessary after full verification.

## Coordinator scope note
- `tests/unit/background.test.ts` and `tests/unit/detect.test.ts` are outside the Phase 5 Files list. Accepted as test-only scope additions.
- Validation: npm ci 0, typecheck 0, 60 unit tests passed, E2E 15 passed with 0 skipped, greps clean.

## Fix cycle 1

### Decisions made
- Serialize recent URL read-modify-write with the browser Web Locks API under the stable `recent-urls` lock name.
- Derive capture keys exclusively from the validated `sender.tab.url`, and use `{ url, text, ts }` session values with one-time read/removal.
- Share URL scheme validation from `src/source/url.ts`; rejected context-menu links show a toolbar badge/title so no additional permission is needed.
- Popup keyboard focus feedback uses a token-based `:focus-visible` outline in its stylesheet.

### Spec deviations
- none

### Tradeoffs accepted
- Rejected context-menu URLs leave a `!` badge until a supported context-menu URL is opened; this uses the existing `action` API and no notification permission.

### Assumptions
- Chrome's Web Locks API is available in the extension reader context.

### Follow-ups for human
- `npm ci` reports 8 dependency audit findings (4 low, 4 moderate); no automatic dependency updates were applied.

### Test evidence
- RED -> GREEN:
  - RED: `npm test -- --run tests/unit/recent.test.ts tests/unit/background.test.ts tests/unit/captured-text.test.ts` -> delayed concurrent recent test lost entries (`expected length 8; received 1`); capture validation and shared URL scheme tests also failed before implementation. The first captured-text invocation additionally showed the absent module scaffold, then was rerun after adding the helper.
  - GREEN: `npm run typecheck && npm test` -> typecheck passed; 11 files / 65 tests passed, 0 skipped.
  - RED: `npm run test:e2e -- --grep 'popup actions'` -> popup's primary action had no focus-visible styling; asserted focus with keyboard.
  - GREEN: `npm run test:e2e -- --grep 'popup actions'` -> 1 passed; keyboard focus-visible outline and requested reader mode verified.
  - `npm run test:e2e` -> final full run: 15 passed, 1 failed, 0 skipped; only the existing 1 MiB render timing gate failed (best 5086 ms against 5000 ms). The 1 MiB threshold test is outside the Phase 5 allowed file scope and was not modified.
  - Root cause (bugfix only): concurrent storage writes raced between `get` and `set`; capture accepted untrusted URL data and lacked TTL; reader only removed a capture after rendering and recent-store failure was in the same catch path; unsupported schemes were not rejected at entry points.

## Coordinator validation after fix cycle 1
- Fact: npm ci 0, typecheck 0, 65 unit tests passed, E2E 16 passed with 0 skipped, greps clean.
- Fact: the 1 MiB timing gate measured 5086 ms in the worker run and 4499 ms best in the Coordinator run, with host load average 16 to 24.
- Decision: keep the 5000 ms ceiling for now. Phase 8 must replace it with a load-normalized gate in perf.spec.ts.
