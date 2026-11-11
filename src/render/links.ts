import { resolveRelativePath, type DirectorySource } from '../source/directory';
import { isJsonName } from '../lib/doc-kind';

export function resolveLink(element: Element, baseUrl: string): void {
  const base = (() => {
    try {
      return baseUrl ? new URL(baseUrl) : null;
    } catch {
      return null;
    }
  })();
  for (const attribute of ['href', 'src']) {
    const value = element.getAttribute(attribute);
    if (!value || (attribute === 'href' && value.startsWith('#'))) continue;
    let resolved: URL;
    try {
      resolved = new URL(value, baseUrl || undefined);
    } catch {
      continue;
    }
    element.setAttribute(attribute, resolved.href);
    if (attribute === 'href' && (/\.(?:md|markdown)$/i.test(resolved.pathname) || isJsonName(resolved.pathname))) {
      element.setAttribute('data-md-link', '');
    }
    if (
      attribute === 'href' &&
      /^https?:$/.test(resolved.protocol) &&
      (!base || base.protocol === 'file:' || resolved.origin !== base.origin)
    ) {
      element.setAttribute('target', '_blank');
    }
  }
  if (element.localName === 'a' && element.getAttribute('target')?.toLowerCase() === '_blank') {
    element.setAttribute('rel', 'noopener noreferrer');
  }
}

export function resolveFolderLinks(element: Element, currentDocPath: string, fallbackBaseUrl?: string): void {
  const href = element.getAttribute('href');
  if (!href || href.startsWith('#')) return;

  if (/^[a-z][a-z0-9+.-]*:/i.test(href)) {
    try {
      const parsed = new URL(href);
      if (/^https?:$/i.test(parsed.protocol)) {
        element.setAttribute('target', '_blank');
        element.setAttribute('rel', 'noopener noreferrer');
      }
      if (/\.(?:md|markdown)$/i.test(parsed.pathname) || isJsonName(parsed.pathname)) {
        element.setAttribute('data-md-link', '');
      }
    } catch {
      // not a standard URL
    }
    return;
  }

  const { path, isOutside } = resolveRelativePath(currentDocPath, href);
  if (isOutside) {
    if (fallbackBaseUrl) {
      try {
        const resolved = new URL(href, fallbackBaseUrl);
        element.setAttribute('href', resolved.href);
        if (/\.(?:md|markdown)$/i.test(resolved.pathname) || isJsonName(resolved.pathname)) element.setAttribute('data-md-link', '');
        if (/^https?:$/i.test(resolved.protocol)) {
          element.setAttribute('target', '_blank');
          element.setAttribute('rel', 'noopener noreferrer');
        }
        return;
      } catch {
        // fall through to disable
      }
    }
    element.removeAttribute('href');
    element.setAttribute('aria-disabled', 'true');
    return;
  }

  element.setAttribute('href', path);
  if (/\.(?:md|markdown)$/i.test(path) || isJsonName(path)) {
    element.setAttribute('data-md-link', '');
    element.setAttribute('data-folder-path', path);
  }
}

export async function resolveFolderImages(
  root: Element,
  source: DirectorySource,
  currentDocPath: string,
  fallbackBaseUrl?: string,
  signal?: AbortSignal,
  onUrlCreated?: (url: string) => void,
): Promise<void> {
  const images = Array.from(root.querySelectorAll<HTMLImageElement>('img[src]'));
  for (const img of images) {
    if (signal?.aborted) return;
    const rawSrc = img.getAttribute('src');
    if (!rawSrc) continue;
    if (/^(?:https?:|data:|blob:)/i.test(rawSrc)) continue;
    const resolved = await source.resolveImage(rawSrc, currentDocPath, fallbackBaseUrl);
    if (signal?.aborted) {
      if (resolved.src && resolved.src.startsWith('blob:')) {
        if (typeof (source as any).revokeUrl === 'function') {
          (source as any).revokeUrl(resolved.src);
        } else {
          URL.revokeObjectURL(resolved.src);
        }
      }
      return;
    }
    if (resolved.disabled) {
      img.removeAttribute('src');
      img.setAttribute('aria-disabled', 'true');
    } else if (resolved.src) {
      img.setAttribute('src', resolved.src);
      if (resolved.src.startsWith('blob:')) {
        onUrlCreated?.(resolved.src);
      }
    }
  }
}
