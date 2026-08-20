# ADR-006 — KES in minor units, single locale, schema does not block i18n

**Status:** Accepted · 2026-08-20

## Context

The merchant sells in Kenya, in Kenyan shillings, to customers reading English.
A second currency or a second language is not in scope, but neither should be
made expensive by a decision taken now for convenience.

## Decision

**Currency.** `KES`. Amounts are `bigint` **cents** — 1 KES = 100 cents. Every
money column ends `_minor` and every row carries its own `currency char(3)`, even
though every row currently says `KES`.

`CURRENCY=KES` is an env constant, read in one place. Formatting happens only
inside the `<Price>` primitive, via `Intl.NumberFormat('en-KE', { style:
'currency', currency: CURRENCY })`.

Money never becomes a JS `number`. It crosses the wire as a string, because
`bigint` does not survive `JSON.stringify` and `number` loses precision above
2^53. All arithmetic goes through `src/lib/money.ts`.

**Phone numbers.** Stored E.164, `+254…`. Input accepts the local forms people
actually type — `0712 345 678`, `254712345678`, `+254712345678` — and normalises
on save. Validation is a shared Zod schema; a phone that will not normalise is a
form error with an example, not a silent failure.

**Locale.** Single locale, LTR, English. `products.name` and
`products.description_md` are plain columns. i18n later means a
`product_translations` table keyed on `(product_id, locale)` and a fallback join
— an additive migration, not a rewrite. No code should read `products.name` from
more than one helper, so that helper is the only thing that changes.

**Delivery.** A per-zone fee table set by the admin, not a flat fee and not a
carrier API. Nairobi zones and upcountry differ enough that a flat fee is either
a loss or a deterrent. `delivery_zones(id, name, fee_minor, active)`, and the
chosen zone plus its fee are snapshotted into the order.

## Consequences

- No floating point anywhere near an amount. Rounding disputes on a
  cash-on-delivery order are settled by the snapshot, not recomputed.
- The `currency` column is redundant today and cheap. Adding a second currency
  becomes a pricing problem rather than a migration problem.
- `Intl` output for KES is "KSh 45,000.00". If the merchant prefers "KSh 45,000"
  with no cents for whole amounts, that is a formatting option on `<Price>`, not
  a storage change.
- Sorting and filtering by price operate on `bigint`, so they are exact and index
  friendly.

## Rejected alternatives

**`numeric(12,2)`.** Exact, and the textbook answer for money in Postgres. It
arrives in JavaScript as a string that everyone eventually parses with
`parseFloat`, which reintroduces the problem the type was chosen to avoid.
Integer minor units make the unsafe operation impossible rather than merely
discouraged. Rejected.

**Storing a formatted price string.** Unsortable, unsummable. Rejected.

**Flat delivery fee.** Simpler, and wrong for a country where delivering a
wardrobe to Kisumu and to Kilimani are not the same job. Rejected.
