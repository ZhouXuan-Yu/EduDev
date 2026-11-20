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
const {permissionTemporaryRoot, projectionTemporaryRoot} = await import('../../src/main/xiaozhi-agent/permissions/windows/temporary.ts');
const {checkCompiledPermissionRuntime} = await import('../../src/main/xiaozhi-agent/permissions/windows/runtime-health.ts');
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
  await check('Managed cleanup works when the former TEMP is missing and legacy cannot admit a fresh execution', async () => {
    const current = permissionTemporaryRoot();
    const legacyRoot = path.join(root, 'legacy-temp');
    fs.mkdirSync(legacyRoot);
    const outside = fs.realpathSync(legacyRoot);
    const managed = path.join(current, 'xiaozhi-permission-exec-' + randomUUID());
    const legacy = path.join(outside, 'xiaozhi-permission-exec-' + randomUUID());
    const original = {TEMP:process.env.TEMP, TMP:process.env.TMP};
    fs.mkdirSync(managed);
    fs.mkdirSync(legacy);
    try {
      process.env.TEMP = outside;
      process.env.TMP = outside;
      assert.equal(projectionTemporaryRoot(legacy, true), outside);
      assert.throws(() => projectionTemporaryRoot(legacy), /invalid_projection/);
      process.env.TEMP = path.join(root, 'not-created-legacy-temp');
      process.env.TMP = path.join(root, 'not-created-other-temp');
      assert.equal(projectionTemporaryRoot(managed, true), current);
      assert.throws(() => projectionTemporaryRoot(legacy, true), /invalid_projection/);
      assert(!fs.existsSync(process.env.TEMP) && !fs.existsSync(process.env.TMP));
    } finally {
      for (const [name, value] of Object.entries(original)) {
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
      }
      fs.rmdirSync(managed);
      fs.rmdirSync(legacy);
    }
  });
  await check('Only a cleaned pre-start health failure gets one fresh probe under the current grant', async () => {
    const selected = await manager.readVersion(version);
    const reference = {manifest: selected.manifest, directory: selected.directory, runtime: selected.manifest.runtimes[0], version};
    const calls = [], audits = [];
    let assertions = 0;
    const authority = {request, signal: new AbortController().signal, decision: {permissionSnapshotHash: 'a'.repeat(64)},
      assert: async () => {assertions++;}};
    const auditStore = {audit: async (_session, _kind, _version, data) => {audits.push(data);}};
    const run = (started, healthy) => async ({start, onData}) => {
      const previous = calls.at(-1);
      if (previous) assert(!fs.existsSync(previous.projectionRoot));
      calls.push(start);
      const ready = calls.length === 2 && healthy;
      if (ready) onData(Buffer.from('XIAOZHI_SANDBOX_READY'));
      const result = {schemaVersion: 1, type: 'result', executionId: start.executionId, state: ready ? 'completed' : 'failed',
        exitCode: ready ? 0 : null, truncated: false, durationMs: 1,
        cleanup: {jobActiveProcesses: 0, profileRemoved: true, remainingOwnedAces: 0}, ...(!ready && {error: 'launch_failed'})};
      return {result, helperHash: selected.manifest.helperSha256, outputBytes: 0, started: ready || started};
    };
    const options = {...reference, authority, store: auditStore};
    await checkCompiledPermissionRuntime(options, run(false, true));
    assert.deepEqual(audits.map(({attempt, ready, started}) => [attempt, ready, started]), [[1, false, false], [2, true, true]]);
    assert.equal(assertions, 2);
    assert.notEqual(calls[0].executionId, calls[1].executionId);
    assert.notEqual(calls[0].projectionRoot, calls[1].projectionRoot);
    assert(calls.every(call => call.command === 'Write-Output XIAOZHI_SANDBOX_READY' && !fs.existsSync(call.projectionRoot)));
    calls.length = 0;
    await assert.rejects(checkCompiledPermissionRuntime(options, run(true, false)), /configuration/);
    assert.equal(calls.length, 1);
    calls.length = 0;
    await assert.rejects(checkCompiledPermissionRuntime(options, run(false, false)), /configuration/);
    assert.equal(calls.length, 2);
  });
  report.success = true;
} catch (error) {report.error = error.stack; process.exitCode = 1; console.error(error);}
finally {db.close(); fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify({success: report.success, passed: checks.length, output, root, error: report.error}));}
