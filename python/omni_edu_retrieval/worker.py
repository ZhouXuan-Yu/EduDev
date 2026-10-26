"""Offline BGE adapter; fixed local ONNX bytes, no pickle, downloads or user paths."""
import ctypes
import hashlib
import json
import os
from pathlib import Path
import socket
import sys
import threading
import time
import uuid

SCHEMA = "xiaozhi.embedding.v1"
MODEL_SHA = "15b717c382bcb518ba457b93ea6850ede7f4f1cd8937454aa06972366cd19bcc"
TOKENIZER_SHA = "48cea5d44424912a6fd1ea647bf4fe50b55ab8b1e5879c3275f80e339e8fae26"
IDENTITY = "bge-small-zh-v1.5.q8.cls-l2.window512-stride64.v1"


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


def emit(value):
    sys.stdout.write(json.dumps(value, ensure_ascii=True, allow_nan=False, separators=(",", ":")) + "\n")
    sys.stdout.flush()


def main():
    if len(sys.argv) != 3 or sys.argv[1] != "--parent-pid" or not sys.argv[2].isdigit():
        raise RuntimeError("invalid_input")
    threading.Thread(target=watch_parent, args=(int(sys.argv[2]),), daemon=True).start()
    import numpy as np
    import onnxruntime as ort
    from tokenizers import Tokenizer
    if ort.__version__ != "1.30.0" or np.__version__ != "2.5.3":
        raise RuntimeError("runtime_version")
    root = Path(getattr(sys, "_MEIPASS", Path(__file__).parent)) / "models"
    model = (root / "model_quantized.onnx").read_bytes()
    tokenizer_bytes = (root / "tokenizer.json").read_bytes()
    if hashlib.sha256(model).hexdigest() != MODEL_SHA or hashlib.sha256(tokenizer_bytes).hexdigest() != TOKENIZER_SHA:
        raise RuntimeError("model_integrity")
    tokenizer = Tokenizer.from_str(tokenizer_bytes.decode("utf-8"))
    tokenizer.enable_truncation(max_length=512, stride=64)
    tokenizer.enable_padding(pad_id=0, pad_token="[PAD]")
    options = ort.SessionOptions()
    options.intra_op_num_threads = 2
    options.inter_op_num_threads = 1
    session = ort.InferenceSession(model, sess_options=options, providers=["CPUExecutionProvider"])
    del model
    names = {item.name for item in session.get_inputs()}
    if not {"input_ids", "attention_mask"}.issubset(names):
        raise RuntimeError("model_contract")
    emit({"schemaVersion": SCHEMA, "kind": "ready", "identity": IDENTITY, "modelHash": MODEL_SHA, "tokenizerHash": TOKENIZER_SHA, "dimension": 512})
    while True:
        raw = sys.stdin.buffer.readline(262145)
        if not raw:
            return
        if len(raw) > 262144 or not raw.endswith(b"\n"):
            raise RuntimeError("message_too_large")
        request_id = ""
        try:
            request = json.loads(raw)
            request_id = request.get("requestId", "")
            if str(uuid.UUID(request_id)) != request_id:
                raise ValueError()
            if set(request) != {"schemaVersion", "requestId", "role", "texts"} or request["schemaVersion"] != SCHEMA or request["role"] not in ("query", "document"):
                raise ValueError()
            texts = request["texts"]
            if not isinstance(texts, list) or not 1 <= len(texts) <= (1 if request["role"] == "query" else 2):
                raise ValueError()
            if any(not isinstance(text, str) or not text.strip() or len(text.encode("utf-16-le")) > 24000 or "\x00" in text for text in texts):
                raise ValueError()
            values = []
            for text in texts:
                encoded_text = ("为这个句子生成表示以用于检索相关文章：" if request["role"] == "query" else "") + text
                encoding = tokenizer.encode(encoded_text)
                windows = [encoding] + encoding.overflowing
                if len(windows) > 32 or request["role"] == "query" and len(windows) != 1:
                    raise ValueError()
                results = []
                for batch_start in range(0, len(windows), 4):
                    batch = windows[batch_start:batch_start + 4]
                    longest = max(len(e.ids) for e in batch)
                    inputs = {
                        "input_ids": np.array([e.ids + [0] * (longest - len(e.ids)) for e in batch], dtype=np.int64),
                        "attention_mask": np.array([e.attention_mask + [0] * (longest - len(e.ids)) for e in batch], dtype=np.int64),
                        "token_type_ids": np.array([e.type_ids + [0] * (longest - len(e.ids)) for e in batch], dtype=np.int64),
                    }
                    output = session.run(None, {k: v for k, v in inputs.items() if k in names})[0]
                    vectors = output[:, 0, :] if output.ndim == 3 else output
                    if vectors.shape != (len(batch), 512):
                        raise RuntimeError("model_contract")
                    vectors = vectors.astype(np.float32)
                    norms = np.linalg.norm(vectors, axis=1, keepdims=True)
                    if not np.isfinite(vectors).all() or (norms < 1e-9).any():
                        raise RuntimeError("invalid_vector")
                    vectors /= norms
                    for e, vector in zip(batch, vectors):
                        offsets = [(a, b) for a, b in e.offsets if b > a]
                        a, b = (min(x[0] for x in offsets), max(x[1] for x in offsets)) if offsets else (0, len(text))
                        if request["role"] == "query":
                            a, b = 0, len(text)
                        start = len(text[:a].encode("utf-16-le")) // 2
                        end = len(text[:b].encode("utf-16-le")) // 2
                        results.append({"start": start, "end": end, "vector": [round(float(v), 8) for v in vector]})
                values.append(results)
            emit({"schemaVersion": SCHEMA, "kind": "result", "requestId": request_id, "identity": IDENTITY, "values": values})
        except (ValueError, KeyError, TypeError):
            emit({"schemaVersion": SCHEMA, "kind": "error", "requestId": request_id, "code": "invalid_input"})


if __name__ == "__main__":
    try:
        main()
    except Exception:
        sys.stderr.write("embedding_unavailable\n")
        sys.exit(2)
