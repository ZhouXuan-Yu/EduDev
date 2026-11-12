import '../office-agent/register-source.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {build} from 'esbuild';
const {createPermissionStore} = await import('../../src/main/xiaozhi-agent/permissions/store.ts');
const {createPermissionEngine} = await import('../../src/main/xiaozhi-agent/permissions/engine.ts');
const {permissionHash} = await import('../../src/main/xiaozhi-agent/permissions/validation.ts');
const {runWithPermission} = await import('../../src/main/xiaozhi-agent/permissions/current.ts');
const output = fs.mkdtempSync(path.resolve('test-results/xiaozhi-agent/permission-phase3-runtime-'));
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'xiaozhi-phase3-runtime-'));
const modulePath = path.join(output, 'runtime.mjs');
await build({entryPoints: ['src/main/xiaozhi-agent/permissions/windows/runtime.ts'], outfile: modulePath,
  bundle: true, platform: 'node', format: 'esm', target: 'node24', packages: 'external', plugins: [{name: 'obsolete-shipped-pin-fixture', setup(plugin) {
    plugin.onLoad({filter: /sandbox-manifest\.json$/}, args => {
      const manifest = JSON.parse(fs.readFileSync(args.path, 'utf8'));
      // Only metadata simulates an obsolete shipped runtime pin. Diagnosis,
      // compiler, exact executable hashes, AppContainer health and CAS are real.
      manifest.runtimes = manifest.runtimes.map(pin => ({...pin, sha256: '0'.repeat(64)}));
      return {contents: JSON.stringify(manifest), loader: 'json'};
    });
  }}]});
const {createPermissionRuntimeManager} = await import(pathToFileURL(modulePath).href);
const db = new DatabaseSync(path.join(root, 'authority.sqlite'));
db.exec('CREATE TABLE ai_confirmation_items(id TEXT PRIMARY KEY,run_id TEXT,session_id TEXT,action_type TEXT,status TEXT,title TEXT,description TEXT,preview_md TEXT,payload_json TEXT,created_at TEXT,updated_at TEXT)');
const sql = {all: async (query, values = []) => db.prepare(query).all(...values),
  run: async (query, values = []) => {db.prepare(query).run(...values);},
  change: async (query, values = []) => Number(db.prepare(query).run(...values).changes)};
sql.transaction = async work => {db.exec('BEGIN IMMEDIATE'); try {const value = await work(sql); db.exec('COMMIT'); return value;} catch (error) {db.exec('ROLLBACK'); throw error;}};
const store = createPermissionStore(sql); await store.migrate();
const owner = {sessionId: 'aisession_' + randomUUID(), taskId: 'xitask_' + 'c'.repeat(64), runId: 'run_runtime_recipe', generation: 1};
const runtimeRoot = path.join(root, 'runtime');
const manager = createPermissionRuntimeManager({root: runtimeRoot, store});
const scope = manager.recipe(); await store.issue(owner.sessionId, [scope], {kind: 'teacher', reference: 'fixed-recipe-fixture'});
const engine = createPermissionEngine({store, current: () => true});
const request = {schemaVersion: 2, owner, requirementsVersion: 1, callId: 'runtime_recipe', action: 'environment_repair', inputDigest: permissionHash(scope),
  purpose: '固定源码受控运行时配置', scopes: [scope], files: [], provider: null, classification: 'redacted', expiresAt: new Date(Date.now() + 120000).toISOString()};
const execute = action => engine.run(request, new AbortController().signal, context => runWithPermission({request, ...context}, () => action({request, ...context})));
const checks = [];
const report = {success: false, root, output, checks,
  boundary: 'Simulated obsolete shipped pin metadata only. Native Microsoft offline platform diagnosis, fixed Framework compiler/source recipe, actual helper bytes, AppContainer health and cold receipt authority are real. OS patch and cross-machine installation remain Phase8.'};
async function check(name, action) {const started = performance.now(); await action(); checks.push({name, pass: true, durationMs: performance.now() - started}); console.log('PASS ' + name);}
try {
  let version;
  await check('Obsolete pin configures a real fixed-source helper and activates only after actual AppContainer health', async () => {
    assert.equal((await manager.inspect()).status, 'needs_configuration');
    const selected = await execute(authority => manager.prepare(authority, scope.sha256));
    assert(selected.changed); version = selected.runtime.version;
    assert.equal((await manager.inspect()).status, 'ready');
    assert.notEqual(selected.runtime.manifest.runtimes[0].sha256, '0'.repeat(64));
    assert.equal(fs.statSync(path.join(selected.runtime.directory, 'xiaozhi-sandbox.exe')).size, selected.runtime.manifest.helperBytes);
    report.helperHash = selected.runtime.manifest.helperSha256;
  });
  await check('Cold main reads exact managed identity and unchanged prepare reuses verified bytes', async () => {
    const cold = createPermissionRuntimeManager({root: runtimeRoot, store});
    assert.equal((await cold.inspect()).status, 'ready');
    assert.equal((await cold.readVersion(version)).manifest.helperSha256, report.helperHash);
    const reused = await execute(authority => cold.prepare(authority, scope.sha256));
    assert.equal(reused.changed, false); assert.equal(reused.runtime.manifest.helperSha256, report.helperHash);
    assert.equal((await sql.all("SELECT count(*) AS n FROM xiaozhi_permission_audit_v1 WHERE kind='permission_runtime_build_intent'"))[0].n, 1);
  });
  await check('Wrong source recipe refuses configuration and retains previous active pointer', async () => {
    const pointer = path.join(runtimeRoot, 'active.json'); const before = fs.readFileSync(pointer);
    await assert.rejects(execute(authority => manager.prepare(authority, '0'.repeat(64))), /permission_denied/);
    assert.deepEqual(fs.readFileSync(pointer), before);
  });
  report.success = true;
} catch (error) {report.error = error.stack; process.exitCode = 1; console.error(error);}
finally {db.close(); fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify({success: report.success, passed: checks.length, output, root, error: report.error}));}
