import { ImageResponse } from 'next/og';

import { getAllCategorySlugs, getCategory } from '@/lib/catalog/source';
import { OG_COLOURS, OG_CONTENT_TYPE, OG_SIZE, OgFrame, ogFonts } from '@/lib/seo/og';
import { MERCHANT } from '@/lib/site';

export const alt = 'Collection card';
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export async function generateStaticParams(): Promise<Array<{ slug: string }>> {
  const slugs = await getAllCategorySlugs();
  return slugs.map((slug) => ({ slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [category, fonts] = await Promise.all([getCategory(slug), ogFonts()]);

  const name = category?.name ?? 'Collections';
  const count = category?.productCount ?? 0;

  return new ImageResponse(
    (
      <OgFrame>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              fontFamily: 'JetBrainsMono',
              fontSize: 24,
              letterSpacing: 2,
              textTransform: 'uppercase',
              color: OG_COLOURS.inkMuted,
            }}
          >
            Collection
          </div>
          <div
            style={{
              fontSize: 82,
              color: OG_COLOURS.ink,
              lineHeight: 1.05,
              marginTop: 18,
              maxWidth: 1000,
            }}
          >
            {name}
          </div>
          <div
            style={{
              fontFamily: 'JetBrainsMono',
              fontSize: 30,
              color: OG_COLOURS.inkMuted,
              marginTop: 22,
            }}
          >
            {`${count} ${count === 1 ? 'piece' : 'pieces'}, every one with its dimensions listed`}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            borderTop: `2px solid ${OG_COLOURS.ink}`,
            paddingTop: 20,
          }}
        >
          <div style={{ fontSize: 40, color: OG_COLOURS.ink }}>{MERCHANT}</div>
          <div style={{ fontFamily: 'JetBrainsMono', fontSize: 24, color: OG_COLOURS.accent }}>
            Pay cash when it arrives
          </div>
        </div>
      </OgFrame>
    ),
    { ...size, fonts },
  );
}
