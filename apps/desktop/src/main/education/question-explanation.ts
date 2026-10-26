import type {QuestionBankItem} from '../../shared/contracts';
import type {QuestionReviewDraft} from '../../shared/question-review';
import {QUESTION_DOCUMENT_COMPLETE_SCHEMA,validQuestionDocument,type QuestionEvidence} from '../../shared/question-document';
import {questionFacts} from './question-context-provider';
import {questionExplanationCoverage} from '../../shared/question-explanation-coverage';

export const QUESTION_EXPLANATION_RECORD_SCHEMA='xiaozhi.education.question-review-record.v8' as const;
export const QUESTION_EXPLANATION_LEGACY_RECORD_SCHEMA='xiaozhi.education.question-review-record.v7' as const;
export const QUESTION_EXPLANATION_COLLECTION_RECORD_SCHEMA='xiaozhi.education.question-review-record.v9' as const;
export const QUESTION_EXPLANATION_REVISION_SCHEMA='xiaozhi.question-explanation-revision.v1' as const;
export type ExplanationGenerator={provider:string;model:string;runId:string};
export type ExplanationOrigins={answer:'ai_generated'|'teacher'|null;analysis:'ai_generated'|'teacher'|null};
export function explanationCoverage(q:QuestionReviewDraft['items'][number],source:QuestionBankItem){
 const doc=source.document,required=doc?.schemaVersion===QUESTION_DOCUMENT_COMPLETE_SCHEMA&&doc.context.projection.subquestions.state==='provided'?doc.context.projection.subquestions.text:source.stem;
 return questionExplanationCoverage(required,q.answer,q.analysis);
}
export function validExplanationGenerator(v:unknown):v is ExplanationGenerator{
 if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).sort().join()!=='model,provider,runId')return false;
 return Object.values(v).every(x=>typeof x==='string'&&x.trim().length>0&&x.length<=128&&!x.includes('\0'));
}
/** The model and teacher can fill missing evidence, never rewrite an approved source as a new question. */
export function validExplanationDraft(draft:QuestionReviewDraft,sources:QuestionBankItem[],legacy=false,allowComplete=false){
 const first=sources[0];
 return !!first&&draft.subject===first.subject&&draft.grade===first.grade&&draft.knowledgePoint===first.knowledgePoint&&sources.length===draft.items.length&&sources.every((q,i)=>{
  const item=draft.items[i],doc=q.document;
  return q.sourceKind==='teacher_resource'&&doc?.schemaVersion===QUESTION_DOCUMENT_COMPLETE_SCHEMA&&validQuestionDocument(doc)&&
   (allowComplete||doc.answer.origin==='missing'||doc.analysis.origin==='missing')&&(!legacy||draft.subject===q.subject&&draft.grade===q.grade&&draft.knowledgePoint===q.knowledgePoint)&&
   item.questionType==='short_answer'&&item.options===null&&item.stem===q.stem&&item.difficulty===q.difficulty&&
   (doc.answer.origin==='missing'||item.answer===q.answer)&&(doc.analysis.origin==='missing'||item.analysis===q.analysis);
 });
}
export function completeQuestionExplanation(q:QuestionBankItem,answer:string,analysis:string,generator:ExplanationGenerator,origins:ExplanationOrigins,at:string):QuestionBankItem{
 const doc=q.document;if(!doc||doc.schemaVersion!==QUESTION_DOCUMENT_COMPLETE_SCHEMA||!validQuestionDocument(doc)||!validExplanationGenerator(generator))throw new Error('invalid_input');
 const fill=(kind:'answer'|'analysis',text:string):QuestionEvidence=>{
  const previous=doc[kind],origin=origins[kind];
  if(previous.origin!=='missing'){if(origin!==null||text!==previous.text)throw new Error('invalid_input');return previous;}
  if(!text.trim()||text.length>(kind==='answer'?8000:12000)||!['teacher','ai_generated'].includes(String(origin)))throw new Error('invalid_input');
  return origin==='ai_generated'?{origin,text,anchors:[],generator}:{origin:'teacher',text,anchors:[]};
 };
 const document={...doc,answer:fill('answer',answer),analysis:fill('analysis',analysis)};
 if(!validQuestionDocument(document))throw new Error('invalid_input');
 return questionFacts({...q,answer,analysis,document,updatedAt:at});
}
