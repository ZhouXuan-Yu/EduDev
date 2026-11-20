import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {once} from 'node:events';
import fs from 'node:fs';
import http from 'node:http';
import {createRequire} from 'node:module';
import os from 'node:os';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {setTimeout as sleep} from 'node:timers/promises';
import {pathToFileURL} from 'node:url';
import {testMain} from '../acceptance/build-root.mjs';
import {collectFiles, readOriginalRecords, verifiedRunBinding} from './phase8-real-model-readback.mjs';
import {fingerprint, providerPaths, sha256, syntheticFiles, tasks} from './phase8-real-model-plan.mjs';

const desktop = fs.realpathSync(path.resolve(import.meta.dirname, '../..'));
const baseline = fs.realpathSync(process.argv[2] || '');
const selected = process.argv.slice(3);
const cases = ['cancel-Q4', 'decline-Q7', 'offline'];
assert(selected.every(item => /^[AB]:(cancel-Q4|decline-Q7|offline)$/.test(item)));
const commit = cwd => execFileSync('git', ['rev-parse', 'HEAD'], {cwd, encoding: 'utf8'}).trim();
assert.equal(commit(baseline), 'd50ef330f0f9c4995cc7e096e85bd8fd93629c83');
const versions = {
  A: {desktop: baseline, main: path.join(baseline, 'out/main/index.js')},
  B: {desktop, main: testMain(desktop)},
};
const fingerprintOf = main => fingerprint(path.resolve(path.dirname(main), '..'));
const identities = Object.fromEntries(Object.entries(versions).map(([id, version]) => {
  const output = fingerprintOf(version.main);
  const file = path.join(version.desktop, 'node_modules/electron/package.json');
  return [id, {commit: commit(version.desktop), outSha256: output.sha256, outFiles: output.files.length,
    electron: JSON.parse(fs.readFileSync(file)).version}];
}));
assert.equal(identities.A.outSha256, '9339199da66260513af57250be680c31b507d0f6549e4e5d4f545f13648734f2');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'omni-edu-xiaozhi-phase8-failure-'));
const report = {status: 'FAIL', scope: 'Actual Electron/Pi UI, Chromium transport and SQLite. Local fixture supplies model payloads. No paid requests or foreground desktop timing.',
  versions: identities, rows: []};
console.log(root);

function bootstrapMain(config) {
  const {app, net} = require('electron');
  app.setPath('userData', config.profile);
  const actualFetch = net.fetch.bind(net);
  const posts = [];
  globalThis.phase8Fault = {
    posts,
    async probe() {
      try {
        const response = await actualFetch(config.origin + '/probe', {cache: 'no-store'});
        await response.text();
        return {status: response.status};
      } catch (error) {return {error: String(error.message)};}
    },
  };
  net.fetch = async (input, init) => {
    const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
    if (url.origin !== 'https://api.deepseek.com') throw Error('owned_fixture_external_fetch_denied');
    if (['/v1/models', '/models'].includes(url.pathname) && (!init?.method || init.method === 'GET')) {
      return new Response(JSON.stringify({object: 'list', data: [{id: 'deepseek-flash', context_window: 1048576,
        max_output_tokens: 32768, input_modalities: ['text']}]}), {headers: {'content-type': 'application/json'}});
    }
    if (!config.paths.includes(url.pathname) || init?.method !== 'POST') throw Error('owned_fixture_unexpected_provider_route');
    const row = {path: url.pathname, status: null, error: null};
    posts.push(row);
    try {
      const response = await actualFetch(config.origin + url.pathname, init);
      row.status = response.status;
      return response;
    } catch (error) {
      row.error = String(error.message);
      throw error;
    }
  };
  app.whenReady().then(() => import(config.main));
}

async function until(action, timeoutMs = 60000) {
  const deadline = performance.now() + timeoutMs;
  do {
    const result = await action();
    if (result) return result;
    await sleep(200);
  } while (performance.now() < deadline);
  throw Error('phase8_fault_wait_timeout');
}

