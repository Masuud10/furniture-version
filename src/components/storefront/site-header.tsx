import Link from 'next/link';

import { MERCHANT, NAV_LINKS } from '@/lib/site';
import { MobileNav } from './mobile-nav';

/**
 * Server component. The only client part is the small-screen disclosure, which is
 * its own island — the header's links are real anchors and work without JS.
 */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-rule bg-surface/95 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-(--page-max) items-center gap-4 px-(--page-gutter)">
        <Link
          href="/"
          className="font-display text-step-1 font-semibold tracking-tight"
          aria-label={`${MERCHANT} — home`}
        >
          {MERCHANT}
        </Link>

        <nav aria-label="Main" className="ml-auto hidden items-center gap-6 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-step-0 text-ink-muted underline-offset-4 hover:text-ink hover:underline"
            >
              {link.label}
            </Link>
          ))}
          <SearchLink />
        </nav>

        <div className="ml-auto md:hidden">
          <MobileNav />
        </div>
      </div>
    </header>
  );
}

function SearchLink() {
  return (
    <Link
      href="/search"
      className="border border-rule-strong px-3 py-1 font-mono text-step--1 text-ink-muted hover:border-ink hover:text-ink"
    >
      Search
    </Link>
  );
}
