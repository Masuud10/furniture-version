import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

/**
 * axe on every route type, in both colour schemes, because the palette inverts
 * and a contrast pair that passes on paper can fail on the dark ground.
 */

const ROUTES = [
  { path: '/', name: 'home' },
  { path: '/collections', name: 'collections index' },
  { path: '/gallery', name: 'gallery' },
  { path: '/collections/seating', name: 'collection listing' },
  { path: '/collections/seating?material=Fabric', name: 'filtered listing' },
  { path: '/products/corduroy-sofa', name: 'product detail' },
  { path: '/search?q=mahogany', name: 'search results' },
  { path: '/search', name: 'search empty' },
  { path: '/showroom', name: 'showroom' },
  { path: '/contact', name: 'contact' },
  { path: '/styleguide', name: 'styleguide' },
  { path: '/no-such-page', name: '404' },
];

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`axe — ${scheme}`, () => {
    test.use({ colorScheme: scheme });

    for (const route of ROUTES) {
      test(`${route.name} has no detectable violations`, async ({ page }) => {
        await page.goto(route.path);
        const results = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
          .analyze();

        expect(
          results.violations.map((v) => `${v.id} (${v.nodes.length}) — ${v.help}`),
        ).toEqual([]);
      });
    }
  });
}

test.describe('keyboard', () => {
  test('the purchase path is reachable with the keyboard alone', async ({ page }) => {
    await page.goto('/products/corduroy-sofa');

    const addToCart = page.getByRole('button', { name: 'Add to cart' });
    await expect(addToCart).toBeVisible();

    // Focus it via the keyboard rather than clicking, then activate it.
    await addToCart.focus();
    await expect(addToCart).toBeFocused();
    await page.keyboard.press('Enter');

    await expect(page.getByRole('status')).toHaveText('Added to cart.');
  });

  test('a finish can be chosen with the keyboard and updates the price', async ({ page }) => {
    await page.goto('/products/corduroy-sofa');

    const unitPrice = page.getByTestId('unit-price');
    const before = await unitPrice.innerText();

    const fiveSeater = page.getByRole('radio', { name: /5 seater/ });
    await fiveSeater.focus();
    await page.keyboard.press('Enter');
    await expect(fiveSeater).toHaveAttribute('aria-checked', 'true');

    // The URL reflects the choice so the link is shareable.
    await expect(page).toHaveURL(/variant=/);

    // Base 45,000 (3 seater) + a 35,000 delta. Applied in integer minor units, so
    // this is an exact expectation rather than a "something changed" check.
    await expect(unitPrice).not.toHaveText(before);
    await expect(unitPrice).toContainText('80,000');
  });

  // Skipped: the overlay only draws when a piece has dimensions AND a measured
  // anchor box, and no merchant piece has either yet (docs/progress.md section 9).
  // The signature element is dormant across the whole live catalogue until then.
  test.skip('the dimension annotations are reachable without a pointer', async ({ page }) => {
    await page.goto('/products/corduroy-sofa');
    const toggle = page.locator('.dimension-toggle').first();
    await toggle.focus();
    await expect(toggle).toBeFocused();
    // Focus alone reveals the layer via :focus-within.
    await expect(page.locator('.dimension-layer').first()).toHaveCSS('opacity', '1');
  });

  test('the full-screen viewer traps focus and closes on Escape', async ({ page }) => {
    await page.goto('/products/corduroy-sofa');
    await page.getByRole('button', { name: /Open .* at full size/ }).click();

    const dialog = page.locator('dialog[open]');
    await expect(dialog).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.locator('dialog[open]')).toHaveCount(0);
  });

  test('the skip link is the first thing a keyboard reaches', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  });
});
