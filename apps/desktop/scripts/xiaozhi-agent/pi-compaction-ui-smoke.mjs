import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { _electron as electron } from 'playwright';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const output = fs.mkdtempSync(path.join(appRoot, 'test-results/xiaozhi-agent/pi-compaction-ui-'));
const dataRoot = path.join(output, 'data'), folder = path.join(output, '备课资料');
fs.mkdirSync(dataRoot); fs.mkdirSync(folder);
fs.writeFileSync(path.join(folder, '分数课.md'), '来源：合成教师资料。先理解分数单位，再通过纸条比较分数大小。');
const cfg = fs.readFileSync(path.join(appRoot, '.env.local'), 'utf8');
const pick = name => cfg.match(new RegExp(`^${name}\\s*=\\s*["']?([^\\r\\n"']+)`, 'm'))?.[1]?.trim();
const key = pick('DEEPSEEK_API_KEY'), model = pick('DEEPSEEK_MODEL') || 'deepseek-flash'; assert(key);
const checks = [], report = { suite: 'pi-compaction-formal-ui', success: false, model, checks,
  boundaries: ['Real DeepSeek and actual Electron; isolated synthetic teacher records only', 'Manual compaction regression plus default production auto policy; B3 memory pending', 'Cost unknown; SDK before/after context counts are estimates'] };
