"""Regression for observed UNO disposal after successful PDF export."""
import base64
from contextlib import contextmanager, redirect_stdout
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import sys
import tempfile
import types
import unittest

DATA = b'controlled source package'
PDF = b'%PDF-1.4\ncontrolled exported bytes\n%%EOF'


class DisposedException(Exception):
    pass


class ExportTest(unittest.TestCase):
    def run_export(self, *, cleanup_error=None, store_error=None, output=PDF, digest=None, limit=100000):
        with tempfile.TemporaryDirectory(prefix='edu-word-export-') as directory:
            root = Path(directory)

            class Document:
                def storeToURL(self, _url, _properties):
                    if store_error:
                        raise store_error
                    (root / 'rendered.pdf').write_bytes(output)

                def getRendererCount(self, *_args):
                    raise AssertionError('Page count must come from the exported PDF')

            @contextmanager
            def office_document(_data, _root):
                yield Document(), None
                if cleanup_error:
                    raise cleanup_error

            stub = types.ModuleType('word_office_worker')
            stub.office_document = office_document
            stub.prop = lambda name, value: (name, value)
            stub.watch_parent = lambda _pid: None
            sys.modules['word_office_worker'] = stub
            worker_path = Path(__file__).resolve().parents[2] / 'src/main/assets/word-pdf-worker.py'
            spec = importlib.util.spec_from_file_location('word_pdf_export_test', worker_path)
            worker = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(worker)
            request = {'schemaVersion': worker.SCHEMA, 'parentPid': 1,
                       'sourceSha256': digest or hashlib.sha256(DATA).hexdigest(),
                       'data': base64.b64encode(DATA).decode(), 'jobRoot': str(root),
                       'maxPdfBytes': limit, 'maxPages': 10000}
            original_stdin = sys.stdin
            try:
                sys.stdin = types.SimpleNamespace(buffer=io.BytesIO(json.dumps(request).encode() + b'\n'))
                stream = io.StringIO()
                with redirect_stdout(stream):
                    worker.main()
                return json.loads(stream.getvalue())
            finally:
                sys.stdin = original_stdin
                del sys.modules['word_office_worker']

    def test_success_uses_versioned_byte_receipt(self):
        result = self.run_export()
        self.assertEqual(set(result), {'schemaVersion', 'sourceSha256', 'sha256', 'bytes'})
        self.assertEqual(result['schemaVersion'], 'xiaozhi.word-pdf-export.v2')
        self.assertEqual(result['sha256'], hashlib.sha256(PDF).hexdigest())

    def test_disposal_after_success_keeps_export_for_independent_pdf_validation(self):
        self.assertEqual(self.run_export(cleanup_error=DisposedException())['bytes'], len(PDF))

    def test_disposal_during_export_fails_closed(self):
        with self.assertRaises(DisposedException):
            self.run_export(store_error=DisposedException())

    def test_other_cleanup_errors_stay_failed(self):
        with self.assertRaises(RuntimeError):
            self.run_export(cleanup_error=RuntimeError('unsafe'))

    def test_invalid_pdf_is_rejected(self):
        with self.assertRaises(ValueError):
            self.run_export(output=b'broken export')

    def test_source_change_is_rejected(self):
        with self.assertRaises(ValueError):
            self.run_export(digest='0' * 64)

    def test_oversized_export_is_rejected(self):
        with self.assertRaises(ValueError):
            self.run_export(limit=10)


if __name__ == '__main__':
    unittest.main()
