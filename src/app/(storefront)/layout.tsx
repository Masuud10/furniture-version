import type { ReactNode } from 'react';

import { SiteFooter } from '@/components/storefront/site-footer';
import { SiteHeader } from '@/components/storefront/site-header';

/**
 * The public shell. Route group only — `(storefront)` does not appear in any URL.
 * The account and admin areas get their own shell in their own phases.
 */
export default function StorefrontLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
