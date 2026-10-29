import { randomUUID } from 'node:crypto';
import type { ToolDefinition } from '@earendil-works/pi-coding-agent';
import type { OmniEduStore } from '../db';
import type { XiaozhiAgentEventPayload, XiaozhiControlInput, XiaozhiActionResult } from '../../shared/xiaozhi-agent';
import { publicControl, type PrivateControl } from './control-state';
import {createPlanService} from './plan-service';
import {PLAN_UPDATE_SCHEMA} from '../../shared/xiaozhi-plan';

const short = (v: unknown, max: number): v is string => typeof v === 'string' && !!v.trim() && v.length <= max && !v.includes('\0');
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const result = (data: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(data) }], details: { success: true } });
export function createPiControlCoordinator(options: { store: OmniEduStore; isCurrent: (id: string, run: string) => boolean;
  sanitize?:(text:string)=>Promise<string>;
  emit: (id: string, run: string, payload: XiaozhiAgentEventPayload) => void;
  flush:(sessionId:string,runId:string)=>Promise<void>;
  resume: (item: PrivateControl, answer: string) => Promise<XiaozhiActionResult> }) {
  const { store } = options;
  const waits = new Map<string, { item: PrivateControl; resolve: (answer: string | undefined) => void }>();
  const notify = (item: PrivateControl) => options.emit(item.sessionId, item.runId, { kind: 'control', control: publicControl(item) });
  const clean = async (text: string) => options.sanitize?options.sanitize(text):(await store.sanitizeProblemText(text)).sanitizedText;
  const plans=createPlanService({sql:store.xiaozhiState.sql,state:store.xiaozhiState,current:options.isCurrent,sanitize:clean,publish:async(id,run,item)=>{notify(item);await options.flush(id,run);}});
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
    cancel, finish,planHistory:plans.history,
    tools(sessionId: string, runId: string): ToolDefinition[] {
      return [
        { name: 'update_plan', label: '更新任务计划', description: '公开提出/调整任务计划。使用xiaozhi.plan.v2；首次expectedRevision=0，后续用上次回执revision。每步稳定id，前置dependsOn必须先报告完成；删除的id不能复用。reason写公开调整原因，basisCallIds只引用本轮已返回的真实工具callId，没有则空数组。宿主仅采用计划结构/版本；completed仅报告进度，不等于教学或交付核验通过。最多8步、1步进行中。',
          parameters: PLAN_UPDATE_SCHEMA as unknown as ToolDefinition['parameters'],
          execute: async (callId, args, signal) => {
            const saved=await plans.propose(sessionId,runId,callId,args,signal);
            return result({success:true,adopted:true,scope:'plan_structure',revision:saved.control.plan.revision,planId:saved.control.id,steps:saved.control.steps,duplicate:saved.duplicate,stepVerification:'not_checked'});
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
      const appliedOrder=1+Math.max(0,...(await store.xiaozhiState.controls(item.sessionId)).filter(c=>c.runId===item.runId).map(c=>c.appliedOrder||0));
      if (await store.xiaozhiState.changeControl(id,['dispatching'],{state:'applied',appliedOrder})) notify({...item,state:'applied',appliedOrder});
    },
    async dispatching(id: string) {
      const item = await store.xiaozhiState.control(id);
      if (!item || item.kind !== 'instruction' || !options.isCurrent(item.sessionId,item.runId)) return false;
      if (!await store.xiaozhiState.changeControl(id,['queued'],{state:'dispatching'})) return false;
      notify({...item,state:'dispatching'}); return true;
    },
  };
}
