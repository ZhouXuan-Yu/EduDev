import {createHash} from 'node:crypto';
import type {SessionManager,ToolDefinition} from '@earendil-works/pi-coding-agent';
import {PLAN_UPDATE_SCHEMA} from '../../shared/xiaozhi-plan';
import {TASK_PLAN_PARAMETERS} from '../../shared/xiaozhi-task-plan';
const PLAN_BASIS_NOTE='计划关联时使用此宿主调用标识，不猜测模型侧ID；宿主仍须核对已提交的同轮回执，此标识不代表结果已核验。';

/** Additive capability after all historical creation/control/memory identities. */
export function ensureNativeTaskContract(manager:Pick<SessionManager,'getEntries'|'appendCustomEntry'>,base:string,tools:ToolDefinition[]){
 if(tools.length!==1||tools[0].name!=='update_task_plan'||JSON.stringify(tools[0].parameters)!==JSON.stringify(TASK_PLAN_PARAMETERS))throw Error('configuration');
 const entries=manager.getEntries().filter(e=>e.type==='custom'&&e.customType==='xiaozhi.education.task-plan.v3');
 const data={schemaVersion:3,base,envelopeVersion:1,schemaHash:createHash('sha256').update(JSON.stringify(TASK_PLAN_PARAMETERS)).digest('hex')};
 if(entries.length>1||entries.some(e=>e.type!=='custom'||JSON.stringify(e.data)!==JSON.stringify(data)))throw Error('configuration');
 if(!entries.length)manager.appendCustomEntry('xiaozhi.education.task-plan.v3',data);
}

/** Opaque host identity, not provider-generated tool IDs or a success claim.
 * The later plan proposal must still resolve its committed same-run receipt. */
export function withPlanBasisReference(result:Awaited<ReturnType<ToolDefinition['execute']>>,callId:string,tool:string){
 if(!result||!Array.isArray(result.content))return result;
 return {...result,content:[...result.content,{type:'text' as const,text:JSON.stringify({planBasisCallId:callId,tool,note:PLAN_BASIS_NOTE})}]};
}

/** Recognize only the exact host suffix for this actual call. Arbitrary JSON or
 * foreign references stay in the body and cannot be normalized away. */
export function withoutPlanBasisReference(content:unknown[],callId:string,tool:string):unknown[]{
 const last=content.at(-1) as {type?:unknown;text?:unknown}|undefined;
 if(last?.type!=='text'||typeof last.text!=='string')return content;
 try{const v=JSON.parse(last.text);if(v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')==='note,planBasisCallId,tool'&&v.planBasisCallId===callId&&v.tool===tool&&v.note===PLAN_BASIS_NOTE)return content.slice(0,-1);}catch{/* Original body. */}
 return content;
}

/** Separate additive capability after historical identities. Never rewrite the
 * old control prompt/fingerprint or replay old tool calls to upgrade them. */
export function ensureNativePlanContract(manager:Pick<SessionManager,'getEntries'|'appendCustomEntry'>,controls:ToolDefinition[],base:string){
 const tool=controls.find(t=>t.name==='update_plan'),schema=tool?JSON.stringify(tool.parameters):'';
 const v2=schema===JSON.stringify(PLAN_UPDATE_SCHEMA),entries=manager.getEntries().filter(e=>e.type==='custom'&&e.customType.startsWith('xiaozhi.education.plan.'));
 const declaresV2=schema.includes('xiaozhi.plan.v2');
 if(declaresV2&&!v2||entries.length>1||entries.some(e=>e.type!=='custom'||e.customType!=='xiaozhi.education.plan.v2'))throw Error('configuration');
 if(!v2){if(entries.length)throw Error('configuration');return;}
 const data={schemaVersion:2,base,schemaHash:createHash('sha256').update(schema).digest('hex')};
 if(entries.some(e=>e.type!=='custom'||JSON.stringify(e.data)!==JSON.stringify(data)))throw Error('configuration');
 if(!entries.length)manager.appendCustomEntry('xiaozhi.education.plan.v2',data);
}
