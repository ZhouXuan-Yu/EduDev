import {generatedQuestionCompleteness} from '../../shared/generated-question-completeness';
import {questionChoiceText} from '../../shared/question-text';
import {createHash} from 'node:crypto';
import type {QuestionBankItem} from '../../shared/contracts';
import type {QuestionDraftResult} from '../../shared/question-draft';
import type {QuestionReviewDraft} from '../../shared/question-review';
import {questionContentIdentity} from '../../shared/question-identity';
import {QUESTION_QUALITY_SCHEMA,QUESTION_MATH_QUALITY_SCHEMA,type QuestionMathReceipt,type QuestionQualityReview,type QuestionQualityIssue} from '../../shared/question-quality';
import {questionVersion} from './question-context-provider';

const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
type Scope={id:string;sessionId:string;studentId:string};
const stem=(q:QuestionReviewDraft['items'][number])=>questionChoiceText(q).text;
export function questionQualityCandidate(q:QuestionReviewDraft['items'][number],draft:QuestionReviewDraft,index:number):QuestionBankItem{
 return{id:`candidate_${index}`,subject:draft.subject,grade:draft.grade,knowledgePoint:draft.knowledgePoint,questionType:q.questionType,difficulty:q.difficulty,stem:stem(q),answer:q.answer,analysis:q.analysis,sourceKind:'generated',sourceTitle:draft.title,tags:[],createdAt:'',updatedAt:''};
}
/** The review token is scoped to the exact teacher version, immutable proposal and source versions. */
export function questionQualityHash(scope:Scope,proposalHash:string,draft:QuestionReviewDraft,sources:QuestionBankItem[],quality:Omit<QuestionQualityReview,'revisionHash'>){
 return hash({scope,proposalHash,draft,sources:sources.map(q=>({id:q.id,version:questionVersion(q)})),quality});
}
/** Reuses conservative content identity. Format and exact-text conflicts never prove an answer correct. */
export function assessQuestionQuality(scope:Scope,proposalHash:string,draft:QuestionReviewDraft,sources:QuestionBankItem[],formatted:QuestionDraftResult[],math?:QuestionMathReceipt[]):QuestionQualityReview{
 const questions=draft.items.map((q,i)=>questionQualityCandidate(q,draft,i)),identities=questions.map(questionContentIdentity),parents=sources.map(questionContentIdentity);
 const items=draft.items.map((q,index)=>{
  const issues:QuestionQualityIssue[]=[...formatted[index].issues,...generatedQuestionCompleteness(q)],identity=identities[index];
  if(questionChoiceText(q).conflict)issues.push('choice_embedded_options_conflict');
  if(identity.status==='available'){
   const peers=identities.flatMap((v,i)=>i!==index&&v.status==='available'&&v.key===identity.key?[i]:[]);
   const originals=parents.flatMap((v,i)=>v.status==='available'&&v.key===identity.key?[i]:[]);
   if(peers.length)issues.push('duplicate_batch');if(originals.length)issues.push('duplicate_parent');
   if(peers.some(i=>questions[i].answer!==q.answer)||originals.some(i=>sources[i].answer!==q.answer))issues.push('answer_conflict');
  }
  if(math?.[index].state==='mismatch')issues.push('math_mismatch');
  return{state:issues.length?'blocked' as const:'manual_review' as const,issues,...(math?{math:math[index]}:{})};
 });
 const quality:Omit<QuestionQualityReview,'revisionHash'>={schemaVersion:math?QUESTION_MATH_QUALITY_SCHEMA:QUESTION_QUALITY_SCHEMA,state:items.some(i=>i.state==='blocked')?'blocked':'manual_review',duplicateScope:'batch_and_read_parents',answerVerification:'not_run',items};
 return{...quality,revisionHash:questionQualityHash(scope,proposalHash,draft,sources,quality)};
}
