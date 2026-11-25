import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {test} from 'node:test';

const {createProviderHealth} = await import('../../src/main/xiaozhi-agent/provider-health.ts');
const {createProviderCooldownStore} = await import('../../src/main/xiaozhi-agent/provider-cooldown-store.ts');

const acceptance = process.env.OMNI_EDU_PROVIDER_ACCEPTANCE_ROOT;
assert(path.isAbsolute(acceptance ?? ''));
const key = 'deepseek:' + 'a'.repeat(64), other = 'mcp:' + 'b'.repeat(64);
const fail = {kind: 'dependency_failure'};
const verified = {kind: 'verified'};

test('actual SQLite restart restores a future provider deadline and requires current verification after it expires', async () => {
  const root = await fs.mkdtemp(path.join(await fs.realpath(acceptance), 'provider-health-sqlite-'));
  const file = path.join(root, 'app.sqlite');
  let db = new DatabaseSync(file);
  db.exec('CREATE TABLE app_settings(key TEXT PRIMARY KEY,value_json TEXT NOT NULL,updated_at TEXT NOT NULL)');
  const sql = {
    all: async (query, args = []) => db.prepare(query).all(...args),
    run: async (query, args = []) => db.prepare(query).run(...args),
  };
  let wall = 1_000_000, monotonic = 2000;
  const setup = () => {
    const store = createProviderCooldownStore(sql);
    return {store, health: createProviderHealth({now: () => monotonic, wallNow: () => wall, random: () => 0, persistence: store})};
  };
  try {
    let {store, health} = setup();
    await health.ready();
    const salt = await store.salt();
    await health.begin(key, true).complete({...fail, retryAfterMs: 90_000});
    const written = db.prepare('SELECT value_json FROM app_settings').get();
    const persisted = JSON.parse(written.value_json);
    assert.deepEqual(persisted.cooldowns, [{key, savedAt: 1_000_000, until: 1_090_000, cooldown: 10_000}]);
    assert.deepEqual(Object.keys(persisted).sort(), ['cooldowns', 'salt', 'version']);
    db.close();
    db = new DatabaseSync(file);
    wall -= 20_000;
    monotonic = 30;
    ({store, health} = setup());
    await health.ready();
    assert.equal(await store.salt(), salt);
    const restored = health.snapshot(key);
    assert.deepEqual(restored, {phase: 'open', failures: 0, active: 0, retryAt: 90_030});
    assert.throws(() => health.begin(key, true), /provider_unavailable/u);
    await health.begin(other, true).complete(verified);
    monotonic += 90_000;
    wall = 1_090_000;
    assert.throws(() => health.begin(key, false), /provider_unavailable/u);
    const request = health.begin(key, true);
    assert.equal(health.snapshot(key).phase, 'half_open');
    await request.complete(verified);
    assert.equal(health.snapshot(key).phase, 'closed');
    assert.deepEqual(JSON.parse(db.prepare('SELECT value_json FROM app_settings').get().value_json).cooldowns, []);
    await fs.writeFile(path.join(root, 'report.json'), JSON.stringify({key, persisted: persisted.cooldowns, restored,
      postVerification: health.snapshot(key), independent: health.snapshot(other)}, null, 2), {flag: 'wx'});
    console.log('evidence ' + root);
  } finally {db.close();}
});

test('resume invalidates healthy verdicts and counts the original active request until its real owner settles', async () => {
  let now = 10;
  const health = createProviderHealth({now: () => now, random: () => 0, maxDomains: 2});
  await health.begin(key, true).complete(verified);
  const active = health.begin(key, false);
  await health.begin(other, true).complete({...fail, retryAfterMs: 60_000});
  await health.revalidateAfterResume();
  assert.equal(health.snapshot(key).phase, 'open');
  assert.equal(health.snapshot(key).active, 1);
  assert.throws(() => health.begin(key, true), /provider_unavailable/u);
  assert.throws(() => health.begin(other, true), /provider_unavailable/u);
  await active.complete(verified);
  assert.equal(health.snapshot(key).phase, 'open');
  await health.begin(key, true).complete(verified);
  assert.equal(health.snapshot(key).phase, 'closed');
  now += 59_999;
  assert.throws(() => health.begin(other, true), /provider_unavailable/u);
});

test('full cache retains every active or cooling domain and evicts an expired idle domain', async () => {
  let now = 50;
  const health = createProviderHealth({now: () => now, random: () => 0, maxDomains: 2});
  const held = health.begin(key, true);
  await health.begin(other, true).complete({...fail, retryAfterMs: 120_000});
  const newKey = 'deepseek:' + 'c'.repeat(64);
  assert.throws(() => health.begin(newKey, true), /provider_unavailable/u);
  now += 120_001;
  await health.begin(newKey, true).complete(verified);
  assert.equal(health.snapshot(key).active, 1);
  assert.equal(health.snapshot(other).phase, 'unknown');
  await held.complete(verified);
});
