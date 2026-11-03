"""Independent PyMuPDF readback; --check never opens or creates a PDF.

Real readback retains every PDF/page PNG, records failures, and returns nonzero.
It proves controlled helper feasibility only, not Office approval/Pi delivery.
"""
import collections
import hashlib
import importlib.metadata
import json
import math
import pathlib
import re
import sys
import traceback

import pymupdf as fitz

TOL = 1.25  # PDF points: Chromium subpixel/font-box rounding, not a column-gap allowance.


def geometry(layout):
    width, height = (210, 297) if layout['orientation'] == 'portrait' else (297, 210)
    pt = 72 / 25.4
    left, right, top, bottom = [layout['margins'][s] / 10 * pt for s in ('left', 'right', 'top', 'bottom')]
    gap = layout['columnGap'] / 10 * pt
    column = (width * pt - left - right - (layout['columns'] - 1) * gap) / layout['columns']
    # Independently reproduce conservative Word-rounded safe image/table dimensions.
    twip = lambda mm: math.floor(mm * 1440 / 25.4 + 0.5)
    column_twip = math.floor((twip(width) - twip(layout['margins']['left'] / 10)
                              - twip(layout['margins']['right'] / 10)
                              - (layout['columns'] - 1) * twip(layout['columnGap'] / 10)) / layout['columns'])
    return {'width': width * pt, 'height': height * pt, 'left': left, 'right': right,
            'top': top, 'bottom': bottom, 'column': column, 'gap': gap,
            'image_width': min(column, column_twip / 20),
            'table_width': math.floor(column_twip / 2) * 2 / 20,
            'columns': layout['columns']}


def column_of(rect, g):
    for col in range(g['columns']):
        start = g['left'] + col * (g['column'] + g['gap'])
        if start - TOL <= rect[0] and rect[2] <= start + g['column'] + TOL:
            return col
    return None


def inside_page(rect, g):
    return (g['left'] - TOL <= rect[0] <= rect[2] <= g['width'] - g['right'] + TOL
            and g['top'] - TOL <= rect[1] <= rect[3] <= g['height'] - g['bottom'] + TOL)


def flow_key(page, col, rect):
    return (page, col, round((rect[1] + rect[3]) / 2, 2), rect[0])


def metadata():
    d = importlib.metadata.distribution('PyMuPDF')
    return {'executable': sys.executable, 'distribution': d.metadata['Name'], 'version': d.version,
            'location': str(d.locate_file('')), 'fitz': fitz.__file__}


def self_check():
    layout = {'orientation': 'portrait', 'columns': 2, 'columnGap': 103,
              'margins': {'top': 201, 'right': 192, 'bottom': 213, 'left': 224}}
    g = geometry(layout)
    assert column_of([g['left'], 100, g['left'] + 50, 120], g) == 0
    right = g['left'] + g['column'] + g['gap']
    assert column_of([right, 100, right + 50, 120], g) == 1
    assert column_of([g['left'], 100, right + 50, 120], g) is None
    assert not inside_page([0, 0, 10, 10], g)
    assert not inside_page([g['left'], 100, g['width'], 120], g)
    assert flow_key(0, 0, [100, 600, 120, 620]) < flow_key(0, 1, [350, 80, 370, 100])
    assert flow_key(0, 1, [350, 600, 370, 620]) < flow_key(1, 0, [100, 80, 120, 100])
    assert g['table_width'] <= g['column'] and g['image_width'] <= g['column']
    return {'metadata': metadata(), 'readbackSelfCheck': 'passed', 'pdfAcceptance': 'NOT_RUN',
            'tolerancePoints': TOL, 'writes': 0}


def vertical_edges(page, y):
    xs = []
    for drawing in page.get_drawings():
        for item in drawing['items']:
            if item[0] == 'l':
                a, b = item[1:3]
                if abs(a.x - b.x) < 0.2 and min(a.y, b.y) - TOL <= y <= max(a.y, b.y) + TOL:
                    xs.append(a.x)
            elif item[0] == 're':
                r = item[1]
                if r.y0 - TOL <= y <= r.y1 + TOL:
                    xs.extend([r.x0, r.x1])
    return sorted(xs)


