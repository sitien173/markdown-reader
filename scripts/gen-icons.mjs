// Generates the extension icons as PNG files with no dependencies: a rounded accent tile with a white "M" glyph.
// Run with `node scripts/gen-icons.mjs`; output goes to public/icons/icon-<size>.png.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = resolve(root, 'public/icons');
const sizes = [16, 32, 48, 128];
const background = [0x59, 0x2d, 0x80, 255];
const foreground = [255, 255, 255, 255];
const SUPERSAMPLE = 4;

// Glyph strokes in unit coordinates.
const strokes = [
  [
    [0.24, 0.3],
    [0.24, 0.7],
  ],
  [
    [0.76, 0.3],
    [0.76, 0.7],
  ],
  [
    [0.24, 0.3],
    [0.5, 0.6],
  ],
  [
    [0.5, 0.6],
    [0.76, 0.3],
  ],
];
const strokeWidth = 0.1;
const cornerRadius = 0.2;

function distanceToSegment(x, y, [[x1, y1], [x2, y2]]) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy));
}

function insideRoundedSquare(x, y) {
  const cx = Math.min(Math.max(x, cornerRadius), 1 - cornerRadius);
  const cy = Math.min(Math.max(y, cornerRadius), 1 - cornerRadius);
  return Math.hypot(x - cx, y - cy) <= cornerRadius;
}

function pixel(u, v) {
  if (!insideRoundedSquare(u, v)) return [0, 0, 0, 0];
  const onGlyph = strokes.some((segment) => distanceToSegment(u, v, segment) <= strokeWidth / 2);
  return onGlyph ? foreground : background;
}

function renderIcon(size) {
  const rows = Buffer.alloc((size * 4 + 1) * size);
  const samples = SUPERSAMPLE * SUPERSAMPLE;
  for (let y = 0; y < size; y++) {
    const rowStart = y * (size * 4 + 1);
    rows[rowStart] = 0;
    for (let x = 0; x < size; x++) {
      const sum = [0, 0, 0, 0];
      for (let sy = 0; sy < SUPERSAMPLE; sy++) {
        for (let sx = 0; sx < SUPERSAMPLE; sx++) {
          const u = (x + (sx + 0.5) / SUPERSAMPLE) / size;
          const v = (y + (sy + 0.5) / SUPERSAMPLE) / size;
          const [r, g, b, a] = pixel(u, v);
          sum[0] += r * a;
          sum[1] += g * a;
          sum[2] += b * a;
          sum[3] += a;
        }
      }
      const alpha = sum[3] / samples;
      const offset = rowStart + 1 + x * 4;
      if (alpha > 0) {
        rows[offset] = Math.round(sum[0] / sum[3]);
        rows[offset + 1] = Math.round(sum[1] / sum[3]);
        rows[offset + 2] = Math.round(sum[2] / sum[3]);
      }
      rows[offset + 3] = Math.round(alpha);
    }
  }
  return rows;
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData));
  return Buffer.concat([length, typeAndData, crc]);
}

function encodePng(size) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(renderIcon(size), { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync(outDir, { recursive: true });
for (const size of sizes) {
  const file = resolve(outDir, `icon-${size}.png`);
  writeFileSync(file, encodePng(size));
  console.log(`wrote ${file} (${size}x${size})`);
}
