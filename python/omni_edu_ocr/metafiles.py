"""Bounded, local WMF/EMF rasterization using Pillow's original Windows handler."""
import base64
import ctypes
import hashlib
import io
import json
import math
import struct
import threading
from metafile_gdiplus import render as render_metafile

SCHEMA = "xiaozhi.local-metafile.v1"
ENGINE = "windows-gdiplus-pillow-13.0.0-144dpi.v1"
MAX_INPUT = 8 * 1048576


def requested_fonts(data):
    """Read font declarations only. Rendering remains in Pillow/Windows GDI."""
    fonts = set()
    if data[:4] == b"\xd7\xcd\xc6\x9a":
        offset = 22
    elif len(data) >= 88 and data[:4] == b"\x01\x00\x00\x00" and data[40:44] == b" EMF":
        offset = 0
        end = struct.unpack_from("<I", data, 48)[0]
        if end < 88 or end > len(data):
            raise ValueError("invalid_input")
        while offset < end:
            if offset + 8 > end:
                raise ValueError("invalid_input")
            kind, length = struct.unpack_from("<II", data, offset)
            if length < 8 or length % 4 or offset + length > end:
                raise ValueError("invalid_input")
            if kind == 82:
                if length < 104:
                    raise ValueError("invalid_input")
                face = data[offset + 40:offset + 104]
                stop = next((i for i in range(0, 64, 2) if face[i:i + 2] == b"\0\0"), 64)
                fonts.add(face[:stop].decode("utf-16-le"))
            if kind == 14:
                if offset + length != end:
                    raise ValueError("invalid_input")
                return fonts
            offset += length
        raise ValueError("invalid_input")
    else:
        offset = 0
    if len(data) < offset + 18:
        raise ValueError("invalid_input")
    kind, header_words, version = struct.unpack_from("<HHH", data, offset)
    if kind not in (1, 2) or header_words != 9 or version not in (0x100, 0x300):
        raise ValueError("invalid_input")
    end = offset + struct.unpack_from("<I", data, offset + 6)[0] * 2
    if end < offset + 18 or end > len(data):
        raise ValueError("invalid_input")
    offset += 18
    while offset < end:
        if offset + 6 > end:
            raise ValueError("invalid_input")
        words, function = struct.unpack_from("<IH", data, offset)
        length = words * 2
        if length < 6 or offset + length > end:
            raise ValueError("invalid_input")
        if function == 0x02FB:
            if length < 26:
                raise ValueError("invalid_input")
            # Legacy producers store a shorter, null-terminated face field.
            # Bound it by both the record and LOGFONT16's 32-byte maximum.
            face = data[offset + 24:offset + min(length, 56)]
            if b"\0" not in face and len(face) < 32:
                raise ValueError("invalid_input")
            fonts.add(face.split(b"\0", 1)[0].decode("mbcs"))
        if function == 0:
            if offset + length != end:
                raise ValueError("invalid_input")
            return fonts
        offset += length
    raise ValueError("invalid_input")


def fonts_available(fonts):
    if not fonts:
        return True
    gdi = ctypes.WinDLL("gdi32", use_last_error=True)
    gdi.CreateCompatibleDC.restype = ctypes.c_void_p
    gdi.CreateCompatibleDC.argtypes = [ctypes.c_void_p]
    gdi.CreateFontW.restype = ctypes.c_void_p
    gdi.CreateFontW.argtypes = [ctypes.c_int] * 5 + [ctypes.c_uint] * 8 + [ctypes.c_wchar_p]
    gdi.SelectObject.restype = ctypes.c_void_p
    gdi.SelectObject.argtypes = [ctypes.c_void_p, ctypes.c_void_p]
    gdi.GetTextFaceW.argtypes = [ctypes.c_void_p, ctypes.c_int, ctypes.c_wchar_p]
    gdi.DeleteObject.argtypes = [ctypes.c_void_p]
    gdi.DeleteDC.argtypes = [ctypes.c_void_p]
    dc = gdi.CreateCompatibleDC(None)
    if not dc:
        raise ValueError("parse_failed")
    try:
        for name in fonts:
            if not name:
                return False
            font = gdi.CreateFontW(24, 0, 0, 0, 400, 0, 0, 0, 1, 0, 0, 0, 0, name)
            if not font:
                return False
            previous = gdi.SelectObject(dc, font)
            try:
                face = ctypes.create_unicode_buffer(128)
                if not gdi.GetTextFaceW(dc, len(face), face) or face.value.casefold() != name.lstrip("@").casefold():
                    return False
            finally:
                gdi.SelectObject(dc, previous)
                gdi.DeleteObject(font)
        return True
    finally:
        gdi.DeleteDC(dc)


