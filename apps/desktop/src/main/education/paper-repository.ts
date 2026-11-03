import {validPaperPurpose,type PaperPurpose} from '../../shared/paper-purpose';
import {PAPER_BASKET_SNAPSHOT_V2_SCHEMA, validPaperBasketV2Snapshot, type PaperBasketV2SnapshotInput} from '../../shared/paper-basket-v2';
import {PAPER_SNAPSHOT_C2_SCHEMA} from '../../shared/paper-basket-c2';
import {validC2SnapshotExtension,captureTemplateSources,type C2SnapshotExtension} from './paper-template-snapshot';
import {readStoredBasket} from './paper-basket-state';
import {assertC2SnapshotReady} from './paper-basket-c2-state';
import {assertInstance, instanceReviewed, instanceDeliveryBlock} from './paper-instance';
import {randomUUID,createHash} from 'node:crypto';
import type {QuestionBankItem} from '../../shared/contracts';
import {PAPER_SCHEMA,PAPER_GENERATED_SCHEMA,generatedPaperCount,validPaperBlueprint,validPaperGenerationQuery,validPaperCreate,validPaperReview,validPaperCompare,validPaperSession,type PaperCreateInput,type PaperCompareInput,type PaperCompareView,type PaperDecision,type PaperSelection,type PaperSummary,type PaperView,type PaperGeneration,type PaperGenerationContext,type PaperGenerationQuery} from '../../shared/paper-blueprint';
import {QUESTION_SELECTION_IDENTITY_POLICY,questionSelectionIdentity} from '../../shared/question-selection-identity';
import {questionContentIdentity} from '../../shared/question-identity';
import {questionVersion} from './question-context-provider';
import {comparePaperViews} from './paper-compare';
import {selectPaper,paperSectionMatches,paperShortages,type PaperSelectionHost} from './paper-selection';
import {PAPER_BASKET_SNAPSHOT_SCHEMA,validPaperBasketBinding,validPaperBasketSnapshot,type PaperBasketBinding,type PaperBasketSnapshotInput} from '../../shared/paper-basket';
import {plainStudentInput} from '../../shared/student-context';
import {authorizePaperOwner,basketBindingCurrent} from './paper-basket-state';
import type {PaperSql,ApprovedPaperGroup,PaperStoreHost} from './paper-sql';
export type {PaperSql,ApprovedPaperGroup} from './paper-sql';
export const PAPER_ACTION='pi_paper_candidate';
type Row=Record<string,unknown>;
type Host=PaperStoreHost & {currentC2?:(sql:PaperSql,sessionId:string,studentId:string,binding:PaperBasketBinding,extension:C2SnapshotExtension)=>Promise<boolean>};
type BasketPaperInput = {
 schemaVersion: typeof PAPER_BASKET_SNAPSHOT_SCHEMA | typeof PAPER_BASKET_SNAPSHOT_V2_SCHEMA | typeof PAPER_SNAPSHOT_C2_SCHEMA;
 sessionId: string;
 requestId: string;
 purpose?:PaperPurpose;
 blueprint: PaperCreateInput['blueprint'];
 basket: PaperBasketBinding;
 c2?:C2SnapshotExtension['c2'];
 templateSources?:C2SnapshotExtension['templateSources'];
};
type Payload={schemaVersion:typeof PAPER_SCHEMA|typeof PAPER_GENERATED_SCHEMA|typeof PAPER_BASKET_SNAPSHOT_SCHEMA | typeof PAPER_BASKET_SNAPSHOT_V2_SCHEMA|typeof PAPER_SNAPSHOT_C2_SCHEMA;input:PaperCreateInput|BasketPaperInput;studentId:string;callId:string;selection:PaperSelection};
const basketSnapshotSchema=(v:unknown)=>v===PAPER_BASKET_SNAPSHOT_SCHEMA||v===PAPER_BASKET_SNAPSHOT_V2_SCHEMA||v===PAPER_SNAPSHOT_C2_SCHEMA;
function frozenEffectSnapshot(p:Payload){return {blueprint:p.input.blueprint,selection:p.selection,...('purpose'in p.input&&p.input.purpose?{purpose:p.input.purpose}:{}),...(p.input.schemaVersion===PAPER_SNAPSHOT_C2_SCHEMA?{c2:p.input.c2,templateSources:p.input.templateSources}:{})};}
function validSnapshotInput(value: unknown): value is BasketPaperInput {
 return plainStudentInput(value, ['schemaVersion','sessionId','requestId','blueprint','basket','c2','templateSources','purpose'])
  && basketSnapshotSchema(value.schemaVersion) && (value.schemaVersion===PAPER_SNAPSHOT_C2_SCHEMA?!!value.c2&&Array.isArray(value.templateSources):value.c2===undefined&&value.templateSources===undefined) && validPaperSession(value.sessionId)
  && typeof value.requestId === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value.requestId)
  && (value.purpose===undefined||value.schemaVersion!==PAPER_BASKET_SNAPSHOT_SCHEMA&&validPaperPurpose(value.purpose)) && validPaperBlueprint(value.blueprint) && validPaperBasketBinding(value.basket);
}
const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const integer=(v:unknown)=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0;
const countBy=(selection:PaperSelection,id:string)=>selection.items.filter(i=>i.sectionId===id).length;
function validSelection(s:PaperSelection,p:Payload):boolean{
 if(!s||s.duplicatePolicy!==undefined&&s.duplicatePolicy!==QUESTION_SELECTION_IDENTITY_POLICY||!Array.isArray(s.items)||s.items.length>100||!Array.isArray(s.shortages)||!integer(s.scanned)||s.scanned<s.items.length||typeof s.scanComplete!=='boolean'||!integer(s.duplicateRecords)||!s.excluded||!['unsupported','missing_answer','source_unavailable'].every(k=>integer(s.excluded[k as keyof typeof s.excluded])))return false;
 const b=p.input.blueprint,keys=new Set<string>(),ids=new Set<string>();
 try{for(const [index,item]of s.items.entries()){
  const q=item.question,section=b.sections.find(section=>section.id===item.sectionId);if((q.sourceKind==='generated'?b.mode==='source_only'||!item.generation||!/^xiquestion_[a-f0-9-]{36}$/i.test(item.generation.groupId)||!/^([a-f0-9]{64})$/.test(item.generation.effectDigest)||!['ai_original','variation'].includes(item.generation.generationKind)||b.mode==='ai_original'&&item.generation.generationKind!=='ai_original':item.generation!==undefined)||!section||item.number!==index+1||item.points!==section.points||!q||!paperSectionMatches(q,b,section)||q.id!==item.source.questionId||item.source.schemaVersion!=='xiaozhi.education.question-context.v1'||item.source.version!==questionVersion(q)||!q.answer.trim()||!q.analysis.trim())return false;
  if(p.schemaVersion===PAPER_BASKET_SNAPSHOT_V2_SCHEMA||p.schemaVersion===PAPER_SNAPSHOT_C2_SCHEMA){if(!item.instance||!item.entryId)return false;assertInstance({entryId:item.entryId,questionId:q.id,contentVersion:item.source.version,sectionId:item.sectionId,position:index,question:q,generation:item.generation},item.instance);if(!instanceReviewed(item.instance)||instanceDeliveryBlock(q,item.instance))return false;}else if(item.instance!==undefined)return false;
  const identity=(s.duplicatePolicy?questionSelectionIdentity:questionContentIdentity)(q);if(identity.status!=='available'||keys.has(identity.key)||ids.has(q.id))return false;keys.add(identity.key);ids.add(q.id);
 }
 if ((p.input.schemaVersion === PAPER_BASKET_SNAPSHOT_SCHEMA || p.input.schemaVersion === PAPER_BASKET_SNAPSHOT_V2_SCHEMA || p.input.schemaVersion===PAPER_SNAPSHOT_C2_SCHEMA)) {
  const binding = p.input.basket;
  if (s.method !== 'manual' || s.scanComplete || s.scanned !== s.items.length || s.shortages.length
   || binding.entryIds.length !== s.items.length || !s.items.every((item,index)=>item.entryId===binding.entryIds[index])) return false;
 }
 if(p.input.schemaVersion===PAPER_SNAPSHOT_C2_SCHEMA&&!validC2SnapshotExtension({c2:p.input.c2,templateSources:p.input.templateSources},b,s))return false;
 for(const section of b.sections){const selected=s.items.filter(i=>i.sectionId===section.id);if(selected.length>section.count)return false;if(b.mode!=='source_only'){const generated=selected.filter(i=>i.question.sourceKind==='generated').length,quota=generatedPaperCount(b,section);if(generated>quota||selected.length-generated>section.count-quota)return false;}}
 return JSON.stringify(paperShortages(b,s.items))===JSON.stringify(s.shortages);
 }catch{return false;}
}
export class PaperRepository{
 private readonly host:Host;
 constructor(host:Host){this.host=host;}
 private async authorize(sql:PaperSql,sessionId:string,expected?:string){
  return authorizePaperOwner(sql,sessionId,expected);
 }
 private payload(r:Row):Payload{
  try{const p=JSON.parse(String(r.payload_json)) as Payload;if(!(basketSnapshotSchema(p.schemaVersion)?validSnapshotInput(p.input):[PAPER_SCHEMA,PAPER_GENERATED_SCHEMA].includes(p.schemaVersion)&&validPaperCreate(p.input))||p.schemaVersion!==p.input.schemaVersion||p.input.sessionId!==r.session_id||p.studentId!==r.student_id||typeof p.callId!=='string'||p.callId.length>128||!['pending','confirmed','rejected'].includes(String(r.status))||!validSelection(p.selection,p))throw 0;return p;}catch{throw new Error('unavailable');}
 }
 private summary(r:Row,p:Payload):PaperSummary{return{id:String(r.id),sessionId:String(r.session_id),runId:String(r.run_id),callId:p.callId,requestId:p.input.requestId,revision:1,title:p.input.blueprint.title,state:r.status as PaperSummary['state'],count:p.selection.items.length,totalPoints:p.input.blueprint.totalPoints,complete:p.selection.shortages.length===0};}
 private effect(r:Row,p:Payload):string{
  try{const e=JSON.parse(String(r.result_json)),snapshot=frozenEffectSnapshot(p);if(e.schemaVersion!==p.schemaVersion||e.revision!==1||JSON.stringify(e.snapshot)!==JSON.stringify(snapshot)||e.digest!==hash({id:r.id,sessionId:r.session_id,payload:p,snapshot}))throw 0;return e.digest;}catch{throw new Error('unavailable');}
 }
 private async get(sql:PaperSql,sessionId:string,id:string){const r=(await sql.all('SELECT * FROM ai_confirmation_items WHERE id=? AND session_id=? AND action_type=?',[id,sessionId,PAPER_ACTION]))[0];if(!r)throw new Error('permission_denied');const p=this.payload(r);await this.authorize(sql,sessionId,p.studentId);if(r.status==='confirmed')this.effect(r,p);return{r,p};}
 private async generations(sql:PaperSql,sessionId:string,b:PaperCreateInput['blueprint']){
  if(!this.host.approvedGenerations)throw new Error('unavailable');await this.authorize(sql,sessionId);const groups=await this.host.approvedGenerations(sessionId,sql),refs=new Map<string,PaperGeneration>(),questions:QuestionBankItem[]=[];
  for(const group of groups){if(group.sessionId!==sessionId)throw new Error('permission_denied');if(group.subject!==b.subject||group.grade!==b.grade||b.mode==='ai_original'&&group.generationKind!=='ai_original')continue;for(const q of group.questions){if(refs.has(q.id))throw new Error('unavailable');refs.set(q.id,{groupId:group.id,effectDigest:group.effectDigest,generationKind:group.generationKind});questions.push(q);}}return{refs,questions};
 }
 private async current(sql:PaperSql,p:Payload,lease:()=>boolean=()=>true){
  if (p.input.schemaVersion === PAPER_BASKET_SNAPSHOT_SCHEMA || p.input.schemaVersion === PAPER_BASKET_SNAPSHOT_V2_SCHEMA || p.input.schemaVersion===PAPER_SNAPSHOT_C2_SCHEMA) {
   const stored=await readStoredBasket(sql,p.input.sessionId,p.input.basket.basketId,true);if(stored.data.purpose!==p.input.purpose)return false;
   if(!await basketBindingCurrent(sql,p.input.sessionId,p.studentId,p.input.blueprint,p.input.basket,p.selection.items,p.input.schemaVersion===PAPER_SNAPSHOT_C2_SCHEMA))return false;
   if(p.input.schemaVersion===PAPER_SNAPSHOT_C2_SCHEMA){try{if(!this.host.currentC2||!await this.host.currentC2(sql,p.input.sessionId,p.studentId,p.input.basket,{c2:p.input.c2!,templateSources:p.input.templateSources!}))return false;}catch{return false;}}
  }
  let generations:Map<string,PaperGeneration>|undefined;if(p.input.blueprint.mode!=='source_only'){try{generations=(await this.generations(sql,p.input.sessionId,p.input.blueprint)).refs;}catch{return false;}}
  for(const item of p.selection.items){if(!lease())throw new Error('cancelled');const q=await sql.read(item.question.id);if(!q||questionVersion(q)!==item.source.version)return false;
   if(q.sourceKind==='generated'&&JSON.stringify(generations?.get(q.id))!==JSON.stringify(item.generation))return false;try{await sql.validate(q);}catch{return false;}}
  if(!lease())throw new Error('cancelled');return true;
 }
 async generationContexts(query:PaperGenerationQuery):Promise<PaperGenerationContext[]>{
  if(!validPaperGenerationQuery(query))throw new Error('invalid_input');const read=this.host.readTransaction??this.host.transaction;
  return read.call(this.host,async(sql:PaperSql)=>{if(!this.host.approvedGenerations)throw new Error('unavailable');const rows=await sql.all("SELECT DISTINCT session_id FROM ai_confirmation_items WHERE action_type='pi_question_candidate' AND status='confirmed' AND json_extract(payload_json,'$.draft.subject')=? AND json_extract(payload_json,'$.draft.grade')=? ORDER BY session_id",[query.subject,query.grade]),contexts:PaperGenerationContext[]=[];
   for(const row of rows){const sessionId=String(row.session_id);try{await this.authorize(sql,sessionId);}catch(e){if((e as Error).message==='permission_denied')continue;throw e;}
    const groups=(await this.host.approvedGenerations(sessionId,sql)).filter(g=>g.subject===query.subject&&g.grade===query.grade);if(!groups.length)continue;contexts.push({sessionId,title:groups[0].title,subject:query.subject,grade:query.grade,originalCount:groups.filter(g=>g.generationKind==='ai_original').reduce((n,g)=>n+g.questions.length,0),variationCount:groups.filter(g=>g.generationKind==='variation').reduce((n,g)=>n+g.questions.length,0)});
   }return contexts;
  }) as Promise<PaperGenerationContext[]>;
 }
 private async view(sql:PaperSql,r:Row,p:Payload):Promise<PaperView>{const supersededBy=r.status==='rejected'?await this.successorId(sql,String(r.session_id),String(r.id)):undefined;const latest=r.status==='confirmed'?(await sql.all("SELECT id FROM ai_confirmation_items WHERE session_id=? AND action_type=? AND status='confirmed' ORDER BY confirmed_at DESC,id DESC LIMIT 1",[String(r.session_id),PAPER_ACTION]))[0]:undefined;return{...this.summary(r,p),...('purpose'in p.input&&p.input.purpose?{purpose:p.input.purpose}:{}),...(supersededBy?{supersededBy}:{}),blueprint:p.input.blueprint,selection:p.selection,sourceCurrent:await this.current(sql,p),exportCurrent:latest?.id===r.id,answerVerified:false,...(r.status==='confirmed'?{digest:this.effect(r,p)}:{}),...((p.input.schemaVersion===PAPER_BASKET_SNAPSHOT_SCHEMA||p.input.schemaVersion===PAPER_BASKET_SNAPSHOT_V2_SCHEMA||p.input.schemaVersion===PAPER_SNAPSHOT_C2_SCHEMA)?{basket:p.input.basket}:{}),...(p.input.schemaVersion===PAPER_SNAPSHOT_C2_SCHEMA?{snapshotSchema:PAPER_SNAPSHOT_C2_SCHEMA,c2:p.input.c2,templateSources:p.input.templateSources}:{})};}
 private async insertPending(sql: PaperSql, runId: string, payload: Payload): Promise<string> {
  if (!validSelection(payload.selection, payload)) throw new Error('unavailable');
  const id = 'xipaper_' + randomUUID();
  const at = new Date().toISOString();
  await sql.run(`INSERT INTO ai_confirmation_items(id,run_id,session_id,student_id,action_type,status,title,payload_json,created_at,updated_at)
    VALUES(?,?,?,?,?,'pending',?,?,?,?)`, [id, runId, payload.input.sessionId, payload.studentId,
    PAPER_ACTION, payload.input.blueprint.title, JSON.stringify(payload), at, at]);
  return id;
 }

