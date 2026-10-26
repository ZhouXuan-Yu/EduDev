import {useEffect,useRef,useState} from 'react';
import {Button} from '@heroui/react';
import {PLAN_HISTORY_ERRORS,validPlanHistoryPage,type PlanHistoryPage,type VersionedPlan} from '../../../shared/xiaozhi-plan';
import {xiaozhiToolLabel} from '../../../shared/xiaozhi-projection';

type Record=PlanHistoryPage['records'][number];
function StepSnapshot({plan}:{plan:VersionedPlan}){
 return <ol>{plan.steps.map(s=><li key={s.id}><span>{s.text} · {s.status==='completed'?'报告完成':s.status==='in_progress'?'报告进行中':'待处理'}</span>{s.dependsOn.length>0&&<small>前置：{s.dependsOn.map(id=>plan.steps.find(p=>p.id===id)!.text).join('、')}</small>}</li>)}</ol>;
}
/** Read-only committed revisions. Opening or locating a record never executes a tool. */
export function PiPlanHistory({sessionId,plan}:{sessionId:string;plan:VersionedPlan}){
 const [open,setOpen]=useState(false),[records,setRecords]=useState<Record[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[hasMore,setHasMore]=useState(false),[notice,setNotice]=useState('');
 const lock=useRef(false),epoch=useRef(0),requestedRevision=useRef(0),root=useRef<HTMLDetailsElement>(null);
 useEffect(()=>()=>{epoch.current++;},[sessionId,plan.id]);
 async function load(beforeSequence?:number){
  if(lock.current)return;const stamp=epoch.current;lock.current=true;setBusy(true);setError('');
  const input={sessionId,runId:plan.runId,planId:plan.id,limit:8,...(beforeSequence?{beforeSequence}:{})};
  try{
   const result=await window.omniEdu?.getXiaozhiPlanHistory(input);if(stamp!==epoch.current)return;
   if(!result?.ok){setError(result?PLAN_HISTORY_ERRORS[result.error]:'计划记录读取未完成，请重试。');return;}
   if(!validPlanHistoryPage(result.value,input)||result.value.legacy){setError('计划记录与当前版本不一致，请重新读取。');return;}
   setRecords(previous=>[...new Map([...previous,...result.value.records].map(row=>[row.control.plan.revision,row])).values()].sort((a,b)=>b.cursor.sequence-a.cursor.sequence));
   setHasMore(result.value.hasMore);
  }catch{if(stamp===epoch.current)setError('计划记录暂时无法读取，请重试。');}
  finally{lock.current=false;if(stamp===epoch.current)setBusy(false);}
 }
 useEffect(()=>{if(open&&!busy&&!error&&requestedRevision.current<plan.plan.revision){requestedRevision.current=plan.plan.revision;void load();}},[open,busy,error,plan.plan.revision]);
 function locate(callId:string){
  const turn=root.current?.closest('.office-turn'),node=turn?.querySelector<HTMLElement>(`[data-item-id="${CSS.escape(callId)}"]`);
  if(!node){setNotice('关联操作未包含在当前记录中。');return;}
  node.scrollIntoView({block:'center',behavior:'auto'});node.querySelector<HTMLElement>('[data-slot="chat-tool-trigger"],[data-slot="chain-of-thought-trigger"]')?.focus({preventScroll:true});setNotice('已定位到本轮关联操作。');
 }
 return <details ref={root} className="pi-plan-history" data-testid="pi-plan-history" onToggle={e=>setOpen(e.currentTarget.open)}>
  <summary>查看计划调整记录</summary><p>这里只读取已保存的公开建议与宿主采用记录；步骤进度仍需独立核验。</p>
  {busy&&<p role="status">正在读取计划记录…</p>}{error&&<p role="alert" data-testid="pi-plan-history-error">{error}</p>}
  {error&&<Button size="sm" variant="ghost" onPress={()=>void load()} isDisabled={busy}>重新读取计划记录</Button>}
  {!busy&&!error&&!records.length&&open&&<p>尚未找到已提交的调整记录。</p>}
  {records.map((record,index)=>{const current=record.control,previous=records[index+1]?.control,adjacent=previous?.plan.revision===current.plan.previousRevision;return <section className="pi-plan-revision" key={current.plan.revision} data-testid="pi-plan-revision" data-revision={current.plan.revision}>
   <h4>第 {current.plan.revision} 版 · 已采用计划结构</h4><p><time dateTime={current.plan.changedAt}>{new Date(current.plan.changedAt).toLocaleString()}</time> · 小智公开建议</p><p data-testid="pi-plan-reason">调整说明：{current.plan.reason}</p>
   {current.plan.basis.length>0&&<ul aria-label="调整关联的实际操作">{current.plan.basis.map(b=><li key={b.callId}>{xiaozhiToolLabel(b.tool)} · {b.outcome==='succeeded'?'工具返回成功':b.outcome==='not_delivered'?'未交付执行':'工具返回失败'}<Button size="sm" variant="ghost" onPress={()=>locate(b.callId)}>定位关联操作</Button></li>)}</ul>}
   <details data-testid="pi-plan-comparison"><summary>查看调整前后</summary><section aria-label="调整前"><strong>调整前</strong>{current.plan.previousRevision===0?<p>首次建立计划。</p>:adjacent?<StepSnapshot plan={previous}/>:<><p>上一版尚未载入，暂时无法比较。</p><Button size="sm" variant="ghost" isDisabled={busy} onPress={()=>void load(record.cursor.sequence)}>载入上一版</Button></>}</section><section aria-label="调整后"><strong>调整后</strong><StepSnapshot plan={current}/></section></details>
   <details className="pi-plan-record-identity"><summary>查看记录标识</summary><p>计划版本 {current.plan.revision}，记录序号 {record.cursor.sequence}，代次 {record.cursor.generation}。</p></details>
  </section>;})}
  {hasMore&&records.length>0&&<Button size="sm" variant="ghost" isDisabled={busy} onPress={()=>void load(records.at(-1)!.cursor.sequence)} data-testid="pi-plan-history-more">读取更早记录</Button>}
  {notice&&<p role="status">{notice}</p>}
 </details>;
}
