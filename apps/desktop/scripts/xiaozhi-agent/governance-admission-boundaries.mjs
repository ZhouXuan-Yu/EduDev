import '../office-agent/register-source.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {openFixture, digest} from './phase6-state-foundation-worker.mjs';

const {createCapabilityRegistry} = await import('../../src/main/xiaozhi-agent/capabilities/registry.ts');
const {createProviderSnapshotStore} = await import('../../src/main/xiaozhi-agent/capabilities/provider-snapshots.ts');
const {registerSessionToolGovernance, createRunToolGovernance, CORE_TOOL_PROVIDER_IDS} = await import('../../src/main/xiaozhi-agent/capabilities/core-governance.ts');
const {createToolExecutionBoundary} = await import('../../src/main/xiaozhi-agent/tools/execution-bound.ts');
const {SessionExecutionRegistry} = await import('../../src/main/xiaozhi-agent/vendor/hana/lib/session-execution-registry.ts');
const {TaskAdmissionError} = await import('../../src/main/xiaozhi-agent/tasks/admission-error.ts');
const {validToolAttempt} = await import('../../src/shared/xiaozhi-tool-attempt.ts');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'xiaozhi-governance-admission-'));
const report = {success: false, root, checks: [], paidCalls: 0,
  boundary: 'Current governance, Tool boundary, Task, SQLite Journal/Receipt/Effect transactions. Original tool bodies and MCP identity lookup are declared counter fixtures. Actual production Host is tested separately.'};

async function fixture() {
  const f = await openFixture(path.join(root, randomUUID()));
  const run = await f.fresh();
  const registry = createCapabilityRegistry(f.sql, {officialProviderIds: CORE_TOOL_PROVIDER_IDS});
  await registry.migrate();
  const snapshots = createProviderSnapshotStore(f.sql);
  await snapshots.migrate();
  const name = 'mcp_' + 'a'.repeat(24) + '_lookup_lesson';
  const source = {serverId: 'mcp_' + randomUUID(), tool: 'lookup_lesson', sourceHash: 'a'.repeat(64), schemaHash: 'b'.repeat(64), transport: 'http'};
  let currentSource = source, performed = 0, critical = 0, revokeAtExecute = false, throwAfterInvoke = false;
  const definitions = [name, 'office_list_files'].map(name => ({name, label: name, description: 'Owned counter fixture',
    parameters: {type: 'object', properties: {}, additionalProperties: false},
    execute: async () => {
      performed++;
      if (throwAfterInvoke) throw new TaskAdmissionError('source_changed');
      return {content: [{type: 'text', text: 'owned result'}], details: {success: true}};
    }}));
  const records = await registerSessionToolGovernance({definitions, registry, mcp: async tool => tool === name ? currentSource : null});
  const governance = createRunToolGovernance({owner: {...run.owner, taskId: run.task.id}, registry, records,
    current: () => true, mcp: async tool => tool === name ? currentSource : null,
    task: async () => ({planRevision: run.task.planRevision, requirementsVersion: 1, stepId: null, target: null}),
    snapshot: async record => {
      const existing = await snapshots.current(run.owner, run.task.id, record.capabilityId);
      if (existing) return existing;
      const catalog = await registry.snapshot();
      const version = await registry.providerVersion(record.providerId, record.providerVersion, record.capabilityId);
      return run.publisher.persist(() => snapshots.save(run.owner, run.task.id, {capabilityId: record.capabilityId, registryRevision: catalog.revision,
        requirement: {capabilityId: record.capabilityId, contractVersion: '1.0.0', required: ['invoke'], optional: [], conditions: [],
          localOnly: version.provider.locality === 'local', platform: process.platform, budget: {latencyMs: record.manifest.timeoutMs, resourceUnits: 1}},
        selection: {providerId: record.providerId, providerVersion: record.providerVersion, contractVersion: '1.0.0', level: 'full', missingRequirements: [], limitations: []},
        providerHash: record.providerHash, evidenceRefs: version.binding.conformance.evidence.map(item => item.reference), previousSnapshotId: null, refreshReason: 'initial'}));
    },
    persist: (callId, tool, contract) => run.publisher.persist(owner => f.journal.recordToolContract(owner, callId, tool, contract)),
    beginEffect: callId => run.publisher.persist(owner => f.journal.beginToolEffect(owner, callId)),
  });
  const boundary = createToolExecutionBoundary({sessionId: run.sessionId, workspaceKey: f.file, trustedMcpNames: new Set([name]),
    registry: new SessionExecutionRegistry(), epoch: () => run.runId, current: () => true, waiting: () => false, onWaiting: () => () => {},
    beforeDelivery: async (callId, tool, signal, input) => {
      await run.publisher.persist(owner => f.journal.admitTool(owner, callId, tool));
      await governance.before(callId, tool, input, signal);
    },
    attempt: async attempt => {run.publisher.enqueue({kind: 'tool_attempt', attempt}); await run.publisher.barrier();},
    executeAuthorized: (callId, tool, input, signal, perform) => {
      if (revokeAtExecute) currentSource = null;
      return governance.execute(callId, tool, input, signal, perform);
    },
    criticalFailure: error => {critical++; run.publisher.fail(error);},
  });
  const receipt = callId => f.db.prepare('SELECT * FROM xiaozhi_tool_receipts WHERE run_id=? AND call_id=?').get(run.runId, callId);
  async function execute(tool = name) {
    const callId = 'call_' + randomUUID();
    run.publisher.enqueue({kind: 'tool_start', callId, tool}); await run.publisher.flush();
    const result = await boundary.execute(definitions.find(def => def.name === tool), callId, {}, new AbortController().signal);
    run.publisher.enqueue({kind: 'tool_end', callId, tool, success: !result.isError}, undefined,
      {callId, tool, digest: digest(result.content), failed: result.isError === true});
    await run.publisher.flush();
    return {callId, result, receipt: receipt(callId)};
  }
  return {f, run, registry, records, name, receipt, execute, boundary,
    source: value => {currentSource = value;}, revokeAtExecute: () => {revokeAtExecute = true;},
    throwAfterInvoke: () => {throwAfterInvoke = true;},
    performed: () => performed, critical: () => critical, close: () => f.close()};
}

