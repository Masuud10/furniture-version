import localFont from 'next/font/local';

/**
 * Two typefaces, self-hosted, subsetted to latin.
 *
 * Inter is used in two optical widths — Inter Tight for display, Inter for body.
 * They share metrics and a designer, so the page reads as one voice while the
 * display sizes get the tighter fit that a spec sheet wants; JetBrains Mono is
 * the second face and it exists to carry every number a person could measure or
 * read aloud, which is the rule that makes the spec-sheet idea legible.
 *
 * These are variable files, so the weight axis is declared as an explicit range
 * rather than shipping four static instances. `adjustFontFallback` generates a
 * metric-matched Arial fallback, which is what keeps CLS at zero during swap.
 *
 * The files are subsetted by scripts/subset-fonts.py to basic latin plus the
 * punctuation this site actually sets. All three are preloaded and therefore on
 * the critical path, so the full Google latin subsets cost ~123 KB in front of
 * first paint; subsetting takes that to ~70 KB. Re-run that script if the copy
 * ever needs a character outside the declared range.
 */

export const inter = localFont({
  src: [{ path: '../../public/fonts/inter-latin-var.woff2', weight: '400 500', style: 'normal' }],
  variable: '--font-inter',
  weight: '400 500',
  display: 'swap',
  preload: true,
  adjustFontFallback: 'Arial',
  fallback: ['ui-sans-serif', 'system-ui', 'sans-serif'],
});

export const interTight = localFont({
  src: [
    { path: '../../public/fonts/inter-tight-latin-var.woff2', weight: '600 700', style: 'normal' },
  ],
  variable: '--font-inter-tight',
  weight: '600 700',
  display: 'swap',
  preload: true,
  adjustFontFallback: 'Arial',
  fallback: ['ui-sans-serif', 'system-ui', 'sans-serif'],
});

export const jetbrainsMono = localFont({
  src: [
    {
      path: '../../public/fonts/jetbrains-mono-latin-var.woff2',
      weight: '400 500',
      style: 'normal',
    },
  ],
  variable: '--font-jetbrains-mono',
  weight: '400 500',
  display: 'swap',
  preload: true,
  adjustFontFallback: 'Arial',
  fallback: ['ui-monospace', 'monospace'],
});

export const fontVariables = [inter.variable, interTight.variable, jetbrainsMono.variable].join(' ');
