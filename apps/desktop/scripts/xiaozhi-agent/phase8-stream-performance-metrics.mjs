function statistics(values) {
  if (!values.length) return {count: 0, meanMs: null, medianMs: null, maximumMs: null};
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return {count: values.length, meanMs: values.reduce((sum, value) => sum + value, 0) / values.length,
    medianMs: sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2,
    maximumMs: sorted.at(-1)};
}

export function summarizeProbe(raw) {
  const phaseAt = at => raw.phaseChanges.findLast(change => change.at <= at)?.phase ?? 'idle';
  const phases = {};
  for (const phase of ['idle', 'reasoning', 'final', 'settled']) {
    phases[phase] = {
      raf: statistics(raw.raf.filter(sample => phaseAt(sample.at) === phase).map(sample => sample.gap)),
      longTasks: statistics(raw.longTasks.filter(sample => phaseAt(sample.at) === phase).map(sample => sample.duration)),
    };
  }
  return {phases, interactions: raw.interactions.map(action => ({...action,
    eventToFrameMs: action.frameAt === undefined || action.eventAt === undefined ? null : action.frameAt - action.eventAt,
    eventToChangeMs: action.changedAt === undefined || action.eventAt === undefined ? null : action.changedAt - action.eventAt}))};
}

export function preparationTiming({submitEpochMs, mainFetchEpochMs, fixtureEpochMs}) {
  return {submitEpochMs, mainFetchEpochMs, fixtureEpochMs,
    submitToMainFetchMs: mainFetchEpochMs - submitEpochMs, submitToFixtureMs: fixtureEpochMs - submitEpochMs,
    clockOrderingValid: mainFetchEpochMs >= submitEpochMs && fixtureEpochMs >= mainFetchEpochMs,
    clock: 'Separate process performance.timeOrigin + performance.now Unix epoch anchors. Cross-process calibration uncertainty applies.'};
}

/** Observed boundaries partition wall time; nested spans are retained, never added together. */
export function preparationBreakdown({lifecycle, runId, submitEpochMs, mainFetchEpochMs, fixtureEpochMs}) {
  const reasons = [];
  if (!lifecycle || lifecycle.version !== 1 || lifecycle.dropped !== 0 || lifecycle.invalid !== 0 || !Array.isArray(lifecycle.rows)) {
    return {complete: false, reasons: ['lifecycle_collection_missing_or_incomplete']};
  }
  const rows = lifecycle.rows.filter(row => row.runId === runId);
  if (!runId || rows.some(row => !Number.isFinite(row.startedEpochMs) || !Number.isFinite(row.endedEpochMs)
    || !Number.isFinite(row.durationMs) || row.durationMs < 0 || row.endedEpochMs < row.startedEpochMs
    || Math.abs(row.endedEpochMs - row.startedEpochMs - row.durationMs) > 0.05)) reasons.push('invalid_span');
  const one = operation => {
    const matches = rows.filter(row => row.operation === operation);
    if (matches.length !== 1) reasons.push('missing_or_duplicate_' + operation);
    return matches[0];
  };
  const execution = one('host_execute'), imported = one('host_pi_import'), assembly = one('pi_assembly'), prompt = one('host_prompt');
  if (reasons.length) return {complete: false, reasons};
  const anchors = [submitEpochMs, execution.startedEpochMs, imported.startedEpochMs, imported.endedEpochMs,
    assembly.startedEpochMs, assembly.endedEpochMs, prompt.startedEpochMs, mainFetchEpochMs, fixtureEpochMs];
  if (anchors.some((value, index) => !Number.isFinite(value) || index > 0 && value < anchors[index - 1])) reasons.push('invalid_boundary_order');
  if (execution.endedEpochMs < mainFetchEpochMs || prompt.endedEpochMs < mainFetchEpochMs) reasons.push('fetch_outside_execution');
  if (imported.outcome !== 'success' || assembly.outcome !== 'success') reasons.push('preparation_failed');
  if (reasons.length) return {complete: false, reasons};
  const names = ['submit_to_host_execute', 'host_before_pi_import', 'pi_import', 'host_before_pi_assembly',
    'pi_assembly', 'host_after_pi_assembly', 'pi_prompt_to_main_fetch', 'main_fetch_to_fixture'];
  const intervals = names.map((name, index) => ({name, startedEpochMs: anchors[index], endedEpochMs: anchors[index + 1],
    durationMs: anchors[index + 1] - anchors[index]}));
  const operations = rows.filter(row => !['host_execute', 'host_prompt', 'pi_assembly'].includes(row.operation)
    && row.startedEpochMs >= execution.startedEpochMs && row.endedEpochMs <= mainFetchEpochMs);
  return {complete: true, reasons: [], runId, intervals, operations,
    hostPreparationMs: prompt.startedEpochMs - execution.startedEpochMs,
    accountedMs: intervals.reduce((sum, row) => sum + row.durationMs, 0),
    boundary: 'Ordered observed boundaries partition submit-to-fixture wall time. Coarse gaps include scheduling and uninstrumented work; nested operation durations overlap and must not be summed.'};
}
