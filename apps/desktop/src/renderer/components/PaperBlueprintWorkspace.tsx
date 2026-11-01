import {useEffect,useRef,useState} from 'react';
import {Button} from '@heroui/react';
import {PAPER_SCHEMA,PAPER_GENERATED_SCHEMA,PAPER_ERRORS,defaultPaperBlueprint,validPaperBlueprint,type PaperBlueprint,type PaperSection,type PaperSummary,type PaperView,type PaperCreateInput,type PaperMode,type PaperGenerationContext} from '../../shared/paper-blueprint';
import {PaperReviewPanel} from './PaperReviewPanel';
import {PaperExportEntry} from './PaperExportEntry';
import {PaperComparePanel} from './PaperComparePanel';
import {usePaperDraftHandoff} from './paper-ui/usePaperDraftHandoff';
import {DisclosureCard} from './ui/DisclosureCard';
import {PaperBlueprintEditor} from './paper-ui/PaperBlueprintEditor';
import {PaperWorkflowNavigation} from './paper-ui/PaperWorkflowNavigation';
import {paperDeliveryAllowed, type PaperStage} from './paper-ui/paper-workflow';
import '../ui-system/paper.css';
export function PaperBlueprintWorkspace(){
 const [stage,setStage]=useState<PaperStage>('blueprint');
 const [draftEdited,setDraftEdited]=useState(false);
 const [discardAction,setDiscardAction]=useState<PaperSummary|'new'|'discard'>();
 const [blueprint,setBlueprint]=useState<PaperBlueprint>(defaultPaperBlueprint),[papers,setPapers]=useState<PaperSummary[]>([]),[view,setView]=useState<PaperView>(),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [contexts,setContexts]=useState<PaperGenerationContext[]>([]),[contextOwner,setContextOwner]=useState(''),[contextsLoading,setContextsLoading]=useState(false);
 const lock=useRef(false),generation=useRef(0),pending=useRef<PaperCreateInput|undefined>(undefined),session=useRef(''),supplementSession=useRef('');
 const draftHandoff=usePaperDraftHandoff({blocked:draftEdited||busy,message:busy?'组卷正在处理中，请先停止或等待完成再离开。':'蓝图有未保存修改，已保留在当前页。请继续编辑，或点击“放弃蓝图修改”并确认后再离开。',onRestore:(draft,current)=>{
  setBlueprint(draft.blueprint);setContextOwner(draft.contextOwner);setView(current);setDraftEdited(true);setStage('blueprint');session.current=draft.targetSessionId;supplementSession.current=draft.targetSessionId;setNotice('已恢复补充题组前的蓝图编辑；请重新组卷并核对，暂存内容不代表试卷已确认。');
 }});
 async function refresh(){const r=await window.omniEdu?.listPapers();if(r?.ok)setPapers(r.value);else throw new Error(r?PAPER_ERRORS[r.error]:'读取未完成，请重试。');}
 useEffect(()=>{let live=true;void refresh().catch(e=>{if(live)setError(e.message);}).finally(()=>{if(live)setLoading(false);});return()=>{live=false;generation.current++;if(pending.current&&lock.current)void window.omniEdu?.cancelPaper({schemaVersion:PAPER_SCHEMA,sessionId:pending.current.sessionId,requestId:pending.current.requestId});};},[]);
 useEffect(()=>{let live=true;if(blueprint.mode==='source_only'){setContexts([]);setContextsLoading(false);return;}if(!blueprint.subject.trim()||!blueprint.grade.trim()){setContexts([]);setContextOwner('');setContextsLoading(false);return;}setContextsLoading(true);setError('');void window.omniEdu?.listPaperGenerationContexts({schemaVersion:PAPER_SCHEMA,subject:blueprint.subject,grade:blueprint.grade}).then(r=>{if(!live)return;if(r?.ok){setContexts(r.value);setContextOwner(old=>draftHandoff.recovered?old:r.value.some(c=>c.sessionId===old)?old:r.value.length===1?r.value[0].sessionId:'');}else{setContexts([]);if(!draftHandoff.recovered)setContextOwner('');setError(r?PAPER_ERRORS[r.error]:'题组读取未完成，请重试。');}}).catch(()=>{if(live)setError('题组读取未完成，请重试。');}).finally(()=>{if(live)setContextsLoading(false);});return()=>{live=false;};},[blueprint.mode,blueprint.subject,blueprint.grade,draftHandoff.recovered]);
 function change(next:PaperBlueprint){if(next.mode!==blueprint.mode||next.subject!==blueprint.subject||next.grade!==blueprint.grade){supplementSession.current='';if(next.mode!=='source_only'){setContextsLoading(true);setContexts([]);setContextOwner('');}}setBlueprint(next);setDraftEdited(true);pending.current=undefined;setNotice('');setError('');}
 const field=(key:'title'|'subject'|'grade',value:string)=>change({...blueprint,[key]:value});
 const section=(index:number,patch:Partial<PaperSection>)=>change({...blueprint,sections:blueprint.sections.map((s,i)=>i===index?{...s,...patch}:s)});
 async function open(paper:PaperSummary){if(lock.current)return;lock.current=true;const owner=++generation.current;setLoading(true);setError('');try{const r=await window.omniEdu?.reviewPaper({schemaVersion:PAPER_SCHEMA,sessionId:paper.sessionId,id:paper.id});if(owner!==generation.current)return;if(r?.ok){draftHandoff.clear();supplementSession.current='';setView(r.value);setDraftEdited(false);setStage('review');setBlueprint(r.value.blueprint);session.current=r.value.sessionId;setContextOwner(r.value.blueprint.mode==='source_only'?'':r.value.sessionId);pending.current=undefined;}else setError(r?PAPER_ERRORS[r.error]:'读取未完成，请重试。');}catch{if(owner===generation.current)setError('读取未完成，请重试。');}finally{lock.current=false;if(owner===generation.current)setLoading(false);}}
 async function create(){
  if(lock.current)return;if(!validPaperBlueprint(blueprint)){setError(PAPER_ERRORS.invalid_input);return;}lock.current=true;const owner=++generation.current;setBusy(true);setError('');setNotice('');
  try{
   if(blueprint.mode!=='source_only'){if(!contextOwner||!contexts.some(c=>c.sessionId===contextOwner))throw Error('请先选择已确认题组的出题任务，或前往小智补充题组。');session.current=contextOwner;}
   if(!session.current){const created=await window.omniEdu?.createAiConversationSession({title:'组卷 · '+blueprint.title});if(!created)throw Error('无法建立本地组卷记录。');session.current=created.session.id;}
   if(owner!==generation.current)return;
   const input=pending.current||{schemaVersion:blueprint.mode==='source_only'?PAPER_SCHEMA:PAPER_GENERATED_SCHEMA,sessionId:session.current,requestId:crypto.randomUUID(),blueprint:JSON.parse(JSON.stringify(blueprint)),...(blueprint.mode!=='source_only'?{generationScope:'approved_session' as const}:{}),...(view?.state==='pending'&&view.sessionId===session.current?{replace:{id:view.id,revision:view.revision}}:{})};pending.current=input;
   const r=await window.omniEdu?.createPaper(input);if(owner!==generation.current)return;if(r?.ok){draftHandoff.clear();setView(r.value);setDraftEdited(false);setStage('review');setBlueprint(r.value.blueprint);pending.current=undefined;setNotice(r.value.complete?'已按蓝图选题，请逐题核对后确认。':'题库不足，请查看缺口并调整蓝图。');await refresh();}else setError(r?PAPER_ERRORS[r.error]:'组卷未完成，请重试。');
  }catch(e){if(owner===generation.current)setError(e instanceof Error?e.message:'组卷未完成，请重试。');}finally{lock.current=false;if(owner===generation.current)setBusy(false);}
 }
 async function cancel(){const input=pending.current;if(!input)return;const r=await window.omniEdu?.cancelPaper({schemaVersion:PAPER_SCHEMA,sessionId:input.sessionId,requestId:input.requestId});if(r?.ok){setNotice('已请求停止组卷。');}else setError(r?PAPER_ERRORS[r.error]:'停止未完成，请重试。');}
 const dirty=!!view&&(draftHandoff.recovered||JSON.stringify(blueprint)!==JSON.stringify(view.blueprint)||(blueprint.mode!=='source_only'&&contextOwner!==view.sessionId)),actualPoints=blueprint.sections.reduce((n,s)=>n+s.count*s.points,0);
 const canDeliver=paperDeliveryAllowed(view,dirty);
 function newBlueprint(){if(lock.current)return;draftHandoff.clear();setView(undefined);change(defaultPaperBlueprint());setDraftEdited(false);session.current='';supplementSession.current='';setStage('blueprint');}
 function requestNew(){if(draftEdited)setDiscardAction('new');else newBlueprint();}
 function requestOpen(paper:PaperSummary){if(draftEdited)setDiscardAction(paper);else void open(paper);}
 function discardEdits(){
  draftHandoff.clear();supplementSession.current='';
  const saved=view?.blueprint??defaultPaperBlueprint();
  setBlueprint(saved);setContextOwner(saved.mode==='source_only'?'':view?.sessionId??'');
  session.current=view?.sessionId??'';pending.current=undefined;setDraftEdited(false);setStage('blueprint');setNotice('已放弃蓝图编辑，已保存的整卷快照和确认记录仍保留。');setError('');
 }
 function discardAndContinue(){const action=discardAction;setDiscardAction(undefined);if(action==='new')newBlueprint();else if(action==='discard')discardEdits();else if(action)void open(action);}
 function modeChange(mode:PaperMode){change({...blueprint,mode,sections:blueprint.sections.map(({generatedCount:_count,...s})=>({...s,...(mode==='hybrid'?{generatedCount:Math.ceil(s.count/2)}:{})}))});session.current='';}
 function chooseContext(owner:string){setContextOwner(owner);setDraftEdited(true);session.current=owner;pending.current=undefined;setError('');}
 function supplement(){void(async()=>{
  if(lock.current||draftHandoff.restoring)return;
  if(!validPaperBlueprint(blueprint)){setError(PAPER_ERRORS.invalid_input);return;}
  lock.current=true;const ownerGeneration=generation.current;setBusy(true);setError('');
  try{
   let owner=contextOwner||supplementSession.current;
   if(!owner){const created=await window.omniEdu?.createAiConversationSession({title:'出题 · '+blueprint.title});if(!created)throw Error('无法建立出题任务，请重试。');owner=created.session.id;}
   if(ownerGeneration!==generation.current)return;
   supplementSession.current=owner;
   draftHandoff.handoff({schemaVersion:'edudev.paper-ui-draft.v1',blueprint,contextOwner:owner,targetSessionId:owner,...(view?{currentView:{id:view.id,sessionId:view.sessionId}}:{})},'请按以下蓝图补充'+(blueprint.mode==='ai_original'?'AI原创题':'原创或变式题')+'，使用当前教育出题工具并等待教师核对。已有可用题先复用；不得伪造原题来源。蓝图：'+JSON.stringify(blueprint));
  }catch{if(ownerGeneration===generation.current)setError('打开出题任务未完成，请重试。');}
  finally{lock.current=false;if(ownerGeneration===generation.current)setBusy(false);}
 })();}
 const reading=loading||draftHandoff.restoring;
 return <div className="paper-workspace edu-paper-workspace" data-testid="paper-workspace" data-stage={stage}>
  <header className="edu-paper-heading">
      <div>
      <h1>智能组卷</h1>
      <p>先定蓝图，再核对每一道题，最后准备交付。</p></div>
      <div className="edu-paper-actions">{draftEdited&&<Button variant="ghost" data-testid="paper-discard-edits" isDisabled={busy||reading} onPress={()=>setDiscardAction('discard')}>放弃蓝图修改</Button>}<Button variant="secondary" isDisabled={busy||reading} onPress={requestNew}>新建蓝图</Button></div></header>
  <PaperWorkflowNavigation dirty={dirty} stage={stage} hasView={!!view} canDeliver={canDeliver} disabled={busy||reading} onChange={setStage}/>
  {discardAction&&<section role="alert" aria-labelledby="paper-discard-title" className="edu-paper-draft-warning"><h2 id="paper-discard-title">保留当前蓝图修改？</h2><p>继续将替换尚未保存的蓝图编辑，已保存的试卷快照和确认记录不会删除。</p><div className="edu-paper-actions"><Button variant="secondary" onPress={()=>setDiscardAction(undefined)}>继续编辑</Button><Button data-testid="paper-discard-continue" onPress={discardAndContinue}>放弃编辑并继续</Button></div></section>}
  {dirty&&<p role="status" data-testid="paper-draft-status">当前蓝图或题组上下文已修改。核对页展示原快照，修改仍保留；请按新蓝图重新组卷再确认，暂不能导出。原确认记录不会删除。</p>}
  {reading&&<p role="status">正在读取已保存试卷…</p>}{busy&&<p role="status">正在查看本地题库并按蓝图选题…</p>}
  {(error||draftHandoff.error)&&<div role="alert" data-testid="paper-error">{error||draftHandoff.error}<Button variant="secondary" isDisabled={busy} onPress={()=>void refresh().then(()=>setError('')).catch(e=>setError(e.message))}>重新读取列表</Button></div>}
  {notice&&<p role="status" data-testid="paper-notice">{notice}</p>}
  <div className="edu-paper-body">
      <main className="edu-paper-main">
   <div hidden={stage!=='blueprint'}><PaperBlueprintEditor blueprint={blueprint} busy={busy} loading={reading} contextsLoading={contextsLoading} contexts={contexts} contextOwner={contextOwner} hasView={!!view} actualPoints={actualPoints} change={change} field={field} section={section} onMode={modeChange} onContext={chooseContext} onSupplement={supplement} create={create} cancel={cancel}/></div>
   {view&&<div hidden={stage!=='review'}>
    <PaperReviewPanel view={view} allowConfirm={!dirty&&!busy&&!reading} onChanged={next=>{setView(next);void refresh().catch(e=>setError(e.message));}}/>
    <div className="edu-paper-actions">
      <Button variant="secondary" isDisabled={busy||reading} onPress={()=>setStage('blueprint')}>返回修改蓝图</Button>{view.state==='confirmed'&&<Button data-testid="paper-to-delivery" isDisabled={!canDeliver||busy||reading} onPress={()=>setStage('delivery')}>查看交付选项</Button>}</div>
   </div>}
   {stage==='delivery'&&view&&<section data-testid="paper-delivery">
      <h2>确认与交付</h2>
      <p>已确认保存的整卷快照不等于文件已导出。实际导出仍需小智工具执行和文件审批。</p>
    {canDeliver?<PaperExportEntry key={view.id+':'+view.revision} view={view} disabled={busy||reading}/>:<p role="alert" data-testid="paper-delivery-blocked">当前试卷不能导出。请重新核对蓝图、来源和最新确认版本。</p>}
    <Button variant="secondary" onPress={()=>setStage('review')}>返回逐题核对</Button>
   </section>}
   {view?.state==='confirmed'&&view.exportCurrent===false&&!dirty&&<p role="status" data-testid="paper-export-older">这不是本会话最新确认的试卷。请打开最新确认版本后导出，避免交付错误版本。</p>}
  </main>
      <aside className="edu-paper-sidebar" aria-label="蓝图摘要与历史">
   <section className="edu-paper-summary">
      <h2>蓝图摘要</h2>
      <p>{blueprint.title}</p>
      <p>{blueprint.subject} · {blueprint.grade} · {blueprint.durationMinutes} 分钟</p>
      <dl>
      <div><dt>题数</dt><dd>{blueprint.sections.reduce((n,s)=>n+s.count,0)}</dd></div>
      <div><dt>分值</dt><dd>{actualPoints} / {blueprint.totalPoints}</dd></div></dl>
      <p>{dirty?'蓝图有未保存修改，当前快照不能交付':view?{pending:'待教师逐题核对',confirmed:'整卷快照已确认，文件需另行导出',rejected:'已拒绝，保留原记录'}[view.state]:'完善蓝图后生成预览'}</p></section>
   <DisclosureCard
    className="edu-paper-history"
    data-testid="paper-history"
    title={`已保存的组卷记录（${papers.length}）`}
   >
    <div className="edu-paper-history-list">
     {papers.map(p=><Button
      variant="secondary"
      data-testid="paper-saved"
      data-paper-id={p.id}
      key={p.id}
      isDisabled={busy||reading}
      onPress={()=>requestOpen(p)}
     >{p.title} · {p.count}题 · {{pending:'待核对',confirmed:'已确认',rejected:'已拒绝'}[p.state]}</Button>)}
     {!loading&&!papers.length&&<p>暂无组卷记录。</p>}
    </div>
   </DisclosureCard>
  </aside></div>
  <DisclosureCard className="edu-paper-history" data-testid="paper-compare-details" title="比较已保存试卷">
   <PaperComparePanel papers={papers} loading={reading||busy}/>
  </DisclosureCard>
 </div>;
}
