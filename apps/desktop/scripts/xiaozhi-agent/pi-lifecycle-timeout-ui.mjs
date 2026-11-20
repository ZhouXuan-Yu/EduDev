import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {setTimeout as sleep} from 'node:timers/promises';
import {pathToFileURL} from 'node:url';
import {_electron as electron} from 'playwright';
import {assertIsolatedPiMain, testMain} from '../acceptance/build-root.mjs';
import {fingerprint} from '../acceptance/evidence.mjs';

const main = testMain(process.cwd());
const buildRoot = path.resolve(path.dirname(main), '..');
const build = fingerprint(buildRoot);
const output = fs.mkdtempSync(path.resolve('test-results/xiaozhi-agent/pi-lifecycle-timeout-ui-'));
const data = path.join(output, 'data');
const profile = path.join(output, 'profile');
const bootstrap = path.join(output, 'bootstrap.cjs');
const answer = '已核对浮力方向竖直向上。';
fs.mkdirSync(data);
fs.mkdirSync(profile);
const report = {success: false, buildSha256: build.sha256, checks: [], model: 'synthetic'};
let application;
let page;
let sessionId;

function launchFixture(config) {
  const {net} = require('electron');
  const capture = {posts: 0, diagnostics: [], blocked: 0};
  globalThis.eduLifecycleTimeoutFixture = capture;
  const log = console.error.bind(console);
  console.error = (tag, ...args) => {
    if (tag === '[xiaozhi-journal]') {
      const {code, operation, timeoutMs, elapsedMs} = JSON.parse(args[0]);
      capture.diagnostics.push({code, operation, timeoutMs, elapsedMs});
    }
    log(tag, ...args);
  };
  net.fetch = async (input, options) => {
    const address = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
    const method = options?.method || 'GET';
    if (address.origin === 'https://api.deepseek.com') {
      if (method === 'GET' && ['/models', '/v1/models'].includes(address.pathname)) {
        return new Response(JSON.stringify({object: 'list', data: [{
          id: 'deepseek-flash', context_window: 1048576, max_output_tokens: 32768, input_modalities: ['text'],
        }]}), {headers: {'content-type': 'application/json'}});
      }
      if (method === 'POST' && ['/chat/completions', '/v1/chat/completions'].includes(address.pathname)) {
        capture.posts++;
        const frame = (delta, finish_reason = null) => 'data: ' + JSON.stringify({
          id: 'owned-lifecycle-timeout', object: 'chat.completion.chunk', created: 1, model: 'deepseek-flash',
          choices: [{index: 0, delta, finish_reason}],
        }) + '\n\n';
        return new Response(frame({role: 'assistant', content: config.answer}) + frame({}, 'stop') + 'data: [DONE]\n\n',
          {headers: {'content-type': 'text/event-stream'}});
      }
    }
    capture.blocked++;
    throw Error('external_request_blocked_by_fixture');
  };
  void import(config.main);
}

fs.writeFileSync(bootstrap, '(' + launchFixture.toString() + ')(' + JSON.stringify({main: pathToFileURL(main).href, answer}) + ');');
const marker = name => path.join(data, name);
const snapshot = () => page.evaluate(id => window.omniEdu.getXiaozhiSnapshot(id), sessionId);
const fixture = () => application.evaluate(() => globalThis.eduLifecycleTimeoutFixture);
const turn = id => page.locator('[data-turn-id="' + id + '"]');
const check = name => {report.checks.push(name);console.log('PASS ' + name);};

async function launch() {
  const env = Object.fromEntries(Object.entries(process.env).filter(([name]) =>
    !/(KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL)/i.test(name) && !name.startsWith('OMNI_EDU_E2E_') &&
    !['ELECTRON_RUN_AS_NODE', 'NODE_OPTIONS', 'ELECTRON_RENDERER_URL'].includes(name)));
  Object.assign(env, {
    DEEPSEEK_API_KEY: 'synthetic-no-paid-model', DEEPSEEK_MODEL: 'deepseek-flash',
    OMNI_EDU_DATA_ROOT: data, OMNI_EDU_REPO_ROOT: path.resolve('../..'),
    OMNI_EDU_XIAOZHI_PI: '1', OMNI_EDU_E2E_DIALOG_MODE: '1', OMNI_EDU_E2E_PI_MODEL_WAIT: '1',
  });
  application = await electron.launch({args: [bootstrap, '--user-data-dir=' + profile], env, timeout: 60000});
  page = await application.firstWindow();
  await page.getByTestId('xiaozhi-pi-workspace').waitFor({timeout: 60000});
  await page.waitForFunction(() => !document.querySelector('[data-testid="office-prompt-input"]')?.disabled);
  const id = await page.locator('.office-composer-container').getAttribute('data-session-id');
  assert(id);
  if (sessionId) assert.equal(id, sessionId);
  sessionId = id;
  await assertIsolatedPiMain(application, main, profile);
}

async function send(text) {
  await page.getByTestId('office-prompt-input').fill(text);
  await page.getByRole('button', {name: '发送消息', exact: true}).click();
}

