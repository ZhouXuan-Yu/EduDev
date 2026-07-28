import type { AiAgentTraceStep, AiConsoleToolRun } from '../../shared/contracts';
import type { OmniEduStore } from '../db';
import { routeAiPrompt } from './router';
import { compileAiContext, type CompiledAiContext } from './tool-registry';

export type AiAgentLoopResult = CompiledAiContext & {
  agentRunId?: string;
  trace: AiAgentTraceStep[];
  router: ReturnType<typeof routeAiPrompt>;
};

function statusFromToolRun(status: AiConsoleToolRun['status']): AiAgentTraceStep['status'] {
  if (status === 'used') return 'succeeded';
  if (status === 'failed') return 'failed';
  if (status === 'blocked') return 'blocked';
  return 'pending';
}

function summarizeToolObservation(tool: AiConsoleToolRun) {
  const output = tool.outputSummary ? ` 输出摘要：${JSON.stringify(tool.outputSummary)}` : '';
  return `${tool.detail}${output}`;
}

export async function runAiAgentLoop(params: {
  store: OmniEduStore;
  prompt: string;
  studentId?: string;
  agentRunId?: string;
}): Promise<AiAgentLoopResult> {
  const trace: AiAgentTraceStep[] = [];
  const router = routeAiPrompt(params.prompt, { hasStudent: Boolean(params.studentId) });

  async function emit(step: AiAgentTraceStep) {
    trace.push(step);
    if (params.agentRunId) {
      await params.store.recordAiAgentEvent(params.agentRunId, step);
    }
  }

  await emit({
    phase: 'route',
    status: 'succeeded',
    label: '任务识别',
    detail: `Router dry-run 判定为 ${router.route}，置信度 ${Math.round(router.confidence * 100)}%。动作级别：${router.actionLevel}；风险级别：${router.riskLevel}。`,
    inputSummary: {
      promptLength: params.prompt.length,
      hasSelectedStudent: Boolean(params.studentId),
    },
    outputSummary: {
      route: router.route,
      confidence: router.confidence,
      audience: router.audience,
      actionLevel: router.actionLevel,
      riskLevel: router.riskLevel,
      needsStudent: router.needsStudent,
    },
  });

  if (router.clarificationQuestion) {
    await emit({
      phase: 'guardrail',
      status: 'blocked',
      label: '学生绑定边界',
      detail: router.clarificationQuestion,
      outputSummary: {
        needsStudent: router.needsStudent,
        clarificationQuestion: router.clarificationQuestion,
      },
    });
  }

  await emit({
    phase: 'plan',
    status: router.allowedTools.length ? 'succeeded' : 'skipped',
    label: '工具计划',
    detail: router.allowedTools.length
      ? `本轮允许调用：${router.allowedTools.join(' → ')}。上下文策略：${router.contextPolicy.reason}`
      : `本轮无需调用本地工具。上下文策略：${router.contextPolicy.reason}`,
    outputSummary: {
      allowedTools: router.allowedTools,
      selectedContext: router.contextPolicy.include,
      contextReason: router.contextPolicy.reason,
    },
  });

  const context = await compileAiContext({
    store: params.store,
    prompt: params.prompt,
    studentId: params.studentId,
    router,
  });

  for (const tool of context.toolRuns) {
    await emit({
      phase: 'tool_call',
      status: statusFromToolRun(tool.status),
      label: `调用工具：${tool.label}`,
      detail: `${tool.name}｜${tool.effect ?? 'read'}｜${tool.privacy ?? 'local_only'}`,
      toolName: tool.name,
      inputSummary: tool.inputSummary ?? {
        effect: tool.effect ?? 'read',
        privacy: tool.privacy ?? 'local_only',
      },
    });
    await emit({
      phase: 'observe',
      status: statusFromToolRun(tool.status),
      label: `观察结果：${tool.label}`,
      detail: summarizeToolObservation(tool),
      toolName: tool.name,
      outputSummary: tool.outputSummary ?? {
        status: tool.status,
        detail: tool.detail,
      },
    });
  }

  const blockedTools = context.toolRuns.filter((tool) => tool.status === 'blocked' || tool.status === 'failed');
  const usedTools = context.toolRuns.filter((tool) => tool.status === 'used');
  await emit({
    phase: 'reflect',
    status: blockedTools.length ? 'blocked' : 'succeeded',
    label: '复盘与边界',
    detail: blockedTools.length
      ? `有 ${blockedTools.length} 个工具未拿到数据：${blockedTools.map((tool) => tool.label).join('、')}。回复必须把缺口写入未知/下一步，不得伪造。`
      : `已拿到 ${usedTools.length} 个工具结果，可进入结构化回复。`,
    outputSummary: {
      usedTools: usedTools.map((tool) => tool.name),
      blockedTools: blockedTools.map((tool) => ({ name: tool.name, status: tool.status })),
    },
  });

  await emit({
    phase: 'finalize',
    status: 'succeeded',
    label: '终止条件',
    detail: '达到本轮目标：完成路由、按需工具调用、观察、复盘，并进入 xiazhi.reply.v1 结构化输出校验。',
    outputSummary: {
      schemaVersion: 'xiazhi.reply.v1',
      maxLoopReached: false,
      terminationReason: 'ready_for_structured_reply',
    },
  });

  return { ...context, agentRunId: params.agentRunId, router, trace };
}
