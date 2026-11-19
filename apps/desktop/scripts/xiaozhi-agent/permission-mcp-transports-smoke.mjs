import '../office-agent/register-source.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {randomUUID, createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {startMcpFixture} from './fixtures/mcp-server.mjs';

const {createMcpPermissionContext} = await import('../../src/main/xiaozhi-agent/permissions/mcp.ts');
const {createMcpRuntime} = await import('../../src/main/xiaozhi-agent/mcp-runtime.ts');
const {createPermissionStore} = await import('../../src/main/xiaozhi-agent/permissions/store.ts');
const {createPermissionEngine} = await import('../../src/main/xiaozhi-agent/permissions/engine.ts');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'xiaozhi-mcp-transports-'));
const report = {success: false, root, checks: [], paidCalls: 0,
  boundary: 'Current permission adapter and engine, owned SQLite, actual HTTP MCP loopback and network broker. Stdio input conversion is a declared callback fixture, without a native stdio process. No Electron or model.'};
const db = new DatabaseSync(path.join(root, 'authority.sqlite'));
db.exec(`CREATE TABLE app_settings(key TEXT PRIMARY KEY,value_json TEXT NOT NULL,updated_at TEXT NOT NULL);
  CREATE TABLE ai_confirmation_items(id TEXT PRIMARY KEY,run_id TEXT,session_id TEXT,action_type TEXT,status TEXT,
    title TEXT,description TEXT,preview_md TEXT,payload_json TEXT,created_at TEXT,updated_at TEXT);`);
const sql = {
  all: async (query, values = []) => db.prepare(query).all(...values),
  run: async (query, values = []) => {db.prepare(query).run(...values);},
  change: async (query, values = []) => Number(db.prepare(query).run(...values).changes),
};
sql.transaction = async action => {
  db.exec('BEGIN IMMEDIATE');
  try {const result = await action(sql); db.exec('COMMIT'); return result;}
  catch (error) {db.exec('ROLLBACK'); throw error;}
};
const fixture = await startMcpFixture();
const store = createPermissionStore(sql);
await store.migrate();
const owner = {sessionId: 'aisession_' + randomUUID(), taskId: 'xitask_' + 'a'.repeat(64), runId: 'run_mcp_transports', generation: 1};
const engine = createPermissionEngine({store, current: () => true});
const runtime = createMcpRuntime(sql, undefined, {timeoutMs: 2000, sanitize: text => text.replaceAll('PRIVATE_STUDENT', '[学生]')});
let transforms = 0;
const context = createMcpPermissionContext({permissions: {engine, summarize: async action => action}, store, owner: () => owner,
  stdio: {
    transport: async () => {throw Error('HTTP must not open stdio');},
    scopes: async () => {throw Error('HTTP must not request stdio scopes');},
    transformInput: async (source, _tool, input) => {
      transforms++;
      if (source.transport !== 'stdio' || input.reject) throw Error('permission_denied');
      return {...input, path: 'owned-projection/' + input.path};
    },
  }});
