import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';

import { cn } from '@/lib/utils/cn';

type Variant = 'primary' | 'secondary' | 'quiet';
type Size = 'md' | 'lg';

const base =
  'inline-flex items-center justify-center gap-2 border font-medium transition-colors ' +
  'disabled:cursor-not-allowed disabled:opacity-55 rounded-sm';

// No pills, no shadows. A control is a rectangle with a rule around it.
const variants: Record<Variant, string> = {
  primary: 'border-accent bg-accent text-accent-ink hover:bg-ink hover:border-ink',
  secondary: 'border-rule-strong bg-surface text-ink hover:border-ink hover:bg-surface-sunken',
  quiet: 'border-transparent bg-transparent text-ink-muted hover:text-ink hover:border-rule',
};

const sizes: Record<Size, string> = {
  md: 'h-10 px-4 text-step-0',
  lg: 'h-12 px-6 text-step-0',
};

export function buttonClass(variant: Variant = 'primary', size: Size = 'md', className?: string) {
  return cn(base, variants[variant], sizes[size], className);
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...rest
}: ComponentProps<'button'> & { variant?: Variant; size?: Size; children: ReactNode }) {
  return (
    <button className={buttonClass(variant, size, className)} {...rest}>
      {children}
    </button>
  );
}

export function ButtonLink({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...rest
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size; children: ReactNode }) {
  return (
    <Link className={buttonClass(variant, size, className)} {...rest}>
      {children}
    </Link>
  );
}
