"""Create one synthetic scan containing three separated incomplete option rows."""
import os
from pathlib import Path
import sys

from PIL import Image, ImageDraw, ImageFont

font_path = Path(os.environ.get("WINDIR", r"C:\Windows")) / "Fonts" / "msyh.ttc"
font = ImageFont.truetype(font_path, 42)
image = Image.new("RGB", (1700, 2100), "white")
draw = ImageDraw.Draw(image)

def text(x, y, value):
    draw.text((x, y), value, font=font, fill="black")

text(140, 150, "练习卷")
text(140, 300, "一、选择题")
for number, stem, known in (
    (1, "已知边长为三，求正方形的面积。", (9, 12)),
    (2, "若每盒装六支笔，求四盒的总数。", (22, 24)),
    (3, "一段公路长八千米，求它的一半。", (4, 5)),
    (4, "已知一个数的一半为十，求这个数。", (10, 20)),
):
    top = 450 + (number - 1) * 365
    text(140, top, f"{number}. {stem}")
    if number == 4:
        text(203, top + 116, "(A) 2")
        text(510, top + 116, "(B) 8")
    text(816, top + 116, f"(C) {known[0]}")
    text(1122, top + 116, f"(D) {known[1]}")

image.save(sys.argv[1], format="PDF", resolution=205, quality=95)
