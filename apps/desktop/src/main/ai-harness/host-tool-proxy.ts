import type {
  AiModelToolCall,
  AiRouterDecision,
  XiazhiHostToolRequest,
  XiazhiHostToolResult,
} from '../../shared/contracts';
import type { OmniEduStore } from '../db';
import {
  createAiToolExecutionState,
  executeAiToolCall,
  reviewModelToolCall,
  type CompiledAiContext,
} from './tool-registry';
import { isCapabilityAllowedForRoute } from './agent-harness-profile';

export async function executeHostToolRequest(params: {
  store: OmniEduStore;
  prompt: string;
  router: AiRouterDecision;
  request: XiazhiHostToolRequest;
  boundStudentId?: string;
  state?: CompiledAiContext;
  executionContext?: { runId?: string; turnId?: string };
}) : Promise<{ result: XiazhiHostToolResult; state: CompiledAiContext }> {
  const { request, router } = params;
  const state = params.state ?? createAiToolExecutionState(router, { resolvedStudentId: params.boundStudentId });
  const base = {
    schemaVersion: 'xiazhi.host_tool.result.v1' as const,
    requestId: request.requestId,
    turnId: request.turnId,
  };
  if (request.schemaVersion !== 'xiazhi.host_tool.request.v1') {
    return { state, result: { ...base, status: 'blocked', review: { ok: false, reason: 'HostToolProxy contract version mismatch.', errors: ['schema_version_mismatch'] }, modelResult: { ok: false, blocked: true } } };
  }
  if (!isCapabilityAllowedForRoute(request.capability, router.route)) {
    return { state, result: { ...base, status: 'blocked', review: { ok: false, reason: 'Capability is not allowed for the active route.', errors: ['capability_route_mismatch'] }, modelResult: { ok: false, blocked: true } } };
  }
  const review = reviewModelToolCall(
    { name: request.toolName, arguments: request.arguments } satisfies AiModelToolCall,
    router,
    { allowManagedWrite: request.capability === 'mastery_path' },
  );
  if (!review.ok) {
    return { state, result: { ...base, status: 'blocked', review: { ok: false, reason: review.reason, errors: review.errors }, modelResult: { ok: false, blocked: true, reason: review.reason } } };
  }
  const execution = await executeAiToolCall({
    store: params.store,
    prompt: params.prompt,
    router,
    state,
    call: { name: request.toolName, arguments: review.normalizedArguments },
    allowManagedWrite: request.capability === 'mastery_path',
    executionContext: params.executionContext ?? { turnId: request.turnId },
  });
  return {
    state,
    result: {
      ...base,
      status: execution.toolRun.status === 'used' ? 'used' : execution.toolRun.status === 'failed' ? 'failed' : 'blocked',
      review: { ok: execution.review.ok, reason: execution.review.reason, errors: execution.review.errors },
      modelResult: execution.modelResult,
    },
  };
}
