import { createHash, randomUUID } from 'node:crypto';
import type { ToolDefinition } from '@earendil-works/pi-coding-agent';
import type { OmniEduStore } from '../db';
import type { XiaozhiAgentEventPayload, XiaozhiControlInput, XiaozhiActionResult, XiaozhiPlanStep } from '../../shared/xiaozhi-agent';
import { publicControl, type PrivateControl } from './control-state';

const short = (v: unknown, max: number): v is string => typeof v === 'string' && !!v.trim() && v.length <= max && !v.includes('\0');
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const result = (data: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(data) }], details: { success: true } });
export function createPiControlCoordinator(options: { store: OmniEduStore; isCurrent: (id: string, run: string) => boolean;
  emit: (id: string, run: string, payload: XiaozhiAgentEventPayload) => void;
  resume: (item: PrivateControl, answer: string) => Promise<XiaozhiActionResult> }) {
  const { store } = options;
  const waits = new Map<string, { item: PrivateControl; resolve: (answer: string | undefined) => void }>();
  const notify = (item: PrivateControl) => options.emit(item.sessionId, item.runId, { kind: 'control', control: publicControl(item) });
  const clean = async (text: string) => (await store.sanitizeProblemText(text)).sanitizedText;
  async function cancel(run: string) {
    for (const [id, entry] of waits) if (entry.item.runId === run) { waits.delete(id); entry.resolve(undefined); }
  }
  async function finish(session: string, run: string) {
    await cancel(run);
    for (const item of await store.xiaozhiState.controls(session)) if (item.runId === run && ['pending','queued','dispatching'].includes(item.state)) {
      if (await store.xiaozhiState.changeControl(item.id, [item.state], { state: 'interrupted' })) notify({ ...item, state: 'interrupted' });
    }
  }
  return {
    cancel, finish,
    tools(sessionId: string, runId: string): ToolDefinition[] {
      return [
        { name: 'update_plan', label: '更新任务计划', description: '公开更新教师任务的简短步骤及真实进度。复杂任务先计划；计划不等于文件或业务已提交。最多8步，至多1步执行中。',
          parameters: { type: 'object', properties: { steps: { type: 'array', minItems: 1, maxItems: 8, items: { type: 'object', properties: { text: { type: 'string', maxLength: 200 }, status: { type: 'string', enum: ['pending','in_progress','completed'] } }, required: ['text','status'], additionalProperties: false } } }, required: ['steps'], additionalProperties: false } as ToolDefinition['parameters'],
          execute: async (_callId, args, signal) => {
            signal?.throwIfAborted();
            if (!options.isCurrent(sessionId,runId) || !object(args) || Object.keys(args).some(key => key !== 'steps') || !Array.isArray(args.steps)
              || args.steps.length < 1 || args.steps.length > 8 || args.steps.some(step => !object(step) || Object.keys(step).some(key => !['text','status'].includes(key)) || !short(step.text,200) || !['pending','in_progress','completed'].includes(String(step.status)))
              || args.steps.filter(step => step.status === 'in_progress').length > 1) throw new Error('invalid_input');
            const steps: XiaozhiPlanStep[] = await Promise.all(args.steps.map(async step => ({ text: await clean(step.text), status: step.status })));
            signal?.throwIfAborted(); if (!options.isCurrent(sessionId,runId)) throw new Error('cancelled');
            const item: PrivateControl = { id: `pictrl_${createHash('sha256').update(runId).digest('hex')}`, sessionId,runId,kind:'plan',state:'applied',text:'任务计划',steps };
            await store.xiaozhiState.replacePlan(item); notify(item); return result({ success:true,steps });
          } },
        { name: 'ask_teacher', label: '请教师补充', description: '教师任务有必要歧义时提一个问题，给2–3个建议选项，等待教师选择或自由回答后继续。不要反复询问已明确事项。',
          parameters: { type:'object', properties:{ question:{type:'string',maxLength:1000}, options:{type:'array',minItems:2,maxItems:3,items:{type:'string',maxLength:200}} },required:['question','options'],additionalProperties:false } as ToolDefinition['parameters'],
          execute: async (callId,args,signal) => {
            signal?.throwIfAborted();
            if (!options.isCurrent(sessionId,runId) || !object(args) || Object.keys(args).some(key => !['question','options'].includes(key)) || !short(args.question,1000)
              || !Array.isArray(args.options) || args.options.length < 2 || args.options.length > 3 || args.options.some(value => !short(value,200)) || new Set(args.options).size !== args.options.length) throw new Error('invalid_input');
            const item: PrivateControl = { id:`pictrl_${randomUUID()}`,sessionId,runId,callId,kind:'question',state:'pending',text:await clean(args.question),options:await Promise.all(args.options.map(clean)) };
            signal?.throwIfAborted(); if (!options.isCurrent(sessionId,runId)) throw new Error('cancelled');
            let resolve!: (value: string | undefined) => void;
            const answer = new Promise<string | undefined>(done => { resolve = done; });
            const abort = () => { waits.delete(item.id); resolve(undefined); };
            waits.set(item.id,{item,resolve}); signal?.addEventListener('abort',abort,{once:true});
            try {
              await store.xiaozhiState.putControl(item);
              if (signal?.aborted || !options.isCurrent(sessionId,runId)) { abort(); throw new Error('cancelled'); }
              notify(item); const value = await answer;
              if (value === undefined || signal?.aborted || !options.isCurrent(sessionId,runId)) throw new Error('cancelled');
              return result({ success:true,answer:value });
            } finally { waits.delete(item.id); signal?.removeEventListener('abort',abort); }
          } },
      ];
    },
    async answer(input: XiaozhiControlInput): Promise<XiaozhiActionResult> {
      if (!object(input) || Object.keys(input).some(key => !['sessionId','controlId','answer'].includes(key)) || !/^aisession_[a-f0-9-]{36}$/i.test(input.sessionId)
        || !/^pictrl_[a-f0-9-]{36}$/i.test(input.controlId) || !short(input.answer,4000)) return {ok:false,error:'invalid_input'};
      try {
        const item = await store.xiaozhiState.control(input.controlId);
        if (!item || item.sessionId !== input.sessionId || item.kind !== 'question') return {ok:false,error:'permission_denied'};
        const answer = await clean(input.answer.trim());
        const live = waits.get(item.id);
        if (item.state === 'answered' && !item.canResume) return item.answer === answer ? {ok:true} : {ok:false,error:'command_conflict'};
        if (live && options.isCurrent(item.sessionId,item.runId)) {
          if (item.state === 'answered') return item.answer === answer ? {ok:true} : {ok:false,error:'command_conflict'};
          if (!await store.xiaozhiState.changeControl(item.id,['pending'],{state:'answered',answer})) {
            const committed=await store.xiaozhiState.control(item.id);
            return committed?.state === 'answered' && committed.answer === answer ? {ok:true} : {ok:false,error:'permission_denied'};
          }
          if (!options.isCurrent(item.sessionId,item.runId)) { live.resolve(undefined); return {ok:false,error:'permission_denied'}; }
          notify({...item,state:'answered',answer}); live.resolve(answer); return {ok:true};
        }
        // Only a recovered question starts a new explicit run; a stopped live run never resumes.
        if (!item.canResume || !['interrupted','resuming','answered'].includes(item.state) || (item.answer !== undefined && item.answer !== answer)) return {ok:false,error:'permission_denied'};
        if (item.state === 'interrupted' && !await store.xiaozhiState.changeControl(item.id,['interrupted'],{state:'resuming',answer})) {
          const committed=await store.xiaozhiState.control(item.id);
          if (!committed?.canResume || committed.answer !== answer || !['resuming','answered'].includes(committed.state)) return {ok:false,error:'busy'};
        }
        const outcome = await options.resume(item,answer);
        await store.xiaozhiState.changeControl(item.id,['resuming'],{state:outcome.ok?'answered':'interrupted',answer});
        return outcome;
      } catch { return {ok:false,error:'configuration'}; }
    },
    async applied(id: string) {
      const item = await store.xiaozhiState.control(id); if (item?.kind !== 'instruction') return;
      if (await store.xiaozhiState.changeControl(id,['dispatching'],{state:'applied'})) notify({...item,state:'applied'});
    },
    async dispatching(id: string) {
      const item = await store.xiaozhiState.control(id);
      if (!item || item.kind !== 'instruction' || !options.isCurrent(item.sessionId,item.runId)) return false;
      if (!await store.xiaozhiState.changeControl(id,['queued'],{state:'dispatching'})) return false;
      notify({...item,state:'dispatching'}); return true;
    },
  };
}
