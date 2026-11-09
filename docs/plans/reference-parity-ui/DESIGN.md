# Reference-Parity UI Design

**Status:** Confirmed 2026-11-09
**Consultation:** Two consult jobs. 99dfa7b7 (balanced) proposed the architecture; 1edfa50c (anthropic) cross-validated it and corrected parser gating, block-key invalidation, local TOC and front-matter rules, auto-refresh default, and charset order. Job 89d45c68 (openai) failed transient and was replaced by 1edfa50c.

## Purpose

Refactor the Markdown Reader extension so its popup, settings, reader shell, and reading view match the layout, controls, and feature set of the reference snapshots in `snapshot/`. The reference is a third-party product (md-reader v3.6.33). This design copies its structure and behavior, not its branding, account features, or visual tokens.

## Users and Success Criteria

Users: people reading and editing Markdown from web URLs, `file://` URLs, picked files, and picked folders in Chrome.

Success criteria:

1. The popup shows a 60 px icon rail with four tabs, General, Appearance, Plugins, and About, and each tab exposes every in-scope setting listed in Settings Behavior.
2. Every setting persists in `storage.local`, survives reload, and reaches every open reader tab without a reload.
3. The same settings panel renders in the popup, an options page, and a reader dialog.
4. In read mode, the reader shows a left sidebar with a Files/Outline segmented control and a search filter, a floating sidebar toggle, and a floating top-right menu. There is no top bar.
5. Code blocks show a language label and a Copy button. Headings show an `aria-hidden` `#` permalink on hover.
6. Every pre-existing feature still works: editor and split modes, Cmd+K palette, Open URL dialog, welcome screen, export, recents, keyboard shortcuts, dark mode, reduced motion.
7. S3 (under 100 ms per keystroke) and S4 (under 500 ms to first content) from `docs/plans/ui-stack-refactor/DESIGN.md` pass with all plugins on and with a `[[TOC]]` document.
8. Rendering and export make zero network requests. The XSS fixtures stay inert.
9. With no stored settings, rendered output and behavior equal the pre-plan base. Exception, per PLAN Resolved ambiguities 1 and 3: TOC, Insert, Front matter, and Multi-markdown table default On, and front matter is recognized only at offset 0.

## Constraints, Invariants, and Non-Goals

Constraints:

- Keep the current stack: WXT, React 19, TypeScript, Tailwind v4, shadcn base-nova on `@base-ui/react`, Zustand, Zod mini (jitless), markdown-it, Shiki, Mermaid, KaTeX, CodeMirror, Vitest, Playwright, pnpm, Biome.
- Keep the current Apple visual style and design tokens. Copy layout, structure, and controls only.
- Add no manifest permission.
- New dependencies are limited to `markdown-it-ins` and `markdown-it-multimd-table`.

Invariants:

- DOMPurify sanitize on all rendered HTML; user-content id prefix on generated ids.
- CSP-safe Mermaid; zero network requests from render and export.
- Existing `storage.local` keys for drafts, recents, and handles keep their names and formats.
- Existing keyboard shortcuts keep their bindings.

Non-goals:

- Account, sign-in, Guest mode, Pro plan, and Feedback.
- PlantUML, because it needs a network service.
- Render folder URLs. Opening a folder stays available through Open folder.
- Gear sub-settings on plugins.
- Any locale other than English (US).
- Third-party branding, logo, author line, and links.

## Chosen Approach

One Zod-validated settings object in `storage.local`, one shared `SettingsPanel` mounted in three hosts, a parser-instance cache keyed by plugin settings, and seven phases ordered so each later phase is testable through real controls.

Rejected alternatives:

- Reader-owned settings with a popup link only: the popup would not match the reference.
- Shell first with static controls, settings wired later: controls would ship non-functional between phases.

## Architecture and Data Flow

### Settings model: `src/lib/settings.ts`

- Zod mini schema stored under one key, `settings:v1`, with `version: 1`.
- Each field has its own fallback, so a corrupt or partial stored object keeps its valid fields and defaults the rest.
- `breaks` is stored once. The General and Plugins switches both bind to it.
- "All plugins" is derived: on when every plugin is on; setting it sets every plugin.
- `customCss` is a string capped at 65,536 characters in the same object.

### Settings store: `src/store/settings-store.ts`

- Zustand store, loaded once before the reader's first render.
- Subscribes to `storage.onChanged` and reacts only to `settings:v1`. Drafts save to `storage.local` every 1 s, so the key filter is mandatory.
- Used by the popup, the options page, and the reader.
- The background worker and the content script read settings once inside each handler and hold no store.

### Settings panel: `src/ui/settings/`

- `SettingsPanel` with an icon rail and four tabs.
- Hosts: popup, new `options` entrypoint registered as `options_ui`, and a reader dialog opened by the Setting menu item.

