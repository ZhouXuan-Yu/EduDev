import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';
import {mkdir, mkdtemp, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {test} from 'node:test';
import {digest, openFixture} from './phase6-state-foundation-worker.mjs';

const {createCapabilityRegistry} = await import('../../src/main/xiaozhi-agent/capabilities/registry.ts');
const {createCapabilityTaskRuntime} = await import('../../src/main/xiaozhi-agent/capabilities/runtime.ts');
const {createProviderSnapshotStore} = await import('../../src/main/xiaozhi-agent/capabilities/provider-snapshots.ts');
const {createNativeStatService, NATIVE_STAT_CAPABILITY, NATIVE_STAT_PROVIDER_IDS} =
  await import('../../src/main/xiaozhi-agent/capabilities/native-stat.ts');

const [hana, workspace] = NATIVE_STAT_PROVIDER_IDS;
const request = {
  capabilityId: NATIVE_STAT_CAPABILITY.id,
  contractVersion: NATIVE_STAT_CAPABILITY.contractVersion,
  required: [], optional: [], conditions: [],
  platform: process.platform, localOnly: true, budget: {latencyMs: 30_000, resourceUnits: 1},
};
const root = await mkdtemp(path.join(tmpdir(), 'provider-snapshot-recovery-'));
console.log('SQLite and readback evidence:', root);

async function setup(t, name, options = {}) {
  const directory = path.join(root, name);
  await mkdir(directory);
  const f = await openFixture(directory);
  t.after(() => f.close());
  const registry = createCapabilityRegistry(f.sql, {officialProviderIds: NATIVE_STAT_PROVIDER_IDS});
  const snapshots = createProviderSnapshotStore(f.sql);
  await registry.migrate();
  await snapshots.migrate();
  const run = await f.fresh();
  const lease = {path: directory, label: 'Synthetic stat workspace', version: digest(directory)};
  const file = 'owned.txt';
  const content = 'Real fixture bytes for capability recovery';
  await writeFile(path.join(directory, file), content);
  const isCurrent = (sessionId, runId) => {
    const owner = f.db.prepare('SELECT run_id,generation FROM xiaozhi_event_owners WHERE session_id=?').get(sessionId);
    return owner?.run_id === runId && owner.generation === run.owner.generation;
  };
  const native = createNativeStatService({registry, resolveWorkspace: async () => lease, isCurrent});
  await native.register();
  let refreshChecks = 0;
  const allow = {refresh: true, attempts: Infinity};
  async function setProvider(id, update) {
    const view = await registry.snapshot();
    const provider = view.providers.find(item => item.id === id);
    const binding = view.bindings.find(item => item.providerId === id && item.capabilityId === request.capabilityId);
    assert(provider && binding);
    update(provider, binding);
    await registry.register(NATIVE_STAT_CAPABILITY, provider, binding, view.revision);
  }
  await setProvider(hana, (_, binding) => {binding.priority = 10; binding.userPinned = options.pinned === true;});
  const runtime = createCapabilityTaskRuntime({registry, snapshots, native, owner: run.owner, taskId: run.task.id,
    current: () => isCurrent(run.sessionId, run.runId), workspace: async () => lease,
    canRefresh: async () => allow.refresh && ++refreshChecks <= allow.attempts, persist: action => run.publisher.persist(action)});
  const requirement = options.mime ? {...request, conditions: ['require_mime']} : request;
  const selected = (await runtime.resolve(requirement)).snapshot;
  assert.equal(selected?.selection.providerId, hana);
  const originalTask = await f.taskState.get(run.task.id);
  const history = () => snapshots.history(run.task.id);
  const execute = () => runtime.execute('owned-metadata', requirement, {path: file});
  const observe = async result => {
    const seen = {result, history: await history(), actualReads: native.executionHistory(),
      task: await f.taskState.get(run.task.id), providers: await registry.snapshot()};
    await writeFile(path.join(directory, 'report.json'), JSON.stringify(seen, null, 2));
    return seen;
  };
  return {allow, setProvider, execute, observe, selected, originalTask, file, content};
}

test('uses the original verified readable Provider when another Provider becomes preferred', async t => {
  const x = await setup(t, 'healthy-original');
  await x.setProvider(workspace, (_, binding) => {binding.priority = 20;});
  const seen = await x.observe(await x.execute());
  assert.equal(seen.result.result?.status, 'completed');
  assert.equal(seen.result.result?.snapshotId, x.selected.snapshotId);
  assert.deepEqual(seen.actualReads.map(call => call.providerId), [hana]);
  assert.deepEqual(seen.history, [x.selected]);
});

test('recovers an unsent local read once through the compatible installed Provider', async t => {
  const x = await setup(t, 'unsent-local-read');
  await x.setProvider(hana, provider => {provider.health = 'unavailable';});
  const seen = await x.observe(await x.execute());
  assert.equal(seen.result.result?.data?.path, x.file, JSON.stringify(seen.result));
  assert.equal(seen.result.result.data.size, Buffer.byteLength(x.content));
  assert.match(seen.result.result.data.version, /^[a-f0-9]{64}$/u);
  assert.deepEqual(seen.actualReads.map(call => call.providerId), [workspace]);
  assert.equal(seen.history.length, 2);
  assert.deepEqual(seen.history.find(item => item.snapshotId === x.selected.snapshotId), x.selected);
  const recovered = seen.history.find(item => item.snapshotId !== x.selected.snapshotId);
  assert.equal(recovered.previousSnapshotId, x.selected.snapshotId);
  assert.equal(recovered.refreshReason, 'explicit_refresh');
  assert.deepEqual(recovered.requirement, x.selected.requirement);
  assert.deepEqual(seen.task, x.originalTask);
  assert.equal(seen.providers.bindings.find(item => item.providerId === hana).priority, 10);
});

for (const [name, options] of [
  ['user-pinned', {pinned: true}],
  ['missing-conditional-evidence', {mime: true}],
  ['busy-safe-point', {}],
  ['late-busy-safe-point', {}],
  ['approval-required', {}],
]) {
  test(`preserves the original snapshot and makes no replacement read when ${name}`, async t => {
    const x = await setup(t, name, options);
    if (name === 'busy-safe-point') x.allow.refresh = false;
    if (name === 'late-busy-safe-point') x.allow.attempts = 3;
    await x.setProvider(hana, provider => {provider.health = 'unavailable';});
    if (name === 'approval-required') await x.setProvider(workspace, provider => {provider.health = 'pending_approval';});
    const seen = await x.observe(await x.execute());
    assert.equal(seen.result.success, false);
    assert.deepEqual(seen.actualReads, []);
    assert.deepEqual(seen.history, [x.selected]);
    assert.deepEqual(seen.task, x.originalTask);
  });
}
