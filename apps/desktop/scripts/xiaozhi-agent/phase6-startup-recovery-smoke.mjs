import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomUUID, createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';

const {createTaskCoordinator} = await import('../../src/main/xiaozhi-agent/tasks/coordinator.ts');
const {createEventJournal} = await import('../../src/main/xiaozhi-agent/events/journal.ts');
const {createEventPublisher} = await import('../../src/main/xiaozhi-agent/events/publisher.ts');
const {createTaskState} = await import('../../src/main/xiaozhi-agent/tasks/task-state.ts');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'xiaozhi-phase6-startup-recovery-'));
const filename = path.join(root, 'app.db');
const report = {success: false, root, checks: [], paidCalls: 0,
  boundary: 'Actual Task coordinator/state and Journal recovery against cold reopened owned SQLite. Store domain lookup is a synthetic adapter. No Electron, helper or model execution.'};
let db = new DatabaseSync(filename);
db.exec(`CREATE TABLE app_settings(key TEXT PRIMARY KEY,value_json TEXT,updated_at TEXT);
  CREATE TABLE ai_conversation_sessions(id TEXT PRIMARY KEY,archived_at TEXT);
  CREATE TABLE ai_conversation_messages(id TEXT PRIMARY KEY,session_id TEXT,role TEXT,content TEXT,metadata_json TEXT);
  CREATE TABLE ai_agent_runs(id TEXT PRIMARY KEY,session_id TEXT,status TEXT);
  CREATE TABLE xiaozhi_pi_commands(command_id TEXT PRIMARY KEY,conversation_id TEXT,run_id TEXT,status TEXT);`);
let lane = Promise.resolve();
const sql = {
  all: async (query, values = []) => db.prepare(query).all(...values),
  run: async (query, values = []) => db.prepare(query).run(...values),
  change: async (query, values = []) => Number(db.prepare(query).run(...values).changes),
  transaction(action) {
    const work = lane.then(async () => {
      db.exec('BEGIN IMMEDIATE');
      try {const result = await action(sql); db.exec('COMMIT'); return result;}
      catch (error) {db.exec('ROLLBACK'); throw error;}
    });
    lane = work.catch(() => undefined);
    return work;
  },
};
const journal = createEventJournal(sql);
await journal.migrate();
const sessionId = 'aisession_' + randomUUID();
const runId = 'run_' + randomUUID();
const commandId = 'xicmd_' + randomUUID();
const messageId = 'aimsg_' + randomUUID();
db.prepare('INSERT INTO ai_conversation_sessions VALUES(?,NULL)').run(sessionId);
db.prepare('INSERT INTO ai_agent_runs VALUES(?,?,?)').run(runId, sessionId, 'running');
db.prepare('INSERT INTO xiaozhi_pi_commands VALUES(?,?,?,?)').run(commandId, sessionId, runId, 'running');
db.prepare('INSERT INTO ai_conversation_messages VALUES(?,?,?,?,?)').run(messageId, sessionId, 'user', '核对合成课堂成果',
  JSON.stringify({agentRunId: runId, piVersion: 'xiaozhi.pi.education.v1'}));
const store = {
  xiaozhiState: {sql, eventJournal: journal},
  sanitizeProblemText: async text => ({sanitizedText: text}),
  getAiConversationSession: async id => ({session: {id, archivedAt: null, studentId: ''},
    messages: db.prepare('SELECT * FROM ai_conversation_messages WHERE session_id=? ORDER BY rowid').all(id)
      .map(row => ({id: row.id, role: row.role, content: row.content, metadata: JSON.parse(row.metadata_json)}))}),
};
const actor = createTaskCoordinator({store, closing: () => false, busy: () => false, running: () => false, emit: () => undefined});
const owner = await journal.begin(sessionId, runId, {id: runId, status: 'running', items: []});
const publisher = createEventPublisher({journal, owner, committed: () => undefined, emit: () => undefined,
  failed: () => undefined, beforeTerminalEmit: () => undefined});
publisher.enqueue({kind: 'status', status: 'running'});
await publisher.flush();
let task = await actor.start(sessionId, runId, commandId, publisher);
task = await publisher.checkpointTask(work => createTaskState({...work, transaction: action => action(work)}, {sanitize: async text => text})
  .propose(owner, task.id, task.revision, {expectedRevision: 0, reason: '需要核对剩余成果',
    steps: [{id: 'review', text: '核对课堂成果', dependsOn: [], criterionIds: ['teacher_request'], reported: 'in_progress'}]}));
await publisher.settled();
report.before = {owner, task};
db.close();
db = new DatabaseSync(filename);
try {
  await journal.recover();
  report.recoveredOwner = db.prepare('SELECT * FROM xiaozhi_event_owners WHERE session_id=?').get(sessionId);
  await actor.recover(sessionId);
  const view = await actor.snapshot({sessionId});
  report.snapshot = view;
  assert(view.ok);
  assert.equal(view.value.task.id, task.id);
  assert.equal(view.value.task.state, 'interrupted');
  assert.equal(view.value.canResume, true);
  assert.equal(report.recoveredOwner.run_id, '');
  assert(report.recoveredOwner.generation > owner.generation);
  await assert.rejects(journal.assertOwner(owner), /event_owner_stale/);
  report.checks.push({name: 'Cold startup restores the same Task after Journal invalidates the old owner', pass: true});
  const saved = JSON.stringify(view);
  await journal.recover();
  await actor.recover(sessionId);
  assert.equal(JSON.stringify(await actor.snapshot({sessionId})), saved);
  report.checks.push({name: 'Repeated startup recovery is idempotent and the old Run stays fenced', pass: true});
  report.success = true;
} catch (error) {report.error = error.stack; process.exitCode = 1;}
finally {
  db.close();
  report.sources = ['src/main/xiaozhi-agent/tasks/coordinator.ts', 'src/main/xiaozhi-agent/events/journal.ts',
    'src/main/xiaozhi-agent/tasks/task-state.ts'].map(file => ({file, sha256: createHash('sha256').update(fs.readFileSync(file)).digest('hex')}));
  fs.writeFileSync(path.join(root, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({success: report.success, passed: report.checks.length, root, error: report.error}));
}
