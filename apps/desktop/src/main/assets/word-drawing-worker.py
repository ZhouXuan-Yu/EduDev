"""Local geometry-only DOCX group exporter. The host owns the complete process tree."""
import base64
import hashlib
import io
import json
from pathlib import Path
import sys
import threading
import xml.etree.ElementTree as ET
import zipfile

import uno
from word_office_worker import office_document, prop, watch_parent

SCHEMA = 'xiaozhi.word-drawing-vector.v1'
MAX_IMAGE = 4 * 1024 * 1024
MAX_TOTAL = 64 * 1024 * 1024


def geometry_only(shape, budget):
    budget[0] += 1
    if budget[0] > 2048:
        return False
    supported = {'GroupShape', 'CustomShape', 'LineShape', 'EllipseShape', 'RectangleShape', 'PolyLineShape', 'PolyPolygonShape', 'ClosedBezierShape', 'OpenBezierShape', 'ConnectorShape'}
    kind = shape.ShapeType.rsplit('.', 1)[-1]
    if kind not in supported:
        return False
    try:
        if shape.String.strip():
            return False
    except AttributeError:
        pass
    if kind == 'GroupShape':
        return shape.Count > 0 and all(geometry_only(shape.getByIndex(index), budget) for index in range(shape.Count))
    return True


def main():
    raw = sys.stdin.buffer.readline(96 * 1024 * 1024 + 1)
    if len(raw) > 96 * 1024 * 1024:
        raise ValueError('too_large')
    request = json.loads(raw)
    if request['schemaVersion'] != SCHEMA:
        raise ValueError('invalid_input')
    if 'parentPid' in request:
        threading.Thread(target=watch_parent, args=(request['parentPid'],), daemon=True).start()
    data = base64.b64decode(request['data'], validate=True)
    source_sha = hashlib.sha256(data).hexdigest()
    if source_sha != request['sourceSha256'] or not 0 < len(data) <= 50 * 1024 * 1024 or not 0 < len(request['items']) <= 128:
        raise ValueError('invalid_input')
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        for item in request['items']:
            part_bytes = archive.read(item['part'])
            if part_bytes.startswith((b'\xff\xfe', b'\xfe\xff')):
                encoding = 'utf-16'
            elif part_bytes[:2] == b'<\0':
                encoding = 'utf-16le'
            elif part_bytes[:2] == b'\0<':
                encoding = 'utf-16be'
            else:
                encoding = 'utf-8-sig'
            part = part_bytes.decode(encoding)
            if hashlib.sha256(item['xml'].encode('utf-8')).hexdigest() != item['sha256'] or part.count(item['xml']) != 1:
                raise ValueError('source_changed')
    root = Path(request['jobRoot']).resolve()
    with office_document(data, root) as (document, context):
        page = document.getDrawPage()
        shapes = {}
        for index in range(page.Count):
            shape = page.getByIndex(index)
            shapes.setdefault(shape.Name, []).append(shape)
        items = []
        total = 0
        for index, source_item in enumerate(request['items']):
            result = {'inputSha256': source_item['sha256'], 'ok': False, 'error': 'render_failed'}
            found = shapes.get(source_item['name'], [])
            if len(found) != 1:
                result['error'] = 'ambiguous' if found else 'missing'
            elif found[0].ShapeType != 'com.sun.star.drawing.GroupShape' or not geometry_only(found[0], [0]):
                result['error'] = 'unsupported'
            else:
                shape = found[0]
                width = round(shape.Size.Width * 300 / 2540)
                height = round(shape.Size.Height * 300 / 2540)
                if width < 1 or height < 1 or width > 10000 or height > 10000 or width * height > 20000000:
                    result['error'] = 'too_large'
                else:
                    target = root / ('drawing-' + str(index) + '.svg')
                    exporter = context.ServiceManager.createInstanceWithContext('com.sun.star.drawing.GraphicExportFilter', context)
                    exporter.setSourceDocument(shape)
                    settings = uno.Any('[]com.sun.star.beans.PropertyValue', (
                        prop('Translucent', True), prop('PixelWidth', width), prop('PixelHeight', height),
                    ))
                    if exporter.filter((prop('URL', target.as_uri()), prop('MediaType', 'image/svg+xml'), prop('FilterData', settings))):
                        svg = target.read_bytes()
                        if len(svg) > MAX_IMAGE or total + len(svg) > MAX_TOTAL:
                            result['error'] = 'too_large'
                        elif ET.fromstring(svg).tag != '{http://www.w3.org/2000/svg}svg':
                            result['error'] = 'invalid_image'
                        else:
                            total += len(svg)
                            result = {'inputSha256': source_item['sha256'], 'ok': True,
                                      'svg': base64.b64encode(svg).decode('ascii'),
                                      'sha256': hashlib.sha256(svg).hexdigest(),
                                      'width': width, 'height': height}
            items.append(result)
        print(json.dumps({'schemaVersion': SCHEMA, 'sourceSha256': source_sha, 'items': items}), flush=True)


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        code = str(error) if str(error) in ('invalid_input', 'too_large', 'source_changed', 'unavailable', 'parse_failed') else type(error).__name__
        print(code, file=sys.stderr)
        sys.exit(1)
