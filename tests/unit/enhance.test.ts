// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createBlockCache } from '../../src/render/cache';
import { highlight } from '../../src/render/highlight';
import { enhanceDiagrams, renderDiagramSvg, rerenderDiagrams } from '../../src/render/diagram';

const mermaidMock = vi.hoisted(() => ({
  initialize: vi.fn(),
  render: vi.fn(),
}));
vi.mock('mermaid', () => ({ default: mermaidMock }));

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

  it.each([
    ['py', 'python'],
    ['rs', 'rust'],
    ['yml', 'yaml'],
    ['sh', 'bash'],
    ['md', 'markdown'],
  ])('supports the %s alias', async (alias, language) => {
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
      '<pre class="shiki"><code class="language-js-test-xss"><script>alert(1)</script><span onclick="alert(2)">test</span></code></pre>',
    );
    const { enhance } = await import('../../src/render/enhance');
    await enhance(root);
    expect(root.querySelector('script')).toBeNull();
    expect(root.querySelector('span')?.getAttribute('onclick')).toBeNull();
    expect(root.querySelector('.shiki')).not.toBeNull();
    root.remove();
  });
});

describe('code block and heading chrome', () => {
  const mount = (html: string) => {
    const root = document.createElement('div');
    root.innerHTML = html;
    document.body.append(root);
    return root;
  };
  const stubClipboard = (writeText: (text: string) => Promise<void>) =>
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

  it('adds a language label and a Copy button that writes the exact source and reports Copied', async () => {
    const writeText = vi.fn(async () => undefined);
    stubClipboard(writeText);
    const root = mount('<pre><code class="language-js">const a = 1;\nconst b = 2;\n</code></pre>');
    const { enhance } = await import('../../src/render/enhance');
    await enhance(root);
    expect(root.querySelector('.md-code-lang')?.textContent).toBe('js');
    const button = root.querySelector('.md-code button') as HTMLButtonElement;
    expect(button.textContent).toBe('Copy');
    button.click();
    await vi.waitFor(() => expect(button.textContent).toBe('Copied'));
    expect(writeText).toHaveBeenCalledWith('const a = 1;\nconst b = 2;\n');
    root.remove();
  });

  it('shows a failure label and does not throw when the clipboard refuses', async () => {
    stubClipboard(() => Promise.reject(new DOMException('denied', 'NotAllowedError')));
    const root = mount('<pre><code>plain</code></pre>');
    const { enhance } = await import('../../src/render/enhance');
    await enhance(root);
    const button = root.querySelector('.md-code button') as HTMLButtonElement;
    button.click();
    await vi.waitFor(() => expect(button.textContent).toBe('Copy failed'));
    root.remove();
  });

  it('adds one aria-hidden, unfocusable permalink to each heading with an id, even when enhanced twice', async () => {
    const root = mount('<h2 id="user-content-intro">Intro</h2><h3>No id</h3>');
    const { enhance } = await import('../../src/render/enhance');
    await enhance(root);
    await enhance(root);
    const links = root.querySelectorAll('a.md-permalink');
    expect(links).toHaveLength(1);
    expect(links[0]?.getAttribute('aria-hidden')).toBe('true');
    expect(links[0]?.getAttribute('href')).toBe('#user-content-intro');
    expect([null, '-1']).toContain(links[0]?.getAttribute('tabindex'));
    expect(root.querySelectorAll('.md-code')).toHaveLength(0);
    root.remove();
  });

  it('leaves mermaid blocks without a Copy button', async () => {
    const root = mount('<pre class="mermaid">graph TD; A--&gt;B</pre>');
    const { enhance } = await import('../../src/render/enhance');
    await enhance(root);
    expect(root.querySelector('.md-code')).toBeNull();
    root.remove();
  });
});

describe('dual-theme highlighting', () => {
  it('emits light and dark colors in one output so the theme switches by CSS alone', async () => {
    const html = (await highlight('const answer = 42;', 'js'))!;
    expect(html).toContain('--shiki-dark:');
    expect(html).toContain('--shiki-dark-bg:');
    expect(html).toContain('github-light');
    expect(html).toContain('github-dark');
  });
});

