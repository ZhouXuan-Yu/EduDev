import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import {McpClient} from '@earendil-works/pi-mcp';
import {DatabaseSync} from 'node:sqlite';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'xiaozhi-phase5-stdio-'));
const output = fs.mkdtempSync(path.resolve('test-results/xiaozhi-agent/phase5-stdio-'));
await build({stdin: {contents: `export {createControlledStdioTransport} from './src/main/xiaozhi-agent/mcp-controlled-transport.ts';
export {createPermissionRuntimeManager} from './src/main/xiaozhi-agent/permissions/windows/runtime.ts';
export {createPermissionStore} from './src/main/xiaozhi-agent/permissions/store.ts';
export {createPermissionEngine} from './src/main/xiaozhi-agent/permissions/engine.ts';
export {permissionHash} from './src/main/xiaozhi-agent/permissions/validation.ts';
export {createControlledMcpService} from './src/main/xiaozhi-agent/mcp-controlled-service.ts';
export {createMcpRuntime} from './src/main/xiaozhi-agent/mcp-runtime.ts';
export {createMcpPermissionContext} from './src/main/xiaozhi-agent/permissions/mcp.ts';
export {createPermissionService} from './src/main/xiaozhi-agent/permissions/service.ts';
export {filesystemScope, digest} from './src/main/xiaozhi-agent/permissions/resources.ts';`, resolveDir: process.cwd(), loader: 'ts'}, outfile: path.join(output, 'transport.mjs'),
  bundle: true, platform: 'node', format: 'esm', packages: 'external', target: 'node24'});
const {createControlledStdioTransport, createPermissionRuntimeManager, createPermissionStore, createPermissionEngine, permissionHash,
  createControlledMcpService, createMcpRuntime, createMcpPermissionContext, createPermissionService, filesystemScope, digest} = await import(pathToFileURL(path.join(output, 'transport.mjs')).href);
const db = new DatabaseSync(path.join(root, 'authority.sqlite'));
db.exec('CREATE TABLE ai_confirmation_items(id TEXT PRIMARY KEY,run_id TEXT,session_id TEXT,action_type TEXT,status TEXT,title TEXT,description TEXT,preview_md TEXT,payload_json TEXT,created_at TEXT,updated_at TEXT)');
db.exec('CREATE TABLE app_settings(key TEXT PRIMARY KEY,value_json TEXT,updated_at TEXT)');
const sql = {all: async (query, values = []) => db.prepare(query).all(...values),
  run: async (query, values = []) => {db.prepare(query).run(...values);},
  change: async (query, values = []) => Number(db.prepare(query).run(...values).changes)};
sql.transaction = async action => {
  db.exec('BEGIN IMMEDIATE');
  try {const result = await action(sql); db.exec('COMMIT'); return result;}
  catch (error) {db.exec('ROLLBACK'); throw error;}
};
const store = createPermissionStore(sql); await store.migrate();
const owner = {sessionId: 'aisession_' + randomUUID(), taskId: 'xitask_' + 'a'.repeat(64), runId: 'run_stdio_recipe', generation: 1};
const manager = createPermissionRuntimeManager({root: path.join(root, 'runtime'), store});
const recipe = manager.recipe();
await store.issue(owner.sessionId, [recipe], {kind: 'teacher', reference: 'owned-phase5-runtime-recipe'});
const engine = createPermissionEngine({store, current: () => true});
const request = {schemaVersion: 2, owner, requirementsVersion: 1, callId: 'runtime_recipe', action: 'environment_repair', inputDigest: permissionHash(recipe),
  purpose: '合成stdio测试固定源码受控运行时', scopes: [recipe], files: [], provider: null, classification: 'redacted', expiresAt: new Date(Date.now() + 300000).toISOString()};
