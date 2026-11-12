import '../office-agent/register-source.mjs';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import sqlite3 from 'sqlite3';
import http from 'node:http';
const {createPermissionStore} = await import('../../src/main/xiaozhi-agent/permissions/store.ts');
const {createPermissionEngine} = await import('../../src/main/xiaozhi-agent/permissions/engine.ts');
const {filesystemScope,checkedFile} = await import('../../src/main/xiaozhi-agent/permissions/resources.ts');
const {permissionHash,validRequest,snapshotRequest} = await import('../../src/main/xiaozhi-agent/permissions/validation.ts');
const {serializeStateWrites} = await import('../../src/main/xiaozhi-agent/serialized-state-sql.ts');
const {createPermissionNetworkBroker} = await import('../../src/main/xiaozhi-agent/permissions/network.ts');
const {createEnvironmentService} = await import('../../src/main/xiaozhi-agent/environment/service.ts');
const {runWithPermission} = await import('../../src/main/xiaozhi-agent/permissions/current.ts');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'xiaozhi-permission-phase3-store-'));
const workspace = path.join(root, 'workspace');
fs.mkdirSync(workspace);
fs.writeFileSync(path.join(workspace, '资料.txt'), 'synthetic');
const db = await new Promise((resolve, reject) => {
  const connection = new sqlite3.Database(path.join(root, 'authority.sqlite'), error => error ? reject(error) : resolve(connection));
});
const connection = {
  run: (query, args = []) => new Promise((resolve, reject) => db.run(query, args, error => error ? reject(error) : resolve())),
  change: (query, args = []) => new Promise((resolve, reject) => db.run(query, args, function(error) { error ? reject(error) : resolve(this.changes); })),
  all: (query, args = []) => new Promise((resolve, reject) => db.all(query, args, (error, rows) => error ? reject(error) : resolve(rows))),
};
connection.transaction = async action => {
  await connection.run('BEGIN IMMEDIATE');
  try { const result = await action(connection); await connection.run('COMMIT'); return result; }
  catch (error) { await connection.run('ROLLBACK'); throw error; }
};
const sql = serializeStateWrites(connection);
await sql.run(`CREATE TABLE ai_confirmation_items(id TEXT PRIMARY KEY,run_id TEXT,session_id TEXT,action_type TEXT,status TEXT,
  title TEXT,description TEXT,preview_md TEXT,payload_json TEXT,created_at TEXT,updated_at TEXT)`);
await sql.run(`CREATE TABLE xiaozhi_pi_workspaces(conversation_id TEXT PRIMARY KEY,schema_version INTEGER,path TEXT,label TEXT,updated_at TEXT)`);
const store = createPermissionStore(sql);
const sessionId = 'aisession_' + randomUUID();
let owner = {sessionId, taskId: 'xitask_' + 'a'.repeat(64), runId: 'run_fixture_v1', generation: 1};
let engine = createPermissionEngine({store, current: input => permissionHash(input) === permissionHash(owner)});
const read = filesystemScope(workspace, ['read']);
const write = filesystemScope(workspace, ['read', 'write']);
const request = (scope, overrides = {}) => ({schemaVersion: 2, owner: {...owner}, requirementsVersion: 1, callId: 'call_' + randomUUID(),
  action: 'fixture', inputDigest: permissionHash({input: 'synthetic'}), purpose: '合成权限验证', scopes: [scope],
  files: [], provider: null, classification: 'public', expiresAt: new Date(Date.now() + 600000).toISOString(), ...overrides});
