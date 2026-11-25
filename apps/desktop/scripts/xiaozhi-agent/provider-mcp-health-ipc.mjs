import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {setTimeout as delay} from 'node:timers/promises';
import {_electron as electron} from 'playwright';
import {startMcpFixture} from './fixtures/mcp-server.mjs';

const build = process.argv[2];
const acceptance = process.env.OMNI_EDU_PROVIDER_ACCEPTANCE_ROOT;
assert(path.isAbsolute(build ?? '') && path.isAbsolute(acceptance ?? ''), 'Set the verified build and acceptance root');
const main = await fs.realpath(path.join(build, 'main/index.js'));
const root = await fs.mkdtemp(path.join(await fs.realpath(acceptance), 'mcp-health-desktop-'));
const data = path.join(root, 'data'), profile = path.join(root, 'profile');
const report = {main, mainHash: createHash('sha256').update(await fs.readFile(main)).digest('hex'),
  root, checks: [], paidCalls: 0, success: false};
const source = await startMcpFixture();
const independent = await startMcpFixture();
let app;

function call(page, method, input) {
  return page.evaluate(({method, input}) => window.omniEdu[method](input), {method, input});
}
function success(result) {
  assert.equal(result?.ok, true, JSON.stringify(result));
  return result.value;
}

try {
  const env = Object.fromEntries(Object.entries(process.env).filter(([name]) =>
    !/KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL|NODE_OPTIONS|ELECTRON_RUN_AS_NODE|ELECTRON_RENDERER_URL/iu.test(name)));
  Object.assign(env, {OMNI_EDU_SKIP_DOTENV: '1', OMNI_EDU_REPO_ROOT: path.resolve(import.meta.dirname, '../../../..'),
    OMNI_EDU_DATA_ROOT: data, OMNI_EDU_XIAOZHI_PI: '1', TEMP: root, TMP: root});
  app = await electron.launch({args: [main, '--user-data-dir=' + profile], env, timeout: 60_000});
  const page = await app.firstWindow();
  await page.waitForFunction(() => typeof window.omniEdu?.getXiaozhiMcpCatalog === 'function');
  const inspect = async id => {
    const catalog = success(await call(page, 'getXiaozhiMcpCatalog'));
    return call(page, 'inspectXiaozhiMcp', {schemaVersion: catalog.schemaVersion, revision: catalog.revision, serverId: id});
  };
  async function trust(name, fixture) {
    const created = success(await call(page, 'addXiaozhiMcp', {name, transport: 'http', url: fixture.url}));
    const id = created.servers.find(item => item.name === name).id;
    const catalog = success(await inspect(id));
    const server = catalog.servers.find(item => item.id === id);
    const trusted = success(await call(page, 'trustXiaozhiMcp', {schemaVersion: catalog.schemaVersion, revision: catalog.revision,
      serverId: id, schemaHash: server.schemaHash, tools: ['lookup_lesson']}));
    return trusted.servers.find(item => item.id === id);
  }
  const first = await trust('MCP cooldown fixture', source);
  const second = await trust('Independent MCP fixture', independent);
  const initTime = [];
  let offline = true;
  source.state.beforeReply = request => {
    if (request.method !== 'initialize') return;
    initTime.push(performance.now());
    if (offline) return 'drop';
  };
  for (let index = 0; index < 3; index++) {
    const catalog = success(await inspect(first.id));
    const row = catalog.servers.find(item => item.id === first.id);
    assert.equal(row.status, 'failed');
    assert.equal(row.trustedSchemaHash, first.trustedSchemaHash);
    assert.deepEqual(row.tools.filter(tool => tool.selected).map(tool => tool.name), ['lookup_lesson']);
  }
  const blocked = await inspect(first.id);
  assert.deepEqual(blocked, {ok: false, error: 'provider_unavailable'});
  assert.equal(initTime.length, 3);
  report.checks.push('Typed preload returns the cooldown error and preserves the trusted choice after three real outages');
  const independentCatalog = success(await inspect(second.id));
  assert.equal(independentCatalog.servers.find(item => item.id === second.id).status, 'ready');
  report.checks.push('The independently verified MCP origin still responds during the first origin cooldown');

  offline = false;
  await delay(12_100);
  const recoveredCatalog = success(await inspect(first.id));
  const recovered = recoveredCatalog.servers.find(item => item.id === first.id);
  assert.equal(recovered.status, 'ready');
  assert.equal(recovered.trustedSchemaHash, first.trustedSchemaHash);
  assert.equal(initTime.length, 4);
  report.elapsedFromLastFailureMs = initTime[3] - initTime[2];
  assert(report.elapsedFromLastFailureMs >= 10_000);
  assert.equal(source.state.calls + independent.state.calls, 0);
  const db = new DatabaseSync(path.join(data, 'app.db'), {readOnly: true});
  try {
    const stored = JSON.parse(db.prepare('SELECT value_json FROM app_settings WHERE key=?').get('xiaozhi.mcp.v1').value_json);
    assert.equal(stored.revision, recoveredCatalog.revision);
    const row = stored.servers.find(item => item.id === first.id);
    assert.equal(row.trustedSchemaHash, first.trustedSchemaHash);
    assert.deepEqual(row.selectedTools, ['lookup_lesson']);
    report.persisted = {revision: stored.revision, id: row.id, trustedSchemaHash: row.trustedSchemaHash};
  } finally {db.close();}
  report.checks.push('After cooldown the same endpoint verifies its original schema, and SQLite retains its original selection');
  report.success = true;
} catch (error) {
  report.error = String(error.stack ?? error);
  process.exitCode = 1;
} finally {
  await app?.close().catch(() => undefined);
  await Promise.all([source.close(), independent.close()]);
  await fs.writeFile(path.join(root, 'report.json'), JSON.stringify(report, null, 2), {flag: 'wx'});
  console.log(JSON.stringify({success: report.success, checks: report.checks.length, root, error: report.error}));
}
