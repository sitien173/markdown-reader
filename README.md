# Markdown Reader

A Chrome extension (Manifest V3) that renders Markdown from local files, local folders, and web addresses in one reader page. It works offline and includes a split editor with live preview, export to a standalone HTML file, and print.

## Features

- Open Markdown from a file, a folder, or a web address. Folders show a file tree in the sidebar.
- Contents panel, split editor with live preview, read, edit, and split modes, and a focus mode.
- Code highlighting, math, and diagrams. Export to one standalone HTML file, or print.
- Command palette (Ctrl+K, or Cmd+K on macOS) and shortcuts: open file (`Mod+O`), save (`Mod+S`), print (`Mod+P`), toggle sidebar (`Mod+\`). `Mod` is Ctrl, or Cmd on macOS.
- Light and dark appearance follow the system setting. Short enter and exit transitions are turned off when the system asks for reduced motion.

## Requirements

- Node.js (developed on Node.js 24) with pnpm 11 (pinned in `packageManager`)
- Google Chrome or Chromium

## Build

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm build
```

`pnpm build` writes the unpacked extension to `.output/chrome-mv3/`. To create a ZIP of that build for the Chrome Web Store, run `pnpm exec wxt zip`.

To regenerate the icons in `public/icons/`, run `node scripts/gen-icons.mjs`.

End-to-end tests load the built extension in Chromium and need the build first:

```sh
pnpm test:e2e
```

## Load unpacked

1. Build the extension (see above).
2. Open `chrome://extensions` in Chrome.
3. Turn on **Developer mode** (top right).
4. Click **Load unpacked** and select the `.output/chrome-mv3` folder.
5. Pin **Markdown Reader** from the extensions menu if you want the toolbar icon visible.

After you rebuild, click the reload button on the extension's card in `chrome://extensions`.

## Enable file URL access

To view a Markdown file opened from your computer by its `file://` address, Chrome needs your permission:

1. Open `chrome://extensions`.
2. Find **Markdown Reader** and click **Details**.
3. Turn on **Allow access to file URLs**.

Without this setting, the reader can still open files with the **Open file** button or by dragging them onto the page, and it can open web addresses.

## Manual checks

Some behaviors cannot be automated in a headless browser, such as native file and folder pickers and saving back to disk. The procedure for them is in [docs/manual-checklist.md](docs/manual-checklist.md).

## Store and privacy documents

- [CHROMEWEBSTORE.md](CHROMEWEBSTORE.md): store listing copy and the justification for each permission. It is internal and is not packaged in the extension.
- [PRIVACY.md](PRIVACY.md): the privacy policy. Documents stay on the device, and nothing is sent to any server.
