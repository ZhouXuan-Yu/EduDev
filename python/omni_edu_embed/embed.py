"""Local embedding + LanceDB vector index worker for Omni-Edu.

Protocol: NDJSON over stdin/stdout, one UTF-8 JSON object per line.

Request (xiazhi.vector.request.v1):
  {"schemaVersion":"xiazhi.vector.request.v1","requestId":"r1","type":"status","indexPath":"C:\\abs\\index"}
  {"schemaVersion":"xiazhi.vector.request.v1","requestId":"r2","type":"index","indexPath":"...","items":[{"id":"chunk_1","text":"..."}]}
  {"schemaVersion":"xiazhi.vector.request.v1","requestId":"r3","type":"query","indexPath":"...","query":"斜率","limit":5}

Result (xiazhi.vector.result.v1):
  status -> {"ok":true,"modelAvailable":true,"model":"...","dims":512,"indexedCount":N}
  index  -> {"ok":true,"indexed":N,"model":"...","dims":512,"indexedCount":N}
  query  -> {"ok":true,"results":[{"id":"chunk_1","score":0.83}],"model":"...","dims":512}
  error  -> {"ok":false,"code":"MODEL_UNAVAILABLE"|"LANCE_UNAVAILABLE"|"INDEX_EMPTY"|"BAD_REQUEST"|"INTERNAL_ERROR","message":"..."}

The index is a rebuildable derivative: the host owns the chunk truth in SQLite,
this worker only stores vectors. No business data is read here.
"""
import json
import os
import sys
from typing import Any, Optional

VECTOR_SCHEMA = "xiazhi.vector.request.v1"
RESULT_SCHEMA = "xiazhi.vector.result.v1"
DEFAULT_MODEL = os.environ.get("OMNI_EDU_EMBED_MODEL", "BAAI/bge-small-zh-v1.5")
TABLE_NAME = "chunks"
MAX_BATCH = 512

# Known embedding dimensions so `status` can answer without loading torch weights
# (the Electron host would otherwise block/allocate far more than a probe needs).
MODEL_DIMS = {
    "BAAI/bge-small-zh-v1.5": 512,
    "BAAI/bge-base-zh-v1.5": 768,
    "BAAI/bge-large-zh-v1.5": 1024,
}

_model: Any = None
_model_error = ""
_model_dims = 0


def _load_model() -> Optional[Any]:
    global _model, _model_error, _model_dims
    if _model is not None:
        return _model
    if _model_error:
        return None
    try:
        from sentence_transformers import SentenceTransformer

        _model = SentenceTransformer(DEFAULT_MODEL)
        dims_getter = getattr(_model, "get_embedding_dimension", None) or getattr(_model, "get_sentence_embedding_dimension", None)
        _model_dims = int(dims_getter() or 0) if dims_getter else 0
        return _model
    except Exception as error:  # noqa: BLE001 - availability boundary
        _model_error = f"{type(error).__name__}: {error}"
        return None


def _connect(index_path: str) -> Any:
    import lancedb

    os.makedirs(index_path, exist_ok=True)
    return lancedb.connect(index_path)


def _table_count(db: Any) -> int:
    try:
        return int(db.open_table(TABLE_NAME).count_rows())
    except Exception:  # noqa: BLE001 - a missing table simply means "not indexed yet"
        return 0


def _modules_present() -> tuple[bool, str]:
    """Availability probe that never imports torch/lancedb."""
    import importlib.util

    missing = [name for name in ("sentence_transformers", "lancedb") if importlib.util.find_spec(name) is None]
    return (not missing, "缺少 Python 依赖：" + "、".join(missing) if missing else "")


def _status(request_id: str, index_path: str) -> dict:
    modules_ok, modules_error = _modules_present()
    indexed_count = 0
    if index_path:
        try:
            indexed_count = _table_count(_connect(index_path))
        except Exception:  # noqa: BLE001 - status must never fail the caller
            indexed_count = 0
    return {
        "schemaVersion": RESULT_SCHEMA,
        "requestId": request_id,
        "ok": True,
        "type": "status",
        "modelAvailable": modules_ok,
        "model": DEFAULT_MODEL,
        "dims": MODEL_DIMS.get(DEFAULT_MODEL, _model_dims),
        "modelError": modules_error or _model_error,
        "indexedCount": indexed_count,
    }


