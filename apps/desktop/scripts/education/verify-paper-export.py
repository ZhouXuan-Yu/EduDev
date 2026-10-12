import hashlib, io, json, pathlib, sys, zipfile
from PIL import Image
from docx import Document
from pypdf import PdfReader
import pypdfium2 as pdfium

root, expected, output = pathlib.Path(sys.argv[1]).resolve(), json.loads(pathlib.Path(sys.argv[2]).read_text(encoding='utf-8')), pathlib.Path(sys.argv[3]).resolve()
files = []
def pixels(data):
    with Image.open(io.BytesIO(data)) as image:
        rgb = image.convert('RGB')
        return (rgb.size, hashlib.sha256(rgb.tobytes()).hexdigest())

def layout_text(text):
    # PDF introduces line breaks at page width; compare every non-whitespace character.
    return ''.join(text.split())

for item in expected:
    file = (root / item['path']).resolve()
    assert file.is_relative_to(root)
    images, embedded = [], []
    source_images = [(output / name).read_bytes() for name in item.get('imagePaths', [])]
    if file.suffix == '.docx':
        doc = Document(file)
        text = '\n'.join(p.text for p in doc.paragraphs)
        assert all(abs(s.page_width.mm - 210) < 1 and abs(s.page_height.mm - 297) < 1 for s in doc.sections)
        with zipfile.ZipFile(file) as z:
            assert 'word/document.xml' in z.namelist()
            assert not any('embeddings/' in n for n in z.namelist())
            embedded = [z.read(name) for name in z.namelist() if name.startswith('word/media/')]
            assert len(doc.inline_shapes) == len(source_images), 'Unexpected Word image count'
            for source in source_images:
                assert hashlib.sha256(source).hexdigest() in [hashlib.sha256(data).hexdigest() for data in embedded], 'Word changed source PNG'
        pages = None
    else:
        reader = PdfReader(file)
        embedded = [image.data for page in reader.pages for image in page.images]
        for source in source_images:
            assert pixels(source) in [pixels(data) for data in embedded], 'PDF source image pixels missing or altered'
        assert all(abs(float(p.mediabox.width) - 595.28) < 2 and abs(float(p.mediabox.height) - 841.89) < 2 for p in reader.pages)
        document, texts = pdfium.PdfDocument(file), []
        try:
            pages = len(document)
            for index in range(pages):
                page = document[index]
                text_page = page.get_textpage()
                try:
                    texts.append(text_page.get_text_range())
                    if item.get('renderAll') or index in {0, pages - 1}:
                        png = output / (file.stem + '-page-' + str(index + 1) + '.png')
                        bitmap = page.render(scale=2)
                        try:
                            bitmap.to_pil().save(png)
                        finally:
                            bitmap.close()
                        images.append(str(png))
                finally:
                    text_page.close()
                    page.close()
        finally:
            document.close()
        # PDFium maps a visible line-final hyphen to U+FFFE on some Chromium
        # PDFs. Use the independent PDF text extractor for exact content checks;
        # retain PDFium for actual rendered-page and source-image inspection.
        text = '\n'.join(page.extract_text() for page in reader.pages)
    for marker in item['markers']:
        assert layout_text(marker) in layout_text(text), file.name + ': missing complete question/reference'
    for marker in item.get('forbiddenMarkers', []):
        assert layout_text(marker) not in layout_text(text), file.name + ': student reference leakage'
    if item['audience'] == 'student':
        assert '答案哨兵' not in text and '解析哨兵' not in text
    else:
        assert '尚未独立核验' in text
    files.append(dict(path=file.name, audience=item['audience'], pages=pages, a4=True, completeMarkers=len(item['markers']), embeddedImages=len(embedded), verifiedSourceImages=len(source_images), studentAnswersExcluded=item['audience'] == 'student', rendered=images, bytes=file.stat().st_size))
print(json.dumps(dict(success=True, files=files), ensure_ascii=False))

