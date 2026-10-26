# Local Chinese cross-encoder

This adapter runs a fixed offline ONNX cross-encoder with a versioned, bounded NDJSON protocol. It ranks a limited retrieved set; neither logits nor agreement prove correctness of a question or its answer.

Selected baseline: BAAI/bge-reranker-base (MIT), upstream revision `2cfc18c9415c912f9d8155881c133215df768a70`. ONNX conversion: Xenova/bge-reranker-base revision `280bcc27a84e0b898c251e06fddb25171bd9b101`. The model, tokenizer, upstream card, converter card and license bytes are pinned in `apps/desktop/src/main/retrieval/reranker-assets.json`.

The existing approved build-only Python 3.12.14 / ONNX Runtime 1.30.0 / NumPy 2.5.3 / tokenizers 0.21.4 / PyInstaller 6.22.3 environment is reused without installing into it. The Windows onedir runtime carries Python and dependency notices, a 279301077-byte q8 model, and a 17098079-byte tokenizer. Actual total bytes and file hashes are generated in the runtime manifest. The larger Apache-2.0 BGE-reranker-v2-m3 was evaluated separately and is not shipped by this baseline.

No PyTorch, arbitrary executable path, network access, dynamic model download, pickle, or remote model code is used at runtime. Raw files, question facts, archive eligibility and privacy are owned by the host. The process exits when its parent dies. Long bounded contexts can be incomplete; the host preserves unscored tails, reports coverage and revalidates selected source revisions after inference.
