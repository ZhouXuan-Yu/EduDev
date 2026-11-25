import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {test} from 'node:test';
import {startMcpFixture} from './fixtures/mcp-server.mjs';

const {createMcpRuntime} = await import('../../src/main/xiaozhi-agent/mcp-runtime.ts');
const evidence = process.env.OMNI_EDU_PROVIDER_ACCEPTANCE_ROOT;
assert(evidence && path.isAbsolute(evidence), 'Set the isolated Provider acceptance root');

function deferred() {
  let resolve;
  const promise = new Promise(done => {resolve = done;});
  return {promise, resolve};
}

async function scenario(label, verify, healthNow) {
  const root = await fs.mkdtemp(path.join(await fs.realpath(evidence), 'mcp-sqlite-generation-'));
  const filename = path.join(root, 'isolated.sqlite');
  let db = new DatabaseSync(filename);
  db.exec('CREATE TABLE app_settings(key TEXT PRIMARY KEY,value_json TEXT NOT NULL,updated_at TEXT NOT NULL)');
  const read = () => JSON.parse(db.prepare('SELECT value_json FROM app_settings WHERE key=?').get('xiaozhi.mcp.v1').value_json);
  const sql = {all: async (query, values = []) => db.prepare(query).all(...values),
    change: async (query, values = []) => Number(db.prepare(query).run(...values).changes)};
  // Synthetic fixture credentials. This test exercises SQLite generations, not secret storage.
  const codec = {available: () => true, seal: value => Buffer.from(value).toString('base64'),
    open: value => Buffer.from(value, 'base64').toString()};
  let sanitize = text => text;
  let runtime = createMcpRuntime(sql, codec, {timeoutMs: 1300, sanitize: text => sanitize(text), healthNow, healthRandom: () => 0});
  const fixture = await startMcpFixture();
  const report = {label, root, transport: 'real loopback HTTP + cold SQLite', http: fixture.url, success: false};
  try {
    const added = await runtime.add({name: 'Isolated generation fixture', transport: 'http', url: fixture.url,
      bearerToken: 'SYNTHETIC_MCP_A_ONLY'});
    const id = added.servers[0].id;
    const input = async () => {
      const catalog = await runtime.catalog();
      return {schemaVersion: catalog.schemaVersion, revision: catalog.revision, serverId: id};
    };
    const observed = await runtime.inspect(await input());
    const schemaHash = observed.servers[0].schemaHash;
    await runtime.trust({...await input(), schemaHash, tools: ['lookup_lesson']});
    await verify({
      runtime, fixture, id, input, read, report, schemaHash, setSanitizer: next => {sanitize = next;},
      async coldLegacy() {
        await runtime.dispose();
        const old = read();
        old.revision++;
        Object.assign(old.servers[0], {revision: old.servers[0].revision + 1, status: 'failed',
          lastError: 'timeout', selectedTools: []});
        delete old.servers[0].trustedSchemaHash;
        db.prepare('UPDATE app_settings SET value_json=? WHERE key=?').run(JSON.stringify(old), 'xiaozhi.mcp.v1');
        db.close();
        db = new DatabaseSync(filename);
        runtime = createMcpRuntime(sql, codec, {timeoutMs: 1300});
        return runtime;
      },
    });
    report.requests = fixture.state.requests;
    report.toolCalls = fixture.state.calls;
    report.success = true;
  } catch (error) {
    report.error = String(error.stack ?? error);
    throw error;
  } finally {
    await runtime.dispose();
    await fixture.close();
    db.close();
    await fs.writeFile(path.join(root, 'report.json'), JSON.stringify(report, null, 2), {flag: 'wx'});
    console.log('evidence ' + root);
  }
}

for (const [label, change] of Object.entries({
  trust: async ({runtime, input, schemaHash}) => runtime.trust({...await input(), schemaHash, tools: ['unknown_effect']}),
  revoke: async ({runtime, input}) => runtime.revoke(await input()),
  remove: async ({runtime, input}) => runtime.remove(await input()),
  credential: async ({runtime, input}) => runtime.credential({...await input(), action: 'set', value: 'SYNTHETIC_MCP_B_ONLY'}),
})) {
  for (const outcome of ['successful', 'failed']) {
    test(label + ' survives a delayed ' + outcome + ' probe', async () => {
      await scenario(label + '-' + outcome, async context => {
        const {runtime, fixture, input, read, report, id} = context;
        const arrived = deferred(), resume = deferred();
        fixture.state.beforeReply = async request => {
          if (request.method !== 'tools/list') return;
          report.probeArrivedAt = new Date().toISOString();
          arrived.resolve();
          await resume.promise;
          report.probeReleasedAt = new Date().toISOString();
          if (outcome === 'failed') return 'drop';
        };
        report.before = read();
        const request = await input();
        const handling = runtime.inspect(request).then(value => ({value}), error => ({error: String(error)}));
        try {
          await Promise.race([arrived.promise, handling.then(() => {throw Error('Probe completed before HTTP barrier');})]);
          const changed = await change(context);
          report.changedAt = new Date().toISOString();
          report.changed = read();
          assert.equal(report.changed.revision, report.before.revision + 1);
          assert.equal(changed.revision, report.changed.revision);
        } finally {
          resume.resolve();
          report.probeResult = await handling;
        }
        report.after = read();
        assert.deepEqual(report.after, report.changed);
        assert.equal(report.probeResult.value?.revision ?? report.after.revision, report.changed.revision);
        assert.equal(fixture.state.calls, 0);
        if (label !== 'trust') assert.equal(await runtime.trustedAuthority(id), null);
      });
    });
  }
}

