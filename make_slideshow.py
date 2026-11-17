"""Build screenshots/slideshow.gif from screenshots/web/1.png, 2.png, ...
Run from anywhere:  python make_slideshow.py     (needs: pip install pillow)
Automatically shrinks the GIF until it is under MAX_MB so GitHub loads it fast.
"""
import sys
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "screenshots" / "web"
OUT = ROOT / "screenshots" / "slideshow.gif"

DURATION = 2200            # ms per frame
MAX_MB = 4.5               # target size limit
BG = (11, 16, 32)
ATTEMPTS = [(960, 540, 128), (800, 450, 96), (640, 360, 64)]   # width, height, colors

files = sorted(
    (p for p in SRC.glob("*") if p.suffix.lower() in {".png", ".jpg", ".jpeg", ".webp"} and p.stem.isdigit()),
    key=lambda p: int(p.stem),
)
if not files:
    sys.exit(f"No numbered images found in {SRC}")


def build(w, h, colors):
    frames = []
    for f in files:
        im = Image.open(f).convert("RGB")
        im.thumbnail((w, h), Image.LANCZOS)
        canvas = Image.new("RGB", (w, h), BG)
        canvas.paste(im, ((w - im.width) // 2, (h - im.height) // 2))
        frames.append(canvas.quantize(colors=colors, method=0, dither=0))
    frames[0].save(OUT, save_all=True, append_images=frames[1:], duration=DURATION, loop=0, optimize=True)
    return len(frames), OUT.stat().st_size / 1e6


for w, h, c in ATTEMPTS:
    n, mb = build(w, h, c)
    print(f"{n} frames, {w}x{h}, {c} colors -> {mb:.1f} MB")
    if mb <= MAX_MB:
        break
print(f"Saved {OUT}")