def verify_case(root, fixture):
    result = {'id': fixture['id'], 'success': False, 'errors': [], 'checks': 0, 'pages': [], 'markers': [], 'images': []}

    def check(ok, message):
        result['checks'] += 1
        if not ok:
            result['errors'].append(message)

    doc = None
    try:
        pdf = root / (fixture['id'] + '.pdf')
        check(pdf.is_file(), 'Real PDF missing')
        if not pdf.is_file():
            return result
        check(pdf.stat().st_size < 20 * 1048576, 'PDF exceeds fixture byte budget')
        if pdf.stat().st_size >= 20 * 1048576:
            return result
        result['pdfSha256'] = hashlib.sha256(pdf.read_bytes()).hexdigest()
        doc = fitz.open(pdf)
        check(2 <= len(doc) <= 20, 'Fixture must span at least two pages, at most twenty')
        if len(doc) > 20:
            return result
        g = geometry(fixture['layout'])
        expected = {m['text']: m['role'] for m in fixture['markers']}
        occurrences = collections.defaultdict(list)
        page_words, pixmaps, images = [], [], []
        for index, page in enumerate(doc):
            # Save all pages before semantic assertions; failures retain visual evidence.
            pix = page.get_pixmap(matrix=fitz.Matrix(2, 2), colorspace=fitz.csRGB, alpha=False)
            png = root / f"{fixture['id']}-page-{index + 1:03d}.png"
            pix.save(png)
            pixmaps.append(pix)
            words = page.get_text('words', sort=False)
            page_words.append(words)
            result['pages'].append({'page': index + 1, 'sizePoints': list(page.rect), 'png': png.name,
                                    'pngSha256': hashlib.sha256(png.read_bytes()).hexdigest()})
            check(page.rotation == 0, f'Page {index + 1}: unexpected rotation')
            check(abs(page.rect.width - g['width']) < 1 and abs(page.rect.height - g['height']) < 1,
                  f'Page {index + 1}: A4 physical orientation/size mismatch')
            for word in words:
                rect, value = word[:4], word[4]
                check(inside_page(rect, g), f'Page {index + 1}: text outside margins: {value} {rect}')
                if value in expected:
                    occurrences[value].append({'page': index, 'rect': list(rect), 'col': column_of(rect, g)})
                elif re.fullmatch(r'Q\d{4}L[123]|T\d{3}[AB]|HDRLEFT|HDRRIGHT|IMAGEPRE|IMAGEPOST|TABLEPRE|TABLEPOST', value):
                    check(False, f'Unexpected unique marker {value}')
            images.extend((index, info) for info in page.get_image_info())
        for text, role in expected.items():
            found = occurrences[text]
            check(len(found) == 1, f'{text}: expected exactly once, actual {len(found)}')
            result['markers'].append({'text': text, 'role': role, 'occurrences': found})
        # Header is the first paragraph, whose words precede the first body baseline.
        first_body = occurrences['Q0001L1']
        header_words = []
        if first_body:
            header_words = [w for w in page_words[0] if w[1] < first_body[0]['rect'][1] - 0.1]
        check(bool(header_words), 'Header text missing at page head')
        header_bottom = max((w[3] for w in header_words), default=g['top'])
        for name in ['HDRLEFT', 'HDRRIGHT']:
            for item in occurrences[name]:
                check(item['page'] == 0 and item['rect'][1] <= g['top'] + 50,
                      f'{name}: header repeated or outside first page head')
        if g['columns'] == 2 and header_words:
            check(max(w[2] for w in header_words) > g['left'] + g['column'] + TOL,
                  'Header failed to span beyond left column')
        for index, words in enumerate(page_words):
            for word in words:
                if index == 0 and tuple(word) in {tuple(w) for w in header_words}:
                    continue
                check(column_of(word[:4], g) is not None, f'Page {index + 1}: body text crosses column/gap: {word[4]}')
                if index == 0:
                    check(word[1] >= header_bottom - TOL, f'Body overlaps first-page header: {word[4]}')
        flow = []
        used_columns = collections.defaultdict(set)
        for marker in fixture['markers']:
            if marker['role'] == 'header':
                continue
            for item in occurrences[marker['text']]:
                if item['col'] is not None:
                    flow.append((marker['text'], flow_key(item['page'], item['col'], item['rect'])))
                    used_columns[item['page']].add(item['col'])
        ordered = [name for name, _ in sorted(flow, key=lambda item: item[1])]
        wanted = [m['text'] for m in fixture['markers'] if m['role'] != 'header']
        check(ordered == wanted, 'PDF coordinate order differs from source: expected left then right, then next page')
        check(set(used_columns) == set(range(len(doc))), 'Unexpected empty page or page with no unique body markers')
        if g['columns'] == 2:
            check(any(cols == {0, 1} for cols in used_columns.values()), 'Two-column fixture never actually used both columns')
            check(all(cols == {0, 1} for p, cols in used_columns.items() if p < len(doc) - 1),
                  'A non-final page failed to use both columns')
            result['usedColumnsByPage'] = {str(p + 1): sorted(cols) for p, cols in used_columns.items()}
        # Real vector table borders, not HTML widths. Every cell and border is checked.
        for text, role in expected.items():
            if role != 'table':
                continue
            for item in occurrences[text]:
                if item['col'] is None:
                    continue
                rect = item['rect']; start = g['left'] + item['col'] * (g['column'] + g['gap'])
                edges = [x for x in vertical_edges(doc[item['page']], (rect[1] + rect[3]) / 2)
                         if start - TOL <= x <= start + g['column'] + TOL]
                target_edges = [start + i * g['table_width'] / 2 for i in range(3)]
                check(all(any(abs(x - target) < TOL for x in edges) for target in target_edges), f'{text}: real table grid missing/wrong column width')
                cell = 0 if text.endswith('A') else 1
                check(target_edges[cell] - TOL <= rect[0] and rect[2] <= target_edges[cell + 1] + TOL,
                      f'{text}: clipped/crossing its actual table cell')
        check(len(images) == 1, f'Approved PNG must appear once, actual {len(images)}')
        for index, info in images:
            rect = info['bbox']; col = column_of(rect, g)
            check(inside_page(rect, g) and col is not None, 'Actual image rectangle crosses page/column boundary')
            check(info['width'] == 1200 and info['height'] == 240, 'Embedded image pixel dimensions changed')
            check(abs((rect[2] - rect[0]) - g['image_width']) < TOL, 'Image is not sized to actual column')
            check(abs((rect[3] - rect[1]) - g['image_width'] / 5) < TOL, 'Image aspect ratio/crop mismatch')
            result['images'].append({'page': index + 1, 'rect': list(rect), 'column': col})
            if col is not None and occurrences['IMAGEPRE'] and occurrences['IMAGEPOST']:
                key = flow_key(index, col, rect)
                a, b = occurrences['IMAGEPRE'][0], occurrences['IMAGEPOST'][0]
                check(a['col'] is not None and b['col'] is not None and flow_key(a['page'], a['col'], a['rect']) < key < flow_key(b['page'], b['col'], b['rect']),
                      'Actual PNG is out of source order')
            # All four corners + four perimeter midpoints survive in rendered PDF pixels.
            samples = [(24, 24, (20, 170, 20)), (1176, 24, (20, 20, 220)),
                       (24, 216, (220, 170, 20)), (1176, 216, (170, 20, 170)),
                       (600, 6, (220, 20, 20)), (600, 234, (220, 20, 20)),
                       (6, 120, (220, 20, 20)), (1194, 120, (220, 20, 20))]
            for x, y, rgb in samples:
                px = round((rect[0] + x / 1200 * (rect[2] - rect[0])) * 2)
                py = round((rect[1] + y / 240 * (rect[3] - rect[1])) * 2)
                pix = pixmaps[index]
                if not (0 <= px < pix.width and 0 <= py < pix.height):
                    check(False, f'PNG fiducial {x},{y} outside raster'); continue
                actual = pix.pixel(px, py)[:3]
                check(max(abs(a - b) for a, b in zip(actual, rgb)) <= 45,
                      f'PNG perimeter/corner missing or clipped: {x},{y} actual={actual}')
        result['success'] = not result['errors']
    except Exception:
        result['errors'].append(traceback.format_exc())
    finally:
        if doc is not None:
            doc.close()
    return result


