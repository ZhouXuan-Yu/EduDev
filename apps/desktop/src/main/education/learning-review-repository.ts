import {randomUUID,createHash} from 'node:crypto';
import type {StudentContextRepository} from '../students/context-repository';
import {LEARNING_REVIEW_SCHEMA,LEARNING_HISTORY_PAGE_SIZE,validLearningDraft,type LearningHistoryInput,type LearningHistoryPage,type LearningHistoryItem,type LearningReviewDraft,type LearningReviewSummary,type LearningReviewView,type LearningReviewDecision} from '../../shared/learning-review';
import {collectLearningEvidence} from './learning-evidence';
import {trainingSourcesMatch} from './training-plan';
import {STUDENT_CONTEXT_SCHEMA} from '../../shared/student-context';
import {STUDENT_TRAINING_SCHEMA,type StudentTrainingInput,type StudentTrainingSource,type StudentTrainingResultInput,type StudentTrainingView,type StudentTrainingReceipt,type StudentTrainingEvidence} from '../../shared/student-training';
import type {LearningRecordInput} from '../../shared/contracts';
import type {PracticeReviewView} from '../../shared/practice-review';
import {savedPracticeResult} from '../../shared/practice-result';
import {preparePracticeResult} from './practice-result';
type Row=Record<string,unknown>;
export type LearningSql={all:(sql:string,params?:(string|number|null)[])=>Promise<Row[]>;run:(sql:string,params?:(string|number|null)[])=>Promise<void>;snapshot:StudentContextRepository['learningSnapshot'];createRecord?:(input:LearningRecordInput,id:string)=>Promise<unknown>;practiceSource?:(studentId:string,exerciseId:string)=>Promise<PracticeReviewView>};
type Host=LearningSql&{transaction:<T>(work:(sql:LearningSql)=>Promise<T>)=>Promise<T>};
export type LearningReviewPayload={schemaVersion:typeof LEARNING_REVIEW_SCHEMA;callId:string;studentId:string;subject:string|null;fingerprint:string;recordId?:string;sourceVersion?:string;previousVersion:number;previousRetention:number;draft:LearningReviewDraft;heuristic?:LearningReviewView['heuristic']};
type Effect={planFingerprint?:string;version:number;draft:LearningReviewDraft;sourceVersion?:string;recordId?:string;digest:string};
const ACTION='pi_student_learning_change';
const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const summary=(r:Row):LearningReviewSummary=>({id:String(r.id),runId:String(r.run_id),state:r.status as LearningReviewSummary['state'],kind:(JSON.parse(String(r.payload_json)) as LearningReviewPayload).draft.kind,version:r.status==='confirmed'?Number(JSON.parse(String(r.result_json)).version):0});
/** Existing confirmation table is both immutable annotation history and strategy ledger. No practice event is added. */
export class LearningReviewRepository{
 private readonly host:Host;
 constructor(host:Host){this.host=host;}
 private async authorize(sql:LearningSql,sessionId:string,studentId?:string){
  const rows=await sql.all(`SELECT s.student_id,t.status FROM ai_conversation_sessions s JOIN students t ON t.id=s.student_id WHERE s.id=? AND s.archived_at IS NULL`,[sessionId]);
  if(!rows[0]||rows[0].status!=='active'||studentId&&rows[0].student_id!==studentId)throw new Error('permission_denied');return String(rows[0].student_id);
 }
 private async get(sql:LearningSql,sessionId:string,id:string){const row=(await sql.all(`SELECT * FROM ai_confirmation_items WHERE id=? AND session_id=? AND action_type=?`,[id,sessionId,ACTION]))[0];if(!row)throw new Error('permission_denied');await this.authorize(sql,sessionId,String(row.student_id));return row;}
 private async effects(sql:LearningSql,studentId:string){
  const rows=await sql.all(`SELECT * FROM ai_confirmation_items WHERE student_id=? AND action_type=? AND status='confirmed' ORDER BY confirmed_at,id`,[studentId,ACTION]);
  if(rows.length>20000)throw new Error('unavailable');
  return rows.map(row=>{
   const p=JSON.parse(String(row.payload_json)) as LearningReviewPayload,e=JSON.parse(String(row.result_json)) as Effect;
   const planBasis=e.draft?.kind==='strategy'&&e.draft.plan?{planFingerprint:e.planFingerprint}:{};
   if(p.schemaVersion!==LEARNING_REVIEW_SCHEMA||p.studentId!==studentId||!validLearningDraft(p.draft)||!validLearningDraft(e.draft)||!Number.isSafeInteger(e.version)||e.version<=0||e.draft.kind!==p.draft.kind||e.recordId!==p.recordId||e.sourceVersion!==p.sourceVersion||e.digest!==hash({id:row.id,studentId,version:e.version,draft:e.draft,recordId:p.recordId,sourceVersion:p.sourceVersion,...planBasis})||e.draft.kind==='strategy'&&e.draft.plan&&e.planFingerprint!==p.fingerprint)throw new Error('unavailable');
   return{...e,subject:p.subject,confirmationId:String(row.id),sessionId:String(row.session_id),confirmedAt:String(row.confirmed_at),proposal:p.draft,previousRetention:p.previousRetention};
  }).sort((a,b)=>a.version-b.version);
 }
 async state(studentId:string,subject:string|null=null,sql:LearningSql=this.host){
  const effects=await this.effects(sql,studentId),strategies=effects.filter(e=>e.draft.kind==='strategy'&&(e.subject===null||e.subject===subject));
  const last=strategies.at(-1),training=strategies.filter(e=>e.draft.kind==='strategy'&&e.draft.plan).at(-1);return{...(training?{trainingPlan:training}:{}),version:effects.at(-1)?.version||0,desiredRetention:last?.draft.kind==='strategy'?last.draft.desiredRetention:.9,assessments:effects.filter(e=>e.draft.kind==='assessment'),strategies};
 }
 async list(sessionId:string){await this.authorize(this.host,sessionId);return(await this.host.all(`SELECT * FROM ai_confirmation_items WHERE session_id=? AND action_type=? ORDER BY created_at,id`,[sessionId,ACTION])).map(summary);}
 private async training(sql:LearningSql,studentId:string){
  if(!(await sql.all(`SELECT id FROM students WHERE id=? AND status='active'`,[studentId]))[0])throw new Error('permission_denied');
  const effects=await this.effects(sql,studentId),saved=effects.filter(e=>e.draft.kind==='strategy'&&e.draft.plan).at(-1);
  const facts=await sql.snapshot(studentId,saved?.subject?{subject:saved.subject}:{});
  return{saved,facts,effects,sourceCurrent:Boolean(saved&&saved.planFingerprint===facts.fingerprint),strategyCurrent:Boolean(saved&&saved.version===effects.at(-1)?.version)};
 }
 private trainingSources(state:Awaited<ReturnType<LearningReviewRepository['training']>>){
  const {saved,facts}=state;if(!saved||saved.draft.kind!=='strategy'||!saved.draft.plan)return[];
  const used=new Set(saved.draft.plan.days.map(d=>d.pointId));
  return collectLearningEvidence(facts,Date.now()/1000).points.filter(t=>used.has(t.id)).flatMap(t=>t.records.slice(-1));
 }
 /** Traditional teacher workspace, not model authorization or a second plan store. */
 async trainingView(input:StudentTrainingInput):Promise<StudentTrainingView>{return this.host.transaction(async sql=>{
  const state=await this.training(sql,input.studentId),{saved,facts}=state;if(!saved||saved.draft.kind!=='strategy'||!saved.draft.plan)return{results:[],totalResults:0};
  const knownPlans=new Map(state.effects.filter(e=>e.draft.kind==='strategy'&&e.draft.plan).map(e=>[e.confirmationId,e.version]));
  const results=facts.records.flatMap(e=>{try{const meta=JSON.parse(e.record.content);return meta.schemaVersion==='xiaozhi.education.training-result.v1'&&knownPlans.get(meta.planId)===meta.planVersion&&Number.isInteger(meta.day)&&meta.day>=1&&meta.day<=14&&['correct','incorrect','partial'].includes(meta.result)?[{recordId:e.record.id,planVersion:meta.planVersion,day:meta.day,result:meta.result as StudentTrainingResultInput['result'],occurredAt:e.record.occurredAt,notes:String(meta.notes||''),...(savedPracticeResult(meta.practice)?{practice:savedPracticeResult(meta.practice)}:{})}]:[];}catch{return[];}});
  return{plan:{id:saved.confirmationId,version:saved.version,confirmedAt:saved.confirmedAt,plan:saved.draft.plan,reason:saved.draft.reason,sourceCurrent:state.sourceCurrent,strategyCurrent:state.strategyCurrent,sources:this.trainingSources(state).map(e=>({title:e.record.title,reference:{schemaVersion:STUDENT_TRAINING_SCHEMA,studentId:input.studentId,planId:saved.confirmationId,recordId:e.record.id,version:e.version}}))},results:results.slice(0,10),totalResults:results.length};
 });}
 async trainingSource(input:StudentTrainingSource):Promise<StudentTrainingEvidence>{return this.host.transaction(async sql=>{
  const state=await this.training(sql,input.studentId);if(state.saved?.confirmationId!==input.planId)throw new Error('source_changed');
  const entry=this.trainingSources(state).find(e=>e.record.id===input.recordId&&e.version===input.version);if(!entry)throw new Error('source_changed');
  return{student:state.facts.student,record:entry.record};
 });}
 async recordTrainingResult(input:StudentTrainingResultInput):Promise<StudentTrainingReceipt>{return this.host.transaction(async sql=>{
  const state=await this.training(sql,input.studentId),id='record_'+input.requestId;
  const requestDigest=hash({studentId:input.studentId,planId:input.planId,planVersion:input.planVersion,day:input.day,result:input.result,occurredAt:input.occurredAt,notes:input.notes,...(input.practice?{practice:input.practice}:{})});
  const previous=(await sql.all(`SELECT student_id,content,occurred_at,created_at,updated_at FROM learning_records WHERE id=?`,[id]))[0];
  if(previous){let meta;try{meta=JSON.parse(String(previous.content));}catch{throw new Error('conflict');}const actual=savedPracticeResult(meta.practice);if(input.practice){if(!actual)throw new Error('conflict');const {title:_title,...savedInput}=actual;if(hash(savedInput)!==hash(input.practice))throw new Error('conflict');}else if(meta.practice!==undefined)throw new Error('conflict');if(previous.student_id!==input.studentId||meta.schemaVersion!=='xiaozhi.education.training-result.v1'||meta.requestDigest!==requestDigest||previous.created_at!==previous.updated_at||previous.occurred_at!==input.occurredAt||meta.result!==input.result||meta.notes!==input.notes||meta.planId!==input.planId||meta.planVersion!==input.planVersion||meta.day!==input.day)throw new Error('conflict');return{recordId:id,duplicate:true};}
  const {saved}=state;if(!saved||saved.confirmationId!==input.planId||saved.version!==input.planVersion||saved.draft.kind!=='strategy'||!saved.draft.plan)throw new Error('conflict');
  if((!state.sourceCurrent||!state.strategyCurrent)&&input.allowHistorical!==true)throw new Error('source_changed');
  const day=saved.draft.plan.days.find(d=>d.day===input.day),topic=saved.draft.plan.topics.find(t=>t.id===day?.pointId);if(!day||day.activity==='rest'||!topic)throw new Error('invalid_input');
  const practice=input.practice?await preparePracticeResult(input.studentId,input.practice,topic,input.result,sql.practiceSource):undefined;
  if(!sql.createRecord)throw new Error('unavailable');
  const content={schemaVersion:'xiaozhi.education.training-result.v1',requestDigest,planId:saved.confirmationId,planVersion:saved.version,day:day.day,knowledgePoint:topic.name,knowledgeType:topic.type,result:input.result,notes:input.notes,type:['concept','design'].includes(topic.type)?'mastery_assessment':'practice_result',...(practice?{practice}:{})};
  await sql.createRecord({studentId:input.studentId,recordType:'practice',subject:topic.subject,title:`${topic.name} · 第${day.day}天学习结果`,content:JSON.stringify(content),tags:['训练结果'],occurredAt:input.occurredAt},id);
  return{recordId:id,duplicate:false};
 });}
 /** Read-only teacher view across conversations. Historical source versions never grant current fact authority. */
 async history(input:LearningHistoryInput):Promise<LearningHistoryPage>{
  return this.host.transaction(async sql=>{
   const studentId=await this.authorize(sql,input.sessionId),effects=await this.effects(sql,studentId);
   if(new Set(effects.map(e=>e.version)).size!==effects.length)throw new Error('unavailable');
   const facts=await sql.snapshot(studentId),eligible=effects.filter(e=>input.beforeVersion===undefined||e.version<input.beforeVersion).reverse(),page=eligible.slice(0,LEARNING_HISTORY_PAGE_SIZE);
   const fingerprints=new Map<string|null,string>([[null,facts.fingerprint]]);
   for(const e of page)if(e.draft.kind==='strategy'&&e.draft.plan&&!fingerprints.has(e.subject))fingerprints.set(e.subject,(await sql.snapshot(studentId,e.subject?{subject:e.subject}:{})).fingerprint);
   const items:LearningHistoryItem[]=page.map(e=>{
    const source=e.recordId?facts.records.find(r=>r.record.id===e.recordId):undefined;
    const previous=effects.filter(p=>p.version<e.version&&p.draft.kind===e.draft.kind&&(e.draft.kind==='assessment'?p.recordId===e.recordId&&p.sourceVersion===e.sourceVersion:p.subject===null||p.subject===e.subject)).at(-1);
    return{id:e.confirmationId,version:e.version,confirmedAt:e.confirmedAt,sameConversation:e.sessionId===input.sessionId,subject:e.subject,draft:e.draft,proposal:e.proposal,previousRetention:e.previousRetention,...(previous?{previous:{version:previous.version,draft:previous.draft}}:{}),...(e.draft.kind==='strategy'&&e.draft.plan?{planCurrent:e.planFingerprint===fingerprints.get(e.subject)&&e.version===effects.at(-1)?.version}:{}),sourceStatus:e.draft.kind==='strategy'&&e.draft.plan?(e.planFingerprint===fingerprints.get(e.subject)?'current':'changed'):!e.recordId?'not_applicable':!source?'missing':source.version===e.sourceVersion?'current':'changed',...(source?{source:{title:source.record.title,reference:{schemaVersion:STUDENT_CONTEXT_SCHEMA,sessionId:input.sessionId,recordId:source.record.id,version:source.version}}}:{})};
   });
   return{items,total:effects.length,latestVersion:effects.at(-1)?.version||0,nextBeforeVersion:eligible.length>page.length?page.at(-1)!.version:null};
  });
 }
 async propose(sessionId:string,runId:string,callId:string,facts:Awaited<ReturnType<StudentContextRepository['learningSnapshot']>>&{reviewVersion:number},draft:LearningReviewDraft,recordId?:string,heuristic?:LearningReviewView['heuristic']){
  if(!validLearningDraft(draft)||!callId||callId.length>128||draft.kind==='assessment'&&!recordId||draft.kind==='strategy'&&recordId)throw new Error('invalid_input');
  return this.host.transaction(async sql=>{
   const studentId=await this.authorize(sql,sessionId,facts.student.id),existing=(await sql.all(`SELECT * FROM ai_confirmation_items WHERE session_id=? AND run_id=? AND action_type=? AND json_extract(payload_json,'$.callId')=?`,[sessionId,runId,ACTION,callId]))[0];
   if(existing)return summary(existing);
   // Existing Pi runs historically leave student_id empty. Session binding is the authority;
   // a nonempty conflicting legacy run binding still refuses admission.
   const run=(await sql.all(`SELECT id,student_id FROM ai_agent_runs WHERE id=? AND session_id=?`,[runId,sessionId]))[0];if(!run||run.student_id&&run.student_id!==studentId)throw new Error('permission_denied');
   const current=await sql.snapshot(studentId,facts.subject?{subject:facts.subject}:{});if(current.fingerprint!==facts.fingerprint)throw new Error('source_changed');
   const source=current.records.find(e=>e.record.id===recordId);if(recordId&&!source)throw new Error('source_changed');
   const state=await this.state(studentId,facts.subject,sql);if(state.version!==facts.reviewVersion)throw new Error('conflict');
   if(draft.kind==='strategy'&&draft.plan&&!trainingSourcesMatch(draft.plan,current))throw new Error('source_changed');
   const id='xilearning_'+randomUUID(),timestamp=new Date().toISOString();
   const payload:LearningReviewPayload={schemaVersion:LEARNING_REVIEW_SCHEMA,callId,studentId,subject:facts.subject,fingerprint:facts.fingerprint,previousVersion:state.version,previousRetention:state.desiredRetention,draft,...(heuristic?{heuristic}:{}),...(source?{recordId,sourceVersion:source.version}:{})};
   await sql.run(`INSERT INTO ai_confirmation_items (id,run_id,session_id,student_id,action_type,status,title,payload_json,created_at,updated_at) VALUES (?,?,?,?,?,'pending',?,?,?,?)`,[id,runId,sessionId,studentId,ACTION,draft.kind==='assessment'?'核对学习结果':'核对复习策略',JSON.stringify(payload),timestamp,timestamp]);
   return summary(await this.get(sql,sessionId,id));
  });
 }
 async review(sessionId:string,id:string):Promise<LearningReviewView>{
  const row=await this.get(this.host,sessionId,id),p=JSON.parse(String(row.payload_json)) as LearningReviewPayload;
  const facts=await this.host.snapshot(p.studentId,p.subject?{subject:p.subject}:{}),source=facts.records.find(e=>e.record.id===p.recordId);
  if(row.status==='pending'&&facts.fingerprint!==p.fingerprint||p.recordId&&(!source||source.version!==p.sourceVersion))throw new Error('source_changed');
  const state=await this.state(p.studentId,p.subject),saved=row.status==='confirmed'?[...state.assessments,...state.strategies].find(e=>e.confirmationId===id):undefined;
  if(row.status==='confirmed'&&!saved)throw new Error('unavailable');
  const draft=saved?.draft||p.draft,plan=draft.kind==='strategy'?draft.plan:undefined;
  const used=new Set(plan?.days.map(d=>d.pointId)),entries=plan?collectLearningEvidence(facts,Date.now()/1000).points.filter(t=>used.has(t.id)).flatMap(t=>t.records.slice(-1)):[];
  return{...summary(row),draft,...(plan?{planCurrent:(saved?.planFingerprint||p.fingerprint)===facts.fingerprint&&(!saved||saved.version===state.version),planSources:entries.map(e=>({title:e.record.title,reference:{schemaVersion:STUDENT_CONTEXT_SCHEMA,sessionId,recordId:e.record.id,version:e.version}}))}:{}),previousRetention:p.previousRetention,previousVersion:p.previousVersion,...(p.heuristic?{heuristic:p.heuristic}:{}),...(source?{source:{title:source.record.title,content:source.record.content,subject:source.record.subject,occurredAt:source.record.occurredAt}}:{})};
 }
 async decide(input:LearningReviewDecision,isCurrent:()=>boolean=()=>true,afterWrite?:(isCurrent:()=>boolean)=>Promise<void>){
  return this.host.transaction(async sql=>{
   if(!isCurrent())throw new Error('cancelled');const row=await this.get(sql,input.sessionId,input.id),p=JSON.parse(String(row.payload_json)) as LearningReviewPayload;
   if(!isCurrent())throw new Error('cancelled');
   if(row.status!=='pending'){if(input.action==='reject'&&row.status==='rejected'||input.action==='confirm'&&row.status==='confirmed'&&JSON.stringify((JSON.parse(String(row.result_json)) as Effect).draft)===JSON.stringify(input.draft))return summary(row);throw new Error('conflict');}
   const timestamp=new Date().toISOString();
   if(input.action==='reject'){await sql.run(`UPDATE ai_confirmation_items SET status='rejected',rejected_at=?,updated_at=? WHERE id=? AND status='pending'`,[timestamp,timestamp,input.id]);const saved=await this.get(sql,input.sessionId,input.id);if(!isCurrent())throw new Error('cancelled');return summary(saved);}
   if(!validLearningDraft(input.draft)||input.draft.kind!==p.draft.kind)throw new Error('invalid_input');
   const facts=await sql.snapshot(p.studentId,p.subject?{subject:p.subject}:{});if(facts.fingerprint!==p.fingerprint)throw new Error('source_changed');
   const state=await this.state(p.studentId,p.subject,sql);if(state.version!==p.previousVersion)throw new Error('conflict');
   if(input.draft.kind==='strategy'&&Boolean(input.draft.plan)!==Boolean(p.draft.kind==='strategy'&&p.draft.plan))throw new Error('invalid_input');
   if(input.draft.kind==='strategy'&&input.draft.plan&&!trainingSourcesMatch(input.draft.plan,facts))throw new Error('source_changed');
   const effect={version:state.version+1,draft:input.draft,recordId:p.recordId,sourceVersion:p.sourceVersion,...(input.draft.kind==='strategy'&&input.draft.plan?{planFingerprint:p.fingerprint}:{})};
   if(!isCurrent())throw new Error('cancelled');
   await sql.run(`UPDATE ai_confirmation_items SET status='confirmed',result_json=?,confirmed_at=?,updated_at=? WHERE id=? AND status='pending'`,[JSON.stringify({...effect,digest:hash({id:input.id,studentId:p.studentId,...effect})}),timestamp,timestamp,input.id]);
   await afterWrite?.(isCurrent);
   const saved=await this.get(sql,input.sessionId,input.id);
   if(!isCurrent())throw new Error('cancelled');return summary(saved);
  });
 }
}
