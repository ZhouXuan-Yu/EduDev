import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import {createHash} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {_electron as electron} from 'playwright';

const build = process.argv[2], acceptance = process.env.OMNI_EDU_PROVIDER_ACCEPTANCE_ROOT;
const statusUi=process.argv.includes('--status-ui');
assert(path.isAbsolute(build ?? '') && path.isAbsolute(acceptance ?? ''), 'Set the verified build and acceptance root');
const main = await fs.realpath(path.join(build, 'main/index.js'));
const root = await fs.mkdtemp(path.join(await fs.realpath(acceptance), 'model-wire-health-'));
const data = path.join(root, 'data'), profile = path.join(root, 'profile');
const report = {root, main, mainHash: createHash('sha256').update(await fs.readFile(main)).digest('hex'),
  checks: [], calls: [], paidCalls: 0, success: false};
let mode = 'exhausted', attempts = 0, app, page, input, session;
const server = http.createServer(async (request, response) => {
  if (request.url === '/v1/models') {
    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify({object: 'list', data: [{id: 'deepseek-flash', context_window: 1048576, max_output_tokens: 32768, input_modalities: ['text']}]}));
    return;
  }
  if (request.url !== '/v1/chat/completions' || request.method !== 'POST') {response.writeHead(404).end(); return;}
  let encoded = '';
  for await (const part of request) encoded += part;
  const body = JSON.parse(encoded), number = ++attempts;
  const status = mode === 'exhausted' ? 500 : mode === 'long-rate-limit' || mode === 'sequence' && number === 1 ? 429
    : mode === 'sequence' && number === 2 ? 503 : mode === 'auth-401' ? 401 : mode === 'auth-403' ? 403 : 200;
  report.calls.push({mode, number, status, at: performance.now(), model: body.model});
  if (mode === 'uncertain-post') {response.destroy(); return;}
  if (status !== 200) {
    const retryAfter = mode === 'long-rate-limit' ? '90' : mode === 'sequence' ? number === 1 ? '0.02' : 'invalid' : '0';
    report.calls.at(-1).retryAfter = retryAfter;
    response.writeHead(status, {'content-type': 'application/json', 'retry-after': retryAfter,
      ...(status === 401 || status === 403 ? {'x-should-retry': 'true'} : {})});
    response.end(JSON.stringify({error: {type: 'server_error', message: 'Owned loopback provider unavailable'}}));
    return;
  }
  const chunk = (delta, finish_reason = null) => 'data: ' + JSON.stringify({id: 'model-wire-fixture',
    object: 'chat.completion.chunk', created: 1, model: body.model, choices: [{index: 0, delta, finish_reason}]}) + '\n\n';
  response.writeHead(200, {'content-type': 'text/event-stream'});
  if (mode === 'partial') {
    response.write(chunk({role: 'assistant', content: '合成提示：先说明方向。'}));
    await delay(320);
    response.destroy();
    return;
  }
  response.end(chunk({role: 'assistant', content: '合成示例：浮力的方向竖直向上。'}) + chunk({}, 'stop') + 'data: [DONE]\n\n');
});

async function until(action, timeoutMs = 60_000) {
  const deadline = performance.now() + timeoutMs;
  do {
    const found = await action();
    if (found) return found;
    await delay(35);
  } while (performance.now() < deadline);
  throw Error('The isolated request did not settle');
}
function verifyCount(phase, count) {
  assert.equal(report.calls.filter(entry => entry.mode === phase).length, count);
}

