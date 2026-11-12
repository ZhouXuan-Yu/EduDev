"""Local geometry-only DOCX group exporter. The host owns the complete process tree."""
import base64
import ctypes
import hashlib
import io
import json
import os
from pathlib import Path
import struct
import subprocess
import sys
import threading
import time
import uuid
import xml.etree.ElementTree as ET
import zipfile

import uno
from com.sun.star.beans import PropertyValue

SCHEMA = 'xiaozhi.word-drawing.v1'
MAX_IMAGE = 4 * 1024 * 1024
MAX_TOTAL = 64 * 1024 * 1024


def watch_parent(pid):
    """Use the existing OCR host-handle pattern, terminating our whole tree."""
    kernel = ctypes.WinDLL('kernel32', use_last_error=True)
    kernel.OpenProcess.restype = ctypes.c_void_p
    kernel.OpenProcess.argtypes = [ctypes.c_uint32, ctypes.c_bool, ctypes.c_uint32]
    kernel.GetExitCodeProcess.argtypes = [ctypes.c_void_p, ctypes.POINTER(ctypes.c_uint32)]
    kernel.CloseHandle.argtypes = [ctypes.c_void_p]
    handle = kernel.OpenProcess(0x1000, False, pid)
    if not handle:
        os._exit(2)
    try:
        while True:
            status = ctypes.c_uint32()
            if not kernel.GetExitCodeProcess(handle, ctypes.byref(status)) or status.value != 259:
                subprocess.run(['taskkill.exe', '/PID', str(os.getpid()), '/T', '/F'],
                               stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                               creationflags=subprocess.CREATE_NO_WINDOW, timeout=15)
                os._exit(2)
            time.sleep(.25)
    finally:
        kernel.CloseHandle(handle)


def prop(name, value):
    result = PropertyValue()
    result.Name = name
    result.Value = value
    return result


def sanitized_copy(data, target):
    """Remove external relationships from the process copy.
    Original XML/bytes remain untouched in the teacher archive.
    Embedded payloads retain package integrity. They are never activated by this
    exporter, which disables macros and updates and accesses geometry only.
    """
    with zipfile.ZipFile(io.BytesIO(data)) as source, zipfile.ZipFile(target, 'w', zipfile.ZIP_DEFLATED) as output:
        for item in source.infolist():
            name = item.filename
            content = source.read(item)
            if name.endswith('.rels'):
                relations = ET.fromstring(content)
                changed = False
                for relation in list(relations):
                    if relation.attrib.get('TargetMode') == 'External':
                        relations.remove(relation)
                        changed = True
                if changed:
                    ET.register_namespace('', 'http://schemas.openxmlformats.org/package/2006/relationships')
                    content = ET.tostring(relations, encoding='utf-8', xml_declaration=True)
            output.writestr(name, content)


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
    source = root / 'source.docx'
    sanitized_copy(data, source)
    pipe = 'xiaozhi_drawing_' + uuid.uuid4().hex
    profile = root / 'profile'
    program = Path(os.environ['XIAOZHI_OFFICE_PROGRAM'])
    child = subprocess.Popen([
        str(program / 'soffice.exe'), '-env:UserInstallation=' + profile.as_uri(),
        '--headless', '--norestore', '--nodefault', '--nofirststartwizard',
        '--accept=pipe,name=' + pipe + ';urp;StarOffice.ComponentContext',
    ], stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
       creationflags=subprocess.CREATE_NO_WINDOW)
    document = None
    desktop = None
    try:
        local = uno.getComponentContext()
        resolver = local.ServiceManager.createInstanceWithContext('com.sun.star.bridge.UnoUrlResolver', local)
        deadline = time.monotonic() + 90
        while True:
            try:
                context = resolver.resolve('uno:pipe,name=' + pipe + ';urp;StarOffice.ComponentContext')
                break
            except Exception:
                if time.monotonic() >= deadline:
                    raise RuntimeError('unavailable')
                time.sleep(.2)
        desktop = context.ServiceManager.createInstanceWithContext('com.sun.star.frame.Desktop', context)
        document = desktop.loadComponentFromURL(source.as_uri(), '_blank', 0, (
            prop('Hidden', True), prop('ReadOnly', True), prop('MacroExecutionMode', 0), prop('UpdateDocMode', 0),
        ))
        if document is None:
            raise RuntimeError('parse_failed')
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
                    target = root / ('drawing-' + str(index) + '.png')
                    exporter = context.ServiceManager.createInstanceWithContext('com.sun.star.drawing.GraphicExportFilter', context)
                    exporter.setSourceDocument(shape)
                    settings = uno.Any('[]com.sun.star.beans.PropertyValue', (
                        prop('Translucent', True), prop('PixelWidth', width), prop('PixelHeight', height),
                    ))
                    if exporter.filter((prop('URL', target.as_uri()), prop('MediaType', 'image/png'), prop('FilterData', settings))):
                        png = target.read_bytes()
                        if len(png) > MAX_IMAGE or total + len(png) > MAX_TOTAL:
                            result['error'] = 'too_large'
                        elif len(png) < 33 or png[:8] != b'\x89PNG\r\n\x1a\n':
                            result['error'] = 'invalid_image'
                        else:
                            actual_width, actual_height = struct.unpack('>II', png[16:24])
                            if not 0 < actual_width <= 10000 or not 0 < actual_height <= 10000 or actual_width * actual_height > 20000000:
                                result['error'] = 'too_large'
                            else:
                                total += len(png)
                                result = {'inputSha256': source_item['sha256'], 'ok': True,
                                          'png': base64.b64encode(png).decode('ascii'),
                                          'sha256': hashlib.sha256(png).hexdigest(),
                                          'width': actual_width, 'height': actual_height}
            items.append(result)
        print(json.dumps({'schemaVersion': SCHEMA, 'sourceSha256': source_sha, 'items': items}), flush=True)
    finally:
        if document is not None:
            document.close(True)
        if desktop is not None:
            desktop.terminate()
        try:
            child.wait(timeout=10)
        except subprocess.TimeoutExpired:
            # The host waits for tree termination before releasing its worker slot.
            subprocess.run(['taskkill.exe', '/PID', str(child.pid), '/T', '/F'],
                           stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                           creationflags=subprocess.CREATE_NO_WINDOW, timeout=15)


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        code = str(error) if str(error) in ('invalid_input', 'too_large', 'source_changed', 'unavailable', 'parse_failed') else type(error).__name__
        print(code, file=sys.stderr)
        sys.exit(1)
