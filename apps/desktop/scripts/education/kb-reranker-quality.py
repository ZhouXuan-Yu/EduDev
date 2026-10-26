"""Independent synthetic pilot: fixed BGE cosine baseline versus a fixed cross-encoder.
Not a natural teacher holdout or end-to-end import/latency benchmark.
"""
import hashlib
import json
import math
from pathlib import Path
import sys
import time

desktop = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(desktop / ".local-retrieval/build-deps"))
sys.path.insert(0, str(desktop.parents[1] / "python"))
from omni_edu_reranker.worker import Reranker
import numpy as np
import onnxruntime as ort
from tokenizers import Tokenizer

v2 = len(sys.argv) > 1 and sys.argv[1] == "v2"
fixture = Path(__file__).parent / ("fixtures/reranker-holdout-v2.json" if v2 else "fixtures/reranker-pilot-v1.json")
raw = fixture.read_bytes()
if hashlib.sha256(raw).hexdigest() != ("2e39324477c05ccb6fedd43b1a3758f96790513fa4a56e9ffdf7f12537178072" if v2 else "f8db72209b05c8ec588fd55ccd327bfff35005fcac74b38afabc2455b1d1c9e1"):
    raise RuntimeError("independent_fixture_changed")
cases = json.loads(raw.decode("utf-8-sig"))["cases"]
root = desktop / ".local-retrieval/model"
tokenizer = Tokenizer.from_str((root / "tokenizer.json").read_text("utf-8"))
tokenizer.enable_truncation(max_length=512, stride=64)
options = ort.SessionOptions()
options.intra_op_num_threads = 2
options.inter_op_num_threads = 1
session = ort.InferenceSession(str(root / "model_quantized.onnx"), sess_options=options, providers=["CPUExecutionProvider"])
names = {i.name for i in session.get_inputs()}


def embed(text):
    encoded = tokenizer.encode(text)
    result = []
    for encoding in [encoded] + encoded.overflowing:
        inputs = {"input_ids": np.array([encoding.ids], np.int64), "attention_mask": np.array([encoding.attention_mask], np.int64), "token_type_ids": np.array([encoding.type_ids], np.int64)}
        vector = session.run(None, {k: v for k, v in inputs.items() if k in names})[0][0, 0, :]
        result.append(vector / np.linalg.norm(vector))
    return result


lock = json.loads((desktop / "src/main/retrieval/reranker-assets.json").read_text("utf-8"))
ranker = Reranker(desktop / ".local-reranker/base", lock["modelHash"], lock["tokenizerHash"])
report = {"fixtureSha256": hashlib.sha256(raw).hexdigest(), "scope": __doc__, "cases": []}
dcg = lambda grades: sum((2 ** g - 1) / math.log2(i + 2) for i, g in enumerate(grades[:3]))
for case in cases:
    query = embed("为这个句子生成表示以用于检索相关文章：" + case["query"])[0]
    scores = [(item["id"], max(float(np.dot(query, v)) for v in embed(item["text"]))) for item in case["items"]]
    baseline = [i[0] for i in sorted(scores, key=lambda i: -i[1])]
    reordered = ranker.score(case["query"], [{"id": i["id"], "text": i["text"]} for i in case["items"]])
    order = [i["id"] for i in sorted(reordered["scores"], key=lambda i: -i["score"])]
    grades = {i["id"]: i["grade"] for i in case["items"]}
    ideal = dcg(sorted(grades.values(), reverse=True))
    ranks = {item: 1 / (61 + i) + 1 / (61 + order.index(item)) for i, item in enumerate(baseline)}
    fusion = sorted(baseline, key=lambda item: (-ranks[item], baseline.index(item)))
    report["cases"].append({"fusionNdcg3": dcg([grades[i] for i in fusion]) / ideal, "fusionTop1": grades[fusion[0]], "fusion": fusion,"id": case["id"], "baselineNdcg3": dcg([grades[i] for i in baseline]) / ideal, "rerankNdcg3": dcg([grades[i] for i in order]) / ideal, "baselineTop1": grades[baseline[0]], "rerankTop1": grades[order[0]], "elapsedMs": reordered["elapsedMs"], "baseline": baseline, "reranked": order})
for prefix in ["baseline", "rerank", "fusion"]:
    report[prefix + "MeanNdcg3"] = sum(c[prefix + "Ndcg3"] for c in report["cases"]) / len(cases)
    report[prefix + "Top1Best"] = sum(c[prefix + "Top1"] == 2 for c in report["cases"])
report["improvedCases"] = sum(c["rerankNdcg3"] > c["baselineNdcg3"] + 1e-8 for c in report["cases"])
report["regressedCases"] = sum(c["rerankNdcg3"] < c["baselineNdcg3"] - 1e-8 for c in report["cases"])
output = desktop / ("test-results/goal/kb-reranker-quality-v2.json" if v2 else "test-results/goal/kb-reranker-quality.json")
output.write_text(json.dumps(report, ensure_ascii=False, indent=2), "utf-8")
print(json.dumps({k: v for k, v in report.items() if k != "cases"}, ensure_ascii=False))
