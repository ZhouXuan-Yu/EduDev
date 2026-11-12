import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {_electron as electron} from 'playwright';
import {DatabaseSync} from 'node:sqlite';
import http from 'node:http';
import {createHash} from 'node:crypto';
import {startMcpFixture} from './fixtures/mcp-server.mjs';

const output = fs.mkdtempSync(path.resolve('test-results/xiaozhi-agent/permission-phase3-ui-'));
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'xiaozhi-phase3-ui-'));
const dataRoot = path.join(root, 'data');
const workspace = path.join(root, '教师合成目录'); fs.mkdirSync(workspace);
fs.writeFileSync(path.join(workspace, 'source.txt'), 'synthetic');
fs.writeFileSync(path.join(workspace, 'existing.txt'), 'preserve');
fs.writeFileSync(path.join(workspace, 'delete.txt'), 'preserve-delete');
let scenario, step = 0, modelCalls = 0;
const fixture = http.createServer(async (request, response) => {
  request.resume();
  if (request.url === '/v1/models') {
    response.writeHead(200, {'content-type': 'application/json'});
    response.end(JSON.stringify({object: 'list', data: [{id: 'deepseek-flash', context_window: 1048576,
      max_output_tokens: 32768, input_modalities: ['text'], effort: {supported_levels: ['low', 'high', 'max'], default_level: 'low'}}]})); return;
  }
  if (request.url !== '/v1/chat/completions') {response.writeHead(404); response.end(); return;}
  modelCalls++;
  response.writeHead(200, {'content-type': 'text/event-stream'});
  const tool = scenario && step++ === 0;
  const base = {id: 'synthetic-phase3-ui', object: 'chat.completion.chunk', created: 1, model: 'deepseek-flash'};
  const delta = tool ? {role: 'assistant', tool_calls: [{index: 0, id: 'call_ui_' + modelCalls, type: 'function',
    function: {name: scenario.name, arguments: JSON.stringify(scenario.input)}}]} : {role: 'assistant', content: '当前申请已保存，请核对授权卡。'};
  response.write('data: ' + JSON.stringify({...base, choices: [{index: 0, delta, finish_reason: null}]}) + '\n\n');
  response.write('data: ' + JSON.stringify({...base, choices: [{index: 0, delta: {}, finish_reason: tool ? 'tool_calls' : 'stop'}], usage: {prompt_tokens: 100, completion_tokens: 30, total_tokens: 130}}) + '\n\n');
  response.end('data: [DONE]\n\n');
});
await new Promise(resolve => fixture.listen(0, '127.0.0.1', resolve));
const modelPort = fixture.address().port;
const mcpFixture = await startMcpFixture();
const bootstrap = path.join(output, 'bootstrap.cjs');
fs.writeFileSync(bootstrap, `const {app,net}=require('electron');app.setPath('userData',${JSON.stringify(path.join(root, 'profile'))});net.fetch=async(input,init)=>{const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);if(url.origin!=='https://api.deepseek.com')throw Error('external model delivery denied');return fetch('http://127.0.0.1:${modelPort}'+url.pathname,init);};import(${JSON.stringify(pathToFileURL(path.resolve('out/main/index.js')).href)});`);
let application, page;
const checks = [];
const report = {success: false, root, output, checks, paidCalls: 0, modelCalls: 0,
  boundary: 'Actual built Electron main/preload/conversation/settings controls with owned synthetic profile and loopback SSE. Native chooser uses a controlled main dialog fixture. Paid and real model calls 0. No Phase7 full page or real native-dialog acceptance claim.'};
