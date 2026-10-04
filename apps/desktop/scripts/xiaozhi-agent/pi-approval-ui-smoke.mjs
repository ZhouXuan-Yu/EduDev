import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { _electron as electron } from 'playwright';
const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const output = fs.mkdtempSync(path.join(appRoot, 'test-results/xiaozhi-agent/pi-approval-ui-'));
const dataRoot = path.join(output, 'data'), workshop = path.join(output, '教学工作目录'); fs.mkdirSync(dataRoot); fs.mkdirSync(workshop);
const envFile = fs.readFileSync(path.join(appRoot, '.env.local'), 'utf8');
const key = envFile.match(/^DEEPSEEK_API_KEY\s*=\s*["']?([^\r\n"']+)/m)?.[1]?.trim();
assert(key, 'Local DeepSeek credential required');
const model = envFile.match(/^DEEPSEEK_MODEL\s*=\s*["']?([^\r\n"']+)/m)?.[1]?.trim() || 'deepseek-flash';
const sourceName = '教案.md', sourceText = '# 教学备课\n分数相加先通分。\n验收事实：教师已校正。\n模拟联系方式 teacher-test@example.invalid 13800138000\n';
fs.writeFileSync(path.join(workshop, sourceName), sourceText);
const digest = value => createHash('sha256').update(value).digest('hex');
const checks = [], report = { suite: 'pi-persistent-approval-ui', success: false, model, checks,
  boundaries: ['Actual formal Electron and real DeepSeek tools; synthetic teacher work directory', 'Crash cut explicitly injected after physical copy, never model reasoning/history', 'No full office editing, installer, or VPN-off claim'] };
let application, page;
async function launch(crashDelay = false, commandDelay = false) {
  application = await electron.launch({ args: [path.join(appRoot, 'out/main/index.js')], timeout: 60000, env: {
    ...process.env, OMNI_EDU_DATA_ROOT: dataRoot, OMNI_EDU_REPO_ROOT: path.resolve(appRoot, '../..'), OMNI_EDU_E2E_DIALOG_MODE: '1',
    OMNI_EDU_XIAOZHI_PI: '1', DEEPSEEK_API_KEY: key, DEEPSEEK_MODEL: model,
    OMNI_EDU_E2E_PI_AFTER_COPY_DELAY_MS: crashDelay ? '30000' : '',
    OMNI_EDU_E2E_PI_COMMAND_DELAY_MS: commandDelay ? '30000' : '',
  } });
  page = await application.firstWindow();
  await page.getByTestId('xiaozhi-pi-workspace').waitFor({ state: 'visible', timeout: 30000 });
  await ready();
}
async function ready() { await page.waitForFunction(() => !document.querySelector('[data-testid="office-prompt-input"]')?.disabled); }
function rows() {
  const db = new DatabaseSync(path.join(dataRoot, 'app.db'), { readOnly: true });
  try { return { bindings: db.prepare('SELECT * FROM xiaozhi_pi_session_bindings').all(), commands: db.prepare('SELECT * FROM xiaozhi_pi_commands ORDER BY created_at').all(),
    confirmations: db.prepare("SELECT * FROM ai_confirmation_items WHERE action_type='pi_office_copy' ORDER BY created_at").all().map(row => ({ ...row, payload: JSON.parse(row.payload_json) })),
    messages: db.prepare('SELECT * FROM ai_conversation_messages ORDER BY created_at').all(),
    runs: db.prepare("SELECT * FROM ai_agent_runs WHERE sub_intent='pi_education' ORDER BY created_at").all(),
    workspaces: db.prepare('SELECT * FROM xiaozhi_pi_workspaces').all() }; } finally { db.close(); }
}
const check = (name, fn) => { fn(); checks.push({ name, pass: true }); };
async function id() { return page.locator('.office-composer-container').getAttribute('data-session-id'); }
async function choose(directory) {
  await application.evaluate(({ dialog }, selected) => { dialog.showOpenDialog = async () => ({ canceled: !selected, filePaths: selected ? [selected] : [] }); }, directory);
  await page.getByRole('button', { name: '选择教学工作目录', exact: true }).click();
}
async function workspaceVisible() {
  const label = page.getByText(`工作目录：${path.basename(workshop)}。文件复制逐次确认。`, { exact: false });
  if (!await label.isVisible()) await page.getByTestId('pi-task-details-expand').click();
  await label.waitFor({ state: 'visible' });
}
async function fresh() {
  const previous = await id(); await page.getByTestId('ai-conversation-new').click();
  await page.waitForFunction(previous => document.querySelector('.office-composer-container')?.getAttribute('data-session-id') !== previous, previous); await ready();
  await choose(workshop); await workspaceVisible();
}
async function copyRequest(target, readFirst = false) {
  const prompt = `${readFirst ? `请先调用 office_read_text 读取 ${sourceName}，然后` : ''}请调用 office_copy_file 将当前教学工作目录里的 ${sourceName} 复制成 ${target}。请直接请求复制工具和一次审批；不要只给操作建议，教师拒绝后不要重试。`;
  await page.getByTestId('office-prompt-input').fill(prompt); await page.getByTestId('office-prompt-input').press('Enter');
  assert.equal(await page.getByTestId('office-prompt-input').inputValue(), '');
  const card = page.locator('[data-testid="pi-copy-approval"][data-state="pending"]').last();
  await card.waitFor({ state: 'visible', timeout: 100000 });
  return { card, prompt, approval: rows().confirmations.at(-1) };
}
async function terminal(session) {
  await until(async () => !(await page.evaluate(session => window.omniEdu.getXiaozhiSnapshot(session), session)).running);
}
async function until(test, timeout = 100000) {
  const deadline = Date.now() + timeout;
  do { if (await test()) return; await page.waitForTimeout(100); } while (Date.now() < deadline);
  throw new Error('Bounded async snapshot wait timed out');
}
async function killOwnedApp() {
  const child = application.process(); assert(child?.pid, 'Known live smoke Electron process required');
  if (process.platform === 'win32') execFileSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' }); else child.kill('SIGKILL');
  await Promise.race([application.close().catch(() => undefined), new Promise(resolve => setTimeout(resolve, 2000))]); application = undefined;
}
try {
  await launch();
  await choose(undefined); await page.waitForTimeout(100);
  check('Native directory cancellation grants no workspace', () => assert.equal(rows().workspaces.length, 0));
  await choose(dataRoot); await page.getByRole('alert').filter({ hasText: '未获授权' }).waitFor({ state: 'visible' });
  check('Private education data root cannot become office workspace', () => assert.equal(rows().workspaces.length, 0));
  await choose(workshop); await workspaceVisible();
  check('Visible native chooser grants only selected synthetic folder', () => assert.equal(rows().workspaces[0].path, workshop));
  const accepted = await copyRequest('批准教案.md', true); const session = await id();
  check('Real provider copy waits on durable approval with zero file writes', () => {
    assert.equal(accepted.approval.payload.state, 'pending'); assert(!fs.existsSync(path.join(workshop, '批准教案.md')));
  });
  const before = rows(), command = before.commands.at(-1);
  const repeat = await page.evaluate(({ session, prompt, command }) => Promise.all([
    window.omniEdu.startXiaozhi({ sessionId: session, prompt, commandId: command }),
    window.omniEdu.startXiaozhi({ sessionId: session, prompt, commandId: command }),
    window.omniEdu.startXiaozhi({ sessionId: session, prompt: prompt + ' changed', commandId: command }),
  ]), { session, prompt: accepted.prompt, command: command.command_id });
  check('Repeated command maps same run; changed input is rejected without duplicate messages', () => {
    assert.equal(repeat[0].runId, command.run_id); assert.equal(repeat[1].runId, command.run_id); assert.equal(repeat[2].error, 'command_conflict');
    assert.equal(rows().runs.length, before.runs.length); assert.equal(rows().messages.length, before.messages.length);
  });
  const other = await page.evaluate(() => window.omniEdu.createAiConversationSession({ title: '审批身份边界' }));
  const wrong = await page.evaluate(({ session, approval }) => window.omniEdu.decideXiaozhi({ sessionId: session, approvalId: approval, decision: 'approve' }), { session: other.session.id, approval: accepted.approval.id });
  check('Approval cannot be granted by another conversation identity', () => { assert.equal(wrong.error, 'permission_denied'); assert(!fs.existsSync(path.join(workshop, '批准教案.md'))); });
  for (const [width, height] of [[1366, 768], [1920, 1080]]) {
    await page.setViewportSize({ width, height }); await accepted.card.scrollIntoViewIfNeeded();
    const button = await accepted.card.getByTestId('pi-copy-approve').boundingBox();
    check(`Approval controls reachable at ${width}x${height}`, () => assert(button && button.y + button.height <= height && button.x + button.width <= width));
    await page.screenshot({ path: path.join(output, `approval-${width}x${height}.png`), fullPage: true });
  }
  await accepted.card.getByTestId('pi-copy-approve').click(); await terminal(session);
  check('Teacher approves once; Hana copy commits and readback hash matches', () => {
    assert.equal(digest(fs.readFileSync(path.join(workshop, '批准教案.md'))), digest(sourceText)); assert.equal(rows().confirmations.find(row => row.id === accepted.approval.id).payload.state, 'executed');
  });
  check('Authorized file text is sanitized before entering private model history', () => {
    const binding = rows().bindings.find(row => row.conversation_id === session);
    const transcript = fs.readFileSync(path.join(dataRoot, 'xiaozhi-pi', binding.session_file), 'utf8');
    assert(transcript.includes('office_read_text')); assert(!transcript.includes('teacher-test@example.invalid')); assert(!transcript.includes('13800138000'));
  });
  await choose(workshop); await page.getByRole('alert').filter({ hasText: '资料范围已经固定' }).waitFor({ state: 'visible' });
  check('Bound SDK history cannot silently switch its workspace', () => assert.equal(rows().workspaces.find(row => row.conversation_id === session).path, workshop));
  const legacyItems = await page.evaluate(() => window.omniEdu.listAiConfirmations('all'));
  check('Legacy student confirmation UI excludes Pi file approvals', () => assert(!legacyItems.some(item => item.id === accepted.approval.id)));
  const afterRepeat = await page.evaluate(({ session, approval }) => Promise.all([
    window.omniEdu.decideXiaozhi({ sessionId: session, approvalId: approval, decision: 'approve' }),
    window.omniEdu.decideXiaozhi({ sessionId: session, approvalId: approval, decision: 'approve' }),
  ]), { session, approval: accepted.approval.id });
  check('Repeated approval remains idempotent after outcome commit', () => { assert(afterRepeat.every(result => result.ok)); assert.equal(fs.readdirSync(workshop).filter(file => file === '批准教案.md').length, 1); });
  await fresh(); const denied = await copyRequest('拒绝教案.md'); await denied.card.getByTestId('pi-copy-reject').click(); await terminal(await id());
  check('Reject keeps durable rejection and zero target writes', () => { assert(!fs.existsSync(path.join(workshop, '拒绝教案.md'))); assert.equal(rows().confirmations.find(row => row.id === denied.approval.id).payload.state, 'rejected'); });
  await fresh(); const cancelled = await copyRequest('停止教案.md'); const stopSession = await id();
  await page.getByRole('button', { name: '停止本轮', exact: true }).click(); await terminal(stopSession);
  const late = await page.evaluate(({ session, approval }) => window.omniEdu.decideXiaozhi({ sessionId: session, approvalId: approval, decision: 'approve' }), { session: stopSession, approval: cancelled.approval.id });
  check('Stopping approval invalidates late grant with zero writes', () => { assert(!late.ok); assert(!fs.existsSync(path.join(workshop, '停止教案.md'))); assert.equal(rows().confirmations.find(row => row.id === cancelled.approval.id).payload.state, 'interrupted'); });
  await fresh(); const changed = await copyRequest('变更教案.md'); fs.writeFileSync(path.join(workshop, sourceName), sourceText + '审批后来源变更\n');
  await changed.card.getByTestId('pi-copy-approve').click(); await terminal(await id());
  check('Frozen source hash refuses changed source after approval', () => assert(!fs.existsSync(path.join(workshop, '变更教案.md'))));
  fs.writeFileSync(path.join(workshop, sourceName), sourceText);
  await fresh(); const crash = await copyRequest('重启教案.md'); const crashSession = await id(); const crashCommand = rows().commands.at(-1);
  await killOwnedApp(); await launch();
  const recovered = await page.evaluate(session => window.omniEdu.getXiaozhiSnapshot(session), crashSession);
  const stale = await page.evaluate(({ session, approval }) => window.omniEdu.decideXiaozhi({ sessionId: session, approvalId: approval, decision: 'approve' }), { session: crashSession, approval: crash.approval.id });
  const restartCommand = await page.evaluate(({ session, prompt, command }) => window.omniEdu.startXiaozhi({ sessionId: session, prompt, commandId: command }), { session: crashSession, prompt: crash.prompt, command: crashCommand.command_id });
  check('Real process crash invalidates old approval; repeated command never replays', () => {
    assert.equal(recovered.approvals.find(item => item.id === crash.approval.id).state, 'interrupted'); assert(!stale.ok);
    assert.equal(restartCommand.runId, crashCommand.run_id); assert(!fs.existsSync(path.join(workshop, '重启教案.md')));
  });
  // Explicit new user turn must not resume the abandoned tool effect.
  const continuePrompt = '上一轮已经中断。不要复制任何文件，仅用一句中文回复本轮停止复制。';
  await page.getByTestId('office-prompt-input').fill(continuePrompt);
  await page.getByTestId('office-prompt-input').press('Enter');
  const continueSession = await id();
  await until(async () => {
    const snapshot = await page.evaluate(session => window.omniEdu.getXiaozhiSnapshot(session), continueSession), turn = snapshot.projection.turns.at(-1);
    return turn?.items.some(item => item.role === 'user' && item.text === continuePrompt) && !snapshot.running;
  });
  check('New turn after killed approval does not resume old copy', () => { assert(!fs.existsSync(path.join(workshop, '重启教案.md'))); assert.equal(rows().runs.at(-1).status, 'succeeded'); });
  await application.close(); application = undefined; await launch(true); await fresh();
  const cut = await copyRequest('待核验教案.md'); const cutSession = await id(); await cut.card.getByTestId('pi-copy-approve').click();
  await until(async () => (await page.evaluate(session => window.omniEdu.getXiaozhiSnapshot(session), cutSession)).approvals.some(item => item.state === 'executing'));
  const deadline = Date.now() + 15000;
  while (!fs.existsSync(path.join(dataRoot, '.e2e-pi-copy-committed')) && Date.now() < deadline) await page.waitForTimeout(100);
  assert(fs.existsSync(path.join(dataRoot, '.e2e-pi-copy-committed'))); assert(fs.existsSync(path.join(workshop, '待核验教案.md')));
  await killOwnedApp(); await launch();
  await page.locator(`[data-testid="pi-copy-approval"][data-approval-id="${cut.approval.id}"][data-state="uncertain"]`).waitFor({ state: 'visible' });
  const mtime = fs.statSync(path.join(workshop, '待核验教案.md')).mtimeMs;
  await page.getByTestId('pi-copy-verify').click();
  await page.locator(`[data-approval-id="${cut.approval.id}"][data-state="verified"]`).waitFor({ state: 'visible' });
  check('Crash after physical copy is uncertain; teacher verifies read-only with no replay', () => {
    assert.equal(fs.statSync(path.join(workshop, '待核验教案.md')).mtimeMs, mtime); assert.equal(digest(fs.readFileSync(path.join(workshop, '待核验教案.md'))), digest(sourceText));
    assert.equal(rows().confirmations.find(row => row.id === cut.approval.id).payload.state, 'verified');
  });
  await application.close(); application = undefined; await launch();
  const verified = await page.evaluate(session => window.omniEdu.getXiaozhiSnapshot(session), cutSession);
  check('Verified outcome and selected workspace persist across another restart', () => { assert.equal(verified.approvals.find(item => item.id === cut.approval.id).state, 'verified'); assert.equal(verified.workspace.label, path.basename(workshop)); });
  const countAfterRestart = rows().runs.length;
  const completedReplay = await page.evaluate(({ session, prompt, command }) => window.omniEdu.startXiaozhi({ sessionId: session, prompt, commandId: command }), { session, prompt: accepted.prompt, command: command.command_id });
  check('Completed command remains idempotent after actual app restart', () => { assert.equal(completedReplay.runId, command.run_id); assert.equal(rows().runs.length, countAfterRestart); });
  await application.close(); application = undefined; await launch(false, true); await fresh();
  const receiptSession = await id(), beforeReceipt = rows().runs.length, receiptPrompt = '消息接收中断实例：仅回复你好，不调用工具。';
  await page.getByTestId('office-prompt-input').fill(receiptPrompt); await page.getByTestId('office-prompt-input').press('Enter');
  await until(async () => fs.existsSync(path.join(dataRoot, '.e2e-pi-command-claimed')));
  const receiptCommand = rows().commands.at(-1); assert.equal(receiptCommand.run_id, '');
  await killOwnedApp(); await launch();
  await page.getByTestId(`ai-conversation-session-${receiptSession}`).click(); await ready();
  await page.getByText('上次消息接收过程中中断。请重新发送，旧请求不会自动继续。', { exact: true }).waitFor({ state: 'visible' });
  const receiptReplay = await page.evaluate(({ session, prompt, command }) => window.omniEdu.startXiaozhi({ sessionId: session, prompt, commandId: command }), { session: receiptSession, prompt: receiptPrompt, command: receiptCommand.command_id });
  check('Crash between command claim and run creation is visible and never replays', () => { assert(!receiptReplay.ok); assert.equal(rows().runs.length, beforeReceipt); });
  report.success = true;
} catch (error) { report.failure = String(error.stack).replaceAll(key, '[REDACTED]').replace(/sk-[a-zA-Z0-9_-]+/g, '[REDACTED]').slice(0, 4000); process.exitCode = 1;
  await page?.screenshot({ path: path.join(output, 'failure.png'), fullPage: true }).catch(() => undefined); }
finally { await application?.close().catch(() => undefined); fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify({ ...report, report: path.relative(appRoot, path.join(output, 'report.json')) })); }
