"""Local document parsing worker for Omni-Edu.

Protocol: NDJSON over stdin/stdout, one UTF-8 JSON object per line.

Request (xiazhi.parse.request.v1):
  {"schemaVersion":"xiazhi.parse.request.v1","requestId":"r1","type":"engines"}
  {"schemaVersion":"xiazhi.parse.request.v1","requestId":"r2","type":"parse","filePath":"C:\\abs\\a.pdf","extension":".pdf"}

Result (xiazhi.parse.result.v1):
  engines -> {"ok":true,"engines":[{"name":"docling","available":true,"version":""}, ...]}
  parse   -> {"ok":true,"engine":"docling"|"pypdf"|"python-docx"|"python-pptx"|"plain-text",
              "text":"...","pages":[{"page":1,"text":"..."}],"title":""}
  error   -> {"ok":false,"code":"UNSUPPORTED_FORMAT"|"ENGINE_FAILED"|"FILE_READ_FAILED"|"EMPTY_CONTENT","message":"..."}

The host (Electron main) validates paths before sending them. This worker never
reads business data and never writes to the Omni-Edu SQLite.
"""
import json
import os
import sys
from pathlib import Path
from typing import Any, Callable, Optional

PARSE_SCHEMA = "xiazhi.parse.request.v1"
RESULT_SCHEMA = "xiazhi.parse.result.v1"
MAX_TEXT_CHARS = 4_000_000

# Engine order: the native libraries run first because they are deterministic,
# offline and fast enough for bulk 30-40GB imports; Docling (heavy torch models,
# first-run download) is the fallback for formats the native path cannot read,
# and can be forced to the front with OMNI_EDU_PARSE_ENGINE=docling.
DOCLING_FIRST = os.environ.get("OMNI_EDU_PARSE_ENGINE", "").strip().lower() == "docling"


def _engine_versions() -> dict:
    versions = {}
    try:
        import docling  # noqa: F401

        versions["docling"] = str(getattr(docling, "__version__", ""))
    except Exception:  # noqa: BLE001 - availability probe only
        versions["docling"] = ""
    for module_name, package in (("pypdf", "pypdf"), ("docx", "python-docx"), ("pptx", "python-pptx")):
        try:
            module = __import__(module_name)
            versions[package] = str(getattr(module, "__version__", ""))
        except Exception:  # noqa: BLE001 - availability probe only
            versions[package] = ""
    return versions


def _engines(request_id: str) -> dict:
    versions = _engine_versions()
    return {
        "schemaVersion": RESULT_SCHEMA,
        "requestId": request_id,
        "ok": True,
        "type": "engines",
        "engines": [
            {"name": name, "available": bool(version), "version": version}
            for name, version in versions.items()
        ],
    }


def _parse_plain_text(path: Path) -> tuple[str, list]:
    text = path.read_text(encoding="utf-8", errors="replace")
    return text, [{"page": 1, "text": text}]


def _parse_pdf(path: Path) -> tuple[str, list]:
    from pypdf import PdfReader

    reader = PdfReader(str(path))
    pages = []
    for index, page in enumerate(reader.pages, start=1):
        try:
            page_text = page.extract_text() or ""
        except Exception:  # noqa: BLE001 - per-page extraction must not kill the document
            page_text = ""
        pages.append({"page": index, "text": page_text})
    return "\n\n".join(page["text"] for page in pages), pages


def _parse_docx(path: Path) -> tuple[str, list]:
    import docx

    document = docx.Document(str(path))
    blocks = []
    for paragraph in document.paragraphs:
        text = (paragraph.text or "").strip()
        if text:
            blocks.append(text)
    for table in document.tables:
        for row in table.rows:
            cells = [cell.text.strip() for cell in row.cells if cell.text.strip()]
            if cells:
                blocks.append(" | ".join(cells))
    text = "\n".join(blocks)
    return text, [{"page": 1, "text": text}]


def _parse_pptx(path: Path) -> tuple[str, list]:
    from pptx import Presentation

    presentation = Presentation(str(path))
    pages = []
    for index, slide in enumerate(presentation.slides, start=1):
        blocks = []
        for shape in slide.shapes:
            if getattr(shape, "has_text_frame", False) and shape.text_frame is not None:
                text = (shape.text_frame.text or "").strip()
                if text:
                    blocks.append(text)
        pages.append({"page": index, "text": "\n".join(blocks)})
    return "\n\n".join(page["text"] for page in pages), pages