function startFixture(mode) {
  const wire = {probes: 0, posts: [], closedSockets: 0};
  let unreachable = false;
  const server = http.createServer(async (request, response) => {
    if (request.url === '/probe' && request.method === 'GET') {
      wire.probes++;
      return response.writeHead(200, {'cache-control': 'no-store'}).end('fixture ready');
    }
    if (!providerPaths.includes(request.url) || request.method !== 'POST') return response.writeHead(404).end();
    let requestBytes = 0;
    const chunks = [];
    for await (const bytes of request) {
      requestBytes += bytes.length;
      if (requestBytes > 2 * 1024 * 1024) return response.writeHead(413).end();
      if (mode === 'decline-Q7' && wire.posts.length === 0) chunks.push(bytes);
    }
    const entry = {path: request.url, requestBytes, status: 200, disconnected: false};
    wire.posts.push(entry);
    response.on('close', () => {entry.disconnected = !response.writableEnded;});
    const frame = (delta, finish_reason = null) => 'data: ' + JSON.stringify({
      id: 'phase8-fault', object: 'chat.completion.chunk', model: 'deepseek-flash', created: 1,
      choices: [{index: 0, delta, finish_reason}],
    }) + '\n\n';
    response.writeHead(200, {'content-type': 'text/event-stream', 'cache-control': 'no-store'});
    const initial = frame({role: 'assistant'});
    if (mode === 'cancel-Q4') {
      response.write(initial + frame({content: '正在核对合成分数。'}));
      return;
    }
    if (mode === 'decline-Q7' && wire.posts.length <= 2) {
      const plan = wire.posts.length === 1;
      const requestText = Buffer.concat(chunks).toString('utf8');
      const requirementVersion = Number([...requestText.matchAll(/\\"requirementsVersion\\":(\d+)/g)].at(-1)?.[1] || 1);
      const tool = plan ? {name: 'update_task_plan', arguments: JSON.stringify({schemaVersion: 'xiaozhi.task-plan.v3',
        requirementsVersion: requirementVersion, expectedRevision: 0, reason: '文本交付前由教师核对',
        steps: [
          {id: 'practice', text: '准备合成练习并等待教师确认', dependsOn: [], reported: 'pending', kind: 'saved_text', target: 'practice.txt'},
          {id: 'review', text: '由教师核对是否保存练习', dependsOn: [], reported: 'pending', kind: 'human'},
        ]})}
        : {name: 'office_create_text', arguments: JSON.stringify({path: 'practice.txt', content: '合成练习：3/4 + 1/4 = 1', taskStepId: 'practice'})};
      const call = {index: 0, id: plan ? 'call_owned_plan' : 'call_owned_practice', type: 'function', function: tool};
      return response.end(initial + frame({tool_calls: [call]}) + frame({}, 'tool_calls') + 'data: [DONE]\n\n');
    }
    response.end(initial + frame({content: '本地合成检查结束。'}) + frame({}, 'stop') + 'data: [DONE]\n\n');
  });
  server.prependListener('connection', socket => {
    if (!unreachable) return;
    wire.closedSockets++;
    socket.destroy();
  });
  server.listen(0, '127.0.0.1');
  return {server, wire, setUnreachable(value) {
    unreachable = value;
    if (value) server.closeAllConnections();
  }};
}

function readDurable(databasePath, sessionId, runId) {
  const original = readOriginalRecords(databasePath, sessionId, runId);
  const sqlite = new DatabaseSync(databasePath, {readOnly: true});
  try {
    const journal = sqlite.prepare('SELECT status FROM xiaozhi_event_runs WHERE run_id=?').get(runId);
    const changes = sqlite.prepare('SELECT id,state,revision,relative_path,call_id FROM xiaozhi_pi_text_changes WHERE conversation_id=? AND run_id=? ORDER BY id').all(sessionId, runId);
    return {original, journal, changes};
  } finally {sqlite.close();}
}

