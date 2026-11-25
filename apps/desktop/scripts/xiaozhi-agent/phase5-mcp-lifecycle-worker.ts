import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {randomUUID, createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {safeStorage} from 'electron';
import {createPermissionStore} from '../../src/main/xiaozhi-agent/permissions/store';
import {createPermissionService} from '../../src/main/xiaozhi-agent/permissions/service';
import {createPermissionRuntimeManager} from '../../src/main/xiaozhi-agent/permissions/windows/runtime';
import {createControlledMcpService, type PreparedStdioBinding} from '../../src/main/xiaozhi-agent/mcp-controlled-service';
import {createMcpRuntime, mcpToolName} from '../../src/main/xiaozhi-agent/mcp-runtime';
import {createMcpPermissionContext} from '../../src/main/xiaozhi-agent/permissions/mcp';
import {canonicalMcp} from '../../src/main/xiaozhi-agent/mcp-schema';
import {filesystemScope, digest} from '../../src/main/xiaozhi-agent/permissions/resources';
import type {Sql} from '../../src/main/xiaozhi-agent/session-state';
import {testManagedMcpRecovery} from './provider-managed-mcp-fixture';

const output = process.argv[2];
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'xiaozhi-phase5-mcp-lifecycle-'));
const workspace = path.join(root, 'workspace'), directory = path.join(root, 'package'), dataRoot = path.join(root, 'data');
for (const folder of [workspace, directory, dataRoot]) fs.mkdirSync(folder);
const db = new DatabaseSync(path.join(root, 'authority.sqlite'));
db.exec('CREATE TABLE ai_confirmation_items(id TEXT PRIMARY KEY,run_id TEXT,session_id TEXT,action_type TEXT,status TEXT,title TEXT,description TEXT,preview_md TEXT,payload_json TEXT,created_at TEXT,updated_at TEXT)');
db.exec('CREATE TABLE app_settings(key TEXT PRIMARY KEY,value_json TEXT,updated_at TEXT)');
const sql: Sql = {all: async (query, params = []) => db.prepare(query).all(...params),
  run: async (query, params = []) => {db.prepare(query).run(...params);}, change: async (query, params = []) => Number(db.prepare(query).run(...params).changes)};
sql.transaction = async action => {db.exec('BEGIN IMMEDIATE'); try {const value = await action(sql); db.exec('COMMIT'); return value;}
  catch (error) {db.exec('ROLLBACK'); throw error;}};
const store = createPermissionStore(sql); await store.migrate();
const owner = {sessionId: 'aisession_' + randomUUID(), taskId: 'xitask_' + 'a'.repeat(64), runId: 'run_mcp_secret', generation: 1};
const runtime = createPermissionRuntimeManager({root: path.join(root, 'runtime'), store});
const permissions = createPermissionService({store, dataRoot, owner: () => owner, archived: async () => false, workspace: async () => ({path: workspace}),
  process: async () => {const selected = await runtime.systemRuntime(); return {executable: selected.path, executableHash: selected.sha256};}});
let opened = 0, storageUsable = safeStorage.isEncryptionAvailable();
const codec = {available: () => storageUsable, seal: (value: string) => safeStorage.encryptString(value).toString('base64'),
  open: (sealed: string) => {opened++; return safeStorage.decryptString(Buffer.from(sealed, 'base64'));}};
