"""Produce the fixed synthetic scans used by the Provider resilience acceptance."""

import argparse
import hashlib
import json
from pathlib import Path
from tempfile import mkdtemp

import pymupdf


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def render_scan(root, source, name, region, must_contain, must_exclude=None):
    with pymupdf.open(source) as document:
        page = document[0]
        clip = pymupdf.Rect(region) if region else page.rect
        visible = page.get_text(clip=clip)
        assert must_contain in visible, name
        assert not must_exclude or must_exclude not in visible, name
        image = page.get_pixmap(clip=clip, alpha=False)

    with pymupdf.open() as scan:
        page = scan.new_page(width=595, height=842)
        page.insert_image(page.rect, pixmap=image)
        pdf = scan.tobytes(no_new_id=True, deflate=True)
    with pymupdf.open(stream=pdf, filetype='pdf') as readback:
        assert len(readback) == 1
        assert not readback[0].get_text()
        assert len(readback[0].get_images()) == 1

    target = root / f'{name}.pdf'
    target.write_bytes(pdf)
    return {
        'file': target.name, 'sha256': sha256(pdf), 'pages': 1,
        'source': source.name, 'sourceSha256': sha256(source.read_bytes()),
        'crop': list(clip), 'pixels': [image.width, image.height],
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('fixtures', type=Path)
    parser.add_argument('acceptance', type=Path)
    args = parser.parse_args()
    source = args.fixtures.resolve(strict=True)
    target = Path(mkdtemp(prefix='provider-journey-inputs-', dir=args.acceptance.resolve(strict=True)))
    cases = [
        ('scan-mock-a.svg', 'SYNTHETIC-M-A', (0, 0, 1240, 720), 'x + 3 = 8', 'ANSWER KEY'),
        ('scan-mock-a.svg', 'SYNTHETIC-A-A', (0, 775, 1240, 1130), '2. 4', 'x + 3 = 8'),
        ('scan-mock-b.svg', 'SYNTHETIC-M-B', (0, 0, 1240, 720), '2x = 14', 'ANSWER KEY'),
        ('scan-mock-b.svg', 'SYNTHETIC-A-B', (0, 775, 1240, 1130), '2. 8', '2x = 14'),
        ('scan-mock-c-page1.svg', 'SYNTHETIC-M-C', None, 'PAGE 1 OF 2', 'ANSWER KEY'),
        ('scan-page.svg', 'SYN-OCR-01', None, 'SYN-OCR-01', None),
    ]
    scans = [render_scan(target, source / name, stem, region, required, forbidden)
             for name, stem, region, required, forbidden in cases]
    refs = {name: sha256((source / name).read_bytes()) for name in
            ('mock-source.txt', 'journeys.md', 'questions.csv', 'lesson-source.txt')}
    report = {'format': 1, 'renderer': pymupdf.VersionBind, 'lockedInputs': refs, 'scans': scans}
    (target / 'inputs.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(target)


if __name__ == '__main__':
    main()
