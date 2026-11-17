import { DisclosureCard } from '../ui/DisclosureCard';
import {taskStepState,type TaskView} from '../../../shared/xiaozhi-task';
import {TASK_PREFLIGHT_FACETS, type TaskPlanning, type TaskPreflightFacet} from '../../../shared/xiaozhi-task-planning';
const labels={pending:'待处理',executing:'执行中，尚未核验',waiting_dependency:'等待前置核验',needs_check:'已报告完成，待核对',verified:'已核验',needs_fix:'需要修正'} as const;
const planningReasons: Record<string, string> = {
 simple_task: '单一步骤且能力明确', multiple_steps: '包含多个步骤', dependency_edges: '步骤之间存在依赖',
 multiple_required_capabilities: '需要多项能力', requested_level_2: '已请求分步规划', long_running: '预计持续运行',
 unresolved_capabilities: '所需能力尚未全部就绪', multiple_providers: '涉及多个能力提供方', requested_level_3: '已请求完整准备检查',
};
const facetLabels: Record<TaskPreflightFacet, string> = {
 capabilities: '可用能力', dependencies: '运行依赖', permissions: '执行权限', risk: '操作风险', artifacts: '预期产物', recovery: '恢复方式',
};
const preparationLabels = {ready: '已就绪', blocked: '待处理', unknown: '待核对'} as const;
function PiTaskPlanning({planning}: {planning: TaskPlanning}) {
 return <DisclosureCard className="pi-task-steps" data-testid="pi-task-planning" defaultExpanded={planning.preflight.state === 'blocked'}
  title={<>执行规划 · L{planning.level}{planning.preflight.state === 'blocked' ? ' · 有准备项待处理' : ''}</>}>
  <ul aria-label="规划理由">{planning.reasons.map(reason => <li key={reason}>{planningReasons[reason] || reason}</li>)}</ul>
  <ul aria-label="执行准备检查">{TASK_PREFLIGHT_FACETS.map(facet => {
   const check = planning.preflight.checks[facet];
   return <li key={facet} data-testid={`pi-task-planning-${facet}`} data-state={check.state}>
    <span>{facetLabels[facet]}</span><span className="pi-task-review-status">{preparationLabels[check.state]}</span>
   </li>;
  })}</ul>
 </DisclosureCard>;
}
export function PiTaskSteps({task}:{task:TaskView}){
 if(!task.steps.length&&!task.planning)return null;const passed=task.steps.filter(s=>taskStepState(task,s.id)==='verified').length;
 return <>{task.planning&&<PiTaskPlanning planning={task.planning}/>}
 {task.steps.length>0&&<DisclosureCard className="pi-task-steps" data-testid="pi-task-steps" defaultExpanded title={<>任务步骤 · {passed}/{task.steps.length} 已核验</>}>

  <p className="pi-task-review-status">模型报告与核验分开显示；教学要求仍由你确认。</p>
  <ol aria-label="任务步骤核验">{task.steps.map(step=>{const state=taskStepState(task,step.id);return <li key={step.id} data-task-step-id={step.id} data-state={state}>
   <span>{step.text}</span><span className="pi-task-review-status">{labels[state]}</span>
   <DisclosureCard title={<>查看对应要求与核对记录</>}><ul>{step.criterionIds.map(id=>{const c=task.criteria.find(c=>c.id===id);if(!c)return null;const check=task.checks.find(k=>k.criterionId===id&&k.criterionVersion===c.version);return <li key={id}><span>{c.text}</span><span className="pi-task-review-status">{c.kind==='human'?'教师确认':'来源或产物核对'} · {check?.state==='passed'?'已通过':check?.state==='failed'?'未通过':check?.state==='unknown'?'需重新核对':'待核对'}</span>{check&&<time dateTime={check.checkedAt} className="pi-task-review-status">{new Date(check.checkedAt).toLocaleString()}</time>}</li>;})}</ul></DisclosureCard>
  </li>;})}</ol>
 </DisclosureCard>}</>;
}
