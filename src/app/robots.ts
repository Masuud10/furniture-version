import type { MetadataRoute } from 'next';

import { absoluteUrl } from '@/lib/seo/urls';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // /search is thin and infinite; the rest are private surfaces that RLS
        // already refuses, but there is no reason to spend crawl budget on them.
        disallow: ['/account/', '/admin/', '/search', '/api/'],
      },
    ],
    sitemap: absoluteUrl('/sitemap.xml'),
  };
}
