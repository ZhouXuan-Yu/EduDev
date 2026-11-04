import type {QuestionBankItem} from './contracts';
import {isCompleteQuestionDocument,validQuestionDocument} from './question-document';
import {validQuestionArchive} from './question-archive';
import {nativeQuestionConflicts} from './native-question';
export type QuestionFactConflict='answer'|'analysis'|'statement';
/** Compare existing mirrors only. Equality proves neither source fidelity nor answer correctness. Never repairs facts. */
export function questionFactConflicts(q:Pick<QuestionBankItem,'stem'|'answer'|'analysis'|'document'|'archive'>):QuestionFactConflict[]{
 if(q.archive?.native)return nativeQuestionConflicts(q,q.archive.native);
 const document=q.document;if(!document)return[];
 const conflicts:QuestionFactConflict[]=[];
 if(q.answer!==document.answer.text)conflicts.push('answer');
 if(q.analysis!==document.analysis.text)conflicts.push('analysis');
 for(const role of ['answer','analysis'] as const){const evidence=document[role],book=q.archive?.book?.roles[role];if(evidence.origin==='book_extracted'||q.archive?.[`${role}Origin`]==='book_extracted')if(evidence.origin!=='book_extracted'||!book||evidence.book.candidateId!==book.candidateId)if(!conflicts.includes(role))conflicts.push(role);}
 for(const role of ['answer','analysis'] as const){const evidence=document[role],web=q.archive?.web?.roles[role];if(evidence.origin==='web_extracted'||q.archive?.[`${role}Origin`]==='web_extracted')if(evidence.origin!=='web_extracted'||web?.kind!=='web_extracted'||JSON.stringify(evidence.web)!==JSON.stringify(web))if(!conflicts.includes(role))conflicts.push(role);}
 // v1 deliberately stores a summary beside original images; do not reinterpret old summaries as complete statements.
 if(isCompleteQuestionDocument(document)&&q.stem!==document.context.projection.statement.text)conflicts.push('statement');
 return conflicts;
}
/** Hash facts, not notebook bookmarks/categories or a claimed accuracy score. */
export function questionFacts(q:QuestionBankItem):QuestionBankItem{
 if(q.document!==undefined&&!validQuestionDocument(q.document))throw new Error('question_document_invalid');
 if(q.archive!==undefined&&!validQuestionArchive(q.archive))throw new Error('question_archive_invalid');
 if(q.document&&q.archive?.native)throw new Error('question_fact_conflict');
 return{id:q.id,subject:q.subject,grade:q.grade,knowledgePoint:q.knowledgePoint,questionType:q.questionType,difficulty:q.difficulty,
  stem:q.stem,answer:q.answer,analysis:q.analysis,sourceTitle:q.sourceTitle,sourceKind:q.sourceKind,tags:[...q.tags],createdAt:q.createdAt,updatedAt:q.updatedAt,
  ...(q.document?{document:JSON.parse(JSON.stringify(q.document))}: {}),...(q.archive?{archive:JSON.parse(JSON.stringify(q.archive))}:{})};
}
