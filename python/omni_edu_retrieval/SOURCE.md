# Offline embedding runtime

The host owns scheduling, SQLite facts, outbox, permissions, and Lance generations. This worker only runs fixed local BGE ONNX inference on CPU. No Agent loop, model download, raw file path input, pickle or network request is supported.

- BAAI/bge-small-zh-v1.5 base revision `7999e1d3359715c523056ef9478215996d62a620`, MIT.
- Xenova ONNX conversion revision `75c43b069aac4d136ba6bc1122f995fedcfd2781`, q8 model SHA `15b717c382bcb518ba457b93ea6850ede7f4f1cd8937454aa06972366cd19bcc`.
- Hugging Face tokenizers 0.21.4, Apache-2.0, fixed Windows ABI3 wheel.
- ONNX Runtime 1.30.0 MIT, NumPy 2.5.3 BSD-3-Clause, Python 3.12.14 PSF, PyInstaller 6.22.3 GPL with bootloader exception. Existing approved build interpreter is read-only; new wheel is unpacked under this worktree.
- CLS pooling and L2 normalization follow the BAAI model card. Query-only Chinese instruction, document windows 512 tokens with overlap 64. No silent tail truncation; over-budget input fails.

Primary sources checked 2026-10-24: https://huggingface.co/BAAI/bge-small-zh-v1.5 ; https://huggingface.co/Xenova/bge-small-zh-v1.5 ; https://pypi.org/project/tokenizers/0.21.4/ . Model/runtime manifests lock all shipped bytes.
