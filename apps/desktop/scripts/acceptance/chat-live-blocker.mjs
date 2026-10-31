/** Accept only the runner's already public, run-bound DTO. No raw SDK objects. */
export function readOnlyRunBlocker(turn) {
  const questions = (turn.questions || []).filter(item => item.state === 'pending').map(item => ({
    id:item.id, callId:item.callId, state:item.state, text:item.text,
    options:item.options,
  }));
  const approvals = (turn.approvals || []).filter(item => ['pending','uncertain'].includes(item.state))
    .map(item => ({id:item.id,callId:item.callId,state:item.state}));
  const inputTool = turn.tools?.some(item => item.status === 'waiting_input');
  const approvalTool = turn.tools?.some(item => item.status === 'waiting_approval');
  const kind = turn.status === 'waiting_input' || questions.length || inputTool ? 'waiting_input'
    : turn.status === 'waiting_approval' || approvals.length || approvalTool ? 'waiting_approval' : undefined;
  if (!kind) return;
  return {kind,observedStatus:turn.status,questions,approvals,
    tools:(turn.tools || []).map(item => ({id:item.id,name:item.name,status:item.status,
      summary:item.summary ? {text:item.summary.text,query:item.summary.query,scope:item.summary.scope} : undefined})),
  };
}

/** Browser-side cleanup. The stop IPC is session-scoped, so verify its only
 * active run is exactly the run admitted by this isolated runner before calling.
 * Never answer controls, approve writes, resume a run, or return the snapshot. */
export async function stopOwnedChatRun({sessionId,runId}) {
  const snapshot = await window.omniEdu.getXiaozhiSnapshot(sessionId);
  if (snapshot.projection.threadId !== sessionId) return {requested:false,reason:'session_mismatch'};
  const turn = snapshot.projection.turns.find(item => item.id === runId);
  if (!turn) return {requested:false,reason:'owned_run_missing'};
  const active = snapshot.projection.turns.filter(item => ['running','waiting_input','waiting_approval'].includes(item.status));
  if (active.some(item => item.id !== runId)) return {requested:false,reason:'different_active_run'};
  if (!['running','waiting_input','waiting_approval'].includes(turn.status))
    return {requested:false,reason:'already_terminal',status:turn.status};
  const result = await window.omniEdu.stopXiaozhi(sessionId);
  return {requested:true,ok:result?.ok === true};
}
