# Local OCR runtime sources

Recognition: original RapidOCR 3.9.2 / Apache-2.0, ONNX Runtime 1.30.0 / MIT. Adapter is worker.py. PP-OCRv6 detection/recognition and legacy angle models are bundled original artifacts; see licenses/MODEL_LICENSES.md with matching upstream hashes. Models are checked before use; no runtime download or cloud fallback.

Build: Python 3.12.14, PyInstaller 6.22.3 (GPL distribution exception). Exact build environment in requirements-windows.lock.txt. Frozen Windows onedir runtime is private .local-ocr/resume-v2-dist/omni-edu-ocr for development and must be shipped as resources/ocr-runtime in a packaged build. No Codex Python is needed by that executable.

Model notice snapshot commit: f65c7da00e72c19c258245e8e0e5f33af14488be. Original license URLs/hashes and complete output file lock: apps/desktop/src/main/xiaozhi-agent/ocr-runtime-manifest.json. 646 files / 279026886 bytes. Models total 31,749,509 bytes. This is runtime size, not installer size or installer acceptance.

Build command (from apps/desktop):

    test-results/xiaozhi-agent/rapidocr-env/Scripts/python.exe -m PyInstaller --onedir --name omni-edu-ocr --distpath .local-ocr/resume-v2-dist --workpath .local-ocr/resume-v2-work --specpath .local-ocr/resume-v2-spec --collect-all rapidocr --collect-all onnxruntime --collect-all pypdfium2 --collect-all pypdfium2_raw --copy-metadata pypdfium2 --copy-metadata rapidocr --copy-metadata onnxruntime --exclude-module tkinter --exclude-module pytest ../../python/omni_edu_ocr/worker.py
    node scripts/xiaozhi-agent/lock-ocr-runtime.mjs resume-v2

Do not regenerate the application lock at runtime or select arbitrary executable paths from renderer/model. Missing or modified runtime fails closed.

PDF rasterisation: original pypdfium2 5.14.0 / PDFium (BSD-3-Clause, Apache-2.0 and upstream dependency notices). Windows wheel 3,947,280 bytes; PDFium DLL 7,381,504 bytes. All upstream notices are included in runtime licenses/pypdfium2-5.14.0. PDF text is unreviewed OCR, not confirmed questions/answers. Previous image-only runtime is retained in .local-ocr/dist for old processes; new compiled host selects .local-ocr/resume-v2-dist.

Layout: source-backed 2400-pixel page raster plus original RapidOCR quadrilaterals, text and scores. These are unreviewed candidates, not complete questions/answers. Previous page-v1 runtime is retained for rollback.

PDF request v2 supports bounded completed-page checkpoints; final receipt/text identity is unchanged. Previous layout-v1 runtime remains for rollback.
