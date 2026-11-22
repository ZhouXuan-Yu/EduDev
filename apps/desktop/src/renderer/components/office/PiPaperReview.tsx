import {useState} from 'react';
import {Button,Modal} from '@heroui/react';
import {ClipboardCheck} from 'lucide-react';
import {ChatTool} from '../../heroui-pro/components/chat-tool';
import {PAPER_SCHEMA,PAPER_ERRORS,type PaperSummary,type PaperView} from '../../../shared/paper-blueprint';
import {PaperReviewPanel} from '../PaperReviewPanel';
import {PaperExportEntry} from '../PaperExportEntry';
import '../paper-workspace.css';
import {OfficeMutationBoundary} from './OfficeSynchronization';
import {paperReviewVersions} from './paper-review-versions';
export function PiPaperReview({sessionId,review,reviews=[],onRefresh,running=false,compact=false}:{sessionId:string;review:PaperSummary;reviews?:readonly PaperSummary[];running?:boolean;onRefresh:()=>Promise<void>;compact?:boolean}){
 const [view,setView]=useState<PaperView>(),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const {versions,latest,currentId}=paperReviewVersions(review,reviews);
 const edited=currentId!==review.id;
 const restoredIndex=versions.findIndex(version=>version.id===latest.restoredFrom);
 async function open(id=currentId){if(busy)return;setBusy(true);setError('');try{const r=await window.omniEdu?.reviewPaper({schemaVersion:PAPER_SCHEMA,sessionId,id});if(r?.ok)setView(r.value);else setError(r?PAPER_ERRORS[r.error]:'无法读取试卷，请重试。');}catch{setError('无法读取试卷，请重试。');}finally{setBusy(false);}}
 const historical=Boolean(view&&(view.id!==currentId||view.supersededBy));
 const restoreHead=historical&&latest.id===currentId&&latest.state==='confirmed'&&view?.id!==currentId?latest:undefined;
 const dialog=view&&<Modal.Backdrop isOpen onOpenChange={open=>{if(!open)setView(undefined);}}><Modal.Container size="lg" scroll="inside">
   <Modal.Dialog className="pi-themed-surface" data-testid="pi-paper-dialog" data-paper-id={view.id}>
    <Modal.Header><Modal.Heading>{historical?'历史版试卷':'试卷预览与核对'}</Modal.Heading></Modal.Header>
    <Modal.Body><OfficeMutationBoundary><PaperReviewPanel view={view} historical={historical} restoreHead={restoreHead} allowConfirm={!historical} onEditing={()=>setView(undefined)} onChanged={next=>{setView(next);void onRefresh();}}/>
      {!historical&&<PaperExportEntry view={view} selectedVersion disabled={busy||running} onPrepared={()=>setView(undefined)}/>}
    </OfficeMutationBoundary></Modal.Body>
    <Modal.Footer><Button variant="secondary" onPress={()=>setView(undefined)}>关闭</Button></Modal.Footer>
   </Modal.Dialog>
 </Modal.Container></Modal.Backdrop>;
 const action=<><Button variant={compact?'ghost':'secondary'} size={compact?'sm':undefined} data-testid={compact?'pi-context-paper-preview':'pi-paper-preview'} isDisabled={busy} onPress={()=>void open()}>
   {edited?'查看修改后的正式卷':compact?'查看蓝图、题目与答案':'预览并核对试卷'}</Button>
   {edited&&<details data-testid="pi-paper-versions"><summary>试卷版本</summary>
     {latest.restoredFrom&&<p data-testid="pi-paper-restored">当前修订从{restoredIndex===0?'原版':restoredIndex>0?`第 ${restoredIndex+1} 版`:'历史版本'}恢复。</p>}
     {versions.filter(version=>version.id!==currentId).map((version,index)=><Button key={version.id} size="sm" variant="ghost" isDisabled={busy}
       data-testid="pi-paper-history-open" data-paper-id={version.id} onPress={()=>void open(version.id)}>{index===0?'查看原版':`查看第 ${index+1} 版`}</Button>)}
   </details>}{error&&<p role="alert">{error}</p>}</>;
 if(compact)return <>{action}{dialog}</>;
 return <ChatTool className="pi-learning-review" data-testid="pi-paper-review" data-paper-id={review.id} data-current-paper-id={currentId} data-state={review.state} defaultExpanded={review.state==='pending'} state={review.state==='pending'?'requires-action':review.state==='confirmed'||edited?'output-available':'output-error'}>
   <ChatTool.Trigger><ClipboardCheck size={16}/><span>核对试卷</span><span>{latest.restoredFrom?'已保存恢复版':edited?'已保存编辑版':{pending:'需要你核对',confirmed:'已确认保存',rejected:'已拒绝'}[review.state]}</span></ChatTool.Trigger>
   <ChatTool.Content><p>{latest.title} · {latest.count}题 · {latest.totalPoints}分。{edited?'':latest.complete?'请在本机核对整卷后一次确认。':'题库不足，不能确认。'}参考答案未独立核验。</p>{action}</ChatTool.Content>{dialog}
 </ChatTool>;
}
