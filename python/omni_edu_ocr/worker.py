"""Private, single-request local OCR adapter; recognition is original RapidOCR."""
import base64
import ctypes
import hashlib
import io
import json
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
    engine = RapidOCR(params=params)
    result = engine(data)
    texts = list(result.txts or [])
    if len(texts) > 2000 or len("\n".join(texts)) > 128000:
        raise ValueError("too_large")
    if not texts or not "\n".join(texts).strip():
        raise ValueError("empty")
    return {"schemaVersion": SCHEMA, "ok": True, "engine": IDENTITY, "text": "\n".join(texts),
            "lines": len(texts), "width": width, "height": height,
            "scores": [float(score) for score in (result.scores or [])]}

def main():
    # Original SDK logging goes to stderr; stdout contains only the versioned receipt.
    sys.stdout.reconfigure(encoding="utf-8")
    line = sys.stdin.buffer.readline(6000001)
    try:
        if len(line) > 6000000:
            raise ValueError("too_large")
        result = run(json.loads(line))
    except Exception as cause:
        code = str(cause) if str(cause) in {"invalid_input", "too_large", "configuration", "empty"} else "parse_failed"
        result = {"schemaVersion": SCHEMA, "ok": False, "error": code}
    print(json.dumps(result, ensure_ascii=True), flush=True)

if __name__ == "__main__":
    main()
