import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {fork, spawn} from 'node:child_process';
import {once} from 'node:events';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';

const output = fs.mkdtempSync(path.join(os.tmpdir(), 'xiaozhi-phase8-budget-'));
const checks = [];
const report = {success: false, output, checks, realModelCalls: 0, error: undefined};
const workerFile = fileURLToPath(new URL('./phase8-budget-test-worker.mjs', import.meta.url));
const secret = 'sk-synthetic-NeverPersistKey-849217';
const privateBody = 'SYNTHETIC_PRIVATE_BODY_645391';
const privateResponse = 'SYNTHETIC_RESPONSE_931645';
let openBudgetLedger, startCountingProxy;
const databasePath = name => path.join(output, name + '.sqlite');
const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

async function until(test) {
  const deadline = Date.now() + 8000;
  while (!test()) {
    if (Date.now() >= deadline) throw Error('test_deadline');
    await delay(10);
  }
}

async function check(name, action) {
  const started = performance.now();
  try {
    await action();
    checks.push({name, pass: true, durationMs: performance.now() - started});
  } catch (error) {
    checks.push({name, pass: false, error: error.stack});
  }
  console.log(JSON.stringify(checks.at(-1)));
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
}

function spawnWorker(mode, options) {
  const child = fork(workerFile, [mode, JSON.stringify(options)], {windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe', 'ipc']});
  const messages = [];
  let stderr = '';
  child.on('message', message => messages.push(message));
  child.stderr.on('data', bytes => {stderr = (stderr + bytes).slice(-16384);});
  child.stdout.on('data', () => {});
  const exited = once(child, 'exit');
  return {child, messages, exited, stderr: () => stderr};
}

async function message(worker, kind) {
  await until(() => worker.messages.some(item => item.kind === kind || item.kind === 'error'));
  const failure = worker.messages.find(item => item.kind === 'error');
  assert(!failure, JSON.stringify(failure));
  return worker.messages.find(item => item.kind === kind);
}

async function fixture() {
  const hits = [];
  let redirects = 0;
  const sockets = new Set();
  const redirectServer = http.createServer((_request, response) => {redirects++; response.end('unexpected');});
  redirectServer.listen(0, '127.0.0.1'); await once(redirectServer, 'listening');
  const server = http.createServer(async (request, response) => {
    let raw = '';
    for await (const bytes of request) raw += bytes;
    const body = JSON.parse(raw);
    const hit = {url: request.url, auth: request.headers.authorization, extra: request.headers['x-extra'],
      closed: false, mode: body.mode, drains: 0, finishedAt: null};
    hits.push(hit);
    response.once('close', () => {hit.closed = true;});
    response.once('finish', () => {hit.finishedAt = Date.now();});
    if (body.mode === 'redirect') {
      response.writeHead(307, {location: `http://127.0.0.1:${redirectServer.address().port}/secret`});
      response.end();
    } else if (body.mode === 'hang') {
      // The proxy deadline or client cancellation must close this socket.
    } else if (body.mode === 'failed') {
      response.writeHead(503, {'content-type': 'application/json'}); response.end('{"error":"fixture"}');
    } else if (body.mode === 'socket-error') {
      response.destroy();
    } else {
      response.writeHead(200, {'content-type': 'text/event-stream'});
      response.write('data: ' + privateResponse + '\n\n');
      if (body.mode === 'pressure') {
        const frame = 'data: ' + 'p'.repeat(65528) + '\n\n';
        for (let index = 0; index < 256; index++) {
          if (!response.write(frame)) {hit.drains++; await once(response, 'drain');}
        }
        response.end('data: [DONE]\n\n');
      }
      if (body.mode === 'sse') setTimeout(() => response.end('data: [DONE]\n\n'), 80);
      if (body.mode === 'disconnect') setTimeout(() => response.destroy(), 30);
    }
  });
  server.on('connection', socket => {sockets.add(socket); socket.on('close', () => sockets.delete(socket));});
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  return {hits, redirects: () => redirects, endpoint: `http://127.0.0.1:${server.address().port}/fixed`,
    async close() {for (const socket of sockets) socket.destroy(); server.close(); redirectServer.close();
      await Promise.all([once(server, 'close'), once(redirectServer, 'close')]);}};
}

function post(url, mode, extra = {}) {
  return fetch(url, {method: 'POST', headers: {authorization: 'Bearer ' + secret,
    'content-type': 'application/json', 'x-extra': secret}, body: JSON.stringify({mode, text: privateBody}), ...extra});
}

try {
  ({openBudgetLedger} = await import('./phase8-budget-ledger.mjs'));
  ({startCountingProxy} = await import('./phase8-counting-proxy.mjs'));

  await check('SQLite cap and imported usage are immutable and reservations survive reopen without refunds', async () => {
    const file = databasePath('immutable');
    let ledger = openBudgetLedger({databasePath: file, limit: 3, initialUsed: 1});
    const one = ledger.reserve({task: 'Q1', version: 'A', round: 1});
    assert.equal(one.sequence, 2);
    assert.deepEqual(ledger.summary().durability, {journalMode: 'wal', synchronous: 2});
    assert.throws(() => ledger.finish(one.reservationId, {state: 'completed', elapsedMs: 1, responseBytes: 0}),
      {code: 'budget_state_conflict'});
    ledger.reserve({task: 'Q1', version: 'B', round: 1});
    assert.equal(ledger.summary().used, 3);
    assert.throws(() => ledger.reserve({task: 'Q1'}), {code: 'budget_exhausted'});
    ledger.close();
    assert.throws(() => openBudgetLedger({databasePath: file, limit: 4}), {code: 'budget_configuration_conflict'});
    assert.throws(() => openBudgetLedger({databasePath: file, initialUsed: 0}), {code: 'budget_configuration_conflict'});
    assert.throws(() => openBudgetLedger({databasePath: databasePath('over200'), limit: 201}), {code: 'budget_invalid_configuration'});
    ledger = openBudgetLedger({databasePath: file});
    assert.equal(ledger.summary().remaining, 0);
    assert.equal(ledger.attempts()[0].reservationId, one.reservationId);
    assert.equal(ledger.attempts()[0].state, 'reserved');
    ledger.close();
  });

  await check('Only safe context fields persist and runtime Run binding is append-only', async () => {
    const ledger = openBudgetLedger({databasePath: databasePath('context'), limit: 10});
    try {
      for (const context of [{task: 'Q1', extra: secret}, {task: secret}, {evidenceRef: '../private'},
        {runId: 'email@example.test'}, {round: 0}]) {
        assert.throws(() => ledger.reserve(context), {code: 'budget_invalid_context'});
      }
      assert.equal(ledger.summary().used, 0);
      const reservation = ledger.reserve({task: 'Q1', version: 'A', round: 2, evidenceRef: 'phase8/Q1/round2'});
      ledger.bindRun(reservation.reservationId, 'xirun_synthetic_1');
      ledger.bindRun(reservation.reservationId, 'xirun_synthetic_1');
      assert.throws(() => ledger.bindRun(reservation.reservationId, 'xirun_other'), {code: 'budget_context_conflict'});
      assert.equal(ledger.attempts()[0].context.runId, 'xirun_synthetic_1');
      assert.equal(ledger.events(reservation.reservationId).filter(item => item.kind === 'run_bound').length, 1);
    } finally {ledger.close();}
  });

  await check('Eight real processes contend for the same WAL ledger and stop exactly at the fixed cap', async () => {
    const file = databasePath('parallel');
    const ledger = openBudgetLedger({databasePath: file, limit: 37, initialUsed: 3});
    const workers = Array.from({length: 8}, () => spawnWorker('reserve', {databasePath: file, count: 12}));
    try {
      await Promise.all(workers.map(worker => message(worker, 'ready')));
      for (const worker of workers) worker.child.send({go: true});
      const results = await Promise.all(workers.map(worker => message(worker, 'done')));
      await Promise.all(workers.map(worker => worker.exited));
      assert.equal(results.reduce((sum, item) => sum + item.reserved, 0), 34);
      assert.equal(ledger.summary().used, 37);
      assert.equal(ledger.attempts().length, 34);
      assert.equal(new Set(ledger.attempts().map(item => item.sequence)).size, 34);
    } finally {for (const worker of workers) if (worker.child.exitCode === null) worker.child.kill('SIGKILL'); ledger.close();}
  });

  await check('SIGKILL after durable reserve or dispatch consumes the original allowance across restart', async () => {
    const file = databasePath('killed');
    let ledger = openBudgetLedger({databasePath: file, limit: 2}); ledger.close();
    for (const dispatch of [false, true]) {
      const worker = spawnWorker('hold', {databasePath: file, dispatch});
      await message(worker, 'reserved'); worker.child.kill('SIGKILL'); await worker.exited;
    }
    ledger = openBudgetLedger({databasePath: file});
    try {
      assert.equal(ledger.summary().used, 2);
      assert.deepEqual(ledger.attempts().map(item => item.state), ['reserved', 'dispatching']);
      assert.throws(() => ledger.reserve({task: 'Q2'}), {code: 'budget_exhausted'});
    } finally {ledger.close();}
  });

  await check('Proxy fixes origin route and header allowlists, streams SSE and counts SDK-like retry attempts separately', async () => {
    const upstream = await fixture();
    const ledger = openBudgetLedger({databasePath: databasePath('stream'), limit: 10});
    const proxy = await startCountingProxy({ledger, providerEndpoint: upstream.endpoint, fixtureHttp: true,
      context: {task: 'Q3', version: 'B', round: 1}, requestTimeoutMs: 2000});
    try {
      const response = await post(proxy.url, 'sse');
      const reader = response.body.getReader();
      const first = await reader.read(); assert(Buffer.from(first.value).toString().includes(privateResponse));
      assert.equal(ledger.attempts()[0].state, 'response');
      let tail = ''; for (;;) {const part = await reader.read(); if (part.done) break; tail += Buffer.from(part.value);}
      assert(tail.includes('[DONE]'));
      for (let attempt = 0; attempt < 2; attempt++) {
        const failed = await post(proxy.url, 'failed'); assert.equal(failed.status, 503); await failed.text();
      }
      await until(() => ledger.attempts().every(item => item.finishedAt));
      assert.equal(upstream.hits.length, 3);
      assert(upstream.hits.every(item => item.url === '/fixed' && item.auth === 'Bearer ' + secret && !item.extra));
      assert.deepEqual(ledger.attempts().map(item => item.state), ['completed', 'http_error', 'http_error']);
      assert(ledger.attempts().every(item => item.context.task === 'Q3' && item.context.attempt === item.sequence));
      assert(ledger.attempts()[0].responseBytes > 0);
      assert.equal((await fetch(proxy.url.replace('/v1/chat/completions', '/other'))).status, 404);
      assert.equal((await fetch(proxy.url)).status, 405);
      assert.equal(ledger.summary().used, 3);
    } finally {await proxy.close(); ledger.close(); await upstream.close();}
  });

  await check('Redirects never reach a second origin and timeout failure cancels the upstream socket', async () => {
    const upstream = await fixture();
    const ledger = openBudgetLedger({databasePath: databasePath('failures'), limit: 10});
    const proxy = await startCountingProxy({ledger, providerEndpoint: upstream.endpoint, fixtureHttp: true,
      requestTimeoutMs: 80, context: {task: 'Q5', version: 'A', round: 1}});
    try {
      const redirect = await post(proxy.url, 'redirect'); assert.equal(redirect.status, 502); await redirect.text();
      const timeout = await post(proxy.url, 'hang'); assert.equal(timeout.status, 504); await timeout.text();
      const socketFailure = await post(proxy.url, 'socket-error'); assert.equal(socketFailure.status, 502); await socketFailure.text();
      await until(() => upstream.hits.every(item => item.closed));
      assert.equal(upstream.redirects(), 0);
      assert.deepEqual(ledger.attempts().map(item => item.state), ['redirect_rejected', 'timed_out', 'failed']);
      assert.equal(ledger.attempts()[0].httpStatus, 307);
      for (const endpoint of ['http://example.test/model', 'https://user:password@example.test/model',
        'https://example.test/model?key=private', 'https://example.test/model#private']) {
        await assert.rejects(startCountingProxy({ledger, providerEndpoint: endpoint}), {code: 'proxy_invalid_configuration'});
      }
    } finally {await proxy.close(); ledger.close(); await upstream.close();}
  });

  await check('A paused real HTTP consumer propagates backpressure and preserves every SSE byte', async () => {
    const upstream = await fixture();
    const ledger = openBudgetLedger({databasePath: databasePath('backpressure'), limit: 1});
    const proxy = await startCountingProxy({ledger, providerEndpoint: upstream.endpoint, fixtureHttp: true,
      requestTimeoutMs: 4000, context: {task: 'Q3', version: 'A', round: 2}});
    try {
      assert.equal(proxy.baseURL, proxy.url.replace('/chat/completions', ''));
      let resumedAt;
      const bytes = await new Promise((resolve, reject) => {
        const body = JSON.stringify({mode: 'pressure', text: privateBody});
        const request = http.request(proxy.url, {method: 'POST', headers: {authorization: 'Bearer ' + secret,
          'content-type': 'application/json', 'content-length': Buffer.byteLength(body)}}, response => {
          let size = 0;
          response.pause();
          setTimeout(() => {resumedAt = Date.now(); response.resume();}, 120);
          response.on('data', chunk => {size += chunk.length;});
          response.once('error', reject); response.once('end', () => resolve(size));
        });
        request.once('error', reject); request.end(body);
      });
      await until(() => ledger.attempts()[0].finishedAt);
      assert(bytes > 16 * 1024 * 1024);
      assert(upstream.hits[0].drains > 0);
      assert(upstream.hits[0].finishedAt >= resumedAt);
      assert.equal(ledger.attempts()[0].responseBytes, bytes);
      report.backpressure = {responseBytes: bytes, upstreamDrains: upstream.hits[0].drains,
        finishedAfterConsumerResumed: true};
    } finally {await proxy.close(); ledger.close(); await upstream.close();}
  });

  await check('The CLI shares the same ledger, binds Run identity and leaves missing status paths untouched', async () => {
    const cli = fileURLToPath(new URL('./phase8-budget-cli.mjs', import.meta.url));
    const file = databasePath('cli');
    const ledger = openBudgetLedger({databasePath: file, limit: 1});
    const reservation = ledger.reserve({task: 'Q1', version: 'A', round: 1}); ledger.close();
    async function run(args) {
      const child = spawn(process.execPath, [cli, ...args], {windowsHide: true});
      let stdout = '', stderr = '';
      child.stdout.on('data', bytes => {stdout += bytes;}); child.stderr.on('data', bytes => {stderr += bytes;});
      const [code] = await once(child, 'exit');
      return {code, stdout, stderr};
    }
    const binding = await run(['bind-run', file, reservation.reservationId, 'xirun_cli']);
    assert.equal(binding.code, 0); assert.equal(JSON.parse(binding.stdout).attempts[0].context.runId, 'xirun_cli');
    const status = await run(['status', file]); assert.equal(status.code, 0); assert.equal(JSON.parse(status.stdout).budget.used, 1);
    const denied = await run(['authorize-unlimited', file]);
    assert.equal(denied.code, 1);
    assert.match(denied.stderr, /budget_explicit_authorization_required/u);
    const authorized = await run(['authorize-unlimited', file, '--user-authorized']);
    assert.equal(authorized.code, 0);
    const budget = JSON.parse(authorized.stdout).budget;
    assert.equal(budget.used, 1);
    assert.equal(budget.limit, null);
    assert.equal(budget.remaining, null);
    assert.equal(budget.authorization.previousLimit, 1);
    const reopened = openBudgetLedger({databasePath: file, limit: 1});
    try {
      assert.equal(reopened.reserve().sequence, 2);
      reopened.authorizeUnlimited();
      assert.deepEqual(reopened.summary().authorization, budget.authorization);
      assert.equal(reopened.attempts()[0].reservationId, reservation.reservationId);
      assert.equal(reopened.summary().used, 2);
    } finally {reopened.close();}
    const missingFile = databasePath('missing-status');
    const missing = await run(['status', missingFile]); assert.equal(missing.code, 1); assert(!fs.existsSync(missingFile));
  });

  await check('Client cancellation and truncated upstream SSE retain charged terminal outcomes', async () => {
    const upstream = await fixture();
    const ledger = openBudgetLedger({databasePath: databasePath('cancel'), limit: 10});
    const proxy = await startCountingProxy({ledger, providerEndpoint: upstream.endpoint, fixtureHttp: true,
      requestTimeoutMs: 2000, context: {task: 'Q7', version: 'B', round: 1}});
    try {
      const controller = new AbortController();
      const response = await post(proxy.url, 'cancel', {signal: controller.signal});
      await response.body.getReader().read(); controller.abort();
      await until(() => ledger.attempts()[0].state === 'client_cancelled' && upstream.hits[0].closed);
      const partial = await post(proxy.url, 'disconnect');
      await assert.rejects(partial.text());
      await until(() => ledger.attempts()[1].state === 'failed');
      assert.equal(ledger.summary().used, 2);
    } finally {await proxy.close(); ledger.close(); await upstream.close();}
  });

  await check('Concurrent HTTP attempts stop before the upstream at exhaustion and oversized bodies use no allowance', async () => {
    const upstream = await fixture();
    const ledger = openBudgetLedger({databasePath: databasePath('cutoff'), limit: 4});
    const proxy = await startCountingProxy({ledger, providerEndpoint: upstream.endpoint, fixtureHttp: true,
      maximumRequestBytes: 1000, context: {task: 'Q4', version: 'A', round: 1}});
    try {
      const large = await fetch(proxy.url, {method: 'POST', body: 'x'.repeat(1001)});
      assert.equal(large.status, 413); await large.text(); assert.equal(ledger.summary().used, 0);
      const replies = await Promise.all(Array.from({length: 9}, async () => {
        const response = await post(proxy.url, 'sse'); await response.text(); return response.status;
      }));
      assert.equal(replies.filter(status => status === 200).length, 4);
      assert.equal(replies.filter(status => status === 429).length, 5);
      assert.equal(upstream.hits.length, 4); assert.equal(ledger.summary().used, 4);
    } finally {await proxy.close(); ledger.close(); await upstream.close();}
  });

  await check('Killing the proxy after a real fixture HTTP arrival preserves the pre-send dispatch reservation', async () => {
    const upstream = await fixture();
    const file = databasePath('proxy-crash');
    let ledger = openBudgetLedger({databasePath: file, limit: 1}); ledger.close();
    const worker = spawnWorker('proxy', {databasePath: file, endpoint: upstream.endpoint});
    try {
      const listening = await message(worker, 'listening');
      const request = post(listening.url, 'hang').catch(() => undefined);
      await until(() => upstream.hits.length === 1);
      worker.child.kill('SIGKILL'); await worker.exited; await request;
      ledger = openBudgetLedger({databasePath: file});
      assert.equal(ledger.summary().remaining, 0);
      assert.equal(ledger.attempts()[0].state, 'dispatching');
      ledger.close();
    } finally {if (worker.child.exitCode === null) worker.child.kill('SIGKILL'); await upstream.close();}
  });

  await check('Ledger pragmas and raw SQLite files contain only allowed metadata without keys or message bodies', async () => {
    for (const name of fs.readdirSync(output).filter(name => name.endsWith('.sqlite'))) {
      const db = new DatabaseSync(path.join(output, name));
      try {
        assert.equal(db.prepare('PRAGMA journal_mode').get().journal_mode, 'wal');
        assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
        db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
      } finally {db.close();}
    }
    for (const name of fs.readdirSync(output).filter(name => /\.sqlite(?:-wal|-shm)?$/.test(name))) {
      const bytes = fs.readFileSync(path.join(output, name));
      for (const value of [secret, privateBody, privateResponse]) assert(!bytes.includes(Buffer.from(value)), name);
    }
  });
  report.success = checks.length === 12 && checks.every(item => item.pass);
} catch (error) {
  report.error = error.stack;
} finally {
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({success: report.success, passed: checks.filter(item => item.pass).length,
    total: checks.length, output, error: report.error}));
  if (!report.success) process.exitCode = 1;
}
