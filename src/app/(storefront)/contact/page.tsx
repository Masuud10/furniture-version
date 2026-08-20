import type { Metadata } from 'next';

import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { SpecList, SpecRow } from '@/components/ui/spec-list';
import { JsonLd } from '@/lib/seo/json-ld';
import { breadcrumbJsonLd, type Crumb } from '@/lib/seo/schema';
import { MERCHANT, OPENING_HOURS, SHOWROOM } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Contact',
  description: `Call ${MERCHANT} about a piece, a lead time, or something built to your own dimensions. ${SHOWROOM.telephoneDisplay}.`,
  alternates: { canonical: '/contact' },
  openGraph: {
    type: 'website',
    url: '/contact',
    title: 'Contact',
    description: `Call ${MERCHANT} about a piece, a lead time, or a custom build.`,
  },
};

const crumbs: readonly Crumb[] = [
  { name: 'Home', path: '/' },
  { name: 'Contact', path: '/contact' },
];

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-(--page-max) px-(--page-gutter) py-8">
      <Breadcrumbs crumbs={crumbs} />

      <h1 className="mt-4 text-step-5">Contact</h1>
      <p className="mt-3 max-w-(--measure) text-step-1 text-ink-muted">
        Call us. It is the fastest way to get an answer, particularly about whether a
        piece will fit, and there is a person at the other end of it during showroom
        hours.
      </p>

      <div className="mt-10 grid gap-10 md:grid-cols-2">
        <section aria-labelledby="reach-us">
          <h2 id="reach-us" className="text-step-2">
            Reach us
          </h2>
          <SpecList className="mt-4">
            <SpecRow label="Phone" mono>
              <a href={`tel:${SHOWROOM.telephone}`} className="underline-offset-4 hover:underline">
                {SHOWROOM.telephoneDisplay}
              </a>
            </SpecRow>
            {SHOWROOM.email && (
              <SpecRow label="Email">
                <a href={`mailto:${SHOWROOM.email}`} className="underline-offset-4 hover:underline">
                  {SHOWROOM.email}
                </a>
              </SpecRow>
            )}
            <SpecRow label="Showroom">
              <address className="not-italic">
                {SHOWROOM.streetAddress}
                <br />
                {SHOWROOM.addressLocality}
              </address>
            </SpecRow>
            {OPENING_HOURS.map((slot) => (
              <SpecRow
                key={slot.days.join('-')}
                label={slot.days.length > 1 ? `${slot.days[0]}–${slot.days[slot.days.length - 1]}` : slot.days[0]}
                mono
              >
                {slot.opens} – {slot.closes}
              </SpecRow>
            ))}
          </SpecList>
        </section>

        <section aria-labelledby="what-to-say">
          <h2 id="what-to-say" className="text-step-2">
            What helps us answer
          </h2>
          <div className="mt-4 flex max-w-(--measure) flex-col gap-4 text-step-0 leading-relaxed">
            <p>
              The piece name or the SKU, if you are asking about something in the
              catalogue. Every listing carries both.
            </p>
            <p>
              The dimensions you have to work with, if you are asking whether something
              fits — the wall, the doorway, and the ceiling height for the tall pieces.
            </p>
            <p>
              For a custom build: the size, the timber, and roughly when you need it.
              Most things in the catalogue can be made to a different length. Some cannot,
              and we will say so rather than take the order.
            </p>
          </div>

          <h2 className="mt-8 text-step-2">After you order</h2>
          <div className="mt-4 flex max-w-(--measure) flex-col gap-4 text-step-0 leading-relaxed">
            <p>
              We call within a day to confirm the order before production starts. Nothing
              is cut before that conversation.
            </p>
            <p>
              You pay cash when the piece arrives and you have looked at it. There is no
              deposit and no card on file.
            </p>
          </div>
        </section>
      </div>

      <JsonLd data={breadcrumbJsonLd(crumbs)} />
    </div>
  );
}
