import { Check, Circle, ListTodo, ArrowRight } from 'lucide-react';
import {useState} from 'react';
import type { XiaozhiControl } from '../../../shared/xiaozhi-agent';
import { ChainOfThought } from '../../heroui-pro/components/chain-of-thought';
import './pi-plan-failure.css';
import {validVersionedPlan} from '../../../shared/xiaozhi-plan';
import {PiPlanHistory} from './PiPlanHistory';

/** Public native plan facts only. This is not a private reasoning or persistent goal view. */
export function PiTaskPlan({plan,compact=false,sessionId}:{plan:XiaozhiControl;compact?:boolean;sessionId?:string}) {
  const versioned=validVersionedPlan(plan);
  const steps=plan.steps||[], completed=steps.filter(step=>step.status==='completed').length;
  const current=steps.find(step=>step.status==='in_progress');
  const done=steps.length>0&&completed===steps.length;
  const scope=JSON.stringify([plan.id,compact]);
  const [choice,setChoice]=useState<{scope:string;expanded:boolean}>();
  const expanded=choice?.scope===scope?choice.expanded:!compact&&!done&&!versioned;
  if(plan.plan&&!versioned)return <p role="alert">计划记录暂时无法核对，请重新读取会话。</p>;
  return <ChainOfThought key={plan.id} isExpanded={expanded} onExpandedChange={value=>setChoice({scope,expanded:value})} className={compact?'pi-live-task-strip':'office-plan pi-native-plan'}
    data-testid={compact?'pi-live-task':'pi-task-plan'} data-control-id={plan.id} data-state={plan.state} data-plan-revision={plan.plan?.revision}>
    <ChainOfThought.Trigger><ListTodo size={16} aria-hidden="true"/><span className="pi-plan-title">{compact?'进行中的任务':'任务计划'}</span>
      {(compact||versioned)&&<span className="pi-plan-current" title={current?.text||plan.text}>{current?.text||plan.text}</span>}
      <span className="pi-plan-count">{completed}/{steps.length} {versioned?'已报告完成':'已完成'}</span>
    </ChainOfThought.Trigger>
    <ChainOfThought.Content><p className="pi-plan-verification-note">{versioned?'计划结构已检查采用；步骤进度是小智的报告，不代表结果已核验。':'旧版计划进度记录，未保存可比较的调整版本；步骤未经独立核验。'}</p><ChainOfThought.Steps role="list" aria-label="任务步骤">{steps.map((step,index)=><ChainOfThought.Step key={step.id||index} role="listitem" aria-current={step.status==='in_progress'?'step':undefined} data-testid="pi-plan-step" data-step-id={step.id} data-state={step.status}>
      <span className="pi-plan-step-line">{step.status==='completed'?<Check size={15} aria-hidden="true"/>:step.status==='in_progress'?<ArrowRight size={15} aria-hidden="true"/>:<Circle size={13} aria-hidden="true"/>}
        <span>{step.text}{step.dependsOn?.length? <small className="pi-plan-dependencies">前置：{step.dependsOn.map(id=>steps.find(s=>s.id===id)?.text||'记录缺失').join('、')}</small>:null}</span><span className="pi-plan-step-state">{step.status==='completed'?(versioned?'报告完成':'已完成'):step.status==='in_progress'?'进行中':step.dependsOn?.some(id=>steps.find(s=>s.id===id)?.status!=='completed')?'等待前置步骤':'待处理'}</span>
      </span>
    </ChainOfThought.Step>)}</ChainOfThought.Steps>{versioned&&!compact&&sessionId&&<PiPlanHistory key={plan.id} sessionId={sessionId} plan={plan}/>}</ChainOfThought.Content>
  </ChainOfThought>;
}
