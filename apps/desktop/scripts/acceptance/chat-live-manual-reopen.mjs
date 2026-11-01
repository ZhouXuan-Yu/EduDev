import assert from 'node:assert/strict';

/** Public metadata only, sampled together after the real keyboard interaction. */
export async function manualReopenCheckpoint({sessionId, runId}) {
  const snapshot = await window.omniEdu.getXiaozhiSnapshot(sessionId);
  const turn = snapshot.projection.turns.find(item => item.id === runId);
  const events = (window.__uiChatEvents || []).filter(item => item.sessionId === sessionId && item.runId === runId);
  const terminal = events.find(item => item.kind === 'status' && ['completed','failed','interrupted'].includes(item.status));
  const element = [...document.querySelectorAll('.office-turn[data-turn-id]')].find(node => node.getAttribute('data-turn-id') === runId);
  return {sessionId, runId, observedAt: Date.now(), running: snapshot.running && turn?.status === 'running',
    turnStatus: turn?.status, sourceSequence: snapshot.projection.sourceSequence,
    eventSequence: Math.max(0, ...events.map(item => item.sequence)), terminalSequence: terminal?.sequence,
    expanded: element?.querySelector('[data-testid="agent-trace-toggle"]')?.getAttribute('aria-expanded')};
}

export async function reopenProcessDuringStream({page, turn, sessionId, runId, evidence}) {
  const trigger = turn.getByTestId('agent-trace-toggle');
  evidence.before = await page.evaluate(manualReopenCheckpoint, {sessionId, runId});
  assert.equal(evidence.before.expanded, 'false', 'Real handoff DOM must be collapsed before manual reopen');
  // Native Playwright keyboard input exercises ReactAria; never dispatch a DOM event.
  await trigger.focus();
  assert(await trigger.evaluate(node => node === node.ownerDocument.activeElement), 'Manual reopen must focus the actual trigger');
  await trigger.press('Enter');
  evidence.after = await page.evaluate(manualReopenCheckpoint, {sessionId, runId});
  assert.equal(evidence.after.expanded, 'true', 'Real Enter interaction must reopen the process');
  // Conservative barrier: deltas delivered during the action are not credited.
  evidence.afterSequence = Math.max(evidence.after.sourceSequence, evidence.after.eventSequence);
  evidence.interaction = 'Playwright trigger.focus + trigger.press Enter';
  evidence.status = evidence.before.running && evidence.after.running && !evidence.after.terminalSequence ? 'pending-completion' : 'missing-evidence';
  if (evidence.status === 'missing-evidence') evidence.missing = ['live-reopen-window'];
  if (evidence.required) assert(evidence.before.running && evidence.after.running && !evidence.after.terminalSequence,
    'Required manual reopen missed the live stream window');
  return evidence;
}

export function verifyManualReopen(evidence, events, completedExpanded) {
  let phase;
  const deltas = [];
  const own = events.filter(item => item.sessionId === evidence.sessionId && item.runId === evidence.runId).slice().sort((a,b) => a.sequence-b.sequence);
  const terminal = own.find(item => item.kind === 'status' && ['completed','failed','interrupted'].includes(item.status));
  for (const event of own) {
    if (event.kind === 'assistant_start') phase = undefined;
    if (event.kind === 'assistant_phase') phase = event.phase;
    if (event.kind === 'text_delta' && phase === 'final_answer' && event.chars > 0
      && event.sequence > (evidence.afterSequence ?? Infinity) && (!terminal || event.sequence < terminal.sequence)) deltas.push(event.sequence);
  }
  evidence.publicDeltasAfterManualReopen = deltas.length;
  evidence.firstPublicDeltaSequence = deltas[0]; evidence.lastPublicDeltaSequence = deltas.at(-1);
  evidence.completedExpanded = completedExpanded;
  evidence.missing = [];
  if (!evidence.before?.running || !evidence.after?.running || evidence.after?.terminalSequence) evidence.missing.push('live-reopen-window');
  if (!deltas.length) evidence.missing.push('subsequent-final-public-delta');
  if (completedExpanded !== 'true') evidence.missing.push('open-at-completion');
  evidence.status = evidence.missing.length ? 'missing-evidence' : 'passed';
  if (evidence.required) assert.equal(evidence.status, 'passed', `Required manual reopen evidence missing: ${evidence.missing.join(', ')}`);
  return evidence;
}
