import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createHash, randomUUID} from 'node:crypto';
import {_electron} from 'playwright';

const desktop = path.resolve(import.meta.dirname, '../..');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'xiaozhi-stream-tools-'));
const hash = value => createHash('sha256').update(value).digest('hex');
const report = {
  ok: false, root, checks: [], errors: [], paidRequests: 0,
  mainSha256: hash(fs.readFileSync(path.join(desktop, 'out/main/index.js'))),
};
let app, page, sessionId;
const check = text => { report.checks.push(text); console.log('PASS ' + text); };
async function until(work) {
  const end = Date.now() + 30000;
  while (Date.now() < end) {
    const value = await work();
    if (value) return value;
    await new Promise(resolve => setTimeout(resolve, 70));
  }
  throw Error('Stream observation deadline');
}
async function launch(cold = false) {
  const env = {
    ...process.env, OMNI_EDU_REPO_ROOT: path.resolve(desktop, '../..'),
    OMNI_EDU_DATA_ROOT: path.join(root, 'data'), OMNI_EDU_XIAOZHI_PI: '1',
    OMNI_EDU_E2E_DIALOG_MODE: '1', DEEPSEEK_API_KEY: 'synthetic-local-only',
    DEEPSEEK_MODEL: 'deepseek-flash',
  };
  for (const key of ['NODE_OPTIONS', 'ELECTRON_RUN_AS_NODE', 'ELECTRON_RENDERER_URL']) delete env[key];
  app = await _electron.launch({
    args: [path.join(desktop, 'out/main/index.js'), '--user-data-dir=' + path.join(root, 'profile')],
    cwd: desktop, env, timeout: 60000,
  });
  await app.evaluate(({net}, cold) => {
    const wire = globalThis.streamToolsWire = {requests: [], blocked: [], streams: []};
    net.fetch = async (input, init) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/models')) return new Response(JSON.stringify({object: 'list', data: [{
        id: 'deepseek-flash', context_window: 1048576, max_output_tokens: 32768,
        input_modalities: ['text'],
      }]}), {headers: {'content-type': 'application/json'}});
      if (cold || !url.includes('/chat/completions')) {
        wire.blocked.push(url);
        throw Error('External fetch or cold replay disabled');
      }
      const body = JSON.parse(init.body), index = wire.requests.length;
      wire.requests.push({index, tools: body.tools?.length || 0,
        toolSchemaBytes: JSON.stringify(body.tools || []).length, toolSizes: (body.tools||[]).map(t=>({name:t.function.name,characters:JSON.stringify(t).length})), requestBytes: JSON.stringify(body).length});
      const chunk = (delta, finish_reason = null) => 'data: ' + JSON.stringify({
        id: 'stream-local', object: 'chat.completion.chunk', model: body.model,
        choices: [{index: 0, delta, finish_reason}],
      }) + '\n\n';
      const stream = new ReadableStream({start(controller) {
        wire.streams[index] = {controller, chunk};
        controller.enqueue(new TextEncoder().encode(chunk({role: 'assistant'}) + chunk({
          reasoning_content: index === 0 ? '第一段合成思考正在核对条件。' : index === 1
            ? '工具之后的合成思考继续核对。' : '停止前已收到的合成思考。',
        })));
      }});
      return new Response(stream, {headers: {'content-type': 'text/event-stream'}});
    };
  }, cold);
  page = await app.firstWindow();
  page.on('pageerror', error => report.errors.push(String(error)));
  await page.getByTestId('office-prompt-input').waitFor({timeout: 60000});
  assert((await page.evaluate(() => window.omniEdu.getXiaozhiSettings({refresh: true}))).ok);
  sessionId = await until(() => page.locator('.office-composer-container').getAttribute('data-session-id'));
}
const snapshot = () => page.evaluate(id => window.omniEdu.getXiaozhiSnapshot(id), sessionId);
async function push(index, delta, finish) {
  await app.evaluate((_, value) => {
    const stream = streamToolsWire.streams[value.index];
    stream.controller.enqueue(new TextEncoder().encode(stream.chunk(value.delta, value.finish || null)));
    if (value.finish) {
      stream.controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
      stream.controller.close();
    }
  }, {index, delta, finish});
}
async function send(prompt) {
  await page.getByTestId('office-prompt-input').fill(prompt);
  await page.getByTestId('office-prompt-input').press('Enter');
}
try {
  await launch();
  await send('请用合成资料检查浮力，先读取资料目录，再给出简明结论。');
  await page.getByTestId('model-reasoning').filter({hasText: '第一段合成思考'}).waitFor();
  assert((await snapshot()).running);
  await push(0, {reasoning_content: '第二次增量已经收到。'});
  await page.getByTestId('model-reasoning').filter({hasText: '第二次增量已经收到'}).waitFor();
  assert.equal(await page.getByTestId('reply-waiting').count(), 0);
  check('Original composer/Pi/journal streams two actual reasoning updates before completion');
  await push(0, {content: '<xiaozhi_progress>先核对本次合成资料目录。</xiaozhi_progress>'});
  await page.getByTestId('reply-process-summary').filter({hasText: '合成资料目录'}).waitFor();
  await push(0, {tool_calls: [{index: 0, id: 'stream-read', type: 'function', function: {
    name: 'office_list_files', arguments: JSON.stringify({path: '.'}),
  }}]}, 'tool_calls');
  await page.getByTestId('model-reasoning').filter({hasText: '工具之后'}).waitFor();
  const tool = (await snapshot()).projection.turns.at(-1).items.find(item => item.id === 'stream-read');
  assert.equal(tool?.status, 'completed');
  assert.equal(tool?.toolAttempt?.state, 'succeeded');
  const order = await page.locator('[data-testid="agent-trace-timeline"]').last()
    .locator('[data-testid="model-reasoning"],[data-testid="reply-process-summary"],[data-testid="office-tool-step"]')
    .evaluateAll(nodes => nodes.map(node => node.getAttribute('data-testid')));
  assert.deepEqual(order, ['model-reasoning', 'reply-process-summary', 'office-tool-step', 'model-reasoning']);
  check('Provider reasoning, public commentary and real original tool stay in captured order');
  await push(1, {content: '<xiaozhi_answer>合成最终正文已经开始。'});
  const toggle = page.getByTestId('agent-trace-toggle').last();
  await until(async () => await toggle.getAttribute('aria-expanded') === 'false');
  await toggle.click();
  await page.getByTestId('model-reasoning').filter({hasText: '工具之后'}).waitFor();
  await push(1, {content: '正文的后续增量保持展开状态。</xiaozhi_answer>'});
  await page.getByTestId('agent-reply-body').filter({hasText: '后续增量'}).waitFor();
  assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
  await push(1, {}, 'stop');
  await until(async () => !(await snapshot()).running);
  check('Explicit answer handoff folds once and manual reopen survives later answer tokens');
  await send('请继续合成检查，稍后由教师停止。');
  await page.getByTestId('model-reasoning').filter({hasText: '停止前已收到'}).waitFor();
  assert((await page.evaluate(id => window.omniEdu.stopXiaozhi(id), sessionId)).ok);
  await until(async () => {
    const state = await snapshot();
    return !state.running && state.projection.turns.at(-1)?.status === 'interrupted';
  });
  const stopped = (await snapshot()).projection.turns.at(-1);
  assert(stopped.modelReasoning.some(block => block.status === 'interrupted' && block.text.includes('停止前')));
  const stoppedToggle = page.getByTestId('agent-trace-toggle').last();
  if (await stoppedToggle.getAttribute('aria-expanded') === 'false') await stoppedToggle.click();
  await page.getByText('此段思考未完成。', {exact: true}).last().waitFor();
  for (const [width, height] of [[1366, 768], [1920, 1080]]) {
    await app.evaluate(({BrowserWindow}, size) => BrowserWindow.getAllWindows()[0].setContentSize(...size), [width, height]);
    await page.screenshot({path: path.join(root, `reasoning-${width}.png`)});
    assert(await page.getByTestId('model-reasoning').filter({hasText: '停止前'}).isVisible());
  }
  report.saved = (await snapshot()).projection.turns;
  report.wire = await app.evaluate(() => ({requests: streamToolsWire.requests, blocked: streamToolsWire.blocked}));
  await app.close(); app = undefined;
  await launch(true);
  assert.deepEqual((await snapshot()).projection.turns.map(turn => turn.modelReasoning), report.saved.map(turn => turn.modelReasoning));
  assert.equal(await app.evaluate(() => streamToolsWire.requests.length), 0);
  assert.deepEqual(report.errors, []);
  check('Stop preserves incomplete reasoning at both viewport sizes; cold original history keeps exact blocks with zero replay');
  report.ok = true;
} catch (error) {
  report.error = String(error.stack); process.exitCode = 1;
  await page?.screenshot({path: path.join(root, 'failure.png')}).catch(() => {});
} finally {
  await app?.close().catch(() => {});
  fs.writeFileSync(path.join(root, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ok: report.ok, root, checks: report.checks.length, error: report.error}));
}