 /** Uses the caller's paperTransaction connection; never opens another writer. */
 async createBasketSnapshotInTransaction(
  sql: PaperSql,
  input: PaperBasketSnapshotInput | PaperBasketV2SnapshotInput,
  blueprint: PaperCreateInput['blueprint'],
  selection: PaperSelection,
  binding: PaperBasketBinding,
  studentId: string,
  current: () => boolean,
 ): Promise<PaperView> {
  if ((!validPaperBasketSnapshot(input) && !validPaperBasketV2Snapshot(input)) || !validPaperBasketBinding(binding)
   || input.basketId !== binding.basketId || input.expectedRevision !== binding.basketRevision) {
   throw new Error('invalid_input');
  }
  await this.authorize(sql, input.sessionId, studentId);
  if (!current()) throw new Error('cancelled');
  const prior = await sql.all(`SELECT id FROM ai_confirmation_items WHERE session_id=? AND action_type=?
    AND json_extract(payload_json,'$.input.requestId')=?`, [input.sessionId, PAPER_ACTION, input.requestId]);
  if (prior.length) throw new Error('conflict');
  const stored=await readStoredBasket(sql,input.sessionId,binding.basketId,true);
  if(stored.data.c2)assertC2SnapshotReady(stored);
  const extension=stored.data.c2?{c2:structuredClone(stored.data.c2),templateSources:await captureTemplateSources(sql,stored.data.c2,studentId)}:undefined;
  const snapshotInput: BasketPaperInput = {
   schemaVersion: extension ? PAPER_SNAPSHOT_C2_SCHEMA : validPaperBasketV2Snapshot(input) ? PAPER_BASKET_SNAPSHOT_V2_SCHEMA : PAPER_BASKET_SNAPSHOT_SCHEMA, sessionId: input.sessionId, requestId: input.requestId,
   blueprint: structuredClone(blueprint), basket: structuredClone(binding),...extension,...(stored.data.purpose?{purpose:stored.data.purpose}:{}),
  };
  if (!validSnapshotInput(snapshotInput)) throw new Error('invalid_input');
  const payload: Payload = {
   schemaVersion: snapshotInput.schemaVersion, input: snapshotInput,
   studentId, callId: '', selection: structuredClone(selection),
  };
  const id = await this.insertPending(sql, '', payload);
  const result = await this.reviewInTransaction(sql, input.sessionId, id);
  if (!result.sourceCurrent) throw new Error('source_changed');
  if (!current()) throw new Error('cancelled');
  return result;
 }