const secretA = 'SYNTHETIC_MCP_A_' + randomUUID(), secretB = 'SYNTHETIC_MCP_B_' + randomUUID();
const script = String.raw`[Console]::InputEncoding=New-Object System.Text.UTF8Encoding($false)
[Console]::OutputEncoding=New-Object System.Text.UTF8Encoding($false)
$schemaChanged=$false
while($null -ne ($line=[Console]::ReadLine())){
 $request=$line|ConvertFrom-Json
 if($null -eq $request.id){continue}
 switch($request.method){
  'initialize' {$value=@{protocolVersion=$request.params.protocolVersion;capabilities=@{tools=@{}};serverInfo=@{name='owned-secret';version='1.0.0'}}}
  'tools/list' {$properties=@{text=@{type='string'}};if($schemaChanged){$properties.newField=@{type='string'}};$value=@{tools=@(@{name='echo';description='Owned synthetic echo';inputSchema=@{type='object';properties=$properties;required=@('text')}})}}
  'tools/call' {if($request.params.arguments.text -eq '__change_schema__'){$schemaChanged=$true};$value=@{content=@(@{type='text';text=($request.params.arguments.text+' '+$env:MCP_API_KEY)})}}
 }
 [Console]::WriteLine((@{jsonrpc='2.0';id=$request.id;result=$value}|ConvertTo-Json -Depth 30 -Compress))
}`;
fs.writeFileSync(path.join(directory, 'server.ps1'), '\ufeff' + script);
const checks: {name: string; pass: boolean; durationMs: number}[] = [];
const report = {success: false, checks, root, output, paidCalls: 0, error: undefined as string | undefined};
const signal = new AbortController().signal;
let mcp = createMcpRuntime(sql, codec);
let binding: PreparedStdioBinding;
let expectedSource = '';
const controlled = createControlledMcpService({permissions, store, runtime, binding: async source => {
  assert.equal(source.sourceHash, expectedSource); return binding;
}});
const owned = () => controlled.forOwner({owner: () => owner, signal, workspace, requirementsVersion: () => 1});
const permission = () => createMcpPermissionContext({permissions, store, owner: () => owner, stdio: owned()});
let serverId = '';
let prepared: Awaited<ReturnType<typeof mcp.tools>> | undefined;
async function check(name: string, action: () => Promise<void>) {const started = performance.now(); await action(); checks.push({name, pass: true, durationMs: performance.now() - started}); console.log('PASS ' + name);}
async function approvePending() {for (const approval of (await store.approvals(owner.sessionId)).filter(row => row.state === 'pending'))
  await permissions.decide({sessionId: owner.sessionId, approvalId: approval.id, revision: approval.revision, decision: 'approve', scope: 'task'});}
async function inspect() {const catalog = await mcp.catalog(); return mcp.inspect({schemaVersion: catalog.schemaVersion, revision: catalog.revision, serverId}, owned().transport);}
async function trust() {const catalog = await mcp.catalog(); const server = catalog.servers.find(row => row.id === serverId)!;
  return mcp.trust({schemaVersion: catalog.schemaVersion, revision: catalog.revision, serverId, schemaHash: server.schemaHash!, tools: ['echo']});}
