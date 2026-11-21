// Source-only, zero-provider test. In draft mode, untouched dependencies are
// resolved from the frozen source tree; all SQLite databases remain in memory.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {registerHooks} from 'node:module';
import {DatabaseSync} from 'node:sqlite';
import {randomUUID} from 'node:crypto';
import {setImmediate as tick, setTimeout as delay} from 'node:timers/promises';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const frozen = process.env.EDUDEV_FROZEN_SOURCE_ROOT || root;
registerHooks({resolve(specifier, context, next) {
  try {return next(specifier, context);}
  catch (error) {if (!['ERR_MODULE_NOT_FOUND', 'MODULE_NOT_FOUND'].includes(error.code)) throw error;}
  if (specifier.startsWith('.')) {
    const candidate = fileURLToPath(new URL(specifier, context.parentURL));
    const local = [candidate, candidate + '.ts', candidate + '.mjs'];
    const relative = path.relative(root, candidate);
    if (frozen !== root && relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative)) {
      const original = path.join(frozen, relative);
      local.push(original, original + '.ts', original + '.mjs');
    }
    for (const file of local) if (fs.existsSync(file) && fs.statSync(file).isFile()) return next(pathToFileURL(file).href, context);
  }
  return next(specifier, context);
}});

const {createPermissionStore} = await import('../../src/main/xiaozhi-agent/permissions/store.ts');
const {createPermissionEngine} = await import('../../src/main/xiaozhi-agent/permissions/engine.ts');
const {createToolPermissionRuntime} = await import('../../src/main/xiaozhi-agent/permissions/tool-runtime.ts');
const {permissionHash} = await import('../../src/main/xiaozhi-agent/permissions/validation.ts');
const {serializeStateWrites} = await import('../../src/main/xiaozhi-agent/serialized-state-sql.ts');
const {createCapabilityRegistry} = await import('../../src/main/xiaozhi-agent/capabilities/registry.ts');
const {registerSessionToolGovernance, createRunToolGovernance, CORE_TOOL_PROVIDER_IDS} = await import('../../src/main/xiaozhi-agent/capabilities/core-governance.ts');
const {createToolExecutionBoundary} = await import('../../src/main/xiaozhi-agent/tools/execution-bound.ts');
const {SessionExecutionRegistry} = await import('../../src/main/xiaozhi-agent/vendor/hana/lib/session-execution-registry.ts');
const {createPiRunBudget} = await import('../../src/main/xiaozhi-agent/runtime-budget.ts');
const {DEFAULT_PI_BUDGET} = await import('../../src/main/xiaozhi-agent/budget-state.ts');

