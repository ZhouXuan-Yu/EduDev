import {openFixture, digest} from './phase6-state-foundation-worker.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';

const {createPermissionStore} = await import('../../src/main/xiaozhi-agent/permissions/store.ts');
const {createPermissionEngine} = await import('../../src/main/xiaozhi-agent/permissions/engine.ts');
const {createPermissionNetworkBroker} = await import('../../src/main/xiaozhi-agent/permissions/network.ts');
const {createNetworkEffects} = await import('../../src/main/xiaozhi-agent/effects/network.ts');
const {runWithPermission} = await import('../../src/main/xiaozhi-agent/permissions/current.ts');
const {createTaskState} = await import('../../src/main/xiaozhi-agent/tasks/task-state.ts');
const {createEventPublisher} = await import('../../src/main/xiaozhi-agent/events/publisher.ts');

// This adapter supplies only test input and assertions around the original APIs.
export async function openNetworkFixture(root, origin, {beforeNetworkCommit} = {}) {
  const url = new URL(origin);
  if (url.origin !== origin || url.protocol !== 'http:' || url.hostname !== '127.0.0.1') throw Error('owned_loopback_required');
  const f = await openFixture(root);
  await f.sql.run(`CREATE TABLE IF NOT EXISTS ai_confirmation_items(id TEXT PRIMARY KEY,run_id TEXT,session_id TEXT,
    action_type TEXT,status TEXT,title TEXT,description TEXT,preview_md TEXT,payload_json TEXT,created_at TEXT,updated_at TEXT)`);
  const store = createPermissionStore(f.sql);
  await store.migrate();
  const engine = createPermissionEngine({store,
    current: async owner => {
      try {
        const task = await f.taskState.get(owner.taskId);
        if (!task || task.sessionId !== owner.sessionId) return false;
        await f.taskState.validateCurrent({sessionId: owner.sessionId, runId: owner.runId, generation: owner.generation}, task.id, task.revision);
        return true;
      } catch {return false;}
    },
    verifyRequest: async request => {
      const task = await f.taskState.get(request.owner.taskId);
      return !!task && task.sessionId === request.owner.sessionId && task.requirementsVersion === request.requirementsVersion;
    },
  });
  function withCommitBoundary(sql) {
    return {...sql,
      change: async (query, values = []) => {
        if (beforeNetworkCommit && query.startsWith('UPDATE xiaozhi_effects_v1 SET') && values[1] === 'committed') {
          const record = JSON.parse(String(values[2]));
          if (record.operation === 'network_post') await beforeNetworkCommit(record);
        }
        return sql.change(query, values);
      },
      transaction: action => sql.transaction(work => action(withCommitBoundary(work))),
    };
  }
  const directory = path.join(root, 'network-receipts');
  const effects = createNetworkEffects(beforeNetworkCommit ? withCommitBoundary(f.sql) : f.sql, directory);
  const broker = createPermissionNetworkBroker({engine, effects, sanitize: async text => text});
  const scopes = [
    {kind: 'network', origin, methods: ['GET', 'POST'], purpose: 'script_network'},
    {kind: 'egress', origin, classifications: ['public']},
  ];
  async function issue(run) {
    return store.issue(run.sessionId, scopes, {kind: 'teacher', reference: 'owned-network-fixture'}, run.task.id,
      new Date(Date.now() + 120000).toISOString());
  }
  async function call(run, raw, {callId = 'network_' + randomUUID(), owner, signal = new AbortController().signal} = {}) {
    const actualOwner = {...run.owner, taskId: run.task.id};
    const request = {schemaVersion: 2, owner: actualOwner, requirementsVersion: run.task.requirementsVersion,
      callId: run.callId, action: run.tool, inputDigest: run.contract.inputDigest, purpose: 'Owned synthetic network parent',
      scopes, files: [], provider: null, classification: 'public', expiresAt: new Date(Date.now() + 60000).toISOString()};
    return engine.run(request, signal, context => runWithPermission({request, ...context,
      recordAuthority: async (reference, refs) => {
        const contract = {...run.contract, grantRefs: refs,
          authorityRefs: [...new Set([...run.contract.authorityRefs, reference])]};
        await run.publisher.persist(current => f.journal.recordToolContract(current, run.callId, run.tool, contract));
        run.contract = contract;
      },
    }, () => broker.fetch(owner || actualOwner, callId, raw, context.signal)));
  }
  async function resume(taskId) {
    const task = await f.taskState.get(taskId);
    const runId = 'run_' + randomUUID(), commandId = 'xicmd_' + randomUUID();
    f.db.prepare('INSERT INTO ai_agent_runs VALUES(?,?,?)').run(runId, task.sessionId, 'running');
    f.db.prepare('INSERT INTO xiaozhi_pi_commands VALUES(?,?,?,?)').run(commandId, task.sessionId, runId, 'running');
    const owner = await f.journal.begin(task.sessionId, runId, {id: runId, status: 'running', items: []});
    const publisher = createEventPublisher({journal: f.journal, owner, committed() {}, emit() {}, failed() {}, beforeTerminalEmit() {}});
    publisher.enqueue({kind: 'status', status: 'running'}); await publisher.flush();
    const resumed = await f.coordinator.resume({schema: 'xiaozhi.task.v1', sessionId: task.sessionId, taskId,
      revision: task.revision, requirementsVersion: task.requirementsVersion, commandId}, publisher);
    return {sessionId: task.sessionId, runId, commandId, owner, publisher, task: resumed};
  }
  async function admitNext(run, previous) {
    const callId = 'call_' + randomUUID(), tool = previous.tool;
    const target = path.join(root, 'parent-' + callId + '.txt');
    const inputDigest = digest({path: target, text: 'Distinct owned parent for the same explicit Task'});
    run.publisher.enqueue({kind: 'tool_start', callId, tool, label: 'Owned network parent'}); await run.publisher.flush();
    run.task = await run.publisher.checkpointTask(work => createTaskState({...work, transaction: action => action(work)}, {sanitize: async text => text})
      .admit(run.owner, run.task.id, run.task.revision, 'owned_file', callId, tool, inputDigest, target, true, true));
    await run.publisher.persist(owner => f.journal.admitTool(owner, callId, tool));
    const contract = {...previous.contract, taskId: run.task.id, planRevision: run.task.planRevision,
      requirementsVersion: run.task.requirementsVersion, inputDigest, target, grantRefs: [], authorityRefs: []};
    await run.publisher.persist(owner => f.journal.recordToolContract(owner, callId, tool, contract));
    const admitted = {...run, callId, tool, contract};
    await f.execute(admitted);
    return admitted;
  }
  const records = async taskId => {
    const task = await f.taskState.get(taskId);
    return (await f.effects.forTask(task.sessionId, taskId)).filter(row => row.operation.startsWith('network_'));
  };
  return {f, store, engine, call, issue, resume, admitNext, directory, records, close: () => f.close()};
}

