"""Bounded offline cross-encoder. Model bytes and tokenizer are fixed at build time."""
import ctypes
import hashlib
import json
import math
import os
from pathlib import Path
import re
import socket
import sys
import threading
import time

SCHEMA = "xiaozhi.rerank.v1"
# Selected after the local model comparison; immutable assets are locked by the build manifest.
IDENTITY = "bge-reranker-base.q8.pair512.window2.v1"
MODEL_SHA = "dd98f3e67837d23210a6b7550c08cced4f61845b940ac45be3565840a10f3244"
TOKENIZER_SHA = "48564c5c7d3fa64d85d95e65414a542385f88b0f128fd8d4163fd7a57f2be05c"


def deny(*_args, **_kwargs):
    raise RuntimeError("network_forbidden")


socket.socket.connect = deny
socket.socket.connect_ex = deny
socket.create_connection = deny
os.environ["HF_HUB_OFFLINE"] = "1"
os.environ["TOKENIZERS_PARALLELISM"] = "false"


def watch_parent(pid):
    kernel = ctypes.WinDLL("kernel32", use_last_error=True)
    kernel.OpenProcess.restype = ctypes.c_void_p
    kernel.OpenProcess.argtypes = [ctypes.c_uint32, ctypes.c_bool, ctypes.c_uint32]
    kernel.GetExitCodeProcess.argtypes = [ctypes.c_void_p, ctypes.POINTER(ctypes.c_uint32)]
    handle = kernel.OpenProcess(0x1000, False, pid)
    if not handle:
        os._exit(2)
    while True:
        code = ctypes.c_uint32()
        if not kernel.GetExitCodeProcess(handle, ctypes.byref(code)) or code.value != 259:
            os._exit(2)
        time.sleep(1)


def utf16_size(text):
    return len(text.encode("utf-16-le")) // 2


class Reranker:
    def __init__(self, root, model_hash, tokenizer_hash):
        import numpy as np
        import onnxruntime as ort
        from tokenizers import Tokenizer
        if ort.__version__ != "1.30.0" or np.__version__ != "2.5.3":
            raise RuntimeError("runtime_version")
        root = Path(root)
        model = (root / "model_quantized.onnx").read_bytes()
        tokenizer = (root / "tokenizer.json").read_bytes()
        if hashlib.sha256(model).hexdigest() != model_hash or hashlib.sha256(tokenizer).hexdigest() != tokenizer_hash:
            raise RuntimeError("model_integrity")
        self.tokenizer = Tokenizer.from_str(tokenizer.decode("utf-8"))
        self.tokenizer.enable_truncation(max_length=512, stride=64, strategy="only_second")
        options = ort.SessionOptions()
        options.intra_op_num_threads = 2
        options.inter_op_num_threads = 1
        self.session = ort.InferenceSession(model, sess_options=options, providers=["CPUExecutionProvider"])
        self.names = {v.name for v in self.session.get_inputs()}
        if not {"input_ids", "attention_mask"}.issubset(self.names):
            raise RuntimeError("model_contract")
        self.np = np

    def score(self, query, items):
        if not isinstance(query, str) or not query.strip() or utf16_size(query) > 240 or "\x00" in query:
            raise ValueError()
        if not isinstance(items, list) or not 1 <= len(items) <= 20:
            raise ValueError()
        ids = set()
        for item in items:
            if not isinstance(item, dict) or set(item) != {"id", "text"} or not isinstance(item["id"], str) or not re.fullmatch(r"[A-Za-z0-9_.:-]{1,128}", item["id"]) or item["id"] in ids:
                raise ValueError()
            text = item["text"]
            if not isinstance(text, str) or not text.strip() or utf16_size(text) > 1024 or "\x00" in text:
                raise ValueError()
            ids.add(item["id"])
        began = time.monotonic()
        results = []
        for item in items:
            encoded = self.tokenizer.encode(query, item["text"])
            windows = [encoded] + encoded.overflowing
            complete = len(windows) <= 2
            if len(windows) > 2:
                windows = [windows[0], windows[-1]]
            longest = max(len(e.ids) for e in windows)
            inputs = {
                "input_ids": self.np.array([e.ids + [1] * (longest - len(e.ids)) for e in windows], dtype=self.np.int64),
                "attention_mask": self.np.array([e.attention_mask + [0] * (longest - len(e.ids)) for e in windows], dtype=self.np.int64),
            }
            if "token_type_ids" in self.names:
                inputs["token_type_ids"] = self.np.zeros_like(inputs["input_ids"])
            logits = self.session.run(None, inputs)[0]
            if logits.size != len(windows) or not self.np.isfinite(logits).all():
                raise RuntimeError("model_contract")
            results.append({"id": item["id"], "score": float(logits.max()), "complete": complete})
        return {"scores": results, "elapsedMs": round((time.monotonic() - began) * 1000)}


def emit(value):
    sys.stdout.write(json.dumps(value, ensure_ascii=True, allow_nan=False, separators=(",", ":")) + "\n")
    sys.stdout.flush()


def main():
    if len(sys.argv) != 3 or sys.argv[1] != "--parent-pid" or not sys.argv[2].isdigit():
        raise RuntimeError("invalid_input")
    threading.Thread(target=watch_parent, args=(int(sys.argv[2]),), daemon=True).start()
    root = Path(getattr(sys, "_MEIPASS", Path(__file__).parent)) / "models"
    model = Reranker(root, MODEL_SHA, TOKENIZER_SHA)
    emit({"schemaVersion": SCHEMA, "kind": "ready", "identity": IDENTITY, "modelHash": MODEL_SHA, "tokenizerHash": TOKENIZER_SHA})
    while True:
        raw = sys.stdin.buffer.readline(131073)
        if not raw:
            return
        if len(raw) > 131072 or not raw.endswith(b"\n"):
            raise RuntimeError("protocol_limit")
        request_id = ""
        try:
            request = json.loads(raw)
            request_id = request.get("requestId", "")
            if not re.fullmatch(r"[a-f0-9-]{36}", request_id) or set(request) != {"schemaVersion", "requestId", "identity", "query", "items"} or request["schemaVersion"] != SCHEMA or request["identity"] != IDENTITY:
                raise ValueError()
            result = model.score(request["query"], request["items"])
            emit({"schemaVersion": SCHEMA, "kind": "result", "requestId": request_id, "identity": IDENTITY, **result})
        except (ValueError, KeyError, TypeError):
            emit({"schemaVersion": SCHEMA, "kind": "error", "requestId": request_id, "code": "invalid_input"})


if __name__ == "__main__":
    try:
        main()
    except Exception:
        sys.stderr.write("reranker_unavailable\n")
        sys.exit(2)
