import fs from 'node:fs';
import io from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash, randomUUID} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {build} from 'esbuild';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'xiaozhi-phase5-extension-package-'));
const output = path.join(root, 'evidence'); fs.mkdirSync(output);
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const sources = ['src/main/xiaozhi-agent/extensions/package-manager.ts', 'src/main/xiaozhi-agent/extensions/package-worker.ts',
  'scripts/xiaozhi-agent/phase5-extension-package-smoke.mjs'];
const report = {success: false, root, output, paidCalls: 0, checks: [], fetches: [],
  sources: sources.map(filename => ({path: filename, sha256: digest(fs.readFileSync(filename))}))};
const save = () => fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
await build({stdin: {contents: `export {createExtensionPackageManager} from './src/main/xiaozhi-agent/extensions/package-manager.ts';
export {createExtensionService} from './src/main/xiaozhi-agent/extensions/service.ts';
export {createPermissionStore} from './src/main/xiaozhi-agent/permissions/store.ts';
export {createPermissionService} from './src/main/xiaozhi-agent/permissions/service.ts';
export {createPermissionRuntimeManager} from './src/main/xiaozhi-agent/permissions/windows/runtime.ts';
export {serializeStateWrites} from './src/main/xiaozhi-agent/serialized-state-sql.ts';
export {permissionHash} from './src/main/xiaozhi-agent/permissions/validation.ts';
export {NODE_RECIPE} from './src/main/xiaozhi-agent/capabilities/acquisition/recipes.ts';`, resolveDir: process.cwd(), loader: 'ts'},
  outfile: path.join(output, 'package.mjs'), bundle: true, platform: 'node', format: 'esm', packages: 'external', target: 'node24',
  plugins: [{name: 'installed-dependencies', setup(builder) {
    builder.onResolve({filter: /^(?:@[^/]+\/[^/]+|[a-zA-Z][\w-]*)(?:\/.*)?$/}, args => ({path: import.meta.resolve(args.path), external: true}));
  }}]});
const api = await import(pathToFileURL(path.join(output, 'package.mjs')).href);
const db = new DatabaseSync(path.join(root, 'authority.sqlite'));
db.exec('CREATE TABLE app_settings(key TEXT PRIMARY KEY,value_json TEXT,updated_at TEXT)');
db.exec('CREATE TABLE ai_confirmation_items(id TEXT PRIMARY KEY,run_id TEXT,session_id TEXT,action_type TEXT,status TEXT,title TEXT,description TEXT,preview_md TEXT,payload_json TEXT,created_at TEXT,updated_at TEXT)');
const rawSql = {
  all: async (query, values = []) => db.prepare(query).all(...values),
  run: async (query, values = []) => {db.prepare(query).run(...values);},
  change: async (query, values = []) => Number(db.prepare(query).run(...values).changes),
};
rawSql.transaction = async action => {
  db.exec('BEGIN IMMEDIATE');
  try {const result = await action(rawSql); db.exec('COMMIT'); return result;}
  catch (error) {db.exec('ROLLBACK'); throw error;}
};
const sql = api.serializeStateWrites(rawSql);
const store = api.createPermissionStore(sql); await store.migrate();
const owner = {sessionId: 'aisession_' + randomUUID(), taskId: 'xitask_' + digest(root), runId: 'run_extension_package', generation: 1};
const workspace = path.join(root, 'empty-hook-workspace'); fs.mkdirSync(workspace);
const packageRoot = path.join(root, 'managed-extension-packages');
const runtime = api.createPermissionRuntimeManager({root: path.join(root, 'runtime'), store});
let packages;
const permissions = api.createPermissionService({store, dataRoot: path.join(root, 'data'), owner: () => owner,
  archived: async () => false, workspace: async () => ({path: workspace}), verifyProcess: scope => packages.verifyProcess(scope)});
