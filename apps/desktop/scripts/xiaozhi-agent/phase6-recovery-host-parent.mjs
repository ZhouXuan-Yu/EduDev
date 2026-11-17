import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {createHash, randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {build} from 'esbuild';

const args = process.argv.slice(2);
assert(args.length === 0 || args.length === 4 && args[0] === '--reuse' && args[2] === '--only', 'fixture arguments');
const reuse = args.length ? path.resolve(args[1]) : undefined;
const selected = args.length ? args[3].split(',') : ['H01', 'H02', 'H03', 'H04'];
assert(selected.length && new Set(selected).size === selected.length && selected.every(id => ['H01', 'H02', 'H03', 'H04'].includes(id)));
const root = reuse ?? fs.mkdtempSync(path.join(os.tmpdir(), 'xiaozhi-phase6-recovery-host-'));
if (reuse) assert(path.dirname(root) === fs.realpathSync(os.tmpdir()) && /^xiaozhi-phase6-recovery-host-[A-Za-z0-9]+$/u.test(path.basename(root)));
const evidenceRoot = reuse ? path.join(root, 'revalidation-' + randomUUID()) : root;
if (reuse) fs.mkdirSync(evidenceRoot);
const activeRoot = path.join(root, 'active'), golden = path.join(root, 'golden'), bundle = path.join(evidenceRoot, 'bundle');
const identityFile = path.join(root, 'identity.json'); if (!reuse) fs.mkdirSync(activeRoot); fs.mkdirSync(bundle);
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const sourceFiles = ['src/main/xiaozhi-agent/production-host.ts', 'src/main/xiaozhi-agent/tasks/native-rebuild-state.ts',
  'src/main/xiaozhi-agent/tasks/native-session-replacement.ts',
  'src/main/xiaozhi-agent/tasks/recovery-inspection.ts', 'src/main/xiaozhi-agent/events/journal.ts', 'src/main/xiaozhi-agent/effects/readback.ts',
  'src/main/xiaozhi-agent/model-switch-state.ts', 'src/main/xiaozhi-agent/capabilities/generated/core-tool-manifest.json',
  'src/main/xiaozhi-agent/permissions/windows/generated/sandbox-manifest.json',
  'scripts/xiaozhi-agent/phase6-recovery-host-parent.mjs', 'scripts/xiaozhi-agent/phase6-recovery-host-worker.ts'];
const report = {success: false, root, evidenceRoot, activeRoot, reusedGolden: Boolean(reuse), selected, paidCalls: 0, checks: [], workers: [],
  boundary: 'Actual Electron OmniEduStore Host Pi via loopback and foreground controlled exec. Golden is restored at one constant owned activeRoot, preserving absolute ledger references. Independent case copies are evidence snapshots, not relocation acceptance.',
  sources: sourceFiles.map(file => ({file, sha256: digest(fs.readFileSync(file))}))};
const save = () => fs.writeFileSync(path.join(evidenceRoot, 'report.json'), JSON.stringify(report, null, 2)); save();
function owned(target) {
  const absolute = path.resolve(target), relative = path.relative(root, absolute);
  assert(relative && relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative), 'outside named fixture root');
  let current = absolute;
  while (current !== root) {if (fs.existsSync(current)) assert(!fs.lstatSync(current).isSymbolicLink(), 'fixture link'); current = path.dirname(current);}
  assert.equal(fs.realpathSync(root), root); return absolute;
}
function manifest(directory) {
  owned(directory); const files = [];
  function walk(current) {
    for (const name of fs.readdirSync(current).sort()) {
      const file = path.join(current, name), stat = fs.lstatSync(file); assert(!stat.isSymbolicLink(), 'fixture link');
      if (stat.isDirectory()) walk(file);
      else {assert(stat.isFile() && stat.nlink === 1); files.push({file: path.relative(directory, file), bytes: stat.size,
        sha256: digest(fs.readFileSync(file)), mtimeMs: stat.mtimeMs});}
    }
  }
  walk(directory); return files;
}
const byteManifest = rows => rows.map(({file, bytes, sha256}) => ({file, bytes, sha256}));
function copySnapshot(source, destination) {
  owned(source); owned(destination); const before = manifest(source); assert(!fs.existsSync(destination));
  fs.cpSync(source, destination, {recursive: true, preserveTimestamps: true, errorOnExist: true, force: false});
  const after = manifest(destination); assert.deepEqual(byteManifest(after), byteManifest(before));
  fs.writeFileSync(destination + '.manifest.json', JSON.stringify(after, null, 2)); return after;
}
function directoryIdentities(directory, template = directory) {
  const rows = [];
  function walk(current) {
    const relative = path.relative(template, current), actual = path.join(directory, relative);
    owned(actual); const stat = fs.lstatSync(actual);
    assert(stat.isDirectory() && !stat.isSymbolicLink(), 'original directory unavailable');
    rows.push({directory: relative, identity: [stat.dev, stat.ino, stat.birthtimeMs]});
    for (const entry of fs.readdirSync(current, {withFileTypes: true}).sort((left, right) => left.name.localeCompare(right.name))) {
      if (entry.isDirectory()) walk(path.join(current, entry.name));
    }
  }
  walk(template); return rows;
}
function restore(caseRoot) {
  owned(activeRoot); assert.equal(path.resolve(activeRoot), path.join(root, 'active')); manifest(activeRoot);
  const before = directoryIdentities(activeRoot, golden);
  assert.deepEqual(before, report.originalDirectories, 'original directory identity changed before restore');
  function restoreContents(source, destination) {
    const names = fs.readdirSync(source).sort(), expected = new Set(names);
    for (const name of fs.readdirSync(destination)) {
      if (expected.has(name)) continue;
      const extra = owned(path.join(destination, name)), stat = fs.lstatSync(extra);
      assert(!stat.isSymbolicLink(), 'fixture link');
      if (stat.isDirectory()) manifest(extra);
      else assert(stat.isFile() && stat.nlink === 1);
      fs.rmSync(extra, {recursive: stat.isDirectory()});
    }
    for (const name of names) {
      const original = path.join(source, name), target = owned(path.join(destination, name));
      const stat = fs.lstatSync(original); assert(!stat.isSymbolicLink(), 'golden link');
      if (stat.isDirectory()) {
        const current = fs.lstatSync(target); assert(current.isDirectory() && !current.isSymbolicLink());
        restoreContents(original, target);
      } else {
        assert(stat.isFile() && stat.nlink === 1);
        if (fs.existsSync(target)) {const current = fs.lstatSync(target); assert(current.isFile() && current.nlink === 1);}
        fs.writeFileSync(target, fs.readFileSync(original)); fs.utimesSync(target, stat.atime, stat.mtime);
      }
    }
  }
  restoreContents(golden, activeRoot);
  const after = directoryIdentities(activeRoot, golden);
  assert.deepEqual(after, before, 'restore changed original directory identity');
  const restored = byteManifest(manifest(activeRoot)); assert.deepEqual(restored, byteManifest(manifest(golden)));
  (report.restores ??= []).push({caseRoot, before, after, manifestHash: digest(JSON.stringify(restored))});
  copySnapshot(activeRoot, path.join(caseRoot, 'before'));
}
const normalized = value => String(value).replaceAll('\\', '/');
function nativeFile(identity, bindingFile = identity.sessionFile) {
  const file = path.resolve(identity.nativeRoot, bindingFile); owned(file);
  const relative = path.relative(identity.nativeRoot, file);
  assert(relative && !relative.startsWith('..') && !path.isAbsolute(relative) && file.endsWith('.jsonl'));
  return file;
}
function mutateHeader(file, evidence) {
  owned(file); const bytes = fs.readFileSync(file), end = bytes.indexOf(10); assert(end > 0);
  const first = bytes.subarray(0, end).toString('utf8'), header = JSON.parse(first); assert.equal(header.type, 'session');
  const match = /"id"\s*:\s*("(?:\\.|[^"\\])*")/u.exec(first); assert(match && JSON.parse(match[1]) === header.id);
  const start = match.index + match[0].lastIndexOf(match[1]); const replacement = JSON.stringify(randomUUID());
  const changedFirst = first.slice(0, start) + replacement + first.slice(start + match[1].length);
  assert.deepEqual({...JSON.parse(changedFirst), id: header.id}, header);
  const changed = Buffer.concat([Buffer.from(changedFirst), bytes.subarray(end)]);
  assert.deepEqual(changed.subarray(Buffer.byteLength(changedFirst)), bytes.subarray(end));
  fs.writeFileSync(path.join(evidence, 'old-jsonl.bin'), bytes); fs.writeFileSync(path.join(evidence, 'changed-jsonl.bin'), changed);
  fs.writeFileSync(file, changed); return {oldHash: digest(bytes), changedHash: digest(changed), oldId: header.id, newId: JSON.parse(changedFirst).id};
}
await build({entryPoints: ['scripts/xiaozhi-agent/phase6-recovery-host-worker.ts'], outfile: path.join(bundle, 'worker.mjs'),
  bundle: true, platform: 'node', target: 'node24', format: 'esm', packages: 'external', logLevel: 'warning'});
