"""Render a synthetic, image-only exam for the mixed catalogue desktop test."""
import os
from pathlib import Path
import sys

from PIL import Image, ImageDraw, ImageFont

target = Path(sys.argv[1])
target.parent.mkdir(parents=True, exist_ok=True)
font_file = Path(os.environ.get("WINDIR", r"C:\Windows")) / "Fonts" / "msyh.ttc"
title = ImageFont.truetype(font_file, 51)
body = ImageFont.truetype(font_file, 40)
image = Image.new("RGB", (1700, 2360), "white")
draw = ImageDraw.Draw(image)

def write(x, y, text, font=body):
    draw.text((x, y), text, font=font, fill="black")

write(147, 120, "2025年上海徐汇区九年级数学一模试卷", title)
write(147, 255, "一、解答题", title)
for x, rows in (
    (110, [
        "1. 已知水池长为八米，",
        "水池的宽为六米。",
        "求水池的占地面积。",
        "2. 已知正方体棱长为三，",
        "求它的体积并写出过程。",
    ]),
    (925, [
        "3. 已知操场跑道长为四百米，",
        "小明沿跑道跑了两圈。",
        "求小明一共跑了多少米。",
        "4. 已知长方形周长为二十，",
        "长为六，求长方形的宽。",
    ]),
):
    for text, y in zip(rows, [475, 556, 637, 850, 931]):
        write(x, y, text)
write(720, 2180, "第 1 页 共 1 页")
image.save(target, format="PDF", resolution=207, quality=95)
