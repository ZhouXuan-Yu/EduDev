"""Independent U4-B DOCX XML / PDF readback. Never generates delivery files.

Expected manifest comes from the companion JS collector, whose saved-artifact
facts are read-only. This verifier independently checks all SIX supplied files.
Direct CLI use proves file assertions only, not DB provenance or UI approval.
"""
import hashlib
import io
import json
import pathlib
import re
import sys
import unicodedata
import xml.etree.ElementTree as ET
import zipfile

W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
A = '{http://schemas.openxmlformats.org/drawingml/2006/main}'
R = '{http://schemas.openxmlformats.org/officeDocument/2006/relationships}'


def sha(data):
    return hashlib.sha256(data).hexdigest()


def compact(text):
    return re.sub(r'\s', '', unicodedata.normalize('NFC', text))


def pixels(data):
    from PIL import Image
    with Image.open(io.BytesIO(data)) as im:
        rgb = im.convert('RGB')
        return {'width': rgb.width, 'height': rgb.height, 'sha256': sha(rgb.tobytes())}


def read_docx(file):
    """Traverse paragraphs/tables in original XML order, including table cells.
    Do NOT append all tables after paragraphs (that hides reorder regressions).
    Only relationship-referenced images count as displayed; alt text never
    substitutes for visible text or mathematical/image correctness.
    """
    with zipfile.ZipFile(file) as z:
        assert sum(i.file_size for i in z.infolist()) <= 128*1024*1024, 'DOCX expanded size exceeds readback bound'
        assert not any('/embeddings/' in n for n in z.namelist()), 'Embedded Office objects'
        root = ET.fromstring(z.read('word/document.xml'))
        relationships = ET.fromstring(z.read('word/_rels/document.xml.rels'))
        rels = {r.attrib['Id']: r.attrib for r in relationships}
        body = root.find(W+'body')
        assert body is not None
        lines = []  # Visible text nodes only: never image alt text/XML attributes.
        for p in body.iter(W+'p'):
            lines.append(''.join(e.text or '' for e in p.iter() if e.tag == W+'t'))
        images = []
        for blip in body.iter(A+'blip'):
            rid = blip.get(R+'embed')
            assert rid and rid in rels, 'Image must be embedded'
            rel = rels[rid]
            assert rel.get('TargetMode') != 'External', 'External image reference'
            member = pathlib.PurePosixPath('word') / rel['Target']
            assert '..' not in member.parts and member.as_posix().startswith('word/media/'), 'Unexpected image path'
            data = z.read(member.as_posix())
            images.append({'member': member.as_posix(), 'bytesSha256': sha(data), 'pixels': pixels(data)})
        assert not list(body.iter(W+'altChunk')), 'External text chunks unsupported'
        sections = list(root.iter(W+'sectPr'))
        assert sections, 'No Word page setup'
        for section in sections:
            size = section.find(W+'pgSz')
            assert size is not None and abs(int(size.get(W+'w', '0'))/1440*25.4-210)<1 and abs(int(size.get(W+'h', '0'))/1440*25.4-297)<1, 'Word is not A4 portrait'
        return {'text': '\n'.join(lines), 'pages': None, 'images': images}


def read_pdf(file, output, render):
    from pypdf import PdfReader
    reader = PdfReader(file, strict=True)
    assert not reader.is_encrypted, 'Encrypted PDF'
    assert len(reader.pages)>0, 'Empty PDF'
    texts, images = [], []
    for n, page in enumerate(reader.pages):
        assert abs(float(page.mediabox.width)*25.4/72-210)<1 and abs(float(page.mediabox.height)*25.4/72-297)<1, 'PDF is not A4 portrait'
        texts.append(page.extract_text() or '')
        for image in page.images:
            images.append({'page':n+1, 'name':image.name, 'bytesSha256':sha(image.data), 'pixels':pixels(image.data)})
    rendered = []
    if render:
        import pypdfium2 as pdfium
        document = pdfium.PdfDocument(file)
        try:
            for n in range(len(document)):
                page = document[n]
                bitmap = page.render(scale=1.25)
                try:
                    image = bitmap.to_pil()
                    target = output / (file.stem+'-page-'+str(n+1)+'.png')
                    assert not target.exists(), 'Refusing to overwrite page evidence'
                    image.save(target)
                    rendered.append(str(target))
                finally:
                    bitmap.close()
                    page.close()
        finally:
            document.close()
    return {'text':'\n'.join(texts), 'pages':len(reader.pages), 'images':images, 'renderedPages':rendered}


