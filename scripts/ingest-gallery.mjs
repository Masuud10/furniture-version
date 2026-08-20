/**
 * Ingest the gallery.
 *
 * Everything in `media-source/gallery/` becomes a gallery photo. There is no
 * manifest: the merchant keeps sending photographs, so the ergonomics that
 * matter are "drop the files in the folder and run this".
 *
 * Unlike product media these are not cropped to fixed shapes — a gallery reads
 * better when each photograph keeps the proportions it was taken at. Width and
 * height are still recorded per image so every tile reserves its space before the
 * bytes arrive, which is what keeps the grid from reflowing as it loads.
 *
 * Captions live in `gallery-captions.json`, keyed by file name. A photo with no
 * caption still needs alt text, so it falls back to a generic description and is
 * listed at the end of the run — alt text is not optional.
 *
 * Usage: node scripts/ingest-gallery.mjs
 */
import { mkdir, readdir, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = process.cwd();
const SRC = path.join(ROOT, 'media-source/gallery');
const OUT = path.join(ROOT, 'public/media/gallery');

// Big enough for a full-screen viewer on a laptop, small enough not to be silly.
const MAX_EDGE = 1600;

async function main() {
  await mkdir(OUT, { recursive: true });

  const captionsPath = path.join(ROOT, 'scripts/gallery-captions.json');
  const captions = existsSync(captionsPath)
    ? JSON.parse(await readFile(captionsPath, 'utf8'))
    : {};

  const files = (await readdir(SRC))
    .filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
    .sort();

  const items = [];
  const missingCaptions = [];

  for (const file of files) {
    const slug = file.replace(/\.[^.]+$/, '');
    const src = path.join(SRC, file);

    const image = sharp(src).rotate(); // honour EXIF orientation
    const meta = await image.metadata();
    const landscape = (meta.width ?? 1) >= (meta.height ?? 1);

    const dest = path.join(OUT, `${slug}.webp`);
    await image
      .resize(
        landscape
          ? { width: MAX_EDGE, withoutEnlargement: true }
          : { height: MAX_EDGE, withoutEnlargement: true },
      )
      .webp({ quality: 82 })
      .toFile(dest);

    const out = await sharp(dest).metadata();
    const blur = await sharp(dest).resize(12).webp({ quality: 55 }).toBuffer();

    const caption = captions[file] ?? captions[slug];
    if (!caption) missingCaptions.push(file);

    items.push({
      id: slug,
      path: `/media/gallery/${slug}.webp`,
      width: out.width ?? 0,
      height: out.height ?? 0,
      blurDataUrl: `data:image/webp;base64,${blur.toString('base64')}`,
      alt: caption ?? 'A piece made by the workshop, photographed in a customer’s home or the showroom.',
      captioned: Boolean(caption),
    });

    process.stdout.write('.');
  }

  await writeFile(
    path.join(ROOT, 'src/lib/catalog/generated-gallery.json'),
    JSON.stringify(items, null, 2),
    'utf8',
  );

  console.log(`\nwrote ${items.length} gallery photos`);
  if (missingCaptions.length) {
    console.warn(
      `\n  ! ${missingCaptions.length} photo(s) have no caption and fell back to generic alt text.\n` +
        `    Alt text describes the image for someone who cannot see it, so a generic\n` +
        `    line is a placeholder, not a finish. Add entries to scripts/gallery-captions.json:\n` +
        missingCaptions.map((f) => `      "${f}": "…"`).join('\n'),
    );
  }
}

await main();
