"""Deterministic smoke for the local embedding + LanceDB worker.

Runs the worker protocol in-process against a temp index directory.
Run: python vector-smoke.py <output-dir>
"""
import json
import sys
import tempfile
from pathlib import Path

from omni_edu_embed.embed import _handle

SCHEMA = "xiazhi.vector.request.v1"
DOCS = [
    {"id": "chunk_1", "text": "一次函数图像的斜率表示纵向变化量与横向变化量之比。"},
    {"id": "chunk_2", "text": "解一元二次方程可以使用配方法与公式法。"},
    {"id": "chunk_3", "text": "三角形内角和等于一百八十度。"},
]


def main() -> int:
    output_dir = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(tempfile.mkdtemp(prefix="omni-edu-vector-smoke-"))
    index_path = output_dir / "index"
    index_path.mkdir(parents=True, exist_ok=True)

    empty_status = _handle({"schemaVersion": SCHEMA, "requestId": "status-1", "type": "status", "indexPath": str(index_path)})
    assert empty_status["ok"] is True, f"status must succeed: {empty_status}"
    assert empty_status["modelAvailable"] is True, f"embedding model must be available: {empty_status}"
    assert empty_status["dims"] == 512, f"bge-small-zh must report 512 dims: {empty_status}"
    assert empty_status["indexedCount"] == 0, f"fresh index must be empty: {empty_status}"

    indexed = _handle({"schemaVersion": SCHEMA, "requestId": "index-1", "type": "index", "indexPath": str(index_path), "items": DOCS})
    assert indexed["ok"] is True, f"index must succeed: {indexed}"
    assert indexed["indexed"] == 3 and indexed["indexedCount"] == 3, f"all documents must be indexed: {indexed}"

    hit = _handle({"schemaVersion": SCHEMA, "requestId": "query-1", "type": "query", "indexPath": str(index_path), "query": "斜率是怎么定义的", "limit": 2})
    assert hit["ok"] is True, f"query must succeed: {hit}"
    assert len(hit["results"]) == 2, f"query must respect the limit: {hit}"
    assert hit["results"][0]["id"] == "chunk_1", f"semantic query must rank the slope chunk first: {hit}"
    assert all(-1.0 <= result["score"] <= 1.0 for result in hit["results"]), f"scores must stay in cosine range: {hit}"

    upserted = _handle({"schemaVersion": SCHEMA, "requestId": "index-2", "type": "index", "indexPath": str(index_path), "items": [{"id": "chunk_2", "text": "配方法与公式法是解一元二次方程的常用方法。"}]})
    assert upserted["indexed"] == 1 and upserted["indexedCount"] == 3, f"re-indexing an existing id must upsert instead of duplicating: {upserted}"

    empty_query = _handle({"schemaVersion": SCHEMA, "requestId": "query-2", "type": "query", "indexPath": str(index_path), "query": "   ", "limit": 2})
    assert empty_query["ok"] is False and empty_query["code"] == "BAD_REQUEST", f"blank query must fail closed: {empty_query}"

    missing_index = _handle({"schemaVersion": SCHEMA, "requestId": "query-3", "type": "query", "indexPath": str(output_dir / "no-index"), "query": "斜率", "limit": 2})
    assert missing_index["ok"] is False and missing_index["code"] in {"INDEX_EMPTY", "INTERNAL_ERROR"}, f"missing index must fail closed: {missing_index}"

    bad_schema = _handle({"schemaVersion": "wrong.v1", "requestId": "bad", "type": "status"})
    assert bad_schema["ok"] is False and bad_schema["code"] == "BAD_SCHEMA", f"bad schema must fail closed: {bad_schema}"

    print(json.dumps({
        "ok": True,
        "model": empty_status["model"],
        "dims": empty_status["dims"],
        "indexedCount": upserted["indexedCount"],
        "topHit": hit["results"][0]["id"],
        "topScore": hit["results"][0]["score"],
        "degradationPathsFailClosed": True,
    }, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
