---
title: Features and usage
nav_order: 3
---

# Features and usage
{: .no_toc }

1. TOC
{:toc}

## Open from anywhere

Markdown Reader opens a file, a folder with a file tree in the sidebar, a `file://` address, or a web address. Markdown pages can redirect to the reader automatically, and a context menu entry opens Markdown links.

Folder trees hide dot-items, files ignored by `.gitignore`, and custom ignore patterns. Turn on **Show hidden and ignored items** in **Settings > General** to show them.

## Read, edit, and split

The reader has three modes: **Read**, **Edit**, and **Split**. Split mode shows the editor and a live preview side by side. The sidebar shows the file tree or the document outline. Zen mode hides the toolbar, and fullscreen fills the screen.

Saving writes back to disk when the browser grants write access. Unsaved drafts are kept in browser storage, so work survives a closed tab.

## Rendering

- Code highlighting with Shiki
- Math with KaTeX
- Diagrams with Mermaid
- 18 markdown-it plugins, each switchable in **Settings > Plugins**

| Plugin               | Effect                                                               | Default |
| -------------------- | -------------------------------------------------------------------- | ------- |
| Linkify              | Turn bare URLs into links.                                           | On      |
| Emoji                | Render `:shortcode:` emoji.                                          | On      |
| Superscript          | Render `^text^` as superscript.                                      | On      |
| Subscript            | Render `~text~` as subscript.                                        | On      |
| Mark                 | Render `==text==` as highlighted text.                               | On      |
| KaTeX                | Render `$math$` and `$$math$$` formulas.                             | On      |
| Mermaid              | Render mermaid code blocks as diagrams.                              | On      |
| Abbreviation         | Show the full text of `*[ABBR]:` definitions.                        | On      |
| Definition list      | Render term and definition lists.                                    | On      |
| Footnote             | Render `[^1]` footnotes.                                             | On      |
| Task list            | Render `- [ ]` and `- [x]` checkboxes.                               | On      |
| Alert box            | Render `> [!NOTE]` callouts.                                         | On      |
| Typographer          | Replace straight quotes, dashes, and ellipses with typographic ones. | Off     |
| Breaks               | Render a single line break as a line break.                          | Off     |
| TOC                  | Replace `[[TOC]]` with a table of contents.                          | On      |
| Insert               | Render `++text++` as inserted text.                                  | On      |
| Front matter         | Show a leading `---` block as a metadata table.                      | On      |
| Multi-markdown table | Support cells that span columns and table captions.                  | On      |

Rendered HTML is sanitized with DOMPurify before it reaches the page.

## Export and print

**Export HTML** writes the document as one standalone HTML file. **Print** opens the browser print dialog.

## Keyboard shortcuts

`Mod` is Ctrl, or Cmd on macOS.

| Shortcut | Command         |
| -------- | --------------- |
| `Mod+K`  | Command palette |
| `Mod+O`  | Open file       |
| `Mod+S`  | Save            |
| `Mod+P`  | Print           |
| `Mod+\`  | Toggle sidebar  |

Every other command, such as mode switching, Zen mode, and Export HTML, is available in the command palette.

## Live updates

Files and folders refresh when they change on disk. Remote documents can refresh on an interval from 0.5 to 600 seconds when **Auto-refresh web pages** is on.

## Settings

One settings panel is shared by the toolbar popup, the options page, and a dialog in the reader. Settings are stored in `storage.local` under `settings:v1` and reach open reader tabs without a reload.

| Tab        | Covers                                                                                                   |
| ---------- | -------------------------------------------------------------------------------------------------------- |
| General    | Automatic redirect, file access, outline collapsing, `.txt` rendering, auto-refresh, folder tree filters |
| Appearance | Text size, font, theme, code themes, code wrapping, wide tables, Zen mode, column width, custom CSS      |
| Plugins    | The 18 markdown-it plugins                                                                               |
| About      | Version                                                                                                  |