let selected, runtime;
const checks = [], receipts = [];
const report = {success: false, root, output, checks, receipts, paidCalls: 0,
  boundary: 'Actual production helper AppContainer/Job and public Pi McpClient/Transport. Owned synthetic PS5 NDJSON server. Main permission-lease and actual acquired package coverage are separate Phase5 integration cases.'};
function projection(script) {
  const executionId = 'xiexec_' + randomUUID();
  const owner = {sessionId: 'aisession_' + randomUUID(), taskId: 'xitask_fixture', runId: 'run_stdio', generation: 1};
  const directory = path.join(os.tmpdir(), 'xiaozhi-permission-exec-' + randomUUID());
  fs.mkdirSync(directory);
  fs.writeFileSync(path.join(directory, '.xiaozhi-projection.json'), JSON.stringify({schemaVersion: 1, executionId, grantHash: 'a'.repeat(64), owner}));
  fs.writeFileSync(path.join(directory, 'server.ps1'), '\ufeff' + script);
  return {executionId, owner, directory};
}
function transport(fixture, signal, overrides = {}) {
  return createControlledStdioTransport({runtime: selected, signal,
    assert: async () => signal.throwIfAborted(), receipt: async result => {receipts.push(result);}, cleanup: async () => {},
    start: {schemaVersion: 1, type: 'start', executionId: fixture.executionId, owner: fixture.owner, grantHash: 'a'.repeat(64),
      executable: runtime.path, executableHash: runtime.sha256, projectionRoot: fixture.directory, cwd: fixture.directory,
      command: '', env: {XIAOZHI_WORKSPACE: fixture.directory}, timeoutMs: 300000, maxOutputBytes: 4194304, maxProcesses: 8,
      session: {schemaVersion: 1, mode: 'stdio', arguments: '-NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "' + path.join(fixture.directory, 'server.ps1') + '"',
        maxInputBytes: 8388608, memoryBytes: 536870912, cpuRate: 5000, userTimeMs: 0, environment: {}, ...overrides}}});
}
const server = String.raw`
[Console]::InputEncoding = New-Object System.Text.UTF8Encoding($false)
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
while ($null -ne ($line = [Console]::ReadLine())) {
  $request = $line | ConvertFrom-Json
  if ($null -eq $request.id) { continue }
  $result = @{}
  switch ($request.method) {
    'initialize' { $result = @{protocolVersion=$request.params.protocolVersion;capabilities=@{tools=@{}};serverInfo=@{name='owned-stdio';version='1.0.0'}} }
    'tools/list' { $result = @{tools=@(@{name='echo';description='Synthetic echo';inputSchema=@{type='object';properties=@{text=@{type='string'}};required=@('text')}})} }
    'tools/call' { if($request.params.arguments.text -eq '__owned_request_timeout__'){Start-Sleep -Milliseconds 4000}; [Console]::Error.WriteLine('synthetic diagnostic'); $result = @{content=@(@{type='text';text=$request.params.arguments.text})} }
    default { $result = @{} }
  }
  [Console]::WriteLine((@{jsonrpc='2.0';id=$request.id;result=$result} | ConvertTo-Json -Depth 30 -Compress))
}
`;
async function check(name, action) {const start = performance.now(); await action(); checks.push({name, pass: true, durationMs: performance.now() - start}); console.log('PASS ' + name);}
try {
  await check('Current verified Microsoft runtime uses the original authorized recipe preparation and actual sandbox health', async () => {
    selected = (await engine.run(request, new AbortController().signal, context => manager.prepare({request, ...context}, recipe.sha256))).runtime;
    runtime = await manager.systemRuntime();
    assert.equal(selected.manifest.runtimes.find(item => item.required).sha256, runtime.sha256);
    report.helperHash = selected.manifest.helperSha256;
  });
  await check('Actual AppContainer duplex supports public initialize list multi-call Unicode and independent stderr', async () => {
    const fixture = projection(server);
    const controller = new AbortController();
    const connection = transport(fixture, controller.signal);
    const client = new McpClient({name: 'phase5-owned', version: '1.0.0', requestTimeoutMs: 10000});
    try {
      await client.connect(connection);
      assert.equal((await client.listTools())[0].name, 'echo');
      for (const text of ['合成Unicode🙂', '长请求'.repeat(12000), 'second request after earlier completion']) {
        const response = await client.callTool('echo', {text});
        assert.equal(response.content[0].text, text);
      }
    } finally {await client.close();}
    const receipt = receipts.at(-1);
    assert(receipt); assert.equal(receipt.cleanup.jobActiveProcesses, 0); assert.equal(receipt.cleanup.profileRemoved, true);
    assert.equal(receipt.cleanup.remainingOwnedAces, 0);
  });
  await check('Parent-owned cancellation settles a suspended server and performs exact Job profile ACE cleanup', async () => {
    const fixture = projection('Start-Sleep -Seconds 300');
    const controller = new AbortController();
    const connection = transport(fixture, controller.signal);
    await connection.start();
    controller.abort('revoked');
    await connection.close();
    assert.equal(receipts.at(-1).state, 'cancelled');
    assert.equal(receipts.at(-1).cleanup.jobActiveProcesses, 0);
  });
  await check('Original MCP Runtime and PermissionService retain the service lease across actual calls and revoke it at terminal cleanup', async () => {
    const workspace = path.join(root, 'workspace'); fs.mkdirSync(workspace);
    fs.writeFileSync(path.join(workspace, 'synthetic.txt'), 'owned teacher-private fixture');
    const packageRoot = path.join(root, 'package'); fs.mkdirSync(packageRoot);
    const bytes = Buffer.from('\ufeff' + server); fs.writeFileSync(path.join(packageRoot, 'server.ps1'), bytes);
    const artifactId = digest(bytes);
    const recipe = {artifactId, version: '1.0.0', directory: packageRoot, source: 'https://example.invalid', package: 'owned-stdio-fixture',
      packageHash: artifactId, files: [{path: 'server.ps1', sha256: digest(bytes), bytes: bytes.length}],
      executable: {path: runtime.path, sha256: runtime.sha256}, arguments: ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', '$PACKAGE/server.ps1'],
      workspaceActions: ['read'], limits: {memoryBytes: 536870912, cpuRate: 5000, userTimeMs: 0, leaseMs: 300000,
        maxInputBytes: 8388608, maxOutputBytes: 4194304, maxProcesses: 8}};
    let mcp;
    const permissions = createPermissionService({store, dataRoot: path.join(root, 'data'), owner: () => owner,
      archived: async () => false, workspace: async () => ({path: workspace}), process: async () => ({executable: runtime.path, executableHash: runtime.sha256}),
      verifyProvider: async provider => {const current = await mcp.authority('mcp_' + provider.id.slice('mcp.mcp-'.length)); return current?.sourceHash === provider.sourceHash && current?.schemaHash === provider.schemaHash;}});
    const controller = new AbortController();
    const controlled = createControlledMcpService({permissions, store, runtime: manager, binding: async () => recipe});
    const context = controlled.forOwner({owner: () => owner, signal: controller.signal, workspace, requirementsVersion: () => 1});
    const processScope = {kind: 'process', backend: 'appcontainer', executable: runtime.path, executableHash: runtime.sha256, workspace};
    const issued = await store.issue(owner.sessionId, [filesystemScope(workspace, ['read']), processScope,
      {kind: 'dependency', source: recipe.source, package: recipe.package, version: recipe.version, sha256: recipe.packageHash, environment: packageRoot, installScripts: false}],
      {kind: 'teacher', reference: 'explicit-owned-service-fixture'});
    mcp = createMcpRuntime(sql, undefined, {timeoutMs: 2500, stdioTransport: async (...input) => {
      try {const connection = await context.transport(...input); connection.onError(error => {report.transportError = error.stack; console.error(error);}); return connection;}
      catch (error) {report.factoryError = error.stack; console.error(error); throw error;}
    }});
    let catalog = await mcp.add({name: 'owned-controlled', transport: 'stdio', command: 'managed:' + artifactId});
    const serverId = catalog.servers[0].id;
    catalog = await mcp.inspect({schemaVersion: catalog.schemaVersion, revision: catalog.revision, serverId});
    assert.equal(catalog.servers[0].status, 'ready');
    assert.equal(permissions.engine.activeCount(), 0);
    catalog = await mcp.trust({schemaVersion: catalog.schemaVersion, revision: catalog.revision, serverId, schemaHash: catalog.servers[0].schemaHash, tools: ['echo']});
    const source = await mcp.authority(serverId);
    await store.issue(owner.sessionId, [{kind: 'mcp', serverId, sourceHash: source.sourceHash, schemaHash: source.schemaHash, tools: ['echo']}],
      {kind: 'teacher', reference: 'explicit-owned-mcp-call'});
    const prepared = await mcp.tools(createMcpPermissionContext({permissions, store, owner: () => owner, stdio: context}));
    try {
      assert.equal(prepared.definitions.length, 1);
      assert.equal(permissions.engine.activeCount(), 1);
      const result = await prepared.definitions[0].execute('call_owned_echo', {text: 'actual service call'}, controller.signal);
      assert(JSON.stringify(result).includes('actual service call'));
      assert.equal(permissions.engine.activeCount(), 1);
      await new Promise(resolve => setTimeout(resolve, 2750));
      assert.equal(permissions.engine.activeCount(), 1);
      const later = await prepared.definitions[0].execute('call_owned_after_request_window', {text: 'healthy after request timeout window'}, controller.signal);
      assert.equal(later.isError, false); assert(JSON.stringify(later).includes('healthy after request timeout window'));
      const timed = await prepared.definitions[0].execute('call_owned_timeout', {text: '__owned_request_timeout__'}, controller.signal);
      assert.equal(timed.isError, true); assert.equal(timed.details.error.code, 'timeout');
      await new Promise(resolve => setTimeout(resolve, 2000));
      const afterTimeout = await prepared.definitions[0].execute('call_owned_after_timeout', {text: 'separate new request after timeout'}, controller.signal);
      assert.equal(afterTimeout.isError, false); assert(JSON.stringify(afterTimeout).includes('separate new request after timeout'));
      const processGrant = issued.find(grant => grant.scope.kind === 'process');
      await permissions.engine.revoke(owner.sessionId, processGrant.grantId, processGrant.revision);
    } finally {await prepared.dispose(); await mcp.dispose();}
    assert.equal(permissions.engine.activeCount(), 0);
    const terminal = await sql.all("SELECT metadata_json FROM xiaozhi_permission_audit_v1 WHERE kind='mcp_service_terminal'");
    assert.equal(terminal.length, 2);
    for (const row of terminal) assert.equal(JSON.parse(row.metadata_json).result.cleanup.jobActiveProcesses, 0);
  });
  await check('OS cumulative Job user CPU budget terminates actual busy execution with a typed resource receipt', async () => {
    const fixture = projection('while ($true) { $x = [Math]::Sqrt(12345) }');
    const connection = transport(fixture, new AbortController().signal, {userTimeMs: 1000});
    let done;
    const closed = new Promise(resolve => {done = resolve;});
    connection.onClose(done);
    await connection.start();
    await Promise.race([closed, new Promise((_, reject) => {const timer = setTimeout(() => reject(Error('resource_probe_timeout')), 30000); timer.unref();})]);
    assert.equal(receipts.at(-1).error, 'cpu_limit');
    assert.equal(receipts.at(-1).cleanup.jobActiveProcesses, 0);
    await connection.close();
  });
  report.success = true;
} catch (error) {report.error = error.stack; process.exitCode = 1; console.error(error);}
finally {db.close();fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));console.log(JSON.stringify({success: report.success, passed: checks.length, output, root, error: report.error}));}