const nodeLicensePath = 'C:/Users/ZhouXuan/AppData/Local/Temp/xiaozhi-phase5-production-grcqce/data/managed-tools/capabilities/versions/e9fe9851ff24b2479da1900ff81c2be5363e3186b6efccecfaa2d14473b4a2f6/NODE-LICENSE.txt';
const nodeLicense = fs.readFileSync(nodeLicensePath);
assert.equal(digest(nodeLicense), api.NODE_RECIPE.licenseHash);
let fetchBehavior = async () => nodeLicense;
const fetcher = async (url, signal, maximumBytes, accept) => {
  signal.throwIfAborted();
  assert.equal(url, api.NODE_RECIPE.licenseUrl, 'fixed local Node should avoid binary download and internal identities must never be fetched');
  report.fetches.push({url, maximumBytes, accept, source: 'previously verified official license cache'});
  return fetchBehavior(signal);
};
const managerOptions = {sql, permissions, root: packageRoot, fetcher, localNode: () => 'D:/Node/node.exe'};
packages = api.createExtensionPackageManager(managerOptions);
const service = api.createExtensionService({sql, permissions, store, runtime, binding: manifest => packages.binding(manifest)});
const controller = new AbortController();
const authorityRecords = [];
const context = {owner: () => owner, signal: controller.signal, workspace, requirementsVersion: () => 1,
  recordAuthority: async (reference, refs) => authorityRecords.push({reference, refs})};