### i18n: `src/i18n/`

- Typed English dictionary, `t(key)` for non-React callers, `useT()` hook in React.
- Selected by `settings.language`; sets `lang` on reader, popup, options, and export documents.
- The Language select shows one disabled option, English (US).

### Render pipeline: `src/render/pipeline.ts`

- `getMarkdownIt(config)` replaces the module-level instance with a four-entry LRU keyed by a stable plugin-config string. `render`, `planPrefix`, `planBlocks`, and the Mermaid fence rule all take the instance from it.
- The plugin-config key joins the block keys and the reset condition in `src/ui/markdown-view.tsx`, so a toggle change replaces every mounted block.
- KaTeX and Mermaid are gated in the parser: KaTeX by omitting `@vscode/markdown-it-katex`, Mermaid by the fence rule.
- `[[TOC]]` is a local block rule that emits an empty placeholder. After each render the view fills it from the existing headings with `buildToc` from `src/toc/toc.ts`. This keeps incremental rendering.
- Front matter is a local rule that matches only at offset 0 of the full document and only when closed. It renders as a compact metadata table.
- New packages: `markdown-it-ins`, `markdown-it-multimd-table`. Type declarations go in `src/render/plugins.d.ts`.
- Sanitizer adds tag `ins`, tag `caption`, and attributes `colspan` and `rowspan`.

### Theme: `src/styles/globals.css`, `markdown.css`, `editor.css`, `src/export/export-styles.ts`

- A root `data-theme` attribute resolves Auto, Light, or Dark. Auto keeps the `prefers-color-scheme` rule so exported files still follow the reader's system theme.
- A theme change calls `rerenderDiagrams`; `isDark()` in `src/render/diagram.ts` reads the resolved theme.
- Code themes stay limited to the bundled `github-light` and `github-dark`; the highlight cache key includes the selected code theme.

### Reader commands: `src/reader/commands.ts`

- New commands: `toggle-raw`, `toggle-fullscreen`, `settings`, `about`.
- `focus-mode` becomes Zen mode.
- The menu and the Cmd+K palette both read the registry.
- No new shortcuts: the shortcut parser accepts Mod plus one key only, and the free keys collide with browser shortcuts.

## Settings Behavior

Defaults preserve pre-plan behavior.

| Tab | Setting | Behavior | Default |
|---|---|---|---|
| General | Enable | Content script skips auto-redirect when off; manual open, render, and context menu still work | On |
| General | Local file access | Shows live `isAllowedFileSchemeAccess()` state, read-only; click opens the existing file-access instructions dialog | Live state |
| General | Breaks | Same stored value as Plugins > Breaks | Off |
| General | Outline collapsing | Outline headings with children get expand and collapse toggles | Off |
| General | Render .txt as Markdown | Adds `*.txt` matches; redirects only when on and `contentType` is `text/plain` | Off |
| General | Auto-refresh | Applies to file URLs, picked files, and folders. With an unsaved edit, a change shows the existing external-change banner and never overwrites the draft | On |
| General | Auto-refresh web pages | Extends auto-refresh to http(s) URLs. Polls use `max(interval, 5 s)` and conditional requests. Off by default so no new network traffic occurs without opt-in. User decision 2026-11-09 | Off |
| General | Auto-refresh interval | 0.5 s to 600 s, clamped | 1 s |
| General | Charset compatibility | Reads bytes, checks the BOM, tries strict UTF-8, then the HTTP charset, then `windows-1252`; bypasses captured page text for `file:` | Off |
| General | Language | Single disabled option | English (US) |
| General | Reset settings | Confirm dialog, then restores all defaults | n/a |
| Appearance | Text size | 6-step slider, scale 0.875 to 1.25 | Step 3, 1.0 |
| Appearance | Font | Default (Inter), Serif, Sans, Mono system stacks | Default |
| Appearance | Theme | Auto, Light, Dark | Auto |
| Appearance | Code theme in light mode | Light or Dark, from bundled github-light and github-dark | Light |
| Appearance | Code theme in dark mode | Light or Dark, from the same bundled themes | Dark |
| Appearance | Wrap code lines | `pre` wraps instead of scrolling | Off |
| Appearance | Wide tables | Tables extend past the text column and scroll horizontally | Off |
| Appearance | Zen mode | Merged with the existing focus mode. Stored value sets the start state and applies live. Escape exits for the session only. The Exit button stays | Off |
| Appearance | Centered | Content column centered; off aligns it left | On |
| Appearance | Custom max width | Switch plus 500 to 3000 px slider and number field | Off, 1000 px |
| Appearance | Custom CSS | Switch plus textarea with Apply and Cancel. The whole stylesheet is rejected with an inline error if it contains `url(`, `image-set(`, `@import`, or a backslash. Applied with `adoptedStyleSheets` | Off, empty |
| Plugins | All plugins | Derived; sets every plugin | Derived |
| Plugins | Linkify, Emoji, Superscript, Subscript, Mark, KaTeX, Mermaid, Abbreviation, Definition list, Footnote, Task list, Alert box | Each removes its parser plugin when off | On |
| Plugins | Typographer | Built-in markdown-it option | Off |
| Plugins | TOC, Insert, Front matter, Multi-markdown table | New features | On |