const checks = [];
async function until(predicate) {
  for (let n = 0; n < 200; n++) {const value = await predicate(); if (value) return value; await tick();}
  throw Error('owned_fixture_did_not_reach_expected_state');
}
const outcome = promise => promise.then(value => ({ok: true, value}), error => ({ok: false, error}));
async function bounded(promise) {
  let timer;
  try {return await Promise.race([promise, new Promise((_, reject) => {timer = setTimeout(() => reject(Error('owned_fixture_timeout')), 2000);})]);}
  finally {clearTimeout(timer);}
}
async function fixture(extra = {}) {
  const db = new DatabaseSync(':memory:');
  const connection = {
    run: async (query, args = []) => {db.prepare(query).run(...args);},
    change: async (query, args = []) => Number(db.prepare(query).run(...args).changes),
    all: async (query, args = []) => db.prepare(query).all(...args),
  };
  connection.transaction = async action => {
    db.exec('BEGIN IMMEDIATE');
    try {const value = await action(connection); db.exec('COMMIT'); return value;}
    catch (error) {db.exec('ROLLBACK'); throw error;}
  };
  const sql = serializeStateWrites(connection);
  await sql.run('CREATE TABLE ai_confirmation_items(id TEXT PRIMARY KEY,run_id TEXT,session_id TEXT,action_type TEXT,status TEXT,title TEXT,description TEXT,preview_md TEXT,payload_json TEXT,created_at TEXT,updated_at TEXT)');
  const store = createPermissionStore(sql); await store.migrate();
  const owner = {sessionId: 'aisession_' + randomUUID(), taskId: 'xitask_' + 'a'.repeat(64), runId: 'run_owned_' + randomUUID(), generation: 1};
  const controller = new AbortController();
  let current = true, waitCalls = 0;
  const engine = createPermissionEngine({store, current: value => current && permissionHash(value) === permissionHash(owner), ...extra});
  const request = {schemaVersion: 2, owner, requirementsVersion: 1, callId: 'call_' + randomUUID(), action: 'fixture_no_io',
    inputDigest: permissionHash({synthetic: true}), purpose: 'Owned counter fixture; no network IO',
    scopes: [{kind: 'network', origin: 'https://example.com', methods: ['GET'], purpose: 'public'}],
    files: [], provider: null, classification: 'public', expiresAt: new Date(Date.now() + 600000).toISOString()};
  const wait = {wait: action => {waitCalls++; return action();}};
  async function pending() {return until(async () => (await store.approvals(owner.sessionId)).find(row => row.state === 'pending'));}
  async function decide(decision = 'approve') {
    const row = await pending();
    await engine.decide({sessionId: owner.sessionId, approvalId: row.id, revision: row.revision, decision, scope: 'operation'});
    return row.id;
  }
  return {db, sql, store, engine, owner, request, controller, wait, pending, decide, waitCalls: () => waitCalls,
    stale: () => {current = false;},
    async close() {controller.abort(); await tick(); await tick(); assert.equal(engine.activeCount(), 0); db.close();}};
}
async function check(name, action) {
  const f = await fixture();
  try {await action(f); checks.push({name, pass: true}); console.log('PASS ' + name);}
  finally {await f.close();}
}
async function governance(f) {
  const registry = createCapabilityRegistry(f.sql, {officialProviderIds: CORE_TOOL_PROVIDER_IDS}); await registry.migrate();
  const tool = {name: 'office_create_text', label: 'Owned counter', description: 'Owned fixture', parameters: {type: 'object', properties: {}, additionalProperties: false}, execute: async () => ({content: [], details: {success: true}})};
  const records = await registerSessionToolGovernance({definitions: [tool], registry, mcp: async () => null});
  const original = {planRevision: 1, requirementsVersion: 1, stepId: 'save', target: 'owned_target'};
  let task = {...original}, effects = 0;
  const g = createRunToolGovernance({owner: f.owner, registry, records, current: () => true, mcp: async () => null,
    task: async (_call, currentPlan) => currentPlan ? task : original,
    snapshot: async () => ({snapshotId: 'xicap_' + randomUUID(), registryRevision: (await registry.snapshot()).revision}),
    persist: async () => {}, beginEffect: async () => {effects++;}});
  await g.before(f.request.callId, tool.name, {}, f.controller.signal);
  return {g, tool, change: value => {task = {...task, ...value};}, effects: () => effects,
    wait: {...f.wait, beforeResume: () => g.assertWaitingCall(f.request.callId, tool.name, {}, f.controller.signal)}};
}

