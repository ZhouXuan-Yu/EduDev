# Local OCR runtime sources

Recognition: original RapidOCR 3.9.2 / Apache-2.0, ONNX Runtime 1.30.0 / MIT. Adapter is worker.py. PP-OCRv6 detection/recognition and legacy angle models are bundled original artifacts; see licenses/MODEL_LICENSES.md with matching upstream hashes. Models are checked before use; no runtime download or cloud fallback.

Build: Python 3.12.14, PyInstaller 6.22.3 (GPL distribution exception). Exact build environment in requirements-windows.lock.txt. Frozen Windows onedir runtime is private .local-ocr/dist/omni-edu-ocr for development and must be shipped as resources/ocr-runtime in a packaged build. No Codex Python is needed by that executable.

Model notice snapshot commit: f65c7da00e72c19c258245e8e0e5f33af14488be. Original license URLs/hashes and complete output file lock: apps/desktop/src/main/xiaozhi-agent/ocr-runtime-manifest.json. 576 files / 270805763 bytes. Models total 31,749,509 bytes. This is runtime size, not installer size or installer acceptance.

Build command (from apps/desktop):

    test-results/xiaozhi-agent/rapidocr-env/Scripts/python.exe -m PyInstaller --onedir --name omni-edu-ocr --distpath .local-ocr/dist --workpath .local-ocr/work --specpath .local-ocr/spec --collect-all rapidocr --collect-all onnxruntime --copy-metadata rapidocr --copy-metadata onnxruntime --exclude-module tkinter --exclude-module pytest ../../python/omni_edu_ocr/worker.py
    node scripts/xiaozhi-agent/lock-ocr-runtime.mjs

Do not regenerate the application lock at runtime or select arbitrary executable paths from renderer/model. Missing or modified runtime fails closed.
