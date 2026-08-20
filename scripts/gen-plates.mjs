/**
 * Generates the drafting plates that stand in for catalogue photography, plus the
 * blur placeholders and dimension anchor boxes that go with them.
 *
 * Each plate is an orthographic front elevation drawn from the piece's real
 * width/height, so the anchor box handed to the dimension overlay is measured
 * geometry rather than a guess.
 *
 * Run: node gen-plates.mjs <projectRoot>
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const root = process.argv[2];
if (!root) throw new Error('usage: node gen-plates.mjs <projectRoot>');

const catalogue = JSON.parse(
  readFileSync(path.join(root, 'src/lib/catalog/catalogue.json'), 'utf8'),
);
const pieces = catalogue.pieces;

const PAPER = '#f7f7f6';
const GRID = '#e6e7e9';
const GRID_MAJOR = '#d8dadd';
const LINE = '#23262a';
const HAIR = '#9aa0a6';

const RATIOS = [
  { key: 'wide', w: 1600, h: 1200 }, // 4:3 — the primary, and the LCP element
  { key: 'square', w: 1200, h: 1200 }, // 1:1
  { key: 'pano', w: 1600, h: 900 }, // 16:9
];

/** Interior detail lines per piece type, drawn inside the piece box. */
function detail(type, x, y, w, h, seatFrac) {
  const L = [];
  const r = (n) => Math.round(n * 100) / 100;
  const line = (x1, y1, x2, y2, stroke = LINE, sw = 2) =>
    `<line x1="${r(x1)}" y1="${r(y1)}" x2="${r(x2)}" y2="${r(y2)}" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="square"/>`;
  const rect = (rx, ry, rw, rh, sw = 2) =>
    `<rect x="${r(rx)}" y="${r(ry)}" width="${r(rw)}" height="${r(rh)}" fill="none" stroke="${LINE}" stroke-width="${sw}"/>`;

  const seatY = seatFrac ? y + h * (1 - seatFrac) : y + h * 0.55;

  switch (type) {
    case 'sofa':
    case 'armchair': {
      const armW = w * 0.11;
      L.push(rect(x, y + h * 0.18, armW, h * 0.82 - h * 0.18));
      L.push(rect(x + w - armW, y + h * 0.18, armW, h * 0.82 - h * 0.18));
      L.push(line(x + armW, seatY, x + w - armW, seatY));
      const cushions = type === 'sofa' ? 3 : 1;
      const cw = (w - armW * 2) / cushions;
      for (let i = 1; i < cushions; i += 1) {
        L.push(line(x + armW + cw * i, seatY, x + armW + cw * i, y + h * 0.82, HAIR, 1.5));
      }
      L.push(line(x + armW, y + h * 0.18, x + w - armW, y + h * 0.18));
      for (let i = 0; i < 2; i += 1) {
        const lx = x + w * (i === 0 ? 0.08 : 0.92);
        L.push(line(lx, y + h * 0.82, lx, y + h));
      }
      break;
    }
    case 'dining-table':
    case 'desk': {
      const topH = h * 0.09;
      L.push(rect(x, y, w, topH));
      const inset = w * 0.06;
      L.push(line(x + inset, y + topH, x + inset, y + h));
      L.push(line(x + w - inset, y + topH, x + w - inset, y + h));
      if (type === 'desk') {
        L.push(rect(x + w * 0.55, y + topH, w * 0.33, h * 0.28, 1.5));
        L.push(line(x + w * 0.55, y + topH + h * 0.14, x + w * 0.88, y + topH + h * 0.14, HAIR, 1.5));
      } else {
        L.push(line(x + inset, y + topH + h * 0.12, x + w - inset, y + topH + h * 0.12, HAIR, 1.5));
      }
      break;
    }
    case 'coffee-table':
    case 'side-table':
    case 'bench': {
      const topH = h * 0.14;
      L.push(rect(x, y, w, topH));
      const inset = w * 0.08;
      L.push(line(x + inset, y + topH, x + inset, y + h));
      L.push(line(x + w - inset, y + topH, x + w - inset, y + h));
      break;
    }
    case 'sideboard': {
      const doors = 3;
      const dw = w / doors;
      for (let i = 1; i < doors; i += 1) L.push(line(x + dw * i, y, x + dw * i, y + h * 0.86));
      for (let i = 0; i < doors; i += 1) {
        L.push(line(x + dw * i + dw * 0.62, y + h * 0.42, x + dw * i + dw * 0.82, y + h * 0.42, LINE, 3));
      }
      L.push(line(x, y + h * 0.86, x + w, y + h * 0.86));
      for (let i = 0; i < 2; i += 1) {
        const lx = x + w * (i === 0 ? 0.06 : 0.94);
        L.push(line(lx, y + h * 0.86, lx, y + h));
      }
      break;
    }
    case 'bookshelf': {
      const shelves = 5;
      for (let i = 1; i < shelves; i += 1) {
        L.push(line(x, y + (h * 0.92 * i) / shelves, x + w, y + (h * 0.92 * i) / shelves));
      }
      L.push(line(x, y + h * 0.92, x + w, y + h * 0.92));
      break;
    }
    case 'wardrobe': {
      L.push(line(x + w / 2, y, x + w / 2, y + h * 0.94));
      L.push(line(x + w * 0.44, y + h * 0.45, x + w * 0.44, y + h * 0.56, LINE, 3));
      L.push(line(x + w * 0.56, y + h * 0.45, x + w * 0.56, y + h * 0.56, LINE, 3));
      L.push(line(x, y + h * 0.94, x + w, y + h * 0.94));
      break;
    }
    case 'bed': {
      const headH = h * 0.62;
      L.push(rect(x, y, w * 0.06, headH));
      L.push(rect(x + w - w * 0.06, y, w * 0.06, headH));
      L.push(line(x, y, x + w, y));
      L.push(line(x, y + headH * 0.9, x + w, y + headH * 0.9));
      L.push(rect(x + w * 0.06, y + headH * 0.9, w * 0.88, h * 0.2, 1.5));
      for (let i = 0; i < 2; i += 1) {
        const lx = x + w * (i === 0 ? 0.09 : 0.91);
        L.push(line(lx, y + headH * 0.9 + h * 0.2, lx, y + h));
      }
      break;
    }
    case 'dining-chair': {
      L.push(rect(x, y, w, h * (1 - (seatFrac ?? 0.55)), 2));
      L.push(line(x, seatY, x + w, seatY));
      for (let i = 0; i < 2; i += 1) {
        const lx = x + w * (i === 0 ? 0.1 : 0.9);
        L.push(line(lx, seatY, lx, y + h));
      }
      break;
    }
    default:
      break;
  }
  return L.join('');
}