let app, page;
const check = (name, fn) => { fn(); checks.push({ name, pass: true }); console.log(`PASS ${name}`); };
const until = async (fn, ms = 120000) => { const end = Date.now() + ms; while (Date.now() < end) { if (await fn()) return; await new Promise(resolve => setTimeout(resolve, 100)); } throw new Error('Compaction acceptance condition timed out'); };
async function launch(commitDelay = 0) {
  const env = { ...process.env, OMNI_EDU_DATA_ROOT: dataRoot, OMNI_EDU_REPO_ROOT: path.resolve(appRoot, '../..'), OMNI_EDU_E2E_DIALOG_MODE: '1', OMNI_EDU_XIAOZHI_PI: '1', DEEPSEEK_API_KEY: key, DEEPSEEK_MODEL: model };
  delete env.ELECTRON_RUN_AS_NODE; delete env.NODE_OPTIONS;
  env.OMNI_EDU_E2E_PI_COMPACT_COMMIT_DELAY_MS = String(commitDelay);
  app = await electron.launch({ args: [path.join(appRoot, 'out/main/index.js')], env, timeout: 60000 }); page = await app.firstWindow();
  await page.getByTestId('xiaozhi-pi-workspace').waitFor({ state: 'visible', timeout: 30000 }); await ready();
}
async function ready() { await page.getByTestId('pi-budget-card').waitFor({ state: 'visible' }); await page.waitForFunction(() => !document.querySelector('[data-testid="office-prompt-input"]')?.disabled); }
const id = () => page.locator('.office-composer-container').getAttribute('data-session-id');
async function snap(session) { return page.evaluate(value => window.omniEdu.getXiaozhiSnapshot(value), session || await id()); }
async function fresh() { const previous = await id(); await page.getByTestId('ai-conversation-new').click(); await page.waitForFunction(value => document.querySelector('.office-composer-container')?.getAttribute('data-session-id') !== value, previous); await ready(); }
async function terminal(session) { await until(async () => !(await snap(session)).running); return snap(session); }
async function send(text) {
  const session = await id(), count = (await snap(session)).projection.turns.length;
  await page.getByTestId('office-prompt-input').fill(text); await page.getByTestId('office-prompt-input').press('Enter');
  await until(async () => (await snap(session)).projection.turns.length > count); return session;
}
async function compact() {
  const session = await id(), count = (await snap(session)).projection.turns.length;
  await page.getByTestId('pi-compact').click(); await until(async () => (await snap(session)).projection.turns.length > count); return session;
}
function read(session) {
  const db = new DatabaseSync(path.join(dataRoot, 'app.db'), { readOnly: true });
  try {
    const binding = db.prepare('SELECT * FROM xiaozhi_pi_session_bindings WHERE conversation_id=?').get(session);
    const file = binding && path.join(dataRoot, 'xiaozhi-pi', binding.session_file);
    const raw = file && fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    return { raw, entries: raw.trim() ? raw.trim().split('\n').map(line => JSON.parse(line)) : [],
      approvals: db.prepare("SELECT payload_json FROM ai_confirmation_items WHERE session_id=? AND action_type='pi_office_copy'").all(session).map(row => JSON.parse(row.payload_json)),
      commands: db.prepare('SELECT * FROM xiaozhi_pi_commands WHERE conversation_id=?').all(session) };
  } finally { db.close(); }
}
async function budget(patch) {
  const before = (await snap()).budgetSettings;
  if (!await page.getByTestId('pi-budget-activeMs').isVisible()) await page.getByTestId('pi-budget-expand').click();
  for (const [field, value] of Object.entries(patch)) await page.getByTestId(`pi-budget-${field}`).fill(String(['activeMs', 'waitMs'].includes(field) ? value / 1000 : value));
  await page.getByTestId('pi-budget-save').click(); await until(async () => (await snap()).budgetSettings.version === before.version + 1);
}
const marker = `教育验收码${randomUUID().slice(0, 8)}`;
const longText = Array.from({ length: 100 }, (_, index) => `合成备课条目${index + 1}：课堂先用纸条建立分数单位，再让教师组织学生比较大小并解释依据；课后只记录脱敏教学反馈，所有练习均为草稿，需教师审查来源、答案与难度。`).join('\n');
async function longHistory(prefix = '') {
  for (let n = 0; n < 3; n++) {
    const session = await send(`${prefix}\n重要任务事实：${marker}，五年级分数课，最终产物尚未提交。请保留此事实供后续续问。以下是第${n + 1}批合成资料，先阅读，仅回复一句“已阅读”，不要工具或长摘要。\n${longText}`);
    assert.equal((await terminal(session)).projection.turns.at(-1).status, 'completed');
  }
}
try {
  await launch(); const empty = await id(); await compact(); let state = await terminal(empty);
  check('Default formal IPC enables verified official-window auto policy without E2E override', () => { assert.equal(state.contextPolicy.auto, true); assert.equal(state.contextPolicy.window, 1048576); assert.equal(state.contextPolicy.testPolicy, undefined); assert.equal(state.modelCapabilities.contextWindow, 1048576); });
  check('Empty history rejects compaction without any provider request', () => { assert.equal(state.usage.at(-1).modelCalls, 0); assert.equal(state.projection.turns.at(-1).status, 'failed'); assert(state.projection.turns.at(-1).error.includes('没有需要压缩')); });
  const invalid = await page.evaluate(session => Promise.all([
    window.omniEdu.compactXiaozhi({ sessionId: session, commandId: `xicmd_${crypto.randomUUID()}`, apiKey: 'not-accepted' }),
    window.omniEdu.compactXiaozhi({ sessionId: 'invalid', commandId: 'invalid' }),
  ]), empty);
  check('Compaction IPC rejects extra fields and invalid identities', () => invalid.forEach(value => assert.equal(value.error, 'invalid_input')));
  await fresh(); const session = await id(); await budget({ activeMs: 120000 });
  await app.evaluate(({ dialog }, directory) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [directory] }); }, folder);
  await page.getByRole('button', { name: '选择教学工作目录', exact: true }).click(); await until(async () => Boolean((await snap()).workspace));
  await send('先调用 update_plan 公布两步“读取分数资料”（in_progress）、“整理教案草稿”（pending）。再用 office_read_text 读取 分数课.md，然后调用 office_copy_file 复制为 分数课草稿.md，等待教师确认；不要自行批准或重试。');
  await page.locator('[data-testid="pi-copy-approval"][data-state="pending"]').waitFor({ state: 'visible', timeout: 90000 });
  await page.getByTestId('pi-copy-reject').click(); state = await terminal(session);
  const approval = read(session).approvals.at(-1); assert(approval); assert.equal(approval.state, 'rejected');
  await longHistory(); const before = read(session), beforeCount = before.entries.filter(entry => entry.type === 'compaction').length;
  await compact(); await until(async () => (await snap(session)).usage.at(-1).modelCalls > 0);
  const live = await snap(session);
  const busy = await page.evaluate(session => Promise.all([
    window.omniEdu.startXiaozhi({ sessionId: session, commandId: `xicmd_${crypto.randomUUID()}`, prompt: '并发消息' }),
    window.omniEdu.queueXiaozhi({ sessionId: session, commandId: `xicmd_${crypto.randomUUID()}`, text: '迟到补充', mode: 'steer' }),
    window.omniEdu.compactXiaozhi({ sessionId: session, commandId: `xicmd_${crypto.randomUUID()}` }),
  ]), session);
  check('Compaction owns the conversation and rejects concurrent prompt/queue/compact', () => { assert.equal(live.operation, 'compact'); busy.forEach(value => assert.equal(value.error, 'busy')); });
  state = await terminal(session); const after = read(session), last = after.entries.filter(entry => entry.type === 'compaction').at(-1), receipt = state.usage.at(-1);
  check('Visible button performs real native compaction without rewriting history', () => { assert.equal(state.projection.turns.at(-1).status, 'completed'); assert.equal(after.entries.filter(entry => entry.type === 'compaction').length, beforeCount + 1); assert(after.raw.startsWith(before.raw)); assert(last.summary.length > 0); });
  check('Native summary retains local plan, rejected approval and exact source version', () => { assert(last.summary.includes(approval.sourceSha256)); assert(last.summary.includes('rejected')); assert(last.summary.includes('整理教案草稿')); assert(last.summary.includes('分数课.md')); assert(!fs.existsSync(path.join(folder, '分数课草稿.md'))); });
  const usageEntries = after.entries.slice(before.entries.length).filter(entry => entry.customType === 'xiaozhi.compaction.usage.v1');
  check('Compaction records actual SDK usage separate from assistant-message events', () => { assert(receipt.modelCalls >= 1); assert.equal(receipt.toolCalls, 0); assert.equal(usageEntries.length, receipt.modelCalls); assert.deepEqual(receipt.tokens, usageEntries.at(-1).data.usage); assert(receipt.tokens.total > 0); assert.equal(receipt.completeness, 'reported'); assert.equal(receipt.cost, null); });
  const card = state.projection.turns.at(-1).items.find(item => item.kind === 'compaction');
  check('Public projection exposes estimated counts and excludes private summary/hash', () => { assert.equal(card.status, 'completed'); assert(card.text.includes('估计')); assert(!JSON.stringify(state).includes(approval.sourceSha256)); assert(!JSON.stringify(state).includes(last.summary)); });
  const command = after.commands.at(-1), replay = await page.evaluate(input => window.omniEdu.compactXiaozhi(input), { sessionId: session, commandId: command.command_id });
  check('Persistent duplicate command returns same run with no second summary request', () => { assert.equal(replay.runId, command.run_id); assert.equal(read(session).entries.filter(entry => entry.type === 'compaction').length, beforeCount + 1); });
  for (const [width, height] of [[1366,768], [1920,1080]]) {
    await page.setViewportSize({ width, height }); await page.getByTestId('pi-compact').evaluate(element => element.scrollIntoView({ block: 'center' }));
    const bounds = await page.getByTestId('pi-compact').boundingBox(); check(`Compaction control reachable at ${width}x${height}`, () => assert(bounds.y >= 0 && bounds.y + bounds.height <= height));
    await page.locator('[data-testid="pi-compaction-card"][data-state="completed"]').last().scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(output, `compact-${width}x${height}.png`) });
  }
  await send('继续刚才的任务：只回答重要任务事实中的教育验收码和年级，不要工具，不要写文件。'); state = await terminal(session);
  check('Real provider continuation recalls pre-compaction task after native summary', () => { const text = state.projection.turns.at(-1).items.filter(item => item.role === 'assistant').map(item => item.text).join(''); assert.equal(state.projection.turns.at(-1).status, 'completed'); assert(text.includes(marker.replace('教育验收码', ''))); assert(text.includes('五年级')); });
  await app.close(); app = undefined; await launch(); state = await snap(session);
  check('Actual restart preserves native summary, public card, ledger and approval state', () => { assert(!state.running); assert(state.projection.turns.some(turn => turn.items.some(item => item.kind === 'compaction' && item.status === 'completed'))); assert.equal(read(session).approvals.at(-1).state, 'rejected'); assert.equal(read(session).entries.filter(entry => entry.type === 'compaction').length, beforeCount + 1); });
  // A new run must not reopen or approve a prior file effect.
  await send('请继续备课，先调用 update_plan 将“整理教案草稿”设为 pending，不要复制或写文件，只回复一句。'); await terminal(session);
  await longHistory(); const stopBefore = read(session); await compact(); await until(async () => (await snap(session)).usage.at(-1).modelCalls > 0);
  await page.getByRole('button', { name: '停止本轮', exact: true }).click(); state = await terminal(session);
  check('Stop aborts native summarization, preserves history and performs no file effect', () => { assert.equal(state.projection.turns.at(-1).status, 'interrupted'); assert.equal(read(session).entries.filter(entry => entry.type === 'compaction').length, stopBefore.entries.filter(entry => entry.type === 'compaction').length); assert(read(session).raw.startsWith(stopBefore.raw)); assert(!fs.existsSync(path.join(folder, '分数课草稿.md'))); });
  await budget({ activeMs: 1000 }); const limitBefore = read(session); await compact(); state = await terminal(session);
  check('Activity budget aborts real compaction before native commit', () => { assert.equal(state.usage.at(-1).exhausted, 'active_time'); assert.equal(state.projection.turns.at(-1).status, 'failed'); assert.equal(read(session).entries.filter(entry => entry.type === 'compaction').length, limitBefore.entries.filter(entry => entry.type === 'compaction').length); });
  await budget({ activeMs: 120000 }); const crashBefore = read(session); await compact(); await until(async () => (await snap(session)).usage.at(-1).modelCalls > 0);
  execFileSync('taskkill', ['/PID', String(app.process().pid), '/T', '/F'], { windowsHide: true, stdio: 'pipe' }); await app.close().catch(() => {}); app = undefined;
  await launch(); state = await snap(session);
  check('Owned process crash converges to interruption without replaying compaction/effects', () => { assert(!state.running); assert.equal(state.usage.at(-1).state, 'interrupted'); assert(read(session).raw.startsWith(crashBefore.raw)); assert.equal(read(session).entries.filter(entry => entry.type === 'compaction').length, crashBefore.entries.filter(entry => entry.type === 'compaction').length); assert(!fs.existsSync(path.join(folder, '分数课草稿.md'))); });
  await app.close(); app = undefined; await launch(30000);
  const gapBefore = read(session); await compact(); await until(() => fs.existsSync(path.join(dataRoot, '.e2e-pi-compaction-committed')));
  const gapCommitted = read(session), gapCommand = gapCommitted.commands.at(-1);
  execFileSync('taskkill', ['/PID', String(app.process().pid), '/T', '/F'], { windowsHide: true, stdio: 'pipe' }); await app.close().catch(() => {}); app = undefined; await launch(); state = await snap(session);
  const replayGap = await page.evaluate(input => window.omniEdu.compactXiaozhi(input), { sessionId: session, commandId: gapCommand.command_id });
  check('Crash after native commit keeps summary while public run is interrupted; no command replay', () => { assert(!state.running); assert.equal(state.usage.at(-1).state, 'interrupted'); assert.equal(replayGap.runId, gapCommand.run_id); assert.equal(read(session).entries.filter(entry => entry.type === 'compaction').length, gapBefore.entries.filter(entry => entry.type === 'compaction').length + 1); assert(read(session).raw.startsWith(gapBefore.raw)); assert(!fs.existsSync(path.join(folder, '分数课草稿.md'))); });
  await send('继续重要任务，只回答教育验收码与年级，不要任何工具或写入。'); state = await terminal(session);
  check('Fresh user turn resumes committed native summary after crash with task facts intact', () => { assert.equal(state.projection.turns.at(-1).status, 'completed'); const text = state.projection.turns.at(-1).items.filter(item => item.role === 'assistant').map(item => item.text).join(''); assert(text.includes(marker.replace('教育验收码', ''))); assert(text.includes('五年级')); assert(!fs.existsSync(path.join(folder, '分数课草稿.md'))); });
  await fresh(); const isolated = await snap();
  check('Another conversation has no foreign compaction records or approvals', () => { assert.equal(isolated.usage.length, 0); assert.equal(isolated.approvals.length, 0); assert.equal(isolated.controls.length, 0); });
  report.success = true;
} catch (error) {
  report.error = String(error.stack).replaceAll(key, '[credential]').slice(0, 3500);
  if (page) await page.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {});
} finally {
  await app?.close().catch(() => {}); fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ...report, report: path.relative(appRoot, path.join(output, 'report.json')) }));
}
if (!report.success) process.exitCode = 1;
