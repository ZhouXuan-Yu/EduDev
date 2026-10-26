import {taskStepState,type TaskView} from '../../../shared/xiaozhi-task';
const labels={pending:'待处理',executing:'执行中，尚未核验',waiting_dependency:'等待前置核验',needs_check:'已报告完成，待核对',verified:'已核验',needs_fix:'需要修正'} as const;
export function PiTaskSteps({task}:{task:TaskView}){
 if(!task.steps.length)return null;const passed=task.steps.filter(s=>taskStepState(task,s.id)==='verified').length;
 return <details className="pi-task-steps" data-testid="pi-task-steps" open>
  <summary>任务步骤 · {passed}/{task.steps.length} 已核验</summary>
  <p className="pi-task-review-status">模型报告与核验分开显示；教学要求仍由你确认。</p>
  <ol aria-label="任务步骤核验">{task.steps.map(step=>{const state=taskStepState(task,step.id);return <li key={step.id} data-task-step-id={step.id} data-state={state}>
   <span>{step.text}</span><span className="pi-task-review-status">{labels[state]}</span>
   <details><summary>查看对应要求与核对记录</summary><ul>{step.criterionIds.map(id=>{const c=task.criteria.find(c=>c.id===id);if(!c)return null;const check=task.checks.find(k=>k.criterionId===id&&k.criterionVersion===c.version);return <li key={id}><span>{c.text}</span><span className="pi-task-review-status">{c.kind==='human'?'教师确认':'来源或产物核对'} · {check?.state==='passed'?'已通过':check?.state==='failed'?'未通过':check?.state==='unknown'?'需重新核对':'待核对'}</span>{check&&<time dateTime={check.checkedAt} className="pi-task-review-status">{new Date(check.checkedAt).toLocaleString()}</time>}</li>;})}</ul></details>
  </li>;})}</ol>
 </details>;
}
