import { ImageResponse } from 'next/og';

import { OG_COLOURS, OG_CONTENT_TYPE, OG_SIZE, OgFrame, ogFonts } from '@/lib/seo/og';
import { MERCHANT } from '@/lib/site';

export const alt = `${MERCHANT} — handmade furniture in Nairobi, listed with full dimensions`;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image() {
  const fonts = await ogFonts();

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
            Made to order in Nairobi
          </div>
          <div style={{ fontSize: 82, color: OG_COLOURS.ink, lineHeight: 1.05, marginTop: 20 }}>
            Every piece, with
          </div>
          <div style={{ fontSize: 82, color: OG_COLOURS.ink, lineHeight: 1.05 }}>
            its numbers on it.
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
