import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {imageSize} from 'image-size';
import type {QuestionBankItem} from '../../shared/contracts';
import {validQuestionArchive,type ArchiveFields} from '../../shared/question-archive';
import {NATIVE_QUESTION_ROLES,validNativeQuestionDocument,nativeQuestionConflicts,nativeQuestionComplete,type NativeQuestionFigure,type NativeQuestionRole} from '../../shared/native-question';
import type {QuestionProjection} from '../../shared/question-projection';
import {validWordQuestionSource,type WordQuestionSource} from '../../shared/material-word-question';
import {WORD_PROOF_SCHEMA,validWordProof,type WordProof,type WordProofBase,type WordProofPage} from '../../shared/material-word-proof';
import {nativeSourceRoleText,nativeTextContentDigest,wordRoleContentDigest,nativeSourceRequirements,nativeProjectionCoversSource} from './native-question-content';
import {questionVersion} from '../education/question-context-provider';
import {readMaterialOriginal} from './material-original';
import {acquireWriterLock} from '../retrieval/writer-lock';
import {aiBatchId,validAiBatch,AI_MODELS} from '../../shared/material-ai';
import {validAiNativeSelector,type AiNativeSelector} from '../../shared/material-ai-native-input';
import {validNativeAiContext,type NativeAiContext} from './material-ai-native-context';

type Row=Record<string,unknown>;type Value=string|number|null;
export type NativeSourceEvidence={source:WordQuestionSource;proof:WordProof;images:ReadonlyMap<string,Buffer>};
export type NativeTranscription={projection:QuestionProjection;roles:Record<NativeQuestionRole,{text:string;origin:'source'|'ai_generated'|'missing'}>;imagesObserved:boolean};
type Host={root:()=>string;all:(sql:string,p?:Value[])=>Promise<Row[]>;run:(sql:string,p?:Value[])=>Promise<void>;read:(id:string)=>Promise<QuestionBankItem|undefined>;
 /** Synchronous private connection state, never a BEGIN/ROLLBACK probe. Preparation hosts
  * must own a dedicated autocommit connection; caller publication uses its writer host. */
 inTransaction:()=>boolean;
 source:(base:WordProofBase)=>Promise<WordQuestionSource>;verify:(base:WordProofBase,signal:AbortSignal)=>Promise<void>;
 /** Private producer, not an IPC/model-supplied proof or pixel map. */
 attest:(proof:WordProof,signal:AbortSignal)=>Promise<NativeSourceEvidence>;
 /** Exact real AI-unit first/final receipt binding; never infer text authority from q.ai hashes alone. */
 transcription:(q:QuestionBankItem,source:WordQuestionSource,phase:'publish'|'read',signal:AbortSignal)=>Promise<NativeTranscription>;
 validate:(q:QuestionBankItem)=>Promise<void>};
