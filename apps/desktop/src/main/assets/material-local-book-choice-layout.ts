import type { PdfLayout } from '../../shared/material-layout';
import type { PageBox } from '../../shared/material-page-preview';

const literal = (value: string) => value.normalize('NFKC').replace(/\s/gu, '');

export function independentChoiceLetters(lines: string[]) {
  const reads = lines.flatMap(line => {
    const match = /选择题(?:答案)?(?:\([^)]{1,32}\))?:([A-H](?:[、,]?[A-H]){1,31})$/u.exec(literal(line));
    return match ? [match[1].replace(/[、,]/gu, '')] : [];
  });
  return reads.length === 1 ? reads[0] : '';
}

export function locateLocalChoiceRow(layout: Pick<PdfLayout, 'lines'>, sample: string): PageBox | undefined {
  const toBox = (points: PdfLayout['lines'][number]['normalizedQuad']): PageBox => {
    const x = points.map(point => point[0]), y = points.map(point => point[1]);
    return [Math.min(...x), Math.min(...y), Math.max(...x), Math.max(...y)];
  };
  const matches = layout.lines.filter(line => literal(line.text) === literal(sample));
  if (matches.length !== 1 || matches[0].score < .90) return;
  const line = matches[0], [left, top, right, bottom] = toBox(line.normalizedQuad);
  const height = bottom - top;
  if (right - left < .04 || height < .004 || height > .08) return;
  const box: PageBox = [Math.max(0, left - height), Math.max(0, top - height * .24),
    Math.min(1, right + height), Math.min(1, bottom + height * .24)];
  // OCR padding can meet an adjacent row even when both printed rows are separate.
  for (const other of layout.lines) {
    if (other === line) continue;
    const [a, b, c, d] = toBox(other.normalizedQuad);
    if (a >= box[2] || c <= box[0] || b >= box[3] || d <= box[1]) continue;
    if (d <= top) box[1] = Math.max(box[1], (top + d) / 2);
    else if (b >= bottom) box[3] = Math.min(box[3], (bottom + b) / 2);
    else if (c <= left) box[0] = Math.max(box[0], (left + c) / 2);
    else if (a >= right) box[2] = Math.min(box[2], (right + a) / 2);
    else return;
  }
  return box;
}
