import {randomUUID,createHash} from 'node:crypto';
import type {QuestionBankItem,QuestionBankItemInput} from '../../shared/contracts';
import {QUESTION_CONTEXT_SCHEMA,validQuestionContextSource,type QuestionContextSource} from '../../shared/question-context';
import {QUESTION_REVIEW_SCHEMA,validQuestionReviewDraft,type QuestionReviewDraft,type QuestionReviewSummary,type QuestionReviewView,type QuestionReviewDecision} from '../../shared/question-review';
import {normalizeQuestionDraft} from './question-host';
import {questionFacts,questionVersion} from './question-context-provider';
export type QuestionReviewSql={all:(sql:string,params?:(string|number|null)[])=>Promise<Record<string,unknown>[]>;run:(sql:string,params?:(string|number|null)[])=>Promise<void>;read:(id:string)=>Promise<QuestionBankItem|undefined>;create:(input:QuestionBankItemInput)=>Promise<QuestionBankItem>};
type Host=QuestionReviewSql&{transaction:<T>(work:(sql:QuestionReviewSql)=>Promise<T>)=>Promise<T>};
type Payload={schemaVersion:typeof QUESTION_REVIEW_SCHEMA;callId:string;studentId:string;draft:QuestionReviewDraft;sources:QuestionBankItem[]};
type Effect={schemaVersion:typeof QUESTION_REVIEW_SCHEMA;draft:QuestionReviewDraft;saved:QuestionContextSource[];digest:string};
const ACTION='pi_question_candidate',hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const source=(q:QuestionBankItem):QuestionContextSource=>({schemaVersion:QUESTION_CONTEXT_SCHEMA,questionId:q.id,version:questionVersion(q)});
const summary=(r:Record<string,unknown>):QuestionReviewSummary=>{const p=JSON.parse(String(r.payload_json)) as Payload;return{id:String(r.id),runId:String(r.run_id),callId:p.callId,state:r.status as QuestionReviewSummary['state'],count:p.draft.items.length};};
export async function validateQuestionReviewFormat(draft:QuestionReviewDraft,signal:AbortSignal){
 if(!validQuestionReviewDraft(draft))throw new Error('invalid_input');
 const output=[];
 for(const q of draft.items){signal.throwIfAborted();output.push(await normalizeQuestionDraft({questionType:q.questionType,raw:JSON.stringify({question_type:q.questionType,question:q.stem,correct_answer:q.answer,explanation:q.analysis,options:q.options})},signal));}
 return output;
}
/** Immutable proposals/teacher versions in the existing ledger; fact writers share its transaction. */
export class QuestionReviewRepository{
 private readonly host:Host;
 constructor(host:Host){this.host=host;}
 private async authorize(sql:QuestionReviewSql,sessionId:string,studentId?:string){
  const r=(await sql.all(`SELECT s.student_id,t.status FROM ai_conversation_sessions s LEFT JOIN students t ON t.id=s.student_id WHERE s.id=? AND s.archived_at IS NULL`,[sessionId]))[0];
  if(!r||r.student_id&&r.status!=='active'||studentId!==undefined&&studentId!==r.student_id)throw new Error('permission_denied');return String(r.student_id||'');
 }
 private async get(sql:QuestionReviewSql,sessionId:string,id:string){
  const r=(await sql.all(`SELECT * FROM ai_confirmation_items WHERE id=? AND session_id=? AND action_type=?`,[id,sessionId,ACTION]))[0];if(!r)throw new Error('permission_denied');
  await this.authorize(sql,sessionId,String(r.student_id));const p=JSON.parse(String(r.payload_json)) as Payload;
  if(p.schemaVersion!==QUESTION_REVIEW_SCHEMA||p.studentId!==r.student_id||!validQuestionReviewDraft(p.draft)||!Array.isArray(p.sources)||p.sources.length<1||p.sources.length>8||!['pending','confirmed','rejected'].includes(String(r.status)))throw new Error('unavailable');return{r,p};
 }
 private async sourcesCurrent(sql:QuestionReviewSql,p:Payload){for(const q of p.sources){const current=await sql.read(q.id);if(!current||questionVersion(current)!==questionVersion(q))return false;}return true;}
 private effect(r:Record<string,unknown>,p:Payload){const e=JSON.parse(String(r.result_json)) as Effect;
  if(e.schemaVersion!==QUESTION_REVIEW_SCHEMA||!validQuestionReviewDraft(e.draft)||!Array.isArray(e.saved)||e.saved.some(s=>!validQuestionContextSource(s))||e.saved.length!==e.draft.items.length||e.digest!==hash({id:r.id,sessionId:r.session_id,studentId:p.studentId,proposalSha256:hash(p),parents:p.sources.map(source),draft:e.draft,saved:e.saved}))throw new Error('unavailable');return e;}
 async list(sessionId:string){await this.authorize(this.host,sessionId);return(await this.host.all(`SELECT * FROM ai_confirmation_items WHERE session_id=? AND action_type=? ORDER BY created_at,id`,[sessionId,ACTION])).map(summary);}
 async parentsForStudent(studentId:string,questionId:string):Promise<QuestionContextSource[]>{
  const rows=await this.host.all(`SELECT c.* FROM ai_confirmation_items c WHERE action_type=? AND status='confirmed' AND (student_id='' OR student_id=?) AND EXISTS (SELECT 1 FROM json_each(c.result_json,'$.saved') s WHERE json_extract(s.value,'$.questionId')=?)`,[ACTION,studentId,questionId]);
  const parents:QuestionContextSource[]=[];for(const r of rows){const p=JSON.parse(String(r.payload_json)) as Payload;this.effect(r,p);for(const q of p.sources){const reference=source(q);if(!parents.some(s=>s.questionId===reference.questionId&&s.version===reference.version))parents.push(reference);}}return parents;
 }
 async propose(sessionId:string,runId:string,callId:string,draft:QuestionReviewDraft,parents:QuestionContextSource[],isCurrent:()=>boolean){
  if(!validQuestionReviewDraft(draft)||!callId||callId.length>128||parents.length<1||parents.length>8||parents.some(p=>!validQuestionContextSource(p))||new Set(parents.map(p=>p.questionId)).size!==parents.length)throw new Error('invalid_input');
  return this.host.transaction(async sql=>{
   if(!isCurrent())throw new Error('cancelled');const studentId=await this.authorize(sql,sessionId);
   const run=(await sql.all('SELECT student_id FROM ai_agent_runs WHERE id=? AND session_id=?',[runId,sessionId]))[0];if(!run||run.student_id&&run.student_id!==studentId)throw new Error('permission_denied');
   const snapshots=[];for(const ref of parents){const q=await sql.read(ref.questionId);if(!q||questionVersion(q)!==ref.version)throw new Error('source_changed');snapshots.push(questionFacts(q));}
   const p:Payload={schemaVersion:QUESTION_REVIEW_SCHEMA,callId,studentId,draft,sources:snapshots};
   const prior=(await sql.all(`SELECT * FROM ai_confirmation_items WHERE session_id=? AND run_id=? AND action_type=? AND json_extract(payload_json,'$.callId')=?`,[sessionId,runId,ACTION,callId]))[0];
   if(prior){if(String(prior.payload_json)!==JSON.stringify(p))throw new Error('conflict');if(!isCurrent())throw new Error('cancelled');return summary(prior);}
   const id='xiquestion_'+randomUUID(),at=new Date().toISOString();
   await sql.run(`INSERT INTO ai_confirmation_items (id,run_id,session_id,student_id,action_type,status,title,payload_json,created_at,updated_at) VALUES (?,?,?,?,?,'pending',?,?,?,?)`,[id,runId,sessionId,studentId,ACTION,draft.title,JSON.stringify(p),at,at]);
   const saved=await this.get(sql,sessionId,id);if(!isCurrent())throw new Error('cancelled');return summary(saved.r);
  });
 }
 async review(sessionId:string,id:string):Promise<QuestionReviewView>{return this.host.transaction(async sql=>{
  const {r,p}=await this.get(sql,sessionId,id),e=r.status==='confirmed'?this.effect(r,p):undefined,draft=e?.draft||p.draft;
  const formatted=await validateQuestionReviewFormat(draft,new AbortController().signal);
  return{...summary(r),draft,issues:formatted.map(q=>q.issues),sourceCurrent:await this.sourcesCurrent(sql,p),sources:p.sources.map(q=>({title:q.sourceTitle||q.knowledgePoint||'原题',question:source(q)})),saved:(e?.saved||[]).map((question,i)=>({title:`${draft.title} · 第${i+1}题`,question}))};
 });}
 async decide(input:QuestionReviewDecision,isCurrent:()=>boolean,afterWrite?:(current:()=>boolean)=>Promise<void>){return this.host.transaction(async sql=>{
  const current=()=>{if(!isCurrent())throw new Error('cancelled');};current();const {r,p}=await this.get(sql,input.sessionId,input.id);current();
  if(r.status!=='pending'){
   if(r.status==='rejected'&&input.action==='reject')return summary(r);
   if(r.status==='confirmed'&&input.action==='confirm'&&JSON.stringify(this.effect(r,p).draft)===JSON.stringify(input.draft))return summary(r);throw new Error('conflict');
  }
  const at=new Date().toISOString();
  if(input.action==='reject'){await sql.run(`UPDATE ai_confirmation_items SET status='rejected',rejected_at=?,updated_at=? WHERE id=? AND status='pending'`,[at,at,input.id]);const rejected=await this.get(sql,input.sessionId,input.id);current();return summary(rejected.r);}
  const draft=input.draft;if(!validQuestionReviewDraft(draft)||draft.items.length!==p.draft.items.length||draft.items.some((q,i)=>q.questionType!==p.draft.items[i].questionType))throw new Error('invalid_input');
  if(!await this.sourcesCurrent(sql,p))throw new Error('source_changed');
  const format=await validateQuestionReviewFormat(draft,new AbortController().signal);current();if(format.some(q=>!q.valid))throw new Error('invalid_input');
  // Require the displayed teacher version to already be canonical; no silent post-confirm edits.
  if(format.some(({question:q},i)=>{const shown=draft.items[i];return q.stem!==shown.stem||q.answer!==shown.answer||q.analysis!==shown.analysis||JSON.stringify(q.options)!==JSON.stringify(shown.options);}))throw new Error('invalid_input');
  const saved:QuestionContextSource[]=[];
  for(const q of draft.items){const item=await sql.create({subject:draft.subject,grade:draft.grade,knowledgePoint:draft.knowledgePoint,questionType:q.questionType,difficulty:q.difficulty,stem:q.stem+(q.options?'\n\n'+Object.entries(q.options).map(([k,v])=>`${k}. ${v}`).join('\n'):''),answer:q.answer,analysis:q.analysis,sourceKind:'generated',sourceTitle:draft.title,tags:['教师核对']});current();saved.push(source(item));}
  const effect:Effect={schemaVersion:QUESTION_REVIEW_SCHEMA,draft,saved,digest:hash({id:r.id,sessionId:r.session_id,studentId:p.studentId,proposalSha256:hash(p),parents:p.sources.map(source),draft,saved})};
  await sql.run(`UPDATE ai_confirmation_items SET status='confirmed',result_json=?,confirmed_at=?,updated_at=? WHERE id=? AND status='pending'`,[JSON.stringify(effect),at,at,input.id]);
  await afterWrite?.(isCurrent);const savedRow=await this.get(sql,input.sessionId,input.id);current();return summary(savedRow.r);
 });}
}
