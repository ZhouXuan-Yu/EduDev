"""Private, single-request local OCR adapter; recognition is original RapidOCR."""
import base64
import ctypes
from contextlib import closing
import hashlib
import io
import json
import math
import os
from pathlib import Path
import socket
import sys
import threading
import time

SCHEMA = "xiaozhi.local-ocr.v1"
MODELS = {
    "Det": ("PP-OCRv6_det_small.onnx", "090f04abcd9d9a7498bc4ebf677e4cb9bdce1fe4197ddb7e529f1ef44e1ff94f"),
    "Cls": ("ch_ppocr_mobile_v2.0_cls_mobile.onnx", "e47acedf663230f8863ff1ab0e64dd2d82b838fceb5957146dab185a89d6215c"),
    "Rec": ("PP-OCRv6_rec_small.onnx", "6f327246b50388f3c176ae304bd95767ea6dc0c9ae92153ef8cbe210b3c14884"),
}
IDENTITY = "rapidocr-3.9.2-ort-1.30.0-ppocrv6-small.v1"
PDF_SCHEMA = "xiaozhi.local-pdf-ocr.v1"
PDF_RESUME_SCHEMA = "xiaozhi.local-pdf-ocr.v2"
PDF_ENGINE = "pdfium-5.14.0-rapidocr-3.9.2.v1"
PAGE_SCHEMA = "xiaozhi.local-pdf-page.v1"
PAGE_ENGINE = "pdfium-5.14.0-page.v1"
LAYOUT_SCHEMA = "xiaozhi.local-pdf-layout.v1"
LAYOUT_ENGINE = "pdfium-5.14.0-rapidocr-3.9.2-layout.v1"

def no_network(*args, **kwargs):
    raise RuntimeError("network_forbidden")

socket.socket.connect = no_network
socket.socket.connect_ex = no_network
socket.create_connection = no_network

def watch_parent(pid):
    # The owned child must not continue OCR after a force-terminated Electron host.
    kernel = ctypes.WinDLL("kernel32", use_last_error=True)
    kernel.OpenProcess.restype = ctypes.c_void_p
    kernel.OpenProcess.argtypes = [ctypes.c_uint32, ctypes.c_bool, ctypes.c_uint32]
    kernel.GetExitCodeProcess.argtypes = [ctypes.c_void_p, ctypes.POINTER(ctypes.c_uint32)]
    kernel.CloseHandle.argtypes = [ctypes.c_void_p]
    handle = kernel.OpenProcess(0x1000, False, pid)
    if not handle:
        os._exit(2)
    try:
        while True:
            status = ctypes.c_uint32()
            if not kernel.GetExitCodeProcess(handle, ctypes.byref(status)) or status.value != 259:
                os._exit(2)
            time.sleep(0.25)
    finally:
        kernel.CloseHandle(handle)

def run(request):
    if not isinstance(request, dict) or set(request) != {"schemaVersion", "data", "parentPid"} or request["schemaVersion"] != SCHEMA:
        raise ValueError("invalid_input")
    if type(request["parentPid"]) is not int or request["parentPid"] <= 0:
        raise ValueError("invalid_input")
    threading.Thread(target=watch_parent, args=(request["parentPid"],), daemon=True).start()
    value = request["data"]
    if not isinstance(value, str) or len(value) > 5600000:
        raise ValueError("too_large")
    data = base64.b64decode(value, validate=True)
    if not data or len(data) > 4 * 1048576:
        raise ValueError("too_large")
    from PIL import Image
    Image.MAX_IMAGE_PIXELS = 16000000
    with Image.open(io.BytesIO(data)) as image:
        width, height = image.size
        if max(width, height) > 8192 or width * height > 16000000 or image.format not in ("PNG", "JPEG", "GIF", "WEBP"):
            raise ValueError("too_large")
        image.verify()
    engine = create_engine()
    result = engine(data)
    texts = list(result.txts or [])
    if len(texts) > 2000 or len("\n".join(texts)) > 128000:
        raise ValueError("too_large")
    if not texts or not "\n".join(texts).strip():
        raise ValueError("empty")
    return {"schemaVersion": SCHEMA, "ok": True, "engine": IDENTITY, "text": "\n".join(texts),
            "lines": len(texts), "width": width, "height": height,
            "scores": [float(score) for score in (result.scores or [])]}

def create_engine():
    import rapidocr
    from rapidocr import RapidOCR
    from importlib.metadata import version
    if version("rapidocr") != "3.9.2" or version("onnxruntime") != "1.30.0":
        raise ValueError("configuration")
    root = Path(rapidocr.__file__).resolve().parent
    params = {"Global.log_level": "error", "EngineConfig.onnxruntime.intra_op_num_threads": 2,
              "EngineConfig.onnxruntime.inter_op_num_threads": 1}
    for task, (name, sha) in MODELS.items():
        file = root / "models" / name
        if not file.is_file() or hashlib.sha256(file.read_bytes()).hexdigest() != sha:
            raise ValueError("configuration")
        params[task + ".model_path"] = str(file)
    return RapidOCR(params=params)

