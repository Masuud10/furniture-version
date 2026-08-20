import { test } from '@playwright/test';

/**
 * The screenshot pass required by the definition of done: every route type at
 * 360, 768 and 1440, in light and dark. Run with `--project=desktop`; the
 * viewport is set per case so the mobile project would duplicate the work.
 */

// Each case sets its own viewport, so running this under the mobile project too
// would just overwrite the same files with a mobile-emulated variant.
// Opt-in only: run with SCREENSHOTS=1 npx playwright test tests/e2e/screenshots.spec.ts
// It is capture tooling, not an assertion, so it does not belong in every run.
test.skip(process.env.SCREENSHOTS !== '1', 'set SCREENSHOTS=1 to capture');
test.skip(({ isMobile }) => isMobile === true, 'desktop project only');

const WIDTHS = [360, 768, 1440] as const;

const ROUTES = [
  { path: '/', name: 'home' },
  { path: '/collections', name: 'collections' },
  { path: '/collections/seating', name: 'listing' },
  { path: '/products/corduroy-sofa', name: 'product' },
  { path: '/search?q=mahogany', name: 'search' },
  { path: '/showroom', name: 'showroom' },
  { path: '/contact', name: 'contact' },
  { path: '/styleguide', name: 'styleguide' },
  { path: '/no-such-page', name: '404' },
] as const;

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`screenshots — ${scheme}`, () => {
    test.use({ colorScheme: scheme });

    for (const route of ROUTES) {
      for (const width of WIDTHS) {
        test(`${route.name} @ ${width} ${scheme}`, async ({ page }) => {
          await page.setViewportSize({ width, height: 900 });
          await page.goto(route.path);
          // Let lazy images below the fold settle so the capture is honest.
          await page.waitForLoadState('networkidle');
          await page.screenshot({
            path: `screenshots/${route.name}-${width}-${scheme}.png`,
            fullPage: true,
          });
        });
      }
    }
  });
}
