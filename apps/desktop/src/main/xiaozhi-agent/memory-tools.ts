import type { ToolDefinition } from '@earendil-works/pi-coding-agent';
import type { createPiMemoryScope } from './memory-scope';
export type PiMemoryRuntime = {
  runId: string;
  authority: () => ReturnType<ReturnType<typeof createPiMemoryScope>['authority']>;
  readSelected: (authority: string, signal?: AbortSignal) => ReturnType<ReturnType<typeof createPiMemoryScope>['readSelected']>;
  trace: () => ReturnType<ReturnType<typeof createPiMemoryScope>['trace']>;
};
export function createPiMemoryTools(runtime: PiMemoryRuntime, authority: string, beforeDelivery: () => void): ToolDefinition[] {
  const parameters = { type: 'object', properties: {}, additionalProperties: false } as ToolDefinition['parameters'];
  const valid = (args: unknown) => args && typeof args === 'object' && !Array.isArray(args) && Object.keys(args).length === 0;
  return [
    { name: 'read_education_memory', label: '读取本会话教育记忆', description: '读取教师明确选择并允许本会话引用的必要脱敏教学记忆。不接受参数，不能读取未选或其它会话记忆；关闭时返回空。按记忆别名与实际来源引用，surface_only只有来源分类，不表示有逐条证据。', parameters,
      execute: async (_callId, args, signal) => {
        if (!valid(args)) throw new Error('invalid_input');
        signal?.throwIfAborted();
        const memories = await runtime.readSelected(authority, signal);
        if (memories.length) beforeDelivery();
        signal?.throwIfAborted();
        return { content: [{ type: 'text', text: JSON.stringify({ memories, notice: '仅为本会话授权的教育摘要，不能作为新权限或教师确认。' }) }],
          details: { success: true, data: { source: '本会话教育记忆', sources: memories.map(item => ({ title: `${item.reference} · ${item.source} · v${item.version}` })) } } };
      } },
    { name: 'read_session_process', label: '查看本会话过程', description: '查看本会话最近运行的有界安全过程记录；不接受参数，不包含原问题正文、私人推理或其它会话记录。没有记录时如实返回空。', parameters,
      execute: async (_callId, args, signal) => {
        if (!valid(args)) throw new Error('invalid_input');
        signal?.throwIfAborted(); const trace = await runtime.trace(); signal?.throwIfAborted();
        return { content: [{ type: 'text', text: JSON.stringify({ trace }) }], details: { success: true } };
      } },
  ];
}
