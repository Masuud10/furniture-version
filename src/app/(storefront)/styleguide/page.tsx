import type { Metadata } from 'next';

import { DimensionFigure, DimensionStrip } from '@/components/storefront/dimension-figure';
import { Button, ButtonLink } from '@/components/ui/button';
import { Media } from '@/components/ui/media';
import { Price, PriceDelta } from '@/components/ui/price';
import { Rule, SpecList, SpecRow } from '@/components/ui/spec-list';
import { FIXTURE_PRODUCTS } from '@/lib/catalog/fixtures';
import { CURRENCY } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Styleguide',
  // An internal reference surface. Never indexed.
  robots: { index: false, follow: false },
};

/**
 * The token and component reference required by docs/design-brief.md §9.
 * Screenshot this at 360px and 1440px, in light and dark, before declaring done.
 */

const COLOURS: ReadonlyArray<{ token: string; role: string; note: string }> = [
  { token: '--surface', role: 'Page ground', note: 'paper in light, ground in dark' },
  { token: '--surface-raised', role: 'Raised surface', note: 'dialog, plate, sheet' },
  { token: '--surface-sunken', role: 'Sunken surface', note: 'media slot, skeleton' },
  { token: '--ink', role: 'Body text', note: '16.4:1 light · 18.5:1 dark' },
  { token: '--ink-muted', role: 'Secondary text', note: '6.12:1 light · 7.26:1 dark' },
  { token: '--rule', role: 'Hairline', note: 'decorative structure' },
  { token: '--rule-strong', role: 'UI boundary', note: '3.41:1 light · 3.26:1 dark' },
  { token: '--accent', role: 'Focus, price, active', note: '6.40:1 light · 8.55:1 dark' },
  { token: '--accent-quiet', role: 'Selected wash', note: 'behind a chosen filter' },
  { token: '--warn', role: 'Warning', note: 'reserved' },
  { token: '--danger', role: 'Danger', note: 'reserved' },
  { token: '--ok', role: 'Success', note: 'reserved' },
];

const STEPS = ['--step--1', '--step-0', '--step-1', '--step-2', '--step-3', '--step-4', '--step-5', '--step-6'];
const SPACES = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];

