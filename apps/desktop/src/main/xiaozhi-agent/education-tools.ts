import type { ToolDefinition } from '@earendil-works/pi-coding-agent';
import type { OmniEduStore } from '../db';
import { executeAiToolCall, getModelToolDefinitions, type CompiledAiContext } from '../ai-harness/tool-registry';
import { routeAiPrompt } from '../ai-harness/router';

/** Existing teacher knowledge review/execution, no direct SQL or raw-file bypass. */
export function createEducationTools(store: OmniEduStore, prompt = ''): ToolDefinition[] {
  const router = routeAiPrompt('检索老师知识库中的教学资料', { hasStudent: false });
  const definition = getModelToolDefinitions(router, { toolNames: ['search_teacher_knowledge'] })[0];
  if (!definition) throw new Error('configuration');
  return [{ name: definition.function.name, label: '检索老师知识库', description: definition.function.description,
    parameters: definition.function.parameters as ToolDefinition['parameters'],
    execute: async (_callId, args, signal) => {
      signal?.throwIfAborted();
      const state: CompiledAiContext = { records: [], knowledgeSnippets: [], graphNodes: [], similarQuestions: [],
        sources: [], toolRuns: [], selectedContext: [] };
      const result = await executeAiToolCall({ store, prompt, router, state,
        call: { name: 'search_teacher_knowledge', arguments: args as Record<string, unknown> } });
      signal?.throwIfAborted();
      // Empty search is a factual result; validation/execution failure is an error.
      const failed = !result.review.ok || result.toolRun.status === 'failed';
      const snippets = Array.isArray(result.modelResult.snippets) ? result.modelResult.snippets : [];
      const sources = snippets.flatMap(value => value && typeof value.resourceTitle === 'string' ? [{ title: value.resourceTitle.slice(0, 200) }] : []);
      // Keep existing reviewed/bounded facts, give the model human citation aliases.
      const payload = { ...result.modelResult, snippets: snippets.map((value, index) => {
        const { id: _id, resourceId: _resourceId, resourceTitle, ...facts } = value;
        return { reference: `资料${index + 1}`, title: resourceTitle, ...facts };
      }) };
      return { content: [{ type: 'text', text: JSON.stringify(payload) }],
        details: { success: !failed, data: { source: '老师知识库', count: result.modelResult.count ?? 0, sources } }, isError: failed };
    },
  }];
}
