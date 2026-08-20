"""
Instance the static TTFs that next/og needs.

Satori (behind ImageResponse) parses raw OpenType signatures: it rejects WOFF2
and wants one concrete weight rather than a variable axis. These two files are
used only by the opengraph-image routes and are not served to browsers.

Run after changing the display or mono face.
"""
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
import os

JOBS = [
    ("public/fonts/inter-tight-latin-var.woff2", 700, "src/assets/og-fonts/inter-tight-700.ttf"),
    ("public/fonts/jetbrains-mono-latin-var.woff2", 500, "src/assets/og-fonts/jetbrains-mono-500.ttf"),
]

os.makedirs("src/assets/og-fonts", exist_ok=True)
for src, weight, dest in JOBS:
    font = TTFont(src)          # fontTools reads woff2 given brotli
    font.flavor = None          # emit plain TTF
    instancer.instantiateVariableFont(font, {"wght": weight}, inplace=True).save(dest)
    print(f"{os.path.basename(dest)}  {os.path.getsize(dest)/1024:.0f} KB  (wght={weight})")
