import {createHash,randomUUID} from 'node:crypto';
import type {QuestionBankItem} from '../../shared/contracts';
import type {XiaozhiBrowserReceipt} from '../../shared/xiaozhi-browser';
import {QUESTION_WEB_ARCHIVE_SCHEMA,QUESTION_WEB_EVIDENCE_SCHEMA,publicWebAnswerUrl,webAnswerId,type WebAnswerOwner,type WebAnswerProposal,type WebAnswerCandidate,type WebAnswerRole,type WebAnswerRoleProof} from '../../shared/question-web-answer';
import {validQuestionContextSource,type QuestionContextSource} from '../../shared/question-context';
import {archiveMissing,archiveEligible,validQuestionArchive,type QuestionArchive} from '../../shared/question-archive';
import {answerEnrichmentRoles} from '../../shared/question-answer-enrichment';
import {questionVersion} from './question-context-provider';
type Row=Record<string,unknown>;type Value=string|number|null;
type Host={all:(sql:string,p?:Value[])=>Promise<Row[]>;run:(sql:string,p?:Value[])=>Promise<void>;read:(id:string)=>Promise<QuestionBankItem|undefined>;validate:(q:QuestionBankItem,signal:AbortSignal)=>Promise<void>;writer:<T>(action:(repo:QuestionWebAnswerRepository)=>Promise<T>,beforeCommit?:()=>void)=>Promise<T>};
const hash=(text:string)=>createHash('sha256').update(text).digest('hex');
const ownerKey=(owner:WebAnswerOwner)=>{if(!owner||![owner.sessionId,owner.runId].every(v=>typeof v==='string'&&v.length>0&&v.length<=128))throw Error('invalid_input');return hash(JSON.stringify(owner));};
const normalized=(text:string)=>text.normalize('NFC').replace(/\s+/gu,'');
const roles=['answer','analysis'] as const;
const now=()=>new Date().toISOString();
function canonicalReceipt(receipt:XiaozhiBrowserReceipt){return JSON.stringify([receipt.url,receipt.title,receipt.text,receipt.extraction]);}
/** Strict labelled single-solution region. Similarity and model confidence never grant automatic writes. */
function solutionMatch(q:QuestionBankItem,input:WebAnswerProposal,text:string){
 const needle=normalized(q.stem),quote=normalized(input.questionQuote);
 if(!needle||quote!==needle)return false;
 const body=normalized(text);if(body.split(needle).length!==2)return false;
 const markers=[...text.matchAll(/(?:^|\n)\s*(?:【(参考答案|答案|解析|分析|解答)】|(?:参考答案|答案|解析|分析|解答)\s*[:：])\s*/g)];
 const answer=markers.find(m=>/答案/.test(m[0])),analysis=markers.find(m=>/解析|分析|解答/.test(m[0]));
 if(!answer||!normalized(text.slice(0,answer.index)).includes(needle)||markers.filter(m=>/答案/.test(m[0])).length!==1||markers.filter(m=>/解析|分析|解答/.test(m[0])).length>1)return false;
 const beforeAnswer=normalized(text.slice(0,answer.index)),between=beforeAnswer.slice(beforeAnswer.indexOf(needle)+needle.length);
 if(between.replace(/[：:。？！?!【】\[\]()（）\-—]/gu,''))return false;
 if(analysis&&analysis.index!<=answer.index!)return false;
 const answerText=text.slice(answer.index!+answer[0].length,analysis?.index??text.length).trim(),analysisText=analysis?text.slice(analysis.index!+analysis[0].length).trim():'';
 if(input.answerQuote!==undefined&&normalized(input.answerQuote)!==normalized(answerText)||input.analysisQuote!==undefined&&normalized(input.analysisQuote)!==normalized(analysisText))return false;
 // Another question after the matched stem invalidates the association, even inside one selected region.
 if(/(?:^|\n)\s*(?:第\d+题|\d+[.、．])/.test(text.slice(answer.index)))return false;
 return {answer:answerText,analysis:analysisText};
}
export class QuestionWebAnswerRepository{
 constructor(private readonly host:Host){}
 async migrate(){
  for(const sql of [
   'CREATE TABLE IF NOT EXISTS question_web_grants(id TEXT PRIMARY KEY,owner TEXT NOT NULL,payload_json TEXT NOT NULL,expires_at INTEGER NOT NULL)',
   'CREATE TABLE IF NOT EXISTS question_web_observations(id TEXT PRIMARY KEY,owner TEXT NOT NULL,call_id TEXT NOT NULL,receipt_json TEXT NOT NULL,digest TEXT NOT NULL,UNIQUE(owner,call_id))',
   "CREATE TABLE IF NOT EXISTS question_web_candidates(id TEXT PRIMARY KEY,request_key TEXT NOT NULL UNIQUE,owner TEXT NOT NULL,question_id TEXT NOT NULL,observation_id TEXT NOT NULL,state TEXT NOT NULL,payload_json TEXT NOT NULL,before_json TEXT NOT NULL,after_json TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL)",
   'CREATE INDEX IF NOT EXISTS question_web_candidates_question ON question_web_candidates(question_id,created_at DESC,id)'
  ])await this.host.run(sql);
 }
 async authorize(owner:WebAnswerOwner,sources:QuestionContextSource[],origins:string[],signal:AbortSignal){
  signal.throwIfAborted();const key=ownerKey(owner);
  if(!Array.isArray(sources)||!sources.length||sources.length>20||new Set(sources.map(s=>s.questionId)).size!==sources.length||!sources.every(validQuestionContextSource)||!Array.isArray(origins)||!origins.length||origins.length>5||origins.some(s=>!publicWebAnswerUrl(s)||new URL(s).origin!==s))throw Error('invalid_input');
  for(const source of sources){const q=await this.host.read(source.questionId);if(!q||questionVersion(q)!==source.version||!answerEnrichmentRoles(q).length)throw Error('source_changed');await this.host.validate(q,signal);}
  signal.throwIfAborted();const id='webgrant_'+randomUUID(),expiresAt=Date.now()+20*60000;
  if(Number((await this.host.all('SELECT COUNT(*) n FROM question_web_grants WHERE owner=?',[key]))[0].n)>=16)throw Error('too_large');
  await this.host.run('INSERT INTO question_web_grants VALUES(?,?,?,?)',[id,key,JSON.stringify({sources,origins}),expiresAt]);return{id,expiresAt};
 }
 async observe(owner:WebAnswerOwner,callId:string,receipt:XiaozhiBrowserReceipt,signal:AbortSignal){
  signal.throwIfAborted();const key=ownerKey(owner),e=receipt?.extraction;
  if(typeof callId!=='string'||!callId||callId.length>128||!receipt||!publicWebAnswerUrl(receipt.url)||typeof receipt.title!=='string'||receipt.title.length>200||typeof receipt.observedAt!=='string'||!Number.isFinite(Date.parse(receipt.observedAt))||receipt.untrusted!==true||typeof receipt.text!=='string'||receipt.text.length>24000||Buffer.byteLength(receipt.text)>48000||!e||e.engine!=='mozilla-readability-0.6.0'||!['readability','dom_region'].includes(e.method)||e.contentSha!==hash(receipt.text)||!['truncated','lossy'].every(k=>typeof e[k as 'lossy']==='boolean')||![e.sourceChars,e.figures,e.canvas,e.formulas].every(n=>Number.isSafeInteger(n)&&n>=0)||!['none','login_or_challenge'].includes(e.accessHint))throw Error('invalid_input');
  const digest=hash(canonicalReceipt(receipt)),old=(await this.host.all('SELECT id,digest FROM question_web_observations WHERE owner=? AND call_id=?',[key,callId]))[0];
  if(old){if(old.digest!==digest)throw Error('source_changed');return{id:String(old.id)};}
  if(Number((await this.host.all('SELECT COUNT(*) n FROM question_web_observations WHERE owner=?',[key]))[0].n)>=32)throw Error('too_large');
  signal.throwIfAborted();const id='webobs_'+randomUUID();await this.host.run('INSERT INTO question_web_observations VALUES(?,?,?,?,?)',[id,key,callId,JSON.stringify(receipt),digest]);return{id};
 }
 async propose(owner:WebAnswerOwner,input:WebAnswerProposal,signal:AbortSignal,callId=''):Promise<WebAnswerCandidate>{
  signal.throwIfAborted();const key=ownerKey(owner);
  if(!input||!webAnswerId(input.grantId,'webgrant')||!webAnswerId(input.observationId,'webobs')||!validQuestionContextSource(input.source)||typeof input.questionQuote!=='string'||!input.questionQuote.trim()||input.questionQuote.length>12000||!roles.some(r=>input[`${r}Quote`])||roles.some(r=>[input[`${r}Quote`],input[`${r}Text`]].some(s=>s!==undefined&&(typeof s!=='string'||!s.trim()||s.length>12000||s.includes('\0')))))throw Error('invalid_input');
  const grant=(await this.host.all('SELECT * FROM question_web_grants WHERE id=? AND owner=?',[input.grantId,key]))[0];if(!grant||Number(grant.expires_at)<Date.now())throw Error('permission_denied');
  const consent=JSON.parse(String(grant.payload_json)) as {sources:QuestionContextSource[];origins:string[]};if(!consent.sources.some(s=>s.questionId===input.source.questionId&&s.version===input.source.version))throw Error('permission_denied');
  const observed=(await this.host.all('SELECT * FROM question_web_observations WHERE id=? AND owner=?',[input.observationId,key]))[0];if(!observed)throw Error('permission_denied');
  const receipt=JSON.parse(String(observed.receipt_json)) as XiaozhiBrowserReceipt;if(hash(canonicalReceipt(receipt))!==observed.digest||!consent.origins.includes(new URL(receipt.url).origin))throw Error('permission_denied');
  const request=hash(JSON.stringify([key,input])),old=(await this.host.all('SELECT payload_json FROM question_web_candidates WHERE request_key=?',[request]))[0];if(old)return JSON.parse(String(old.payload_json));
  return this.host.writer(async target=>{
   const freshGrant=(await target.host.all('SELECT expires_at FROM question_web_grants WHERE id=? AND owner=?',[input.grantId,key]))[0];if(!freshGrant||Number(freshGrant.expires_at)<Date.now())throw Error('permission_denied');
   signal.throwIfAborted();const exists=(await target.host.all('SELECT payload_json FROM question_web_candidates WHERE request_key=?',[request]))[0];if(exists)return JSON.parse(String(exists.payload_json)) as WebAnswerCandidate;
   if(Number((await target.host.all('SELECT COUNT(*) n FROM question_web_candidates WHERE owner=?',[key]))[0].n)>=100)throw Error('too_large');
   const q=await target.host.read(input.source.questionId);if(!q)throw Error('source_changed');
   const candidate:WebAnswerCandidate={id:'webanswer_'+randomUUID(),callId,grantId:input.grantId,questionId:q.id,state:'candidate',reason:'',beforeVersion:input.source.version,afterVersion:'',createdAt:now(),roles:{},observation:{id:input.observationId,url:receipt.url,title:receipt.title,observedAt:receipt.observedAt,text:receipt.text!}};
   for(const role of roles){const quote=input[`${role}Quote`],derived=input[`${role}Text`];if(quote)candidate.roles[role]={text:derived??quote,kind:derived!==undefined&&derived!==quote?'ai_derived':'web_extracted'};}
   const missing=answerEnrichmentRoles(q),e=receipt.extraction!,matched=solutionMatch(q,input,receipt.text!);
   if(matched)for(const role of roles)if(candidate.roles[role]?.kind==='web_extracted')candidate.roles[role]!.text=matched[role];
   if(questionVersion(q)!==input.source.version){candidate.state='conflict';candidate.reason='source_changed';}
   else{
    await target.host.validate(q,signal);
    candidate.reason=q.document||q.archive?.native?'presentation_revision_required':!missing.length?'no_missing_roles':e.truncated||e.lossy||e.accessHint!=='none'?'incomplete_web_evidence':receipt.text!.includes('[公式文本]')?'formula_web_evidence':e.figures||e.canvas?'visual_web_evidence':!matched?'question_or_role_mismatch':q.answer.trim()&&normalized(q.answer)!==normalized(matched.answer)?'existing_answer_conflict':q.analysis.trim()&&normalized(q.analysis)!==normalized(matched.analysis)?'existing_analysis_mismatch':Object.values(candidate.roles).some(r=>r.kind==='ai_derived')?'derived_verification_required':'';
   }
   // Publish the immutable candidate before any business mutation, in the same transaction.
   await target.host.run('INSERT INTO question_web_candidates(id,request_key,owner,question_id,observation_id,state,payload_json,before_json,created_at) VALUES(?,?,?,?,?,?,?,?,?)',[candidate.id,request,key,q.id,input.observationId,candidate.state,JSON.stringify(candidate),JSON.stringify(q),candidate.createdAt]);
   if(candidate.state!=='conflict'&&!candidate.reason){
    const archive:QuestionArchive=q.archive?structuredClone(q.archive):{schemaVersion:QUESTION_WEB_ARCHIVE_SCHEMA,extractor:'web-answer-enriched.v1',state:'web_enriched',number:'0',sources:[],issues:archiveMissing(q),sourceRisks:[],sourceChecked:false,answerOrigin:q.answer?'unattributed':'missing',analysisOrigin:q.analysis?'unattributed':'missing'};
    archive.web??={schemaVersion:QUESTION_WEB_EVIDENCE_SCHEMA,base:q.archive?.ai?'ai':q.archive?'numbered':'manual',roles:{}};
    archive.schemaVersion=QUESTION_WEB_ARCHIVE_SCHEMA;archive.extractor='web-answer-enriched.v1';archive.state='web_enriched';const next={...q,archive,updatedAt:now()};
    let changed=0;for(const role of missing){const value=candidate.roles[role];if(!value)continue;next[role]=value.text;archive[`${role}Origin`]=value.kind==='web_extracted'?'web_extracted':'ai_generated';archive.web.roles[role]={candidateId:candidate.id,observationId:input.observationId,kind:value.kind,textSha:hash(value.text),questionSha:hash(q.stem),url:receipt.url,title:receipt.title,observedAt:receipt.observedAt};archive.issues=archive.issues.filter(code=>code!==`missing_${role}`);changed++;}
    if(!changed){candidate.reason='no_missing_roles';}
    else{
     if(!validQuestionArchive(archive))throw Error('invalid_input');
     signal.throwIfAborted();await target.host.run('UPDATE question_bank_items SET answer=?,analysis=?,archive_json=?,updated_at=? WHERE id=?',[next.answer,next.analysis,JSON.stringify(archive),next.updatedAt,q.id]);
     await target.host.run('UPDATE material_question_members SET needs_attention=? WHERE question_id=?',[archiveEligible(next)?0:1,q.id]);
     candidate.state='applied';candidate.afterVersion=questionVersion(next);
     await target.host.run('UPDATE question_web_candidates SET state=?,payload_json=?,after_json=? WHERE id=?',[candidate.state,JSON.stringify(candidate),JSON.stringify(next),candidate.id]);
     await target.host.validate(next,signal);
    }
   }
   await target.host.run('UPDATE question_web_candidates SET state=?,payload_json=? WHERE id=?',[candidate.state,JSON.stringify(candidate),candidate.id]);
   signal.throwIfAborted();return candidate;
  },()=>{signal.throwIfAborted();if(Number(grant.expires_at)<Date.now())throw Error('permission_denied');});
 }
 async list(questionId:string):Promise<WebAnswerCandidate[]>{if(!/^question_[a-f0-9-]{36}$/.test(questionId))throw Error('invalid_input');return(await this.host.all('SELECT payload_json FROM question_web_candidates WHERE question_id=? ORDER BY created_at DESC,id DESC LIMIT 5',[questionId])).map(r=>JSON.parse(String(r.payload_json)));}
 async readCurrent(questionId:string,signal:AbortSignal){const q=await this.host.read(questionId);if(!q)throw Error('source_changed');await this.host.validate(q,signal);return q;}
 async verificationSnapshot(owner:WebAnswerOwner,callId:string,candidateId:string,version:string){
  if(!webAnswerId(candidateId,'webanswer')||typeof callId!=='string'||!callId||callId.length>128||!/^[a-f0-9]{64}$/.test(version))throw Error('invalid_input');
  const row=(await this.host.all('SELECT question_id,payload_json,after_json FROM question_web_candidates WHERE id=? AND owner=? AND state=?',[candidateId,ownerKey(owner),'applied']))[0];if(!row)throw Error('evidence_missing');
  const candidate=JSON.parse(String(row.payload_json)) as WebAnswerCandidate,after=JSON.parse(String(row.after_json)) as QuestionBankItem;
  if(candidate.callId!==callId||candidate.afterVersion!==version||questionVersion(after)!==version)throw Error('evidence_missing');
  const signal=new AbortController().signal,q=await this.readCurrent(String(row.question_id),signal);if(questionVersion(q)!==version)throw Error('source_changed');
  await this.validate(q);const latest=await this.host.read(q.id);if(!latest||questionVersion(latest)!==version)throw Error('source_changed');
  return{digest:hash(JSON.stringify([ownerKey(owner),callId,candidate.id,version,row.after_json])),version};
 }
 async validate(q:QuestionBankItem){
  for(const role of roles){const proof=q.archive?.web?.roles[role];if(!proof)continue;
   const row=(await this.host.all('SELECT owner,payload_json,before_json,after_json FROM question_web_candidates WHERE id=? AND question_id=? AND state=?',[proof.candidateId,q.id,'applied']))[0];if(!row||hash(q[role])!==proof.textSha||hash(q.stem)!==proof.questionSha)throw Error('source_changed');
   const candidate=JSON.parse(String(row.payload_json)) as WebAnswerCandidate,after=JSON.parse(String(row.after_json)) as QuestionBankItem;
   if(candidate.roles[role]?.text!==q[role]||JSON.stringify(after.archive?.web?.roles[role])!==JSON.stringify(proof))throw Error('source_changed');
   const obs=(await this.host.all('SELECT receipt_json,digest FROM question_web_observations WHERE id=? AND owner=?',[proof.observationId,String(row.owner)]))[0],grant=(await this.host.all('SELECT payload_json,expires_at FROM question_web_grants WHERE id=? AND owner=?',[candidate.grantId,String(row.owner)]))[0];
   if(!obs||!grant)throw Error('source_changed');const receipt=JSON.parse(String(obs.receipt_json)) as XiaozhiBrowserReceipt,consent=JSON.parse(String(grant.payload_json)) as {sources:QuestionContextSource[];origins:string[]},before=JSON.parse(String(row.before_json)) as QuestionBankItem;
   if(hash(canonicalReceipt(receipt))!==obs.digest||receipt.url!==proof.url||receipt.title!==proof.title||receipt.observedAt!==proof.observedAt||receipt.text!==candidate.observation.text||!consent.origins.includes(new URL(receipt.url).origin)||!consent.sources.some(s=>s.questionId===q.id&&s.version===candidate.beforeVersion)||questionVersion(before)!==candidate.beforeVersion||Date.parse(candidate.createdAt)>Number(grant.expires_at))throw Error('source_changed');
  }
 }
}
