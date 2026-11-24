"""Local, image-only PP-FormulaNet worker. The desktop host pins the model files."""
from base64 import b64decode
from contextlib import redirect_stdout
from hashlib import sha256
from importlib.metadata import version
from io import BytesIO
import json
import socket
import sys


SCHEMA = "xiaozhi.local-formula-recognition.v1"


def no_network(*args, **kwargs):
    raise OSError("offline formula worker")


def candidate(request, model_dir):
    if set(request) != {"schemaVersion", "cropSha256", "png"} or request["schemaVersion"] != SCHEMA:
        raise ValueError("invalid request")
    raw = b64decode(request["png"], validate=True)
    if len(raw) > 1024 * 1024 or not raw.startswith(b"\x89PNG\r\n\x1a\n") or sha256(raw).hexdigest() != request["cropSha256"]:
        raise ValueError("invalid image")

    socket.create_connection = no_network
    socket.socket.connect = no_network
    socket.socket.connect_ex = no_network
    from PIL import Image, ImageOps

    image = Image.open(BytesIO(raw)).convert("RGB")
    if image.width * image.height > 420_000 or min(image.size) < 8:
        raise ValueError("invalid crop")
    if sum(image.convert("L").histogram()[:145]) < 24:
        return None
    if [version(name) for name in ("paddlepaddle", "paddleocr", "paddlex")] != ["3.0.0", "3.0.3", "3.0.2"]:
        raise RuntimeError("unsupported local runtime")
    from paddleocr import FormulaRecognition
    import numpy as np

    image = ImageOps.expand(image, border=12, fill="white")
    model = FormulaRecognition(model_name="PP-FormulaNet_plus-S", model_dir=model_dir, device="cpu",
                               cpu_threads=4, enable_mkldnn=False)
    [result] = list(model.predict(np.ascontiguousarray(np.asarray(image)[:, :, ::-1]), batch_size=1))
    return result["rec_formula"].strip()


def main():
    request = json.loads(sys.stdin.buffer.readline(1_500_000))
    with redirect_stdout(sys.stderr):
        reading = candidate(request, sys.argv[1])
    print(json.dumps({"schemaVersion": SCHEMA, "cropSha256": request["cropSha256"], "latex": reading}, ensure_ascii=True))


if __name__ == "__main__":
    main()
