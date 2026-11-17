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
