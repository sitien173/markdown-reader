import { describe, expect, it } from 'vitest';
import { buildToc } from '../../src/toc/toc';

describe('buildToc', () => {
  it('nests heading levels and promotes skipped levels to the nearest parent', () => {
    const tree = buildToc([{ level: 1, text: 'A', id: 'a' }, { level: 3, text: 'C', id: 'c' }, { level: 2, text: 'B', id: 'b' }]);
    expect(tree.map(x => x.id)).toEqual(['a']);
    expect(tree[0]!.children.map(x => x.id)).toEqual(['c', 'b']);
  });
});
