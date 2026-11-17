import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash, randomUUID} from 'node:crypto';
import {StringDecoder} from 'node:string_decoder';
import {DatabaseSync} from 'node:sqlite';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'xiaozhi-phase6-conpty-native-'));
const evidence = path.join(root, 'evidence'); fs.mkdirSync(evidence);
const cwdDiagnostic = process.argv.includes('--cwd-diagnostic');
const interactiveOnly = process.argv.includes('--only-interactive');
const ctrlcDiagnostic = process.argv.includes('--ctrlc-diagnostic');
const detachedCandidate = process.argv.includes('--detached-false');
const hash = value => createHash('sha256').update(value).digest('hex');
const sourceFiles = ['permissions/windows/ConPtyNative.cs', 'permissions/windows/ConPtySession.cs', 'terminal/controlled-backend.ts',
  'terminal/controlled-types.ts', 'permissions/windows/NativeSandbox.cs', 'permissions/windows/SessionInput.cs',
  'permissions/windows/SessionOptions.cs', 'permissions/windows/launcher.ts', 'terminal/shell-startup.ts'];
const report = {success: false, root, paidCalls: 0, checks: [], runs: [], sources: sourceFiles.map(file => ({file,
  sha256: hash(fs.readFileSync(path.join('src/main/xiaozhi-agent', file)))})),
  boundary: 'Real original Permission/Sql/runtime recipe and managed AppContainer Job helper. Owned synthetic PTY sessions through leaf backend. Task/Effect/Job supervisor, UI, provider and restart acceptance remain separate.'};
report.diagnostic = cwdDiagnostic;
report.interactiveOnly = interactiveOnly;
report.ctrlcDiagnostic = ctrlcDiagnostic;
report.detachedCandidate = detachedCandidate;
const save = () => fs.writeFileSync(path.join(evidence, 'report.json'), JSON.stringify(report, null, 2));
save();
await build({stdin: {contents: `export {createPermissionStore} from './src/main/xiaozhi-agent/permissions/store.ts';
export {createPermissionService} from './src/main/xiaozhi-agent/permissions/service.ts';
export {createPermissionRuntimeManager} from './src/main/xiaozhi-agent/permissions/windows/runtime.ts';
export {runNativeSandbox} from './src/main/xiaozhi-agent/permissions/windows/launcher.ts';
export {prepareExecutionProjection,removeOwnedProjection} from './src/main/xiaozhi-agent/permissions/windows/projection.ts';
export {filesystemScope} from './src/main/xiaozhi-agent/permissions/resources.ts';
export {permissionHash} from './src/main/xiaozhi-agent/permissions/validation.ts';
export {createControlledTerminalBackend} from './src/main/xiaozhi-agent/terminal/controlled-backend.ts';
export {terminalShellArguments,terminalEofBytes} from './src/main/xiaozhi-agent/terminal/shell-startup.ts';`, resolveDir: process.cwd(), loader: 'ts'},
  outfile: path.join(evidence, 'native.mjs'), bundle: true, platform: 'node', format: 'esm', packages: 'external', target: 'node24',
  plugins: [{name: 'temp-launcher-candidate', setup(builder) {
    if (!detachedCandidate) return;
    builder.onLoad({filter: /permissions[\\/]windows[\\/]launcher\.ts$/}, args => {
      const original = fs.readFileSync(args.path, 'utf8'); const before = 'detached: true, windowsHide: true';
      assert.equal(original.split(before).length - 1, 1); assert.equal(report.launcherPatch, undefined);
      const after = 'detached: false, windowsHide: true';
      report.launcherPatch = {file: args.path, sourceHash: hash(original), before, after}; save();
      fs.writeFileSync(path.join(evidence, 'temp-launcher-patch.json'), JSON.stringify(report.launcherPatch, null, 2));
      return {contents: original.replace(before, after), loader: 'ts', resolveDir: path.dirname(args.path)};
    });
  }}, {name: 'installed-dependencies', setup(builder) {builder.onResolve({filter: /^(?:@[^/]+\/[^/]+|[a-zA-Z][\w-]*)(?:\/.*)?$/},
    args => ({path: import.meta.resolve(args.path), external: true}));}}]});
