# Manual Verification Checklist

Native File System Access API pickers, persistent handle permission re-prompting, and save-back operations cannot be automated in headless browser environments. This document defines the manual testing procedure to verify these behaviors in Chrome MV3.

## 1. Native Folder Open

1. Launch Chrome with the unpacked Markdown Reader extension loaded.
2. Open the Markdown Reader tab (`reader.html`).
3. In the sidebar, select the **Files** tab.
4. Click the **Open folder** button.
5. In the native Chrome directory picker dialog (`showDirectoryPicker`), select a directory containing Markdown documents (`.md` and `.markdown`), subdirectories with Markdown documents, and non-Markdown files (`.png`, `.txt`).
6. Verify:
   - Chrome requests permission to access the directory: grant read access.
   - The Files sidebar populates with a recursive tree of Markdown documents.
   - Non-Markdown files and directories without any Markdown documents are filtered out.
   - Folders are listed first, sorted alphabetically, followed by Markdown files.
   - The first Markdown document in the tree opens and renders in the reader.
   - Clicking any other Markdown document in the tree opens and renders it.
   - Clicking a folder node expands or collapses its contents.
7. Verify picker hiding and settings toggle:
   - In a directory containing dot-items (e.g. `.git`), entries ignored by `.gitignore`, or patterns matched by Settings (e.g. `node_modules/`), verify these entries are hidden from the tree by default.
   - Open Settings (**Settings** dialog from menu or Command Palette `Control+K`) -> **General**.
   - Turn **Show hidden and ignored items** ON.
   - Verify that the picker tree refreshes and displays the previously hidden dot-items, `.gitignore` entries, and ignored folders without needing to re-pick the directory.
   - Turn **Show hidden and ignored items** OFF and verify those entries are hidden again.

## 2. Directory Watch and Live Updates

1. With a folder opened in the reader:
   - In terminal or an external file manager, create a new file `docs/new-guide.md`.
   - Observe: the Files tab tree updates and displays `new-guide.md` without refreshing the page.
   - Rename `docs/new-guide.md` to `docs/renamed-guide.md`.
   - Observe: the tree reflects the rename immediately.
   - Delete `docs/renamed-guide.md`.
   - Observe: the file disappears from the tree.
2. Live file reloading:
   - Open a document from the folder.
   - In an external text editor, modify and save the document.
   - Observe: the reader reloads the updated content from disk automatically (scroll position preserved).
   - If local edits exist in the reader (dirty draft), observe: the reader does NOT overwrite the draft, displaying the "File changed on disk: Reload" announcement instead.

## 3. Handle Persistence and Reconnect

1. Open a local file or folder using the native picker.
2. Completely restart the Chrome browser.
3. Open Markdown Reader.
4. Check recent handle items in the extension interface.
5. Observe:
   - The stored handle reflects the `prompt` permission state after browser restart.
   - A **Reconnect** action is displayed for the handle.
6. Click **Reconnect**:
   - Verify: Chrome presents the native permission prompt asking "Let this extension view files in <folder/file>?".
   - Note: the prompt must ONLY appear in response to a direct user click.
   - Click "Allow" / "View files".
   - Verify: permission transitions to `granted` and the file or folder tree opens immediately.

## 4. File Save-Back and Conflict Handling

1. Open a local file using "Open file" (`showOpenFilePicker`) or select a document within an opened folder.
2. Switch reader mode to **Edit** or **Split**.
3. Type changes into the editor.
4. Observe:
   - "Unsaved draft" status announcement appears.
   - The **Save** button becomes enabled.
5. Click **Save**:
   - Verify: the content is written back to the disk file with matching `lastModified` timestamp.
   - Verify: the "Unsaved draft" announcement clears, and the Save button disables.
6. Save Conflict testing:
   - Make another edit in the editor (do not save yet).
   - In an external editor, modify and save the same file on disk.
   - In Markdown Reader, click **Save**.
   - Verify: the **Save Conflict** dialog appears stating "File changed on disk" and offering:
     - **Overwrite**: forces writing local draft over disk file.
     - **Reload from disk**: discards local draft and reloads disk content.
     - **Cancel**: closes dialog without modifying disk.

## 5. JSON Preview

Headless runs cannot drive the native file picker, drag-and-drop, or saving to disk, and the end-to-end suite runs Chromium only. Verify these by hand.

1. **Picker and drop download names.** Open a `.json` file through **Open file**, then click **Download**. Verify the saved file keeps the source name, for example `report.json`, not `document.json`. Repeat by dragging a `.jsonc` file onto the reader window.
2. **Download contents match the view.** With a `.jsonc` file open, verify the download is named `.jsonc` while comments remain, and `.json` once **Strip comments** or **Minify** removes them. Open each saved file and verify it matches what the view showed at the moment of download.
3. **Toolbar reset between documents.** Open a `.json` file, set a non-default layout such as **Minify**, then open a different `.json` file through the picker. Verify the toolbar resets to the open rule rather than keeping the previous document's setting. Edit the first file on disk and verify auto-refresh keeps the toolbar setting.
4. **Firefox auto-redirect.** In Firefox with the extension loaded, open a remote `.json` URL with the redirect setting ON and verify the reader takes over. Turn the setting OFF and verify the raw document loads untouched. Chromium covers this in `tests/e2e/json-preview.spec.ts`; Firefox is not in the end-to-end matrix.
5. **Parse error banner.** Open a malformed `.json` file and verify the banner reports the line and column, the source still renders beneath it, and the toolbar is disabled. Open a valid Markdown document next and verify the banner is gone.
