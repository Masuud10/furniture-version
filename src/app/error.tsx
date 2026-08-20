'use client';

// An error boundary is a client component by definition — it needs the reset
// callback and it runs after a render has already failed.

import { useEffect } from 'react';

import { Button, ButtonLink } from '@/components/ui/button';
import { SHOWROOM } from '@/lib/site';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // The digest is the only safe handle on a server error: the message itself
    // may contain internals and never reaches the customer. No raw Postgres
    // error is ever rendered.
    console.error('Storefront error', error.digest ?? error.message);
  }, [error]);

  return (
    <main
      id="main"
      className="mx-auto flex min-h-dvh max-w-(--page-max) flex-col justify-center px-(--page-gutter) py-16"
    >
      <p className="font-mono text-step--1 uppercase tracking-wide text-ink-muted">Error</p>
      <h1 className="mt-3 text-step-5">Something went wrong at our end</h1>
      <p className="mt-3 max-w-(--measure) text-step-1 text-ink-muted">
        The page did not load. Try it again — if it still will not, call the showroom on{' '}
        <a href={`tel:${SHOWROOM.telephone}`} className="font-mono text-ink underline-offset-4 hover:underline">
          {SHOWROOM.telephoneDisplay}
        </a>{' '}
        and we will take it from there.
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        <Button onClick={reset} size="lg">
          Try again
        </Button>
        <ButtonLink href="/" variant="secondary" size="lg">
          Go to the home page
        </ButtonLink>
      </div>

      {error.digest && (
        <p className="mt-8 border-t border-rule pt-4 font-mono text-step--1 text-ink-muted">
          Reference {error.digest}
        </p>
      )}
    </main>
  );
}
