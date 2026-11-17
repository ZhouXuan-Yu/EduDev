"""Source-preserving PDF export through the existing managed LibreOffice."""
import base64
import hashlib
import json
from pathlib import Path
import sys
import threading
from word_office_worker import office_document, prop, watch_parent

SCHEMA = 'xiaozhi.word-pages.v1'


def main():
    raw = sys.stdin.buffer.readline(72 * 1024 * 1024 + 1)
    if len(raw) > 72 * 1024 * 1024:
        raise ValueError('too_large')
    request = json.loads(raw)
    if request['schemaVersion'] != SCHEMA:
        raise ValueError('invalid_input')
    threading.Thread(target=watch_parent, args=(request['parentPid'],), daemon=True).start()
    data = base64.b64decode(request['data'], validate=True)
    if not 0 < len(data) <= 50 * 1024 * 1024 or hashlib.sha256(data).hexdigest() != request['sourceSha256']:
        raise ValueError('source_changed')
    root = Path(request['jobRoot']).resolve()
    target = root / 'rendered.pdf'
    with office_document(data, root) as (document, _):
        document.storeToURL(target.as_uri(), (prop('FilterName', 'writer_pdf_Export'), prop('Overwrite', True)))
        pages = document.getRendererCount(document, ())
    size = target.stat().st_size
    if not 0 < size <= request['maxPdfBytes'] or not 0 < pages <= request['maxPages']:
        raise ValueError('too_large')
    digest = hashlib.sha256()
    with target.open('rb') as output:
        if not output.read(5) == b'%PDF-':
            raise ValueError('parse_failed')
        output.seek(0)
        for piece in iter(lambda: output.read(1024 * 1024), b''):
            digest.update(piece)
    print(json.dumps({'schemaVersion': SCHEMA, 'sourceSha256': request['sourceSha256'],
                      'sha256': digest.hexdigest(), 'bytes': size, 'pages': pages}), flush=True)


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        value = str(error)
        print(value if value in ['invalid_input', 'too_large', 'source_changed', 'unavailable', 'parse_failed'] else type(error).__name__, file=sys.stderr)
        sys.exit(1)
