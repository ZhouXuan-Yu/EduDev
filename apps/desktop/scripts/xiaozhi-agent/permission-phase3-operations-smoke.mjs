import '../office-agent/register-source.mjs';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {validateToolArguments} from '@earendil-works/pi-ai';
import sqlite3 from 'sqlite3';
const {createPermissionStore} = await import('../../src/main/xiaozhi-agent/permissions/store.ts');
const {createPermissionEngine} = await import('../../src/main/xiaozhi-agent/permissions/engine.ts');
const {createPermissionRuntimeManager} = await import('../../src/main/xiaozhi-agent/permissions/windows/runtime.ts');
const {inspectPermissionPlatform} = await import('../../src/main/xiaozhi-agent/permissions/windows/launcher.ts');
const {createControlledPowerShellOperations} = await import('../../src/main/xiaozhi-agent/permissions/windows/operations.ts');
const {createPermissionNetworkBroker} = await import('../../src/main/xiaozhi-agent/permissions/network.ts');
const {createTerminalTool} = await import('../../src/main/xiaozhi-agent/tools/terminal.ts');
const {filesystemScope} = await import('../../src/main/xiaozhi-agent/permissions/resources.ts');
const {permissionHash} = await import('../../src/main/xiaozhi-agent/permissions/validation.ts');
const {runWithPermission} = await import('../../src/main/xiaozhi-agent/permissions/current.ts');
const {serializeStateWrites} = await import('../../src/main/xiaozhi-agent/serialized-state-sql.ts');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'xiaozhi-phase3-operations-'));
const workspace = path.join(root, 'workspace');
fs.mkdirSync(workspace);
fs.writeFileSync(path.join(workspace, 'source.txt'), 'synthetic');
fs.writeFileSync(path.join(root, 'sibling.txt'), 'private-canary');
const db = await new Promise((resolve, reject) => {
  const connection = new sqlite3.Database(path.join(root, 'authority.sqlite'), error => error ? reject(error) : resolve(connection));
});
const connection = {
  run: (query, args = []) => new Promise((resolve, reject) => db.run(query, args, error => error ? reject(error) : resolve())),
  change: (query, args = []) => new Promise((resolve, reject) => db.run(query, args, function(error) {error ? reject(error) : resolve(this.changes);})),
  all: (query, args = []) => new Promise((resolve, reject) => db.all(query, args, (error, rows) => error ? reject(error) : resolve(rows)))
};
connection.transaction = async action => {
  await connection.run('BEGIN IMMEDIATE');
  try {const value = await action(connection); await connection.run('COMMIT'); return value;}
  catch (error) {await connection.run('ROLLBACK'); throw error;}
};
const store = createPermissionStore(serializeStateWrites(connection));
await connection.run('CREATE TABLE ai_confirmation_items(id TEXT PRIMARY KEY,run_id TEXT,session_id TEXT,action_type TEXT,status TEXT,title TEXT,description TEXT,preview_md TEXT,payload_json TEXT,created_at TEXT,updated_at TEXT)');
await store.migrate();
const owner = {sessionId: 'aisession_' + randomUUID(), taskId: 'xitask_' + 'b'.repeat(64), runId: 'run_operations', generation: 1};
const engine = createPermissionEngine({store, current: candidate => permissionHash(candidate) === permissionHash(owner)});
const runtime = createPermissionRuntimeManager({root: path.join(root, 'runtime'), store});
const system = await runtime.systemRuntime();
const platform = await inspectPermissionPlatform();
const compiler = platform.runtimes.find(item => item.kind === 'framework_csc');
assert.equal(compiler.trust, 'verified');
const securityReader = path.join(root, 'security-read.exe');
const compiled = spawnSync(compiler.path, ['/nologo', '/target:exe', '/out:' + securityReader,
  path.resolve('scripts/xiaozhi-agent/fixtures/permission-security-read.cs')], {encoding: 'utf8', windowsHide: true, timeout: 30000});
assert.equal(compiled.status, 0, compiled.stdout + compiled.stderr);
function readSecurity(filename) {
  const value = spawnSync(securityReader, [filename], {encoding: 'utf8', windowsHide: true, timeout: 5000, maxBuffer: 8192});
  assert.equal(value.status, 0, value.stderr); return value.stdout.trim();
}
const originalSecurity = readSecurity(workspace);
const scopes = [filesystemScope(workspace, ['read', 'write', 'delete']),
  {kind: 'process', backend: 'appcontainer', executable: system.path, executableHash: system.sha256, workspace}];
await store.issue(owner.sessionId, scopes, {kind: 'teacher', reference: 'owned-fixture'});
const operations = createControlledPowerShellOperations({runtime, store,
  broker: createPermissionNetworkBroker({engine, sanitize: async text => text})});
