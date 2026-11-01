"""Own deterministic fixtures for free attachment-host tests; no network or model."""
from pathlib import Path
import sys
from PIL import Image, ImageDraw, ImageFont
from pypdf import PdfReader, PdfWriter
from pypdf.generic import NameObject, DictionaryObject, DecodedStreamObject

target = Path(sys.argv[1])
source = Path(sys.argv[2])
target.mkdir(parents=True, exist_ok=True)
writer = PdfWriter()
writer.add_page(PdfReader(source).pages[0])
writer.encrypt("synthetic-attachment-test-only")
with (target / "encrypted.pdf").open("wb") as output:
    writer.write(output)
image = Image.new("RGB", (1000, 700), "white")
draw = ImageDraw.Draw(image)
font = ImageFont.truetype("C:/Windows/Fonts/arial.ttf", 45)
for index, line in enumerate(["SCANNED BUOYANCY DATA", "Weight is 3N", "Spring reading is 2N", "Check forces before motion"]):
    draw.text((40, 60 + index * 140), line, fill="black", font=font)
image.save(target / "scan.pdf", "PDF")
writer = PdfWriter()
writer.add_page(PdfReader(source).pages[0])
writer.add_page(PdfReader(target / "scan.pdf").pages[0])
with (target / "mixed.pdf").open("wb") as output:
    writer.write(output)
(target / "corrupt.pdf").write_bytes(b"%PDF-1.7\ncorrupted fixture\n")
writer = PdfWriter()
font = DictionaryObject({NameObject("/Type"): NameObject("/Font"), NameObject("/Subtype"): NameObject("/Type1"), NameObject("/BaseFont"): NameObject("/Helvetica")})
for number in range(3):
    page = writer.add_blank_page(width=612, height=792)
    lines = [f"Line {number * 40 + line}: Synthetic Student phone 18012345678. " + "native source evidence " * 8 for line in range(40)]
    content = DecodedStreamObject()
    content.set_data(("BT /F1 4 Tf 14 TL 25 760 Td\n" + "\n".join("(" + line + ") Tj T*" for line in lines) + "\nET").encode("ascii"))
    page[NameObject("/Resources")] = DictionaryObject({NameObject("/Font"): DictionaryObject({NameObject("/F1"): writer._add_object(font)})})
    page[NameObject("/Contents")] = writer._add_object(content)
with (target / "native-long.pdf").open("wb") as output:
    writer.write(output)
print("attachment-pdf-fixtures-ready")