export type NativeAiInputKey={batchId:string;ordinal:number;inputSha:string};
type Prepared=NativeSourceEvidence&{root:string;active:boolean;input?:NativeAiInputKey&{digest:string}};
const permits=new WeakMap<object,Prepared>(),hash=(v:string|Buffer)=>createHash('sha256').update(v).digest('hex');
const sha=(s:unknown):s is string=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);
const assetId=(s:string)=>'asset_'+[s.slice(0,8),s.slice(8,12),s.slice(12,16),s.slice(16,20),s.slice(20,32)].join('-');
const baseOf=(proof:WordProof):WordProofBase=>({schemaVersion:WORD_PROOF_SCHEMA,resourceId:proof.resourceId,version:proof.version,documentSha:proof.documentSha,ordinal:proof.ordinal});
const sameBase=(a:WordProofBase,b:WordProofBase)=>a.schemaVersion===b.schemaVersion&&a.resourceId===b.resourceId&&a.version===b.version&&a.documentSha===b.documentSha&&a.ordinal===b.ordinal;
const baseFrom=(q:QuestionBankItem):WordProofBase=>{const s=q.archive!.native!.source;return{schemaVersion:WORD_PROOF_SCHEMA,resourceId:s.resourceId,version:s.resourceVersion,documentSha:s.documentSha,ordinal:s.ordinal};};
/** Business images are immutable source evidence. No LRU or cache authority is used on read. */
export class NativeQuestionRepository{
 constructor(private readonly host:Host){}
 private assertIdle(){
  if(this.host.inTransaction())throw Error('native_transaction_boundary');
 }
 async migrate(){for(const sql of [
  'CREATE TABLE IF NOT EXISTS material_ai_native_revisions(question_id TEXT NOT NULL,question_version TEXT NOT NULL,native_digest TEXT NOT NULL,native_json TEXT NOT NULL,source_json TEXT NOT NULL,proof_json TEXT NOT NULL,PRIMARY KEY(question_id,question_version))',
  'CREATE TABLE IF NOT EXISTS material_ai_native_images(question_id TEXT NOT NULL,question_version TEXT NOT NULL,role TEXT NOT NULL,ordinal INTEGER NOT NULL,sha256 TEXT NOT NULL,bytes INTEGER NOT NULL,width INTEGER NOT NULL,height INTEGER NOT NULL,PRIMARY KEY(question_id,question_version,role,ordinal))',
  'CREATE INDEX IF NOT EXISTS material_ai_native_images_sha ON material_ai_native_images(sha256)',
  'CREATE TABLE IF NOT EXISTS material_ai_native_pending(sha256 TEXT PRIMARY KEY,pending_name TEXT NOT NULL)',
  'CREATE TABLE IF NOT EXISTS material_ai_native_inputs(batch_id TEXT NOT NULL,ordinal INTEGER NOT NULL,input_sha TEXT NOT NULL,source_json TEXT NOT NULL,proof_json TEXT NOT NULL,input_digest TEXT NOT NULL,PRIMARY KEY(batch_id,ordinal))',
  'CREATE TABLE IF NOT EXISTS material_ai_native_input_images(batch_id TEXT NOT NULL,ordinal INTEGER NOT NULL,role TEXT NOT NULL,page_index INTEGER NOT NULL,sha256 TEXT NOT NULL,bytes INTEGER NOT NULL,width INTEGER NOT NULL,height INTEGER NOT NULL,PRIMARY KEY(batch_id,ordinal,role,page_index))',
  'CREATE INDEX IF NOT EXISTS material_ai_native_input_images_sha ON material_ai_native_input_images(sha256)',
  'CREATE TABLE IF NOT EXISTS material_ai_native_context(batch_id TEXT NOT NULL,ordinal INTEGER NOT NULL,context_json TEXT NOT NULL,digest TEXT NOT NULL,PRIMARY KEY(batch_id,ordinal))'
 ])await this.host.run(sql);}
 private async folder(){
  let folder=path.resolve(this.host.root());
  const check=async(p:string)=>{const s=await fs.lstat(p);if(!s.isDirectory()||s.isSymbolicLink()||(await fs.realpath(p)).toLowerCase()!==p.toLowerCase())throw Error('unavailable');};
  await check(folder);for(const part of ['question-ai-assets','v1']){folder=path.join(folder,part);await fs.mkdir(folder).catch(e=>{if(e.code!=='EEXIST')throw e;});await check(folder);}return folder;
 }
 private async unlink(folder:string,name:string){const target=path.join(folder,name);try{const s=await fs.lstat(target);if(!s.isFile()||s.isSymbolicLink()||s.nlink!==1)throw Error('unavailable');await fs.unlink(target);}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}}
 private async recover(folder:string,signal:AbortSignal){
  const rows=await this.host.all('SELECT sha256,pending_name FROM material_ai_native_pending LIMIT 65');if(rows.length>64)throw Error('too_large');
  for(const row of rows){signal.throwIfAborted();const id=String(row.sha256),name=String(row.pending_name);if(!sha(id)||!/^\.pending-[a-f0-9-]{36}$/.test(name))throw Error('unavailable');
   await this.unlink(folder,name);if(!(await this.host.all('SELECT 1 FROM material_ai_native_images WHERE sha256=? UNION ALL SELECT 1 FROM material_ai_native_input_images WHERE sha256=? LIMIT 1',[id,id])).length)await this.unlink(folder,id+'.png');
   await this.host.run('DELETE FROM material_ai_native_pending WHERE sha256=?',[id]);
  }
 }
 private async inputUnit(key:NativeAiInputKey,signal:AbortSignal){
  signal.throwIfAborted();if(!key||Object.keys(key).sort().join(',')!=='batchId,inputSha,ordinal'||!aiBatchId(key.batchId)||!Number.isSafeInteger(key.ordinal)||key.ordinal<1||key.ordinal>100||!sha(key.inputSha))throw Error('invalid_input');
  const row=(await this.host.all('SELECT u.input_json,u.status,u.first_json,b.config_json,b.resource_id,b.version FROM material_ai_units u JOIN material_ai_batches b ON b.id=u.batch_id WHERE u.batch_id=? AND u.ordinal=?',[key.batchId,key.ordinal]))[0];
  if(!row||typeof row.input_json!=='string'||Buffer.byteLength(row.input_json)>96*1024||hash(row.input_json)!==key.inputSha||typeof row.config_json!=='string'||Buffer.byteLength(row.config_json)>4096)throw Error('source_changed');
  let unit,config;try{unit=JSON.parse(row.input_json);config=JSON.parse(row.config_json);}catch{throw Error('source_changed');}
  if(!config||typeof config!=='object')throw Error('source_changed');
  const {model,...batch}=config;
  if(!validAiBatch(batch)||!AI_MODELS.includes(model)||!batch.images||key.ordinal>batch.count||!validAiNativeSelector(unit?.native))throw Error('source_changed');
  const selector:AiNativeSelector=unit.native;
  if(selector.base.resourceId!==batch.resourceId||selector.base.version!==batch.version||row.resource_id!==batch.resourceId||row.version!==batch.version||selector.base.ordinal!==batch.start+key.ordinal-1)throw Error('source_changed');
  signal.throwIfAborted();return{row,selector};
 }
 /** Called in the same caller transaction that prepares a still-undispatched AI unit. */
 async stageInput(key:NativeAiInputKey,permit:object,signal:AbortSignal,context?:NativeAiContext){
  if(!this.host.inTransaction())throw Error('native_transaction_boundary');
  const evidence=permits.get(permit);if(!evidence?.active||evidence.root!==path.resolve(this.host.root()).toLowerCase())throw Error('permission_denied');
  const {row,selector}=await this.inputUnit(key,signal),sourceJson=JSON.stringify(evidence.source),proofJson=JSON.stringify(evidence.proof);
  if(!sameBase(selector.base,baseOf(evidence.proof))||selector.sourceDigest!==hash(sourceJson))throw Error('source_changed');
  if(context!==undefined&&!validNativeAiContext(context,evidence.source,evidence.proof))throw Error('invalid_input');
  const contextJson=context===undefined?'':JSON.stringify(context),digest=hash(JSON.stringify(context===undefined?['native-ai-input.v1',key.inputSha,sourceJson,proofJson]:['native-ai-input.v2',key.inputSha,sourceJson,proofJson,contextJson]));
  const prior=(await this.host.all('SELECT * FROM material_ai_native_inputs WHERE batch_id=? AND ordinal=?',[key.batchId,key.ordinal]))[0];
  if(prior){if(prior.input_sha!==key.inputSha||prior.source_json!==sourceJson||prior.proof_json!==proofJson||prior.input_digest!==digest)throw Error('source_changed');await this.readInput(key,signal);return digest;}
  if(row.status!=='pending'||row.first_json!=='')throw Error('source_changed');
  await this.currentSource(selector.base,evidence.source,signal);const folder=await this.folder();for(const page of evidence.proof.pages)await this.png(folder,page,signal);
  await this.host.run('INSERT INTO material_ai_native_inputs VALUES(?,?,?,?,?,?)',[key.batchId,key.ordinal,key.inputSha,sourceJson,proofJson,digest]);
  if(context!==undefined)await this.host.run('INSERT INTO material_ai_native_context VALUES(?,?,?,?)',[key.batchId,key.ordinal,contextJson,hash(contextJson)]);
  for(const p of evidence.proof.pages)await this.host.run('INSERT INTO material_ai_native_input_images VALUES(?,?,?,?,?,?,?,?)',[key.batchId,key.ordinal,p.role,p.index,p.sha256,p.bytes,p.width,p.height]);
  await this.inputUnit(key,signal);await this.currentSource(selector.base,evidence.source,signal);return digest;
 }
 /** Reopens exactly the first-dispatch evidence, independent of cache/fonts/renderer updates. */
 async readInput(key:NativeAiInputKey,signal:AbortSignal){
  const {selector}=await this.inputUnit(key,signal),row=(await this.host.all('SELECT * FROM material_ai_native_inputs WHERE batch_id=? AND ordinal=?',[key.batchId,key.ordinal]))[0];
  const contextRow=(await this.host.all('SELECT * FROM material_ai_native_context WHERE batch_id=? AND ordinal=?',[key.batchId,key.ordinal]))[0];
  if(!row||row.input_sha!==key.inputSha||typeof row.source_json!=='string'||Buffer.byteLength(row.source_json)>96*1024||typeof row.proof_json!=='string'||Buffer.byteLength(row.proof_json)>256*1024||contextRow&&(typeof contextRow.context_json!=='string'||Buffer.byteLength(contextRow.context_json)>64000||contextRow.digest!==hash(contextRow.context_json))||row.input_digest!==hash(JSON.stringify(contextRow?['native-ai-input.v2',key.inputSha,row.source_json,row.proof_json,contextRow.context_json]:['native-ai-input.v1',key.inputSha,row.source_json,row.proof_json])))throw Error('source_changed');
  let source,proof;try{source=JSON.parse(row.source_json);proof=JSON.parse(row.proof_json);}catch{throw Error('source_changed');}
  if(!validWordQuestionSource(source)||!validWordProof(proof,source)||!sameBase(selector.base,baseOf(proof))||selector.sourceDigest!==hash(row.source_json))throw Error('source_changed');
  let context:NativeAiContext|undefined;if(contextRow){try{context=JSON.parse(String(contextRow.context_json));}catch{throw Error('source_changed');}if(!validNativeAiContext(context,source,proof))throw Error('source_changed');}
  const refs=await this.host.all('SELECT * FROM material_ai_native_input_images WHERE batch_id=? AND ordinal=?',[key.batchId,key.ordinal]);
  if(refs.length!==proof.pages.length||refs.some(r=>!proof.pages.some(p=>p.role===r.role&&p.index===r.page_index&&p.sha256===r.sha256&&p.bytes===r.bytes&&p.width===r.width&&p.height===r.height)))throw Error('source_changed');
  const folder=await this.folder(),images=new Map<string,Buffer>();for(const p of proof.pages)images.set(p.sha256,await this.png(folder,p,signal));
  await this.inputUnit(key,signal);await this.currentSource(selector.base,source,signal);return{source,proof,images,digest:String(row.input_digest),context};
 }
 async withInput<T>(key:NativeAiInputKey,signal:AbortSignal,action:(permit:object)=>Promise<T>):Promise<T>{
  this.assertIdle();const folder=await this.folder(),lock=await acquireWriterLock(folder),permit=Object.freeze({});
  try{
   await this.recover(folder,signal);const evidence=await this.readInput(key,signal);
   const prepared:Prepared={source:evidence.source,proof:evidence.proof,images:evidence.images,root:path.resolve(this.host.root()).toLowerCase(),active:true,input:{...key,digest:evidence.digest}};permits.set(permit,prepared);
   signal.throwIfAborted();const result=await action(permit);signal.throwIfAborted();return result;
  }finally{const prepared=permits.get(permit);if(prepared)prepared.active=false;permits.delete(permit);try{this.assertIdle();await this.recover(folder,AbortSignal.timeout(5000));}finally{await lock.close();}}
 }
 /** Local teacher edits retain history and can restore the exact original AI stem.
  * Only genuinely plain source questions can gain fresh text coverage from the explicit check. */
 async reviseDocument(q:QuestionBankItem,fields:ArchiveFields,checked:boolean,permit:object,signal:AbortSignal){
  if(!this.host.inTransaction())throw Error('native_transaction_boundary');const evidence=permits.get(permit);
  if(!evidence?.active||evidence.root!==path.resolve(this.host.root()).toLowerCase()||!q.archive?.native)throw Error('permission_denied');
  const original=await this.host.transcription(q,evidence.source,'read',signal),document=structuredClone(q.archive.native);
  for(const role of NATIVE_QUESTION_ROLES){const field=role==='question'?'stem':role;if(fields[field]===q[field])continue;const text=fields[field];document.roles[role]={text,origin:role==='question'||text?'teacher':'missing',contentSha:nativeTextContentDigest(text),figures:[]};}
  if(fields.stem===original.roles.question.text){
   document.projection=structuredClone(original.projection);document.roles.question={text:fields.stem,origin:'source',contentSha:wordRoleContentDigest(evidence.source,'question'),figures:evidence.proof.pages.filter(p=>p.role==='question').map((p,i)=>({blockId:`native_question_${i}`,assetId:p.assetId,sha256:p.sha256,bytes:p.bytes,width:p.width,height:p.height}))};
  }else if(fields.stem!==q.stem||checked){
   document.projection=Object.fromEntries(Object.entries(document.projection).map(([field,part])=>[field,{state:'missing',text:field==='statement'?fields.stem:part.text}])) as typeof document.projection;
   const plain=!Object.values(nativeSourceRequirements(evidence.source)).some(Boolean)&&!/如图|图中|下图|见图|如表|下表|表中|!\[|<\s*(?:img|svg|table)|\[原图|\|.*\|/i.test(fields.stem);
   if(checked&&plain){document.projection=Object.fromEntries(Object.keys(document.projection).map(field=>[field,{state:field==='statement'?'provided':'not_applicable',text:field==='statement'?fields.stem:''}])) as typeof document.projection;}
  }
  if(evidence.source.issues.length)document.projection.statement.state='missing';
  return document;
 }
 async originalStem(questionId:string,version:string,signal:AbortSignal){const q=await this.host.read(questionId);if(!q||questionVersion(q)!==version)throw Error('source_changed');const {source}=await this.validate(q,signal);const original=await this.host.transcription(q,source,'read',signal);const current=await this.host.read(questionId);if(!current||questionVersion(current)!==version)throw Error('source_changed');await this.currentSource(baseFrom(q),source,signal);return original.roles.question.text;}
 private checkPng(bytes:Buffer,page:Pick<WordProofPage,'sha256'|'bytes'|'width'|'height'|'assetId'>){
  let size;try{size=imageSize(bytes);}catch{throw Error('source_changed');}
  if(bytes.length!==page.bytes||hash(bytes)!==page.sha256||size.type!=='png'||size.width!==page.width||size.height!==page.height||assetId(page.sha256)!==page.assetId)throw Error('source_changed');
 }
 private async png(folder:string,page:Pick<WordProofPage,'sha256'|'bytes'|'width'|'height'|'assetId'>,signal:AbortSignal){
  const bytes=await readMaterialOriginal(folder,path.join(folder,page.sha256+'.png'),page.sha256,signal,4*1048576);this.checkPng(bytes,page);return bytes;
 }
 private async put(folder:string,page:WordProofPage,bytes:Buffer,signal:AbortSignal){
  this.checkPng(bytes,page);try{await this.png(folder,page,signal);return;}catch(e){signal.throwIfAborted();const s=await fs.lstat(path.join(folder,page.sha256+'.png')).catch(x=>{if(x.code!=='ENOENT')throw x;return undefined;});if(s&&(!s.isFile()||s.isSymbolicLink()||s.nlink!==1))throw Error('unavailable');}
  const name='.pending-'+randomUUID(),temporary=path.join(folder,name);await this.host.run('INSERT INTO material_ai_native_pending VALUES(?,?)',[page.sha256,name]);
  const handle=await fs.open(temporary,'wx',0o600);try{await handle.writeFile(bytes);await handle.sync();}finally{await handle.close();}
  signal.throwIfAborted();await fs.rename(temporary,path.join(folder,page.sha256+'.png'));await this.png(folder,page,signal);
 }
 private async currentSource(base:WordProofBase,expected:WordQuestionSource,signal:AbortSignal){
  signal.throwIfAborted();await this.host.verify(base,signal);const source=await this.host.source(base);
  if(!validWordQuestionSource(source)||source.documentSha!==base.documentSha||source.ordinal!==base.ordinal||JSON.stringify(source)!==JSON.stringify(expected))throw Error('source_changed');await this.host.verify(base,signal);signal.throwIfAborted();
 }
 async withEvidence<T>(input:NativeSourceEvidence,signal:AbortSignal,action:(permit:object)=>Promise<T>):Promise<T>{
  this.assertIdle();
  signal.throwIfAborted();if(!validWordQuestionSource(input?.source)||!validWordProof(input?.proof,input.source)||!this.host.attest)throw Error('invalid_input');
  const verified=await this.host.attest(input.proof,signal);
  if(JSON.stringify(verified.source)!==JSON.stringify(input.source)||JSON.stringify(verified.proof)!==JSON.stringify(input.proof)||input.images.size!==new Set(verified.proof.pages.map(p=>p.sha256)).size)throw Error('source_changed');
  const prepared:Prepared={source:structuredClone(verified.source),proof:structuredClone(verified.proof),images:new Map(),root:path.resolve(this.host.root()).toLowerCase(),active:true};
  const copied=new Map<string,Buffer>();for(const p of prepared.proof.pages){const original=verified.images.get(p.sha256),given=input.images.get(p.sha256);if(!original||!given||!Buffer.isBuffer(original)||!Buffer.isBuffer(given)||!original.equals(given))throw Error('source_changed');this.checkPng(original,p);copied.set(p.sha256,Buffer.from(original));}prepared.images=copied;
  const folder=await this.folder(),lock=await acquireWriterLock(folder),permit=Object.freeze({});permits.set(permit,prepared);
  try{
   await this.recover(folder,signal);await this.currentSource(baseOf(prepared.proof),prepared.source,signal);
   const stat=await fs.statfs(folder);if(stat.bavail*stat.bsize<prepared.proof.pages.reduce((sum,p)=>sum+p.bytes,0)+16*1048576)throw Error('disk_full');
   for(const p of new Map(prepared.proof.pages.map(p=>[p.sha256,p])).values())await this.put(folder,p,prepared.images.get(p.sha256)!,signal);
   signal.throwIfAborted();const value=await action(permit);signal.throwIfAborted();return value;
  }finally{prepared.active=false;permits.delete(permit);try{this.assertIdle();await this.recover(folder,AbortSignal.timeout(5000));}finally{await lock.close();}}
 }
 private async checkRole(q:QuestionBankItem,source:WordQuestionSource,proof:WordProof,phase:'publish'|'read',signal:AbortSignal){
  const document=q.archive!.native!;
  const transcript=await this.host.transcription(q,source,phase,signal);signal.throwIfAborted();
  if(q.archive!.state!=='teacher_edited'&&JSON.stringify(document.projection)!==JSON.stringify(transcript.projection))throw Error('source_changed');
  for(const [field,needed]of Object.entries(nativeSourceRequirements(source)))if(needed){const part=document.projection[field as 'formulas'|'tables'|'figures'|'choices'|'subquestions'];if(part.state==='not_applicable'||q.archive!.state==='ai_final'&&(part.state!=='provided'||field==='figures'&&!transcript.imagesObserved))throw Error('source_incomplete');}
  if(q.archive!.state==='ai_final'&&!nativeProjectionCoversSource(source,document.projection))throw Error('source_incomplete');
  if(q.archive!.state==='ai_final'&&!nativeQuestionComplete(document))throw Error('source_incomplete');
  for(const role of NATIVE_QUESTION_ROLES){const body=document.roles[role],pages=proof.pages.filter(p=>p.role===role);
   if(body.origin==='source'){
    if(transcript.roles[role].origin!=='source'||body.text!==transcript.roles[role].text||body.contentSha!==wordRoleContentDigest(source,role)||body.figures.length!==pages.length)throw Error('source_changed');
    for(const [index,f]of body.figures.entries()){const p=pages[index];if(!p||f.blockId!==`native_${role}_${index}`||['sha256','assetId','bytes','width','height'].some(k=>(f as unknown as Row)[k]!=(p as unknown as Row)[k]))throw Error('source_changed');}
   }else if(body.contentSha!==nativeTextContentDigest(body.text)||body.figures.length||body.origin==='teacher'&&q.archive!.state!=='teacher_edited'||body.origin!=='teacher'&&(transcript.roles[role].origin!==body.origin||transcript.roles[role].text!==body.text))throw Error('source_changed');
  }
 }
 async publish(q:QuestionBankItem,permit:object,signal:AbortSignal){
  if(!this.host.inTransaction())throw Error('native_transaction_boundary');
  const evidence=permits.get(permit);if(!evidence?.active||evidence.root!==path.resolve(this.host.root()).toLowerCase())throw Error('permission_denied');
  if(!validQuestionArchive(q.archive)||!validNativeQuestionDocument(q.archive.native)||nativeQuestionConflicts(q,q.archive.native).length)throw Error('invalid_input');
  if(evidence.input&&(q.archive.ai?.batchId!==evidence.input.batchId||q.archive.ai.ordinal!==evidence.input.ordinal||q.archive.ai.imageSha!==evidence.input.digest))throw Error('source_changed');
  const document=q.archive.native,base=baseFrom(q);if(!sameBase(base,baseOf(evidence.proof))||document.source.sourceDigest!==hash(JSON.stringify(evidence.source))||evidence.source.issues.length&&q.archive.state==='ai_final')throw Error('source_changed');
  await this.checkRole(q,evidence.source,evidence.proof,'publish',signal);await this.currentSource(base,evidence.source,signal);
  const folder=await this.folder();for(const p of evidence.proof.pages)await this.png(folder,p,signal);
  const version=questionVersion(q),nativeJson=JSON.stringify(document),digest=hash(nativeJson),rows=await this.host.all('SELECT native_digest,source_json,proof_json FROM material_ai_native_revisions WHERE question_id=? AND question_version=?',[q.id,version]);
  const sourceJson=JSON.stringify(evidence.source),proofJson=JSON.stringify(evidence.proof);
  const current=await this.host.read(q.id);if(!current||questionVersion(current)!==version)throw Error('source_changed');
  if(rows.length){if(rows[0].native_digest!==digest||rows[0].source_json!==sourceJson||rows[0].proof_json!==proofJson)throw Error('source_changed');await this.currentSource(base,evidence.source,signal);return;}
  await this.host.run('INSERT INTO material_ai_native_revisions VALUES(?,?,?,?,?,?)',[q.id,version,digest,nativeJson,sourceJson,proofJson]);
  for(const p of evidence.proof.pages){signal.throwIfAborted();await this.host.run('INSERT INTO material_ai_native_images VALUES(?,?,?,?,?,?,?,?)',[q.id,version,p.role,p.index,p.sha256,p.bytes,p.width,p.height]);}
  await this.currentSource(base,evidence.source,signal);const saved=await this.host.read(q.id);if(!saved||questionVersion(saved)!==version)throw Error('source_changed');await this.currentSource(base,evidence.source,signal);signal.throwIfAborted();
 }
 async validate(q:QuestionBankItem,signal:AbortSignal=new AbortController().signal){
  if(!validQuestionArchive(q.archive)||!validNativeQuestionDocument(q.archive.native)||nativeQuestionConflicts(q,q.archive.native).length)throw Error('source_changed');
  const version=questionVersion(q),row=(await this.host.all('SELECT * FROM material_ai_native_revisions WHERE question_id=? AND question_version=?',[q.id,version]))[0];if(!row||row.native_json!==JSON.stringify(q.archive.native)||row.native_digest!==hash(String(row.native_json)))throw Error('source_changed');
  if(typeof row.source_json!=='string'||Buffer.byteLength(row.source_json)>96*1024||typeof row.proof_json!=='string'||Buffer.byteLength(row.proof_json)>256*1024)throw Error('source_changed');
  let source:WordQuestionSource,proof:WordProof;try{source=JSON.parse(row.source_json);proof=JSON.parse(row.proof_json);}catch{throw Error('source_changed');}
  if(!validWordQuestionSource(source)||!validWordProof(proof,source)||q.archive.native.source.sourceDigest!==hash(row.source_json)||!sameBase(baseOf(proof),baseFrom(q)))throw Error('source_changed');
  await this.checkRole(q,source,proof,'read',signal);await this.currentSource(baseFrom(q),source,signal);
  const references=await this.host.all('SELECT * FROM material_ai_native_images WHERE question_id=? AND question_version=?',[q.id,version]);
  if(references.length!==proof.pages.length||references.some(r=>!proof.pages.some(p=>p.role===r.role&&p.index===r.ordinal&&p.sha256===r.sha256&&p.bytes===r.bytes&&p.width===r.width&&p.height===r.height)))throw Error('source_changed');
  const folder=await this.folder();for(const p of proof.pages)await this.png(folder,p,signal);await this.currentSource(baseFrom(q),source,signal);signal.throwIfAborted();return{source,proof};
 }
 async officeImages(questionId:string,version:string,audience:'student'|'teacher',signal:AbortSignal){
  signal.throwIfAborted();if(!/^question_[a-f0-9-]{36}$/.test(questionId)||!sha(version)||!['student','teacher'].includes(audience))throw Error('invalid_input');
  const q=await this.host.read(questionId);if(!q||questionVersion(q)!==version)throw Error('source_changed');await this.host.validate(q);const {source}=await this.validate(q,signal);
  const folder=await this.folder(),images:{role:'question'|'answer'|'analysis';figure:NativeQuestionFigure;bytes:Buffer}[]=[];
  for(const role of NATIVE_QUESTION_ROLES){if(audience==='student'&&role!=='question')continue;for(const figure of q.archive!.native!.roles[role].figures)images.push({role,figure:{...figure},bytes:await this.png(folder,figure,signal)});}
  const latest=await this.host.read(questionId);if(!latest||questionVersion(latest)!==version)throw Error('source_changed');await this.currentSource(baseFrom(q),source,signal);signal.throwIfAborted();return images;
 }
}
