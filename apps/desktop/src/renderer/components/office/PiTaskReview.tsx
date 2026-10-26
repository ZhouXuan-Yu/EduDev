import {useEffect,useRef,useState} from 'react';
import {Button,Checkbox,Label,TextArea} from '@heroui/react';
import {ClipboardCheck,ChevronDown} from 'lucide-react';
import {TASK_SCHEMA,TASK_API_ERRORS,validTaskView,validTaskCandidate,type TaskView,type TaskSnapshot,type TaskReviewInput,type TaskCorrectionInput} from '../../../shared/xiaozhi-task';
import {useOfficeSynchronization} from './OfficeSynchronization';
import './pi-task-review.css';
import {PiTaskSteps} from './PiTaskSteps';
import {XIAOZHI_ERRORS} from '../../../shared/xiaozhi-projection';

type RequirementDraft={key:string;id?:string;text:string};
const requirementDrafts=(criteria:TaskView['criteria']):RequirementDraft[]=>criteria.filter(c=>c.kind==='human').map(c=>({key:c.id,id:c.id,text:c.text}));
const labels:Record<TaskView['state'],string>={active:'执行中',review_required:'待你核对',paused:'需要重新核对',interrupted:'本轮未完成',completed:'你已确认',ended:'已结束'};
/** Human acceptance of this request. Legacy plan progress remains a proposal. */
export function PiTaskReview({sessionId,task,running,onRefresh}:{sessionId:string;task:TaskView;running:boolean;onRefresh:()=>Promise<void>}){
 const sync=useOfficeSynchronization(),alive=useRef(true),lock=useRef(false),attempt=useRef<{fingerprint:string;requestId:string}|undefined>(undefined);
 const resumeAttempt=useRef<{scope:string;commandId:string}|undefined>(undefined);
 const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[data,setData]=useState<TaskSnapshot>(),[selected,setSelected]=useState<string[]>([]),[editing,setEditing]=useState(false),[drafts,setDrafts]=useState<RequirementDraft[]>([]);
 const identity=`${sessionId}:${task.id}`,live=useRef({identity,revision:task.revision,ticket:0});
 if(live.current.identity!==identity)live.current={identity,revision:task.revision,ticket:live.current.ticket+1};else live.current.revision=task.revision;
 useEffect(()=>{alive.current=true;lock.current=false;attempt.current=undefined;setBusy(false);setOpen(false);setNotice('');setData(undefined);setSelected([]);setEditing(false);setDrafts([]);return()=>{alive.current=false;live.current.ticket++;};},[identity]);
 function requestIsCurrent(ticket:number){return alive.current&&live.current.identity===identity&&live.current.ticket===ticket;}
 function validSnapshot(value:TaskSnapshot):value is TaskSnapshot&{task:TaskView}{return value&&validTaskView(value.task)&&value.task.id===task.id&&value.task.sessionId===sessionId&&value.task.revision>=live.current.revision&&typeof value.canAccept==='boolean'&&(value.canResume===undefined||typeof value.canResume==='boolean')&&(value.candidate===undefined||validTaskCandidate(value.candidate));}
 const valid=validTaskView(task)&&task.sessionId===sessionId,view=data?.task&&validTaskView(data.task)&&data.task.id===task.id&&data.task.revision>=task.revision?data.task:task;
 const current=Boolean(data?.task?.id===task.id&&data.task.revision===task.revision),human=view.criteria.filter(c=>c.kind==='human'),blocked=running||sync.blocked||busy||!current;
 const crossRun=Boolean(view.lastRunId&&view.lastRunId!==view.origin.runId),scopeKind=crossRun?'cross_run':'single_run';
 const scope=`${task.id}:${task.requirementsVersion}:${task.revision}`,[checkedScope,setCheckedScope]=useState(scope),checked=checkedScope===scope?selected:[];
 async function load(){
  if(lock.current)return;const ticket=++live.current.ticket;lock.current=true;setBusy(true);setNotice('');setData(undefined);setSelected([]);setCheckedScope(scope);setEditing(false);
  try{const result=await window.omniEdu?.getXiaozhiTask({sessionId});if(!requestIsCurrent(ticket))return;
   if(!result?.ok){setNotice(result?TASK_API_ERRORS[result.error]:'核对入口暂不可用，请重试。');return;}
   if(!validSnapshot(result.value)){setNotice(TASK_API_ERRORS.changed);return;}
   setData(result.value);setDrafts(requirementDrafts(result.value.task.criteria));await onRefresh();
  }catch{if(requestIsCurrent(ticket))setNotice('未能读取核对记录，请重试。');}finally{if(requestIsCurrent(ticket)){lock.current=false;setBusy(false);}}
 }
 async function mutate(kind:'review'|'correct',accepted=false){
  if(lock.current||running||sync.isBlocked()||!current)return;
  if(kind==='review'&&!data?.candidate)return;
  if(kind==='review'&&accepted&&(!data?.canAccept||!human.length||human.some(c=>!checked.includes(c.id))))return;
  const payload=kind==='review'?{candidate:data!.candidate!,checked:human.map(c=>({criterionId:c.id,version:c.version,accepted}))}:{criteria:drafts.map(c=>({...(c.id?{id:c.id}:{}),text:c.text}))};
  const base={schema:TASK_SCHEMA,sessionId,taskId:view.id,revision:view.revision,requirementsVersion:view.requirementsVersion},fingerprint=JSON.stringify([kind,base,payload]);
  if(attempt.current?.fingerprint!==fingerprint)attempt.current={fingerprint,requestId:`xitact_${crypto.randomUUID()}`};
  const ticket=++live.current.ticket;lock.current=true;setBusy(true);setNotice('');
  try{const input={...base,requestId:attempt.current.requestId,...payload};const result=kind==='review'?await window.omniEdu?.reviewXiaozhiTask(input as TaskReviewInput):await window.omniEdu?.correctXiaozhiTask(input as TaskCorrectionInput);
   if(!requestIsCurrent(ticket))return;
   if(!result?.ok){setNotice(result?TASK_API_ERRORS[result.error]:'操作结果未确认，请重新读取。');return;}
   if(!validSnapshot(result.value)){setData(undefined);setNotice(TASK_API_ERRORS.changed);return;}
   setData(result.value);setSelected([]);setEditing(false);attempt.current=undefined;setNotice(kind==='correct'?'要求已保存，旧核对结论已失效。':accepted?'已记录你的确认。':'已记录需要修改，尚未确认完成。');await onRefresh();
  }catch{if(requestIsCurrent(ticket))setNotice('操作结果尚未确认，请重新读取后核对。');}finally{if(requestIsCurrent(ticket)){lock.current=false;setBusy(false);}}
 }
 async function resume(){
  if(lock.current||running||sync.isBlocked()||!current||!data?.canResume)return;
  const base={schema:TASK_SCHEMA,sessionId,taskId:view.id,revision:view.revision,requirementsVersion:view.requirementsVersion},key=JSON.stringify(base);
  if(resumeAttempt.current?.scope!==key)resumeAttempt.current={scope:key,commandId:`xicmd_${crypto.randomUUID()}`};
  const ticket=++live.current.ticket;lock.current=true;setBusy(true);setNotice('');
  try{const result=await window.omniEdu?.resumeXiaozhiTask({...base,commandId:resumeAttempt.current.commandId});
   if(!requestIsCurrent(ticket))return;
   if(!result?.ok){setNotice(result?XIAOZHI_ERRORS[result.error]:'恢复结果尚未确认，请重新读取后核对。');return;}
   setNotice('已恢复剩余步骤，先重新核对已有来源和保存结果。');await onRefresh();
  }catch{if(requestIsCurrent(ticket))setNotice('恢复结果尚未确认，请重新读取后核对。');}finally{if(requestIsCurrent(ticket)){lock.current=false;setBusy(false);}}
 }
 if(!valid)return <p role="alert">要求记录无法核对，请重新读取。</p>;
 return <section className="pi-task-review" data-testid="pi-task-review" data-task-id={task.id} data-state={task.state} data-revision={task.revision} data-scope={scopeKind}>
  <Button variant="ghost" size="sm" className="pi-task-review-toggle" data-testid="pi-task-review-toggle" aria-expanded={open} onPress={()=>{setOpen(v=>!v);if(!open)void load();}}><ClipboardCheck size={16}/><span>{task.goal?'核对目标成果':task.lastRunId?'核对任务成果':'核对本轮回复'}</span><span className="pi-task-review-status">{labels[task.state]}</span><ChevronDown size={14}/></Button>
  {open&&<div className="pi-task-review-body">
   <p className="pi-task-review-status" data-testid="pi-task-review-scope" data-scope={scopeKind}>{crossRun?'确认范围：同一任务的多轮累计成果。每轮自己的核验记录仍保留在对应回复中；本次确认不会重新执行旧工具。':'确认范围：当前任务的本次执行。后续继续任务时会重新读取来源和现有成果。'}</p>
   <p>{task.goal?'逐项核对你设置的目标要求。系统核对来源与保存结果，教学内容由你确认。':task.lastRunId?'按原任务要求核对成果。已保存步骤会重新核对，继续操作不会复用旧的保存批准。':'按本轮原始请求核对成果。这里记录你的确认；计划中的步骤进度仍须分别核验。'}</p>
   <p className="pi-task-review-status">要求版本 {view.requirementsVersion} · {new Date(view.updatedAt).toLocaleString()}</p>
   <PiTaskSteps task={view}/>
   {busy&&<p role="status">正在核对记录…</p>}
   {sync.blocked&&<p role="status">过程记录正在同步，暂时不能确认或修改。</p>}
   {!current&&data&&<p role="status">记录已变化，请重新读取后核对。</p>}
   {editing?<div className="pi-task-requirements-editor" data-testid="pi-task-requirements-editor">
    <p className="pi-task-review-status">可添加或撤回教学要求，至少保留一项，最多八项。保存后旧确认失效，需要按新要求重新核对。</p>
    {drafts.map((c,i)=><div key={c.key} className="pi-task-review-field">
     <label>要求 {i+1}<TextArea value={c.text} onChange={e=>setDrafts(items=>items.map(row=>row.key===c.key?{...row,text:e.target.value}:row))} disabled={blocked} maxLength={400} rows={3} aria-label="修正本轮要求" data-testid="pi-task-review-requirement"/></label>
     <div className="pi-task-review-actions"><Button size="sm" variant="ghost" isDisabled={blocked||i===0} aria-label={`上移第${i+1}项要求`} data-testid="pi-task-review-move" onPress={()=>setDrafts(items=>{const index=items.findIndex(row=>row.key===c.key);if(index<1)return items;const rows=[...items];[rows[index-1],rows[index]]=[rows[index],rows[index-1]];return rows;})}>上移</Button><Button size="sm" variant="ghost" isDisabled={blocked||drafts.length<=1} aria-label={`移除第${i+1}项要求`} data-testid="pi-task-review-remove" onPress={()=>setDrafts(items=>items.length>1?items.filter(row=>row.key!==c.key):items)}>移除要求</Button></div>
    </div>)}
    <Button size="sm" variant="ghost" isDisabled={blocked||drafts.length>=8} onPress={()=>setDrafts(items=>items.length<8?[...items,{key:crypto.randomUUID(),text:''}]:items)} data-testid="pi-task-review-add">添加要求</Button>
   </div>:human.map(c=>task.state==='completed'&&view.checks.some(k=>k.criterionId===c.id&&k.authority==='teacher'&&k.state==='passed')?<p key={c.id} className="pi-task-review-confirmed" data-testid="pi-task-review-confirmed"><ClipboardCheck size={16} aria-hidden="true"/><span>{c.text}</span><span className="pi-task-review-status">已确认</span></p>:!data?.candidate||!data.canAccept?<p key={c.id} data-testid="pi-task-review-unavailable-requirement">{c.text}</p>:<Checkbox key={c.id} isSelected={checked.includes(c.id)} isDisabled={blocked||task.state==='completed'} onChange={value=>{setCheckedScope(scope);setSelected(items=>value?[...items.filter(id=>id!==c.id),c.id]:items.filter(id=>id!==c.id));}} data-testid="pi-task-review-check"><Checkbox.Content><Checkbox.Control><Checkbox.Indicator/></Checkbox.Control><Label>{c.text}</Label></Checkbox.Content></Checkbox>)}
   {!editing&&task.state!=='completed'&&data&&!data.canAccept&&<p className="pi-task-review-status">本轮尚不能确认完成；可查看上方未完成项或修正要求。</p>}
   <div className="pi-task-review-actions">
    <Button size="sm" variant="ghost" isDisabled={busy} onPress={()=>void load()} data-testid="pi-task-review-refresh">重新读取</Button>
    {!editing&&data?.canResume&&<Button size="sm" variant="secondary" isDisabled={blocked} onPress={()=>void resume()} data-testid="pi-task-resume">继续剩余步骤</Button>}
    {editing?<><Button size="sm" variant="ghost" isDisabled={busy} onPress={()=>setEditing(false)}>取消修改</Button><Button size="sm" isDisabled={blocked||!drafts.length||drafts.some(c=>!c.text.trim())||JSON.stringify(drafts.map(c=>[c.id,c.text]))===JSON.stringify(human.map(c=>[c.id,c.text]))} onPress={()=>void mutate('correct')} data-testid="pi-task-review-save">保存要求</Button></>:<>
     <Button size="sm" variant="ghost" isDisabled={blocked||!data?.candidate||task.state==='completed'} onPress={()=>void mutate('review',false)} data-testid="pi-task-review-reject">需要修改</Button>
     <Button size="sm" isDisabled={blocked||!data?.candidate||!data.canAccept||task.state==='completed'||checked.length!==human.length} onPress={()=>void mutate('review',true)} data-testid="pi-task-review-accept">确认符合要求</Button>
     <Button size="sm" variant="ghost" isDisabled={blocked||task.state==='ended'} onPress={()=>{setDrafts(requirementDrafts(human));setEditing(true);}} data-testid="pi-task-review-edit">修正要求</Button>
    </>}
   </div>
   {view.reviewVerification&&<p className="pi-task-review-status" data-testid="pi-task-review-readback">确认时重新核对了来源与保存记录。教学内容的确认由你作出。</p>}
  </div>}
  {notice&&<p role="status" className="pi-task-review-notice" data-testid="pi-task-review-notice">{notice}</p>}
 </section>;
}
