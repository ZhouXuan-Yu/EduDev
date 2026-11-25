import type { BookMatchRow } from "../../shared/question-book-answer";
import type { MockExamEntry, MockExamAnswerReview, MockExamAnswerReviewRow } from "../../shared/mock-exam-compilation";
import type { MaterialBookRole } from "../../shared/material-book-pair";
import type { QuestionBankItem } from "../../shared/contracts";
import { questionVersion } from "../education/question-context-provider";
import { bookMatchReasons } from "../../shared/question-book-answer";

type Host = {
  all(sql: string, values: (string | number)[]): Promise<Record<string, unknown>[]>;
  role(id: string): Promise<MaterialBookRole | null>;
  read(id: string): Promise<QuestionBankItem | undefined>;
};

const limit = 40;
const validVersion = (value: unknown) => typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);

function readAttempt(value: unknown, questionId: string): BookMatchRow | undefined {
  try {
    const row = JSON.parse(String(value)) as BookMatchRow;
    if (!row || row.questionId !== questionId || !/^\d{1,5}$/u.test(row.number) ||
        !/^bookanswer_[a-f0-9-]{36}$/u.test(row.id) ||
        !["applied", "held", "conflict"].includes(row.state) || !validVersion(row.beforeVersion) ||
        (row.afterVersion !== "" && !validVersion(row.afterVersion))) return;
    return row;
  } catch {
    return undefined;
  }
}

/** Read existing attempts for the current pair. The view is not question or answer certification. */
export async function readMockExamAnswerReview(host: Host, entry: MockExamEntry, signal: AbortSignal): Promise<MockExamAnswerReview> {
  const answer = entry.answer;
  if (answer.state !== 'linked' || !answer.resourceId || !answer.version || !answer.pairRevision) throw Error('source_changed');
  const assertCurrentPair = async () => {
    signal.throwIfAborted();
    const current = await host.role(entry.resourceId);
    if (current?.kind !== "questions" || current.questionVersion !== entry.version ||
        current.answerId !== answer.resourceId || current.answerVersion !== answer.version ||
        current.revision !== answer.pairRevision) throw Error("source_changed");
  };
  await assertCurrentPair();
  const result = await host.all(`WITH batches(id) AS (
    SELECT id FROM material_ai_batches WHERE resource_id=? AND version=?
    UNION ALL
    SELECT 'structure:'||generation FROM material_structure_jobs
      WHERE resource_id=? AND version=? AND status IN ('complete','partial')
  ), attempts AS (
    SELECT j.question_id,j.rowid,
      CASE WHEN json_valid(j.evidence_json) THEN j.evidence_json ELSE '{}' END AS evidence
    FROM batches b JOIN material_book_answer_journal_v1 j ON j.batch_id=b.id
  ), latest AS (
    SELECT question_id,MAX(rowid) AS attempt
    FROM attempts
    WHERE json_extract(evidence,'$.pair.questionId')=? AND json_extract(evidence,'$.pair.questionVersion')=?
      AND json_extract(evidence,'$.pair.answerId')=? AND json_extract(evidence,'$.pair.answerVersion')=?
      AND json_extract(evidence,'$.pair.revision')=?
    GROUP BY question_id
  )
  SELECT j.question_id,j.payload_json
  FROM latest JOIN material_book_answer_journal_v1 j ON j.rowid=latest.attempt
  WHERE NOT EXISTS(SELECT 1 FROM material_structure_hidden_questions h WHERE h.question_id=j.question_id)
  ORDER BY j.rowid DESC LIMIT ?`, [
    entry.resourceId, entry.version, entry.resourceId, entry.version,
    entry.resourceId, entry.version, answer.resourceId, answer.version, answer.pairRevision, limit + 1,
  ]);
  const rows: MockExamAnswerReviewRow[] = [];
  let unreadable = 0;
  for (const saved of result.slice(0, limit)) {
    signal.throwIfAborted();
    const record = readAttempt(saved.payload_json, String(saved.question_id));
    if (!record) {
      unreadable++;
      continue;
    }
    const current = await host.read(record.questionId);
    const version = record.afterVersion || record.beforeVersion;
    const changed = !current || questionVersion(current) !== version || record.state === "conflict";
    const state = changed ? "changed" : record.state === "applied" && record.afterVersion ? "saved" : "held";
    const page = (record.source ?? record.localSource)?.page;
    rows.push({
      id: record.id,
      number: record.number,
      state,
      ...(state === "held" && typeof record.reason === "string" && Object.hasOwn(bookMatchReasons, record.reason) ? { reason: record.reason } : {}),
      ...(typeof page === 'number' && Number.isSafeInteger(page) && page > 0 && page <= 10000 ? { answerPage: page } : {}),
    });
  }
  await assertCurrentPair();
  return { rows, limited: result.length > limit, unreadable };
}
