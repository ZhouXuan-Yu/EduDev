import {useEffect,useState} from 'react';
import {Button} from '@heroui/react';
import {ClipboardCheck} from 'lucide-react';
import {ChatTool} from '../../heroui-pro/components/chat-tool';
import {useOfficeControlState} from './OfficeComposerState';
import {LEARNING_REVIEW_SCHEMA,LEARNING_REVIEW_ERRORS,validLearningDraft,type LearningReviewSummary,type LearningReviewView,type LearningReviewDraft} from '../../../shared/learning-review';
import './pi-learning-review.css';
import {learningSourcePreview} from '../../../shared/learning-source-preview';
import {StudentSourceLink} from '../students/StudentSourceNavigation';
import {PiTrainingPlan} from './PiTrainingPlan';
const labels={pending:'需要你核对',confirmed:'已确认保存',rejected:'已拒绝，未生效'};
/** Reuses the current ChatTool approval and session-keyed editable form state. */
export function PiLearningReview({sessionId,review,onRefresh}:{sessionId:string;review:LearningReviewSummary;onRefresh:()=>Promise<void>}){
 const {draft:updateState,update,lock}=useOfficeControlState(`learning:${review.id}`),[view,setView]=useState<LearningReviewView>();
 const [loading,setLoading]=useState(true);
 useEffect(()=>{let live=true;setLoading(true);void window.omniEdu?.reviewXiaozhiLearning({schemaVersion:LEARNING_REVIEW_SCHEMA,sessionId,id:review.id}).then(result=>{
  if(!live)return;if(result?.ok){setView(result.value);if(!updateState.learningDraft)update({learningDraft:result.value.draft});}else update({error:result?LEARNING_REVIEW_ERRORS[result.error]:'无法读取待核对建议，请重试。'});
 }).catch(()=>{if(live)update({error:'无法读取待核对建议，请重试。'});}).finally(()=>{if(live)setLoading(false);});return()=>{live=false;};},[sessionId,review.id,review.state]);
 const draft=updateState.learningDraft||view?.draft,pending=review.state==='pending';
 const setDraft=(value:LearningReviewDraft)=>update({learningDraft:value,error:''});
 async function decide(action:'confirm'|'reject'){
  if(lock.current)return;if(action==='confirm'&&!validLearningDraft(draft)){update({error:'请填写核对说明，并检查结果与复习参数。'});return;}
  lock.current=true;update({busy:true,error:''});
  try{const result=await window.omniEdu?.decideXiaozhiLearning({schemaVersion:LEARNING_REVIEW_SCHEMA,sessionId,id:review.id,action,...(action==='confirm'?{draft}: {})});if(!result?.ok)update({error:result?LEARNING_REVIEW_ERRORS[result.error]:'确认请求没有送达，请重试。'});await onRefresh();}
  catch{update({error:'确认没有完成，请刷新后重试。'});}finally{lock.current=false;update({busy:false});}
 }
 return <ChatTool state={pending?'requires-action':review.state==='confirmed'?'output-available':'output-error'} defaultExpanded={pending} className="pi-learning-review" data-testid="pi-learning-review" data-review-id={review.id} data-state={review.state}>
  <ChatTool.Trigger><ClipboardCheck size={16}/><strong>{review.kind==='assessment'?'核对学习结果':draft?.kind==='strategy'&&draft.plan?'核对两周训练计划':'调整复习节奏'}</strong><span>{labels[review.state]}</span></ChatTool.Trigger>
  <ChatTool.Content>
   {loading&&<p role="status">正在读取本地证据…</p>}
   {view?.source&&<details open className="pi-learning-source"><summary>原学习证据 · {view.source.subject} · {view.source.title}</summary><p>{new Date(view.source.occurredAt).toLocaleString('zh-CN')}</p><pre data-testid="learning-review-source">{learningSourcePreview(view.source.content)}</pre></details>}
   {view?.planSources&&<ul aria-label="训练计划依据">{view.planSources.map(s=><StudentSourceLink key={s.reference.recordId} source={{kind:'read',title:s.title,student:s.reference}}/>)}</ul>}
   {view?.planCurrent===false&&<p role="status">学习证据或复习策略已变化，这是当时保存的计划，请重新分析后再安排训练。</p>}
   {view?.heuristic&&<p data-testid="learning-review-heuristic">本地参考评分：{view.heuristic.isCorrect?'答案匹配':'答案未匹配'}。这是启发式建议，请核对学生作答与参考答案后决定。</p>}
   <p>原学习记录保留。请核对建议后保存；校正不会增加练习次数。</p>
   {pending&&draft&&<fieldset disabled={updateState.busy} className="pi-learning-fields">
    {draft.kind==='strategy'&&draft.plan&&<PiTrainingPlan plan={draft.plan} onChange={plan=>setDraft({...draft,plan})}/>}
    {draft.kind==='assessment'?<>
     <label>学习结果<select data-testid="learning-review-result" value={draft.correction.result} onChange={e=>{const result=e.target.value as typeof draft.correction.result;setDraft({...draft,correction:{...draft.correction,result,errorType:result==='correct'?'none':draft.correction.errorType==='none'?'application':draft.correction.errorType}});}}><option value="correct">正确</option><option value="incorrect">错误</option><option value="partial">部分正确</option></select></label>
     <label>错因初步分类<select data-testid="learning-review-error-type" value={draft.correction.errorType} onChange={e=>setDraft({...draft,correction:{...draft.correction,errorType:e.target.value as typeof draft.correction.errorType}})}><option value="none">没有错误</option><option value="metacognitive">答题监控或遗漏</option><option value="application">理解与应用</option></select></label>
     <label>给学生的反馈<textarea data-testid="learning-review-feedback" maxLength={2000} value={draft.correction.feedback} onChange={e=>setDraft({...draft,correction:{...draft.correction,feedback:e.target.value}})}/></label>
    </>:<label>复习目标保留率（70%–99%）<input data-testid="learning-review-retention" type="number" min="70" max="99" step="1" value={Math.round(draft.desiredRetention*100)} onChange={e=>setDraft({...draft,desiredRetention:e.target.valueAsNumber/100})}/><small>当前：{Math.round((view?.previousRetention||.9)*100)}%。较高目标通常安排更早复习；这是算法估计。</small></label>}
    <label>核对说明<textarea data-testid="learning-review-reason" maxLength={1000} value={draft.reason} onChange={e=>setDraft({...draft,reason:e.target.value})}/></label>
   </fieldset>}
   {pending&&<ChatTool.Approval><ChatTool.ApprovalActions><Button data-testid="learning-review-confirm" isDisabled={loading||!view||updateState.busy} onPress={()=>void decide('confirm')}>确认并保存</Button><ChatTool.Reject data-testid="learning-review-reject" isDisabled={updateState.busy} onPress={()=>void decide('reject')}>拒绝</ChatTool.Reject></ChatTool.ApprovalActions></ChatTool.Approval>}
   {review.state==='confirmed'&&view?.draft.kind==='strategy'&&view.draft.plan&&<PiTrainingPlan plan={view.draft.plan}/>}
   {review.state==='confirmed'&&<p role="status">已保存第 {review.version} 版，后续学习分析将核验并使用这份结果。</p>}
   {updateState.busy&&<p role="status">正在保存核对结果…</p>}{updateState.error&&<p role="alert">{updateState.error}</p>}
  </ChatTool.Content>
 </ChatTool>;
}
