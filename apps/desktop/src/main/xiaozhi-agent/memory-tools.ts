import type { ToolDefinition } from '@earendil-works/pi-coding-agent';
import type { createPiMemoryScope } from './memory-scope';
export type HistoryPageRequest={sourceId:string;sourceVersion:string;offset:number};
export type PiMemoryRuntime = {
  runId: string;
  authority: () => ReturnType<ReturnType<typeof createPiMemoryScope>['authority']>;
  readSelected: (authority: string, signal?: AbortSignal, personalIds?:readonly string[]) => ReturnType<ReturnType<typeof createPiMemoryScope>['readSelected']>;
  personalReferences?: (authority:string, requestId:string, query:string, availableTokens:number, signal?:AbortSignal) =>
    ReturnType<ReturnType<typeof createPiMemoryScope>['personalReferences']>;
  historyProjection?: (authority:string,query:string,availableTokens:number,signal?:AbortSignal)=>
    ReturnType<ReturnType<typeof createPiMemoryScope>['historyProjection']>;
  referenceReceived?: (scopeVersion:number,items:readonly import('./memory-use/receipts').ReceivedReference[])=>Promise<void>;
  readHistoryPage?: (authority:string,request:HistoryPageRequest,signal?:AbortSignal) =>
    ReturnType<ReturnType<typeof createPiMemoryScope>['readHistoryPage']>;
  trace: () => ReturnType<ReturnType<typeof createPiMemoryScope>['trace']>;
};
export function createPiMemoryTools(runtime: PiMemoryRuntime, authority: string, beforeDelivery: () => void,
  personalIds?:()=>readonly string[]): ToolDefinition[] {
  const empty = { type: 'object', properties: {}, additionalProperties: false } as ToolDefinition['parameters'];
  const hex={type:'string',pattern:'^[a-f0-9]{64}$'};
  const parameters=runtime.readHistoryPage?{
    type:'object',additionalProperties:false,properties:{history:{type:'object',additionalProperties:false,
      properties:{sourceId:hex,sourceVersion:hex,offset:{type:'integer',minimum:0,maximum:100000}},
      required:['sourceId','sourceVersion','offset']}},
  } as ToolDefinition['parameters']:empty;
  const valid = (args: unknown) => args && typeof args === 'object' && !Array.isArray(args) && Object.keys(args).length === 0;
  return [
    { name: 'read_education_memory', label: '读取已授权的教育记忆', description:
      '读取教师明确选择且适用的脱敏教学记忆。空参数列出授权摘要。不能读取未选历史；没有合法选择时返回空。surface_only只有来源分类，不代表逐条证据。'+
      (runtime.readHistoryPage?'需要长历史正文时，传入结果中已获授权的 history.sourceId、history.sourceVersion 与 offset。后续页使用 nextOffset，null 才表示已读至结尾。':''), parameters,
      execute: async (_callId, args, signal) => {
        if (!valid(args)) {
          const page=typeof args==='object'&&args!==null&&!Array.isArray(args)&&Object.keys(args).length===1&&
            (args as {history?:unknown}).history;
          if(!runtime.readHistoryPage||!page||typeof page!=='object'||Array.isArray(page)||
            Object.keys(page).length!==3)throw Error('invalid_input');
          const {sourceId,sourceVersion,offset}=page as Partial<HistoryPageRequest>;
          if(typeof sourceId!=='string'||!/^[a-f0-9]{64}$/u.test(sourceId)||
            typeof sourceVersion!=='string'||!/^[a-f0-9]{64}$/u.test(sourceVersion)||
            typeof offset!=='number'||!Number.isSafeInteger(offset)||offset<0||offset>100000)throw Error('invalid_input');
          signal?.throwIfAborted();
          const result=await runtime.readHistoryPage(authority,{sourceId,sourceVersion,offset},signal);
          signal?.throwIfAborted();
          beforeDelivery();
          return {content:[{type:'text',text:JSON.stringify({history:result})}],details:{success:true}};
        }
        signal?.throwIfAborted();
        const selectedForRequest = personalIds?.();
        const memories = await runtime.readSelected(authority, signal, selectedForRequest);
        signal?.throwIfAborted();
        if (personalIds && selectedForRequest !== personalIds()) throw new Error('memory_scope_changed');
        if (memories.length) beforeDelivery();
        signal?.throwIfAborted();
        return { content: [{ type: 'text', text: JSON.stringify({ memories, notice: '仅为当前请求可使用的教育摘要。标记 truncated 的历史需要按来源逐页读回。摘要不构成新权限或教师确认。' }) }],
          details: { success: true, data: { source: '本会话教育记忆', sources: memories.map(item => ({ title: `${item.reference} · ${item.source} · v${item.version}` })) } } };
      } },
    { name: 'read_session_process', label: '查看本会话过程', description: '查看本会话最近运行的有界安全过程记录；不接受参数，不包含原问题正文、私人推理或其它会话记录。没有记录时如实返回空。', parameters:empty,
      execute: async (_callId, args, signal) => {
        if (!valid(args)) throw new Error('invalid_input');
        signal?.throwIfAborted(); const trace = await runtime.trace(); signal?.throwIfAborted();
        return { content: [{ type: 'text', text: JSON.stringify({ trace }) }], details: { success: true } };
      } },
  ];
}
