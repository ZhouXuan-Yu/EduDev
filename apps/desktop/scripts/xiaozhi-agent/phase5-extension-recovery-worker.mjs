import fs from 'node:fs';
import io from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash, randomUUID} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {DatabaseSync} from 'node:sqlite';

const [root, bundle, pointText, mode] = process.argv.slice(2);
const point = Number(pointText);
assert(path.isAbsolute(root) && path.basename(root).startsWith('case-') && [1, 2].includes(point));
assert(['setup', 'crash', 'inspect', 'retry', 'retry-drift'].includes(mode));
const api = await import(pathToFileURL(bundle).href);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const databaseFile = path.join(root, 'authority.sqlite');
const db = new DatabaseSync(databaseFile);
if (mode === 'setup') {
  db.exec('CREATE TABLE app_settings(key TEXT PRIMARY KEY,value_json TEXT,updated_at TEXT)');
  db.exec('CREATE TABLE ai_confirmation_items(id TEXT PRIMARY KEY,run_id TEXT,session_id TEXT,action_type TEXT,status TEXT,title TEXT,description TEXT,preview_md TEXT,payload_json TEXT,created_at TEXT,updated_at TEXT)');
}
const baseSql = {
  all: async (query, values = []) => db.prepare(query).all(...values),
  run: async (query, values = []) => {db.prepare(query).run(...values);},
  change: async (query, values = []) => Number(db.prepare(query).run(...values).changes),
};
baseSql.transaction = async action => {
  db.exec('BEGIN IMMEDIATE');
  try {const value = await action(baseSql); db.exec('COMMIT'); return value;}
  catch (error) {db.exec('ROLLBACK'); throw error;}
};
let config = mode === 'setup' ? null : JSON.parse(fs.readFileSync(path.join(root, 'control.json'), 'utf8'));
let owner = config?.owner;
if (mode.startsWith('retry')) owner = {...owner, runId: mode === 'retry-drift' ? 'run_recovery_drift' : 'run_explicit_recovery', generation: mode === 'retry-drift' ? 2 : 3};
const workspace = path.join(root, 'empty-workspace');
const packageRoot = path.join(root, 'packages');
const store = api.createPermissionStore(baseSql);
if (mode === 'setup') await store.migrate();
const selection = api.createExtensionState(baseSql);
const permissions = api.createPermissionService({store, dataRoot: path.join(root, 'data'), owner: () => owner,
  archived: async () => false, workspace: async () => ({path: workspace})});