export default function StyleguidePage() {
  const sample = FIXTURE_PRODUCTS[0];

  return (
    <div className="mx-auto max-w-(--page-max) px-(--page-gutter) py-8">
      <h1 className="text-step-5">Styleguide</h1>
      <p className="mt-3 max-w-(--measure) text-step-1 text-ink-muted">
        Direction B, “Spec sheet”. Every value below is a token in{' '}
        <code className="font-mono text-step-0">src/styles/globals.css</code>. No component
        contains a raw hex value or a default Tailwind palette name.
      </p>

      {/* Colour ------------------------------------------------------------- */}
      <Section title="Colour">
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {COLOURS.map((colour) => (
            <li key={colour.token} className="flex items-center gap-3 border-t border-rule pt-3">
              <span
                aria-hidden="true"
                className="h-12 w-12 shrink-0 border border-rule-strong"
                style={{ backgroundColor: `var(${colour.token})` }}
              />
              <div className="min-w-0">
                <p className="font-mono text-step--1 text-ink">{colour.token}</p>
                <p className="text-step--1 text-ink-muted">{colour.role}</p>
                <p className="font-mono text-step--1 tabular-nums text-ink-muted">{colour.note}</p>
              </div>
            </li>
          ))}
        </ul>
      </Section>

      {/* Type --------------------------------------------------------------- */}
      <Section title="Type scale">
        <p className="max-w-(--measure) text-step-0 text-ink-muted">
          A 1.200 major third from a 16px base. Display steps are fluid via clamp(). Inter
          Tight carries display, Inter carries body, JetBrains Mono carries every number a
          person could measure or read aloud.
        </p>
        <ul className="mt-5">
          {STEPS.map((step) => (
            <li key={step} className="flex flex-wrap items-baseline gap-4 border-t border-rule py-3">
              <span className="w-24 shrink-0 font-mono text-step--1 text-ink-muted">{step}</span>
              <span style={{ fontSize: `var(${step})` }} className="font-display leading-tight">
                Kaputei 2100
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-6 border-t border-rule pt-3">
          <p className="font-mono text-step--1 uppercase tracking-wide text-ink-muted">
            The mono rule
          </p>
          <p className="mt-2 max-w-(--measure) text-step-0">
            Order number <span className="font-mono">FRN-2026-0417</span>, dimensions{' '}
            <span className="font-mono tabular-nums">2100 × 900 × 780 mm</span>, SKU{' '}
            <span className="font-mono">KPT-3S-CAN</span>, lead time{' '}
            <span className="font-mono tabular-nums">28 days</span>.
          </p>
        </div>
      </Section>

      {/* Spacing ------------------------------------------------------------ */}
      <Section title="Spacing">
        <ul className="flex flex-col gap-2">
          {SPACES.map((n) => (
            <li key={n} className="flex items-center gap-4">
              <span className="w-24 shrink-0 font-mono text-step--1 text-ink-muted">
                --space-{n}
              </span>
              <span
                aria-hidden="true"
                className="h-3 bg-accent"
                style={{ width: `var(--space-${n})` }}
              />
            </li>
          ))}
        </ul>
      </Section>

      {/* Controls ----------------------------------------------------------- */}
      <Section title="Controls">
        <div className="flex flex-wrap items-center gap-4">
          <Button>Add to cart</Button>
          <Button variant="secondary">Clear filters</Button>
          <Button variant="quiet">Ask a question</Button>
          <Button disabled>Unavailable</Button>
          <ButtonLink href="/collections" size="lg">
            Browse collections
          </ButtonLink>
        </div>
        <p className="mt-4 max-w-(--measure) text-step--1 text-ink-muted">
          Radii are 2px and 4px. Nothing is a pill. Shadows are reserved for genuinely
          floating surfaces — dialog, sheet, toast — and a card never floats. Tab through
          these to see the focus treatment: a 2px accent outline at 2px offset.
        </p>
      </Section>

      {/* Rules and spec block ------------------------------------------------ */}
      <Section title="Rules and the spec block">
        <div className="grid gap-8 md:grid-cols-2">
          <div>
            <SpecList>
              <SpecRow label="Width" mono>
                2100 mm
              </SpecRow>
              <SpecRow label="Depth" mono>
                900 mm
              </SpecRow>
              <SpecRow label="Height" mono>
                780 mm
              </SpecRow>
              <SpecRow label="Materials">Canvas, Wool, Leather</SpecRow>
            </SpecList>
          </div>
          <div>
            <p className="text-step--1 text-ink-muted">Hairline, then emphasised rule:</p>
            <Rule className="mt-3" />
            <hr className="mt-3 border-0 border-t border-rule-strong" />
            <p className="mt-6 text-step--1 text-ink-muted">Price and price delta:</p>
            <p className="mt-2 flex flex-wrap items-baseline gap-4">
              <Price minor="14500000" currency={CURRENCY} emphasis className="text-step-3" />
              <Price minor="14500000" currency={CURRENCY} />
              <PriceDelta minor="4200000" currency={CURRENCY} />
              <PriceDelta minor="0" currency={CURRENCY} />
            </p>
          </div>
        </div>
      </Section>

      {/* Signature ----------------------------------------------------------- */}
      <Section title="Signature — dimension annotations">
        <p className="max-w-(--measure) text-step-0 text-ink-muted">
          Hover it, or tab to the “Sizes” control inside it, or tap that control on touch.
          The geometry comes from the product’s dimensions crossed with the measured anchor
          box stored on the image, so it is a drawing rather than a decoration. Below 480px
          the overlay is withdrawn and the strip beneath carries the numbers instead. With
          reduced motion the annotations appear at full extent without drawing on.
        </p>
        {sample?.primaryImage && (
          <div className="mt-6 max-w-2xl">
            <DimensionFigure
              dimensions={sample.dimensions}
              anchors={sample.primaryImage.anchors}
              axes="wdh"
              className="border border-rule"
            >
              <Media asset={sample.primaryImage} sizes="(min-width: 48rem) 42rem, 92vw" />
            </DimensionFigure>
            <DimensionStrip dimensions={sample.dimensions} className="mt-3" />
          </div>
        )}
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-14 border-t border-rule pt-6">
      <h2 className="text-step-3">{title}</h2>
      <div className="mt-6">{children}</div>
    </section>
  );
}
