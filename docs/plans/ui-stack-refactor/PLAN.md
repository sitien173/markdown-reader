# UI Stack Refactor Plan

**Design:** [DESIGN.md](DESIGN.md)
**Context key:** `ui-stack-refactor`
**Base:** `refs/plans/ui-stack-refactor/base` (`e100b02`)
**Commit:** `feat(ui): move reader to Base UI shadcn with Apple-style design, dark mode, and redesigned UX`

## Outcome & Scope

Move the Markdown Reader extension UI to shadcn `base-nova` on `@base-ui/react`, remove the Trulioo Design System, add system dark mode across shell, editor, Shiki, Mermaid, KaTeX, and HTML export, switch to pnpm and Biome, extract reader state to Zustand with `zod/mini` boundary checks, and deliver the redesigned shell: toolbar, welcome screen, collapsible sidebar with scroll-spy, focus mode, status banner, toasts, Open URL dialog, command palette, and shortcuts.

Preserved invariants, every phase:

- Render pipeline, DOMPurify sanitization, link resolution, and lazy Shiki, KaTeX, and Mermaid loading keep their behavior.
- Race protocol in the reader: generation counter, `isCurrent()`, source identity checks, saves pinned to the committed path.
- `onEdit` updates the preview through `viewRef.update` without React state.
- IndexedDB and `chrome.storage` keys and value formats are unchanged.
- `src/entrypoints/background.ts` and `src/entrypoints/detect.content.ts` gain no new dependencies.
- Gates: S3 per-keystroke median under 100 ms, S4 first content under 500 ms, S8, S9, export zero network requests, XSS fixtures.
- WXT 0.21.5, Vite 8, React 19.3.1, TypeScript 7.0.2 stay.

Out of scope: manual theme toggle, React Hook Form, Motion, `cmdk`, new file sources, new Markdown features, popup and reader shared state, `.output/` and `.wxt/` generated files.

Secret-bearing files: none known. Workers must not read or write files outside this repository.

## Baseline Evidence

Measured at `e100b02` on 2026-11-07 with host load average 66 to 132 on 8 cores from unrelated jobs.

- `npm run typecheck`: pass.
- `npx vitest run`: run 1, 172 passed, 9 failed, 4 errors; run 2, 7 files and 15 tests passed, 14 files failed to start with `[vitest-pool]: Failed to start forks worker`.
- `npm run test:e2e`: build passed; 13 passed, 11 failed, 3 did not run in 15.3 min. Every failure is a 30 s timeout, `Target page, context or browser has been closed`, or context setup timeout. Failing: `entry.spec.ts` 19, 28, 44; `export.spec.ts` 4, 77; `perf.spec.ts` 18; `reader.spec.ts` 7, 17, 36; `reload.spec.ts` 55; `spike-file-fetch.spec.ts` 65. Not run: `perf.spec.ts` 51, 80, 95.

Inference: the failures are environmental. No failure shows an assertion mismatch on rendered content. Phase 1 Task 1 re-establishes the baseline on a quiet host before any change.

### Phase 1: Baseline, characterization tests, and selector hooks

