import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {fork} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {openNetworkFixture} from './phase6-network-effects-worker.mjs';
import {digest} from './phase6-state-foundation-worker.mjs';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'xiaozhi-phase6-network-effects-'));
const sources = ['src/main/xiaozhi-agent/effects/network.ts', 'src/main/xiaozhi-agent/effects/network-receipts.ts',
  'src/main/xiaozhi-agent/effects/state.ts', 'src/main/xiaozhi-agent/effects/journal.ts', 'src/main/xiaozhi-agent/effects/reconcile.ts',
  'src/main/xiaozhi-agent/permissions/network.ts', 'src/main/xiaozhi-agent/permissions/current.ts',
  'src/main/xiaozhi-agent/permissions/engine.ts', 'src/main/xiaozhi-agent/permissions/store.ts',
  'src/main/xiaozhi-agent/events/journal.ts', 'src/main/xiaozhi-agent/tasks/task-state.ts',
  'scripts/xiaozhi-agent/phase6-state-foundation-worker.mjs'];
const hashes = () => sources.map(file => ({file, sha256: digest(fs.readFileSync(file))}));
const report = {success: false, root, paidCalls: 0, checks: [], wire: [], observations: {}, crashes: [], sourcesBefore: hashes(),
  boundary: 'Original SQLite Task/Journal/Effect/receipt, PermissionStore/Engine and NetworkBroker/NetworkEffects APIs against explicit loopback network+egress grants. Real HTTP and one real child SIGKILL. Synthetic identity sanitizer and fixture inputs. No Pi/Host/UI, external provider, TLS, native helper, keys, real budget, build or product recovery acceptance.'};
const save = () => fs.writeFileSync(path.join(root, 'report.json'), JSON.stringify(report, null, 2));
const waiting = new Map();
const sockets = new Set();
const server = http.createServer(async (request, response) => {
  try {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const body = Buffer.concat(chunks).toString('utf8');
    const row = {path: request.url, method: request.method, body, bodySha: digest(body),
      idempotencyKey: request.headers['idempotency-key'] || null, receivedAt: new Date().toISOString(),
      ordinal: report.wire.filter(item => item.path === request.url).length + 1, responseCompleted: false};
    report.wire.push(row); save();
    const finish = () => {row.responseCompleted = true; row.finishedAt = new Date().toISOString(); save();};
    response.on('finish', finish);
    response.on('close', () => {row.connectionClosed = true; save();});
    for (const resolve of waiting.get(request.url) || []) resolve(row);
    waiting.delete(request.url);
    if (request.url.endsWith('/drop')) {request.socket.destroy(); return;}
    if (request.url.endsWith('/hold')) {response.writeHead(200, {'content-type': 'text/plain'}); response.write('partial owned response'); return;}
    const status = request.method === 'POST' ? 201 : 200;
    const responseBody = `{\n  "fixture": "课堂", "method": "${request.method}", "ordinal": ${row.ordinal}\n}\n`;
    row.status = status; row.responseBody = responseBody;
    response.writeHead(status, {'content-type': 'application/json; charset=utf-8'}); response.end(responseBody);
  } catch (error) {response.destroy(error);}
});
server.on('connection', socket => {sockets.add(socket); socket.on('close', () => sockets.delete(socket));});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = 'http://127.0.0.1:' + server.address().port;
report.origin = origin; save();
const received = pathname => report.wire.filter(row => row.path === pathname).length;
async function waitReceived(pathname) {
  const existing = report.wire.find(row => row.path === pathname);
  if (existing) return existing;
  let timer;
  try {
    return await Promise.race([new Promise(resolve => waiting.set(pathname, [...(waiting.get(pathname) || []), resolve])),
      new Promise((_, reject) => {timer = setTimeout(() => reject(Error('owned_request_timeout')), 5000);})]);
  } finally {clearTimeout(timer); waiting.delete(pathname);}
}
const raw = (pathname, body = '{"fixture":"post"}', extra = {}) => ({url: origin + pathname, method: 'POST', body,
  purpose: 'script_network', classification: 'public', ...extra});
