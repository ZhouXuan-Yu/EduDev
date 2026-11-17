import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {openBudgetLedger} from './phase8-budget-ledger.mjs';
import {startCountingProxy} from './phase8-counting-proxy.mjs';

const output = fs.mkdtempSync(path.join(os.tmpdir(), 'xiaozhi-phase8-real-model-protocol-'));
const report = {success: false, output, checks: [], realProviderCalls: 0, actualGoalLedgerOpened: false,
  boundary: 'Node-only protocol and local HTTP fixtures. No Electron, builds, native UI, real credentials or models.'};
const resources = [];
async function check(name, action) {
  try {await action(); report.checks.push({name, pass: true});}
  catch (error) {report.checks.push({name, pass: false, error: error.stack});}
  console.log(JSON.stringify(report.checks.at(-1)));
}
try {
  const {schedule, tasks, syntheticFiles, validateManifest, preparePlan} = await import('./phase8-real-model-plan.mjs');
  const {installProviderBridge} = await import('./phase8-real-model-transport.mjs');
  const {verifiedRunBinding, exportBlindBundle, readOriginalRecords} = await import('./phase8-real-model-readback.mjs');
  const {executePlan} = await import('./phase8-real-model-run.mjs');
  await check('Frozen plan has exact Q1-Q8 ABBA order and 32 independent identities', () => {
    assert.equal(tasks.length, 8); assert.equal(schedule.length, 32);
    for (const task of tasks) assert.deepEqual(schedule.filter(row => row.task === task.id).map(row => row.version), ['A', 'B', 'B', 'A']);
    assert.equal(new Set(schedule.map(row => row.id)).size, 32);
    assert.equal(syntheticFiles['scores.csv'], 'id,score\nA,60\nB,80\nC,100\n');
    assert.throws(() => validateManifest({schemaVersion: 1, databasePath: path.join(output, 'fixture.sqlite')}));
    assert.equal(typeof executePlan, 'function');
    const prepared = preparePlan(path.join(output, 'prepared'));
    assert.equal(prepared.actualGoalLedgerOpened, false); assert.equal(prepared.runs, 32);
    assert.equal(JSON.parse(fs.readFileSync(path.join(prepared.output, 'manifest-template.json'))).versions.B, null);
  });
  const received = [];
  const upstream = http.createServer(async (request, response) => {
    let bytes = 0; for await (const chunk of request) bytes += chunk.length;
    received.push({path: request.url, bytes, syntheticAuthorization: request.headers.authorization === 'Bearer fixture-value'});
    response.writeHead(request.url === '/fail' ? 503 : 200, {'content-type': 'text/event-stream'});
    response.write('data: {"choices":[{"delta":{"content":"fixture"}}]}\n\n');
    response.end('data: [DONE]\n\n');
  });
  await new Promise(resolve => upstream.listen(0, '127.0.0.1', resolve));
  resources.push(() => new Promise(resolve => {upstream.close(resolve); upstream.closeAllConnections();}));
  const origin = `http://127.0.0.1:${upstream.address().port}`;
  const ledger = openBudgetLedger({databasePath: path.join(output, 'fixture-only.sqlite'), limit: 4});
  resources.push(() => ledger.close());
  const context = {task: 'Q1', version: 'A', round: 1, evidenceRef: 'fixture/Q1-A-r1'};
  const proxy = await startCountingProxy({ledger, providerEndpoint: origin + '/chat', fixtureHttp: true, context});
  resources.push(() => proxy.close());
  let modelGets = 0, delegated = 0;
  const native = async (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input.url);
    if (url.hostname === 'api.deepseek.com') {modelGets++; return new Response('{"data":[]}');}
    if (url.hostname !== '127.0.0.1') {delegated++; return new Response('other allowed transport');}
    return fetch(input, init);
  };
  const net = {fetch: native};
  const bridge = installProviderBridge(net, {chatRoutes: {'/v1/chat/completions': proxy.url, '/chat/completions': proxy.url}});
  resources.push(() => bridge.restore());
  const send = endpoint => net.fetch(endpoint, {method: 'POST', redirect: 'error', headers: {authorization: 'Bearer fixture-value'},
    body: JSON.stringify({model: 'fixture-model', stream: true, temperature: 0.2, max_tokens: 100, thinking: {type: 'disabled'}, messages: [{role: 'user', content: 'fixture body excluded from telemetry'}]})});
  await check('Provider-scoped net bridge meters both exact chat paths and records only safe actual-wire fields', async () => {
    const globalFetch = globalThis.fetch;
    for (const suffix of ['/v1/chat/completions', '/chat/completions']) {
      const response = await send('https://api.deepseek.com' + suffix); assert((await response.text()).includes('[DONE]'));
    }
    assert.equal(globalThis.fetch, globalFetch); assert.equal(received.length, 2); assert(received.every(row => row.syntheticAuthorization));
    assert.equal(ledger.summary().used, 2); assert.equal(bridge.snapshot().chats.length, 2);
    const rows = bridge.snapshot().chats;
    assert(rows.every(row => row.configuration.model === 'fixture-model' && row.firstByteAt !== null && row.endAt !== null));
    const safe = JSON.stringify({rows, attempts: ledger.attempts()});
    assert(!safe.includes('fixture-value')); assert(!safe.includes('fixture body excluded from telemetry'));
    assert(!safe.includes('messages')); assert(!safe.includes('authorization'));
  });
  await check('Models GET is separately observed and unknown provider routes fail before any upstream reservation', async () => {
    await net.fetch('https://api.deepseek.com/v1/models', {redirect: 'error'});
    await net.fetch('https://example.test/resource', {redirect: 'error'});
    await assert.rejects(() => send('https://api.deepseek.com/v1/unrecognized'));
    await assert.rejects(() => send('https://api.deepseek.com/v1/chat/completions?unexpected=1'));
    assert.equal(modelGets, 1); assert.equal(delegated, 1); assert.equal(ledger.summary().used, 2);
    assert.equal(bridge.snapshot().models.length, 1); assert.equal(bridge.snapshot().rejected.length, 2);
  });
  await check('Subsequent SDK-shaped HTTP attempts each consume allowance and budget rejection occurs before upstream', async () => {
    for (let attempt = 0; attempt < 3; attempt++) {const response = await send('https://api.deepseek.com/v1/chat/completions'); await response.text();}
    assert.equal(received.length, 4); assert.equal(ledger.summary().used, 4);
    assert.equal(bridge.snapshot().chats.at(-1).httpStatus, 429);
    assert.equal(ledger.attempts().length, 4);
  });
  await check('Original SQLite Run identity is required before binding all actual attempts to a runtime Run', () => {
    const dbPath = path.join(output, 'app-fixture.sqlite');
    const db = new DatabaseSync(dbPath);
    db.exec("CREATE TABLE ai_agent_runs(id TEXT,session_id TEXT,status TEXT,model TEXT); CREATE TABLE app_settings(key TEXT,value_json TEXT);");
    db.prepare('INSERT INTO ai_agent_runs VALUES(?,?,?,?)').run('run_fixture', 'session_fixture', 'succeeded', 'fixture-model'); db.close();
    const records = readOriginalRecords(dbPath, 'session_fixture', 'run_fixture');
    const binding = verifiedRunBinding({sessionId: 'session_fixture', runId: 'run_fixture', records,
      snapshot: {projection: {turns: [{id: 'run_fixture'}]}}});
    assert.equal(binding.taskId, null); assert.equal(binding.runId, 'run_fixture');
    assert.throws(() => verifiedRunBinding({...binding, records, snapshot: {projection: {turns: [{id: 'wrong'}]}}}));
    for (const attempt of ledger.attempts()) ledger.bindRun(attempt.reservationId, binding.runId);
    assert(ledger.attempts().every(row => row.context.runId === binding.runId));
  });
  await check('Blind export preserves artifact bytes and keeps version identity in a separate map', () => {
    const artifact = path.join(output, 'synthetic.txt'); fs.writeFileSync(artifact, 'synthetic artifact');
    const result = exportBlindBundle(path.join(output, 'blind'), [{id: 'Q1-r1-A', task: 'Q1', version: 'A', round: 1,
      answer: '合成回答', artifacts: [{path: artifact, relativePath: 'synthetic.txt'}]}]);
    assert.equal(result.samples.length, 1);
    const sample = JSON.parse(fs.readFileSync(path.join(output, 'blind', result.samples[0].id, 'sample.json')));
    assert.equal(sample.task, 'Q1'); assert(!Object.hasOwn(sample, 'version')); assert(!Object.hasOwn(sample, 'runId'));
    assert.equal(fs.readFileSync(path.join(output, 'blind', result.samples[0].id, 'artifacts/synthetic.txt'), 'utf8'), 'synthetic artifact');
  });
  report.budget = ledger.summary(); report.success = report.checks.length === 6 && report.checks.every(row => row.pass);
} catch (error) {report.error = error.stack;}
finally {
  for (const close of resources.reverse()) await close();
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({success: report.success, passed: report.checks.filter(row => row.pass).length, total: report.checks.length, output, error: report.error}));
  if (!report.success) process.exitCode = 1;
}
