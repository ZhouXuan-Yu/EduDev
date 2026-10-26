import path from 'node:path';
import type {TaskCriterionKind} from '../../../shared/xiaozhi-task';
import type {WorkspaceLease} from '../workspace-files';
import {approvedFile} from '../workspace-authority';
import {taskHash,taskToolKinds} from './task-evidence';
import {TaskAdmissionError} from './admission-error';

/** Identity only; does not grant permissions or read/execute a model proposal. */
export function createTaskResources(options:{sessionId:string;workspace:()=>Promise<WorkspaceLease>;studentId:()=>Promise<string>;attachment:(id:string)=>Promise<boolean>}){
 async function resource(kind:TaskCriterionKind,target:string):Promise<string>{
  if(['file','saved_text','saved_office'].includes(kind)){
   const lease=await options.workspace(),file=approvedFile(lease.path,target);
   return taskHash(['workspace-file',path.resolve(file).toLowerCase()]);
  }
  if(kind==='web'){const url=new URL(target);if(!['http:','https:'].includes(url.protocol)||url.username||url.password)throw new TaskAdmissionError('task_target_invalid');url.hash='';return taskHash(['web',url.href]);}
  if(kind==='attachment'||kind==='image'){if(!await options.attachment(target))throw new TaskAdmissionError('task_source_changed');return taskHash(['attachment',options.sessionId,target]);}
  if(kind==='saved_questions'&&target==='current')return taskHash(['questions',options.sessionId,await options.studentId()]);
  throw new TaskAdmissionError('task_target_invalid');
 }
 async function invocation(kind:TaskCriterionKind,tool:string,args:Record<string,unknown>,expectedResource?:string){
  if(!taskToolKinds[kind]?.includes(tool))throw new TaskAdmissionError('task_tool_scope');
  if(kind==='web'&&tool==='office_browser'&&args.action!=='navigate'){
   if(typeof expectedResource!=='string'||!/^[a-f0-9]{64}$/.test(expectedResource))throw new TaskAdmissionError('task_target_invalid');
   return expectedResource;
  }
  const target=kind==='web'?args.url:kind==='attachment'||kind==='image'?args.id:kind==='saved_questions'?'current':tool==='office_copy_file'?args.target:args.path;
  if(typeof target!=='string')throw new TaskAdmissionError('task_target_invalid');return resource(kind,target);
 }
 return{resource,invocation};
}
