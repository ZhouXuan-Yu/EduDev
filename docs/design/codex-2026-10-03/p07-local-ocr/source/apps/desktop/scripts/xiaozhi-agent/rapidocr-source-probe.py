"""Exact installed original SDK, same synthetic fixture as failed Windows OCR."""
import hashlib
import json
from pathlib import Path
import socket
import sys

def offline(*args, **kwargs):
    raise RuntimeError("OCR_NETWORK_FORBIDDEN")

socket.socket.connect = offline
socket.socket.connect_ex = offline
socket.create_connection = offline

import rapidocr
from rapidocr import RapidOCR
from importlib.metadata import version

root = Path(rapidocr.__file__).resolve().parent
names = {"Det": "PP-OCRv6_det_small.onnx", "Cls": "ch_ppocr_mobile_v2.0_cls_mobile.onnx", "Rec": "PP-OCRv6_rec_small.onnx"}
models = []
params = {"Global.log_level": "error", "EngineConfig.onnxruntime.intra_op_num_threads": 2, "EngineConfig.onnxruntime.inter_op_num_threads": 1}
for task, name in names.items():
    file = root / "models" / name
    data = file.read_bytes()
    models.append({"name": name, "size": len(data), "sha256": hashlib.sha256(data).hexdigest()})
    params[task + ".model_path"] = str(file)
engine = RapidOCR(params=params)
result = engine(Path(sys.argv[1]))
text = "\n".join(result.txts or [])
compact = "".join(text.split())
checks = {"chinese": "教师资料本地识别" in compact, "english": "OFFICE" in compact, "code": "731928" in compact, "duration": "37" in compact}
report = {"success": all(checks.values()), "checks": checks, "versions": {"rapidocr": version("rapidocr"), "onnxruntime": version("onnxruntime")}, "models": models, "lines": len(result.txts or []), "scores": list(result.scores or []), "offlineEnforced": True}
Path(sys.argv[2]).write_text(json.dumps(report, indent=2), encoding="utf8")
Path(sys.argv[2]).with_suffix(".private.txt").write_text(text, encoding="utf8")
print(json.dumps(report))
assert report["success"], "Actual original OCR content mismatch"
