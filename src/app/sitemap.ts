import type { MetadataRoute } from 'next';

import { providerUrl } from '@/lib/catalog/media-url';
import { getCategories, getPublishedForSitemap } from '@/lib/catalog/source';
import { INDEXABLE_FACETS } from '@/lib/seo/facets';
import { absoluteUrl } from '@/lib/seo/urls';

/**
 * Only published products appear — `getPublishedForSitemap` filters on
 * `status = 'published'`, and anon RLS would refuse the rest anyway.
 *
 * `lastModified` comes from the row's own `updated_at`, never `new Date()`. A
 * sitemap that claims everything changed today teaches crawlers to ignore the
 * field entirely.
 *
 * At this catalogue size the 50,000-URL limit is irrelevant. If it ever is not,
 * the sharding path is `generateSitemaps()` returning ids and this file taking an
 * `{ id }` argument — no change to how the URLs are built.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, categories] = await Promise.all([getPublishedForSitemap(), getCategories()]);

  const newestProduct = products.reduce<string | null>(
    (latest, p) => (latest === null || p.updatedAt > latest ? p.updatedAt : latest),
    null,
  );

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: absoluteUrl('/'),
      ...(newestProduct ? { lastModified: new Date(newestProduct) } : {}),
      changeFrequency: 'weekly',
      priority: 1,
    },
    { url: absoluteUrl('/collections'), changeFrequency: 'weekly', priority: 0.8 },
    { url: absoluteUrl('/gallery'), changeFrequency: 'weekly', priority: 0.6 },
    { url: absoluteUrl('/showroom'), changeFrequency: 'monthly', priority: 0.5 },
    { url: absoluteUrl('/contact'), changeFrequency: 'monthly', priority: 0.4 },
  ];

  const categoryPages: MetadataRoute.Sitemap = categories.map((category) => ({
    url: absoluteUrl(`/collections/${category.slug}`),
    lastModified: new Date(category.updatedAt),
    changeFrequency: 'weekly',
    priority: 0.8,
  }));

  // Only the allowlisted facets. Every other filter combination is noindex and
  // has no business in a sitemap.
  const facetPages: MetadataRoute.Sitemap = INDEXABLE_FACETS.map((facet) => ({
    url: absoluteUrl(
      `/collections/${facet.categorySlug}?material=${encodeURIComponent(facet.material)}`,
    ),
    changeFrequency: 'weekly',
    priority: 0.6,
  }));

  const productPages: MetadataRoute.Sitemap = products.map((product) => ({
    url: absoluteUrl(`/products/${product.slug}`),
    lastModified: new Date(product.updatedAt),
    changeFrequency: 'monthly',
    priority: 0.7,
    // Image entries help discovery for a catalogue whose whole pitch is visual.
    ...(product.image
      ? {
          images: [
            (() => {
              const url = providerUrl(product.image.startsWith('/media/') ? 'local' : 'supabase', product.image);
              return url.startsWith('http') ? url : absoluteUrl(url);
            })(),
          ],
        }
      : {}),
  }));

  return [...staticPages, ...categoryPages, ...facetPages, ...productPages];
}
