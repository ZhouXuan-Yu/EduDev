"""Versioned, parent-owned PDF file reader. Only bounded page receipts cross stdout."""
import ctypes
from contextlib import closing
import hashlib
import io
import json
import math
import os
import re
from collections import Counter
from pathlib import Path
import stat
import sys
import threading
import unicodedata

SCHEMA = "xiaozhi.local-pdf-file.v3"
ENGINE = "pdfium-5.14.0-rapidocr-3.9.2-file.v3"
MAX_PAGES = 10000
MAX_FILE = 16 * 1024**3
MAX_TEXT = 256 * 1024

def emit(request, kind, **fields):
    print(json.dumps({"schemaVersion": SCHEMA, "requestId": request["requestId"], "kind": kind, **fields}, ensure_ascii=False), flush=True)

def check_path(root, file):
    root, file = Path(root), Path(file)
    if not root.is_absolute() or not file.is_absolute() or file.parent != root:
        raise ValueError("invalid_input")
    for target in (root, file):
        info = target.lstat()
        if stat.S_ISLNK(info.st_mode) or getattr(info, "st_file_attributes", 0) & 0x400 or str(target.resolve()).lower() != str(target).lower():
            raise ValueError("missing")
    if not root.is_dir() or not stat.S_ISREG(file.stat().st_mode) or file.stat().st_nlink != 1:
        raise ValueError("missing")
    return file

def open_locked(file):
    # Keep the same Windows handle for hashing and PDFium; refuse concurrent writes/deletes.
    import msvcrt
    kernel = ctypes.WinDLL("kernel32", use_last_error=True)
    kernel.CreateFileW.argtypes = [ctypes.c_wchar_p, ctypes.c_uint32, ctypes.c_uint32, ctypes.c_void_p, ctypes.c_uint32, ctypes.c_uint32, ctypes.c_void_p]
    kernel.CreateFileW.restype = ctypes.c_void_p
    handle = kernel.CreateFileW(str(file), 0x80000000, 1, None, 3, 0x10000000, None)
    if handle in (None, ctypes.c_void_p(-1).value):
        raise ValueError("missing")
    try:
        descriptor = msvcrt.open_osfhandle(handle, os.O_RDONLY | os.O_BINARY)
    except Exception:
        kernel.CloseHandle(ctypes.c_void_p(handle))
        raise
    return os.fdopen(descriptor, "rb")

def identity(info):
    # Python 3.12 Windows path-stat and CRT fstat expose different ctime meanings.
    return info.st_dev, info.st_ino, info.st_size, info.st_mtime_ns, info.st_nlink

def normalized(text):
    return "".join(unicodedata.normalize("NFKC", text).lower().split())

def native_covered(native, ocr):
    expected = "".join(c for c in normalized(native) if c.isalnum())
    recognized = "".join(c for c in normalized(ocr) if c.isalnum())
    if len(expected) >= 3:
        grams = [expected[i:i+3] for i in range(len(expected)-2)]
        if sum(part in recognized for part in grams) / len(grams) < .95:
            return False
    elif expected and expected not in recognized:
        return False
    math_context = bool(re.search(r"\d|[=<>≤≥≠+−×÷^√∠△π]", native))
    pattern = r"\d+(?:\.\d+)?|[-=*/()<>≤≥≠+−×÷^√∠△π]" if math_context else r"\d+(?:\.\d+)?|[=<>≤≥≠+−×÷^√∠△π]"
    critical = lambda text: Counter(re.findall(pattern, normalized(text))) + Counter(c for c in text if c in "⁰¹²³⁴⁵⁶⁷⁸⁹₀₁₂₃₄₅₆₇₈₉")
    expected_tokens, recognized_tokens = critical(native), critical(ocr)
    return all(recognized_tokens[token] >= count for token, count in expected_tokens.items())

def bounded_text(text):
    text = text.replace("\x00", "").replace("\r\n", "\n").strip()
    if len(text.encode("utf-8")) > MAX_TEXT:
        raise ValueError("too_large")
    return text

def raster(page):
    width, height = page.get_size()
    if not all(math.isfinite(n) and n > 0 for n in (width, height)):
        raise ValueError("invalid_input")
    return page.render(scale=2400 / max(width, height))

def image_budget(page):
    import pypdfium2 as pdfium
    for index, item in enumerate(page.get_objects(max_depth=15)):
        if index >= 50000:
            raise ValueError("too_large")
        if item.type == pdfium.raw.FPDF_PAGEOBJ_IMAGE:
            size = item.get_px_size()
            if size[0] * size[1] > 64000000:
                raise ValueError("too_large")

