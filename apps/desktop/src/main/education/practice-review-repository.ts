import {randomUUID,createHash} from 'node:crypto';
import type {ExerciseSet,ExerciseSetDraftPayload,QuestionBankItem} from '../../shared/contracts';
import {QUESTION_CONTEXT_SCHEMA,validQuestionContextSource,type QuestionContextSource} from '../../shared/question-context';
import {PRACTICE_REVIEW_SCHEMA,validPracticeDraft,type PracticeReviewDraft,type PracticeReviewSummary,type PracticeReviewDecision,type PracticeReviewView} from '../../shared/practice-review';
import {questionFacts,questionVersion} from './question-context-provider';
export type PracticeReviewSql={all:(sql:string,params?:(string|number|null)[])=>Promise<Record<string,unknown>[]>;run:(sql:string,params?:(string|number|null)[])=>Promise<void>;read:(id:string)=>Promise<QuestionBankItem|undefined>;save:(studentId:string,draft:ExerciseSetDraftPayload)=>Promise<ExerciseSet>;exercises:(studentId:string)=>Promise<ExerciseSet[]>;lineage:(studentId:string,questionId:string)=>Promise<QuestionContextSource[]>};
export type PracticeSourceSql=Pick<PracticeReviewSql,'all'|'read'|'exercises'>;
type Host=PracticeReviewSql&{transaction:<T>(work:(sql:PracticeReviewSql)=>Promise<T>)=>Promise<T>};
type Payload={schemaVersion:typeof PRACTICE_REVIEW_SCHEMA;callId:string;studentId:string;draft:PracticeReviewDraft;questions:{question:QuestionBankItem;parents:QuestionContextSource[]}[]};
type Effect={schemaVersion:typeof PRACTICE_REVIEW_SCHEMA;draft:PracticeReviewDraft;exercise:ExerciseSet;digest:string};
const ACTION='pi_practice_candidate',hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const ref=(q:QuestionBankItem):QuestionContextSource=>({schemaVersion:QUESTION_CONTEXT_SCHEMA,questionId:q.id,version:questionVersion(q)});
const summary=(r:Record<string,unknown>,p:Payload):PracticeReviewSummary=>({id:String(r.id),runId:String(r.run_id),callId:p.callId,state:r.status as PracticeReviewSummary['state'],count:r.status==='confirmed'?JSON.parse(String(r.result_json)).draft.items.length:p.draft.items.length});
/** Exercise snapshots and usage remain in the existing SQLite, through the original writer. */
export class PracticeReviewRepository{
 private readonly host:Host;
 constructor(host:Host){this.host=host;}
 private async student(sql:PracticeSourceSql,studentId:string){const s=(await sql.all('SELECT display_name,status FROM students WHERE id=?',[studentId]))[0];if(!s||s.status!=='active')throw new Error('permission_denied');return String(s.display_name||'当前学生');}
 private async authorize(sql:PracticeReviewSql,sessionId:string,studentId?:string){const row=(await sql.all('SELECT student_id FROM ai_conversation_sessions WHERE id=? AND archived_at IS NULL',[sessionId]))[0];if(!row?.student_id||studentId!==undefined&&row.student_id!==studentId)throw new Error('permission_denied');const id=String(row.student_id);await this.student(sql,id);return id;}
 private payload(r:Record<string,unknown>):Payload{const p=JSON.parse(String(r.payload_json));if(p.schemaVersion!==PRACTICE_REVIEW_SCHEMA||p.studentId!==r.student_id||!validPracticeDraft(p.draft)||!Array.isArray(p.questions)||p.questions.length<1||p.questions.length>8||p.draft.items.some((i:{index:number})=>i.index>=p.questions.length)||!['pending','confirmed','rejected'].includes(String(r.status)))throw new Error('unavailable');return p;}
 private effect(r:Record<string,unknown>,p:Payload):Effect{const e=JSON.parse(String(r.result_json));if(e.schemaVersion!==PRACTICE_REVIEW_SCHEMA||!validPracticeDraft(e.draft)||!e.exercise||e.exercise.studentId!==p.studentId||e.exercise.items?.length!==e.draft.items.length||e.digest!==hash({id:r.id,sessionId:r.session_id,proposal:hash(p),draft:e.draft,exercise:e.exercise}))throw new Error('unavailable');return e;}
 private async get(sql:PracticeReviewSql,sessionId:string,id:string){const r=(await sql.all('SELECT * FROM ai_confirmation_items WHERE id=? AND session_id=? AND action_type=?',[id,sessionId,ACTION]))[0];if(!r)throw new Error('permission_denied');const p=this.payload(r);await this.authorize(sql,sessionId,p.studentId);return{r,p};}
 private async current(sql:PracticeSourceSql,p:Payload){for(const {question:q}of p.questions){const live=await sql.read(q.id);if(!live||questionVersion(live)!==questionVersion(q))return false;}return true;}
 private async view(sql:PracticeSourceSql,r:Record<string,unknown>,p:Payload):Promise<PracticeReviewView>{const e=r.status==='confirmed'?this.effect(r,p):undefined;return{...summary(r,p),studentLabel:await this.student(sql,p.studentId),draft:e?.draft||p.draft,sourceCurrent:await this.current(sql,p),questions:p.questions.map(q=>({...q,source:ref(q.question)})),...(e?{exercise:e.exercise,exerciseVersion:hash(e.exercise)}:{})};}
 async list(sessionId:string){await this.authorize(this.host,sessionId);return(await this.host.all('SELECT * FROM ai_confirmation_items WHERE session_id=? AND action_type=? ORDER BY created_at,id',[sessionId,ACTION])).map(r=>{const p=this.payload(r);if(r.status==='confirmed')this.effect(r,p);return summary(r,p);});}
 async propose(sessionId:string,runId:string,callId:string,draft:PracticeReviewDraft,sources:QuestionContextSource[],isCurrent:()=>boolean){
  if(!validPracticeDraft(draft)||sources.length<1||sources.length>8||sources.some(s=>!validQuestionContextSource(s))||new Set(sources.map(s=>s.questionId)).size!==sources.length||draft.items.length!==sources.length||draft.items.some((i,n)=>i.index!==n)||!callId||callId.length>128)throw new Error('invalid_input');
  return this.host.transaction(async sql=>{
   // Pi's run ledger may omit student_id; the active session binding remains the authority.
   // An explicit conflicting run binding still refuses, and run/session ownership must match.
   if(!isCurrent())throw new Error('cancelled');const studentId=await this.authorize(sql,sessionId);const run=(await sql.all('SELECT student_id FROM ai_agent_runs WHERE id=? AND session_id=?',[runId,sessionId]))[0];if(!run||run.student_id&&run.student_id!==studentId)throw new Error('permission_denied');
   const questions=[];for(const s of sources){const q=await sql.read(s.questionId);if(!q||questionVersion(q)!==s.version)throw new Error('source_changed');if(!q.stem.trim()||!q.answer.trim()||!q.analysis.trim()||q.stem.length>12000||q.answer.length>8000||q.analysis.length>12000)throw new Error('invalid_input');questions.push({question:questionFacts(q),parents:await sql.lineage(studentId,q.id)});}
   const p:Payload={schemaVersion:PRACTICE_REVIEW_SCHEMA,studentId,callId,draft,questions};const prior=(await sql.all(`SELECT * FROM ai_confirmation_items WHERE session_id=? AND run_id=? AND action_type=? AND json_extract(payload_json,'$.callId')=?`,[sessionId,runId,ACTION,callId]))[0];
   if(prior){if(String(prior.payload_json)!==JSON.stringify(p))throw new Error('conflict');if(!isCurrent())throw new Error('cancelled');return summary(prior,p);}
   const id='xipractice_'+randomUUID(),at=new Date().toISOString();await sql.run(`INSERT INTO ai_confirmation_items (id,run_id,session_id,student_id,action_type,status,title,payload_json,created_at,updated_at) VALUES (?,?,?,?,?,'pending',?,?,?,?)`,[id,runId,sessionId,studentId,ACTION,draft.title,JSON.stringify(p),at,at]);const saved=await this.get(sql,sessionId,id);if(!isCurrent())throw new Error('cancelled');return summary(saved.r,saved.p);
  });
 }
 async review(sessionId:string,id:string){return this.host.transaction(async sql=>{const {r,p}=await this.get(sql,sessionId,id);return this.view(sql,r,p);});}
 async latest(sessionId:string){const studentId=await this.authorize(this.host,sessionId);const r=(await this.host.all(`SELECT result_json FROM ai_confirmation_items WHERE student_id=? AND action_type=? AND status='confirmed' ORDER BY confirmed_at DESC,id DESC LIMIT 1`,[studentId,ACTION]))[0];const value=r?await this.source(studentId,JSON.parse(String(r.result_json)).exercise.id):undefined;await this.authorize(this.host,sessionId,studentId);return value;}
 async source(studentId:string,exerciseId:string){return this.host.transaction(sql=>this.sourceOn(sql,studentId,exerciseId));}
 /** Reuse the caller transaction for result/source validation, without opening another connection. */
 async sourceOn(sql:PracticeSourceSql,studentId:string,exerciseId:string){
  await this.student(sql,studentId);const rows=await sql.all(`SELECT * FROM ai_confirmation_items WHERE student_id=? AND action_type=? AND status='confirmed' AND json_extract(result_json,'$.exercise.id')=?`,[studentId,ACTION,exerciseId]);if(rows.length!==1)throw new Error('unavailable');const r=rows[0],p=this.payload(r),e=this.effect(r,p),actual=(await sql.exercises(studentId)).find(s=>s.id===exerciseId);if(!actual)throw new Error('source_changed');const {reviewSource:_overlay,...facts}=actual;if(hash(facts)!==hash(e.exercise))throw new Error('source_changed');return this.view(sql,r,p);
 }
 async decide(input:PracticeReviewDecision,isCurrent:()=>boolean,afterWrite?:()=>Promise<void>){return this.host.transaction(async sql=>{
  const lease=()=>{if(!isCurrent())throw new Error('cancelled');};lease();const{r,p}=await this.get(sql,input.sessionId,input.id);lease();
  if(r.status!=='pending'){if(r.status==='rejected'&&input.action==='reject')return summary(r,p);if(r.status==='confirmed'&&input.action==='confirm'&&JSON.stringify(this.effect(r,p).draft)===JSON.stringify(input.draft))return summary(r,p);throw new Error('conflict');}
  const at=new Date().toISOString();if(input.action==='reject'){await sql.run(`UPDATE ai_confirmation_items SET status='rejected',rejected_at=?,updated_at=? WHERE id=? AND status='pending'`,[at,at,input.id]);lease();return{...summary(r,p),state:'rejected' as const};}
  const d=input.draft;if(!validPracticeDraft(d)||d.items.some(i=>i.index>=p.questions.length))throw new Error('invalid_input');if(!await this.current(sql,p))throw new Error('source_changed');lease();
  const items=d.items.map(i=>{const q=p.questions[i.index].question;return{role:i.role,questionId:q.id,sourceKind:q.sourceKind,stem:q.stem,answer:q.answer,analysis:q.analysis,knowledgePoint:q.knowledgePoint,difficulty:q.difficulty,teacherObservation:i.teacherObservation};});
  const contentMd='# '+d.title+'\n\n'+d.reason+'\n\n'+items.map((q,i)=>`## 第${i+1}题\n\n${q.stem}\n\n答案：${q.answer}\n\n解析：${q.analysis}\n\n教师观察：${q.teacherObservation}`).join('\n\n');
  const exercise=await sql.save(p.studentId,{title:d.title,subject:d.subject,knowledgePoint:d.knowledgePoint,contentMd,items,sourceQuestionIds:items.map(q=>q.questionId)});lease();
  const e:Effect={schemaVersion:PRACTICE_REVIEW_SCHEMA,draft:d,exercise,digest:hash({id:r.id,sessionId:r.session_id,proposal:hash(p),draft:d,exercise})};await sql.run(`UPDATE ai_confirmation_items SET status='confirmed',result_json=?,confirmed_at=?,updated_at=? WHERE id=? AND status='pending'`,[JSON.stringify(e),at,at,input.id]);await afterWrite?.();const saved=await this.get(sql,input.sessionId,input.id);lease();return summary(saved.r,saved.p);
 });}
}
