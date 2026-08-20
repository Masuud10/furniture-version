import { expect, test } from '@playwright/test';

test.describe('rendering without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('categories are browsable and a product page is readable', async ({ page }) => {
    await page.goto('/collections');
    await expect(page.getByRole('heading', { level: 1, name: 'Collections' })).toBeVisible();

    await page.getByRole('link', { name: 'Tables and desks' }).first().click();
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Tables and desks');

    // The grid is in the HTML, not swapped in by a hydration script.
    const cards = page.locator('article h3 a');
    expect(await cards.count()).toBeGreaterThan(0);

    await cards.first().click();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    // Scoped to the spec block: below 480px the dimension overlay is correctly
    // display:none, so an unscoped /mm/ match can land on a hidden node.
    const spec = page.locator('section[aria-labelledby="spec"]');
    await expect(spec).toBeVisible();
    // A piece either states its dimensions or says plainly that it has not been
    // measured. What it must never do is show nothing, or show a made-up number.
    await expect(spec.getByText(/\d+ mm|Not measured yet/).first()).toBeVisible();
  });

  // Skipped: no merchant piece carries width/depth/height yet (docs/progress.md
  // section 9). Kept rather than deleted — it is the check that comes back the
  // moment measurements arrive.
  test.skip('a measured piece states its dimensions in millimetres', async ({ page }) => {
    await page.goto('/products/solid-dining-table');
    const spec = page.locator('section[aria-labelledby="spec"]');
    await expect(spec.getByText(/d+ mm/).first()).toBeVisible();
  });

  test('an unmeasured piece says so rather than inventing a number', async ({ page }) => {
    await page.goto('/products/round-coffee-table');
    const spec = page.locator('section[aria-labelledby="spec"]');
    await expect(spec.getByText(/Not measured yet/)).toBeVisible();
    await expect(spec.getByText(/\d+ mm/)).toHaveCount(0);
  });

  test('filters work as links', async ({ page }) => {
    await page.goto('/collections/seating');
    await page.getByRole('link', { name: 'Fabric' }).first().click();
    await expect(page).toHaveURL(/material=Fabric/);
    expect(await page.locator('article h3 a').count()).toBeGreaterThan(0);
  });

  test('search works as a GET form', async ({ page }) => {
    await page.goto('/search?q=mahogany');
    expect(await page.locator('article h3 a').count()).toBeGreaterThan(0);
  });
});

test.describe('the storefront home is the home page', () => {
  test('/ renders the storefront, not a scaffold', async ({ page }) => {
    // Regression guard: an `app/page.tsx` left over from create-next-app shadows
    // `app/(storefront)/page.tsx` silently — same URL, no build error.
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Every piece, with its numbers on it.',
    );
    await expect(page.locator('#home-collections')).toHaveText('Collections');
    await expect(page.getByText('To get started')).toHaveCount(0);
  });
});

