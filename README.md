<div align="center">

<img src="public/icons/icon-128.png" alt="Markdown Reader icon" width="96" height="96">

# Markdown Reader

**Read, edit, and export Markdown from files, folders, and web addresses, offline, in one Chrome tab.**

[![CI](https://github.com/sitien173/markdown-reader/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/sitien173/markdown-reader/actions/workflows/ci.yml)

[Features](#features) · [Getting started](#getting-started) · [Development](#development) · [Project structure](#project-structure) · [Documentation](#documentation)

</div>

Markdown Reader is a Chrome extension built on Manifest V3. It opens Markdown from a local file, a local folder, or an http or https address and renders it in a reader page. The reader includes a split editor with live preview, a contents panel, export to a standalone HTML file, and print. Documents stay on the device; nothing is sent to a server.

## Features

- **Open from anywhere:** a file, a folder with a file tree in the sidebar, a `file://` address, or a web address. Markdown pages can redirect to the reader automatically, and a context menu entry opens Markdown links.
- **Read, edit, split:** three modes, a contents panel, Zen mode, and fullscreen. Saving writes back to disk when the browser grants write access.
- **Rich rendering:** code highlighting with Shiki, math with KaTeX, diagrams with Mermaid, and 18 switchable markdown-it plugins such as footnotes, task lists, alerts, and front matter.
- **Safe output:** rendered HTML is sanitized with DOMPurify before it reaches the page.
- **Export and print:** one standalone HTML file, or the browser print dialog.
- **Keyboard first:** a command palette on `Mod+K`, plus `Mod+O` to open a file, `Mod+S` to save, `Mod+P` to print, and `Mod+\` to toggle the sidebar. `Mod` is Ctrl, or Cmd on macOS.
- **Live updates:** files and folders refresh when they change on disk. Remote documents can refresh on an interval from 0.5 to 600 seconds.
- **One settings panel:** shared by the toolbar popup, the options page, and a dialog in the reader. Settings are stored in `storage.local` under `settings:v1` and reach open reader tabs without a reload.

## Getting started

### Install from a release

1. Download `markdown-reader-<version>-chrome.zip` from [GitHub Releases](https://github.com/sitien173/markdown-reader/releases).
2. Unpack the ZIP file.
3. Open `chrome://extensions` in Chrome.
4. Turn on **Developer mode**.
5. Click **Load unpacked** and select the unpacked folder.

### Build from source

#### Prerequisites

- Node.js 24
- pnpm 11, pinned in the `packageManager` field of `package.json`
- Google Chrome or Chromium

#### Build

```sh
pnpm install --frozen-lockfile
pnpm build
```

The unpacked extension is written to `.output/chrome-mv3/`.

#### Load the extension

1. Open `chrome://extensions`.
2. Turn on **Developer mode**.
3. Click **Load unpacked** and select `.output/chrome-mv3`.

After each rebuild, click the reload button on the extension card.

> [!IMPORTANT]
> To open Markdown by its `file://` address, Chrome needs permission. On `chrome://extensions`, open **Details** for Markdown Reader and turn on **Allow access to file URLs**. Without it, the **Open file** button, drag and drop, and web addresses still work.

## Development

| Command                      | Purpose                                                                     |
| ---------------------------- | --------------------------------------------------------------------------- |
| `pnpm typecheck`             | Generate WXT types, then run `tsc --noEmit`                                 |
| `pnpm lint`                  | Run Biome in CI mode for lint and format checks                             |
| `pnpm format`                | Format the codebase with Biome                                              |
| `pnpm test`                  | Run Vitest unit tests in `tests/unit`                                       |
| `pnpm test:coverage`         | Run unit tests with V8 coverage                                             |
| `pnpm test:e2e`              | Build, then run Playwright tests in `tests/e2e` against the built extension |
| `pnpm build`                 | Build the extension with WXT                                                |
| `pnpm exec wxt zip`          | Package the build as a ZIP for the Chrome Web Store                         |
| `node scripts/gen-icons.mjs` | Regenerate the icons in `public/icons/`                                     |

> [!NOTE]
> Native file and folder pickers and saving back to disk cannot run in a headless browser. Check them by hand with [docs/manual-checklist.md](docs/manual-checklist.md).

Setup, testing, and commit workflow are in [CONTRIBUTING.md](CONTRIBUTING.md). Coding conventions are in [CODING_STANDARDS.md](CODING_STANDARDS.md). Guidance for AI coding agents is in [AGENTS.md](AGENTS.md).

### Tech stack

WXT, React 19, TypeScript, Tailwind CSS v4, shadcn/ui on Base UI, Zustand, Zod 4 mini, markdown-it, CodeMirror 6, Shiki, KaTeX, Mermaid, DOMPurify, Biome, Vitest, and Playwright.

## Project structure

```text
src/
  entrypoints/   WXT entry points: background, content script, reader, popup, options
  reader/        Reader controller, command registry, keyboard shortcuts
  render/        markdown-it pipeline, sanitizer, highlighting, math, diagrams, links
  source/        Document sources: file handles, directories, file and http URLs, watching
  store/         Zustand stores, drafts, recents, persisted handles
  ui/            Reader and settings React components
  components/ui/ shadcn/ui primitives
  editor/        CodeMirror editor setup
  export/        Standalone HTML export
  toc/           Table of contents
  lib/           Settings schema, appearance, shared utilities
  i18n/          UI strings
  styles/        Global, reader, editor, and Markdown CSS
tests/
  unit/          Vitest tests
  e2e/           Playwright tests that load the built extension
  fixtures/      Markdown and JSON fixtures
docs/
  plans/         Design documents and phased implementation plans
```

## Documentation

- [Documentation site](https://sitien173.github.io/markdown-reader/): guides and reference
- [SECURITY.md](SECURITY.md): security policy and vulnerability reporting
- [docs/manual-checklist.md](docs/manual-checklist.md): manual test procedure
- [docs/spikes.md](docs/spikes.md): verified platform spikes for file URL fetch, `FileSystemObserver`, and Mermaid under the MV3 CSP
- [docs/plans/](docs/plans/): design and plan documents per feature
- [PRIVACY.md](PRIVACY.md): privacy policy
- [CHROMEWEBSTORE.md](CHROMEWEBSTORE.md): store listing copy and permission justifications; internal, not packaged
