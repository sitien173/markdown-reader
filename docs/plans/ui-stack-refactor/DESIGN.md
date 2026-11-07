# UI Stack Refactor Design

**Status:** Confirmed 2026-11-07
**Consultation:** Two read-only consults, openai eb7b98e3 and google b4c71faf. Both ranked race regressions first, put tooling and state extraction before visual work, rejected `cmdk` and Motion, and advised dropping React Hook Form. Google's ordering of the Base UI swap together with TDS removal was adopted.

## Purpose

Move the Markdown Reader extension UI from shadcn on Radix with the Trulioo Design System look to the preferred frontend stack, and redesign the UX: command palette, shortcuts, welcome screen, collapsible sidebar with scroll-spy, focus mode, toasts, and system dark mode.

## Users and Success Criteria

Users: people reading and editing Markdown from local files, folders, and URLs in Chrome.

Success criteria:

- No `tds-` class, `src/styles/tds/` file, or `@radix-ui/*` dependency remains.
- UI primitives come from shadcn `base-nova` on `@base-ui/react`; icons from lucide-react.
- Light and dark themes follow `prefers-color-scheme` across shell, editor, Shiki, Mermaid, KaTeX, and HTML export. Print is always light.
- Command palette, shortcuts, welcome screen, collapsible sidebar, scroll-spy, focus mode, toasts, and the single status banner work and have E2E coverage.
- pnpm with a pinned version and frozen lockfile; Biome lint and format pass.
- All v1 behavior and gates hold: S3 per-keystroke median under 100 ms, S4 first content under 500 ms, S8, S9, export zero network requests, XSS fixtures, race guards.

## Constraints, Invariants, and Non-Goals

Constraints:

- WXT 0.21.5 and Vite 8 stay. Next.js is rejected: Chrome rejects `_next/` extension paths and MV3 CSP blocks inline scripts.
- TypeScript stays at 7.0.2.
- MV3 CSP: no inline scripts, no `eval`. Zod runs with `z.config({ jitless: true })`.
- Offline: no network fonts or assets.

Invariants:

- Render pipeline, DOMPurify sanitization, link resolution, and lazy Shiki, KaTeX, and Mermaid loading are unchanged in behavior.
- Race protocol: generation counter, `isCurrent()`, source identity checks, and saves pinned to the committed path.
- The `onEdit` to `viewRef.update` path bypasses React state.
- IndexedDB and `chrome.storage` keys and formats are unchanged.
- Background and content scripts gain no new dependencies.

Non-goals:

- Manual theme toggle.
- React Hook Form, Motion, and `cmdk`.
- New file sources or Markdown features.
- Shared state between popup and reader.

## Chosen Approach

Approach A, staged with layout parity first: characterization tests, tooling, state extraction with unchanged screens, Base UI swap with TDS removal at the current layout, dark mode, new shell, palette and shortcuts, then motion, accessibility, and audit.

- Rejected B, primitives before restyle: every component would be styled twice.
- Rejected C, parallel new shell: long-broken tests and duplicated race logic.

## Architecture and Data Flow

State:

- `src/store/reader-store.ts`: Zustand store for mode, source, document path, loading, headings, recents, sidebar open and tab, focus mode, and separate status flags: error, external change, conflict, dirty, writable.
- `src/reader/controller.ts`: `load`, `openFile`, `openFolder`, `selectTreeFile`, `save`, `overwrite`, `reloadFromDisk`, `drop`, moved from `src/entrypoints/reader/App.tsx` with the guard refs in module scope.
- Kept outside the store: draft text, editor and view instances, watchers, abort controllers, render caches.

Commands:

- `src/reader/commands.ts`: registry of id, label, shortcut, availability, and run. Toolbar, palette, and shortcuts call the same command. Pickers open synchronously from user activation.

Validation:

- `src/lib/schemas.ts` with `zod/mini`; `jitless` set in reader and popup `main.tsx`.
- Boundaries: captured-text read in the reader, stored handle metadata, recent-URL storage read, Open URL dialog. The URL rule reuses `isAllowedUrl`, so `file:` stays allowed.

Components:

- `src/components/ui/`: regenerated `base-nova` components.
- Command palette: custom component on Base UI Dialog and Autocomplete.
- Toasts: Base UI Toast.

Theme:

