import 'server-only';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * The catalogue read client.
 *
 * Deliberately *not* the cookie-bound `@supabase/ssr` client that lives in
 * `src/lib/supabase/`. Catalogue pages are static: the moment a client reads
 * `cookies()`, the route opts out of static rendering and every product page
 * becomes a database round trip. Published rows are readable by `anon` under RLS,
 * so this client carries no session at all and can be shared and cached.
 *
 * Anon key only. Nothing in this module may ever reference the service role key.
 */

let cached: SupabaseClient | null = null;

export function isCatalogueBacked(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function catalogueClient(): SupabaseClient {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      'Catalogue client requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY. ' +
        'Call isCatalogueBacked() before catalogueClient().',
    );
  }

  cached = createClient(url, anonKey, {
    auth: {
      // No session, no refresh timer, nothing written to storage. This client
      // exists to read public rows during a build.
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: { 'x-application-name': 'storefront-catalogue' },
    },
  });

  return cached;
}
