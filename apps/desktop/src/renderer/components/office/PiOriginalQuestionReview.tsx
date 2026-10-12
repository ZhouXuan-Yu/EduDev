import {useEffect,useRef,useState} from 'react';
import {Button} from '@heroui/react';
import {ClipboardCheck} from 'lucide-react';
import {ChatTool} from '../../heroui-pro/components/chat-tool';
import {useOfficeControlState} from './OfficeComposerState';
import {ORIGINAL_REVIEW_SCHEMA,validOriginalDraft,type OriginalQuestionDraft,type OriginalQuestionView} from '../../../shared/original-question-review';
import {QUESTION_REVIEW_ERRORS,type QuestionReviewSummary} from '../../../shared/question-review';
import './pi-learning-review.css';
import './pi-original-question.css';
import {PiOriginalMultiQuestionReview} from './PiOriginalMultiQuestionReview';
export function PiOriginalQuestionReview({sessionId,review,onRefresh}:{sessionId:string;review:QuestionReviewSummary;onRefresh:()=>Promise<void>}){
 return review.id.startsWith('xioriginalmulti_')?<PiOriginalMultiQuestionReview sessionId={sessionId} review={review} onRefresh={onRefresh}/>:<PiOriginalSingleQuestionReview sessionId={sessionId} review={review} onRefresh={onRefresh}/>;
}
function PiOriginalSingleQuestionReview({sessionId,review,onRefresh}:{sessionId:string;review:QuestionReviewSummary;onRefresh:()=>Promise<void>}){
 const {draft:state,update,lock}=useOfficeControlState(`original:${review.id}`),[view,setView]=useState<OriginalQuestionView>(),[loading,setLoading]=useState(true),[revision,setRevision]=useState(0),retained=useRef(state.originalDraft);retained.current=state.originalDraft;
 useEffect(()=>{let live=true;setLoading(true);void window.omniEdu?.reviewOriginalQuestion({schemaVersion:ORIGINAL_REVIEW_SCHEMA,sessionId,id:review.id}).then(r=>{if(!live)return;if(r?.ok){setView(r.value);if(!retained.current||review.state!=='pending')update({originalDraft:r.value.draft,error:''});}else update({error:r?QUESTION_REVIEW_ERRORS[r.error]:'原题读取未完成，请重试。'});}).catch(()=>{if(live)update({error:'原题读取未完成，请重试。'});}).finally(()=>{if(live)setLoading(false);});return()=>{live=false;};},[sessionId,review.id,review.state,revision]);
 const draft=state.originalDraft||view?.draft,pending=review.state==='pending';
 const change=(v:OriginalQuestionDraft)=>{retained.current=v;update({originalDraft:v,originalComplete:false,error:''});};
 async function decide(action:'confirm'|'reject'){if(lock.current)return;if(action==='confirm'&&(!validOriginalDraft(draft)||!state.originalComplete)){update({error:'请对照原图核对完整题面并勾选后保存。'});return;}lock.current=true;update({busy:true,error:''});try{const r=await window.omniEdu?.decideOriginalQuestion({schemaVersion:ORIGINAL_REVIEW_SCHEMA,sessionId,id:review.id,action,...(action==='confirm'?{draft,complete:true as const}:{})});if(!r?.ok)update({error:r?QUESTION_REVIEW_ERRORS[r.error]:'请求未送达，请重试。'});await onRefresh();}catch{update({error:'原题保存未完成，请重试。'});}finally{lock.current=false;update({busy:false});}}
 return <ChatTool className="pi-learning-review" data-testid="pi-original-review" data-review-id={review.id} data-state={review.state} defaultExpanded={pending} state={pending?'requires-action':review.state==='confirmed'?'output-available':'output-error'}>
  <ChatTool.Trigger><ClipboardCheck size={16}/><span>核对资料原题</span><span>{pending?'需要你核对':review.state==='confirmed'?'已保存原题':'已拒绝，未保存'}</span></ChatTool.Trigger>
  <ChatTool.Content><p>请对照原件检查全部条件、公式、题图与选项。转写可能有遗漏；保存题面不表示答案已经验证。</p>
   {loading&&<p role="status">正在读取本地原图…</p>}
   {view&&<><p>{view.sourceTitle} · 第 {view.image.page} 页 · 原图保存在本机</p><div className="pi-original-paper" tabIndex={0} aria-label="原题图"><img data-testid="original-review-image" src={view.image.dataUrl} alt={`第 ${view.image.page} 页原题区域`}/></div>{!view.sourceCurrent&&<p role="alert">原件已变化，候选不能保存；请拒绝后重新读取。</p>}</>}
   {draft&&<fieldset className="pi-learning-fields" disabled={!pending||loading||state.busy}>
    {(['title','subject','grade','knowledgePoint','questionType'] as const).map((field,i)=><label key={field}>{['题目名称','科目','年级','知识点','题型'][i]}<input data-testid={`original-review-${field}`} maxLength={field==='title'?160:128} value={draft[field]} onChange={e=>change({...draft,[field]:e.target.value})}/></label>)}
    <label>难度<select data-testid="original-review-difficulty" value={draft.difficulty} onChange={e=>change({...draft,difficulty:e.target.value as OriginalQuestionDraft['difficulty']})}><option value="easy">基础</option><option value="medium">标准</option><option value="hard">提高</option></select></label>
    <label>教师校正转写<textarea data-testid="original-review-stem" maxLength={12000} value={draft.stem} onChange={e=>change({...draft,stem:e.target.value})}/></label>
    <label>教师补充答案（没有可靠答案可留空）<textarea data-testid="original-review-answer" maxLength={8000} value={draft.answer} onChange={e=>change({...draft,answer:e.target.value})}/></label>
    <label>教师补充解析（可留空）<textarea data-testid="original-review-analysis" maxLength={12000} value={draft.analysis} onChange={e=>change({...draft,analysis:e.target.value})}/></label>
    <label className="pi-original-complete"><input type="checkbox" data-testid="original-review-complete" checked={!!state.originalComplete} onChange={e=>update({originalComplete:e.target.checked})}/>我已对照原图核对完整题面，包括条件、公式、图形和选项。</label>
   </fieldset>}
   {review.state==='confirmed'&&draft&&!draft.answer.trim()&&<p>答案尚未提供，不能用于需要标准答案的组卷。</p>}
   {state.error&&<p role="alert" data-testid="original-review-error">{state.error}</p>}
   <div className="toolbar-row"><Button variant="secondary" data-testid="original-review-retry" isDisabled={state.busy||loading} onPress={()=>{update({error:''});setRevision(x=>x+1);}}>重新读取</Button>{pending&&<><Button variant="secondary" data-testid="original-review-reject" isDisabled={state.busy} onPress={()=>void decide('reject')}>拒绝</Button><Button data-testid="original-review-confirm" isDisabled={state.busy||loading||!view?.sourceCurrent||!state.originalComplete} onPress={()=>void decide('confirm')}>确认题面并保存</Button></>}</div>
  </ChatTool.Content>
 </ChatTool>;
}