fs.copyFileSync('package.json', path.join(bundle, 'package.json'));
fs.symlinkSync(path.resolve('node_modules'), path.join(bundle, 'node_modules'), 'junction');
report.bundleHash = digest(fs.readFileSync(path.join(bundle, 'worker.mjs'))); save();
async function worker(mode, output, cut = false) {
  owned(output); fs.mkdirSync(output, {recursive: true});
  const bootstrap = path.join(output, 'bootstrap.cjs'), profile = path.join(output, 'electron-profile'); fs.mkdirSync(profile);
  fs.writeFileSync(bootstrap, `const {app}=require('electron');app.setPath('userData',${JSON.stringify(profile)});app.whenReady().then(async()=>{try{await import(${JSON.stringify(pathToFileURL(path.join(bundle, 'worker.mjs')).href)});app.exit(process.exitCode||0);}catch(error){console.error(error.stack);app.exit(1);}});`);
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => /^(SystemRoot|windir|SystemDrive|TEMP|TMP|USERPROFILE|LOCALAPPDATA|APPDATA|PATH|COMSPEC)$/iu.test(key)));
  env.DEEPSEEK_API_KEY = 'synthetic-phase6-recovery-loopback'; env.DEEPSEEK_MODEL = 'deepseek-flash';
  const record = {mode, output}; report.workers.push(record); save();
  const child = spawn(createRequire(import.meta.url)('electron'), [bootstrap, activeRoot, output, mode, identityFile],
    {env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe']}); record.pid = child.pid;
  const log = fs.createWriteStream(path.join(output, 'worker.log')); child.stdout.pipe(log, {end: false}); child.stderr.pipe(log, {end: false});
  let ended = false;
  const timeout = setTimeout(() => {record.timeout = true; child.kill('SIGKILL');}, 180000);
  const closed = new Promise((resolve, reject) => {child.once('error', reject); child.once('close', (code, signal) => {ended = true; resolve({code, signal});});});
  try {
    if (cut) {
      const ready = path.join(output, 'cut-ready.json'), deadline = Date.now() + 120000;
      while (!fs.existsSync(ready)) {
        if (ended || Date.now() > deadline) throw Error('cut boundary unavailable; inspect worker report/log');
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      const boundary = JSON.parse(fs.readFileSync(ready, 'utf8')), identity = boundary.identity;
      const db = new DatabaseSync(identity.database, {readOnly: true});
      try {
        const task = JSON.parse(db.prepare('SELECT value_json FROM app_settings WHERE key=?').get('xiaozhi.task.v1:' + identity.taskId).value_json).view;
        const effect = JSON.parse(db.prepare('SELECT document_json FROM xiaozhi_effects_v1 WHERE effect_id=?').get(identity.effectId).document_json);
        const run = db.prepare('SELECT * FROM xiaozhi_event_runs WHERE run_id=?').get(identity.runId);
        assert.equal(task.state, 'active'); assert.equal(run.status, 'running'); assert.equal(effect.state, 'committed');
        assert.equal(effect.callId, identity.callId); assert.equal(effect.tool, 'exec_command'); assert(effect.execution?.id);
        assert.equal(digest(fs.readFileSync(identity.artifact)), identity.artifactHash);
        record.independentBoundary = {task, effect, run, artifactHash: identity.artifactHash};
      } finally {db.close();}
      record.killAccepted = child.kill('SIGKILL'); assert.equal(record.killAccepted, true);
    }
    record.exit = await closed;
    await new Promise(resolve => log.end(resolve));
    if (cut) {assert(record.exit.code !== 0 || record.exit.signal); return record;}
    const value = JSON.parse(fs.readFileSync(path.join(output, 'report.json'), 'utf8')); record.result = value;
    assert.equal(record.exit.code, 0, value.error); assert.equal(value.success, true, value.error); return value;
  } finally {
    clearTimeout(timeout); if (!ended) child.kill('SIGKILL');
    await closed; if (!log.closed) await new Promise(resolve => log.end(resolve)); save();
  }
}
async function check(id, name, action) {
  const started = performance.now();
  try {await action(); report.checks.push({id, name, pass: true, durationMs: performance.now() - started}); console.log('PASS ' + id + ' ' + name);}
  catch (error) {report.checks.push({id, name, pass: false, durationMs: performance.now() - started, error: String(error.stack ?? error)});
    console.error('FAIL ' + id + ' ' + String(error).split('\n')[0]); throw error;}
  finally {save();}
}
function rebuiltCoherent(value, identity, expectedArchives) {
  const state = value.after, last = value.attempts.at(-1).start;
  assert.equal(state.task.id, identity.taskId); assert.equal(state.artifact.sha256, identity.artifactHash);
  assert.equal(state.rebuildArchives.length, expectedArchives);
  const file = nativeFile(identity, state.sessionBinding.session_file), header = JSON.parse(fs.readFileSync(file, 'utf8').split('\n')[0]);
  assert.equal(state.modelLedger.native_session_id, header.id);
  assert.equal(normalized(state.modelLedger.session_file), normalized(state.sessionBinding.session_file));
  const binding = state.nativeBindings.find(row => row.run_id === last.runId); assert(binding);
  assert.equal(normalized(JSON.parse(binding.binding_json).file), normalized(state.sessionBinding.session_file));
  if (expectedArchives) {
    const archive = JSON.parse(state.rebuildArchives.at(-1).value_json).document;
    assert.equal(archive.owner.runId, last.runId); assert.equal(archive.taskId, identity.taskId);
    assert.equal(archive.replacement.nativeSessionId, header.id);
  }
}
try {
  if (!reuse) report.cut = await worker('cut', path.join(root, 'cut'), true);
  const identity = JSON.parse(fs.readFileSync(identityFile, 'utf8')); report.identity = identity;
  assert.equal(identity.activeRoot, activeRoot);
  if (reuse) {
    const previous = JSON.parse(fs.readFileSync(path.join(root, 'report.json'), 'utf8'));
    report.originalDirectories = previous.originalDirectories; report.golden = previous.golden; report.goldenHash = previous.goldenHash;
    assert.deepEqual(byteManifest(manifest(golden)), byteManifest(report.golden));
    assert.equal(digest(JSON.stringify(byteManifest(report.golden))), report.goldenHash);
  } else {
    report.originalDirectories = directoryIdentities(activeRoot);
    report.golden = copySnapshot(activeRoot, golden); report.goldenHash = digest(JSON.stringify(byteManifest(report.golden)));
  }
  save();
  const cases = [['H01', 'available', 'Normal cold state and explicit same-Task resume'], ['H02', 'missing', 'Missing JSONL explicit rebuild'],
    ['H03', 'changed', 'Header-ID-only change explicit rebuild'], ['H04', 'rollback', 'Native binding failure rolls back rebuild then explicit retry']];
  for (const [id, kind, name] of cases.filter(([id]) => selected.includes(id))) await check(id, name, async () => {
    const directory = path.join(evidenceRoot, id); fs.mkdirSync(directory); restore(directory);
    const oldFile = nativeFile(identity); let mutation;
    if (kind === 'missing') {
      owned(oldFile); assert.equal(digest(fs.readFileSync(oldFile)), digest(fs.readFileSync(nativeFile({...identity, nativeRoot: path.join(golden, 'data', 'xiaozhi-pi')}))));
      fs.copyFileSync(oldFile, path.join(directory, 'deleted-jsonl.bin')); fs.unlinkSync(oldFile);
    } else if (kind === 'changed' || kind === 'rollback') mutation = mutateHeader(oldFile, directory);
    fs.writeFileSync(path.join(directory, 'mutation.json'), JSON.stringify({kind, mutation, oldFile}, null, 2));
    copySnapshot(activeRoot, path.join(directory, 'after-mutation'));
    const cold = await worker('cold', path.join(directory, 'cold'));
    assert.equal(cold.before.inspection.native.state, kind === 'rollback' ? 'changed' : kind);
    assert.equal(cold.before.inspection.canRebuildSession, kind !== 'available');
    assert.equal(cold.modelCalls, 0); assert.equal(cold.processes.length, 0); assert.equal(cold.before.artifact.sha256, identity.artifactHash);
    const resumed = await worker(kind === 'rollback' ? 'rollback' : 'resume', path.join(directory, 'resume'));
    assert.equal(resumed.modelCalls, 1); assert.equal(resumed.attempts.length, kind === 'rollback' ? 2 : 1);
    assert.equal(resumed.after.runs.length - cold.before.runs.length, kind === 'rollback' ? 2 : 1);
    assert(resumed.after.runs.at(-1).generation > identity.generation);
    rebuiltCoherent(resumed, identity, kind === 'available' ? 0 : 1);
    if (mutation) assert.equal(digest(fs.readFileSync(oldFile)), mutation.changedHash);
    const coldAgain = await worker('cold_after', path.join(directory, 'second-cold'));
    assert.equal(coldAgain.before.inspection.native.state, 'available'); assert.equal(coldAgain.before.task.state, resumed.after.task.state);
    assert.equal(coldAgain.modelCalls, 0); assert.equal(coldAgain.processes.length, 0); assert.equal(coldAgain.before.artifact.sha256, identity.artifactHash);
    if (mutation) assert.equal(digest(fs.readFileSync(oldFile)), mutation.changedHash);
    copySnapshot(activeRoot, path.join(directory, 'after'));
    assert.deepEqual(byteManifest(manifest(golden)), byteManifest(report.golden));
  });
  report.sourceDrift = report.sources.filter(row => digest(fs.readFileSync(row.file)) !== row.sha256);
  assert.deepEqual(report.sourceDrift, []); report.success = report.checks.length === selected.length;
} catch (error) {report.error = String(error.stack ?? error); process.exitCode = 1;}
finally {save(); console.log(JSON.stringify({root, evidenceRoot, success: report.success, checks: report.checks.length, error: report.error}));}
