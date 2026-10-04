import type { ToolDefinition } from '@earendil-works/pi-coding-agent';
import type { XiaozhiAgentEventPayload } from '../../shared/xiaozhi-agent';
import type { XiaozhiChangeDecision, XiaozhiChangeReviewInput, XiaozhiChangeResult,
  XiaozhiChangeReview, XiaozhiChangeSummary, XiaozhiChangeError } from '../../shared/xiaozhi-changes';
import { createTextChangeState, changeSummary } from './text-change-state';
import { createTextChangeService } from './text-change-service';

type Wait = (action: () => Promise<boolean>) => Promise<boolean>;
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const session = (v: unknown): v is string => typeof v === 'string' && /^aisession_[a-f0-9-]{36}$/i.test(v);
const change = (v: unknown): v is string => typeof v === 'string' && /^xichange_[a-f0-9-]{36}$/i.test(v);
const errorCode = (raw: unknown): XiaozhiChangeError => {
  const message = raw instanceof Error ? raw.message : '';
  return ['invalid_input', 'permission_denied', 'conflict', 'busy'].includes(message) ? message as XiaozhiChangeError : 'configuration';
};
const receipt = async (row: XiaozhiChangeSummary, sanitize: (value: string) => Promise<string>) => ({
  // No file content, differences, private root or hash is sent to the model.
  content: [{ type: 'text' as const, text: JSON.stringify({ success: row.state === 'applied',
    file: await sanitize(row.path), operation: row.operation, outcome: row.state,
    message: row.state === 'applied' ? '教师已确认，文件已保存并核验。' : row.state === 'rejected' ? '教师拒绝，本次没有写入。'
      : row.state === 'conflict' ? '文件版本已变化，本次没有覆盖。' : '本次未确认完成，请查看实际状态。' }) }],
  details: { success: row.state === 'applied' }, isError: row.state !== 'applied',
});

