import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {_electron as electron} from 'playwright';
import {startMcpFixture} from './fixtures/mcp-server.mjs';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'xiaozhi-phase5-ui-'));
const output = fs.mkdtempSync(path.resolve('test-results/xiaozhi-agent/phase5-ui-'));
const dataRoot = path.join(root, 'data');
const packageRoot = path.join(root, 'public-extension'); fs.mkdirSync(packageRoot);
fs.writeFileSync(path.join(packageRoot, 'edudev.extension.json'), JSON.stringify({schemaVersion: 1, extensionId: 'ui.context', version: '1.0.0', entry: 'entry.cjs', hooks: ['context.transform'], license: 'MIT'}));
fs.writeFileSync(path.join(packageRoot, 'LICENSE'), 'MIT synthetic UI package license');
fs.writeFileSync(path.join(packageRoot, 'entry.cjs'), "exports.contextTransform=async({text})=>({text:'UI_REAL_EXTENSION:'+text});");
const licenseSource = 'C:/Users/ZhouXuan/AppData/Local/Temp/xiaozhi-phase5-production-grcqce/data/managed-tools/capabilities/versions/e9fe9851ff24b2479da1900ff81c2be5363e3186b6efccecfaa2d14473b4a2f6/NODE-LICENSE.txt';
const license = fs.readFileSync(licenseSource);
assert.equal(createHash('sha256').update(license).digest('hex'), '537308465103a306d0e3eecf42632b4ff1b48aaaec044e9fc10a78c81fd00b34');
let modelCalls = 0, licenseCalls = 0, pendingModel, pendingLicense, releaseModel = false;
const bodies = [];
function answer(response, tool) {
  const base = {id: 'phase5-ui-fixture', object: 'chat.completion.chunk', created: 1, model: 'deepseek-flash'};
  const delta = tool ? {role: 'assistant', tool_calls: [{index: 0, id: 'call_ui_phase5', type: 'function', function: {name: 'extension_invoke', arguments: JSON.stringify({extensionId: 'ui.context', hook: 'context.transform', text: 'public generic text'})}}]} : {role: 'assistant', content: '公开扩展调用已完成，请核对本地回执。'};
  response.write('data: ' + JSON.stringify({...base, choices: [{index: 0, delta, finish_reason: null}]}) + '\n\n');
  response.write('data: ' + JSON.stringify({...base, choices: [{index: 0, delta: {}, finish_reason: tool ? 'tool_calls' : 'stop'}], usage: {prompt_tokens: 100, completion_tokens: 30, total_tokens: 130}}) + '\n\n');
  response.end('data: [DONE]\n\n');
}
const fixture = http.createServer(async (request, response) => {
  if (request.url === '/license') {
    licenseCalls++;
    if (licenseCalls === 1) {pendingLicense = response; response.on('close', () => {pendingLicense = undefined;}); return;}
    response.writeHead(200, {'content-type': 'text/plain'}); response.end(license); return;
  }
  if (request.url === '/v1/models') {
    request.resume(); response.writeHead(200, {'content-type': 'application/json'});
    response.end(JSON.stringify({object: 'list', data: [{id: 'deepseek-flash', context_window: 1048576, max_output_tokens: 32768, input_modalities: ['text'], effort: {supported_levels: ['low', 'high', 'max'], default_level: 'low'}}]})); return;
  }
  if (request.url !== '/v1/chat/completions') {request.resume(); response.writeHead(404).end(); return;}
  let raw = ''; for await (const chunk of request) raw += chunk; bodies.push(JSON.parse(raw)); modelCalls++;
  response.writeHead(200, {'content-type': 'text/event-stream'}); response.flushHeaders();
  if (modelCalls === 1 && !releaseModel) {pendingModel = response; return;}
  answer(response, false);
});
await new Promise(resolve => fixture.listen(0, '127.0.0.1', resolve));
const port = fixture.address().port;
const mcpFixture = await startMcpFixture();
const bootstrap = path.join(output, 'bootstrap.cjs');
fs.writeFileSync(bootstrap, `const {app,net}=require('electron');app.setPath('userData',${JSON.stringify(path.join(root, 'profile'))});net.fetch=async(input,init)=>{const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);if(url.origin==='https://api.deepseek.com')return fetch('http://127.0.0.1:${port}'+url.pathname,init);if(url.href==='https://raw.githubusercontent.com/nodejs/node/v24.12.0/LICENSE')return fetch('http://127.0.0.1:${port}/license',init);if(url.origin===${JSON.stringify(new URL(mcpFixture.url).origin)})return fetch(url.href,init);throw Error('owned UI source outage fixture');};import(${JSON.stringify(pathToFileURL(path.resolve('out/main/index.js')).href)});`);
let application, page, sessionId, artifactId;
const checks = [], rendererErrors = [];
const report = {success: false, root, output, checks, rendererErrors, paidCalls: 0, modelCalls: 0, licenseCalls: 0, error: undefined,
  boundary: 'Actual built Electron main/preload/original settings and user actions. Native picker has a main-only owned directory fixture. Public Node license uses a previously verified official byte cache. Model uses loopback SSE and source outage is injected. No teacher visual acceptance claim.'};