async function check(name, action) {
  let x;
  try {
    x = await fixture(); await action(x);
    report.checks.push({name, pass: true}); console.log('PASS ' + name);
  } catch (error) {
    report.checks.push({name, pass: false, error: String(error.stack || error)}); console.error('FAIL ' + name + ': ' + error);
  } finally {x?.close();}
}
async function refused(x, reason) {
  const {callId, result, receipt} = await x.execute();
  assert.equal(result.isError, true);
  assert.equal(result.details.taskReason, reason);
  assert.equal(result.details.error.retryable, false);
  assert.equal(result.details.execution.delivery, 'not_delivered');
  assert.equal(receipt.phase, 'settled'); assert.equal(receipt.success, 0); assert.equal(receipt.admitted, 0);
  assert.equal(x.performed(), 0); assert.equal(x.critical(), 0); assert.equal(x.run.publisher.failed, false);
  const recovery = await x.f.journal.reconcile(x.run.owner);
  assert.equal(recovery.receipts.find(row => row.callId === callId).disposition, 'not_delivered');
  const safe = await x.execute('office_list_files');
  assert.equal(safe.result.isError, undefined); assert.equal(x.performed(), 1);
}

await check('Provider source withdrawal before admission settles as not delivered and safe alternative can continue', async x => {
  x.source(null); await refused(x, 'source_changed');
});
await check('Provider Registry revocation before admission preserves its typed refusal', async x => {
  await x.registry.revokeProvider(x.records.get(x.name).providerId); await refused(x, 'capability_revoked');
});
await check('Provider change between before and execute is refused before original tool invocation', async x => {
  x.revokeAtExecute();
  const {result, receipt} = await x.execute();
  assert.equal(result.details.taskReason, 'source_changed'); assert.equal(result.details.execution.delivery, 'not_delivered');
  assert.equal(receipt.phase, 'settled'); assert.equal(receipt.admitted, 0); assert(receipt.contract_json);
  assert.equal(x.performed(), 0); assert.equal(x.critical(), 0); assert.equal(x.run.publisher.failed, false);
});
await check('A typed failure after actual invocation retains unknown effect and cannot claim not delivered', async x => {
  x.throwAfterInvoke();
  const {result, receipt} = await x.execute();
  assert.equal(x.performed(), 1); assert.equal(result.details.execution.effect, 'unknown');
  assert.equal(result.details.execution.delivery, undefined); assert.equal(receipt.admitted, 1); assert.equal(receipt.effect_state, 'uncertain');
});
await check('Ordinary source_changed storage error is not mistaken for typed admission failure', async x => {
  x.registry.snapshot = async () => {throw Error('source_changed');};
  await assert.rejects(x.execute(), /source_changed/);
  assert.equal(x.critical(), 1); assert.equal(x.run.publisher.failed, true); assert.equal(x.performed(), 0);
});
await check('Actual SQLite contract UPDATE failure permanently closes the original publisher', async x => {
  x.f.db.exec("CREATE TRIGGER refuse_contract BEFORE UPDATE OF contract_json ON xiaozhi_tool_receipts BEGIN SELECT RAISE(ABORT,'owned_contract_failure'); END");
  await assert.rejects(x.execute(), /owned_contract_failure/);
  assert.equal(x.run.publisher.failed, true); assert.equal(x.performed(), 0);
  assert.equal(x.f.db.prepare('SELECT COUNT(*) n FROM xiaozhi_tool_receipts WHERE phase=\'settled\'').get().n, 0);
});
await check('Actual SQLite failed-attempt INSERT failure rolls back the not-delivered marker and fails closed', async x => {
  x.source(null);
  x.f.db.exec("CREATE TRIGGER refuse_failed_attempt BEFORE INSERT ON xiaozhi_event_journal WHEN json_extract(NEW.event_json,'$.kind')='tool_attempt' BEGIN SELECT RAISE(ABORT,'owned_attempt_failure'); END");
  await assert.rejects(x.execute(), /owned_attempt_failure/);
  assert.equal(x.run.publisher.failed, true); assert.equal(x.performed(), 0);
  const row = x.f.db.prepare('SELECT * FROM xiaozhi_tool_receipts').get();
  assert.equal(row.admitted, 1); assert.equal(row.phase, 'admitted'); assert.equal(row.success, null);
});
for (const effect of ['uncertain', 'matched']) await check('Not-delivered marker cannot erase an existing ' + effect + ' effect', async x => {
  const callId = 'call_' + randomUUID();
  x.run.publisher.enqueue({kind: 'tool_start', tool: x.name, callId}); await x.run.publisher.flush();
  await x.run.publisher.persist(owner => x.f.journal.admitTool(owner, callId, x.name));
  x.f.db.prepare('UPDATE xiaozhi_tool_receipts SET effect_state=? WHERE run_id=? AND call_id=?').run(effect, x.run.runId, callId);
  x.run.publisher.enqueue({kind: 'tool_attempt', attempt: {schemaVersion: 1, callId, tool: x.name, attempt: 1, maxAttempts: 1,
    state: 'failed', code: 'task_blocked', effect: 'none', delivery: 'not_delivered'}});
  await assert.rejects(x.run.publisher.flush(), /tool_receipt_conflict/);
  assert.equal(x.receipt(callId).effect_state, effect); assert.equal(x.receipt(callId).admitted, 1);
});
const marker = {schemaVersion: 1, callId: 'call_fixture', tool: 'office_read_text', attempt: 1, maxAttempts: 1,
  state: 'failed', code: 'task_blocked', effect: 'none', delivery: 'not_delivered'};
assert(validToolAttempt(marker));
for (const change of [{state: 'started'}, {code: 'timeout'}, {effect: 'unknown'}, {delivery: 'delivered'}]) assert(!validToolAttempt({...marker, ...change}));
report.success = report.checks.every(row => row.pass);
fs.writeFileSync(path.join(root, 'report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({success: report.success, checks: report.checks.length, root}));
if (!report.success) process.exitCode = 1;
