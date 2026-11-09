function tryDecode(bytes: Uint8Array, label: string): string | undefined {
  try {
    return new TextDecoder(label, { fatal: true }).decode(bytes);
  } catch {
    return undefined;
  }
}

function bomLabel(bytes: Uint8Array): string | undefined {
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return 'utf-8';
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return 'utf-16le';
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return 'utf-16be';
  return undefined;
}

/** Decodes in order: BOM, strict UTF-8, the HTTP charset, then windows-1252, which accepts every byte. */
export function decodeBytes(bytes: Uint8Array, httpCharset?: string): string {
  const bom = bomLabel(bytes);
  return (
    (bom && tryDecode(bytes, bom)) ||
    tryDecode(bytes, 'utf-8') ||
    (httpCharset && tryDecode(bytes, httpCharset.trim())) ||
    new TextDecoder('windows-1252').decode(bytes)
  );
}

export function charsetFromContentType(contentType: string | null): string | undefined {
  return /charset\s*=\s*"?([^";\s]+)/i.exec(contentType ?? '')?.[1];
}

/** `text()` unless charset compatibility is on, which reads bytes and decodes them with `decodeBytes`. */
export async function readResponseText(response: Response, charsetCompat: boolean): Promise<string> {
  if (!charsetCompat) return response.text();
  return decodeBytes(new Uint8Array(await response.arrayBuffer()), charsetFromContentType(response.headers.get('content-type')));
}
