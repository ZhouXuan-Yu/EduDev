import {useRef,useState} from 'react';
import {Button,Checkbox,Label,Modal,TextArea} from '@heroui/react';
import {Target,Pause,Play,Square,Check} from 'lucide-react';
import {ChainOfThought} from '../../heroui-pro/components/chain-of-thought';
import {GOAL_LABELS,type XiaozhiGoal,type GoalMutation} from '../../../shared/xiaozhi-goal';
import './pi-goal.css';

/** Public persisted goal facts. Only the teacher can accept a result. */
export function PiGoalControl({sessionId,goal,running,disabled,onRefresh}:{sessionId:string;goal?:XiaozhiGoal;running:boolean;disabled:boolean;onRefresh:()=>Promise<void>}){
 const [open,setOpen]=useState(false),[objective,setObjective]=useState(''),[criteria,setCriteria]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[checked,setChecked]=useState<number[]>([]);
 const lock=useRef(false),createId=useRef(`xigoal_${crypto.randomUUID()}`);
 const terminal=!goal||['completed','ended'].includes(goal.state);
 async function mutate(input:GoalMutation){
  if(lock.current)return;lock.current=true;setBusy(true);setNotice('');
  try{const result=await window.omniEdu?.mutateXiaozhiGoal(input);
   if(!result?.ok){setNotice(result?.error==='command_conflict'?'目标状态已变化，请核对最新进度后重试。':result?.error==='busy'?'请先结束当前任务或移除待发送附件。':'目标操作未完成，请刷新后重试。');}
   else{setOpen(false);setChecked([]);}
   await onRefresh();
  }catch{setNotice('操作结果未确认，请刷新后核对。');}finally{lock.current=false;setBusy(false);}
 }
 const action=(action:'pause'|'resume'|'end'|'accept')=>goal&&void mutate({schemaVersion:1,sessionId,id:goal.id,revision:goal.revision,action,...(action==='accept'?{checked}:{})} as GoalMutation);
 return <>
  {terminal?<div className="pi-goal-new"><Button size="sm" variant="ghost" data-testid="pi-goal-open" isDisabled={disabled||running||busy} onPress={()=>{setOpen(true);setNotice('');createId.current=`xigoal_${crypto.randomUUID()}`;}}><Target size={15}/>持续目标</Button>{goal&&<span>{GOAL_LABELS[goal.state]} · {goal.objective}</span>}</div>:<div className="pi-live-task-strip pi-goal-strip" data-testid="pi-goal-strip" data-state={goal.state} data-revision={goal.revision}>
   <div className="pi-goal-heading"><ChainOfThought defaultExpanded={false} className="pi-goal-facts">
    <ChainOfThought.Trigger><Target size={16}/><span className="pi-plan-title">{GOAL_LABELS[goal.state]}</span><span className="pi-plan-current" title={goal.objective}>{goal.objective}</span></ChainOfThought.Trigger>
    <ChainOfThought.Content><p>{goal.summary||'正在核对需求与资料。'}</p><p>下一步：{goal.nextStep}</p><ol>{goal.criteria.map((text,i)=><li key={i}>{text}</li>)}</ol>{goal.evidence.length>0&&<p>已执行：{[...new Set(goal.evidence.map(v=>v.label))].join('、')}</p>}</ChainOfThought.Content>
   </ChainOfThought><div className="pi-goal-actions">
    {['active','waiting_teacher'].includes(goal.state)&&<Button size="sm" variant="ghost" isIconOnly aria-label="暂停目标" data-testid="pi-goal-pause" isDisabled={busy} onPress={()=>action('pause')}><Pause size={15}/></Button>}
    {['paused','interrupted'].includes(goal.state)&&<Button size="sm" variant="ghost" data-testid="pi-goal-resume" isDisabled={busy||running||disabled} onPress={()=>action('resume')}><Play size={15}/>恢复</Button>}
    {goal.state==='review_required'&&<Button size="sm" variant="ghost" data-testid="pi-goal-review" isDisabled={busy||running||!goal.resultRunId} onPress={()=>{setOpen(true);setChecked([]);}}><Check size={15}/>验收</Button>}
    <Button size="sm" variant="ghost" isIconOnly aria-label="结束目标" data-testid="pi-goal-end" isDisabled={busy} onPress={()=>action('end')}><Square size={14}/></Button>
   </div></div>
  </div>}
  {notice&&<p className="pi-goal-notice" role="status" data-testid="pi-goal-notice">{notice}</p>}
  {open&&<Modal.Backdrop isOpen isDismissable={!busy} onOpenChange={value=>{if(!value&&!lock.current)setOpen(false);}}><Modal.Container size="lg" scroll="inside"><Modal.Dialog className="pi-goal-dialog" data-testid="pi-goal-dialog">
   <Modal.Header><Modal.Heading>{terminal?'设置持续目标':'验收目标成果'}</Modal.Heading></Modal.Header>
   <Modal.Body>{terminal?<><label htmlFor="pi-goal-objective">希望完成什么</label><TextArea id="pi-goal-objective" data-testid="pi-goal-objective" value={objective} onChange={e=>setObjective(e.target.value)} rows={3} maxLength={4000} aria-label="持续目标"/>
    <label htmlFor="pi-goal-criteria">验收要求（每行一项，最多八项）</label><TextArea id="pi-goal-criteria" data-testid="pi-goal-criteria" value={criteria} onChange={e=>setCriteria(e.target.value)} rows={3} maxLength={3200} aria-label="目标验收要求"/>
    <p>小智会保存进度并持续推进。需要你的决定时等待确认；暂停与重启后保留进度，由你恢复。</p></>:<><p>{goal.objective}</p><pre data-testid="pi-goal-result">{goal.candidate}</pre><p>核对本轮成果后逐项确认：</p>{goal.criteria.map((text,i)=><Checkbox key={i} data-testid={`pi-goal-check-${i}`} isSelected={checked.includes(i)} onChange={value=>setChecked(items=>value?[...items.filter(v=>v!==i),i]:items.filter(v=>v!==i))}><Checkbox.Content><Checkbox.Control><Checkbox.Indicator/></Checkbox.Control><Label>{text}</Label></Checkbox.Content></Checkbox>)}</>}{notice&&<p role="alert">{notice}</p>}</Modal.Body>
   <Modal.Footer><Button variant="secondary" isDisabled={busy} onPress={()=>setOpen(false)}>取消</Button>{terminal?<Button data-testid="pi-goal-create" isDisabled={busy||disabled||running||!objective.trim()||!criteria.trim()||criteria.split('\n').filter(v=>v.trim()).length>8||criteria.split('\n').some(v=>v.trim().length>400)} onPress={()=>void mutate({schemaVersion:1,action:'create',sessionId,id:createId.current,revision:0,objective:objective.trim(),criteria:criteria.split('\n').map(v=>v.trim()).filter(Boolean)})}>开始目标</Button>:<Button data-testid="pi-goal-accept" isDisabled={busy||running||checked.length!==goal.criteria.length} onPress={()=>action('accept')}>确认完成</Button>}</Modal.Footer>
  </Modal.Dialog></Modal.Container></Modal.Backdrop>}
 </>;
}
