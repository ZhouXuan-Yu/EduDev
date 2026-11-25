import { createHash } from 'node:crypto';
import type { QuestionBankItem } from '../../shared/contracts';
import type { StructurePage } from '../../shared/material-document-structure';
import { PDF_LAYOUT_ENGINE } from '../../shared/material-layout';
import { pageSha, validPageBox } from '../../shared/material-page-preview';
import type { PdfFilePage } from '../../shared/material-pdf-file';
import { LOCAL_OCR_ENGINE } from '../../shared/xiaozhi-ocr';
import type { OriginalImage } from './question-assets';
import type { StructureBookScope } from './material-structure-book-scope';

export type ChoiceSource = { resourceId: string; version: string; page: number };
type Read = (sql: string, values: (string | number | null)[]) => Promise<Record<string, unknown>[]>;

/** The caller also revalidates the teacher review and its exact structure scope before committing. */
export async function reviewedChoiceNumber(
  read: Read, q: QuestionBankItem, source: ChoiceSource, receipt: PdfFilePage, scope: StructureBookScope | undefined,
) {
  const archive = q.archive, ref = archive?.structure, review = archive?.structureReview;
  if (!archive?.sourceChecked || !ref || !review || !scope?.section || scope.page !== source.page ||
      ref.resourceId !== source.resourceId || ref.version !== source.version ||
      JSON.stringify(ref) !== JSON.stringify(scope.reference) || receipt.method !== 'ocr') return;
  const [row] = await read(
    'SELECT body_json,image_json,sha256 FROM material_structure_pages WHERE generation=? AND page=?',
    [ref.generation, source.page],
  );
  if (typeof row?.body_json !== 'string' || typeof row.image_json !== 'string' || !pageSha(row.sha256) ||
      scope.pages.at(-1) !== row.sha256 || createHash('sha256').update(row.body_json).digest('hex') !== row.sha256) return;
  const page = JSON.parse(row.body_json) as StructurePage;
  const image = JSON.parse(row.image_json) as OriginalImage;
  if (page.resourceId !== source.resourceId || page.version !== source.version || page.page !== source.page ||
      page.sourceEngine !== PDF_LAYOUT_ENGINE || page.rasterSource?.resourceId !== source.resourceId ||
      page.rasterSource.version !== source.version || page.issues.length || !pageSha(page.rasterSha256) ||
      image.resourceId !== source.resourceId || image.version !== source.version || image.page !== source.page ||
      image.total !== page.totalPages || image.sha256 !== page.rasterSha256 || JSON.stringify(image.box) !== '[0,0,1,1]' ||
      image.width !== receipt.width || image.height !== receipt.height) return;
  const number = archive.number;
  const printedNumber = (text: string) => /^(\d{1,5})[.、](?!\d)/u.exec(text.normalize('NFKC').trim())?.[1];
  const parents = page.paragraphs.filter(p => p.marker?.kind === 'parent' && p.marker.label === number);
  const witnesses = page.printedRecovery?.parents.filter(witness => printedNumber(witness.line.text) === number) ?? [];
  if (parents.length !== 1 || witnesses.length !== 1) return;
  const [parent] = parents, [witness] = witnesses;
  const line = page.lines.find(line => line.sourceId === witness.line.id);
  if (!parent.issues.includes('printed_crop_unconfirmed') || !line || !parent.lineIds.includes(line.id) ||
      line.origin !== 'local_ocr_crop' || line.text !== witness.line.text || witness.variant !== 'color-light' ||
      witness.engine !== LOCAL_OCR_ENGINE || witness.uncertain !== true || witness.line.score < 0.9 ||
      !validPageBox(witness.crop) || !pageSha(witness.cropSha256) || !witness.readings[0] ||
      printedNumber(witness.readings[0]) !== number) return;
  return { policy: 'reviewed-terminal-choice-number.v1' as const, pageSha: row.sha256,
    cropSha: witness.cropSha256, rasterSha: page.rasterSha256, reviewSha: review.sha256 };
}
