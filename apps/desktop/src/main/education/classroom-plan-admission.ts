import {CLASSROOM_PLAN_TOOLS,validClassroomPlanStart,type ClassroomPlanStart} from '../../shared/classroom-plan';
import {TaskAdmissionError} from '../xiaozhi-agent/tasks/admission-error';
import type {createTaskPlanRuntime} from '../xiaozhi-agent/tasks/plan-runtime';
import type {createClassroomPlanState} from './classroom-plan-state';

type Options={
 sessionId:string;
 runId:string;
 intent?:ClassroomPlanStart;
 plans:ReturnType<typeof createClassroomPlanState>;
 current:()=>boolean;
 signal?:AbortSignal;
 task?:Pick<ReturnType<typeof createTaskPlanRuntime>,'admit'|'refresh'>;
};
const refusals=new Set(['invalid_input','permission_denied','not_confirmed','source_changed','conflict']);

/** Domain writes keep their write manifest and the normal journal/lease boundary.
 * Only a host-captured typed classroom intent selects this independent ledger;
 * model task arguments never grant authority or replace either teacher approval.
 */
export async function admitClassroomOrTaskTool(options:Options,callId:string,tool:string,input:unknown):Promise<void>{
 if(!CLASSROOM_PLAN_TOOLS.some(name=>name===tool)){
  await options.task?.admit(callId,tool,input);
  return;
 }
 const check=()=>{if(options.signal?.aborted||!options.current())throw Error('cancelled');};
 check();
 const intent=options.intent;
 if(!intent||!validClassroomPlanStart(intent))throw new TaskAdmissionError('task_classroom_intent_required');
 const realignmentRead=intent.mode==='outline'&&intent.realign&&tool==='education_read_classroom_plan';
 if(!realignmentRead&&(intent.mode==='outline')!==(tool==='education_propose_classroom_outline'))throw new TaskAdmissionError('task_classroom_mode_mismatch');
 // Keep the generic task's current teacher-request/source checks. Its file/card
 // criteria cannot represent an outline or per-page checkpoint and cannot approve it.
 await options.task?.refresh();
 check();
 try{
  if(intent.mode==='outline'){await options.plans.assertOutlineRun(options.sessionId,options.runId,options.current);if(intent.realign)await options.plans.readLessonForRealignment(options.sessionId,intent.realign);}
  else await options.plans.readForRun(options.sessionId,options.runId,intent,()=>options.current()&&!options.signal?.aborted);
 }catch(error){
  if(error instanceof Error&&refusals.has(error.message))throw new TaskAdmissionError('task_classroom_'+error.message);
  throw error;
 }
 check();
}