/** One Pi tool awaits one durable local proposal. No additional agent loop. */
export function createTextChangeCoordinator(options: {
  state: ReturnType<typeof createTextChangeState>; service: ReturnType<typeof createTextChangeService>;
  isCurrent: (sessionId: string, runId: string) => boolean;
  emit: (sessionId: string, runId: string, event: XiaozhiAgentEventPayload) => void;
  sanitize: (value: string) => Promise<string>;
}) {
  const waits = new Map<string, { sessionId: string; runId: string; finish: (approved: boolean) => void }>();
  const publish = async (sessionId: string, id: string) => {
    const row = await options.state.get(id);
    if (!row || row.sessionId !== sessionId) throw new Error('permission_denied');
    const summary = changeSummary(row); options.emit(sessionId, row.runId, { kind: 'change', change: summary }); return summary;
  };
  async function cancel(runId: string) {
    await options.state.invalidateRun(runId);
    for (const [id, waiting] of waits) if (waiting.runId === runId) {
      try { await publish(waiting.sessionId, id); } finally { waiting.finish(false); }
    }
  }
  return {
    cancel,
    async review(input: XiaozhiChangeReviewInput): Promise<XiaozhiChangeResult<XiaozhiChangeReview>> {
      if (!object(input) || Object.keys(input).some(key => !['sessionId', 'changeId'].includes(key))
        || !session(input.sessionId) || !change(input.changeId)) return { ok: false, error: 'invalid_input' };
      try { return { ok: true, value: await options.service.review(input.sessionId, input.changeId) }; }
      catch (error) { return { ok: false, error: errorCode(error) }; }
    },
    async decide(input: XiaozhiChangeDecision): Promise<XiaozhiChangeResult<XiaozhiChangeSummary>> {
      if (!object(input) || !session(input.sessionId) || !change(input.changeId)) return { ok: false, error: 'invalid_input' };
      const waiting = waits.get(input.changeId);
      if (['approve', 'reject'].includes(input.action) && (!waiting || waiting.sessionId !== input.sessionId
        || !options.isCurrent(waiting.sessionId, waiting.runId))) return { ok: false, error: 'permission_denied' };
      try {
        const result = await options.service.decision(input);
        await publish(input.sessionId, result.id);
        if (waiting) waiting.finish(result.state === 'approved' && options.isCurrent(waiting.sessionId, waiting.runId));
        return { ok: true, value: changeSummary(result) };
      } catch (error) { return { ok: false, error: errorCode(error) }; }
    },
    tools(sessionId: string, runId: string, wait: Wait): ToolDefinition[] {
      const execute = async (callId: string, raw: unknown, signal: AbortSignal | undefined, operation: 'create' | 'edit') => {
        if (!object(raw) || 'operation' in raw) throw new Error('invalid_input');
        const row = await options.service.propose(sessionId, runId, callId, { ...raw, operation }, signal);
        if (row.state !== 'pending') return receipt(changeSummary(row), options.sanitize);
        try {
          const approved = await wait(() => new Promise<boolean>(resolve => {
            const finish = (value: boolean) => { waits.delete(row.id); signal?.removeEventListener('abort', abort); resolve(value); };
            const abort = () => { void cancel(runId).catch(() => undefined).finally(() => finish(false)); };
            waits.set(row.id, { sessionId, runId, finish }); signal?.addEventListener('abort', abort, { once: true });
            if (signal?.aborted || !options.isCurrent(sessionId, runId)) abort();
            else void publish(sessionId, row.id).catch(() => abort());
          }));
          signal?.throwIfAborted();
          if (approved) { const outcome = await options.service.apply(sessionId, row.id, signal); await publish(sessionId, row.id); return receipt(changeSummary(outcome), options.sanitize); }
          return receipt(await publish(sessionId, row.id), options.sanitize);
        } catch (error) {
          await cancel(runId); await publish(sessionId, row.id).catch(() => undefined); throw error;
        }
      };
      const safeExecute = async (...args: Parameters<typeof execute>) => {
        try { return await execute(...args); }
        catch (error) {
          const code = error instanceof Error ? error.message : '';
          if (args[2]?.aborted || code === 'cancelled' || code === 'budget_exhausted') throw new Error(code === 'budget_exhausted' ? code : 'cancelled');
          return { content: [{type:'text' as const,text:JSON.stringify({success:false,message:
            code==='conflict'?'文件或修改记录已变化，本次没有覆盖。':code==='permission_denied'?'当前操作未获授权或确认已失效。':'未完成本次文件修改。请核对授权范围、实际文本及支持格式；不能宣称已经保存。'})}],
            details:{success:false},isError:true };
        }
      };
      const path = { type: 'string', minLength: 1, maxLength: 500 };
      return [{ name: 'office_create_text', label: '创建教学文档',
        description: '在教师授权工作目录提出新UTF8 .md或.txt文件，最多64KiB。既有父目录、相对路径；不能覆盖已有文件。展示真实审阅并等待教师确认后才保存。拒绝后不要重复请求。',
        parameters: { type: 'object', properties: { path, content: { type: 'string', maxLength: 65536 } }, required: ['path', 'content'], additionalProperties: false } as ToolDefinition['parameters'],
        execute: (callId, args, signal) => safeExecute(callId, args, signal, 'create'),
      }, { name: 'office_edit_text', label: '修改教学文档',
        description: '修改授权目录现有UTF8 .md或.txt，最多64KiB。先读取实际文本再提出1至16处唯一oldText/newText替换；原文等于全文时也可按教师明确要求替换。复用Pi编辑算法。展示真实差异，教师确认且原版本仍一致才写。拒绝或版本冲突不得重复强写。',
        parameters: { type: 'object', properties: { path, edits: { type: 'array', minItems: 1, maxItems: 16, items: { type: 'object', properties: { oldText: { type: 'string', minLength: 1, maxLength: 65536 }, newText: { type: 'string', maxLength: 65536 } }, required: ['oldText', 'newText'], additionalProperties: false } } }, required: ['path', 'edits'], additionalProperties: false } as ToolDefinition['parameters'],
        execute: (callId, args, signal) => safeExecute(callId, args, signal, 'edit'),
      }];
    },
  };
}
