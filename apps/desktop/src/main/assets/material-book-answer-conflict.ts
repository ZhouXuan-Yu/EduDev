import type {QuestionBankItem} from '../../shared/contracts';
import {validQuestionArchive} from '../../shared/question-archive';

export const BOOK_ANSWER_CONFLICT_POLICY='book-answer-conflict.v1';
type Host={run:(sql:string,p?:(string|number|null)[])=>Promise<void>};

/** Reuse the durable match queue. Historical observations are reauthenticated by match(), never applied by migration. */
export async function migrateBookAnswerConflicts(host:Host){
 await host.run('CREATE INDEX IF NOT EXISTS material_book_answer_journal_lookup_v1 ON material_book_answer_journal_v1(question_id)');
 const conflict="CASE WHEN json_valid(j.payload_json) THEN json_extract(j.payload_json,'$.reason')='existing_answer_conflict' ELSE 0 END AND j.after_json=''";
 await host.run(`CREATE INDEX IF NOT EXISTS material_book_answer_journal_conflicts_v1 ON material_book_answer_journal_v1(batch_id,ordinal,question_id) WHERE ${conflict.replaceAll('j.','')}`);
 await host.run(`INSERT OR IGNORE INTO material_book_answer_work_v1(batch_id,ordinal,revision,error)
  SELECT j.batch_id,j.ordinal,p.revision,'' FROM material_book_answer_journal_v1 j
  JOIN material_ai_batches b ON b.id=j.batch_id
  JOIN material_book_pairs p ON p.question_id=b.resource_id AND p.question_version=b.version AND p.active=1
  JOIN question_bank_items q ON q.id=j.question_id
  WHERE ${conflict}
  AND j.rowid=(SELECT rowid FROM material_book_answer_journal_v1 WHERE batch_id=j.batch_id AND ordinal=j.ordinal AND question_id=j.question_id ORDER BY rowid DESC LIMIT 1)
  AND CASE WHEN json_valid(q.archive_json) THEN NOT EXISTS(SELECT 1 FROM json_each(q.archive_json,'$.issues') WHERE value='answer_conflict') ELSE 0 END`);
}

/** Quarantine only: leave both role texts, provenance, document and paid receipts unchanged. */
export function quarantineBookAnswerConflict(q:QuestionBankItem):QuestionBankItem|undefined{
 if(!q.archive||q.archive.issues.includes('answer_conflict'))return;
 const archive=structuredClone(q.archive);
 archive.issues.push('answer_conflict');
 if(archive.state==='ai_final')archive.state='ai_needs_review';
 if(!validQuestionArchive(archive))throw Error('invalid_input');
 return{...q,archive,updatedAt:new Date().toISOString()};
}
