import type {ToolDefinition} from '@earendil-works/pi-coding-agent';
import {assertFileWritesEnabled} from './file-write-policy';
import {DELIVERY_SCHEMA,deliveryId,validDeliveryDecision,type DeliveryDecision,type DeliveryResult,type DeliverySummary} from '../../shared/xiaozhi-delivery';
import {OFFICE_ARTIFACT_SCHEMA,validOfficeProposal,type OfficeArtifactProposal,type OfficeArtifactReviseInput,type OfficeArtifactResult,type OfficeArtifactSummary} from '../../shared/xiaozhi-office-artifacts';
import type {XiaozhiAgentEventPayload} from '../../shared/xiaozhi-agent';
import {createDeliveryState,deliveryHash,type DeliveryRow,type DeliveryRef} from './delivery-state';
import {changeSummary,createTextChangeState} from './text-change-state';
import {officeSummary,createOfficeArtifactState} from './office-artifact-state';
import type {createTextChangeService} from './text-change-service';
import type {createOfficeArtifactService} from './office-artifact-service';
import type {BoundEffect} from './verification/effect-readback';

type FileSpec={fileId:string;kind:'text';path:string;content:string}|({fileId:string;kind:'office'}&OfficeArtifactProposal);
type Wait=(action:()=>Promise<boolean>)=>Promise<boolean>;
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const code=(e:unknown)=>e instanceof Error&&['file_writes_disabled','invalid_input','permission_denied','conflict','busy','cancelled','too_large'].includes(e.message)?e.message:'configuration';
const resultError=(e:unknown)=>{const c=code(e);return{ok:false as const,error:(['file_writes_disabled','invalid_input','permission_denied','conflict','busy'].includes(c)?c:'configuration') as 'file_writes_disabled'|'invalid_input'|'permission_denied'|'conflict'|'busy'|'configuration'};};
const childCall=(callId:string,fileId:string)=>'delivery_'+deliveryHash([callId,fileId]);
const saved=(f:DeliverySummary['files'][number])=>f.kind==='text'?f.change?.state==='applied':f.artifact?.state==='saved';