Export and print: every Appearance setting carries into exported HTML, including custom CSS. Print stays light.

## UI Layout

### Popup

- 520 × 480 px. 60 px icon rail with General, Appearance, Plugins, About; each rail button has an accessible name and an active highlight.
- Scrolling content pane. Rows: label and description on the left, control on the right.
- New shadcn controls on Base UI: Switch, Slider, Select, Textarea.
- General: compact row with Open viewer, Open editor, Render current tab in place of the reference's sign-in card; then up to 5 recent URLs; then settings rows; Reset settings last.
- Appearance and Plugins: H2 heading, then rows.
- About: 128 px extension icon, H1 "Markdown Reader", manifest version, the line "© 2026 Markdown Reader". No links.
- Options page: the same panel in a centered page.

### Reader, read mode

- Left sidebar, about 260 px, muted background. Header: Files/Outline segmented control with named icons and a search icon that opens a filter field for the active list.
- Outline: nested headings, scroll-spy highlight, optional collapsing.
- Files: existing file tree, Open file and Open folder, recents.
- Content column: floating sidebar toggle at top-left; floating menu button at top-right.
- Menu groups: Toggle Raw, Toggle Fullscreen, Print / Export HTML, Open file, Open folder, Open URL / Command palette, Setting / About.
- Code blocks: language label and Copy button. Headings: hover `#` permalink, `aria-hidden`.
- About dialog: same content as the About tab, with a close button.

### Reader, edit and split modes

- A compact header shows the title, the unsaved-changes dot, Save, and the Read/Edit/Split radio group.
- Toggle Raw switches between read and edit.

## Errors and Edge Cases

- Corrupt or partial stored settings: per-field fallback; no throw.
- Rejected custom CSS: inline error; the previously applied CSS stays.
- `[[TOC]]` with no headings: empty placeholder.
- Unclosed front matter: rendered as ordinary text; the document is never hidden.
- Theme change during a Mermaid render: the existing epoch guard drops stale output.
- Auto-refresh on http: a 304 or network error keeps the current document; repeated failures back off.
- Fullscreen request refused: toast.
- Escape that leaves browser fullscreen must not also exit Zen mode; covered by an end-to-end test.

## Migration

- No stored settings exist yet; defaults apply and equal pre-plan behavior.
- Draft, recent, and handle keys in `storage.local` are unchanged.
- Manifest: add `options_ui`; add `*://*/*.txt` and `file:///*.txt` to content-script `matches`. No new permissions.
- The context-menu title moves through `t()`.

## Testing

Test-driven: a failing test precedes each behavior change.

Unit:

- Schema defaults, clamping, per-field fallback, and version.
- Settings store `onChanged` key filter.
- Derived All plugins.
- Each plugin on and off in the parser; instance cache; block-key change on toggle.
- Local `[[TOC]]` and front-matter rules, including mid-document `---` and unclosed blocks.
- Sanitizer `ins`, `caption`, `colspan`, `rowspan`.
- Custom CSS filter.
- Charset decode order.
- `.txt` detection and the Enable gate.
- Auto-refresh interval, http minimum, and the dirty-draft guard.
- Command registry entries.

End-to-end:

- Popup tabs against the role structure of `snapshot/markdown_reader_popup_*_snapshot.yml`.
- Live propagation of a setting from the popup to an open reader tab.
- Reader menu, About dialog, Toggle Raw, Fullscreen, Zen mode.
- Sidebar search and outline collapsing.
- Code Copy button and heading permalinks.
- Theme override in light and dark; contrast.
- Export with Appearance settings and zero network requests.

Every phase runs: S3 and S4 perf with all plugins on and a `[[TOC]]` fixture, export zero-network, XSS, contrast, and reduced motion.

Commands: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:e2e`. Final audit adds `pnpm wxt zip`.

## Risks and Open Questions

- The `data-theme` migration touches three stylesheets and the export styles; dark-mode export is the main regression risk.
- Extra parser instances add parse time on the first render after a toggle change.
- The 5 s http minimum for auto-refresh is a design choice; the reference allows 0.5 s.
- The About copyright line has no confirmed holder name.
