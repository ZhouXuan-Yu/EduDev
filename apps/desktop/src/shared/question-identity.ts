import type {QuestionBankItem} from './contracts';
import {QUESTION_DOCUMENT_COMPLETE_SCHEMA,validQuestionDocument,type QuestionBlock} from './question-document';
import {QUESTION_PROJECTION_FIELDS} from './question-projection';
import {questionFactConflicts} from './question-facts';

export const QUESTION_CONTENT_IDENTITY_SCHEMA='xiaozhi.question-content-identity.v1' as const;
export type QuestionIdentityScope='saved_text'|'reviewed_document';
export type QuestionContentIdentity=
 |{schemaVersion:typeof QUESTION_CONTENT_IDENTITY_SCHEMA;status:'available';scope:QuestionIdentityScope;key:string}
 |{schemaVersion:typeof QUESTION_CONTENT_IDENTITY_SCHEMA;status:'unsupported';reason:'invalid_document'|'incomplete_document'|'fact_conflict'|'empty_text'};
export type QuestionDuplicateCandidate={scope:QuestionIdentityScope|'unsupported';matches:number;duplicateOf?:number};
// Deliberately no trimming, number/label removal, case folding or symbolic equivalence.
const text=(value:string)=>value.replace(/\r\n/g,'\n');
function blockContent(block:QuestionBlock):unknown{
 switch(block.kind){
  case 'text':case 'latex':return[block.kind,text(block.text)];
  case 'image':return[block.kind,block.sha256,block.mime,block.width,block.height];
  case 'table':return[block.kind,block.rows.map(row=>row.map(cell=>[cell.kind,text(cell.text)]))];
  case 'choices':return[block.kind,block.options.map(option=>[option.label,option.blocks.map(blockContent)])];
  case 'subquestion':return[block.kind,text(block.label),block.blocks.map(blockContent)];
 }
}
/** Local comparison only. A matching key proves neither complete source fidelity nor a correct answer.
 * Never use this key as a source/version token: questionVersion and its existing CAS remain authoritative.
 */
export function questionContentIdentity(question:QuestionBankItem):QuestionContentIdentity{
 const schemaVersion=QUESTION_CONTENT_IDENTITY_SCHEMA,document=question.document;
 if(document!==undefined){
  if(!validQuestionDocument(document))return{schemaVersion,status:'unsupported',reason:'invalid_document'};
  if(questionFactConflicts(question).length)return{schemaVersion,status:'unsupported',reason:'fact_conflict'};
  if(document.schemaVersion!==QUESTION_DOCUMENT_COMPLETE_SCHEMA)return{schemaVersion,status:'unsupported',reason:'incomplete_document'};
  const projection=QUESTION_PROJECTION_FIELDS.map(field=>[field,document.context.projection[field].state,text(document.context.projection[field].text)]);
  return{schemaVersion,status:'available',scope:'reviewed_document',key:JSON.stringify([schemaVersion,'reviewed_document',text(question.subject),projection,document.blocks.map(blockContent)])};
 }
 if(typeof question.stem!=='string'||!question.stem.trim()||question.stem.includes('\0'))return{schemaVersion,status:'unsupported',reason:'empty_text'};
 return{schemaVersion,status:'available',scope:'saved_text',key:JSON.stringify([schemaVersion,'saved_text',text(question.subject),text(question.stem)])};
}
/** Bounded to the supplied candidate set, not a claim about every question in the library. */
export function questionDuplicateCandidates(questions:readonly QuestionBankItem[]):QuestionDuplicateCandidate[]{
 const identities=questions.map(questionContentIdentity),groups=new Map<string,Map<string,number>>();
 identities.forEach((identity,index)=>{
  if(identity.status!=='available')return;
  const group=groups.get(identity.key)??new Map<string,number>();
  if(!group.has(questions[index].id))group.set(questions[index].id,index);
  groups.set(identity.key,group);
 });
 return identities.map((identity,index)=>{
  if(identity.status!=='available')return{scope:'unsupported',matches:0};
  const group=groups.get(identity.key)!;
  const primary=group.entries().next().value!;
  return{scope:identity.scope,matches:group.size,...(primary[0]!==questions[index].id?{duplicateOf:primary[1]}:{})};
 });
}
