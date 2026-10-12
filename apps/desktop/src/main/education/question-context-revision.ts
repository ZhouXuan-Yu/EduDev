import {createHash} from 'node:crypto';
import type {QuestionBankItem} from '../../shared/contracts';
import {QUESTION_DOCUMENT_COMPLETE_SCHEMA,validQuestionDocument} from '../../shared/question-document';
import {QUESTION_PROJECTION_SCHEMA,validQuestionProjection,type QuestionProjection} from '../../shared/question-projection';
import {QUESTION_CONTEXT_EDIT_SCHEMA} from '../../shared/question-context-edit';
import type {QuestionContextSource} from '../../shared/question-context';
import {questionFacts,questionVersion} from './question-context-provider';
export type ContextRevision={schemaVersion:typeof QUESTION_CONTEXT_EDIT_SCHEMA;requestId:string;at:string;before:QuestionBankItem;after:QuestionBankItem;projection:QuestionProjection;previousDigest:string;digest:string};
export type ContextRevisionEffect={saved:QuestionContextSource;digest:string;contextRevisions?:ContextRevision[]};
const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
export function completeQuestion(q:QuestionBankItem,projection:QuestionProjection,at:string):QuestionBankItem{
 if(!q.document||!validQuestionProjection(projection,true))throw new Error('invalid_input');
 const sourceBlockIds=q.document.blocks.flatMap(b=>b.kind==='image'&&(b.id==='original'||b.id.startsWith('source_question_'))?[b.id]:[]);
 if(!sourceBlockIds.length||!q.document.blocks.some(b=>b.id==='transcription'&&b.kind==='text'))throw new Error('unavailable');
 const document={...q.document,schemaVersion:QUESTION_DOCUMENT_COMPLETE_SCHEMA,blocks:q.document.blocks.map(b=>b.id==='transcription'&&b.kind==='text'?{...b,text:projection.statement.text}:b),context:{schemaVersion:QUESTION_PROJECTION_SCHEMA,projection,sourceBlockIds}};
 if(!validQuestionDocument(document))throw new Error('invalid_input');
 return questionFacts({...q,stem:projection.statement.text,updatedAt:at,document});
}
function revisionDigest(row:Record<string,unknown>,effect:ContextRevisionEffect,entry:Omit<ContextRevision,'digest'>){
 return hash({approvalId:row.id,sessionId:row.session_id,studentId:row.student_id,runId:row.run_id,rootDigest:effect.digest,entry});
}
/** Immutable teacher corrections remain in the original approval ledger; canonical facts remain in the question row. */
export function contextHistory(row:Record<string,unknown>,effect:ContextRevisionEffect):ContextRevision[]{
 if(effect.contextRevisions===undefined)return[];
 if(!Array.isArray(effect.contextRevisions)||effect.contextRevisions.length>256||Buffer.byteLength(JSON.stringify(effect.contextRevisions))>2*1048576)throw new Error('unavailable');
 let version=effect.saved.version,previousDigest=effect.digest,previous:QuestionBankItem|undefined;const ids=new Set<string>();
 for(const entry of effect.contextRevisions){
  if(!entry||Object.keys(entry).sort().join()!==['schemaVersion','requestId','at','before','after','projection','previousDigest','digest'].sort().join()||entry.schemaVersion!==QUESTION_CONTEXT_EDIT_SCHEMA||!/^xicontext_[a-f0-9-]{36}$/.test(entry.requestId)||ids.has(entry.requestId)||typeof entry.at!=='string'||!Number.isFinite(Date.parse(entry.at))||new Date(entry.at).toISOString()!==entry.at||!entry.before||!entry.after||entry.before.id!==effect.saved.questionId||entry.after.id!==effect.saved.questionId||questionVersion(entry.before)!==version||previous&&JSON.stringify(questionFacts(entry.before))!==JSON.stringify(previous)||entry.previousDigest!==previousDigest||!validQuestionProjection(entry.projection,true)||JSON.stringify(entry.after)!==JSON.stringify(completeQuestion(entry.before,entry.projection,entry.at)))throw new Error('unavailable');
  const{digest,...body}=entry;if(digest!==revisionDigest(row,effect,body))throw new Error('unavailable');ids.add(entry.requestId);version=questionVersion(entry.after);previousDigest=digest;previous=entry.after;
 }
 return effect.contextRevisions;
}
export function latestOriginalVersion(row:Record<string,unknown>,effect:ContextRevisionEffect){const history=contextHistory(row,effect);return history.length?questionVersion(history.at(-1)!.after):effect.saved.version;}
export function appendContextRevision(row:Record<string,unknown>,effect:ContextRevisionEffect,before:QuestionBankItem,projection:QuestionProjection,requestId:string){
 const history=contextHistory(row,effect);if(history.length>=256)throw new Error('too_large');const at=new Date().toISOString(),after=completeQuestion(before,projection,at),body={schemaVersion:QUESTION_CONTEXT_EDIT_SCHEMA,requestId,at,before:questionFacts(before),after,projection,previousDigest:history.at(-1)?.digest||effect.digest};
 const revision={...body,digest:revisionDigest(row,effect,body)},next={...effect,contextRevisions:[...history,revision]};if(Buffer.byteLength(JSON.stringify(next))>2*1048576)throw new Error('too_large');return{revision,effect:next};
}
