"""Local OCR worker for Omni-Edu.

Protocol: NDJSON over stdin/stdout, one UTF-8 JSON object per line.

Request (xiazhi.ocr.request.v1):
  {"schemaVersion":"xiazhi.ocr.request.v1","requestId":"r1","type":"health"}
  {"schemaVersion":"xiazhi.ocr.request.v1","requestId":"r2","type":"ocr","imagePath":"C:\\abs\\path.png"}

Result (xiazhi.ocr.result.v1):
  health -> {"ok":true,"modelAvailable":true,"modelVersion":"..."}
  ocr    -> {"ok":true,"lines":[{"text","confidence","bbox":[[x0,y0],[x1,y1],[x2,y2],[x3,y3]]}],"lowConfidenceCount":N}
  error  -> {"ok":false,"code":"MODELS_MISSING"|"IMAGE_READ_FAILED"|"INTERNAL_ERROR","message":"..."}

The host (Electron main) validates paths before sending them. This worker never
reads business data and never writes to the Omni-Edu SQLite.
"""
import json
import sys
from typing import Any, Optional

OCR_SCHEMA = "xiazhi.ocr.request.v1"
RESULT_SCHEMA = "xiazhi.ocr.result.v1"
LOW_CONFIDENCE_THRESHOLD = 0.7

_engine: Any = None
_model_version = ""
_load_error = ""


def _get_engine() -> Optional[Any]:
    global _engine, _model_version, _load_error
    if _engine is not None:
        return _engine
    if _load_error:
        return None
    try:
        import rapidocr
        from rapidocr import RapidOCR

        _engine = RapidOCR()
        _model_version = getattr(rapidocr, "__version__", "rapidocr")
        return _engine
    except Exception as error:  # noqa: BLE001 - boundary diagnostics only
        _load_error = f"{type(error).__name__}: {error}"
        return None


def _health(request_id: str) -> dict:
    engine = _get_engine()
    return {
        "schemaVersion": RESULT_SCHEMA,
        "requestId": request_id,
        "ok": engine is not None,
        "type": "health",
        "modelAvailable": engine is not None,
        "modelVersion": _model_version if engine is not None else "",
        "loadError": _load_error,
    }


def _run_ocr(request_id: str, image_path: str) -> dict:
    engine = _get_engine()
    if engine is None:
        return {
            "schemaVersion": RESULT_SCHEMA,
            "requestId": request_id,
            "ok": False,
            "type": "ocr",
            "code": "MODELS_MISSING",
            "message": _load_error or "OCR models are not available",
        }
    try:
        result = engine(image_path)
    except Exception as error:  # noqa: BLE001 - boundary diagnostics only
        return {
            "schemaVersion": RESULT_SCHEMA,
            "requestId": request_id,
            "ok": False,
            "type": "ocr",
            "code": "IMAGE_READ_FAILED",
            "message": f"{type(error).__name__}: {error}",
        }
    txts = list(getattr(result, "txts", None) or [])
    scores = getattr(result, "scores", None)
    boxes = getattr(result, "boxes", None)
    lines = []
    low_confidence_count = 0
    for index, text in enumerate(txts):
        try:
            confidence = float(scores[index]) if scores is not None and index < len(scores) else 1.0
            if confidence < LOW_CONFIDENCE_THRESHOLD:
                low_confidence_count += 1
            raw_box = boxes[index] if boxes is not None and index < len(boxes) else [[0, 0], [0, 0], [0, 0], [0, 0]]
            bbox = [[float(x), float(y)] for x, y in raw_box]
            lines.append({"text": str(text), "confidence": confidence, "bbox": bbox})
        except (TypeError, ValueError, IndexError):
            continue
    return {
        "schemaVersion": RESULT_SCHEMA,
        "requestId": request_id,
        "ok": True,
        "type": "ocr",
        "lines": lines,
        "lowConfidenceCount": low_confidence_count,
        "modelVersion": _model_version,
    }


def _handle(payload: dict) -> dict:
    request_id = str(payload.get("requestId", ""))
    if payload.get("schemaVersion") != OCR_SCHEMA:
        return {
            "schemaVersion": RESULT_SCHEMA,
            "requestId": request_id,
            "ok": False,
            "type": "protocol",
            "code": "BAD_SCHEMA",
            "message": "unsupported request schema",
        }
    request_type = payload.get("type")
    if request_type == "health":
        return _health(request_id)
    if request_type == "ocr":
        image_path = str(payload.get("imagePath", "")).strip()
        if not image_path:
            return {
                "schemaVersion": RESULT_SCHEMA,
                "requestId": request_id,
                "ok": False,
                "type": "ocr",
                "code": "BAD_REQUEST",
                "message": "imagePath is required",
            }
        return _run_ocr(request_id, image_path)
    return {
        "schemaVersion": RESULT_SCHEMA,
        "requestId": request_id,
        "ok": False,
        "type": "protocol",
        "code": "BAD_TYPE",
        "message": f"unsupported request type: {request_type}",
    }


def main() -> None:
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            payload = json.loads(line)
            if not isinstance(payload, dict):
                raise ValueError("request must be a JSON object")
            response = _handle(payload)
        except Exception as error:  # noqa: BLE001 - fail the line, keep the worker alive
            response = {
                "schemaVersion": RESULT_SCHEMA,
                "requestId": "",
                "ok": False,
                "type": "protocol",
                "code": "BAD_JSON",
                "message": f"{type(error).__name__}: {error}",
            }
        sys.stdout.write(json.dumps(response, ensure_ascii=False) + "\n")
        sys.stdout.flush()


if __name__ == "__main__":
    main()
