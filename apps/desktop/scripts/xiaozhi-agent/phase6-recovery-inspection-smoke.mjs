import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash, randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'xiaozhi-phase6-recovery-inspection-'));
const report = {success: false, root, checks: [], observations: [], paidCalls: 0, writesAttempted: 0,
  boundary: 'Source-only inspection with actual TaskState, Journal, read-only SQLite and owned native files. Synthetic receipts, approvals, effects and provider rows use original validators. No Host, Electron, native helper, resume execution or model.'};
const sha = value => createHash('sha256').update(value).digest('hex');
const source = 'src/main/xiaozhi-agent/tasks/recovery-inspection.ts';
function manifest(directory, relative = '') {
  return fs.readdirSync(path.join(directory, relative), {withFileTypes: true}).flatMap(entry => {
    const file = path.join(relative, entry.name), absolute = path.join(directory, file), stat = fs.lstatSync(absolute);
    if (stat.isSymbolicLink()) return [{file, link: fs.readlinkSync(absolute)}];
    if (stat.isDirectory()) return manifest(directory, file);
    return [{file, sha256: sha(fs.readFileSync(absolute))}];
  });
}
const check = async (name, action) => {
  try {await action(); report.checks.push({name, pass: true});}
  catch (error) {report.checks.push({name, pass: false, error: error.stack});}
};