function check(name) {checks.push({name, pass: true}); console.log('PASS ' + name);}
function readback() {
  const db = new DatabaseSync(path.join(dataRoot, 'app.db'), {readOnly: true});
  try {
    const rows = db.prepare("SELECT key,value_json FROM app_settings WHERE key LIKE 'xiaozhi.extension.%'").all();
    const packages = rows.filter(row => row.key.startsWith('xiaozhi.extension.package.v1.')).map(row => JSON.parse(row.value_json).document);
    const states = rows.filter(row => row.key.startsWith('xiaozhi.extension.v1.')).map(row => JSON.parse(row.value_json).document);
    const mcp = db.prepare("SELECT value_json FROM app_settings WHERE key='xiaozhi.mcp.v1'").get();
    return {packages, states, mcp: mcp ? JSON.parse(mcp.value_json) : null,
      runs: db.prepare('SELECT id,status FROM ai_agent_runs').all(),
      invocations: db.prepare("SELECT * FROM xiaozhi_tool_receipts WHERE tool='extension_invoke'").all()};
  } finally {db.close();}
}
async function until(test, timeout = 30000) {
  const deadline = Date.now() + timeout;
  while (!await test()) {if (Date.now() >= deadline) throw Error('ui_readback_timeout'); await page.waitForTimeout(100);}
}
async function launch() {
  const env = {...process.env, OMNI_EDU_DATA_ROOT: dataRoot, OMNI_EDU_REPO_ROOT: path.resolve('../..'), OMNI_EDU_E2E_DIALOG_MODE: '1', OMNI_EDU_XIAOZHI_PI: '1', DEEPSEEK_API_KEY: 'synthetic-phase5-ui', DEEPSEEK_MODEL: 'deepseek-flash'};
  delete env.NODE_OPTIONS; delete env.ELECTRON_RUN_AS_NODE;
  application = await electron.launch({args: [bootstrap, '--force-device-scale-factor=1'], env, timeout: 60000}); page = await application.firstWindow();
  page.on('pageerror', error => rendererErrors.push(error.message));
  await page.getByTestId('xiaozhi-pi-workspace').waitFor({timeout: 40000});
  await page.waitForFunction(() => !document.querySelector('[data-testid="office-prompt-input"]')?.disabled);
}
async function settings(tab = 'tools') {
  if (!await page.getByTestId('pi-settings-workspace').isVisible()) await page.getByRole('button', {name: '设置', exact: true}).click();
  const advanced = page.getByTestId('pi-settings-advanced-toggle');
  if (await advanced.getAttribute('aria-expanded') === 'false') await advanced.click();
  await page.getByTestId('pi-settings-tab-' + tab).click();
  if (tab === 'tools') await page.getByTestId('pi-extensions').scrollIntoViewIfNeeded();
}
async function approvals() {
  await settings('permissions'); await page.getByRole('button', {name: '刷新权限', exact: true}).click();
  while (await page.getByTestId('pi-permission-request').count()) {
    const request = page.getByTestId('pi-permission-request').first();
    await request.getByRole('button', {name: '授权当前任务', exact: true}).click(); await request.waitFor({state: 'detached'});
  }
  await settings('tools');
}
try {
  await launch(); await settings();
  await page.getByTestId('pi-mcp-name').fill('UI external effects'); await page.getByTestId('pi-mcp-address').fill(mcpFixture.url);
  await page.getByTestId('pi-mcp-ack').getByRole('checkbox').press('Space'); await page.getByTestId('pi-mcp-add').click();
  let catalog;
  await until(async () => {catalog = await page.evaluate(() => window.omniEdu.getXiaozhiMcpCatalog()); return catalog.ok && catalog.value.servers.some(server => server.name === 'UI external effects');});
  const serverId = catalog.value.servers.find(server => server.name === 'UI external effects').id;
  await page.getByTestId('pi-mcp-inspect-' + serverId).click();
  const external = page.getByTestId('pi-mcp-tool-' + serverId + '-unknown_effect'); await external.waitFor();
  await external.getByRole('checkbox').press('Space'); await page.getByTestId('pi-mcp-trust-' + serverId).click();
  await until(async () => {const value = await page.evaluate(() => window.omniEdu.getXiaozhiMcpCatalog()); return value.ok && value.value.servers.find(row => row.id === serverId)?.tools.some(tool => tool.name === 'unknown_effect' && tool.selected);});
  check('Visible MCP controls connect the actual loopback service and select an external-effect tool through typed IPC');
  const secret = 'SYNTHETIC_UI_SECRET_ONLY';
  const password = page.getByTestId('pi-mcp-credential-' + serverId); assert.equal(await password.getAttribute('type'), 'password');
  await password.fill(secret); await page.getByTestId('pi-mcp-credential-save-' + serverId).click(); await until(async () => await password.inputValue() === '');
  catalog = await page.evaluate(() => window.omniEdu.getXiaozhiMcpCatalog()); assert(catalog.ok); assert(catalog.value.servers.find(row => row.id === serverId).credentialConfigured);
  assert(!JSON.stringify(catalog).includes(secret)); assert(!JSON.stringify(readback().mcp).includes(secret));
  await page.getByTestId('pi-mcp-credential-clear-' + serverId).click();
  await until(async () => {const value = await page.evaluate(() => window.omniEdu.getXiaozhiMcpCatalog()); return value.ok && !value.value.servers.find(row => row.id === serverId).credentialReference;});
  check('Visible safe input seals a synthetic credential, clears the local field and invalidates trust on replacement and clear');
  await page.getByTestId('pi-acquisition-query').fill('local filesystem'); await page.getByTestId('pi-acquisition-search').click();
  await page.getByTestId('pi-acquisition-source-reviewed').waitFor();
  assert(await page.getByTestId('pi-acquisition-source-official_mcp').innerText());
  assert.equal(await page.locator('[data-testid^="pi-acquisition-prepare-"]').first().isDisabled(), true);
  check('Visible source discovery retains reviewed candidates during injected public-source outage and requires an active Task for prepare');
  sessionId = await page.getByTestId('pi-extensions').getAttribute('data-session-id'); assert.match(sessionId, /^aisession_/);
  await application.evaluate(({dialog}, selected) => {dialog.showOpenDialog = async () => ({canceled: false, filePaths: [selected]});}, packageRoot);
  await page.getByTestId('pi-extension-import').click(); await until(() => readback().packages.length === 1);
  const initial = readback().packages[0]; artifactId = initial.artifactId; assert.equal(initial.phase, 'quarantined'); assert.equal(initial.provenance.kind, 'local_import');
  await page.getByTestId('pi-extension-details-' + artifactId).getByRole('button').click();
  assert((await page.getByTestId('pi-extension-' + artifactId).innerText()).includes(initial.provenance.directoryFingerprint));
  assert.equal(await page.getByTestId('pi-extension-prepare-' + artifactId).isDisabled(), true);
  check('Native main picker imports an immutable local quarantine and the visible page exposes the real fingerprint without executing it');
  await page.getByTestId('nav-ai').click(); await page.getByTestId('office-prompt-input').fill('准备我导入的公开上下文扩展，核对实际本地回执。');
  await page.getByRole('button', {name: '发送消息', exact: true}).click(); await until(() => !!pendingModel, 60000);
  await settings();
  let cancelled = false;
  for (let attempt = 0; attempt < 8; attempt++) {
    const state = readback(); if (state.states.some(row => row.enabled && row.activeVersion === '1.0.0')) break;
    const prepare = page.getByTestId('pi-extension-prepare-' + artifactId); await prepare.waitFor(); await until(async () => !await prepare.isDisabled());
    await prepare.click();
    await until(async () => !!pendingLicense || readback().states.some(row => row.enabled && row.activeVersion === '1.0.0')
      || await prepare.isEnabled().catch(() => false), 60000);
    if (pendingLicense && !cancelled) {
      await until(async () => await page.getByTestId('pi-extension-' + artifactId).getAttribute('data-phase') === 'preparing');
      await page.getByTestId('pi-extension-cancel-' + artifactId).click();
      await until(() => readback().packages[0].phase === 'cancelled'); cancelled = true;
    } else await approvals();
  }
  assert(cancelled); assert(readback().states.some(row => row.enabled && row.activeVersion === '1.0.0'));
  check('An actual active Task prepares from the existing settings, handles original approvals and cancels then retries the real Node dependency preparation');
  releaseModel = true; answer(pendingModel, true); pendingModel = undefined;
  await page.getByTestId('nav-ai').click();
  await until(() => readback().invocations.some(row => row.success === 1) && readback().runs.some(row => row.status === 'succeeded'), 60000);
  const state = readback(); const invocation = state.invocations.find(row => row.success === 1); assert(invocation.contract_json);
  assert.equal(JSON.parse(invocation.contract_json).effect, 'external_effect');
  check('The same actual Pi Task invokes the UI-prepared isolated extension and stores the original governed receipt');
  await settings();
  for (const size of [{width: 1366, height: 768}, {width: 1920, height: 1080}]) {
    const nativeBounds = await application.evaluate(({BrowserWindow}, dimensions) => {
      const window = BrowserWindow.getAllWindows().find(item => !item.isDestroyed());
      window.unmaximize(); window.setContentSize(dimensions.width, dimensions.height); return window.getContentBounds();
    }, size);
    await page.setViewportSize(size); const button = page.getByTestId('pi-extension-revoke-' + artifactId); await button.scrollIntoViewIfNeeded();
    const box = await button.boundingBox(); assert(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= size.width && box.y + box.height <= size.height);
    report['layout' + size.width] = await page.evaluate(() => ({cssWidth: innerWidth, cssHeight: innerHeight, dpr: devicePixelRatio, nativeDisclosure: document.querySelectorAll('[data-testid="pi-extensions"] details,[data-testid="pi-extensions"] summary').length}));
    report['layout' + size.width].nativeContentBounds = nativeBounds;
    assert.equal(report['layout' + size.width].nativeDisclosure, 0);
    await page.screenshot({path: path.join(output, 'extensions-' + size.width + '.png')});
  }
  check('Actual extension controls and progressive disclosure remain reachable at both required desktop sizes');
  await page.getByTestId('pi-extension-revoke-' + artifactId).click(); await until(() => !!readback().states[0].versions[0].revokedAt);
  const runs = readback().runs.length; await application.close(); application = undefined; await launch(); await settings();
  const cold = readback(); assert.equal(cold.runs.length, runs); assert(cold.states[0].versions[0].revokedAt); assert.equal(cold.states[0].enabled, false);
  await page.getByTestId('pi-extension-revoke-' + artifactId).waitFor(); assert.equal(await page.getByTestId('pi-extension-revoke-' + artifactId).isDisabled(), true);
  assert.deepEqual(rendererErrors, []);
  check('Visible idle revocation persists through actual cold main with no replayed Run and disabled revoked controls');
  report.success = true;
} catch (error) {report.error = error.stack; process.exitCode = 1; console.error(error); await page?.screenshot({path: path.join(output, 'failure.png')}).catch(() => {});}
finally {
  pendingModel?.destroy(); pendingLicense?.destroy(); await application?.close(); await mcpFixture.close();
  fixture.closeAllConnections(); await new Promise(resolve => fixture.close(resolve));
  report.modelCalls = modelCalls; report.licenseCalls = licenseCalls;
  fs.writeFileSync(path.join(output, 'model-bodies.json'), JSON.stringify(bodies, null, 2)); fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({success: report.success, passed: checks.length, root, output, error: report.error}));
}
