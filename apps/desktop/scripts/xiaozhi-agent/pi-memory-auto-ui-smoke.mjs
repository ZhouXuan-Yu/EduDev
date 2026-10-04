import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { _electron as electron } from 'playwright';
import { SessionManager } from '@earendil-works/pi-coding-agent';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const tests = fs.realpathSync(path.join(root, 'test-results/xiaozhi-agent'));
const source = fs.realpathSync(path.resolve(root, process.argv[2] || 'missing')), relative = path.relative(tests, source);
assert(!relative.startsWith('..') && !path.isAbsolute(relative) && path.basename(source) === 'data');
const output = fs.mkdtempSync(path.join(tests, 'pi-memory-auto-ui-')), data = path.join(output, 'data');
fs.cpSync(source, data, { recursive: true, force: false, errorOnExist: true });
const db = new DatabaseSync(path.join(data, 'app.db'), { readOnly: true });
const binding = db.prepare('SELECT * FROM xiaozhi_pi_session_bindings').all().find(row => {
  const file = path.join(data, 'xiaozhi-pi', row.session_file); return fs.existsSync(file) && fs.readFileSync(file, 'utf8').includes('search_teacher_knowledge');
}); db.close(); assert(binding);
const session = binding.conversation_id, file = path.join(data, 'xiaozhi-pi', binding.session_file), original = fs.readFileSync(file, 'utf8');
assert(!original.includes('xiaozhi.education.memory.v1'), 'Explicit old B3b1 test copy required');
const cfg = fs.readFileSync(path.join(root, '.env.local'), 'utf8'), pick = name => cfg.match(new RegExp(`^${name}\\s*=\\s*["']?([^\\r\\n"']+)`, 'm'))?.[1]?.trim();
const apiKey = pick('DEEPSEEK_API_KEY'), model = pick('DEEPSEEK_MODEL') || 'deepseek-flash'; assert(apiKey);
const checks = [], report = { suite: 'pi-memory-auto-old-history-formal-ui', success: false, model, checks,
  boundaries: ['Real Electron/DeepSeek; explicit old isolated B3b1 copy only', '65536 early auto policy is an E2E seam, official capacity stays unchanged', 'Owned-process kill; no real teacher database or system network modification'] };