if (detachedCandidate) assert(report.launcherPatch);
report.bundleHash = hash(fs.readFileSync(path.join(evidence, 'native.mjs'))); save();
const api = await import(pathToFileURL(path.join(evidence, 'native.mjs')).href);
const db = new DatabaseSync(path.join(root, 'authority.sqlite'));
db.exec('CREATE TABLE app_settings(key TEXT PRIMARY KEY,value_json TEXT,updated_at TEXT)');
db.exec('CREATE TABLE ai_confirmation_items(id TEXT PRIMARY KEY,run_id TEXT,session_id TEXT,action_type TEXT,status TEXT,title TEXT,description TEXT,preview_md TEXT,payload_json TEXT,created_at TEXT,updated_at TEXT)');
const sql = {all: async (query, values = []) => db.prepare(query).all(...values),
  run: async (query, values = []) => {db.prepare(query).run(...values);},
  change: async (query, values = []) => Number(db.prepare(query).run(...values).changes)};
sql.transaction = async action => {db.exec('BEGIN IMMEDIATE'); try {const value = await action(sql); db.exec('COMMIT'); return value;}
  catch (error) {db.exec('ROLLBACK'); throw error;}};
const store = api.createPermissionStore(sql); await store.migrate();
const owner = {sessionId: 'aisession_' + randomUUID(), taskId: 'xitask_' + hash(root), runId: 'run_conpty_fixture', generation: 1};
const workspace = path.join(root, 'workspace'); fs.mkdirSync(workspace);
const manager = api.createPermissionRuntimeManager({root: path.join(root, 'runtime'), store});
const permissions = api.createPermissionService({store, dataRoot: path.join(root, 'data'), owner: () => owner,
  archived: async () => false, workspace: async () => ({path: workspace})});
