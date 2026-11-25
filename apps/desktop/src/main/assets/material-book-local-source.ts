import { MATERIAL_PAGE_SOURCE, validMaterialPageSource, type MaterialPageSource } from '../../shared/material-ai-page';
import { BOOK_SECTION_LAYOUT, bookSectionLookupKey } from '../../shared/material-book-section-layout';
import { LOCAL_BOOK_RECHECK_SCHEMA } from '../../shared/material-local-book-answers';
import { validPageBox } from '../../shared/material-page-preview';
import { validPdfFilePage } from '../../shared/material-pdf-file';
import { LOCAL_BOOK_DOCUMENT_EVIDENCE } from '../../shared/question-book-document';
import type { QuestionEvidence } from '../../shared/question-document';
import type { ShanghaiMockSectionPolicy } from '../../shared/shanghai-mock-sections';
import { localCompactChoiceRows } from './material-book-answer-content';
import { WINDOWS_CHOICE_OCR, localBookReceiptSha, type LocalBookHost, type LocalBookRecheckEvidence } from './material-local-book-answers';
import { independentChoiceLetters } from './material-local-book-choice-layout';

export type LocalBookAnswerSource = {
  source: MaterialPageSource;
  proofSha: string;
  quoteSha: string;
  range: [number, number];
  answer: string;
};

const digest = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);

export async function findLocalBookAnswer(
  all: LocalBookHost['all'], resourceId: string, version: string, section: string, number: string,
  policy: ShanghaiMockSectionPolicy, layout?: typeof BOOK_SECTION_LAYOUT,
): Promise<LocalBookAnswerSource[]> {
  if (!/^\d{1,5}$/.test(number)) return [];
  const position = Number(number);
  const key = bookSectionLookupKey(section, policy, layout === BOOK_SECTION_LAYOUT);
  if (!key) return [];
  const stored = await all(`SELECT r.page,r.generation,r.raw_sha,r.body_json,r.body_sha,p.result_json
    FROM material_local_book_rechecks_v1 r
    JOIN material_pdf_jobs j ON j.resource_id=r.resource_id AND j.version=r.version AND j.generation=r.generation
    JOIN material_pdf_pages p ON p.generation=r.generation AND p.page=r.page AND p.status='complete'
    WHERE r.resource_id=? AND r.version=? AND EXISTS (
      SELECT 1 FROM json_each(CASE WHEN json_valid(r.body_json) THEN r.body_json ELSE '{}' END,'$.rows') AS item
      WHERE CASE WHEN item.type='object' THEN
        json_extract(item.value,'$.range[0]')<=? AND json_extract(item.value,'$.range[1]')>=?
      END
    ) ORDER BY r.page`, [resourceId, version, position, position]);
  const matches: LocalBookAnswerSource[] = [];
  for (const row of stored) {
    const { body_json: body, body_sha: bodySha, result_json: raw, raw_sha: rawSha } = row;
    if (typeof body !== 'string' || typeof raw !== 'string' || localBookReceiptSha(body) !== bodySha ||
        localBookReceiptSha(raw) !== rawSha) continue;
    try {
      const proof = JSON.parse(body) as LocalBookRecheckEvidence;
      const receipt: unknown = JSON.parse(raw);
      const source = {schemaVersion: MATERIAL_PAGE_SOURCE, resourceId, version, page: row.page,
        generation: row.generation, receiptSha: rawSha};
      if (!validMaterialPageSource(source) || !validPdfFilePage(receipt) || receipt.status !== 'complete' ||
          proof.schemaVersion !== LOCAL_BOOK_RECHECK_SCHEMA || proof.engine !== WINDOWS_CHOICE_OCR ||
          proof.resourceId !== resourceId || proof.version !== version || proof.page !== source.page ||
          proof.generation !== source.generation || proof.rawSha !== rawSha || !digest(proof.rasterSha)) continue;
      const current = localCompactChoiceRows(receipt.text);
      for (const candidate of proof.rows) {
        const original = current.filter(item => item.sample === candidate.sample && item.section === candidate.section &&
          item.letters === candidate.letters && item.range[0] === candidate.range?.[0] && item.range[1] === candidate.range?.[1]);
        if (original.length !== 1 || candidate.range[0] > position || candidate.range[1] < position ||
            bookSectionLookupKey(candidate.section, policy, layout === BOOK_SECTION_LAYOUT) !== key) continue;
        const crop = candidate.crop;
        if (!crop || !validPageBox(crop.box) || !digest(crop.sha256) || !digest(crop.inputSha) ||
            !Array.isArray(crop.lines) || crop.lines.some(line => typeof line !== 'string') ||
            crop.observed !== candidate.letters || independentChoiceLetters(crop.lines) !== candidate.letters) continue;
        const answer = candidate.letters[position - candidate.range[0]];
        if (/^[A-H]$/.test(answer || '')) {
          const proofSha = localBookReceiptSha(JSON.stringify([source, proof.engine, proof.rasterSha, candidate]));
          matches.push({source, proofSha, range: candidate.range, answer, quoteSha: localBookReceiptSha(candidate.sample)});
          if (matches.length > 1) return matches;
        }
      }
    } catch { /* Damaged receipts do not qualify for publication. */ }
  }
  return matches;
}

export function localBookDocumentRole(candidateId: string, entry: LocalBookAnswerSource, section: string, number: string): QuestionEvidence {
  return {origin: 'book_extracted', text: entry.answer, anchors: [], book: {
    schemaVersion: LOCAL_BOOK_DOCUMENT_EVIDENCE, candidateId, source: entry.source,
    section, number, proofSha: entry.proofSha, quoteSha: entry.quoteSha,
  }};
}
