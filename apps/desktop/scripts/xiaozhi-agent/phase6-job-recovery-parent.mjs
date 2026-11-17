import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawn, spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {build} from 'esbuild';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'xiaozhi-phase6-job-recovery-'));
const args = process.argv.slice(2);
const reviewOnly = args.length === 2 && args[0] === '--only' && args[1] === 'J03';
const normalOnly = args.length === 2 && args[0] === '--only' && args[1] === 'J02,J03';
assert(args.length === 0 || reviewOnly || normalOnly || args.length === 3 && args[0] === '--recover-existing', 'fixture arguments');
const existing = args[0] === '--recover-existing' ? args.slice(1).map(directory => {
  const absolute = path.resolve(directory);
  assert(path.dirname(absolute) === fs.realpathSync(os.tmpdir()) && /^xiaozhi-phase6-job-recovery-[A-Za-z0-9]+$/u.test(path.basename(absolute)));
  assert.equal(fs.realpathSync(absolute), absolute); return absolute;
}) : [];
const allowedActiveRoots = new Set(existing.map(directory => path.join(directory, 'J01', 'active')));
const bundle = path.join(root, 'bundle'); fs.mkdirSync(bundle);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const sourceFiles = ['src/main/xiaozhi-agent/production-host.ts', 'src/main/xiaozhi-agent/terminal/lifecycle.ts',
  'src/main/xiaozhi-agent/terminal/service.ts', 'src/main/xiaozhi-agent/terminal/input.ts', 'src/main/xiaozhi-agent/terminal/job-state.ts',
  'src/main/xiaozhi-agent/terminal/recovery.ts',
  'src/main/xiaozhi-agent/terminal/presentation.ts', 'src/main/xiaozhi-agent/terminal/controlled-backend.ts',
  'src/main/xiaozhi-agent/effects/reconcile.ts', 'src/main/xiaozhi-agent/effects/state.ts', 'src/main/xiaozhi-agent/tasks/coordinator.ts',
  'src/main/xiaozhi-agent/tasks/task-state.ts', 'src/main/xiaozhi-agent/capabilities/generated/core-tool-manifest.json',
  'src/main/xiaozhi-agent/permissions/windows/generated/sandbox-manifest.json',
  'scripts/xiaozhi-agent/phase6-job-recovery-parent.mjs', 'scripts/xiaozhi-agent/phase6-job-recovery-worker.ts'];
const report = {success: false, root, paidCalls: 0, checks: [], workers: [],
  boundary: 'Actual Electron/OmniEduStore/Host/Pi/PTY Job with synthetic loopback model. Parent PowerShell only inventories exact native PIDs and the original owned projection ACL/profile. No data-root clone or Grant ledger rewrite.',
  ackLossBoundary: 'Owned TEMP port wrapper awaits real native ACK then throws once before original main ACK persistence.',
  sources: sourceFiles.map(file => ({file, sha256: hash(fs.readFileSync(file))}))};
