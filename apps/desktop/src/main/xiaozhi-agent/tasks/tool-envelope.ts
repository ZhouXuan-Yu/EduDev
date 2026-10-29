import type {ToolDefinition} from '@earendil-works/pi-coding-agent';
import {taskObject,taskLocalId} from '../../../shared/xiaozhi-task';
import {toolManifest} from '../tools/manifest';
import {taskToolKinds} from './task-evidence';

export const TASK_CONTROL_TOOLS=new Set(['update_task_plan','update_plan','ask_teacher','report_goal_progress','read_education_memory','read_session_process','read_teacher_request']);
export function unwrapTaskArguments(value:unknown):{stepId?:string;input:Record<string,unknown>}{
 if(!taskObject(value))throw Error('invalid_input');const {taskStepId,...input}=value;
 if(taskStepId!==undefined&&!taskLocalId(taskStepId))throw Error('invalid_input');return{...(typeof taskStepId==='string'?{stepId:taskStepId}:{}),input};
}
/** Preserve each original domain schema and execution implementation. Only the
 * SDK-facing additive contract sees the optional host task routing envelope. */
export function taskEnvelope(def:ToolDefinition):ToolDefinition{
 if(TASK_CONTROL_TOOLS.has(def.name))return def;
 if(def.name.startsWith('mcp_')||toolManifest(def.name).effect==='safe_read'&&!Object.values(taskToolKinds).some(names=>names?.includes(def.name)))return def;
 const schema=def.parameters as unknown as Record<string,unknown>;
 if(schema.type!=='object'||schema.properties!==undefined&&!taskObject(schema.properties))throw Error('configuration');
 const properties=schema.properties as Record<string,unknown>|undefined;if(properties&&'taskStepId'in properties)throw Error('configuration');
 return{...def,parameters:{...schema,properties:{...properties,taskStepId:{type:'string',minLength:1,maxLength:48}}} as unknown as ToolDefinition['parameters'],execute:(id,args,signal,update,context)=>def.execute(id,unwrapTaskArguments(args).input,signal,update,context)};
}