try {
  assert.match(fs.readFileSync('node_modules/@earendil-works/pi-coding-agent/dist/core/session-manager.js', 'utf8'), /export const CURRENT_SESSION_VERSION = 3;/u);
  const {inspectTaskRecovery} = await import('../../src/main/xiaozhi-agent/tasks/recovery-inspection.ts');
  const {createTaskState} = await import('../../src/main/xiaozhi-agent/tasks/task-state.ts');
  const {createEventJournal} = await import('../../src/main/xiaozhi-agent/events/journal.ts');
  const {captureNativeTail, toolResultDigest} = await import('../../src/main/xiaozhi-agent/events/native-tail.ts');
  const {protocolHash} = await import('../../src/main/xiaozhi-agent/capabilities/validation.ts');
  const {createProviderSnapshotStore, validProviderSnapshot} = await import('../../src/main/xiaozhi-agent/capabilities/provider-snapshots.ts');
  const {createEffectState} = await import('../../src/main/xiaozhi-agent/effects/state.ts');
  const {validApproval, requestDigest} = await import('../../src/main/xiaozhi-agent/permissions/validation.ts');
  const {createModelSwitchState} = await import('../../src/main/xiaozhi-agent/model-switch-state.ts');
  let serial = 0;
  async function fixture() {
    const directory = path.join(root, String(++serial));
    fs.mkdirSync(directory);
    const nativeRoot = path.join(directory, 'native');
    fs.mkdirSync(nativeRoot);
    const filename = path.join(directory, 'app.db');
    const db = new DatabaseSync(filename);
    const sql = {
      all: async (query, values = []) => db.prepare(query).all(...values),
      run: async (query, values = []) => db.prepare(query).run(...values),
      change: async (query, values = []) => Number(db.prepare(query).run(...values).changes),
      transaction: async action => {
        db.exec('BEGIN IMMEDIATE');
        try {const value = await action(sql); db.exec('COMMIT'); return value;}
        catch (error) {db.exec('ROLLBACK'); throw error;}
      },
    };
    db.exec(`CREATE TABLE app_settings(key TEXT PRIMARY KEY,value_json TEXT,updated_at TEXT);
      CREATE TABLE ai_conversation_sessions(id TEXT PRIMARY KEY,archived_at TEXT);
      CREATE TABLE ai_conversation_messages(id TEXT PRIMARY KEY,session_id TEXT,role TEXT,content TEXT,metadata_json TEXT);
      CREATE TABLE ai_agent_runs(id TEXT PRIMARY KEY,session_id TEXT,status TEXT);
      CREATE TABLE xiaozhi_pi_commands(command_id TEXT PRIMARY KEY,conversation_id TEXT,run_id TEXT,status TEXT);
      CREATE TABLE xiaozhi_pi_session_bindings(conversation_id TEXT PRIMARY KEY,schema_version INTEGER,session_file TEXT,model TEXT,updated_at TEXT);`);
    const journal = createEventJournal(sql);
    await journal.migrate();
    const sessionId = 'aisession_' + randomUUID(), runId = 'run_' + randomUUID();
    const commandId = 'xicmd_' + randomUUID(), messageId = 'aimsg_' + randomUUID();
    db.prepare('INSERT INTO ai_conversation_sessions VALUES(?,NULL)').run(sessionId);
    db.prepare('INSERT INTO ai_agent_runs VALUES(?,?,?)').run(runId, sessionId, 'running');
    db.prepare('INSERT INTO xiaozhi_pi_commands VALUES(?,?,?,?)').run(commandId, sessionId, runId, 'running');
    db.prepare('INSERT INTO ai_conversation_messages VALUES(?,?,?,?,?)').run(messageId, sessionId, 'user', 'synthetic private teacher request', JSON.stringify({agentRunId: runId, piVersion: 'xiaozhi.pi.education.v1'}));
    const owner = await journal.begin(sessionId, runId, {id: runId, status: 'running', items: []});
    const tasks = createTaskState(sql, {sanitize: async text => text});
    let task = await tasks.create(owner, messageId, commandId);
    const activeTask = structuredClone(task);
    task = await tasks.settle(owner, task.id, task.revision, true);
    const relative = `${sessionId}/sessions/fixture.jsonl`, file = path.join(nativeRoot, relative);
    fs.mkdirSync(path.dirname(file), {recursive: true});
    const header = {type: 'session', version: 3, id: randomUUID(), timestamp: new Date().toISOString(), cwd: directory};
    fs.writeFileSync(file, JSON.stringify(header) + '\n');
    const binding = {...captureNativeTail(file, nativeRoot), markerId: 'marker_fixture', ...owner};
    const content = [{type: 'text', text: 'synthetic private result'}];
    const lines = [header,
      {type: 'custom', id: binding.markerId, customType: 'xiaozhi.event-owner.v1', data: {schemaVersion: 1, ...owner}},
      {type: 'message', id: 'assistant_fixture', parentId: binding.markerId, message: {role: 'assistant', content: [{type: 'toolCall', id: 'call_fixture', name: 'fixture_read'}]}},
      {type: 'message', id: 'result_fixture', parentId: 'assistant_fixture', message: {role: 'toolResult', toolCallId: 'call_fixture', toolName: 'fixture_read', content, isError: false}},
    ];
    const rewrite = () => fs.writeFileSync(file, lines.map(row => JSON.stringify(row)).join('\n') + '\n');
    rewrite();
    await journal.bindNative(owner, binding);
    db.prepare('INSERT INTO xiaozhi_pi_session_bindings VALUES(?,1,?,?,?)').run(sessionId, relative, 'deepseek-chat', new Date().toISOString());
    db.prepare(`INSERT INTO xiaozhi_tool_receipts(run_id,call_id,generation,tool,start_sequence,phase,admitted,result_digest,success,updated_at)
      VALUES(?,?,?,'fixture_read',1,'settled',1,?,1,?)`).run(runId, 'call_fixture', owner.generation, toolResultDigest('fixture_read', content, false), new Date().toISOString());
    const taskKey = 'xiaozhi.task.v1:' + task.id;
    const mutateTask = change => {
      const document = JSON.parse(db.prepare('SELECT value_json FROM app_settings WHERE key=?').get(taskKey).value_json);
      change(document);
      db.prepare('UPDATE app_settings SET value_json=? WHERE key=?').run(JSON.stringify(document), taskKey);
    };
    async function inspect(overrides = {}) {
      db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
      const before = sha(fs.readFileSync(filename));
      const filesBefore = manifest(directory);
      const nativeBefore = fs.existsSync(file) ? sha(fs.readFileSync(file)) : null;
      const ro = new DatabaseSync(filename, {readOnly: true});
      let writes = 0;
      const readonly = {
        all: async (query, values = []) => ro.prepare(query).all(...values),
        run: async (query, values = []) => {writes++; return ro.prepare(query).run(...values);},
        change: async (query, values = []) => {writes++; return Number(ro.prepare(query).run(...values).changes);},
        transaction: async action => {writes++; ro.exec('BEGIN IMMEDIATE'); return action(readonly);},
      };
      try {
        const result = await inspectTaskRecovery({sql: readonly, nativeRoot, sessionId, taskId: task.id, ...overrides});
        report.observations.push({fixture:serial,native:result.native,canRebuildSession:result.canRebuildSession,checkpointId:result.checkpointId});
        return result;
      }
      finally {
        ro.close(); report.writesAttempted += writes; assert.equal(writes, 0);
        assert.equal(sha(fs.readFileSync(filename)), before);
        assert.equal(fs.existsSync(file) ? sha(fs.readFileSync(file)) : null, nativeBefore);
        assert.deepEqual(manifest(directory), filesBefore);
      }
    }
    return {directory, db, sql, journal, owner, task, activeTask, sessionId, runId, nativeRoot, relative, file, header, binding, lines, rewrite, inspect, mutateTask, taskKey};
  }
  async function test(name, action) {
    await check(name, async () => {const f = await fixture(); try {await action(f);} finally {f.db.close();}});
  }
  await test('Available exact native receipt preserves original SQLite Task and checkpoint, zero writes', async f => {
    const result = await f.inspect();
    assert.equal(result.native.state, 'available'); assert.equal(result.native.digest, sha(fs.readFileSync(f.file)));
    assert.equal(result.taskId, f.task.id); assert.match(result.checkpointId, /^xitcp_/);
    assert.equal(result.canRebuildSession, false); assert.equal(result.automaticReplay, false);
    for (const forbidden of [f.directory, 'synthetic private', 'session_file']) assert(!JSON.stringify(result).includes(forbidden));
  });
  await test('Absent session binding and absent Task native binding are independently unbound', async f => {
    f.db.exec('DELETE FROM xiaozhi_pi_session_bindings'); assert.equal((await f.inspect()).native.state, 'unbound');
    f.db.prepare('INSERT INTO xiaozhi_pi_session_bindings VALUES(?,1,?,?,?)').run(f.sessionId, f.relative, 'deepseek-chat', new Date().toISOString());
    f.db.exec('DELETE FROM xiaozhi_native_run_bindings'); const result = await f.inspect();
    assert.equal(result.native.state, 'unbound'); assert.equal(result.canRebuildSession, false);
  });
  await test('Missing JSONL is rebuildable for original interrupted Task', async f => {
    fs.renameSync(f.file, f.file + '.retained'); const result = await f.inspect();
    assert.equal(result.native.state, 'missing'); assert.equal(result.native.digest, null); assert.equal(result.canRebuildSession, true);
  });
  await test('Strict syntax, header version, UTF8 and partial-line failures are invalid with file digest', async f => {
    for (const bytes of ['{bad}\n', JSON.stringify({...f.header, version: 99}) + '\n', JSON.stringify(f.header), Buffer.from([255,10]), '[]\n']) {
      fs.writeFileSync(f.file, bytes); const result = await f.inspect();
      assert.equal(result.native.state, 'invalid'); assert.equal(result.native.digest, sha(fs.readFileSync(f.file))); assert.equal(result.canRebuildSession, true);
    }
  });
  await test('Anchor, marker, parent, declarations and result digest conflicts are changed', async f => {
    const original = structuredClone(f.lines);
    const mutations = [rows => {rows[0].cwd += 'changed';}, rows => {rows[1].data.generation++;},
      rows => {rows[2].parentId = 'other';}, rows => {rows[2].message.content[0].name = 'other';}, rows => {rows[3].message.content[0].text += 'changed';}];
    for (const mutation of mutations) {
      f.lines.splice(0, f.lines.length, ...structuredClone(original)); mutation(f.lines); f.rewrite();
      assert.equal((await f.inspect()).native.state, 'changed');
    }
  });
  await test('Receipt mismatches and missing recorded result reject native success as truth', async f => {
    f.db.exec("UPDATE xiaozhi_tool_receipts SET success=0"); assert.equal((await f.inspect()).native.state, 'changed');
    f.db.exec("UPDATE xiaozhi_tool_receipts SET success=1,native_entry_id='other'"); assert.equal((await f.inspect()).native.state, 'changed');
    f.db.exec('UPDATE xiaozhi_tool_receipts SET native_entry_id=NULL');
    f.lines.pop(); f.rewrite(); assert.equal((await f.inspect()).native.state, 'changed');
  });
  await test('Unassociated native tool result is changed', async f => {
    f.db.exec('DELETE FROM xiaozhi_tool_receipts'); assert.equal((await f.inspect()).native.state, 'changed');
  });
  await test('Outside-root binding, hardlink, junction and oversized file fail without reading outside authority', async f => {
    const outside = path.join(f.directory, 'outside.jsonl'); fs.writeFileSync(outside, fs.readFileSync(f.file));
    f.db.prepare('UPDATE xiaozhi_pi_session_bindings SET session_file=?').run(outside);
    assert.equal((await f.inspect()).native.state, 'unavailable');
    f.db.prepare('UPDATE xiaozhi_pi_session_bindings SET session_file=?').run(f.relative);
    fs.linkSync(f.file, path.join(f.directory, 'retained-hardlink.jsonl'));
    assert.equal((await f.inspect()).native.state, 'unavailable');
    const linkRoot = path.join(f.directory, 'linked-root'); fs.symlinkSync(f.nativeRoot, linkRoot, 'junction');
    assert.equal((await f.inspect({nativeRoot: linkRoot})).native.state, 'unavailable');
    const big = path.join(f.nativeRoot, 'large.jsonl'); fs.writeFileSync(big, Buffer.alloc(32 * 1048576 + 1));
    f.db.prepare('UPDATE xiaozhi_pi_session_bindings SET session_file=?').run('large.jsonl');
    assert.equal((await f.inspect()).native.state, 'unavailable');
  });
  await test('Missing/corrupt/cross-session Task and checkpoint fail closed through original validator', async f => {
    await assert.rejects(f.inspect({taskId: 'xitask_' + '0'.repeat(64)}), /task_missing/);
    await assert.rejects(f.inspect({sessionId: 'aisession_' + randomUUID()}), /permission_denied/);
    f.db.prepare("UPDATE app_settings SET value_json='{}' WHERE key=?").run('xiaozhi.checkpoint.v1:' + (await f.inspect()).checkpointId);
    await assert.rejects(f.inspect(), /task_checkpoint_corrupt/);
    f.db.prepare("UPDATE app_settings SET value_json='{}' WHERE key=?").run(f.taskKey);
    await assert.rejects(f.inspect(), /task_corrupt/);
  });
  await test('Legacy checkpoint absence is null and active/ended state policy prevents rebuild', async f => {
    f.mutateTask(doc => {delete doc.checkpoint;});
    fs.writeFileSync(f.file, '{bad}\n'); assert.equal((await f.inspect()).checkpointId, null);
    f.mutateTask(doc => {doc.view = f.activeTask; delete doc.eventOwner;});
    assert.equal((await f.inspect()).canRebuildSession, false);
    f.mutateTask(doc => {doc.view.state = 'ended'; doc.view.binding = null;});
    assert.equal((await f.inspect()).canRebuildSession, false);
  });
  await test('Unknown effect refs and exact Task approval/provider refs are validated and redacted', async f => {
    await createEffectState(f.sql).migrate(); await createProviderSnapshotStore(f.sql).migrate();
    f.db.exec('CREATE TABLE ai_confirmation_items(id TEXT PRIMARY KEY,session_id TEXT,run_id TEXT,action_type TEXT,payload_json TEXT)');
    const stamp = new Date().toISOString(), hash = 'a'.repeat(64), owner = {...f.owner, taskId: f.task.id};
    for (const state of ['intent','executing','unknown','failed','committed']) {
      const id = 'xieffect_' + protocolHash([f.sessionId, f.task.id, state]);
      const effect = {schemaVersion:1,id,revision:1,owner,callId:'call_fixture',commandId:'fixture_command',tool:'fixture_read',operation:'tool',idempotencyKey:state,
        receipt:{runId:f.runId,callId:'call_fixture'},contract:{schemaVersion:1,taskId:f.task.id,inputDigest:hash,sourceHash:hash,providerHash:hash,schemaHash:hash},
        target:null,targetVersion:null,state,execution:null,outcome:null,proofs:[],createdAt:stamp,updatedAt:stamp};
      f.db.prepare(`INSERT INTO xiaozhi_effects_v1(effect_id,session_id,task_id,run_id,generation,call_id,command_id,operation,idempotency_key,receipt_run_id,receipt_call_id,revision,state,document_json,created_at,updated_at)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(id,f.sessionId,f.task.id,f.runId,f.owner.generation,'call_fixture','fixture_command','tool',state,f.runId,'call_fixture',1,state,JSON.stringify(effect),stamp,stamp);
    }
    const request = {schemaVersion:2,owner,requirementsVersion:1,callId:'call_fixture',action:'fixture.read',inputDigest:hash,purpose:'synthetic private purpose',scopes:[{kind:'egress',origin:'https://example.test',classifications:['public']}],files:[],provider:null,classification:'public',expiresAt:'2099-01-01T00:00:00.000Z'};
    const approval = {schemaVersion:2,id:'fixture_approval',revision:1,request,requestDigest:requestDigest(request),permissionSnapshotHash:hash,grantRefs:[],state:'pending',scope:'operation',createdAt:stamp,updatedAt:stamp};
    assert(validApproval(approval));
    f.db.prepare('INSERT INTO ai_confirmation_items VALUES(?,?,?,?,?)').run(approval.id,f.sessionId,f.runId,'xiaozhi_permission_v2',JSON.stringify(approval));
    const other = structuredClone(approval); other.id = 'other_task_approval'; other.request.owner.taskId = 'xitask_' + 'f'.repeat(64); other.requestDigest = requestDigest(other.request);
    f.db.prepare('INSERT INTO ai_confirmation_items VALUES(?,?,?,?,?)').run(other.id,f.sessionId,f.runId,'xiaozhi_permission_v2',JSON.stringify(other));
    const snapshot = {schema:'xiaozhi.capability-snapshot.v1',snapshotId:'xicap_'+randomUUID(),taskId:f.task.id,...f.owner,capabilityId:'edu.fixture.read',registryRevision:1,
      requirement:{capabilityId:'edu.fixture.read',contractVersion:'1.0.0',platform:process.platform,localOnly:true,required:[],optional:[],conditions:[],budget:{latencyMs:10,resourceUnits:1}},
      selection:{providerId:'edu.native.fixture',providerVersion:'1.0.0',contractVersion:'1.0.0',level:'full',missingRequirements:[],limitations:[]},providerHash:hash,createdAt:stamp,evidenceRefs:[],previousSnapshotId:null,refreshReason:'initial'};
    assert(validProviderSnapshot(snapshot));
    f.db.prepare('INSERT INTO xiaozhi_capability_snapshots_v1 VALUES(?,?,?,?,?,?,?,?,?)').run(snapshot.snapshotId,f.task.id,f.sessionId,f.runId,f.owner.generation,snapshot.capabilityId,JSON.stringify(snapshot),protocolHash(snapshot),stamp);
    const result = await f.inspect();
    assert.deepEqual(result.unknownEffects.map(item=>item.state).sort(), ['executing','failed','intent','unknown']);
    assert.deepEqual(result.approvals, [{id:approval.id,revision:1,state:'pending',action:'fixture.read'}]);
    assert.equal(result.providerSnapshots[0].hash, hash); assert.equal(result.native.state,'available');
    assert(!JSON.stringify(result).includes('synthetic private'));
    f.db.exec("UPDATE xiaozhi_capability_snapshots_v1 SET snapshot_hash='bad'");
    await assert.rejects(f.inspect(), /capability_snapshot_corrupt/);
  });
  await test('Only hash-verified lineage rebuild archive permits old file association to be skipped', async f => {
    const nextRun = 'run_' + randomUUID(), nextCommand = 'xicmd_' + randomUUID(), nextGeneration = f.owner.generation + 1;
    f.mutateTask(doc => {delete doc.checkpoint; doc.lineage.push({runId:nextRun,generation:nextGeneration,commandId:nextCommand}); doc.view.lastRunId=nextRun;});
    const oldBinding = {...f.db.prepare('SELECT * FROM xiaozhi_pi_session_bindings').get()};
    const nextFile = `${f.sessionId}/sessions/rebuilt.jsonl`, nextOwner = {sessionId:f.sessionId,runId:nextRun,generation:nextGeneration};
    const replacement = {sessionId:f.sessionId,sessionFile:nextFile,nativeSessionId:randomUUID(),originModel:'deepseek-chat',model:'deepseek-chat',revision:0};
    fs.writeFileSync(f.file, '{bad}\n');
    const document = {schemaVersion:1,owner:nextOwner,taskId:f.task.id,inspection:await f.inspect(),previousBinding:oldBinding,previousLedger:null,previousTransitions:[],replacement,createdAt:new Date().toISOString()};
    const archiveKey = 'xiaozhi.native-rebuild.v1:' + nextRun;
    f.db.prepare('INSERT INTO app_settings VALUES(?,?,?)').run(archiveKey,JSON.stringify({schemaVersion:1,document,hash:protocolHash(document)}),document.createdAt);
    fs.writeFileSync(path.join(f.nativeRoot,nextFile), JSON.stringify({...f.header,id:replacement.nativeSessionId})+'\n'+JSON.stringify({type:'custom',id:'new_marker',customType:'xiaozhi.event-owner.v1',data:{schemaVersion:1,...nextOwner}})+'\n');
    f.db.prepare('INSERT INTO ai_agent_runs VALUES(?,?,?)').run(nextRun,f.sessionId,'running');
    f.db.prepare("INSERT INTO xiaozhi_event_runs VALUES(?,?,?,0,0,'running',?,?)").run(nextRun,f.sessionId,nextGeneration,JSON.stringify({id:nextRun,status:'running',items:[]}),new Date().toISOString());
    f.db.prepare('INSERT INTO xiaozhi_native_run_bindings VALUES(?,?,?)').run(nextRun,nextGeneration,JSON.stringify({file:nextFile,offset:0,anchor:sha(''),markerId:'new_marker',...nextOwner}));
    f.db.prepare('UPDATE xiaozhi_pi_session_bindings SET session_file=?').run(nextFile);
    fs.writeFileSync(f.file,'retained broken previous file');
    assert.equal((await f.inspect()).native.state,'available');
    const archive = {schemaVersion:1,document,hash:'0'.repeat(64)};
    f.db.prepare('UPDATE app_settings SET value_json=? WHERE key=?').run(JSON.stringify(archive),archiveKey);
    assert.equal((await f.inspect()).native.state,'changed');
  });
  await test('Present ModelState binds header identity and current model/file while absent ledger remains legacy', async f => {
    // A first-Run capture can precede file creation. Its offset-zero anchor does
    // not cover the header, while the original marker/receipt proof still holds.
    const binding = {...f.binding, offset: 0, anchor: sha('')};
    f.db.prepare('UPDATE xiaozhi_native_run_bindings SET binding_json=? WHERE run_id=?').run(JSON.stringify(binding), f.runId);
    const models = createModelSwitchState(f.sql);
    await models.migrate();
    assert.equal((await f.inspect()).native.state, 'available');
    const identity = {sessionId: f.sessionId, sessionFile: f.relative, nativeSessionId: f.header.id,
      originModel: 'deepseek-chat', model: 'deepseek-chat', revision: 0};
    await models.seed(identity);
    assert.deepEqual(await models.current(f.sessionId), identity);
    assert.equal((await f.inspect()).native.state, 'available');
    const {readNativeToolEntries} = await import('../../src/main/xiaozhi-agent/events/native-tail.ts');
    const before = await readNativeToolEntries(binding, f.nativeRoot);
    f.lines[0].id = randomUUID(); f.rewrite();
    assert.deepEqual(await readNativeToolEntries(binding, f.nativeRoot), before);
    const changed = await f.inspect();
    assert.equal(changed.native.state, 'changed');
    assert.equal(changed.native.digest, sha(fs.readFileSync(f.file)));
    assert.equal(changed.canRebuildSession, true);
    f.db.prepare('DELETE FROM xiaozhi_pi_model_state WHERE conversation_id=?').run(f.sessionId);
    assert.equal((await f.inspect()).native.state, 'available');
    f.lines[0].id = identity.nativeSessionId; f.rewrite();
    await models.seed(identity);
    f.db.prepare('UPDATE xiaozhi_pi_session_bindings SET model=?').run('deepseek-reasoner');
    assert.equal((await f.inspect()).native.state, 'changed');
    f.db.prepare('UPDATE xiaozhi_pi_session_bindings SET model=?').run(identity.model);
    f.db.prepare('UPDATE xiaozhi_pi_model_state SET session_file=?').run(`${f.sessionId}/sessions/other.jsonl`);
    assert.equal((await f.inspect()).native.state, 'changed');
    f.db.prepare('UPDATE xiaozhi_pi_model_state SET session_file=?,native_session_id=?').run(identity.sessionFile, 'invalid-native-id');
    assert.equal((await f.inspect()).native.state, 'changed');
    f.db.prepare('UPDATE xiaozhi_pi_model_state SET native_session_id=?').run(identity.nativeSessionId);
    assert.equal((await f.inspect()).native.state, 'available');
  });
  report.success = report.checks.every(item => item.pass);
} catch (error) {report.error = error.stack;}
finally {
  report.sources = [source, 'scripts/xiaozhi-agent/phase6-recovery-inspection-smoke.mjs'].filter(file=>fs.existsSync(file)).map(file=>({file,sha256:sha(fs.readFileSync(file))}));
  fs.writeFileSync(path.join(root,'report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({success:report.success,passed:report.checks.filter(item=>item.pass).length,total:report.checks.length,root,error:report.error}));
  if (!report.success) process.exitCode = 1;
}
