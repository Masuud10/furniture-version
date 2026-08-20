/**
 * Ingest real merchant photography and video into public/media.
 *
 * For each asset this produces exactly what the read contract requires so that a
 * media slot has its size before the bytes arrive:
 *   - width / height
 *   - a blur placeholder
 *   - for video: a poster frame and a duration
 *
 * The poster is captured by decoding the video in Chromium and painting a frame
 * to a canvas, because there is no ffmpeg on this machine that can read H.264.
 *
 * ADR-003 caps video at 20 s and 8 MB. This script does not silently accept or
 * silently reject an over-cap file — it writes the asset and prints a warning
 * that states the consequence for a shopper on a slow connection.
 *
 * Usage: node scripts/ingest-media.mjs
 */
import { chromium } from '@playwright/test';
import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { statSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'public/media');

const MAX_VIDEO_SECONDS = 20;
const MAX_VIDEO_BYTES = 8 * 1024 * 1024;

/** Crops every still into the three shapes the Product JSON-LD wants. */
const SHAPES = [
  { key: 'wide', w: 1600, h: 1200 },
  { key: 'square', w: 1200, h: 1200 },
  { key: 'pano', w: 1600, h: 900 },
];

async function blurDataUrl(input) {
  const buf = await sharp(input).resize(12).webp({ quality: 55 }).toBuffer();
  return `data:image/webp;base64,${buf.toString('base64')}`;
}

export async function ingestImage(sourcePath, slug) {
  const out = {};
  for (const shape of SHAPES) {
    const file = `${slug}-${shape.key}.webp`;
    const dest = path.join(OUT, file);
    await sharp(sourcePath)
      .resize(shape.w, shape.h, { fit: 'cover', position: 'attention' })
      .webp({ quality: 82 })
      .toFile(dest);
    out[shape.key] = {
      path: `/media/${file}`,
      width: shape.w,
      height: shape.h,
      blurDataUrl: await blurDataUrl(dest),
    };
  }
  return out;
}

export async function ingestVideo(sourcePath, slug, posterAt) {
  const bytes = statSync(sourcePath).size;
  const file = `${slug}.mp4`;
  await copyFile(sourcePath, path.join(OUT, file));

  // Decode in a real browser to get true dimensions and a poster frame.
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const dataUrl = `data:video/mp4;base64,${(await readFile(sourcePath)).toString('base64')}`;

  const probe = await page.evaluate(async ({ src, posterAt }) => {
    const v = document.createElement('video');
    v.muted = true;
    v.playsInline = true;
    v.src = src;
    v.preload = 'auto';
    await new Promise((res, rej) => {
      v.oncanplaythrough = res;
      v.onerror = () => rej(new Error('video failed to decode'));
    });
    // Use the timestamp the manifest names, when it names one. Otherwise take a
    // frame far enough in to clear a dark lead-in. A poster is the still that
    // stands in for the whole piece, so it is worth choosing deliberately.
    const t =
      typeof posterAt === 'number'
        ? Math.min(posterAt, Math.max(0, v.duration - 0.1))
        : Math.min(1.5, v.duration / 4);
    await new Promise((res) => {
      v.onseeked = res;
      v.currentTime = t;
    });
    const canvas = document.createElement('canvas');
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    canvas.getContext('2d').drawImage(v, 0, 0);
    return {
      width: v.videoWidth,
      height: v.videoHeight,
      duration: v.duration,
      poster: canvas.toDataURL('image/png'),
    };
  }, { src: dataUrl, posterAt });

  await browser.close();

  const posterFile = `${slug}-poster.webp`;
  const posterBuf = Buffer.from(probe.poster.split(',')[1], 'base64');
  await sharp(posterBuf).webp({ quality: 82 }).toFile(path.join(OUT, posterFile));

  if (probe.duration > MAX_VIDEO_SECONDS) {
    console.warn(
      `  ! ${slug}: ${probe.duration.toFixed(1)}s exceeds the ${MAX_VIDEO_SECONDS}s cap in ADR-003.\n` +
        `    Supabase Storage does not transcode, so there is no bitrate ladder to step\n` +
        `    down to — a shopper on a slow connection downloads the whole file. Trim it,\n` +
        `    or accept the cost knowingly.`,
    );
  }
  if (bytes > MAX_VIDEO_BYTES) {
    console.warn(`  ! ${slug}: ${(bytes / 1024 / 1024).toFixed(1)} MB exceeds the 8 MB cap in ADR-003.`);
  }

  return {
    path: `/media/${file}`,
    posterPath: `/media/${posterFile}`,
    width: probe.width,
    height: probe.height,
    durationSeconds: Math.round(probe.duration),
    bytes,
    blurDataUrl: await blurDataUrl(path.join(OUT, posterFile)),
  };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await mkdir(OUT, { recursive: true });
  const manifest = JSON.parse(await readFile(path.join(ROOT, 'scripts/ingest.json'), 'utf8'));
  const result = {};

  for (const item of manifest) {
    process.stdout.write(`${item.slug} (${item.kind}) … `);
    result[item.slug] =
      item.kind === 'video'
        ? await ingestVideo(item.source, item.slug, item.posterAt)
        : await ingestImage(item.source, item.slug);
    console.log('done');
  }

  await writeFile(
    path.join(ROOT, 'src/lib/catalog/generated-real-media.json'),
    JSON.stringify(result, null, 2),
    'utf8',
  );
  console.log(`\nwrote src/lib/catalog/generated-real-media.json (${Object.keys(result).length} assets)`);
}
