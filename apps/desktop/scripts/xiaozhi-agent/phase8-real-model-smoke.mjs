import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {JSDOM} from 'jsdom';
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
  const {executePlan, rendererObservation, collectScheduledRuns} = await import('./phase8-real-model-run.mjs');
  await check('Frozen plan has exact Q1-Q8 ABBA order, 32 identities and precise role-submit observation', () => {
    assert.equal(tasks.length, 8); assert.equal(schedule.length, 32);
    for (const task of tasks) assert.deepEqual(schedule.filter(row => row.task === task.id).map(row => row.version), ['A', 'B', 'B', 'A']);
    assert.equal(new Set(schedule.map(row => row.id)).size, 32);
    assert.equal(syntheticFiles['scores.csv'], 'id,score\nA,60\nB,80\nC,100\n');
    assert.throws(() => validateManifest({schemaVersion: 1, databasePath: path.join(output, 'fixture.sqlite')}));
    assert.equal(typeof executePlan, 'function');
    const prepared = preparePlan(path.join(output, 'prepared'));
    assert.equal(prepared.actualGoalLedgerOpened, false); assert.equal(prepared.runs, 32);
    assert.equal(JSON.parse(fs.readFileSync(path.join(prepared.output, 'manifest-template.json'))).versions.B, null);
    const dom = new JSDOM('<button aria-label="发送消息" data-phase8-real-submit="true"><span>发送</span></button><button aria-label="其他操作">其他</button>');
    const previousWindow = globalThis.window, previousDocument = globalThis.document;
    try {
      globalThis.window = dom.window; globalThis.document = dom.window.document;
      window.omniEdu = {onXiaozhiEvent: () => () => {}};
      assert.equal(document.querySelector('[data-testid="office-prompt-send"]'), null);
      rendererObservation();
      document.querySelector('[aria-label="发送消息"]').dispatchEvent(new window.KeyboardEvent('keydown', {key: 'Tab', bubbles: true}));
      document.querySelector('span').dispatchEvent(new window.MouseEvent('click', {bubbles: true}));
      document.querySelector('[aria-label="其他操作"]').click();
      const observed = window.phase8RealObservation.snapshot();
      report.submitObservation = {count: observed.submissions.length, trusted: observed.submissions[0]?.trusted ?? null,
        boundary: 'Actual DOM marker matching in JSDOM. DOM event is untrusted. Actual Electron trusted click remains NOT_TESTED.'};
      assert.equal(observed.submissions.length, 1); assert.equal(observed.submissions[0].trusted, false);
    } finally {
      window.phase8RealObservation?.dispose(); dom.window.close();
      if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow;
      if (previousDocument === undefined) delete globalThis.document; else globalThis.document = previousDocument;
    }
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
  function collectionFixture(name, {limit = 64, initialUsed = 0} = {}) {
    const directory = path.join(output, name); fs.mkdirSync(directory);
    const databasePath = path.join(directory, 'protocol-budget.sqlite');
    const budget = openBudgetLedger({databasePath, limit, initialUsed}); resources.push(() => budget.close());
    const calls = [];
    const manifest = {model: {id: 'fixture-model', expectedWire: {stream: true, thinking: {type: 'disabled'}}}};
    async function collect(row, settings, _version, actualLedger, destination) {
      calls.push(row.id);
      const root = path.join(destination, row.id); fs.mkdirSync(root, {recursive: true});
      const sessionId = 'session_' + row.id, runId = 'run_' + row.id.replaceAll('-', '_');
      const file = path.join(root, 'app-fixture.sqlite'), db = new DatabaseSync(file);
      db.exec('CREATE TABLE ai_agent_runs(id TEXT,session_id TEXT,status TEXT,model TEXT);');
      db.prepare('INSERT INTO ai_agent_runs VALUES(?,?,?,?)').run(runId, sessionId, 'failed', settings.model.id); db.close();
      const snapshot = {projection: {turns: [{id: runId, status: 'failed'}]}};
      const records = readOriginalRecords(file, sessionId, runId);
      const binding = verifiedRunBinding({sessionId, runId, snapshot, records});
      const context = {task: row.task, version: row.version, round: row.round,
        evidenceRef: 'phase8-real/' + path.basename(destination) + '/' + row.id};
      const attempt = actualLedger.reserve(context);
      actualLedger.markDispatching(attempt.reservationId, 1); actualLedger.markResponse(attempt.reservationId, 200);
      actualLedger.finish(attempt.reservationId, {state: 'completed', elapsedMs: 1, responseBytes: 1});
      actualLedger.bindRun(attempt.reservationId, runId);
      const artifact = path.join(root, 'objective-failure.txt'); fs.writeFileSync(artifact, 'preserved synthetic quality failure');
      return {...row, output: root, collectionStatus: 'PASS', qualityStatus: 'FAIL', terminal: 'failed',
        binding, snapshot, records, coldRecords: readOriginalRecords(file, sessionId, runId),
        attempts: actualLedger.attempts().filter(item => item.context.evidenceRef === context.evidenceRef),
        transport: {chats: [{index: 1, path: '/v1/chat/completions', method: 'POST', state: 'completed', httpStatus: 200,
          configuration: {model: settings.model.id, stream: true, thinking: {type: 'disabled'}}}], rejected: []},
        answer: 'synthetic objective failure retained for review', artifacts: [{path: artifact, relativePath: 'objective-failure.txt'}]};
    }
    return {directory, databasePath, budget, calls, manifest, collect};
  }
  await check('Executable preflight dispatches only fixed Q1 A/B and full collection preserves 32 quality failures', async () => {
    assert.equal(typeof collectScheduledRuns, 'function');
    const beforeHttp = received.length, pair = collectionFixture('preflight-pair');
    const result = await collectScheduledRuns({mode: 'preflight', manifest: pair.manifest, versions: {}, ledger: pair.budget,
      output: pair.directory, collect: pair.collect});
    assert.deepEqual(pair.calls, ['Q1-r1-A', 'Q1-r1-B']); assert.equal(result.stoppedAt, null);
    assert.deepEqual(result.results.map(row => row.id), pair.calls); assert.equal(pair.budget.summary().used, 2);
    const full = collectionFixture('full-quality-failures');
    const all = await collectScheduledRuns({mode: 'execute', manifest: full.manifest, versions: {}, ledger: full.budget,
      output: full.directory, collect: full.collect});
    assert.deepEqual(full.calls, schedule.map(row => row.id)); assert.equal(all.stoppedAt, null);
    assert(all.results.every(row => row.qualityStatus === 'FAIL' && row.terminal === 'failed' && row.collectionStatus === 'PASS'));
    assert.equal(full.budget.summary().used, 32);
    for (const row of all.results) {
      assert.equal(JSON.parse(fs.readFileSync(path.join(row.output, 'report.json'))).qualityStatus, 'FAIL');
      assert.equal(fs.readFileSync(row.artifacts[0].path, 'utf8'), 'preserved synthetic quality failure');
    }
    report.collectionControl = {preflightCalls: pair.calls, fullCalls: full.calls, qualityFailuresPreserved: all.results.length,
      boundary: 'Same actual serial loop as executePlan. Collector callbacks produce synthetic rows using owned SQLite original Run validation and real TEMP budget reservations. These reservations simulate dispatch and make no HTTP request.'};
    assert.equal(received.length, beforeHttp);
  });
  await check('Executable collection stops dispatch on infrastructure/binding/wire errors and preserves spent allowance', async () => {
    assert.equal(typeof collectScheduledRuns, 'function');
    const cases = [
      ['collection_failure', row => ({...row, collectionStatus: 'FAIL', error: 'phase8_collection_failed'})],
      ['collector_throw', () => {throw Error('phase8_collection_failed');}],
      ['binding_failure', row => ({...row, bindingError: 'phase8_attempt_binding_or_readback_failed'})],
      ['wrong_run', row => ({...row, binding: {...row.binding, runId: 'wrong_run'}})],
      ['unbound_attempt', row => ({...row, attempts: row.attempts.map(item => ({...item, context: {...item.context, runId: 'wrong_run'}}))})],
      ['route_rejected', row => ({...row, transport: {...row.transport, rejected: [{code: 'provider_route_rejected'}]}})],
      ['wrong_model', row => ({...row, transport: {...row.transport, chats: row.transport.chats.map(item => ({...item, configuration: {...item.configuration, model: 'wrong-model'}}))}})],
      ['wrong_thinking', row => ({...row, transport: {...row.transport, chats: row.transport.chats.map(item => ({...item, configuration: {...item.configuration, thinking: {type: 'enabled'}}}))}})],
      ['provider_failure', row => ({...row, transport: {...row.transport, chats: row.transport.chats.map(item => ({...item, httpStatus: 401}))}})],
    ];
    const observations = [];
    for (const [name, mutate] of cases) {
      const fixture = collectionFixture('stop-' + name);
      const result = await collectScheduledRuns({manifest: fixture.manifest, versions: {}, ledger: fixture.budget,
        output: fixture.directory, collect: async (...args) => mutate(await fixture.collect(...args))});
      assert.equal(fixture.calls.length, 1, name); assert.equal(result.stoppedAt.id, schedule[0].id, name);
      assert.equal(result.results.length, 32); assert.equal(result.results[0].collectionStatus, 'FAIL');
      assert(result.results.slice(1).every(row => row.collectionStatus === 'NOT_TESTED'));
      assert.equal(JSON.parse(fs.readFileSync(path.join(fixture.directory, schedule[0].id, 'report.json'))).collectionStatus, 'FAIL');
      const used = fixture.budget.summary().used; assert.equal(used, 1);
      fixture.budget.close(); const reopened = openBudgetLedger({databasePath: fixture.databasePath});
      try {assert.equal(reopened.summary().used, used);} finally {reopened.close();}
      observations.push({name, calls: fixture.calls, stoppedAt: result.stoppedAt, used});
    }
    const parity = collectionFixture('thinking-parity'); parity.manifest.model.expectedWire = {stream: true};
    const different = await collectScheduledRuns({manifest: parity.manifest, versions: {}, ledger: parity.budget, output: parity.directory,
      collect: async (...args) => {
        const row = await parity.collect(...args);
        if (row.version === 'B') row.transport.chats[0].configuration.thinking = {type: 'enabled'};
        return row;
      }});
    assert.deepEqual(parity.calls, ['Q1-r1-A', 'Q1-r1-B']); assert.equal(different.stoppedAt.id, 'Q1-r1-B');
    const empty = collectionFixture('exhausted', {limit: 1, initialUsed: 1});
    const exhausted = await collectScheduledRuns({manifest: empty.manifest, versions: {}, ledger: empty.budget, output: empty.directory, collect: empty.collect});
    assert.equal(empty.calls.length, 0); assert.equal(empty.budget.summary().used, 1); assert(exhausted.stoppedAt);
    report.stopControl = {cases: observations, thinkingParityCalls: parity.calls, exhaustedDispatches: empty.calls.length};
  });
  report.budget = ledger.summary(); report.success = report.checks.length === 8 && report.checks.every(row => row.pass);
} catch (error) {report.error = error.stack;}
finally {
  for (const close of resources.reverse()) await close();
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({success: report.success, passed: report.checks.filter(row => row.pass).length, total: report.checks.length, output, error: report.error}));
  if (!report.success) process.exitCode = 1;
}
