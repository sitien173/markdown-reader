---
title: Getting started
nav_order: 2
---

# Getting started

## Prerequisites

- Node.js 24
- pnpm 11, pinned in the `packageManager` field of `package.json`
- Google Chrome or Chromium

## Build

```sh
pnpm install --frozen-lockfile
pnpm build
```

The unpacked extension is written to `.output/chrome-mv3/`.

## Load the extension

1. Open `chrome://extensions`.
2. Turn on **Developer mode**.
3. Click **Load unpacked** and select `.output/chrome-mv3`.

After each rebuild, click the reload button on the extension card.

## Allow access to file URLs

{: .important }
To open Markdown by its `file://` address, Chrome needs permission. On `chrome://extensions`, open **Details** for Markdown Reader and turn on **Allow access to file URLs**. Without it, the **Open file** button, drag and drop, and web addresses still work.

## Open a document

- Click the toolbar icon, then **Open viewer** or **Open editor**.
- Choose **Render current tab** to open the Markdown page in the active tab.
- Right-click a Markdown link and choose **Open in Markdown Reader**.
- Visit a raw `.md` or `.markdown` page. The extension redirects it to the reader when **Enable** is on in **Settings > General**.
