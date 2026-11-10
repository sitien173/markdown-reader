import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchGitignore, findRepoRoot, getParentUrl, getRelPath, listDirectory } from '../../src/source/file-url-tree';

describe('file-url-tree', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('getParentUrl', () => {
    it('returns null at filesystem root', () => {
      expect(getParentUrl('file:///')).toBeNull();
    });

    it('returns null at Windows drive root', () => {
      expect(getParentUrl('file:///C:/')).toBeNull();
      expect(getParentUrl('file:///c:/')).toBeNull();
      expect(getParentUrl('file:///D:/')).toBeNull();
    });

    it('returns null at UNC share level', () => {
      expect(getParentUrl('file://server/share/')).toBeNull();
      expect(getParentUrl('file://server/share')).toBeNull();
    });

    it('computes parent directory URL for POSIX paths', () => {
      expect(getParentUrl('file:///home/user/notes/')).toBe('file:///home/user/');
      expect(getParentUrl('file:///home/user/')).toBe('file:///home/');
      expect(getParentUrl('file:///home/')).toBe('file:///');
    });

    it('computes parent directory URL for Windows paths', () => {
      expect(getParentUrl('file:///C:/Users/alice/')).toBe('file:///C:/Users/');
      expect(getParentUrl('file:///C:/Users/')).toBe('file:///C:/');
    });

    it('computes parent directory URL for UNC paths below share level', () => {
      expect(getParentUrl('file://server/share/sub/nested/')).toBe('file://server/share/sub/');
      expect(getParentUrl('file://server/share/sub/')).toBe('file://server/share/');
    });
  });

  describe('listDirectory', () => {
    it('parses normal rows, skips .. and honors response.ok === false', async () => {
      const html = `
        <!DOCTYPE html>
        <script>addRow("..","..",1,0,"0 B",0,"");</script>
        <script>addRow("docs","docs",1,0,"0 B",1700000000,"2023-11-14 10:00:00");</script>
        <script>addRow("readme.md","readme.md",0,1234,"1.2 kB",1700000000,"2023-11-14 10:00:00");</script>
      `;

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        text: async () => html,
      } as Response);

      const entries = await listDirectory('file:///my/folder/');

      expect(entries).toEqual([
        {
          name: 'docs',
          url: 'file:///my/folder/docs/',
          isDir: true,
        },
        {
          name: 'readme.md',
          url: 'file:///my/folder/readme.md',
          isDir: false,
        },
      ]);
    });

    it('handles escaped display names with \\u003C and quotes', async () => {
      const html = `
        <script>addRow("\\u003Chello>","%3Chello%3E",0,10,"10 B",0,"");</script>
        <script>addRow("file \\"quoted\\".md","file%20%22quoted%22.md",0,20,"20 B",0,"");</script>
      `;

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        text: async () => html,
      } as Response);

      const entries = await listDirectory('file:///folder/');

      expect(entries).toEqual([
        {
          name: '<hello>',
          url: 'file:///folder/%3Chello%3E',
          isDir: false,
        },
        {
          name: 'file "quoted".md',
          url: 'file:///folder/file%20%22quoted%22.md',
          isDir: false,
        },
      ]);
    });

    it('resolves child URLs with #, %, spaces, and :', async () => {
      const html = `
        <script>addRow("hash#tag.md","hash%23tag.md",0,10,"10 B",0,"");</script>
        <script>addRow("100%done.md","100%25done.md",0,10,"10 B",0,"");</script>
        <script>addRow("space name.md","space%20name.md",0,10,"10 B",0,"");</script>
        <script>addRow("colon:name.md","colon:name.md",0,10,"10 B",0,"");</script>
      `;

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        text: async () => html,
      } as Response);

      const entries = await listDirectory('file:///dir/');

      expect(entries).toEqual([
        {
          name: 'hash#tag.md',
          url: 'file:///dir/hash%23tag.md',
          isDir: false,
        },
        {
          name: '100%done.md',
          url: 'file:///dir/100%25done.md',
          isDir: false,
        },
        {
          name: 'space name.md',
          url: 'file:///dir/space%20name.md',
          isDir: false,
        },
        {
          name: 'colon:name.md',
          url: 'file:///dir/colon:name.md',
          isDir: false,
        },
      ]);
    });

    it('parses real rows following a listing header containing function addRow without quadratic slowdown', async () => {
      const header = `
        <script>
        function addRow(name, url, isdir, size, size_string, date_modified, date_modified_string) {
          if (name == "..") {
            handleParent();
          }
          createRow(name, url, isdir);
        }
        </script>
      `;
      const rowCount = 5000;
      const rows: string[] = [];
      for (let i = 0; i < rowCount; i++) {
        rows.push(`<script>addRow("file-${i}.md","file-${i}.md",0,100,"100 B",0,"");</script>`);
      }
      const html = header + rows.join('\n');

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        text: async () => html,
      } as Response);

      const entries = await listDirectory('file:///large/');

      expect(entries).toHaveLength(rowCount);
      expect(entries[0]?.name).toBe('file-0.md');
      expect(entries[rowCount - 1]?.name).toBe(`file-${rowCount - 1}.md`);
    });

    it('returns empty array when HTML body contains no addRow calls', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        text: async () => '<html><body>Empty directory</body></html>',
      } as Response);

      const entries = await listDirectory('file:///empty/');
      expect(entries).toEqual([]);
    });

    it('propagates fetch rejection when file access is off', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));

      await expect(listDirectory('file:///restricted/')).rejects.toThrow('Failed to fetch');
    });
  });

  describe('fetchGitignore', () => {
    it('returns gitignore contents when present', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => 'node_modules/\n*.log\n',
      } as Response);

      const text = await fetchGitignore('file:///project/');
      expect(text).toBe('node_modules/\n*.log\n');
      expect(globalThis.fetch).toHaveBeenCalledWith('file:///project/.gitignore');
    });

    it('returns empty string when gitignore is absent or fetch fails', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      } as Response);

      const text = await fetchGitignore('file:///project/');
      expect(text).toBe('');

      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
      const text2 = await fetchGitignore('file:///project/');
      expect(text2).toBe('');
    });
  });

  describe('findRepoRoot', () => {
    it('finds repo root when .git directory exists in an ancestor', async () => {
      const listings: Record<string, string> = {
        'file:///home/user/project/sub/dir/': `
          <script>addRow("..","..",1,0,"",0,"");</script>
          <script>addRow("file.md","file.md",0,10,"",0,"");</script>
        `,
        'file:///home/user/project/sub/': `
          <script>addRow("..","..",1,0,"",0,"");</script>
          <script>addRow("dir","dir",1,0,"",0,"");</script>
        `,
        'file:///home/user/project/': `
          <script>addRow("..","..",1,0,"",0,"");</script>
          <script>addRow(".git",".git",1,0,"",0,"");</script>
          <script>addRow("sub","sub",1,0,"",0,"");</script>
        `,
      };

      globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
        const html = listings[url];
        if (html) {
          return { ok: false, text: async () => html } as Response;
        }
        return { ok: false, text: async () => '' } as Response;
      });

      const repoRoot = await findRepoRoot('file:///home/user/project/sub/dir/');
      expect(repoRoot).toBe('file:///home/user/project/');
    });

    it('finds repo root when .git is a file (e.g. git worktree or submodule)', async () => {
      const listings: Record<string, string> = {
        'file:///home/user/worktree/': `
          <script>addRow(".git",".git",0,35,"35 B",0,"");</script>
          <script>addRow("readme.md","readme.md",0,100,"",0,"");</script>
        `,
      };

      globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
        const html = listings[url];
        if (html) {
          return { ok: false, text: async () => html } as Response;
        }
        return { ok: false, text: async () => '' } as Response;
      });

      const repoRoot = await findRepoRoot('file:///home/user/worktree/');
      expect(repoRoot).toBe('file:///home/user/worktree/');
    });

    it('returns null when no ancestor has .git up to filesystem root', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        text: async () => '<script>addRow("other","other",1,0,"",0,"");</script>',
      } as Response);

      const repoRoot = await findRepoRoot('file:///home/user/notes/');
      expect(repoRoot).toBeNull();
    });
  });

  describe('getRelPath', () => {
    it('returns relative path for files and folders inside base', () => {
      expect(getRelPath('file:///home/u/repo/docs/readme.md', 'file:///home/u/repo/')).toBe('docs/readme.md');
      expect(getRelPath('file:///home/u/repo/docs/', 'file:///home/u/repo/')).toBe('docs');
      expect(getRelPath('file:///home/u/repo/', 'file:///home/u/repo/')).toBe('');
      expect(getRelPath('file:///home/u/repo', 'file:///home/u/repo/')).toBe('');
    });

    it('throws when target is outside base and never returns a URL', () => {
      expect(() => getRelPath('file:///home/u/other/', 'file:///home/u/repo/')).toThrow();
      expect(() => getRelPath('file:///home/u/other.md', 'file:///home/u/repo/')).toThrow();
    });
  });
});
