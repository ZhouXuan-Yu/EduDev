import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fork} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {openFixture, digest} from './phase6-state-foundation-worker.mjs';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'xiaozhi-phase6-state-'));
const sources = ['effects/state.ts', 'effects/types.ts', 'effects/journal.ts', 'events/journal.ts', 'events/publisher.ts',
  'tasks/task-state.ts', 'tasks/checkpoints.ts', 'tasks/startup-recovery.ts', 'tasks/coordinator.ts'];
const report = {success: false, root, paidCalls: 0, checks: [], crashes: [],
  boundary: 'Original SQLite Task/coordinator/Journal/receipt/Effect/checkpoint APIs and actual child SIGKILL plus owned file effects. State foundation only. Pi runtime, Job, provider, native helper, UI and product restart are separate.',
  sources: sources.map(file => ({file, sha256: digest(fs.readFileSync(path.join('src/main/xiaozhi-agent', file)))}))};
const save = () => fs.writeFileSync(path.join(root, 'report.json'), JSON.stringify(report, null, 2));
save();
async function check(id, name, action) {
  const started = performance.now();
  try {await action(); report.checks.push({id, name, pass: true, durationMs: performance.now() - started}); console.log('PASS ' + id + ' ' + name);}
  catch (error) {report.checks.push({id, name, pass: false, error: String(error.stack ?? error), durationMs: performance.now() - started}); console.error('FAIL ' + id + ' ' + String(error).split('\n')[0]);}
  save();
}
function snapshotFile(fixture, name) {
  const value = fixture.snapshot(); fs.writeFileSync(path.join(fixture.root, name + '.json'), JSON.stringify(value, null, 2)); return value;
}
async function killedBoundary(cut) {
  const directory = path.join(root, cut); fs.mkdirSync(directory);
  const worker = fileURLToPath(new URL('./phase6-state-foundation-worker.mjs', import.meta.url));
  const record = {cut, directory}; report.crashes.push(record); save();
  const environment = Object.fromEntries(Object.entries(process.env).filter(([key]) => /^(SystemRoot|windir|SystemDrive|TEMP|TMP|LOCALAPPDATA|USERPROFILE)$/iu.test(key)));
  const child = fork(worker, ['--crash', directory, cut], {execPath: process.execPath, execArgv: ['--experimental-transform-types'], windowsHide: true,
    env: environment, stdio: ['ignore', 'pipe', 'pipe', 'ipc']});
  record.pid = child.pid;
  let stdout = '', stderr = '';
  child.stdout.on('data', bytes => {stdout = (stdout + bytes.toString()).slice(-65536);});
  child.stderr.on('data', bytes => {stderr = (stderr + bytes.toString()).slice(-65536);});
  const closed = new Promise((resolve, reject) => {child.once('error', reject); child.once('close', (code, signal) => resolve({code, signal}));});
  let timeout;
  try {
    const boundary = await new Promise((resolve, reject) => {
      timeout = setTimeout(() => reject(Error('state_boundary_timeout')), 20000);
      child.on('message', message => message.type === 'boundary_committed' ? resolve(message) : reject(Error(message.error || 'unexpected_worker_frame')));
      child.once('error', reject); child.once('exit', (code, signal) => reject(Error('worker_before_boundary ' + code + ' ' + signal)));
    });
    clearTimeout(timeout); record.boundary = boundary;
    const readOnly = new DatabaseSync(path.join(directory, 'state.sqlite'), {readOnly: true});
    try {
      record.independentBeforeKill = {
        effect: JSON.parse(readOnly.prepare('SELECT document_json FROM xiaozhi_effects_v1 WHERE effect_id=?').get(boundary.identity.effectId).document_json),
        run: readOnly.prepare('SELECT run_id,status,generation,sequence FROM xiaozhi_event_runs WHERE run_id=?').get(boundary.identity.runId),
        task: JSON.parse(readOnly.prepare('SELECT value_json FROM app_settings WHERE key=?').get('xiaozhi.task.v1:' + boundary.identity.taskId).value_json),
      };
    } finally {readOnly.close();}
    assert.equal(record.independentBeforeKill.effect.state, cut === 'intent' ? 'intent' : cut === 'committed' ? 'committed' : 'executing');
    assert.equal(record.independentBeforeKill.run.status, 'running');
    record.killAccepted = child.kill('SIGKILL'); assert.equal(record.killAccepted, true);
    record.exit = await closed; assert(record.exit.code !== 0 || record.exit.signal);
    return record;
  } finally {
    clearTimeout(timeout);
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    record.exit ??= await closed;
    fs.writeFileSync(path.join(directory, 'worker.stdout.txt'), stdout); fs.writeFileSync(path.join(directory, 'worker.stderr.txt'), stderr); save();
  }
}
async function recoverCut(record) {
  const {directory, boundary} = record; const expectedCount = ['external_success', 'committed'].includes(record.cut) ? 1 : 0;
  let f = await openFixture(directory);
  try {
    const initial = snapshotFile(f, 'reopened-before-recovery');
    assert.deepEqual(initial, JSON.parse(fs.readFileSync(path.join(directory, 'boundary-snapshot.json'), 'utf8')));
    assert.equal(f.count(), expectedCount);
    const taskBefore = await f.taskState.get(boundary.identity.taskId); assert.equal(taskBefore.state, 'active');
    await f.journal.recover();
    const effect = await f.effects.get(boundary.identity.effectId), task = await f.taskState.get(boundary.identity.taskId);
    const checkpoint = await f.taskState.checkpoint(task.id);
    assert.equal(effect.state, expectedCount ? 'committed' : 'unknown'); assert.equal(task.state, 'interrupted');
    assert.equal(task.id, taskBefore.id); assert.equal(task.requirementsVersion, taskBefore.requirementsVersion);
    assert.deepEqual(task.steps, taskBefore.steps);
    assert(checkpoint.effects.some(item => item.id === effect.id && item.revision === effect.revision && item.state === effect.state));
    const run = f.db.prepare('SELECT status FROM xiaozhi_event_runs WHERE run_id=?').get(boundary.identity.runId);
    const owner = f.db.prepare('SELECT run_id,generation FROM xiaozhi_event_owners WHERE session_id=?').get(boundary.identity.sessionId);
    assert.equal(run.status, 'interrupted'); assert.equal(owner.run_id, ''); assert.equal(owner.generation, boundary.identity.owner.generation + 1);
    const events = f.db.prepare("SELECT event_json FROM xiaozhi_event_journal WHERE run_id=? ORDER BY sequence").all(boundary.identity.runId).map(row => JSON.parse(row.event_json));
    assert(events.filter(event => event.kind === 'recovery').every(event => event.recovery.automaticReplay === false));
    const taskEvent = events.filter(event => event.kind === 'task').at(-1); assert.deepEqual(taskEvent.task, task);
    assert.equal(checkpoint.journalCursor.sequence, taskEvent.sequence);
    assert.equal(f.count(), expectedCount);
    if (expectedCount) assert.equal(digest(fs.readFileSync(f.artifact)), digest(f.bytes));
    const after = snapshotFile(f, 'recovery-committed');
    record.recovery = {effect, task, checkpoint, owner, physicalEffects: f.count(), readbackCalls: f.readbackCalls(), snapshotHash: digest(after)};
    f.close(); f = await openFixture(directory);
    assert.deepEqual(f.snapshot(), after); await f.journal.recover(); assert.deepEqual(f.snapshot(), after); assert.equal(f.count(), expectedCount);
    record.secondColdOpen = {snapshotHash: digest(f.snapshot()), readbackCalls: f.readbackCalls(), physicalEffects: f.count()};
    assert.equal(f.readbackCalls(), 0);
  } finally {f.close(); save();}
}
function intentOf(record) {
  const {schemaVersion, id, revision, state, execution, outcome, proofs, createdAt, updatedAt, ...intent} = record;
  return intent;
}
try {
  for (const [index, cut] of ['intent', 'executing', 'external_success', 'committed'].entries()) {
    await check('S0' + (index + 1), 'Actual SIGKILL at ' + cut + ' and two cold opens without replay', async () => recoverCut(await killedBoundary(cut)));
  }
  await check('S05', 'Recovery outbox failure atomically rolls back Effect Task checkpoint and owner', async () => {
    const f = await openFixture(path.join(root, 'recovery-rollback'));
    try {
      const run = await f.admit(await f.fresh()); await f.execute(run); f.perform(run);
      const before = snapshotFile(f, 'before-fault'); f.fault(true);
      await assert.rejects(f.journal.recover(), /owned_outbox_failure/); f.fault(false);
      assert.deepEqual(snapshotFile(f, 'after-fault'), before); assert.equal(f.count(), 1);
      await f.journal.recover(); assert.equal((await f.effects.byCall(run.runId, run.callId)).state, 'committed');
      assert.equal((await f.taskState.get(run.task.id)).state, 'interrupted'); assert.equal(f.count(), 1);
      snapshotFile(f, 'explicit-retry');
    } finally {f.close();}
  });
  await check('S06', 'Task checkpoint outbox failure rolls back immutable history and permits explicit retry', async () => {
    const f = await openFixture(path.join(root, 'checkpoint-rollback'));
    try {
      const run = await f.admit(await f.fresh()); const before = snapshotFile(f, 'before-fault');
      const proposal = {expectedRevision: run.task.planRevision, reason: 'Explicit updated plan', steps: run.task.steps};
      const mutate = work => import('../../src/main/xiaozhi-agent/tasks/task-state.ts').then(({createTaskState}) =>
        createTaskState({...work, transaction: action => action(work)}, {sanitize: async text => text}).propose(run.owner, run.task.id, run.task.revision, proposal));
      f.fault(true); await assert.rejects(run.publisher.checkpointTask(mutate), /owned_outbox_failure/); f.fault(false);
      await run.publisher.settled(); assert.deepEqual(snapshotFile(f, 'after-fault'), before);
      const row = f.db.prepare('SELECT revision,sequence FROM xiaozhi_event_runs WHERE run_id=?').get(run.runId);
      const saved = await f.journal.changeTask(run.owner, row.revision, row.sequence + 1, mutate);
      assert.equal(saved.task.revision, run.task.revision + 1);
      const checkpoint = await f.taskState.checkpoint(run.task.id); assert.equal(checkpoint.task.revision, saved.task.revision);
      assert.equal(checkpoint.journalCursor.sequence, saved.cursor.sequence); assert.equal(f.count(), 0); snapshotFile(f, 'explicit-retry');
    } finally {f.close();}
  });
  await check('S07', 'Actual admitted identity retries once and digest conflicts plus concurrent CAS are fenced', async () => {
    const f = await openFixture(path.join(root, 'idempotency-cas'));
    try {
      const run = await f.admit(await f.fresh()); const effect = await f.effects.byCall(run.runId, run.callId);
      const input = intentOf(effect), before = f.snapshot();
      const again = await f.effects.intent(input, run.authority); assert.equal(again.created, false); assert.deepEqual(again.record, effect); assert.deepEqual(f.snapshot(), before);
      await assert.rejects(f.effects.intent({...input, contract: {...input.contract, inputDigest: 'f'.repeat(64)}}, run.authority), /effect_idempotency_conflict/);
      await assert.rejects(f.journal.recordToolContract(run.owner, run.callId, run.tool, {...run.contract, inputDigest: 'e'.repeat(64)}), /tool_receipt_conflict/);
      assert.deepEqual(f.snapshot(), before);
      const patch = {execution: {id: 'owned_cas_execution'}};
      const race = await Promise.allSettled([f.effects.transition(effect.id, effect.revision, 'executing', run.authority, patch),
        f.effects.transition(effect.id, effect.revision, 'executing', run.authority, patch)]);
      assert.equal(race.filter(value => value.status === 'fulfilled').length, 1);
      assert.match(String(race.find(value => value.status === 'rejected').reason), /effect_revision_conflict/);
      const latest = await f.effects.get(effect.id); assert.equal(latest.revision, effect.revision + 1);
      await assert.rejects(f.effects.updateExecution(effect.id, effect.revision, {id: 'late'}, run.authority), /effect_revision_conflict/);
      assert.equal(f.count(), 0); snapshotFile(f, 'race-result');
    } finally {f.close();}
  });
  await check('S08', 'Old Run cross-Task requests and old Task revision produce zero mutation', async () => {
    const f = await openFixture(path.join(root, 'owner-task-fences'));
    try {
      const old = await f.admit(await f.fresh()); await f.execute(old);
      old.publisher.enqueue({kind: 'status', status: 'interrupted', error: 'cancelled'}); await old.publisher.flush();
      const current = await f.admit(await f.fresh(old.sessionId)); const before = snapshotFile(f, 'before-negative');
      const effect = await f.effects.byCall(old.runId, old.callId);
      await assert.rejects(f.effects.transition(effect.id, effect.revision, 'unknown', old.authority), /event_owner_stale/);
      await assert.rejects(f.effects.transition(effect.id, effect.revision, 'unknown', current.authority), /event_owner_stale/);
      const oldTask = await f.taskState.get(old.task.id);
      await assert.rejects(f.taskState.propose(current.owner, old.task.id, oldTask.revision,
        {expectedRevision: oldTask.planRevision, reason: 'Stale cross-Task request', steps: oldTask.steps}), /task_owner_stale/);
      await assert.rejects(f.taskState.propose(current.owner, current.task.id, current.task.revision - 1,
        {expectedRevision: current.task.planRevision, reason: 'Stale CAS request', steps: current.task.steps}), /task_revision_conflict/);
      assert.deepEqual(snapshotFile(f, 'after-negative'), before); assert.equal(f.count(), 0);
    } finally {f.close();}
  });
  report.success = report.checks.length === 8 && report.checks.every(value => value.pass);
} catch (error) {report.error = String(error.stack ?? error);}
finally {save(); console.log(JSON.stringify({root, success: report.success, checks: report.checks.length})); if (!report.success) process.exitCode = 1;}
