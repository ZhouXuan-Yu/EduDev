import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { _electron as electron } from 'playwright';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const tests = fs.realpathSync(path.join(root, 'test-results/xiaozhi-agent'));
const source = fs.realpathSync(path.resolve(root, process.argv[2] || 'missing'));
const relative = path.relative(tests, source);
assert(!relative.startsWith('..') && !path.isAbsolute(relative) && path.basename(source) === 'data');
const output = fs.mkdtempSync(path.join(tests, 'pi-auto-edge-')), data = path.join(output, 'data');
fs.cpSync(source, data, { recursive: true, errorOnExist: true, force: false });
const cfg = fs.readFileSync(path.join(root, '.env.local'), 'utf8');
const pick = name => cfg.match(new RegExp(`^${name}\\s*=\\s*["']?([^\\r\\n"']+)`, 'm'))?.[1]?.trim();
const key = pick('DEEPSEEK_API_KEY'), model = pick('DEEPSEEK_MODEL') || 'deepseek-flash'; assert(key);
const db = new DatabaseSync(path.join(data, 'app.db'), { readOnly: true });
const binding = db.prepare('SELECT * FROM xiaozhi_pi_session_bindings').all().find(row => {
  const file = path.join(data, 'xiaozhi-pi', row.session_file);
  return fs.existsSync(file) && fs.readFileSync(file, 'utf8').includes('"type":"compaction"');
}); db.close(); assert(binding);
const session = binding.conversation_id, file = path.join(data, 'xiaozhi-pi', binding.session_file);
const original = fs.readFileSync(path.join(source, 'xiaozhi-pi', binding.session_file), 'utf8');
const checks = [], report = { suite: 'pi-auto-control-edge', success: false, model, checks,
  boundaries: ['Actual Electron, real DeepSeek, explicitly copied isolated synthetic history', '65536 early test policy; official provider window unchanged', 'Owned process kill only; no production data or network configuration changes'] };