const tool = createTerminalTool({workspace, secret: '', sanitize: async text => text, beforeExecute: () => {}, operations});
async function execute(cmd, {signal = new AbortController().signal, onUpdate} = {}) {
  const callId = 'call_' + randomUUID();
  const request = {schemaVersion: 2, owner, requirementsVersion: 1, callId, action: 'exec_command', inputDigest: permissionHash({cmd}),
    purpose: '受控合成脚本', scopes, files: [], provider: null, classification: 'redacted', expiresAt: new Date(Date.now() + 60000).toISOString()};
  return engine.run(request, signal, context => runWithPermission({request, ...context}, () =>
    tool.execute(callId, {cmd, timeout: 15}, context.signal, onUpdate, {cwd: workspace})));
}
const checks = [];
const report = {success: false, root, checks, boundary: 'Real Pi public PowerShell operations and Windows AppContainer with synthetic current-owner callback. Production host owner tested separately.'};
async function check(name, action) {const start = performance.now(); await action(); checks.push({name, pass: true, durationMs: performance.now() - start}); console.log('PASS ' + name);}
try {
  await check('Pi public operations execute arbitrary PowerShell, preserve exit status and commit real files', async () => {
    const result = await execute("$sum=0; foreach($i in 1..10){$sum+=$i}; [IO.File]::WriteAllText((Join-Path $env:XIAOZHI_WORKSPACE 'sum.txt'),[string]$sum); Write-Output $sum");
    assert.equal(result.details.terminal.exitCode, 0, JSON.stringify(result));
    assert.equal(fs.readFileSync(path.join(workspace, 'sum.txt'), 'utf8'), '55');
    assert.match(result.details.terminal.output, /55/);
    const nonzero = await execute('exit 37');
    assert.equal(nonzero.details.terminal.exitCode, 37);
    assert.equal(nonzero.details.terminal.state, 'failed');
  });
  await check('OS boundary denies sibling bytes and direct loopback, source directory stays unchanged', async () => {
    let requests = 0;
    const server = http.createServer((_request, response) => {requests++; response.end('canary');});
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const url = 'http://127.0.0.1:' + server.address().port;
    try {
      const cmd = "$ErrorActionPreference='Stop'; try {[IO.Directory]::Move((Join-Path $env:XIAOZHI_WORKSPACE '.runtime/broker'),(Join-Path $env:XIAOZHI_WORKSPACE 'broker-moved')); throw 'BROKER_MOVED'} catch {Write-Output 'broker-pinned'}; try {[IO.File]::ReadAllText('" + path.join(root, 'sibling.txt').replaceAll("'", "''")
        + "'); throw 'CANARY_READ'} catch {Write-Output 'sibling-denied'}; try {Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 -Uri '" + url + "'; throw 'DIRECT_NETWORK'} catch {Write-Output 'network-denied'}";
      const result = await execute(cmd);
      assert.match(result.details.terminal.output, /sibling-denied/);
      assert.match(result.details.terminal.output, /network-denied/);
      assert.match(result.details.terminal.output, /broker-pinned/);
      assert(!fs.existsSync(path.join(workspace, 'broker-moved')));
      assert.equal(requests, 0);
      assert.equal(fs.readFileSync(path.join(root, 'sibling.txt'), 'utf8'), 'private-canary');
    } finally {await new Promise(resolve => server.close(resolve));}
  });
  await check('Cancellation kills owned shell tree and discards projected changes', async () => {
    const controller = new AbortController();
    const task = execute("[IO.File]::WriteAllText((Join-Path $env:XIAOZHI_WORKSPACE 'cancelled.txt'),'discard'); Write-Output 'READY'; Start-Sleep -Seconds 30", {
      signal: controller.signal, onUpdate: value => {if (value.content.some(part => part.type === 'text' && part.text.includes('READY'))) controller.abort();}
    });
    await assert.rejects(task);
    assert(!fs.existsSync(path.join(workspace, 'cancelled.txt')));
  });
  await check('Projection source CAS preserves a concurrent teacher edit', async () => {
    let changed = false;
    const result = await execute("Write-Output 'SOURCE_READY'; Start-Sleep -Milliseconds 700; [IO.File]::WriteAllText((Join-Path $env:XIAOZHI_WORKSPACE 'source.txt'),'script')", {
      onUpdate: value => {
        if (!changed && value.content.some(part => part.type === 'text' && part.text.includes('SOURCE_READY'))) {
          changed = true; fs.writeFileSync(path.join(workspace, 'source.txt'), 'teacher-concurrent');
        }
      }
    });
    assert(changed); assert.equal(result.details.terminal.state, 'failed');
    assert.match(result.details.terminal.output, /source_changed/);
    assert.equal(fs.readFileSync(path.join(workspace, 'source.txt'), 'utf8'), 'teacher-concurrent');
  });
  await check('PowerShell broker freezes a distinct network and private-egress request before actual authorized HTTP', async () => {
    let calls = 0;
    const server = http.createServer(async (request, response) => {
      calls++; let body = ''; for await (const bytes of request) body += bytes;
      assert.equal(body, 'synthetic-private'); response.end('broker-approved');
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const url = 'http://127.0.0.1:' + server.address().port + '/fixture';
    const command = "(Invoke-XiaozhiRequest -Uri '" + url + "' -Method POST -Body 'synthetic-private').body";
    try {
      const denied = await execute(command);
      assert.equal(denied.details.terminal.state, 'failed'); assert.equal(calls, 0);
      const pending = (await store.approvals(owner.sessionId)).find(item => item.request.action === 'network_broker');
      assert(pending); assert.equal(pending.request.classification, 'teacher_private');
      assert.deepEqual(pending.request.scopes.map(scope => scope.kind), ['network', 'egress']);
      await engine.decide({sessionId: owner.sessionId, approvalId: pending.id, revision: pending.revision, decision: 'approve', scope: 'task'});
      const allowed = await execute(command);
      assert.equal(allowed.details.terminal.exitCode, 0, JSON.stringify(allowed));
      assert.match(allowed.details.terminal.output, /broker-approved/); assert.equal(calls, 1);
    } finally {await new Promise(resolve => server.close(resolve));}
  });
  await check('Full public 16384-character command remains executable with the fixed broker prefix', async () => {
    const prefix = "Write-Output 'LONG_COMMAND_OK'; #";
    const command = prefix + 'x'.repeat(16384 - prefix.length);
    assert.equal(command.length, 16384);
    assert.equal(tool.parameters.properties.cmd.maxLength, 16384);
    assert.throws(() => validateToolArguments(tool, {type: 'toolCall', id: 'oversized_public', name: 'exec_command', arguments: {cmd: 'x'.repeat(16385)}}));
    const result = await execute(command);
    assert.equal(result.details.terminal.exitCode, 0, JSON.stringify(result));
    assert.match(result.details.terminal.output, /LONG_COMMAND_OK/);
  });
  await check('Public maximum Unicode codepoint command preserves the JSON Schema character boundary', async () => {
    const prefix = "Write-Output 'UNICODE_COMMAND_OK'; #";
    const command = prefix + '😀'.repeat(16384 - Array.from(prefix).length);
    assert.equal(Array.from(command).length, 16384);
    validateToolArguments(tool, {type: 'toolCall', id: 'unicode_public_maximum', name: 'exec_command', arguments: {cmd: command}});
    const result = await execute(command);
    assert.equal(result.details.terminal.exitCode, 0, JSON.stringify(result));
    assert.match(result.details.terminal.output, /UNICODE_COMMAND_OK/);
  });
  await check('Active filesystem Grant revoke cancels the real AppContainer and prevents final write', async () => {
    let revocation;
    const task = execute("[IO.File]::WriteAllText((Join-Path $env:XIAOZHI_WORKSPACE 'revoked.txt'),'discard'); Write-Output 'REVOKE_READY'; Start-Sleep -Seconds 30", {
      onUpdate: value => {
        if (!revocation && value.content.some(part => part.type === 'text' && part.text.includes('REVOKE_READY'))) {
          revocation = (async () => {
            const grant = (await store.grants(owner.sessionId)).find(item => !item.revokedAt && item.scope.kind === 'filesystem');
            assert(grant); await engine.revoke(owner.sessionId, grant.grantId, grant.revision);
          })();
        }
      }
    });
    await assert.rejects(task, /permission_denied/); await revocation;
    assert(!fs.existsSync(path.join(workspace, 'revoked.txt')));
    assert.equal(engine.activeCount(), 0);
  });
  await check('Original teacher directory owner DACL and mandatory integrity label remain byte-identical', async () => {
    assert.equal(readSecurity(workspace), originalSecurity);
    report.originalDirectorySecurityHash = permissionHash(originalSecurity);
  });
  report.success = true;
} catch (error) {report.error = error.stack; process.exitCode = 1; console.error(error);}
finally {
  fs.writeFileSync(path.join(root, 'report.json'), JSON.stringify(report, null, 2));
  await new Promise(resolve => db.close(resolve));
  console.log(JSON.stringify({success: report.success, passed: checks.length, root}));
}