const marker = path.join(root, 'main-entry-must-never-execute.txt');
const entry = `import fs from 'node:fs';
try { fs.writeFileSync(${JSON.stringify(marker)}, 'external-entry-executed'); } catch {}
export function contextTransform(payload) { return {text: payload.text.toUpperCase(), guest: true}; }
export function observeEvent(payload) { if (payload.type !== 'turn.complete') throw Error('synthetic'); }
`;
async function fixture(name, changes = {}) {
  const directory = path.join(root, name); await io.mkdir(directory);
  const metadata = {schemaVersion: 1, extensionId: 'owned.packaged', version: '1.0.0', entry: 'entry.mjs',
    hooks: ['context.transform', 'event.observe'], license: 'LicenseRef-Teacher-Review', ...changes};
  await io.writeFile(path.join(directory, 'edudev.extension.json'), JSON.stringify(metadata));
  await io.writeFile(path.join(directory, 'LICENSE'), 'Owned synthetic package license. Teacher review is required.\n');
  await io.writeFile(path.join(directory, 'entry.mjs'), entry);
  return directory;
}
async function approvePending() {
  for (const approval of (await store.approvals(owner.sessionId)).filter(item => item.state === 'pending')) {
    await permissions.decide({sessionId: owner.sessionId, approvalId: approval.id, revision: approval.revision, decision: 'approve', scope: 'task'});
  }
}
async function idle() {
  for (let index = 0; index < 100 && permissions.engine.activeCount(); index++) await new Promise(resolve => setTimeout(resolve, 50));
  assert.equal(permissions.engine.activeCount(), 0);
}
async function check(name, action) {
  const started = performance.now();
  await action();
  report.checks.push({name, pass: true, durationMs: performance.now() - started});
  save(); console.log('PASS ' + name);
}
let candidate;
let prepared;
try {
  await check('Main-picked static import records real local provenance and exact LICENSE without executing entry', async () => {
    const selected = await fixture('picked-v1');
    candidate = await packages.importCandidate(selected);
    assert.equal(candidate.phase, 'quarantined');
    assert.equal(candidate.provenance.kind, 'local_import'); assert.equal(candidate.provenance.trust, 'unknown');
    assert.equal(candidate.provenance.pickedPath, selected); assert.equal(candidate.manifest.source, 'edudev-local://extensions/owned.packaged');
    assert.equal(candidate.manifest.licenseHash, digest(fs.readFileSync(path.join(selected, 'LICENSE'))));
    assert.equal(fs.existsSync(marker), false); assert.equal(report.fetches.length, 0);
    assert.equal((await packages.importCandidate(selected)).artifactId, candidate.artifactId);
  });
  await check('Static package schema rejects traversal, unknown hooks, extra publisher claims and missing LICENSE', async () => {
    await assert.rejects(packages.importCandidate(''), /invalid_input/);
    for (const [name, changes] of [['escape', {entry: '../entry.mjs'}], ['hook', {hooks: ['tool.register']}],
      ['publisher', {publisher: 'official'}], ['extension', {entry: 'entry.exe'}]]) {
      await assert.rejects(packages.importCandidate(await fixture('invalid-' + name, changes)), /invalid_package/);
    }
    const missing = await fixture('invalid-license'); await io.unlink(path.join(missing, 'LICENSE'));
    await assert.rejects(packages.importCandidate(missing), /invalid_package/);
  });
  await check('Static scan rejects hardlinks, directory junctions and oversized source files', async () => {
    const linked = await fixture('invalid-hardlink'); await io.link(path.join(linked, 'entry.mjs'), path.join(linked, 'hardlink.mjs'));
    await assert.rejects(packages.importCandidate(linked), /source_changed|skill_source_changed/);
    const junction = await fixture('invalid-junction'); await io.symlink(path.join(root, 'picked-v1'), path.join(junction, 'outside'), 'junction');
    await assert.rejects(packages.importCandidate(junction), /source_changed|skill_source_changed/);
    const oversized = await fixture('invalid-large'); const handle = await io.open(path.join(oversized, 'large.bin'), 'wx');
    await handle.truncate(32 * 1048576 + 1); await handle.close();
    await assert.rejects(packages.importCandidate(oversized), /resource_budget/);
  });
  await check('Import A/B race cannot substitute different entry bytes after the source snapshot', async () => {
    const selected = await fixture('race-source');
    let changed = false;
    const watcher = fs.watch(path.join(packageRoot, 'quarantine'), (_event, filename) => {
      if (!changed && String(filename).startsWith('.import-')) {changed = true; fs.appendFileSync(path.join(selected, 'entry.mjs'), '\n// B bytes after snapshot');}
    });
    try {await assert.rejects(packages.importCandidate(selected), /source_changed|skill_source_changed/); assert.equal(changed, true);}
    finally {watcher.close();}
    assert.equal(fs.existsSync(marker), false);
  });
  await check('Unknown source and license require exact original scopes before Node preparation I/O', async () => {
    const teacherDirectory = path.join(root, 'synthetic-teacher-directory');
    await io.mkdir(teacherDirectory); await io.writeFile(path.join(teacherDirectory, 'teacher-private.txt'), 'synthetic-only');
    await assert.rejects(packages.prepare(candidate.artifactId, {...context, workspace: teacherDirectory}), /extension_workspace_not_empty/);
    await assert.rejects(packages.prepare(candidate.artifactId, context), /permission_pending/);
    assert.equal(report.fetches.length, 0); assert.equal(fs.existsSync(marker), false);
    const approval = (await store.approvals(owner.sessionId)).find(item => item.state === 'pending');
    assert(approval.request.scopes.some(scope => scope.kind === 'extension' && scope.sourceHash === candidate.manifest.sourceHash));
    assert(approval.request.scopes.some(scope => scope.kind === 'process' && scope.executableHash === api.NODE_RECIPE.sha256));
    assert(approval.request.scopes.some(scope => scope.kind === 'dependency' && scope.source === 'edudev-local://extensions'));
    assert(!approval.request.scopes.some(scope => scope.kind === 'network' && scope.origin.startsWith('edudev-local:')));
    await approvePending(); await idle();
  });
  await check('Cancelled Node preparation leaves no binding or owned attempt stage and can retry', async () => {
    const cancel = new AbortController();
    fetchBehavior = async signal => {cancel.abort('owned-cancel'); signal.throwIfAborted(); return nodeLicense;};
    await assert.rejects(packages.prepare(candidate.artifactId, {...context, signal: cancel.signal}));
    const record = (await packages.list()).find(item => item.artifactId === candidate.artifactId);
    assert.equal(record.phase, 'cancelled'); assert.equal(record.binding, null);
    assert.equal((await io.readdir(path.join(packageRoot, 'versions'))).some(name => name.startsWith('.prepare-')), false);
    await assert.rejects(packages.binding(candidate.manifest), /extension_package_unavailable/);
    fetchBehavior = async () => nodeLicense;
    prepared = await packages.prepare(candidate.artifactId, context);
    assert.equal(prepared.phase, 'prepared'); assert.equal(prepared.provenance.trust, 'unknown');
    assert(authorityRecords.length >= 2); await idle();
  });
  await check('Prepared immutable package survives source-directory edits and manager reconstruction', async () => {
    fs.appendFileSync(path.join(candidate.provenance.pickedPath, 'entry.mjs'), '\n// local author edited after quarantine');
    const restored = api.createExtensionPackageManager(managerOptions);
    const binding = await restored.binding(candidate.manifest);
    assert.equal(binding.packageHash, candidate.artifactId); assert.equal(binding.source, 'edudev-local://extensions');
    assert.equal(binding.executable.sha256, api.NODE_RECIPE.sha256); assert.equal(await restored.verifyProcess({kind: 'process', backend: 'appcontainer',
      executable: binding.executable.path, executableHash: binding.executable.sha256, workspace}), true);
    assert.equal((await restored.list()).find(item => item.artifactId === candidate.artifactId).manifest.sourceHash, candidate.manifest.sourceHash);
  });
  await check('Concurrent manager cannot steal an active persisted attempt or overwrite its CAS metadata', async () => {
    const next = await packages.importCandidate(await fixture('picked-v2', {version: '2.0.0'}));
    await assert.rejects(packages.prepare(next.artifactId, context), /permission_pending/); await approvePending();
    let release; let waiting;
    const entered = new Promise(resolve => {waiting = resolve;});
    fetchBehavior = async () => {waiting(); return new Promise(resolve => {release = () => resolve(nodeLicense);});};
    const pending = packages.prepare(next.artifactId, context); await entered;
    const other = api.createExtensionPackageManager(managerOptions);
    const before = (await other.list()).find(item => item.artifactId === next.artifactId);
    await assert.rejects(other.prepare(next.artifactId, context), /resource_busy/);
    assert.deepEqual((await other.list()).find(item => item.artifactId === next.artifactId), before);
    release(); await pending; fetchBehavior = async () => nodeLicense; await idle();
  });
  await check('Actual AppContainer bootstrap imports the package and maps both frozen hook exports', async () => {
    const recipe = runtime.recipe(); await store.issue(owner.sessionId, [recipe], {kind: 'teacher', reference: 'owned-package-runtime'});
    const request = {schemaVersion: 2, owner, requirementsVersion: 1, callId: 'package_runtime', action: 'environment_repair', inputDigest: api.permissionHash(recipe),
      purpose: '合成本地扩展受控运行时', scopes: [recipe], files: [], provider: null, classification: 'redacted', expiresAt: new Date(Date.now() + 300000).toISOString()};
    const selected = await permissions.engine.run(request, context.signal, authority => runtime.prepare({request, ...authority}, recipe.sha256));
    report.helperHash = selected.runtime.manifest.helperSha256;
    let view = await service.install(candidate.manifest, 0, context);
    view = await service.select(candidate.manifest.extensionId, candidate.manifest.version, view.revision, context);
    const session = await service.open(candidate.manifest.extensionId, context);
    try {
      assert.deepEqual(await session.invoke('context.transform', {text: 'teacher 中文'}), {text: 'TEACHER 中文', guest: true});
      assert.equal(await session.invoke('event.observe', {type: 'turn.complete'}), null);
      assert.equal(fs.existsSync(marker), false, 'entry must execute only inside actual AppContainer');
    } finally {await session.close();}
    await idle();
  });
  const commonJsEntry = `const fs = require('node:fs');
try { fs.writeFileSync(${JSON.stringify(marker)}, 'external-entry-executed'); } catch {}
module.exports.contextTransform = payload => ({text: payload.text.toUpperCase(), guest: true});
module.exports.observeEvent = payload => { if (payload.type !== 'turn.complete') throw Error('synthetic'); };
`;
  const formatCases = [
    {name: 'cjs-js-without-package-json', filename: 'entry.js', source: commonJsEntry},
    {name: 'esm-mjs', filename: 'entry.mjs', source: entry},
    {name: 'commonjs-cjs', filename: 'entry.cjs', source: commonJsEntry},
    {name: 'esm-js-without-package-json', filename: 'entry.js', source: entry},
    {name: 'declared-commonjs-js', filename: 'entry.js', source: commonJsEntry, packageMetadata: {type: 'commonjs'}},
    {name: 'declared-module-js', filename: 'entry.js', source: entry, packageMetadata: {type: 'module'}},
  ];
  for (const format of formatCases) await check('Actual isolated module format ' + format.name, async () => {
    const directory = await fixture('format-' + format.name, {extensionId: 'owned.format.' + format.name, entry: format.filename});
    if (format.filename !== 'entry.mjs') await io.unlink(path.join(directory, 'entry.mjs'));
    await io.writeFile(path.join(directory, format.filename), format.source);
    if (format.packageMetadata) await io.writeFile(path.join(directory, 'package.json'), JSON.stringify(format.packageMetadata));
    const imported = await packages.importCandidate(directory);
    await assert.rejects(packages.prepare(imported.artifactId, context), /permission_pending/);
    await approvePending();
    const ready = await packages.prepare(imported.artifactId, context);
    if (format.packageMetadata) assert.deepEqual(JSON.parse(await io.readFile(path.join(ready.binding.directory, 'payload/package.json'), 'utf8')), format.packageMetadata);
    let view = await service.install(imported.manifest, 0, context);
    view = await service.select(imported.manifest.extensionId, imported.manifest.version, view.revision, context);
    const session = await service.open(imported.manifest.extensionId, context);
    try {
      assert.deepEqual(await session.invoke('context.transform', {text: 'module format 中文'}), {text: 'MODULE FORMAT 中文', guest: true});
      assert.equal(await session.invoke('event.observe', {type: 'turn.complete'}), null);
      assert.equal(fs.existsSync(marker), false);
    } finally {await session.close();}
    await idle();
  });
  await check('Prepared file drift blocks binding, process verification and guest launch', async () => {
    const filename = path.join(prepared.binding.directory, 'payload/entry.mjs'); const original = fs.readFileSync(filename);
    fs.appendFileSync(filename, '\n// prepared bytes drift');
    try {
      await assert.rejects(packages.binding(candidate.manifest), /source_changed/);
      assert.equal(await packages.verifyProcess({kind: 'process', backend: 'appcontainer', executable: prepared.binding.executable.path,
        executableHash: api.NODE_RECIPE.sha256, workspace}), false);
      await assert.rejects(service.open(candidate.manifest.extensionId, context), /source_changed/);
    } finally {fs.writeFileSync(filename, original);}
    await idle();
  });
  await check('Original Grant revocation closes idle packaged guest and prevents later execution', async () => {
    const session = await service.open(candidate.manifest.extensionId, context);
    const grant = (await store.grants(owner.sessionId)).find(item => !item.revokedAt && item.scope.kind === 'extension' && item.scope.sourceHash === candidate.manifest.sourceHash);
    await permissions.engine.revoke(owner.sessionId, grant.grantId, grant.revision); await idle();
    await assert.rejects(session.invoke('context.transform', {text: 'after revoke'}), /extension_|permission/); await session.close();
    await assert.rejects(service.open(candidate.manifest.extensionId, context), /permission_pending|permission_denied/);
    const view = await service.view(candidate.manifest.extensionId);
    await service.revoke(candidate.manifest.extensionId, candidate.manifest.version, view.revision);
    await assert.rejects(packages.binding(candidate.manifest), /permission_denied/); await idle();
  });
  await check('All actual package-native terminals clean every Job profile ACE and preserve static import boundary', async () => {
    const rows = await sql.all("SELECT metadata_json FROM xiaozhi_permission_audit_v1 WHERE kind='mcp_service_terminal'");
    report.receipts = rows.map(row => JSON.parse(row.metadata_json).result); assert(report.receipts.length >= 4);
    for (const receipt of report.receipts) {assert.equal(receipt.cleanup.jobActiveProcesses, 0); assert.equal(receipt.cleanup.profileRemoved, true); assert.equal(receipt.cleanup.remainingOwnedAces, 0);}
    assert.equal(fs.existsSync(marker), false); assert.equal(permissions.engine.activeCount(), 0);
    assert.equal(report.fetches.some(row => row.url.startsWith('edudev-local:')), false);
    report.packageBindings = (await packages.list()).filter(record => record.binding).map(record => ({artifactId: record.artifactId,
      manifest: record.manifest, files: record.binding.files, packageHash: record.binding.packageHash}));
  });
  report.success = true;
} catch (error) {report.error = error.stack; process.exitCode = 1; console.error(error);}
finally {await service.dispose(); db.close(); save(); console.log(JSON.stringify({success: report.success, passed: report.checks.length, root, output}));}
