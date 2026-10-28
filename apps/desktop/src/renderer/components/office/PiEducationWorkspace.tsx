import { useEffect, useRef, useState } from 'react';
import type { AiConversationWorkspace } from '../../../shared/contracts';
import type { XiaozhiWorkspaceSnapshot,XiaozhiStartInput, XiaozhiAgentEvent } from '../../../shared/xiaozhi-agent';
import { createEventReceiver,type XiaozhiEventSynchronization } from '../../../shared/xiaozhi-event-receiver';
import {OfficeSynchronization,OfficeSynchronizationNotice,OfficeMutationBoundary} from './OfficeSynchronization';
import { XIAOZHI_SETTINGS_SCHEMA, XIAOZHI_SETTINGS_ERRORS, type XiaozhiSettingsView } from '../../../shared/xiaozhi-settings';
import { applyXiaozhiEvent, XIAOZHI_ERRORS } from '../../../shared/xiaozhi-projection';
import {publicMessageText,type XiaozhiMessagePresentation} from '../../../shared/xiaozhi-message-presentation';
import { AiConversationSidebar } from '../AiConversationSidebar';
import { PiConversationSurface } from './PiConversationSurface';
import {PiGoalControl} from './PiGoalControl';
import { OfficeComposer } from './OfficeComposer';
import { OfficeComposerState,OfficeComposerSeed } from './OfficeComposerState';
import { PiCopyApproval } from './PiCopyApproval';
import {PiLearningReview} from './PiLearningReview';
import {PiQuestionCollection} from './PiQuestionCollection';
import {PiQuestionReview} from './PiQuestionReview';
import {PiPaperReview} from './PiPaperReview';
import {PiPracticeReview} from './PiPracticeReview';
import { PiTextChangeCard } from './PiTextChangeCard';
import {PiOfficeArtifactCard} from './PiOfficeArtifactCard';
import { PiControlCards } from './PiControlCards';
import { PiTaskPlan } from './PiTaskPlan';
import { PiWorkspaceActivity } from './PiWorkspaceActivity';
import { PiSkillSettings } from './PiSkillSettings';
import { PiWorkspaceShell } from './PiWorkspaceShell';
import { PiWorkspaceContext } from './PiWorkspaceContext';
import { PiWorkspaceFiles } from './PiWorkspaceFiles';
import {usePiAttachments} from './usePiAttachments';
import { createPiSnapshotHydrator } from './pi-snapshot-hydrator';
import { useDesktopCommands, useDesktopNavigation } from '../desktop/DesktopFrame';
import './pi-education-workspace.css';

async function readPiSnapshot(target: string) {
  const current = await window.omniEdu?.getXiaozhiSnapshot(target);
  const settings = await window.omniEdu?.getXiaozhiSettings({ sessionId: target });
  if (!current) throw Error('snapshot_unavailable');
  return { current, settings };
}