let runtime, executable;
async function check(id, name, action) {
  const started = performance.now();
  try {await action(); report.checks.push({id, name, pass: true, durationMs: performance.now() - started}); console.log('PASS ' + id + ' ' + name);}
  catch (error) {report.checks.push({id, name, pass: false, durationMs: performance.now() - started, error: String(error.stack ?? error)}); console.error('FAIL ' + id + ' ' + error);}
  save();
}
function clean(result) {
  assert.equal(result.cleanup.jobActiveProcesses, 0); assert.equal(result.cleanup.profileRemoved, true);
  assert.equal(result.cleanup.remainingOwnedAces, 0);
  if (result.cleanup.ptyClosed !== undefined) assert.equal(result.cleanup.ptyClosed, true);
}
function markerCommand(marker) {
  const half = Math.floor(marker.length / 2);
  return "[Console]::WriteLine(('" + marker.slice(0, half) + "'+'" + marker.slice(half) + "'))";
}
async function run(name, action, overrides = {}) {
  const controller = new AbortController();
  const scopes = [api.filesystemScope(workspace, ['read']), {kind: 'process', backend: 'appcontainer',
    executable: executable.path, executableHash: executable.sha256, workspace}];
  const request = {schemaVersion: 2, owner, requirementsVersion: 1, callId: 'conpty_' + name, action: 'owned_conpty_probe',
    inputDigest: api.permissionHash({name}), purpose: '合成受控PTY固定验证', scopes, files: [], provider: null,
    classification: 'redacted', expiresAt: new Date(Date.now() + 120000).toISOString()};
  const record = {name, bytes: 0, text: '', input: [], controls: []}; report.runs.push(record); save();
  let actionError;
  return permissions.engine.run(request, controller.signal, async authority => {
    const projection = await api.prepareExecutionProjection(workspace, '', {request, ...authority});
    record.projectionRoot = projection.root;
    const decoder = new StringDecoder('utf8'); let sequence = 0, outcome;
    const session = {schemaVersion: 1, mode: 'pty', cols: 80, rows: 24, arguments: '',
      maxInputBytes: 1048576, memoryBytes: 536870912, cpuRate: 5000, userTimeMs: 0, environment: {}, ...overrides.session};
    let command = '';
    if (overrides.script) {
      const script = path.join(projection.root, 'probe.ps1'); fs.writeFileSync(script, '\ufeff' + overrides.script);
      command = overrides.script;
    }
    session.arguments = api.terminalShellArguments({cwd: projection.cwd, command});
    record.argumentsHash = hash(session.arguments);
    const handle = api.createControlledTerminalBackend({controller, onData(bytes) {
      record.bytes += bytes.length; record.text = (record.text + decoder.write(bytes)).slice(-65536);
      fs.appendFileSync(path.join(evidence, name + '.vt'), bytes);
    }, launch: callbacks => api.runNativeSandbox({manifest: runtime.manifest, directory: runtime.directory, signal: authority.signal,
      start: {schemaVersion: 1, type: 'start', executionId: projection.executionId, owner, grantHash: authority.decision.permissionSnapshotHash,
        executable: executable.path, executableHash: executable.sha256, projectionRoot: projection.root, cwd: projection.cwd, command: '',
        env: {XIAOZHI_WORKSPACE: projection.root}, timeoutMs: overrides.timeoutMs ?? 30000, maxOutputBytes: overrides.maxOutputBytes ?? 1048576,
        maxProcesses: 8, session}, ...callbacks,
      onStarted(pid, helperPid) {record.pid = pid; record.helperPid = helperPid; callbacks.onStarted(pid, helperPid); save();},
      onResult(result) {record.result = result; save();}})});
    void handle.closed.then(value => {outcome = value; record.result = value.result; save();}, error => {record.launchError = String(error.stack ?? error); save();});
    const write = async chars => {
      const input = {sequence: ++sequence, bytes: Buffer.from(chars)};
      record.input.push({sequence, bytes: input.bytes.length, sha256: hash(input.bytes)});
      const ack = await handle.write(input); assert.equal(ack.sequence, sequence); return ack;
    };
    const wait = async (text, timeout = 12000, since = 0) => {
      const deadline = Date.now() + timeout;
      while (!record.text.slice(since).includes(text)) {
        if (Date.now() >= deadline || outcome) throw Error('missing_output ' + text + '\n' + record.text);
        await new Promise(resolve => setTimeout(resolve, 25));
      }
    };
    try {
      await action({handle, write, wait, record, projection, marker: () => 'OWNED_' + randomUUID().replaceAll('-', '')});
      outcome = await handle.closed; record.text += decoder.end(); clean(outcome.result);
      if (record.pid) assert.equal(outcome.result.cleanup.ptyClosed, true);
      return record;
    } catch (error) {
      actionError = error; record.actionError = String(error.stack ?? error); throw error;
    } finally {
      if (!outcome) {handle.cancel('cancelled'); try {outcome = await handle.closed;} catch { /* Original failure retained in record. */ }}
      if (outcome) {clean(outcome.result); api.removeOwnedProjection(projection.root); record.projectionRemoved = !fs.existsSync(projection.root);}
      save();
    }
  }).catch(error => {
    record.authorityError = String(error.stack ?? error); save();
    if (actionError) throw actionError;
    if (overrides.expectCancellation && controller.signal.aborted && record.result?.state === 'cancelled') return record;
    throw error;
  });
}
try {
  await check('P01', 'Original authorized runtime recipe prepares the PTY-capable managed helper', async () => {
    const recipe = manager.recipe(); await store.issue(owner.sessionId, [recipe], {kind: 'teacher', reference: 'owned-phase6-runtime'});
    const request = {schemaVersion: 2, owner, requirementsVersion: 1, callId: 'conpty_runtime', action: 'environment_repair',
      inputDigest: api.permissionHash(recipe), purpose: '合成PTY原运行时', scopes: [recipe], files: [], provider: null, classification: 'redacted',
      expiresAt: new Date(Date.now() + 300000).toISOString()};
    runtime = (await permissions.engine.run(request, new AbortController().signal, authority => manager.prepare({request, ...authority}, recipe.sha256))).runtime;
    assert.equal(runtime.manifest.ptyProtocolVersion, 1); executable = await manager.systemRuntime();
    report.helperHash = runtime.manifest.helperSha256; report.runtimeVersion = runtime.version;
    await store.issue(owner.sessionId, [api.filesystemScope(workspace, ['read']), {kind: 'process', backend: 'appcontainer',
      executable: executable.path, executableHash: executable.sha256, workspace}], {kind: 'teacher', reference: 'owned-phase6-pty'});
  });
  if (!runtime || !executable) throw Error('runtime_preparation_failed');
  await check(cwdDiagnostic ? 'D02' : ctrlcDiagnostic ? 'D03' : 'P02', cwdDiagnostic ? 'Owned cwd Win32 and PowerShell provider diagnostic' :
    ctrlcDiagnostic ? 'Owned Ctrl+C raw ETX and Win32 key-event diagnostic' :
    'Real console preserves state, Read-Host, ANSI/Unicode, resize and Ctrl+C continuation', async () => {
    const record = await run('interactive', async ({handle, write, wait, marker, projection, record}) => {
      const ready = await handle.ready; assert(ready.pid > 0 && ready.helperPid > 0);
      if (cwdDiagnostic) {
        const cwd = "'" + projection.cwd.replaceAll("'", "''") + "'";
        const rootPath = "'" + projection.root.replaceAll("'", "''") + "'";
        const done = marker();
        const command = [
          "try {[Console]::WriteLine(('DIAG_'+'WIN32_INITIAL=')+[IO.Directory]::GetCurrentDirectory()); [Console]::WriteLine(('DIAG_'+'WIN32_INITIAL_MATCH=')+([IO.Directory]::GetCurrentDirectory() -eq " + cwd + "))} catch {[Console]::WriteLine(('DIAG_'+'WIN32_INITIAL_ERROR=')+$_.Exception.GetBaseException().HResult)}",
          "try {[IO.Directory]::SetCurrentDirectory(" + cwd + "); [Console]::WriteLine(('DIAG_'+'WIN32_SET_MATCH=')+([IO.Directory]::GetCurrentDirectory() -eq " + cwd + "))} catch {[Console]::WriteLine(('DIAG_'+'WIN32_SET_ERROR=')+$_.Exception.GetBaseException().HResult)}",
          "try {New-PSDrive -Name Xiaozhi -PSProvider FileSystem -Root " + rootPath + " -Scope Global -ErrorAction Stop | Out-Null; Set-Location Xiaozhi:\\ -ErrorAction Stop; [Console]::WriteLine(('DIAG_'+'PSDRIVE_MATCH=')+((Get-Location).ProviderPath -eq " + cwd + ")); [Console]::WriteLine(('DIAG_'+'PSDRIVE_PROVIDERPATH=')+(Get-Location).ProviderPath); [Console]::WriteLine(('DIAG_'+'PSDRIVE_PATH=')+(Get-Location).Path); [Console]::WriteLine(('DIAG_'+'PSDRIVE_NORMALIZED_MATCH=')+((Get-Location).ProviderPath.TrimEnd('\\') -eq " + cwd + ".TrimEnd('\\')))} catch {[Console]::WriteLine(('DIAG_'+'PSDRIVE_ERROR=')+$_.Exception.GetBaseException().HResult); [Console]::WriteLine(('DIAG_'+'PSDRIVE_ERROR_TYPE=')+$_.Exception.GetBaseException().GetType().FullName)}",
          markerCommand(done), 'exit 0',
        ].join('; ');
        fs.writeFileSync(path.join(evidence, 'cwd-diagnostic-command.ps1'), command);
        await write(command + '\r'); await wait(done); return;
      }
      if (ctrlcDiagnostic) {
        const prompt = async (since, timeout) => {
          const deadline = Date.now() + timeout;
          while (Date.now() < deadline && !record.text.slice(since).includes('PS ')) await new Promise(resolve => setTimeout(resolve, 25));
          return record.text.slice(since).includes('PS ');
        };
        const sleeping = marker(); await write(markerCommand(sleeping) + '; Start-Sleep -Seconds 20\r'); await wait(sleeping);
        await new Promise(resolve => setTimeout(resolve, 150)); let since = record.text.length;
        const rawStart = performance.now(); await write('\x03'); const rawAckMs = performance.now() - rawStart;
        const rawPrompt = await prompt(since, 1500);
        record.ctrlc = {raw: {bytesHex: '03', ackMs: rawAckMs, prompt: rawPrompt, observationMs: performance.now() - rawStart}};
        if (rawPrompt && detachedCandidate) {
          record.ctrlc.win32 = {skipped: 'Raw ETX interrupted the original shell'};
          const continued = marker(); await write(markerCommand(continued) + '; exit 0\r'); await wait(continued);
          record.ctrlc.continuedMarkerObserved = true; return;
        }
        if (rawPrompt) {const second = marker(); await write(markerCommand(second) + '; Start-Sleep -Seconds 20\r'); await wait(second);}
        since = record.text.length; const keyStart = performance.now();
        const keys = '\x1b[17;29;0;1;8;1_\x1b[67;46;3;1;8;1_\x1b[67;46;3;0;8;1_\x1b[17;29;0;0;0;1_';
        await write(keys); const keyAckMs = performance.now() - keyStart; const keyPrompt = await prompt(since, 3000);
        record.ctrlc.win32 = {bytesHex: Buffer.from(keys).toString('hex'), ackMs: keyAckMs, prompt: keyPrompt, observationMs: performance.now() - keyStart};
        if (keyPrompt) {const continued = marker(); await write(markerCommand(continued) + '; exit 0\r'); await wait(continued);}
        else handle.cancel('cancelled');
        return;
      }
      const initialized = marker();
      await write("$ownedValue=41; [Console]::WriteLine(('INITIALCWD_'+'VALUE=')+((Get-Location).ProviderPath.TrimEnd('\\') -eq '" + projection.cwd.replaceAll("'", "''")
        + "'.TrimEnd('\\'))); [Console]::WriteLine(('REDIRECTED_'+'VALUE=')+[Console]::IsInputRedirected); "
        + markerCommand(initialized) + '\r');
      await wait(initialized); await wait('REDIRECTED_VALUE=False'); await wait('INITIALCWD_VALUE=True');
      const ask = marker(), answered = marker();
      await write("$a=Read-Host ('" + ask.slice(0, 12) + "'+'" + ask.slice(12) + "'); " + markerCommand(answered) + "; [Console]::WriteLine(('ANSWER_'+'VALUE=')+$a)\r");
      await wait(ask); await write('hello-42\r'); await wait(answered); await wait('ANSWER_VALUE=hello-42');
      const controlId = randomUUID(); await handle.resize({controlId, cols: 96, rows: 32});
      const state = marker();
      await write("$ownedValue++; [Console]::WriteLine(('STATE_'+'VALUE=')+$ownedValue); [Console]::WriteLine(('SIZE_'+'VALUE=')+[Console]::WindowWidth+'x'+[Console]::WindowHeight); "
        + "[Console]::WriteLine(([char]27)+'[31m'+[char]20013+[char]25991+[char]::ConvertFromUtf32(128578)+([char]27)+'[0m'); " + markerCommand(state) + '\r');
      await wait(state); await wait('STATE_VALUE=42'); await wait('SIZE_VALUE=96x32'); await wait('中文🙂');
      const sleeping = marker(); await write(markerCommand(sleeping) + '; Start-Sleep -Seconds 30\r'); await wait(sleeping);
      await new Promise(resolve => setTimeout(resolve, 150)); const interruptedAt = record.text.length;
      await write('\x03'); await wait('PS ', 12000, interruptedAt);
      const continued = marker(); await write(markerCommand(continued) + '\r'); await wait(continued);
      const cwd = marker(); await write("Set-Location .runtime; [Console]::WriteLine(('CWD_'+'VALUE=')+((Get-Location).ProviderPath.TrimEnd('\\') -eq '"
        + path.join(projection.root, '.runtime').replaceAll("'", "''") + "'.TrimEnd('\\'))); " + markerCommand(cwd) + '\r');
      await wait(cwd); await wait('CWD_VALUE=True');
      await write('exit 0\r');
    }, {expectCancellation: ctrlcDiagnostic});
    if (ctrlcDiagnostic) {
      assert(record.ctrlc?.raw && record.ctrlc?.win32);
      if (detachedCandidate) {assert.equal(record.ctrlc.raw.prompt, true); assert.equal(record.ctrlc.continuedMarkerObserved, true);}
    }
    else {assert.equal(record.result.state, 'completed'); assert.equal(record.result.exitCode, 0);}
  });
  if (!cwdDiagnostic && !interactiveOnly && !ctrlcDiagnostic) {
  await check('P03', 'Natural nonzero exit is preserved after output drain', async () => {
    const record = await run('nonzero', async ({handle, write, wait, marker}) => {await handle.ready; const done = marker();
      await write(markerCommand(done) + '; exit 7\r'); await wait(done);});
    assert.equal(record.result.state, 'completed'); assert.equal(record.result.exitCode, 7);
  });
  await check('P04', 'Typed Windows console EOF completes the actual application read loop', async () => {
    const record = await run('eof', async ({handle, write, wait}) => {await handle.ready; await wait('EOF_READY');
      await write(api.terminalEofBytes().toString('utf8')); await wait('EOF_DONE');},
      {script: "[Console]::WriteLine('EOF_READY'); while($null -ne [Console]::ReadLine()) {}; [Console]::WriteLine('EOF_DONE'); exit 0", timeoutMs: 5000});
    assert.equal(record.result.state, 'completed'); assert.equal(record.result.exitCode, 0); assert(record.text.includes('EOF_DONE'));
    record.eofObservation = {exitCode: record.result.exitCode, applicationReadLoopCompleted: record.text.includes('EOF_DONE')};
  });
  await check('P05', 'Job timeout closes console, reader, profile and ACEs', async () => {
    const record = await run('timeout', async ({handle}) => {await handle.ready;}, {script: 'Start-Sleep -Seconds 30', timeoutMs: 1200});
    assert.equal(record.result.state, 'timed_out');
  });
  await check('P06', 'Explicit revoke cancellation remains idempotent through verified cleanup', async () => {
    const record = await run('revoke', async ({handle, wait}) => {await handle.ready; await wait('REVOKE_READY'); handle.cancel('revoked'); handle.cancel('revoked');},
      {script: "[Console]::WriteLine('REVOKE_READY'); Start-Sleep -Seconds 30", expectCancellation: true});
    assert.equal(record.result.state, 'cancelled');
  });
  await check('P07', 'Bounded pending input under a non-reading guest is cancelled and settled', async () => {
    const record = await run('backpressure', async ({handle, wait, record}) => {
      await handle.ready; await wait('BLOCK_READY'); const writes = []; let settledCount = 0;
      for (let sequence = 1; sequence <= 4; sequence++) {
        const bytes = Buffer.alloc(16384, 120); record.input.push({sequence, bytes: bytes.length, sha256: hash(bytes)});
        writes.push(handle.write({sequence, bytes}).finally(() => {settledCount++;}));
      }
      const settled = Promise.allSettled(writes); await new Promise(resolve => setTimeout(resolve, 100));
      record.pendingAtCancellation = 4 - settledCount; handle.cancel('cancelled');
      const results = await settled; record.inputOutcomes = results.map(value => ({state: value.status, reason: value.reason && String(value.reason)}));
      assert.equal(results.length, 4);
    }, {script: "[Console]::WriteLine('BLOCK_READY'); Start-Sleep -Seconds 30", expectCancellation: true});
    assert.equal(record.result.state, 'cancelled');
  });
  await check('P08', 'PTY output budget follows the original Job termination and cleanup path', async () => {
    const record = await run('output-limit', async ({handle}) => {await handle.ready;},
      {script: "while($true){[Console]::Write(('x'*2048))}", maxOutputBytes: 8192});
    assert(record.result.truncated || record.result.error === 'output_limit');
  });
  await check('P09', 'Invalid PTY dimensions are rejected before shell start with complete cleanup', async () => {
    const record = await run('invalid-size', async ({handle}) => {await assert.rejects(handle.ready);}, {session: {cols: 1001}});
    assert.equal(record.result.state, 'failed'); assert.equal(record.pid, undefined);
  });
  }
  report.success = report.checks.length === (cwdDiagnostic || interactiveOnly || ctrlcDiagnostic ? 2 : 9) && report.checks.every(check => check.pass);
} catch (error) {report.error = String(error.stack ?? error);}
finally {db.close(); save(); console.log(JSON.stringify({root, success: report.success, checks: report.checks.length})); if (!report.success) process.exitCode = 1;}
