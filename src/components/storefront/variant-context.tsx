'use client';

// "use client" because the variant selection is interaction state shared by the
// gallery, the price and the cart button. It is held here so those three stay
// small leaf clients and everything between them stays a Server Component.

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import type { Variant } from '@/lib/catalog/types';

interface VariantContextValue {
  variants: readonly Variant[];
  selected: Variant | null;
  select: (id: string) => void;
}

const VariantContext = createContext<VariantContextValue | null>(null);

export function useVariant(): VariantContextValue {
  const value = useContext(VariantContext);
  if (!value) throw new Error('useVariant must be used inside <VariantProvider>');
  return value;
}

export function VariantProvider({
  variants,
  children,
}: {
  variants: readonly Variant[];
  children: ReactNode;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(variants[0]?.id ?? null);

  // A shared `?variant=` link should land on that variant.
  //
  // This genuinely is "subscribe to an external system on mount": the page is
  // prerendered without knowing the query string, so reading it during render
  // would make the server HTML and the first client render disagree and produce
  // a hydration error. An effect is the correct tool here, and the one extra
  // render only happens for a visitor arriving on a variant link.
  useEffect(() => {
    const param = new URLSearchParams(window.location.search).get('variant');
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reads the URL, an external system; see above.
    if (param && variants.some((v) => v.id === param)) setSelectedId(param);
  }, [variants]);

  function select(id: string) {
    setSelectedId(id);

    // `replaceState` rather than `router.replace`: this page is static, and a
    // router navigation would fetch an RSC payload just to reflect a query
    // parameter that only the client cares about. The canonical stays the bare
    // product URL either way, so the parameter never fragments the index.
    const url = new URL(window.location.href);
    url.searchParams.set('variant', id);
    window.history.replaceState(null, '', url.toString());
  }

  const value = useMemo<VariantContextValue>(
    () => ({
      variants,
      selected: variants.find((v) => v.id === selectedId) ?? variants[0] ?? null,
      select,
    }),
    [variants, selectedId],
  );

  return <VariantContext.Provider value={value}>{children}</VariantContext.Provider>;
}
