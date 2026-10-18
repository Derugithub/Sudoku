#!/usr/bin/env node
/**
 * Placeholder app icons: a navy rounded tile with a 3x3 grid and one lit blue cell.
 * Pure Node (zlib PNG encoder, 4x4 supersampling), deterministic. Run: node scripts/generate-icons.mjs
 */
import { Buffer } from 'node:buffer';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'images');
const NAVY = [0x2b, 0x2d, 0x42];
const LINE = [0xf7, 0xf5, 0xf0];
const LIT = [0x7f, 0xb3, 0xe8];
const LIT_EDGE = [0x3a, 0x6e, 0xa5];

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function png(size, rgba) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function roundRect(x, y, x0, y0, x1, y1, r) {
  const cx = Math.min(Math.max(x, x0 + r), x1 - r);
  const cy = Math.min(Math.max(y, y0 + r), y1 - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r && x >= x0 && x <= x1 && y >= y0 && y <= y1;
}

/**
 * Paints in unit coordinates (0..1). `tile` draws the navy tile; `scale` shrinks the artwork for
 * adaptive-icon safe zones; `mono` paints everything in white for the monochrome layer.
 */
function paint(u, v, { tile, scale = 1, mono = false, bg = null }) {
  const x = (u - 0.5) / scale + 0.5;
  const y = (v - 0.5) / scale + 0.5;
  let color = bg ? [...bg, 255] : [0, 0, 0, 0];
  if (tile && roundRect(x, y, 0.04, 0.04, 0.96, 0.96, 0.22)) color = [...NAVY, 255];
  const g0 = 0.2;
  const g1 = 0.8;
  const cell = (g1 - g0) / 3;
  const w = 0.034;
  if (x >= g0 - w / 2 && x <= g1 + w / 2 && y >= g0 - w / 2 && y <= g1 + w / 2) {
    // lit cell: center
    const lx0 = g0 + cell + w / 2;
    const ly0 = g0 + cell + w / 2;
    if (roundRect(x, y, lx0 + 0.012, ly0 + 0.012, lx0 + cell - w - 0.012, ly0 + cell - w - 0.012, 0.03)) {
      const edge = roundRect(x, y, lx0 + 0.03, ly0 + 0.03, lx0 + cell - w - 0.03, ly0 + cell - w - 0.03, 0.02);
      color = mono ? [255, 255, 255, 255] : [...(edge ? LIT : LIT_EDGE), 255];
    }
    for (let i = 0; i <= 3; i++) {
      const p = g0 + i * cell;
      const outer = i === 0 || i === 3;
      const half = (outer ? w * 1.25 : w) / 2;
      if (Math.abs(x - p) <= half || Math.abs(y - p) <= half) {
        color = mono ? [255, 255, 255, 255] : [...LINE, 255];
      }
    }
  }
  return color;
}

function render(size, opts) {
  const out = Buffer.alloc(size * size * 4);
  const ss = 4;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const c = paint((px + (sx + 0.5) / ss) / size, (py + (sy + 0.5) / ss) / size, opts);
          r += c[0] * c[3];
          g += c[1] * c[3];
          b += c[2] * c[3];
          a += c[3];
        }
      }
      const i = (py * size + px) * 4;
      out[i] = a ? Math.round(r / a) : 0;
      out[i + 1] = a ? Math.round(g / a) : 0;
      out[i + 2] = a ? Math.round(b / a) : 0;
      out[i + 3] = Math.round(a / (ss * ss));
    }
  }
  return png(size, out);
}

mkdirSync(OUT, { recursive: true });
const files = {
  'icon.png': render(1024, { tile: true }),
  'android-icon-foreground.png': render(1024, { tile: false, scale: 0.75 }),
  'android-icon-background.png': render(1024, { tile: false, bg: NAVY, scale: 0.0001 }),
  'android-icon-monochrome.png': render(1024, { tile: false, scale: 0.75, mono: true }),
  'splash-icon.png': render(512, { tile: true }),
  'favicon.png': render(48, { tile: true }),
};
for (const [name, data] of Object.entries(files)) writeFileSync(join(OUT, name), data);
console.log(`Wrote ${Object.keys(files).length} icons to ${OUT}`);
