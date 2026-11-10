import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { expect, test } from './fixtures';

async function createFixtureRepo(): Promise<{ repoDir: string; cleanup: () => Promise<void> }> {
  const repoDir = await mkdtemp(path.join(os.tmpdir(), 'mdr-e2e-tree-'));

  // .git folder
  await mkdir(path.join(repoDir, '.git'));
  // root .gitignore
  await writeFile(path.join(repoDir, '.gitignore'), 'ignored.md\nignored-dir/\n');
  // dot-folder with markdown file
  await mkdir(path.join(repoDir, '.dot-folder'));
  await writeFile(path.join(repoDir, '.dot-folder', 'hidden.md'), '# Hidden Dot File\n');
  // node_modules folder
  await mkdir(path.join(repoDir, 'node_modules'));
  await writeFile(path.join(repoDir, 'node_modules', 'pkg.md'), '# Pkg Doc\n');
  // root markdown file
  await writeFile(path.join(repoDir, 'root.md'), '# Root Doc\n');
  // ignored.md at root
  await writeFile(path.join(repoDir, 'ignored.md'), '# Ignored Root\n');
  // docs folder
  const docsDir = path.join(repoDir, 'docs');
  await mkdir(docsDir);
  await writeFile(path.join(docsDir, 'readme.md'), '# Docs Readme\n');
  await writeFile(path.join(docsDir, 'guide.md'), '# Docs Guide\n');
  await writeFile(path.join(docsDir, 'ignored.md'), '# Ignored in Docs\n');
  // docs/sub folder
  const subDir = path.join(docsDir, 'sub');
  await mkdir(subDir);
  await writeFile(path.join(subDir, 'nested.md'), '# Nested Doc\n');
  await writeFile(path.join(subDir, 'deep.md'), '# Deep Doc\n');

  return {
    repoDir,
    cleanup: async () => {
      await rm(repoDir, { recursive: true, force: true });
    },
  };
}