def verify_file(item, workspace, output, render):
    file = pathlib.Path(item['path']).resolve(strict=True)
    assert file.is_relative_to(workspace) and file.is_file(), 'Output outside workspace'
    assert file.suffix.lower() == '.'+item['format']
    data = file.read_bytes()
    assert len(data)<=32*1024*1024, 'Output exceeds Office bound'
    assert sha(data) == item['sha256'], 'Saved file hash changed'
    assert data.startswith(b'PK' if item['format']=='docx' else b'%PDF'), 'Wrong file signature'
    result = read_docx(file) if item['format']=='docx' else read_pdf(file,output,render)
    text = compact(result['text'])
    for marker in item['required']:
        assert compact(marker) in text, 'Missing visible text: '+marker
    for marker in item.get('forbidden', []):
        assert compact(marker) not in text, 'Private/stale visible text leaked: '+marker
    for sequence in item.get('ordered', []):
        offset = 0
        for marker in sequence:
            at = text.find(compact(marker), offset)
            assert at>=0, 'Visible block order differs: '+repr(sequence)
            offset = at+len(compact(marker))
    image_pixels = [x['pixels'] for x in result['images']]
    for source in item.get('images', []):
        expected = pixels(pathlib.Path(source).read_bytes())
        assert expected in image_pixels, 'Required source image pixels absent: '+source
    for source in item.get('forbiddenImages', []):
        expected = pixels(pathlib.Path(source).read_bytes())
        assert expected not in image_pixels, 'Old/private source image leaked: '+source
    return {'kind':item['kind'], 'format':item['format'], 'path':str(file), 'sha256':sha(data), 'success':True, **result}


def main():
    manifest_path, report_path = map(pathlib.Path, sys.argv[1:3])
    assert not report_path.exists(), 'Refusing to overwrite report'
    report = {'scope':'independent-six-file-xml-pdf-readback', 'productAcceptance':False, 'success':False, 'files':[], 'failures':[]}
    try:
        manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
        assert manifest['schemaVersion']=='u4b.paper-instance-export-readback.v1'
        report['manifestSha256'] = sha(manifest_path.read_bytes())
        report['pending'] = manifest.get('pending', [])
        files = manifest['files']
        assert len(files)==6 and sorted((f['kind'],f['format']) for f in files)==sorted((k,f) for k in ['student','teacher','answer_sheet'] for f in ['docx','pdf']), 'Require exact six-file matrix'
        assert len({str(pathlib.Path(f['path']).resolve()).lower() for f in files})==6, 'Duplicate output path'
        workspace = pathlib.Path(manifest['workspace']).resolve(strict=True)
        for n, item in enumerate(files):
            # Per-file evidence folders avoid colliding basenames from different directories.
            owned = report_path.parent / ('readback-'+str(n+1)+'-'+item['kind']+'-'+item['format'])
            owned.mkdir(exist_ok=False)
            try:
                result = verify_file(item,workspace,owned,'--render-pdf' in sys.argv)
                report['files'].append(result)
            except Exception as error:
                failure = {'kind':item['kind'], 'format':item['format'], 'path':item['path'], 'error':str(error), 'type':type(error).__name__}
                report['failures'].append(failure)
        report['success'] = len(report['files'])==6 and not report['failures']
    except Exception as error:
        report['failures'].append({'error':str(error), 'type':type(error).__name__})
    finally:
        with report_path.open('x',encoding='utf-8') as stream:
            json.dump(report,stream,ensure_ascii=False,indent=2)
    return 0 if report['success'] else 1


if __name__ == '__main__':
    sys.exit(main())
