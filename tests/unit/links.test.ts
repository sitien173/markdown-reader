// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render } from '../../src/render/pipeline';

describe('link rewriting', () => {
  it('resolves relative href/src, retains fragments, marks markdown links, and secures external links', () => {
    const html = render(
      '[next](next.md) [part](#part) [out](https://other.test/x) [absolute](https://example.test/a.markdown)\n\n<img src="../img.png"><a target="_blank" rel="opener" href="https://example.test/same">same</a><a href="//cdn.example.test/x">scheme</a>',
      'https://example.test/docs/readme.md',
    ).html;
    const doc = new DOMParser().parseFromString(html, 'text/html');
    expect(doc.querySelector('a')?.getAttribute('href')).toBe('https://example.test/docs/next.md');
    expect(doc.querySelector('a')?.getAttribute('data-md-link')).toBe('');
    expect(doc.querySelector('a[href="#user-content-part"]')?.getAttribute('href')).toBe('#user-content-part');
    expect(doc.querySelector('a[href^="https://other"]')?.getAttribute('target')).toBe('_blank');
    expect(doc.querySelector('a[href^="https://other"]')?.getAttribute('rel')).toBe('noopener noreferrer');
    expect(doc.querySelector('a[href="https://example.test/same"]')?.getAttribute('rel')).toBe('noopener noreferrer');
    expect(doc.querySelector('a[href="https://cdn.example.test/x"]')?.getAttribute('target')).toBe('_blank');
    expect(doc.querySelector('a[href="https://example.test/a.markdown"]')?.hasAttribute('data-md-link')).toBe(true);
    expect(doc.querySelector('img')?.getAttribute('src')).toBe('https://example.test/img.png');
  });
  it('marks markdown absolute paths and secures all http links with file or empty bases', () => {
    const html = render(
      '<a href="https://example.test/a.markdown">md</a><a href="https://example.test/">web</a><a href="//cdn.example.test/x">scheme</a>',
      'file:///tmp/read.md',
    ).html;
    const doc = new DOMParser().parseFromString(html, 'text/html');
    expect(doc.querySelector('a[href$="a.markdown"]')?.hasAttribute('data-md-link')).toBe(true);
    expect(doc.querySelector('a[href="https://example.test/"]')?.getAttribute('target')).toBe('_blank');
  });

  it('marks .json and .jsonc links with data-md-link attribute', () => {
    const html = render(
      '[config](config.json) [schema](https://example.test/schema.jsonc) [text](notes.txt)',
      'https://example.test/docs/readme.md',
    ).html;
    const doc = new DOMParser().parseFromString(html, 'text/html');
    expect(doc.querySelector('a[href$="config.json"]')?.hasAttribute('data-md-link')).toBe(true);
    expect(doc.querySelector('a[href$="schema.jsonc"]')?.hasAttribute('data-md-link')).toBe(true);
    expect(doc.querySelector('a[href$="notes.txt"]')?.hasAttribute('data-md-link')).toBe(false);
  });

  it('resolves folder-relative links and renders unresolvable outside links as disabled', async () => {
    const doc = new DOMParser().parseFromString(
      '<a href="sub/target.md">inner</a><a href="../outside.md">outside</a><a href="https://example.com/ext.md">external</a>',
      'text/html',
    );
    const { resolveFolderLinks } = (await import('../../src/render/links')) as any;

    const inner = doc.querySelector('a[href="sub/target.md"]')!;
    resolveFolderLinks(inner, 'docs/readme.md');
    expect(inner.getAttribute('href')).toBe('docs/sub/target.md');
    expect(inner.hasAttribute('data-md-link')).toBe(true);
    expect(inner.getAttribute('data-folder-path')).toBe('docs/sub/target.md');

    const outside = doc.querySelector('a[href="../outside.md"]')!;
    resolveFolderLinks(outside, 'readme.md');
    expect(outside.hasAttribute('href')).toBe(false);
    expect(outside.getAttribute('aria-disabled')).toBe('true');
  });

  it('marks a folder-relative JSON link with data-md-link and data-folder-path', async () => {
    const doc = new DOMParser().parseFromString('<a href="sub/data.json">data</a>', 'text/html');
    const { resolveFolderLinks } = await import('../../src/render/links');
    const link = doc.querySelector('a') as HTMLAnchorElement;
    resolveFolderLinks(link, 'docs/readme.md');
    expect(link.hasAttribute('data-md-link')).toBe(true);
    expect(link.getAttribute('data-folder-path')).toBe('docs/sub/data.json');
  });

  it('cancels superseded image work with AbortSignal and revokes created URL immediately', async () => {
    let revoked = '';
    const fakeUrl = 'blob:test-image-123';
    const originalRevoke = URL.revokeObjectURL;
    URL.revokeObjectURL = vi.fn((u) => {
      revoked = u;
    });

    const controller = new AbortController();
    const fakeSource = {
      resolveImage: vi.fn(async () => {
        controller.abort();
        return { src: fakeUrl };
      }),
      revokeObjectUrls: vi.fn(),
    };

    const doc = new DOMParser().parseFromString('<img src="photo.png">', 'text/html');

    const { resolveFolderImages } = (await import('../../src/render/links')) as any;
    await resolveFolderImages(doc.body, fakeSource, 'readme.md', undefined, controller.signal);

    const img = doc.querySelector('img')!;
    expect(img.getAttribute('src')).not.toBe(fakeUrl);
    expect(revoked).toBe(fakeUrl);

    URL.revokeObjectURL = originalRevoke;
  });

  it('notifies onUrlCreated for valid resolved blob URLs', async () => {
    const fakeUrl = 'blob:test-image-456';
    const fakeSource = {
      resolveImage: vi.fn(async () => ({ src: fakeUrl })),
      revokeUrl: vi.fn(),
      revokeObjectUrls: vi.fn(),
    };

    const doc = new DOMParser().parseFromString('<img src="photo.png">', 'text/html');
    const created: string[] = [];

    const { resolveFolderImages } = (await import('../../src/render/links')) as any;
    await resolveFolderImages(doc.body, fakeSource, 'readme.md', undefined, undefined, (u: string) => {
      created.push(u);
    });

    const img = doc.querySelector('img')!;
    expect(img.getAttribute('src')).toBe(fakeUrl);
    expect(created).toEqual([fakeUrl]);
  });
});