describe('diagram theming', () => {
  const tokens: Record<string, string> = {};
  const setTheme = (dark: boolean) => {
    Object.assign(
      tokens,
      dark
        ? { '--muted': '#2c2c2e', '--foreground': '#f5f5f7', '--background': '#1c1c1e' }
        : { '--muted': '#f5f5f7', '--foreground': '#1d1d1f', '--background': '#ffffff' },
    );
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({ getPropertyValue: (name: string) => tokens[name] ?? '' } as CSSStyleDeclaration);
  };
  const svgFor = (id: string, tag: string) => `<svg id="${id}"><title>${tag}</title></svg>`;
  const lastVariables = () => mermaidMock.initialize.mock.calls.at(-1)![0].themeVariables;
  // The diagram cache is module-wide, so each test uses its own source.
  const mount = (source = 'graph TD; A--&gt;B') => {
    const root = document.createElement('div');
    root.innerHTML = `<pre class="mermaid">${source}</pre>`;
    document.body.append(root);
    return root;
  };

  afterEach(() => {
    vi.restoreAllMocks();
    // @ts-expect-error restore the environment without matchMedia
    delete window.matchMedia;
    mermaidMock.initialize.mockReset();
    mermaidMock.render.mockReset();
    document.body.replaceChildren();
  });

  it('keeps the Mermaid source on the wrapper and rerenders it with the current theme colors', async () => {
    setTheme(false);
    mermaidMock.render.mockImplementation(async (id: string) => ({ svg: svgFor(id, 'light') }));
    const root = mount();
    await enhanceDiagrams(root);
    const wrapper = root.querySelector('[data-md-diagram]')!;
    expect(wrapper.getAttribute('data-md-diagram')).toBe('graph TD; A-->B');
    expect(wrapper.querySelector('title')?.textContent).toBe('light');
    expect(lastVariables().primaryColor).toBe('#f5f5f7');

    setTheme(true);
    mermaidMock.render.mockImplementation(async (id: string) => ({ svg: svgFor(id, 'dark') }));
    await rerenderDiagrams(root);
    expect(root.querySelectorAll('svg')).toHaveLength(1);
    expect(root.querySelector('[data-md-diagram] title')?.textContent).toBe('dark');
    expect(lastVariables().primaryColor).toBe('#2c2c2e');
  });

  it('discards a result from an earlier theme and leaves no temporary nodes', async () => {
    setTheme(false);
    mermaidMock.render.mockImplementation(async (id: string) => ({ svg: svgFor(id, 'light') }));
    const root = mount('graph TD; X--&gt;Y');
    await enhanceDiagrams(root);

    let finishDark: () => void = () => {};
    mermaidMock.render.mockImplementation(
      (id: string) =>
        new Promise((resolve) => {
          finishDark = () => resolve({ svg: svgFor(id, 'stale-dark') });
        }),
    );
    setTheme(true);
    const stale = rerenderDiagrams(root);
    await vi.waitFor(() => expect(mermaidMock.render).toHaveBeenCalledTimes(2));
    // Back to light before the dark render finishes; the light result is already cached.
    setTheme(false);
    await rerenderDiagrams(root);
    expect(root.querySelector('[data-md-diagram] title')?.textContent).toBe('light');
    finishDark();
    await stale;
    expect(root.querySelector('[data-md-diagram] title')?.textContent).toBe('light');
    expect(root.querySelectorAll('svg')).toHaveLength(1);
    expect(document.querySelectorAll('[id^="markdown-diagram-"]:not([data-md-diagram] *)')).toHaveLength(0);
  });

  it('serializes renders so an export theme cannot leak into a live render', async () => {
    const configAtRender: string[] = [];
    let current = '';
    mermaidMock.initialize.mockImplementation((config: { themeVariables: { background: string } }) => {
      current = config.themeVariables.background;
    });
    mermaidMock.render.mockImplementation(async (id: string) => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      configAtRender.push(current);
      return { svg: svgFor(id, current) };
    });
    const mermaid = (await import('mermaid')).default;
    const [live, exported] = await Promise.all([
      renderDiagramSvg(mermaid, 'graph TD; L-->M', { background: '#111111' }, 'live-a'),
      renderDiagramSvg(mermaid, 'graph TD; L-->M', { background: '#eeeeee' }, 'export-a'),
    ]);
    expect(configAtRender).toEqual(['#111111', '#eeeeee']);
    expect(live).toContain('#111111');
    expect(exported).toContain('#eeeeee');
  });

  it('keeps a light copy for print next to a dark screen render', async () => {
    setTheme(true);
    window.matchMedia = (() => ({ matches: true })) as unknown as typeof window.matchMedia;
    mermaidMock.render.mockImplementation(async (id: string) => ({
      svg: svgFor(id, mermaidMock.initialize.mock.calls.at(-1)![0].themeVariables.background),
    }));
    const root = mount('graph TD; P--&gt;Q');
    await enhanceDiagrams(root);
    const screenCopy = root.querySelector('.md-diagram-screen title')?.textContent;
    const printCopy = root.querySelector('.md-diagram-print title')?.textContent;
    expect(screenCopy).toBe('#1c1c1e');
    expect(printCopy).toBe('#ffffff');
    const ids = [...root.querySelectorAll('[id]')].map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('shows every screen copy before any print copy render resolves', async () => {
    setTheme(true);
    window.matchMedia = (() => ({ matches: true })) as unknown as typeof window.matchMedia;
    let releasePrint!: () => void;
    const printGate = new Promise<void>((resolve) => {
      releasePrint = resolve;
    });
    mermaidMock.render.mockImplementation(async (id: string) => {
      const background = mermaidMock.initialize.mock.calls.at(-1)![0].themeVariables.background;
      if (background === '#ffffff') await printGate;
      return { svg: svgFor(id, background) };
    });
    const root = document.createElement('div');
    root.innerHTML = '<pre class="mermaid">graph TD; S1--&gt;S2</pre><pre class="mermaid">graph TD; S3--&gt;S4</pre>';
    document.body.append(root);

    const pending = enhanceDiagrams(root);
    await vi.waitFor(() => expect(root.querySelectorAll('.md-diagram-screen')).toHaveLength(2));
    expect(root.querySelectorAll('pre.mermaid')).toHaveLength(0);
    expect(root.querySelectorAll('.md-diagram-print')).toHaveLength(0);

    releasePrint();
    await pending;
    expect(root.querySelectorAll('.md-diagram-print')).toHaveLength(2);
    expect(root.querySelector('.md-diagram-print title')?.textContent).toBe('#ffffff');
    expect(root.querySelector('.md-diagram-screen title')?.textContent).toBe('#1c1c1e');
  });
  it('keeps one light print copy across a rerender in the dark scheme and drops it in the light scheme', async () => {
    setTheme(true);
    window.matchMedia = (() => ({ matches: true })) as unknown as typeof window.matchMedia;
    mermaidMock.render.mockImplementation(async (id: string) => ({
      svg: svgFor(id, mermaidMock.initialize.mock.calls.at(-1)![0].themeVariables.background),
    }));
    const root = mount('graph TD; R1--&gt;R2');
    await enhanceDiagrams(root);
    await rerenderDiagrams(root);
    expect(root.querySelectorAll('.md-diagram-screen')).toHaveLength(1);
    expect(root.querySelectorAll('.md-diagram-print')).toHaveLength(1);

    window.matchMedia = (() => ({ matches: false })) as unknown as typeof window.matchMedia;
    setTheme(false);
    await rerenderDiagrams(root);
    expect(root.querySelectorAll('.md-diagram-screen')).toHaveLength(1);
    expect(root.querySelectorAll('.md-diagram-print')).toHaveLength(0);
  });
});
