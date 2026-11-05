import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import config from '../../wxt.config';

const sizes = [16, 32, 48, 128] as const;

function readPng(size: number) {
  const buffer = readFileSync(resolve('public/icons', `icon-${size}.png`));
  return {
    signature: buffer.subarray(1, 4).toString('ascii'),
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

describe('extension icons', () => {
  it.each(sizes)('icon-%i.png is a PNG at exactly %ix%i pixels', (size) => {
    expect(readPng(size)).toEqual({ signature: 'PNG', width: size, height: size });
  });

  it('manifest references every icon size for the extension and the toolbar action', () => {
    const manifest = config.manifest as { icons?: Record<string, string>; action?: { default_icon?: Record<string, string> } };
    const expected = {
      16: 'icons/icon-16.png',
      32: 'icons/icon-32.png',
      48: 'icons/icon-48.png',
      128: 'icons/icon-128.png',
    };
    expect(manifest.icons).toEqual(expected);
    expect(manifest.action?.default_icon).toEqual(expected);
  });
});
