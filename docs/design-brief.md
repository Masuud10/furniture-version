# Visual direction — Direction B, "Spec sheet"

**Decided.** Do not re-open the choice. Build against this.

---

## 1. What is banned

AI design for furniture converges on one look: cream background near `#F4F1EA`,
high-contrast serif display, terracotta accent near `#D97757`, generous
whitespace, a centred hero with a single sofa. It is competent, it is everywhere,
and it reads as generated.

Specifically banned:

- backgrounds in the `#F4F1EA` / `#FAF7F2` / `#F5F0E8` family as the site ground
- terracotta or clay accent near `#D97757` / `#C96442` / `#B5654A`
- a high-contrast serif display face paired with a geometric sans body
- full-bleed centred hero with one product and two words of copy
- soft ambient drop shadows on cards
- pill-shaped buttons with 999px radius

If a screen could be swapped into any other AI-built furniture site without
anyone noticing, it has failed.

## 2. Direction B — Spec sheet

The visual language is borrowed from furniture drawings and cutting lists, not
from lifestyle magazines. This site looks like it was made by people who know the
dimensions of what they sell.

**The idea.** Every piece of furniture arrives in the world as a drawing with
numbers on it. The storefront treats the drawing as the native language:
dimension lines, hairline rules, callouts, material swatches as first-class UI,
and a mono face carrying every measurement, SKU and lead time.

**Signature element — spend the boldness here and nowhere else.**
Hovering, focusing or tapping a product photo reveals **dimension annotations
drawn over the image**: hairline extension lines to the edges of the piece, an
arrowed dimension line, and the measurement in mono type on a small opaque plate.
Width and depth on the listing, all three axes on product detail.

Requirements for the signature:
- coordinates come from `products.dimensions` jsonb plus per-image anchor points
  stored on `media_assets`, so it is data, not a hand-placed decoration
- it is keyboard reachable — focus triggers it, not just hover
- `prefers-reduced-motion` removes the draw-on animation; annotations appear at
  full opacity immediately
- on touch it appears on tap of a dedicated "dimensions" affordance, never
  hijacking the tap that opens the product
- it never obscures the product at small sizes; below 480px it degrades to a
  dimension strip beneath the image

**Everything else stays quiet.** One bold thing.

## 3. Palette

Ink and paper, cool rather than warm, with product photography carrying all the
colour. Accent is used for focus rings, price emphasis and active state — nothing
else. These are starting values; tune for AA and record the final set as tokens.

    --ground        #0E0F11   near-black, slightly cool          (dark surface)
    --paper         #FBFBFA   off-white, no cream cast           (light surface)
    --ink           #16181B   body text on paper
    --ink-muted     #5B6067   secondary text, annotations
    --rule          #D6D8DB   hairlines, dimension lines, table borders
    --rule-strong   #9AA0A6   emphasised rules
    --accent        #1F4FD8   ink blue — drafting blue, not terracotta
    --accent-quiet  #E8EDFB   accent wash for selected swatches
    --warn          #8A5A00
    --danger        #A61B1B
    --ok            #1E6B3A

The accent is a drafting blue on purpose: it belongs to the technical vernacular,
and it is the furthest thing from the banned palette.

Dark mode is a first-class inversion, not an afterthought — `--ground` becomes the
page, `--paper` becomes the elevated card. Verify AA in both.

## 4. Typography

Two faces, self-hosted through `next/font`, explicit weights only.

- **Display and body:** a tightly-tracked neo-grotesk with real optical
  correction at large sizes. Suggested: **Inter Tight** for display (600, 700) and
  **Inter** for body (400, 500). Justify whatever is chosen in two sentences.
- **Utility:** a mono for every measurement, SKU, order number, lead time, price
  in tables and dimension annotation. Suggested: **JetBrains Mono** (400, 500).

The mono is not decoration. It is the rule that makes the spec-sheet idea legible:
**if it is a number a person could measure or read aloud, it is set in mono.**
Order number `FRN-2026-0417`, `1800 × 900 × 750 mm`, `SKU WAL-3S-BCL`, `14 days`.

No serif anywhere.

## 5. Tokens before components

Define as CSS custom properties in `@theme` before writing a single component.
No default Tailwind palette names (`gray-500`, `blue-600`) may appear in any
component. Type scale, spacing scale, radii and motion durations are all tokens.

- **Type scale** — a modest ratio; this is a technical document, not a poster.
  1.200 major third from a 16px base, with display sizes clamped for fluid
  behaviour. Line heights are tokens too.
- **Spacing** — 4px base, with a strict subset in use. Rhythm comes from the
  rules and the grid, not from wide gaps.
- **Radii** — small and consistent. `--radius-sm: 2px`, `--radius-md: 4px`. Nothing
  is a pill. A drawing does not have rounded corners.
- **Rules** — hairlines are `1px` at `--rule` and they are structural. Tables,
  spec blocks and card edges use rules where a lifestyle site would use shadow.
  **Shadows are reserved for genuinely floating surfaces only** — dialog, sheet,
  toast, dropdown. A card does not float.
- **Motion** — `--duration-fast: 120ms`, `--duration-base: 200ms`,
  `--ease-out: cubic-bezier(0.2, 0, 0, 1)`. Everything respects
  `prefers-reduced-motion`.

## 6. Layout

A visible grid is part of the vernacular. Listings sit on a 12-column grid with
hairline column rules that stay faintly visible at desktop widths. Product detail
is a two-column spec layout: media left, specification block right, set as a
definition list with hairline separators — dimensions, materials, finish, lead
time, care — not as prose paragraphs.

Material swatches are first-class UI, not colour chips in a dropdown: a labelled
square with the material name in mono beneath it, selected state marked by a
double rule rather than a glow.

## 7. Quality floor — unannounced, non-negotiable

- Responsive down to 360px. Test at 360, 768, 1440.
- Visible keyboard focus on every interactive element, drawn as a 2px accent
  outline with a 2px offset. Never `outline: none` without a replacement.
- `prefers-reduced-motion` respected everywhere, including the signature.
- AA contrast in light and dark. Verify, do not assume.
- Every media slot has a fixed aspect ratio and a blur placeholder. Zero CLS.
- No layout shift when the dimension annotations appear.

## 8. Copy

Active voice, sentence case, one job per label.

- "Place order" produces "Order placed."
- Empty states are invitations: "No orders yet. When you place one, it will show
  up here with its full timeline."
- Errors say what to do next: "That email and password do not match. Check them,
  or reset your password."
- Numbers are stated plainly, in mono: "Ready in 14 days", not "Ships soon".
- Never apologise for the process. "We will call you within a day to confirm
  before production starts" is a step, not an excuse.

## 9. Self-critique before declaring done

Screenshot `/styleguide` at 360px and 1440px, in light and dark. Then:

1. Could this be any other furniture site? If yes, the signature is not doing its
   job.
2. Is the mono rule applied consistently, or has a number leaked into the sans?
3. Is there more than one bold idea competing on screen?
4. **Remove one decoration you like.** Say which one in the handoff.
