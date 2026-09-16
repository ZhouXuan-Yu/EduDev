"""Deterministic smoke for the local OCR worker.

Draws a fixture PNG with a real Chinese font, runs the worker protocol
in-process (health + ocr + error paths) and asserts recognition results.
Run: python ocr-smoke.py <output-dir>
"""
import json
import sys
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

from omni_edu_ocr.ocr import _handle

SAMPLE_TEXT = "一次函数斜率 求 y = 2x + 3 的斜率"
FONT_CANDIDATES = [
    "C:/Windows/Fonts/simhei.ttf",
    "C:/Windows/Fonts/msyh.ttc",
]


def main() -> int:
    output_dir = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(tempfile.mkdtemp(prefix="omni-edu-ocr-smoke-"))
    output_dir.mkdir(parents=True, exist_ok=True)

    font_path = next((candidate for candidate in FONT_CANDIDATES if Path(candidate).exists()), None)
    if not font_path:
        print(json.dumps({"ok": False, "reason": "no Chinese font available for the fixture"}, ensure_ascii=False))
        return 1
    font = ImageFont.truetype(font_path, 42)
    image = Image.new("RGB", (900, 140), "white")
    draw = ImageDraw.Draw(image)
    draw.text((20, 40), SAMPLE_TEXT, fill="black", font=font)
    image_path = output_dir / "ocr-fixture.png"
    image.save(image_path)

    health = _handle({"schemaVersion": "xiazhi.ocr.request.v1", "requestId": "health-1", "type": "health"})
    assert health["ok"] is True, f"health must report available models: {health}"
    assert health["modelAvailable"] is True, f"modelAvailable must be true: {health}"

    result = _handle({"schemaVersion": "xiazhi.ocr.request.v1", "requestId": "ocr-1", "type": "ocr", "imagePath": str(image_path)})
    assert result["ok"] is True, f"ocr must succeed: {result}"
    joined = "".join(line["text"] for line in result["lines"])
    assert "一次函数" in joined and "斜率" in joined, f"fixture text must be recognized: {joined!r}"
    assert all("bbox" in line and "confidence" in line for line in result["lines"]), "every line must carry bbox and confidence"
    assert result["lowConfidenceCount"] >= 0, "low confidence count must be reported"

    bad_schema = _handle({"schemaVersion": "wrong.v1", "requestId": "bad-1", "type": "health"})
    assert bad_schema["ok"] is False and bad_schema["code"] == "BAD_SCHEMA", f"bad schema must fail closed: {bad_schema}"

    missing_path = _handle({"schemaVersion": "xiazhi.ocr.request.v1", "requestId": "ocr-2", "type": "ocr", "imagePath": ""})
    assert missing_path["ok"] is False and missing_path["code"] == "BAD_REQUEST", f"empty imagePath must fail closed: {missing_path}"

    missing_file = _handle({"schemaVersion": "xiazhi.ocr.request.v1", "requestId": "ocr-3", "type": "ocr", "imagePath": str(output_dir / "no-such.png")})
    assert missing_file["ok"] is False and missing_file["code"] == "IMAGE_READ_FAILED", f"missing image must fail closed: {missing_file}"

    print(json.dumps({
        "ok": True,
        "recognizedLines": len(result["lines"]),
        "sampleText": joined[:60],
        "modelVersion": result.get("modelVersion", ""),
        "lowConfidenceCount": result["lowConfidenceCount"],
        "errorPathsFailClosed": True,
    }, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