if (process.argv[2] === '--receipt-boundary') {
  const root = process.argv[3], origin = process.argv[4], pathname = process.argv[5];
  let fixture;
  try {
    fixture = await openNetworkFixture(root, origin, {beforeNetworkCommit: async record => {
      const file = path.join(fixture.directory, record.id + '.json');
      const receipt = JSON.parse(fs.readFileSync(file, 'utf8'));
      const identity = {sessionId: record.owner.sessionId, taskId: record.owner.taskId, runId: record.owner.runId,
        owner: record.owner, effectId: record.id, parentCallId: record.receipt.callId, raw, directory: fixture.directory};
      fs.writeFileSync(path.join(root, 'boundary-identity.json'), JSON.stringify(identity, null, 2));
      process.send({type: 'receipt_published_before_commit', identity, record, receipt,
        receiptSha: digest(fs.readFileSync(file)), checkpoint: await fixture.f.taskState.checkpoint(identity.taskId)});
      await new Promise(() => {});
    }});
    const run = await fixture.f.admit(await fixture.f.fresh()); await fixture.f.execute(run); await fixture.issue(run);
    const raw = {url: origin + pathname, method: 'POST', body: '{"fixture":"cold-receipt"}', purpose: 'script_network', classification: 'public'};
    await fixture.call(run, raw);
    throw Error('boundary_was_not_reached');
  } catch (error) {
    process.send?.({type: 'worker_error', error: String(error.stack || error)});
    fixture?.close(); process.exitCode = 1; process.disconnect?.();
  }
}