**Task Guide Input:** Frontend test and client implementation. Re-establish a green baseline, add characterization tests for reader race paths and keyboard behavior, and replace behavioral `.tds-*` DOM lookups with stable hooks without changing appearance.
**Goal:** A green, trustworthy test suite that pins current reader behavior and no longer depends on TDS class names for behavior.
**Depends on:** none
**Invariants & Boundaries:** No visual change. No production behavior change except the selector swap. Do not touch styles, components in `src/components/ui/`, or dependencies other than adding test-only packages if strictly required. `.tds-*` class names stay on elements for styling; only lookups change.
**Files:**
- Modify: `vitest.config.ts`
- Modify: `src/ui/markdown-view.tsx`
- Modify: `src/toc/toc.ts`
- Modify: `src/ui/toc-panel.tsx`
- Modify: `src/entrypoints/reader/App.tsx`
- Modify: `tests/e2e/enhance.spec.ts`
- Create: `tests/unit/reader-app.test.tsx`
- Create: `tests/e2e/keyboard.spec.ts`
**Tasks:**
1. Run `npm run typecheck`, `npx vitest run --no-file-parallelism`, and `npm run test:e2e` when `uptime` load average is below 8. Record counts in the phase journal. A failure that reproduces at low load is fixed here with a RED test first; an environmental failure is recorded, not patched.
2. Add `data-slot="reader-content"` to the reader content section and `data-slot="markdown"` to the Markdown container. Replace the lookups at `src/ui/markdown-view.tsx:90`, `src/toc/toc.ts:15`, `src/ui/toc-panel.tsx`, and the export container query in `src/entrypoints/reader/App.tsx` with refs or `[data-slot=...]` selectors. Narrow `tests/e2e/enhance.spec.ts:54` to assert no leaked Mermaid artifacts instead of no SVG outside Markdown.
3. Extend `vitest.config.ts` `include` to `tests/unit/**/*.{test,spec}.{ts,tsx}`. Create `tests/unit/reader-app.test.tsx` rendering the reader `App` with `react-dom/client` in happy-dom, using `vi.mock` for source and store modules and deferred promises. Cover: tree selection during an in-flight save writes to the committed path; edits during reload are not lost; explicit-path Overwrite; conflict Cancel leaves content and dirty state unchanged; Reconnect exception surfaces an announcement. Each test must fail when the guard it covers is removed; verify by temporarily disabling the guard and record the result in the journal.
4. Create `tests/e2e/keyboard.spec.ts`: sidebar tabs ArrowRight moves focus and activates the panel; Export menu opens with Enter, Escape closes it and restores focus to the trigger; save-conflict and file-access dialogs close on Escape and Cancel and restore focus.
**Acceptance Criteria:**
- `grep -rn "querySelector\|closest" src | grep "tds-"` prints nothing.
- New unit and E2E tests pass, and each race test fails with its guard disabled.
- No change in rendered appearance; existing E2E specs pass unchanged except `enhance.spec.ts:54`.
**Reviewer Checklist:**
- Race tests assert observable outcomes, not implementation calls.
- Mocks do not bypass the guard logic under test.
- Selector hooks are stable attributes, not new class names.
**Verification Checks:**
- `npm run typecheck`
- `npx vitest run --no-file-parallelism`
- `npm run test:e2e`

### Phase 2: pnpm and Biome

