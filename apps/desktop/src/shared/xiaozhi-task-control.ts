import {TASK_SCHEMA,taskKeys,taskNatural,taskObject,validTaskOwner,validTaskQuery,type TaskOwner,type TaskView} from './xiaozhi-task';

export type TaskControlAction='pause'|'cancel';
export type TaskControlInput=Pick<TaskView,'schema'|'sessionId'|'requirementsVersion'> & {taskId:string}
    & ({action:TaskControlAction;owner:TaskOwner}|{action:'cancel';revision:number});

export const taskControlState=(action:TaskControlAction)=>action==='pause'?'paused' as const:'ended' as const;

export function validTaskControl(value:unknown):value is TaskControlInput {
    if(!taskObject(value)||Object.keys(value).length!==6||!taskKeys(value,['schema','sessionId','taskId','requirementsVersion','action','owner','revision'])
      ||value.schema!==TASK_SCHEMA||!validTaskQuery({sessionId:value.sessionId})||typeof value.taskId!=='string'||!/^xitask_[a-f0-9]{64}$/u.test(value.taskId)
      ||!taskNatural(value.requirementsVersion)||value.requirementsVersion<1)return false;
    if('owner' in value)return !('revision' in value)&&(value.action==='pause'||value.action==='cancel')&&validTaskOwner(value.owner)&&value.owner.sessionId===value.sessionId;
    return value.action==='cancel'&&taskNatural(value.revision)&&value.revision>0;
}
