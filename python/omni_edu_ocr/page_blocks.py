"""Pinned RapidLayout adapter; only local PNGs, never network/model auto-downloads."""
import base64
import hashlib
import io
import math
from pathlib import Path

SCHEMA = "xiaozhi.local-page-blocks.v1"
ENGINE = "rapid-layout-1.2.1-pp-doclayoutv3-250dbad1.v1"
MODEL_SHA = "250dbad1dfb9e4983fab75e1bf5085cd56ec3f41d5c7d0f8623ec74856e7aa67"


def run(request, watch_parent):
    import threading
    if not isinstance(request, dict) or set(request) != {"schemaVersion", "data", "parentPid"} or request["schemaVersion"] != SCHEMA or type(request["parentPid"]) is not int or request["parentPid"] <= 0:
        raise ValueError("invalid_input")
    threading.Thread(target=watch_parent, args=(request["parentPid"],), daemon=True).start()
    if not isinstance(request["data"], str) or len(request["data"]) > 5592408:
        raise ValueError("too_large")
    data = base64.b64decode(request["data"], validate=True)
    if not data or len(data) > 4 * 1048576:
        raise ValueError("too_large")
    from PIL import Image
    Image.MAX_IMAGE_PIXELS = 2401 * 2401
    with Image.open(io.BytesIO(data)) as image:
        width, height = image.size
        if image.format != "PNG" or not 1 <= width <= 2401 or not 1 <= height <= 2401:
            raise ValueError("invalid_input")
        image.verify()
    from importlib.metadata import version
    if version("rapid-layout") != "1.2.1" or version("onnxruntime") != "1.30.0":
        raise ValueError("configuration")
    import rapid_layout
    from rapid_layout import RapidLayout
    model = Path(rapid_layout.__file__).resolve().parent / "models" / "pp_doc_layoutv3.onnx"
    # Explicit checked file path prevents the upstream convenience downloader.
    if not model.is_file() or model.stat().st_size != 130502330:
        raise ValueError("configuration")
    digest = hashlib.sha256()
    with model.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1048576), b""):
            digest.update(chunk)
    if digest.hexdigest() != MODEL_SHA:
        raise ValueError("configuration")
    engine = RapidLayout(model_type="pp_doc_layoutv3", model_dir_or_path=str(model), conf_thresh=.3,
                         engine_cfg={"intra_op_num_threads": 2, "inter_op_num_threads": 1})
    result = engine(data)
    boxes, kinds, scores = result.boxes, result.class_names, result.scores
    if boxes is None or kinds is None or scores is None or not len(boxes) == len(kinds) == len(scores) or len(boxes) > 256:
        raise ValueError("parse_failed")
    blocks = []
    for box, kind, score in zip(boxes, kinds, scores):
        if len(box) != 4 or not all(math.isfinite(float(x)) for x in box) or not math.isfinite(float(score)):
            raise ValueError("parse_failed")
        box = [float(x) for x in box]
        if not 0 <= box[0] < box[2] <= width or not 0 <= box[1] < box[3] <= height or box[2] - box[0] < 1 or box[3] - box[1] < 1:
            raise ValueError("parse_failed")
        blocks.append({"id": "block-" + str(len(blocks) + 1), "kind": str(kind), "score": float(score),
                       "box": [box[0] / width, box[1] / height, box[2] / width, box[3] / height], "needsReview": True})
    return {"schemaVersion": SCHEMA, "ok": True, "engine": ENGINE, "rasterSha256": hashlib.sha256(data).hexdigest(),
            "width": width, "height": height, "blocks": blocks}
