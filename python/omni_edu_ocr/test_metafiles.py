"""Regression checks for the Windows-only local vector renderer."""
import base64
import hashlib
import json
import os
import struct
import unittest
from unittest.mock import patch
import metafiles


def wmf():
    def record(function, *parameters):
        return struct.pack('<IH', 3 + len(parameters), function) + struct.pack('<' + 'H' * len(parameters), *parameters)
    records = b''.join([record(0x0103, 8), record(0x020B, 0, 0), record(0x020C, 500, 1000),
                        record(0x041B, 450, 950, 50, 50), record(0x0214, 250, 100), record(0x0213, 250, 900), record(0)])
    placeable = struct.pack('<IHhhhhHI', 0x9AC6CDD7, 0, 0, 0, 1000, 500, 1440, 0)
    checksum = 0
    for word in struct.unpack('<10H', placeable):
        checksum ^= word
    return placeable + struct.pack('<H', checksum) + struct.pack('<HHHIHIH', 1, 9, 0x300, (18 + len(records)) // 2, 0, 7, 0) + records


class MetafileTests(unittest.TestCase):
    def request(self, data):
        items = [{'sha256': hashlib.sha256(data).hexdigest(), 'data': base64.b64encode(data).decode()}]
        return {'schemaVersion': metafiles.SCHEMA, 'parentPid': os.getpid(), 'data': base64.b64encode(json.dumps(items).encode()).decode()}

    def test_original_pillow_renders_synthetic_wmf_at_physical_dpi(self):
        result = metafiles.run(self.request(wmf()), lambda pid: None)['items'][0]
        self.assertTrue(result['ok'])
        self.assertEqual((result['width'], result['height']), (100, 50))
        self.assertEqual(hashlib.sha256(base64.b64decode(result['png'])).hexdigest(), result['sha256'])

    def test_corrupt_records_and_missing_fonts_are_isolated(self):
        request = self.request(wmf()[:-1])
        self.assertEqual(metafiles.run(request, lambda pid: None)['items'][0]['error'], 'invalid_input')
        with patch.object(metafiles, 'fonts_available', return_value=False):
            result = metafiles.run(self.request(wmf()), lambda pid: None)['items'][0]
            self.assertEqual(result['error'], 'font_missing')

    def test_real_font_resolution_detects_substitution(self):
        self.assertTrue(metafiles.fonts_available({'Arial'}))
        self.assertFalse(metafiles.fonts_available({'XiaozhiMissingFont_9c51'}))

    def test_legacy_short_font_records_are_bounded_by_their_own_size(self):
        data = wmf()
        font = struct.pack('<IH', 15, 0x02FB) + bytes(18) + b'Arial\0'
        result = bytearray(data[:40] + font + data[40:])
        struct.pack_into('<I', result, 28, (len(result) - 22) // 2)
        self.assertEqual(metafiles.requested_fonts(result), {'Arial'})

    def test_emf_font_terminator_and_declared_end_ignore_unused_bytes(self):
        header, font, eof = bytearray(88), bytearray(104), bytearray(20)
        struct.pack_into('<II', header, 0, 1, 88)
        header[40:44] = b' EMF'
        struct.pack_into('<I', header, 48, 212)
        struct.pack_into('<II', font, 0, 82, 104)
        font[40:104] = 'Arial\0'.encode('utf-16-le') + b'\x00\xd8' * 26
        struct.pack_into('<II', eof, 0, 14, 20)
        self.assertEqual(metafiles.requested_fonts(header + font + eof + bytes(32)), {'Arial'})

    def test_hash_and_outer_request_validation_precede_rendering(self):
        request = self.request(wmf())
        batch = json.loads(base64.b64decode(request['data']))
        batch[0]['sha256'] = 'f' * 64
        request['data'] = base64.b64encode(json.dumps(batch).encode()).decode()
        with self.assertRaisesRegex(ValueError, 'invalid_input'):
            metafiles.run(request, lambda pid: None)
        request['unexpected'] = True
        with self.assertRaisesRegex(ValueError, 'invalid_input'):
            metafiles.run(request, lambda pid: None)


if __name__ == '__main__':
    unittest.main()
