import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fixture, snapshotInput} from './phase6-provider-resume-fixture.mjs';
import {digest} from './phase6-state-foundation-worker.mjs';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'xiaozhi-phase6-provider-resume-'));
const sourceFiles = ['capabilities/runtime.ts', 'capabilities/provider-snapshots.ts', 'capabilities/resolver.ts', 'capabilities/registry.ts',
  'capabilities/provider-contract.ts', 'tasks/task-state.ts', 'tasks/coordinator.ts', 'effects/state.ts', 'effects/journal.ts', 'events/journal.ts'];
const report = {success: false, root, paidCalls: 0, checks: [], runs: [],
  boundary: 'Real SQLite Registry Resolver Task create/resume Effect and Snapshot state. Authorization availability and adapter calls are metadata seams. Pi, real Provider I/O, Permission approval UI and Job are separate.',
  sources: sourceFiles.map(file => ({file, sha256: digest(fs.readFileSync(path.join('src/main/xiaozhi-agent', file)))}))};
const save = () => fs.writeFileSync(path.join(root, 'report.json'), JSON.stringify(report, null, 2));
async function check(id, name, action, capabilityId) {
  let x; const started = performance.now();
  try {x = await fixture(path.join(root, id), capabilityId); await action(x);
    report.checks.push({id, name, pass: true, durationMs: performance.now() - started}); console.log('PASS ' + id + ' ' + name);}
  catch (error) {report.checks.push({id, name, pass: false, durationMs: performance.now() - started, error: String(error.stack ?? error)});
    console.error('FAIL ' + id + ' ' + String(error).split('\n')[0]);}
  finally {
    if (x) {const detail = {id, origin: {...x.origin, publisher: undefined}, current: {...x.current, publisher: undefined}, oldSnapshot: x.oldSnapshot,
      history: await x.snapshots.history(x.current.task.id), calls: x.calls}; report.runs.push(detail); x.record('final-state', x.capture()); x.close();}
    save();
  }
}
const providerCalls = x => ({resolve: x.calls.resolve.length, pinned: x.calls.resolveVersion.length, execute: x.calls.execute.length});
const snapshots = x => x.f.db.prepare('SELECT count(*) AS n FROM xiaozhi_capability_snapshots_v1').get().n;
async function persistedEffect(x, state) {
  const run = await x.f.admit(x.current); await x.f.execute(run);
  let effect = await x.f.effects.byCall(run.runId, run.callId);
  if (state === 'unknown') effect = await x.f.effects.transition(effect.id, effect.revision, 'unknown', run.authority);
  return {run, effect};
}
await check('R01', 'Same Task new Run revalidates retained old pin despite newer current and higher-ranked alternative', async x => {
  assert.equal(x.current.task.id, x.origin.task.id); assert.notEqual(x.current.runId, x.origin.runId);
  assert(x.current.owner.generation > x.origin.owner.generation);
  const before = providerCalls(x), runtime = x.runtime(x.current), view = await runtime.resolve(x.request);
  assert.equal(x.calls.resolve.length, before.resolve); assert.equal(x.calls.resolveVersion.length, before.pinned + 1);
  assert.equal(view.snapshot.refreshReason, 'resume_revalidate'); assert.equal(view.snapshot.previousSnapshotId, x.oldSnapshot.snapshotId);
  assert.equal(view.snapshot.runId, x.current.runId); assert.equal(view.snapshot.selection.providerVersion, x.primary.provider.version);
  assert.equal(view.snapshot.providerHash, x.primary.provider.source.packageHash);
  const result = await runtime.execute('resume_valid', x.request, {path: 'owned.txt'});
  assert.equal(result.success, true); assert.equal(result.result.status, 'completed');
  assert.equal(x.calls.execute.at(-1).version, x.primary.provider.version); x.record('resolved', view);
});
await check('R02', 'Revoked old version blocks new calls without silent Resolver fallback', async x => {
  await x.registry.revokeProviderVersion(x.primary.provider.id, x.primary.provider.version, x.cap);
  const count = snapshots(x), before = providerCalls(x), runtime = x.runtime(x.current);
  const view = await runtime.resolve(x.request); assert.equal(view.blockedReason, 'capability_revoked');
  const result = await runtime.execute('revoked', x.request, {path: 'owned.txt'});
  assert.equal(result.success, false); assert.equal(result.error.code, 'capability_revoked');
  assert.equal(x.calls.resolve.length, before.resolve); assert.equal(x.calls.execute.length, 0); assert.equal(snapshots(x), count);
  x.record('blocked', view);
});
await check('R03', 'Missing retained executable blocks resume before any adapter execution', async x => {
  x.installed.delete(x.key(x.primary.provider.id, x.primary.provider.version, x.primary.provider.source.packageHash));
  const before = providerCalls(x), view = await x.runtime(x.current).resolve(x.request);
  assert.equal(view.blockedReason, 'provider_version_unavailable'); assert.equal(view.resolution.selectedProviders.length, 0);
  assert.equal(x.calls.resolve.length, before.resolve); assert.equal(x.calls.execute.length, 0); assert.equal(snapshots(x), 1); x.record('blocked', view);
});
await check('R04', 'Denied old authority blocks resume and does not select an authorized alternative implicitly', async x => {
  x.denied.add(x.primary.provider.id + ':' + x.primary.provider.version);
  const before = providerCalls(x), view = await x.runtime(x.current).resolve(x.request);
  assert.equal(view.blockedReason, 'permission_denied'); assert.equal(view.resolution.status, 'blocked_permission');
  assert.equal(x.calls.resolve.length, before.resolve); assert.equal(x.calls.execute.length, 0); assert.equal(snapshots(x), 1); x.record('blocked', view);
});
await check('R05', 'Required guarantees missing from all providers cannot become an accepted partial selection', async x => {
  const request = {...x.request, required: ['owned_missing_required']};
  const view = await x.runtime(x.current).resolve(request);
  assert.equal(view.resolution.selectedProviders.length, 0); assert(view.resolution.blockedReasons.includes('missing_required'));
  assert.equal(view.snapshot, null); assert.equal(x.calls.execute.length, 0); assert.equal(snapshots(x), 1); x.record('blocked', view);
});
await check('R06', 'Persisted same-capability executing Effect blocks explicit refresh at the original safe-point callback', async x => {
  const {effect} = await persistedEffect(x, 'executing'); const before = x.capture(), calls = providerCalls(x);
  await assert.rejects(x.runtime(x.current).resolve(x.request, undefined, true), /capability_refresh_busy/);
  assert.deepEqual(x.capture(), before); assert.equal(x.calls.resolve.length, calls.resolve);
  assert(x.calls.safety.at(-1).blocked.some(row => row.id === effect.id && row.state === 'executing'));
}, 'edu.core.tool.office_create_text');
await check('R07', 'Persisted same-capability unknown Effect also blocks explicit refresh', async x => {
  const {effect} = await persistedEffect(x, 'unknown'); const before = x.capture(), calls = providerCalls(x);
  await assert.rejects(x.runtime(x.current).resolve(x.request, undefined, true), /capability_refresh_busy/);
  assert.deepEqual(x.capture(), before); assert.equal(x.calls.resolve.length, calls.resolve);
  assert(x.calls.safety.at(-1).blocked.some(row => row.id === effect.id && row.state === 'unknown'));
}, 'edu.core.tool.office_create_text');
await check('R08', 'Exact owned file reconciliation permits explicit compatible fallback with Optional gaps disclosed', async x => {
  const {run, effect} = await persistedEffect(x, 'unknown');
  const proof = x.f.perform(run);
  await x.f.effects.transition(effect.id, effect.revision, 'reconciled', run.authority,
    {proofs: [proof], outcome: {digest: proof.digest, references: [proof.reference]}});
  await x.registry.revokeProviderVersion(x.primary.provider.id, x.primary.provider.version, x.cap);
  const runtime = x.runtime(x.current), view = await runtime.resolve(x.request, undefined, true);
  assert.equal(view.snapshot.selection.providerId, x.alternative.provider.id); assert.equal(view.snapshot.refreshReason, 'explicit_refresh');
  assert.equal(view.snapshot.previousSnapshotId, x.oldSnapshot.snapshotId); assert.equal(view.snapshot.selection.level, 'partial');
  assert(view.snapshot.selection.missingRequirements.includes('mime')); assert(view.resolution.acceptedLimitations.includes('missing:mime'));
  assert.equal(x.f.count(), 1); const result = await runtime.execute('compatible_fallback', x.request, {path: 'owned.txt'});
  assert.equal(result.success, true); assert.equal(x.calls.execute.at(-1).providerId, x.alternative.provider.id); assert.equal(x.f.count(), 1);
  x.record('fallback', view);
}, 'edu.core.tool.office_create_text');
await check('R09', 'Foreign Task Snapshot lineage and old owner requests are rejected with zero mutation', async x => {
  const foreign = await x.f.fresh(); const foreignView = await x.runtime(foreign).resolve(x.request);
  const currentView = await x.runtime(x.current).resolve(x.request); const before = x.capture();
  await assert.rejects(x.snapshots.previous(x.origin.owner, x.current.task.id, x.cap), /permission_denied/);
  await assert.rejects(x.snapshots.previous(foreign.owner, x.current.task.id, x.cap), /permission_denied/);
  await assert.rejects(x.snapshots.save(x.current.owner, x.current.task.id,
    {...snapshotInput(currentView.snapshot), previousSnapshotId: foreignView.snapshot.snapshotId}), /capability_invalid_snapshot/);
  assert.deepEqual(x.capture(), before); assert.equal(x.calls.execute.length, 0);
});
await check('R10', 'Stale Registry revision is refused by Snapshot CAS validation', async x => {
  const view = await x.runtime(x.current).resolve(x.request), input = snapshotInput(view.snapshot);
  const changed = structuredClone(x.alternative); changed.binding.priority++;
  await x.register(changed); const before = x.capture();
  await assert.rejects(x.snapshots.save(x.current.owner, x.current.task.id, input), /source_changed/);
  assert.deepEqual(x.capture(), before); assert.equal(x.calls.execute.length, 0);
});
await check('R11', 'Snapshot INSERT failure rolls back its transaction and preserves old Snapshot and Task', async x => {
  const before = x.capture();
  x.f.db.exec("CREATE TRIGGER owned_snapshot_fail BEFORE INSERT ON xiaozhi_capability_snapshots_v1 BEGIN SELECT RAISE(ABORT,'owned_snapshot_failure'); END");
  await assert.rejects(x.runtime(x.current).resolve(x.request), /owned_snapshot_failure/);
  assert.deepEqual(x.capture(), before); assert.equal(snapshots(x), 1); assert.equal(x.calls.execute.length, 0);
});
await check('R12', 'A real Effect entering after Resolver but before persist is caught by the second safe-point check', async x => {
  const count = snapshots(x); let entered;
  x.afterResolve(async () => {entered = await persistedEffect(x, 'executing');});
  await assert.rejects(x.runtime(x.current).resolve(x.request, undefined, true), /capability_refresh_busy/);
  assert.equal(snapshots(x), count); assert.equal(x.calls.execute.length, 0);
  assert.equal((await x.f.effects.get(entered.effect.id)).state, 'executing');
  assert(x.calls.safety.at(-1).blocked.some(row => row.id === entered.effect.id));
}, 'edu.core.tool.office_create_text');
report.success = report.checks.length === 12 && report.checks.every(check => check.pass);
save(); console.log(JSON.stringify({root, success: report.success, checks: report.checks.length}));
if (!report.success) process.exitCode = 1;
