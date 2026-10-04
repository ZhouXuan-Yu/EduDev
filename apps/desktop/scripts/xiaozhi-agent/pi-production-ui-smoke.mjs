import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { _electron as electron } from 'playwright';
import { DatabaseSync } from 'node:sqlite';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const config = fs.readFileSync(path.join(appRoot, '.env.local'), 'utf8');
const pick = name => config.match(new RegExp(`^${name}\\s*=\\s*(.*?)\\s*$`, 'm'))?.[1]?.replace(/^['"]|['"]$/g, '');
const key = process.env.DEEPSEEK_API_KEY || pick('DEEPSEEK_API_KEY');
const model = process.env.DEEPSEEK_MODEL || pick('DEEPSEEK_MODEL') || 'deepseek-chat';
assert(key);
const output = fs.mkdtempSync(path.join(appRoot, 'test-results/xiaozhi-agent/pi-production-ui-'));
const dataRoot = path.join(output, 'data');
const marker = randomUUID().slice(0, 8);
const fixture = path.join(output, '分数加法教研.md');
fs.writeFileSync(fixture, `# 分数加法与通分\n五年级数学教研，核验编号 ${marker}，备课时间37分钟。\n同分母分数相加：保持分母不变，把分子相加。异分母分数相加：先通分再相加。教师用圆形分块图帮助理解单位相同才能相加。学生先比较两个分数的分母，再选择同分母直接加或通分的方法。安排导入10分钟、图示探究15分钟、巩固练习10分钟、总结2分钟。原题需保留来源，例题和生成变式都由教师复核。\n`);
const checks = [], report = { suite: 'pi-production-education-ui', success: false, checks, model,
  boundaries: ['Actual formal Electron main/preload/page, real DeepSeek, synthetic teacher resource', 'No VPN-off or complete harness claim'] };
let application, page;
const check = (name, fn) => { fn(); checks.push({ name, pass: true }); };
async function launch(apiKey = key) {
  const env = { ...process.env, DEEPSEEK_API_KEY: apiKey, DEEPSEEK_MODEL: model,
    OMNI_EDU_XIAOZHI_PI: '1', OMNI_EDU_DATA_ROOT: dataRoot, OMNI_EDU_REPO_ROOT: path.resolve(appRoot, '../..'), OMNI_EDU_E2E_DIALOG_MODE: '1' };
  delete env.ELECTRON_RUN_AS_NODE; delete env.NODE_OPTIONS;
  application = await electron.launch({ args: [path.join(appRoot, 'out/main/index.js')], env, timeout: 60000 });
  page = await application.firstWindow();
  await page.getByTestId('xiaozhi-pi-workspace').waitFor({ state: 'visible', timeout: 30000 });
  await page.getByTestId('ai-return-workspace').click();
  await page.getByTestId('nav-ai').waitFor({ state: 'visible', timeout: 30000 });
}
async function enterAi() {
  await page.getByTestId('nav-ai').click();
  await page.getByTestId('xiaozhi-pi-workspace').waitFor({ state: 'visible' });
  await page.getByTestId('office-prompt-input').waitFor({ state: 'visible' });
  await page.waitForFunction(() => !document.querySelector('[data-testid="office-prompt-input"]')?.disabled);
}
async function readRows() {
  const db = new DatabaseSync(path.join(dataRoot, 'app.db'), { readOnly: true });
  try { return { bindings: db.prepare('SELECT * FROM xiaozhi_pi_session_bindings').all(),
    messages: db.prepare('SELECT role,content,metadata_json FROM ai_conversation_messages ORDER BY created_at').all(),
    runs: db.prepare("SELECT id,status,error_message FROM ai_agent_runs WHERE sub_intent='pi_education'").all() }; }
  finally { db.close(); }
}
try {
  await launch();
  // Native chooser fixture only; the visible import button and real importer execute.
  await application.evaluate(({ dialog }, file) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] }); }, fixture);
  await page.getByTestId('nav-knowledge').click();
  await page.getByRole('button', { name: '导入知识资源', exact: true }).click();
  await page.getByText('分数加法教研.md', { exact: true }).first().waitFor({ state: 'visible' });
  await enterAi();
  await page.evaluate(() => { window.piPublicTestEvents = []; window.omniEdu.onXiaozhiEvent(e => window.piPublicTestEvents.push(e)); });
  const input = page.getByTestId('office-prompt-input');
  // IME confirmation must not submit.
  await input.fill('输入法测试');
  await input.evaluate(element => element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true, isComposing: true })));
  assert.equal((await readRows()).runs.length, 0);
  checks.push({ name: 'IME confirmation does not send a run', pass: true });
  const prompt = "请调用 search_teacher_knowledge 查询'分数加法'，依据老师知识库材料给出简短备课建议，注明核验编号、备课时间和资料标题。";
  await input.fill(prompt); await input.press('Enter');
  assert.equal(await input.inputValue(), '');
  await page.waitForFunction(() => window.piPublicTestEvents.some(e => e.kind === 'status' && e.status !== 'running'), undefined, { timeout: 120000 });
  const events = await page.evaluate(() => window.piPublicTestEvents);
  const terminal = events.filter(e => e.kind === 'status').at(-1);
  check('Formal page DeepSeek stream and teacher knowledge tool complete', () => {
    assert.equal(terminal.status, 'completed', JSON.stringify(terminal));
    assert(events.filter(e => e.kind === 'text_delta').length > 1);
    assert(events.some(e => e.kind === 'tool_end' && e.tool === 'search_teacher_knowledge' && e.success));
  });
  await page.waitForFunction(marker => document.querySelector('[data-testid="office-conversation"]')?.textContent?.replace(/\s/g, '').includes(marker), marker);
  const saved = await readRows();
  check('Accepted send clears composer; SQLite stores one user and one assistant', () => {
    assert.equal(saved.messages.filter(m => m.role === 'user').length, 1); assert.equal(saved.messages.filter(m => m.role === 'assistant').length, 1);
    assert.equal(saved.runs[0].status, 'succeeded'); assert.equal(saved.bindings.length, 1);
    assert(saved.messages.find(m => m.role === 'assistant').content.replace(/\s/g, '').includes(marker));
    assert(!JSON.stringify(saved).includes(key));
  });
  const sessionId = saved.bindings[0].conversation_id;
  for (const [width, height] of [[1366, 768], [1920, 1080]]) {
    await page.setViewportSize({ width, height });
    const bounds = await input.boundingBox(); const send = await page.getByRole('button', { name: '发送消息', exact: true }).boundingBox();
    check(`Composer and send remain reachable at ${width}x${height}`, () => { assert(bounds && bounds.y + bounds.height <= height); assert(send && send.y + send.height <= height && send.x + send.width <= width); });
    await page.screenshot({ path: path.join(output, `${width}x${height}.png`), fullPage: true });
  }
  await application.close(); application = undefined;
  await launch(); await enterAi();
  await page.waitForFunction(marker => document.querySelector('[data-testid="office-conversation"]')?.textContent?.replace(/\s/g, '').includes(marker), marker);
  const restored = await page.evaluate(id => window.omniEdu.getXiaozhiSnapshot(id), sessionId);
  check('Actual app restart restores visible history, binding, and fixed model', () => {
    assert.equal(restored.projection.model, model); assert.equal(restored.projection.turns.length, 1); assert.equal(restored.projection.turns[0].status, 'completed');
  });
  const existingEvents = await page.evaluate(() => { window.piPublicTestEvents = []; window.omniEdu.onXiaozhiEvent(e => window.piPublicTestEvents.push(e)); return true; }); assert(existingEvents);
  await page.getByTestId('office-prompt-input').fill('只根据本会话刚才已读取的资料回答核验编号和备课时间。不要再读取工具。');
  await page.getByTestId('office-prompt-input').press('Enter');
  await page.waitForFunction(() => window.piPublicTestEvents.some(e => e.kind === 'status' && e.status !== 'running'), undefined, { timeout: 120000 });
  const second = (await readRows()).messages.filter(m => m.role === 'assistant').at(-1);
  check('Restored SDK context supplies prior facts in a new real API turn', () => { assert(second.content.replace(/\s/g, '').includes(marker)); assert(second.content.includes('37')); });
  await page.getByTestId('office-prompt-input').fill('请写一份至少2000字的分数加法详细备课说明，分多个阶段展开。');
  const count = await page.evaluate(() => window.piPublicTestEvents.length);
  await page.getByTestId('office-prompt-input').press('Enter');
  await page.waitForFunction(count => window.piPublicTestEvents.slice(count).some(e => e.kind === 'text_delta'), count, { timeout: 120000 });
  await page.getByRole('button', { name: '停止本轮', exact: true }).click();
  await page.getByText('本轮已中断', { exact: true }).waitFor({ state: 'visible', timeout: 30000 });
  const stoppedRows = await readRows();
  check('Formal stop interrupts a real provider stream and persists blocked status', () => assert.equal(stoppedRows.runs.at(-1).status, 'blocked'));
  await application.close(); application = undefined;
  // Missing-key path uses the same visible UI and preserves submitted text only in history.
  await launch(''); await enterAi();
  const previousId = await page.locator('.office-composer-container').getAttribute('data-session-id');
  await page.getByTestId('ai-conversation-new').click();
  await page.waitForFunction(previous => document.querySelector('.office-composer-container')?.getAttribute('data-session-id') !== previous, previousId);
  await page.waitForFunction(() => !document.querySelector('[data-testid="office-prompt-input"]')?.disabled);
  await page.getByTestId('office-prompt-input').fill('你好'); await page.getByTestId('office-prompt-input').press('Enter');
  await page.getByText('小智未完成本轮', { exact: true }).waitFor({ state: 'visible', timeout: 30000 });
  assert.equal(await page.getByTestId('office-prompt-input').inputValue(), '');
  const failedRows = await readRows();
  check('Missing credential fails visibly without restoring sent composer text', () => {
    assert.equal(failedRows.runs.at(-1).status, 'failed'); assert.match(failedRows.runs.at(-1).error_message, /凭证|API Key/);
    assert.equal(failedRows.messages.filter(m => m.role === 'user').at(-1).content, '你好');
  });
  const currentId = await page.locator('.office-composer-container').getAttribute('data-session-id');
  const beforeRejected = (await readRows()).messages.length;
  const rejected = await page.evaluate(id => window.omniEdu.startXiaozhi({ sessionId: id, prompt: '非法额外字段', commandId: `xicmd_${crypto.randomUUID()}`, apiKey: 'forbidden-field' }), currentId);
  check('Production IPC rejects extra credential fields without creating messages', () => { assert.equal(rejected.error, 'invalid_input'); });
  assert.equal((await readRows()).messages.length, beforeRejected);
  const race = await page.evaluate(id => Promise.all([
    window.omniEdu.startXiaozhi({ sessionId: id, prompt: '并发调用一', commandId: `xicmd_${crypto.randomUUID()}` }),
    window.omniEdu.startXiaozhi({ sessionId: id, prompt: '并发调用二', commandId: `xicmd_${crypto.randomUUID()}` }),
  ]), currentId);
  check('Main ownership rejects a concurrent second run before awaits', () => { assert.equal(race.filter(r => r.ok).length, 1); assert.equal(race.filter(r => r.error === 'busy').length, 1); });
  report.success = true; report.eventCount = events.length;
} catch (error) { report.failure = String(error.stack).replaceAll(key, '[REDACTED]').replace(/sk-[a-zA-Z0-9_-]+/g, '[REDACTED]').slice(0, 4000); process.exitCode = 1;
  await page?.screenshot({ path: path.join(output, 'failure.png'), fullPage: true }).catch(() => undefined); }
finally { await application?.close(); fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify({ ...report, report: path.relative(appRoot, path.join(output, 'report.json')) })); }
