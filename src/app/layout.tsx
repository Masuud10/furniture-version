import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

import { fontVariables } from '@/lib/fonts';
import { JsonLd } from '@/lib/seo/json-ld';
import { organizationJsonLd } from '@/lib/seo/schema';
import { MERCHANT, OG_LOCALE, SITE_DESCRIPTION, siteUrl } from '@/lib/site';
import '@/styles/globals.css';

/**
 * `metadataBase` is set once here. Everything downstream inherits it, which is
 * what makes relative OG image paths and relative canonicals resolve to absolute
 * URLs without every page repeating the origin.
 */
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: `${MERCHANT} — Handmade furniture in Nairobi`,
    template: `%s — ${MERCHANT}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: MERCHANT,
  openGraph: {
    type: 'website',
    siteName: MERCHANT,
    locale: OG_LOCALE,
  },
  twitter: { card: 'summary_large_image' },
  robots: { index: true, follow: true },
  alternates: { canonical: '/' },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fbfbfa' },
    { media: '(prefers-color-scheme: dark)', color: '#0e0f11' },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-KE" className={fontVariables}>
      <body className="flex min-h-dvh flex-col bg-surface text-ink antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:border focus:border-accent focus:bg-surface focus:px-3 focus:py-2"
        >
          Skip to content
        </a>
        {children}
        <JsonLd data={organizationJsonLd()} />
      </body>
    </html>
  );
}
