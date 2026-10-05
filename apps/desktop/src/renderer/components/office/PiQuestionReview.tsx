import {useEffect,useRef,useState} from 'react';
import {Button} from '@heroui/react';
import {ClipboardCheck} from 'lucide-react';
import {ChatTool} from '../../heroui-pro/components/chat-tool';
import {useOfficeControlState} from './OfficeComposerState';
import {QuestionSourceLink} from './PiQuestionSource';
import {QUESTION_REVIEW_SCHEMA,QUESTION_REVIEW_ERRORS,validQuestionReviewDraft,type QuestionReviewSummary,type QuestionReviewView,type QuestionReviewDraft} from '../../../shared/question-review';
import './pi-learning-review.css';
const labels={pending:'需要你核对',confirmed:'已确认保存',rejected:'已拒绝，未保存'};
const typeLabels={choice:'选择题',concept:'判断题',fill_in_blank:'填空题',short_answer:'简答题',written:'书面作答',coding:'编程练习'};
/** The existing approval card and session-owned drafts; no second question workspace. */
export function PiQuestionReview({sessionId,review,onRefresh}:{sessionId:string;review:QuestionReviewSummary;onRefresh:()=>Promise<void>}){
 const {draft:state,update,lock}=useOfficeControlState(`question:${review.id}`),[view,setView]=useState<QuestionReviewView>(),[loading,setLoading]=useState(true),[revision,setRevision]=useState(0);
 const retained=useRef(state.questionDraft);retained.current=state.questionDraft;
 useEffect(()=>{let live=true;setLoading(true);void window.omniEdu?.reviewXiaozhiQuestions({schemaVersion:QUESTION_REVIEW_SCHEMA,sessionId,id:review.id}).then(result=>{if(!live)return;if(result?.ok){setView(result.value);if(!retained.current||review.state!=='pending'){retained.current=result.value.draft;update({questionDraft:result.value.draft});}}else update({error:result?QUESTION_REVIEW_ERRORS[result.error]:'无法读取题目，请重试。'});}).catch(()=>{if(live)update({error:'无法读取题目，请重试。'});}).finally(()=>{if(live)setLoading(false);});return()=>{live=false;};},[sessionId,review.id,review.state,revision]);
 const draft=state.questionDraft||view?.draft,pending=review.state==='pending';
 const change=(value:QuestionReviewDraft)=>{retained.current=value;update({questionDraft:value,error:''});};
 async function decide(action:'confirm'|'reject'){
  if(lock.current)return;if(action==='confirm'&&!validQuestionReviewDraft(draft)){update({error:QUESTION_REVIEW_ERRORS.invalid_input});return;}
  lock.current=true;update({busy:true,error:''});try{const result=await window.omniEdu?.decideXiaozhiQuestions({schemaVersion:QUESTION_REVIEW_SCHEMA,sessionId,id:review.id,action,...(action==='confirm'?{draft}:{})});if(!result?.ok)update({error:result?QUESTION_REVIEW_ERRORS[result.error]:'确认请求未送达，请重试。'});await onRefresh();}catch{update({error:'保存未完成，请重试。'});}finally{lock.current=false;update({busy:false});}
 }
 const itemChange=(index:number,fields:Partial<QuestionReviewDraft['items'][number]>)=>{const current=retained.current||draft;if(current)change({...current,items:current.items.map((q,i)=>i===index?{...q,...fields}:q)});};
 return <ChatTool className="pi-learning-review" data-testid="pi-question-review" data-review-id={review.id} data-state={review.state} defaultExpanded={pending} state={pending?'requires-action':review.state==='confirmed'?'output-available':'output-error'}>
  <ChatTool.Trigger><ClipboardCheck size={16}/><span>核对 {review.count} 道题</span><span>{labels[review.state]}</span></ChatTool.Trigger>
  <ChatTool.Content>
   <p>小智根据原题起草。请核对题干、答案和解析；保存后可在教学内容的题本查看。</p>
   {loading&&<p role="status">正在读取待核对题目…</p>}
   {view&&!view.sourceCurrent&&<p role="alert">原题已变化，这份候选只能查看或拒绝；请重新出题。</p>}
   {!!view?.sources.length&&<><p>原题来源</p><ul>{view.sources.map(source=><QuestionSourceLink key={source.question.questionId} source={source}/>)}</ul></>}
   {draft&&<fieldset className="pi-learning-fields" disabled={!pending||state.busy||loading}>
    <label>题目组名称<input data-testid="question-review-title" maxLength={160} value={draft.title} onChange={e=>change({...draft,title:e.target.value})}/></label>
    <div className="pi-training-heading">{(['subject','grade','knowledgePoint'] as const).map((field,i)=><label key={field}>{['科目','年级','知识点'][i]}<input data-testid={`question-review-${field}`} maxLength={128} value={draft[field]} onChange={e=>change({...draft,[field]:e.target.value})}/></label>)}</div>
    <div className="pi-question-candidates" tabIndex={0} aria-label="逐题核对">{draft.items.map((q,i)=><section className="pi-training-day" data-testid="question-review-item" key={i}>
     <strong>第 {i+1} 题 · {typeLabels[q.questionType]}</strong>
     {!!view?.issues[i]?.length&&<p>原候选的题干、选项、答案或解析不完整，请补全后保存。</p>}
     <label>难度<select data-testid="question-review-difficulty" value={q.difficulty} onChange={e=>itemChange(i,{difficulty:e.target.value as typeof q.difficulty})}><option value="easy">基础</option><option value="medium">标准</option><option value="hard">提高</option></select></label>
     <label>题干<textarea data-testid="question-review-stem" maxLength={12000} value={q.stem} onChange={e=>itemChange(i,{stem:e.target.value})}/></label>
     {q.questionType==='choice'&&(['A','B','C','D'] as const).map(k=><label key={k}>选项 {k}<input data-testid={`question-review-option-${k}`} maxLength={2000} value={q.options?.[k]||''} onChange={e=>itemChange(i,{options:{...q.options,[k]:e.target.value}})}/></label>)}
     <label>参考答案<textarea data-testid="question-review-answer" maxLength={8000} value={q.answer} onChange={e=>itemChange(i,{answer:e.target.value})}/><small>{q.questionType==='choice'?'选择题填写 A、B、C 或 D。':q.questionType==='concept'?'判断题填写 true（正确）或 false（错误）。':'请完整填写答案。填空题题干用 ____ 标明空格。'}</small></label>
     <label>解析<textarea data-testid="question-review-analysis" maxLength={12000} value={q.analysis} onChange={e=>itemChange(i,{analysis:e.target.value})}/></label>
    </section>)}</div>
    <label>核对说明<textarea data-testid="question-review-reason" maxLength={1000} value={draft.reason} onChange={e=>change({...draft,reason:e.target.value})}/></label>
   </fieldset>}
   {pending&&<ChatTool.Approval><ChatTool.ApprovalActions><Button data-testid="question-review-confirm" isDisabled={loading||!view||!view.sourceCurrent||state.busy} onPress={()=>void decide('confirm')}>确认并保存到题本</Button><ChatTool.Reject data-testid="question-review-reject" isDisabled={state.busy} onPress={()=>void decide('reject')}>拒绝</ChatTool.Reject></ChatTool.ApprovalActions></ChatTool.Approval>}
   {!!view?.saved.length&&<><p role="status">已保存 {view.saved.length} 道题；保留原题来源和本次核对版本。</p><ul>{view.saved.map(source=><QuestionSourceLink key={source.question.questionId} source={source}/>)}</ul></>}
   {state.busy&&<p role="status">正在保存题目…</p>}{state.error&&<p role="alert">{state.error}</p>}
   {state.error&&<Button variant="secondary" data-testid="question-review-retry" isDisabled={loading||state.busy} onPress={()=>{setLoading(true);update({error:''});setRevision(v=>v+1);}}>重新读取</Button>}
  </ChatTool.Content>
 </ChatTool>;
}
