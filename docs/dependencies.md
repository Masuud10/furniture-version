# Pinned dependencies

Checked against the npm registry on **2026-08-20**. Versions are exact — no
carets in `package.json`. Bumping anything here needs an ADR or an explicit
instruction.

## Toolchain present on the build machine

    node        22.14.0
    npm         10.9.7
    supabase    2.115.0   (CLI, via npx)
    docker      28.3.2    (required for `supabase start`)

## Runtime

    next                      16.3.1
    react                     19.2.8
    react-dom                 19.2.8
    @supabase/supabase-js     2.112.3
    server-only               0.0.1
    @supabase/ssr             0.12.4
    zod                       4.4.3
    clsx                      2.1.1
    tailwind-merge            3.6.0
    lucide-react              1.33.0
    sonner                    2.0.8
    next-themes               0.4.6
    @radix-ui/react-dialog    1.1.23
    @radix-ui/react-select    2.3.7
    @dnd-kit/core             6.3.1
    @dnd-kit/sortable         10.0.0
    @dnd-kit/modifiers        9.0.0

## Dev

    typescript                5.9.3   (see note)
    @types/node               26.2.0
    @types/react              19.2.18
    @types/react-dom          19.2.4
    tailwindcss               4.3.3
    @tailwindcss/postcss      4.3.3
    eslint                    9.39.5  (see note)
    eslint-config-next        16.3.1
    prettier                  3.9.6
    vitest                    4.1.11
    @vitejs/plugin-react      6.1.0
    jsdom                     30.0.1
    @playwright/test          1.62.1
    @axe-core/playwright      4.13.0
    sharp                     0.35.3
    supabase                  2.115.0

## Added during the storefront phase

**`server-only` 0.0.1.** CLAUDE.md requires every server-only module to start
with `import 'server-only'`, but the package was not listed here and is not a
transitive dependency of `next`, so the import failed to resolve. Added and
pinned. It is a two-line package whose only job is to fail the build if a
server module is pulled into a client bundle.

## Notes on the risky pins

**TypeScript is pinned to 5.9.3, not the current stable 7.0.2.** This was tried
and reverted, not assumed. `typescript-eslint` — which `eslint-config-next`
depends on — refuses to load against TS 7.0 outright:

    typescript-eslint does not support TS 7.0.

TS 7.0 also typechecks the project fine on its own; only linting breaks. Revisit
when `typescript-eslint` ships TS 7 support (tracked in typescript-eslint#10940).
Until then TS 7 means no lint, which is not a trade worth making.

**ESLint is pinned to 9.39.5, not the current 10.8.1.** Also tried and reverted.
ESLint 10 declares `node ^22.22.2 || ^24.15.0 || >=26.0.0`, and this machine runs
22.14.0; more decisively, `eslint-plugin-react` bundled by `eslint-config-next`
crashes under ESLint 10 with `contextOrFilename.getFilename is not a function`.
`eslint-config-next@16.3.1` declares `eslint >= 9.0.0`, so 9.39.5 is in range and
lints clean. Flat config (`eslint.config.mjs`) only.

**Node 22.14.0** is below what a few transitive packages now ask for. Nothing
fails today. Upgrading to Node 22 LTS latest or 24 would clear the warnings and
unblock ESLint 10; worth doing, not urgent.

**Tailwind v4** is CSS-first. There is no `tailwind.config.ts` with a theme
object — tokens are declared in CSS with `@theme`, and PostCSS uses
`@tailwindcss/postcss`. Anyone reaching for `tailwind.config.js` habits is
building against v3 documentation.

**`@supabase/ssr` 0.12.4** — still pre-1.0, and this API has already been renamed
once (`auth-helpers` → `ssr`). Verify `createServerClient` / `createBrowserClient`
and the cookie interface against current docs before writing the client
factories. Do not copy a blog post.

**`next.config.ts` has no `eslint` key.** Next 16 removed it — the build warns
`Unrecognized key(s) in object: 'eslint'` and then fails typecheck on it. Lint is
a separate step (`npm run lint`) and a separate CI job.

**`sharp`** runs server-side only, for extracting image dimensions and generating
blur placeholders at upload. It must never be imported from a client component.

## Deliberately absent

- No ORM. See ADR-001.
- No payment SDK. Cash on delivery.
- No SMS provider. See ADR-007.
- No analytics, no chat widget, no font CDN. Core Web Vitals are acceptance
  criteria, and a third-party script is the usual reason they fail.
- No component library beyond two Radix primitives that solve genuinely hard
  problems (focus trapping in Dialog, listbox semantics in Select). Everything
  else is written against the design system, because a component library ships
  someone else's visual opinions.