function check(name) {checks.push({name, pass: true}); console.log('PASS ' + name);}
async function until(test, timeout = 15000) {
  const deadline = Date.now() + timeout;
  while (!test()) {
    if (Date.now() >= deadline) throw Error('fixture_readback_timeout');
    await page.waitForTimeout(30);
  }
}
async function launch() {
  const env = {...process.env, OMNI_EDU_DATA_ROOT: dataRoot, OMNI_EDU_REPO_ROOT: path.resolve('../..'),
    OMNI_EDU_E2E_DIALOG_MODE: '1', OMNI_EDU_XIAOZHI_PI: '1', DEEPSEEK_API_KEY: 'synthetic-ui-blocked', DEEPSEEK_MODEL: 'deepseek-flash'};
  delete env.NODE_OPTIONS; delete env.ELECTRON_RUN_AS_NODE;
  application = await electron.launch({args: [bootstrap], env, timeout: 60000});
  page = await application.firstWindow();
  await page.getByTestId('xiaozhi-pi-workspace').waitFor({timeout: 40000});
  await page.waitForFunction(() => !document.querySelector('[data-testid="office-prompt-input"]')?.disabled);
}
async function settings() {
  await page.getByRole('button', {name: '设置', exact: true}).click();
  await page.getByTestId('pi-settings-workspace').waitFor();
  await page.getByTestId('pi-settings-tab-permissions').click();
  await page.getByTestId('pi-permission-authority').waitFor();
}
function readback() {
  const db = new DatabaseSync(path.join(dataRoot, 'app.db'), {readOnly: true});
  try {return {profiles: db.prepare('SELECT document_json FROM xiaozhi_permission_profiles_v1').all().map(row => JSON.parse(row.document_json)),
    grants: db.prepare('SELECT document_json FROM xiaozhi_permission_grants_v1').all().map(row => JSON.parse(row.document_json)),
    approvals: db.prepare("SELECT payload_json FROM ai_confirmation_items WHERE action_type='xiaozhi_permission_v2'").all().map(row => JSON.parse(row.payload_json)),
    runs: db.prepare('SELECT count(*) AS n FROM ai_agent_runs').get().n};}
  finally {db.close();}
}
try {
  await launch(); await settings();
  await application.evaluate(({dialog}, selected) => {dialog.showOpenDialog = async () => ({canceled: false, filePaths: [selected]});}, workspace);
  await page.getByTestId('pi-settings-workspace-choose').click();
  await page.getByText(path.basename(workspace), {exact: true}).first().waitFor();
  await page.getByRole('button', {name: '刷新权限', exact: true}).click();
  await until(() => readback().grants.some(grant => grant.scope.root === workspace && grant.scope.actions.join(',') === 'read'));
  assert(readback().grants.some(grant => grant.scope.root === workspace && grant.scope.actions.join(',') === 'read'));
  check('Visible native chooser migrates its main read authority and displays actual Grant');
  await page.getByTestId('pi-settings-permission-fullAccess').click();
  await page.waitForFunction(() => document.querySelector('[data-testid="pi-settings-permission-fullAccess"]')?.getAttribute('aria-pressed') === 'true');
  assert.equal(readback().profiles.at(-1).mode, 'fullAccess');
  assert(readback().grants.some(grant => grant.scope.kind === 'process'));
  check('Visible existing fullAccess mode persists exact main process and workspace scopes');
  await page.getByTestId('pi-environment-settings').scrollIntoViewIfNeeded();
  await page.getByTestId('pi-environment-permission_runtime').waitFor();
  assert.match(await page.getByTestId('pi-environment-permission_runtime').innerText(), /核验|配置|不可用/);
  check('Existing permissions page presents actual local Environment diagnostics');
  for (const size of [{width: 1366, height: 768}, {width: 1920, height: 1080}]) {
    await page.setViewportSize(size);
    const control = page.getByTestId('pi-settings-permission-request'); await control.scrollIntoViewIfNeeded();
    const box = await control.boundingBox(); assert(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= size.width && box.y + box.height <= size.height);
    await page.screenshot({path: path.join(output, `permissions-${size.width}.png`)});
  }
  check('Mode controls are reachable at 1366x768 and 1920x1080');
  const revoke = page.getByTestId('pi-permission-revoke').first(); await revoke.scrollIntoViewIfNeeded(); await revoke.click();
  await page.waitForFunction(() => !document.querySelector('[data-testid="pi-permission-authority"] [role="alert"]'));
  // Wait for the SQLite-backed view refresh before reading the original record.
  await page.getByRole('button', {name: '刷新权限', exact: true}).click();
  assert(readback().grants.some(grant => grant.revokedAt));
  check('Visible revoke persists the Grant tombstone');
  await application.close(); application = undefined;
  await launch(); await settings();
  await page.waitForFunction(() => document.querySelector('[data-testid="pi-settings-permission-fullAccess"]')?.getAttribute('aria-pressed') === 'true');
  assert.equal(readback().runs, 0);
  check('Cold settings retain main mode and revoke facts with zero model or Task execution');
  await page.getByTestId('nav-ai').click();
  const previousSession = await page.locator('.office-composer-container').getAttribute('data-session-id');
  await page.getByTestId('pi-new-session').click();
  await page.waitForFunction(previous => {
    const current = document.querySelector('.office-composer-container')?.getAttribute('data-session-id');
    return current && current !== previous && !document.querySelector('[data-testid="office-prompt-input"]')?.disabled;
  }, previousSession);
  await application.evaluate(({dialog}, selected) => {dialog.showOpenDialog = async () => ({canceled: false, filePaths: [selected]});}, workspace);
  await page.getByTestId('pi-permission-picker').click();
  await page.getByRole('menuitem', {name: '选择教学工作目录', exact: true}).click();
  const selectedSession = await page.locator('.office-composer-container').getAttribute('data-session-id');
  await page.waitForFunction(async session => (await window.omniEdu.getXiaozhiSnapshot(session)).workspace?.label === '教师合成目录', selectedSession);
  scenario = {name: 'exec_command', input: {cmd: "Set-Content existing.txt 'OVERWRITE'; Remove-Item delete.txt", timeout: 10}}; step = 0;
  await page.getByTestId('office-prompt-input').fill('按合成脚本覆盖并删除文件，超出权限先发起真实申请。');
  await page.getByTestId('office-prompt-input').press('Enter');
  const scriptCard = page.getByTestId('pi-permission-approval').filter({hasText: '运行受控脚本'}).last();
  await scriptCard.waitFor({timeout: 60000});
  const scriptId = await scriptCard.getAttribute('data-approval-id');
  const scriptRevision = Number(await scriptCard.getAttribute('data-revision'));
  const original = readback().approvals.find(item => item.id === scriptId); assert(original);
  const scriptText = await scriptCard.innerText();
  assert(scriptText.includes('写入或覆盖')); assert(scriptText.includes('删除')); assert(scriptText.includes('Remove-Item'));
  assert(!scriptText.includes('复制教学资料')); assert(!scriptText.includes('已有同名文件不会被覆盖'));
  assert.equal(scriptRevision, original.revision);
  assert.equal(fs.readFileSync(path.join(workspace, 'existing.txt'), 'utf8'), 'preserve');
  assert(fs.existsSync(path.join(workspace, 'delete.txt')));
  await scriptCard.getByTestId('pi-permission-approve').click();
  await page.waitForFunction(id => document.querySelector(`[data-approval-id="${id}"]`)?.getAttribute('data-state') === 'approved', scriptId);
  const approved = readback().approvals.find(item => item.id === scriptId);
  assert.equal(approved.requestDigest, original.requestDigest); assert.equal(approved.revision, scriptRevision + 1);
  assert.deepEqual(approved.request, original.request);
  check('G3B-F01 conversation script card discloses overwrite/delete and approves the exact frozen id revision and request');
  const stale = await page.evaluate(input => window.omniEdu.decideXiaozhiPermission(input), {sessionId: original.request.owner.sessionId,
    approvalId: scriptId, revision: scriptRevision, decision: 'reject', scope: 'operation'});
  assert.equal(stale.ok, false); assert.equal(readback().approvals.find(item => item.id === scriptId).state, 'approved');
  await page.waitForFunction(async session => !(await window.omniEdu.getXiaozhiSnapshot(session)).running, original.request.owner.sessionId, {timeout: 60000});
  const source = await page.evaluate(async url => {
    // Snapshot running=false may precede release of the settings reservation.
    // A busy result has made no configuration change, so wait for that boundary.
    const deadline = Date.now() + 60000;
    let result;
    do {
      result = await window.omniEdu.addXiaozhiMcp({name: '合成MCP授权卡', transport: 'http', url});
      if (result.ok || result.error !== 'busy') break;
      if (Date.now() >= deadline) throw Error('MCP settings reservation did not settle');
      await new Promise(resolve => setTimeout(resolve, 100));
    } while (true);
    if (!result.ok) throw Error(JSON.stringify(result));
    let view = result.value;
    const input = () => ({schemaVersion: view.schemaVersion, revision: view.revision, serverId: view.servers[0].id});
    result = await window.omniEdu.inspectXiaozhiMcp(input()); if (!result.ok) throw Error(JSON.stringify(result)); view = result.value;
    result = await window.omniEdu.trustXiaozhiMcp({...input(), schemaHash: view.servers[0].schemaHash, tools: ['lookup_lesson']});
    if (!result.ok) throw Error(JSON.stringify(result)); return result.value.servers[0];
  }, mcpFixture.url);
  const identity = createHash('sha256').update(JSON.stringify([source.id, 'lookup_lesson'])).digest('hex').slice(0, 24);
  scenario = {name: `mcp_${identity}_lookup_lesson`, input: {topic: '合成MCP POST申请'}}; step = 0;
  await page.getByTestId('office-prompt-input').fill('调用已选择的合成MCP课程工具，外发前先申请。');
  await page.getByTestId('office-prompt-input').press('Enter');
  const mcpCard = page.getByTestId('pi-permission-approval').filter({hasText: '调用外部MCP工具'}).last();
  await mcpCard.waitFor({timeout: 60000});
  const mcpId = await mcpCard.getAttribute('data-approval-id');
  const mcpRequest = readback().approvals.find(item => item.id === mcpId);
  const mcpText = await mcpCard.innerText();
  assert(mcpText.includes('POST')); assert(mcpText.includes(new URL(mcpFixture.url).origin)); assert(mcpText.includes('教师私有资料'));
  assert(mcpText.includes('lookup_lesson')); assert(!mcpText.includes('复制教学资料')); assert(!mcpText.includes('已有同名文件不会被覆盖'));
  assert.equal(mcpFixture.state.calls, 0);
  await mcpCard.getByTestId('pi-permission-approve').click();
  await page.waitForFunction(id => document.querySelector(`[data-approval-id="${id}"]`)?.getAttribute('data-state') === 'approved', mcpId);
  assert.equal(readback().approvals.find(item => item.id === mcpId).requestDigest, mcpRequest.requestDigest);
  assert.equal(mcpFixture.state.calls, 0);
  await page.screenshot({path: path.join(output, 'conversation-permission-mcp.png')});
  check('G3B-F01 conversation MCP POST card discloses destination data and frozen input while stale revision is rejected');
  report.success = true;
} catch (error) {report.error = error.stack; process.exitCode = 1; console.error(error);}
finally {
  await application?.close().catch(() => {}); await mcpFixture.close();
  fixture.closeAllConnections(); await new Promise(resolve => fixture.close(resolve)); report.modelCalls = modelCalls;
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify({success: report.success, passed: checks.length, output, root, error: report.error}));
}
