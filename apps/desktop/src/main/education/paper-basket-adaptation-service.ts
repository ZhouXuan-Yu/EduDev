import {assertAdaptationQuota} from './paper-basket-adaptation-quota';
import {createAdaptationRunBinder,createAdaptationParentReader} from './paper-basket-adaptation-run';
import {PAPER_ADAPTATION_SCHEMA,validAdaptationList,validAdaptationPrepare,validAdaptationRead,type PaperAdaptationPrepare,type PaperAdaptationRead,type PaperAdaptationAccept,type PaperAdaptationCancel,type PaperAdaptationView,type PaperAdaptationReceipt} from '../../shared/paper-basket-adaptation';
import {PAPER_BASKET_V2_SCHEMA,type PaperBasketV2MutationInput,type PaperBasketV2View} from '../../shared/paper-basket-v2';
import type {QuestionReviewRepository} from './question-review-repository';
import type {BasketHost} from './paper-basket-repository';
import type {PaperSql} from './paper-sql';
import {authorizePaperOwner,readStoredBasket} from './paper-basket-state';
import {questionVersion} from './question-context-provider';
import {newPaperInstance} from './paper-instance';
import {adaptationHash,adaptationOperation,checkAdaptationOperation,writeAdaptationOperation,type AdaptationRecord} from './paper-basket-adaptation-ledger';
export type PaperBasketAdaptationHost=BasketHost&{mutateInTransaction:(sql:PaperSql,input:PaperBasketV2MutationInput,current:()=>boolean)=>Promise<PaperBasketV2View>};
export function createPaperBasketAdaptationService(host:PaperBasketAdaptationHost,reviews:Pick<QuestionReviewRepository,'paperAdaptationCandidate'>){
 const lease=(signal:AbortSignal,current:()=>boolean)=>{signal.throwIfAborted();if(!current())throw Error('cancelled');};
 const readRecord=async(sql:PaperSql,input:PaperAdaptationRead)=>{
  await authorizePaperOwner(sql,input.sessionId,input.studentId);
  const row=await adaptationOperation(sql,input.sessionId,input.intentId);
  if(!row||row.student_id!==input.studentId||row.basket_id!==input.basketId||row.operation_kind!=='domain:adaptation-prepare')throw Error('permission_denied');
  const record=JSON.parse(String(row.adaptation_json)) as AdaptationRecord;
  if(!validAdaptationPrepare(record.input)||adaptationHash(record.input)!==row.input_hash||record.intentId!==input.intentId)throw Error('unavailable');
  if(record.input.sessionId!==input.sessionId||record.input.studentId!==input.studentId||record.input.basketId!==input.basketId)throw Error('permission_denied');
  return record;
 };
 const exact=async(sql:PaperSql,record:AdaptationRecord)=>{
  const i=record.input,b=await readStoredBasket(sql,i.sessionId,i.basketId,true);
  if(b.studentId!==i.studentId)throw Error('permission_denied');
  const e=b.data.entries.find(e=>e.entryId===i.entryId);
  if(b.state!=='active'||b.revision!==i.expectedBasketRevision||!e
   ||e.questionId!==i.parentQuestionId||e.contentVersion!==i.parentSourceVersion
   ||(e.instance||newPaperInstance(e)).instanceRevision!==i.instanceRevision
   ||adaptationHash({...e,instance:e.instance||newPaperInstance(e)})!==record.entryHash
   ||b.data.blueprint.sections.find(s=>s.id===e.sectionId)?.points!==record.points)throw Error('conflict');
  const q=await sql.read(i.parentQuestionId);
  if(!q||questionVersion(q)!==i.parentSourceVersion)throw Error('source_changed');
  await sql.validate(q);
  if(b.data.c2){if(!host.verifyTemplates)throw Error('unavailable');await host.verifyTemplates(sql,b);}
  assertAdaptationQuota(b,record.input);return b;
 };
 const proof=async(sql:PaperSql,record:AdaptationRecord,id:string)=>{
  const p=await reviews.paperAdaptationCandidate(sql,record.input.sessionId,id);
  const run=(await sql.all('SELECT prompt,student_id,status FROM ai_agent_runs WHERE id=? AND session_id=?',
   [p.runId,record.input.sessionId]))[0];
  if(!record.runId||p.runId!==record.runId||!run||run.prompt!==record.prompt
   ||String(run.student_id||'')!==record.input.studentId)throw Error('permission_denied');
  if(p.variation.parents.length!==1
   ||p.variation.parents[0].question.questionId!==record.input.parentQuestionId
   ||p.variation.parents[0].question.version!==record.input.parentSourceVersion
   ||p.count!==1)throw Error('source_changed');
  // A later run failure cannot undo the original teacher's durable save. The
  // repository has independently checked the effect, parent and saved version.
  const committed=p.state==='confirmed'&&!p.supersededBy&&p.sourceCurrent
   &&!!p.effectDigest&&p.saved.length===1;
  if(['interrupted','cancelled'].includes(String(run.status))
   ||run.status==='failed'&&!committed)throw Error('permission_denied');
  return p;
 };
 const view=async(sql:PaperSql,record:AdaptationRecord):Promise<PaperAdaptationView>=>{let current=record.status==='prepared';if(current)try{await exact(sql,record);}catch(e){if(e instanceof Error&&['conflict','source_changed','shortage'].includes(e.message))current=false;else throw e;}const candidates=[];const rows=await sql.all("SELECT c.id FROM ai_confirmation_items c JOIN ai_agent_runs r ON r.id=c.run_id AND r.session_id=c.session_id WHERE c.session_id=? AND c.student_id=? AND c.action_type='pi_question_candidate' AND r.id=? ORDER BY c.created_at,c.id LIMIT 32",[record.input.sessionId,record.input.studentId,record.runId??'']);for(const row of rows){try{const p=await proof(sql,record,String(row.id));const {saved:_saved,...candidate}=p;candidates.push(candidate);}catch(e){if(!(e instanceof Error)||!['invalid_input','source_changed','permission_denied'].includes(e.message))throw e;}}const {entryHash:_hash,points:_points,...value}=record;return {...value,current,candidates,generationStarted:Boolean(record.runId)};};
 return {
 bindRun:createAdaptationRunBinder(host,readRecord,exact),
 boundParent:createAdaptationParentReader(host,readRecord,exact),
 async list(raw:unknown):Promise<PaperAdaptationView[]>{if(!validAdaptationList(raw))throw Error('invalid_input');return (host.readTransaction||host.transaction).call(host,async(sql:PaperSql)=>{await authorizePaperOwner(sql,raw.sessionId,raw.studentId);await readStoredBasket(sql,raw.sessionId,raw.basketId,true);const rows=await sql.all("SELECT request_id FROM paper_basket_operations WHERE session_id=? AND student_id=? AND basket_id=? AND operation_kind='domain:adaptation-prepare' AND json_extract(adaptation_json,'$.input.entryId')=? ORDER BY created_at DESC,rowid DESC LIMIT 32",[raw.sessionId,raw.studentId,raw.basketId,raw.entryId]);const result=[];for(const r of rows)result.push(await view(sql,await readRecord(sql,{schemaVersion:PAPER_ADAPTATION_SCHEMA,sessionId:raw.sessionId,studentId:raw.studentId,basketId:raw.basketId,intentId:String(r.request_id)})));return result;}) as Promise<PaperAdaptationView[]>;},
 async prepare(raw:unknown,signal:AbortSignal=new AbortController().signal,current:()=>boolean=()=>true){if(!validAdaptationPrepare(raw))throw Error('invalid_input');const input=structuredClone(raw);return host.transaction(async sql=>{lease(signal,current);await authorizePaperOwner(sql,input.sessionId,input.studentId);const prior=await adaptationOperation(sql,input.sessionId,input.requestId);if(prior){checkAdaptationOperation(prior,input.studentId,input.basketId,'domain:adaptation-prepare',input);return view(sql,JSON.parse(String(prior.adaptation_json)));}const b=await readStoredBasket(sql,input.sessionId,input.basketId,true),entry=b.data.entries.find(e=>e.entryId===input.entryId);if(!entry)throw Error('conflict');const original={...structuredClone(entry),instance:structuredClone(entry.instance||newPaperInstance(entry))};if(entry.questionId!==input.parentQuestionId||entry.contentVersion!==input.parentSourceVersion||original.instance.instanceRevision!==input.instanceRevision)throw Error('conflict');const section=b.data.blueprint.sections.find(s=>s.id===entry.sectionId);if(!section)throw Error('conflict');
 const prompt=`指定题改编意图 ${input.requestId}。请使用现有 education_read_question 实读父题 ${input.parentQuestionId}，精确版本 ${input.parentSourceVersion}，只生成一道变式并调用 education_propose_questions 等待教师核对，不自动入篮。改编要求：${input.requirements}。指定实例内容（source沿父题，edited须按当前教师内容改编）：${JSON.stringify(original.instance.content)}。保持当前session，不生成其它题。题篮 ${input.basketId} revision=${input.expectedBasketRevision} entry=${input.entryId} instanceRevision=${input.instanceRevision}。`;
 if(prompt.length>32768)throw Error('too_large');
 const record:AdaptationRecord={schemaVersion:PAPER_ADAPTATION_SCHEMA,intentId:input.requestId,input,prompt,status:'prepared',original,entryHash:adaptationHash(original),points:section.points};await exact(sql,record);
 assertAdaptationQuota(b,input);
 lease(signal,current);await writeAdaptationOperation(sql,input.sessionId,input.studentId,input.basketId,input.requestId,'domain:adaptation-prepare',input,record,b.revision);lease(signal,current);return view(sql,record);});},
 async read(raw:unknown):Promise<PaperAdaptationView>{if(!validAdaptationRead(raw))throw Error('invalid_input');return (host.readTransaction||host.transaction).call(host,async(sql:PaperSql)=>view(sql,await readRecord(sql,raw))) as Promise<PaperAdaptationView>;},
 async accept(raw:unknown,signal:AbortSignal=new AbortController().signal,current:()=>boolean=()=>true):Promise<PaperAdaptationReceipt>{if(!validAdaptationRead(raw,'accept'))throw Error('invalid_input');const input=structuredClone(raw);return host.transaction(async sql=>{lease(signal,current);const record=await readRecord(sql,input);const prior=await adaptationOperation(sql,input.sessionId,input.requestId);if(prior){checkAdaptationOperation(prior,input.studentId,input.basketId,'domain:adaptation-accept',input);return JSON.parse(String(prior.adaptation_json)) as PaperAdaptationReceipt;}if(record.status!=='prepared')throw Error('conflict');const before=await exact(sql,record);
 assertAdaptationQuota(before,record.input);
 const candidate=await proof(sql,record,input.candidateId);if(candidate.state!=='confirmed'||candidate.supersededBy||!candidate.sourceCurrent||candidate.effectDigest!==input.candidateDigest||candidate.saved.length!==1)throw Error('conflict');const saved=candidate.saved[0],old=record.original;
 const beforeIds=new Set(before.data.entries.map(e=>e.entryId));const mutation:PaperBasketV2MutationInput={schemaVersion:PAPER_BASKET_V2_SCHEMA,sessionId:input.sessionId,basketId:input.basketId,requestId:adaptationHash(input).slice(0,8)+'-'+adaptationHash(input).slice(8,12)+'-'+adaptationHash(input).slice(12,16)+'-'+adaptationHash(input).slice(16,20)+'-'+adaptationHash(input).slice(20,32),expectedRevision:record.input.expectedBasketRevision,operation:record.input.intent==='replace'?{type:'replaceEntry',entryId:old.entryId,expectedInstanceRevision:record.input.instanceRevision,questionId:saved.questionId,expectedSourceVersion:saved.version}:{type:'add',sectionId:old.sectionId,questionId:saved.questionId,expectedSourceVersion:saved.version}};
 // One transaction/connection. The original primitive owns quota, privacy, instance events, CAS and syncC2.
 lease(signal,current);const result=await host.mutateInTransaction(sql,mutation,()=>!signal.aborted&&current());const entry=result.entries.find(e=>record.input.intent==='replace'?e.entryId===old.entryId:!beforeIds.has(e.entryId)&&e.questionId===saved.questionId);if(!entry||entry.questionId!==saved.questionId||entry.contentVersion!==saved.version||entry.sectionId!==old.sectionId||record.input.intent==='replace'&&entry.position!==old.position)throw Error('conflict');const points=result.c2?.entryPoints[entry.entryId]??result.blueprint.sections.find(s=>s.id===entry.sectionId)?.points;if(points!==record.points)throw Error('conflict');
 const receipt:PaperAdaptationReceipt={requestId:input.requestId,intentId:input.intentId,basketId:input.basketId,basketRevision:result.revision,entryId:entry.entryId,candidateId:input.candidateId,questionId:saved.questionId,sourceVersion:saved.version,intent:record.input.intent};await writeAdaptationOperation(sql,input.sessionId,input.studentId,input.basketId,input.requestId,'domain:adaptation-accept',input,receipt,result.revision);record.status='accepted';record.receipt=receipt;await sql.run('UPDATE paper_basket_operations SET adaptation_json=? WHERE session_id=? AND request_id=?',[JSON.stringify(record),input.sessionId,input.intentId]);await authorizePaperOwner(sql,input.sessionId,input.studentId);lease(signal,current);return receipt;});},
 async cancel(raw:unknown,signal:AbortSignal=new AbortController().signal,current:()=>boolean=()=>true){if(!validAdaptationRead(raw,'cancel'))throw Error('invalid_input');const input=structuredClone(raw);return host.transaction(async sql=>{lease(signal,current);const record=await readRecord(sql,input),prior=await adaptationOperation(sql,input.sessionId,input.requestId);if(prior){checkAdaptationOperation(prior,input.studentId,input.basketId,'domain:adaptation-cancel',input);return view(sql,record);}if(record.status==='accepted')throw Error('conflict');record.status='cancelled';await sql.run('UPDATE paper_basket_operations SET adaptation_json=? WHERE session_id=? AND request_id=?',[JSON.stringify(record),input.sessionId,input.intentId]);await writeAdaptationOperation(sql,input.sessionId,input.studentId,input.basketId,input.requestId,'domain:adaptation-cancel',input,{cancelled:true},record.input.expectedBasketRevision);lease(signal,current);return view(sql,record);});}
 };
}
