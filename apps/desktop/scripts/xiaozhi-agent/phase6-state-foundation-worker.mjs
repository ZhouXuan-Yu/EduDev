import '../office-agent/register-source.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID, createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';

const {createTaskCoordinator} = await import('../../src/main/xiaozhi-agent/tasks/coordinator.ts');
const {createTaskState} = await import('../../src/main/xiaozhi-agent/tasks/task-state.ts');
const {createEventJournal} = await import('../../src/main/xiaozhi-agent/events/journal.ts');
const {createEventPublisher} = await import('../../src/main/xiaozhi-agent/events/publisher.ts');
const {createEffectState} = await import('../../src/main/xiaozhi-agent/effects/state.ts');
const {toolManifest} = await import('../../src/main/xiaozhi-agent/tools/manifest.ts');
export const digest = value => createHash('sha256').update(typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value)).digest('hex');
const inline = work => ({...work, transaction: action => action(work)});
const tables = ['app_settings', 'xiaozhi_event_owners', 'xiaozhi_event_runs', 'xiaozhi_event_journal', 'xiaozhi_event_outbox', 'xiaozhi_tool_receipts', 'xiaozhi_effects_v1'];

export async function openFixture(root) {
  fs.mkdirSync(root, {recursive: true});
  const file = path.join(root, 'state.sqlite');
  const freshDatabase = !fs.existsSync(file);
  const db = new DatabaseSync(file); db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=3000');
  if (freshDatabase) db.exec(`CREATE TABLE app_settings(key TEXT PRIMARY KEY,value_json TEXT,updated_at TEXT);
CREATE TABLE ai_conversation_sessions(id TEXT PRIMARY KEY,archived_at TEXT);
CREATE TABLE ai_conversation_messages(id TEXT PRIMARY KEY,session_id TEXT,role TEXT,content TEXT,metadata_json TEXT);
CREATE TABLE ai_agent_runs(id TEXT PRIMARY KEY,session_id TEXT,status TEXT);
CREATE TABLE xiaozhi_pi_commands(command_id TEXT PRIMARY KEY,conversation_id TEXT,run_id TEXT,status TEXT);`);
  let lane = Promise.resolve(), fault = false, readbackCalls = 0;
  const sql = {
    all: async (query, values = []) => db.prepare(query).all(...values),
    run: async (query, values = []) => {
      if (fault && query.startsWith('INSERT INTO xiaozhi_event_outbox')) throw Error('owned_outbox_failure');
      return db.prepare(query).run(...values);
    },
    change: async (query, values = []) => Number(db.prepare(query).run(...values).changes),
    transaction(action) {
      const work = lane.then(async () => {
        db.exec('BEGIN IMMEDIATE');
        try {const value = await action(sql); db.exec('COMMIT'); return value;}
        catch (error) {db.exec('ROLLBACK'); throw error;}
      });
      lane = work.catch(() => {}); return work;
    },
  };
  const bytes = Buffer.from('Owned physical state effect ' + path.basename(root));
  const artifact = path.join(root, 'owned-result.txt'), counter = path.join(root, 'effect-count.ndjson');
  const journal = createEventJournal(sql, {readEffect: async () => {
    readbackCalls++;
    return fs.existsSync(artifact) && digest(fs.readFileSync(artifact)) === digest(bytes) ? 'matched' : 'uncertain';
  }});
  await journal.migrate();
  const taskState = createTaskState(sql, {sanitize: async text => text});
  const effects = createEffectState(sql);
  const store = {xiaozhiState: {sql, eventJournal: journal}, sanitizeProblemText: async text => ({sanitizedText: text}),
    getAiConversationSession: async id => ({session: {id, archivedAt: db.prepare('SELECT archived_at FROM ai_conversation_sessions WHERE id=?').get(id)?.archived_at, studentId: ''},
      messages: db.prepare('SELECT * FROM ai_conversation_messages WHERE session_id=? ORDER BY rowid').all(id)
        .map(row => ({id: row.id, role: row.role, content: row.content, metadata: JSON.parse(row.metadata_json)}))})};
  const coordinator = createTaskCoordinator({store, closing: () => false, busy: () => false, running: () => false, emit() {}});
  const snapshot = () => Object.fromEntries(tables.map(table => [table,
    db.prepare('SELECT * FROM ' + table + ' ORDER BY rowid').all().map(row => ({...row}))]));
  const count = () => fs.existsSync(counter) ? fs.readFileSync(counter, 'utf8').trim().split('\n').filter(Boolean).length : 0;
  async function fresh(sessionId = 'aisession_' + randomUUID()) {
    const runId = 'run_' + randomUUID(), commandId = 'xicmd_' + randomUUID(), messageId = 'aimsg_' + randomUUID();
    db.prepare('INSERT OR IGNORE INTO ai_conversation_sessions VALUES(?,NULL)').run(sessionId);
    db.prepare('INSERT INTO ai_agent_runs VALUES(?,?,?)').run(runId, sessionId, 'running');
    db.prepare('INSERT INTO xiaozhi_pi_commands VALUES(?,?,?,?)').run(commandId, sessionId, runId, 'running');
    db.prepare('INSERT INTO ai_conversation_messages VALUES(?,?,?,?,?)').run(messageId, sessionId, 'user', 'Create one owned synthetic teaching artifact',
      JSON.stringify({agentRunId: runId, piVersion: 'xiaozhi.pi.education.v1'}));
    const owner = await journal.begin(sessionId, runId, {id: runId, status: 'running', items: []});
    const publisher = createEventPublisher({journal, owner, committed() {}, emit() {}, failed() {}, beforeTerminalEmit() {}});
    publisher.enqueue({kind: 'status', status: 'running'}); await publisher.flush();
    let task = await coordinator.start(sessionId, runId, commandId, publisher);
    task = await publisher.checkpointTask(work => createTaskState(inline(work), {sanitize: async text => text}).propose(owner, task.id, task.revision,
      {expectedRevision: 0, reason: 'One owned file and exact readback', steps: [{id: 'owned_file', text: 'Create the owned artifact', dependsOn: [], criterionIds: ['teacher_request'], reported: 'in_progress'}]}));
    return {sessionId, runId, commandId, messageId, owner, publisher, task};
  }
  async function admit(f) {
    const callId = 'call_' + randomUUID(), tool = 'office_create_text';
    const inputDigest = digest({path: artifact, text: bytes.toString('utf8')});
    f.publisher.enqueue({kind: 'tool_start', callId, tool, label: 'Owned state fixture'}); await f.publisher.flush();
    f.task = await f.publisher.checkpointTask(work => createTaskState(inline(work), {sanitize: async text => text}).admit(
      f.owner, f.task.id, f.task.revision, 'owned_file', callId, tool, inputDigest, artifact, true, true));
    await f.publisher.persist(owner => journal.admitTool(owner, callId, tool));
    const manifest = toolManifest(tool);
    const contract = {schemaVersion: 1, capabilityId: 'edu.core.tool.' + tool, providerId: 'edu.native.tool.' + tool,
      providerVersion: 'owned-state-fixture-v1', providerHash: digest(manifest), schemaHash: digest({type: 'object'}), sourceHash: digest('owned-state-file-operation-v1'),
      contractVersion: '1.0.0', snapshotId: 'xicap_' + randomUUID(), registryRevision: 1, taskId: f.task.id, stepId: 'owned_file',
      planRevision: f.task.planRevision, requirementsVersion: f.task.requirementsVersion, target: artifact, inputDigest,
      effect: manifest.effect, scopePolicy: 'filesystem_request', classification: 'teacher_private', grantRefs: [], authorityRefs: []};
    await f.publisher.persist(owner => journal.recordToolContract(owner, callId, tool, contract));
    return {...f, callId, tool, contract, authority: {kind: 'run', owner: {...f.owner, taskId: f.task.id}}};
  }
  async function execute(f) {
    await f.publisher.persist(owner => journal.beginToolEffect(owner, f.callId));
    const executionId = 'owned_file_' + randomUUID();
    await f.publisher.persist(owner => journal.bindToolEffectExecution(owner, f.callId, {id: executionId}));
    return executionId;
  }
  function perform(f) {
    fs.writeFileSync(artifact, bytes, {flag: 'wx'});
    fs.appendFileSync(counter, JSON.stringify({callId: f.callId, digest: digest(bytes)}) + '\n');
    return {kind: 'file', reference: artifact, digest: digest(fs.readFileSync(artifact))};
  }
  async function commit(f) {
    f.publisher.enqueue({kind: 'tool_end', callId: f.callId, tool: f.tool, success: true}, undefined,
      {callId: f.callId, tool: f.tool, digest: digest(bytes), failed: false});
    await f.publisher.flush();
    f.task = await f.publisher.checkpointTask(work => createTaskState(inline(work), {sanitize: async text => text}).propose(
      f.owner, f.task.id, f.task.revision, {expectedRevision: f.task.planRevision, reason: 'Physical bytes verified',
        steps: [{id: 'owned_file', text: 'Create the owned artifact', dependsOn: [], criterionIds: ['teacher_request'], reported: 'completed'}]}));
  }
  return {root, file, db, sql, journal, taskState, effects, coordinator, snapshot, fresh, admit, execute, perform, commit,
    artifact, bytes, count, readbackCalls: () => readbackCalls, fault: value => {fault = value;}, close: () => db.close()};
}

if (process.argv[2] === '--crash') {
  const root = process.argv[3], cut = process.argv[4];
  const f = await openFixture(root);
  try {
    const run = await f.admit(await f.fresh());
    if (cut !== 'intent') await f.execute(run);
    if (['external_success', 'committed'].includes(cut)) f.perform(run);
    if (cut === 'committed') await f.commit(run);
    const effect = await f.effects.byCall(run.runId, run.callId);
    const identity = {sessionId: run.sessionId, runId: run.runId, taskId: run.task.id, owner: run.owner, callId: run.callId, cut, effectId: effect.id};
    fs.writeFileSync(path.join(root, 'identity.json'), JSON.stringify(identity, null, 2));
    fs.writeFileSync(path.join(root, 'boundary-snapshot.json'), JSON.stringify(f.snapshot(), null, 2));
    process.send({type: 'boundary_committed', identity, effect, physicalEffects: f.count(), checkpoint: await f.taskState.checkpoint(run.task.id)});
    setInterval(() => {}, 1000);
  } catch (error) {
    process.send({type: 'worker_error', error: String(error.stack ?? error)});
    f.close(); process.exitCode = 1; process.disconnect();
  }
}