def run_pdf(request):
    resume = request.get("schemaVersion") == PDF_RESUME_SCHEMA
    expected = {"schemaVersion", "data", "parentPid"} | ({"resumePages"} if resume else set())
    if set(request) != expected or type(request["parentPid"]) is not int or request["parentPid"] <= 0:
        raise ValueError("invalid_input")
    threading.Thread(target=watch_parent, args=(request["parentPid"],), daemon=True).start()
    if not isinstance(request["data"], str) or len(request["data"]) > 69905068:
        raise ValueError("too_large")
    data = base64.b64decode(request["data"], validate=True)
    if not data or len(data) > 50 * 1048576 or not data.startswith(b"%PDF-"):
        raise ValueError("invalid_input")
    import pypdfium2 as pdfium
    from importlib.metadata import version
    if version("pypdfium2") != "5.14.0":
        raise ValueError("configuration")
    pages = request["resumePages"] if resume else []
    if not isinstance(pages, list) or len(pages) > 50:
        raise ValueError("invalid_input")
    total_bytes = 0
    for index, page in enumerate(pages):
        if not isinstance(page, dict) or set(page) != {"page", "text", "width", "height"} or type(page["page"]) is not int or page["page"] != index + 1 or not isinstance(page["text"], str) or len(page["text"]) > 128000:
            raise ValueError("invalid_input")
        if not all(type(page[n]) is int and 0 < page[n] <= 2401 for n in ("width", "height")) or page["width"] * page["height"] > 16000000:
            raise ValueError("invalid_input")
        total_bytes += len(page["text"].encode("utf-8"))
    if total_bytes > 1048576:
        raise ValueError("too_large")
    # No JavaScript/XFA build, external fetch, path selection or cloud OCR.
    with pdfium.PdfDocument(data) as document:
        total = len(document)
        if not total or total > 50:
            raise ValueError("too_large" if total else "empty")
        if len(pages) > total:
            raise ValueError("invalid_input")
        engine = create_engine() if len(pages) < total else None
        for index in range(len(pages), total):
            print(json.dumps({"schemaVersion": PDF_SCHEMA, "kind": "progress", "page": index + 1, "total": total}), flush=True)
            with closing(document[index]) as page:
                width, height = page.get_size()
                if width <= 0 or height <= 0:
                    raise ValueError("invalid_input")
                with closing(page.render(scale=2400 / max(width, height))) as bitmap:
                    pixels = bitmap.to_numpy()
                    if pixels.shape[0] * pixels.shape[1] > 16000000:
                        raise ValueError("too_large")
                    result = engine(pixels)
                    texts = list(result.txts or [])
                    text = "\n".join(texts)
                    if len(texts) > 2000 or len(text) > 128000:
                        raise ValueError("too_large")
                    total_bytes += len(text.encode("utf-8"))
                    if total_bytes > 1048576:
                        raise ValueError("too_large")
                    pages.append({"page": index + 1, "text": text, "width": bitmap.width, "height": bitmap.height})
                    if resume:
                        print(json.dumps({"schemaVersion": PDF_RESUME_SCHEMA, "kind": "completed", "total": total, "result": pages[-1]}, ensure_ascii=True), flush=True)
        if not any(page["text"].strip() for page in pages):
            raise ValueError("empty")
    return {"schemaVersion": PDF_SCHEMA, "ok": True, "engine": PDF_ENGINE, "pages": pages}

