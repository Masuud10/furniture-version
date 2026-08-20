import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * Regression: the first Vercel deploy failed with `ERR_INVALID_URL, input: ''`.
 *
 * `NEXT_PUBLIC_SITE_URL` had been added to the project without a value, so it
 * arrived as an empty string. `??` only falls back on null/undefined, so the
 * empty string went straight into `new URL('')` and took the whole build down at
 * `metadataBase`.
 *
 * `siteUrl()` is imported fresh per case because it reads the environment.
 */
async function siteUrlWith(env: Record<string, string | undefined>): Promise<string> {
  vi.resetModules();
  const previous = { ...process.env };

  for (const key of [
    'NEXT_PUBLIC_SITE_URL',
    'NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL',
    'VERCEL_PROJECT_PRODUCTION_URL',
    'NEXT_PUBLIC_VERCEL_URL',
    'VERCEL_URL',
  ]) {
    delete process.env[key];
  }
  Object.assign(process.env, env);

  try {
    const { siteUrl } = await import('@/lib/site');
    return siteUrl();
  } finally {
    process.env = previous;
  }
}

afterEach(() => {
  vi.resetModules();
});

describe('siteUrl', () => {
  it('uses the configured site URL', async () => {
    await expect(siteUrlWith({ NEXT_PUBLIC_SITE_URL: 'https://furnitureversion.co.ke' })).resolves.toBe(
      'https://furnitureversion.co.ke',
    );
  });

  it('strips a trailing slash, so absolute URLs never double up', async () => {
    await expect(siteUrlWith({ NEXT_PUBLIC_SITE_URL: 'https://example.com/' })).resolves.toBe(
      'https://example.com',
    );
  });

  it('treats an EMPTY variable as missing rather than throwing', async () => {
    // This is the exact shape that failed the first deploy.
    await expect(siteUrlWith({ NEXT_PUBLIC_SITE_URL: '' })).resolves.toBe('http://localhost:3000');
  });

  it('treats a whitespace-only variable as missing', async () => {
    await expect(siteUrlWith({ NEXT_PUBLIC_SITE_URL: '   ' })).resolves.toBe('http://localhost:3000');
  });

  it('falls back to the Vercel production domain and adds the protocol', async () => {
    await expect(
      siteUrlWith({ NEXT_PUBLIC_SITE_URL: '', VERCEL_PROJECT_PRODUCTION_URL: 'shop.vercel.app' }),
    ).resolves.toBe('https://shop.vercel.app');
  });

  it('prefers the configured URL over the Vercel one', async () => {
    await expect(
      siteUrlWith({
        NEXT_PUBLIC_SITE_URL: 'https://furnitureversion.co.ke',
        VERCEL_PROJECT_PRODUCTION_URL: 'shop.vercel.app',
      }),
    ).resolves.toBe('https://furnitureversion.co.ke');
  });

  it('degrades past a malformed value instead of throwing', async () => {
    await expect(
      siteUrlWith({ NEXT_PUBLIC_SITE_URL: 'not a url', VERCEL_URL: 'shop.vercel.app' }),
    ).resolves.toBe('https://shop.vercel.app');
  });

  it('rejects a non-http protocol', async () => {
    await expect(siteUrlWith({ NEXT_PUBLIC_SITE_URL: 'ftp://example.com' })).resolves.toBe(
      'http://localhost:3000',
    );
  });

  it('always returns something new URL() accepts', async () => {
    for (const value of ['', '   ', 'nonsense', '///', 'javascript:alert(1)']) {
      const result = await siteUrlWith({ NEXT_PUBLIC_SITE_URL: value });
      expect(() => new URL(result)).not.toThrow();
    }
  });
});
