import type {AiAgentEvent} from '../../shared/contracts';

const phases={route:'选择处理方式',plan:'制定计划',tool_call:'调用工具',observe:'读取工具结果',
  reflect:'复核步骤',finalize:'结束本轮',guardrail:'检查权限'};
const statuses={pending:'尚未开始',running:'进行中',succeeded:'已完成',failed:'失败',blocked:'受阻',skipped:'已跳过'};

export function sessionEventSummary(event:AiAgentEvent) {
  return '第 '+event.sequence+' 个事件 · '+(phases[event.phase]??'工作步骤')+' · '+(statuses[event.status]??'状态未知');
}