test('SQLite CAS discards a verified HTTP response when B commits before A writes', async () => {
  await scenario('trust-cas-after-response', async ({runtime, fixture, input, read, report, schemaHash, setSanitizer}) => {
    const cleaning = deferred(), resume = deferred();
    setSanitizer(async text => {
      if (!report.responseCheckedAt) {
        report.responseCheckedAt = new Date().toISOString();
        cleaning.resolve();
        await resume.promise;
      }
      return text;
    });
    report.before = read();
    const handling = runtime.inspect(await input()).then(value => ({value}), error => ({error: String(error)}));
    try {
      await Promise.race([cleaning.promise, handling.then(() => {throw Error('Probe completed before post-response barrier');})]);
      await runtime.trust({...await input(), schemaHash, tools: ['unknown_effect']});
      report.changedAt = new Date().toISOString();
      report.changed = read();
    } finally {
      resume.resolve();
      report.probeResult = await handling;
    }
    assert.equal(report.probeResult.error, 'Error: conflict');
    report.after = read();
    assert.deepEqual(report.after, report.changed);
    assert.equal(report.after.revision, report.before.revision + 1);
    assert.equal(fixture.state.calls, 0);
  });
});

test('a cold legacy failure without trust requires the original selection and issues no automatic HTTP', async () => {
  await scenario('legacy-cold', async ({coldLegacy, input, fixture, id, read, report}) => {
    const runtime = await coldLegacy();
    report.before = read();
    const before = fixture.state.requests;
    const cold = await runtime.tools();
    assert.equal(cold.definitions.length, 0);
    await cold.dispose();
    assert.equal(fixture.state.requests, before);
    assert.equal(await runtime.trustedAuthority(id), null);
    const checked = await runtime.inspect(await input());
    assert.equal(checked.servers[0].status, 'ready');
    assert.equal(await runtime.trustedAuthority(id), null);
    const unconfirmed = await runtime.tools();
    assert.equal(unconfirmed.definitions.length, 0);
    await unconfirmed.dispose();
    const latest = checked.servers[0];
    await runtime.trust({...await input(), schemaHash: latest.schemaHash, tools: ['lookup_lesson']});
    const confirmed = await runtime.tools();
    assert.equal(confirmed.definitions.length, 1);
    await confirmed.dispose();
    report.after = read();
    assert.equal(fixture.state.calls, 0);
  });
});

test('a transport loss before tool dispatch degrades a live session without replaying an already dispatched call', async () => {
  await scenario('live-metadata-transport-loss', async ({runtime, fixture, read, report, schemaHash}) => {
    const first = await runtime.tools();
    assert.equal(first.definitions.length, 1);
    fixture.state.beforeReply = request => request.method === 'tools/list' ? 'drop' : undefined;
    const failed = await first.definitions[0].execute('before_dispatch', {topic: 'synthetic'});
    assert.equal(failed.isError, true);
    assert.equal(fixture.state.calls, 0);
    report.offline = read();
    assert.equal(report.offline.servers[0].status, 'failed', 'a known metadata loss leaves the live session incorrectly ready');
    assert.equal(report.offline.servers[0].trustedSchemaHash, schemaHash);
    await first.dispose();

    fixture.state.beforeReply = undefined;
    const second = await runtime.tools();
    assert.equal(second.definitions.length, 1);
    report.recovered = read();
    assert.equal(report.recovered.servers[0].status, 'ready');
    fixture.state.drop = true;
    const ambiguous = await second.definitions[0].execute('after_dispatch', {topic: 'synthetic'});
    assert.equal(ambiguous.isError, true);
    assert.equal(fixture.state.calls, 1, 'the physical call may have produced an effect and must not be replayed');
    await second.dispose();
  });
});

test('same MCP domain blocks repeated preparation and admits a single real half-open probe', async () => {
  let clock = 1000;
  await scenario('shared-mcp-breaker', async ({runtime, fixture, id, input, read, report}) => {
    let initialize = 0;
    fixture.state.beforeReply = request => {
      if (request.method === 'initialize') {initialize++; return 'drop';}
    };
    const attempt = async () => {
      const prepared = await runtime.tools(undefined, {serverId: id, preparationTimeoutMs: 4000});
      try {return prepared.definitions.length;} finally {await prepared.dispose();}
    };
    for (let index = 0; index < 3; index++) assert.equal(await attempt(), 0);
    assert.equal(initialize, 3);
    assert.equal(await attempt(), 0);
    await runtime.inspect(await input());
    report.beforeCooldown = {initialize, state: read()};
    assert.equal(initialize, 3, 'open domain must stop ordinary and explicit metadata requests');
    assert.equal(fixture.state.calls, 0);
    const arrived = deferred(), release = deferred();
    fixture.state.beforeReply = async request => {
      if (request.method === 'initialize') {
        initialize++;
        arrived.resolve();
        await release.promise;
      }
    };
    clock += 10_000;
    const probes = Array.from({length: 10}, attempt);
    try {
      await Promise.race([arrived.promise, Promise.all(probes).then(() => {throw Error('No physical probe after cooldown');})]);
    } finally {release.resolve();}
    report.probes = await Promise.all(probes);
    assert.equal(initialize, 4, 'concurrent half-open requests must share one physical probe');
    assert.equal(report.probes.filter(count => count === 1).length, 1);
    assert.equal(read().servers[0].status, 'ready');
    fixture.state.beforeReply = undefined;
    assert.equal(await attempt(), 1);
    assert.equal(fixture.state.calls, 0);
    report.recovered = read();
  }, () => clock);
});