async function check(name, action) {
  await action();
  report.checks.push({name, pass: true});
  console.log('PASS ' + name);
}
const grant = async scope => (await store.issue(owner.sessionId, [scope], {kind: 'teacher', reference: 'owned-mcp-transport'}))[0];
const revoke = row => engine.revoke(owner.sessionId, row.grantId, row.revision);
let handle, view, definition, source;
let calls = 0;
const call = input => definition.execute('call_' + randomUUID(), input, new AbortController().signal, undefined, {});
async function succeeds() {
  const result = await call({topic: 'public-normal-grant'});
  assert.equal(result.isError, false);
  assert.equal(result.details.success, true);
  assert.equal(result.details.untrusted, true);
  assert.equal(fixture.state.calls, ++calls);
  assert.equal(transforms, 0);
}
async function denied(input = {topic: 'public-normal-grant'}, code) {
  const before = fixture.state.requests;
  const result = await call(input);
  assert.equal(result.isError, true);
  if (code) assert.equal(result.details.error.code, code);
  assert.equal(fixture.state.calls, calls);
  assert.equal(fixture.state.requests, before);
  assert.equal(transforms, 0);
}
try {
  await check('Mixed adapter leaves HTTP input unchanged and does not invoke the stdio converter', async () => {
    const input = {topic: 'public-normal-grant'};
    assert.equal(await context.transformInput({transport: 'http'}, 'lookup_lesson', input), input);
    assert.equal(transforms, 0);
  });
  await check('Stdio converter result and denial still propagate', async () => {
    assert.deepEqual(await context.transformInput({transport: 'stdio'}, 'read_text_file', {path: 'lesson.txt'}), {path: 'owned-projection/lesson.txt'});
    await assert.rejects(context.transformInput({transport: 'stdio'}, 'read_text_file', {reject: true}), /permission_denied/);
    assert.equal(transforms, 2);
    transforms = 0;
  });
  await check('Real HTTP metadata and selected tools initialize with the mixed adapter', async () => {
    view = await runtime.add({name: 'owned-http', transport: 'http', url: fixture.url});
    const id = view.servers[0].id;
    view = await runtime.inspect({schemaVersion: view.schemaVersion, revision: view.revision, serverId: id});
    view = await runtime.trust({schemaVersion: view.schemaVersion, revision: view.revision, serverId: id,
      schemaHash: view.servers[0].schemaHash, tools: ['lookup_lesson']});
    source = await runtime.authority(id);
    handle = await runtime.tools(context);
    assert.equal(handle.definitions.length, 1);
    definition = handle.definitions[0];
    assert.equal(fixture.state.calls, 0);
  });
  const origin = new URL(fixture.url).origin;
  const mcpScope = {kind: 'mcp', serverId: source.serverId, sourceHash: source.sourceHash, schemaHash: source.schemaHash, tools: ['lookup_lesson']};
  const networkScope = {kind: 'network', origin, methods: ['POST'], purpose: 'mcp_call'};
  const egressScope = {kind: 'egress', origin, classifications: ['teacher_private']};
  let mcpGrant = await grant(mcpScope);
  let egressGrant = await grant(egressScope);
  await grant({...networkScope, origin: 'http://127.0.0.1:1'});
  await check('Network grant for another actual URL origin cannot authorize this endpoint', () => denied());
  let networkGrant = await grant(networkScope);
  await check('Exact Network Egress and MCP grants permit the actual HTTP call without stdio projection', succeeds);
  await check('Input schema and privacy refusals happen before any HTTP request', async () => {
    await denied({topic: 'public', undeclared: true}, 'invalid_input');
    await denied({topic: 'PRIVATE_STUDENT'}, 'permission_denied');
  });
  await check('Server authentication failure is reported independently from URL authorization', async () => {
    fixture.state.auth = 'owned-authentication-negative';
    const before = fixture.state.requests;
    const result = await call({topic: 'public'});
    assert.equal(result.isError, true);
    assert.equal(result.details.error.code, 'authentication');
    assert(fixture.state.requests > before);
    assert.equal(fixture.state.calls, calls);
    fixture.state.auth = '';
  });
  await check('Relevant Egress revocation blocks the registered callback before network IO', async () => {
    await revoke(egressGrant);
    await denied();
    egressGrant = await grant(egressScope);
    await succeeds();
  });
  await check('Relevant MCP revocation blocks the registered callback before network IO', async () => {
    await revoke(mcpGrant);
    await denied();
    mcpGrant = await grant(mcpScope);
    await succeeds();
  });
  await check('Relevant Network revocation blocks the registered callback before network IO', async () => {
    await revoke(networkGrant);
    await denied();
    networkGrant = await grant(networkScope);
    await succeeds();
  });
  await check('Server revocation blocks the old registered callback with all grants still present', async () => {
    view = await runtime.catalog();
    await runtime.revoke({schemaVersion: view.schemaVersion, revision: view.revision, serverId: source.serverId});
    await denied(undefined, 'permission_denied');
  });
  report.success = true;
} catch (error) {
  report.error = String(error.stack || error);
  console.error(report.error);
  process.exitCode = 1;
} finally {
  await handle?.dispose();
  await runtime.dispose();
  await fixture.close();
  db.close();
  report.calls = fixture.state.calls;
  report.requests = fixture.state.requests;
  report.sourceSha256 = createHash('sha256').update(fs.readFileSync(new URL('../../src/main/xiaozhi-agent/permissions/mcp.ts', import.meta.url))).digest('hex');
  fs.writeFileSync(path.join(root, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({success: report.success, checks: report.checks.length, root, error: report.error}));
}
