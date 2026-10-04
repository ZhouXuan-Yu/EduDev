import { Check, Circle, ListTodo, ArrowRight } from 'lucide-react';
import type { XiaozhiControl } from '../../../shared/xiaozhi-agent';
import { ChainOfThought } from '../../heroui-pro/components/chain-of-thought';
import './pi-plan-failure.css';

/** Public native plan facts only. This is not a private reasoning or persistent goal view. */
export function PiTaskPlan({plan,compact=false}:{plan:XiaozhiControl;compact?:boolean}) {
  const steps=plan.steps||[], completed=steps.filter(step=>step.status==='completed').length;
  const current=steps.find(step=>step.status==='in_progress');
  const done=steps.length>0&&completed===steps.length;
  return <ChainOfThought key={`${plan.id}:${done}`} defaultExpanded={!compact&&!done} className={compact?'pi-live-task-strip':'office-plan pi-native-plan'}
    data-testid={compact?'pi-live-task':'pi-task-plan'} data-control-id={plan.id} data-state={plan.state}>
    <ChainOfThought.Trigger><ListTodo size={16} aria-hidden="true"/><span className="pi-plan-title">{compact?'进行中的任务':'任务计划'}</span>
      {compact&&<span className="pi-plan-current" title={current?.text||plan.text}>{current?.text||plan.text}</span>}
      <span className="pi-plan-count">{completed}/{steps.length} 已完成</span>
    </ChainOfThought.Trigger>
    <ChainOfThought.Content><ChainOfThought.Steps>{steps.map((step,index)=><ChainOfThought.Step key={index} data-testid="pi-plan-step" data-state={step.status}>
      <span className="pi-plan-step-line">{step.status==='completed'?<Check size={15} aria-hidden="true"/>:step.status==='in_progress'?<ArrowRight size={15} aria-hidden="true"/>:<Circle size={13} aria-hidden="true"/>}
        <span>{step.text}</span><span className="pi-plan-step-state">{step.status==='completed'?'已完成':step.status==='in_progress'?'进行中':'待处理'}</span>
      </span>
    </ChainOfThought.Step>)}</ChainOfThought.Steps></ChainOfThought.Content>
  </ChainOfThought>;
}