let app, page;
const until = async (fn, ms = 120000) => { const end = Date.now() + ms; while (Date.now() < end) { if (await fn()) return; await new Promise(resolve => setTimeout(resolve, 100)); } throw new Error('Auto control edge condition timed out'); };
const snap = () => page.evaluate(id => window.omniEdu.getXiaozhiSnapshot(id), session);
const history = () => fs.readFileSync(file, 'utf8').trim().split('\n').map(JSON.parse);
const count = () => history().filter(entry => entry.type === 'compaction').length;
const check = (name, fn) => { fn(); checks.push({ name, pass: true }); console.log(`PASS ${name}`); };
async function launch() {
  const env = { ...process.env, OMNI_EDU_DATA_ROOT: data, OMNI_EDU_REPO_ROOT: path.resolve(root, '../..'), OMNI_EDU_E2E_DIALOG_MODE: '1',
    OMNI_EDU_XIAOZHI_PI: '1', OMNI_EDU_E2E_PI_AUTO_COMPACTION: '1', OMNI_EDU_E2E_PI_CONTEXT_WINDOW: '65536', DEEPSEEK_API_KEY: key, DEEPSEEK_MODEL: model };
  delete env.ELECTRON_RUN_AS_NODE; delete env.NODE_OPTIONS;
  app = await electron.launch({ args: [path.join(root, 'out/main/index.js')], env, timeout: 60000 }); page = await app.firstWindow();
  await page.getByTestId('xiaozhi-pi-workspace').waitFor({ state: 'visible', timeout: 30000 });
  await page.getByTestId(`ai-conversation-session-${session}`).click();
  await page.waitForFunction(() => !document.querySelector('[data-testid="office-prompt-input"]')?.disabled);
}
async function send(text) {
  const n = (await snap()).projection.turns.length;
  await page.getByTestId('office-prompt-input').fill(text); await page.getByTestId('office-prompt-input').press('Enter');
  await until(async () => (await snap()).projection.turns.length > n);
}
async function terminal() { await until(async () => !(await snap()).running); return snap(); }
const batch = '合成分数备课资料，先理解分数单位，然后比较大小，教师复核来源，不能自动提交文件。'.repeat(160);
async function activeAuto() {
  for (let n = 0; n < 6; n++) {
    await send('只阅读下面的合成教学资料，回复一句已阅读，不操作文件。\n' + batch);
    let active = false;
    await until(async () => { const state = await snap(); active = state.projection.turns.at(-1).items.some(item => item.kind === 'compaction' && item.status === 'inProgress'); return active || !state.running; });
    if (active) return;
    const state = await snap(); assert.equal(state.projection.turns.at(-1).status, 'completed');
  }
  throw new Error('No real active automatic summarizer reached');
}
try {
  await launch(); await activeAuto();
  const before = await snap(), run = before.projection.turns.at(-1).id;
  const instruction = '后续只补一行：自动整理后仍需教师复核。';
  await page.getByTestId('pi-queue-mode-followup').click();
  await page.getByTestId('office-prompt-input').fill(instruction); await page.getByTestId('pi-queue-submit').click();
  await until(async () => (await snap()).controls.some(item => item.kind === 'instruction' && item.text === instruction));
  check('Follow-up is accepted through the real composer during automatic summary', () => assert(before.running));
  assert.equal(await page.getByTestId('office-prompt-input').inputValue(), '');
  let state = await terminal();
  check('Queued follow-up is consumed exactly once by native SDK after auto replacement', () => {
    assert.equal(state.projection.turns.at(-1).id, run); assert.equal(state.projection.turns.at(-1).status, 'completed');
    assert.equal(state.controls.find(item => item.kind === 'instruction' && item.text === instruction).state, 'applied');
    assert.equal(history().filter(entry => entry.type === 'message' && entry.message.role === 'user' && entry.message.content.some(part => part.type === 'text' && part.text === instruction)).length, 1);
    assert(state.projection.turns.at(-1).items.some(item => item.role === 'assistant' && item.text.includes('教师复核')));
  });
  for (const [width, height] of [[1366, 768], [1920, 1080]]) {
    await app.browserWindow(page).then(win => win.evaluate((window, size) => window.setContentSize(...size), [width, height]));
    for (const testId of ['office-prompt-input', 'pi-model-capabilities']) {
      const element = page.getByTestId(testId); await element.evaluate(node => node.scrollIntoView({ block: 'center' }));
      const box = await element.boundingBox(); const viewport = await page.evaluate(() => ({ width: innerWidth, height: innerHeight }));
      assert(box && box.y >= -1 && box.y + box.height <= viewport.height + 1 && box.x >= -1 && box.x + box.width <= viewport.width + 1);
    }
    await page.screenshot({ path: path.join(output, `edge-${width}x${height}.png`) });
    check(`Composer and model capacity reachable at ${width}x${height}`, () => assert(true));
  }
  const crashCount = count(); await activeAuto(); const prefix = fs.readFileSync(file, 'utf8');
  execFileSync('taskkill', ['/PID', String(app.process().pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' }); app = undefined;
  await launch(); state = await snap();
  check('Crash before native summary commit preserves history and never auto resumes', () => {
    assert(!state.running); assert.equal(state.projection.turns.at(-1).status, 'interrupted'); assert.equal(count(), crashCount);
    assert(fs.readFileSync(file, 'utf8').startsWith(prefix)); assert.equal(state.usage.at(-1).state, 'interrupted');
  });
  // The preceding interrupted current input remains in native history and triggers the next summary.
  const settings = (await snap()).budgetSettings;
  const details = page.getByTestId('pi-task-details-expand');
  if (await details.getAttribute('aria-expanded') === 'false') await details.click();
  if (!(await page.getByTestId('pi-budget-save').isVisible())) await page.getByTestId('pi-budget-expand').click();
  await page.getByTestId('pi-budget-maxModelCalls').fill('1'); await page.getByTestId('pi-budget-save').click();
  await until(async () => (await snap()).budgetSettings.version === settings.version + 1);
  const budgetCount = count(), budgetPrefix = fs.readFileSync(file, 'utf8');
  await send('阅读本次合成材料，只回复已阅读，不操作文件。\n' + batch); state = await terminal();
  check('Automatic summary shares the one-request run budget and cannot dispatch extra requests', () => {
    const usage = state.usage.at(-1), turn = state.projection.turns.at(-1);
    assert.equal(usage.modelCalls, 1); assert.equal(usage.exhausted, 'model_calls'); assert.equal(usage.state, 'failed'); assert.equal(turn.status, 'failed');
    assert(turn.items.some(item => item.kind === 'compaction')); assert(count() >= budgetCount && count() <= budgetCount + 1);
    assert(fs.readFileSync(file, 'utf8').startsWith(budgetPrefix)); assert((usage.tokens?.total ?? 0) > 0 || usage.completeness !== 'reported');
  });
  check('Original copied history is unchanged and private metadata is not exposed', () => {
    assert.equal(fs.readFileSync(path.join(source, 'xiaozhi-pi', binding.session_file), 'utf8'), original);
    for (const entry of history().filter(entry => entry.type === 'compaction')) assert(!JSON.stringify(state).includes(entry.summary));
  });
  report.success = true;
} catch (error) { report.error = String(error.stack).replaceAll(key, '[credential]').slice(0, 5000); if (page) { await page.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {}); report.snapshot = await snap().catch(() => undefined); } }
finally { await app?.close().catch(() => {}); fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify({ success: report.success, checks: checks.length, error: report.error, report: path.relative(root, path.join(output, 'report.json')) })); }
if (!report.success) process.exitCode = 1;