def main():
    if sys.argv[1:] == ['--check']:
        print(json.dumps(self_check(), ensure_ascii=True)); return 0
    if len(sys.argv) != 2:
        raise ValueError('Use --check or <owned evidence root>')
    root = pathlib.Path(sys.argv[1]).resolve(strict=True)
    if (root / 'owned-root.txt').read_text(encoding='utf-8') != 'paper-layout-pdf-owned-v1':
        raise ValueError('Not an owned fixture root')
    fixtures = json.loads((root / 'fixtures.json').read_text(encoding='utf-8'))
    if [f['id'] for f in fixtures] != ['portrait-1', 'portrait-2', 'landscape-1', 'landscape-2']:
        raise ValueError('Expected exactly four controlled A4 combinations')
    report = {'success': False, 'metadata': metadata(), 'tolerancePoints': TOL,
              'boundary': 'Real PDF helper readback only; no Office approval, Pi, natural-quality or teacher visual acceptance',
              'cases': [verify_case(root, f) for f in fixtures]}
    report['success'] = all(case['success'] for case in report['cases'])
    with (root / 'pdf-readback.json').open('x', encoding='utf-8') as out:
        json.dump(report, out, ensure_ascii=False, indent=2)
    print(json.dumps({'success': report['success'], 'report': str(root / 'pdf-readback.json'),
                      'cases': [{'id': c['id'], 'success': c['success'], 'errors': c['errors']} for c in report['cases']]}))
    return 0 if report['success'] else 1


if __name__ == '__main__':
    sys.exit(main())