async function check(id, name, action) {
  const started = performance.now();
  try {await action(); report.checks.push({id, name, pass: true, durationMs: performance.now() - started}); console.log('PASS ' + id + ' ' + name);}
  catch (error) {report.checks.push({id, name, pass: false, durationMs: performance.now() - started, error: String(error.stack || error)}); console.error('FAIL ' + id + ' ' + String(error));}
  save();
}
async function fixture(id, action) {
  const network = await openNetworkFixture(path.join(root, id), origin);
  try {
    const run = await network.f.admit(await network.f.fresh()); await network.f.execute(run);
    const grants = await network.issue(run);
    return await action(network, run, grants);
  } finally {network.close();}
}
async function killAfterReceipt(pathname) {
  const directory = path.join(root, 'N05-cold-receipt'), record = {directory};
  report.crashes.push(record); save();
  const environment = Object.fromEntries(Object.entries(process.env).filter(([key]) => /^(SystemRoot|windir|SystemDrive|TEMP|TMP|LOCALAPPDATA|USERPROFILE)$/iu.test(key)));
  const worker = fileURLToPath(new URL('./phase6-network-effects-worker.mjs', import.meta.url));
  const child = fork(worker, ['--receipt-boundary', directory, origin, pathname], {execPath: process.execPath, execArgv: [],
    windowsHide: true, env: environment, stdio: ['ignore', 'pipe', 'pipe', 'ipc']});
  record.pid = child.pid;
  let stdout = '', stderr = '', timer;
  child.stdout.on('data', bytes => {stdout += bytes.toString();}); child.stderr.on('data', bytes => {stderr += bytes.toString();});
  const closed = new Promise((resolve, reject) => {child.once('error', reject); child.once('close', (code, signal) => resolve({code, signal}));});
  try {
    const boundary = await new Promise((resolve, reject) => {
      timer = setTimeout(() => reject(Error('receipt_boundary_timeout')), 15000);
      child.on('message', message => message.type === 'receipt_published_before_commit' ? resolve(message) : reject(Error(message.error || 'unexpected_worker_message')));
      child.once('error', reject); child.once('exit', (code, signal) => reject(Error('worker_before_boundary ' + code + ' ' + signal)));
    });
    clearTimeout(timer); record.boundary = boundary;
    const db = new DatabaseSync(path.join(directory, 'state.sqlite'), {readOnly: true});
    try {
      record.beforeKill = JSON.parse(db.prepare('SELECT document_json FROM xiaozhi_effects_v1 WHERE effect_id=?').get(boundary.identity.effectId).document_json);
      assert.equal(record.beforeKill.state, 'executing'); assert.equal(record.beforeKill.outcome, null);
    } finally {db.close();}
    assert.equal(received(pathname), 1);
    assert.equal(digest(fs.readFileSync(path.join(directory, 'network-receipts', boundary.identity.effectId + '.json'))), boundary.receiptSha);
    record.killAccepted = child.kill('SIGKILL'); assert.equal(record.killAccepted, true);
    record.exit = await closed; assert(record.exit.code !== 0 || record.exit.signal);
    return record;
  } finally {
    clearTimeout(timer);
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    record.exit ??= await closed;
    fs.writeFileSync(path.join(directory, 'worker.stdout.log'), stdout); fs.writeFileSync(path.join(directory, 'worker.stderr.log'), stderr); save();
  }
}
try {
  await check('N01', 'Same Task/requirements/digest POST and distinct admitted parent reuse one exact response', async () => fixture('N01', async (n, run) => {
    const pathname = '/N01/complete', request = raw(pathname);
    const first = await n.call(run, request), repeat = await n.call(run, request);
    const next = await n.admitNext({...run}, run), otherParent = await n.call(next, request);
    assert.deepEqual(repeat, first); assert.deepEqual(otherParent, first); assert.equal(first.body, report.wire.find(row => row.path === pathname).responseBody);
    assert.equal(first.status, 201); assert.equal(received(pathname), 1);
    const effects = await n.records(run.task.id); assert.equal(effects.length, 1); assert.equal(effects[0].state, 'committed');
    assert.equal(effects[0].receipt.callId, run.callId); assert.equal(report.wire.find(row => row.path === pathname).idempotencyKey, effects[0].id);
    report.observations.N01 = {response:first,effects,received:received(pathname),parentCalls:[run.callId,next.callId]};
  }));
  await check('N02', 'Real GET with the same child call returns its cached exact response', async () => fixture('N02', async (n, run) => {
    const pathname = '/N02/complete', request = raw(pathname, null, {method:'GET'}), callId = 'network_' + randomUUID();
    const first = await n.call(run, request, {callId}), cached = await n.call(run, request, {callId});
    assert.deepEqual(cached, first); assert.equal(first.status, 200); assert.equal(received(pathname), 1);
    const effects = await n.records(run.task.id); assert.equal(effects[0].operation,'network_get'); assert.equal(effects[0].state,'committed');
    report.observations.N02 = {response:first,effects,received:received(pathname)};
  }));
  await check('N03', 'Explicit IdempotencyKey rejects a different POST body before any second HTTP', async () => fixture('N03', async (n, run) => {
    const pathname = '/N03/complete', request = raw(pathname, '{"fixture":"A"}', {idempotencyKey:'owned-fixed-key'});
    const first = await n.call(run, request); assert.deepEqual(await n.call(run, request), first);
    const before = await n.records(run.task.id);
    await assert.rejects(n.call(run, {...request, body:'{"fixture":"B"}'}), /effect_idempotency_conflict/);
    assert.equal(received(pathname), 1); assert.deepEqual(await n.records(run.task.id), before);
    report.observations.N03 = {response:first,effects:before,received:received(pathname),conflictingSecondHttp:0};
  }));
  await check('N04', 'Lost response remains unknown and a new call or explicit same-Task new Run cannot replay', async () => fixture('N04', async (n, run) => {
    const pathname = '/N04/drop', request = raw(pathname);
    await assert.rejects(n.call(run, request));
    let effects = await n.records(run.task.id); assert.equal(effects.length,1); assert.equal(effects[0].state,'unknown');
    assert.equal(received(pathname),1); await assert.rejects(n.call(run, request), /side_effect_unknown/); assert.equal(received(pathname),1);
    await n.f.journal.recover();
    const resumed = await n.resume(run.task.id), next = await n.admitNext(resumed, run);
    assert.equal(next.task.id,run.task.id); assert.notEqual(next.runId,run.runId); assert.equal(next.task.requirementsVersion,run.task.requirementsVersion);
    await assert.rejects(n.call(next, request), /side_effect_unknown/);
    effects = await n.records(run.task.id); assert.equal(effects[0].state,'unknown'); assert.equal(received(pathname),1);
    report.observations.N04 = {effects,received:received(pathname),replayHttp:0,oldRun:run.runId,newRun:next.runId,taskId:run.task.id};
  }));
  await check('N05', 'Published complete response survives SIGKILL before commit and cold reconcile sends no HTTP', async () => {
    const pathname = '/N05/complete', crash = await killAfterReceipt(pathname), identity = crash.boundary.identity;
    let n = await openNetworkFixture(crash.directory,origin);
    try {
      assert.equal((await n.f.effects.get(identity.effectId)).state,'executing');
      await n.f.journal.recover();
      crash.afterJournalRecovery = await n.f.effects.get(identity.effectId); save();
      const original = await n.f.effects.byCall(identity.runId,identity.parentCallId);
      const resumed = await n.resume(identity.taskId), next = await n.admitNext(resumed,original);
      const response = await n.call(next,identity.raw);
      assert.deepEqual(response,{status:crash.boundary.receipt.status,body:crash.boundary.receipt.body});
      const effect = await n.f.effects.get(identity.effectId); assert.equal(effect.state,'reconciled'); assert.equal(received(pathname),1);
      crash.reconciled = effect; crash.received = received(pathname); save();
      const revision = effect.revision;
      n.close(); n = await openNetworkFixture(crash.directory,origin);
      assert.equal((await n.f.effects.get(identity.effectId)).revision,revision); assert.equal(received(pathname),1);
      report.observations.N05 = {response,effect,received:received(pathname),reconcileHttp:0};
    } finally {n.close();}
  });
  await check('N06', 'Cancellation after real delivery preserves unknown and refuses an unobserved retry', async () => fixture('N06', async (n,run) => {
    const pathname='/N06/hold', request=raw(pathname), controller=new AbortController();
    const pending=n.call(run,request,{signal:controller.signal}).then(value=>({value}),error=>({error:String(error)}));
    await waitReceived(pathname); controller.abort('teacher_cancelled');
    const result=await pending; assert.match(result.error,/cancelled/);
    const effects=await n.records(run.task.id); assert.equal(effects[0].state,'unknown');
    await assert.rejects(n.call(run,request),/side_effect_unknown/); assert.equal(received(pathname),1);
    report.observations.N06={result,effects,received:received(pathname),replayHttp:0};
  }));
  await check('N07', 'Actual Scope revocation aborts a delivered request and renewed grants cannot replay unknown', async () => fixture('N07', async (n,run,grants) => {
    const pathname='/N07/hold',request=raw(pathname);
    const pending=n.call(run,request).then(value=>({value}),error=>({error:String(error)}));
    await waitReceived(pathname);
    const grant=grants.find(item=>item.scope.kind==='network');
    const revoked=await n.engine.revoke(run.sessionId,grant.grantId,grant.revision); assert(revoked.revokedAt);
    const result=await pending; assert.match(result.error,/permission_denied/);
    const effects=await n.records(run.task.id); assert.equal(effects[0].state,'unknown');
    await n.issue(run); await assert.rejects(n.call(run,request),/side_effect_unknown/); assert.equal(received(pathname),1);
    report.observations.N07={result,revoked,effects,received:received(pathname),replayHttp:0};
  }));
  await check('N08', 'A valid foreign Task cannot borrow a parent receipt and stale original owner sends zero HTTP', async () => fixture('N08', async (n,run) => {
    const pathname='/N08/complete',request=raw(pathname);
    const foreign=await n.f.admit(await n.f.fresh()); await n.f.execute(foreign); await n.issue(foreign);
    await assert.rejects(n.call(run,request,{owner:{...foreign.owner,taskId:foreign.task.id}}),/tool_receipt_conflict/);
    assert.equal(received(pathname),0); assert.equal((await n.records(run.task.id)).length,0);
    await n.f.journal.recover();
    await assert.rejects(n.call(run,request),/permission_denied/); assert.equal(received(pathname),0);
    report.observations.N08={received:0,oldOwner:run.owner,foreignOwner:foreign.owner,foreignTaskId:foreign.task.id};
  }));
  report.success=report.checks.length===8&&report.checks.every(item=>item.pass);
} catch(error) {report.error=String(error.stack||error);}
finally {
  for(const socket of sockets) socket.destroy();
  await new Promise(resolve=>server.close(resolve));
  report.sourcesAfter=hashes();
  report.sourceChanges=report.sourcesBefore.filter((item,index)=>item.sha256!==report.sourcesAfter[index].sha256);
  if(report.sourceChanges.length) report.success=false;
  report.scripts=['scripts/xiaozhi-agent/phase6-network-effects-worker.mjs','scripts/xiaozhi-agent/phase6-network-effects-smoke.mjs']
    .map(file=>({file,sha256:digest(fs.readFileSync(file))}));
  report.totalHttpReceived=report.wire.length; report.serverClosed=!server.listening; save();
  console.log(JSON.stringify({root,success:report.success,passed:report.checks.filter(item=>item.pass).length,total:report.checks.length,httpReceived:report.wire.length,sourceChanges:report.sourceChanges.length}));
  if(!report.success) process.exitCode=1;
}