def rasterize(data):
    from PIL import Image, ImageChops
    if not fonts_available(requested_fonts(data)):
        raise ValueError("font_missing")
    with Image.open(io.BytesIO(data)) as image:
        if image.format != "WMF":
            raise ValueError("invalid_input")
        # Pillow's WMF plugin scales its natural bounding box from this dpi.
        dots = image._inch
        if len(dots) != 2 or any(not isinstance(n, (int, float)) or not math.isfinite(n) or n <= 0 for n in dots):
            raise ValueError("invalid_input")
        x0, y0, x1, y1 = image.info['wmf_bbox']
        width, height = (int(n * 144 / resolution) for n, resolution in zip((x1 - x0, y1 - y0), dots))
        if min(width, height) < 1 or max(width, height) > 4096 or width * height > 16000000:
            raise ValueError("too_large")
        # Pillow's GDI text playback overlaps legacy MathType glyphs. GDI+
        # preserves the text layout, matching the System.Drawing reference.
        with render_metafile(data, (width, height)) as rgb, Image.new("RGB", rgb.size, "white") as white:
            with ImageChops.difference(rgb, white) as difference:
                if difference.getbbox() is None:
                    raise ValueError("empty")
            output = io.BytesIO()
            rgb.save(output, format="PNG")
    png = output.getvalue()
    if len(png) > 4 * 1048576:
        raise ValueError("too_large")
    return {"ok": True, "sha256": hashlib.sha256(png).hexdigest(), "width": width, "height": height,
            "png": base64.b64encode(png).decode("ascii")}


def run(request, watch_parent):
    from PIL import __version__
    if __version__ != "13.0.0":
        raise ValueError("configuration")
    if set(request) != {"schemaVersion", "parentPid", "data"} or request["schemaVersion"] != SCHEMA or type(request["parentPid"]) is not int or request["parentPid"] <= 0:
        raise ValueError("invalid_input")
    threading.Thread(target=watch_parent, args=(request["parentPid"],), daemon=True).start()
    if not isinstance(request["data"], str) or len(request["data"]) > 16 * 1048576:
        raise ValueError("too_large")
    batch = json.loads(base64.b64decode(request["data"], validate=True))
    if not isinstance(batch, list) or not 1 <= len(batch) <= 16:
        raise ValueError("invalid_input")
    results, seen, total = [], set(), 0
    for item in batch:
        if not isinstance(item, dict) or set(item) != {"sha256", "data"} or not isinstance(item["data"], str):
            raise ValueError("invalid_input")
        data = base64.b64decode(item["data"], validate=True)
        digest = hashlib.sha256(data).hexdigest()
        total += len(data)
        if not data or total > MAX_INPUT or digest != item["sha256"] or digest in seen:
            raise ValueError("invalid_input")
        seen.add(digest)
        try:
            result = rasterize(data)
        except Exception as cause:
            code = str(cause)
            result = {"ok": False, "error": code if code in {"invalid_input", "too_large", "empty", "font_missing"} else "parse_failed"}
        results.append({"inputSha256": digest, **result})
    return {"schemaVersion": SCHEMA, "ok": True, "engine": ENGINE, "items": results}