test('file URL folder tree end-to-end scenarios', async ({ page, extensionId }) => {
  const { repoDir, cleanup } = await createFixtureRepo();
  try {
    const repoBasename = path.basename(repoDir);
    const subNestedPath = path.join(repoDir, 'docs', 'sub', 'nested.md');
    const subNestedUrl = pathToFileURL(subNestedPath).href;

    // (1) Opening a nested file:// Markdown file roots the tree at its parent folder
    await page.goto(`chrome-extension://${extensionId}/reader.html?src=${encodeURIComponent(subNestedUrl)}`);
    await expect(page.locator('.md-content h1')).toHaveText('Nested Doc');

    // Switch to Files tab
    await page.locator('[aria-label="Sidebar view"] [aria-label="Files"]').click();

    const tree = page.locator('[data-slot="file-tree"]');

    // Verify header shows root folder name "sub"
    const headerTitle = page.locator('.reader-folder-actions span');
    await expect(headerTitle).toHaveText('sub');

    // Verify tree shows nested.md and deep.md
    await expect(tree.locator('button[data-slot="file-tree-file"]')).toHaveCount(2);
    await expect(tree.getByRole('button', { name: 'nested.md', exact: true })).toBeVisible();
    await expect(tree.getByRole('button', { name: 'deep.md', exact: true })).toBeVisible();
    await expect(tree.getByRole('button', { name: 'nested.md', exact: true })).toHaveAttribute('aria-current', 'page');

    // (2) Expanding a folder loads its contents
    const docsReadmePath = path.join(repoDir, 'docs', 'readme.md');
    const docsReadmeUrl = pathToFileURL(docsReadmePath).href;
    await page.goto(`chrome-extension://${extensionId}/reader.html?src=${encodeURIComponent(docsReadmeUrl)}`);
    await expect(page.locator('.md-content h1')).toHaveText('Docs Readme');

    await page.locator('[aria-label="Sidebar view"] [aria-label="Files"]').click();
    await expect(headerTitle).toHaveText('docs');

    // Folder "sub" is present, but its children are not loaded yet
    const subToggle = tree.locator('button[aria-label="Toggle sub"]');
    await expect(subToggle).toBeVisible();
    await expect(tree.getByRole('button', { name: 'nested.md', exact: true })).toHaveCount(0);

    // Expand sub folder
    await subToggle.click();
    await expect(tree.getByRole('button', { name: 'nested.md', exact: true })).toBeVisible();
    await expect(tree.getByRole('button', { name: 'deep.md', exact: true })).toBeVisible();

    // (3) "Up one level" climbs one level and keeps the loaded subtree
    const upButton = page.locator('button[aria-label="Up one level"]');
    await expect(upButton).toBeEnabled();
    await upButton.click();

    // Header now shows repo directory name
    await expect(headerTitle).toHaveText(repoBasename);

    // Tree now contains docs and root.md
    await expect(tree.getByRole('button', { name: 'root.md', exact: true })).toBeVisible();
    const docsToggle = tree.locator('button[aria-label="Toggle docs"]');
    await expect(docsToggle).toBeVisible();

    // The loaded subtree for docs was grafted and sub is still loaded
    await expect(tree.getByRole('button', { name: 'nested.md', exact: true })).toBeVisible();

    // (4) Clicking a file keeps the tree root
    // Navigate back to docs/readme.md and verify tree root stays when clicking guide.md
    await page.goto(`chrome-extension://${extensionId}/reader.html?src=${encodeURIComponent(docsReadmeUrl)}`);
    await expect(page.locator('.md-content h1')).toHaveText('Docs Readme');
    await page.locator('[aria-label="Sidebar view"] [aria-label="Files"]').click();
    await expect(headerTitle).toHaveText('docs');

    // Click guide.md in the tree
    await tree.getByRole('button', { name: 'guide.md', exact: true }).click();
    await expect(page.locator('.md-content h1')).toHaveText('Docs Guide');
    // Root is kept at docs
    await expect(headerTitle).toHaveText('docs');
    await expect(tree.getByRole('button', { name: 'guide.md', exact: true })).toHaveAttribute('aria-current', 'page');

    // (5) Hidden and ignored entries are absent by default and appear when toggle is on
    // In docs: ignored.md is hidden by default
    await expect(tree.getByRole('button', { name: 'ignored.md', exact: true })).toHaveCount(0);

    // Also climb to repo root to verify .dot-folder and node_modules are hidden by default
    await upButton.click();
    await expect(headerTitle).toHaveText(repoBasename);
    await expect(tree.getByRole('button', { name: 'ignored.md', exact: true })).toHaveCount(0);
    await expect(tree.locator('button[aria-label="Toggle .dot-folder"]')).toHaveCount(0);
    await expect(tree.locator('button[aria-label="Toggle node_modules"]')).toHaveCount(0);

    // Open settings and turn on "Show hidden and ignored items"
    await page.keyboard.press('Control+k');
    const palette = page.getByRole('dialog', { name: 'Command palette' });
    await expect(palette).toBeVisible();
    await palette.getByRole('option', { name: 'Settings' }).click();

    const settingsDialog = page.getByRole('dialog', { name: 'Settings' });
    await expect(settingsDialog).toBeVisible();

    const showHiddenSwitch = settingsDialog.getByRole('switch', { name: 'Show hidden and ignored items' });
    await expect(showHiddenSwitch).toBeVisible();
    await expect(showHiddenSwitch).not.toBeChecked();
    await showHiddenSwitch.click();
    await expect(showHiddenSwitch).toBeChecked();

    // Close settings dialog
    await page.keyboard.press('Escape');
    await expect(settingsDialog).toHaveCount(0);

    // Now hidden and ignored entries appear in the tree
    await expect(tree.getByRole('button', { name: 'ignored.md', exact: true })).toBeVisible();
    await expect(tree.locator('button[aria-label="Toggle .dot-folder"]')).toBeVisible();
    await expect(tree.locator('button[aria-label="Toggle node_modules"]')).toBeVisible();
  } finally {
    await cleanup();
  }
});
