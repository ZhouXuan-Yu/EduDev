import {randomUUID,createHash} from 'node:crypto';
import type {QuestionBankItem} from '../../shared/contracts';
import {PAPER_SCHEMA,PAPER_GENERATED_SCHEMA,generatedPaperCount,validPaperBlueprint,validPaperGenerationQuery,validPaperCreate,validPaperReview,validPaperSession,type PaperCreateInput,type PaperDecision,type PaperSelection,type PaperSummary,type PaperView,type PaperGeneration,type PaperGenerationContext,type PaperGenerationQuery} from '../../shared/paper-blueprint';
import {questionContentIdentity} from '../../shared/question-identity';
import {questionVersion} from './question-context-provider';
import {selectPaper,paperSectionMatches,paperShortages,type PaperSelectionHost} from './paper-selection';
export const PAPER_ACTION='pi_paper_candidate';
type Row=Record<string,unknown>;
export type PaperSql=PaperSelectionHost&{all:(sql:string,params?:(string|number|null)[])=>Promise<Row[]>;run:(sql:string,params?:(string|number|null)[])=>Promise<unknown>};
export type ApprovedPaperGroup={id:string;sessionId:string;subject:string;grade:string;title:string;generationKind:'ai_original'|'variation';effectDigest:string;questions:QuestionBankItem[]};
type Host=PaperSql&{approvedGenerations?:(sessionId:string,sql:PaperSql)=>Promise<ApprovedPaperGroup[]>;transaction:<T>(work:(sql:PaperSql)=>Promise<T>)=>Promise<T>;readTransaction?:<T>(work:(sql:PaperSql)=>Promise<T>)=>Promise<T>};
type Payload={schemaVersion:typeof PAPER_SCHEMA|typeof PAPER_GENERATED_SCHEMA;input:PaperCreateInput;studentId:string;callId:string;selection:PaperSelection};
const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const integer=(v:unknown)=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0;
const countBy=(selection:PaperSelection,id:string)=>selection.items.filter(i=>i.sectionId===id).length;
function validSelection(s:PaperSelection,p:Payload):boolean{
 if(!s||!Array.isArray(s.items)||s.items.length>100||!Array.isArray(s.shortages)||!integer(s.scanned)||s.scanned<s.items.length||typeof s.scanComplete!=='boolean'||!integer(s.duplicateRecords)||!s.excluded||!['unsupported','missing_answer','source_unavailable'].every(k=>integer(s.excluded[k as keyof typeof s.excluded])))return false;
 const b=p.input.blueprint,keys=new Set<string>(),ids=new Set<string>();
 try{for(const [index,item]of s.items.entries()){
  const q=item.question,section=b.sections.find(section=>section.id===item.sectionId);if((q.sourceKind==='generated'?b.mode==='source_only'||!item.generation||!/^xiquestion_[a-f0-9-]{36}$/i.test(item.generation.groupId)||!/^([a-f0-9]{64})$/.test(item.generation.effectDigest)||!['ai_original','variation'].includes(item.generation.generationKind)||b.mode==='ai_original'&&item.generation.generationKind!=='ai_original':item.generation!==undefined)||!section||item.number!==index+1||item.points!==section.points||!q||!paperSectionMatches(q,b,section)||q.id!==item.source.questionId||item.source.schemaVersion!=='xiaozhi.education.question-context.v1'||item.source.version!==questionVersion(q)||!q.answer.trim()||!q.analysis.trim())return false;
  const identity=questionContentIdentity(q);if(identity.status!=='available'||keys.has(identity.key)||ids.has(q.id))return false;keys.add(identity.key);ids.add(q.id);
 }
 for(const section of b.sections){const selected=s.items.filter(i=>i.sectionId===section.id);if(selected.length>section.count)return false;if(b.mode!=='source_only'){const generated=selected.filter(i=>i.question.sourceKind==='generated').length,quota=generatedPaperCount(b,section);if(generated>quota||selected.length-generated>section.count-quota)return false;}}
 return JSON.stringify(paperShortages(b,s.items))===JSON.stringify(s.shortages);
 }catch{return false;}
}
export class PaperRepository{
 private readonly host:Host;
 constructor(host:Host){this.host=host;}
 private async authorize(sql:PaperSql,sessionId:string,expected?:string){
  if(!validPaperSession(sessionId))throw new Error('invalid_input');const session=(await sql.all('SELECT student_id FROM ai_conversation_sessions WHERE id=? AND archived_at IS NULL',[sessionId]))[0];if(!session)throw new Error('permission_denied');
  const studentId=String(session.student_id||'');if(expected!==undefined&&expected!==studentId)throw new Error('permission_denied');
  if(studentId){const student=(await sql.all("SELECT id FROM students WHERE id=? AND status='active'",[studentId]))[0];if(!student)throw new Error('permission_denied');}return studentId;
 }
 private payload(r:Row):Payload{
  try{const p=JSON.parse(String(r.payload_json)) as Payload;if(![PAPER_SCHEMA,PAPER_GENERATED_SCHEMA].includes(p.schemaVersion)||!validPaperCreate(p.input)||p.schemaVersion!==p.input.schemaVersion||p.input.sessionId!==r.session_id||p.studentId!==r.student_id||typeof p.callId!=='string'||p.callId.length>128||!['pending','confirmed','rejected'].includes(String(r.status))||!validSelection(p.selection,p))throw 0;return p;}catch{throw new Error('unavailable');}
 }
 private summary(r:Row,p:Payload):PaperSummary{return{id:String(r.id),sessionId:String(r.session_id),runId:String(r.run_id),callId:p.callId,requestId:p.input.requestId,revision:1,title:p.input.blueprint.title,state:r.status as PaperSummary['state'],count:p.selection.items.length,totalPoints:p.input.blueprint.totalPoints,complete:p.selection.shortages.length===0};}
 private effect(r:Row,p:Payload):string{
  try{const e=JSON.parse(String(r.result_json)),snapshot={blueprint:p.input.blueprint,selection:p.selection};if(e.schemaVersion!==p.schemaVersion||e.revision!==1||JSON.stringify(e.snapshot)!==JSON.stringify(snapshot)||e.digest!==hash({id:r.id,sessionId:r.session_id,payload:p,snapshot}))throw 0;return e.digest;}catch{throw new Error('unavailable');}
 }
 private async get(sql:PaperSql,sessionId:string,id:string){const r=(await sql.all('SELECT * FROM ai_confirmation_items WHERE id=? AND session_id=? AND action_type=?',[id,sessionId,PAPER_ACTION]))[0];if(!r)throw new Error('permission_denied');const p=this.payload(r);await this.authorize(sql,sessionId,p.studentId);if(r.status==='confirmed')this.effect(r,p);return{r,p};}
 private async generations(sql:PaperSql,sessionId:string,b:PaperCreateInput['blueprint']){
  if(!this.host.approvedGenerations)throw new Error('unavailable');await this.authorize(sql,sessionId);const groups=await this.host.approvedGenerations(sessionId,sql),refs=new Map<string,PaperGeneration>(),questions:QuestionBankItem[]=[];
  for(const group of groups){if(group.sessionId!==sessionId)throw new Error('permission_denied');if(group.subject!==b.subject||group.grade!==b.grade||b.mode==='ai_original'&&group.generationKind!=='ai_original')continue;for(const q of group.questions){if(refs.has(q.id))throw new Error('unavailable');refs.set(q.id,{groupId:group.id,effectDigest:group.effectDigest,generationKind:group.generationKind});questions.push(q);}}return{refs,questions};
 }
 private async current(sql:PaperSql,p:Payload,lease:()=>boolean=()=>true){
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
 private async view(sql:PaperSql,r:Row,p:Payload):Promise<PaperView>{const latest=r.status==='confirmed'?(await sql.all("SELECT id FROM ai_confirmation_items WHERE session_id=? AND action_type=? AND status='confirmed' ORDER BY confirmed_at DESC,id DESC LIMIT 1",[String(r.session_id),PAPER_ACTION]))[0]:undefined;return{...this.summary(r,p),blueprint:p.input.blueprint,selection:p.selection,sourceCurrent:await this.current(sql,p),exportCurrent:latest?.id===r.id,answerVerified:false,...(r.status==='confirmed'?{digest:this.effect(r,p)}:{})};}
 async list(sessionId?:string):Promise<PaperSummary[]>{
  if(sessionId!==undefined)await this.authorize(this.host,sessionId);
  const rows=await this.host.all(`SELECT c.* FROM ai_confirmation_items c JOIN ai_conversation_sessions s ON s.id=c.session_id WHERE c.action_type=? AND s.archived_at IS NULL ${sessionId?'AND c.session_id=?':''} ORDER BY c.created_at DESC,c.id DESC`,sessionId?[PAPER_ACTION,sessionId]:[PAPER_ACTION]);
  const result:PaperSummary[]=[];for(const r of rows){const p=this.payload(r);await this.authorize(this.host,String(r.session_id),p.studentId);if(r.status==='confirmed')this.effect(r,p);result.push(this.summary(r,p));}return result;
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
   const selection=await selectPaper(selectionHost,input.blueprint,current,generations?.refs);lease();const id='xipaper_'+randomUUID(),at=new Date().toISOString(),p:Payload={schemaVersion:input.schemaVersion,input:JSON.parse(JSON.stringify(input)),studentId,callId,selection};if(!validSelection(selection,p))throw new Error('unavailable');
   await sql.run(`INSERT INTO ai_confirmation_items(id,run_id,session_id,student_id,action_type,status,title,payload_json,created_at,updated_at) VALUES(?,?,?,?,?,'pending',?,?,?,?)`,[id,runId,input.sessionId,studentId,PAPER_ACTION,input.blueprint.title,JSON.stringify(p),at,at]);
   if(input.replace)await sql.run("UPDATE ai_confirmation_items SET status='rejected',rejected_at=?,updated_at=? WHERE id=? AND session_id=? AND action_type=? AND status='pending'",[at,at,input.replace.id,input.sessionId,PAPER_ACTION]);
   await afterWrite?.();lease();await this.authorize(sql,input.sessionId,studentId);const saved=await this.get(sql,input.sessionId,id);const view=await this.view(sql,saved.r,saved.p);lease();return view;
  });
 }
 async review(sessionId:string,id:string):Promise<PaperView>{const read=this.host.readTransaction??this.host.transaction;return read.call(this.host,async sql=>{const {r,p}=await this.get(sql,sessionId,id);return this.view(sql,r,p);}) as Promise<PaperView>;}
 /** Holds the existing BEGIN IMMEDIATE source lease across a synchronous file installation.
  * The action must not call the separate Office SQLite connection while this lease is held. */
 async withConfirmedSource<T>(sessionId:string,id:string,digest:string,action:(paper:PaperView)=>T):Promise<T>{
  return this.host.transaction(async sql=>{const {r,p}=await this.get(sql,sessionId,id),paper=await this.view(sql,r,p);
   if(paper.state!=='confirmed'||!paper.complete||!paper.sourceCurrent||paper.digest!==digest)throw new Error('conflict');
   const result=action(paper);if(result&&typeof (result as {then?:unknown}).then==='function')throw new Error('configuration');return result;
  });
 }
 async latest(sessionId:string){await this.authorize(this.host,sessionId);const row=(await this.host.all("SELECT id FROM ai_confirmation_items WHERE session_id=? AND action_type=? AND status='confirmed' ORDER BY confirmed_at DESC,id DESC LIMIT 1",[sessionId,PAPER_ACTION]))[0];return row?this.review(sessionId,String(row.id)):undefined;}
 async decide(input:PaperDecision,current:()=>boolean,afterWrite?:()=>Promise<void>):Promise<PaperView>{
  if(!validPaperReview(input,true))throw new Error('invalid_input');return this.host.transaction(async sql=>{
   const lease=()=>{if(!current())throw new Error('cancelled');};lease();const {r,p}=await this.get(sql,input.sessionId,input.id);if(input.revision!==1)throw new Error('conflict');
   if(r.status!=='pending'){if(r.status==='confirmed'&&input.action==='confirm'||r.status==='rejected'&&input.action==='reject'){const view=await this.view(sql,r,p);lease();return view;}throw new Error('conflict');}
   const at=new Date().toISOString();if(input.action==='confirm'){
    if(p.selection.shortages.length)throw new Error('shortage');if(!await this.current(sql,p,current))throw new Error('source_changed');lease();
    const snapshot={blueprint:p.input.blueprint,selection:p.selection},result={schemaVersion:p.schemaVersion,revision:1,snapshot,digest:hash({id:r.id,sessionId:r.session_id,payload:p,snapshot})};
    await sql.run("UPDATE ai_confirmation_items SET status='confirmed',result_json=?,confirmed_at=?,updated_at=? WHERE id=? AND status='pending'",[JSON.stringify(result),at,at,input.id]);
   }else await sql.run("UPDATE ai_confirmation_items SET status='rejected',rejected_at=?,updated_at=? WHERE id=? AND status='pending'",[at,at,input.id]);
   await afterWrite?.();lease();const saved=await this.get(sql,input.sessionId,input.id),view=await this.view(sql,saved.r,saved.p);lease();return view;
  });
 }
}
