import {createHash} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {validateToolArguments} from '@earendil-works/pi-ai';
import type {ToolDefinition} from '@earendil-works/pi-coding-agent';
import {snapshotToolInvocationInput} from '../../ai-harness/vendor/openhanako-tool-input-snapshot';
import {SessionExecutionRegistry} from '../vendor/hana/lib/session-execution-registry';
import {AgentToolAbortedError,AgentToolTimeoutError,executeWithToolBound} from '../vendor/openmaic/tool-timeout';
import {toolManifest,type ToolManifest} from './manifest';
import {acquireToolResource} from './resource-lock';
import {acquireSafeReadSlot,type ReadSlot} from './read-scheduler';
import {TOOL_EXECUTION_CODES,TOOL_EXECUTION_MESSAGES,type ToolExecutionCode,type XiaozhiToolAttempt} from '../../../shared/xiaozhi-tool-attempt';
import {taskAdmissionFailure} from '../tasks/admission-error';
import type {PermissionToolExecution} from '../permissions/tool-runtime';
type Result=Awaited<ReturnType<ToolDefinition['execute']>>;
type Options={trustedMcpNames?:ReadonlySet<string>;sessionId:string;workspaceKey:string;outputWorkspaceKey?:string;registry:SessionExecutionRegistry;epoch:()=>string;current:(epoch:string)=>boolean;waiting:()=>boolean;onWaiting:(fn:(waiting:boolean)=>void)=>()=>void;beforeDelivery:(callId:string,tool:string,signal:AbortSignal,input:unknown)=>Promise<void>;attempt:(attempt:XiaozhiToolAttempt,signal:AbortSignal)=>Promise<void>;criticalFailure?:(error:unknown)=>void;timeout?: (manifest:ToolManifest)=>number};
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
export function toolExecutionCode(raw:unknown):ToolExecutionCode{
 if(taskAdmissionFailure(raw))return'task_blocked';
 if(raw instanceof AgentToolTimeoutError)return'timeout';if(raw instanceof AgentToolAbortedError||raw instanceof Error&&raw.name==='AbortError')return'cancelled';
 const message=raw instanceof Error?raw.message:'';
 const nativeCode=object(raw)&&typeof raw.code==='string'?raw.code:'';
 if(['ENOENT','ENOTDIR'].includes(nativeCode))return'not_found';
 if(['EBUSY','ETXTBSY'].includes(nativeCode))return'resource_busy';
 if(['EACCES','EPERM'].includes(nativeCode))return'permission_denied';
 if(TOOL_EXECUTION_CODES.includes(message as ToolExecutionCode))return message as ToolExecutionCode;
 if (['student_required', 'context_required', 'evidence_missing'].includes(message)) return 'source_required';
 if (['changed', 'stale_source'].includes(message)) return 'source_changed';
 if (message === 'permission_pending') return 'permission_denied';
 if (/Command exited with code \d+/.test(message)) return 'execution_failed';
 if(/\b401\b|authentication|api.?key/i.test(message))return'authentication';
 if(/\b403\b|permission/i.test(message))return'permission_denied';
 if(/429|rate.?limit/i.test(message))return'rate_limited';
 if(/timeout|timed out/i.test(message))return'timeout';
 if(/fetch|connect|network|ECONN|ENOTFOUND|TLS/i.test(message))return'network';
 return'unknown';
}
function resultCode(result:Result):ToolExecutionCode|undefined{
 const d=object(result.details)?result.details:{};
 if(result.isError!==true&&d.success!==false)return;
 const e=object(d.error)?d.error:{};
 const mapped = toolExecutionCode(new Error(typeof d.error === 'string' ? d.error : typeof e.code === 'string' ? e.code : ''));
 return mapped !== 'unknown' ? mapped : toolExecutionCode(new Error(typeof e.message === 'string' ? e.message : ''));
}
export function validBoundedToolResult(v:unknown):v is Result{
 if(!object(v)||!Array.isArray(v.content)||v.content.length>256||v.isError!==undefined&&typeof v.isError!=='boolean')return false;
 if(!v.content.every(b=>object(b)&&(b.type==='text'&&typeof b.text==='string'||b.type==='image'&&typeof b.data==='string'&&typeof b.mimeType==='string')))return false;
 try{return Buffer.byteLength(JSON.stringify(v))<=16*1024*1024;}catch{return false;}
}
function failed(code:ToolExecutionCode,attempt:XiaozhiToolAttempt):Result{
 if(attempt.tool==='office_view_public_image'&&code==='cancelled')return{content:[{type:'text',text:'这次图片准备已停止，本工具未将图片交付给模型。这是旧调用的结果，不表示后续新请求已停止；教师再次要求查看时，应核对当前附件并通过公开图片工具重新发起本轮用途确认。不得复用旧批准或旧答案。'}],details:{success:false,error:{code,retryable:false},execution:attempt},isError:true};
 return{content:[{type:'text',text:TOOL_EXECUTION_MESSAGES[code]+(attempt.effect==='unknown'?' 操作可能已经产生效果，请先核对，不要重复执行。':'')}],details:{success:false,error:{code,retryable:false},execution:attempt},isError:true};
}
/** One boundary inside Pi's existing dispatcher. It never calls a model or replays a write. */
export function createToolExecutionBoundary(options:Options & {executeAuthorized?:PermissionToolExecution}){
 const calls=new Map<string,{signature:string;result:Promise<Result>}>();
 let currentEpoch='';
 let activeEffects=0;
 return{activeEffectCount:()=>activeEffects,execute(def:ToolDefinition,callId:string,args:unknown,signal:AbortSignal|undefined,onUpdate:Parameters<ToolDefinition['execute']>[3],context:Parameters<ToolDefinition['execute']>[4]):Promise<Result>{
  const manifest=toolManifest(def.name,options.trustedMcpNames),epoch=options.epoch();
  if(currentEpoch!==epoch){calls.clear();currentEpoch=epoch;}
  const summary=(attempt:number,state:XiaozhiToolAttempt['state'],code?:ToolExecutionCode,effect:XiaozhiToolAttempt['effect']='none',timing:Pick<XiaozhiToolAttempt,'queueWaitMs'|'executionMs'|'teacherWaitMs'>={}):XiaozhiToolAttempt=>({schemaVersion:1,callId,tool:def.name,attempt,maxAttempts:manifest.maxAttempts,state,...(code?{code}:{}),effect,...timing});
  if(!/^[A-Za-z0-9_:.-]{1,128}$/.test(callId))return Promise.resolve(failed('invalid_input',summary(1,'failed','invalid_input')));
  const snapshot=snapshotToolInvocationInput(args);if(!snapshot.ok)return Promise.resolve(failed('invalid_input',summary(1,'failed','invalid_input')));
  const signature=createHash('sha256').update(JSON.stringify([def.name,snapshot.value])).digest('hex');
  const previous=calls.get(callId);if(previous)return previous.signature===signature?previous.result:Promise.resolve(failed('conflict',summary(1,'failed','conflict')));
  const task=Promise.resolve().then(async()=>{
   let input:unknown;
   try {
    input=validateToolArguments(def,{type:'toolCall',id:callId,name:def.name,arguments:snapshot.value as Parameters<typeof validateToolArguments>[1]['arguments']});
   } catch (error) {
    const result = failed('invalid_input',summary(1,'failed','invalid_input'));
    // SDK diagnostics include a separate argument echo. Return only the bounded
    // schema paths/messages so the next model call can repair its invocation.
    const validation = error instanceof Error && error.message.startsWith('Validation failed for tool ')
      ? error.message.split('\n\nReceived arguments:')[0].slice(0,1500) : undefined;
    if (validation) result.content.push({type:'text',text:validation});
    return result;
   }
   if(!options.current(epoch)||signal?.aborted)return failed('cancelled',summary(1,'failed','cancelled'));
   let admitted=false;
   // Actual IO releases its registry entry when it settles. Keep the subsequent
   // retry wait registered too, so session stop can cancel it immediately.
   const waitForRetry=async(ms:number)=>{
    const pending=options.registry.begin({sessionId:options.sessionId,toolName:def.name,toolCallId:callId,signal});
    try{pending.signal.throwIfAborted();if(!options.current(epoch))return false;await delay(ms,undefined,{signal:pending.signal});return options.current(epoch)&&!pending.signal.aborted;}
    catch{return false;}finally{pending.release();}
   };
   for(let n=1;n<=manifest.maxAttempts;n++){
    const active=options.registry.begin({sessionId:options.sessionId,toolName:def.name,toolCallId:callId,signal});
    const timeoutMs=options.timeout?.(manifest)??manifest.timeoutMs;
    const current=(workSignal:AbortSignal)=>{workSignal.throwIfAborted();if(!options.current(epoch))throw Error('cancelled');};
    // Persistence is a critical gate, never a retryable tool failure. Use the same
    // upstream wait primitive; a blocked gate cannot bypass admission or run on.
    const critical=async(action:(workSignal:AbortSignal)=>Promise<void>)=>{
     try{
      await executeWithToolBound(async(_id,_args,workSignal)=>{current(workSignal!);await action(workSignal!);current(workSignal!);return{content:[],details:{}};},def.name,Math.min(timeoutMs,15000),callId,{},active.signal,undefined,{waiting:options.waiting,onWaiting:options.onWaiting});
     }catch(error){if(!taskAdmissionFailure(error)&&toolExecutionCode(error)!=='cancelled'&&options.current(epoch))options.criticalFailure?.(error);throw error;}
    };
    const persistAttempt=(state:XiaozhiToolAttempt)=>critical(s=>options.attempt(state,s));
    let releaseLock=()=>{},safeSlot:ReadSlot|undefined,released=false,queuePersisted=manifest.effect!=='safe_read';
    const release=()=>{if(released)return;released=true;releaseLock();safeSlot?.release();active.release();};
    try{
     if(manifest.effect==='safe_read'){
      await persistAttempt(summary(n,'queued'));queuePersisted=true;current(active.signal);
      safeSlot=await acquireSafeReadSlot(active.signal);current(active.signal);
     }
     releaseLock=acquireToolResource(manifest.resource==='none'?undefined:manifest.resource==='output'?options.outputWorkspaceKey??options.workspaceKey:manifest.resource==='workspace'?options.workspaceKey:`session:${options.sessionId}`,manifest.lock);
    }catch(error){
     try{
      const code=toolExecutionCode(error);
      // A failed journal gate is fatal. It cannot turn into a retryable read.
      if(!queuePersisted&&code!=='cancelled'||!['cancelled','resource_busy'].includes(code))throw error;
      const state=summary(n,'failed',code,'none',safeSlot?{queueWaitMs:safeSlot.queueWaitMs}:{});
      if(code==='resource_busy'&&manifest.effect==='safe_read'&&n<manifest.maxAttempts&&options.current(epoch)&&!signal?.aborted){
       await persistAttempt(summary(n,'retrying',code,'none',safeSlot?{queueWaitMs:safeSlot.queueWaitMs}:{}));
       if(!await waitForRetry(300))return failed('cancelled',summary(n,'failed','cancelled'));
       continue;
      }
      if(code!=='cancelled')await persistAttempt(state);
      return failed(code,state);
     }finally{release();}
    }
    let invoked=false;
    let executionStartedAt:number|undefined,executionMs:number|undefined;
    let teacherWaitMs = 0;
    const timing=()=>({...teacherWaitMs > 0 ? {teacherWaitMs: Math.round(teacherWaitMs)} : {},...safeSlot?{queueWaitMs:safeSlot.queueWaitMs}:{},...executionStartedAt===undefined?{}:{executionMs:executionMs??Math.max(0,Math.round(performance.now()-executionStartedAt))}});
    let result:Result|undefined,code:ToolExecutionCode|undefined;
    const retryId=n===1?callId:`readretry_${createHash('sha256').update(`${epoch}:${callId}:${n}`).digest('hex')}`;
    let preparing=true,preparationError:unknown;
    const underlying:ToolDefinition['execute']=async(id,values,workSignal,progress,ctx)=>{
     try{
      current(workSignal!);
      if(!admitted){await options.beforeDelivery(callId,def.name,workSignal!,values);current(workSignal!);admitted=true;}
      await options.attempt(summary(n,'started',undefined,'none',safeSlot?{queueWaitMs:safeSlot.queueWaitMs}:{}),workSignal!);current(workSignal!);
     }catch(error){preparationError=error;throw error;}
     preparing=false;executionStartedAt=performance.now();
     const effectful=manifest.effect==='local_write'||manifest.effect==='external_effect'
      ||manifest.effect==='local_cache'&&def.name!=='capability_resolve';
     if(effectful)activeEffects++;
     let waitingSince = options.waiting() ? executionStartedAt : undefined;
     const stopObserving = options.onWaiting(waiting => {
      if (waiting && waitingSince === undefined) waitingSince = performance.now();
      if (!waiting && waitingSince !== undefined) {
       teacherWaitMs += performance.now() - waitingSince;
       waitingSince = undefined;
      }
     });
     try {
      const perform = (authorizedSignal: AbortSignal) => {invoked=true;return def.execute(id, values, authorizedSignal, progress, ctx);};
      return options.executeAuthorized
       ? await options.executeAuthorized(callId, def.name, values, workSignal!, perform)
       : await perform(workSignal!);
     }
     finally {
      if(effectful)activeEffects--;
      if (waitingSince !== undefined) teacherWaitMs += performance.now() - waitingSince;
      stopObserving();
      executionMs=Math.max(0,Math.round(performance.now()-executionStartedAt));
     }
    };
    try{
     result=await executeWithToolBound(underlying,def.name,timeoutMs,retryId,input as Record<string,unknown>,active.signal,onUpdate?update=>{if(options.current(epoch))onUpdate(update);}:undefined,{context,waiting:options.waiting,onWaiting:options.onWaiting,onActualSettled:release});
     if(!options.current(epoch)||active.signal.aborted)code='cancelled';
     else if(!validBoundedToolResult(result))code='invalid_output';else code=resultCode(result);
    }catch(error){code=toolExecutionCode(error);}
    // This intrinsic tool only prepares local image bytes. Upload happens later
    // in the provider stream and is tracked by its separate delivery receipt.
    const effect=code&&invoked&&manifest.effect!=='safe_read'&&def.name!=='office_view_public_image'?'unknown':'none';
    if(preparing&&code){
     if(code==='task_blocked'&&taskAdmissionFailure(preparationError)){const state=summary(n,'failed',code,'none',timing()),result=failed(code,state);await persistAttempt(state);return{...result,content:[...result.content,{type:'text' as const,text:JSON.stringify({success:false,scope:'task_admission',reason:preparationError.reason,delivery:'not_delivered'})}],details:{success:false,error:{code,retryable:false},taskReason:preparationError.reason,execution:state}};}
     // The work signal was aborted by the race. The outstanding preparation
     // retains its lock until it really settles and is fenced before dispatch.
     if(code==='cancelled')return failed(code,summary(n,'failed',code,'none',timing()));
     const error=preparationError??Error(code);options.criticalFailure?.(error);throw error;
    }
    if(!code&&result){const state=summary(n,'succeeded',undefined,'none',timing());await persistAttempt(state);return{...result,details:{...(object(result.details)?result.details:{}),execution:state}};}
    code??='unknown';
    if(code==='cancelled'||!options.current(epoch))return failed('cancelled',summary(n,'failed','cancelled',effect,timing()));
    if(manifest.effect==='safe_read'&&n<manifest.maxAttempts&&['network','rate_limited','service_error','timeout','resource_busy'].includes(code)&&options.current(epoch)&&!signal?.aborted){
     await persistAttempt(summary(n,'retrying',code,'none',timing()));
     if(!await waitForRetry(code==='rate_limited'?1000:300))return failed('cancelled',summary(n,'failed','cancelled'));
     continue;
    }
    const state=summary(n,'failed',code,effect,timing());await persistAttempt(state);
    if(result&&validBoundedToolResult(result)&&!['invalid_output','cancelled'].includes(code))return{...result,isError:true,details:{...(object(result.details)?result.details:{}),execution:state}};
    return failed(code,state);
   }
   throw Error('tool_execution_bounds');
  });
  calls.set(callId,{signature,result:task});return task;
 }};
}
