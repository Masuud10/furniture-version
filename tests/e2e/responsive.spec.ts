import { expect, test } from '@playwright/test';

/**
 * Responsive floor, asserted rather than eyeballed.
 *
 * 360px is the narrowest viewport the design brief requires. The failure this
 * catches is horizontal overflow — one un-wrapped table, one long SKU, one image
 * that ignores its container — which produces a page that scrolls sideways and is
 * miserable on a phone. A screenshot can hide it; scrollWidth cannot.
 */

const ROUTES = [
  '/',
  '/collections',
  '/gallery',
  '/collections/seating',
  '/collections/seating?material=Fabric',
  '/products/corduroy-sofa',
  '/products/sofa-set-seven-seater',
  '/products/solid-dining-table',
  '/search?q=mahogany',
  '/search',
  '/showroom',
  '/contact',
  '/styleguide',
  '/no-such-page',
];

const WIDTHS = [360, 768, 1440] as const;

test.describe('no horizontal overflow', () => {
  for (const width of WIDTHS) {
    for (const route of ROUTES) {
      test(`${route} at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(route);
        await page.waitForLoadState('networkidle');

        const overflow = await page.evaluate(() => {
          const doc = document.documentElement;
          // Anything sticking out past the viewport, named so a failure says which.
          const offenders: string[] = [];

          // An element inside a deliberate horizontal scroller (the gallery
          // thumbnail rail) is allowed to extend past the viewport — that is what
          // the scroller is for. Only unscrolled overflow is a bug.
          const insideScroller = (el: Element): boolean => {
            let p = el.parentElement;
            while (p && p !== document.body) {
              const o = getComputedStyle(p).overflowX;
              if (o === 'auto' || o === 'scroll' || o === 'hidden') return true;
              p = p.parentElement;
            }
            return false;
          };

          for (const el of Array.from(document.querySelectorAll('body *'))) {
            const r = el.getBoundingClientRect();
            if (r.width === 0 && r.height === 0) continue;
            if (insideScroller(el)) continue;
            if (r.right > doc.clientWidth + 1 || r.left < -1) {
              const e = el as HTMLElement;
              offenders.push(
                `${e.tagName.toLowerCase()}.${String(e.className).split(' ').slice(0, 3).join('.')}` +
                  ` [${Math.round(r.left)}..${Math.round(r.right)}]`,
              );
            }
          }
          return {
            scrollWidth: doc.scrollWidth,
            clientWidth: doc.clientWidth,
            offenders: offenders.slice(0, 5),
          };
        });

        expect(overflow.offenders, `elements overflowing at ${width}px`).toEqual([]);
        expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);
      });
    }
  }
});

test.describe('touch targets at 360px', () => {
  test('every control in the purchase path is at least 24px', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 900 });
    await page.goto('/products/corduroy-sofa');

    // Buttons and button-styled links. Links inline in running text (breadcrumbs,
    // footer lists) are exempt from WCAG 2.2 target size under the inline exception.
    const controls = page.locator('button:visible, a.inline-flex:visible');
    const count = await controls.count();
    const tooSmall: string[] = [];

    for (let i = 0; i < count; i += 1) {
      const box = await controls.nth(i).boundingBox();
      if (!box) continue;
      // WCAG 2.2 target size (minimum) is 24x24 CSS px.
      if (box.width < 24 || box.height < 24) {
        tooSmall.push(`${(await controls.nth(i).innerText()).slice(0, 30)} ${box.width}x${box.height}`);
      }
    }

    expect(tooSmall).toEqual([]);
  });

  test('the mobile nav opens and its links are reachable', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 900 });
    await page.goto('/');

    const menu = page.getByRole('button', { name: 'Menu' });
    await expect(menu).toBeVisible();
    await menu.click();
    await expect(menu).toHaveAttribute('aria-expanded', 'true');

    const panel = page.locator('#mobile-nav-panel');
    await expect(panel.getByRole('link', { name: 'Collections' })).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Menu' })).toBeFocused();
  });
});
