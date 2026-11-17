import '../office-agent/register-source.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {openFixture, digest} from './phase6-state-foundation-worker.mjs';
const {createCapabilityRegistry} = await import('../../src/main/xiaozhi-agent/capabilities/registry.ts');
const {createCapabilityResolver} = await import('../../src/main/xiaozhi-agent/capabilities/resolver.ts');
const {createCapabilityTaskRuntime} = await import('../../src/main/xiaozhi-agent/capabilities/runtime.ts');
const {createProviderSnapshotStore} = await import('../../src/main/xiaozhi-agent/capabilities/provider-snapshots.ts');
const {nativeStatDeclarations} = await import('../../src/main/xiaozhi-agent/capabilities/native-stat.ts');
const {providerResult} = await import('../../src/main/xiaozhi-agent/capabilities/provider-contract.ts');
const {createEventPublisher} = await import('../../src/main/xiaozhi-agent/events/publisher.ts');

export function snapshotInput(snapshot) {
  const {schema, snapshotId, taskId, sessionId, runId, generation, createdAt, ...input} = snapshot;
  return input;
}
export async function fixture(root, capabilityId) {
  const f = await openFixture(root);
  const declarations = nativeStatDeclarations();
  if (capabilityId) for (const value of declarations) {
    value.definition.id = capabilityId; value.binding.capabilityId = capabilityId; value.binding.conformance.capabilityId = capabilityId;
  }
  const primary = declarations[0], alternative = declarations[1];
  const cap = primary.definition.id;
  const registry = createCapabilityRegistry(f.sql, {officialProviderIds: declarations.map(value => value.provider.id)}); await registry.migrate();
  const snapshots = createProviderSnapshotStore(f.sql); await snapshots.migrate();
  const installed = new Set(), denied = new Set();
  const key = (id, version, hash) => [id, version, hash].join(':');
  const calls = {resolve: [], resolveVersion: [], execute: [], authorize: [], safety: []};
  let afterResolve;
  const resolver = createCapabilityResolver(registry, async provider => {
    calls.authorize.push({id: provider.id, version: provider.version}); return !denied.has(provider.id + ':' + provider.version);
  }, {verifySource: provider => installed.has(key(provider.id, provider.version, provider.source.packageHash))});
  const adapters = {
    supports: id => id === cap,
    async resolve(sessionId, request) {
      calls.resolve.push({sessionId, request}); const result = await resolver.resolve(request);
      if (afterResolve) await afterResolve(); return result;
    },
    async resolveVersion(sessionId, request, id, version, hash) {
      calls.resolveVersion.push({sessionId, id, version, hash}); return resolver.resolveVersion(request, id, version, hash);
    },
    hasExecutable: (id, version, hash) => installed.has(key(id, version, hash)),
    async execute(context) {
      calls.execute.push({runId: context.runId, snapshotId: context.snapshot.snapshotId,
        providerId: context.snapshot.selection.providerId, version: context.snapshot.selection.providerVersion});
      return providerResult(context, {status: 'completed', data: {path: 'owned.txt', size: 7, version: digest('owned-metadata')},
        sideEffects: {status: 'none', references: []}});
    },
  };
  const request = {capabilityId: cap, contractVersion: '1.0.0', required: [], optional: [], conditions: [], platform: process.platform,
    localOnly: true, budget: {latencyMs: 30000, resourceUnits: 1}};
  async function register(value) {
    await registry.register(value.definition, value.provider, value.binding);
    installed.add(key(value.provider.id, value.provider.version, value.provider.source.packageHash));
  }
  function runtime(run) {
    return createCapabilityTaskRuntime({owner: run.owner, taskId: run.task.id, registry, snapshots, native: adapters, adapters,
      current: () => {
        const owner = f.db.prepare('SELECT run_id,generation FROM xiaozhi_event_owners WHERE session_id=?').get(run.sessionId);
        return owner?.run_id === run.runId && owner.generation === run.owner.generation;
      },
      canRefresh: async capability => {
        const blocked = (await f.effects.forTask(run.sessionId, run.task.id)).filter(effect => effect.contract.capabilityId === capability
          && ['local_write', 'external_effect'].includes(effect.contract.effect) && ['intent', 'executing', 'unknown'].includes(effect.state));
        calls.safety.push({capability, blocked: blocked.map(effect => ({id: effect.id, state: effect.state}))}); return blocked.length === 0;
      },
      workspace: async () => ({path: root, version: digest(root)}), persist: action => run.publisher.persist(action)});
  }
  await register(primary);
  const origin = await f.fresh(), initial = await runtime(origin).resolve(request);
  const oldSnapshot = initial.snapshot;
  async function resume() {
    const oldTask = await f.taskState.get(origin.task.id);
    origin.task = await origin.publisher.checkpointTask(work => import('../../src/main/xiaozhi-agent/tasks/task-state.ts').then(({createTaskState}) =>
      createTaskState({...work, transaction: action => action(work)}, {sanitize: async text => text}).settle(origin.owner, oldTask.id, oldTask.revision, true)));
    origin.publisher.enqueue({kind: 'status', status: 'interrupted', error: 'cancelled'}); await origin.publisher.flush();
    const sessionId = origin.sessionId, runId = 'run_' + randomUUID(), commandId = 'xicmd_' + randomUUID();
    f.db.prepare('INSERT INTO ai_agent_runs VALUES(?,?,?)').run(runId, sessionId, 'running');
    f.db.prepare('INSERT INTO xiaozhi_pi_commands VALUES(?,?,?,?)').run(commandId, sessionId, runId, 'running');
    const owner = await f.journal.begin(sessionId, runId, {id: runId, status: 'running', items: []});
    const publisher = createEventPublisher({journal: f.journal, owner, committed() {}, emit() {}, failed() {}, beforeTerminalEmit() {}});
    publisher.enqueue({kind: 'status', status: 'running'}); await publisher.flush();
    const task = await f.coordinator.resume({schema: 'xiaozhi.task.v1', sessionId, taskId: origin.task.id, revision: origin.task.revision,
      requirementsVersion: origin.task.requirementsVersion, commandId}, publisher);
    return {sessionId, runId, commandId, owner, publisher, task};
  }
  const current = await resume();
  const updated = structuredClone(primary); updated.provider.version = '9.8.7'; updated.binding.providerVersion = '9.8.7';
  updated.provider.source.packageHash = digest('owned-metadata-upgrade'); updated.binding.providerHash = updated.provider.source.packageHash;
  await register(updated); alternative.binding.priority = 100; await register(alternative);
  function capture() {
    const names = ['xiaozhi_capability_registry_v1', 'xiaozhi_capability_provider_versions_v1', 'xiaozhi_capability_snapshots_v1'];
    return {...f.snapshot(), ...Object.fromEntries(names.map(name => [name, f.db.prepare('SELECT * FROM ' + name + ' ORDER BY rowid').all().map(row => ({...row}))]))};
  }
  return {f, root, registry, snapshots, primary, alternative, updated, origin, current, oldSnapshot, calls, request, cap,
    runtime, capture, denied, installed, key, register,
    afterResolve: action => {afterResolve = action;},
    record(name, value) {fs.writeFileSync(path.join(root, name + '.json'), JSON.stringify(value, null, 2));}, close: () => f.close()};
}