 async reviewInTransaction(sql: PaperSql, sessionId: string, id: string): Promise<PaperView> {
  const {r, p} = await this.get(sql, sessionId, id);
  return this.view(sql, r, p);
 }
 async list(sessionId?:string):Promise<PaperSummary[]>{
  if(sessionId!==undefined)await this.authorize(this.host,sessionId);
  const rows=await this.host.all(`SELECT c.* FROM ai_confirmation_items c JOIN ai_conversation_sessions s ON s.id=c.session_id WHERE c.action_type=? AND s.archived_at IS NULL ${sessionId?'AND c.session_id=?':''} ORDER BY c.created_at DESC,c.id DESC`,sessionId?[PAPER_ACTION,sessionId]:[PAPER_ACTION]);
  const result:PaperSummary[]=[];for(const r of rows){const p=this.payload(r);await this.authorize(this.host,String(r.session_id),p.studentId);if(r.status==='confirmed')this.effect(r,p);const supersededBy=r.status==='rejected'?await this.successorId(this.host,String(r.session_id),String(r.id)):undefined;result.push({...this.summary(r,p),...('purpose'in p.input&&p.input.purpose?{purpose:p.input.purpose}:{}),...(supersededBy?{supersededBy}:{})});}return result;
 }
 async create(input:PaperCreateInput,runId:string,callId:string,current:()=>boolean,afterWrite?:()=>Promise<void>):Promise<PaperView>{
  if(!validPaperCreate(input)||typeof callId!=='string'||callId.length>128)throw new Error('invalid_input');
  return this.host.transaction(async sql=>{
   const lease=()=>{if(!current())throw new Error('cancelled');};lease();const studentId=await this.authorize(sql,input.sessionId);
   if(runId){const run=(await sql.all('SELECT student_id FROM ai_agent_runs WHERE id=? AND session_id=?',[runId,input.sessionId]))[0];if(!run||run.student_id&&run.student_id!==studentId)throw new Error('permission_denied');}
   const prior=(await sql.all(`SELECT * FROM ai_confirmation_items WHERE session_id=? AND action_type=? AND json_extract(payload_json,'$.input.requestId')=?`,[input.sessionId,PAPER_ACTION,input.requestId]))[0];
   if(prior){const p=this.payload(prior);if(prior.run_id!==runId||JSON.stringify(p.input)!==JSON.stringify(input)||p.studentId!==studentId)throw new Error('conflict');lease();return this.view(sql,prior,p);}
   if(input.replace){const old=await this.get(sql,input.sessionId,input.replace.id);if(old.r.status!=='pending'||input.replace.revision!==1)throw new Error('conflict');}
   const generations=input.blueprint.mode==='source_only'?undefined:await this.generations(sql,input.sessionId,input.blueprint);lease();
   const selectionHost:PaperSelectionHost=generations?{...sql,page:async(b,after)=>{const original=b.mode==='ai_original'?[]:await sql.page(b,after),last=original.at(-1)?.id,generated=generations.questions.filter(q=>q.id>after&&(!last||q.id<=last)).map(question=>({id:question.id,question}));return Array.from(new Map([...original,...generated].map(q=>[q.id,q])).values()).sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0).slice(0,200);}}:sql;
   const selection=await selectPaper(selectionHost,input.blueprint,current,generations?.refs);lease();const at=new Date().toISOString(),p:Payload={schemaVersion:input.schemaVersion,input:JSON.parse(JSON.stringify(input)),studentId,callId,selection};
   const id=await this.insertPending(sql,runId,p);
   if(input.replace)await sql.run("UPDATE ai_confirmation_items SET status='rejected',rejected_at=?,updated_at=? WHERE id=? AND session_id=? AND action_type=? AND status='pending'",[at,at,input.replace.id,input.sessionId,PAPER_ACTION]);
   await afterWrite?.();lease();await this.authorize(sql,input.sessionId,studentId);const saved=await this.get(sql,input.sessionId,id);const view=await this.view(sql,saved.r,saved.p);lease();return view;
  });
 }
 async review(sessionId:string,id:string):Promise<PaperView>{const read=this.host.readTransaction??this.host.transaction;return read.call(this.host,async sql=>{const {r,p}=await this.get(sql,sessionId,id);return this.view(sql,r,p);}) as Promise<PaperView>;}
 async compare(input:PaperCompareInput):Promise<PaperCompareView>{
  if(!validPaperCompare(input))throw new Error('invalid_input');const read=this.host.readTransaction??this.host.transaction;
  return read.call(this.host,async(sql:PaperSql)=>{const left=await this.get(sql,input.sessionId,input.leftId),right=await this.get(sql,input.sessionId,input.rightId);return comparePaperViews(await this.view(sql,left.r,left.p),await this.view(sql,right.r,right.p));}) as Promise<PaperCompareView>;
 }
 /** Holds the existing BEGIN IMMEDIATE source lease across a synchronous file installation.
  * The action must not call the separate Office SQLite connection while this lease is held. */
 async withConfirmedSource<T>(sessionId:string,id:string,digest:string,action:(paper:PaperView)=>T,options?:{c2:true}):Promise<T>{
  return this.host.transaction(async sql=>{const {r,p}=await this.get(sql,sessionId,id),paper=await this.view(sql,r,p);
   if(p.input.schemaVersion===PAPER_SNAPSHOT_C2_SCHEMA&&options?.c2!==true)throw new Error('c2_export_unavailable');
   if(paper.state!=='confirmed'||!paper.complete||!paper.sourceCurrent||paper.exportCurrent!==true||paper.digest!==digest)throw new Error('conflict');
   const result=action(paper);if(result&&typeof (result as {then?:unknown}).then==='function')throw new Error('configuration');if(p.input.schemaVersion===PAPER_SNAPSHOT_C2_SCHEMA&&!await this.current(sql,p))throw new Error('source_changed');return result;
  });
 }
 async latest(sessionId:string){await this.authorize(this.host,sessionId);const row=(await this.host.all("SELECT id FROM ai_confirmation_items WHERE session_id=? AND action_type=? AND status='confirmed' ORDER BY confirmed_at DESC,id DESC LIMIT 1",[sessionId,PAPER_ACTION]))[0];return row?this.review(sessionId,String(row.id)):undefined;}
 async decide(input:PaperDecision,current:()=>boolean,afterWrite?:()=>Promise<void>):Promise<PaperView>{
  if(!validPaperReview(input,true))throw new Error('invalid_input');return this.host.transaction(sql=>this.decideInTransaction(sql,input,current,afterWrite));
 }
 async decideInTransaction(sql:PaperSql,input:PaperDecision,current:()=>boolean,afterWrite?:()=>Promise<void>):Promise<PaperView>{
   if(!validPaperReview(input,true))throw new Error('invalid_input');
   const lease=()=>{if(!current())throw new Error('cancelled');};lease();const {r,p}=await this.get(sql,input.sessionId,input.id);if(input.revision!==1)throw new Error('conflict');
   if(r.status!=='pending'){if(r.status==='confirmed'&&input.action==='confirm'||r.status==='rejected'&&input.action==='reject'){const view=await this.view(sql,r,p);lease();return view;}throw new Error('conflict');}
   const at=new Date().toISOString();if(input.action==='confirm'){
    if(p.selection.shortages.length)throw new Error('shortage');if(!await this.current(sql,p,current))throw new Error('source_changed');lease();
    const snapshot=frozenEffectSnapshot(p),result={schemaVersion:p.schemaVersion,revision:1,snapshot,digest:hash({id:r.id,sessionId:r.session_id,payload:p,snapshot})};
    await sql.run("UPDATE ai_confirmation_items SET status='confirmed',result_json=?,confirmed_at=?,updated_at=? WHERE id=? AND status='pending'",[JSON.stringify(result),at,at,input.id]);
   }else await sql.run("UPDATE ai_confirmation_items SET status='rejected',rejected_at=?,updated_at=? WHERE id=? AND status='pending'",[at,at,input.id]);
   await afterWrite?.();lease();const saved=await this.get(sql,input.sessionId,input.id),view=await this.view(sql,saved.r,saved.p);lease();if(p.input.schemaVersion===PAPER_SNAPSHOT_C2_SCHEMA&&input.action==='confirm'&&!view.sourceCurrent)throw new Error('source_changed');return view;
 }
 private async successorId(sql:PaperSql,sessionId:string,id:string):Promise<string|undefined>{
  // Older source-only databases have no basket tables; their rejection semantics stay unchanged.
  if(!(await sql.all("SELECT name FROM sqlite_master WHERE type='table' AND name='paper_basket_operations'")).length)return undefined;
  const rows=await sql.all("SELECT c.paper_id FROM paper_basket_operations i JOIN paper_basket_operations c ON c.session_id=i.session_id AND c.basket_id=i.basket_id WHERE i.session_id=? AND i.operation_kind='domain:import-paper' AND i.paper_id=? AND c.operation_kind='domain:confirm-paper' ORDER BY c.created_at DESC,c.rowid DESC LIMIT 1",[sessionId,id]);
  return rows[0]?.paper_id?String(rows[0].paper_id):undefined;
 }
 async editedSuccessor(sessionId:string,id:string):Promise<PaperView|undefined>{
  const read=this.host.readTransaction??this.host.transaction;
  return read.call(this.host,async(sql:PaperSql)=>{const source=await this.get(sql,sessionId,id);if(source.r.status!=='rejected')return undefined;
   const successor=await this.successorId(sql,sessionId,id);if(!successor)return undefined;const saved=await this.get(sql,sessionId,successor);if(saved.r.status!=='confirmed')return undefined;return this.view(sql,saved.r,saved.p);
  }) as Promise<PaperView|undefined>;
 }
}
