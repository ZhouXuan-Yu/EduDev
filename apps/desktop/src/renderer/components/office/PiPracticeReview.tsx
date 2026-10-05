import {useEffect,useRef,useState} from 'react';
import {Button,Modal} from '@heroui/react';
import {ClipboardCheck} from 'lucide-react';
import {ChatTool} from '../../heroui-pro/components/chat-tool';
import {useOfficeControlState} from './OfficeComposerState';
import {QuestionSourceLink} from './PiQuestionSource';
import {PRACTICE_REVIEW_SCHEMA,PRACTICE_REVIEW_ERRORS,type PracticeReviewSummary,type PracticeReviewView,type PracticeReviewDraft,type PracticeSourceInput} from '../../../shared/practice-review';
import './pi-learning-review.css';
const labels={pending:'需要你核对',confirmed:'已确认保存',rejected:'已拒绝，未保存'};
const roles={original:'原题',similar:'相似题',variant:'变式题'};
export function PracticeQuestionList({view,draft,onChange}:{view:PracticeReviewView;draft:PracticeReviewDraft;onChange?:(draft:PracticeReviewDraft)=>void}){
 const editable=!!onChange,change=(index:number,patch:Partial<PracticeReviewDraft['items'][number]>)=>onChange?.({...draft,items:draft.items.map((q,i)=>i===index?{...q,...patch}:q)});
 return <div className="pi-question-candidates" tabIndex={0} aria-label="练习题目与来源">{draft.items.map((item,n)=>{const entry=view.questions[item.index];return <section className="pi-training-day" data-testid="practice-review-item" key={item.index}>
  <strong>第 {n+1} 题 · {entry.question.knowledgePoint||'未标注知识点'}</strong>
  <div className="pi-training-heading"><label>题目用途<select data-testid="practice-review-role" disabled={!editable} value={item.role} onChange={e=>change(n,{role:e.target.value as typeof item.role})}>{Object.entries(roles).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
  {editable&&<div><Button variant="secondary" data-testid="practice-review-up" isDisabled={!n} onPress={()=>{const items=[...draft.items];[items[n-1],items[n]]=[items[n],items[n-1]];onChange({...draft,items});}}>上移</Button><Button variant="secondary" data-testid="practice-review-remove" isDisabled={draft.items.length===1} onPress={()=>onChange({...draft,items:draft.items.filter((_,i)=>i!==n)})}>移出练习</Button></div>}</div>
  <h4>题干</h4><div className="pi-practice-text" data-testid="practice-review-stem">{entry.question.stem}</div>
  <h4>参考答案</h4><div className="pi-practice-text" data-testid="practice-review-answer">{entry.question.answer}</div>
  <h4>解析</h4><div className="pi-practice-text">{entry.question.analysis}</div>
  <label>教师观察<textarea data-testid="practice-review-observation" maxLength={1000} disabled={!editable} value={item.teacherObservation} onChange={e=>change(n,{teacherObservation:e.target.value})}/></label>
  <ul><QuestionSourceLink source={{title:'本题保存版本',question:entry.source}}/>{entry.parents.map((source,i)=><QuestionSourceLink key={`${source.questionId}:${source.version}`} source={{title:`父题来源 ${i+1}`,question:source}}/>)}</ul>
 </section>;})}
 {editable&&view.questions.map((q,index)=>draft.items.some(i=>i.index===index)?null:<Button key={index} variant="secondary" data-testid="practice-review-restore" onPress={()=>onChange({...draft,items:[...draft.items,{index,role:'variant',teacherObservation:''}]})}>恢复题目 {index+1}</Button>)}
 </div>;
}
export function PiPracticeReview({sessionId,review,onRefresh}:{sessionId:string;review:PracticeReviewSummary;onRefresh:()=>Promise<void>}){
 const {draft:state,update,lock}=useOfficeControlState(`practice:${review.id}`),[view,setView]=useState<PracticeReviewView>(),[loading,setLoading]=useState(true),[revision,setRevision]=useState(0),retained=useRef(state.practiceDraft);retained.current=state.practiceDraft;
 useEffect(()=>{let live=true;setLoading(true);void window.omniEdu?.reviewXiaozhiPractice({schemaVersion:PRACTICE_REVIEW_SCHEMA,sessionId,id:review.id}).then(result=>{if(!live)return;if(result?.ok){setView(result.value);if(!retained.current||review.state!=='pending'){retained.current=result.value.draft;update({practiceDraft:result.value.draft});}}else update({error:result?PRACTICE_REVIEW_ERRORS[result.error]:'无法读取练习，请重试。'});}).catch(()=>{if(live)update({error:'无法读取练习，请重试。'});}).finally(()=>{if(live)setLoading(false);});return()=>{live=false;};},[sessionId,review.id,review.state,revision]);
 const draft=state.practiceDraft||view?.draft,pending=review.state==='pending',change=(value:PracticeReviewDraft)=>{retained.current=value;update({practiceDraft:value,error:''});};
 async function decide(action:'confirm'|'reject'){
  if(lock.current)return;lock.current=true;update({busy:true,error:''});try{const result=await window.omniEdu?.decideXiaozhiPractice({schemaVersion:PRACTICE_REVIEW_SCHEMA,sessionId,id:review.id,action,...(action==='confirm'?{draft}:{})});if(!result?.ok)update({error:result?PRACTICE_REVIEW_ERRORS[result.error]:'保存未完成，请重试。'});await onRefresh();}catch{update({error:'保存未完成，请重试。'});}finally{lock.current=false;update({busy:false});}
 }
 return <ChatTool className="pi-learning-review" data-testid="pi-practice-review" data-review-id={review.id} data-state={review.state} defaultExpanded={pending} state={pending?'requires-action':review.state==='confirmed'?'output-available':'output-error'}>
  <ChatTool.Trigger><ClipboardCheck size={16}/><span>核对练习</span><span>{labels[review.state]}</span></ChatTool.Trigger>
  <ChatTool.Content><p>为 {view?.studentLabel||'当前学生'} 安排练习。题目来自本地保存版本；请核对答案、顺序和用途。安排练习不表示学生已经作答。</p>
   {loading&&<p role="status">正在读取练习…</p>}{view&&!view.sourceCurrent&&<p role="alert">引用题目已变化。原安排保留，待核对候选请拒绝后重新读取题目。</p>}
   {view&&draft&&<fieldset className="pi-learning-fields" disabled={!pending||state.busy||loading}>
    <label>练习名称<input data-testid="practice-review-title" value={draft.title} maxLength={160} onChange={e=>change({...draft,title:e.target.value})}/></label>
    <div className="pi-training-heading"><label>科目<input data-testid="practice-review-subject" value={draft.subject} maxLength={128} onChange={e=>change({...draft,subject:e.target.value})}/></label><label>知识点<input data-testid="practice-review-point" value={draft.knowledgePoint} maxLength={128} onChange={e=>change({...draft,knowledgePoint:e.target.value})}/></label></div>
    <PracticeQuestionList view={view} draft={draft} {...(pending?{onChange:change}:{})}/>
    <label>核对说明<textarea data-testid="practice-review-reason" maxLength={1000} value={draft.reason} onChange={e=>change({...draft,reason:e.target.value})}/></label>
   </fieldset>}
   {pending&&<ChatTool.Approval><ChatTool.ApprovalActions><Button data-testid="practice-review-confirm" isDisabled={loading||!view?.sourceCurrent||state.busy} onPress={()=>void decide('confirm')}>确认并保存练习</Button><ChatTool.Reject data-testid="practice-review-reject" isDisabled={state.busy} onPress={()=>void decide('reject')}>拒绝</ChatTool.Reject></ChatTool.ApprovalActions></ChatTool.Approval>}
   {view?.exercise&&<p role="status">已保存到学生的错题与练习；题目版本和本次核对说明已保留。</p>}
   {state.busy&&<p role="status">正在保存练习…</p>}{state.error&&<p role="alert">{state.error}</p>}{state.error&&<Button variant="secondary" data-testid="practice-review-retry" isDisabled={loading||state.busy} onPress={()=>{setLoading(true);update({error:''});setRevision(v=>v+1);}}>重新读取</Button>}
  </ChatTool.Content>
 </ChatTool>;
}
/** Read-only provenance from the same ledger; a source dialog cannot grant approval. */
export function PracticeSourceButton({source}:{source:PracticeSourceInput}){
 const [view,setView]=useState<PracticeReviewView>(),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),generation=useRef(0);
 useEffect(()=>{generation.current++;setView(undefined);setNotice('');setBusy(false);return()=>{generation.current++;};},[source.studentId,source.exerciseId]);
 return <><Button variant="secondary" data-testid="practice-source-open" isDisabled={busy} onPress={async()=>{const owner=++generation.current;setBusy(true);setNotice('');try{const result=await window.omniEdu?.readPracticeSource(source);if(owner!==generation.current)return;if(!result?.ok)throw new Error('unavailable');setView(result.value);}catch{if(owner===generation.current)setNotice('这份练习的来源暂时无法读取，请重试。');}finally{if(owner===generation.current)setBusy(false);}}}>来源与核对记录</Button>{notice&&<p role="alert">{notice}</p>}
 {view&&<Modal.Backdrop isOpen onOpenChange={open=>{if(!open){generation.current++;setView(undefined);}}}><Modal.Container size="lg" scroll="inside"><Modal.Dialog className="pi-themed-surface" data-testid="practice-source-dialog"><Modal.Header><Modal.Heading>练习来源与核对</Modal.Heading></Modal.Header><Modal.Body><p>{view.draft.title} · {view.studentLabel}</p><p>{view.draft.reason}</p><p>以下保留确认时的题目版本；题库后续编辑不改写这份练习。</p>{!view.sourceCurrent&&<p role="alert">部分题库正文已变化；原保存快照仍保留，来源链接会核对版本。</p>}<PracticeQuestionList view={view} draft={view.draft}/></Modal.Body><Modal.Footer><Button variant="secondary" data-testid="practice-source-close" onPress={()=>{generation.current++;setView(undefined);}}>关闭</Button></Modal.Footer></Modal.Dialog></Modal.Container></Modal.Backdrop>}
 </>;
}
