import {useEffect,useState} from 'react';
import {Button} from '@heroui/react';
import {FilePenLine} from 'lucide-react';
import {ChatTool} from '../../heroui-pro/components/chat-tool';
import {QuestionMathText} from '../QuestionMathText';
import {useDesktopNavigation} from '../desktop/DesktopFrame';
import {useOfficeControlState} from './OfficeComposerState';
import {HANDOUT_EDIT_SCHEMA,type HandoutEditDecision,type HandoutEditReview,type HandoutEditStatus,
  type HandoutEditSummary} from '../../../shared/teaching-handout-edit';
import styles from '../../ui-system/handout-edit.module.css';

const labels:Record<HandoutEditStatus,string>={pending:'等待核对修改',applied:'已保存为草稿',rejected:'已拒绝',
  conflict:'讲义或资料已变化',interrupted:'审阅已中断'};

export function PiTeachingHandoutEdit({summary,sessionId,enabled,onRefresh}:{
  summary:HandoutEditSummary;sessionId:string;enabled:boolean;onRefresh:()=>Promise<void>;
}) {
  const nav=useDesktopNavigation();
  const {draft,update,lock}=useOfficeControlState('handout-edit:'+summary.id);
  const [expanded,setExpanded]=useState(summary.state==='pending'),[review,setReview]=useState<HandoutEditReview>();
  const [reading,setReading]=useState(false),[generation,retry]=useState(0);
  const pending=summary.state==='pending';
  const ready=review?.summary.fingerprint===summary.fingerprint&&review.summary.state===summary.state;
  useEffect(()=>{
    if(!expanded)return;
    const api=window.omniEdu;
    if(!api){update({error:'无法读取讲义差异，请重试。'});return;}
    let live=true;
    setReading(true);
    void api.reviewHandoutEdit({schemaVersion:HANDOUT_EDIT_SCHEMA,sessionId,id:summary.id}).then(result=>{
      if(!live)return;
      if(result.ok&&result.value.summary.fingerprint===summary.fingerprint){
        setReview(result.value);
      }else update({error:result.ok?'这份修改预览已过期，请重新读取。':result.message});
    }).catch(()=>{if(live)update({error:'无法读取讲义差异，请重试。'});})
      .finally(()=>{if(live)setReading(false);});
    return()=>{live=false;};
  },[expanded,sessionId,summary.id,summary.fingerprint,summary.state,generation]);

  async function decide(action:HandoutEditDecision['action']){
    if(lock.current||!pending||!enabled||action==='approve'&&(!ready||reading))return;
    lock.current=true;
    update({busy:true,error:''});
    try{
      const result=await window.omniEdu?.decideHandoutEdit({schemaVersion:HANDOUT_EDIT_SCHEMA,sessionId,id:summary.id,
        fingerprint:summary.fingerprint,action});
      if(!result?.ok)update({error:result?.message||'这次决定未提交，请重试。'});
      await onRefresh();
    }catch{update({error:'暂时无法核对保存状态，请刷新后查看。'});}
    finally{lock.current=false;update({busy:false});}
  }
  const state=pending?'requires-action':summary.state==='applied'?'output-available':'output-error';
  return <ChatTool state={state} isExpanded={expanded} onExpandedChange={setExpanded}
    className="pi-copy-approval pi-handout-edit" data-testid="pi-handout-edit" data-state={summary.state} data-book-id={summary.bookId}>
    <ChatTool.Trigger><FilePenLine size={16}/><strong>{summary.title}</strong><span>{summary.count} 处修改</span><span>{labels[summary.state]}</span></ChatTool.Trigger>
    <ChatTool.Content>
      {reading?<p role="status">正在读取讲义差异…</p>:ready&&<ol className={styles.diffs} tabIndex={0} aria-label="讲义修改前后对照" data-testid="pi-handout-edit-diffs">
        {review.diffs.map((diff,index)=><li key={index}>
          <h4>{diff.location} · {diff.field}</h4>
          <div className={styles.comparison}>
            <div><h5>修改前</h5><QuestionMathText text={diff.before||'（空）'}/></div>
            <div><h5>修改后</h5><QuestionMathText text={diff.after||'（空）'}/></div>
          </div>
        </li>)}
      </ol>}
      {pending&&<p>应用后保存为讲义草稿。请在讲义中确认新版本后再导出。</p>}
      {summary.version&&<p>第 {summary.version.revision} 版草稿已保存。修改前的正文可从讲义历史恢复。</p>}
      {summary.state==='conflict'&&<p role="status">本次建议未应用。请重新打开讲义核对后再修改。</p>}
      {summary.state==='interrupted'&&<p role="status">本次建议未应用。可在原对话再次提出修改。</p>}
      {pending&&<ChatTool.Approval><ChatTool.ApprovalActions>
        <ChatTool.Approve isDisabled={!enabled||!ready||reading||draft.busy} onPress={()=>void decide('approve')} data-testid="pi-handout-edit-approve">应用修改</ChatTool.Approve>
        <ChatTool.Reject isDisabled={!enabled||draft.busy} onPress={()=>void decide('reject')} data-testid="pi-handout-edit-reject">拒绝</ChatTool.Reject>
      </ChatTool.ApprovalActions></ChatTool.Approval>}
      {draft.busy&&<p role="status">正在提交决定…</p>}
      {draft.error&&<p role="alert">{draft.error} <Button size="sm" variant="ghost" onPress={()=>{
        update({error:''});retry(value=>value+1);void onRefresh();
      }}>重新读取</Button></p>}
      {!pending&&<Button size="sm" variant="secondary" onPress={()=>nav.navigate({view:'book',bookId:summary.bookId})}
        data-testid="pi-handout-edit-open">打开讲义</Button>}
    </ChatTool.Content>
  </ChatTool>;
}
