import type { OmniEduStore } from '../db';
import type { XiaozhiQueueMutationInput, XiaozhiActionResult } from '../../shared/xiaozhi-agent';
import type { PrivateControl } from './control-state';
type Agent = Awaited<ReturnType<typeof import('./pi-session')['createPiXiaozhiSession']>>;
export function createQueueMutationHandler(options: { store: OmniEduStore;
  current: (id: string, runId: string) => { agent: Agent; releaseSlot: (id: string) => void } | undefined;
  notify: (item: PrivateControl) => void }) {
  return async (input: XiaozhiQueueMutationInput): Promise<XiaozhiActionResult> => {
    if (!input || typeof input !== 'object' || Array.isArray(input)
      || Object.keys(input).some(key => !['sessionId','controlId','revision','action', ...(input.action === 'edit' ? ['text','mode'] : [])].includes(key))
      || !/^aisession_[a-f0-9-]{36}$/i.test(input.sessionId) || !/^xicmd_[a-f0-9-]{36}$/i.test(input.controlId)
      || !Number.isSafeInteger(input.revision) || input.revision < 0 || !['edit','withdraw'].includes(input.action)
      || (input.action === 'edit' && (typeof input.text !== 'string' || !input.text.trim() || input.text.length > 8192 || input.text.includes('\0') || !['steer','followUp'].includes(input.mode)))) return {ok:false,error:'invalid_input'};
    let reservation: ReturnType<Agent['reserveInstruction']> | undefined;
    try {
      const item = await options.store.xiaozhiState.control(input.controlId);
      if (!item || item.kind !== 'instruction' || item.sessionId !== input.sessionId) return {ok:false,error:'permission_denied'};
      const patch = input.action === 'edit' ? {text:(await options.store.sanitizeProblemText(input.text.trim())).sanitizedText,mode:input.mode} : undefined;
      if (patch && (!patch.text.trim() || patch.text.length > 8192)) return {ok:false,error:'invalid_input'};
      const revision = item.revision ?? 0;
      if (revision === input.revision + 1 && (patch ? item.text === patch.text && item.mode === patch.mode && item.state !== 'withdrawn' : item.state === 'withdrawn')) return {ok:true};
      if (revision !== input.revision) return {ok:false,error:'command_conflict'};
      if (item.state !== 'queued') return {ok:false,error:'permission_denied'};
      const current = options.current(item.sessionId,item.runId);
      if (!current) return {ok:false,error:'permission_denied'};
      reservation = current.agent.reserveInstruction(item.id,revision);
      const updated: PrivateControl = {...item,...patch,revision:revision + 1,state:patch ? 'queued' : 'withdrawn'};
      if (!await options.store.xiaozhiState.changeControl(item.id,['queued'],updated,revision)) return {ok:false,error:'command_conflict'};
      if (!reservation.commit(patch)) return {ok:false,error:'permission_denied'};
      if (!patch) current.releaseSlot(item.id);
      options.notify(updated); return {ok:true};
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      return {ok:false,error:message === 'command_conflict' || message === 'permission_denied' || message === 'busy' ? message : 'configuration'};
    } finally { reservation?.release(); }
  };
}
