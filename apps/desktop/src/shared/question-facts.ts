import type {QuestionBankItem} from './contracts';
import {QUESTION_DOCUMENT_COMPLETE_SCHEMA,validQuestionDocument} from './question-document';
export type QuestionFactConflict='answer'|'analysis'|'statement';
/** Compare existing mirrors only. Equality proves neither source fidelity nor answer correctness. Never repairs facts. */
export function questionFactConflicts(q:Pick<QuestionBankItem,'stem'|'answer'|'analysis'|'document'>):QuestionFactConflict[]{
 const document=q.document;if(!document)return[];
 const conflicts:QuestionFactConflict[]=[];
 if(q.answer!==document.answer.text)conflicts.push('answer');
 if(q.analysis!==document.analysis.text)conflicts.push('analysis');
 // v1 deliberately stores a summary beside original images; do not reinterpret old summaries as complete statements.
 if(document.schemaVersion===QUESTION_DOCUMENT_COMPLETE_SCHEMA&&q.stem!==document.context.projection.statement.text)conflicts.push('statement');
 return conflicts;
}
/** Hash facts, not notebook bookmarks/categories or a claimed accuracy score. */
export function questionFacts(q:QuestionBankItem):QuestionBankItem{
 if(q.document!==undefined&&!validQuestionDocument(q.document))throw new Error('question_document_invalid');
 return{id:q.id,subject:q.subject,grade:q.grade,knowledgePoint:q.knowledgePoint,questionType:q.questionType,difficulty:q.difficulty,
  stem:q.stem,answer:q.answer,analysis:q.analysis,sourceTitle:q.sourceTitle,sourceKind:q.sourceKind,tags:[...q.tags],createdAt:q.createdAt,updatedAt:q.updatedAt,
  ...(q.document?{document:JSON.parse(JSON.stringify(q.document))}: {})};
}
