import {useCallback,useEffect,useRef,useState} from 'react';
import {Button} from '@heroui/react';
import {ChatSources} from '../../heroui-pro/components/chat-source';
import {StudentSourceLink} from '../students/StudentSourceNavigation';
import {LEARNING_REVIEW_SCHEMA,LEARNING_REVIEW_ERRORS,type LearningHistoryItem,type LearningHistoryPage,type LearningReviewDraft} from '../../../shared/learning-review';
import './pi-learning-review.css';
import {PiTrainingPlan} from './PiTrainingPlan';

const outcome={correct:'正确',incorrect:'错误',partial:'部分正确'};
const errorType={none:'无',metacognitive:'概念理解',application:'应用与计算'};
function DraftDetails({draft}:{draft:LearningReviewDraft}){
 return <>{draft.kind==='assessment'?<><p>结果：{outcome[draft.correction.result]} · 错因：{errorType[draft.correction.errorType]}</p><p>{draft.correction.feedback}</p></>:<><p>复习目标保留率：{Math.round(draft.desiredRetention*100)}%</p>{draft.plan&&<PiTrainingPlan plan={draft.plan}/>}</>}<p>说明：{draft.reason}</p></>;
}
function HistoryItem({item}:{item:LearningHistoryItem}){
 const changed=JSON.stringify(item.proposal)!==JSON.stringify(item.draft);
 return <article data-testid="learning-history-item" data-version={item.version} className="pi-learning-history-item">
  <ChatSources defaultExpanded={false}>
   <ChatSources.Trigger data-testid="learning-history-item-expand">版本 {item.version} · {item.draft.kind==='assessment'?'学习校正':'复习策略'}</ChatSources.Trigger>
   <ChatSources.Content>
    <p>{new Date(item.confirmedAt).toLocaleString('zh-CN')} · {item.sameConversation?'本对话确认':'其他对话确认'}</p>
    <p>{item.subject||'全部科目'}</p>
    {item.planCurrent===false&&<p role="status">这是历史训练计划；当前学习证据或复习策略需要重新核对。</p>}
    {item.sourceStatus==='changed'&&<p role="status">原记录已变化，需要重新核对；下面是当时确认的校正。</p>}
    {item.sourceStatus==='missing'&&<p role="status">原记录不可用；下面是当时确认的校正。</p>}
    {item.source&&<ul><StudentSourceLink source={{kind:'read',title:item.sourceStatus==='changed'?`查看当前记录：${item.source.title}`:item.source.title,student:item.source.reference}}/></ul>}
    <div data-testid="learning-history-final"><strong>教师确认结果</strong><DraftDetails draft={item.draft}/></div>
    {item.draft.kind==='strategy'&&<p data-testid="learning-history-retention-diff">保留率：{Math.round(item.previousRetention*100)}% → {Math.round(item.draft.desiredRetention*100)}%</p>}
    {item.previous&&<div data-testid="learning-history-previous"><strong>此前确认 · 版本 {item.previous.version}</strong><DraftDetails draft={item.previous.draft}/></div>}
    {changed&&<ChatSources defaultExpanded={false}><ChatSources.Trigger data-testid="learning-history-proposal-expand">查看教师编辑前的建议</ChatSources.Trigger><ChatSources.Content><DraftDetails draft={item.proposal}/></ChatSources.Content></ChatSources>}
   </ChatSources.Content>
  </ChatSources>
 </article>;
}
/** Local teacher history, deliberately not part of model snapshots or compaction. */
export function PiLearningHistory({sessionId,revision}:{sessionId:string;revision:string}){
 const [expanded,setExpanded]=useState(false),[value,setValue]=useState<LearningHistoryPage>(),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const generation=useRef(0);
 const load=useCallback(async(beforeVersion?:number,expectedVersion?:number)=>{
  const request=++generation.current;setBusy(true);setError('');
  try{let result=await window.omniEdu?.learningXiaozhiHistory({schemaVersion:LEARNING_REVIEW_SCHEMA,sessionId,...(beforeVersion===undefined?{}:{beforeVersion})});
   if(request!==generation.current)return;
   if(!result?.ok){setError(result?LEARNING_REVIEW_ERRORS[result.error]:'核对历史未读取，请重试。');return;}
   // If another conversation confirms while paging, restart at the latest page.
   // Never append an older page to a history with a different head version.
   if(beforeVersion!==undefined&&result.value.latestVersion!==expectedVersion){beforeVersion=undefined;result=await window.omniEdu?.learningXiaozhiHistory({schemaVersion:LEARNING_REVIEW_SCHEMA,sessionId});if(request!==generation.current)return;if(!result?.ok){setError(result?LEARNING_REVIEW_ERRORS[result.error]:'核对历史未读取，请重试。');return;}}
   setValue(previous=>beforeVersion!==undefined&&previous&&previous.latestVersion===result.value.latestVersion?{...result.value,items:[...previous.items,...result.value.items]}:result.value);
  }catch{if(request===generation.current)setError('核对历史未读取，请重试。');}finally{if(request===generation.current)setBusy(false);}
 },[sessionId]);
 useEffect(()=>{if(expanded)void load();return()=>{generation.current++;};},[expanded,revision,load]);
 return <section data-testid="pi-learning-history" className="pi-learning-history">
  <ChatSources isExpanded={expanded} onExpandedChange={setExpanded}>
   <ChatSources.Trigger data-testid="learning-history-expand">学习核对历史</ChatSources.Trigger>
   <ChatSources.Content>
    <p>仅显示教师已确认的本地版本，包含其他对话。</p>
    <Button size="sm" variant="ghost" data-testid="learning-history-refresh" isDisabled={busy} onPress={()=>void load()}>刷新历史</Button>
    {busy&&<p role="status">正在读取核对历史…</p>}
    {error&&<p role="alert">{error}<Button size="sm" variant="ghost" data-testid="learning-history-retry" isDisabled={busy} onPress={()=>void load()}>重试</Button></p>}
    {value&&!error&&<><p data-testid="learning-history-count">已确认 {value.total} 个版本，已显示 {value.items.length} 个。</p>{value.total===0&&<p>还没有已确认的学习校正或复习策略。</p>}{value.items.map(item=><HistoryItem key={item.id} item={item}/>)}{value.nextBeforeVersion!==null&&<Button size="sm" variant="ghost" data-testid="learning-history-more" isDisabled={busy} onPress={()=>void load(value.nextBeforeVersion!,value.latestVersion)}>查看较早版本</Button>}</>}
   </ChatSources.Content>
  </ChatSources>
 </section>;
}