const save = () => fs.writeFileSync(path.join(root, 'report.json'), JSON.stringify(report, null, 2)); save();
function owned(target) {
  const resolved = path.resolve(target), relative = path.relative(root, resolved);
  assert(relative && relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative));
  let cursor = resolved;
  while (cursor !== root) {if (fs.existsSync(cursor)) assert(!fs.lstatSync(cursor).isSymbolicLink()); cursor = path.dirname(cursor);}
  assert.equal(fs.realpathSync(root), root); return resolved;
}
function identity(directory) {
  const stat = fs.lstatSync(directory); assert(stat.isDirectory() && !stat.isSymbolicLink());
  return {directory, identity: [stat.dev, stat.ino, stat.birthtimeMs]};
}
function files(directory) {
  const rows = [];
  function walk(current) {
    for (const name of fs.readdirSync(current).sort()) {
      const filename = path.join(current, name), stat = fs.lstatSync(filename); assert(!stat.isSymbolicLink());
      if (stat.isDirectory()) walk(filename);
      else {assert(stat.isFile() && stat.nlink === 1); rows.push({file: path.relative(directory, filename), bytes: stat.size, sha256: hash(fs.readFileSync(filename))});}
    }
  }
  walk(directory); return rows;
}
const literal = value => "'" + value.replaceAll("'", "''") + "'";
let inventorySequence = 0;
function nativeInventory(document, sids = []) {
  const projection = path.resolve(document.projection.root);
  assert(/^xiaozhi-/iu.test(path.basename(projection)) && path.dirname(projection) === fs.realpathSync(os.tmpdir()));
  identity(projection);
  const ids = [document.pid, document.helperPid]; assert(ids.every(value => Number.isSafeInteger(value) && value > 0));
  assert(sids.every(value => /^S-1-15-2-[0-9-]+$/u.test(value)));
  const script = `$ErrorActionPreference='Stop';$ProgressPreference='SilentlyContinue'
$projection=${literal(projection)}
$processes=@(${ids.map(id => `Get-CimInstance Win32_Process -Filter 'ProcessId=${id}' | Select-Object ProcessId,ParentProcessId,CreationDate,ExecutablePath,CommandLine`).join('\n')})
$targets=@($projection)+@(Get-ChildItem -LiteralPath $projection -Recurse -Force | ForEach-Object {$_.FullName})
$rules=@(foreach($target in $targets){$acl=if([IO.Directory]::Exists($target)){[IO.Directory]::GetAccessControl($target)}else{[IO.File]::GetAccessControl($target)};foreach($rule in $acl.GetAccessRules($true,$true,[System.Security.Principal.SecurityIdentifier])){if($rule.IdentityReference.Value -match '^S-1-15-2-' -and $rule.IdentityReference.Value.Length -gt 30){[pscustomobject]@{path=$target;sid=$rule.IdentityReference.Value;rights=[string]$rule.FileSystemRights}}}})
$sids=@(${sids.map(literal).join(',')})
if($sids.Count -eq 0){$sids=@($rules | Select-Object -ExpandProperty sid -Unique)}
$profiles=@(foreach($sid in $sids){[pscustomobject]@{sid=$sid;exists=(Test-Path -LiteralPath ('Registry::HKEY_CURRENT_USER\\Software\\Classes\\Local Settings\\Software\\Microsoft\\Windows\\CurrentVersion\\AppContainer\\Mappings\\'+$sid))}})
[pscustomobject]@{processes=$processes;projection=$projection;rules=$rules;sids=$sids;profiles=$profiles} | ConvertTo-Json -Depth 5 -Compress`;
  const powershell = path.join(process.env.SystemRoot || 'C:/Windows', 'System32/WindowsPowerShell/v1.0/powershell.exe');
  const result = spawnSync(powershell, ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')],
    {windowsHide: true, encoding: 'utf8', timeout: 20000, maxBuffer: 1048576});
  const evidence = path.join(root, 'native-inventory-' + ++inventorySequence);
  fs.writeFileSync(evidence + '.ps1', script);
  fs.writeFileSync(evidence + '.json', JSON.stringify({status: result.status, error: result.error?.message, stdout: result.stdout, stderr: result.stderr}, null, 2));
  if (result.error) throw result.error; assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout.trim().replace(/^\ufeff/u, ''));
}
const alive = pid => {try {process.kill(pid, 0); return true;} catch (error) {if (error.code === 'ESRCH') return false; throw error;}};
await build({entryPoints: ['scripts/xiaozhi-agent/phase6-job-recovery-worker.ts'], outfile: path.join(bundle, 'worker.mjs'), bundle: true,
  platform: 'node', target: 'node24', format: 'esm', packages: 'external', logLevel: 'warning'});
