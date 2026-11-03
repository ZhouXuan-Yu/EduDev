"""Independent bytes/XML/PDF extraction plus every PDF page rasterization."""
import hashlib, json, pathlib, re, sys, zipfile, sqlite3
import xml.etree.ElementTree as ET
from pypdf import PdfReader
import pypdfium2 as pdfium

root = pathlib.Path(sys.argv[1]).resolve()
report = json.loads((root / 'report.json').read_text(encoding='utf-8'))
assert report['ok']
results = []
ns = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
      'wp': 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing'}
teacher_markers = []
if report.get('paperId'):
    with sqlite3.connect((root / 'data' / 'app.db').as_uri() + '?mode=ro', uri=True) as db:
        result = json.loads(db.execute('SELECT result_json FROM ai_confirmation_items WHERE id=?', (report['paperId'],)).fetchone()[0])
    for item in result['snapshot']['selection']['items']:
        analysis = item.get('instance', {}).get('content', {}).get('analysis', {})
        if analysis.get('mode') == 'edited':
            teacher_markers.extend(b['text'] for b in analysis['blocks'] if b.get('type') == 'text' and len(b.get('text', '')) > 20)
    assert teacher_markers, 'Current formal UI fixture must have actual edited teacher analysis'
for item in report['files']:
    file = pathlib.Path(item.get('file', item.get('path', ''))).resolve()
    assert file.is_relative_to(root)
    assert hashlib.sha256(file.read_bytes()).hexdigest() == item['sha256']
    teacher = item.get('audience') == 'teacher' or file.name.startswith('teacher-')
    answer_sheet = item.get('template') == 'answer_sheet'
    role = '教师解析卷' if teacher else '答题卡' if answer_sheet else '学生卷'
    result = {'file': str(file), 'role': role, 'a4': True, 'rendered': []}
    if file.suffix == '.docx':
        with zipfile.ZipFile(file) as z:
            xml = {name: z.read(name).decode('utf-8') for name in z.namelist() if name.endswith(('.xml', '.rels'))}
            all_xml = '\n'.join(xml.values())
            body = ET.fromstring(xml['word/document.xml'])
            page = body.find('.//w:pgSz', ns)
            assert page.get('{'+ns['w']+'}w') == '11906'
            assert page.get('{'+ns['w']+'}h') == '16838'
            assert any(role in text for name, text in xml.items() if re.match(r'word/header\d+\.xml$', name))
            assert 'NUMPAGES' in all_xml and 'PAGE' in all_xml
            for extent in body.findall('.//wp:extent', ns):
                assert int(extent.get('cx')) <= 9638 * 635 + 635
            if answer_sheet:
                assert all_xml.count('____________________________________________') == 24
            result['media'] = len([n for n in z.namelist() if n.startswith('word/media/')])
            text = all_xml
    else:
        pdf = PdfReader(file)
        assert len(pdf.pages) > 0
        texts = []
        for index, page in enumerate(pdf.pages):
            assert abs(float(page.mediabox.width) - 595.28) < 1
            assert abs(float(page.mediabox.height) - 841.89) < 1
            page_text = page.extract_text() or ''
            assert role in page_text, (file.name, index, 'missing role header')
            compact = ''.join(page_text.split())
            assert f'第{index+1}页/共{len(pdf.pages)}页' in compact
            if answer_sheet:
                numbers = re.findall(r'\d+\.（\d+(?:\.\d+)?分）', compact)
                assert page_text.count('____________________________________________') == 4 * len(numbers), (file.name, index, 'answer area split across pages')
            texts.append(page_text)
        document = pdfium.PdfDocument(file)
        try:
            for index in range(len(document)):
                page = document[index]
                bitmap = page.render(scale=1.4)
                target = root / (file.stem + '-page-' + str(index+1) + '.png')
                try:
                    bitmap.to_pil().save(target)
                finally:
                    bitmap.close()
                    page.close()
                result['rendered'].append(str(target))
        finally:
            document.close()
        text = '\n'.join(texts)
        result['pages'] = len(pdf.pages)
        if file.stem.endswith('-table'):
            compact = ''.join(text.split())
            assert '59119' in compact
        # Read all decodable PDF objects as well as visible text: hidden streams,
        # metadata and attachments cannot hide literal synthetic teacher sentinels.
        for ref in pdf.resolved_objects.values():
            if hasattr(ref, 'get_data'):
                text += ref.get_data().decode('utf-8', errors='ignore')
    for marker in ['TEACHER_ONLY_ANSWER', 'TEACHER_ONLY_ANALYSIS']:
        if not teacher:
            assert marker not in text
    compact = ''.join(text.split())
    for marker in teacher_markers:
        assert (''.join(marker.split()) in compact) == teacher, (file.name, 'edited teacher analysis isolation')
    result['verified_edited_teacher_markers'] = len(teacher_markers)
    result['student_teacher_sentinels_absent'] = not teacher
    results.append(result)
output = {'ok': True, 'files': results, 'scope': 'Real DOCX XML/media extents and PDF text/all-page rasterization, not native Office/WPS print preview or teacher REVIEW'}
(root / 'independent-readback.json').write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({'ok': True, 'files': len(results), 'pages': sum(r.get('pages', 0) for r in results)}, ensure_ascii=False))
