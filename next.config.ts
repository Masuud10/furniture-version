import type { NextConfig } from 'next';

/**
 * The Supabase Storage hostname has to be declared for next/image, otherwise the
 * optimizer refuses the domain at request time rather than at build time. It is
 * derived from the same env var the data layer reads, so the two cannot drift and
 * no project ref is hardcoded.
 */
// An env var that exists but is empty behaves like a missing one, and a
// malformed one must not take the build down — next.config runs before
// anything else, so a throw here fails the whole deploy.
function optionalUrl(value: string | undefined): URL | undefined {
  if (!value || value.trim() === '') return undefined;
  try {
    return new URL(value.trim());
  } catch {
    return undefined;
  }
}

const supabaseHost = optionalUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // Without this, Turbopack walks up to C:\Users\masuu, finds a stray lockfile and
  // infers the wrong workspace root.
  turbopack: {
    root: import.meta.dirname,
  },

  // Cache Components is the top-level flag in Next 16. `experimental.useCache`,
  // `experimental.dynamicIO` and `experimental.ppr` are deprecated aliases of it.
  // Enabling it is what makes the `'use cache'` directive and `cacheTag`/`cacheLife`
  // available; see docs/progress.md for the verification notes.
  cacheComponents: true,

  images: {
    remotePatterns: supabaseHost
      ? [
          {
            protocol: supabaseHost.protocol === 'http:' ? 'http' : 'https',
            hostname: supabaseHost.hostname,
            port: supabaseHost.port,
            pathname: '/storage/v1/object/public/**',
          },
        ]
      : [],
    // Drafting plates served from /public while catalogue photography is pending.
    localPatterns: [{ pathname: '/media/**', search: '' }],
    // Furniture photography is wide. These are the widths the grid actually renders,
    // so the optimizer never generates a 3840px variant nobody requests.
    deviceSizes: [360, 480, 640, 768, 1024, 1280, 1536, 1920],
    imageSizes: [64, 96, 128, 200, 256, 384],
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60 * 60 * 24 * 30,
    qualities: [70, 80, 90],
  },

  // Slug changes are 301s, never silent breaks. A renamed slug is appended here in
  // the same commit that renames it.
  async redirects() {
    return [];
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        ],
      },
    ];
  },
};

export default nextConfig;
