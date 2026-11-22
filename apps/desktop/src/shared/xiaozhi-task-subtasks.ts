import {taskStepState,type TaskView} from './xiaozhi-task';

/** A group of independently identified local sources in an adopted plan. */
export function taskSourceSubtasks(task:TaskView) {
    const sources=task.steps.flatMap(step=>{
        if(step.criterionIds.length!==1)return [];
        const criterion=task.criteria.find(row=>row.id===step.criterionIds[0]);
        return criterion&&(criterion.kind==='file'||criterion.kind==='attachment')&&criterion.resource
            ? [{step,criterion}] : [];
    });
    if(new Set(sources.map(({criterion})=>criterion.resource)).size<2)return [];

    return sources.map(({step,criterion})=>{
        const state=taskStepState(task,step.id);
        const check=state==='verified'?task.checks.find(row=>row.criterionId===criterion.id&&row.criterionVersion===criterion.version&&row.state==='passed'&&row.authority==='readback'):undefined;
        return {
            stepId:step.id,sourceKind:criterion.kind,dependsOn:step.dependsOn,state,
            ...(check?{result:{runId:check.runId,callId:check.callId,digest:check.digest,checkedAt:check.checkedAt}}:{}),
        };
    });
}
