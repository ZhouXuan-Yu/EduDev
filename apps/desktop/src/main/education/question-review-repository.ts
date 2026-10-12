import {generatedQuestionPartCoverage,retainsGeneratedQuestionParts} from '../../shared/generated-question-completeness';
import {questionChoiceText} from '../../shared/question-text';
import {randomUUID,createHash} from 'node:crypto';
import {QuestionCollectionRepository} from './question-collection-repository';
import {QUESTION_COLLECTION_RECORD_SCHEMA,validCollectionId} from '../../shared/question-collection';
import {collectionForQuestion,validateCollectionAppend,attachCollectionGroup,type CollectionScope} from './question-collection-ledger';
import type {QuestionBankItem,QuestionBankItemInput} from '../../shared/contracts';
import {QUESTION_CONTEXT_SCHEMA,validQuestionContextSource,type QuestionContextSource} from '../../shared/question-context';
import {QUESTION_REVIEW_SCHEMA,validQuestionReviewDraft,validQuestionReview,type QuestionReviewDraft,type QuestionReviewSummary,type QuestionReviewView,type QuestionReviewDecision} from '../../shared/question-review';
import {QUESTION_QUALITY_SCHEMA,QUESTION_QUALITY_RECORD_SCHEMA,QUESTION_MATH_QUALITY_SCHEMA,QUESTION_MATH_RECORD_SCHEMA,validQuestionQuality,type QuestionQualityReview} from '../../shared/question-quality';
import {createQuestionMathPlans,validQuestionMathPlans,assessQuestionMath,questionMathBasis,questionMathCalculation,retainsQuestionMathPlan,type QuestionMathPlan} from './question-math';
import {assessQuestionQuality,questionQualityHash} from './question-quality';
import {normalizeQuestionDraft} from './question-host';
import {questionFacts,questionVersion} from './question-context-provider';
import {QUESTION_REPAIR_RECORD_SCHEMA,QUESTION_ORIGINAL_AI_RECORD_SCHEMA,validQuestionRepair,validRepairReference,type QuestionRepairLink} from './question-repair';
export type QuestionReviewSql={all:(sql:string,params?:(string|number|null)[])=>Promise<Record<string,unknown>[]>;run:(sql:string,params?:(string|number|null)[])=>Promise<void>;read:(id:string)=>Promise<QuestionBankItem|undefined>;create:(input:QuestionBankItemInput)=>Promise<QuestionBankItem>;validate?:(q:QuestionBankItem)=>Promise<void>};
type ReadSql=Pick<QuestionReviewSql,'all'|'read'>&{validate?:(q:QuestionBankItem)=>Promise<void>};
export type QuestionReviewHost=QuestionReviewSql&{transaction:<T>(work:(sql:QuestionReviewSql)=>Promise<T>)=>Promise<T>};
type RecordSchema=typeof QUESTION_REVIEW_SCHEMA|typeof QUESTION_QUALITY_RECORD_SCHEMA|typeof QUESTION_MATH_RECORD_SCHEMA|typeof QUESTION_REPAIR_RECORD_SCHEMA|typeof QUESTION_ORIGINAL_AI_RECORD_SCHEMA|typeof QUESTION_COLLECTION_RECORD_SCHEMA;
type Payload={schemaVersion:RecordSchema;callId:string;studentId:string;draft:QuestionReviewDraft;sources:QuestionBankItem[];qualityPolicy?:typeof QUESTION_QUALITY_SCHEMA|typeof QUESTION_MATH_QUALITY_SCHEMA;mathPlans?:QuestionMathPlan[];repair?:QuestionRepairLink;generationKind?:'ai_original';collection?:CollectionScope};
type QualityVersion={draft:QuestionReviewDraft;quality:QuestionQualityReview;checkedAt:string};
type Effect={schemaVersion:RecordSchema;draft:QuestionReviewDraft;saved:QuestionContextSource[];digest:string;quality?:QuestionQualityReview;teacherReviewed?:true;qualityHistory?:QualityVersion[]};
const validPolicy=(p:Payload)=>p.schemaVersion===QUESTION_COLLECTION_RECORD_SCHEMA?!!p.collection&&validCollectionId(p.collection.id)&&typeof p.collection.sectionId==='string'&&/^[a-zA-Z0-9_-]{1,40}$/.test(p.collection.sectionId)&&(p.generationKind===undefined||p.generationKind==='ai_original')&&validQuestionRepair(p.repair)&&p.qualityPolicy===QUESTION_MATH_QUALITY_SCHEMA&&validQuestionMathPlans(p.mathPlans,p.draft):p.collection===undefined&&(p.schemaVersion===QUESTION_ORIGINAL_AI_RECORD_SCHEMA?p.generationKind==='ai_original'&&Array.isArray(p.sources)&&p.sources.length===0&&validQuestionRepair(p.repair)&&p.qualityPolicy===QUESTION_MATH_QUALITY_SCHEMA&&validQuestionMathPlans(p.mathPlans,p.draft):p.generationKind===undefined&&(p.schemaVersion===QUESTION_REPAIR_RECORD_SCHEMA?validQuestionRepair(p.repair)&&p.qualityPolicy===QUESTION_MATH_QUALITY_SCHEMA&&validQuestionMathPlans(p.mathPlans,p.draft):p.repair===undefined&&(p.schemaVersion===QUESTION_MATH_RECORD_SCHEMA?p.qualityPolicy===QUESTION_MATH_QUALITY_SCHEMA&&validQuestionMathPlans(p.mathPlans,p.draft):p.mathPlans===undefined&&(p.schemaVersion===QUESTION_QUALITY_RECORD_SCHEMA?p.qualityPolicy===QUESTION_QUALITY_SCHEMA:p.schemaVersion===QUESTION_REVIEW_SCHEMA&&(p.qualityPolicy===undefined||p.qualityPolicy===QUESTION_QUALITY_SCHEMA)))));
const ACTION='pi_question_candidate',hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const source=(q:QuestionBankItem):QuestionContextSource=>({schemaVersion:QUESTION_CONTEXT_SCHEMA,questionId:q.id,version:questionVersion(q)});
const summary=(r:Record<string,unknown>):QuestionReviewSummary=>{const p=JSON.parse(String(r.payload_json)) as Payload;return{id:String(r.id),runId:String(r.run_id),callId:p.callId,state:r.status as QuestionReviewSummary['state'],count:p.draft.items.length,generationKind:p.generationKind||'variation',...(p.repair?{repairAttempt:p.repair.attempt,...(p.repair.parent?{repairParentId:p.repair.parent.id}:{})}:{}),...(r.superseded_by?{supersededBy:String(r.superseded_by)}:{})};};
export async function validateQuestionReviewFormat(draft:QuestionReviewDraft,signal:AbortSignal){
 if(!validQuestionReviewDraft(draft))throw new Error('invalid_input');
 const output=[];
 for(const q of draft.items){signal.throwIfAborted();output.push(await normalizeQuestionDraft({questionType:q.questionType,raw:JSON.stringify({question_type:q.questionType,question:q.stem,correct_answer:q.answer,explanation:q.analysis,options:q.options})},signal));}
 return output;
}
/** Immutable proposals/teacher versions in the existing ledger; fact writers share its transaction. */
export class QuestionReviewRepository{
 private readonly host:QuestionReviewHost;
 readonly collections:QuestionCollectionRepository;
 constructor(host:QuestionReviewHost){this.host=host;this.collections=new QuestionCollectionRepository(host,this);}
 private async authorize(sql:ReadSql,sessionId:string,studentId?:string){
  const r=(await sql.all(`SELECT s.student_id,t.status FROM ai_conversation_sessions s LEFT JOIN students t ON t.id=s.student_id WHERE s.id=? AND s.archived_at IS NULL`,[sessionId]))[0];
  if(!r||r.student_id&&r.status!=='active'||studentId!==undefined&&studentId!==r.student_id)throw new Error('permission_denied');return String(r.student_id||'');
 }
 private async get(sql:ReadSql,sessionId:string,id:string,validateLineage=true){
  const r=(await sql.all(`SELECT * FROM ai_confirmation_items WHERE id=? AND session_id=? AND action_type=?`,[id,sessionId,ACTION]))[0];if(!r)throw new Error('permission_denied');
  await this.authorize(sql,sessionId,String(r.student_id));const p=JSON.parse(String(r.payload_json)) as Payload;
  if(!validQuestionReviewDraft(p.draft)||!validPolicy(p)||p.studentId!==r.student_id||!Array.isArray(p.sources)||p.sources.length<(p.generationKind==='ai_original'?0:1)||p.sources.length>8||!['pending','confirmed','rejected'].includes(String(r.status)))throw new Error('unavailable');
  if(p.collection){const owner=await collectionForQuestion(sql,sessionId,id);if(owner?.r.id!==p.collection.id||!owner.s.members.some(m=>m.sectionId===p.collection!.sectionId&&m.ids.includes(id)))throw new Error('unavailable');}
  if(validateLineage){let child={r,p};for(let step=0;child.p.repair?.parent;step++){
   if(step>=3)throw new Error('unavailable');const link=child.p.repair,parent=await this.get(sql,sessionId,link.parent!.id,false),h=this.history(parent.r,parent.p).find(v=>v.quality.revisionHash===link.parent!.revisionHash);
   if(JSON.stringify(parent.p.collection)!==JSON.stringify(child.p.collection)||parent.p.generationKind!==child.p.generationKind||(!p.collection&&parent.r.run_id!==r.run_id)||parent.p.studentId!==p.studentId||parent.r.status==='confirmed'||hash(parent.p)!==link.parent!.payloadHash||parent.p.repair?.attempt!==link.attempt-1||!h||h.quality.state!=='blocked'||JSON.stringify(h.draft)!==JSON.stringify(parent.p.draft)||JSON.stringify(parent.p.sources)!==JSON.stringify(child.p.sources)||!this.sameShape(child.p.draft,parent.p)||parent.p.draft.items.some((q,i)=>!retainsGeneratedQuestionParts(q,child.p.draft.items[i]))||parent.p.mathPlans!.some((plan,i)=>!retainsQuestionMathPlan(plan,child.p.mathPlans![i])))throw new Error('unavailable');child=parent;
  }}
  return{r,p};
 }
 private async repairChild(sql:ReadSql,r:Record<string,unknown>){return(await sql.all(`SELECT id FROM ai_confirmation_items WHERE session_id=? AND (run_id=? OR (json_extract(?, '$.collection.id') IS NOT NULL AND json_extract(payload_json,'$.collection.id')=json_extract(?, '$.collection.id'))) AND student_id=? AND action_type=? AND json_extract(payload_json,'$.repair.parent.id')=?`,[String(r.session_id),String(r.run_id),String(r.payload_json),String(r.payload_json),String(r.student_id),ACTION,String(r.id)]))[0];}
 private async outstandingRepair(sql:QuestionReviewSql,sessionId:string,runId:string,scope?:CollectionScope,reference?:string){
  await this.authorize(sql,sessionId);const rows=await sql.all(`SELECT id FROM ai_confirmation_items WHERE session_id=? AND (run_id=? OR (?<>'' AND json_extract(payload_json,'$.collection.id')=?)) AND action_type=? AND status='pending' AND json_extract(payload_json,'$.schemaVersion') IN (?,?,?) ORDER BY created_at DESC,id DESC`,[sessionId,runId,scope?.id||'',scope?.id||'',ACTION,QUESTION_REPAIR_RECORD_SCHEMA,QUESTION_ORIGINAL_AI_RECORD_SCHEMA,QUESTION_COLLECTION_RECORD_SCHEMA]);
  for(const row of rows){const value=await this.get(sql,sessionId,String(row.id));if(scope){const owner=await collectionForQuestion(sql,sessionId,String(row.id));if(!reference||value.p.repair?.reference!==reference||owner?.r.id!==scope.id||!owner.s.members.some(m=>m.sectionId===scope.sectionId&&m.ids.at(-1)===row.id))continue;}const last=this.history(value.r,value.p).at(-1);if(last?.quality.state==='blocked'&&JSON.stringify(last.draft)===JSON.stringify(value.p.draft)&&!await this.repairChild(sql,value.r))return{...value,last};}return undefined;
 }
 async repairFeedback(sessionId:string,runId:string,scope?:CollectionScope,reference?:string){const value=await this.outstandingRepair(this.host,sessionId,runId,scope,reference);return value?{reference:value.p.repair!.reference,attempt:value.p.repair!.attempt,generationKind:value.p.generationKind||'variation' as const,issues:value.last.quality.items.map((i,index)=>({index:index+1,issues:i.issues,...(i.issues.some(code=>code==='generated_part_answer_missing'||code==='generated_part_analysis_missing')?{parts:generatedQuestionPartCoverage(value.p.draft.items[index])}:{}),...(i.math?{math:i.math}:{})})),id:String(value.r.id)}:undefined;}
 /** Main-only: obtain the immutable repair alias after staging a new collection head. */
 async repairFeedbackForQuestion(sessionId:string,id:string){const {r,p}=await this.get(this.host,sessionId,id);return p.repair?this.repairFeedback(sessionId,String(r.run_id),p.collection,p.repair.reference):undefined;}
 async automaticRejected(sessionId:string,runId:string,sql:QuestionReviewSql=this.host){await this.authorize(sql,sessionId);const rows=await sql.all(`SELECT * FROM ai_confirmation_items WHERE session_id=? AND run_id=? AND action_type=? AND status='rejected' AND json_extract(payload_json,'$.schemaVersion') IN (?,?,?)`,[sessionId,runId,ACTION,QUESTION_REPAIR_RECORD_SCHEMA,QUESTION_ORIGINAL_AI_RECORD_SCHEMA,QUESTION_COLLECTION_RECORD_SCHEMA]);for(const r of rows)if(!await this.repairChild(sql,r))return true;return false;}
 private async sourcesCurrent(sql:ReadSql,p:Payload){for(const q of p.sources){const current=await sql.read(q.id);if(!current||questionVersion(current)!==questionVersion(q))return false;}return true;}
 private scope(r:Record<string,unknown>,p:Payload){return{id:String(r.id),sessionId:String(r.session_id),studentId:p.studentId};}
 private sameShape(draft:QuestionReviewDraft,p:Payload){return draft.items.length===p.draft.items.length&&draft.items.every((q,i)=>q.questionType===p.draft.items[i].questionType);}
 private history(r:Record<string,unknown>,p:Payload):QualityVersion[]{
  const value=JSON.parse(String(r.result_json)),history=value.qualityHistory??[];
  if(!Array.isArray(history)||history.length>8||new Set(history.map(h=>h?.quality?.revisionHash)).size!==history.length)throw new Error('unavailable');
  for(const h of history){if(!h||!validQuestionReviewDraft(h.draft)||!this.sameShape(h.draft,p)||!validQuestionQuality(h.quality,h.draft.items.length)||h.quality.schemaVersion!==(p.qualityPolicy||QUESTION_QUALITY_SCHEMA)||typeof h.checkedAt!=='string'||!Number.isFinite(Date.parse(h.checkedAt)))throw new Error('unavailable');const {revisionHash,...quality}=h.quality;if(revisionHash!==questionQualityHash(this.scope(r,p),hash(p),h.draft,p.sources,quality))throw new Error('unavailable');
   if(p.mathPlans)for(let i=0;i<p.mathPlans.length;i++){const plan=p.mathPlans[i],receipt=h.quality.items[i].math;if(!receipt||(!plan?receipt.state!=='not_run':receipt.calculation!==questionMathCalculation(plan.input)||(plan.basisHash!==questionMathBasis(h.draft.items[i],plan.input))!==(receipt.state==='basis_changed')||receipt.state==='not_run'||(plan.input.kind==='steps'&&receipt.state!=='basis_changed'?receipt.stepStates?.length!==plan.input.checks.length:receipt.stepStates!==undefined)))throw new Error('unavailable');}
  }
  return history;
 }
 private effect(r:Record<string,unknown>,p:Payload){const e=JSON.parse(String(r.result_json)) as Effect;
  if(!validPolicy(p))throw new Error('unavailable');
  if(e.schemaVersion!==p.schemaVersion||!validQuestionReviewDraft(e.draft)||!Array.isArray(e.saved)||e.saved.some(s=>!validQuestionContextSource(s))||e.saved.length!==e.draft.items.length)throw new Error('unavailable');
  if(p.qualityPolicy!==undefined&&e.quality===undefined)throw new Error('unavailable');
  if(e.quality!==undefined){const history=this.history(r,p);if(e.teacherReviewed!==true||!validQuestionQuality(e.quality,e.draft.items.length)||e.quality.state!=='manual_review'||!history.some(h=>h.quality.revisionHash===e.quality!.revisionHash&&JSON.stringify(h.draft)===JSON.stringify(e.draft)))throw new Error('unavailable');}
  if(e.digest!==hash({id:r.id,sessionId:r.session_id,studentId:p.studentId,proposalSha256:hash(p),parents:p.sources.map(source),draft:e.draft,saved:e.saved,...(e.quality?{quality:e.quality,teacherReviewed:e.teacherReviewed,qualityHistory:e.qualityHistory}:{})}))throw new Error('unavailable');return e;}
 async list(sessionId:string){await this.authorize(this.host,sessionId);const rows=await this.host.all(`SELECT * FROM ai_confirmation_items WHERE session_id=? AND action_type=? ORDER BY created_at,id`,[sessionId,ACTION]);return Promise.all(rows.map(async row=>{const {r}=await this.get(this.host,sessionId,String(row.id));const owner=await collectionForQuestion(this.host,sessionId,String(r.id));return {...summary({...r,superseded_by:(await this.repairChild(this.host,r))?.id}),...(owner?{collectionId:String(owner.r.id)}:{})};}));}
 /** Read approved current generations through the caller's source lease; never rerun format/math or write facts. */
 async approvedForPaper(sessionId:string,sql:ReadSql=this.host){
  await this.authorize(sql,sessionId);const rows=await sql.all("SELECT id FROM ai_confirmation_items WHERE session_id=? AND action_type=? AND status='confirmed' ORDER BY confirmed_at,id",[sessionId,ACTION]);
  const groups=[];for(const row of rows){const {r,p}=await this.get(sql,sessionId,String(row.id)),e=this.effect(r,p);if(p.collection){const owner=await collectionForQuestion(sql,sessionId,String(r.id));if(owner?.s.phase!=='confirmed'||owner.s.effects?.find(effect=>effect.id===r.id)?.digest!==e.digest)throw new Error('unavailable');}
   // Legacy approvals lacking current quality evidence are not silently promoted.
   if(!p.qualityPolicy||!e.quality||e.teacherReviewed!==true||await this.repairChild(sql,r)||!await this.sourcesCurrent(sql,p))continue;
   let available=true;for(const parent of p.sources)try{await sql.validate?.(parent);}catch{available=false;break;}if(!available)continue;
   const questions=[];let current=true;for(const ref of e.saved){const q=await sql.read(ref.questionId);if(!q||q.sourceKind!=='generated'||questionVersion(q)!==ref.version){current=false;break;}questions.push(questionFacts(q));}
   if(current)groups.push({id:String(r.id),sessionId,subject:e.draft.subject,grade:e.draft.grade,title:e.draft.title,generationKind:p.generationKind||'variation' as 'ai_original'|'variation',effectDigest:e.digest,questions});
  }return groups;
 }
 async parentsForStudent(studentId:string,questionId:string):Promise<QuestionContextSource[]>{
  const rows=await this.host.all(`SELECT c.* FROM ai_confirmation_items c WHERE action_type=? AND status='confirmed' AND (student_id='' OR student_id=?) AND EXISTS (SELECT 1 FROM json_each(c.result_json,'$.saved') s WHERE json_extract(s.value,'$.questionId')=?)`,[ACTION,studentId,questionId]);
  const parents:QuestionContextSource[]=[];for(const r of rows){const p=JSON.parse(String(r.payload_json)) as Payload;this.effect(r,p);for(const q of p.sources){const reference=source(q);if(!parents.some(s=>s.questionId===reference.questionId&&s.version===reference.version))parents.push(reference);}}return parents;
 }
 async propose(sessionId:string,runId:string,callId:string,draft:QuestionReviewDraft,parents:QuestionContextSource[],isCurrent:()=>boolean,mathChecks?:unknown,automatic?:{repairReference?:string;generationKind?:'ai_original'|'variation';collection?:CollectionScope}){
  if(automatic?.generationKind!==undefined&&!['ai_original','variation'].includes(automatic.generationKind))throw new Error('invalid_input');
  if(!validQuestionReviewDraft(draft)||!callId||callId.length>128||(automatic?.generationKind==='ai_original'?parents.length!==0:parents.length<1)||parents.length>8||parents.some(p=>!validQuestionContextSource(p))||new Set(parents.map(p=>p.questionId)).size!==parents.length)throw new Error('invalid_input');
  const mathPlans=createQuestionMathPlans(draft,mathChecks),scope=automatic?.collection;
  return this.host.transaction(async sql=>{
   if(!isCurrent())throw new Error('cancelled');const studentId=await this.authorize(sql,sessionId);
   const run=(await sql.all('SELECT student_id FROM ai_agent_runs WHERE id=? AND session_id=?',[runId,sessionId]))[0];if(!run||run.student_id&&run.student_id!==studentId)throw new Error('permission_denied');
   const snapshots=[];for(const ref of parents){const q=await sql.read(ref.questionId);if(!q||questionVersion(q)!==ref.version)throw new Error('source_changed');snapshots.push(questionFacts(q));}
   const p:Payload={schemaVersion:QUESTION_MATH_RECORD_SCHEMA,callId,studentId,draft,sources:snapshots,...(scope?{collection:scope}:{}),qualityPolicy:QUESTION_MATH_QUALITY_SCHEMA,mathPlans,...(automatic?.generationKind==='ai_original'?{generationKind:'ai_original' as const}:{})};
   const prior=(await sql.all(`SELECT * FROM ai_confirmation_items WHERE session_id=? AND run_id=? AND action_type=? AND json_extract(payload_json,'$.callId')=?`,[sessionId,runId,ACTION,callId]))[0];
   if(prior){const owner=await collectionForQuestion(sql,sessionId,String(prior.id));if(owner?(owner.r.id!==scope?.id||!owner.s.members.some(m=>m.sectionId===scope?.sectionId&&m.ids.includes(String(prior.id)))):scope!==undefined)throw new Error('conflict');const {p:old}=await this.get(sql,sessionId,String(prior.id));const {mathPlans:_plans,qualityPolicy:_policy,...legacy}=p;const compatible=mathPlans.every(v=>v===null)&&[JSON.stringify({...legacy,schemaVersion:QUESTION_QUALITY_RECORD_SCHEMA,qualityPolicy:QUESTION_QUALITY_SCHEMA}),JSON.stringify({...legacy,schemaVersion:QUESTION_REVIEW_SCHEMA}),JSON.stringify({...legacy,schemaVersion:QUESTION_REVIEW_SCHEMA,qualityPolicy:QUESTION_QUALITY_SCHEMA})].includes(String(prior.payload_json));
    if(old.repair){if(!automatic||JSON.stringify({...p,schemaVersion:old.schemaVersion,repair:old.repair})!==String(prior.payload_json))throw new Error('conflict');if(old.repair.parent){const parent=await this.get(sql,sessionId,old.repair.parent.id);if(automatic.repairReference!==parent.p.repair?.reference)throw new Error('conflict');}else if(automatic.repairReference!==undefined)throw new Error('conflict');}
    else if(String(prior.payload_json)!==JSON.stringify(p)&&!compatible)throw new Error('conflict');if(!isCurrent())throw new Error('cancelled');return summary(prior);}
   if(automatic){if(!scope&&await this.automaticRejected(sessionId,runId,sql))throw new Error('conflict');const reference=automatic.repairReference,outstanding=await this.outstandingRepair(sql,sessionId,runId,scope,reference);if(!scope&&outstanding&&await collectionForQuestion(sql,sessionId,String(outstanding.r.id)))throw new Error('collection_required');
    // A concurrent new call must not create another root while the first is being checked or reviewed.
    if(!outstanding&&!scope){const waiting=await sql.all(`SELECT * FROM ai_confirmation_items WHERE session_id=? AND run_id=? AND action_type=? AND status='pending' AND json_extract(payload_json,'$.schemaVersion') IN (?,?,?)`,[sessionId,runId,ACTION,QUESTION_REPAIR_RECORD_SCHEMA,QUESTION_ORIGINAL_AI_RECORD_SCHEMA,QUESTION_COLLECTION_RECORD_SCHEMA]);for(const row of waiting)if(!await this.repairChild(sql,row))throw new Error('conflict');}
    if(reference!==undefined&&!validRepairReference(reference))throw new Error('invalid_input');
    if(outstanding&&reference!==outstanding.p.repair!.reference)throw new Error('repair_required');if(reference&&!outstanding)throw new Error('permission_denied');
    if(outstanding){if(outstanding.p.repair!.attempt>=3)throw new Error('repair_limit');if(p.generationKind!==outstanding.p.generationKind||JSON.stringify(snapshots)!==JSON.stringify(outstanding.p.sources)||!this.sameShape(draft,outstanding.p))throw new Error('source_changed');if(!await this.sourcesCurrent(sql,outstanding.p))throw new Error('source_changed');if(outstanding.p.draft.items.some((q,i)=>!retainsGeneratedQuestionParts(q,draft.items[i]))||outstanding.p.mathPlans!.some((plan,i)=>!retainsQuestionMathPlan(plan,mathPlans[i])))throw new Error('invalid_input');}
    if(scope)await validateCollectionAppend(sql,sessionId,scope,draft,p.generationKind||'variation',outstanding?String(outstanding.r.id):undefined);
    p.schemaVersion=scope?QUESTION_COLLECTION_RECORD_SCHEMA:p.generationKind==='ai_original'?QUESTION_ORIGINAL_AI_RECORD_SCHEMA:QUESTION_REPAIR_RECORD_SCHEMA;p.repair={reference:'修复_'+randomUUID().replace(/-/g,'').slice(0,24),attempt:outstanding?outstanding.p.repair!.attempt+1:0,parent:outstanding?{id:String(outstanding.r.id),payloadHash:hash(outstanding.p),revisionHash:outstanding.last.quality.revisionHash}:null};
   }
   const id='xiquestion_'+randomUUID(),at=new Date().toISOString();
   await sql.run(`INSERT INTO ai_confirmation_items (id,run_id,session_id,student_id,action_type,status,title,payload_json,created_at,updated_at) VALUES (?,?,?,?,?,'pending',?,?,?,?)`,[id,runId,sessionId,studentId,ACTION,draft.title,JSON.stringify(p),at,at]);
   if(scope){const row=(await sql.all('SELECT * FROM ai_confirmation_items WHERE id=?',[id]))[0];await attachCollectionGroup(sql,sessionId,scope,draft,summary(row));}const saved=await this.get(sql,sessionId,id);if(!isCurrent())throw new Error('cancelled');return summary(saved.r);
  });
 }
 async review(sessionId:string,id:string,edited?:QuestionReviewDraft,signal:AbortSignal=new AbortController().signal,isCurrent:()=>boolean=()=>true):Promise<QuestionReviewView>{
  const current=()=>{signal.throwIfAborted();if(!isCurrent())throw new Error('cancelled');};current();
  const {r,p}=await this.get(this.host,sessionId,id),e=r.status==='confirmed'?this.effect(r,p):undefined,history=e?.qualityHistory||this.history(r,p),draft=e?.draft||edited||history.at(-1)?.draft||p.draft;
  const child=await this.repairChild(this.host,r);if(edited&&child)throw new Error('superseded');
  if(edited&&(r.status!=='pending'||!validQuestionReviewDraft(edited)||!this.sameShape(edited,p)))throw new Error('invalid_input');
  const sourceCurrent=await this.sourcesCurrent(this.host,p);if(edited&&!sourceCurrent)throw new Error('source_changed');
  const prior=history.find(h=>JSON.stringify(h.draft)===JSON.stringify(draft));if(edited&&!prior&&history.length>=8)throw new Error('review_limit');
  const formatted=await validateQuestionReviewFormat(draft,signal);current();
  const math=p.mathPlans?(edited&&!prior?await assessQuestionMath(draft,p.mathPlans,signal):p.mathPlans.map(()=>({state:'not_run' as const,conditionsVerified:false as const}))):undefined;current();
  const quality=e?.quality||prior?.quality||assessQuestionQuality(this.scope(r,p),hash(p),draft,p.sources,formatted,math);
  let historyCount=history.length;
  if(edited)historyCount=await this.host.transaction(async sql=>{
   current();const latest=await this.get(sql,sessionId,id);if(latest.r.status!=='pending'||String(latest.r.payload_json)!==String(r.payload_json))throw new Error('conflict');if(await this.repairChild(sql,latest.r))throw new Error('superseded');if(!await this.sourcesCurrent(sql,p))throw new Error('source_changed');
   const versions=this.history(latest.r,p);if(!versions.some(h=>h.quality.revisionHash===quality.revisionHash)){if(p.repair&&String(latest.r.result_json)!==String(r.result_json))throw new Error('quality_stale');if(versions.length>=8)throw new Error('review_limit');versions.push({draft,quality,checkedAt:new Date().toISOString()});await sql.run(`UPDATE ai_confirmation_items SET result_json=?,updated_at=? WHERE id=? AND status='pending'`,[JSON.stringify({qualityHistory:versions}),new Date().toISOString(),id]);}current();return versions.length;
  });
  const parent=p.repair?.parent?await this.get(this.host,sessionId,p.repair.parent.id):undefined,previous=parent?this.history(parent.r,parent.p).find(h=>h.quality.revisionHash===p.repair!.parent!.revisionHash):undefined;current();
  const owner=await collectionForQuestion(this.host,sessionId,id);return{...summary({...r,superseded_by:child?.id}),...(owner?{collectionId:String(owner.r.id)}:{}),draft,issues:formatted.map(q=>q.issues),quality,qualityHistoryCount:historyCount,legacyQuality:!!e&&!e.quality,...(previous?{repairPrevious:{draft:previous.draft,quality:previous.quality}}:{}),sourceCurrent,sources:p.sources.map(q=>({title:q.sourceTitle||q.knowledgePoint||'原题',question:source(q)})),saved:(e?.saved||[]).map((question,i)=>({title:`${draft.title} · 第${i+1}题`,question}))};
 }
 async decide(input:QuestionReviewDecision,isCurrent:()=>boolean,afterWrite?:(current:()=>boolean)=>Promise<void>){if(!validQuestionReview(input,true))throw new Error('invalid_input');
  if(!isCurrent())throw new Error('cancelled');
  const format=input.action==='confirm'?await validateQuestionReviewFormat(input.draft!,new AbortController().signal):undefined;
  return this.host.transaction(sql=>this.applyDecision(sql,input,isCurrent,format,undefined,afterWrite));
 }
 /** Main-only primitive: collection approval calls this within the one existing transaction. */
 async applyDecision(sql:QuestionReviewSql,input:QuestionReviewDecision,isCurrent:()=>boolean,format:Awaited<ReturnType<typeof validateQuestionReviewFormat>>|undefined,collectionId?:string,afterWrite?:(current:()=>boolean)=>Promise<void>){
  const current=()=>{if(!isCurrent())throw new Error('cancelled');};current();const {r,p}=await this.get(sql,input.sessionId,input.id);current();
  const owner=await collectionForQuestion(sql,input.sessionId,input.id);if(owner&&(owner.r.id!==collectionId||owner.r.status!=='pending'||input.action==='confirm'&&!owner.s.members.some(m=>m.ids.at(-1)===input.id))||!owner&&collectionId)throw new Error('collection_required');
  if(r.status!=='pending'){
   if(r.status==='rejected'&&input.action==='reject')return summary(r);
   if(r.status==='confirmed'&&input.action==='confirm'&&JSON.stringify(this.effect(r,p).draft)===JSON.stringify(input.draft))return summary(r);throw new Error('conflict');
  }
  const at=new Date().toISOString();
  if(input.action==='reject'){await sql.run(`UPDATE ai_confirmation_items SET status='rejected',rejected_at=?,updated_at=? WHERE id=? AND status='pending'`,[at,at,input.id]);const rejected=await this.get(sql,input.sessionId,input.id);current();return summary(rejected.r);}
  if(await this.repairChild(sql,r))throw new Error('superseded');
  const draft=input.draft;if(!validQuestionReviewDraft(draft)||draft.items.length!==p.draft.items.length||draft.items.some((q,i)=>q.questionType!==p.draft.items[i].questionType))throw new Error('invalid_input');
  if(!await this.sourcesCurrent(sql,p))throw new Error('source_changed');if(collectionId)for(const parent of p.sources)await sql.validate?.(parent);
  current();if(!format||format.some(q=>!q.valid))throw new Error('invalid_input');
  // Require the displayed teacher version to already be canonical; no silent post-confirm edits.
  if(format.some(({question:q},i)=>{const shown=draft.items[i];return q.stem!==shown.stem||q.answer!==shown.answer||q.analysis!==shown.analysis||JSON.stringify(q.options)!==JSON.stringify(shown.options);}))throw new Error('invalid_input');
  const qualityHistory=this.history(r,p),checked=qualityHistory.find(h=>JSON.stringify(h.draft)===JSON.stringify(draft));
  const quality=assessQuestionQuality(this.scope(r,p),hash(p),draft,p.sources,format,p.mathPlans?(checked?.quality.items.map(i=>i.math!)||p.mathPlans.map(()=>({state:'not_run' as const,conditionsVerified:false as const}))):undefined);
  if(quality.state==='blocked')throw new Error('quality_blocked');
  if(!input.qualityConfirmation)throw new Error('quality_required');
  if(input.qualityConfirmation.revisionHash!==quality.revisionHash||!qualityHistory.some(h=>h.quality.revisionHash===quality.revisionHash))throw new Error('quality_stale');
  const saved:QuestionContextSource[]=[];
  for(const q of draft.items){const item=await sql.create({subject:draft.subject,grade:draft.grade,knowledgePoint:draft.knowledgePoint,questionType:q.questionType,difficulty:q.difficulty,stem:questionChoiceText(q).text,answer:q.answer,analysis:q.analysis,sourceKind:'generated',sourceTitle:draft.title,tags:['教师核对',...(p.generationKind==='ai_original'?['AI原创']:[])]});current();saved.push(source(item));}
  const effect:Effect={schemaVersion:p.schemaVersion,draft,saved,quality,teacherReviewed:true,qualityHistory,digest:hash({id:r.id,sessionId:r.session_id,studentId:p.studentId,proposalSha256:hash(p),parents:p.sources.map(source),draft,saved,quality,teacherReviewed:true,qualityHistory})};
  await sql.run(`UPDATE ai_confirmation_items SET status='confirmed',result_json=?,confirmed_at=?,updated_at=? WHERE id=? AND status='pending'`,[JSON.stringify(effect),at,at,input.id]);
  await afterWrite?.(isCurrent);const savedRow=await this.get(sql,input.sessionId,input.id);current();return summary(savedRow.r);
 }
}
