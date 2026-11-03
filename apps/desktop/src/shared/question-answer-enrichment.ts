import type {QuestionBankItem} from './contracts';
import {validQuestionArchive} from './question-archive';
import {questionFactConflicts} from './question-facts';
import {isCompleteQuestionDocument,validQuestionDocument} from './question-document';
import {generatedQuestionCompleteness} from './generated-question-completeness';
export type MissingQuestionRole='answer'|'analysis';
const metadataIssues=new Set(['missing_answer','missing_analysis','missing_subject','missing_grade','missing_knowledge','missing_type','missing_difficulty']);
/** Read admission only. It grants neither cloud/image upload, answer writeback nor formal paper eligibility. */
export function answerEnrichmentRoles(q:QuestionBankItem):MissingQuestionRole[]{
 if(!q.stem.trim()||q.document&&(!validQuestionDocument(q.document)||!isCompleteQuestionDocument(q.document)))return[];
 if(q.archive&&(!validQuestionArchive(q.archive)||q.archive.native||q.archive.issues.some(code=>!metadataIssues.has(code))
  ||q.archive.sourceRisks.some(code=>['visual_unchecked','long_question'].includes(code)||!q.archive!.sourceChecked)))return[];
 if(questionFactConflicts(q).length)return[];
 if(!q.document&&generatedQuestionCompleteness({stem:q.stem,options:null}).length)return[];
 return (['answer','analysis'] as const).filter(role=>!q[role].trim()&&(!q.archive||q.archive[`${role}Origin`]==='missing')&&(!q.document||q.document[role].origin==='missing'));
}
