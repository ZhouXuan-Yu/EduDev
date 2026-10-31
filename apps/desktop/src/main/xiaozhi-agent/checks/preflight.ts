import {randomUUID} from 'node:crypto';
import type {ToolDefinition} from '@earendil-works/pi-coding-agent';
import {DELIVERY_CHECK_SCHEMA,validFileCheckRules,type CheckFileInput,type FileCheckRules} from '../../../shared/xiaozhi-delivery-checks';
import type {CandidateBytes,createDeliveryChecks} from './service';
import {inspectionSummary} from './tools';

export type CandidateRef={kind:'text'|'office';id:string};
export type CheckReceipt=(sessionId:string,runId:string,callId:string)=>Promise<{type:'text';text:string}[]>;
export type CheckPreflight=(sessionId:string,runId:string,callId:string,refs:CandidateRef[],checks:unknown,signal?:AbortSignal)=>Promise<Awaited<ReturnType<ToolDefinition['execute']>>|undefined>;
export const CHECKS_PARAMETERS={type:'array',maxItems:8,items:{type:'object',additionalProperties:false,required:['path','rules'],properties:{path:{type:'string',maxLength:500},rules:{type:'object'}}}};
/** Existing file services own the drafts. Only their immutable bytes reach the inspector. */
export function createCheckPreflight(options:{service:ReturnType<typeof createDeliveryChecks>;
 candidate:(sessionId:string,ref:CandidateRef,signal?:AbortSignal)=>Promise<CandidateBytes>;
 defaults:(sessionId:string,ref:CandidateRef)=>Promise<FileCheckRules|undefined>;
 owner:(sessionId:string,runId:string)=>{signal:AbortSignal;scope:string;current:()=>boolean};
 sanitize:()=>Promise<(text:string)=>Promise<string>>}):CheckPreflight{
 return async(sessionId,runId,callId,refs,checks,signal)=>{
  const owner=options.owner(sessionId,runId),joined=signal?AbortSignal.any([signal,owner.signal]):owner.signal;joined.throwIfAborted();
  if(!owner.current())throw Error('cancelled');
  // A resumed bundle can consist entirely of original, independently reverified saved effects.
  // There is no new candidate or file write to approve; original readback remains authoritative.
  if(!refs.length)return undefined;
  if(checks!==undefined&&(!Array.isArray(checks)||checks.length>8||checks.some(c=>!c||typeof c!=='object'||Array.isArray(c)||Object.keys(c).some(k=>!['path','rules'].includes(k))||typeof c.path!=='string'||!validFileCheckRules(c.rules))||new Set(checks.map(c=>c.path.toLowerCase())).size!==checks.length))throw Error('invalid_input');
  const declared=(checks||[]) as {path:string;rules:FileCheckRules}[],candidates:CandidateBytes[]=[],files:CheckFileInput[]=[];
  for(const ref of refs){const candidate=await options.candidate(sessionId,ref,joined);joined.throwIfAborted();candidates.push(candidate);const explicit=declared.find(c=>c.path===candidate.path)?.rules,defaults=await options.defaults(sessionId,ref);files.push({path:candidate.path,version:candidate.version,rules:explicit||defaults||{}});}
  if(declared.some(c=>!files.some(f=>f.path===c.path)))throw Error('invalid_input');
  const result=await options.service.inspect({schemaVersion:DELIVERY_CHECK_SCHEMA,sessionId,requestId:`xicheckreq_${randomUUID()}`,files},joined,{runId,callId,scope:owner.scope,current:owner.current},candidates);
  joined.throwIfAborted();if(!owner.current())throw Error('cancelled');
  if(result.ok&&result.report.state!=='failed')return undefined;
  const data=result.ok?{success:false,error:result.report.repairExhausted?.length?'repair_budget_exhausted':'delivery_check_failed',
   inspection:await inspectionSummary(result.report,await options.sanitize()),
   message:result.report.repairExhausted?.length?'此类自动修复已达2轮。草稿和原检查保留，不能再自动生成或换名规避；说明未完成项，等待教师新的要求。':'真实候选检查发现问题；草稿已保留且没有写入正式文件。根据具体失败修正后沿原工具重新提交，每类最多2轮，不另请教师重复批准。'}:
   {success:false,error:result.error,message:'交付前检查未完成，本次没有写入正式文件；草稿保留，不得宣称已交付。'};
  return{content:[{type:'text',text:JSON.stringify(data)}],details:{success:false},isError:true};
 };
}
