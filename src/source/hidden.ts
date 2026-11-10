import ignore, { type Ignore } from 'ignore';

export type GitignoreLevel = {
  dirPath: string;
  gitignoreText: string;
};

export type HidingRuleOptions = {
  showHiddenItems: boolean;
  ignorePatterns: string;
  chain?: GitignoreLevel[];
};

export type HiddenPredicate = (entryPath: string, isDir: boolean) => boolean;

interface CompiledLevel {
  normDir: string;
  depth: number;
  matcher: Ignore;
}

function cleanRelativePath(path: string): string {
  return path.replace(/^(\.\/|\/)+/, '').replace(/\/+$/, '');
}

export function createHidingRule(options: HidingRuleOptions): HiddenPredicate {
  if (options.showHiddenItems) {
    return () => false;
  }

  const settingsMatcher = ignore().add(options.ignorePatterns);

  const rawLevels = options.chain ?? [];
  const compiledLevels: CompiledLevel[] = rawLevels.map((lvl) => {
    const normDir = cleanRelativePath(lvl.dirPath);
    const depth = normDir === '' ? 0 : normDir.split('/').length;
    return {
      normDir,
      depth,
      matcher: ignore().add(lvl.gitignoreText),
    };
  });

  // Test levels deepest first
  compiledLevels.sort((a, b) => b.depth - a.depth);

  return (entryPath: string, isDir: boolean): boolean => {
    const cleanPath = cleanRelativePath(entryPath);
    if (!cleanPath) {
      return false;
    }

    // 1. The entry's own name starts with '.'
    const entryName = cleanPath.slice(cleanPath.lastIndexOf('/') + 1);
    if (entryName.startsWith('.')) {
      return true;
    }

    const entryWithSlash = isDir ? `${cleanPath}/` : cleanPath;

    // 2. Matches Settings pattern (evaluated relative to chain base).
    // Settings patterns only hide; a '!' pattern never un-hides anything.
    if (settingsMatcher.test(entryWithSlash).ignored) {
      return true;
    }

    // 3. The .gitignore chain ignores it: test levels deepest first.
    // The first result with ignored or unignored true decides.
    for (const level of compiledLevels) {
      const isAncestor = level.normDir === '' || cleanPath.startsWith(`${level.normDir}/`);
      if (!isAncestor) {
        continue;
      }

      const relPath = level.normDir === '' ? cleanPath : cleanPath.slice(level.normDir.length + 1);
      const testPath = isDir ? `${relPath}/` : relPath;
      const result = level.matcher.test(testPath);

      if (result.ignored) {
        return true;
      }
      if (result.unignored) {
        return false;
      }
    }

    return false;
  };
}
