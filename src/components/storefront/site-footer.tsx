import Link from 'next/link';

import { getCategories } from '@/lib/catalog/source';
import { MERCHANT, PAYMENT_LINE, SHOWROOM } from '@/lib/site';

export async function SiteFooter() {
  const categories = await getCategories();
  const year = 2026;

  return (
    <footer className="mt-16 border-t border-rule">
      <div className="mx-auto grid max-w-(--page-max) gap-8 px-(--page-gutter) py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="font-display text-step-1 font-semibold">{MERCHANT}</p>
          <p className="mt-2 max-w-(--measure) text-step--1 text-ink-muted">
            Hardwood furniture made to order in Nairobi. {PAYMENT_LINE}
          </p>
        </div>

        <nav aria-labelledby="footer-collections">
          <h2 id="footer-collections" className="font-mono text-step--1 uppercase tracking-wide text-ink-muted">
            Collections
          </h2>
          <ul className="mt-3 flex flex-col gap-2">
            {categories.map((category) => (
              <li key={category.slug}>
                <Link
                  href={`/collections/${category.slug}`}
                  className="text-step-0 underline-offset-4 hover:underline"
                >
                  {category.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-labelledby="footer-visit">
          <h2 id="footer-visit" className="font-mono text-step--1 uppercase tracking-wide text-ink-muted">
            Visit
          </h2>
          <ul className="mt-3 flex flex-col gap-2">
            <li>
              <Link href="/gallery" className="text-step-0 underline-offset-4 hover:underline">
                Gallery
              </Link>
            </li>
            <li>
              <Link href="/showroom" className="text-step-0 underline-offset-4 hover:underline">
                Showroom
              </Link>
            </li>
            <li>
              <Link href="/contact" className="text-step-0 underline-offset-4 hover:underline">
                Contact
              </Link>
            </li>
          </ul>
        </nav>

        <div>
          <h2 className="font-mono text-step--1 uppercase tracking-wide text-ink-muted">Showroom</h2>
          <address className="mt-3 not-italic text-step-0">
            {SHOWROOM.streetAddress}
            <br />
            {SHOWROOM.addressLocality}
            <br />
            <a
              href={`tel:${SHOWROOM.telephone}`}
              className="font-mono underline-offset-4 hover:underline"
            >
              {SHOWROOM.telephoneDisplay}
            </a>
          </address>
        </div>
      </div>

      <div className="border-t border-rule">
        <p className="mx-auto max-w-(--page-max) px-(--page-gutter) py-4 font-mono text-step--1 text-ink-muted">
          © {year} {MERCHANT}
        </p>
      </div>
    </footer>
  );
}