export function PiEducationWorkspace({ onLeave, onSettings, visible = true }: { onLeave: () => void; onSettings: () => void; visible?: boolean }) {
  const navigation=useDesktopNavigation(),navigationRef=useRef(navigation);navigationRef.current=navigation;
  const active=useRef(false);
  const visibleRef=useRef(visible);visibleRef.current=visible;
  const [workspace, setWorkspace] = useState<AiConversationWorkspace>({ folders: [], sessions: [], archivedFolders: [], archivedSessions: [] });
  const [id, setId] = useState('');
  const [snapshot, setSnapshot] = useState<XiaozhiWorkspaceSnapshot>();
  const attachments=usePiAttachments(id,visible,snapshot?.projection.turns.flatMap(turn=>turn.items)||[]);
  const [fileReveal,setFileReveal]=useState<{sessionId:string;id:string;path:string}>();
  const [models, setModels] = useState<XiaozhiSettingsView>(), [modelSelecting, setModelSelecting] = useState(false);
  const [returnHydrating,setReturnHydrating]=useState(false);
  const [loadingEarlier,setLoadingEarlier]=useState(false);
  const [eventSync,setEventSync]=useState<XiaozhiEventSynchronization>('ready'),[refreshFailed,markRefreshFailed]=useState(false);
  const refreshing=useRef(false),refreshFailure=useRef(false),snapshotRef=useRef(snapshot);snapshotRef.current=snapshot;
  function setHydrating(value:boolean){refreshing.current=value;setReturnHydrating(value);}
  function setRefreshFailed(value:boolean){refreshFailure.current=value;markRefreshFailed(value);}
  const [hasEntered,setHasEntered]=useState(visible);
  useEffect(()=>{if(visible)setHasEntered(true);},[visible]);
  const modelLock = useRef(false);
  const [notice, setNotice] = useState('');
  const [skillsOpen, setSkillsOpen] = useState(false);
  const [compactBusy, setCompactBusy] = useState(false);
  const compactLock = useRef(false);
  const compactAttempt = useRef<{ sessionId: string; commandId: string } | undefined>(undefined);
  const idRef = useRef('');
  const attempt = useRef<XiaozhiStartInput | undefined>(undefined);
  const queueAttempt=useRef<{sessionId:string;commandId:string;text:string;mode:'steer'|'followUp'}|undefined>(undefined);
  const sequences = useRef(new Map<string, number>());
  const loadingEarlierRef=useRef(false);
  const eventReceiver = useRef<ReturnType<typeof createEventReceiver> | undefined>(undefined);
  const hydration = useRef<ReturnType<typeof createPiSnapshotHydrator<Awaited<ReturnType<typeof readPiSnapshot>>>> | undefined>(undefined);
  if (!hydration.current) hydration.current = createPiSnapshotHydrator({
    read: readPiSnapshot,
    publish: ({ current, settings }) => {
      if (settings?.ok) setModels(settings.value);
      if (!current.eventPersistence && !current.projection.needsHydration) eventReceiver.current?.seed(current.eventCursors || []);
      for (const cursor of current.eventCursors || []) sequences.current.set(cursor.runId, cursor.sequence);
      if (current.eventPersistence === 'unavailable') setNotice('本轮过程未能保存，执行已停止。请重启后重试，已保存的记录会保留。');
      const turn = current.projection.turns.at(-1);
      if (turn && current.running) sequences.current.set(turn.id, Math.max(sequences.current.get(turn.id) || 0, current.projection.sourceSequence));
      setSnapshot(current);
      setRefreshFailed(false);
      setNotice(value => value === '无法刷新本地会话，请重试。' ? '' : value);
    },
    failed: () => { setRefreshFailed(true); setNotice('无法刷新本地会话，请重试。'); },
  });
  const syncBlocked=!snapshot||returnHydrating||refreshFailed||eventSync!=='ready'||Boolean(snapshot.projection.needsHydration||snapshot.eventPersistence);
  function mutationsBlocked(){const view=snapshotRef.current;return !view||view.projection.threadId!==idRef.current||refreshing.current||refreshFailure.current||eventReceiver.current?.synchronization()!=='ready'||Boolean(view.projection.needsHydration||view.eventPersistence);}
  function requireSynchronized(){if(mutationsBlocked())throw Error('过程记录正在同步，请稍后再试。');}
  async function refreshCurrent(){
    if(refreshing.current)return;const target=idRef.current,token=hydration.current!.token();setHydrating(true);
    try{await hydrate(target);}catch{if(active.current&&hydration.current!.token()===token)setRefreshFailed(true);}
    finally{if(active.current&&hydration.current!.token()===token)setHydrating(false);}
  }
  const journalRunId = snapshot?.projection.turns.at(-1)?.id;
  useEffect(() => {
    if (!visible || !snapshot?.running || !id || !journalRunId) return;
    const timer = setInterval(() => eventReceiver.current?.poll(id, journalRunId), 1500);
    return () => clearInterval(timer);
  }, [visible, id, snapshot?.running, journalRunId]);
  const refreshList = async () => { const list = await window.omniEdu?.listAiConversations(); if (list) setWorkspace(list); };
  async function hydrate(target: string, fresh = true) {
    if(!active.current||idRef.current!==target)return;
    await hydration.current!.hydrate(target, fresh);
  }
  async function open(target: string,record=true) {
    if(!active.current)return;
    hydration.current!.open(target);
    const token=hydration.current!.token();
    loadingEarlierRef.current=false;setLoadingEarlier(false);
    idRef.current = target; snapshotRef.current=undefined;setId(target); setSnapshot(undefined); setModels(undefined); setNotice(''); sequences.current.clear();
    eventReceiver.current?.reset();
    setHydrating(false);setRefreshFailed(false);
    if(record&&visibleRef.current&&navigationRef.current.target.view==='ai')navigation.navigate({view:'ai',sessionId:target});
    try{localStorage.setItem('xiaozhi.current-session.v1',target);}catch{/* Navigation remains usable without UI preference storage. */}
    attempt.current = undefined;
    queueAttempt.current=undefined;
    compactAttempt.current=undefined;
    try { await hydrate(target); } catch { if (active.current && hydration.current!.token() === token) setNotice('无法读取本地会话，请重试。'); }
  }
  async function fresh(folderId: string | null = null) {
    const detail = await window.omniEdu?.createAiConversationSession({ title: '新对话', folderId });
    if(!active.current)return;
    if (detail) { await open(detail.session.id); await refreshList(); }
  }
  async function loadEarlier() {
    const current=snapshotRef.current,target=idRef.current;
    const before=current?.projection.turns[0]?.id;
    if(loadingEarlierRef.current||!current||!target||!before||!current.projection.hasMoreHistory)return;
    loadingEarlierRef.current=true;setLoadingEarlier(true);
    try{
      const page=await window.omniEdu?.getXiaozhiHistoryPage({sessionId:target,before,limit:40});
      if(!page||idRef.current!==target)return;
      eventReceiver.current?.seed(page.eventCursors);
      for(const cursor of page.eventCursors)sequences.current.set(cursor.runId,Math.max(sequences.current.get(cursor.runId)||0,cursor.sequence));
      setSnapshot(previous=>{
        if(!previous||previous.projection.threadId!==target)return previous;
        const existing=new Set(previous.projection.turns.map(turn=>turn.id));
        const earlier=page.projection.turns.filter(turn=>!existing.has(turn.id));
        const cursors=new Map((previous.eventCursors||[]).map(cursor=>[`${cursor.runId}:${cursor.generation}`,cursor]));
        for(const cursor of page.eventCursors)cursors.set(`${cursor.runId}:${cursor.generation}`,cursor);
        return {...previous,eventCursors:[...cursors.values()],legacyHistory:previous.legacyHistory||page.legacyHistory,
          projection:{...previous.projection,turns:[...earlier,...previous.projection.turns],hasMoreHistory:page.projection.hasMoreHistory}};
      });
    }catch{
      if(idRef.current===target)setNotice('加载较早的消息失败，请重试。');
      throw Error('history_page_failed');
    }finally{
      loadingEarlierRef.current=false;
      if(active.current)setLoadingEarlier(false);
    }
  }
  useDesktopCommands(command=>{if(visible&&command==='new-chat'&&idRef.current){void fresh().catch(()=>setNotice('无法创建本地对话，请重试。'));return true;}return false;},10);
  useEffect(()=>{
    if(!visible){setSkillsOpen(false);return;}
    const target=idRef.current;if(!target)return;
    const token=hydration.current!.token();
    let live=true;setHydrating(true);
    void (async()=>{
      const list=await window.omniEdu?.listAiConversations();if(!live||!active.current||hydration.current!.token()!==token)return;
      if(list)setWorkspace(list);
      if(list&&!list.sessions.some(session=>session.id===target)){if(list.sessions[0])await open(list.sessions[0].id);else await fresh();}
      else await hydrate(target);
    })().catch(()=>{if(live&&active.current&&hydration.current!.token()===token){setRefreshFailed(true);setNotice('无法刷新本地会话，请重试。');}}).finally(()=>{if(live&&active.current&&hydration.current!.token()===token)setHydrating(false);});
    return()=>{live=false;};
  },[visible]);
  useEffect(()=>{if(visible&&id&&!returnHydrating)navigation.flush();},[id,visible,returnHydrating,navigation.flush]);
  useEffect(()=>{
    const target=navigation.target.sessionId;
    if(!target||target===idRef.current||!idRef.current)return;
    if(workspace.sessions.some(session=>session.id===target))void open(target,false);
    else{let live=true;void (async()=>{const list=await window.omniEdu?.listAiConversations();if(!live||!active.current||navigationRef.current.target.sessionId!==target)return;if(list)setWorkspace(list);if(list?.sessions.some(session=>session.id===target))await open(target,false);else{setNotice('该会话已不可用，已从窗口导航中移除。');navigation.reject(target);}})().catch(()=>{if(live)setNotice('无法读取本地会话，请重试。');});return()=>{live=false;};}
  },[navigation.target.sessionId,workspace.sessions]);
  useEffect(() => {
    if(!hasEntered)return;
    let live = true;active.current=true;
    void (async () => {
      const list = await window.omniEdu?.listAiConversations(); if (!live) return;
      if (list) setWorkspace(list);
      let remembered='';try{remembered=localStorage.getItem('xiaozhi.current-session.v1')||'';}catch{/* Fall back to current active list. */}
      const requested=navigationRef.current.target.sessionId;
      if(requested&&!list?.sessions.some(session=>session.id===requested))navigationRef.current.reject(requested);
      const first = list?.sessions.find(session=>session.id===(requested||remembered)) || list?.sessions[0]; if (first) await open(first.id); else await fresh();
    })().catch(() => { if (live) setNotice('无法加载本地对话。'); });
    const applyEvent = (event: XiaozhiAgentEvent) => {
      if (!live || event.sessionId !== idRef.current || event.sequence <= (sequences.current.get(event.runId) || 0)) return;
      hydration.current!.changed(); // In-flight older snapshots must re-read after the burst.
      sequences.current.set(event.runId, event.sequence);
      if (hydration.current!.needsRecovery()) void hydrate(event.sessionId, false).catch(() => undefined);
      setSnapshot(previous => {
        if (!previous || previous.projection.threadId !== event.sessionId) return previous;
        const turns = previous.projection.turns.slice();
        let index = turns.findIndex(turn => turn.id === event.runId);
        if (index < 0) {
          const pending = turns.at(-1)?.id === 'pending-send' ? turns.pop() : undefined;
          turns.push({ id: event.runId, status: 'running', items: pending?.items || [] }); index = turns.length - 1;
        }
        turns[index] = applyXiaozhiEvent(turns[index], event);
        const approvals = event.kind === 'approval' ? [...(previous.approvals || []).filter(item => item.id !== event.approval.id), event.approval] : previous.approvals;
        const changes = event.kind === 'change' ? [...(previous.changes || []).filter(item => item.id !== event.change.id), event.change] : previous.changes;
        const officeArtifacts=event.kind==='office_artifact'?[...(previous.officeArtifacts||[]).filter(item=>item.id!==event.artifact.id),event.artifact]:previous.officeArtifacts;
        const learningReviews=event.kind==='learning_review'?[...(previous.learningReviews||[]).filter(item=>item.id!==event.review.id),event.review]:previous.learningReviews;
        const paperReviews=event.kind==='paper_review'?[...(previous.paperReviews||[]).filter(item=>item.id!==event.review.id),event.review]:previous.paperReviews;
        const practiceReviews=event.kind==='practice_review'?[...(previous.practiceReviews||[]).filter(item=>item.id!==event.review.id),event.review]:previous.practiceReviews;
        const questionCollections=event.kind==='question_collection'?[...(previous.questionCollections||[]).filter(item=>item.id!==event.review.id),event.review]:previous.questionCollections;
        const questionReviews=event.kind==='question_review'?[...(previous.questionReviews||[]).filter(item=>item.id!==event.review.id),event.review]:previous.questionReviews;
        const controls=event.kind === 'control' ? [...(previous.controls || []).filter(item=>item.id !== event.control.id),event.control] : previous.controls;
        const usage=event.kind==='usage'?[...(previous.usage || []).filter(item=>item.runId!==event.usage.runId),event.usage]:previous.usage;
        return { ...previous, approvals, changes, officeArtifacts, learningReviews, questionCollections, questionReviews, practiceReviews, paperReviews, controls, usage, ...(event.kind==='goal'?{goal:event.goal}:{}),...(event.kind==='task'?{task:event.task,taskUnavailable:false,...(event.goal?{goal:event.goal}:{})}:{}), ...(event.kind === 'compaction' && !event.automatic ? { operation: 'compact' as const } : {}), running: event.kind === 'status' ? event.status === 'running' : previous.running,
          projection: { ...previous.projection, sourceSequence: event.sequence, turns } };
      });
      if (event.kind === 'status') {
        void refreshList();
        if (event.status !== 'running' && !hydration.current!.hasFailed()) void hydrate(event.sessionId).catch(() => undefined);
      }
    };
    const receiver = createEventReceiver({
      list: input => { if (!window.omniEdu) return Promise.reject(Error('configuration')); return window.omniEdu.listXiaozhiEvents(input); },
      apply: applyEvent,
      syncChanged: state=>{if(live)setEventSync(state);},
      unavailable: () => { if (live) { setNotice('本轮过程未能保存，执行已停止。请重启后重试，已保存的记录会保留。'); if (!hydration.current!.hasFailed()) void hydrate(idRef.current).catch(()=>undefined); } },
      gapFailure: () => { if (live && !hydration.current!.hasFailed()) void hydrate(idRef.current).catch(()=>undefined); },
    });
    eventReceiver.current = receiver;
    const unsubscribe = window.omniEdu?.onXiaozhiEvent(event => { if (live && event.sessionId === idRef.current) receiver.accept(event); });
    return () => { live = false; active.current=false; hydration.current!.reset(); receiver.reset(); unsubscribe?.(); };
  }, [hasEntered]);
  async function send(prompt: string,presentation?:XiaozhiMessagePresentation) {
    requireSynchronized();
    if (!id || !window.omniEdu) throw new Error('configuration');
    setNotice('');
    setSnapshot(previous => previous ? { ...previous, running: true, projection: { ...previous.projection,
      turns: [...previous.projection.turns, { id: 'pending-send', status: 'running', items: [{ id: 'pending-user', kind: 'message', role: 'user', text: publicMessageText(prompt,presentation) }] }] } } : previous);
    if (!attempt.current || attempt.current.sessionId !== id || attempt.current.prompt !== prompt || JSON.stringify(attempt.current.presentation)!==JSON.stringify(presentation)) attempt.current = { sessionId: id, prompt, ...(presentation?{presentation}:{}), commandId: `xicmd_${crypto.randomUUID()}`,
      ...(attachments.selections.length?{attachments:attachments.selections}:{}) };
    let result;
    try{result=await window.omniEdu.startXiaozhi(attempt.current);}catch(error){await hydrate(id).catch(()=>undefined);throw error;}
    if (!result.ok) { attempt.current=undefined;setNotice(XIAOZHI_ERRORS[result.error]); await Promise.all([hydrate(id),attachments.refresh()]); throw new Error(result.error); }
    attempt.current = undefined;
    await Promise.all([hydrate(id), refreshList(),attachments.refresh()]).catch(() => setNotice('消息已接收，暂时无法刷新记录。'));
  }
  const projection = snapshot?.projection;
  const current = projection?.turns.at(-1);
  const compacting = snapshot?.running && snapshot.operation === 'compact';
  const activePlan = snapshot?.running ? snapshot.controls?.filter(control=>control.kind==='plan'&&control.runId===current?.id).at(-1) : undefined;
  async function compact() {
    if (mutationsBlocked() || !id || !snapshot || snapshot.running || compactLock.current) return;
    compactLock.current = true; setCompactBusy(true); setNotice(''); const target = id;
    if (compactAttempt.current?.sessionId !== target) compactAttempt.current = { sessionId: target, commandId: `xicmd_${crypto.randomUUID()}` };
    try {
      const result = await window.omniEdu?.compactXiaozhi(compactAttempt.current);
      if (!result?.ok) setNotice(result ? XIAOZHI_ERRORS[result.error] : '压缩请求未送达，请重试。');
      else compactAttempt.current = undefined;
      await hydrate(target);
    } catch { if (idRef.current === target) setNotice('压缩请求未确认，请重试。'); }
    finally { compactLock.current = false; setCompactBusy(false); }
  }
  return <OfficeComposerState key={id || 'loading'} sessionId={id}><OfficeSynchronization blocked={syncBlocked} isBlocked={mutationsBlocked}><OfficeComposerSeed text={navigation.target.sessionId===id?navigation.target.draft:undefined} onConsumed={()=>navigation.consumeDraft(id)}/><PiWorkspaceShell visible={visible} sessionKey={id} onNewChat={()=>void fresh(null)} title={workspace.sessions.find(session=>session.id===id)?.title||'新对话'}
    fileRequest={fileReveal?.sessionId===id?fileReveal.id:undefined}
    onLeave={onLeave} onSettings={onSettings} onSkills={()=>{if(!mutationsBlocked())setSkillsOpen(true);}}
    files={close=><PiWorkspaceFiles key={`${id}:${snapshot?.workspace?.label||''}`} sessionId={id} changes={snapshot?.changes} officeArtifacts={snapshot?.officeArtifacts} reveal={fileReveal?.sessionId===id?fileReveal:undefined} onClose={close} onChoose={()=>void (async()=>{
      requireSynchronized();const target=id;const result=await window.omniEdu?.selectXiaozhiWorkspace(target);if(result&&!result.ok)setNotice(XIAOZHI_ERRORS[result.error]);else await hydrate(target);
    })().catch(()=>setNotice('无法选择教学工作目录，请重试。'))}/>}
    aside={<PiWorkspaceContext sessionId={id} snapshot={snapshot} compactBusy={compactBusy} compacting={Boolean(compacting)} onCompact={()=>void compact()} onRefresh={()=>hydrate(id)}
      goalControl={<PiGoalControl key={id} sessionId={id} goal={snapshot?.goal} running={Boolean(snapshot?.running)} disabled={!snapshot||!id||modelSelecting||returnHydrating||attachments.hasAttachments} onRefresh={()=>hydrate(id)}/>}/>}
    sidebar={<AiConversationSidebar codexStyle inline folders={workspace.folders} sessions={workspace.sessions} activeSessionId={id}
      onOpenSession={target=>open(target)} onNewSession={fresh} onLeaveAi={onLeave}
      onCreateFolder={async name => { const list = await window.omniEdu?.createAiConversationFolder({ name }); if (list) setWorkspace(list); }}
      onMoveSession={async (session, folder) => { const list = await window.omniEdu?.moveAiConversationSession(session, folder); if (list) setWorkspace(list); }}
      onRename={async (target, value) => { const list = target.type === 'folder' ? await window.omniEdu?.renameAiConversationFolder(target.id, { name: value }) : await window.omniEdu?.renameAiConversationSession(target.id, { title: value }); if (list) setWorkspace(list); }}
      onArchive={async target => { const list = target.type === 'folder' ? await window.omniEdu?.archiveAiConversationFolder(target.id) : await window.omniEdu?.archiveAiConversationSession(target.id); if (list) setWorkspace(list); if (target.id === id) await fresh(); }} />}>
    <section className="work-panel ai-chat-surface">
      {snapshot?.legacyHistory && <p className="pi-history-note">旧对话保留供参考；小智从本轮开始使用新的上下文。</p>}
      {snapshot?.interruptedSend && <p className="pi-history-note" role="status">上次消息接收过程中中断。请重新发送，旧请求不会自动继续。</p>}
      {snapshot?.studentContext&&<p className="pi-history-note" data-testid="pi-student-selection">学习对话 · {snapshot.studentContext.label}{snapshot.studentContext.status==='active'?' · 仅使用必要的脱敏学习记录':' · 档案已归档或不可用，无法读取新记录'}</p>}
      {notice && <p role="alert" className="pi-history-note">{notice}</p>}
      {snapshot?.taskUnavailable&&<p role="alert" className="pi-history-note">本轮要求记录暂时无法核对，请重新读取会话。</p>}
      {syncBlocked&&<OfficeSynchronizationNotice unavailable={eventSync==='unavailable'||refreshFailed||Boolean(snapshot?.eventPersistence)} refreshing={returnHydrating} onRefresh={()=>void refreshCurrent()}/>}
      <div className="ai-conversation-frame">{projection ? <PiConversationSurface visible={visible} projection={projection} onLoadEarlier={loadingEarlier?undefined:loadEarlier} renderAttachments={attachments.renderHistory} renderViewedImages={attachments.renderViewed} running={Boolean(snapshot?.running)} controls={snapshot?.controls} renderApprovals={turnId => snapshot?.approvals?.filter(item => item.runId === turnId).map(approval => <PiCopyApproval key={approval.id} approval={approval} onDecision={async (approvalId, decision) => {
        const target = id; const result = await window.omniEdu?.decideXiaozhi({ sessionId: target, approvalId, decision });
        if (!result?.ok) throw new Error('decision_failed'); await hydrate(target);
      }} />).concat((snapshot?.changes||[]).filter(item=>item.runId===turnId).map(change=><PiTextChangeCard key={change.id} sessionId={id} change={change} running={Boolean(snapshot?.running)} onRefresh={()=>hydrate(id)} onOpen={path=>setFileReveal({sessionId:id,id:crypto.randomUUID(),path})}/>)).concat((snapshot?.officeArtifacts||[]).filter(item=>item.runId===turnId).map(artifact=><PiOfficeArtifactCard key={artifact.id} sessionId={id} artifact={artifact} running={Boolean(snapshot?.running)} onRefresh={()=>hydrate(id)} onOpen={path=>setFileReveal({sessionId:id,id:crypto.randomUUID(),path})}/>)).concat((snapshot?.learningReviews||[]).filter(item=>item.runId===turnId).map(review=><PiLearningReview key={review.id} sessionId={id} review={review} onRefresh={()=>hydrate(id)}/>)).concat((snapshot?.questionCollections||[]).filter(item=>item.runId===turnId).map(review=><PiQuestionCollection key={review.id} sessionId={id} review={review} onRefresh={()=>hydrate(id)}/>)).concat((snapshot?.questionReviews||[]).filter(item=>item.runId===turnId&&!item.collectionId).map(review=><PiQuestionReview key={review.id} sessionId={id} review={review} onRefresh={()=>hydrate(id)}/>)).concat((snapshot?.paperReviews||[]).filter(item=>item.runId===turnId).map(review=><PiPaperReview key={review.id} sessionId={id} review={review} running={Boolean(snapshot?.running)} onRefresh={()=>hydrate(id)}/>)).concat((snapshot?.practiceReviews||[]).filter(item=>item.runId===turnId).map(review=><PiPracticeReview key={review.id} sessionId={id} review={review} onRefresh={()=>hydrate(id)}/>)).concat(<PiControlCards key={`controls:${turnId}`} items={snapshot?.controls?.filter(item=>item.runId === turnId) || []} onAnswer={async(controlId,answer)=>{
        const target=id; const result=await window.omniEdu?.answerXiaozhi({sessionId:target,controlId,answer}); if(!result?.ok)throw new Error('answer_failed'); await hydrate(target);
      }} sessionId={id} onMutation={async input=>{
        const target=id; const result=await window.omniEdu?.mutateXiaozhiQueue(input); await hydrate(target);
        if (!result?.ok) throw new Error('queue_mutation_failed');
      }}/>) } /> : <p className="pi-history-note" role="status">正在读取本地对话…</p>}</div>
      <OfficeComposer nativeAppearance visible={visible} sessionId={id || 'loading'} status={snapshot?.running ? current?.status || 'running' : current?.status}
        showQuickStarts={!projection?.turns.length&&!snapshot?.running}
        taskSummary={<><PiWorkspaceActivity snapshot={snapshot} compactBusy={compactBusy}/><OfficeMutationBoundary><PiGoalControl key={id} sessionId={id} goal={snapshot?.goal} task={snapshot?.task} running={Boolean(snapshot?.running)} disabled={!snapshot||!id||modelSelecting||returnHydrating||attachments.hasAttachments||syncBlocked} onRefresh={()=>hydrate(id)}/></OfficeMutationBoundary>{activePlan&&(!snapshot?.goal||['completed','ended'].includes(snapshot.goal.state))&&<PiTaskPlan plan={activePlan} sessionId={id} compact/>}</>}
        skills={snapshot?.skills}
        disabled={!snapshot || !id || modelSelecting || Boolean(snapshot.studentContext&&snapshot.studentContext.status!=='active')} model={projection?.model || 'DeepSeek'} models={models?.models.map(item => ({ id: item.id, label: item.id })) || [{ id: projection?.model || 'DeepSeek', label: projection?.model || 'DeepSeek' }]}
        onModelChange={!models?.sessionModel || models.sessionModel.locked || models.locked ? undefined : model => {
          if (mutationsBlocked() || modelLock.current || snapshot?.running) return;
          modelLock.current = true; setModelSelecting(true); const target = id;
          void (async () => {
            const result = await window.omniEdu?.selectXiaozhiModel({ schemaVersion: XIAOZHI_SETTINGS_SCHEMA, sessionId: target, version: models.sessionModel!.version, model });
            if (!active.current || idRef.current !== target) return;
            if (!result?.ok) setNotice(result ? XIAOZHI_SETTINGS_ERRORS[result.error] : '模型没有切换，请重试。');
            await hydrate(target);
          })().catch(() => { if (active.current && idRef.current === target) setNotice('模型没有切换，请重试。'); })
            .finally(() => { modelLock.current = false; if (active.current) setModelSelecting(false); });
        }}
        onQueue={compacting ? undefined : async(text,mode)=>{
          requireSynchronized();
          const target=id; if(!queueAttempt.current || queueAttempt.current.sessionId !== target || queueAttempt.current.text !== text || queueAttempt.current.mode !== mode)queueAttempt.current={sessionId:target,text,mode,commandId:`xicmd_${crypto.randomUUID()}`};
          const result=await window.omniEdu?.queueXiaozhi(queueAttempt.current); if(!result?.ok){setNotice(result?XIAOZHI_ERRORS[result.error]:'补充未发送。');throw new Error('queue_failed');}queueAttempt.current=undefined;await hydrate(target);
        }}
        attachments={attachments.cards} hasAttachments={attachments.hasAttachments} sendBlocked={attachments.sendBlocked} attachDisabled={attachments.busy||Boolean(snapshot?.running)||syncBlocked} onAttach={()=>{if(!mutationsBlocked())void attachments.choose();}} onFilesSelected={files=>{if(!mutationsBlocked())void attachments.importFiles(files);}}
        onPermissions={onSettings} attachLabel="添加本地附件" permissionLabel={snapshot?.workspace ? '工作目录 · 写入需确认' : '教师资料 · 只读'} onWorkspace={() => { void (async () => {
          requireSynchronized();setNotice(''); const target = id; const result = await window.omniEdu?.selectXiaozhiWorkspace(target);
          if (result && !result.ok) setNotice(XIAOZHI_ERRORS[result.error]); else await hydrate(target);
        })().catch(() => setNotice('无法选择教学工作目录，请重试。')); }} onSubmit={send} onStop={async () => { const result = await window.omniEdu?.stopXiaozhi(id); if (!result?.ok) throw new Error('stop_failed'); }} />
    </section>
    {attachments.modal}
    {skillsOpen && <PiSkillSettings running={Boolean(snapshot?.running)} onClose={() => setSkillsOpen(false)} onChanged={() => hydrate(id)} />}
  </PiWorkspaceShell></OfficeSynchronization></OfficeComposerState>;
}
