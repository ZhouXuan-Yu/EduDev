// Offline foundation checks only: not Pi, actual PDF, Word/WPS visual or C2c acceptance.
import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {test} from 'node:test';
import {Document, Packer, Paragraph, ImageRun, Table, TableRow, TableCell, WidthType} from 'docx';
import JSZip from 'jszip';
import {SaxesParser} from 'saxes';
const {PAPER_LAYOUT_SCHEMA, validPaperLayout, parsePaperLayout, paperLayoutGeometry,
  paperLayoutImageSize, paperLayoutMathSize, paperLayoutTableWidths} = await import('../../src/shared/paper-layout.ts');
const {paperLayoutDocxSections, paperLayoutDocxStyles} = await import('../../src/main/xiaozhi-agent/paper-layout-docx.ts');
const {paperLayoutHtml} = await import('../../src/main/xiaozhi-agent/paper-layout-html.ts');
const fixture = (patch = {}) => ({schemaVersion: PAPER_LAYOUT_SCHEMA, paper: 'A4', orientation: 'portrait', columns: 1,
  margins: {top: 201, right: 192, bottom: 213, left: 224}, columnGap: 103, ...patch});
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a7WQAAAAASUVORK5CYII=', 'base64');
const output = fs.mkdtempSync(path.resolve('test-results/paper-layout-focused-'));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
console.log('OFFLINE FOUNDATION EVIDENCE ' + output);
function elements(xml) {
  const result = [], parser = new SaxesParser();
  parser.on('opentag', tag => result.push(tag)); parser.write(xml).close(); return result;
}
test('strict schema: plain exact data only, no getters/defaults/coercion/extensions', () => {
  const base = fixture(); assert.equal(validPaperLayout(base), true);
  const nullProto = Object.assign(Object.create(null), base); assert.equal(validPaperLayout(nullProto), true);
  const parsed = parsePaperLayout(base); base.margins.top = 0;
  assert.equal(parsed.margins.top, 201); assert.ok(Object.isFrozen(parsed.margins));
  let reads = 0; const getter = fixture(); Object.defineProperty(getter, 'columns', {enumerable: true, get() {reads++; return 1;}});
  const nested = fixture(); Object.defineProperty(nested.margins, 'top', {enumerable: true, get() {reads++; return 201;}});
  const hidden = fixture(); Object.defineProperty(hidden, 'css', {value: 'x'});
  const values = [undefined, null, [], new Date(), Object.create(fixture()), getter, nested, hidden,
    {...fixture(), [Symbol('x')]: 1}, fixture({css: 'columns:2'}), fixture({schemaVersion: 'xiaozhi.paper-layout.v2'}),
    fixture({paper: 'A3'}), fixture({orientation: 'auto'}), fixture({columns: '2'}), fixture({columns: 3}),
    fixture({columnGap: 1.1}), fixture({columnGap: -1}), fixture({columnGap: 301}), fixture({columnGap: NaN}),
    fixture({columnGap: Infinity}), fixture({columnGap: -0}), fixture({margins: {top: 1, right: 2, bottom: 3}}),
    fixture({margins: {...fixture().margins, top: '200'}}), fixture({margins: {...fixture().margins, top: 1001}}),
    fixture({margins: {...fixture().margins, left: 0.1}}), fixture({margins: {...fixture().margins, css: ''}})];
  for (const value of values) {assert.equal(validPaperLayout(value), false); assert.throws(() => parsePaperLayout(value), /invalid_paper_layout/);}
  assert.equal(reads, 0);
});
test('combined dimensions, range edges, and a single mm/twip/px source', () => {
  assert.ok(validPaperLayout(fixture({margins: {top: 0, right: 0, bottom: 0, left: 0}, columnGap: 0})));
  assert.ok(validPaperLayout(fixture({columns: 2, margins: {top: 1000, right: 500, bottom: 1000, left: 500}, columnGap: 300})));
  assert.ok(!validPaperLayout(fixture({columns: 2, margins: {top: 0, right: 501, bottom: 0, left: 500}, columnGap: 300})));
  assert.ok(!validPaperLayout(fixture({orientation: 'landscape', margins: {top: 801, right: 0, bottom: 800, left: 0}})));
  for (const orientation of ['portrait', 'landscape']) for (const columns of [1, 2]) {
    const g = paperLayoutGeometry(fixture({orientation, columns}));
    assert.equal(g.fontPt, 11); assert.equal(g.pageWidth.mm, orientation === 'portrait' ? 210 : 297);
    assert.equal(g.columnWidth.mm, (g.contentWidth.mm - (columns - 1) * 10.3) / columns);
    assert.ok(g.safeColumnPx <= g.columnWidth.twip / 15);
    assert.equal(g.pageWidth.twip, Math.round(g.pageWidth.mm / 25.4 * 1440));
    assert.equal(g.pageWidth.px, g.pageWidth.mm * 96 / 25.4);
  }
});
test('atomic image/math and table width contracts use actual columns and reject overflow', () => {
  const layout = fixture({columns: 2}), g = paperLayoutGeometry(layout);
  const image = paperLayoutImageSize(layout, 1200, 600);
  assert.equal(image.width, g.safeColumnPx); assert.equal(image.height, image.width / 2);
  assert.throws(() => paperLayoutImageSize(layout, 10, 10000), /too_large/);
  assert.throws(() => paperLayoutImageSize(layout, 100, 100, 50), /too_large/);
  assert.throws(() => paperLayoutMathSize(layout, g.safeColumnPx + 1, 20), /too_large/);
  assert.deepEqual(paperLayoutMathSize(layout, 20, 10), {width: 20, height: 10});
  for (const width of [0, -1, NaN, Infinity]) assert.throws(() => paperLayoutImageSize(layout, width, 1), /invalid/);
  const table = paperLayoutTableWidths(layout, 3); assert.ok(table.widthTwip <= g.columnWidth.twip);
  assert.ok(table.innerPx < table.cellTwip / 15); assert.throws(() => paperLayoutTableWidths(layout, 12), /too_large/);
});
for (const orientation of ['portrait', 'landscape']) for (const columns of [1, 2]) {
  test(`real DOCX bytes/XML ${orientation}/${columns}: single-column header, continuous body, widths`, async () => {
    const layout = fixture({orientation, columns}), g = paperLayoutGeometry(layout), widths = paperLayoutTableWidths(layout, 2);
    const size = paperLayoutImageSize(layout, 1200, 200);
    const body = [new Paragraph('BODY_MARKER'), new Paragraph({children: [new ImageRun({type: 'png', data: png, transformation: size})]}),
      new Table({width: {type: WidthType.DXA, size: widths.widthTwip}, columnWidths: [widths.cellTwip, widths.cellTwip],
        rows: [new TableRow({children: ['甲', '乙'].map(text => new TableCell({children: [new Paragraph(text)]}))})]})];
    const bytes = await Packer.toBuffer(new Document({styles: paperLayoutDocxStyles(),
      sections: paperLayoutDocxSections(layout, [new Paragraph('HEADER_MARKER')], body)}));
    const file = path.join(output, `${orientation}-${columns}.docx`); fs.writeFileSync(file, bytes);
    const zip = await JSZip.loadAsync(bytes), xml = await zip.file('word/document.xml').async('string');
    fs.writeFileSync(file + '.xml', xml);
    const sections = [...xml.matchAll(/<w:sectPr\b[^>]*>[\s\S]*?<\/w:sectPr>/g)].map(m => m[0]); assert.equal(sections.length, 2);
    for (const [i, section] of sections.entries()) {
      const tags = elements(section), find = name => tags.find(t => t.name === name)?.attributes;
      const page = find('w:pgSz'); assert.equal(+page['w:w'], g.pageWidth.twip); assert.equal(+page['w:h'], g.pageHeight.twip);
      assert.equal(page['w:orient'], orientation);
      const margins = find('w:pgMar'); for (const side of ['top', 'right', 'bottom', 'left']) assert.equal(+margins['w:' + side], g.margins[side].twip);
      const cols = find('w:cols'); assert.equal(+cols['w:num'], i === 0 ? 1 : columns); assert.equal(+cols['w:space'], i === 0 ? 0 : g.columnGap.twip);
      if (i === 1) assert.equal(find('w:type')['w:val'], 'continuous');
    }
    assert.ok(xml.indexOf('HEADER_MARKER') < xml.indexOf(sections[0]) && xml.indexOf(sections[0]) < xml.indexOf('BODY_MARKER'));
    const tags = elements(xml), extent = tags.find(t => t.name === 'wp:extent').attributes;
    assert.ok(Math.abs(+extent.cx - size.width * 9525) <= 1);
    assert.equal(+tags.find(t => t.name === 'w:tblW').attributes['w:w'], widths.widthTwip);
    const styles = await zip.file('word/styles.xml').async('string'); assert.match(styles, /w:ascii="SimSun"/); assert.match(styles, /<w:sz w:val="22"/);
    console.log(JSON.stringify({file, bytes: bytes.length, sha256: sha(bytes), orientation, columns, sectPr: 2}));
  });
  test(`static HTML contract ${orientation}/${columns} (not PDF acceptance)`, () => {
    const layout = fixture({orientation, columns}), g = paperLayoutGeometry(layout);
    const html = paperLayoutHtml(layout, ['<script>header</script>'], [{kind: 'paragraph', text: '<img src="https://invalid">'},
      {kind: 'table', rows: [['A', 'B'], ['1', '2']]}, {kind: 'image', png, width: 1200, height: 200, alt: '" onload="x'},
      {kind: 'math', png, width: 30, height: 20, alt: 'math at 11pt'}]);
    assert.ok(html.includes(`size:${g.pageWidth.mm}mm ${g.pageHeight.mm}mm`));
    assert.ok(html.includes(`column-count:${columns};column-gap:10.3mm;column-fill:auto;direction:ltr`));
    assert.ok(html.includes('</header><main class="paper-body">')); assert.ok(html.includes('font:11pt'));
    assert.ok(!html.includes('<script>')); assert.ok(!html.includes('<img src="https:'));
    assert.ok(!html.includes('overflow:hidden')); assert.ok(html.includes('break-inside:auto'));
    fs.writeFileSync(path.join(output, `${orientation}-${columns}.html`), html);
  });
}
test('HTML rejects unrecognized block kinds, URL input, malformed tables, oversize math', () => {
  assert.throws(() => paperLayoutHtml(fixture(), [], [{kind: 'html', html: '<script/>'}]), /invalid/);
  assert.throws(() => paperLayoutHtml(fixture(), [], [{kind: 'image', png: 'https://example.com', width: 10, height: 10}]), /invalid/);
  assert.throws(() => paperLayoutHtml(fixture(), [], [{kind: 'table', rows: [['a'], ['b', 'c']]}]), /invalid/);
  assert.throws(() => paperLayoutHtml(fixture({columns: 2}), [], [{kind: 'math', png, width: 1200, height: 20, alt: ''}]), /too_large/);
});
