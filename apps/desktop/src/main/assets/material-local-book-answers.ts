import { LOCAL_BOOK_ANSWERS_PAGE_COUNT, LOCAL_BOOK_ANSWERS_SCHEMA,
  type LocalBookAnswersQuery, type LocalBookAnswersView } from '../../shared/material-local-book-answers';
import { MATERIAL_PDF_MAX_PAGES } from '../../shared/material-page-preview';
import { validPdfFilePage } from '../../shared/material-pdf-file';
import type { MaterialBookRole } from '../../shared/material-book-pair';
import { localCompactChoicePage } from './material-book-answer-content';

type Host = {
  all: (sql: string, values: (string | number)[]) => Promise<Record<string, unknown>[]>;
  role: (id: string) => Promise<MaterialBookRole | null>;
  verify: (id: string, version: string, signal: AbortSignal) => Promise<unknown>;
};

export async function readLocalBookAnswers(host: Host, input: LocalBookAnswersQuery, signal: AbortSignal): Promise<LocalBookAnswersView> {
  const { resourceId, version, start } = input;
  const checkRole = async () => {
    const role = await host.role(resourceId);
    if (role?.kind !== 'answers' || role.answerId !== resourceId) throw Error('book_pair_required');
    if (role.answerVersion !== version) throw Error('source_changed');
    signal.throwIfAborted();
  };
  await checkRole();
  await host.verify(resourceId, version, signal);
  const [job] = await host.all('SELECT generation,version,total FROM material_pdf_jobs WHERE resource_id=?', [resourceId]);
  if (job && job.version !== version) throw Error('source_changed');
  const total = Number(job?.total ?? 0);
  if (!Number.isInteger(total) || total < 0 || total > MATERIAL_PDF_MAX_PAGES || start > Math.max(1, total))
    throw Error('invalid_input');
  const end = Math.min(total, start + LOCAL_BOOK_ANSWERS_PAGE_COUNT - 1);
  const view: LocalBookAnswersView = { schemaVersion: LOCAL_BOOK_ANSWERS_SCHEMA, start, end, total, pending: 0, review: 0, pages: [] };
  if (end < start) return view;
  const rows = await host.all(`SELECT p.page,p.status,p.result_json FROM material_pdf_jobs j
    JOIN material_pdf_pages p ON p.generation=j.generation
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
    if (answers.length) view.pages.push({ page: Number(row.page), answers });
  }
  const [current] = await host.all('SELECT generation,version,total FROM material_pdf_jobs WHERE resource_id=?', [resourceId]);
  if (current?.generation !== job.generation || current?.version !== version || Number(current?.total) !== total)
    throw Error('source_changed');
  await checkRole();
  return view;
}
