import fs from 'node:fs';
import io from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fork} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {build} from 'esbuild';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'xiaozhi-phase5-extension-recovery-'));
const bundle = path.join(root, 'api.mjs');
const worker = fileURLToPath(new URL('./phase5-extension-recovery-worker.mjs', import.meta.url));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const sourcePaths = ['scripts/xiaozhi-agent/phase5-extension-recovery-parent.mjs', 'scripts/xiaozhi-agent/phase5-extension-recovery-worker.mjs',
  'src/main/xiaozhi-agent/extensions/package-manager.ts', 'src/main/xiaozhi-agent/extensions/package-worker.ts',
  'src/main/xiaozhi-agent/extensions/state.ts', 'src/main/xiaozhi-agent/permissions/engine.ts'];
const report = {success: false, root, paidCalls: 0, nativeExecutions: 0, cases: [],
  sources: sourcePaths.map(filename => ({path: filename, sha256: sha(fs.readFileSync(filename))})),
  boundary: 'Two real child TerminateProcess/SIGKILL cuts through injected original Sql transaction boundaries. Package metadata/files and exact original scoped grants. No helper, external network, entry import, model, UI or app restart.'};
const save = () => fs.writeFileSync(path.join(root, 'report.json'), JSON.stringify(report, null, 2));
await build({stdin: {contents: `export {createExtensionPackageManager} from './src/main/xiaozhi-agent/extensions/package-manager.ts';
export {createExtensionState} from './src/main/xiaozhi-agent/extensions/state.ts';
export {createPermissionStore} from './src/main/xiaozhi-agent/permissions/store.ts';
export {createPermissionService} from './src/main/xiaozhi-agent/permissions/service.ts';
export {filesystemScope} from './src/main/xiaozhi-agent/permissions/resources.ts';
export {permissionHash} from './src/main/xiaozhi-agent/permissions/validation.ts';
export {capabilityPackageFiles} from './src/main/xiaozhi-agent/capabilities/acquisition/npm-install.ts';
export {NODE_RECIPE} from './src/main/xiaozhi-agent/capabilities/acquisition/recipes.ts';`, resolveDir: process.cwd(), loader: 'ts'},
  outfile: bundle, bundle: true, platform: 'node', format: 'esm', packages: 'external', target: 'node24',
  plugins: [{name: 'installed-dependencies', setup(builder) {
    builder.onResolve({filter: /^(?:@[^/]+\/[^/]+|[a-zA-Z][\w-]*)(?:\/.*)?$/}, args => ({path: import.meta.resolve(args.path), external: true}));
  }}]});