fs.copyFileSync('package.json', path.join(bundle, 'package.json'));
fs.symlinkSync(path.resolve('node_modules'), path.join(bundle, 'node_modules'), 'junction');
report.bundleHash = hash(fs.readFileSync(path.join(bundle, 'worker.mjs'))); save();
const backendFile = 'src/main/xiaozhi-agent/terminal/controlled-backend.ts';
const originalBackend = fs.readFileSync(backendFile, 'utf8');
const needle = '        port = value;';
assert.equal(originalBackend.split(needle).length, 2);
const replacement = `        let lost = false;
        const diagnostic = ((globalThis as any).__jobAckFixture ||= {writes: [], drops: []});
        port = {...value, writeSequenced: async frame => {
          const received = await value.writeSequenced(frame);
          const proof = {sequence: frame.sequence, actualAck: received.sequence, bytes: frame.bytes.length};
          diagnostic.writes.push(proof);
          if (!lost && frame.bytes.toString('utf8').includes('ACK_DROP_MARKER')) {
            lost = true; diagnostic.drops.push(proof); throw Error('unknown_ack');
          }
          return received;
        }};`;
fs.writeFileSync(path.join(bundle, 'controlled-backend.original.ts'), originalBackend);
fs.writeFileSync(path.join(bundle, 'ack-loss-instrumentation.json'), JSON.stringify({file: backendFile,
  originalSourceHash: hash(Buffer.from(originalBackend)), exactMatches: 1, needle, replacement}, null, 2));
await build({entryPoints: ['scripts/xiaozhi-agent/phase6-job-recovery-worker.ts'], outfile: path.join(bundle, 'worker-ack-loss.mjs'), bundle: true,
  platform: 'node', target: 'node24', format: 'esm', packages: 'external', logLevel: 'warning',
  plugins: [{name: 'owned-native-ack-loss', setup(builder) {
    builder.onLoad({filter: /terminal[\\/]controlled-backend\.ts$/}, args => {
      const text = fs.readFileSync(args.path, 'utf8'); assert.equal(hash(Buffer.from(text)), hash(Buffer.from(originalBackend)));
      assert.equal(text.split(needle).length, 2); return {contents: text.replace(needle, replacement), loader: 'ts'};
    });
  }}]});