const permissionRequests = [];
const originalRun = permissions.engine.run;
permissions.engine.run = async (request, signal, action) => {
  permissionRequests.push({action: request.action, owner: request.owner, scopes: structuredClone(request.scopes)});
  return originalRun(request, signal, action);
};
let fetches = 0;
let paused = false;
let packages;
async function facts() {
  const records = await packages.list();
  const target = records.find(record => record.artifactId === config.artifactId);
  const selected = await selection.read(config.extensionId);
  const grants = await store.grants(owner.sessionId);
  const versions = path.join(packageRoot, 'versions');
  const stageNames = (await io.readdir(versions)).filter(name => name.startsWith('.prepare-')).sort();
  const stageFiles = [];
  for (const name of stageNames) stageFiles.push({name, files: await api.capabilityPackageFiles(path.join(versions, name))});
  const finalExists = fs.existsSync(path.join(versions, config.artifactId));
  const finalFiles = finalExists ? await api.capabilityPackageFiles(path.join(versions, config.artifactId)) : [];
  return {target, selected, selectionHash: api.permissionHash(selected), grants, grantHash: api.permissionHash(grants),
    stageNames, stageFiles, finalExists, finalFiles, fetches, permissionRequests, activePermissions: permissions.engine.activeCount(),
    nativeTerminals: (await baseSql.all("SELECT id FROM xiaozhi_permission_audit_v1 WHERE kind='mcp_service_terminal'")).length,
    entryExecuted: fs.existsSync(path.join(root, 'external-entry-executed.txt'))};
}
async function suspend(checkpoint) {
  assert(!paused); paused = true;
  // The interval keeps a real process alive until its exact parent terminates it.
  setInterval(() => {}, 1000);
  process.send({event: 'checkpoint', point, pid: process.pid, checkpoint});
  await new Promise(() => {});
}
const instrumentedSql = {...baseSql, transaction: async action => {
  if (mode !== 'crash') return baseSql.transaction(action);
  if (point === 1) {
    const value = await baseSql.transaction(action);
    if (!paused && value?.phase === 'preparing' && value.binding && value.artifactId === config.artifactId) {
      const checkpoint = await facts();
      assert.equal(checkpoint.target.phase, 'preparing'); assert(checkpoint.target.binding);
      assert.equal(checkpoint.finalExists, false); assert.equal(checkpoint.stageNames.length, 1);
      assert.equal(api.permissionHash(checkpoint.stageFiles[0].files), api.permissionHash(value.binding.files));
      await suspend({position: 'binding-intent-committed-before-rename', ...checkpoint});
    }
    return value;
  }
  return baseSql.transaction(async work => {
    const value = await action(work);
    if (!paused && value?.phase === 'prepared' && value.binding && value.artifactId === config.artifactId) {
      const checkpoint = await facts();
      assert.equal(checkpoint.finalExists, true); assert.equal(checkpoint.stageNames.length, 0);
      assert.equal(api.permissionHash(checkpoint.finalFiles), api.permissionHash(value.binding.files));
      await suspend({position: 'rename-completed-before-prepared-commit', transactionDocumentPhase: value.phase, ...checkpoint});
    }
    return value;
  });
}};
packages = api.createExtensionPackageManager({sql: instrumentedSql, permissions, root: packageRoot,
  localNode: () => 'D:/Node/node.exe', fetcher: async (url, signal) => {
    signal.throwIfAborted(); fetches++;
    assert.equal(url, api.NODE_RECIPE.licenseUrl, 'recovery must use only the fixed verified license cache');
    const bytes = await io.readFile(config.nodeLicense);
    assert.equal(hash(bytes), api.NODE_RECIPE.licenseHash);
    return bytes;
  }});