/** Thin orchestration over the original two file services. Bundle approval has no file effects. */
export function createDeliveryCoordinator(options:{state:ReturnType<typeof createDeliveryState>;changes:ReturnType<typeof createTextChangeState>;artifacts:ReturnType<typeof createOfficeArtifactState>;
 text:ReturnType<typeof createTextChangeService>;office:ReturnType<typeof createOfficeArtifactService>;
 current:(sessionId:string,runId:string)=>boolean;taskVersion:(sessionId:string)=>Promise<string>;
 emit:(sessionId:string,runId:string,event:XiaozhiAgentEventPayload)=>void;sanitize:(kind:'text'|'office',path:string)=>Promise<string>;
 verify:(sessionId:string,ref:DeliveryRef)=>Promise<BoundEffect>;proposalError?:(sessionId:string,runId:string,raw:unknown)=>string|undefined|Promise<string|undefined>}){
 const waits=new Map<string,{sessionId:string;runId:string;finish:(approved:boolean)=>void}>();
 const locks=new Map<string,Promise<unknown>>();
 async function locked<T>(id:string,action:()=>Promise<T>):Promise<T>{
  const previous=locks.get(id)??Promise.resolve();const work=previous.catch(()=>undefined).then(action);locks.set(id,work);
  try{return await work;}finally{if(locks.get(id)===work)locks.delete(id);}
 }
 async function owned(sessionId:string,id:string){const row=await options.state.get(id);if(!row||row.sessionId!==sessionId)throw Error('permission_denied');return row;}
 async function summary(row:DeliveryRow):Promise<DeliverySummary>{
  const children=await Promise.all(row.files.map(async ref=>{
   const child=ref.draftId?(ref.kind==='text'?await options.changes.get(ref.draftId):await options.artifacts.get(ref.draftId)):null;
   if(child&&(child.sessionId!==row.sessionId||child.runId!==ref.runId||child.callId!==ref.callId||child.path!==ref.path))throw Error('configuration');return child;
  }));
  const files=row.files.map((ref,index)=>{
   const child=children[index];
   return{fileId:ref.fileId,kind:ref.kind,path:ref.path,draftId:ref.draftId,carried:ref.carried,...(ref.error?{error:ref.error}:{}),
    ...(child?(ref.kind==='text'?{change:changeSummary(child as NonNullable<Awaited<ReturnType<typeof options.changes.get>>>)}:{artifact:officeSummary(child as NonNullable<Awaited<ReturnType<typeof options.artifacts.get>>>)}):{})};
  });
  const versions=children.map(child=>child?[child.id,child.revision,child.workspaceHash,'afterSha256'in child?child.afterSha256:child.draftHash,child.inputHash]:null);
  return{schemaVersion:DELIVERY_SCHEMA,id:row.id,runId:row.runId,callId:row.callId,revision:row.revision,state:row.state,taskVersion:row.taskVersion,files,
   fingerprint:deliveryHash([row.id,row.revision,row.taskVersion,row.files,versions]),...(row.parentId?{parentId:row.parentId}:{})};
 }
 async function publish(row:DeliveryRow){const value=await summary(row);options.emit(row.sessionId,row.runId,{kind:'delivery_bundle',delivery:value});return value;}
 function current(row:DeliveryRow,signal?:AbortSignal){signal?.throwIfAborted();if(!options.current(row.sessionId,row.runId))throw Error('cancelled');}
 async function version(row:DeliveryRow){current(row);if(await options.taskVersion(row.sessionId)!==row.taskVersion)throw Error('conflict');current(row);}
 async function invalidate(row:DeliveryRow){
  for(const ref of row.files){if(ref.carried||!ref.draftId)continue;
   if(ref.kind==='text'){const child=await options.changes.get(ref.draftId);if(child&&['pending','approved'].includes(child.state))await options.changes.transition(child,[child.state],'interrupted');}
   else{const child=await options.artifacts.get(ref.draftId);if(child&&['pending','approved'].includes(child.state))await options.artifacts.transition(child,[child.state],'interrupted');}
  }
 }
 async function cancel(runId:string){
  for(const [id,wait] of waits)if(wait.runId===runId){
   try{await locked(id,async()=>{const row=await owned(wait.sessionId,id);await invalidate(row);if(['preparing','pending','approving','approved'].includes(row.state))await publish(await options.state.update(row,{state:'interrupted',approval:null}));});}
   finally{wait.finish(false);}
  }
 }
 async function decide(input:DeliveryDecision):Promise<DeliveryResult>{
  if(!validDeliveryDecision(input))return{ok:false,error:'invalid_input'};
  return locked<DeliveryResult>(input.bundleId,async()=>{
   let row=await owned(input.sessionId,input.bundleId);const waiting=waits.get(row.id);
   try{
    if(!waiting||waiting.sessionId!==input.sessionId||row.state!=='pending')throw Error('permission_denied');
    await version(row);const before=await summary(row);
    if(row.revision!==input.revision||before.fingerprint!==input.fingerprint)throw Error('conflict');
    row=await options.state.update(row,{state:'approving',approval:input.fingerprint});
    if(input.action==='reject'){
     for(const ref of row.files)if(!ref.carried&&ref.draftId){
      if(ref.kind==='text'){const child=await options.changes.get(ref.draftId);if(child?.state==='pending')await options.text.decision({schemaVersion:'xiaozhi.change.v1',sessionId:row.sessionId,changeId:child.id,revision:child.revision,action:'reject'});}
      else{const child=await options.artifacts.get(ref.draftId);if(child?.state==='pending')await options.office.decide({schemaVersion:OFFICE_ARTIFACT_SCHEMA,sessionId:row.sessionId,draftId:child.id,revision:child.revision,action:'reject'});}
     }
     row=await options.state.update(row,{state:'rejected',approval:null});waiting.finish(false);return{ok:true,value:await publish(row)};
    }
    for(const ref of row.files){
     await version(row);
     if(ref.carried){await options.verify(row.sessionId,ref);continue;}
     if(!ref.draftId)throw Error('conflict');
     if(ref.kind==='text'){const child=await options.changes.get(ref.draftId);if(!child||child.state!=='pending')throw Error('conflict');const outcome=await options.text.decision({schemaVersion:'xiaozhi.change.v1',sessionId:row.sessionId,changeId:child.id,revision:child.revision,action:'approve'});if(outcome.state!=='approved')throw Error('conflict');}
     else{const child=await options.artifacts.get(ref.draftId);if(!child||child.state!=='pending')throw Error('conflict');const outcome=await options.office.decide({schemaVersion:OFFICE_ARTIFACT_SCHEMA,sessionId:row.sessionId,draftId:child.id,revision:child.revision,action:'approve'});if(outcome.state!=='approved')throw Error('conflict');}
    }
    await version(row);row=await options.state.update(row,{state:'approved'});const value=await publish(row);waiting.finish(true);return{ok:true,value};
   }catch(e){
    if(row.state==='approving'){await invalidate(row);row=await options.state.update(row,{state:'conflict',approval:null});await publish(row);waiting?.finish(false);}
    return resultError(e);
   }
  }).catch(resultError);
 }
 async function revise(input:OfficeArtifactReviseInput):Promise<OfficeArtifactResult<OfficeArtifactSummary>>{
  const owner=await options.state.owner(input.sessionId,input.draftId);if(!owner)return{ok:false,error:'permission_denied'};
  return locked(owner.id,async()=>{
   const row=await owned(input.sessionId,owner.id);if(row.state!=='pending'||!waits.has(row.id))throw Error('permission_denied');await version(row);
   await options.office.revise(input.sessionId,input.draftId,input.revision,input.draft);
   const child=await options.artifacts.get(input.draftId);if(!child)throw Error('conflict');
   const next=await options.state.update(row,{approval:null});await publish(next);return{ok:true as const,value:officeSummary(child)};
  }).catch(resultError);
 }
 async function execute(sessionId:string,runId:string,wait:Wait,callId:string,raw:unknown,signal?:AbortSignal){
  assertFileWritesEnabled();
  if(!object(raw)||Object.keys(raw).some(k=>!['files','resumeBundleId','renames'].includes(k)))throw Error('invalid_input');
  let specs:FileSpec[]=[],carried:DeliveryRef[]=[],parentId:string|undefined;
  if(raw.resumeBundleId!==undefined){
   if(!deliveryId(raw.resumeBundleId)||raw.files!==undefined)throw Error('invalid_input');
   const parent=await owned(sessionId,raw.resumeBundleId);if(parent.runId===runId||!['partial','interrupted','failed','conflict'].includes(parent.state))throw Error('conflict');parentId=parent.id;
   const renames=raw.renames??[];if(!Array.isArray(renames)||renames.length>8||!renames.every(r=>object(r)&&Object.keys(r).length===2&&typeof r.fileId==='string'&&typeof r.path==='string')||new Set(renames.map(r=>r.fileId)).size!==renames.length)throw Error('invalid_input');
   const old=await summary(parent);
   for(const f of parent.files){
    if(!f.draftId)throw Error('conflict');
    const rename=renames.find(r=>r.fileId===f.fileId);
    if(saved(old.files.find(v=>v.fileId===f.fileId)!)){if(rename)throw Error('invalid_input');await options.verify(sessionId,f);carried.push({...f,carried:true,error:undefined});continue;}
    // Unknown commit outcomes must be verified before any replacement proposal.
    if(f.kind==='text'){
     let child=await options.changes.get(f.draftId);if(child?.state==='uncertain'){await options.text.decision({schemaVersion:'xiaozhi.change.v1',sessionId,changeId:child.id,revision:child.revision,action:'verify'});child=await options.changes.get(f.draftId);}
     if(child?.state==='applied'){if(rename)throw Error('invalid_input');await options.verify(sessionId,f);carried.push({...f,carried:true,error:undefined});continue;}
     if(!child||['uncertain','executing','reverting','undo_uncertain'].includes(child.state))throw Error('conflict');
     specs.push({fileId:f.fileId,kind:'text',path:rename?.path??f.path,content:child.after.toString('utf8')});
    }else{
     let child=await options.artifacts.get(f.draftId);if(child?.state==='uncertain'){await options.office.decide({schemaVersion:OFFICE_ARTIFACT_SCHEMA,sessionId,draftId:child.id,revision:child.revision,action:'verify'});child=await options.artifacts.get(f.draftId);}
     if(child?.state==='saved'){if(rename)throw Error('invalid_input');await options.verify(sessionId,f);carried.push({...f,carried:true,error:undefined});continue;}
     if(!child||['uncertain','committing'].includes(child.state))throw Error('conflict');
     specs.push({fileId:f.fileId,kind:'office',path:rename?.path??f.path,format:child.format,draft:child.draft,sources:child.sources.filter(s=>s.kind==='workspace_file').map(s=>({path:s.path,version:s.version})),...(child.parentArtifactId?{parentArtifactId:child.parentArtifactId}:{})});
    }
   }
   if(renames.some(r=>!specs.some(s=>s.fileId===r.fileId)))throw Error('conflict');
  }else{
   if(raw.renames!==undefined||!Array.isArray(raw.files)||raw.files.length<2||raw.files.length>8)throw Error('invalid_input');
   specs=raw.files as FileSpec[];
  }
  if(specs.length+carried.length<2||specs.length+carried.length>8||new Set([...specs,...carried].map(f=>f.fileId)).size!==specs.length+carried.length
   ||new Set([...specs,...carried].map(f=>f.path.toLowerCase())).size!==specs.length+carried.length||Buffer.byteLength(JSON.stringify(raw))>1048576)throw Error('invalid_input');
  for(const spec of specs){
   if(!object(spec)||typeof spec.fileId!=='string'||!/^[a-z][a-z0-9_-]{0,63}$/.test(spec.fileId))throw Error('invalid_input');
   const{fileId:_,kind,...proposal}=spec;
   if(kind==='office'){if(!validOfficeProposal(proposal)||!['xiaozhi.office-draft.v1','xiaozhi.presentation-draft.v1'].includes(proposal.draft.schemaVersion))throw Error('invalid_input');const error=await options.proposalError?.(sessionId,runId,proposal);if(error)throw Error('invalid_input');}
   else if(kind!=='text'||Object.keys(proposal).some(k=>!['path','content'].includes(k))||typeof proposal.path!=='string'||typeof (proposal as {content?:unknown}).content!=='string')throw Error('invalid_input');
  }
  let row=await options.state.create({schemaVersion:1,id:'xidelivery_'+deliveryHash([sessionId,runId,callId]),sessionId,runId,callId,inputHash:deliveryHash(raw),revision:0,state:'preparing',taskVersion:await options.taskVersion(sessionId),approval:null,
   files:[...carried,...specs.map(s=>({fileId:s.fileId,kind:s.kind,path:s.path,callId:childCall(callId,s.fileId),runId,draftId:null,carried:false}))],...(parentId?{parentId}:{})});
  if(row.state!=='preparing')return receipt(await summary(row));
  try{
   for(const spec of specs){
    current(row,signal);const ref=row.files.find(f=>f.fileId===spec.fileId)!;const{fileId:_,kind,...proposal}=spec;
    const child=kind==='text'?await options.text.propose(sessionId,runId,ref.callId,{operation:'create',...proposal},signal):await options.office.propose(sessionId,runId,ref.callId,proposal,signal);
    if(child.state!=='pending')throw Error('conflict');
    row=await options.state.update(row,{files:row.files.map(f=>f.fileId===ref.fileId?{...f,draftId:child.id}:f)});
   }
   row=await options.state.update(row,{state:'pending'});
   const approved=await wait(()=>new Promise<boolean>(resolve=>{
    const finish=(ok:boolean)=>{waits.delete(row.id);signal?.removeEventListener('abort',abort);resolve(ok);};
    const abort=()=>{void cancel(runId).catch(()=>undefined).finally(()=>finish(false));};
    waits.set(row.id,{sessionId,runId,finish});signal?.addEventListener('abort',abort,{once:true});
    if(signal?.aborted||!options.current(sessionId,runId))abort();else void publish(row).catch(abort);
   }));
   row=await owned(sessionId,row.id);current(row,signal);if(!approved)return receipt(await publish(row));
   await version(row);row=await options.state.update(row,{state:'executing'});await publish(row);
   for(const ref of row.files){
    current(row,signal);await version(row);
    if(ref.carried){await options.verify(sessionId,ref);continue;}
    try{
     const outcome=ref.kind==='text'?await options.text.apply(sessionId,ref.draftId!,signal):await options.office.apply(sessionId,ref.draftId!,signal);
     if(!['applied','saved'].includes(outcome.state))throw Error(outcome.state==='conflict'?'conflict':'configuration');
     await options.verify(sessionId,ref);
    }catch(e){
     if(signal?.aborted||!options.current(sessionId,runId))throw e;
     row=await options.state.update(row,{files:row.files.map(f=>f.fileId===ref.fileId?{...f,error:code(e)}:f)});
    }
    await publish(row);
   }
   const view=await summary(row);let all=view.files.every(saved);
   // A successful ledger alone is insufficient, including carried files.
   if(all)for(const ref of row.files){try{await options.verify(sessionId,ref);}catch{all=false;row=await options.state.update(row,{files:row.files.map(f=>f.fileId===ref.fileId?{...f,error:'conflict'}:f)});}}
   row=await options.state.update(row,{state:all?'saved':view.files.some(saved)?'partial':'failed'});return receipt(await publish(row));
  }catch(e){
   row=await owned(sessionId,row.id);await invalidate(row);
   const view=await summary(row);row=await options.state.update(row,{state:view.files.some(saved)?'partial':signal?.aborted||!options.current(sessionId,runId)?'interrupted':'failed',approval:null,
    files:row.files.map(f=>f.carried||saved(view.files.find(v=>v.fileId===f.fileId)!)?f:{...f,error:f.error??code(e)})});await publish(row);
   if(signal?.aborted||!options.current(sessionId,runId))throw Error('cancelled');return receipt(await summary(row));
  }
 }
 async function receipt(value:DeliverySummary){
  const files=await Promise.all(value.files.map(async f=>({fileId:f.fileId,file:await options.sanitize(f.kind,f.path),format:f.artifact?.format??'text',outcome:f.change?.state??f.artifact?.state??'not_proposed',carried:f.carried,...(f.error?{error:f.error}:{})})));
  return{content:[{type:'text' as const,text:JSON.stringify({success:value.state==='saved',bundleId:value.id,outcome:value.state,files,message:value.state==='saved'?'整包文件已按教师最终确认版本保存并核验；不要复述未重新实读的正文。':value.state==='rejected'?'教师拒绝，本包未写入新文件；不得在本轮重提。':'整包尚未全部交付，已保存文件保留。后续明确续做可用resumeBundleId，只重提未完成部分并重新确认。'})}],details:{success:value.state==='saved'},isError:value.state!=='saved'};
 }
 return{decide,revise,cancel,summary,
  async context(sessionId:string){
   const all=await options.state.list(sessionId),resolved=new Set(all.filter(r=>r.state==='saved').map(r=>r.parentId));
   const rows=all.filter(r=>!resolved.has(r.id)&&['partial','interrupted','failed','conflict'].includes(r.state)).slice(-4);
   if(!rows.length)return '';
   const bundles=await Promise.all(rows.map(async row=>({bundleId:row.id,state:row.state,files:await Promise.all((await summary(row)).files.map(async f=>({fileId:f.fileId,path:await options.sanitize(f.kind,f.path),state:f.change?.state??f.artifact?.state??'not_proposed'})))})));
   return '\n宿主保存的待续做文件组（状态摘要，非执行权限；续做使用整包工具的resumeBundleId）：'+JSON.stringify(bundles);
  },list:async(sessionId:string)=>{
   const rows=await options.state.list(sessionId);
   return Promise.all(rows.map(async row=>{const value=await summary(row),child=rows.find(r=>r.parentId===row.id&&r.state==='saved');return child?{...value,continuedBy:child.id}:value;}));
  },
  tools(sessionId:string,runId:string,wait:Wait,officeParameters:ToolDefinition['parameters']):ToolDefinition[]{
   const office=officeParameters as unknown as {properties:Record<string,unknown>;required:string[]};
   return[{name:'office_deliver_files',label:'整包交付教学文件',description:'同一任务需要2至8份文件时，一次提交整包草稿，教师统一预览、修改PPT并一次确认保存。files每项fileId为稳定小写标识；kind=text提供path/content（UTF8 md/txt/csv/html最多64KiB）；kind=office使用office_create_document相同path/format/draft/sources/parentArtifactId。严格页数PPT用presentation-draft.v1。所有目标不同且不存在。任务计划用saved_bundle、target=current；成功只有整包真实保存并核验。单文件仍用原工具。部分保存失败保留成功文件，后续新任务可传resumeBundleId（不带files），只续做未完成部分；renames只可为未完成fileId指定新path，仍需整包新确认。拒绝后同轮不可重提。',
    parameters:{type:'object',additionalProperties:false,properties:{files:{type:'array',minItems:2,maxItems:8,items:{type:'object',additionalProperties:false,properties:{fileId:{type:'string',pattern:'^[a-z][a-z0-9_-]{0,63}$'},kind:{type:'string',enum:['text','office']},content:{type:'string',maxLength:65536},...office.properties},required:['fileId','kind','path']}},resumeBundleId:{type:'string',pattern:'^xidelivery_[a-f0-9]{64}$'},renames:{type:'array',maxItems:8,items:{type:'object',additionalProperties:false,required:['fileId','path'],properties:{fileId:{type:'string'},path:{type:'string',maxLength:500}}}}}} as ToolDefinition['parameters'],
    execute:async(callId,raw,signal)=>{try{return await execute(sessionId,runId,wait,callId,raw,signal);}catch(e){if(signal?.aborted||code(e)==='cancelled')throw e;return{content:[{type:'text' as const,text:JSON.stringify({success:false,error:code(e),message:code(e)==='file_writes_disabled'?'小智自动文件生成已暂停，整包未提交。已有文件仍可读取；恢复生成需取消启动停写设置并重启。':'整包未提交或未完成；请核对文件草稿、目标和当前状态。不能宣称已交付。'})}],details:{success:false},isError:true};}}
   }];
  }
 };
}