report.ackLossBundleHash = hash(fs.readFileSync(path.join(bundle, 'worker-ack-loss.mjs'))); save();
async function worker(activeRoot, output, mode, identityFile, cut = false) {
  if (allowedActiveRoots.has(activeRoot)) assert.equal(fs.realpathSync(activeRoot), activeRoot); else owned(activeRoot);
  owned(output); fs.mkdirSync(output, {recursive: true});
  const profile = path.join(output, 'profile'), bootstrap = path.join(output, 'bootstrap.cjs'); fs.mkdirSync(profile);
  const workerFile = mode === 'ack_loss' ? 'worker-ack-loss.mjs' : 'worker.mjs';
  fs.writeFileSync(bootstrap, `const {app}=require('electron');app.setPath('userData',${JSON.stringify(profile)});app.whenReady().then(async()=>{try{await import(${JSON.stringify(pathToFileURL(path.join(bundle,workerFile)).href)});app.exit(process.exitCode||0);}catch(error){console.error(error.stack);app.exit(1);}});`);
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => /^(SystemRoot|windir|SystemDrive|TEMP|TMP|USERPROFILE|LOCALAPPDATA|APPDATA|PATH|COMSPEC)$/iu.test(key)));
  env.DEEPSEEK_API_KEY = 'synthetic-job-recovery-loopback'; env.DEEPSEEK_MODEL = 'deepseek-flash';
  const entry = {mode, activeRoot, output}; report.workers.push(entry); save();
  const child = spawn(createRequire(import.meta.url)('electron'), [bootstrap, activeRoot, output, mode, identityFile], {env, windowsHide: true, stdio: ['ignore','pipe','pipe']});
  entry.pid = child.pid; const log = fs.createWriteStream(path.join(output, 'worker.log'));
  child.stdout.pipe(log, {end: false}); child.stderr.pipe(log, {end: false}); let ended = false;
  const close = new Promise((resolve, reject) => {child.once('error', reject); child.once('close', (code, signal) => {ended = true; resolve({code, signal});});});
  const timeout = setTimeout(() => {entry.timeout = true; child.kill('SIGKILL');}, 210000);
  try {
    if (cut) {
      const deadline = Date.now() + 150000, ready = path.join(output, 'cut-ready.json');
      while (!fs.existsSync(ready)) {if (ended || Date.now() > deadline) throw Error('job_cut_unavailable'); await new Promise(resolve => setTimeout(resolve, 100));}
      const value = JSON.parse(fs.readFileSync(ready, 'utf8')), id = value.identity;
      const db = new DatabaseSync(id.database, {readOnly: true}); let record;
      try {
        record = db.prepare('SELECT * FROM xiaozhi_jobs_v1 WHERE job_id=?').get(id.jobId); assert(record); const doc = JSON.parse(record.document_json);
        assert.equal(doc.state, 'running'); assert.equal(doc.controller.kind, 'teacher'); assert.equal(doc.taskId, id.taskId);
        assert.equal(doc.pid, id.record.document.pid); assert.equal(doc.helperPid, id.record.document.helperPid);
        entry.independent = {record, effect: db.prepare('SELECT * FROM xiaozhi_effects_v1 WHERE effect_id=?').get(doc.effectId)};
      } finally {db.close();}
      const doc = JSON.parse(record.document_json);
      const originalDirectories = [identity(activeRoot), identity(id.workspace), identity(doc.projection.root)];
      const originalFiles = files(id.workspace);
      entry.projectionFilesBefore = files(doc.projection.root);
      entry.beforeKill = nativeInventory(doc); assert.equal(entry.beforeKill.processes.length, 2);
      assert(entry.beforeKill.rules.length > 0 && entry.beforeKill.sids.length === 1);
      assert(entry.beforeKill.profiles.every(profile => profile.exists));
      const helper = entry.beforeKill.processes.find(process => process.ProcessId === doc.helperPid), shell = entry.beforeKill.processes.find(process => process.ProcessId === doc.pid);
      assert.equal(helper.ParentProcessId, child.pid); assert.equal(shell.ParentProcessId, doc.helperPid);
      entry.killAccepted = child.kill('SIGKILL'); assert(entry.killAccepted); entry.exit = await close;
      const cleanupDeadline = Date.now() + 30000;
      while ((alive(doc.pid) || alive(doc.helperPid)) && Date.now() < cleanupDeadline) await new Promise(resolve => setTimeout(resolve, 100));
      entry.afterKill = nativeInventory(doc, entry.beforeKill.sids);
      assert.equal(entry.afterKill.processes.length, 0);
      entry.directoryIdentityBefore = originalDirectories; entry.directoryIdentityAfter = originalDirectories.map(row => identity(row.directory));
      assert.deepEqual(entry.directoryIdentityAfter, originalDirectories); assert.deepEqual(files(id.workspace), originalFiles);
      entry.businessFilesBefore = originalFiles;
      return entry;
    }
    entry.exit = await close; await new Promise(resolve => log.end(resolve));
    const value = JSON.parse(fs.readFileSync(path.join(output, 'report.json'), 'utf8')); entry.result = value;
    assert.equal(entry.exit.code, 0, value.error); assert.equal(value.success, true, value.error); return value;
  } finally {
    clearTimeout(timeout); if (!ended) child.kill('SIGKILL'); await close;
    if (!log.writableEnded) await new Promise(resolve => log.end(resolve)); save();
  }
}
try {
  if (existing.length) {
    for (const directory of existing) {
      const identityFile = path.join(directory, 'J01', 'identity.json'), id = JSON.parse(fs.readFileSync(identityFile));
      const active = path.join(directory, 'J01', 'active'); assert.equal(id.activeRoot, active);
      const beforeDirectories = [identity(active), identity(id.workspace), identity(id.record.document.projection.root)];
      const beforeFiles = files(id.record.document.projection.root), workspaceFiles = files(id.workspace);
      const before = nativeInventory(id.record.document); assert.equal(before.processes.length, 0);
      const db = new DatabaseSync(id.database, {readOnly: true}); let previous;
      try {previous = JSON.parse(db.prepare('SELECT document_json FROM xiaozhi_jobs_v1 WHERE job_id=?').get(id.jobId).document_json);}
      finally {db.close();}
      const result = {id: path.basename(directory), pass: false, before, beforeDirectories, projectionFilesBefore: beforeFiles};
      (report.recoveries ??= []).push(result); save();
      try {
        result.cold = await worker(active, path.join(root, path.basename(directory)), previous.cleanup === 'complete' ? 'cold_recheck' : 'cold', identityFile);
      } finally {
        result.after = nativeInventory(id.record.document, before.sids);
        result.afterDirectories = beforeDirectories.map(row => identity(row.directory));
        result.projectionFilesAfter = files(id.record.document.projection.root); save();
      }
      const after = result.after;
      assert.equal(after.processes.length, 0); assert.equal(after.rules.length, 0); assert(after.profiles.every(profile => !profile.exists));
      assert.deepEqual(result.afterDirectories, beforeDirectories); assert.deepEqual(result.projectionFilesAfter, beforeFiles);
      assert.deepEqual(files(id.workspace), workspaceFiles); result.pass = true; report.checks.push(result); save();
    }
  } else if (reviewOnly || normalOnly) {
    const directory = path.join(root, reviewOnly ? 'J03' : 'J02-J03'); fs.mkdirSync(directory);
    const active = path.join(directory, 'active'); fs.mkdirSync(active);
    const value = await worker(active, path.join(directory, 'live'), reviewOnly ? 'review_only' : 'live', path.join(directory, 'identity.json'));
    report.checks.push(...value.checks);
  } else {
  const first = path.join(root, 'J01'); fs.mkdirSync(first); const active = path.join(first, 'active'); fs.mkdirSync(active);
  const identityFile = path.join(first, 'identity.json');
  report.cut = await worker(active, path.join(first, 'cut'), 'cut', identityFile, true);
  const cold = await worker(active, path.join(first, 'cold'), 'cold', identityFile);
  const id = JSON.parse(fs.readFileSync(identityFile));
  report.afterColdInventory = nativeInventory(id.record.document, report.cut.beforeKill.sids);
  assert.equal(report.afterColdInventory.processes.length, 0); assert.equal(report.afterColdInventory.rules.length, 0);
  assert(report.afterColdInventory.profiles.every(profile => !profile.exists));
  assert.deepEqual(report.cut.directoryIdentityBefore.map(row => identity(row.directory)), report.cut.directoryIdentityBefore);
  assert.deepEqual(files(id.workspace), report.cut.businessFilesBefore);
  assert.deepEqual(files(id.record.document.projection.root), report.cut.projectionFilesBefore);
  report.checks.push({id: 'J01_PARENT_KILL_COLD', pass: true, modelCallsCold: cold.modelCalls, maintenanceProcessesCold: cold.processes.length,
    guestDispatched: cold.maintenance.guestDispatched}); save();
  const unknown = path.join(root, 'J02-ack-loss'); fs.mkdirSync(unknown); const unknownActive = path.join(unknown, 'active'); fs.mkdirSync(unknownActive);
  const dropped = await worker(unknownActive, path.join(unknown, 'live'), 'ack_loss', path.join(unknown, 'identity.json'));
  report.checks.push(...dropped.checks); save();
  const second = path.join(root, 'J02-J03'); fs.mkdirSync(second); const live = path.join(second, 'active'); fs.mkdirSync(live);
  const value = await worker(live, path.join(second, 'live'), 'live', path.join(second, 'identity.json'));
  report.checks.push(...value.checks);
  }
  report.sourceDrift = report.sources.filter(row => hash(fs.readFileSync(row.file)) !== row.sha256); assert.deepEqual(report.sourceDrift, []);
  report.success = report.checks.length === (existing.length || (reviewOnly ? 1 : normalOnly ? 2 : 4)) && report.checks.every(check => check.pass);
} catch (error) {report.error = String(error.stack ?? error); process.exitCode = 1;}
finally {save(); console.log(JSON.stringify({root, success: report.success,
  checks: report.checks.map(check => ({id: check.id, pass: check.pass})), error: report.error}));}
