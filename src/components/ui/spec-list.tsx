import type { ReactNode } from 'react';

import { cn } from '@/lib/utils/cn';

/**
 * The specification block: a definition list with hairline separators, not prose.
 * Values that are numbers a person could measure or read aloud are set in mono by
 * the caller passing `mono`.
 */
export function SpecList({ children, className }: { children: ReactNode; className?: string }) {
  return <dl className={cn('border-t border-rule', className)}>{children}</dl>;
}

export function SpecRow({
  label,
  children,
  mono = false,
}: {
  label: string;
  children: ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="grid grid-cols-[minmax(6.5rem,9rem)_1fr] gap-4 border-b border-rule py-3">
      <dt className="font-mono text-step--1 uppercase tracking-wide text-ink-muted">{label}</dt>
      <dd className={cn('text-step-0 text-ink', mono && 'font-mono tabular-nums')}>{children}</dd>
    </div>
  );
}

/** A hairline rule used as structure. Shadows are for floating surfaces only. */
export function Rule({ className }: { className?: string }) {
  return <hr className={cn('border-0 border-t border-rule', className)} />;
}
