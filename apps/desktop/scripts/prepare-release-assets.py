from pathlib import Path
from PIL import Image, ImageDraw

root = Path(__file__).resolve().parent.parent
build = root / "build"
build.mkdir(exist_ok=True)

size = 1024
image = Image.new("RGBA", (size, size), "#0b2f2a")
draw = ImageDraw.Draw(image)

# Soft inset field.
draw.rounded_rectangle((42, 42, 982, 982), radius=220, fill="#0f3b34")
draw.rounded_rectangle((90, 90, 934, 934), radius=190, outline="#b9f0d2", width=22)

# Open book silhouette.
left = [(218, 390), (474, 332), (474, 744), (218, 806)]
right = [(550, 332), (806, 390), (806, 806), (550, 744)]
draw.polygon(left, fill="#f7f1dd")
draw.polygon(right, fill="#e8e0c8")
draw.line([(512, 344), (512, 750)], fill="#0b2f2a", width=28)
for y in (462, 548, 634):
    draw.rounded_rectangle((262, y, 436, y + 22), radius=11, fill="#9eb9ac")
    draw.rounded_rectangle((588, y, 762, y + 22), radius=11, fill="#9eb9ac")

# Spark / insight mark.
draw.rounded_rectangle((734, 188, 862, 316), radius=44, fill="#f0b84a")
draw.polygon([(798, 212), (818, 260), (866, 278), (818, 296), (798, 344), (778, 296), (730, 278), (778, 260)], fill="#fff8e7")

png = build / "icon.png"
ico = build / "icon.ico"
image.save(png, "PNG", optimize=True)
image.save(ico, sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
print({"png": str(png), "ico": str(ico)})
