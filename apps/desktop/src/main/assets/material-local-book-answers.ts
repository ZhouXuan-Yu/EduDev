import { createHash } from 'node:crypto';
import { LOCAL_BOOK_ANSWERS_PAGE_COUNT, LOCAL_BOOK_ANSWERS_SCHEMA, LOCAL_BOOK_RECHECK_SCHEMA,
  type LocalBookAnswersQuery, type LocalBookAnswersView, type LocalBookRecheck,
  type LocalBookRecheckQuery } from '../../shared/material-local-book-answers';
import { MATERIAL_PDF_MAX_PAGES, type PageBox } from '../../shared/material-page-preview';
import { validPdfFilePage } from '../../shared/material-pdf-file';
import type { MaterialBookRole } from '../../shared/material-book-pair';
import { localCompactChoicePage } from './material-book-answer-content';

export const WINDOWS_CHOICE_OCR = 'windows.media.ocr.zh-hans-cn.v1' as const;
export const localBookReceiptSha = (data: string | Buffer) => createHash('sha256').update(data).digest('hex');
export type LocalBookPageSource = Pick<LocalBookRecheckQuery,'resourceId' | 'version' | 'page'>;
export type LocalBookRecheckRow = { sample: string; section: string; range: [number,number]; letters: string;
  crop?: { box: PageBox; sha256: string; inputSha: string; lines: string[]; observed: string } };
export type LocalBookRecheckEvidence = LocalBookPageSource & { schemaVersion: typeof LOCAL_BOOK_RECHECK_SCHEMA;
  engine: typeof WINDOWS_CHOICE_OCR; generation: string; rawSha: string; rasterSha: string; rows: LocalBookRecheckRow[] };

export function localRecheckSummary(rows: LocalBookRecheckRow[]): LocalBookRecheck {
  const summary = { checked: 0, agreeing: 0, different: 0, unreadable: 0 };
  for (const row of rows) {
    const count = row.letters.length;
    summary.checked += count;
    if (!row.crop?.observed) summary.unreadable += count;
    else if (row.crop.observed === row.letters) summary.agreeing += count;
    else summary.different += count;
  }
  return summary;
}

function readLocalRecheckSummary(stored: Record<string, unknown>, source: LocalBookPageSource, generation: string, raw: string) {
  if (typeof stored.recheck_json !== 'string' || stored.recheck_raw !== localBookReceiptSha(raw) ||
      localBookReceiptSha(stored.recheck_json) !== stored.recheck_sha) return;
  try {
    const proof = JSON.parse(stored.recheck_json) as LocalBookRecheckEvidence;
    if (proof.schemaVersion === LOCAL_BOOK_RECHECK_SCHEMA && proof.engine === WINDOWS_CHOICE_OCR &&
        proof.rawSha === stored.recheck_raw && proof.resourceId === source.resourceId && proof.version === source.version &&
        proof.page === source.page && proof.generation === generation) return localRecheckSummary(proof.rows);
  } catch { /* An incomplete receipt remains a local candidate. */ }
}

export type LocalBookHost = {
  all: (sql: string, values: (string | number)[]) => Promise<Record<string, unknown>[]>;
  role: (id: string) => Promise<MaterialBookRole | null>;
  verify: (id: string, version: string, signal: AbortSignal) => Promise<unknown>;
};

export async function requireCurrentAnswerBook(host: LocalBookHost, input: Pick<LocalBookPageSource,'resourceId' | 'version'>, signal: AbortSignal) {
  const role = await host.role(input.resourceId);
  if (role?.kind !== 'answers' || role.answerId !== input.resourceId) throw Error('book_pair_required');
  if (role.answerVersion !== input.version) throw Error('source_changed');
  signal.throwIfAborted();
}

export async function readLocalBookAnswers(host: LocalBookHost, input: LocalBookAnswersQuery, signal: AbortSignal): Promise<LocalBookAnswersView> {
  const { resourceId, version, start } = input;
  await requireCurrentAnswerBook(host,input,signal);
  await host.verify(resourceId, version, signal);
  const [job] = await host.all('SELECT generation,version,total FROM material_pdf_jobs WHERE resource_id=?', [resourceId]);
  if (job && job.version !== version) throw Error('source_changed');
  const total = Number(job?.total ?? 0);
  if (!Number.isInteger(total) || total < 0 || total > MATERIAL_PDF_MAX_PAGES || start > Math.max(1, total))
    throw Error('invalid_input');
  const end = Math.min(total, start + LOCAL_BOOK_ANSWERS_PAGE_COUNT - 1);
  const view: LocalBookAnswersView = { schemaVersion: LOCAL_BOOK_ANSWERS_SCHEMA, start, end, total, pending: 0, review: 0, pages: [] };
  if (end < start) return view;
  const rows = await host.all(`SELECT p.page,p.status,p.result_json,r.body_json AS recheck_json,
    r.raw_sha AS recheck_raw,r.body_sha AS recheck_sha FROM material_pdf_jobs j
    JOIN material_pdf_pages p ON p.generation=j.generation
    LEFT JOIN material_local_book_rechecks_v1 r ON r.resource_id=j.resource_id AND r.version=j.version
      AND r.generation=j.generation AND r.page=p.page
    WHERE j.resource_id=? AND j.version=? AND j.generation=? AND p.page BETWEEN ? AND ? ORDER BY p.page`,
  [resourceId, version, String(job.generation), start, end]);
  view.pending = end - start + 1 - rows.length;
  for (const row of rows) {
    signal.throwIfAborted();
    if (row.status === 'blank') continue;
    if (row.status === 'pending' || row.status === 'processing') { view.pending++; continue; }
    if (row.status !== 'complete' || typeof row.result_json !== 'string') { view.review++; continue; }
    let receipt: unknown;
    try { receipt = JSON.parse(row.result_json); } catch { view.review++; continue; }
    if (!validPdfFilePage(receipt) || receipt.status !== 'complete') { view.review++; continue; }
    const { answers, needsReview } = localCompactChoicePage(receipt.text);
    if (needsReview) view.review++;
    if (answers.length) {
      const page = Number(row.page);
      const recheck = readLocalRecheckSummary(row,{resourceId,version,page},String(job.generation),row.result_json);
      view.pages.push({page,answers,...(recheck && {recheck})});
    }
  }
  const [current] = await host.all('SELECT generation,version,total FROM material_pdf_jobs WHERE resource_id=?', [resourceId]);
  if (current?.generation !== job.generation || current?.version !== version || Number(current?.total) !== total)
    throw Error('source_changed');
  await requireCurrentAnswerBook(host,input,signal);
  return view;
}
