import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * tailwind-merge has no knowledge of a CSS-first Tailwind v4 theme, so it guesses
 * from the class name. Our fluid type scale is `text-step-0` … `text-step-6`,
 * which it reads as a *text colour* rather than a font size — so in
 * `cn('text-accent-ink', 'text-step-0')` it treats the two as conflicting and
 * drops the colour.
 *
 * That is not hypothetical: it silently stripped `text-accent-ink` from the
 * primary button, leaving inherited ink on an accent fill at 2.68:1, which is
 * what axe caught. Declaring the scale here fixes it everywhere at once.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [
        {
          text: [
            'step--1',
            'step-0',
            'step-1',
            'step-2',
            'step-3',
            'step-4',
            'step-5',
            'step-6',
          ],
        },
      ],
    },
  },
});

/** Conditional classes with later Tailwind utilities winning over earlier ones. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
