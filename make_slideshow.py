"""Build screenshots/slideshow.gif from screenshots/web/1..N.png (needs: pip install pillow)."""
from pathlib import Path
from PIL import Image

SRC = Path("screenshots/web")
OUT = Path("screenshots/slideshow.gif")
W, H = 960, 540          # 16:9 canvas
DURATION = 2200          # ms per frame
BG = (11, 16, 32)

files = sorted(SRC.glob("*.png"), key=lambda p: int(p.stem))
frames = []
for f in files:
    im = Image.open(f).convert("RGB")
    im.thumbnail((W, H), Image.LANCZOS)
    canvas = Image.new("RGB", (W, H), BG)
    canvas.paste(im, ((W - im.width) // 2, (H - im.height) // 2))
    frames.append(canvas.quantize(colors=128, method=Image.MEDIANCUT, dither=Image.NONE))

frames[0].save(OUT, save_all=True, append_images=frames[1:], duration=DURATION, loop=0, optimize=True)
print(f"{len(frames)} frames -> {OUT} ({OUT.stat().st_size / 1e6:.1f} MB)")