let result;
try {
  if (mode === 'setup') {
    await io.mkdir(workspace);
    owner = {sessionId: 'aisession_' + randomUUID(), taskId: 'xitask_' + hash(root), runId: 'run_original_preparation', generation: 1};
    const oldRoot = 'C:/Users/ZhouXuan/AppData/Local/Temp/xiaozhi-phase5-extension-package-sO3nK8';
    const oldDb = new DatabaseSync(path.join(oldRoot, 'authority.sqlite'), {readOnly: true});
    let selected; let oldRecord;
    try {
      selected = JSON.parse(oldDb.prepare('SELECT value_json FROM app_settings WHERE key=?').get('xiaozhi.extension.v1.owned.format.esm-mjs').value_json).document;
      const manifest = selected.versions.find(version => version.manifest.version === selected.activeVersion).manifest;
      oldRecord = JSON.parse(oldDb.prepare('SELECT value_json FROM app_settings WHERE key=?').get('xiaozhi.extension.package.v1.' + manifest.artifactId).value_json).document;
    } finally {oldDb.close();}
    assert.equal(selected.enabled, true); assert.equal(selected.activeVersion, '1.0.0'); assert.equal(oldRecord.phase, 'prepared');
    const oldDirectory = path.join(packageRoot, 'versions', oldRecord.artifactId);
    await io.mkdir(path.dirname(oldDirectory), {recursive: true});
    await io.cp(oldRecord.binding.directory, oldDirectory, {recursive: true, dereference: false, errorOnExist: true, force: false});
    assert.equal(api.permissionHash(await api.capabilityPackageFiles(oldDirectory)), api.permissionHash(oldRecord.binding.files));
    const quarantine = path.join(packageRoot, 'quarantine', oldRecord.artifactId);
    await io.mkdir(path.dirname(quarantine), {recursive: true});
    await io.cp(path.join(oldDirectory, 'payload'), quarantine, {recursive: true, dereference: false, errorOnExist: true, force: false});
    const transferred = {...oldRecord, revision: 1, binding: {...oldRecord.binding, directory: oldDirectory,
      executable: {...oldRecord.binding.executable, path: path.join(oldDirectory, 'node.exe')}}};
    await baseSql.run('INSERT INTO app_settings(key,value_json,updated_at) VALUES(?,?,?)',
      ['xiaozhi.extension.package.v1.' + transferred.artifactId, JSON.stringify({document: transferred, hash: api.permissionHash(transferred)}), new Date().toISOString()]);
    await selection.update(selected.extensionId, 0, () => ({...selected, revision: 1}));
    await store.issue(owner.sessionId, [
      {kind: 'extension', extensionId: selected.extensionId, sourceHash: oldRecord.manifest.sourceHash, actions: ['run']},
      {kind: 'dependency', source: 'edudev-local://extensions', package: selected.extensionId, version: '1.0.0', sha256: oldRecord.artifactId, environment: oldDirectory, installScripts: false},
      {kind: 'process', backend: 'appcontainer', executable: transferred.binding.executable.path, executableHash: api.NODE_RECIPE.sha256, workspace},
      api.filesystemScope(workspace, ['read']),
    ], {kind: 'teacher', reference: 'owned-previously-selected-version'}, owner.taskId);
    const picked = path.join(root, 'picked-v2'); await io.mkdir(picked);
    await io.writeFile(path.join(picked, 'edudev.extension.json'), JSON.stringify({schemaVersion: 1, extensionId: selected.extensionId,
      version: '2.0.0', entry: 'entry.mjs', hooks: ['context.transform', 'event.observe'], license: 'LicenseRef-Teacher-Review'}));
    await io.writeFile(path.join(picked, 'LICENSE'), 'Synthetic locally selected extension for parent-kill recovery.\n');
    await io.writeFile(path.join(picked, 'entry.mjs'), `import fs from 'node:fs';fs.writeFileSync(${JSON.stringify(path.join(root, 'external-entry-executed.txt'))},'forbidden-main-import');
export const contextTransform = value => value;export const observeEvent = () => {};`);
    const candidate = await packages.importCandidate(picked);
    config = {owner, artifactId: candidate.artifactId, manifest: candidate.manifest, extensionId: selected.extensionId,
      nodeLicense: path.join(oldDirectory, 'NODE-LICENSE.txt')};
    const context = {owner: () => owner, signal: new AbortController().signal, workspace, requirementsVersion: () => 1};
    await assert.rejects(packages.prepare(candidate.artifactId, context), /permission_pending/);
    for (const approval of (await store.approvals(owner.sessionId)).filter(value => value.state === 'pending')) {
      await permissions.decide({sessionId: owner.sessionId, approvalId: approval.id, revision: approval.revision, decision: 'approve', scope: 'task'});
    }
    const baseline = await facts();
    config.selectionHash = baseline.selectionHash; config.grantHash = baseline.grantHash;
    await io.writeFile(path.join(root, 'control.json'), JSON.stringify(config, null, 2));
    result = {baseline, config};
  } else if (mode === 'inspect') {
    result = await facts();
    assert.equal(result.fetches, 0); assert.equal(result.activePermissions, 0);
  } else {
    const context = {owner: () => owner, signal: new AbortController().signal, workspace, requirementsVersion: () => 1};
    let error;
    try {await packages.prepare(config.artifactId, context);}
    catch (failure) {error = failure instanceof Error ? failure.message : String(failure);}
    result = {error, ...(await facts())};
    if (mode === 'crash') throw Error('crash_checkpoint_not_reached');
    assert.equal(result.activePermissions, 0);
  }
  assert.equal(result.baseline?.entryExecuted ?? result.entryExecuted, false);
  fs.writeFileSync(path.join(root, mode + '.json'), JSON.stringify(result, null, 2));
  process.send({event: 'done', mode, pid: process.pid, result});
} catch (error) {
  process.send({event: 'error', mode, pid: process.pid, error: error.stack}); process.exitCode = 1;
} finally {db.close(); process.disconnect();}
