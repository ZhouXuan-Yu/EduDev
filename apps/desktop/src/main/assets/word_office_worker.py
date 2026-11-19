"""Shared local LibreOffice lifecycle for source-preserving exports."""
from contextlib import contextmanager
import ctypes
import io
import os
from pathlib import Path
import subprocess
import time
import uuid
import xml.etree.ElementTree as ET
import zipfile
import uno
from com.sun.star.beans import PropertyValue

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
        members = source.infolist()
        if len(members) > 5000 or sum(item.file_size for item in members) > 128 * 1024 * 1024:
            raise ValueError('too_large')
        for item in members:
            name = item.filename
            if item.flag_bits & 1 or '\\' in name or name.startswith('/') or any(part in ['.', '..'] for part in name.split('/')):
                raise ValueError('parse_failed')
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


@contextmanager
def office_document(data, root):
    source = root / 'source.docx'
    sanitized_copy(data, source)
    pipe = 'xiaozhi_word_office_' + uuid.uuid4().hex
    program = Path(os.environ['XIAOZHI_OFFICE_PROGRAM'])
    # The PDF host owns a short disposable profile outside the durable archive.
    profile = Path(os.environ.get('XIAOZHI_OFFICE_PROFILE', str(root / 'profile'))).resolve()
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
        yield document, context
    finally:
        try:
            if document is not None:
                document.close(True)
            if desktop is not None:
                desktop.terminate()
        finally:
            try:
                child.wait(timeout=10)
            except subprocess.TimeoutExpired:
                subprocess.run(['taskkill.exe', '/PID', str(child.pid), '/T', '/F'],
                               stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                               creationflags=subprocess.CREATE_NO_WINDOW, timeout=15)