await check('Noninteractive callers retain pending-return behavior and do not silently resume', async f => {
  let dispatch = 0;
  await assert.rejects(f.engine.run(f.request, f.controller.signal, async () => {dispatch++;}), /permission_pending/);
  const id = await f.decide(); await tick();
  assert.equal(dispatch, 0); assert.equal((await f.store.approval(f.owner.sessionId, id)).state, 'approved');
});
await check('The original active Run waits, freezes the request, and consumes approval exactly once', async f => {
  let dispatch = 0, settled = false;
  const raw = structuredClone(f.request);
  const running = outcome(f.engine.run(raw, f.controller.signal, async context => {dispatch++; assert.deepEqual(context.decision.state, 'allow'); return 'owned';}, undefined, f.wait)).finally(() => {settled = true;});
  await f.pending(); await tick(); raw.action = 'changed_after_start'; raw.inputDigest = 'b'.repeat(64);
  assert.equal(settled, false); assert.equal(dispatch, 0); assert.equal(f.engine.activeCount(), 1);
  const id = await f.decide(); assert.equal((await bounded(running)).ok, true);
  const saved = await f.store.approval(f.owner.sessionId, id);
  assert.equal(dispatch, 1); assert.equal(saved.state, 'executed'); assert.deepEqual(saved.admittedOwner, f.owner); assert.equal(f.waitCalls(), 1);
  await assert.rejects(f.engine.run({...f.request, callId: 'call_no_replay'}, f.controller.signal, async () => {dispatch++;}, undefined, f.wait), /permission_denied/);
  assert.equal(dispatch, 1);
});
await check('Reject remains a real denial with no native dispatch or second approval', async f => {
  let dispatch = 0;
  const running = outcome(f.engine.run(f.request, f.controller.signal, async () => {dispatch++;}, undefined, f.wait));
  const id = await f.decide('reject'); const result = await bounded(running);
  assert.equal(result.error.message, 'permission_denied'); assert.equal(dispatch, 0);
  assert.equal((await f.store.approval(f.owner.sessionId, id)).state, 'rejected'); assert.equal((await f.store.approvals(f.owner.sessionId)).length, 1);
});
await check('CancelRun cleans the waiter; a later approval cannot dispatch the old call', async f => {
  let dispatch = 0;
  const running = outcome(f.engine.run(f.request, f.controller.signal, async () => {dispatch++;}, undefined, f.wait));
  await f.pending(); await tick(); f.engine.cancelRun(f.owner);
  assert.equal((await bounded(running)).error.message, 'cancelled');
  const id = await f.decide(); await tick();
  assert.equal(dispatch, 0); assert.equal(f.engine.activeCount(), 0); assert.equal((await f.store.approval(f.owner.sessionId, id)).state, 'approved');
});
await check('Caller abort and owner change cannot cross waiting authority', async f => {
  let dispatch = 0;
  const running = outcome(f.engine.run(f.request, f.controller.signal, async () => {dispatch++;}, undefined, f.wait));
  await f.pending(); f.stale(); await f.decide();
  assert.equal((await bounded(running)).error.message, 'permission_denied'); assert.equal(dispatch, 0);
});
await check('The original caller signal aborts and unsubscribes without consuming late approval', async f => {
  let dispatch = 0;
  const running = outcome(f.engine.run(f.request, f.controller.signal, async () => {dispatch++;}, undefined, f.wait));
  await f.pending(); f.controller.abort('owned_stop');
  assert.equal((await bounded(running)).error.message, 'cancelled');
  const id = await f.decide(); await f.engine.changed(f.owner.sessionId); await tick();
  assert.equal(dispatch, 0); assert.equal((await f.store.approval(f.owner.sessionId, id)).state, 'approved');
});
await check('Existing teacher wait-budget exhaustion aborts the permission waiter', async f => {
  let dispatch = 0;
  const budget = createPiRunBudget({budget: {...DEFAULT_PI_BUDGET, waitMs: 1000}, runId: f.owner.runId,
    emit: () => {}, abort: () => f.controller.abort('budget_exhausted')});
  budget.start();
  try {
    const running = outcome(f.engine.run(f.request, f.controller.signal, async () => {dispatch++;}, undefined, {wait: action => budget.wait(action)}));
    await f.pending(); assert.equal((await bounded(running)).error.message, 'cancelled');
    assert.equal(budget.snapshot().exhausted, 'wait_time'); assert.equal(dispatch, 0);
  } finally {budget.finish('completed');}
});
await check('Expiry wakes the pending call and releases the active controller', async f => {
  let dispatch = 0;
  const running = outcome(f.engine.run({...f.request, expiresAt: new Date(Date.now() + 80).toISOString()}, f.controller.signal, async () => {dispatch++;}, undefined, f.wait));
  await f.pending(); assert.equal((await bounded(running)).error.message, 'permission_denied'); assert.equal(dispatch, 0); assert.equal(f.engine.activeCount(), 0);
});
await check('An approval committed during publication cannot be lost before subscription', async outer => {
  let inner, dispatched = 0;
  inner = await fixture({notify: async sessionId => {
    const row = (await inner.store.approvals(sessionId)).find(value => value.state === 'pending');
    if (row) await inner.engine.decide({sessionId, approvalId: row.id, revision: row.revision, decision: 'approve', scope: 'operation'});
  }});
  try {
    await bounded(inner.engine.run(inner.request, inner.controller.signal, async () => {dispatched++;}, undefined, inner.wait));
    assert.equal(dispatched, 1); assert.equal((await inner.store.approvals(inner.owner.sessionId))[0].state, 'executed');
  } finally {await inner.close();}
});
await check('Concurrent consumers cannot both execute or corrupt the winning lease', async f => {
  let dispatch = 0;
  const operation = async () => {dispatch++; await tick(); return 'owned';};
  const a = outcome(f.engine.run(f.request, f.controller.signal, operation, undefined, f.wait));
  const b = outcome(f.engine.run({...f.request, callId: 'call_competitor'}, f.controller.signal, operation, undefined, f.wait));
  const id = await f.decide(); const results = await bounded(Promise.all([a, b]));
  assert.equal(results.filter(value => value.ok).length, 1); assert.equal(dispatch, 1); assert.equal((await f.store.approval(f.owner.sessionId, id)).state, 'executed');
});
await check('Unrelated wake notifications do not reset the one teacher wait budget', async f => {
  let dispatch = 0;
  const running = outcome(f.engine.run(f.request, f.controller.signal, async () => {dispatch++;}, undefined, f.wait));
  await f.pending(); await f.engine.changed(f.owner.sessionId); await tick(); await f.engine.changed(f.owner.sessionId); await tick();
  const id = await f.decide(); assert.equal((await bounded(running)).ok, true);
  assert.equal(f.waitCalls(), 1); assert.equal(dispatch, 1); assert.equal((await f.store.approval(f.owner.sessionId, id)).state, 'executed');
});
await check('A teacher-issued scope wakes the call only after the committed grant is reread', async f => {
  let dispatch = 0;
  const running = outcome(f.engine.run(f.request, f.controller.signal, async () => {dispatch++;}, undefined, f.wait));
  await f.pending(); await f.store.issue(f.owner.sessionId, f.request.scopes, {kind: 'teacher', reference: 'owned_explicit_grant'});
  await f.engine.changed(f.owner.sessionId);
  assert.equal((await bounded(running)).ok, true); assert.equal(dispatch, 1);
});
for (const changed of [{planRevision: 2}, {requirementsVersion: 2}, {stepId: 'different_step'}, {target: 'different_target'}]) {
  await check('Waiting revalidates before consuming changed Task identity: ' + Object.keys(changed)[0], async f => {
    const x = await governance(f); let dispatch = 0;
    const running = outcome(f.engine.run(f.request, f.controller.signal, async () => x.g.execute(f.request.callId, x.tool.name, {}, f.controller.signal, async () => {dispatch++; return {content: [], details: {success: true}};}), undefined, x.wait));
    await f.pending(); x.change(changed); const id = await f.decide();
    assert.equal((await bounded(running)).error.reason, 'task_owner_stale');
    const row = await f.store.approval(f.owner.sessionId, id);
    assert.equal(row.state, 'invalidated'); assert.equal(row.admittedOwner, undefined); assert.equal(dispatch, 0); assert.equal(x.effects(), 0);
  });
}
await check('A Task change after consume is fenced before effect and the consumed approval stays nonreusable', async f => {
  const x = await governance(f); let dispatch = 0;
  const running = outcome(f.engine.run(f.request, f.controller.signal, async () => {
    x.change({planRevision: 2});
    return x.g.execute(f.request.callId, x.tool.name, {}, f.controller.signal, async () => {dispatch++; return {content: [], details: {success: true}};});
  }, undefined, x.wait));
  const id = await f.decide(); assert.equal((await bounded(running)).error.reason, 'task_owner_stale');
  assert.equal(dispatch, 0); assert.equal(x.effects(), 0); assert.equal((await f.store.approval(f.owner.sessionId, id)).state, 'uncertain');
});
for (const [label, invalidate] of [
  ['stopped Run', f => {f.stale(); f.controller.abort();}],
  ['changed owner', f => f.stale()],
]) {
  await check(`Consumption is settled when current identity changes immediately after commit: ${label}`, async f => {
    const consume = f.store.consume.bind(f.store);
    f.store.consume = async (...args) => {
      const leased = await consume(...args);
      invalidate(f);
      return leased;
    };
    let dispatched = 0;
    const running = outcome(f.engine.run(f.request, f.controller.signal, async () => {dispatched++;}, undefined, f.wait));
    const id = await f.decide();
    assert.equal((await bounded(running)).ok, false);
    assert.equal(dispatched, 0);
    const reloaded = createPermissionStore(f.sql);
    const approval = await reloaded.approval(f.owner.sessionId, id);
    assert.equal(approval.state, 'uncertain');
    assert.equal(approval.admittedOwner.runId, f.owner.runId);
  });
}
await check('Tool boundary passes one frozen call through existing budget and original dispatch gate', async f => {
  const listeners = new Set(); let waiting = false, dispatched = 0, proofs = 0, settled = false;
  const budget = createPiRunBudget({budget: DEFAULT_PI_BUDGET, runId: f.owner.runId, limitsEnforced: false, emit: () => {}, abort: () => f.controller.abort(),
    onWaiting: value => {waiting = value; for (const fn of listeners) fn(value);}});
  budget.start();
  const runtime = createToolPermissionRuntime({engine: f.engine, owner: () => f.owner, workspace: async () => ({path: root})});
  const boundary = createToolExecutionBoundary({sessionId: f.owner.sessionId, workspaceKey: 'owned_wait_' + randomUUID(), registry: new SessionExecutionRegistry(), epoch: () => f.owner.runId,
    current: epoch => epoch === f.owner.runId, waiting: () => waiting, onWaiting: fn => {listeners.add(fn); return () => listeners.delete(fn);}, timeout: () => 40,
    beforeDelivery: async () => {}, attempt: async () => {}, notDispatched: async () => {proofs++;},
    executeAuthorized: (call, name, input, signal, perform) => runtime.execute(call, name, input, signal, perform, {wait: action => budget.wait(action)})});
  const tool = {name: 'office_create_text', label: 'Owned', description: 'Counter only', parameters: {type: 'object', properties: {path: {type: 'string'}}, required: ['path'], additionalProperties: false},
    execute: async () => {dispatched++; return {content: [], details: {success: true}};}};
  const running = boundary.execute(tool, f.request.callId, {path: 'owned-never-written.html'}, f.controller.signal).finally(() => {settled = true;});
  const duplicate = boundary.execute(tool, f.request.callId, {path: 'owned-never-written.html'}, f.controller.signal);
  await f.pending(); await delay(80);
  assert.equal(waiting, true); assert.equal(settled, false); assert.equal(dispatched, 0); assert.equal(proofs, 0);
  await f.decide(); const [a, b] = await bounded(Promise.all([running, duplicate]));
  assert.equal(a, b); assert.equal(a.details.execution.state, 'succeeded'); assert(a.details.execution.teacherWaitMs >= 60);
  assert.equal(dispatched, 1); assert.equal(proofs, 0); assert.equal(listeners.size, 0); budget.finish('completed');
});
console.log(JSON.stringify({success: true, checks, paidCalls: 0, diskWrites: 0,
  boundary: 'Actual source Permission Engine/Store/Tool Runtime/Governance/Boundary/Budget with in-memory SQLite. Task tuple, native body and snapshot/journal adapter are explicit counter fixtures. No Electron or provider acceptance claim.'}));