let app, page;
const check = (name, fn) => { fn(); checks.push({ name, pass: true }); console.log(`PASS ${name}`); };
const until = async (fn, ms = 120000) => { const end = Date.now() + ms; while (Date.now() < end) { if (await fn()) return; await new Promise(resolve => setTimeout(resolve, 100)); } throw new Error('Memory auto condition timed out'); };
const snap = () => page.evaluate(id => window.omniEdu.getXiaozhiSnapshot(id), session);
const raw = () => fs.readFileSync(file, 'utf8');
const entries = () => raw().trim().split('\n').map(JSON.parse);
const context = () => JSON.stringify(SessionManager.open(file).buildSessionContext().messages);
const compactions = () => entries().filter(entry => entry.type === 'compaction').length;
async function launch() {
  const env = { ...process.env, OMNI_EDU_DATA_ROOT: data, OMNI_EDU_REPO_ROOT: path.resolve(root, '../..'), OMNI_EDU_E2E_DIALOG_MODE: '1', OMNI_EDU_XIAOZHI_PI: '1',
    OMNI_EDU_E2E_PI_CONTEXT_WINDOW: '65536', OMNI_EDU_E2E_PI_AUTO_COMPACTION: '1', DEEPSEEK_API_KEY: apiKey, DEEPSEEK_MODEL: model };
  delete env.ELECTRON_RUN_AS_NODE; delete env.NODE_OPTIONS;
  app = await electron.launch({ args: [path.join(root, 'out/main/index.js')], env, timeout: 60000 }); page = await app.firstWindow();
  await page.getByTestId('xiaozhi-pi-workspace').waitFor({ state: 'visible', timeout: 60000 }); await page.getByTestId(`ai-conversation-session-${session}`).click();
  await page.waitForFunction(() => !document.querySelector('[data-testid="office-prompt-input"]')?.disabled);
}
async function send(text) { const before = (await snap()).projection.turns.length; await page.getByTestId('office-prompt-input').fill(text); await page.getByTestId('office-prompt-input').press('Enter'); await until(async () => (await snap()).projection.turns.length > before); }
async function terminal() { await until(async () => !(await snap()).running); return snap(); }
async function panel() { if (!await page.getByTestId('pi-memory-preview').isVisible()) await page.getByTestId('pi-memory-scope').locator('[data-slot="chat-tool-trigger"]').click(); }
try {
  await launch(); const before = await snap();
  check('Old formal conversation opens with unchanged JSONL and truthful model tool availability', () => { assert.equal(raw(), original); assert.equal(before.memoryScope.modelAccess, 'available'); });
  await panel(); await page.getByTestId('pi-memory-preview').click();
  const document = await page.evaluate(() => window.omniEdu.getAiMemoryDocument('chat'));
  const fact = document.entries.find(entry => entry.status === 'active'); assert(fact);
  const marker = fact.text.match(/本地教学偏好[a-f0-9]{8}/)?.[0]; assert(marker);
  await page.getByTestId(`pi-memory-select-${fact.id}`).check(); await page.getByTestId('pi-memory-enabled').check(); await page.getByTestId('pi-memory-save').click();
  await until(async () => (await snap()).memoryScope.version === before.memoryScope.version + 1);
  await send('请读取本会话所选教学记忆，准确引用教学偏好代号、版本和导入方法；不检索其它来源，不操作文件。'); let state = await terminal();
  check('Old native snapshot upgrades independently and real provider reads only selected current fact', () => { assert.equal(state.projection.turns.at(-1).status, 'completed'); assert(raw().startsWith(original)); assert(context().includes(marker)); const result = entries().filter(entry => entry.type === 'message' && entry.message.role === 'toolResult' && entry.message.toolName === 'read_education_memory').at(-1); const payload = JSON.parse(result.message.content[0].text); assert.equal(payload.memories.length, 1); assert.equal(payload.memories[0].version, fact.version); const verify = new DatabaseSync(path.join(data, 'app.db'), { readOnly: true }); try { assert.equal(verify.prepare('SELECT schema_version FROM xiaozhi_pi_session_bindings WHERE conversation_id=?').get(session).schema_version, 4); } finally { verify.close(); } });
  const autoBefore = compactions(), prefix = raw(), batch = '合成教学资料：理解分数单位之后比较大小，教师核验答案与来源；保留已经核实的教师偏好代号与教学步骤，文件尚未提交。'.repeat(150);
  for (let n = 0; n < 5 && compactions() === autoBefore; n++) { await send('只阅读本批合成资料，回复一句已阅读，不调用工具或长摘要。\n' + batch); state = await terminal(); assert.equal(state.projection.turns.at(-1).status, 'completed'); }
  check('Actual automatic native compaction retains authorized memory and continues same public run', () => { assert(compactions() > autoBefore); assert(raw().startsWith(prefix)); assert(context().includes(marker)); const turn = state.projection.turns.at(-1); assert(turn.items.some(item => item.kind === 'compaction' && item.status === 'completed')); assert(state.usage.find(item => item.runId === turn.id).modelCalls >= 2); assert.equal(state.modelCapabilities.contextWindow, 1048576); assert.equal(state.contextPolicy.window, 65536); });
  const beforeRevoke = raw(), selectedVersion = state.memoryScope.version;
  await panel(); await page.getByTestId('pi-memory-clear').click(); await until(async () => (await snap()).memoryScope.version === selectedVersion + 1);
  await send('给一句新的分数课建议，不引用之前教师偏好，不使用工具。'); state = await terminal();
  check('After clearing real auto-summary and all derived model context are isolated while original bytes survive', () => { assert.equal(state.projection.turns.at(-1).status, 'completed'); assert(state.projection.turns.at(-1).items.some(item => item.kind === 'memory_isolation')); assert(!context().includes(marker)); assert(raw().startsWith(beforeRevoke)); });
  await app.close(); app = undefined; await launch();
  check('Restart retains clean native branch after auto-summary revocation', () => { assert(!context().includes(marker)); assert(raw().includes(marker)); });
  await panel(); await page.getByTestId('pi-memory-preview').click(); await page.getByTestId(`pi-memory-select-${fact.id}`).check(); await page.getByTestId('pi-memory-enabled').check(); await page.getByTestId('pi-memory-save').click();
  await until(async () => (await snap()).memoryScope.version === selectedVersion + 2);
  await send('先读取所选教学记忆，再通过教师提问工具问我三年级还是五年级，给两个选项，等我回答，不操作文件。');
  await page.locator('[data-testid="pi-teacher-question"][data-state="pending"]').waitFor({ state: 'visible', timeout: 90000 });
  const crashPrefix = raw(), controls = (await snap()).controls, question = controls.find(item => item.kind === 'question' && item.state === 'pending'); assert(question);
  execFileSync('taskkill', ['/PID', String(app.process().pid), '/T', '/F'], { windowsHide: true, stdio: 'pipe' }); await app.close().catch(() => {}); app = undefined;
  await launch(); state = await snap();
  check('Owned crash with active question converges to interruption without clearing saved source authority', () => { assert(!state.running); assert.equal(state.projection.turns.at(-1).status, 'interrupted'); assert(state.memoryScope.enabled); assert(raw().startsWith(crashPrefix)); });
  const turnsBeforeResume = state.projection.turns.length;
  const answer = '五年级；已经明确，不再询问年级，直接给一句导入建议，不操作文件。';
  await page.getByTestId('pi-question-answer').fill(answer); await page.getByTestId('pi-question-submit').click();
  await until(async () => (await snap()).projection.turns.length === turnsBeforeResume + 1); state = await terminal();
  check('Explicit page answer starts one fresh run and recovers host-owned unmatched tool boundary with same authority', () => { assert.equal(state.projection.turns.at(-1).status, 'completed'); assert(state.projection.turns.at(-1).items.some(item => item.kind === 'memory_isolation')); assert.equal(state.controls.find(item => item.id === question.id).state, 'answered'); assert(raw().startsWith(crashPrefix)); });
  const repeated = await page.evaluate(input => window.omniEdu.answerXiaozhi(input), { sessionId: session, controlId: question.id, answer });
  state = await snap();
  check('Repeated recovered answer returns original command outcome without starting another run', () => { assert(repeated.ok); assert.equal(state.projection.turns.length, turnsBeforeResume + 1); assert(!state.running); });
  check('Original named B3b1 test source is byte-for-byte unchanged', () => assert.equal(fs.readFileSync(path.join(source, 'xiaozhi-pi', binding.session_file), 'utf8'), original));
  report.success = true;
} catch (error) { report.failure = String(error.stack).replaceAll(apiKey, '[credential]').slice(0, 2600); process.exitCode = 1; if (page) await page.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {}); }
finally { await app?.close().catch(() => {}); fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify({ ...report, report: path.relative(root, path.join(output, 'report.json')) })); }
