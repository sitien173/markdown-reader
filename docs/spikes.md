# Phase 1 platform spikes

Tested with Playwright 1.64.1 using Chromium for Testing 156.0.8078.4 (persistent extension context; no global file-access flags).

## (a) Extension page fetches `file://` URLs — VERIFIED

`spike-file-fetch.spec.ts` uses the actual `Allow access to file URLs` switch at `chrome://extensions/?id=<extension-id>` (the `extensions-toggle-row#allow-on-file-urls` control), not a global Chromium flag. It asserts `chrome.extension.isAllowedFileSchemeAccess()` and the corresponding `fetch()` behavior in both states: with the switch OFF, the API returns `false` and the fixture fetch rejects; with the switch ON, the API returns `true` and fetch returns `ok === true` with text exactly matching `tests/fixtures/local-file.md`. Chromium required a full browser-context restart after changing the switch before the new permission state took effect.

On this Chromium for Testing 156.0.8078.4 build, a fresh unpacked extension initially reported file access enabled, rather than OFF. The test explicitly sets OFF through the real extension UI, restarts, asserts OFF/rejection, then turns it ON through the UI, restarts, and asserts ON/exact fixture content. No `--allow-file-access-from-files` flag is used. Later phases can use direct `file://` fetches only after users grant the extension's file URL access. If access is disabled, use the DESIGN.md fallback: the content script passes `document.body.textContent` to the reader; file URL auto-reload is then limited.

## (b) `FileSystemObserver` availability — VERIFIED

`spike-fs-observer.spec.ts` evaluated `'FileSystemObserver' in self` in the reader page and observed `true`. Later phases should use `FileSystemObserver`; retain polling `getFile().lastModified` every second as the fallback if unavailable in a target environment.

## (c) Mermaid 12.3.0 under MV3 CSP — VERIFIED

Phase 3 moved this spike from the removed `?spike=mermaid` hook to the production Markdown render/enhance path in `spike-mermaid-csp.spec.ts`.

`spike-mermaid-csp.spec.ts` dynamically imported bundled Mermaid 12.3.0, rendered `graph TD; A-->B` to an SVG, and observed no console message containing `Content Security Policy`. Later phases can use bundled dynamic import from the extension page without weakening CSP or using a CDN.
