// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { createBlockCache } from '../../src/render/cache';
import { highlight } from '../../src/render/highlight';

describe('enhancement helpers', () => {
  it('reuses content but distinguishes changed blocks and evicts least recently used entries', () => {
    const cache = createBlockCache<string>(2);
    let calls = 0;
    const put = (source: string) => cache.getOrCreate('code', 'js', source, () => String(++calls));
    expect(put('const a = 1')).toBe('1');
    expect(put('const a = 1')).toBe('1');
    expect(put('const a = 2')).toBe('2');
    expect(put('const a = 1')).toBe('1');
    put('const a = 3');
    expect(cache.size).toBe(2);
    expect(put('const a = 2')).toBe('4');
  });

  it('shares the same NUL-separated key across get, set, and getOrCreate', () => {
    const cache = createBlockCache<string>();
    cache.set('mermaid', 'theme', 'diagram', 'svg');
    expect(cache.get('mermaid', 'theme', 'diagram')).toBe('svg');
    expect(cache.getOrCreate('mermaid', 'theme', 'diagram', () => 'wrong')).toBe('svg');
  });

  it.each([['py', 'python'], ['rs', 'rust'], ['yml', 'yaml'], ['sh', 'bash'], ['md', 'markdown']])('supports the %s alias', async (alias, language) => {
    const result = await highlight('sample', alias);
    expect(result).toContain('shiki');
    expect(result).not.toContain('Unsupported language');
  });

  it('falls back to plain text for unknown languages and skips code over 200 KB', async () => {
    const unknown = await highlight('plain sample', 'not-a-real-language');
    expect(unknown).toContain('plain sample');
    expect(unknown).not.toContain('shiki');
    const known = await highlight('const answer = 42;', 'js');
    console.info('SHIKI_SAMPLE', known?.slice(0, 240));
    expect(known).toContain('shiki');
    expect(await highlight('x'.repeat(200 * 1024 + 1), 'js')).toBeNull();
  });

  it('sanitizes Shiki output with DOMPurify when replacing code blocks', async () => {
    const root = document.createElement('div');
    document.body.appendChild(root);
    root.innerHTML = '<pre><code class="language-js-test-xss">console.log(1);</code></pre>';
    const highlightMod = await import('../../src/render/highlight');
    vi.spyOn(highlightMod, 'highlight').mockResolvedValueOnce(
      '<pre class="shiki"><code class="language-js-test-xss"><script>alert(1)</script><span onclick="alert(2)">test</span></code></pre>'
    );
    const { enhance } = await import('../../src/render/enhance');
    await enhance(root);
    expect(root.querySelector('script')).toBeNull();
    expect(root.querySelector('span')?.getAttribute('onclick')).toBeNull();
    expect(root.querySelector('.shiki')).not.toBeNull();
    root.remove();
  });
});
