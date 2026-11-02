import {paperLayoutGeometry, paperLayoutImageSize, paperLayoutMathSize, paperLayoutTableWidths} from '../../shared/paper-layout';

export type PaperLayoutHtmlBlock = {kind: 'paragraph'; text: string}
  | {kind: 'table'; rows: readonly (readonly string[])[]}
  | {kind: 'image' | 'math'; png: Buffer; width: number; height: number; alt: string};
const escape = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
/** Static print scaffold, NOT a PDF renderer. Inputs are host-constructed text or already
 * authorized PNG/math pixels, never arbitrary HTML/CSS/URLs. The future host must still use
 * withStaticOfficePage and its exact resource allowlist; CSP alone is not file authority.
 * Math PNGs must be measured at 11pt / 96dpi by that host. No whole-question keep-together. */
export function paperLayoutHtml(input: unknown, header: readonly string[], blocks: readonly PaperLayoutHtmlBlock[]): string {
  const g = paperLayoutGeometry(input);
  if (!Array.isArray(header) || header.length > 20 || !Array.isArray(blocks) || blocks.length > 2000) throw Error('invalid_paper_layout_block');
  let chars = 0, imageBytes = 0;
  const text = (value: string) => {
    if (typeof value !== 'string' || value.length > 100000 || (chars += value.length) > 2000000 || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value)) throw Error('invalid_paper_layout_block');
    return escape(value);
  };
  const heading = header.map(value => `<p>${text(value)}</p>`).join('');
  const body = blocks.map(block => {
    if (block.kind === 'paragraph') return `<p>${text(block.text)}</p>`;
    if (block.kind === 'table') {
      if (!Array.isArray(block.rows) || !block.rows.length || block.rows.length > 1000 || !Array.isArray(block.rows[0])) throw Error('invalid_paper_layout_block');
      const columns = block.rows[0].length, widths = paperLayoutTableWidths(g.layout, columns);
      return `<table style="width:${widths.widthTwip / 15}px"><colgroup>${Array.from({length: columns}, () => `<col style="width:${widths.cellTwip / 15}px">`).join('')}</colgroup><tbody>${block.rows.map((row: readonly string[]) => {
        if (!Array.isArray(row) || row.length !== columns) throw Error('invalid_paper_layout_block');
        return `<tr>${row.map(value => `<td>${text(value)}</td>`).join('')}</tr>`;
      }).join('')}</tbody></table>`;
    }
    if (block.kind !== 'image' && block.kind !== 'math') throw Error('invalid_paper_layout_block');
    // No URL/path accepted. These are pixels from existing authorization / math rendering,
    // not an asset import API. Header validation is additional defence, not image approval.
    if (!Buffer.isBuffer(block.png) || block.png.length < 33 || block.png.length > 4 * 1048576
      || (imageBytes += block.png.length) > 16 * 1048576
      || !block.png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      || block.png.toString('ascii', 12, 16) !== 'IHDR' || !block.png.readUInt32BE(16) || !block.png.readUInt32BE(20)) throw Error('invalid_paper_layout_block');
    const atomicHeight = Math.min(g.contentHeight.px, (g.pageHeight.twip - g.margins.top.twip - g.margins.bottom.twip) / 15) - 16;
    const size = (block.kind === 'math' ? paperLayoutMathSize : paperLayoutImageSize)(g.layout, block.width, block.height, atomicHeight);
    return `<figure><img alt="${text(block.alt)}" style="width:${size.width}px;height:${size.height}px" src="data:image/png;base64,${block.png.toString('base64')}"></figure>`;
  }).join('');
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none';style-src 'unsafe-inline';img-src data:;font-src 'none';script-src 'none';base-uri 'none';form-action 'none'"><title>试卷</title><style>
@page{size:${g.pageWidth.mm}mm ${g.pageHeight.mm}mm;margin:${g.margins.top.mm}mm ${g.margins.right.mm}mm ${g.margins.bottom.mm}mm ${g.margins.left.mm}mm}
html,body{margin:0;padding:0}body{font:11pt/1.6 SimSun,"Microsoft YaHei",sans-serif;color:#111;overflow-wrap:anywhere;direction:ltr}
.paper-header{column-count:1}.paper-body{column-count:${g.layout.columns};column-gap:${g.columnGap.mm}mm;column-fill:auto;direction:ltr}
p{margin:0 0 6pt;white-space:pre-wrap;orphans:2;widows:2;break-inside:auto}
figure{margin:6pt 0;break-inside:avoid}img{display:block;max-width:100%}
table{table-layout:fixed;border-collapse:collapse;margin:6pt 0;break-inside:auto}tr{break-inside:auto}td{box-sizing:border-box;border:0.5pt solid #aaa;padding:0 6pt;vertical-align:top;white-space:pre-wrap;overflow-wrap:anywhere}
</style></head><body><header class="paper-header">${heading}</header><main class="paper-body">${body}</main></body></html>`;
}
