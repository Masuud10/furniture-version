"""
Subset the self-hosted fonts to the glyphs this storefront actually renders.

The full latin subsets from Google Fonts total ~123 KB across three faces, all of
them preloaded and therefore on the critical path. Everything on this site is
English plus a small set of typographic punctuation, so the rest is dead weight
in front of first paint.

The variable weight axis is preserved — `next/font/local` declares a range.
"""
import subprocess, sys, os

# Basic latin, plus exactly the punctuation the copy and the UI use.
UNICODES = ",".join([
    "U+0020-007E",   # basic latin
    "U+00A0",        # nbsp
    "U+00A9",        # ©
    "U+00B0",        # °
    "U+00B7",        # ·
    "U+00D7",        # × (dimension separator)
    "U+2013-2014",   # – —
    "U+2018-2019",   # ' '
    "U+201C-201D",   # " "
    "U+2026",        # …
    "U+2192",        # →
    "U+2194",        # ↔ (dimension toggle)
    "U+2212",        # − (minus, price delta)
])

FONTS = [
    "public/fonts/inter-latin-var.woff2",
    "public/fonts/inter-tight-latin-var.woff2",
    "public/fonts/jetbrains-mono-latin-var.woff2",
]

for path in FONTS:
    before = os.path.getsize(path)
    out = path.replace(".woff2", ".subset.woff2")
    subprocess.run([
        sys.executable, "-m", "fontTools.subset", path,
        f"--unicodes={UNICODES}",
        "--layout-features=kern,liga,calt,tnum",
        "--flavor=woff2",
        "--output-file=" + out,
    ], check=True)
    after = os.path.getsize(out)
    print(f"{os.path.basename(path):38s} {before/1024:6.1f} KB -> {after/1024:6.1f} KB "
          f"({100 - after*100/before:.0f}% smaller)")
