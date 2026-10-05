"""One-shot protocol adapter. Runs unmodified pure DeepTutor source, no agent/store."""
import json
from pathlib import Path
import sys
import types

SCHEMA = "xiaozhi.education.quote.v1"
SEARCH_SCHEMA = "xiaozhi.education.search.v1"
MAX_INPUT = 32 * 1024 * 1024


def load_source():
    root = Path(__file__).resolve().parent / "vendor" / "deeptutor-reading"
    # Do not import the old vendored DeepTutor __init__ (or any installed runtime).
    for name in ("deeptutor", "deeptutor.reading"):
        module = types.ModuleType(name)
        module.__path__ = [str(root)]
        sys.modules[name] = module
    for short in ("models", "search"):
        name = "deeptutor.reading." + short
        source = root / (short + ".py")
        module = types.ModuleType(name)
        module.__file__ = str(source)
        sys.modules[name] = module
        # Compile the pinned source bytes directly: no mutable .pyc cache is
        # read or written beside vendored source or in the desktop build.
        exec(compile(source.read_bytes(), str(source), "exec"), module.__dict__)
    return sys.modules["deeptutor.reading.search"]


def main():
    request_id = ""
    schema = SCHEMA
    try:
        raw = sys.stdin.buffer.read(MAX_INPUT + 1)
        if len(raw) > MAX_INPUT:
            raise ValueError("bounded")
        request = json.loads(raw.decode("utf-8"))
        if not isinstance(request, dict):
            raise ValueError("invalid")
        if request.get("schemaVersion") == SEARCH_SCHEMA:
            schema = SEARCH_SCHEMA
        if request.get("schemaVersion") != schema or not isinstance(request.get("requestId"), str) or len(request["requestId"]) > 80:
            raise ValueError("invalid")
        request_id = request["requestId"]
        if schema == SEARCH_SCHEMA:
            if set(request) != {"schemaVersion", "requestId", "units", "query"}:
                raise ValueError("invalid")
            units, query = request["units"], request["query"]
            if not isinstance(query, str) or not 1 <= len(query.strip()) <= 128 or not isinstance(units, list) or len(units) > 20000:
                raise ValueError("invalid")
            size = 0
            pairs = []
            for index, unit in enumerate(units):
                if not isinstance(unit, str):
                    raise ValueError("invalid")
                size += len(unit.encode("utf-8"))
                if size > 8 * 1024 * 1024:
                    raise ValueError("invalid")
                pairs.append((index, unit))
            search = load_source()
            if not search.normalise(query):
                raise ValueError("invalid")
            result = {"schemaVersion": schema, "requestId": request_id, "ok": True, **search.search_units(pairs, query, limit=12).to_dict()}
            sys.stdout.write(json.dumps(result, ensure_ascii=False))
            sys.stdout.flush()
            return
        if set(request) != {"schemaVersion", "requestId", "text", "quote"} or len(raw) > 65536:
            raise ValueError("invalid")
        text, quote = request["text"], request["quote"]
        if not isinstance(text, str) or not isinstance(quote, str) or not 1 <= len(quote) <= 2000 or len(text) > 12000:
            raise ValueError("invalid")
        search = load_source()
        # Upstream locate_quote normalises punctuation. Empty normalised text
        # would match everywhere: reject that input at our protocol boundary.
        if not search.normalise(quote):
            raise ValueError("invalid")
        found = search.locate_quote(text, quote) >= 0
        mode = "exact" if quote.lower() in text.lower() else "normalised" if found else None
        result = {"schemaVersion": SCHEMA, "requestId": request["requestId"], "ok": True, "found": found, "mode": mode}
    except (ValueError, TypeError, UnicodeError):
        result = {"schemaVersion": schema, "requestId": request_id, "ok": False, "error": "invalid_input"}
    except Exception:
        result = {"schemaVersion": schema, "requestId": request_id, "ok": False, "error": "unavailable"}
    # Never return traceback, paths, the source text, or private inputs.
    sys.stdout.write(json.dumps(result, ensure_ascii=False))
    sys.stdout.flush()


if __name__ == "__main__":
    main()
