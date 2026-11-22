import {taskSourceIdentity, taskText, type TaskSource, type TaskView} from '../../../shared/xiaozhi-task';

/** Attach a teacher message to the existing authority and require a fresh review. */
export function recordTaskAmendment(task:TaskView, source:TaskSource, text:string):void {
    if(!source.messageId||!taskText(text,400))throw Error('task_requirements_changed');
    const revisionId=task.criteria.some(criterion=>criterion.id==='teacher_request'&&criterion.kind==='human')
        ? 'teacher_request' : 'teacher_revision';
    const current=task.criteria.findIndex(criterion=>criterion.id===revisionId&&criterion.kind==='human');
    if(current<0&&task.criteria.length>=32)throw Error('task_capacity');
    const requirement={id:revisionId,version:task.requirementsVersion+1,sourceId:taskSourceIdentity(source),
        sourceVersion:source.version,text,kind:'human' as const};
    if(current<0)task.criteria.push(requirement);
    else task.criteria[current]=requirement;
    task.requirementsVersion++;
    task.planReason='教师补充或修改了当前任务。按最新明确要求核对受影响的工作，保留原来源及已有操作回执。';
    delete task.planning;
    task.checks=[];
}