def _index(request_id: str, index_path: str, items: list) -> dict:
    if not index_path:
        return {"schemaVersion": RESULT_SCHEMA, "requestId": request_id, "ok": False, "type": "index", "code": "BAD_REQUEST", "message": "indexPath is required"}
    model = _load_model()
    if model is None:
        return {"schemaVersion": RESULT_SCHEMA, "requestId": request_id, "ok": False, "type": "index", "code": "MODEL_UNAVAILABLE", "message": _model_error or "embedding model unavailable"}
    try:
        import lancedb  # noqa: F401
    except Exception as error:  # noqa: BLE001 - availability boundary
        return {"schemaVersion": RESULT_SCHEMA, "requestId": request_id, "ok": False, "type": "index", "code": "LANCE_UNAVAILABLE", "message": f"{type(error).__name__}: {error}"}

    normalized = []
    for item in items[:MAX_BATCH]:
        if not isinstance(item, dict):
            continue
        item_id = str(item.get("id", "")).strip()
        text = str(item.get("text", "")).strip()
        if not item_id or not text:
            continue
        normalized.append({"id": item_id, "text": text[:4000]})
    if not normalized:
        return {"schemaVersion": RESULT_SCHEMA, "requestId": request_id, "ok": True, "type": "index", "indexed": 0, "model": DEFAULT_MODEL, "dims": _model_dims, "indexedCount": _table_count(_connect(index_path))}

    vectors = model.encode([entry["text"] for entry in normalized], normalize_embeddings=True)
    rows = [
        {"id": entry["id"], "vector": [float(value) for value in vectors[index]], "model": DEFAULT_MODEL}
        for index, entry in enumerate(normalized)
    ]
    db = _connect(index_path)
    ids = [row["id"] for row in rows]
    try:
        table = db.open_table(TABLE_NAME)
        id_list = ", ".join("'" + value.replace("'", "''") + "'" for value in ids)
        table.delete(f"id IN ({id_list})")
        table.add(rows)
    except Exception:  # noqa: BLE001 - table does not exist yet
        db.create_table(TABLE_NAME, data=rows)
    return {
        "schemaVersion": RESULT_SCHEMA,
        "requestId": request_id,
        "ok": True,
        "type": "index",
        "indexed": len(rows),
        "model": DEFAULT_MODEL,
        "dims": _model_dims,
        "indexedCount": _table_count(db),
    }


def _query(request_id: str, index_path: str, query: str, limit: int) -> dict:
    if not index_path or not query.strip():
        return {"schemaVersion": RESULT_SCHEMA, "requestId": request_id, "ok": False, "type": "query", "code": "BAD_REQUEST", "message": "indexPath and query are required"}
    model = _load_model()
    if model is None:
        return {"schemaVersion": RESULT_SCHEMA, "requestId": request_id, "ok": False, "type": "query", "code": "MODEL_UNAVAILABLE", "message": _model_error or "embedding model unavailable"}
    try:
        db = _connect(index_path)
        table = db.open_table(TABLE_NAME)
    except Exception as error:  # noqa: BLE001 - missing index degrades to keyword search upstream
        return {"schemaVersion": RESULT_SCHEMA, "requestId": request_id, "ok": False, "type": "query", "code": "INDEX_EMPTY", "message": f"{type(error).__name__}: {error}"}
    if _table_count(db) == 0:
        return {"schemaVersion": RESULT_SCHEMA, "requestId": request_id, "ok": False, "type": "query", "code": "INDEX_EMPTY", "message": "vector index is empty"}
    vector = model.encode([query[:2000]], normalize_embeddings=True)[0]
    bounded_limit = max(1, min(int(limit), 50))
    rows = table.search([float(value) for value in vector]).limit(bounded_limit).to_list()
    results = []
    for row in rows:
        distance = row.get("_distance")
        score = float(1.0 - distance) if isinstance(distance, (int, float)) else 0.0
        results.append({"id": str(row.get("id", "")), "score": round(score, 4)})
    return {
        "schemaVersion": RESULT_SCHEMA,
        "requestId": request_id,
        "ok": True,
        "type": "query",
        "results": results,
        "model": DEFAULT_MODEL,
        "dims": _model_dims,
    }


def _handle(payload: dict) -> dict:
    request_id = str(payload.get("requestId", ""))
    if payload.get("schemaVersion") != VECTOR_SCHEMA:
        return {"schemaVersion": RESULT_SCHEMA, "requestId": request_id, "ok": False, "type": "protocol", "code": "BAD_SCHEMA", "message": "unsupported request schema"}
    request_type = payload.get("type")
    index_path = str(payload.get("indexPath", "")).strip()
    if request_type == "status":
        return _status(request_id, index_path)
    if request_type == "index":
        items = payload.get("items")
        if not isinstance(items, list):
            return {"schemaVersion": RESULT_SCHEMA, "requestId": request_id, "ok": False, "type": "index", "code": "BAD_REQUEST", "message": "items must be a list"}
        return _index(request_id, index_path, items)
    if request_type == "query":
        return _query(request_id, index_path, str(payload.get("query", "")), int(payload.get("limit", 8) or 8))
    return {"schemaVersion": RESULT_SCHEMA, "requestId": request_id, "ok": False, "type": "protocol", "code": "BAD_TYPE", "message": f"unsupported request type: {request_type}"}


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
