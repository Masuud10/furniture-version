import 'server-only';

import { cacheLife, cacheTag } from 'next/cache';

import galleryData from './generated-gallery.json';

/**
 * The gallery.
 *
 * Photographs of finished work, with no prices and no add-to-cart. It is a
 * different job from the catalogue: the catalogue answers "will this fit and
 * what does it cost", the gallery answers "what does their work look like".
 *
 * Written by `scripts/ingest-gallery.mjs` from everything in
 * `media-source/gallery/`, so adding photographs is a folder drop and one script
 * run rather than a code change.
 */

export interface GalleryPhoto {
  id: string;
  path: string;
  width: number;
  height: number;
  blurDataUrl: string;
  /** Never empty — the ingest script falls back and warns rather than omitting. */
  alt: string;
  captioned: boolean;
}

export const GALLERY_PER_PAGE = 24;

const PHOTOS = galleryData as GalleryPhoto[];

export async function getGalleryPage(
  page: number,
): Promise<{ photos: GalleryPhoto[]; page: number; pageCount: number; total: number }> {
  'use cache';
  cacheTag('gallery');
  cacheLife('days');

  const total = PHOTOS.length;
  const pageCount = Math.max(1, Math.ceil(total / GALLERY_PER_PAGE));
  const current = Math.min(Math.max(1, page), pageCount);
  const from = (current - 1) * GALLERY_PER_PAGE;

  return {
    photos: PHOTOS.slice(from, from + GALLERY_PER_PAGE),
    page: current,
    pageCount,
    total,
  };
}

export async function getGalleryCount(): Promise<number> {
  'use cache';
  cacheTag('gallery');
  cacheLife('days');
  return PHOTOS.length;
}
