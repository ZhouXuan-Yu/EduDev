import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const output = fs.mkdtempSync(path.join(os.tmpdir(), 'xiaozhi-phase8-stream-metrics-'));
const report = {success: false, checks: [], output};
try {
  const {summarizeProbe, preparationTiming, preparationBreakdown} = await import('./phase8-stream-performance-metrics.mjs');
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
  const span = (operation, start, end, runId = 'run_fixture') => ({version: 1, operation, runId,
    startedEpochMs: start, endedEpochMs: end, durationMs: end - start, outcome: 'success'});
  const lifecycle = {version: 1, dropped: 0, invalid: 0, rows: [span('host_execute', 110, 200),
    span('host_pi_import', 120, 130), span('pi_assembly', 140, 160), span('host_prompt', 170, 195),
    span('pi_reload_resources', 145, 155), span('pi_assembly', 0, 1000, 'run_other')]};
  const input = {lifecycle, runId: 'run_fixture', submitEpochMs: 100, mainFetchEpochMs: 180, fixtureEpochMs: 185};
  const breakdown = preparationBreakdown(input);
  assert.equal(breakdown.complete, true); assert.equal(breakdown.accountedMs, 85);
  assert.equal(breakdown.hostPreparationMs, 60); assert.equal(breakdown.operations.length, 2);
  assert.equal(breakdown.intervals.find(row => row.name === 'pi_assembly').durationMs, 20);
  report.checks.push({name: 'Correlated boundaries partition wall time without summing nested or foreign run spans', pass: true});
  for (const invalid of [undefined, {...lifecycle, dropped: 1}, {...lifecycle, invalid: 1},
    {...lifecycle, rows: lifecycle.rows.filter(row => row.operation !== 'host_pi_import')},
    {...lifecycle, rows: [...lifecycle.rows, span('host_pi_import', 120, 130)]}]) {
    assert.equal(preparationBreakdown({...input, lifecycle: invalid}).complete, false);
  }
  assert.equal(preparationBreakdown({...input, mainFetchEpochMs: 169}).complete, false);
  assert.equal(preparationBreakdown({...input, mainFetchEpochMs: 201}).complete, false);
  report.checks.push({name: 'Missing, dropped, malformed, duplicate or unordered measurements cannot support attribution', pass: true});
  const lifecycleModule = path.join(output, 'lifecycle-observer.mjs');
  await (await import('esbuild')).build({entryPoints: [path.resolve(import.meta.dirname, '../../src/main/xiaozhi-agent/lifecycle-wait.ts')],
    outfile: lifecycleModule, bundle: true, platform: 'node', format: 'esm', logLevel: 'silent'});
  const {channel} = await import('node:diagnostics_channel');
  const {observeLifecycle, waitForLifecycle, LifecycleTimeoutError, createLifecycleWorkTracker}
    = await import(pathToFileURL(lifecycleModule).href);
  const diagnostics = channel('omni-edu.xiaozhi.lifecycle.v1');
  const original = Promise.resolve({unchanged: true});
  assert.equal(diagnostics.hasSubscribers, false);
  assert.equal(observeLifecycle('not_observed', () => original), original);
  const observed = [], subscriber = row => observed.push(row);
  diagnostics.subscribe(subscriber);
  try {
    await Promise.all(['run_alpha', 'run_beta'].map(runId => observeLifecycle('test_outer', async () => {
      await waitForLifecycle('test_success', async () => {await new Promise(resolve => setTimeout(resolve, 2)); return 7;});
    }, {runId})));
    for (const runId of ['run_alpha', 'run_beta']) assert.deepEqual(observed.filter(row => row.runId === runId).map(row => row.operation), ['test_success', 'test_outer']);
    const privateError = Error('private synthetic payload must not be retained');
    await assert.rejects(observeLifecycle('test_error', async () => {throw privateError;}), error => error === privateError);
    assert(!JSON.stringify(observed).includes(privateError.message));
    report.checks.push({name: 'Opt-in main observer preserves values and errors, excludes payloads and separates concurrent run scopes', pass: true});
    let release, cleanups = 0, continued = 0;
    const work = new Promise(resolve => {release = resolve;}), controller = new AbortController(), tracker = createLifecycleWorkTracker();
    const cancelled = waitForLifecycle('test_cancel', () => work, {signal: controller.signal, timeoutMs: 1000,
      late: () => {cleanups++;}, track: tracker.track}).then(() => {continued++;});
    await new Promise(resolve => setImmediate(resolve)); controller.abort(); await assert.rejects(cancelled, /cancelled/); assert.equal(tracker.isPending(), true);
    release(1); await new Promise(resolve => setTimeout(resolve, 5));
    assert.equal(cleanups, 1); assert.equal(continued, 0); assert.equal(tracker.isPending(), false);
    await assert.rejects(waitForLifecycle('test_timeout', () => new Promise(() => {}), {timeoutMs: 15}), error => {
      assert(error instanceof LifecycleTimeoutError); assert.equal(error.operation, 'test_timeout'); assert.equal(error.timeoutMs, 15); return true;
    });
    assert.equal(observed.find(row => row.operation === 'test_cancel').outcome, 'cancelled');
    assert.equal(observed.find(row => row.operation === 'test_timeout').outcome, 'timeout');
    assert.equal(observed.find(row => row.operation === 'test_error').outcome, 'error');
    assert(observed.every(row => Object.keys(row).every(key => ['version','operation','runId','startedEpochMs','endedEpochMs','durationMs','outcome'].includes(key))));
    report.checks.push({name: 'Observer retains cancellation, fixed deadlines, tracked late cleanup and scalar-only outcomes', pass: true});
  } finally {diagnostics.unsubscribe(subscriber);}
  report.success = true;
} catch (error) {report.error = error.stack; process.exitCode = 1;}
finally {fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report));}