const checks = [];
const report = {success: false, root, checks, boundary: 'Real SQLite permission store/engine unit integration, synthetic current-owner callback. Production Pi and Windows paths tested separately.'};
async function check(name, action) { await action(); checks.push({name, pass: true}); console.log('PASS ' + name); }
try {
  await check('Incremental permission tables migrate idempotently and main mode changes use revision CAS', async () => {
    await store.migrate(); await store.migrate();
    const profile = await store.profile(sessionId);
    assert.equal(profile.mode, 'request');
    assert.equal((await store.setMode(sessionId, profile.revision, 'fullAccess')).mode, 'fullAccess');
    await assert.rejects(store.setMode(sessionId, profile.revision, 'acceptEdits'), /revision_conflict/);
    assert.equal((await engine.evaluate(request(read))).state, 'pending');
  });
  await check('Legacy main workspace import is idempotent and revocation cannot resurrect it', async () => {
    await assert.rejects(store.importWorkspace(sessionId, read), /permission_denied/);
    await sql.run('INSERT INTO xiaozhi_pi_workspaces VALUES(?,1,?,?,?)', [sessionId, workspace, '合成目录', new Date().toISOString()]);
    await assert.rejects(store.importWorkspace('aisession_' + randomUUID(), read), /permission_denied/);
    await assert.rejects(store.importWorkspace(sessionId, {...read, identity: '0'.repeat(64)}), /permission_denied/);
    await assert.rejects(store.importWorkspace(sessionId, filesystemScope(root, ['read'])), /permission_denied/);
    await assert.rejects(store.importWorkspace(sessionId, write), /permission_denied/);
    await assert.rejects(store.importWorkspace(sessionId, {kind: 'network', origin: 'https://example.com', methods: ['GET'], purpose: 'public'}), /permission_denied/);
    const first = await store.importWorkspace(sessionId, read);
    assert.equal((await store.importWorkspace(sessionId, read))[0].grantId, first[0].grantId);
    assert.equal((await engine.evaluate(request(read))).state, 'allow');
    await engine.revoke(sessionId, first[0].grantId, first[0].revision);
    assert((await store.importWorkspace(sessionId, read))[0].revokedAt);
    assert.equal((await engine.evaluate(request(read))).state, 'pending');
  });
  await check('Canonical filesystem checks reject parent traversal hardlinks ADS and root replacement', async () => {
    checkedFile(read, path.join(workspace, '资料.txt'), 'read');
    assert.throws(() => checkedFile(read, path.join(root, 'outside.txt'), 'read'), /permission_denied/);
    assert.throws(() => checkedFile(read, path.join(workspace, '资料.txt:stream'), 'read'), /permission_denied/);
    fs.linkSync(path.join(workspace, '资料.txt'), path.join(root, 'hardlink.txt'));
    assert.throws(() => checkedFile(read, path.join(workspace, '资料.txt'), 'read'), /permission_denied/);
    fs.unlinkSync(path.join(root, 'hardlink.txt'));
    fs.renameSync(workspace, workspace + '-old'); fs.mkdirSync(workspace);
    assert.throws(() => checkedFile(read, path.join(workspace, 'new.txt'), 'write'), /permission_denied/);
    fs.rmdirSync(workspace); fs.renameSync(workspace + '-old', workspace);
  });
  await check('Strict frozen requests reject renderer authorized fields and accessors', async () => {
    const legal = request(write);
    assert(validRequest(legal));
    assert(!validRequest({...legal, authorized: true}));
    assert.throws(() => snapshotRequest({...legal, get action() { throw Error('accessor executed'); }}), /invalid_input/);
  });
  await check('Pending approval survives reconstruction and rejection deduplicates changed call IDs', async () => {
    const denied = request(write, {action: 'denied'});
    const decision = await engine.authorize(denied);
    const pending = await store.approval(sessionId, decision.approvalId);
    await store.recover();
    assert.equal((await store.approval(sessionId, pending.id)).state, 'pending');
    engine = createPermissionEngine({store: createPermissionStore(sql), current: () => true});
    await engine.decide({sessionId, approvalId: pending.id, revision: pending.revision, decision: 'reject', scope: 'operation'});
    const repeated = await engine.authorize({...denied, callId: 'different-call'});
    assert.equal(repeated.state, 'blocked'); assert.equal(repeated.reason, 'rejected');
    assert.equal((await store.approvals(sessionId)).filter(item => item.requestDigest === repeated.requestDigest).length, 1);
  });
  await check('Approved operation resumes under a new generation with exactly one concurrent consumer', async () => {
    const input = request(write, {action: 'once'});
    const decision = await engine.authorize(input);
    const approval = await store.approval(sessionId, decision.approvalId);
    await engine.decide({sessionId, approvalId: approval.id, revision: approval.revision, decision: 'approve', scope: 'operation'});
    await store.recover();
    assert.equal((await store.approval(sessionId, approval.id)).state, 'approved');
    owner = {...owner, runId: 'run_fixture_v2', generation: 2};
    engine = createPermissionEngine({store, current: input => permissionHash(input) === permissionHash(owner)});
    let executed = 0;
    const results = await Promise.allSettled([0, 1].map(() => engine.run({...input, owner}, new AbortController().signal,
      async context => { executed++; await context.assert(); return 'actual'; })));
    assert.equal(executed, 1); assert.equal(results.filter(item => item.status === 'fulfilled').length, 1);
    assert.equal((await store.approval(sessionId, approval.id)).state, 'executed');
  });
  await check('G3A-F01 original approved expiry fences a longer reconstructed request before real IO', async () => {
    let clock = Date.now();
    engine = createPermissionEngine({store, current: () => true, now: () => clock});
    const short = request(write, {action: 'ttl-intersection', expiresAt: new Date(clock + 60000).toISOString()});
    const decision = await engine.authorize(short);
    const approval = await store.approval(sessionId, decision.approvalId);
    await engine.decide({sessionId, approvalId: approval.id, revision: approval.revision, decision: 'approve', scope: 'operation'});
    let io = 0;
    await assert.rejects(engine.run({...short, expiresAt: new Date(clock + 600000).toISOString()}, new AbortController().signal, async context => {
      clock += 61000;
      try { await context.assert(); io++; fs.writeFileSync(path.join(workspace, 'expired.txt'), 'forbidden'); }
      finally { assert(context.signal.aborted); }
    }), /permission_denied/);
    assert.equal(io, 0); assert(!fs.existsSync(path.join(workspace, 'expired.txt')));
    engine = createPermissionEngine({store, current: input => permissionHash(input) === permissionHash(owner)});
  });
  await check('Task grant approval permits repeated routine actions and active revocation aborts the operation', async () => {
    const input = request(write, {action: 'task-grant'});
    const decision = await engine.authorize(input);
    const approval = await store.approval(sessionId, decision.approvalId);
    await engine.decide({sessionId, approvalId: approval.id, revision: approval.revision, decision: 'approve', scope: 'task'});
    for (let index = 0; index < 3; index++) {
      await engine.run({...input, callId: 'routine_' + index}, new AbortController().signal, async context => {
        await context.assert(); fs.writeFileSync(path.join(workspace, 'output.txt'), String(index));
      });
    }
    assert.equal((await store.approvals(sessionId)).filter(item => item.request.action === 'task-grant').length, 1);
    let started;
    const ready = new Promise(resolve => { started = resolve; });
    const operation = engine.run({...input, callId: 'active'}, new AbortController().signal, async context => {
      started(); await new Promise(resolve => context.signal.addEventListener('abort', resolve, {once: true})); await context.assert();
    });
    await ready;
    const granted = (await store.grants(sessionId)).find(item => item.provenance.reference === approval.id);
    await engine.revoke(sessionId, granted.grantId, granted.revision);
    await assert.rejects(operation);
    assert.equal(engine.activeCount(), 0);
  });
  await check('Unrelated grants do not invalidate a pending request and expired approvals fail closed', async () => {
    const input = request(write, {action: 'unrelated'});
    const decision = await engine.authorize(input);
    await store.issue(sessionId, [{kind: 'network', origin: 'https://example.com', methods: ['GET'], purpose: 'public'}], {kind: 'teacher', reference: 'fixture'});
    const pending = await store.approval(sessionId, decision.approvalId);
    await engine.decide({sessionId, approvalId: pending.id, revision: pending.revision, decision: 'approve', scope: 'operation'});
    assert.equal((await engine.evaluate(request(read, {expiresAt: '2000-01-01T00:00:00.000Z'}))).reason, 'expired');
  });
  await check('Grant owner/hash tampering and transaction failure preserve authority facts', async () => {
    const before = await store.grants(sessionId);
    await sql.run(`CREATE TRIGGER fail_permission BEFORE INSERT ON xiaozhi_permission_grants_v1 BEGIN SELECT RAISE(ABORT,'fixture rollback'); END`);
    await assert.rejects(store.issue(sessionId, [read], {kind: 'teacher', reference: 'rollback'}), /fixture rollback/);
    assert.deepEqual(await store.grants(sessionId), before);
    await sql.run('DROP TRIGGER fail_permission');
    const target = before[0];
    await sql.run('UPDATE xiaozhi_permission_grants_v1 SET document_hash=? WHERE grant_id=?', ['0'.repeat(64), target.grantId]);
    await assert.rejects(store.grants(sessionId), /state_corrupt/);
    await sql.run('UPDATE xiaozhi_permission_grants_v1 SET document_hash=? WHERE grant_id=?', [permissionHash(target), target.grantId]);
  });
  await check('Network and egress grants are independent and actual broker traffic stays at the approved endpoint', async () => {
    let authorizedCalls = 0, forbiddenCalls = 0;
    const forbidden = http.createServer((_request, response) => {forbiddenCalls++; response.end('forbidden');});
    const authorized = http.createServer((incoming, response) => {
      authorizedCalls++;
      if (incoming.url === '/redirect') {response.writeHead(302, {location: forbiddenOrigin}); response.end();}
      else response.end('synthetic approved response');
    });
    await new Promise(resolve => forbidden.listen(0, '127.0.0.1', resolve));
    const forbiddenOrigin = 'http://127.0.0.1:' + forbidden.address().port;
    await new Promise(resolve => authorized.listen(0, '127.0.0.1', resolve));
    const origin = 'http://127.0.0.1:' + authorized.address().port;
    const broker = createPermissionNetworkBroker({engine, purpose: 'fixture_network', sanitize: async value => value.replaceAll('PRIVATE_STUDENT_CANARY', '[redacted]')});
    const input = {url: origin + '/ok', method: 'GET', body: null, purpose: 'fixture_network', classification: 'public'};
    try {
      await store.issue(sessionId, [{kind: 'network', origin, methods: ['GET'], purpose: input.purpose}], {kind: 'teacher', reference: 'network-only'});
      await assert.rejects(broker.fetch(owner, 'broker_missing_egress', input, new AbortController().signal), /permission_pending/);
      assert.equal(authorizedCalls, 0);
      await store.issue(sessionId, [{kind: 'egress', origin, classifications: ['public']}], {kind: 'teacher', reference: 'explicit-egress'});
      assert.equal((await broker.fetch(owner, 'broker_ok', input, new AbortController().signal)).status, 200);
      await assert.rejects(broker.fetch(owner, 'broker_forbidden', {...input, url: forbiddenOrigin}, new AbortController().signal), /permission_pending/);
      await assert.rejects(broker.fetch(owner, 'broker_redirect', {...input, url: origin + '/redirect'}, new AbortController().signal), /permission_denied/);
      await assert.rejects(broker.fetch(owner, 'broker_private', {...input, url: origin + '/?q=PRIVATE_STUDENT_CANARY'}, new AbortController().signal), /permission_denied/);
      assert.equal(authorizedCalls, 2); assert.equal(forbiddenCalls, 0);
    } finally {
      authorized.closeAllConnections(); forbidden.closeAllConnections();
      await Promise.all([new Promise(resolve => authorized.close(resolve)), new Promise(resolve => forbidden.close(resolve))]);
    }
  });
  await check('Environment diagnostics and non-sensitive configuration repair use real Grant CAS and preserve unknown fields', async () => {
    await store.issue(sessionId, [write], {kind: 'teacher', reference: 'environment-fixture'});
    const environment = createEnvironmentService({workspace: async () => ({path: workspace}), permissions: store,
      managedTools: async () => ({tools: [{id: 'fixture-runtime', status: 'ready'}]}), credentialAvailable: async () => false});
    const before = await environment.inspect(sessionId);
    assert(before.checks.some(item => item.id === 'model_credential' && item.status === 'missing_credential'));
    assert.equal(before.configuration.sha256, null);
    const input = request(write, {action: 'environment_repair'});
    const execute = expectedHash => engine.run(input, new AbortController().signal, context =>
      runWithPermission({request: input, ...context}, () => environment.repair(sessionId, expectedHash)));
    const originalRename = fs.renameSync;
    fs.renameSync = (...args) => {if (String(args[1]).endsWith('environment.json')) throw Error('fixture rename failure'); return originalRename(...args);};
    try {await assert.rejects(execute(null), /fixture rename failure/);}
    finally {fs.renameSync = originalRename;}
    assert(!fs.existsSync(path.join(workspace, '.xiaozhi/environment.json')));
    const fixed = await execute(null);
    assert(fixed.changed); assert(fixed.grantRefs.length);
    assert.equal((await execute(fixed.afterHash)).changed, false);
    await assert.rejects(execute(null), /source_changed/);
    const privateConfig = '{"schemaVersion":1,"private_value":"DO_NOT_OVERWRITE"}';
    fs.writeFileSync(path.join(workspace, '.xiaozhi/environment.json'), privateConfig);
    const unknown = await environment.inspect(sessionId);
    await assert.rejects(execute(unknown.configuration.sha256), /unsupported_constraint/);
    assert.equal(fs.readFileSync(path.join(workspace, '.xiaozhi/environment.json'), 'utf8'), privateConfig);
  });
  await check('Independent filesystem action Grants compose and either relevant revoke fences a live operation', async () => {
    owner = {...owner, sessionId: 'aisession_' + randomUUID(), taskId: 'xitask_' + 'd'.repeat(64)};
    const separate = createPermissionEngine({store, current: () => true});
    const grants = await store.issue(owner.sessionId, [filesystemScope(workspace, ['read']), filesystemScope(workspace, ['write'])],
      {kind: 'teacher', reference: 'split-action-fixture'});
    const frozen = request(filesystemScope(workspace, ['read', 'write']), {action: 'split_actions'});
    const decision = await separate.evaluate(frozen);
    assert.equal(decision.state, 'allow'); assert.equal(decision.grantRefs.length, 2);
    let writes = 0;
    await assert.rejects(separate.run(frozen, new AbortController().signal, async context => {
      await separate.revoke(owner.sessionId, grants[0].grantId, grants[0].revision);
      assert(context.signal.aborted); await context.assert(); writes++;
    }), /permission_denied/);
    assert.equal(writes, 0);
  });
  report.success = true;
} catch (error) { report.error = error.stack; process.exitCode = 1; }
finally {
  await new Promise((resolve, reject) => db.close(error => error ? reject(error) : resolve()));
  fs.writeFileSync(path.join(root, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({success: report.success, passed: checks.length, root, error: report.error}));
}
