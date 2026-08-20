import { readFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * Shared pieces for the `opengraph-image` routes.
 *
 * Fonts are read from disk as ArrayBuffers and handed to `ImageResponse`
 * explicitly: the renderer has no system fonts, so an unspecified family renders
 * as blank boxes. Satori also rejects WOFF2 and needs a single concrete weight,
 * which is why these are static TTFs instanced from the variable files rather
 * than the WOFF2s the site itself serves. See scripts/ and docs/progress.md.
 */

export const OG_SIZE = { width: 1200, height: 630 } as const;
export const OG_CONTENT_TYPE = 'image/png';

// Theme-independent: an OG card is rendered once and viewed inside someone
// else's UI, so it commits to the paper ground rather than following a scheme.
export const OG_COLOURS = {
  paper: '#fbfbfa',
  ink: '#16181b',
  inkMuted: '#5b6067',
  rule: '#d6d8db',
  ruleStrong: '#83898f',
  accent: '#1f4fd8',
} as const;

async function loadFont(file: string): Promise<ArrayBuffer> {
  const buffer = await readFile(path.join(process.cwd(), 'src/assets/og-fonts', file));
  return new Uint8Array(buffer).buffer as ArrayBuffer;
}

export async function ogFonts() {
  const [display, mono] = await Promise.all([
    loadFont('inter-tight-700.ttf'),
    loadFont('jetbrains-mono-500.ttf'),
  ]);

  return [
    { name: 'InterTight', data: display, weight: 700 as const, style: 'normal' as const },
    { name: 'JetBrainsMono', data: mono, weight: 500 as const, style: 'normal' as const },
  ];
}

/** The drafting grid, as plain divs — Satori supports no CSS background images. */
export function OgGrid() {
  const step = 40;
  const columns = Math.ceil(OG_SIZE.width / step);
  const rows = Math.ceil(OG_SIZE.height / step);

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex' }}>
      {Array.from({ length: columns }, (_, i) => (
        <div
          key={`c${i}`}
          style={{
            position: 'absolute',
            left: i * step,
            top: 0,
            width: 1,
            height: OG_SIZE.height,
            backgroundColor: i % 5 === 0 ? OG_COLOURS.rule : '#eceef0',
          }}
        />
      ))}
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={`r${i}`}
          style={{
            position: 'absolute',
            left: 0,
            top: i * step,
            width: OG_SIZE.width,
            height: 1,
            backgroundColor: i % 5 === 0 ? OG_COLOURS.rule : '#eceef0',
          }}
        />
      ))}
    </div>
  );
}

/** Corner registration marks, the same ones the plates carry. */
export function OgCorners() {
  const inset = 28;
  const arm = 28;
  const border = `2px solid ${OG_COLOURS.ruleStrong}`;

  // A uniform shape rather than four differently-keyed literals, so the union
  // does not collapse to "no common properties" under a strict compiler.
  const marks: ReadonlyArray<React.CSSProperties> = [
    { top: inset, left: inset, borderTop: border, borderLeft: border },
    { top: inset, right: inset, borderTop: border, borderRight: border },
    { bottom: inset, left: inset, borderBottom: border, borderLeft: border },
    { bottom: inset, right: inset, borderBottom: border, borderRight: border },
  ];

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex' }}>
      {marks.map((mark, i) => (
        <div key={i} style={{ position: 'absolute', width: arm, height: arm, ...mark }} />
      ))}
    </div>
  );
}

/**
 * The card frame.
 *
 * Satori resolves `position: absolute; inset: 0` against the *padding* box, so a
 * padded root pushes the grid and the registration marks inward and they stop
 * lining up with the edge. Padding therefore lives on the content layer and the
 * decoration layers sit on an unpadded root.
 */
export function OgFrame({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        position: 'relative',
        backgroundColor: OG_COLOURS.paper,
        fontFamily: 'InterTight',
      }}
    >
      <OgGrid />
      <OgCorners />
      <div
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          width: '100%',
          height: '100%',
          padding: 64,
        }}
      >
        {children}
      </div>
    </div>
  );
}
