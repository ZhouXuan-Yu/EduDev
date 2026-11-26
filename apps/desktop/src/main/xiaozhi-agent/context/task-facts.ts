import type {OmniEduStore} from '../../db';
import type {TaskView} from '../../../shared/xiaozhi-task';
import {createTaskState} from '../tasks/task-state';
import type {ContextFacts} from './authority';

/** Keep identities/version stamps only. Conversation content remains subject to the existing disclosure path. */
export async function readTaskContextFacts(store:OmniEduStore, sessionId:string, task:TaskView|null):Promise<ContextFacts> {
    if(task && task.sessionId!==sessionId)throw Error('permission_denied');
    const state=createTaskState(store.xiaozhiState.sql,{sanitize:async value=>value});
    const [checkpoint,effects,approvals]=await Promise.all([
        task?state.checkpoint(task.id):null, task?store.xiaozhiState.effects.forTask(sessionId,task.id):[],
        store.xiaozhiState.permissions.approvalSnapshot(sessionId),
    ]);
    if(task&&!checkpoint)throw Error('compaction_failed');
    const referencedEffects=effects.filter(effect=>['local_write','external_effect'].includes(effect.contract.effect));
    const p0=[
        ...(task?[`task:${task.id}:${task.requirementsVersion}:${task.planRevision}`,
            ...(task.binding?[`run:${task.binding.runId}:${task.binding.generation}`]:[])]:[]),
        ...(checkpoint?[`checkpoint:${checkpoint.id}`]:[]),
        ...(task?.sources||[]).map(source=>`teacher:${source.actionId??source.messageId}:${source.version}`),
        ...referencedEffects.slice(-128).map(effect=>`effect:${effect.id}:${effect.revision}:${effect.state}`),
        ...approvals.items.slice(-128).map(item=>`approval:${item.id}:${item.revision}:${item.state}`),
    ].sort();
    const p1=(task?.steps||[]).map(step=>`step:${step.id}`).sort();
    return {p0,p1,effectInProgress:referencedEffects.some(effect=>['intent','executing','unknown'].includes(effect.state))};
}