try {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const env = Object.fromEntries(Object.entries(process.env).filter(([name]) =>
    !/KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL|NODE_OPTIONS|ELECTRON_RUN_AS_NODE|ELECTRON_RENDERER_URL/iu.test(name)));
  Object.assign(env, {OMNI_EDU_SKIP_DOTENV: '1', OMNI_EDU_REPO_ROOT: path.resolve(import.meta.dirname, '../../../..'),
    OMNI_EDU_DATA_ROOT: data, OMNI_EDU_XIAOZHI_PI: '1', DEEPSEEK_API_KEY: 'owned-model-wire-fixture', DEEPSEEK_MODEL: 'deepseek-flash',
    TEMP: root, TMP: root});
  async function launch(credential = 'owned-model-wire-fixture') {
    app = await electron.launch({args: [main, '--user-data-dir=' + profile], env: {...env, DEEPSEEK_API_KEY: credential}, timeout: 60_000});
  await app.evaluate(({net}, endpoint) => {
    net.fetch = (input, init) => {
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
      if (url.origin !== 'https://api.deepseek.com') throw Error('The owned fixture blocks other destinations');
      return fetch(endpoint + url.pathname + url.search, init);
    };
  }, 'http://127.0.0.1:' + server.address().port);
  page = await app.firstWindow();
  input = page.getByTestId('office-prompt-input');
  await input.waitFor();
  await until(async () => !await input.isDisabled());
    const current = await page.locator('.office-composer-container').getAttribute('data-session-id');
    if (session) assert.equal(current, session);
    session = current;
  }
  await launch();
  const snapshot = () => page.evaluate(id => window.omniEdu.getXiaozhiSnapshot(id), session);
  async function send(text, phase) {
    mode = phase;
    attempts = 0;
    const previous = (await snapshot()).projection.turns.at(-1)?.id;
    await input.fill(text);
    await page.getByRole('button', {name: '发送消息', exact: true}).click();
    const state = await until(async () => {
      const current = await snapshot(), turn = current.projection.turns.at(-1);
      return turn && turn.id !== previous && !current.running && !await input.isDisabled() ? current : undefined;
    });
    const turn = state.projection.turns.at(-1);
    const usage = state.usage.find(entry => entry.runId === turn.id);
    report[phase] = {id: turn.id, status: turn.status, errorCode: turn.errorCode, usage, requests: turn.modelRequests};
    return {turn, usage};
  }

  if(statusUi)await page.evaluate(()=>{
    window.providerStatusEvents=[];
    window.omniEdu.onXiaozhiEvent(event=>{
      if(event.kind==='model_request')window.providerStatusEvents.push(event);
    });
  });
  const sequence = await send('用一句话说明浮力方向和大小。', 'sequence');
  verifyCount('sequence', 3);
  assert.equal(sequence.usage.modelCalls, 3);
  assert.equal(sequence.turn.status, 'completed');
  const wire = report.calls.filter(row => row.mode === 'sequence');
  assert.deepEqual(wire.map(row => row.status), [429, 503, 200]);
  assert(wire[1].at - wire[0].at >= 20);
  if(statusUi){
    const section=page.locator(`[data-turn-id="${sequence.turn.id}"]`);
    const notice=section.getByTestId('office-model-requests');
    assert.equal(await notice.count(),1);
    assert.match(await notice.innerText(),/连接已恢复/u);
    assert.equal(new Set(sequence.turn.modelRequests.map(row=>`${row.request}:${row.attempt}`)).size,3);
    assert.match(await section.innerText(),/用一句话说明浮力方向和大小/u);
    const feedbackObservedAt=performance.now();
    const lastDispatchAt=wire.at(-1).at;
    assert(feedbackObservedAt>=lastDispatchAt);
    const events=await page.evaluate(id=>window.providerStatusEvents.filter(event=>event.runId===id),sequence.turn.id);
    assert(events.length>=3);
    assert(events.every((event,index)=>!index||event.sequence>events[index-1].sequence));
    assert.deepEqual(events.filter(event=>event.request.state==='sending').map(event=>event.request.attempt),[1,2,3]);
    assert.equal(events.at(-1).request.state,'accepted');
    await section.screenshot({path:path.join(root,'connection-recovered.png')});
    report.statusUi={recovered:sequence.turn.id,feedbackObservedAt,lastDispatchAt,
      feedbackAfterDispatchMs:feedbackObservedAt-lastDispatchAt,events};
  }
  report.checks.push('Short valid Retry-After and invalid-header fallback stay within the original three physical requests');
  const exhausted = await send('用一句话说明浮力方向。', 'exhausted');
  verifyCount('exhausted', 3);
  assert.equal(exhausted.usage.modelCalls, 3);
  assert.equal(exhausted.turn.errorCode, 'provider_unavailable');
  report.checks.push('Three original wire attempts exhaust the same authorized model request');
  const blocked = await send('再次说明浮力方向。', 'blocked');
  verifyCount('blocked', 0);
  assert.equal(blocked.usage?.modelCalls ?? 0, 0);
  assert.equal(blocked.turn.errorCode, 'provider_cooldown');
  if(statusUi){
    const section=page.locator(`[data-turn-id="${blocked.turn.id}"]`);
    assert.equal(await section.getAttribute('data-state'),'failed');
    assert.match(await section.innerText(),/服务正在冷却，本轮未发送/u);
    assert(await section.getByTestId('office-turn-retry').isEnabled());
    await section.screenshot({path:path.join(root,'cooldown-not-sent.png')});
    report.statusUi.cooldown=blocked.turn.id;
  }
  report.checks.push('A new turn during cooldown uses zero requests and zero attempt budget');
  await delay(12_100);
  const recovered = await send('恢复后说明浮力方向。', 'recovered');
  verifyCount('recovered', 1);
  assert.equal(recovered.usage.modelCalls, 1);
  assert.equal(recovered.turn.status, 'completed');
  report.checks.push('A teacher request verifies recovery with one streamed call to the same model');
  const steady = await send('现在用一句话再说明。', 'steady');
  verifyCount('steady', 1);
  assert.equal(steady.turn.status, 'completed');
  assert(report.calls.every(row => row.model === 'deepseek-flash'));
  report.checks.push('A valid completed stream closes the circuit without any model switch');
  for (const status of [401, 403]) {
    const phase = 'auth-' + status;
    const rejected = await send('测试合成连接的授权反馈。', phase);
    verifyCount(phase, 1);
    assert.equal(rejected.usage.modelCalls, 1);
    assert.equal(rejected.turn.errorCode, 'authentication');
    if(statusUi&&status===401){
      const section=page.locator(`[data-turn-id="${rejected.turn.id}"]`);
      assert.match(await section.innerText(),/凭证不可用/u);
      assert(await section.getByTestId('office-turn-configure').isEnabled());
      await section.screenshot({path:path.join(root,'connection-needs-teacher.png')});
      report.statusUi.needsTeacher=rejected.turn.id;
    }
  }
  report.checks.push('401 and 403 are sent exactly once even when the provider advertises an SDK retry');
  const unknown = await send('核对合成请求在连接断开后的尝试数。', 'uncertain-post');
  verifyCount('uncertain-post', 1);
  assert.equal(unknown.usage.modelCalls, 1);
  assert.equal(unknown.turn.status, 'failed');
  const partial = await send('说明浮力方向，保留实际已收到的段落。', 'partial');
  verifyCount('partial', 1);
  assert.equal(partial.usage.modelCalls, 1);
  assert.equal(partial.usage.cost, null);
  assert.equal(partial.turn.status, 'failed');
  assert(partial.turn.items.some(item => item.text?.includes('合成提示：先说明方向。')));
  report.checks.push('An ambiguous POST and a broken partial stream each dispatch once and retain received text');
  const limited = await send('检查合成长限流。', 'long-rate-limit');
  verifyCount('long-rate-limit', 1);
  assert.equal(limited.turn.errorCode, 'rate_limited');
  const delayed = await send('在冷却期内再次检查合成限流。', 'long-rate-blocked');
  verifyCount('long-rate-blocked', 0);
  assert.equal(delayed.usage?.modelCalls ?? 0, 0);
  assert.equal(delayed.turn.errorCode, 'provider_cooldown');
  report.checks.push('A long Retry-After causes no early send or budget charge on the next turn');
  if (process.argv.includes('--cold')) {
    const beforeWake = report.calls.length;
    await app.evaluate(({powerMonitor}) => powerMonitor.emit('resume'));
    await delay(150);
    assert.equal(report.calls.length, beforeWake);
    const afterWake = await send('唤醒事件后核对合成限流。', 'wake-blocked');
    verifyCount('wake-blocked', 0);
    assert.equal(afterWake.usage?.modelCalls ?? 0, 0);
    assert.equal(afterWake.turn.errorCode, 'provider_cooldown');
    report.checks.push('The Electron resume handler schedules no work and keeps the active Retry-After');
    await app.close();app=undefined;
    const before = report.calls.length;
    mode = 'unrequested-startup';
    await launch();
    assert.equal(report.calls.length, before);
    const restored = await snapshot();
    assert.equal(restored.usage.find(row => row.runId === exhausted.turn.id)?.modelCalls, 3);
    assert.deepEqual(restored.projection.turns.find(row => row.id === exhausted.turn.id)?.modelRequests, exhausted.turn.modelRequests);
    const cold = await send('重启后检查合成限流是否仍然生效。', 'cold-blocked');
    verifyCount('cold-blocked', 0);
    assert.equal(cold.usage?.modelCalls ?? 0, 0);
    assert.equal(cold.turn.errorCode, 'provider_cooldown');
    report.checks.push('After a real Electron restart the original Retry-After and the persisted attempt count are intact');
    if(statusUi){
      const restored=page.locator(`[data-turn-id="${report.statusUi.recovered}"]`);
      assert.match(await restored.getByTestId('office-model-requests').innerText(),/连接已恢复/u);
      const stopped=page.locator(`[data-turn-id="${cold.turn.id}"]`);
      assert.match(await stopped.innerText(),/服务正在冷却，本轮未发送/u);
      assert.equal(await stopped.getAttribute('data-state'),'failed');
      report.statusUi.cold=cold.turn.id;
      const composer=page.locator('.office-composer-container');
      const beforeSessionSwitch=report.calls.length;
      await page.getByTestId('pi-new-session').click();
      const otherSession=await until(async()=>{
        const id=await composer.getAttribute('data-session-id');
        return id&&id!=='loading'&&id!==session?id:undefined;
      });
      await restored.waitFor({state:'detached'});
      await page.getByTestId('pi-sidebar-toggle').click();
      await page.getByTestId(`ai-conversation-session-${session}`).click();
      await until(async()=>await composer.getAttribute('data-session-id')===session);
      const restoredNotice=restored.getByTestId('office-model-requests');
      await restoredNotice.waitFor({state:'visible'});
      assert.equal(await restoredNotice.count(),1);
      assert.match(await restoredNotice.innerText(),/连接已恢复/u);
      assert.match(await restored.innerText(),/用一句话说明浮力方向和大小/u);
      assert.equal(report.calls.length,beforeSessionSwitch);
      report.statusUi.switched={from:session,to:otherSession,returned:session,dispatched:0};
      const diagnosticFile=path.join(root,'provider-recovery-diagnostic.json');
      await app.evaluate(({dialog},filePath)=>{
        dialog.showSaveDialog=async()=>({canceled:false,filePath});
      },diagnosticFile);
      await page.getByRole('button',{name:'设置',exact:true}).click();
      const advanced=page.getByTestId('pi-settings-advanced-toggle');
      if(await advanced.getAttribute('aria-expanded')!=='true')await advanced.click();
      await page.getByTestId('pi-settings-tab-diagnostics').click();
      await page.getByTestId('pi-diagnostic-run').selectOption(sequence.turn.id);
      await page.getByTestId('pi-diagnostic-preview').click();
      const diagnostic=JSON.parse(await page.getByTestId('pi-diagnostic-json').innerText());
      assert.equal(diagnostic.state,'completed');
      assert.deepEqual(diagnostic.requests.map(request=>request.attempt),[1,2,3]);
      await page.getByTestId('pi-diagnostic-save').click();
      await until(async()=>(await page.getByTestId('pi-diagnostic-notice').innerText()).includes('已保存'));
      const diagnosticHash=createHash('sha256').update(await fs.readFile(diagnosticFile)).digest('hex');
      assert.equal(diagnosticHash,await page.getByTestId('pi-diagnostic-hash').innerText());
      assert.equal(report.calls.length,beforeSessionSwitch);
      report.statusUi.diagnostic={file:diagnosticFile,sha256:diagnosticHash};
      report.checks.push('The actual conversation renders distinct recovered, cooldown and teacher settings feedback, restores it across restart and session switching, then exports the exact trace without duplicate prompts');
    }
    await app.close();app=undefined;
    await launch('owned-alternate-wire-fixture');
    const separate = await send('使用当前合成连接说明浮力。', 'separate-credential');
    verifyCount('separate-credential', 1);
    assert.equal(separate.turn.status, 'completed');
    report.checks.push('A different credential verifies its own domain without borrowing the previous cooldown');
  }
  report.success = true;
} catch (error) {
  report.error = String(error.stack ?? error);
  process.exitCode = 1;
} finally {
  await app?.close().catch(() => undefined);
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
  await fs.writeFile(path.join(root, 'report.json'), JSON.stringify(report, null, 2), {flag: 'wx'});
  console.log(JSON.stringify({success: report.success, checks: report.checks.length, root, error: report.error}));
}
