import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const output = fs.mkdtempSync(path.join(os.tmpdir(), 'xiaozhi-phase8-stream-metrics-'));
const report = {success: false, checks: [], output};
try {
  const {summarizeProbe, preparationTiming} = await import('./phase8-stream-performance-metrics.mjs');
  const summary = summarizeProbe({phaseChanges: [{at: 0, phase: 'idle'}, {at: 10, phase: 'reasoning'}, {at: 50, phase: 'final'}],
    raf: [{at: 20, gap: 16}, {at: 40, gap: 20}, {at: 70, gap: 30}],
    longTasks: [{at: 25, duration: 55}], interactions: [{id: 'input', eventAt: 30, frameAt: 46}]});
  assert.equal(summary.phases.reasoning.raf.count, 2);
  assert.equal(summary.phases.final.raf.maximumMs, 30);
  assert.equal(summary.phases.reasoning.longTasks.count, 1);
  assert.equal(summary.interactions[0].eventToFrameMs, 16);
  report.checks.push({name: 'Raw renderer samples retain phase and event-to-frame measurements', pass: true});
  const timing = preparationTiming({submitEpochMs: 100, mainFetchEpochMs: 125, fixtureEpochMs: 128});
  assert.equal(timing.submitToMainFetchMs, 25); assert.equal(timing.submitToFixtureMs, 28);
  assert.equal(preparationTiming({submitEpochMs: 100, mainFetchEpochMs: 99, fixtureEpochMs: 101}).clockOrderingValid, false);
  report.checks.push({name: 'Cross-process epoch deltas expose negative clock order without clamping', pass: true});
  assert.equal(summarizeProbe({phaseChanges: [], raf: [], longTasks: [], interactions: []}).phases.idle.raf.meanMs, null);
  report.checks.push({name: 'Empty measurements remain null and introduce no product SLA', pass: true});
  report.success = true;
} catch (error) {report.error = error.stack; process.exitCode = 1;}
finally {fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report));}