function plateSvg(piece, W, H, fill, label) {
  // Fit the elevation into 66% of the frame, preserving the real w:h ratio.
  const margin = Math.min(W, H) * 0.17;
  const availW = W - margin * 2;
  const availH = H - margin * 2;
  const ratio = piece.w / piece.h;
  let pw = availW;
  let ph = pw / ratio;
  if (ph > availH) {
    ph = availH;
    pw = ph * ratio;
  }
  const px = (W - pw) / 2;
  const py = (H - ph) / 2 + margin * 0.12;

  const grid = [];
  const step = 40;
  for (let gx = 0; gx <= W; gx += step) {
    grid.push(
      `<line x1="${gx}" y1="0" x2="${gx}" y2="${H}" stroke="${gx % (step * 5) === 0 ? GRID_MAJOR : GRID}" stroke-width="1"/>`,
    );
  }
  for (let gy = 0; gy <= H; gy += step) {
    grid.push(
      `<line x1="0" y1="${gy}" x2="${W}" y2="${gy}" stroke="${gy % (step * 5) === 0 ? GRID_MAJOR : GRID}" stroke-width="1"/>`,
    );
  }

  const seatFrac = piece.seatH ? piece.seatH / piece.h : undefined;

  const corner = (cx, cy, sx, sy) =>
    `<path d="M ${cx + 26 * sx} ${cy} H ${cx} V ${cy + 26 * sy}" fill="none" stroke="${HAIR}" stroke-width="2"/>`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${PAPER}"/>
  <g opacity="0.85">${grid.join('')}</g>
  ${corner(24, 24, 1, 1)}${corner(W - 24, 24, -1, 1)}${corner(24, H - 24, 1, -1)}${corner(W - 24, H - 24, -1, -1)}
  <rect x="${px}" y="${py}" width="${pw}" height="${ph}" fill="${fill ?? 'none'}" fill-opacity="${fill ? 0.55 : 0}" stroke="${LINE}" stroke-width="2.5"/>
  ${detail(piece.type, px, py, pw, ph, seatFrac)}
  <text x="28" y="${H - 34}" font-family="monospace" font-size="21" fill="${LINE}" letter-spacing="1.5">${label ?? piece.sku}</text>
  <text x="${W - 28}" y="${H - 34}" text-anchor="end" font-family="monospace" font-size="21" fill="${HAIR}" letter-spacing="1.5">${piece.w} × ${piece.d} × ${piece.h} mm</text>
</svg>`;

  const anchors = {
    x1: Math.round((px / W) * 10000) / 10000,
    y1: Math.round((py / H) * 10000) / 10000,
    x2: Math.round(((px + pw) / W) * 10000) / 10000,
    y2: Math.round(((py + ph) / H) * 10000) / 10000,
  };

  return { svg, anchors };
}

const outDir = path.join(root, 'public/media');
await mkdir(outDir, { recursive: true });

const manifest = {};

async function emit(key, file, piece, ratio, fill, label) {
  const { svg, anchors } = plateSvg(piece, ratio.w, ratio.h, fill, label);
  const buf = Buffer.from(svg);
  await sharp(buf).webp({ quality: 88 }).toFile(path.join(outDir, file));
  const blur = await sharp(buf).resize(12).webp({ quality: 55 }).toBuffer();
  manifest[key] = {
    path: `/media/${file}`,
    width: ratio.w,
    height: ratio.h,
    blurDataUrl: `data:image/webp;base64,${blur.toString('base64')}`,
    anchors,
  };
}

for (const piece of pieces) {
  // Product-level plates: one per aspect ratio, untinted. These are the card
  // image, the OG card and the three image shapes the Product JSON-LD wants.
  for (const ratio of RATIOS) {
    await emit(`${piece.slug}:${ratio.key}`, `${piece.slug}-${ratio.key}.webp`, piece, ratio);
  }

  // Per-variant plates: the elevation filled with the finish, so selecting a
  // variant genuinely swaps the imagery rather than pretending to.
  for (const [i, variant] of piece.variants.entries()) {
    for (const ratio of RATIOS.slice(0, 2)) {
      await emit(
        `${piece.slug}:v${i}:${ratio.key}`,
        `${piece.slug}-v${i}-${ratio.key}.webp`,
        piece,
        ratio,
        variant.swatchHex,
        `${variant.sku}`,
      );
    }
  }
}

const ts = `/* GENERATED by scripts/gen-plates.mjs — do not hand-edit.
 *
 * Stand-in catalogue imagery: orthographic elevation plates drawn from each
 * piece's real dimensions, with the blur placeholder and the measured anchor box
 * that the dimension overlay draws against. Replaced wholesale by real
 * photography once the merchant's shoot lands.
 */
import type { MediaAnchors } from './types';

export interface GeneratedPlate {
  path: string;
  width: number;
  height: number;
  blurDataUrl: string;
  anchors: MediaAnchors;
}

export const PLATES: Record<string, GeneratedPlate> = ${JSON.stringify(manifest, null, 2)};
`;

await writeFile(path.join(root, 'src/lib/catalog/generated-plates.ts'), ts, 'utf8');

console.log(`wrote ${Object.keys(manifest).length} plates for ${pieces.length} pieces`);
