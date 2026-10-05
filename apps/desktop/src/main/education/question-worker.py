"""Exact upstream quiz helpers, isolated once; no model, database or agent loop."""
import ast
from enum import StrEnum
import hashlib
import json
from pathlib import Path
import re
import sys
import types
from typing import Any

SCHEMA = "xiaozhi.education.question-draft.v1"
REVISION = "f07029cfcf2c8dfccdb671cdfc343db8334f5741"
MAX_BYTES = 256 * 1024
CONSTANTS = {"_CHOICE_KEYS", "_FILL_IN_BLANK_TOKEN", "_CONCEPT_ANSWERS"}
METHODS = {"_parse_quiz_payload", "_normalize_quiz_payload", "_collect_quiz_issues"}


def unique_pairs(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("duplicate")
        result[key] = value
    return result


def nonfinite(_value):
    raise ValueError("nonfinite")


def load_helpers():
    root = Path(__file__).resolve().parent / "vendor" / "deeptutor-question"
    manifest = json.loads((root / "source-manifest.json").read_text(encoding="utf-8"), object_pairs_hook=unique_pairs)
    if manifest["schemaVersion"] != 1 or manifest["revision"] != REVISION or manifest["projection"] != {"enum": "QuestionType", "constants": ["_CHOICE_KEYS", "_FILL_IN_BLANK_TOKEN", "_CONCEPT_ANSWERS"], "methods": ["_parse_quiz_payload", "_normalize_quiz_payload", "_collect_quiz_issues"]}:
        raise RuntimeError("manifest")
    entries = {entry["destination"]: entry for entry in manifest["files"]}
    if len(manifest["files"]) != 2 or set(entries) != {"pipeline.py", "LICENSE"}:
        raise RuntimeError("files")
    sources = {}
    for name, entry in entries.items():
        raw = (root / name).read_bytes()
        if len(raw) != entry["bytes"] or hashlib.sha256(raw).hexdigest() != entry["sha256"]:
            raise RuntimeError("integrity")
        sources[name] = raw
    nodes = [ast.ImportFrom(module="__future__", names=[ast.alias(name="annotations")], level=0)]
    found = set()
    for node in ast.parse(sources["pipeline.py"]).body:
        name = node.target.id if isinstance(node, ast.AnnAssign) and isinstance(node.target, ast.Name) else node.targets[0].id if isinstance(node, ast.Assign) and len(node.targets) == 1 and isinstance(node.targets[0], ast.Name) else node.name if isinstance(node, ast.ClassDef) else ""
        if name in CONSTANTS or name == "QuestionType":
            nodes.append(node)
            found.add(name)
        elif name == "QuestionPipeline":
            methods = [item for item in node.body if isinstance(item, ast.FunctionDef) and item.name in METHODS]
            found.update(item.name for item in methods)
            # Class shell only. Original methods/decorators are retained byte-for-byte in AST.
            nodes.append(ast.ClassDef(name="QuestionPipeline", bases=[], keywords=[], body=methods, decorator_list=[]))
    if found != CONSTANTS | METHODS | {"QuestionType"}:
        raise RuntimeError("projection")
    strict_json = types.SimpleNamespace(loads=lambda text: json.loads(text, object_pairs_hook=unique_pairs, parse_constant=nonfinite), JSONDecodeError=json.JSONDecodeError, JSONDecoder=lambda: json.JSONDecoder(object_pairs_hook=unique_pairs, parse_constant=nonfinite))
    namespace = {"StrEnum": StrEnum, "Any": Any, "re": re, "json": strict_json}
    exec(compile(ast.fix_missing_locations(ast.Module(body=nodes, type_ignores=[])), str(root / "pipeline.py"), "exec"), namespace)
    return namespace["QuestionPipeline"], namespace["QuestionType"]


def text(value, maximum):
    if not isinstance(value, str) or len(value) > maximum or any(ord(c) < 32 and c not in "\t\r\n" for c in value):
        raise ValueError("text")


def normalize(request, helpers):
    if set(request) != {"schemaVersion", "requestId", "operation", "questionType", "raw"} or request["operation"] != "normalize":
        raise ValueError("shape")
    pipeline, question_types = helpers
    kind, raw = request["questionType"], request["raw"]
    if not isinstance(kind, str) or kind not in {t.value for t in question_types} or not isinstance(raw, str) or not 1 <= len(raw) <= 65536:
        raise ValueError("input")
    payload = pipeline._parse_quiz_payload(raw)
    if set(payload) - {"question_type", "question", "correct_answer", "explanation", "options"}:
        raise ValueError("fields")
    if "question_type" in payload and payload["question_type"] != kind:
        raise ValueError("type")
    for field, maximum in (("question", 12000), ("correct_answer", 8000), ("explanation", 12000)):
        if field in payload:
            text(payload[field], maximum)
    options = payload.get("options")
    if options is not None:
        if not isinstance(options, dict) or len(options) > 4 or (kind != "choice" and options):
            raise ValueError("options")
        keys = set()
        for key, value in options.items():
            canonical = key.strip().upper()
            if canonical not in {"A", "B", "C", "D"} or canonical in keys:
                raise ValueError("option keys")
            keys.add(canonical)
            text(value, 2000)
    template = types.SimpleNamespace(question_type=kind)
    normalized = pipeline._normalize_quiz_payload(template, payload)
    issues = pipeline._collect_quiz_issues(template, normalized)
    return {"question": {"questionType": kind, "stem": normalized["question"], "answer": normalized["correct_answer"], "analysis": normalized["explanation"], "options": normalized["options"]}, "issues": issues, "valid": not issues}


def main():
    request_id = ""
    try:
        raw = sys.stdin.buffer.read(MAX_BYTES + 1)
        if len(raw) > MAX_BYTES:
            raise ValueError("size")
        request = json.loads(raw.decode("utf-8"), object_pairs_hook=unique_pairs, parse_constant=nonfinite)
        if not isinstance(request, dict) or request.get("schemaVersion") != SCHEMA or not isinstance(request.get("requestId"), str) or not 1 <= len(request["requestId"]) <= 80:
            raise ValueError("request")
        request_id = request["requestId"]
        result = {"schemaVersion": SCHEMA, "requestId": request_id, "ok": True, **normalize(request, load_helpers())}
        output = json.dumps(result, ensure_ascii=False, allow_nan=False)
        if len(output.encode("utf-8")) > MAX_BYTES:
            raise ValueError("size")
    except (ValueError, TypeError, UnicodeError):
        output = json.dumps({"schemaVersion": SCHEMA, "requestId": request_id, "ok": False, "error": "invalid_input"})
    except Exception:
        output = json.dumps({"schemaVersion": SCHEMA, "requestId": request_id, "ok": False, "error": "unavailable"})
    sys.stdout.write(output)
    sys.stdout.flush()


if __name__ == "__main__":
    main()