async function exercise(id, mode) {
  const version = versions[id];
  const folder = path.join(root, id + '-' + mode);
  const data = path.join(folder, 'data'), profile = path.join(folder, 'profile'), workspace = path.join(folder, 'workspace');
  for (const directory of [data, profile, workspace]) fs.mkdirSync(directory, {recursive: true});
  for (const [name, content] of Object.entries(syntheticFiles)) fs.writeFileSync(path.join(workspace, name), content);
  const content = () => collectFiles(workspace).map(({relativePath, sha256}) => ({relativePath, sha256}));
  const databasePath = path.join(data, 'app.db'), before = content();
  const {server, wire, setUnreachable} = startFixture(mode);
  await once(server, 'listening');
  const origin = 'http://127.0.0.1:' + server.address().port;
  const row = {version: id, scenario: mode, status: 'FAIL', before};
  let application, page, sessionId;
  async function launch() {
    const require = createRequire(path.join(version.desktop, 'package.json'));
    const {_electron} = require('playwright');
    const env = Object.fromEntries(Object.entries(process.env).filter(([name]) =>
      !/(KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL|PROXY)/i.test(name) && !name.startsWith('OMNI_EDU_E2E_') &&
      !['ELECTRON_RUN_AS_NODE', 'NODE_OPTIONS', 'ELECTRON_RENDERER_URL'].includes(name)));
    Object.assign(env, {OMNI_EDU_DATA_ROOT: data, OMNI_EDU_REPO_ROOT: path.resolve(version.desktop, '../..'),
      OMNI_EDU_XIAOZHI_PI: '1', OMNI_EDU_E2E_DIALOG_MODE: '1', DEEPSEEK_API_KEY: 'owned-phase8-failure-only', DEEPSEEK_MODEL: 'deepseek-flash'});
    const bootstrap = path.join(folder, 'bootstrap.cjs');
    const config = {profile, origin, paths: providerPaths, main: pathToFileURL(version.main).href};
    fs.writeFileSync(bootstrap, '(' + bootstrapMain.toString() + ')(' + JSON.stringify(config) + ');');
    application = await _electron.launch({executablePath: require('electron'), cwd: version.desktop, args: [bootstrap], env, timeout: 60000});
    page = await application.firstWindow();
    await page.getByTestId('xiaozhi-pi-workspace').waitFor({timeout: 60000});
    const active = () => page.locator('.office-composer-container').getAttribute('data-session-id');
    if (!sessionId) {
      const previous = await until(async () => {
        const current = await active();
        return /^aisession_[A-Za-z0-9_-]+$/.test(current || '') ? current : null;
      });
      await page.getByTestId('pi-new-session').click();
      sessionId = await until(async () => {
        const current = await active();
        return current !== previous && /^aisession_[A-Za-z0-9_-]+$/.test(current || '') ? current : null;
      });
    } else {
      await until(async () => await active() === sessionId);
    }
  }
  const snapshot = () => page.evaluate(id => window.omniEdu.getXiaozhiSnapshot(id), sessionId);
  const posts = () => application.evaluate(() => globalThis.phase8Fault.posts);
  const probe = () => application.evaluate(() => globalThis.phase8Fault.probe());
  const socketFailure = /net::ERR_(CONNECTION_RESET|CONNECTION_CLOSED|EMPTY_RESPONSE)/;
  const present = () => fs.readdirSync(folder, {recursive: true}).some(name => path.basename(name).toLowerCase() === 'practice.txt');
  try {
    await launch();
    // The only intercepted dialog selects this case's owned workspace. The
    // selector and subsequent typed IPC still run through the real window.
    await application.evaluate(({dialog}, selected) => {
      globalThis.phase8FaultPicker = dialog.showOpenDialog;
      dialog.showOpenDialog = async () => ({canceled: false, filePaths: [selected]});
    }, workspace);
    await page.getByTestId('pi-permission-picker').click();
    await page.getByRole('menuitem', {name: '选择教学工作目录', exact: true}).click();
    await until(async () => (await snapshot()).workspace?.label === path.basename(workspace));
    await application.evaluate(({dialog}) => {dialog.showOpenDialog = globalThis.phase8FaultPicker;});
    const task = mode === 'decline-Q7' ? 'Q7' : 'Q4';
    const prompt = tasks.find(item => item.id === task).input;
    row.promptSha256 = sha256(prompt);
    if (mode === 'offline') {
      row.network = {onlineBefore: await probe()};
      assert.deepEqual(row.network.onlineBefore, {status: 200});
      // Keep the endpoint owned and close incoming TCP sockets before HTTP parsing.
      setUnreachable(true);
      row.network.offline = await probe();
      assert.match(row.network.offline.error || '', socketFailure);
      assert.equal(wire.probes, 1);
      assert(wire.closedSockets > 0);
      row.network.closedProbeSockets = wire.closedSockets;
    }
    await page.getByTestId('office-prompt-input').fill(prompt);
    await page.getByRole('button', {name: '发送消息', exact: true}).click();
    if (mode === 'cancel-Q4') {
      await until(() => wire.posts.length === 1);
      await page.getByText('正在核对合成分数。', {exact: true}).waitFor({timeout: 25000});
      await page.getByRole('button', {name: '停止本轮', exact: true}).click();
      await until(() => wire.posts[0].disconnected);
    } else if (mode === 'decline-Q7') {
      const reject = page.locator('[data-testid="pi-text-reject"], [data-testid="pi-permission-reject"]').first();
      await reject.waitFor({timeout: 40000});
      row.decisionControl = await reject.getAttribute('data-testid');
      await reject.click();
    }
    const terminal = await until(async () => {
      const view = await snapshot(), turn = view.projection.turns.at(-1);
      if (view.running || !turn || turn.status === 'running') return;
      const durable = readDurable(databasePath, sessionId, turn.id);
      if (!durable.original.runs.length || !durable.journal || durable.journal.status === 'running') return;
      return {view, turn, durable};
    });
    const {view, turn, durable} = terminal;
    row.binding = verifiedRunBinding({sessionId, runId: turn.id, snapshot: view, records: durable.original});
    row.hot = {durable, turnStatus: turn.status, errorCode: turn.errorCode ?? null, modelRequests: turn.modelRequests || [], posts: await posts()};
    assert.deepEqual(content(), before);
    assert.equal(present(), false);
    if (mode === 'cancel-Q4') {
      assert.equal(turn.status, 'interrupted');
      assert.equal(wire.posts.length, 1);
      assert.deepEqual(row.hot.posts.map(item => item.status), [200]);
    } else if (mode === 'decline-Q7') {
      assert(['failed', 'interrupted', 'completed'].includes(turn.status));
      const rejected = row.decisionControl === 'pi-text-reject' ? durable.changes : durable.original.approvals;
      assert.equal(rejected.filter(item => item.state === 'rejected').length, 1);
      assert(!durable.changes.some(item => item.state === 'applied'));
      assert(wire.posts.length >= 2 && wire.posts.length <= 3);
    } else {
      assert.equal(turn.status, 'failed');
      assert.equal(turn.errorCode, 'transport');
      assert.equal(row.hot.posts.length, 1);
      assert.match(row.hot.posts[0].error || '', socketFailure);
      assert.equal(wire.posts.length, 0);
      row.network.closedModelSockets = wire.closedSockets - row.network.closedProbeSockets;
      assert(row.network.closedModelSockets > 0);
      setUnreachable(false);
      row.network.onlineAfter = await probe();
      assert.deepEqual(row.network.onlineAfter, {status: 200});
      assert.equal(wire.probes, 2);
    }
    const beforeRestart = wire.posts.length;
    await application.close();
    application = undefined;
    const cold = readDurable(databasePath, sessionId, turn.id);
    assert.deepEqual(cold, durable);
    await launch();
    const reopened = await snapshot();
    assert.equal(reopened.running, false);
    assert.equal(reopened.projection.turns.find(item => item.id === turn.id)?.status, turn.status);
    assert.equal((await posts()).length, 0);
    assert.equal(wire.posts.length, beforeRestart);
    assert.deepEqual(content(), before);
    assert.equal(present(), false);
    row.cold = {durable: cold, turnStatus: turn.status, posts: 0, files: content()};
    row.status = 'PASS_SCOPED';
  } catch (error) {
    row.error = String(error.stack || error);
    if (application) row.observedPosts = await posts().catch(() => []);
    if (sessionId && page) {
      const view = await snapshot().catch(() => null);
      const turn = view?.projection?.turns?.at(-1);
      if (turn) row.lastObservation = {runId: turn.id, status: turn.status, errorCode: turn.errorCode,
        toolNames: turn.items.filter(item => item.kind === 'tool').map(item => item.toolName)};
    }
  } finally {
    if (application) await application.close().catch(() => {});
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    row.wire = wire;
    report.rows.push(row);
    fs.writeFileSync(path.join(root, 'report.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({id, mode, status: row.status, error: row.error}));
  }
}

for (const id of Object.keys(versions)) for (const mode of cases) {
  if (!selected.length || selected.includes(id + ':' + mode)) await exercise(id, mode);
}
report.status = report.rows.every(row => row.status === 'PASS_SCOPED') ? 'PASS_SCOPED' : 'FAIL';
fs.writeFileSync(path.join(root, 'report.json'), JSON.stringify(report, null, 2));
if (report.status === 'FAIL') process.exitCode = 1;
