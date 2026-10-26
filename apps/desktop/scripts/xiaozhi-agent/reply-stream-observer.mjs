import assert from 'node:assert/strict';

/** Samples rendered frames, not just the final snapshot. Test-only; no runtime instrumentation. */
export async function observeReplyStream(page) {
  await page.evaluate(() => {
    window.replyStreamAudit = { events: [], frames: [] };
    window.omniEdu.onXiaozhiEvent((event) =>
      window.replyStreamAudit.events.push({
        t: performance.now(),
        kind: event.kind,
        runId: event.runId,
        sequence: event.sequence,
        phase: event.phase,
        chars: event.delta?.length,
      }),
    );
    let requested = false;
    new MutationObserver(() => {
      if (requested) return;
      requested = true;
      requestAnimationFrame(() => {
        requested = false;
        const turn = [...document.querySelectorAll('.office-turn')].at(-1);
        if (!turn) return;
        const trace = turn.querySelector('[data-testid="agent-trace-toggle"]');
        window.replyStreamAudit.frames.push({
          t: performance.now(),
          runId: turn.dataset.turnId,
          status: turn.dataset.state,
          expanded: trace?.getAttribute('aria-expanded'),
          headers: turn.querySelectorAll('[data-testid="agent-trace-toggle"]').length,
          mode: turn.querySelector('[data-testid="agent-trace"]')?.dataset.mode,
          publicChars: [...turn.querySelectorAll('[data-testid="reply-process-summary"]')].reduce((n,el)=>n+el.textContent.length,0),
          toolRows: turn.querySelectorAll('[data-testid="office-tool-step"]').length,
          bodyChars:
            turn.querySelector('[data-testid="agent-reply-body"] [data-slot="markdown"]')
              ?.textContent.length || 0,
          reasoningChars: [...turn.querySelectorAll('[data-testid="model-reasoning"]')].reduce(
            (n, el) => n + el.textContent.length,
            0,
          ),
          animated: turn.querySelectorAll('[data-streamdown-animated], [style*="sd-"]').length,
        });
        if (window.replyStreamAudit.frames.length > 5000) window.replyStreamAudit.frames.shift();
      });
    }).observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['aria-expanded', 'data-state'],
    });
  });
}

export async function assertReplyHandoff(page, runId) {
  const data = await page.evaluate(() => window.replyStreamAudit);
  const events = data.events.filter((e) => e.runId === runId),
    frames = data.frames.filter((e) => e.runId === runId);
  const phase = events.find((e) => e.kind === 'assistant_phase' && e.phase === 'final_answer');
  assert(phase, 'real provider did not produce an explicit final marker');
  const live = frames.filter((f) => f.status === 'running' && f.bodyChars > 0);
  assert(live.length >= 2, 'answer must grow over multiple actual rendered frames');
  assert(
    new Set(live.map((f) => f.bodyChars)).size >= 2,
    'answer cannot arrive as a completed blob',
  );
  assert(
    live.every((f) => f.expanded === 'false'),
    'process must be folded before answer characters are painted',
  );
  assert(
    frames.every((f) => f.headers <= 1),
    'one run has only one aggregate header',
  );
  const firstBody = live[0],
    firstReasoning = frames.find((f) => f.reasoningChars > 0);
  const firstReasoningEvent = events.find((e) => e.kind === 'model_reasoning');
  const firstBodyDelta = events.find((e) => e.kind === 'text_delta' && e.t >= phase.t);
  return {
    runId,
    phaseAt: phase.t,
    firstBodyAt: firstBody.t,
    phaseToBodyMs: firstBody.t - phase.t,
    reasoningIpcToPaintMs:
      firstReasoning && firstReasoningEvent ? firstReasoning.t - firstReasoningEvent.t : undefined,
    bodyIpcToPaintMs: firstBodyDelta ? firstBody.t - firstBodyDelta.t : undefined,
    liveFrames: live.length,
    distinctBodyLengths: new Set(live.map((f) => f.bodyChars)).size,
    events,
    frames,
  };
}