def run_pdf_page(request):
    if set(request) != {"schemaVersion", "data", "parentPid", "page", "box"} or request["schemaVersion"] != PAGE_SCHEMA:
        raise ValueError("invalid_input")
    if type(request["parentPid"]) is not int or request["parentPid"] <= 0 or type(request["page"]) is not int or not 1 <= request["page"] <= 50:
        raise ValueError("invalid_input")
    box = request["box"]
    if not isinstance(box, list) or len(box) != 4 or not all(type(n) in (int, float) and math.isfinite(n) and 0 <= n <= 1 for n in box) or not (box[0] < box[2] and box[1] < box[3]):
        raise ValueError("invalid_input")
    threading.Thread(target=watch_parent, args=(request["parentPid"],), daemon=True).start()
    if not isinstance(request["data"], str) or len(request["data"]) > 69905068:
        raise ValueError("too_large")
    data = base64.b64decode(request["data"], validate=True)
    if not data or len(data) > 50 * 1048576 or not data.startswith(b"%PDF-"):
        raise ValueError("invalid_input")
    import pypdfium2 as pdfium
    from importlib.metadata import version
    if version("pypdfium2") != "5.14.0":
        raise ValueError("configuration")
    # One selected page, same bounded deterministic worker; no OCR/model invocation.
    with pdfium.PdfDocument(data) as document:
        total = len(document)
        if not total or total > 50:
            raise ValueError("too_large" if total else "empty")
        if request["page"] > total:
            raise ValueError("invalid_input")
        with closing(document[request["page"] - 1]) as page:
            width, height = page.get_size()
            if not all(math.isfinite(n) and n > 0 for n in (width, height)):
                raise ValueError("invalid_input")
            with closing(page.render(scale=2400 / max(width, height))) as bitmap:
                page_width, page_height = bitmap.width, bitmap.height
                if max(page_width, page_height) > 2401 or page_width * page_height > 16000000:
                    raise ValueError("too_large")
                # Coordinates refer to displayed intrinsic-rotation raster, top left.
                region = (math.floor(box[0] * page_width), math.floor(box[1] * page_height), math.ceil(box[2] * page_width), math.ceil(box[3] * page_height))
                with bitmap.to_pil() as image, image.crop(region) as crop:
                    buffer = io.BytesIO()
                    crop.save(buffer, format="PNG")
                    png = buffer.getvalue()
                    if len(png) > 4 * 1048576:
                        raise ValueError("too_large")
                    result = {"schemaVersion": PAGE_SCHEMA, "ok": True, "engine": PAGE_ENGINE,
                              "inputSha256": hashlib.sha256(data).hexdigest(), "page": request["page"], "total": total,
                              "box": box, "pageWidth": page_width, "pageHeight": page_height,
                              "width": crop.width, "height": crop.height, "png": base64.b64encode(png).decode("ascii"),
                              "sha256": hashlib.sha256(png).hexdigest()}
    return result

def run_pdf_layout(request):
    if set(request) != {"schemaVersion", "data", "parentPid", "page"} or request["schemaVersion"] != LAYOUT_SCHEMA:
        raise ValueError("invalid_input")
    # Reuse the existing source-backed raster/parent watcher, preserving intrinsic rotation.
    page = run_pdf_page({**request, "schemaVersion": PAGE_SCHEMA, "box": [0, 0, 1, 1]})
    engine = create_engine()
    result = engine(base64.b64decode(page["png"], validate=True))
    texts = list(result.txts or [])
    scores = list(result.scores or [])
    boxes = result.boxes.tolist() if result.boxes is not None else []
    if len(texts) > 2000 or len("".join(texts)) > 128000 or not len(texts) == len(boxes) == len(scores):
        raise ValueError("too_large")
    lines = []
    for text, score, box in zip(texts, scores, boxes):
        if not text.strip():
            continue
        if len(box) != 4 or any(len(point) != 2 or not all(math.isfinite(n) for n in point) for point in box):
            raise ValueError("parse_failed")
        lines.append({"id": "line-" + str(len(lines) + 1), "kind": "text", "needsReview": True,
                      "text": text, "score": float(score), "quad": box,
                      "normalizedQuad": [[x / page["width"], y / page["height"]] for x, y in box]})
    return {"schemaVersion": LAYOUT_SCHEMA, "ok": True, "engine": LAYOUT_ENGINE,
            "inputSha256": page["inputSha256"], "page": page["page"], "total": page["total"],
            "width": page["width"], "height": page["height"], "png": page["png"],
            "rasterSha256": page["sha256"], "lines": lines}

def main():
    # Original SDK logging goes to stderr; stdout contains only the versioned receipt.
    sys.stdout.reconfigure(encoding="utf-8")
    line = sys.stdin.buffer.readline(80000001)
    schema = SCHEMA
    try:
        if len(line) > 80000000:
            raise ValueError("too_large")
        request = json.loads(line)
        if isinstance(request, dict) and request.get("schemaVersion") == LAYOUT_SCHEMA:
            schema = LAYOUT_SCHEMA
            result = run_pdf_layout(request)
        elif isinstance(request, dict) and request.get("schemaVersion") == PAGE_SCHEMA:
            schema = PAGE_SCHEMA
            result = run_pdf_page(request)
        elif isinstance(request, dict) and request.get("schemaVersion") in (PDF_SCHEMA, PDF_RESUME_SCHEMA):
            schema = PDF_SCHEMA
            result = run_pdf(request)
        else:
            result = run(request)
    except Exception as cause:
        code = str(cause) if str(cause) in {"invalid_input", "too_large", "configuration", "empty"} else "parse_failed"
        result = {"schemaVersion": schema, "ok": False, "error": code}
    print(json.dumps(result, ensure_ascii=True), flush=True)

if __name__ == "__main__":
    main()
