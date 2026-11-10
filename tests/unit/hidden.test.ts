import { describe, expect, it } from 'vitest';
import { createHidingRule, type GitignoreLevel } from '../../src/source/hidden';

describe('hiding rule (hidden.ts)', () => {
  it('hides dot-items when showHiddenItems is false', () => {
    const isEntryHidden = createHidingRule({
      showHiddenItems: false,
      ignorePatterns: '',
      chain: [],
    });

    expect(isEntryHidden('.git', true)).toBe(true);
    expect(isEntryHidden('.gitignore', false)).toBe(true);
    expect(isEntryHidden('.env', false)).toBe(true);
    expect(isEntryHidden('sub/.hidden', false)).toBe(true);
    expect(isEntryHidden('sub/.dotdir', true)).toBe(true);
    expect(isEntryHidden('normal.md', false)).toBe(false);
  });

  it('hides dot-items only when the entry itself starts with a dot, not when parent path segments start with a dot', () => {
    const isEntryHidden = createHidingRule({
      showHiddenItems: false,
      ignorePatterns: '',
      chain: [],
    });

    expect(isEntryHidden('.github', true)).toBe(true);
    expect(isEntryHidden('.github/docs/readme.md', false)).toBe(false);
    expect(isEntryHidden('.github/docs/sub', true)).toBe(false);
    expect(isEntryHidden('sub/.hidden', false)).toBe(true);
  });

  it('hides entries matching Settings patterns', () => {
    const isEntryHidden = createHidingRule({
      showHiddenItems: false,
      ignorePatterns: 'node_modules/\n*.tmp\nbuild/',
      chain: [],
    });

    expect(isEntryHidden('node_modules', true)).toBe(true);
    expect(isEntryHidden('node_modules/package.json', false)).toBe(true);
    expect(isEntryHidden('cache.tmp', false)).toBe(true);
    expect(isEntryHidden('src/cache.tmp', false)).toBe(true);
    expect(isEntryHidden('build', true)).toBe(true);
    expect(isEntryHidden('src/main.ts', false)).toBe(false);
  });

  it('ensures Settings "!" patterns never un-hide gitignored entries', () => {
    const chain: GitignoreLevel[] = [
      {
        dirPath: '',
        gitignoreText: 'ignored.md\n*.secret',
      },
    ];

    const isEntryHidden = createHidingRule({
      showHiddenItems: false,
      ignorePatterns: '!ignored.md\n!nested.secret',
      chain,
    });

    // The gitignore chain ignores it, so Settings ! pattern must NOT un-hide it
    expect(isEntryHidden('ignored.md', false)).toBe(true);
    expect(isEntryHidden('nested.secret', false)).toBe(true);
  });

  it('allows nested .gitignore negation to override a parent rule', () => {
    const chain: GitignoreLevel[] = [
      {
        dirPath: '',
        gitignoreText: '*.log',
      },
      {
        dirPath: 'sub',
        gitignoreText: '!keep.log',
      },
    ];

    const isEntryHidden = createHidingRule({
      showHiddenItems: false,
      ignorePatterns: '',
      chain,
    });

    // sub/keep.log is unignored by child level, overriding parent rule
    expect(isEntryHidden('sub/keep.log', false)).toBe(false);
    // sub/other.log is not unignored by child level, so parent rule hides it
    expect(isEntryHidden('sub/other.log', false)).toBe(true);
    // root level log file is hidden by parent rule
    expect(isEntryHidden('root.log', false)).toBe(true);
  });

  it('matches folder-only patterns with trailing "/" only for folders and not files', () => {
    const chain: GitignoreLevel[] = [
      {
        dirPath: '',
        gitignoreText: 'build/\ndist/',
      },
    ];

    const isEntryHidden = createHidingRule({
      showHiddenItems: false,
      ignorePatterns: 'temp/',
      chain,
    });

    // Folder matches folder-only pattern
    expect(isEntryHidden('build', true)).toBe(true);
    expect(isEntryHidden('dist', true)).toBe(true);
    expect(isEntryHidden('temp', true)).toBe(true);

    // File with same name does not match folder-only pattern
    expect(isEntryHidden('build', false)).toBe(false);
    expect(isEntryHidden('dist', false)).toBe(false);
    expect(isEntryHidden('temp', false)).toBe(false);
  });

  it('applies an ancestor .gitignore level above the entry folder', () => {
    const chain: GitignoreLevel[] = [
      {
        dirPath: '',
        gitignoreText: 'ancestor-ignore.txt\nshared/**/*.bak',
      },
      {
        dirPath: 'pkg/sub',
        gitignoreText: 'local-only.txt',
      },
    ];

    const isEntryHidden = createHidingRule({
      showHiddenItems: false,
      ignorePatterns: '',
      chain,
    });

    // Root gitignore is an ancestor of pkg/sub/deep/ancestor-ignore.txt and applies
    expect(isEntryHidden('pkg/sub/deep/ancestor-ignore.txt', false)).toBe(true);
    expect(isEntryHidden('shared/nested/file.bak', false)).toBe(true);

    // pkg/sub gitignore applies to its descendants
    expect(isEntryHidden('pkg/sub/local-only.txt', false)).toBe(true);

    // pkg/sub gitignore does NOT apply to sibling or parent folders
    expect(isEntryHidden('pkg/other/local-only.txt', false)).toBe(false);
    expect(isEntryHidden('local-only.txt', false)).toBe(false);
  });

  it('reveals everything when showHiddenItems is true', () => {
    const chain: GitignoreLevel[] = [
      {
        dirPath: '',
        gitignoreText: '*.ignored\nbuild/\n.git',
      },
    ];

    const isEntryHidden = createHidingRule({
      showHiddenItems: true,
      ignorePatterns: 'node_modules/\n*.tmp',
      chain,
    });

    expect(isEntryHidden('.git', true)).toBe(false);
    expect(isEntryHidden('.gitignore', false)).toBe(false);
    expect(isEntryHidden('node_modules', true)).toBe(false);
    expect(isEntryHidden('cache.tmp', false)).toBe(false);
    expect(isEntryHidden('test.ignored', false)).toBe(false);
    expect(isEntryHidden('build', true)).toBe(false);
  });
});
