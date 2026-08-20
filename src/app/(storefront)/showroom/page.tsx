import type { Metadata } from 'next';

import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { ButtonLink } from '@/components/ui/button';
import { SpecList, SpecRow } from '@/components/ui/spec-list';
import { JsonLd } from '@/lib/seo/json-ld';
import { breadcrumbJsonLd, furnitureStoreJsonLd, type Crumb } from '@/lib/seo/schema';
import { MERCHANT, OPENING_HOURS, SHOWROOM } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Showroom',
  description: `Visit the ${MERCHANT} showroom on ${SHOWROOM.streetAddress}, ${SHOWROOM.addressLocality}. Most of the catalogue is on the floor — come and measure it yourself.`,
  alternates: { canonical: '/showroom' },
  openGraph: {
    type: 'website',
    url: '/showroom',
    title: 'Showroom',
    description: `Most of the catalogue is on the floor at ${SHOWROOM.streetAddress}, ${SHOWROOM.addressLocality}.`,
  },
};

const crumbs: readonly Crumb[] = [
  { name: 'Home', path: '/' },
  { name: 'Showroom', path: '/showroom' },
];

export default function ShowroomPage() {
  return (
    <div className="mx-auto max-w-(--page-max) px-(--page-gutter) py-8">
      <Breadcrumbs crumbs={crumbs} />

      <h1 className="mt-4 text-step-5">Showroom</h1>
      <p className="mt-3 max-w-(--measure) text-step-1 text-ink-muted">
        Photographs and dimensions get you most of the way. Sitting on the thing gets you
        the rest. Most of the catalogue is on the floor here, and nobody will follow you
        around it.
      </p>

      <div className="mt-10 grid gap-10 md:grid-cols-2">
        <section aria-labelledby="visit">
          <h2 id="visit" className="text-step-2">
            Where to find us
          </h2>

          <SpecList className="mt-4">
            <SpecRow label="Address">
              <address className="not-italic">
                {SHOWROOM.streetAddress}
                <br />
                {SHOWROOM.addressLocality}, {SHOWROOM.addressRegion}
                <br />
                {SHOWROOM.postalCode}
              </address>
            </SpecRow>
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
            {OPENING_HOURS.map((slot) => (
              <SpecRow
                key={slot.days.join('-')}
                label={slot.days.length > 1 ? `${slot.days[0]}–${slot.days[slot.days.length - 1]}` : slot.days[0]}
                mono
              >
                {slot.opens} – {slot.closes}
              </SpecRow>
            ))}
            <SpecRow label="Sunday" mono>
              Closed
            </SpecRow>
            <SpecRow label="Delivery">{SHOWROOM.areaServed}</SpecRow>
          </SpecList>

          <div className="mt-6">
            <ButtonLink href="/contact" variant="secondary">
              Ask a question first
            </ButtonLink>
          </div>
        </section>

        <section aria-labelledby="what-to-bring">
          <h2 id="what-to-bring" className="text-step-2">
            What to bring
          </h2>
          <div className="mt-4 flex max-w-(--measure) flex-col gap-4 text-step-0 leading-relaxed">
            <p>
              The dimensions of the room, and of the route into it. Doorway width, stair
              turns, lift depth. The wardrobe and the long dining table are the two pieces
              that most often will not go in, and it is much better to find that out here
              than on your landing.
            </p>
            <p>
              A photograph of the wall the piece is going against, if you have one. It
              settles arguments about scale faster than a tape measure does.
            </p>
            <p>
              Time. Nothing here is bought in five minutes, and nothing about the way we
              sell assumes it will be.
            </p>
          </div>

          <h2 className="mt-8 text-step-2">Paying</h2>
          <div className="mt-4 flex max-w-(--measure) flex-col gap-4 text-step-0 leading-relaxed">
            <p>
              Cash on delivery. You pay the driver when the piece is in your room and you
              have looked at it, not before.
            </p>
            <p>
              We will call you within a day of an order to confirm the details before
              anything is cut. That call is the point at which the order becomes real.
            </p>
          </div>
        </section>
      </div>

      <JsonLd data={furnitureStoreJsonLd()} />
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
    </div>
  );
}
