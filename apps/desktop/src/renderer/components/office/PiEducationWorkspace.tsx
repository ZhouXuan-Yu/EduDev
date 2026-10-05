import { useEffect, useRef, useState } from 'react';
import type { AiConversationWorkspace } from '../../../shared/contracts';
import type { XiaozhiWorkspaceSnapshot,XiaozhiStartInput } from '../../../shared/xiaozhi-agent';
import { XIAOZHI_SETTINGS_SCHEMA, XIAOZHI_SETTINGS_ERRORS, type XiaozhiSettingsView } from '../../../shared/xiaozhi-settings';
import { applyXiaozhiEvent, XIAOZHI_ERRORS } from '../../../shared/xiaozhi-projection';
import {publicMessageText,type XiaozhiMessagePresentation} from '../../../shared/xiaozhi-message-presentation';
import { AiConversationSidebar } from '../AiConversationSidebar';
import { PiConversationSurface } from './PiConversationSurface';
import { PiTaskPlan } from './PiTaskPlan';
import {PiGoalControl} from './PiGoalControl';
import { OfficeComposer } from './OfficeComposer';
import { OfficeComposerState,OfficeComposerSeed } from './OfficeComposerState';
import { PiCopyApproval } from './PiCopyApproval';
import {PiLearningReview} from './PiLearningReview';
import {PiQuestionReview} from './PiQuestionReview';
import {PiPracticeReview} from './PiPracticeReview';
import { PiTextChangeCard } from './PiTextChangeCard';
import {PiOfficeArtifactCard} from './PiOfficeArtifactCard';
import { PiControlCards } from './PiControlCards';
import { PiSkillSettings } from './PiSkillSettings';
import { PiWorkspaceShell } from './PiWorkspaceShell';
import { PiWorkspaceContext } from './PiWorkspaceContext';
import { PiWorkspaceActivity } from './PiWorkspaceActivity';
import { PiWorkspaceFiles } from './PiWorkspaceFiles';
import {usePiAttachments} from './usePiAttachments';
import { useDesktopCommands, useDesktopNavigation } from '../desktop/DesktopFrame';
import './pi-education-workspace.css';
import './pi-workspace-glass.css';

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
  const version = useRef(0), sequences = useRef(new Map<string, number>());
  const refreshList = async () => { const list = await window.omniEdu?.listAiConversations(); if (list) setWorkspace(list); };
  async function hydrate(target: string) {
    // A hidden/return refresh may finish after navigation changed the target.
    // It must not invalidate the new session's in-flight hydration stamp.
    if(!active.current||idRef.current!==target)return;
    const stamp = ++version.current;
    const current = await window.omniEdu?.getXiaozhiSnapshot(target);
    const settings = await window.omniEdu?.getXiaozhiSettings({ sessionId: target });
    if (!active.current || stamp !== version.current || idRef.current !== target) return;
    if (settings?.ok) setModels(settings.value);
    if (current) {
      const turn = current.projection.turns.at(-1);
      if (turn && current.running) sequences.current.set(turn.id, Math.max(sequences.current.get(turn.id) || 0, current.projection.sourceSequence));
      setSnapshot(current);
    }
  }
  async function open(target: string,record=true) {
    if(!active.current)return;
    idRef.current = target; setId(target); setSnapshot(undefined); setModels(undefined); setNotice(''); sequences.current.clear();
    if(record)navigation.navigate({view:'ai',sessionId:target});
    try{localStorage.setItem('xiaozhi.current-session.v1',target);}catch{/* Navigation remains usable without UI preference storage. */}
    attempt.current = undefined;
    queueAttempt.current=undefined;
    compactAttempt.current=undefined;
    try { await hydrate(target); } catch { setNotice('无法读取本地会话，请重试。'); }
  }
  async function fresh(folderId: string | null = null) {
    const detail = await window.omniEdu?.createAiConversationSession({ title: '新对话', folderId });
    if(!active.current||!visibleRef.current)return;
    if (detail) { await open(detail.session.id); await refreshList(); }
  }
  useDesktopCommands(command=>{if(visible&&command==='new-chat'&&idRef.current){void fresh().catch(()=>setNotice('无法创建本地对话，请重试。'));return true;}return false;},10);
  useEffect(()=>{
    if(!visible){setSkillsOpen(false);return;}
    const target=idRef.current;if(!target)return;
    let live=true;setReturnHydrating(true);
    void (async()=>{
      const list=await window.omniEdu?.listAiConversations();if(!live||!active.current)return;
      if(list)setWorkspace(list);
      if(list&&!list.sessions.some(session=>session.id===target)){if(list.sessions[0])await open(list.sessions[0].id);else await fresh();}
      else await hydrate(target);
    })().catch(()=>{if(live)setNotice('无法刷新本地会话，请重试。');}).finally(()=>{if(live)setReturnHydrating(false);});
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
    const unsubscribe = window.omniEdu?.onXiaozhiEvent(event => {
      if (!live || event.sessionId !== idRef.current || event.sequence <= (sequences.current.get(event.runId) || 0)) return;
      version.current++; // In-flight older hydration may not overwrite new events.
      sequences.current.set(event.runId, event.sequence);
      setSnapshot(previous => {
        if (!previous) { void hydrate(event.sessionId); return previous; }
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
        const practiceReviews=event.kind==='practice_review'?[...(previous.practiceReviews||[]).filter(item=>item.id!==event.review.id),event.review]:previous.practiceReviews;
        const questionReviews=event.kind==='question_review'?[...(previous.questionReviews||[]).filter(item=>item.id!==event.review.id),event.review]:previous.questionReviews;
        const controls=event.kind === 'control' ? [...(previous.controls || []).filter(item=>item.id !== event.control.id),event.control] : previous.controls;
        const usage=event.kind==='usage'?[...(previous.usage || []).filter(item=>item.runId!==event.usage.runId),event.usage]:previous.usage;
        return { ...previous, approvals, changes, officeArtifacts, learningReviews, questionReviews, practiceReviews, controls, usage, ...(event.kind==='goal'?{goal:event.goal}:{}), ...(event.kind === 'compaction' && !event.automatic ? { operation: 'compact' as const } : {}), running: event.kind === 'status' ? event.status === 'running' : previous.running,
          projection: { ...previous.projection, sourceSequence: event.sequence, turns } };
      });
      if (event.kind === 'status') {
        void refreshList();
        if (event.status !== 'running') void hydrate(event.sessionId);
      }
    });
    return () => { live = false; active.current=false; version.current++; unsubscribe?.(); };
  }, [hasEntered]);
  async function send(prompt: string,presentation?:XiaozhiMessagePresentation) {
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
  const activePlan = snapshot?.running ? snapshot.controls?.filter(control=>control.kind==='plan'&&control.runId===current?.id).at(-1) : undefined;
  const compacting = snapshot?.running && snapshot.operation === 'compact';
  async function compact() {
    if (!id || !snapshot || snapshot.running || compactLock.current) return;
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
  return <OfficeComposerState key={id || 'loading'}><OfficeComposerSeed text={navigation.target.sessionId===id?navigation.target.draft:undefined} onConsumed={()=>navigation.consumeDraft(id)}/><PiWorkspaceShell visible={visible} title={workspace.sessions.find(session=>session.id===id)?.title||'新对话'}
    fileRequest={fileReveal?.sessionId===id?fileReveal.id:undefined}
    onLeave={onLeave} onSettings={onSettings} onSkills={()=>setSkillsOpen(true)}
    files={close=><PiWorkspaceFiles key={`${id}:${snapshot?.workspace?.label||''}`} sessionId={id} changes={snapshot?.changes} officeArtifacts={snapshot?.officeArtifacts} reveal={fileReveal?.sessionId===id?fileReveal:undefined} onClose={close} onChoose={()=>void (async()=>{
      const target=id;const result=await window.omniEdu?.selectXiaozhiWorkspace(target);if(result&&!result.ok)setNotice(XIAOZHI_ERRORS[result.error]);else await hydrate(target);
    })().catch(()=>setNotice('无法选择教学工作目录，请重试。'))}/>}
    aside={<PiWorkspaceContext sessionId={id} snapshot={snapshot} compactBusy={compactBusy} compacting={Boolean(compacting)} onCompact={()=>void compact()} onRefresh={()=>hydrate(id)}/>}
    sidebar={<AiConversationSidebar codexStyle folders={workspace.folders} sessions={workspace.sessions} activeSessionId={id}
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
      <div className="ai-conversation-frame">{projection ? <PiConversationSurface visible={visible} projection={projection} renderAttachments={attachments.renderHistory} renderViewedImages={attachments.renderViewed} running={Boolean(snapshot?.running)} controls={snapshot?.controls} renderApprovals={turnId => snapshot?.approvals?.filter(item => item.runId === turnId).map(approval => <PiCopyApproval key={approval.id} approval={approval} onDecision={async (approvalId, decision) => {
        const target = id; const result = await window.omniEdu?.decideXiaozhi({ sessionId: target, approvalId, decision });
        if (!result?.ok) throw new Error('decision_failed'); await hydrate(target);
      }} />).concat((snapshot?.changes||[]).filter(item=>item.runId===turnId).map(change=><PiTextChangeCard key={change.id} sessionId={id} change={change} running={Boolean(snapshot?.running)} onRefresh={()=>hydrate(id)} onOpen={path=>setFileReveal({sessionId:id,id:crypto.randomUUID(),path})}/>)).concat((snapshot?.officeArtifacts||[]).filter(item=>item.runId===turnId).map(artifact=><PiOfficeArtifactCard key={artifact.id} sessionId={id} artifact={artifact} running={Boolean(snapshot?.running)} onRefresh={()=>hydrate(id)} onOpen={path=>setFileReveal({sessionId:id,id:crypto.randomUUID(),path})}/>)).concat((snapshot?.learningReviews||[]).filter(item=>item.runId===turnId).map(review=><PiLearningReview key={review.id} sessionId={id} review={review} onRefresh={()=>hydrate(id)}/>)).concat((snapshot?.questionReviews||[]).filter(item=>item.runId===turnId).map(review=><PiQuestionReview key={review.id} sessionId={id} review={review} onRefresh={()=>hydrate(id)}/>)).concat((snapshot?.practiceReviews||[]).filter(item=>item.runId===turnId).map(review=><PiPracticeReview key={review.id} sessionId={id} review={review} onRefresh={()=>hydrate(id)}/>)).concat(<PiControlCards key={`controls:${turnId}`} items={snapshot?.controls?.filter(item=>item.runId === turnId) || []} onAnswer={async(controlId,answer)=>{
        const target=id; const result=await window.omniEdu?.answerXiaozhi({sessionId:target,controlId,answer}); if(!result?.ok)throw new Error('answer_failed'); await hydrate(target);
      }} sessionId={id} onMutation={async input=>{
        const target=id; const result=await window.omniEdu?.mutateXiaozhiQueue(input); await hydrate(target);
        if (!result?.ok) throw new Error('queue_mutation_failed');
      }}/>) } /> : <p className="pi-history-note" role="status">正在读取本地对话…</p>}</div>
      <OfficeComposer visible={visible} sessionId={id || 'loading'} status={snapshot?.running ? current?.status || 'running' : current?.status}
        taskSummary={<><PiWorkspaceActivity snapshot={snapshot} compactBusy={compactBusy}/><PiGoalControl key={id} sessionId={id} goal={snapshot?.goal} running={Boolean(snapshot?.running)} disabled={!snapshot||!id||modelSelecting||returnHydrating||attachments.hasAttachments} onRefresh={()=>hydrate(id)}/>{activePlan&&(!snapshot?.goal||['completed','ended'].includes(snapshot.goal.state))&&<PiTaskPlan plan={activePlan} compact/>}</>}
        skills={snapshot?.skills}
        disabled={!snapshot || !id || modelSelecting || returnHydrating || Boolean(snapshot.studentContext&&snapshot.studentContext.status!=='active')} model={projection?.model || 'DeepSeek'} models={models?.models.map(item => ({ id: item.id, label: item.id })) || [{ id: projection?.model || 'DeepSeek', label: projection?.model || 'DeepSeek' }]}
        onModelChange={!models?.sessionModel || models.sessionModel.locked || models.locked ? undefined : model => {
          if (modelLock.current || snapshot?.running) return;
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
          const target=id; if(!queueAttempt.current || queueAttempt.current.sessionId !== target || queueAttempt.current.text !== text || queueAttempt.current.mode !== mode)queueAttempt.current={sessionId:target,text,mode,commandId:`xicmd_${crypto.randomUUID()}`};
          const result=await window.omniEdu?.queueXiaozhi(queueAttempt.current); if(!result?.ok){setNotice(result?XIAOZHI_ERRORS[result.error]:'补充未发送。');throw new Error('queue_failed');}queueAttempt.current=undefined;await hydrate(target);
        }}
        attachments={attachments.cards} hasAttachments={attachments.hasAttachments} sendBlocked={attachments.sendBlocked} attachDisabled={attachments.busy||Boolean(snapshot?.running)} onAttach={()=>void attachments.choose()}
        onPermissions={onSettings} attachLabel="添加本地附件" permissionLabel={snapshot?.workspace ? '工作目录 · 写入需确认' : '教师资料 · 只读'} onWorkspace={() => { void (async () => {
          setNotice(''); const target = id; const result = await window.omniEdu?.selectXiaozhiWorkspace(target);
          if (result && !result.ok) setNotice(XIAOZHI_ERRORS[result.error]); else await hydrate(target);
        })().catch(() => setNotice('无法选择教学工作目录，请重试。')); }} onSubmit={send} onStop={async () => { const result = await window.omniEdu?.stopXiaozhi(id); if (!result?.ok) throw new Error('stop_failed'); }} />
    </section>
    {attachments.modal}
    {skillsOpen && <PiSkillSettings running={Boolean(snapshot?.running)} onClose={() => setSkillsOpen(false)} onChanged={() => hydrate(id)} />}
  </PiWorkspaceShell></OfficeComposerState>;
}
