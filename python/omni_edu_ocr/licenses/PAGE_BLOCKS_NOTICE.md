# Local page layout component

RapidLayout 1.2.1, RapidAI, Apache-2.0. Original package and inference/postprocessing are reused without algorithm changes. Adapter: ../page_blocks.py.

Source tag commit: https://github.com/RapidAI/RapidLayout/tree/4cfe33f6ceb3deb7c3a0eb242fd8db57994a7ac4

Code license snapshot: RapidLayout-1.2.1-LICENSE.

PP-DocLayoutV3 model, PaddlePaddle, Apache-2.0 as declared by the model publisher at https://huggingface.co/PaddlePaddle/PP-DocLayoutV3 . License snapshot: PP-DocLayoutV3-LICENSE, from https://raw.githubusercontent.com/PaddlePaddle/PaddleOCR/main/LICENSE (2026-11-01).

ONNX conversion distributed by RapidAI at https://www.modelscope.cn/models/RapidAI/RapidLayout/resolve/v1.2.0/onnx/pp_doc_layout/pp_doc_layoutv3.onnx . Exact SHA256: 250dbad1dfb9e4983fab75e1bf5085cd56ec3f41d5c7d0f8623ec74856e7aa67, size 130502330 bytes. Upstream artifact is not modified; geometry is unreviewed and is not an educational correctness claim.

Only build tooling downloads the fixed artifact. Production inference has no network access and rejects a missing/changed model. The frozen runtime includes these notices, the existing OCR/PDFium notices and wheel metadata. This component reuses ONNX Runtime; no PyTorch, external Python installation or hosted parsing service is needed by the frozen Windows executable.
