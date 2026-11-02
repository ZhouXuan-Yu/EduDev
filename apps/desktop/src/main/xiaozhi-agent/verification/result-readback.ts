import {computationEffectTool} from '../../../shared/xiaozhi-computation';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import type {TaskVerification} from '../../../shared/xiaozhi-verification';
import type {PublicImageDelivery} from '../../../shared/xiaozhi-public-images';
import {verifyCriteria,type RegisteredEvidence,type Criterion} from './verifier';
import type {BoundEffect} from './effect-readback';
import {captureNativeTail,readNativeTail} from '../events/native-tail';
import {withoutPlanBasisReference} from '../plan-native';
import {discoveryTools,discoverySnapshot} from './discovery-readback';
import {validPresentationUnchangedReceipt} from '../../../shared/xiaozhi-presentation-edit';

type NativeResult={toolCallId:string;toolName:string;content:unknown;isError?:boolean};
type Captured={tool:string;callId:string;version:string;digest:string;payload:Record<string,any>;observedAt:string;effectWork?:Promise<BoundEffect|undefined>;effect?:BoundEffect};
const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const hex=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const effects=new Set(['education_create_report','education_web_answer','office_create_text','office_create_science_figure','office_edit_text','office_create_document','office_deliver_files','education_propose_questions','education_propose_practice']);
const kinds:Record<string,string>={education_web_answer:'saved_questions',office_list_files:'directory',office_file_stat:'file_metadata',office_web_fetch:'web',office_browser:'web',office_read_attachment:'attachment',office_read_text:'file',office_view_public_image:'image',office_create_text:'saved_text',office_create_science_figure:'saved_text',office_edit_text:'saved_text',office_create_document:'saved_office',office_deliver_files:'saved_bundle',education_propose_questions:'saved_questions',education_propose_practice:'saved_questions'};
async function bounded<T>(work:()=>Promise<T>):Promise<T|undefined>{
 let timer:ReturnType<typeof setTimeout>|undefined;
 try{return await Promise.race([Promise.resolve().then(work),new Promise<undefined>(resolve=>{timer=setTimeout(()=>resolve(undefined),10000);})]);}
 catch{return undefined;}finally{if(timer)clearTimeout(timer);}
}
function normalize(tool:string,content:unknown,callId:string):Omit<Captured,'tool'|'callId'|'observedAt'>|undefined{
 if(!Array.isArray(content))return;
 content=withoutPlanBasisReference(content,callId,tool);
 if(!Array.isArray(content))return;
 const text=content.filter(p=>p?.type==='text'&&typeof p.text==='string').map(p=>p.text).join('\n');
 if(text.length>1048576)return;
 if(tool==='office_view_public_image'){
  const images=content.filter(p=>p?.type==='image'&&typeof p.data==='string'&&p.data.length<=6*1048576);
  if(images.length!==1||!text.trim())return;
  const bytes=images.map(p=>[p.mimeType,createHash('sha256').update(Buffer.from(p.data,'base64')).digest('hex')]);
  return{digest:hash(bytes),version:hash([text,bytes]),payload:{}};
 }
 let payload:Record<string,any>;try{payload=JSON.parse(text);}catch{return;}
 if(tool==='office_browser'){
  if(typeof payload?.url!=='string'||!/^https?:\/\//.test(payload.url)||typeof payload.title!=='string'||!Number.isFinite(Date.parse(payload.observedAt)))return;
  if(payload.captured===true&&payload.capture&&typeof payload.capture==='object'){
   const capture=payload.capture;
   if(capture.schemaVersion!=='xiaozhi.browser-capture.v1'||!hex(capture.sha256)||!Number.isSafeInteger(capture.size)||capture.size<1||!Number.isSafeInteger(capture.width)||capture.width<1||!Number.isSafeInteger(capture.height)||capture.height<1||capture.url!==payload.url)return;
   return{digest:hash(['browser-capture',capture.sha256,capture.size,capture.width,capture.height,payload.url,payload.title]),version:capture.sha256,payload};
  }
  if(payload.extraction){
   const e=payload.extraction;
   if(e.engine!=='mozilla-readability-0.6.0'||!['readability','dom_region'].includes(e.method)||typeof payload.text!=='string'||!payload.text.trim()||payload.text.length>24000||Buffer.byteLength(payload.text)>48000||!Number.isSafeInteger(e.sourceChars)||e.sourceChars<0||e.sourceChars>2097152||typeof e.truncated!=='boolean'||typeof e.lossy!=='boolean'||!['none','login_or_challenge'].includes(e.accessHint)||!['figures','canvas','formulas'].every(k=>Number.isSafeInteger(e[k])&&e[k]>=0&&e[k]<=20000)||e.contentSha!==createHash('sha256').update(payload.text).digest('hex'))return;
   const digest=hash(['browser-extraction',payload.url,payload.title,payload.text,e]);return{digest,version:digest,payload};
  }
  if(typeof payload.snapshotId!=='string'||!payload.snapshotId||typeof payload.text!=='string'||!payload.text.trim())return;
  const digest=hash(['browser-snapshot',payload.url,payload.title,payload.snapshotId,payload.text]);
  return{digest,version:digest,payload};
 }
 if(!payload||payload.success!==true)return;
 tool=computationEffectTool(tool,payload);
 if(discoveryTools.has(tool))return discoverySnapshot(tool,payload);
 if(tool==='education_web_answer'){
  if(payload.state!=='applied'||payload.currentVersionMatches!==true||!hex(payload.afterVersion)||payload.currentVersion!==payload.afterVersion||typeof payload.id!=='string'||!/^webanswer_[a-f0-9-]{36}$/.test(payload.id))return;
  const digest=hash(payload);return{digest,version:digest,payload};
 }
 if(tool==='education_propose_questions'){
  if(payload.state!=='confirmed'||!Number.isInteger(payload.count)||payload.count<1||payload.count>8||!['variation','ai_original','explanation'].includes(payload.generationKind))return;
  const digest=hash(payload);return{digest,version:digest,payload};
 }
 if(tool==='education_propose_practice'){
  if(payload.state!=='confirmed'||!Number.isInteger(payload.count)||payload.count<1||payload.count>8||typeof payload.title!=='string'||!payload.title.trim())return;
  const digest=hash(payload);return{digest,version:digest,payload};
 }
 if(tool==='office_deliver_files'){
  if(typeof payload.bundleId!=='string'||!/^xidelivery_[a-f0-9]{64}$/.test(payload.bundleId)||payload.outcome!=='saved'||!Array.isArray(payload.files)||payload.files.length<2||payload.files.length>8)return;
  const digest=hash(payload);return{digest,version:digest,payload};
 }
 if(effects.has(tool)){
  if(tool==='office_create_document'&&validPresentationUnchangedReceipt(payload)){const digest=hash(payload);return{digest,version:digest,payload};}
  if(typeof payload.file!=='string'||!payload.file||!['applied','saved'].includes(payload.outcome))return;
  const digest=hash(payload);return{digest,version:digest,payload};
 }
 if(tool==='office_web_fetch'){
  if(typeof payload.text!=='string'||!payload.text.trim()||typeof payload.url!=='string'||!/^https?:\/\//.test(payload.url)||!Number.isFinite(Date.parse(payload.observedAt)))return;
  // A new fetch timestamp is part of raw receipt integrity, not new content.
  return{digest:hash([payload.url,payload.text,payload.truncated===true]),version:hash([payload.url,payload.text,payload.observedAt,payload.truncated===true]),payload};
 }
 if(tool==='office_read_attachment'){
  if(typeof payload.text!=='string'||!payload.text.trim()||!hex(payload.source?.version)||typeof payload.source.attachmentId!=='string')return;
  const digest=hash([payload.text,payload.source,payload.teacherCorrected===true,payload.ocrRevision??null]);return{digest,version:payload.source.version,payload};
 }
 if(tool==='office_read_text'){
  if(typeof payload.data?.text!=='string'||!payload.data.text.trim()||!hex(payload.data.version)||typeof payload.data.source!=='string')return;
  return{digest:hash([payload.data.text,payload.data.source,payload.data.version]),version:payload.data.version,payload};
 }
}

/** Bounded, main-owned native tail reader. Old branch calls cannot satisfy the
 * current run. No tool execution, model call, upload or data mutation occurs. */
export function bindNativeResultReadback(file:string,stateRoot:string){
 const binding=captureNativeTail(file,stateRoot);
 return async():Promise<NativeResult[]>=>{
  const entries=await readNativeTail(binding,stateRoot);return entries.filter(entry=>entry.type==='message'&&entry.message?.role==='toolResult').map(entry=>entry.message);
 };
}

/** Result integrity has an explicit scope and a separate human answer check.
 * Matching a durable tool body is never a claim that the answer is correct. */
export function createRunResultReadback(options:{runId:string;readLocal:(tool:string,payload:Record<string,any>)=>Promise<unknown>;
 verifyImage:(receipt:PublicImageDelivery)=>Promise<boolean>;bindEffect?:(callId:string,tool:string,payload:Record<string,any>)=>Promise<BoundEffect>;bindDiscovery?:(callId:string,tool:string,payload:Record<string,any>)=>Promise<BoundEffect>}){
 const captured=new Map<string,Captured>(),images=new Map<string,PublicImageDelivery>();let overflow=false,discoveryIncomplete=false,finished=false;
 function capture(callId:string,tool:string,result:unknown,failed:boolean){
  if(finished||(!Object.prototype.hasOwnProperty.call(kinds,tool)&&tool!=='education_create_report')||failed)return;
  if(captured.has(callId)||captured.size>=30||!callId||callId.length>90){overflow=true;return;}
  const c=normalize(tool,(result as {content?:unknown})?.content,callId);if(c){
   const value:Captured={...c,tool,callId,observedAt:new Date().toISOString()};captured.set(callId,value);
   if(effects.has(tool)&&options.bindEffect)value.effectWork=bounded(()=>options.bindEffect!(callId,tool,structuredClone(c.payload)));
   if(discoveryTools.has(tool)&&options.bindDiscovery)value.effectWork=bounded(()=>options.bindDiscovery!(callId,tool,structuredClone(c.payload)));
  }else if(discoveryTools.has(tool))discoveryIncomplete=true;
  else if(tool==='education_web_answer'){
   let payload:Record<string,unknown>|undefined;try{const content=(result as {content?:{type:string;text?:string}[]})?.content;payload=JSON.parse(content?.filter(p=>p.type==='text').map(p=>p.text).join('\n')||'');}catch{/* Invalid saved receipts remain incomplete. */}
   if(!payload||payload.success!==true||!(['candidate','conflict'].includes(String(payload.state))||payload.state===undefined&&(typeof payload.grantId==='string'||Array.isArray(payload.items))))overflow=true;
  }else overflow=true;
 }
 function image(receipt:PublicImageDelivery){if(receipt.state==='received')images.set(receipt.callId,structuredClone(receipt));}
 async function check(base:TaskVerification,readNative:()=>Promise<NativeResult[]>,signal?:AbortSignal,includeDiscovery=true):Promise<TaskVerification>{
  signal?.throwIfAborted();
  if(base.runId!==options.runId)throw Error('invalid_input');
  const checkpoint=[...captured.values()].filter(c=>includeDiscovery||!discoveryTools.has(c.tool)),incomplete=overflow||includeDiscovery&&discoveryIncomplete,imageSnapshot=new Map(images);
  if(!checkpoint.length&&!incomplete)return base;
  let native:NativeResult[]=[];try{native=await bounded(readNative)||[];}catch{/* Missing native evidence cannot pass. */}signal?.throwIfAborted();
  const nativeMatch=(c:Captured)=>{const matches=native.filter(r=>r.toolCallId===c.callId&&r.toolName===c.tool);if(matches.length!==1||matches[0].isError)return false;const stored=normalize(c.tool,matches[0].content,c.callId);return stored?.digest===c.digest&&stored?.version===c.version&&(c.tool!=='office_read_text'||stored.payload.data.sha256===c.payload.data.sha256);};
  for(const c of checkpoint)if(c.effectWork){const effect=await c.effectWork;if(effect&&hex(effect.digest)&&hex(effect.version))c.effect=effect;}
  const historical=new Map<string,BoundEffect>();
  for(let i=0;i<checkpoint.length;i++){
   const read=checkpoint[i];if(read.tool!=='office_read_text'||!nativeMatch(read))continue;
   for(const later of checkpoint.slice(i+1)){if(!later.effect?.input||!nativeMatch(later))continue;
    const input=await bounded(()=>later.effect!.input!({source:read.payload.data.source,version:read.version,text:read.payload.data.text,sha256:read.payload.data.sha256}));
    if(input&&hex(input.digest)&&hex(input.version)){historical.set(read.callId,input);break;}
   }
  }
  const registry=new Map<string,RegisteredEvidence>(),criteria:Criterion[]=[],byId=new Map<string,Captured>();
  for(const c of checkpoint){
   signal?.throwIfAborted();
   if(c.effectWork){const effect=await c.effectWork;if(effect&&hex(effect.digest)&&hex(effect.version))c.effect=effect;}
   const id=`result:${c.callId}`;byId.set(id,c);
   const input=historical.get(c.callId),bound=input||c.effect;
   const digest=bound?hash([c.digest,bound.digest]):c.digest,version=bound?.version||c.version;
   registry.set(id,{id,runId:options.runId,callId:c.callId,kind:'readback',digest,version,succeeded:true,observedAt:c.observedAt});
   const kind=c.tool==='office_create_document'&&validPresentationUnchangedReceipt(c.payload)?'unchanged_office':kinds[computationEffectTool(c.tool,c.payload)];
   criteria.push({id:`${input?'file_before_edit':kind}:${c.callId}`,kind:'readback',alternatives:[id],expectedDigest:digest,version});
  }
  criteria.push({id:'answer:human',kind:'human',alternatives:[]});
  if(incomplete)criteria.push({id:'coverage:unknown',kind:'readback',alternatives:[]});
  const result=await verifyCriteria({runId:options.runId,criteria,registry,read:async e=>{
   signal?.throwIfAborted();
   const c=byId.get(e.id)!;const matches=native.filter(r=>r.toolCallId===c.callId&&r.toolName===c.tool);
   if(matches.length!==1||matches[0].isError)return;
   const stored=normalize(c.tool,matches[0].content,c.callId);if(!stored||stored.digest!==c.digest||stored.version!==c.version)return;
   const input=historical.get(c.callId);if(input){const actual=await bounded(input.read);if(!actual||actual.digest!==input.digest||actual.version!==input.version)return;return{runId:options.runId,callId:c.callId,digest:hash([stored.digest,actual.digest]),version:actual.version,succeeded:true};}
   if(effects.has(c.tool)||discoveryTools.has(c.tool)){
    if(!c.effect)return;
    const actual=await bounded(c.effect.read);if(!actual||actual.digest!==c.effect.digest||actual.version!==c.effect.version)return;
    return{runId:options.runId,callId:c.callId,digest:hash([stored.digest,actual.digest]),version:actual.version,succeeded:true};
   }
   if(c.tool==='office_read_attachment'||c.tool==='office_read_text'){
    const local=normalize(c.tool,await options.readLocal(c.tool,c.payload),c.callId);if(!local||local.digest!==c.digest||local.version!==c.version)return;
   }
   if(c.tool==='office_view_public_image'){
    const receipt=imageSnapshot.get(c.callId);if(!receipt?.attachment||!await options.verifyImage(receipt))return;
   }
   return{runId:options.runId,callId:c.callId,digest:stored.digest,version:stored.version,succeeded:true};
  }});
  signal?.throwIfAborted();const missing=result.checks.some(c=>c.state==='unknown');
  return{...base,checkedAt:result.checkedAt,
   state:['blocked','partial'].includes(base.state)?base.state:missing?'partial':'needs_human',
   reason:['blocked','partial'].includes(base.state)?base.reason:missing?'evidence_missing':'human_review',
   checks:[...base.checks,...result.checks].slice(0,64),evidence:[...base.evidence,...result.evidence]};
 }
 // Discovery is a checkpoint for continuation, not an acceptance criterion.
 // Its immutable checkpoint events remain in the journal. Final results must
 // not become invalid merely because an approved save added a directory entry.
 return{capture,image,check,finish:async(base:TaskVerification,readNative:()=>Promise<NativeResult[]>)=>{finished=true;return check(base,readNative,undefined,false);}};
}