function persistedTurn(runId) {
  const db = new DatabaseSync(path.join(data, 'app.db'), {readOnly: true});
  try {
    const row = db.prepare('SELECT status,turn_json FROM xiaozhi_event_runs WHERE run_id=?').get(runId);
    return {status: row.status, turn: JSON.parse(row.turn_json)};
  } finally {db.close();}
}

try {
  // The first same-session answer gives the subsequent timeout a committed record to preserve.
  fs.writeFileSync(marker('.e2e-model-wait'), 'skip-for-first-run');
  await launch();
  await send('只回复合成测试中的浮力方向，不调用工具。');
  await page.getByText(answer, {exact: true}).waitFor({timeout: 60000});
  await page.waitForFunction(async id => {
    const view = await window.omniEdu.getXiaozhiSnapshot(id);
    return !view.running && view.projection.turns.at(-1)?.status === 'completed';
  }, sessionId, {polling: 2000, timeout: 60000});
  const previousId = (await snapshot()).projection.turns.at(-1).id;
  const deadline = performance.now() + 30000;
  let previous = persistedTurn(previousId);
  while (previous.status === 'running' && performance.now() < deadline) {
    await sleep(100);
    previous = persistedTurn(previousId);
  }
  assert.equal(previous.status, 'completed');
  assert.equal((await fixture()).posts, 1);
  check('Teacher-visible prior answer is committed in the original SQLite journal.');

  fs.unlinkSync(marker('.e2e-model-wait'));
  const prompt = '合成超时验证，按现有准备检查后回复。';
  await send(prompt);
  const sync = page.getByTestId('pi-event-synchronization');
  await sync.and(page.locator('[data-state="unavailable"]')).waitFor({timeout: 60000});
  const failed = await snapshot();
  const failedTurn = failed.projection.turns.at(-1);
  assert.notEqual(failedTurn.id, previousId);
  assert.equal(failedTurn.status, 'failed');
  assert.equal(failedTurn.errorCode, 'lifecycle_timeout');
  assert.equal(failed.eventPersistenceError, 'lifecycle_timeout');
  assert.equal(failed.running, false);
  assert(!JSON.stringify(failed).includes('pi_before_model_delivery'));
  const draft = page.getByTestId('office-prompt-input');
  const savedDraft = '等待本地记录核对期间保留的合成草稿';
  await draft.fill(savedDraft);
  assert(await page.getByRole('button', {name: '发送消息', exact: true}).isDisabled());
  await turn(failedTurn.id).getByText(/本地准备或校验超时/).waitFor();
  const {posts, diagnostics} = await fixture();
  assert.equal(posts, 1);
  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0].operation, 'pi_before_model_delivery');
  assert.equal(diagnostics[0].timeoutMs, 15000);
  assert(diagnostics[0].elapsedMs >= 14999);
  report.diagnostic = diagnostics[0];
  check('Controlled timeout identifies its exact local operation, stops dispatch and explains the failure in the turn.');

  await page.getByTestId('pi-event-refresh').click();
  await page.getByText('上一轮执行仍在结束，请稍后重新读取记录。', {exact: true}).waitFor({timeout: 15000});
  assert.equal((await snapshot()).eventPersistence, 'unavailable');
  assert.equal((await fixture()).posts, 1);
  check('Explicit refresh remains blocked while the underlying lifecycle operation is still pending.');

  fs.writeFileSync(marker('.e2e-model-release'), 'release-owned-timeout');
  await page.getByTestId('pi-event-refresh').click();
  try {await sync.waitFor({state: 'hidden', timeout: 12000});} catch {
    await page.getByTestId('pi-event-refresh').click();
    await sync.waitFor({state: 'hidden', timeout: 12000});
  }
  const recovered = persistedTurn(failedTurn.id);
  assert.equal(recovered.status, 'failed');
  assert.equal(recovered.turn.errorCode, 'event_recovered');
  assert.deepEqual(persistedTurn(previousId), previous);
  assert.equal((await fixture()).posts, 1);
  assert.equal(await draft.inputValue(), savedDraft);
  assert(await page.getByRole('button', {name: '发送消息', exact: true}).isEnabled());
  check('Visible record refresh restores the input path without replay and preserves the earlier committed turn.');

  await application.close();
  application = undefined;
  await launch();
  const cold = await snapshot();
  assert.equal(cold.running, false);
  assert.equal(cold.projection.turns.find(item => item.id === failedTurn.id)?.errorCode, 'event_recovered');
  assert.deepEqual(persistedTurn(previousId), previous);
  assert.equal((await fixture()).posts, 0);
  assert.equal(fingerprint(buildRoot).sha256, build.sha256);
  check('Cold restart reads the same prior and repaired records with no new model dispatch.');
  report.success = true;
} catch (error) {
  report.error = String(error.stack || error);
  process.exitCode = 1;
} finally {
  fs.writeFileSync(marker('.e2e-model-release'), 'finally-release-owned-timeout');
  await application?.close().catch(() => {});
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({success: report.success, output, checks: report.checks.length, error: report.error}));
}
