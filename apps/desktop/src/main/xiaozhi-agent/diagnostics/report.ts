import {createHash} from 'node:crypto';
import type {OfficeProjectedTurn} from '../../../shared/office-agent';
import type {XiaozhiUsage} from '../../../shared/xiaozhi-agent';
import {XIAOZHI_ERRORS} from '../../../shared/xiaozhi-projection';
import {validModelRequest} from '../../../shared/xiaozhi-model-request';
import {TOOL_EXECUTION_CODES} from '../../../shared/xiaozhi-tool-attempt';
import {DIAGNOSTIC_SCHEMA,type DiagnosticReport} from '../../../shared/xiaozhi-diagnostics';
export const diagnosticRef=(v:string)=>createHash('sha256').update(v).digest('hex').slice(0,24);
const count=(v:unknown):number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0?Math.min(v,Number.MAX_SAFE_INTEGER):0;
const duration=(v:unknown):number|null=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=31_536_000_000?Math.round(v):null;
const at=(v:unknown)=>typeof v==='number'&&Number.isSafeInteger(v)&&v>0&&v<8_640_000_000_000_000?v:0;
const member=(v:unknown,allowed:readonly string[],fallback='unknown')=>typeof v==='string'&&allowed.includes(v)?v:fallback;
type Application=DiagnosticReport['application'];
/** Deliberately enumerate fields; raw text never passes through a general sanitizer. */
export function diagnosticReport(input:{sessionId:string;runId:string;turn:OfficeProjectedTurn;cursor:{generation:number;revision:number;sequence:number};usage?:XiaozhiUsage;usageRecord?:DiagnosticReport['usageRecord'];application:Application;now:number}):DiagnosticReport{
 const {turn}=input,stages=turn.publicStages||[],requests=turn.modelRequests||[],tools=turn.items.filter(i=>i.kind==='tool');
 const u=input.usage?.runId===input.runId?input.usage:undefined,known=u&&u.completeness!=='unknown'&&u.tokens;
 const tokens=known&&Object.values(known).every(n=>typeof n==='number'&&Number.isSafeInteger(n)&&n>=0)&&known.total===known.input+known.output+known.cacheRead+known.cacheWrite
  ?{input:known.input,output:known.output,cacheRead:known.cacheRead,cacheWrite:known.cacheWrite,total:known.total}:null;
 return {schemaVersion:DIAGNOSTIC_SCHEMA,generatedAt:new Date(input.now).toISOString(),application:input.application,
  sessionRef:diagnosticRef(input.sessionId),runRef:diagnosticRef(input.runId),state:member(turn.status,['running','waiting_input','waiting_approval','completed','interrupted','failed']),
  errorCode:turn.errorCode?member(turn.errorCode,Object.keys(XIAOZHI_ERRORS)):turn.error?'unknown':null,
  cursor:{generation:count(input.cursor.generation),revision:count(input.cursor.revision),sequence:count(input.cursor.sequence)},
  stages:stages.slice(-64).filter(s=>['preparing','waiting_model','responding'].includes(s.stage)&&at(s.since)).map(s=>({stage:s.stage,at:at(s.since)})),stagesOmitted:count(turn.publicStagesOmitted)+Math.max(0,stages.length-64),
  requests:requests.slice(-64).filter(validModelRequest).map(r=>({request:r.request,attempt:r.attempt,state:r.state,at:r.at,...(r.status!==undefined?{status:r.status}:{}),...(r.waitMs!==undefined?{waitMs:r.waitMs}:{})})),requestsOmitted:count(turn.modelRequestsOmitted)+Math.max(0,requests.length-64),
  tools:tools.slice(-64).map(t=>({ref:diagnosticRef(t.id),state:member(t.toolAttempt?.state||t.status,['queued','started','retrying','succeeded','failed','running','completed','interrupted']),code:t.toolAttempt?.code?member(t.toolAttempt.code,TOOL_EXECUTION_CODES):null,attempt:t.toolAttempt?count(t.toolAttempt.attempt):null,durationMs:duration(t.toolAttempt?.executionMs??t.durationMs)})),toolsOmitted:Math.max(0,tools.length-64),elapsedMs:duration(turn.traceElapsedMs??turn.elapsedMs),
  usageRecord:input.usageRecord||(u?'read':'missing'),usage:u?{modelCalls:count(u.modelCalls),toolCalls:count(u.toolCalls),completeness:tokens?(u.completeness==='partial'?'partial':'reported'):'unknown',tokens,activeMs:duration(u.activeMs)??0,waitingMs:duration(u.waitingMs)??0,cost:null}:null};
}