def _parse_docling(path: Path) -> tuple[str, list]:
    from docling.document_converter import DocumentConverter

    converter = DocumentConverter()
    result = converter.convert(str(path))
    markdown = result.document.export_to_markdown()
    return markdown, [{"page": 1, "text": markdown}]


NATIVE_ENGINES: dict[str, tuple[str, str, Callable[[Path], tuple[str, list]]]] = {
    ".pdf": ("pypdf", "pypdf", _parse_pdf),
    ".docx": ("python-docx", "python-docx", _parse_docx),
    ".doc": ("python-docx", "python-docx", _parse_docx),
    ".pptx": ("python-pptx", "python-pptx", _parse_pptx),
    ".txt": ("plain-text", "", _parse_plain_text),
    ".md": ("plain-text", "", _parse_plain_text),
    ".markdown": ("plain-text", "", _parse_plain_text),
    ".csv": ("plain-text", "", _parse_plain_text),
}

DOCLING_EXTENSIONS = {".pdf", ".docx", ".pptx", ".html", ".htm"}


def _run_parse(request_id: str, file_path: str, extension: str) -> dict:
    path = Path(file_path)
    if not path.exists() or not path.is_file():
        return {
            "schemaVersion": RESULT_SCHEMA,
            "requestId": request_id,
            "ok": False,
            "type": "parse",
            "code": "FILE_READ_FAILED",
            "message": "文件不存在或不可读",
        }
    ext = (extension or path.suffix).lower()
    versions = _engine_versions()
    docling_attempt = ("docling", versions["docling"], _parse_docling) if ext in DOCLING_EXTENSIONS and versions.get("docling") else None
    native_attempt = NATIVE_ENGINES.get(ext)
    attempts: list[tuple[str, str, Callable[[Path], tuple[str, list]]]] = []
    if DOCLING_FIRST and docling_attempt:
        attempts.append(docling_attempt)
    if native_attempt:
        attempts.append(native_attempt)
    if docling_attempt and not DOCLING_FIRST:
        attempts.append(docling_attempt)
    if not attempts:
        return {
            "schemaVersion": RESULT_SCHEMA,
            "requestId": request_id,
            "ok": False,
            "type": "parse",
            "code": "UNSUPPORTED_FORMAT",
            "message": f"暂不支持解析 {ext or '未知'} 格式",
        }
    failures = []
    for engine_name, engine_version, engine in attempts:
        try:
            text, pages = engine(path)
        except Exception as error:  # noqa: BLE001 - boundary diagnostics only
            failures.append(f"{engine_name}: {type(error).__name__}: {error}")
            continue
        if not text or not text.strip():
            failures.append(f"{engine_name}: 没有提取到文本")
            continue
        return {
            "schemaVersion": RESULT_SCHEMA,
            "requestId": request_id,
            "ok": True,
            "type": "parse",
            "engine": engine_name,
            "engineVersion": engine_version,
            "text": text[:MAX_TEXT_CHARS],
            "truncated": len(text) > MAX_TEXT_CHARS,
            "pages": [{"page": page["page"], "text": page["text"][:MAX_TEXT_CHARS]} for page in pages],
            "title": path.stem,
        }
    return {
        "schemaVersion": RESULT_SCHEMA,
        "requestId": request_id,
        "ok": False,
        "type": "parse",
        "code": "ENGINE_FAILED",
        "message": "；".join(failures)[:600] or "解析失败",
    }


def _handle(payload: dict) -> dict:
    request_id = str(payload.get("requestId", ""))
    if payload.get("schemaVersion") != PARSE_SCHEMA:
        return {
            "schemaVersion": RESULT_SCHEMA,
            "requestId": request_id,
            "ok": False,
            "type": "protocol",
            "code": "BAD_SCHEMA",
            "message": "unsupported request schema",
        }
    request_type = payload.get("type")
    if request_type == "engines":
        return _engines(request_id)
    if request_type == "parse":
        file_path = str(payload.get("filePath", "")).strip()
        if not file_path:
            return {
                "schemaVersion": RESULT_SCHEMA,
                "requestId": request_id,
                "ok": False,
                "type": "parse",
                "code": "FILE_READ_FAILED",
                "message": "filePath is required",
            }
        return _run_parse(request_id, file_path, str(payload.get("extension", "")))
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