**Task Guide Input:** Tooling change. Replace npm with pnpm, declare undeclared dependencies, add Biome lint and format, and apply formatting once as the final mechanical step.
**Goal:** Reproducible pnpm install and passing Biome CI with no behavior change.
**Invariants & Boundaries:** No dependency version changes except adding `@shikijs/core` 4.6.0, `@shikijs/langs` 4.6.0, and `@biomejs/biome` pinned exactly. No source edits beyond Biome fixes that are formatting or safe autofixes. Exclude `.output`, `.wxt`, `node_modules`, `test-results`, `tests/fixtures` from Biome.
**Files:**
- Modify: `package.json`
- Delete: `package-lock.json`
- Create: `pnpm-lock.yaml`
- Create: `biome.json`
- Modify: `README.md`
- Modify: `docs/manual-checklist.md` if it names npm commands
- Modify: any `src/` and `tests/` file touched by Biome formatting
**Tasks:**
1. Set `packageManager` to the installed pnpm version, run `pnpm import` to create `pnpm-lock.yaml` from `package-lock.json`, delete `package-lock.json`, add `@shikijs/core` and `@shikijs/langs` at 4.6.0, change `test:e2e` to `pnpm build && playwright test`, and confirm `pnpm install --frozen-lockfile` and `pnpm build` succeed. Add `.npmrc` only if a build fails without hoisting, and record why.
2. Add `@biomejs/biome` pinned exactly, create `biome.json` with formatter, linter recommended rules, and the exclusions above, add scripts `lint` = `biome ci .` and `format` = `biome format --write .`. Fix lint errors without changing behavior; disable a rule only with a recorded reason.
3. Run `pnpm format` as the last task, in a separate set of hunks, so the Coordinator can checkpoint tooling and formatting as two commits.
4. Replace npm commands in `README.md` and `docs/manual-checklist.md`.
**Acceptance Criteria:**
- `package-lock.json` absent; `pnpm install --frozen-lockfile` exits 0.
- `pnpm lint` exits 0.
- Typecheck, unit, and E2E counts match the Phase 1 recorded baseline.
**Reviewer Checklist:**
- No dependency version drift in `pnpm-lock.yaml` beyond the listed additions.
- Lint fixes do not change runtime behavior, especially in `src/entrypoints/reader/App.tsx` race code.
**Verification Checks:**
- `pnpm install --frozen-lockfile`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm exec vitest run --no-file-parallelism`
- `pnpm test:e2e`

### Phase 3: Reader store, controller, and boundary validation

**Task Guide Input:** Frontend client state refactor. Extract reader state into Zustand and source actions into a controller, add `zod/mini` boundary schemas, keep the UI pixel-identical.
**Goal:** `App.tsx` becomes a view over a store and controller with unchanged behavior.
**Invariants & Boundaries:** DOM output and appearance unchanged. Draft text, editor and view instances, watchers, abort controllers, and render caches stay outside the store. Guard refs live in controller module scope. The `onEdit` path stays outside React state. No Zod import in `src/entrypoints/background.ts` or `src/entrypoints/detect.content.ts`. `chrome.storage` and IndexedDB formats unchanged.
**Files:**
- Modify: `package.json`, `pnpm-lock.yaml`
- Create: `src/store/reader-store.ts`
- Create: `src/reader/controller.ts`
- Create: `src/lib/schemas.ts`
- Modify: `src/entrypoints/reader/App.tsx`
- Modify: `src/entrypoints/reader/main.tsx`
- Modify: `src/entrypoints/popup/main.tsx`
- Modify: `src/source/captured-text.ts`
- Modify: `src/store/handles.ts`
- Modify: `src/store/recent.ts`
- Create: `tests/unit/reader-store.test.ts`
- Create: `tests/unit/controller.test.ts`
- Create: `tests/unit/schemas.test.ts`
**Tasks:**
1. Add `zustand` and `zod` pinned exactly. Create `src/lib/schemas.ts` using `zod/mini` only; call `z.config({ jitless: true })` in reader and popup `main.tsx` before render. Validate the captured-text record in `usableCapturedText`, stored handle metadata in `getRecentHandles`, and the stored recent-URL list in `getRecentUrls`; invalid data yields the same fallback as today. RED tests first in `tests/unit/schemas.test.ts`.
2. Create `src/store/reader-store.ts` with mode, source, document path, loading, headings, recents, sidebar open and tab, focus mode, and separate status flags: `error`, `externalChange`, `conflict`, `dirty`, `writable`, plus `notice`. Add a derived banner selector ordered error, then external change.
3. Create `src/reader/controller.ts` holding `load`, `openFile`, `openFileHandle`, `openFolder`, `openFolderHandle`, `selectTreeFile`, `save`, `overwrite`, `reloadFromDisk`, `checkExternal`, `drop`, and `handleOpenRecent`, moved from `App.tsx` with the guard protocol intact. `App.tsx` subscribes with selectors and calls controller actions. `tests/unit/controller.test.ts` covers stale-generation drops and pinned save path.
4. Keep `tests/unit/reader-app.test.tsx` from Phase 1 passing without weakening its assertions.
**Acceptance Criteria:**
- `src/entrypoints/reader/App.tsx` contains no `sourceGenRef` or async source logic.
- `grep -rn "zod" src/entrypoints/background.ts src/entrypoints/detect.content.ts` prints nothing.
- All Phase 1 race tests pass unchanged; S3 gate passes.
**Reviewer Checklist:**
- Every awaited resume point in the controller still checks the generation and identity.
- No store subscription re-renders on every keystroke.
- Schema fallbacks match prior behavior for malformed storage.
**Verification Checks:**
- `pnpm lint`
- `pnpm typecheck`
- `pnpm exec vitest run --no-file-parallelism`
- `pnpm test:e2e`

### Phase 4: Base UI primitives and TDS removal at current layout

**Task Guide Input:** Frontend UI and CSS implementation. Switch shadcn to `base-nova` on `@base-ui/react`, remove TDS and Radix, apply an Apple-style light theme, keep the current layout and flows.
**Goal:** No TDS or Radix remains; the app looks Apple-style in light mode with the same layout and behavior.
**Invariants & Boundaries:** Layout regions, controls, labels, and flows unchanged. Accessible names unchanged so role-based selectors keep working. Export keeps zero network requests and no scripts. Do not add dark mode, toasts, palette, or new layout here. Fonts: `system-ui, -apple-system, "Inter", sans-serif` with bundled `@fontsource/inter` 400, 500, 600; mono `ui-monospace, SFMono-Regular, Menlo, monospace`.
**Files:**
- Modify: `components.json`
- Modify: `package.json`, `pnpm-lock.yaml`
- Modify: `src/components/ui/alert.tsx`, `button.tsx`, `collapsible.tsx`, `dialog.tsx`, `dropdown-menu.tsx`, `input.tsx`, `spinner.tsx`, `tabs.tsx`, `toggle.tsx`, `toggle-group.tsx`, `tooltip.tsx`
- Delete: `src/styles/tds/` and every file in it
- Create: `src/export/export-styles.ts`
- Modify: `src/export/export.ts`
- Modify: `src/styles/globals.css`, `src/styles/markdown.css`, `src/styles/reader.css`, `src/styles/popup.css`, `src/styles/editor.css`
- Modify: `src/ui/announce.tsx`, `editor-pane.tsx`, `file-access-dialog.tsx`, `file-tree.tsx`, `markdown-view.tsx`, `recent-section.tsx`, `save-conflict-dialog.tsx`, `toc-panel.tsx`, `top-bar.tsx`
- Modify: `src/toc/toc.ts`
- Modify: `src/entrypoints/reader/App.tsx`, `src/entrypoints/popup/App.tsx`
- Modify: `tests/e2e/theme.spec.ts`, `editor.spec.ts`, `enhance.spec.ts`, `entry.spec.ts`, `export.spec.ts`, `perf.spec.ts`, `reader.spec.ts`, `reload.spec.ts`, `spike-mermaid-csp.spec.ts`
- Modify: `tests/unit/export.test.ts`, `tests/unit/file-tree.test.ts`
**Tasks:**
1. Set `components.json` style to `base-nova`, add `@base-ui/react` pinned exactly, regenerate the listed components with the shadcn CLI, and remove every `@radix-ui/*` dependency. Record the CLI version and generated component list in the journal. Convert `asChild` call sites at `src/ui/top-bar.tsx:60` and `src/ui/file-tree.tsx:22` to `render`. Map the mode `ToggleGroup` scalar value to Base UI array values and keep non-empty selection. Set tabs to activate on focus to match Phase 1 keyboard tests.
2. Replace `globals.css` with `base-nova` variables holding Apple-style light values: neutral grays, one blue accent, hairline borders, larger radii, shadows on overlays only, no backdrop blur on content. Rename `.tds-custom-markdown` to `.md-content` and `.tds-custom-md-block` to `.md-block`; carry the typography rules from `src/styles/markdown.css` at `e100b02` with new token names. Rewrite `reader.css`, `popup.css`, `editor.css` with the new tokens or Tailwind utilities.
3. Delete `src/styles/tds/`. Create `src/export/export-styles.ts` from the shared Markdown CSS and use it in `src/export/export.ts`; the exported `<main>` uses `.md-content`.
4. Update tests: `theme.spec.ts` asserts the new tokens resolve and no TDS token remains; replace `.tds-*` selectors in E2E and unit tests with roles, labels, or `data-slot`.
**Acceptance Criteria:**
- `grep -rn "tds-\|@radix-ui" src tests package.json` prints nothing.
- `src/styles/tds` does not exist.
- Phase 1 keyboard tests pass on Base UI primitives.
- Export E2E shows code, math, and diagrams with zero network requests.
**Reviewer Checklist:**
- Focus restoration and Escape behavior on dialogs and menus.
- Accessible names unchanged.
- No Tailwind palette or radius tokens collide with new variables.
- Export CSS contains no `@import` or remote `url()`.
**Verification Checks:**
- `pnpm lint`
- `pnpm typecheck`
- `pnpm exec vitest run --no-file-parallelism`
- `pnpm test:e2e`

### Phase 5: Dark mode across shell, content, and export

**Task Guide Input:** Frontend theming implementation. Add `prefers-color-scheme` dark mode to shell, editor, Shiki, Mermaid, KaTeX, and HTML export; print stays light.
**Goal:** Every surface follows the system theme, including live changes, and exports adapt to the reader's system.
**Invariants & Boundaries:** No theme toggle and no `.dark` class. No script in exported HTML. Sanitization unchanged. Shiki, Mermaid, and KaTeX stay lazy. S8 and S9 unchanged.
**Files:**
- Modify: `src/styles/globals.css`, `src/styles/markdown.css`, `src/styles/editor.css`, `src/styles/reader.css`
- Modify: `src/render/highlight.ts`
- Modify: `src/render/diagram.ts`
- Modify: `src/ui/markdown-view.tsx`
- Modify: `src/export/export.ts`, `src/export/export-styles.ts`
- Modify: `tests/e2e/theme.spec.ts`, `tests/e2e/export.spec.ts`, `tests/e2e/enhance.spec.ts`
- Modify: `tests/unit/enhance.test.ts`, `tests/unit/export.test.ts`
**Tasks:**
1. Add `@custom-variant dark (@media (prefers-color-scheme: dark))` and `:root { color-scheme: light dark }` with dark token values; give `editor.css` and `markdown.css` dark values from the same tokens; force light tokens under `@media print`.
2. Lazy-load `shiki/themes/github-dark` with `github-light` and emit dual-theme output; add the Shiki media-query override to `markdown.css` and export CSS. Highlighting does not rerun on theme change.
3. In `src/render/diagram.ts`, keep each diagram's Mermaid source on its wrapper, read theme colors as hex from computed values, and expose a rerender for the current theme. In `markdown-view.tsx`, listen to `matchMedia('(prefers-color-scheme: dark)')` and rerender only diagrams, discarding results from an earlier theme.
4. In export, embed light and dark CSS selected by `prefers-color-scheme`, render each diagram in both themes with disjoint SVG ids, and show the matching one by CSS. Run theme, export, and enhance E2E with Playwright `colorScheme` set to `light` and `dark`.
**Acceptance Criteria:**
- E2E in both schemes: body background, code token colors, and Mermaid fill differ between light and dark and match the active scheme.
- Emulating a scheme change after load rerenders diagrams without reloading the page.
- Exported HTML contains no `<script>`, makes zero network requests, and switches theme under `colorScheme` emulation.
- Print emulation shows light tokens in dark scheme.
**Reviewer Checklist:**
- Diagram rerender is generation-guarded and does not leak temporary Mermaid nodes.
- Duplicate SVG ids cannot collide in export.
- Explicit KaTeX colors are preserved.
**Verification Checks:**
- `pnpm lint`
- `pnpm typecheck`
- `pnpm exec vitest run --no-file-parallelism`
- `pnpm test:e2e`

### Phase 6: Redesigned shell, Open URL dialog, status, and popup

**Task Guide Input:** Frontend UX implementation. Replace the top bar with a compact toolbar driven by a command registry, add welcome screen, drop overlay, collapsible sidebar with scroll-spy, focus mode, single status banner, Base UI toasts, Open URL dialog, and redesign the popup.
**Goal:** The new reader and popup layout from DESIGN.md Section 3, except the palette and shortcuts.
**Invariants & Boundaries:** Every v1 action stays reachable. Pickers open synchronously from the user gesture. A save conflict stays a dialog. Dismissing an error never clears the external-change prompt. Dirty state has visible and screen-reader text. The Open URL dialog uses a native form and the `src/lib/schemas.ts` URL check reusing `isAllowedUrl`, so `file:` stays allowed. No React Hook Form.
**Files:**
- Create: `src/reader/commands.ts`
- Create: `src/ui/toolbar.tsx`
- Delete: `src/ui/top-bar.tsx`
- Create: `src/ui/welcome.tsx`
- Create: `src/ui/drop-overlay.tsx`
- Create: `src/ui/status-banner.tsx`
- Delete: `src/ui/announce.tsx`
- Create: `src/ui/open-url-dialog.tsx`
- Create: `src/components/ui/toast.tsx`
- Modify: `src/ui/toc-panel.tsx`, `src/toc/toc.ts`, `src/ui/recent-section.tsx`, `src/ui/file-tree.tsx`
- Modify: `src/store/reader-store.ts`, `src/lib/schemas.ts`
- Modify: `src/entrypoints/reader/App.tsx`, `src/styles/reader.css`
- Modify: `src/entrypoints/popup/App.tsx`, `src/styles/popup.css`
- Create: `tests/e2e/shell.spec.ts`
- Create: `tests/unit/commands.test.ts`
- Modify: `tests/e2e/reader.spec.ts`, `tests/e2e/reload.spec.ts`, `tests/e2e/entry.spec.ts`, `tests/e2e/export.spec.ts`, `tests/e2e/editor.spec.ts`, `tests/e2e/perf.spec.ts`
**Tasks:**
1. Create `src/reader/commands.ts` with id, label, shortcut, availability, and run for open file, open folder, open URL, save, mode read, edit, split, export HTML, print, toggle sidebar, focus mode. Build `toolbar.tsx`: sidebar toggle, title with dirty dot and "Unsaved changes" text, Read, Edit, Split switch, Open menu, Save when writable, Export menu, palette button with Cmd+K hint. Build `open-url-dialog.tsx`.
2. Build `welcome.tsx` with Open file, Open folder, Open URL, drop hint, and recents with Reconnect; `drop-overlay.tsx` shown during file drag over the window.
3. Make the sidebar collapsible with a CSS width transition; add scroll-spy to the Contents tab via `IntersectionObserver` with the active item scrolled into view; add focus mode hiding toolbar and sidebar, exited by Esc.
4. Replace stacked announcements with `status-banner.tsx` driven by the store's banner selector, and add Base UI toasts for saved, exported, and recent-list notices with polite announcement. Redesign the popup as an action list with truncated recents and full-URL tooltips; keep the file-access dialog.
**Acceptance Criteria:**
- `tests/e2e/shell.spec.ts` covers: welcome screen with no document; Open URL dialog rejects a disallowed scheme inline and opens an allowed URL; sidebar collapse and expand; scroll-spy marks the heading in view; focus mode on and Esc off; drop overlay appears on drag; error banner plus external-change banner coexist and dismissing the error keeps Reload; toast appears after save.
- All v1 E2E flows pass with updated selectors.
**Reviewer Checklist:**
- No picker is invoked after an `await` or animation.
- Banner priority and coexistence logic.
- Scroll-spy observer is disconnected on document change.
- Popup still validates URLs with `isAllowedUrl`.
**Verification Checks:**
- `pnpm lint`
- `pnpm typecheck`
- `pnpm exec vitest run --no-file-parallelism`
- `pnpm test:e2e`

### Phase 7: Command palette and keyboard shortcuts

**Task Guide Input:** Frontend UX implementation. Add a Cmd/Ctrl+K command palette on Base UI Dialog and Autocomplete without `cmdk`, and global shortcuts routed through the command registry.
**Goal:** Every command is reachable by palette and its shortcut.
**Invariants & Boundaries:** No `cmdk` and no Radix dependency. Commands needing a document are disabled, not hidden. Shortcuts call the same command as the toolbar. Shortcuts do not fire while typing in the URL dialog; Cmd+S works in the editor.
**Files:**
- Create: `src/components/ui/command.tsx`
- Create: `src/ui/command-palette.tsx`
- Create: `src/reader/shortcuts.ts`
- Modify: `src/reader/commands.ts`
- Modify: `src/entrypoints/reader/App.tsx`
- Modify: `src/ui/toolbar.tsx`
- Create: `tests/e2e/palette.spec.ts`
- Modify: `tests/unit/commands.test.ts`
**Tasks:**
1. Create `src/components/ui/command.tsx` composing `@base-ui/react` Dialog and Autocomplete with groups, empty state, and highlight on first item. Create `command-palette.tsx` with groups Actions, Headings, Folder files, Recents.
2. Create `src/reader/shortcuts.ts` binding Cmd/Ctrl+K, +S, +O, +\, +P with `preventDefault`, routed through `commands.ts`.
3. Add E2E coverage in `palette.spec.ts`: open with Cmd+K and Ctrl+K, filter, Enter runs the highlighted action, heading jump scrolls, disabled commands without a document, Escape restores focus; each shortcut runs its command; Cmd+O opens the picker path; Cmd+P calls `window.print`.
**Acceptance Criteria:**
- `grep -rn "cmdk\|@radix-ui" package.json pnpm-lock.yaml` prints nothing.
- `palette.spec.ts` passes, including every shortcut.
- If Chromium consumes a shortcut before the page, the journal records it and the command remains reachable by palette and toolbar.
**Reviewer Checklist:**
- Palette keyboard model: arrow keys, Enter, Escape, focus trap, focus return.
- Shortcut handler ignores composition events and editable fields where required.
**Verification Checks:**
- `pnpm lint`
- `pnpm typecheck`
- `pnpm exec vitest run --no-file-parallelism`
- `pnpm test:e2e`

### Phase 8: Motion, accessibility, and release audit

**Task Guide Input:** Frontend motion and accessibility polish plus a full regression and distribution audit.
**Goal:** Restrained motion that respects reduced motion, verified contrast in both themes, and a release-ready build.
**Invariants & Boundaries:** No Motion library. No animation on Markdown content updates. All gates unchanged.
**Files:**
- Modify: `src/styles/globals.css`, `src/styles/reader.css`, `src/styles/popup.css`
- Modify: `src/components/ui/dialog.tsx`, `dropdown-menu.tsx`, `tooltip.tsx`, `toast.tsx`, `command.tsx`
- Modify: `src/entrypoints/reader/App.tsx`
- Create: `tests/e2e/motion.spec.ts`
- Create: `tests/e2e/contrast.spec.ts`
- Modify: `README.md`, `CHROMEWEBSTORE.md`
**Tasks:**
1. Add enter and exit CSS transitions on Base UI `data-starting-style` and `data-ending-style` for dialogs, menus, tooltips, toasts, and palette, using transform and opacity only; add a View Transition from welcome screen to document with a fallback when the API is absent; disable all motion under `prefers-reduced-motion: reduce`.
2. Create `motion.spec.ts` asserting zero transition and animation duration under Playwright `reducedMotion: 'reduce'`. Create `contrast.spec.ts` computing WCAG contrast for text on background, muted text, primary on primary-foreground, and link color in both schemes, requiring 4.5:1 for body text and 3:1 for large text and UI borders.
3. Audit: `pnpm exec wxt zip` succeeds; no remote URL in built output except user-provided Markdown links; manifest permissions unchanged; update `README.md` and `CHROMEWEBSTORE.md` screenshots text and feature list.
**Acceptance Criteria:**
- `motion.spec.ts` and `contrast.spec.ts` pass.
- S3, S4, S8, S9 in `perf.spec.ts` pass.
- `pnpm exec wxt zip` exits 0.
- `grep -rn "tds\|radix\|TDS" src tests README.md CHROMEWEBSTORE.md` prints nothing.
**Reviewer Checklist:**
- Motion durations short, interruptible, and never block input.
- Contrast pairs cover every text role.
- Docs claims match behavior.
**Verification Checks:**
- `pnpm install --frozen-lockfile`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm exec vitest run --no-file-parallelism`
- `pnpm test:e2e`
- `pnpm exec wxt zip`
