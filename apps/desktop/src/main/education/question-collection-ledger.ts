import {createHash} from 'node:crypto';
import type {QuestionReviewSql} from './question-review-repository';
import {plainStudentInput} from '../../shared/student-context';
import {QUESTION_COLLECTION_SCHEMA,validCollectionBlueprint,validCollectionId,validCollectionReference} from '../../shared/question-collection';
import {generatedPaperCount,type PaperBlueprint} from '../../shared/paper-blueprint';
import type {QuestionReviewDraft,QuestionReviewSummary} from '../../shared/question-review';
import {paperSectionMatches} from './paper-selection';
import {questionQualityCandidate} from './question-quality';

export const COLLECTION_ACTION='pi_question_collection';
export type CollectionPayload={schemaVersion:typeof QUESTION_COLLECTION_SCHEMA;studentId:string;callId:string;reference:string;blueprint:PaperBlueprint};
export type CollectionMember={sectionId:string;ids:string[]};
export type CollectionState={phase:'drafting'|'review'|'confirmed'|'rejected';members:CollectionMember[];approvalRevision?:string;effects?:{id:string;digest:string}[];digest:string};
export type CollectionScope={id:string;sectionId:string};
export const collectionHash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const digest=(r:Record<string,unknown>,p:CollectionPayload,s:Omit<CollectionState,'digest'>)=>collectionHash({id:r.id,sessionId:r.session_id,studentId:r.student_id,payload:p,state:s});
export async function collectionAuthorize(sql:Pick<QuestionReviewSql,'all'>,sessionId:string,expected?:string){
 const r=(await sql.all('SELECT s.student_id,t.status FROM ai_conversation_sessions s LEFT JOIN students t ON t.id=s.student_id WHERE s.id=? AND s.archived_at IS NULL',[sessionId]))[0];
 if(!r||r.student_id&&r.status!=='active'||expected!==undefined&&String(r.student_id||'')!==expected)throw new Error('permission_denied');return String(r.student_id||'');
}
export async function getCollection(sql:Pick<QuestionReviewSql,'all'>,sessionId:string,id:string){
 if(!validCollectionId(id))throw new Error('invalid_input');
 const r=(await sql.all('SELECT * FROM ai_confirmation_items WHERE id=? AND session_id=? AND action_type=?',[id,sessionId,COLLECTION_ACTION]))[0];if(!r)throw new Error('permission_denied');
 await collectionAuthorize(sql,sessionId,String(r.student_id));
 const p=JSON.parse(String(r.payload_json)) as CollectionPayload,s=JSON.parse(String(r.result_json)) as CollectionState;
 if(!plainStudentInput(p,['schemaVersion','studentId','callId','reference','blueprint'])||p.schemaVersion!==QUESTION_COLLECTION_SCHEMA||p.studentId!==r.student_id||typeof p.callId!=='string'||!p.callId||p.callId.length>128||!validCollectionReference(p.reference)||!validCollectionBlueprint(p.blueprint)||!plainStudentInput(s,['phase','members','approvalRevision','effects','digest'])||!['drafting','review','confirmed','rejected'].includes(s.phase)||!Array.isArray(s.members)||s.members.length>100||s.members.some(m=>!plainStudentInput(m,['sectionId','ids'])||!p.blueprint.sections.some(section=>section.id===m.sectionId)||!Array.isArray(m.ids)||m.ids.length<1||m.ids.length>4||m.ids.some(v=>typeof v!=='string'||!/^xiquestion_[a-f0-9-]{36}$/i.test(v)))||new Set(s.members.flatMap(m=>m.ids)).size!==s.members.reduce((n,m)=>n+m.ids.length,0))throw new Error('unavailable');
 if(r.status!==(s.phase==='confirmed'?'confirmed':s.phase==='rejected'?'rejected':'pending'))throw new Error('unavailable');
 if(s.phase==='confirmed'?(typeof s.approvalRevision!=='string'||!/^[a-f0-9]{64}$/.test(s.approvalRevision)||!Array.isArray(s.effects)||s.effects.length!==s.members.length||s.effects.some((e,i)=>!plainStudentInput(e,['id','digest'])||e.id!==s.members[i].ids.at(-1)||typeof e.digest!=='string'||!/^[a-f0-9]{64}$/.test(e.digest))):s.approvalRevision!==undefined||s.effects!==undefined)throw new Error('unavailable');
 const {digest:stored,...state}=s;if(stored!==digest(r,p,state))throw new Error('unavailable');return{r,p,s};
}
export async function saveCollection(sql:Pick<QuestionReviewSql,'run'>,r:Record<string,unknown>,p:CollectionPayload,state:Omit<CollectionState,'digest'>){
 const result={...state,digest:digest(r,p,state)},at=new Date().toISOString(),status=state.phase==='confirmed'?'confirmed':state.phase==='rejected'?'rejected':'pending';
 await sql.run('UPDATE ai_confirmation_items SET status=?,result_json=?,updated_at=?,confirmed_at=?,rejected_at=? WHERE id=?',[status,JSON.stringify(result),at,status==='confirmed'?at:null,status==='rejected'?at:null,String(r.id)]);return result;
}
export async function collectionForQuestion(sql:Pick<QuestionReviewSql,'all'>,sessionId:string,id:string){
 const rows=await sql.all("SELECT DISTINCT c.id FROM ai_confirmation_items c, json_each(c.result_json,'$.members') m, json_each(m.value,'$.ids') i WHERE c.session_id=? AND c.action_type=? AND i.value=?",[sessionId,COLLECTION_ACTION,id]);
 if(rows.length>1)throw new Error('unavailable');return rows.length?getCollection(sql,sessionId,String(rows[0].id)):undefined;
}
export async function validateCollectionAppend(sql:Pick<QuestionReviewSql,'all'>,sessionId:string,scope:CollectionScope,draft:QuestionReviewDraft,kind:'ai_original'|'variation',parentId?:string){
 const value=await getCollection(sql,sessionId,scope.id),{p,s}=value,section=p.blueprint.sections.find(v=>v.id===scope.sectionId);
 if(s.phase!=='drafting')throw new Error('conflict');if(!section||p.blueprint.mode==='ai_original'&&kind!=='ai_original'||!draft.items.every((q,i)=>paperSectionMatches(questionQualityCandidate(q,draft,i),p.blueprint,section)))throw new Error('invalid_input');
 let count=0,found=false;for(const m of s.members){const head=m.ids.at(-1)!;if(head===parentId){if(m.sectionId!==scope.sectionId)throw new Error('conflict');found=true;continue;}if(m.sectionId===scope.sectionId){const row=(await sql.all("SELECT payload_json FROM ai_confirmation_items WHERE id=? AND session_id=? AND student_id=? AND action_type='pi_question_candidate'",[head,sessionId,p.studentId]))[0];if(!row)throw new Error('unavailable');count+=(JSON.parse(String(row.payload_json)) as {draft:QuestionReviewDraft}).draft.items.length;}}
 if(parentId&&!found)throw new Error('permission_denied');if(count+draft.items.length>generatedPaperCount(p.blueprint,section))throw new Error('conflict');return value;
}
export async function attachCollectionGroup(sql:QuestionReviewSql,sessionId:string,scope:CollectionScope,draft:QuestionReviewDraft,group:QuestionReviewSummary){
 const {r,p,s}=await validateCollectionAppend(sql,sessionId,scope,draft,group.generationKind||'variation',group.repairParentId),members=s.members.map(m=>({...m,ids:[...m.ids]}));
 if(group.repairParentId)members.find(m=>m.ids.at(-1)===group.repairParentId)!.ids.push(group.id);else members.push({sectionId:scope.sectionId,ids:[group.id]});
 await saveCollection(sql,r,p,{phase:'drafting',members});
}