const api = await import(pathToFileURL(bundle).href);
const environment = {SystemRoot: process.env.SystemRoot || 'C:\\Windows', windir: process.env.windir || 'C:\\Windows', TEMP: os.tmpdir(), TMP: os.tmpdir()};
function launch(directory, point, mode) {
  const child = fork(worker, [directory, bundle, String(point), mode], {execPath: process.execPath,
    windowsHide: true, env: environment, stdio: ['ignore', 'pipe', 'pipe', 'ipc']});
  const messages = [];
  let stdout = '', stderr = '';
  let resolveEvent, rejectEvent;
  const event = new Promise((resolve, reject) => {resolveEvent = resolve; rejectEvent = reject;});
  const exit = new Promise((resolve, reject) => {
    child.once('error', error => {rejectEvent(error); reject(error);});
    child.once('close', (code, signal) => {
      const value = {pid: child.pid, code, signal, stdout, stderr, messages};
      if (!messages.some(message => ['done', 'checkpoint'].includes(message.event))) rejectEvent(Error('worker_closed_before_checkpoint'));
      resolve(value);
    });
  });
  child.stdout.on('data', bytes => {stdout = (stdout + bytes.toString('utf8')).slice(-16384);});
  child.stderr.on('data', bytes => {stderr = (stderr + bytes.toString('utf8')).slice(-16384);});
  child.on('message', message => {
    messages.push(message);
    if (message.event === 'error') rejectEvent(Error(message.error));
    if (message.event === (mode === 'crash' ? 'checkpoint' : 'done')) resolveEvent(message);
  });
  const timer = setTimeout(() => {rejectEvent(Error('worker_timeout')); child.kill('SIGKILL');}, 60000);
  timer.unref(); void exit.finally(() => clearTimeout(timer));
  return {child, event, exit};
}
async function normal(directory, point, mode) {
  const running = launch(directory, point, mode);
  try {
    const event = await running.event;
    const exit = await running.exit;
    assert.equal(exit.code, 0); assert.equal(exit.signal, null);
    return {result: event.result, exit};
  } catch (error) {running.child.kill('SIGKILL'); await running.exit; throw error;}
}
function committedFacts(directory, config) {
  const db = new DatabaseSync(path.join(directory, 'authority.sqlite'), {readOnly: true});
  try {
    const targetStored = JSON.parse(db.prepare('SELECT value_json FROM app_settings WHERE key=?').get('xiaozhi.extension.package.v1.' + config.artifactId).value_json);
    const selectedStored = JSON.parse(db.prepare('SELECT value_json FROM app_settings WHERE key=?').get('xiaozhi.extension.v1.' + config.extensionId).value_json);
    assert.equal(api.permissionHash(targetStored.document), targetStored.hash);
    assert.equal(api.permissionHash(selectedStored.document), selectedStored.hash);
    const grants = db.prepare('SELECT document_json FROM xiaozhi_permission_grants_v1 WHERE session_id=? ORDER BY created_at,grant_id')
      .all(config.owner.sessionId).map(row => JSON.parse(row.document_json));
    return {target: targetStored.document, selectionHash: api.permissionHash(selectedStored.document), grantHash: api.permissionHash(grants),
      rollbackJournalPresent: fs.existsSync(path.join(directory, 'authority.sqlite-journal'))};
  } finally {db.close();}
}
function preserved(facts, config) {
  assert.equal(facts.selectionHash, config.selectionHash); assert.equal(facts.grantHash, config.grantHash);
  assert.equal(facts.selected.activeVersion, '1.0.0'); assert.equal(facts.selected.enabled, true);
  assert.equal(facts.nativeTerminals, 0); assert.equal(facts.entryExecuted, false);
}
for (const point of [1, 2]) {
  const directory = path.join(root, 'case-' + point); await io.mkdir(directory);
  const record = {point, directory, pass: false}; report.cases.push(record); save();
  let running;
  try {
    record.setup = await normal(directory, point, 'setup');
    const config = record.setup.result.config;
    preserved(record.setup.result.baseline, config);
    assert.equal(record.setup.result.baseline.target.phase, 'needs_approval');
    running = launch(directory, point, 'crash');
    const checkpoint = await running.event;
    assert.equal(checkpoint.pid, running.child.pid); assert.equal(checkpoint.point, point);
    record.checkpoint = checkpoint.checkpoint;
    record.committedBeforeKill = committedFacts(directory, config);
    assert.equal(record.committedBeforeKill.target.phase, 'preparing'); assert(record.committedBeforeKill.target.binding);
    assert.equal(record.committedBeforeKill.target.attempt.processId, running.child.pid);
    assert.equal(record.committedBeforeKill.target.attempt.stageName, '.prepare-' + record.committedBeforeKill.target.attempt.id);
    assert.equal(record.committedBeforeKill.selectionHash, config.selectionHash); assert.equal(record.committedBeforeKill.grantHash, config.grantHash);
    assert.equal(record.checkpoint.finalExists, point === 2);
    assert.equal(record.checkpoint.stageNames.length, point === 1 ? 1 : 0);
    save();
    record.parentKillAccepted = running.child.kill('SIGKILL');
    record.killedWorker = await running.exit;
    assert.equal(record.parentKillAccepted, true);
    assert(record.killedWorker.signal !== null || record.killedWorker.code !== 0);
    running = undefined;
    record.reopened = await normal(directory, point, 'inspect');
    const reopened = record.reopened.result;
    preserved(reopened, config); assert.equal(reopened.target.phase, 'preparing');
    assert.equal(reopened.target.revision, record.committedBeforeKill.target.revision);
    assert.equal(reopened.fetches, 0); assert.equal(reopened.activePermissions, 0);
    assert.deepEqual(reopened.stageNames, record.checkpoint.stageNames); assert.equal(reopened.finalExists, point === 2);
    if (point === 1) {
      assert.deepEqual(reopened.stageFiles[0].files, record.checkpoint.stageFiles[0].files);
    } else {
      assert.deepEqual(reopened.finalFiles, record.checkpoint.finalFiles);
      const filename = path.join(directory, 'packages/versions', config.artifactId, 'payload/entry.mjs');
      const bytes = await io.readFile(filename); record.driftOriginalSha256 = sha(bytes);
      await io.appendFile(filename, '\n// owned recovery drift');
      record.driftMutatedSha256 = sha(await io.readFile(filename));
      assert.notEqual(record.driftMutatedSha256, record.driftOriginalSha256);
      record.driftRetry = await normal(directory, point, 'retry-drift');
      preserved(record.driftRetry.result, config);
      assert.equal(record.driftRetry.result.error, 'source_changed');
      assert.equal(record.driftRetry.result.permissionRequests.length, 0);
      assert.deepEqual(record.driftRetry.result.target, reopened.target);
      assert.equal(record.driftRetry.result.fetches, 0);
      await io.writeFile(filename, bytes); assert.equal(sha(await io.readFile(filename)), record.driftOriginalSha256);
    }
    record.retry = await normal(directory, point, 'retry');
    preserved(record.retry.result, config);
    assert.equal(record.retry.result.error, undefined); assert.equal(record.retry.result.target.phase, 'prepared');
    assert.equal(api.permissionHash(record.retry.result.finalFiles), api.permissionHash(record.retry.result.target.binding.files));
    assert.equal(record.retry.result.activePermissions, 0);
    assert.equal(record.retry.result.fetches, point === 1 ? 1 : 0);
    assert.equal(record.retry.result.stageNames.length, 0);
    if (point === 1) {
      const originalStage = path.join(directory, 'packages/versions', reopened.stageNames[0]);
      record.cleanupEvidence = {stageName: reopened.stageNames[0], recordedProcessId: reopened.target.attempt.processId,
        originalFilesHash: api.permissionHash(reopened.stageFiles[0].files), removedAfterPrepared: !fs.existsSync(originalStage)};
      assert.equal(record.cleanupEvidence.removedAfterPrepared, true);
    } else {
      assert.equal(record.retry.result.permissionRequests.length, 1);
      assert(!record.retry.result.permissionRequests[0].scopes.some(scope => scope.kind === 'network'));
    }
    record.pass = true; console.log('PASS real parent-kill cut ' + point);
  } catch (error) {record.error = error.stack; process.exitCode = 1; console.error(error);}
  finally {if (running) {running.child.kill('SIGKILL'); record.finalForcedExit = await running.exit;} save();}
}
report.success = report.cases.every(record => record.pass); save();
console.log(JSON.stringify({success: report.success, passed: report.cases.filter(record => record.pass).length,
  failed: report.cases.filter(record => !record.pass).length, root}));
