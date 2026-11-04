import {QuestionVariationComparison} from './QuestionVariationComparison';
import { DisclosureCard } from '../ui/DisclosureCard';
import {questionChoiceText} from '../../../shared/question-text';
import {QuestionMathText} from '../QuestionMathText';
import {PiOriginalQuestionReview} from './PiOriginalQuestionReview';
import {useEffect,useRef,useState} from 'react';
import {Button} from '@heroui/react';
import {ClipboardCheck} from 'lucide-react';
import {ChatTool} from '../../heroui-pro/components/chat-tool';
import {useOfficeControlState} from './OfficeComposerState';
import {QuestionSourceLink} from './PiQuestionSource';
import {QuestionQualityReview} from './QuestionQualityReview';
import {QUESTION_REVIEW_SCHEMA,QUESTION_REVIEW_ERRORS,validQuestionReviewDraft,type QuestionReviewSummary,type QuestionReviewView,type QuestionReviewDraft} from '../../../shared/question-review';
import './pi-learning-review.css';
import styles from '../../ui-system/question-review.module.css';
const labels={pending:'需要你核对',confirmed:'已确认保存',rejected:'已拒绝，未保存'};
const typeLabels={choice:'选择题',concept:'判断题',fill_in_blank:'填空题',short_answer:'简答题',written:'书面作答',coding:'编程练习'};
/** The existing approval card and session-owned drafts; no second question workspace. */
export function GeneratedQuestionReview({sessionId,review,onRefresh,grouped=false,exception=false,providedView}:{sessionId:string;review:QuestionReviewSummary;onRefresh:()=>Promise<void>;grouped?:boolean;exception?:boolean;providedView?:QuestionReviewView}){
 const {draft:state,update,lock}=useOfficeControlState(`question:${review.id}`),[view,setView]=useState<QuestionReviewView>(),[loading,setLoading]=useState(true),[revision,setRevision]=useState(0);
 const retained=useRef(state.questionDraft);retained.current=state.questionDraft;
 useEffect(()=>{let live=true;
  // The aggregate already read this exact authorized version. Reuse it so a
  // resumed review cannot race six redundant child reads against host startup.
  if(providedView&&providedView.id===review.id){setView(providedView);setLoading(false);if(!retained.current||review.state!=='pending'){retained.current=providedView.draft;update({questionDraft:providedView.draft,error:''});}return()=>{live=false;};}
  setLoading(true);void window.omniEdu?.reviewXiaozhiQuestions({schemaVersion:QUESTION_REVIEW_SCHEMA,sessionId,id:review.id}).then(result=>{if(!live)return;if(result?.ok){setView(result.value);if(!retained.current||review.state!=='pending'){retained.current=result.value.draft;update({questionDraft:result.value.draft});}}else update({error:result?QUESTION_REVIEW_ERRORS[result.error]:'无法读取题目，请重试。'});}).catch(()=>{if(live)update({error:'无法读取题目，请重试。'});}).finally(()=>{if(live)setLoading(false);});return()=>{live=false;};},[sessionId,review.id,review.state,review.supersededBy,revision,providedView]);
 const explanation=(view?.generationKind||review.generationKind)==='explanation';
 const draft=state.questionDraft||view?.draft,superseded=!!(review.supersededBy||view?.supersededBy),pending=review.state==='pending'&&!superseded;
 const checked=!!draft&&state.questionQuality?.draftJson===JSON.stringify(draft),quality=checked?state.questionQuality?.quality:view?.quality;
 const change=(value:QuestionReviewDraft)=>{retained.current=value;update({questionDraft:value,questionQuality:undefined,error:''});};
 async function checkQuality(){
  if(lock.current||!draft)return;lock.current=true;update({busy:true,error:''});
  try{const result=await window.omniEdu?.reviewXiaozhiQuestions({schemaVersion:QUESTION_REVIEW_SCHEMA,sessionId,id:review.id,draft});if(result?.ok&&result.value.quality){setView(result.value);update({questionQuality:{draftJson:JSON.stringify(draft),quality:result.value.quality,reviewed:false}});if(grouped)await onRefresh();}else update({error:result&&!result.ok?QUESTION_REVIEW_ERRORS[result.error]:'检查未完成，请重试。'});}catch{update({error:'检查未完成，请重试。'});}finally{lock.current=false;update({busy:false});}
 }
 async function decide(action:'confirm'|'reject'){
  if(lock.current)return;if(action==='confirm'&&!validQuestionReviewDraft(draft)){update({error:QUESTION_REVIEW_ERRORS.invalid_input});return;}
  lock.current=true;update({busy:true,error:''});try{const result=await window.omniEdu?.decideXiaozhiQuestions({schemaVersion:QUESTION_REVIEW_SCHEMA,sessionId,id:review.id,action,...(action==='confirm'?{draft,...(checked&&state.questionQuality?.reviewed?{qualityConfirmation:{revisionHash:state.questionQuality.quality.revisionHash,reviewed:true as const}}:{})}:{})});if(!result?.ok)update({error:result?QUESTION_REVIEW_ERRORS[result.error]:'确认请求未送达，请重试。'});await onRefresh();}catch{update({error:'保存未完成，请重试。'});}finally{lock.current=false;update({busy:false});}
 }
 const itemChange=(index:number,fields:Partial<QuestionReviewDraft['items'][number]>)=>{const current=retained.current||draft;if(current)change({...current,items:current.items.map((q,i)=>i===index?{...q,...fields}:q)});};
 return <ChatTool className="pi-learning-review" data-testid="pi-question-review" data-review-id={review.id} data-state={review.state} defaultExpanded={pending&&(!grouped||exception)} state={pending?'requires-action':review.state==='confirmed'?'output-available':'output-error'}>
  <ChatTool.Trigger><ClipboardCheck size={16}/><span>核对 {review.count} 道{explanation?'原题解析':'题'}</span><span>{superseded?'已有修复版本，旧版未保存':labels[review.state]}</span></ChatTool.Trigger>
  <ChatTool.Content>
   <div className={styles.content}>
   <p data-testid="question-generation-provenance">{explanation?'原题题面与图片保持；已有内容直接复用，缺失部分由小智补充，补充内容不是教材标准答案。':(view?.generationKind||review.generationKind)==='ai_original'?'AI原创 · 没有教材原题来源。':'小智根据实读原题起草变式。'}请核对题干、条件、答案和解析；保存后可在教学内容的题本查看。</p>
   {!!review.repairAttempt&&<p data-testid="question-repair-status" role="status">小智已修复 {review.repairAttempt} 次。修复前候选未保存，当前版本仍需你核对。</p>}
   {review.repairAttempt===3&&quality?.state==='blocked'&&<p role="status">自动修复仍未通过，请编辑并检查，或拒绝此候选。</p>}
   {superseded&&<p data-testid="question-repair-superseded" role="status">此候选已保留在修复历史中，请核对新的修复版本。</p>}
   {view?.repairPrevious&&<ChatTool data-testid="question-repair-previous" defaultExpanded={false} state="output-error"><ChatTool.Trigger>查看修复前的题目和检查结果</ChatTool.Trigger><ChatTool.Content>{view.repairPrevious.draft.items.map((q,i)=><section key={i}><strong>第 {i+1} 题</strong><p>{q.stem}</p><p>修复前参考答案：{q.answer}</p><p>修复前解析：{q.analysis}</p></section>)}<QuestionQualityReview quality={view.repairPrevious.quality} checked reviewed={false} historyCount={1} pending={false} busy={false} onCheck={()=>{}} onReviewed={()=>{}}/></ChatTool.Content></ChatTool>}
   {loading&&<p role="status">正在读取待核对题目…</p>}
   {view&&!view.sourceCurrent&&<p role="alert">原题已变化，这份候选只能查看或拒绝；请重新出题。</p>}
   {!!view?.sources.length&&<><p>原题来源</p><ul>{view.sources.map(source=><QuestionSourceLink key={source.question.questionId} source={source}/>)}</ul></>}
   {view?.variation&&draft&&<QuestionVariationComparison variation={view.variation} draft={draft}/>}
   {draft&&<fieldset className={`pi-learning-fields ${styles.fields}`} disabled={!pending||state.busy||loading}>
    <label className={styles.field}>题目组名称<input className={styles.control} data-testid="question-review-title" maxLength={160} value={draft.title} onChange={e=>change({...draft,title:e.target.value})}/></label>
    {!explanation&&<div className={`pi-training-heading ${styles.meta}`}>{(['subject','grade','knowledgePoint'] as const).map((field,i)=><label className={styles.field} key={field}>{['科目','年级','知识点'][i]}<input className={styles.control} data-testid={`question-review-${field}`} maxLength={128} value={draft[field]} onChange={e=>change({...draft,[field]:e.target.value})}/></label>)}</div>}
    <div className={`pi-question-candidates ${styles.items}`} tabIndex={0} aria-label="逐题核对">{draft.items.map((q,i)=><section className={`pi-training-day ${styles.item}`} data-testid="question-review-item" key={i}>
     <strong>第 {i+1} 题 · {explanation?view?.explanationTargets?.[i]?.questionType||'原题解析':typeLabels[q.questionType]}</strong>
     {explanation&&view?.explanationTargets?.[i]&&<p data-testid="question-review-source-meta">{[view.explanationTargets[i].subject,view.explanationTargets[i].grade,view.explanationTargets[i].knowledgePoint].filter(Boolean).join(' · ')}</p>}
     {!!view?.issues[i]?.length&&<p>原候选的题干、选项、答案或解析不完整，请补全后保存。</p>}
     {explanation&&view?.explanationTargets?.[i]?.answerLocked&&view?.explanationTargets?.[i]?.analysisLocked&&<p data-testid="question-review-reused">已有答案和解析，本题只读复用，不改写原题版本。</p>}
     <label className={styles.field}>难度估计<select className={styles.control} data-testid="question-review-difficulty" disabled={explanation} value={q.difficulty} onChange={e=>itemChange(i,{difficulty:e.target.value as typeof q.difficulty})}><option value="easy">基础</option><option value="medium">标准</option><option value="hard">提高</option></select></label>
     <label className={styles.field}>题干<textarea className={`${styles.control} ${styles.textarea}`} data-testid="question-review-stem" readOnly={explanation} maxLength={12000} value={q.stem} onChange={e=>itemChange(i,{stem:e.target.value})}/></label>
     {q.questionType==='choice'&&<div className={styles.options}>{(['A','B','C','D'] as const).map(k=><label className={styles.field} key={k}>选项 {k}<input className={styles.control} data-testid={`question-review-option-${k}`} maxLength={2000} value={q.options?.[k]||''} onChange={e=>itemChange(i,{options:{...q.options,[k]:e.target.value}})}/></label>)}</div>}
     <label className={styles.field}>参考答案<textarea className={`${styles.control} ${styles.textarea}`} data-testid="question-review-answer" readOnly={explanation&&view?.explanationTargets?.[i]?.answerLocked} maxLength={8000} value={q.answer} onChange={e=>itemChange(i,{answer:e.target.value})}/><small className={styles.hint}>{explanation?'请核对全部小问的答案，与讲解一一对应；已有答案不能覆盖。':q.questionType==='choice'?'选择题填写 A、B、C 或 D。':q.questionType==='concept'?'判断题填写 true（正确）或 false（错误）。':'请完整填写答案。填空题题干用 ____ 标明空格。'}</small></label>
     <label className={styles.field}>解析<textarea className={`${styles.control} ${styles.textarea}`} data-testid="question-review-analysis" readOnly={explanation&&view?.explanationTargets?.[i]?.analysisLocked} maxLength={12000} value={q.analysis} onChange={e=>itemChange(i,{analysis:e.target.value})}/></label>
     <DisclosureCard data-testid="question-review-formula-preview" title={<>查看题目排版（随编辑更新）</>}><strong>题干</strong><div data-testid="question-review-body-preview"><QuestionMathText text={questionChoiceText(q).text}/></div>{questionChoiceText(q).conflict&&<p role="alert">题干内的选项与选项字段冲突，请统一后重新检查。</p>}<strong>参考答案</strong><QuestionMathText text={q.answer}/><strong>解析</strong><QuestionMathText text={q.analysis}/></DisclosureCard>

    </section>)}</div>
    <label className={styles.field}>核对说明<textarea className={`${styles.control} ${styles.textarea}`} data-testid="question-review-reason" maxLength={1000} value={draft.reason} onChange={e=>change({...draft,reason:e.target.value})}/></label>
   </fieldset>}
   {view&&<QuestionQualityReview grouped={grouped} quality={quality} prechecked={!!view.qualityHistoryCount&&JSON.stringify(view.draft)===JSON.stringify(draft)} checked={pending?checked:!!view.quality&&!view.legacyQuality} reviewed={!!state.questionQuality?.reviewed} legacy={view.legacyQuality} historyCount={view.qualityHistoryCount||0} pending={pending} busy={loading||state.busy} onCheck={()=>void checkQuality()} onReviewed={reviewed=>{if(state.questionQuality)update({questionQuality:{...state.questionQuality,reviewed}});}}/>}
   {pending&&!grouped&&<ChatTool.Approval><ChatTool.ApprovalActions><Button data-testid="question-review-confirm" isDisabled={loading||!view||!view.sourceCurrent||state.busy} onPress={()=>void decide('confirm')}>{explanation?'确认并补充原题解析':'确认并保存到题本'}</Button><ChatTool.Reject data-testid="question-review-reject" isDisabled={state.busy} onPress={()=>void decide('reject')}>拒绝</ChatTool.Reject></ChatTool.ApprovalActions></ChatTool.Approval>}
   {superseded&&review.state==='pending'&&<Button data-testid="question-review-reject" isDisabled={state.busy} onPress={()=>void decide('reject')}>拒绝旧候选</Button>}
   {!!view?.saved.length&&<><p role="status">{explanation?'已补充':'已保存'} {view.saved.length} 道{explanation?'原题解析':'题'}；保留实际来源和本次核对版本。</p><ul>{view.saved.map(source=><QuestionSourceLink key={source.question.questionId} source={source}/>)}</ul></>}
   {state.busy&&<p role="status">正在处理题目…</p>}{state.error&&<p role="alert">{state.error}</p>}
   {state.error&&<Button variant="secondary" data-testid="question-review-retry" isDisabled={loading||state.busy} onPress={()=>{setLoading(true);update({error:''});setRevision(v=>v+1);}}>重新读取</Button>}
   </div>
  </ChatTool.Content>
 </ChatTool>;
}

export function PiQuestionReview(props:{sessionId:string;review:QuestionReviewSummary;onRefresh:()=>Promise<void>}){return props.review.kind==='original'?<PiOriginalQuestionReview {...props}/>:<GeneratedQuestionReview {...props}/>;}
