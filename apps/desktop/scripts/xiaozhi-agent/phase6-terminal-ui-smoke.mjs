import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {randomUUID, createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {_electron as electron} from 'playwright';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'xiaozhi-phase6-terminal-ui-'));
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'xiaozhi-phase6-terminal-ui-evidence-'));
const dataRoot = path.join(root, 'data'), workspace = path.join(root, 'owned-workspace'); fs.mkdirSync(workspace);
let scenario = [], modelCalls = 0;
const requests = [], errors = [], checks = [];
const report = {success: false, root, output, paidCalls: 0, checks, rendererErrors: errors,
  boundary: 'Built production main/preload/renderer, visible teacher actions, owned native directory picker fixture, actual isolated PTY, loopback model SSE. Screenshots establish functional reachability, with visual refinement remaining Phase7.'};
const server = http.createServer(async (request, response) => {
  try {
    if (request.url === '/v1/models') {request.resume(); response.writeHead(200, {'content-type': 'application/json'}); response.end(JSON.stringify({object: 'list', data: [{id: 'deepseek-flash', context_window: 1048576, max_output_tokens: 32768, input_modalities: ['text']}]})); return;}
    assert.equal(request.url, '/v1/chat/completions'); let text = '';
    for await (const bytes of request) text += bytes.toString('utf8'); requests.push(JSON.parse(text)); modelCalls++;
    const tool = scenario.shift(), base = {id: 'phase6-ui', object: 'chat.completion.chunk', created: 1, model: 'deepseek-flash'};
    const delta = tool ? {role: 'assistant', tool_calls: [{index: 0, id: 'call_' + randomUUID().replaceAll('-', ''), type: 'function', function: {name: tool.name, arguments: JSON.stringify(tool.input)}}]}
      : {role: 'assistant', content: '终端保留在原任务中，教师现在可以直接输入或结束终端。'};
    response.writeHead(200, {'content-type': 'text/event-stream'});
    response.write('data: ' + JSON.stringify({...base, choices: [{index: 0, delta, finish_reason: null}]}) + '\n\n');
    response.write('data: ' + JSON.stringify({...base, choices: [{index: 0, delta: {}, finish_reason: tool ? 'tool_calls' : 'stop'}], usage: {prompt_tokens: 100, completion_tokens: 30, total_tokens: 130}}) + '\n\n');
    response.end('data: [DONE]\n\n');
  } catch (error) {errors.push(String(error.stack)); response.writeHead(500); response.end();}
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); const port = server.address().port;
const bootstrap = path.join(output, 'bootstrap.cjs');
fs.writeFileSync(bootstrap, `const {app,net}=require('electron');app.setPath('userData',${JSON.stringify(path.join(root, 'profile'))});net.fetch=async(input,init)=>{const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);if(url.origin!=='https://api.deepseek.com')throw Error('owned source outage');return fetch('http://127.0.0.1:${port}'+url.pathname,init);};import(${JSON.stringify(pathToFileURL(path.resolve('out/main/index.js')).href)});`);
let application, page, sessionId, jobId, taskId;
async function until(action, timeout = 45000) {const end = Date.now() + timeout; do {if (await action()) return; await page.waitForTimeout(100);} while (Date.now() < end); throw Error('ui_readback_timeout');}
function check(name, detail) {checks.push({name, pass: true, ...(detail ? {detail} : {})}); console.log('PASS ' + name);}
async function launch() {
  const env = {...process.env, OMNI_EDU_DATA_ROOT: dataRoot, OMNI_EDU_REPO_ROOT: path.resolve('../..'), OMNI_EDU_E2E_DIALOG_MODE: '1', OMNI_EDU_XIAOZHI_PI: '1', DEEPSEEK_API_KEY: 'synthetic-phase6-ui', DEEPSEEK_MODEL: 'deepseek-flash'};
  delete env.NODE_OPTIONS; delete env.ELECTRON_RUN_AS_NODE;
  application = await electron.launch({args: [bootstrap, '--force-device-scale-factor=1'], env, timeout: 60000}); page = await application.firstWindow();
  page.on('pageerror', error => errors.push(error.message));
  await page.getByTestId('xiaozhi-pi-workspace').waitFor({timeout: 40000});
  await page.waitForFunction(() => !document.querySelector('[data-testid="office-prompt-input"]')?.disabled);
}
async function read() {return page.evaluate(input => window.omniEdu.readXiaozhiTerminal(input), {sessionId, jobId, sinceSequence: 0});}
async function waitOutput(marker) {await until(async () => {const result = await read(); return result.ok && result.data.output.includes(marker);});}
async function consoleView() {
  const console = page.locator(`[data-testid="agent-terminal-output"][data-terminal-id="${jobId}"]`).first();
  if (!await console.isVisible()) {
    const jobs = page.getByTestId('terminal-jobs-toggle');
    if (await jobs.getAttribute('aria-expanded') !== 'true') await jobs.click();
    await page.getByTestId(`terminal-select-${jobId}`).click();
  }
  await console.waitFor(); return console;
}
async function input(console, command) {await console.getByTestId('terminal-input').fill(command); await console.getByTestId('terminal-send').click();}
try {
  await launch();
  await page.getByRole('button', {name: '设置', exact: true}).click();
  await page.getByTestId('pi-settings-tab-permissions').click();
  await application.evaluate(({dialog}, directory) => {dialog.showOpenDialog = async () => ({canceled: false, filePaths: [directory]});}, workspace);
  await page.getByTestId('pi-settings-workspace-choose').click();
  await page.getByText('owned-workspace', {exact: true}).first().waitFor();
  await page.getByTestId('pi-settings-permission-fullAccess').click();
  await page.waitForFunction(() => document.querySelector('[data-testid="pi-settings-permission-fullAccess"]')?.getAttribute('aria-pressed') === 'true');
  await page.getByTestId('nav-ai').click();
  sessionId = await page.locator('.office-composer-container').getAttribute('data-session-id'); assert(sessionId);
  scenario = [{name: 'exec_command', input: {cmd: "$global:uiValue=40; Write-Output ('UI_'+'READY')", tty: true, background: true, yield_time_ms: 1000}}];
  await page.getByTestId('office-prompt-input').fill('在这个任务打开持久终端，让我在回答结束后继续输入。');
  await page.getByRole('button', {name: '发送消息', exact: true}).click();
  await until(async () => {const listed = await page.evaluate(id => window.omniEdu.listXiaozhiTerminals(id), sessionId); if (!listed.ok || listed.data.jobs.length !== 1) return false;
    const job = listed.data.jobs[0]; jobId = job.jobId; taskId = job.taskId; return job.controller === 'teacher' && job.controls.write && modelCalls === 2;}, 90000);
  await waitOutput('UI_READY'); let console = await consoleView();
  await console.getByTestId('terminal-viewport').locator('.xterm').waitFor();
  check('Visible original Pi tool opens an actual persistent PTY and leaves idle teacher input enabled');
  const calls = modelCalls;
  for (const size of [{width: 1366, height: 768}, {width: 1920, height: 1080}]) {
    await application.evaluate(({BrowserWindow}, value) => {const window = BrowserWindow.getAllWindows().find(window => !window.isDestroyed()); window.unmaximize(); window.setContentSize(value.width, value.height);}, size);
    await page.setViewportSize(size); console = await consoleView();
    await input(console, "$global:uiValue++; Write-Output ('UI_VALUE_'+$global:uiValue); Write-Output ('中文'+'🙂')");
    const expected = size.width === 1366 ? 'UI_VALUE_41' : 'UI_VALUE_42'; await waitOutput(expected); await waitOutput('中文🙂');
    assert.equal(modelCalls, calls);
    const button = console.getByTestId('terminal-close'); await button.scrollIntoViewIfNeeded();
    const box = await button.boundingBox(); assert(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= size.width && box.y + box.height <= size.height);
    assert(await button.evaluate(element => {const box=element.getBoundingClientRect();return element.contains(document.elementFromPoint(box.x+box.width/2,box.y+box.height/2));}), 'visible stop control must receive pointer input');
    await page.screenshot({path: path.join(output, `terminal-${size.width}x${size.height}.png`)});
    check(`Actual ${size.width}x${size.height} terminal accepts UTF8 input without a model request and exposes the stop control`);
    await page.getByTestId('terminal-jobs-toggle').click();
    const review = page.locator(`[data-testid="pi-task-review"][data-task-id="${taskId}"]`).first();
    await review.getByTestId('pi-task-review-toggle').click();
    await review.getByTestId('pi-task-recovery').waitFor();
    const refresh = review.getByTestId('pi-task-review-refresh'); await refresh.scrollIntoViewIfNeeded();
    assert(await refresh.isEnabled());
    const reviewBox = await refresh.boundingBox(); assert(reviewBox && reviewBox.y >= 0 && reviewBox.y + reviewBox.height <= size.height);
    await page.screenshot({path: path.join(output, `task-recovery-${size.width}x${size.height}.png`)});
    assert.equal(modelCalls, calls);
    await review.getByTestId('pi-task-review-toggle').click();
    check(`Actual ${size.width}x${size.height} Task review reads the original recovery diagnostics and exposes explicit refresh`);
    console = await consoleView();
  }
  await input(console, "Write-Output ('UI_'+'SLEEP'); Start-Sleep -Seconds 30"); await waitOutput('UI_SLEEP');
  const beforeInterrupt = await read(); assert(beforeInterrupt.ok);
  await console.getByTestId('terminal-interrupt').click();
  await until(async () => {const result = await read(); return result.ok && result.data.output.slice(beforeInterrupt.data.output.length).includes('PS ');});
  await input(console, "Write-Output ('AFTER_UI_'+'CTRL_C')"); await waitOutput('AFTER_UI_CTRL_C'); assert.equal(modelCalls, calls);
  check('Visible Ctrl+C interrupts the guest while the same idle shell accepts the next command');
  scenario = [{name: 'write_stdin', input: {job_id: jobId, chars: "Write-Output ('AGENT_VALUE_'+$global:uiValue)\r"}}];
  await page.getByTestId('office-prompt-input').fill('向刚才终端输入检查变量的命令，继续原任务。');
  await page.getByRole('button', {name: '发送消息', exact: true}).click();
  await waitOutput('AGENT_VALUE_42');
  await until(async () => {const value = await read(); return value.ok && value.data.job.controller === 'teacher' && value.data.job.controls.write;});
  const continued = await read(); assert(continued.ok); assert.equal(continued.data.job.taskId, taskId); console = await consoleView();
  check('The next visible teacher message resumes the original Task and Job through the original Pi loop');
  const afterAgent = modelCalls;
  await input(console, "Write-Output ('UI_EOF_'+'WAIT'); $line=[Console]::ReadLine(); if($null -eq $line){Write-Output ('UI_EOF_'+'DONE')}");
  await waitOutput('UI_EOF_WAIT'); await console.getByTestId('terminal-eof').click(); await waitOutput('UI_EOF_DONE');
  assert.equal(modelCalls, afterAgent);
  check('The visible EOF action reaches an actual Console.ReadLine without closing its input channel');
  await console.getByTestId('terminal-close').click();
  await until(async () => {const value = await read(); return value.ok && value.data.job.cleanup === 'complete' && value.data.job.terminal.state !== 'running';});
  assert.equal(modelCalls, afterAgent);
  await page.getByTestId('terminal-jobs-toggle').click();
  const finalReview=page.locator(`[data-testid="pi-task-review"][data-task-id="${taskId}"]`).first();
  await finalReview.getByTestId('pi-task-review-toggle').click();
  await finalReview.getByTestId('pi-task-review-check').first().waitFor();
  for(const item of await finalReview.getByTestId('pi-task-review-check').all()){
    await item.locator('[data-slot="checkbox-control"]').click();
    assert(await item.getByRole('checkbox').isChecked());
  }
  await finalReview.getByTestId('pi-task-review-accept').click();
  await until(async()=>{const value=await page.evaluate(id=>window.omniEdu.getXiaozhiTask({sessionId:id}),sessionId);return value.ok&&value.value.task?.id===taskId&&value.value.task.state==='completed';});
  assert.equal(modelCalls,afterAgent);
  check('Visible Teacher confirmation completes the original Task through local readback without another model request');
  await application.close(); application = undefined; await launch();
  const restored = await read(); assert(restored.ok); assert.equal(restored.data.job.cleanup, 'complete'); assert.equal(restored.data.job.controls.write, false);
  assert.equal(modelCalls, afterAgent); assert.deepEqual(errors, []);
  check('Visible close waits for native cleanup and cold history stays read-only with zero replay');
  report.success = true;
} catch (error) {report.error = error.stack; process.exitCode = 1; console.error(error); if (page) await page.screenshot({path: path.join(output, 'failure.png')}).catch(() => {});}
finally {
  await application?.close().catch(() => {}); server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  report.modelCalls = modelCalls; report.sessionId = sessionId; report.jobId = jobId;
  fs.writeFileSync(path.join(output, 'model-requests.json'), JSON.stringify(requests, null, 2));
  const files = ['out/main/index.js', 'out/preload/index.js', 'src/main/xiaozhi-agent/capabilities/generated/core-tool-manifest.json', 'scripts/xiaozhi-agent/phase6-terminal-ui-smoke.mjs'];
  report.identity = files.filter(file => fs.existsSync(file)).map(file => ({file, sha256: createHash('sha256').update(fs.readFileSync(file)).digest('hex')}));
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({success: report.success, passed: checks.length, root, output, error: report.error}));
}
