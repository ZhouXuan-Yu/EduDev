/** Browser-side probe: public event metadata and focus/DOM states only. */
export function installChatPublicProbe() {
  window.__uiChatEvents = [];
  window.__uiChatHandoffs = [];
  window.__uiChatExecutions = [];
  const phases = new Map(), terminals = new Map(), finals = new Map();
  const publicActivity = new Map(), executions = new Set();
  const focusKind = (element, turn) => {
    if (element?.matches('[data-testid="office-prompt-input"]')) return 'composer';
    if (!turn?.contains(element)) return element === document.body ? 'body' : 'other';
    if (element?.matches('[data-testid="agent-trace-toggle"]')) return 'process-trigger';
    // The production ChatTool trigger is a real button, not the old native summary.
    if (element?.closest('button[data-testid="agent-tool-trigger"]')) return 'summary';
    if (element?.matches('[data-testid="office-tool-evidence"] a, [data-testid="office-tool-evidence"] a *')) return 'detail-link';
    return 'other';
  };
  // Observe the actual two-commit DOM handoff even while Playwright is taking
  // screenshots. Only public event identities/DOM states leave the renderer.
  const sampleHandoffs = () => {
    for (const [runId, event] of publicActivity) {
      if (executions.has(runId) || terminals.has(runId) || phases.get(runId) === 'final_answer') continue;
      const turn = [...document.querySelectorAll('.office-turn[data-turn-id]')]
        .find(node => node.getAttribute('data-turn-id') === runId);
      const live = turn?.querySelector('[data-mode="live-prose"]');
      const timeline = live?.querySelector('[data-testid="agent-trace-timeline"]');
      if (!timeline || turn.getAttribute('data-state') !== 'running'
        || !timeline.getClientRects().length
        || !timeline.checkVisibility({visibilityProperty:true, opacityProperty:true})) continue;
      executions.add(runId);
      window.__uiChatExecutions.push({...event, observedAt:Date.now(), mode:'live-prose',
        running:true, timelineVisible:true, beforeFinal:true, beforeTerminal:true});
    }
    for (const [key, final] of finals) {
      const turn = [...document.querySelectorAll('.office-turn[data-turn-id]')]
        .find(node => node.getAttribute('data-turn-id') === final.runId);
      const trigger = turn?.querySelector('[data-testid="agent-trace-toggle"]');
      if (!trigger || trigger.getAttribute('aria-expanded') !== 'false') continue;
      window.__uiChatHandoffs.push({ ...final, observedAt: Date.now(), collapsed: true,
        beforeTerminal: !terminals.has(final.runId),
        terminalSequenceAtCapture: terminals.get(final.runId),
        focusAfter: focusKind(document.activeElement, turn) });
      finals.delete(key);
    }
  };
  window.__uiChatObserver?.disconnect();
  window.__uiChatObserver = new MutationObserver(sampleHandoffs);
  window.__uiChatObserver.observe(document.body, {childList:true, subtree:true,
    attributes:true, attributeFilter:['aria-expanded', 'data-mode']});
  window.__uiChatOff = window.omniEdu.onXiaozhiEvent((e) => {
    const a = { kind: e.kind, sessionId: e.sessionId, runId: e.runId, sequence: e.sequence, capturedAt: e.capturedAt, receivedAt: Date.now() };
    if (e.kind === "assistant_phase") {
      a.segment = e.segment;
      a.phase = e.phase;
      a.since = e.since;
      phases.set(e.runId, e.phase);
      if (e.phase === 'final_answer') {
        const turn = [...document.querySelectorAll('.office-turn[data-turn-id]')]
          .find(node => node.getAttribute('data-turn-id') === e.runId);
        finals.set(`${e.runId}:${e.sequence}`, { sessionId:e.sessionId, runId:e.runId,
          explicitSequence:e.sequence, segment:e.segment, since:e.since,
          receivedAt:a.receivedAt, focusBefore:focusKind(document.activeElement,turn) });
      }
    } else if (e.kind === "assistant_start" || e.kind === "assistant_end") {
      a.segment = e.segment;
      if (e.kind === 'assistant_start') phases.delete(e.runId);
      if (e.kind === "assistant_end") {
        a.final = e.final;
        a.since = e.since;
      }
    } else if (e.kind === "tool_start" || e.kind === "tool_end") {
      a.callId = e.callId;
      a.tool = e.tool;
      if (e.kind === "tool_end") a.success = e.success;
    } else if (e.kind === "text_delta") {
      a.chars = e.delta.length;
      a.publicCommentary = phases.get(e.runId) === 'commentary' && Boolean(e.delta.trim());
    }
    else if (e.kind === "activity") {
      a.stage = e.stage;
      a.since = e.since;
    } else if (e.kind === 'control') {
      a.controlId = e.control.id;
      a.controlKind = e.control.kind;
      a.state = e.control.state;
    } else if (e.kind === 'approval') {
      a.approvalId = e.approval.id;
      a.callId = e.approval.callId;
      a.state = e.approval.state;
    } else if (e.kind === "status") {
      a.status = e.status;
      if (['completed', 'failed', 'interrupted'].includes(e.status)) terminals.set(e.runId,e.sequence);
    }
    else if (e.kind === "model_request") {
      a.request = e.request.request;
      a.attempt = e.request.attempt;
      a.state = e.request.state;
    } else return;
    window.__uiChatEvents.push(a);
    if (e.kind === 'tool_start' || e.kind === 'text_delta' && a.publicCommentary)
      publicActivity.set(e.runId, {...a});
    queueMicrotask(sampleHandoffs);
  });
}