- `src/styles/globals.css`: `base-nova` variable names with Apple-style values; `@custom-variant dark (@media (prefers-color-scheme: dark))`; `:root { color-scheme: light dark }`.
- Fonts: `system-ui, -apple-system, "Inter", sans-serif` with bundled Inter 400, 500, 600; mono `ui-monospace, SFMono-Regular, Menlo, monospace`.
- `src/styles/markdown.css`: plain CSS scoped to `.md-content`, shared by reader and export; 56rem max width.
- Shiki: dual themes `github-light` and `github-dark` in one output, switched by media query.
- Mermaid: source retained; theme colors read as hex from computed values; only diagrams rerender on theme change; stale results dropped.
- KaTeX: bundled CSS and fonts; inherits text color.
- `src/styles/editor.css`: light and dark tokens.
- `src/export/export-styles.ts`: replaces `src/styles/tds/export-styles.ts`. Export embeds both schemes; each diagram exported twice with disjoint SVG ids and selected by CSS; no scripts; zero network requests.

UX shell:

- Toolbar: sidebar toggle; title with dirty dot and "Unsaved changes" screen-reader text; Read, Edit, Split switch; Open menu with File, Folder, URL; Save when writable; Export menu with HTML and Print; palette button with Cmd+K hint.
- Open URL: dialog with native form, Zod check, inline error.
- Welcome screen: Open file, Open folder, Open URL, window-wide drop overlay, recents with Reconnect.
- Sidebar: Cmd+\ or toolbar toggle; CSS width transition; Contents and Files tabs; scroll-spy via `IntersectionObserver`.
- Focus mode: hides toolbar and sidebar; from palette or toolbar; Esc exits; no default shortcut.
- Palette, Cmd/Ctrl+K: groups Actions, Headings, Folder files, Recents.
- Shortcuts: Cmd/Ctrl+S save, +O open file, +\ sidebar, +P print, +K palette, each with `preventDefault`.
- Status: save conflict stays a dialog; one banner shows the highest-priority persistent condition, error with Retry then external change with Reload; toasts for saved, exported, and recent-list notices, announced politely.
- Popup: action list with Open reader, Open editor, Render this tab, recents with truncation and tooltip; file-access dialog kept.

Motion:

- CSS transitions on Base UI `data-starting-style` and `data-ending-style`; a View Transition from welcome screen to document; `prefers-reduced-motion` disables motion. No animation on Markdown updates.

## Errors and Edge Cases

- Overlapping open, save, reload, and tree selection: guarded by the unchanged race protocol.
- Status flags coexist; dismissing an error keeps the external-change prompt.
- Theme change during diagram rendering: earlier-theme results dropped.
- Unavailable or cancelled pickers: existing messages; cancel shows no error.
- Palette without a document: document commands disabled, not hidden.
- Shortcut claimed by the browser: command stays reachable in palette and toolbar.

## Migration

Phases, each ending with a checkpoint commit, consolidated into one commit on `main`:

1. Safety tests and selector hooks: race, conflict Cancel, Reconnect failure, keyboard tests; replace `.tds-*` lookups in `markdown-view.tsx`, `toc.ts`, `toc-panel.tsx`, and `App.tsx` export with refs or `data-slot`.
2. Tooling: pnpm pinned, declare `@shikijs/core` and `@shikijs/langs`, Biome, one separate formatting change.
3. Store, controller, Zod with screens unchanged.
4. Base UI and TDS removal at current layout; Apple-style light theme; move export styles.
5. Dark mode across shell, editor, Shiki, Mermaid, KaTeX, export; print light.
6. New shell: toolbar, Open URL dialog, welcome, sidebar, scroll-spy, focus mode, banner, toasts, popup.
7. Command palette and shortcuts.
8. Motion, reduced motion, contrast, full regression and distribution audit.

No data migration: storage keys and formats are unchanged.

## Testing

- Phase 1 characterization: save during selection, edit during reload, explicit-path Overwrite, conflict Cancel, Reconnect exception, tab, menu, and dialog keyboard paths.
- Narrow `tests/e2e/enhance.spec.ts:54` to leaked Mermaid artifacts so lucide SVGs pass.
- Theme, export, and enhance E2E specs run with Playwright `colorScheme` light and dark.
- Gates unchanged: S3, S4, S8, S9, export zero requests, XSS fixtures.
- Every phase: `pnpm typecheck`, `pnpm biome ci`, `pnpm test`, `pnpm test:e2e`.

## Risks and Open Questions

1. Wrong-file save during extraction. Mitigation: Phase 1 race tests before Phase 3.
2. Typing latency from store subscriptions. Mitigation: draft text stays outside the store; S3 gate.
3. Undeclared dependencies under pnpm, starting with `@shikijs/*`. Mitigation: Phase 2 audit.
4. Browser-reserved shortcuts. Mitigation: Phase 7 E2E; commands stay reachable without shortcuts.
5. Unverified: exact `base-nova` output of shadcn CLI 4.23.0. Phase 4 records it.
6. Contrast in both themes. Phase 8 check.
7. TDS polish committed in e100b02: carry `markdown.css` typography into Phase 4 with new token names.
