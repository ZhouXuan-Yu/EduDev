"""Own synthetic, valid PDF: long native text, mixed scan, blank, over-budget image, tail."""
import json
from pathlib import Path
import sys
import zlib
from PIL import Image, ImageDraw, ImageFont

target = Path(sys.argv[1])
target.parent.mkdir(parents=True, exist_ok=True)
objects = [b"", b"", b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"]
def add(data):
    objects.append(data)
    return len(objects)
def stream(data, extra=b""):
    return b"<< /Length " + str(len(data)).encode() + b" " + extra + b">>\nstream\n" + data + b"\nendstream"
def literal(text):
    return text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
image = Image.new("RGB", (1000, 700), "white")
draw = ImageDraw.Draw(image)
font = ImageFont.truetype("C:/Windows/Fonts/arial.ttf", 38)
for i, line in enumerate(["SCANNED BODY EVIDENCE", "Equation: 12 + 5 = 17", "The header is native text.", "This body is an embedded image."]):
    draw.text((40, 70 + i * 100), line, fill="black", font=font)
scan = add(stream(zlib.compress(image.tobytes()), b"/Type /XObject /Subtype /Image /Width 1000 /Height 700 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode "))
oversize = add(stream(zlib.compress(b"\x00"), b"/Type /XObject /Subtype /Image /Width 100000 /Height 100000 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode "))
pages = []
for number in range(1, 62):
    resources = b"/Font << /F1 3 0 R >>"
    if number == 2:
        content = b"BT /F1 12 Tf 30 760 Td (Native header with enough characters to fool text-only selection.) Tj ET\nq 500 0 0 350 50 350 cm /Scan Do Q"
        resources += b" /XObject << /Scan " + str(scan).encode() + b" 0 R >>"
    elif number == 3:
        content = b""
    elif number == 4:
        content = b"q 500 0 0 500 50 100 cm /Large Do Q"
        resources += b" /XObject << /Large " + str(oversize).encode() + b" 0 R >>"
    elif number == 61:
        content = b"BT /F1 24 Tf 40 700 Td (TAIL_EVIDENCE_61) Tj 0 -45 Td (Quadratic function vertex) Tj ET"
    else:
        lines = [f"Native algebra material page {number}, line {i}. The equality is preserved by the same operation on both sides. " + "Arithmetic context. " * 5 for i in range(140)]
        content = ("BT /F1 4 Tf 5 TL 30 750 Td\n" + "\n".join("(" + literal(line) + ") Tj T*" for line in lines) + "\nET").encode()
    contents = add(stream(content))
    page = add(b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << " + resources + b" >> /Contents " + str(contents).encode() + b" 0 R >>")
    pages.append(page)
objects[0] = b"<< /Type /Catalog /Pages 2 0 R >>"
objects[1] = b"<< /Type /Pages /Count 61 /Kids [" + b" ".join(str(p).encode() + b" 0 R" for p in pages) + b"] >>"
with target.open("wb") as file:
    file.write(b"%PDF-1.7\n%\xe2\xe3\xcf\xd3\n")
    offsets = [0]
    for index, body in enumerate(objects, 1):
        offsets.append(file.tell())
        file.write(str(index).encode() + b" 0 obj\n" + body + b"\nendobj\n")
    # Legal, unreferenced stream to exercise file-based reads beyond the old 50 MiB limit.
    padding_id = len(objects) + 1
    offsets.append(file.tell())
    file.write(str(padding_id).encode() + b" 0 obj\n<< /Length 54525952 >>\nstream\n")
    block = b"x" * 1048576
    for _ in range(52):
        file.write(block)
    file.write(b"\nendstream\nendobj\n")
    xref = file.tell()
    file.write(b"xref\n0 " + str(len(offsets)).encode() + b"\n0000000000 65535 f \n")
    for offset in offsets[1:]:
        file.write(f"{offset:010d} 00000 n \n".encode())
    file.write(b"trailer\n<< /Size " + str(len(offsets)).encode() + b" /Root 1 0 R >>\nstartxref\n" + str(xref).encode() + b"\n%%EOF\n")
print(json.dumps({"file": str(target), "bytes": target.stat().st_size, "pages": 61, "mixedPage": 2, "blankPage": 3, "overBudgetPage": 4, "tailPage": 61}))
