/** Serialized into the isolated renderer by Playwright. No product code changes. */
export function installRendererProbe() {
  const data = {timeOrigin: performance.timeOrigin, dateCalibrationMs: Date.now() - (performance.timeOrigin + performance.now()),
    supportedLongTasks: PerformanceObserver.supportedEntryTypes.includes('longtask'), phaseChanges: [{at: performance.now(), phase: 'idle'}],
    raf: [], longTasks: [], interactions: [], inputSamples: [], events: [], submissions: []};
  let phase = 'idle';
  let previousFrame = performance.now();
  let frameId;
  let current;
  const epoch = at => performance.timeOrigin + at;
  function changePhase(next) {
    if (next !== phase) {phase = next; data.phaseChanges.push({at: performance.now(), phase});}
  }
  function paint(action) {
    if (action.frameRequested) return;
    action.frameRequested = true;
    requestAnimationFrame(() => {action.frameAt = performance.now(); action.complete = true;});
  }
  function inspectAction() {
    if (!current || current.eventAt === undefined || current.complete) return;
    const node = current.selector ? document.querySelector(current.selector) : undefined;
    const expanded = current.kind === 'expand' && node?.getAttribute(current.attribute || 'aria-expanded') === current.expected;
    const scrolled = current.kind === 'scroll' && node && node.scrollTop !== current.beforeScrollTop;
    if (expanded || scrolled) {
      current.changedAt ??= performance.now();
      if (scrolled) current.afterScrollTop = node.scrollTop;
      paint(current);
    }
  }
  function capture(event) {
    const target = event.target instanceof Element ? event.target : undefined;
    if (event.type === 'input' && target?.matches('[data-testid="office-prompt-input"]')) {
      const sample = {at: performance.now(), phase, trusted: event.isTrusted, length: target.value.length};
      data.inputSamples.push(sample); requestAnimationFrame(() => {sample.frameAt = performance.now();});
    }
    if (!current || current.eventAt !== undefined || !target?.closest(current.selector)) return;
    const matches = current.kind === 'input' && event.type === 'input'
      || current.kind === 'submit' && event.type === 'keydown' && event.key === 'Enter'
      || ['expand', 'stop'].includes(current.kind) && event.type === 'click'
      || current.kind === 'scroll' && event.type === 'wheel';
    if (!matches) return;
    current.eventAt = performance.now(); current.epochMs = epoch(current.eventAt); current.trusted = event.isTrusted; current.eventPhase = phase;
    if (current.kind === 'scroll') current.beforeScrollTop = document.querySelector(current.selector).scrollTop;
    if (current.kind === 'submit') data.submissions.push({at: current.eventAt, epochMs: current.epochMs, trusted: event.isTrusted});
    if (['input', 'submit'].includes(current.kind)) paint(current);
    inspectAction();
  }
  const types = ['keydown', 'input', 'click', 'wheel', 'scroll'];
  for (const type of types) document.addEventListener(type, capture, true);
  const observer = new MutationObserver(inspectAction);
  observer.observe(document.body, {subtree: true, childList: true, attributes: true, attributeFilter: ['aria-expanded', 'aria-pressed']});
  const longTaskObserver = new PerformanceObserver(list => {
    for (const entry of list.getEntries()) data.longTasks.push({at: entry.startTime, duration: entry.duration});
  });
  if (data.supportedLongTasks) longTaskObserver.observe({type: 'longtask', buffered: false});
  const unsubscribe = window.omniEdu.onXiaozhiEvent(event => {
    const at = performance.now();
    if (event.kind === 'model_reasoning' && event.block?.status === 'streaming') changePhase('reasoning');
    // This fixed fixture emits only reasoning then final-channel content, with no tools/commentary.
    if (event.kind === 'text_delta' && event.delta?.length) changePhase('final');
    if (event.kind === 'status' && event.status !== 'running') {
      changePhase('settled');
      if (current?.kind === 'stop' && current.eventAt !== undefined) {
        current.changedAt = at; current.terminalStatus = event.status; paint(current);
      }
    }
    if (['model_reasoning', 'assistant_phase', 'status', 'text_delta'].includes(event.kind)) {
      data.events.push({at, kind: event.kind, phase: event.phase, runId: event.runId, status: event.status});
    }
  });
  function frame(at) {
    data.raf.push({at, gap: at - previousFrame}); previousFrame = at;
    inspectAction(); frameId = requestAnimationFrame(frame);
  }
  frameId = requestAnimationFrame(frame);
  window.phase8StreamProbe = {
    arm(action) {
      current = {...action, phase, armedAt: performance.now()};
      data.interactions.push(current);
    },
    snapshot: () => structuredClone(data),
    dispose() {
      cancelAnimationFrame(frameId); observer.disconnect(); longTaskObserver.disconnect();
      for (const type of types) document.removeEventListener(type, capture, true);
      if (typeof unsubscribe === 'function') unsubscribe();
      return structuredClone(data);
    },
  };
}
