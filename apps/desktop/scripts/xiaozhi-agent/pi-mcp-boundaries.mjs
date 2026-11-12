import '../office-agent/register-source.mjs';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { randomBytes, createCipheriv, createDecipheriv, createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { startMcpFixture } from './fixtures/mcp-server.mjs';
const { createMcpRuntime } = await import('../../src/main/xiaozhi-agent/mcp-runtime.ts');
const { validMcpSchema, canonicalMcp } = await import('../../src/main/xiaozhi-agent/mcp-schema.ts');
const { createHanaRunToolScope } = await import('../../src/main/xiaozhi-agent/hana-tool-scope.ts');
const { manifestForTools, toolManifest } = await import('../../src/main/xiaozhi-agent/tools/manifest.ts');
const { mcpResult, registerMcpIpc } = await import('../../src/main/xiaozhi-agent/mcp-api.ts');
const { validToolAttempt } = await import('../../src/shared/xiaozhi-tool-attempt.ts');
const output = fs.mkdtempSync(path.resolve('test-results/xiaozhi-agent/pi-mcp-boundaries-'));
const report = { success: false, scope: 'Production MCP adapter + real loopback HTTP + owned SQLite. Stdio is a typed Phase5 transition. Main Grant integration is tested separately.', checks: [] };
const check = async (name, fn) => { await fn(); report.checks.push({ name, pass: true }); console.log('PASS ' + name); };
const db = new DatabaseSync(path.join(output, 'app.db')); db.exec('CREATE TABLE app_settings(key TEXT PRIMARY KEY,value_json TEXT NOT NULL,updated_at TEXT NOT NULL)');
const sql = { all: async (q, values = []) => db.prepare(q).all(...values), change: async (q, values = []) => Number(db.prepare(q).run(...values).changes) };
const key = randomBytes(32), credential = 'owned-' + randomBytes(16).toString('hex');
const codec = { available: () => true, seal: text => { const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, iv), bytes = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]); return Buffer.concat([iv, cipher.getAuthTag(), bytes]).toString('base64'); }, open: text => { const bytes = Buffer.from(text, 'base64'), decipher = createDecipheriv('aes-256-gcm', key, bytes.subarray(0, 12)); decipher.setAuthTag(bytes.subarray(12, 28)); return Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString('utf8'); } };
const fixture = await startMcpFixture();
const runtime = createMcpRuntime(sql, codec, { timeoutMs: 200, sanitize: async text => text.replaceAll('PRIVATE_STUDENT', '[学生]') });
let view, handle;
const input = () => ({ schemaVersion: view.schemaVersion, revision: view.revision, serverId: view.servers[0].id });
const call = (definition, topic = '勾股定理', signal) => definition.execute('owned_call', { topic }, signal, undefined, {});
async function trust() { view = await runtime.inspect(input()); view = await runtime.trust({ ...input(), schemaHash: view.servers[0].schemaHash, tools: ['lookup_lesson'] }); }
try {
  await check('Empty catalog and add do not execute a server', async () => { view = await runtime.catalog(); assert.equal(view.servers.length, 0); view = await runtime.add({ name: '课程资料', transport: 'http', url: fixture.url, bearerToken: credential }); assert.equal(fixture.state.requests, 0); assert.equal(view.servers[0].status, 'unverified'); assert.equal((await runtime.tools()).definitions.length, 0); });
  await check('Credential is encrypted in owned SQLite and absent from public catalog/endpoint', async () => { assert(!JSON.stringify(view).includes(credential)); assert(!db.prepare('SELECT value_json FROM app_settings').get().value_json.includes(credential)); assert.equal(view.servers[0].endpoint, new URL(fixture.url).origin); });
  await check('Exact schema and teacher selection govern tools independently of readonly hints', async () => {
    view = await runtime.inspect(input());
    assert.equal(view.servers[0].tools.length, 2); assert.equal(view.servers[0].status, 'ready');
    assert.equal((await runtime.tools()).definitions.length, 0);
    await assert.rejects(runtime.trust({...input(), schemaHash: 'a'.repeat(64), tools: ['lookup_lesson']}));
    view = await runtime.trust({...input(), schemaHash: view.servers[0].schemaHash, tools: ['unknown_effect']});
    const selected = await runtime.tools(); assert.equal(selected.definitions.length, 1); await selected.dispose();
  });
  await check('CAS rejects stale writes; service-declared reads still need teacher selection', async () => { const stale = input(); view = await runtime.trust({ ...input(), schemaHash: view.servers[0].schemaHash, tools: ['lookup_lesson'] }); await assert.rejects(runtime.revoke(stale), /conflict/); handle = await runtime.tools(); assert.equal(handle.definitions.length, 1); });
  await check('Real HTTP tools/call and Hana execution-once preserve tool definition', async () => { const scope = createHanaRunToolScope(handle.definitions), n = fixture.state.calls; const result = await call(scope[0]); assert.equal(result.details.success, true); assert.match(result.content[0].text, /勾股定理/); await call(scope[0]); assert.equal(fixture.state.calls, n + 1); });
  await check('Exact MCP manifests conservatively classify external effects with one attempt', async () => {
    assert.throws(() => toolManifest('mcp_fake'), /missing/); assert.throws(() => manifestForTools(handle.definitions), /missing/);
    const manifests = manifestForTools(handle.definitions, new Set(handle.definitions.map(tool => tool.name)));
    assert.equal(manifests[0].effect, 'external_effect'); assert.equal(manifests[0].maxAttempts, 1);
  });
  await check('Generated MCP identity is accepted by durable attempt contract, arbitrary prefix is rejected', async () => { const attempt = { schemaVersion: 1, callId: 'owned_call', tool: handle.definitions[0].name, attempt: 1, maxAttempts: 1, state: 'succeeded', effect: 'none' }; assert(validToolAttempt(attempt)); assert(!validToolAttempt({ ...attempt, tool: 'mcp_fake-123' })); });
  await check('SDK rejects invalid and undeclared args; sensitive args cannot leave host', async () => { const n = fixture.state.calls; assert.equal((await call(handle.definitions[0], '')).isError, true); assert.equal((await call(handle.definitions[0], 'PRIVATE_STUDENT')).details.error.code, 'permission_denied'); assert.equal((await handle.definitions[0].execute('invalid', { topic: '课程', extra: true })).isError, true); assert.equal(fixture.state.calls, n); });
  await check('Remote tool error remains failure; credentials are removed from text', async () => { fixture.state.toolError = true; fixture.state.secret = credential; const result = await call(handle.definitions[0]); assert.equal(result.isError, true); assert.equal(result.details.error.code, 'service_error'); assert(!JSON.stringify(result).includes(credential)); fixture.state.toolError = false; });
  await check('Protocol error never exposes raw remote error or credential', async () => { fixture.state.protocolError = true; const result = await call(handle.definitions[0]); assert.equal(result.isError, true); assert(!JSON.stringify(result).includes('Private raw')); assert(!JSON.stringify(result).includes(credential)); fixture.state.protocolError = false; });
  await check('Timeout and pre-cancel settle as failures', async () => { fixture.state.hang = true; assert.equal((await call(handle.definitions[0])).details.error.code, 'timeout'); fixture.state.hang = false; const abort = new AbortController(); abort.abort(); const n = fixture.state.calls; assert.equal((await call(handle.definitions[0], '课程', abort.signal)).details.error.code, 'cancelled'); assert.equal(fixture.state.calls, n); });
  await check('Concurrent calls share a process-wide server write lock until actual request settles', async () => {
    const before = fixture.state.calls; fixture.state.hang = true;
    const first = call(handle.definitions[0], 'first');
    const deadline = Date.now() + 1000;
    while (fixture.state.calls === before && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 5));
    assert.equal(fixture.state.calls, before + 1);
    assert.equal((await call(handle.definitions[0], 'second')).details.error.code, 'resource_busy');
    assert.equal(fixture.state.calls, before + 1);
    assert.equal((await first).details.error.code, 'timeout'); fixture.state.hang = false;
  });
  await check('Revocation blocks already registered definitions before dispatch', async () => { view = await runtime.revoke(input()); const n = fixture.state.calls; assert.equal((await call(handle.definitions[0])).details.error.code, 'permission_denied'); assert.equal(fixture.state.calls, n); await handle.dispose(); });
  await check('Schema change during an open session revokes trust and does not call changed tool', async () => { await trust(); handle = await runtime.tools(); fixture.state.tools[0].inputSchema.properties.topic.maxLength = 90; const n = fixture.state.calls; assert.equal((await call(handle.definitions[0])).details.error.code, 'permission_denied'); view = await runtime.catalog(); assert.equal(view.servers[0].status, 'schema_changed'); assert.equal(view.servers[0].trustedSchemaHash, undefined); assert.equal(fixture.state.calls, n); await handle.dispose(); });
  await check('Re-inspect/retrust new schema works; cold runtime reads persisted authority', async () => { await trust(); const cold = createMcpRuntime(sql, codec, { timeoutMs: 200 }); const coldView = await cold.catalog(); assert.equal(coldView.servers[0].trustedSchemaHash, view.servers[0].trustedSchemaHash); const tools = await cold.tools(); assert.equal(tools.definitions.length, 1); assert.equal((await call(tools.definitions[0])).details.success, true); await cold.dispose(); });
  await check('Authentication failure is public and leaves built-in initialization usable', async () => { fixture.state.auth = 'different'; const tools = await runtime.tools(); assert.equal(tools.definitions.length, 0); view = await runtime.catalog(); assert.equal(view.servers[0].lastError, 'authentication'); assert.equal(view.servers[0].trustedSchemaHash, undefined); await tools.dispose(); fixture.state.auth = ''; });
  await check('Recursive schema rejects refs/prototype keys/deep/unknown keywords', async () => { for (const prop of [{ $ref: 'https://example.invalid' }, { type: 'string', pattern: '(a+)+' }, { type: 'object', properties: JSON.parse('{"__proto__":{"type":"string"}}') }]) assert.equal(validMcpSchema({ type: 'object', properties: { a: prop } }), false); let deep = { type: 'string' }; for (let i = 0; i < 15; i++) deep = { type: 'object', properties: { a: deep } }; assert.equal(validMcpSchema(deep), false); });
  await check('Malformed metadata is refused and contradictory hints retain conservative external effect', async () => {
    fixture.state.tools[0].title = { private: credential }; view = await runtime.inspect(input()); assert.equal(view.servers[0].status, 'failed'); assert.equal((await runtime.tools()).definitions.length, 0);
    fixture.state.tools[0].title = '查询公开课程'; fixture.state.tools[0].annotations.destructiveHint = true;
    view = await runtime.inspect(input()); assert.equal(view.servers[0].tools[0].readOnly, false);
    view = await runtime.trust({...input(), schemaHash: view.servers[0].schemaHash, tools: ['lookup_lesson']});
    const selected = await runtime.tools();
    const manifest = manifestForTools(selected.definitions, new Set(selected.definitions.map(tool => tool.name)));
    assert.equal(manifest[0].effect, 'external_effect'); await selected.dispose();
    delete fixture.state.tools[0].annotations.destructiveHint;
    view = await runtime.inspect(input()); await trust();
  });
  await check('Credential echoed in remote tool identity is never published by inspection', async () => {
    fixture.state.tools[0].name = credential; view = await runtime.inspect(input()); assert.equal(view.servers[0].status, 'failed'); assert(!JSON.stringify(view).includes(credential));
    fixture.state.tools[0].name = 'lookup_lesson'; await trust();
  });
  await check('Connection loss yields a failed receipt and later reconnection can recover', async () => {
    handle = await runtime.tools(); fixture.state.drop = true; assert.equal((await call(handle.definitions[0])).isError, true);
    fixture.state.drop = false; await handle.dispose(); handle = await runtime.tools(); assert.equal((await call(handle.definitions[0])).details.success, true); await handle.dispose();
  });
  await check('Endless pagination is bounded and failed catalog cannot invoke any tools', async () => {
    fixture.state.endless = true; const before = fixture.state.requests; view = await runtime.inspect(input()); assert.equal(view.servers[0].status, 'failed'); assert(fixture.state.requests - before <= 9); fixture.state.endless = false; await trust();
  });
  await check('HTTP URLs reject credentials/query/redirect schemes and unsupported local protocols', async () => { for (const url of ['https://a:b@example.com/mcp', 'https://example.com/mcp?token=private', 'http://example.com/mcp', 'ftp://localhost/mcp']) await assert.rejects(runtime.add({ name: '拒绝', transport: 'http', url })); });
  await check('Safe IPC wraps success/failure and denies non-main callers', async () => { const error = await mcpResult(() => Promise.reject(Error('private ' + credential))); assert.deepEqual(error, { ok: false, error: 'configuration' }); const handlers = new Map(); registerMcpIpc({ ipcMain: { handle: (name, fn) => handlers.set(name, fn) }, allowed: () => false, host: { mcpCatalog: () => assert.fail() } }); assert.equal((await handlers.get('xiaozhi:mcp-catalog')({})).error, 'permission_denied'); });
  await check('Stdio configuration persists with typed unsupported constraint until controlled transport ships', async () => {
    view = await runtime.add({name: '本地课程', transport: 'stdio', command: process.execPath,
      args: [path.resolve('scripts/xiaozhi-agent/fixtures/mcp-server.mjs')]});
    const local = view.servers.find(server => server.name === '本地课程');
    view = await runtime.inspect({...input(), serverId: local.id});
    const inspected = view.servers.find(server => server.id === local.id);
    assert.equal(inspected.status, 'failed'); assert.equal(inspected.lastError, 'unsupported_constraint');
    assert.equal(inspected.transport, 'stdio');
  });
  await check('Unavailable stdio leaves an independently trusted HTTP server available', async () => {
    await trust(); const tools = await runtime.tools(); assert.equal(tools.definitions.length, 1);
    assert.match(tools.definitions[0].description, /课程资料/);
    assert.equal((await call(tools.definitions[0])).details.success, true); await tools.dispose(); view = await runtime.catalog();
  });
  await check('Replacement address never inherits the old server identity or trust', async () => {
    await trust(); handle = await runtime.tools(); const old = view.servers[0].id, oldDefinition = handle.definitions.find(t => t.description.includes('课程资料'));
    view = await runtime.remove(input()); view = await runtime.add({ name: '课程资料', transport: 'http', url: fixture.url.replace('/mcp', '/replacement') });
    const replacement = view.servers.find(s => s.name === '课程资料'); assert.notEqual(replacement.id, old); assert.equal(replacement.status, 'unverified'); assert.equal(replacement.trustedSchemaHash, undefined);
    const before = fixture.state.calls; assert.equal((await call(oldDefinition)).details.error.code, 'permission_denied'); assert.equal(fixture.state.calls, before); await handle.dispose();
  });
  await check('Multiple offline services share an admission deadline rather than consuming Pi preparation time each', async () => {
    const copy = new DatabaseSync(':memory:'); copy.exec('CREATE TABLE app_settings(key TEXT PRIMARY KEY,value_json TEXT NOT NULL,updated_at TEXT NOT NULL)');
    const privateState = JSON.parse(db.prepare('SELECT value_json FROM app_settings').get().value_json);
    const template = privateState.servers.find(server => server.transport === 'http');
    const hash = createHash('sha256').update(canonicalMcp([...fixture.state.tools].sort((a, b) => a.name.localeCompare(b.name)))).digest('hex');
    template.schemaHash = hash;
    privateState.servers = Array.from({ length: 3 }, (_, n) => ({ id: `mcp_00000000-0000-4000-8000-00000000000${n}`, name: `慢服务${n}`, transport: 'http', url: fixture.url, revision: 1, status: 'ready', schemaHash: template.schemaHash, trustedSchemaHash: template.schemaHash, tools: template.tools, selectedTools: ['lookup_lesson'] }));
    copy.prepare('INSERT INTO app_settings VALUES(?,?,?)').run('xiaozhi.mcp.v1', JSON.stringify(privateState), new Date().toISOString());
    const slow = createMcpRuntime({ all: async (q, v=[]) => copy.prepare(q).all(...v), change: async (q,v=[]) => Number(copy.prepare(q).run(...v).changes) }, codec, { timeoutMs: 1000, preparationTimeoutMs: 60 });
    fixture.state.hangInitialize = true; const started = performance.now();
    try { const result = await slow.tools(); assert.equal(result.definitions.length, 0); assert(performance.now() - started < 700); assert((await slow.catalog()).servers.every(s => s.status === 'failed' && s.lastError === 'timeout')); await result.dispose(); }
    finally { fixture.state.hangInitialize = false; await slow.dispose(); copy.close(); }
  });
  await check('Failed Pi assembly releases its MCP handles', async () => {
    const { createPiXiaozhiSession } = await import('../../src/main/xiaozhi-agent/pi-session.ts'); let disposed = 0;
    await assert.rejects(createPiXiaozhiSession({ stateRoot: 'not-absolute', workspace: output, apiKey: 'owned-test', model: 'owned-model', mcpDispose: async () => { disposed++; } })); assert.equal(disposed, 1);
  });
  await check('Removal persists and corrupt external settings fail closed without claiming ready', async () => { view = await runtime.catalog(); const server = view.servers.find(s => s.name === '课程资料'); view = await runtime.remove({ ...input(), serverId: server.id }); assert.equal(view.servers.length, 1); db.prepare('UPDATE app_settings SET value_json=?').run('{"schemaVersion":9}'); await assert.rejects(runtime.catalog(), /configuration/); assert.equal((await runtime.tools()).definitions.length, 0); });
  report.success = true;
} catch (e) { report.error = String(e.stack || e).replaceAll(credential, '[redacted]'); process.exitCode = 1; }
finally { await runtime.dispose(); await fixture.close(); db.close(); fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify({ success: report.success, checks: report.checks.length, output, error: report.error })); }