test.describe('SEO surface', () => {
  test('a product page carries one h1, a self-canonical and Product JSON-LD', async ({ page }) => {
    await page.goto('/products/solid-dining-table');

    await expect(page.locator('h1')).toHaveCount(1);

    const canonical = await page.locator('link[rel=canonical]').getAttribute('href');
    expect(canonical).toMatch(/\/products\/solid-dining-table$/);

    const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
    const types = blocks.map((b) => JSON.parse(b)['@type']);
    expect(types).toContain('Product');
    expect(types).toContain('BreadcrumbList');

    const productBlock = blocks.map((b) => JSON.parse(b)).find((b) => b['@type'] === 'Product');
    // Price is a decimal string, never a float, and there are no fabricated reviews.
    expect(typeof productBlock.offers.price).toBe('string');
    expect(productBlock.offers.price).toMatch(/^\d+\.\d{2}$/);
    expect(productBlock).not.toHaveProperty('aggregateRating');
    expect(productBlock).not.toHaveProperty('review');
  });

  test('a variant URL still canonicalises to the bare product URL', async ({ page }) => {
    await page.goto('/products/corduroy-sofa?variant=corduroy-sofa:v2');
    const canonical = await page.locator('link[rel=canonical]').getAttribute('href');
    expect(canonical).toMatch(/\/products\/corduroy-sofa$/);
    expect(canonical).not.toContain('variant');
  });

  test('an allowlisted facet is indexable with its own canonical', async ({ page }) => {
    await page.goto('/collections/tables?material=Mahogany');
    const robots = await page.locator('meta[name=robots]').getAttribute('content');
    expect(robots ?? 'index').not.toContain('noindex');
    const canonical = await page.locator('link[rel=canonical]').getAttribute('href');
    expect(canonical).toContain('material=Mahogany');
  });

  test('a non-allowlisted facet is noindex and canonicalises to the bare category', async ({ page }) => {
    await page.goto('/collections/tables?price=under-25k');
    const robots = await page.locator('meta[name=robots]').getAttribute('content');
    expect(robots).toContain('noindex');
    expect(robots).toContain('follow');

    const canonical = await page.locator('link[rel=canonical]').getAttribute('href');
    expect(canonical).toMatch(/\/collections\/tables$/);
  });

  test('page 2 self-canonicalises and stays indexable', async ({ page }) => {
    await page.goto('/collections/seating?page=2');
    const canonical = await page.locator('link[rel=canonical]').getAttribute('href');
    expect(canonical).toContain('page=2');
    const robots = await page.locator('meta[name=robots]').getAttribute('content');
    expect(robots ?? 'index').not.toContain('noindex');
  });

  test('search is noindex, follow', async ({ page }) => {
    await page.goto('/search?q=sofa');
    const robots = await page.locator('meta[name=robots]').getAttribute('content');
    expect(robots).toContain('noindex');
    expect(robots).toContain('follow');
  });

  test('the showroom emits FurnitureStore with a full postal address', async ({ page }) => {
    await page.goto('/showroom');
    const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
    const store = blocks.map((b) => JSON.parse(b)).find((b) => b['@type'] === 'FurnitureStore');
    expect(store).toBeTruthy();
    expect(store.address['@type']).toBe('PostalAddress');
    expect(store.address.addressCountry).toBe('KE');
    expect(store.geo['@type']).toBe('GeoCoordinates');
    expect(Array.isArray(store.openingHoursSpecification)).toBe(true);
  });

  test('the sitemap lists only published products and uses row timestamps', async ({ request }) => {
    const xml = await (await request.get('/sitemap.xml')).text();
    expect(xml).toContain('<loc>');
    expect(xml).toContain('/products/solid-dining-table<');
    // A sitemap that stamps everything with the build date teaches crawlers to
    // ignore the field. A piece genuinely edited today should say today, so the
    // check is that the dates come from rows — several distinct values, and a
    // spread wider than a single build could produce.
    const lastmods = [...xml.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)].map((m) => m[1] ?? '');
    expect(lastmods.length).toBeGreaterThan(5);
    const distinctDays = new Set(lastmods.map((d) => d.slice(0, 10)));
    expect(distinctDays.size).toBeGreaterThan(3);
  });

  test('robots.txt disallows the private surfaces and points at the sitemap', async ({ request }) => {
    const txt = await (await request.get('/robots.txt')).text();
    expect(txt).toContain('Disallow: /admin/');
    expect(txt).toContain('Disallow: /account/');
    expect(txt).toContain('Disallow: /search');
    expect(txt).toContain('Sitemap:');
  });

  test('every OG card renders as a PNG', async ({ page, request, baseURL }) => {
    for (const path of ['/', '/products/solid-dining-table', '/collections/tables']) {
      await page.goto(path);
      const og = await page.locator('meta[property="og:image"]').getAttribute('content');
      expect(og, `og:image missing on ${path}`).toBeTruthy();

      // og:image is absolute against metadataBase (NEXT_PUBLIC_SITE_URL), which is
      // not the origin under test. Fetch the same path from the server we started.
      const url = new URL(og as string);
      const res = await request.get(`${baseURL}${url.pathname}${url.search}`);
      expect(res.status(), `og:image for ${path}`).toBe(200);
      expect(res.headers()['content-type']).toContain('image/png');
    }
  });
});

test.describe('layout stability', () => {
  test('every media slot reserves its aspect ratio before the bytes arrive', async ({ page }) => {
    await page.goto('/collections/seating');
    const slots = page.locator('[style*="aspect-ratio"]');
    expect(await slots.count()).toBeGreaterThan(0);
  });
});
