import type {
  AiAgentRunStatus,
  AiIntentRoute,
  AiRouterDecision,
  XiazhiCapabilityName,
} from '../../shared/contracts';

export const XIAZHI_AGENT_HARNESS_VERSION = 'xiazhi.agent-harness.v1';

const CAPABILITY_TO_ROUTES: Record<XiazhiCapabilityName, readonly AiIntentRoute[]> = {
  chat: ['general_qa', 'workspace_help', 'knowledge_retrieval'],
  deep_solve: ['error_analysis', 'student_diagnosis'],
  deep_question: ['practice_design'],
  deep_research: ['knowledge_retrieval', 'lesson_design', 'report_draft'],
  visualize: ['lesson_design', 'report_draft'],
  mastery_path: ['student_diagnosis', 'practice_design'],
};

const DEFAULT_ROUTE_CAPABILITY: Record<AiIntentRoute, XiazhiCapabilityName> = {
  general_qa: 'chat',
  workspace_help: 'chat',
  knowledge_retrieval: 'chat',
  student_diagnosis: 'deep_solve',
  error_analysis: 'deep_solve',
  practice_design: 'deep_question',
  lesson_design: 'deep_research',
  report_draft: 'deep_research',
};

export function isCapabilityAllowedForRoute(capability: XiazhiCapabilityName, route: AiIntentRoute) {
  return CAPABILITY_TO_ROUTES[capability].includes(route);
}

export function selectDeepTutorCapability(router: AiRouterDecision): XiazhiCapabilityName {
  if (router.subIntent === 'visualization' && isCapabilityAllowedForRoute('visualize', router.route)) {
    return 'visualize';
  }
  if (router.subIntent === 'research_workspace' && isCapabilityAllowedForRoute('deep_research', router.route)) {
    return 'deep_research';
  }
  return DEFAULT_ROUTE_CAPABILITY[router.route];
}

export function isConsoleRunPendingStatus(status: AiAgentRunStatus) {
  return status === 'running' || status === 'waiting_input';
}

export function buildAgentHarnessInstructions(
  router: AiRouterDecision,
  capability: XiazhiCapabilityName = selectDeepTutorCapability(router),
) {
  return [
    `Agent Harness：${XIAZHI_AGENT_HARNESS_VERSION}；本轮 Capability：${capability}。`,
    `上下文预算：只使用 route=${router.route} 的 contextPolicy；当前允许上下文为 ${router.contextPolicy.include.join('、') || '无'}。`,
    '工具协议：只调用宿主提供的工具 schema；先按需 load_tools，再执行必要工具；blocked/failed 后不得用想象结果继续。',
    '学生引用协议：已有 studentId 或任务中有明确学生名时，先使用本地解析/读取工具；只有工具尝试后仍缺少必要标识或证据，才 ask_user。',
    '权限协议：读取可按 route 执行；草稿与写入必须遵守宿主确认边界，模型不得把 pending 当作已保存。',
    '证据协议：学生诊断、错因、题组和报告必须以真实工具结果为事实；没有证据时写 unknowns，不得补造学生表现。',
    '状态协议：waiting_input 表示暂停等待老师输入；收到 answered 后从当前 AgentLoop 继续，cancelled/expired 必须明确终止。',
    '完成定义：只有产生通过 xiazhi.reply.v2 校验的最终结果，或返回可行动的明确失败/等待状态，才算本轮收敛。',
  ];
}