try {
  assert(storageUsable, 'actual_safeStorage_unavailable');
  const recipe = runtime.recipe(); await store.issue(owner.sessionId, [recipe], {kind: 'teacher', reference: 'owned-runtime-source'});
  await permissions.engine.run({schemaVersion: 2, owner, requirementsVersion: 1, callId: 'runtime', action: 'environment_repair', inputDigest: digest('runtime'),
    purpose: '准备合成测试受控运行时', scopes: [recipe], files: [], provider: null, classification: 'public', expiresAt: new Date(Date.now() + 300000).toISOString()}, signal,
  authority => runtime.prepare({request: {schemaVersion: 2, owner, requirementsVersion: 1, callId: 'runtime', action: 'environment_repair', inputDigest: digest('runtime'), purpose: '准备合成测试受控运行时', scopes: [recipe], files: [], provider: null,
    classification: 'public', expiresAt: new Date(Date.now() + 300000).toISOString()}, ...authority}, recipe.sha256));
  const selected = await runtime.systemRuntime();
  binding = {artifactId: 'owned-secret-program', version: '1.0.0', directory, source: 'https://example.invalid', package: 'owned-secret-program', packageHash: digest(script),
    files: [{path: 'server.ps1', sha256: digest(fs.readFileSync(path.join(directory, 'server.ps1'))), bytes: fs.statSync(path.join(directory, 'server.ps1')).size}],
    executable: {path: selected.path, sha256: selected.sha256}, arguments: ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', '$PACKAGE/server.ps1'],
    workspaceActions: ['read'], limits: {memoryBytes: 536870912, cpuRate: 5000, userTimeMs: 0, leaseMs: 300000, maxInputBytes: 4194304, maxOutputBytes: 4194304, maxProcesses: 4}};
  await store.issue(owner.sessionId, [filesystemScope(workspace, ['read']), {kind: 'process', backend: 'appcontainer', executable: selected.path, executableHash: selected.sha256, workspace},
    {kind: 'dependency', source: binding.source, package: binding.package, version: binding.version, sha256: binding.packageHash, environment: directory, installScripts: false}], {kind: 'teacher', reference: 'owned-fixed-program'});
  await check('Actual safeStorage seals synthetic credential and public catalog exposes only a versioned reference', async () => {
    const catalog = await mcp.add({name: 'owned-secret', transport: 'stdio', command: 'managed:' + binding.artifactId, secret: secretA});
    serverId = catalog.servers[0].id; expectedSource = createHash('sha256').update(canonicalMcp({transport: 'stdio', command: 'managed:' + binding.artifactId, args: [], cwd: ''})).digest('hex');
    assert.equal(catalog.servers[0].credentialConfigured, true); assert(catalog.servers[0].credentialReference);
    assert(!JSON.stringify(catalog).includes(secretA)); assert(!JSON.stringify(db.prepare('SELECT value_json FROM app_settings').all()).includes(secretA));
  });
  await check('Missing Secret Scope rejects before credential unseal or native program start', async () => {
    const catalog = await inspect(); assert.equal(catalog.servers[0].lastError, 'permission_pending'); assert.equal(opened, 0);
    assert((await store.approvals(owner.sessionId)).some(row => row.request.scopes.some(scope => scope.kind === 'secret')));
  });
  await check('Original secret approval permits actual isolated initialize and selected-schema consumption', async () => {
    await approvePending(); let catalog = await inspect(); assert.equal(catalog.servers[0].status, 'ready'); assert(opened > 0); await trust();
    prepared = await mcp.tools(permission());
    if (!prepared.definitions.length) {await prepared.dispose(); await approvePending(); prepared = await mcp.tools(permission());}
    assert.equal(prepared.definitions.length, 1); assert.equal(permissions.engine.activeCount(), 1);
    const tool = prepared.definitions.find(row => row.name === mcpToolName(serverId, 'echo'))!;
    let result = await tool.execute('echo_secret', {text: 'owned'}, signal, undefined, undefined as never);
    if (result.isError) {await approvePending(); result = await tool.execute('echo_secret_retry', {text: 'owned'}, signal, undefined, undefined as never);}
    assert.equal(result.isError, false); assert(!JSON.stringify(result).includes(secretA)); assert(JSON.stringify(result).includes('凭证已隐藏'));
  });
  await check('Credential replacement uses CAS, clears old trust and waits for native lease cleanup', async () => {
    const catalog = await mcp.catalog(); const previousReference = catalog.servers[0].credentialReference;
    await assert.rejects(mcp.credential({schemaVersion: catalog.schemaVersion, revision: catalog.revision - 1, serverId, action: 'set', value: secretB}), /conflict/u);
    const changed = await mcp.credential({schemaVersion: catalog.schemaVersion, revision: catalog.revision, serverId, action: 'set', value: secretB});
    assert.notEqual(changed.servers[0].credentialReference, previousReference); assert.equal(changed.servers[0].trustedSchemaHash, undefined);
    assert.equal(changed.servers[0].status, 'unverified'); assert.equal(permissions.engine.activeCount(), 0);
  });
  await check('Cold runtime reads the sealed reference and replacement cannot reuse the old secret Grant', async () => {
    await mcp.dispose(); mcp = createMcpRuntime(sql, codec);
    const catalog = await inspect(); assert.equal(catalog.servers[0].lastError, 'permission_pending');
    const approval = (await store.approvals(owner.sessionId)).findLast(row => row.state === 'pending')!;
    assert(approval.request.scopes.some(scope => scope.kind === 'secret' && scope.reference === catalog.servers[0].credentialReference));
  });
  await check('Unavailable secure storage is explicit and clear remains available without decrypting', async () => {
    await approvePending(); storageUsable = false;
    const catalog = await inspect(); assert.equal(catalog.servers[0].lastError, 'storage_unavailable');
    await assert.rejects(mcp.credential({schemaVersion: catalog.schemaVersion, revision: catalog.revision, serverId, action: 'set', value: secretA}), /storage_unavailable/u);
    const cleared = await mcp.credential({schemaVersion: catalog.schemaVersion, revision: catalog.revision, serverId, action: 'clear'});
    assert.equal(cleared.servers[0].credentialConfigured, undefined); assert.equal(cleared.servers[0].credentialReference, undefined); storageUsable = true;
  });
  await check('Known credential values cannot be copied into ordinary config fields or NUL environment injection', async () => {
    await assert.rejects(mcp.add({name: secretA, transport: 'stdio', command: 'managed:synthetic', secret: secretA}), /invalid_input/u);
    const catalog = await mcp.catalog(); await assert.rejects(mcp.credential({schemaVersion: catalog.schemaVersion, revision: catalog.revision, serverId, action: 'set', value: 'a\0MCP_OTHER=b'}), /invalid_input/u);
  });
  let driftId = '';
  let driftTools: Awaited<ReturnType<typeof mcp.tools>> | undefined;
  let driftTool: Awaited<ReturnType<typeof mcp.tools>>['definitions'][number];
  await check('Actual isolated selected MCP accepts an external-effect tool and preserves exact live schema', async () => {
    let catalog = await mcp.add({name: 'owned-schema-drift', transport: 'stdio', command: 'managed:' + binding.artifactId});
    driftId = catalog.servers.find(row => row.name === 'owned-schema-drift')!.id;
    catalog = await mcp.inspect({schemaVersion: catalog.schemaVersion, revision: catalog.revision, serverId: driftId}, owned().transport);
    const server = catalog.servers.find(row => row.id === driftId)!; assert.equal(server.status, 'ready'); assert.equal(server.tools[0].readOnly, false);
    await mcp.trust({schemaVersion: catalog.schemaVersion, revision: catalog.revision, serverId: driftId, schemaHash: server.schemaHash!, tools: ['echo']});
    driftTools = await mcp.tools(permission()); driftTool = driftTools.definitions.find(row => row.name === mcpToolName(driftId, 'echo'))!; assert(driftTool);
    let result = await driftTool.execute('schema_change', {text: '__change_schema__'}, signal, undefined, undefined as never);
    if (result.isError) {await approvePending(); result = await driftTool.execute('schema_change_authorized', {text: '__change_schema__'}, signal, undefined, undefined as never);}
    assert.equal(result.isError, false);
  });
  await check('Live schema mutation clears trust, denies the next call and closes the original native client', async () => {
    const result = await driftTool.execute('schema_after_change', {text: 'must-not-run'}, signal, undefined, undefined as never);
    assert.equal(result.isError, true); assert.equal((result.details as {error: {code: string}}).error.code, 'permission_denied');
    const server = (await mcp.catalog()).servers.find(row => row.id === driftId)!;
    assert.equal(server.status, 'schema_changed'); assert.equal(server.trustedSchemaHash, undefined); assert(!server.tools.some(row => row.selected));
    await driftTools!.dispose(); assert.equal(permissions.engine.activeCount(), 0);
  });
  await check('Offline preparation fails boundedly and explicit reconnect cannot reuse revoked client closures', async () => {
    let catalog = await mcp.catalog();
    catalog = await mcp.inspect({schemaVersion: catalog.schemaVersion, revision: catalog.revision, serverId: driftId}, owned().transport);
    let server = catalog.servers.find(row => row.id === driftId)!; assert.equal(server.status, 'ready');
    catalog = await mcp.trust({schemaVersion: catalog.schemaVersion, revision: catalog.revision, serverId: driftId, schemaHash: server.schemaHash!, tools: ['echo']});
    const offline = permission(); offline.stdioTransport = async () => {throw Error('transport');};
    const unavailable = await mcp.tools(offline); assert.equal(unavailable.definitions.length, 0); await unavailable.dispose();
    server = (await mcp.catalog()).servers.find(row => row.id === driftId)!; assert.equal(server.status, 'failed'); assert.equal(server.trustedSchemaHash, undefined);
    catalog = await mcp.catalog(); catalog = await mcp.inspect({schemaVersion: catalog.schemaVersion, revision: catalog.revision, serverId: driftId}, owned().transport);
    server = catalog.servers.find(row => row.id === driftId)!;
    catalog = await mcp.trust({schemaVersion: catalog.schemaVersion, revision: catalog.revision, serverId: driftId, schemaHash: server.schemaHash!, tools: ['echo']});
    const fresh = await mcp.tools(permission()); const freshTool = fresh.definitions.find(row => row.name === mcpToolName(driftId, 'echo'))!; assert(freshTool);
    const result = await freshTool.execute('schema_fresh', {text: 'fresh-public'}, signal, undefined, undefined as never); assert.equal(result.isError, false);
    await mcp.revoke({schemaVersion: catalog.schemaVersion, revision: catalog.revision, serverId: driftId});
    const stale = await freshTool.execute('schema_revoked', {text: 'must-not-run'}, signal, undefined, undefined as never); assert.equal(stale.isError, true);
    await fresh.dispose(); assert.equal(permissions.engine.activeCount(), 0);
  });
  await check('Synthetic secrets never enter permission audit and every real helper terminal has clean Job/profile/ACEs', async () => {
    await inspect(); await trust();
    const slow = permission(); const transport = slow.stdioTransport!;
    slow.stdioTransport = async (configuration, signal) => {const candidate = await transport(configuration, signal);
      await new Promise(resolve => setTimeout(resolve, 1250)); return candidate;};
    const timed = await mcp.tools(slow, {preparationTimeoutMs: 1000}); assert.equal(timed.definitions.length, 0); await timed.dispose();
    assert((await sql.all("SELECT metadata_json FROM xiaozhi_permission_audit_v1 WHERE kind='mcp_service_not_started'")).length >= 1);
    await prepared?.dispose(); await mcp.dispose(); assert.equal(permissions.engine.activeCount(), 0);
    const audit = await sql.all('SELECT kind,metadata_json FROM xiaozhi_permission_audit_v1'); assert(!JSON.stringify(audit).includes(secretA)); assert(!JSON.stringify(audit).includes(secretB));
    const terminals = audit.filter(row => row.kind === 'mcp_service_terminal').map(row => JSON.parse(String(row.metadata_json)));
    assert(terminals.length >= 2); for (const row of terminals) assert.deepEqual(row.result.cleanup, {jobActiveProcesses: 0, profileRemoved: true, remainingOwnedAces: 0});
  });
  if (process.argv.includes('--managed-recovery')) {
    await testManagedMcpRecovery({sql, workspace, directory, owner, permissions, store, runtime, signal, check});
  }
  report.success = true;
} catch (error) {report.error = error instanceof Error ? error.stack : String(error); process.exitCode = 1; console.error(error);}
finally {await prepared?.dispose(); await mcp.dispose(); db.close(); fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({success: report.success, passed: checks.length, root, output}));}
