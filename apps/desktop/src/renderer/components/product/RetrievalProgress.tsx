import {useEffect,useState} from 'react';
import {RETRIEVAL_SCHEMA,type RetrievalStatus} from '../../../shared/retrieval';
export function RetrievalProgress(){
  const [state,setState]=useState<RetrievalStatus>(),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  useEffect(()=>{let live=true,pending=false;const poll=async()=>{if(pending)return;pending=true;try{const s=await window.omniEdu?.getRetrievalStatus();if(live&&s)setState(s);}catch{if(live)setError('智能检索状态暂不可读取，关键词检索仍可使用。');}finally{pending=false;}};void poll();const timer=setInterval(()=>void poll(),1500);return()=>{live=false;clearInterval(timer);};},[]);
  async function action(action:'pause'|'resume'|'rebuild'){setBusy(true);setError('');try{await window.omniEdu!.controlRetrieval({schemaVersion:RETRIEVAL_SCHEMA,action});setState(await window.omniEdu!.getRetrievalStatus());}catch{setError('未完成操作，请确认没有另一个小智窗口正在整理索引，再重试。');}finally{setBusy(false);}}
  return <section className="material-batches" data-testid="retrieval-progress"><h2>本地智能检索</h2><p>按题意与知识点查找资料、相似题，模型和索引都在本机，无需上传资料。题意接近不代表答案正确或可以直接组卷。</p>
    {state&&<><p role="status" data-testid="retrieval-status">{state.paused?'后台整理已暂停':state.phase==='building'?state.generation?'正在重建，已有索引继续可用':'正在为已有资料建立题意索引':state.phase==='ready'?'题意检索可用':'正在准备本地模型'} · {state.indexed} 条可用内容 · {state.pending} 项变更待处理{state.failed?` · ${state.failed} 项暂未纳入语义检索`:''}</p>
      {state.error&&<p role="note">{state.error==='index_busy'?'另一个小智窗口正在使用索引。':state.error==='index_disk_full'?'索引所在磁盘空间不足，请释放空间后继续。':state.error==='generation_mismatch'?'本地模型或索引版本已变化，请重建题意索引。':'本地语义检索暂不可用。'}可继续用关键词查找；恢复后会接着整理。</p>}
      {state.maintenance&&<p role="note" data-testid="retrieval-maintenance">{state.maintenance.phase==='running'?'正在优化检索速度与索引占用，已有内容继续可查。':state.maintenance.phase==='retry_pending'?state.maintenance.error==='index_disk_full'?'优化所需临时空间不足；现有内容仍可查，释放空间后自动重试。':'索引优化未完成；现有内容仍可查，稍后自动接续。':state.maintenance.mode==='ivf_flat'?'大型资料索引已启用加速检索。':'索引按当前资料量自动维护。'}</p>}
      <div className="teacher-library-toolbar"><button className="secondary-action" data-testid="retrieval-toggle" disabled={busy} onClick={()=>void action(state.paused?'resume':'pause')}>{state.paused?'继续后台整理':'暂停后台整理'}</button><button className="secondary-action" data-testid="retrieval-rebuild" disabled={busy||!!state.building} onClick={()=>void action('rebuild')}>重建题意索引</button></div></>}
    {error&&<p role="alert">{error}</p>}
  </section>;
}