def read_page(page, create_engine, engine_holder):
    import pypdfium2 as pdfium
    width, height = page.get_size()
    if not all(math.isfinite(n) and n > 0 for n in (width, height)):
        raise ValueError("invalid_input")
    with closing(page.get_textpage()) as textpage:
        if textpage.count_chars() > 262144:
            raise ValueError("too_large")
        native = bounded_text(textpage.get_text_range(errors="replace"))
        count = textpage.count_rects()
        native_boxes = [list(textpage.get_rect(i)) for i in range(min(count, 2000))]
    images, hidden, objects = [], False, 0
    for item in page.get_objects(max_depth=15):
        objects += 1
        if objects > 50000:
            raise ValueError("too_large")
        if item.type == pdfium.raw.FPDF_PAGEOBJ_IMAGE:
            pixels = item.get_px_size()
            if pixels[0] * pixels[1] > 64000000:
                raise ValueError("too_large")
            images.append(item.get_bounds())
        elif item.type == pdfium.raw.FPDF_PAGEOBJ_TEXT:
            hidden = hidden or pdfium.raw.FPDFTextObj_GetTextRenderMode(item.raw) in (3, 7)
        elif item.type == pdfium.raw.FPDF_PAGEOBJ_FORM:
            hidden = True
    image_area = min(1.0, sum(max(0, min(width, b[2]) - max(0, b[0])) * max(0, min(height, b[3]) - max(0, b[1])) for b in images) / (width * height))
    suspicious = hidden or "\ufffd" in native or len(native_boxes) == 0 and bool(native)
    use_ocr = bool(images) or suspicious or len(native.strip()) < 20 and objects > 0
    ocr = ""
    pixel_width, pixel_height = max(1, round(width * 2400 / max(width, height))), max(1, round(height * 2400 / max(width, height)))
    state, error, method = "complete", "", "native"
    if not native and objects == 0:
        state, method = "blank", "blank"
    elif use_ocr:
        if engine_holder[0] is None:
            engine_holder[0] = create_engine()
        with closing(raster(page)) as bitmap:
            pixels = bitmap.to_numpy()
            pixel_width, pixel_height = bitmap.width, bitmap.height
            if pixel_width * pixel_height > 16000000:
                raise ValueError("too_large")
            result = engine_holder[0](pixels)
            if len(result.txts or []) > 4000:
                raise ValueError("too_large")
            ocr = bounded_text("\n".join(result.txts or []))
        method = "ocr"
        if not ocr:
            state, error = "needs_review", "ocr_empty"
        elif native and not native_covered(native, ocr):
            state, error = "needs_review", "text_conflict"
    # One selected transcription, never concatenate overlapping native/OCR versions.
    selected = ocr if method == "ocr" and ocr else native
    return {"status": state, "error": error, "method": method, "text": selected, "nativeText": native, "ocrText": ocr,
            "width": pixel_width, "height": pixel_height, "imageArea": image_area, "nativeBoxes": native_boxes}

def preview(document, page_number, box, source):
    import base64
    with closing(document[page_number - 1]) as page:
        image_budget(page)
        return preview_image(page, document, page_number, box, source)

def preview_image(page, document, page_number, box, source):
    import base64
    with closing(raster(page)) as bitmap:
        image = bitmap.to_pil()
        try:
            page_width, page_height = image.size
            crop = (math.floor(box[0] * page_width), math.floor(box[1] * page_height), math.ceil(box[2] * page_width), math.ceil(box[3] * page_height))
            with image.crop(crop) as cut:
                data = io.BytesIO()
                cut.save(data, format="PNG")
                png = data.getvalue()
                if len(png) > 4 * 1048576:
                    raise ValueError("too_large")
                return {"schemaVersion": "xiaozhi.local-pdf-page.v1", "ok": True, "engine": "pdfium-5.14.0-page.v1", "inputSha256": source,
                        "page": page_number, "total": len(document), "box": box, "pageWidth": page_width, "pageHeight": page_height,
                        "width": cut.width, "height": cut.height, "png": base64.b64encode(png).decode("ascii"), "sha256": hashlib.sha256(png).hexdigest()}
        finally:
            image.close()

