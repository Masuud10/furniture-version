'use client';

// "use client" because a disclosure needs open state and an Escape handler.
// Scoped to small screens only; the desktop nav is plain server-rendered anchors.

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

import { NAV_LINKS } from '@/lib/site';

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls="mobile-nav-panel"
        onClick={() => setOpen((v) => !v)}
        className="border border-rule-strong px-3 py-1 font-mono text-step--1 text-ink hover:border-ink"
      >
        Menu
      </button>

      {open && (
        <div
          id="mobile-nav-panel"
          ref={panelRef}
          className="absolute inset-x-0 top-14 border-b border-rule bg-surface px-(--page-gutter) py-4"
        >
          <nav aria-label="Main">
            <ul className="flex flex-col">
              {NAV_LINKS.map((link) => (
                <li key={link.href} className="border-b border-rule last:border-b-0">
                  <Link
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className="block py-3 text-step-1"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
              <li className="border-t border-rule">
                <Link href="/search" onClick={() => setOpen(false)} className="block py-3 text-step-1">
                  Search
                </Link>
              </li>
            </ul>
          </nav>
        </div>
      )}
    </>
  );
}
