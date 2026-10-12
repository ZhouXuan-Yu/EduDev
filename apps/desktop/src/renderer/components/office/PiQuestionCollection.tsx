import {useEffect,useRef,useState} from 'react';
import {Button,Checkbox} from '@heroui/react';
import {ClipboardCheck} from 'lucide-react';
import {ChatTool} from '../../heroui-pro/components/chat-tool';
import {useOfficeComposerState} from './OfficeComposerState';
import {GeneratedQuestionReview} from './PiQuestionReview';
import {QUESTION_COLLECTION_SCHEMA,type QuestionCollectionSummary,type QuestionCollectionView} from '../../../shared/question-collection';
import {QUESTION_REVIEW_SCHEMA,QUESTION_REVIEW_ERRORS} from '../../../shared/question-review';

const issueLabels={shortage:'题目尚未齐全',quality_required:'当前题目需要检查',quality_blocked:'题目检查未通过',source_changed:'原题或保存版本已变化',duplicate_collection:'整卷出现重复题',answer_conflict:'同题答案存在冲突',quota_mismatch:'题数或题型与要求不符'};
/** Same question editor and host-owned approval ledger, one explicit whole-paper acknowledgement. */
export function PiQuestionCollection({sessionId,review,onRefresh}:{sessionId:string;review:QuestionCollectionSummary;onRefresh:()=>Promise<void>}){
 const [view,setView]=useState<QuestionCollectionView>(),[error,setError]=useState(''),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[ack,setAck]=useState(''),[revision,setRevision]=useState(0);
 const {controlDrafts,setControlDrafts,controlLocks}=useOfficeComposerState();
 const checkingLock=useRef(false),[checking,setChecking]=useState(''),[checkError,setCheckError]=useState('');
 const pending=review.state==='pending';
 async function refresh(){setAck('');setRevision(v=>v+1);await onRefresh();}
 useEffect(()=>{let live=true;setLoading(true);void window.omniEdu?.reviewQuestionCollection({schemaVersion:QUESTION_COLLECTION_SCHEMA,sessionId,id:review.id}).then(result=>{if(!live)return;if(result?.ok){setView(result.value);setError('');}else setError(result?QUESTION_REVIEW_ERRORS[result.error]:'暂时无法读取整卷题目。');}).catch(()=>{if(live)setError('暂时无法读取整卷题目，请重试。');}).finally(()=>{if(live)setLoading(false);});return()=>{live=false;};},[sessionId,review.id,review.state,review.phase,review.count,revision]);
 const dirty=!!view?.groups.some(g=>{const local=controlDrafts[`question:${g.review.id}`];return local?.busy||local?.questionDraft&&JSON.stringify(local.questionDraft)!==JSON.stringify(g.review.draft);});
 useEffect(()=>{setAck('');},[dirty,view?.revisionHash]);
 async function checkChanges(){
  if(checkingLock.current||busy||loading||!pending||!view)return;
  const changes=view.groups.flatMap(g=>{const key=`question:${g.review.id}`,local=controlDrafts[key];return local?.questionDraft&&JSON.stringify(local.questionDraft)!==JSON.stringify(g.review.draft)?[{key,id:g.review.id,local,draft:local.questionDraft}]:[];});
  if(!changes.length||view.groups.some(g=>controlLocks.current.get(`question:${g.review.id}`)?.current||controlDrafts[`question:${g.review.id}`]?.busy))return;
  checkingLock.current=true;setBusy(true);setAck('');setError('');setCheckError('');
  const locks=changes.map(c=>{let lock=controlLocks.current.get(c.key);if(!lock){lock={current:false};controlLocks.current.set(c.key,lock);}lock.current=true;return lock;});
  setControlDrafts(previous=>{const next={...previous};for(const c of changes)next[c.key]={...(previous[c.key]||c.local),busy:true,error:''};return next;});
  try{
   for(const [index,c] of changes.entries()){
    setChecking(`正在检查修改 ${index+1}/${changes.length}…`);
    const result=await window.omniEdu?.reviewXiaozhiQuestions({schemaVersion:QUESTION_REVIEW_SCHEMA,sessionId,id:c.id,draft:c.draft});
    if(!result?.ok||!result.value.quality){const message=result&&!result.ok?QUESTION_REVIEW_ERRORS[result.error]:'检查未完成，请重试。';setControlDrafts(previous=>({...previous,[c.key]:{...(previous[c.key]||c.local),error:message}}));throw new Error(message);}
    const quality=result.value.quality;
    setControlDrafts(previous=>({...previous,[c.key]:{...(previous[c.key]||c.local),questionQuality:{draftJson:JSON.stringify(c.draft),quality,reviewed:false}}}));
   }
  }catch(cause){setCheckError(`部分修改尚未检查：${cause instanceof Error?cause.message:'请重试。'}`);}
  finally{
   for(const lock of locks)lock.current=false;
   setControlDrafts(previous=>{const next={...previous};for(const c of changes)next[c.key]={...(previous[c.key]||c.local),busy:false};return next;});
   setChecking('');setBusy(false);checkingLock.current=false;await refresh();
  }
 }
 async function decide(action:'confirm'|'reject'){
  if(busy||!view||action==='confirm'&&(loading||dirty||!view.complete||view.phase!=='review'||ack!==view.revisionHash))return;
  setBusy(true);setError('');
  try{const result=await window.omniEdu?.decideQuestionCollection({schemaVersion:QUESTION_COLLECTION_SCHEMA,sessionId,id:review.id,action,...(action==='confirm'?{revisionHash:view.revisionHash,reviewed:true as const}:{})});if(result?.ok)setView(result.value);else setError(result?QUESTION_REVIEW_ERRORS[result.error]:'请求未送达，请重试。');setAck('');await onRefresh();setRevision(v=>v+1);}catch{setError('保存未完成，请重新读取当前版本后重试。');}finally{setBusy(false);}
 }
 return <ChatTool className="pi-learning-review" data-testid="pi-question-collection" data-review-id={review.id} data-state={review.state} defaultExpanded state={pending?'requires-action':review.state==='confirmed'?'output-available':'output-error'}>
  <ChatTool.Trigger><ClipboardCheck size={16}/><span>{view?.title||review.title}</span><span>{review.count}/{review.required} 道 · {review.state==='confirmed'?'已集中保存':review.state==='rejected'?'已拒绝':review.phase==='drafting'?'正在起草':'集中核对'}</span></ChatTool.Trigger>
  <ChatTool.Content>
   <p>小智在内部完成分批起草和检查。请展开核对题干、条件、答案与解析；最后集中确认当前全部题目。</p>
   {loading&&<p role="status">正在读取整卷当前版本…</p>}
   {view?.phase==='drafting'&&pending&&<p role="status">题目尚在准备中，草稿已保留。停止后可以继续当前任务，未确认不会保存到题本。</p>}
   {!!view?.issues.length&&<ul data-testid="question-collection-issues" role="status">{view.issues.map((issue,i)=><li key={i}>{view.blueprint.sections.find(s=>s.id===issue.sectionId)?.label||'整卷'}{issue.index!==undefined?` · 第${issue.index+1}题`:''}：{issueLabels[issue.code]}</li>)}</ul>}
   <fieldset disabled={busy} style={{border:0,padding:0,margin:0,minWidth:0}} aria-label="整卷题目编辑">{view?.blueprint.sections.map(section=><section className="pi-training-day" key={section.id} data-testid="question-collection-section"><strong>{section.label}</strong><p>{view.groups.filter(g=>g.sectionId===section.id).reduce((n,g)=>n+g.review.count,0)} / {view.blueprint.mode==='ai_original'?section.count:section.generatedCount||0} 道起草题</p>{view.groups.filter(g=>g.sectionId===section.id).map(g=><GeneratedQuestionReview key={g.review.id} sessionId={sessionId} review={g.review} grouped exception={view.issues.some(i=>i.groupId===g.review.id)} onRefresh={refresh}/>)}</section>)}</fieldset>
   {dirty&&<p role="status" data-testid="question-collection-dirty">题目有未检查的修改。检查全部修改后，再集中核对整卷。</p>}
   {pending&&dirty&&<Button variant="secondary" data-testid="question-collection-check-changes" isDisabled={busy||loading} onPress={()=>void checkChanges()}>检查全部修改</Button>}
   {pending&&view?.phase==='review'&&<ChatTool.Approval>
    <Checkbox data-testid="question-collection-reviewed" isSelected={ack===view.revisionHash} isDisabled={busy||loading||dirty||!view.complete} onChange={checked=>setAck(checked?view.revisionHash:'')}><Checkbox.Content><Checkbox.Control><Checkbox.Indicator/></Checkbox.Control><span>我已核对当前整卷所有题目的题干、条件、答案、解析与计算对应关系。</span></Checkbox.Content></Checkbox>
    <p>格式与局部计算符合不代表整题已证明。存在未解决问题时不会保存。</p>
    <ChatTool.ApprovalActions><Button data-testid="question-collection-confirm" isDisabled={busy||loading||dirty||!view.complete||ack!==view.revisionHash} onPress={()=>void decide('confirm')}>集中确认并保存题目</Button><ChatTool.Reject data-testid="question-collection-reject" isDisabled={busy||loading} onPress={()=>void decide('reject')}>拒绝整卷草稿</ChatTool.Reject></ChatTool.ApprovalActions>
   </ChatTool.Approval>}
   {pending&&view?.phase==='drafting'&&<Button data-testid="question-collection-reject" isDisabled={busy||loading} onPress={()=>void decide('reject')}>拒绝整卷草稿</Button>}
   {busy&&<p role="status" data-testid="question-collection-progress">{checking||'正在处理当前核对结果…'}</p>}{error&&<p role="alert">{error}</p>}{checkError&&<p role="alert">{checkError}</p>}
   <Button variant="secondary" data-testid="question-collection-refresh" isDisabled={busy||loading} onPress={()=>void refresh()}>重新读取当前版本</Button>
  </ChatTool.Content>
 </ChatTool>;
}
