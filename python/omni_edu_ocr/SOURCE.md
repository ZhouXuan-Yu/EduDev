# Local OCR runtime sources

Page blocks v1 (2026-11-01): RapidLayout 1.2.1 and PP-DocLayoutV3, both Apache-2.0, are reused in the existing worker host only for local PNG layout elements. Model SHA/bytes and source provenance are in licenses/PAGE_BLOCKS_NOTICE.md and page-blocks-runtime-manifest.json. This optional component has its own fixed .local-ocr/blocks-v1-dist/omni-edu-ocr directory; legacy OCR keeps its original file-v3-dist and compiled manifest. Build using scripts/release/build-page-blocks-runtime.mjs, requirements-page-blocks-windows.lock.txt and OMNI_EDU_BUILD_PYTHON. Production uses resources/page-blocks-runtime; the release script only bundles it with explicit OMNI_EDU_BUNDLE_PAGE_BLOCKS=1. No automatic production download. Runtime size and Windows installation/managed-download acceptance are separate.

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

File v3: worker.py + pdf_stream.py, fixed file-v3-dist runtime. Same locked Python/RapidOCR/PDFium dependencies and notices; no new model. Read-only Windows handle, source SHA, per-page NDJSON and durable ACK. Old resume-v2-dist retained for rollback. Build with scripts/release/build-pdf-runtime.mjs and approved OMNI_EDU_BUILD_PYTHON.

File v3: worker.py + pdf_stream.py, fixed file-v3-dist runtime. Same locked Python/RapidOCR/PDFium dependencies and notices; no new model. Read-only Windows handle, source SHA, per-page NDJSON and durable ACK. Old resume-v2-dist retained for rollback. Build with scripts/release/build-pdf-runtime.mjs and approved OMNI_EDU_BUILD_PYTHON.

File v3: worker.py + pdf_stream.py, fixed file-v3-dist runtime. Same locked Python/RapidOCR/PDFium dependencies and notices; no new model. Read-only Windows handle, source SHA, per-page NDJSON and durable ACK. Old resume-v2-dist retained for rollback. Build with scripts/release/build-pdf-runtime.mjs and approved OMNI_EDU_BUILD_PYTHON.

File v3: worker.py + pdf_stream.py, fixed file-v3-dist runtime. Same locked Python/RapidOCR/PDFium dependencies and notices; no new model. Read-only Windows handle, source SHA, per-page NDJSON and durable ACK. Old resume-v2-dist retained for rollback. Build with scripts/release/build-pdf-runtime.mjs and approved OMNI_EDU_BUILD_PYTHON.

Optional blocks runtime uses its own complete dependency lock; Pillow 13.0.0, certifi 2026.10.19, pip 26.2 and setuptools 84.1.0 replace inherited vulnerable versions only in this component. The build checks all installed lock entries and includes updated dependency notices; the legacy OCR lock/runtime remain unchanged.

## Word metafile rendering

The base OCR component now also pins Pillow 13.0.0, certifi 2026.10.19,
pip 26.2 and setuptools 84.1.0. Its complete dependency lock is checked by
scripts/release/build-pdf-runtime.mjs. Updated upstream notices are included
under runtime licenses/metafiles, in addition to the preserved original notices.
Pillow uses its HPND license. No additional runtime Python package is introduced.

metafiles.py reads the WMF/EMF physical frame with pinned Pillow, checks declared
font availability and bounded records, and uses the original Windows GDI+
renderer through metafile_gdiplus.py. GDI+ preserves legacy equation glyph
placement that Pillow's GDI playback overlaps. System.Drawing is the independent
rendering reference used in the preparation evidence. Windows supplies gdiplus.dll
and shlwapi.dll. These operating-system files are loaded from System32 and are
not redistributed. No PowerShell, Office automation or OLE execution is required.

The xiaozhi.local-metafile.v1 batch protocol is private to the existing managed
process. It uses the existing parent watchdog, cancellation and host output limits.
Rendering is 144dpi, at most 4096 pixels per side / 16 million pixels and 4MiB PNG
per item. Blank output and missing fonts are isolated as explicit item failures.
The engine is windows-gdiplus-pillow-13.0.0-144dpi.v1. Existing source snapshots
retain their original renderer identities and derived image hashes.

Builds stage a replacement before publishing, retain the prior component at
.local-ocr/file-v3-before-<timestamp>, and update the compiled application file
lock with worker/module hashes. Existing release resource preparation continues
to consume .local-ocr/file-v3-dist/omni-edu-ocr. Clean Windows installation and
cross-machine migration require their own product acceptance evidence.