def run(request, create_engine, watch_parent):
    common = {"schemaVersion", "requestId", "parentPid", "root", "file", "inputSha256", "operation"}
    operation = request.get("operation")
    extra = {"skipPages"} if operation == "parse" else {"page", "box"} if operation == "preview" else {"page"} if operation == "layout" else set()
    if request.get("schemaVersion") != SCHEMA or operation not in ("parse", "preview", "layout") or set(request) != common | extra:
        raise ValueError("invalid_input")
    if type(request["parentPid"]) is not int or request["parentPid"] <= 0 or not isinstance(request["requestId"], str) or len(request["requestId"]) != 36:
        raise ValueError("invalid_input")
    if not isinstance(request["inputSha256"], str) or len(request["inputSha256"]) != 64:
        raise ValueError("invalid_input")
    threading.Thread(target=watch_parent, args=(request["parentPid"],), daemon=True).start()
    file = check_path(request["root"], request["file"])
    before = file.stat()
    if not 0 < before.st_size <= MAX_FILE:
        raise ValueError("too_large")
    import pypdfium2 as pdfium
    from importlib.metadata import version
    if version("pypdfium2") != "5.14.0":
        raise ValueError("configuration")
    with open_locked(file) as handle:
        opened = os.fstat(handle.fileno())
        if identity(before) != identity(opened):
            raise ValueError("source_changed")
        digest = hashlib.sha256()
        while True:
            block = handle.read(1024 * 1024)
            if not block:
                break
            digest.update(block)
        if digest.hexdigest() != request["inputSha256"]:
            raise ValueError("source_changed")
        handle.seek(0)
        if handle.read(5) != b"%PDF-":
            raise ValueError("invalid_input")
        handle.seek(0)
        with pdfium.PdfDocument(handle) as document:
            total = len(document)
            if not 0 < total <= MAX_PAGES:
                raise ValueError("too_large")
            if operation in ("preview", "layout"):
                number, box = request["page"], request.get("box", [0, 0, 1, 1])
                if type(number) is not int or not 1 <= number <= total or not isinstance(box, list) or len(box) != 4 or not all(type(n) in (int, float) and math.isfinite(n) and 0 <= n <= 1 for n in box) or not (box[0] < box[2] and box[1] < box[3]):
                    raise ValueError("invalid_input")
                receipt = preview(document, number, box, request["inputSha256"])
                if operation == "layout":
                    import base64
                    result = create_engine()(base64.b64decode(receipt["png"]))
                    texts, scores = list(result.txts or []), list(result.scores or [])
                    boxes = result.boxes.tolist() if result.boxes is not None else []
                    if not len(texts) == len(scores) == len(boxes) or len(texts) > 2000 or len("".join(texts)) > 128000:
                        raise ValueError("too_large")
                    lines = []
                    for text, score, points in zip(texts, scores, boxes):
                        if not text.strip():
                            continue
                        if len(points) != 4 or any(len(p) != 2 or any(not math.isfinite(n) for n in p) for p in points):
                            raise ValueError("parse_failed")
                        lines.append({"id": "line-" + str(len(lines) + 1), "kind": "text", "needsReview": True, "text": text, "score": float(score),
                                      "quad": points, "normalizedQuad": [[x / receipt["width"], y / receipt["height"]] for x, y in points]})
                    receipt = {"schemaVersion": "xiaozhi.local-pdf-layout.v1", "ok": True, "engine": "pdfium-5.14.0-rapidocr-3.9.2-layout.v1",
                               "inputSha256": request["inputSha256"], "page": number, "total": total, "width": receipt["width"], "height": receipt["height"],
                               "png": receipt["png"], "rasterSha256": receipt["sha256"], "lines": lines}
                    return {"schemaVersion": SCHEMA, "requestId": request["requestId"], "kind": "layout", "receipt": receipt}
                return {"schemaVersion": SCHEMA, "requestId": request["requestId"], "kind": "preview", "receipt": receipt}
            skip = request["skipPages"]
            if not isinstance(skip, list) or len(skip) > total or len(set(skip)) != len(skip) or any(type(p) is not int or not 1 <= p <= total for p in skip):
                raise ValueError("invalid_input")
            skipped, engine = set(skip), [None]
            emit(request, "manifest", inputSha256=request["inputSha256"], engine=ENGINE, total=total)
            for index in range(total):
                if index + 1 in skipped:
                    continue
                emit(request, "progress", page=index + 1, total=total)
                try:
                    with closing(document[index]) as page:
                        result = read_page(page, create_engine, engine)
                except Exception as cause:
                    code = str(cause) if str(cause) in ("too_large", "configuration", "invalid_input") else "page_failed"
                    result = {"status": "failed", "error": code, "method": "failed", "text": "", "nativeText": "", "ocrText": "", "width": 0, "height": 0, "imageArea": 0, "nativeBoxes": []}
                emit(request, "page", page=index + 1, total=total, result=result)
                ack = json.loads(sys.stdin.buffer.readline(257))
                if ack != {"requestId": request["requestId"], "page": index + 1, "ack": True}:
                    raise ValueError("invalid_ack")
            after_handle, after_path = os.fstat(handle.fileno()), file.stat()
            if identity(before) != identity(after_handle) or identity(before) != identity(after_path) or opened.st_ctime_ns != after_handle.st_ctime_ns or before.st_ctime_ns != after_path.st_ctime_ns:
                raise ValueError("source_changed")
            # Keep the read-only Windows handle locked through the host publication transaction.
            emit(request, "finished", inputSha256=request["inputSha256"], total=total)
            ack = json.loads(sys.stdin.buffer.readline(257))
            if ack != {"requestId": request["requestId"], "commit": True}:
                raise ValueError("invalid_ack")
    return {"schemaVersion": SCHEMA, "requestId": request["requestId"], "kind": "released", "inputSha256": request["inputSha256"], "total": total}
