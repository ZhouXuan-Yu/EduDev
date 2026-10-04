import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { _electron as electron } from 'playwright';
import { SessionManager } from '@earendil-works/pi-coding-agent';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const output = fs.mkdtempSync(path.join(root, 'test-results/xiaozhi-agent/pi-memory-model-ui-')), data = path.join(output, 'data'); fs.mkdirSync(data);
const cfg = fs.readFileSync(path.join(root, '.env.local'), 'utf8'), pick = name => cfg.match(new RegExp(`^${name}\\s*=\\s*["']?([^\\r\\n"']+)`, 'm'))?.[1]?.trim();
const apiKey = pick('DEEPSEEK_API_KEY'), model = pick('DEEPSEEK_MODEL') || 'deepseek-flash'; assert(apiKey);
const checks = [], report = { suite: 'pi-memory-model-formal-ui', success: false, model, checks,
  boundaries: ['Real Electron/DeepSeek with synthetic teacher materials only', 'Manual native compaction and real scope/source revocation; automatic compaction requires separate evidence', 'Existing teacher governance UI creates and edits source facts'] };
let app, page;
const check = (name, fn) => { fn(); checks.push({ name, pass: true }); console.log(`PASS ${name}`); };
const until = async (fn, ms = 90000) => { const end = Date.now() + ms; while (Date.now() < end) { if (await fn()) return; await new Promise(resolve => setTimeout(resolve, 80)); } throw new Error('Memory scope acceptance timed out'); };
const id = () => page.locator('.office-composer-container').getAttribute('data-session-id');
const snap = async session => page.evaluate(id => window.omniEdu.getXiaozhiSnapshot(id), session || await id());
const scopeSet = input => page.evaluate(input => window.omniEdu.setXiaozhiMemoryScope(input), input);
async function launch() {
  const env = { ...process.env, OMNI_EDU_DATA_ROOT: data, OMNI_EDU_REPO_ROOT: path.resolve(root, '../..'), OMNI_EDU_E2E_DIALOG_MODE: '1', OMNI_EDU_XIAOZHI_PI: '1', DEEPSEEK_API_KEY: apiKey, DEEPSEEK_MODEL: model };
  delete env.ELECTRON_RUN_AS_NODE; delete env.NODE_OPTIONS;
  app = await electron.launch({ args: [path.join(root, 'out/main/index.js')], env, timeout: 60000 }); page = await app.firstWindow();
  await page.getByTestId('xiaozhi-pi-workspace').waitFor({ state: 'visible' });
  await page.waitForFunction(() => !document.querySelector('[data-testid="office-prompt-input"]')?.disabled);
}
async function send(text) {
  const session = await id(), n = (await snap()).projection.turns.length;
  await page.getByTestId('office-prompt-input').fill(text); await page.getByTestId('office-prompt-input').press('Enter');
  await until(async () => (await snap(session)).projection.turns.length > n); return session;
}
async function terminal(session) { await until(async () => !(await snap(session)).running); return snap(session); }
async function memoryPage() { await page.getByTestId('ai-return-workspace').click(); await page.getByTestId('nav-memory').click(); await page.getByTestId('memory-governance-workspace').waitFor({ state: 'visible' }); }
async function agentPage(session) { await page.getByTestId('nav-ai').click(); await page.getByTestId('xiaozhi-pi-workspace').waitFor({ state: 'visible' }); if (session) await page.getByTestId(`ai-conversation-session-${session}`).click(); await page.waitForFunction(() => !document.querySelector('[data-testid="office-prompt-input"]')?.disabled); }
async function panel() { await until(async () => await page.getByTestId('pi-memory-preview').count() === 1, 5000); if (!await page.getByTestId('pi-memory-preview').isVisible()) await page.getByTestId('pi-memory-scope').locator('[data-slot="chat-tool-trigger"]').click(); }
function native(session) {
  const db = new DatabaseSync(path.join(data, 'app.db'), { readOnly: true });
  try { const binding = db.prepare('SELECT session_file FROM xiaozhi_pi_session_bindings WHERE conversation_id=?').get(session); return fs.readFileSync(path.join(data, 'xiaozhi-pi', binding.session_file), 'utf8'); }
  finally { db.close(); }
}
function nativeContext(session) {
  const db = new DatabaseSync(path.join(data, 'app.db'), { readOnly: true });
  try { const binding = db.prepare('SELECT session_file FROM xiaozhi_pi_session_bindings WHERE conversation_id=?').get(session);
    return JSON.stringify(SessionManager.open(path.join(data, 'xiaozhi-pi', binding.session_file)).buildSessionContext().messages); }
  finally { db.close(); }
}
const assistantText = state => state.projection.turns.at(-1).items.filter(item => item.role === 'assistant').map(item => item.text).join('');
try {
  await launch(); const session = await id(); let state = await snap();
  const emptyTrace = await page.evaluate(id => window.omniEdu.getXiaozhiMemoryTrace(id), session);
  check('New conversation has empty disabled scope and no global latest-run fallback', () => { assert.equal(state.memoryScope.version, 0); assert(!state.memoryScope.enabled); assert.equal(emptyTrace, null); });
  await send('请检索老师知识库有没有三年级分数课导入资料；没有资料就说明没有资料并给一句纸条比较分数的建议。'); state = await terminal(session);
  check('Real existing DeepSeek knowledge path still completes before memory setup', () => { assert.equal(state.projection.turns.at(-1).status, 'completed'); assert(state.projection.turns.at(-1).items.some(item => item.kind === 'tool')); });
  const trace = await page.evaluate(id => window.omniEdu.getXiaozhiMemoryTrace(id), session);
  check('L1 preview is bound to this conversation and projects only safe event fields', () => { assert.equal(trace.runId, state.projection.turns.at(-1).id); assert(trace.events.length); assert(trace.events.every(item => Object.keys(item).every(key => ['sequence', 'label', 'status', 'tool'].includes(key)))); });
  await memoryPage(); await page.getByTestId('memory-draft-l2').click(); await page.getByTestId('memory-adopt-l2-0').click();
  await until(async () => (await page.evaluate(() => window.omniEdu.getAiMemoryDocument('chat')))?.entries.length > 0);
  let entry = (await page.evaluate(() => window.omniEdu.getAiMemoryDocument('chat'))).entries[0];
  const marker = `本地教学偏好${randomUUID().slice(0, 8)}`, text = `${marker}：分数课先让学生比较纸条。测试电话13800138000。`;
  await page.getByTestId(`memory-l2-text-${entry.id}`).fill(text); await page.getByTestId(`memory-save-l2-${entry.id}`).click();
  await until(async () => (await page.evaluate(() => window.omniEdu.getAiMemoryDocument('chat'))).entries.find(item => item.id === entry.id).version > entry.version);
  entry = (await page.evaluate(() => window.omniEdu.getAiMemoryDocument('chat'))).entries.find(item => item.id === entry.id);
  await page.getByTestId('memory-draft-l3').click(); await page.getByTestId('memory-adopt-l3-0').click();
  await until(async () => (await page.evaluate(() => window.omniEdu.getAiMemoryL3Document('profile')))?.entries.length > 0);
  const l3 = (await page.evaluate(() => window.omniEdu.getAiMemoryL3Document('profile'))).entries[0];
  check('Existing teacher UI creates, adopts and edits actual L2/L3 source facts', () => { assert.equal(entry.text, text); assert(entry.refs.length); assert(l3.sourceDocuments.includes('chat')); });
  await agentPage(session); await panel(); await page.getByTestId('pi-memory-preview').click();
  const row = page.getByTestId(`pi-memory-entry-${entry.id}`); await row.waitFor({ state: 'visible' });
  await row.getByText('查看脱敏摘要', { exact: true }).click();
  const localText = await row.getByTestId('pi-memory-local-text').textContent(), sanitizedText = await row.getByTestId('pi-memory-sanitized-text').textContent(), provenance = await row.getByTestId('pi-memory-provenance').textContent();
  check('Local preview preserves original text, redacts phone and shows actual event references', () => { assert(localText.includes('13800138000')); assert(!sanitizedText.includes('13800138000')); assert.match(provenance, /不表示结论已经核实/); });
  await page.getByTestId(`pi-memory-select-${entry.id}`).check(); await page.getByTestId('pi-memory-source').selectOption('8');
  await page.getByTestId(`pi-memory-entry-${l3.id}`).waitFor({ state: 'visible' });
  assert.match(await page.getByTestId(`pi-memory-entry-${l3.id}`).getByTestId('pi-memory-provenance').textContent(), /没有逐条证据/);
  await page.getByTestId(`pi-memory-select-${l3.id}`).check(); await page.getByTestId('pi-memory-enabled').check(); await page.getByTestId('pi-memory-save').click();
  await until(async () => (await snap()).memoryScope.version === 1); state = await snap();
  check('Visible selection persists current versions; memory is available but not injected before actual reading', () => { assert(state.memoryScope.enabled); assert.equal(state.memoryScope.selections.length, 2); assert(state.memoryScope.selections.every(item => item.state === 'ready')); assert.equal(state.memoryScope.modelAccess, 'available'); assert(!JSON.stringify(state.memoryScope).includes('fingerprint')); assert(!native(session).includes(marker)); });
  const db = new DatabaseSync(path.join(data, 'app.db'), { readOnly: true }); const saved = db.prepare('SELECT * FROM xiaozhi_pi_memory_scopes WHERE conversation_id=?').get(session); db.close();
  check('SQLite stores selection authority metadata without a second memory text source', () => { const payload = JSON.parse(saved.payload_json); assert(!saved.payload_json.includes(marker)); assert(!saved.payload_json.includes('sanitizedText')); assert(payload.selections.every(item => Object.keys(item).sort().join(',') === 'fingerprint,id,layer,source,version')); });
  for (const [width, height] of [[1366, 768], [1920, 1080]]) {
    await (await app.browserWindow(page)).evaluate((window, size) => window.setContentSize(...size), [width, height]);
    await page.getByTestId('pi-memory-save').evaluate(node => node.scrollIntoView({ block: 'center' }));
    const box = await page.getByTestId('pi-memory-save').boundingBox(), view = await page.evaluate(() => ({ width: innerWidth, height: innerHeight }));
    check(`Memory save controls reachable at ${width}x${height}`, () => assert(box && box.x >= 0 && box.x + box.width <= view.width + 1 && box.y >= 0 && box.y + box.height <= view.height + 1));
    await page.screenshot({ path: path.join(output, `memory-${width}x${height}.png`) });
  }
  await app.close(); app = undefined; await launch(); await page.getByTestId(`ai-conversation-session-${session}`).click(); state = await snap();
  check('Actual application restart retains per-conversation version and selected source identities', () => { assert.equal(state.memoryScope.version, 1); assert(state.memoryScope.selections.every(item => item.state === 'ready')); });
  const oldSession = await id(); await page.getByTestId('ai-conversation-new').click(); await until(async () => (await id()) !== oldSession); const fresh = await id();
  const freshScope = (await snap()).memoryScope, freshTrace = await page.evaluate(id => window.omniEdu.getXiaozhiMemoryTrace(id), fresh);
  check('Another conversation does not inherit grants or foreign L1 trace', () => { assert.notEqual(fresh, session); assert.equal(freshScope.selections.length, 0); assert.equal(freshTrace, null); });
  await send('请通过教学记忆读取工具核对本会话有没有所选教学偏好；如果没有就明确没有，不要检索其他会话或知识来源。'); const freshState = await terminal(fresh);
  check('Real model in another conversation receives no selected teaching text', () => { assert.equal(freshState.projection.turns.at(-1).status, 'completed'); assert(!native(fresh).includes(marker)); const entries = native(fresh).trim().split('\n').map(JSON.parse); const result = entries.find(entry => entry.type === 'message' && entry.message.role === 'toolResult' && entry.message.toolName === 'read_education_memory'); assert(result); assert.equal(JSON.parse(result.message.content[0].text).memories.length, 0); });
  await page.getByTestId(`ai-conversation-session-${session}`).click(); await panel();
  const chosen = state.memoryScope.selections.map(({ state: _state, label: _label, ...item }) => item);
  const denials = await Promise.all([
    scopeSet({ sessionId: session, version: 0, enabled: true, selections: chosen }),
    scopeSet({ sessionId: session, version: 1, enabled: true, selections: chosen, providerKey: 'untrusted-field' }),
    page.evaluate(input => window.omniEdu.getXiaozhiMemoryCatalog(input), { sessionId: session, layer: 'L2', source: 'all', offset: 0 }),
    scopeSet({ sessionId: `aisession_${randomUUID()}`, version: 0, enabled: true, selections: chosen }),
  ]);
  check('Stale scope and extra authority fields, arbitrary sources and nonexistent sessions reject', () => { assert(denials.every(item => !item.ok)); assert.equal(denials[0].error, 'command_conflict'); assert.equal(denials[1].error, 'invalid_input'); });
  await send('请读取本会话已选教学记忆，告诉我教师的分数课导入偏好，原样引用偏好代号，注明记忆编号与版本。只读这些记忆，不检索其他来源，不提问、不操作文件。'); state = await terminal(session);
  const memoryTurn = state.projection.turns.at(-1);
  check('Real model invokes the selected-memory tool and cites the undisclosed randomized teacher fact', () => { assert.equal(memoryTurn.status, 'completed'); assert(memoryTurn.items.some(item => item.kind === 'tool' && item.label === '读取本会话教育记忆')); assert(assistantText(state).includes(marker)); assert.match(assistantText(state), /记忆\s*1/); assert(nativeContext(session).includes(marker)); });
  const results = native(session).trim().split('\n').map(JSON.parse).filter(entry => entry.type === 'message' && entry.message.role === 'toolResult' && entry.message.toolName === 'read_education_memory');
  check('Actual SDK memory results redact phone and distinguish L3 category from event evidence', () => { assert(results.length); const payload = JSON.parse(results.at(-1).message.content[0].text); assert.equal(payload.memories.length, 2); assert(!JSON.stringify(payload).includes('13800138000')); assert(payload.memories.every(item => !('id' in item))); assert.equal(payload.memories[1].provenance, 'surface_only'); assert(payload.memories[1].sourceDocuments.length); assert.equal(payload.memories[1].refs.length, 0); });
  const longText = Array.from({ length: 100 }, (_, index) => `合成备课条目${index + 1}：用纸条帮助学生建立分数单位，比较大小并说明依据；教师核验教学记录与来源，不自动提交任何练习或文件。`).join('\n');
  for (let n = 0; n < 2; n++) { await send(`请阅读第${n + 1}批合成资料，只回复“已阅读”，保留之前教学偏好，不调用工具：\n${longText}`); assert.equal((await terminal(session)).projection.turns.at(-1).status, 'completed'); }
  const beforeCompact = native(session), compactCount = beforeCompact.trim().split('\n').map(JSON.parse).filter(entry => entry.type === 'compaction').length;
  await page.getByTestId('pi-compact').click(); await until(async () => (await snap()).running); state = await terminal(session);
  check('Real manual compaction retains native memory history with no public summary leakage', () => { assert.equal(state.projection.turns.at(-1).status, 'completed'); assert.equal(native(session).trim().split('\n').map(JSON.parse).filter(entry => entry.type === 'compaction').length, compactCount + 1); assert(native(session).startsWith(beforeCompact)); assert(!JSON.stringify(state.projection.turns.at(-1)).includes(marker)); });
  await send('继续刚才任务，只回答此前教学偏好代号，不再读取工具或操作文件。'); state = await terminal(session);
  check('Real continuation can use the still-authorized memory after native compaction', () => { assert.equal(state.projection.turns.at(-1).status, 'completed'); assert(assistantText(state).includes(marker)); });
  await send('请先用工具读取所选教学记忆，然后用教师提问工具问我三年级还是五年级，给两个选项，等我回答，不操作文件。');
  await page.locator('[data-testid="pi-teacher-question"][data-state="pending"]').waitFor({ state: 'visible', timeout: 90000 });
  const waiting = (await snap()).controls.find(item => item.kind === 'question' && item.state === 'pending');
  await memoryPage(); await page.getByTestId(`memory-l2-text-${entry.id}`).fill(`${marker}：教师已改成先画图比较分数。`); await page.getByTestId(`memory-save-l2-${entry.id}`).click();
  await until(async () => (await page.evaluate(() => window.omniEdu.getAiMemoryDocument('chat'))).entries.find(item => item.id === entry.id).version > entry.version);
  await page.getByTestId(`memory-disable-l3-${l3.id}`).click(); await until(async () => (await page.evaluate(() => window.omniEdu.getAiMemoryL3Document('profile'))).entries.find(item => item.id === l3.id).status === 'disabled');
  state = await terminal(session);
  const lateAnswer = await page.evaluate(input => window.omniEdu.answerXiaozhi(input), { sessionId: session, controlId: waiting.id, answer: '五年级' });
  check('Changing a source during actual teacher waiting aborts the run and denies late answers', () => { assert.equal(state.projection.turns.at(-1).status, 'failed'); assert.match(state.projection.turns.at(-1).error, /记忆/); assert(!lateAnswer.ok); });
  await agentPage(session); await panel(); await page.getByTestId('pi-memory-refresh').click();
  await until(async () => (await snap()).memoryScope.selections.find(item => item.id === entry.id).state === 'changed'); state = await snap();
  check('Teacher edits and disables source facts; saved old grants become invalid without auto-upgrading', () => { assert.equal(state.memoryScope.selections.find(item => item.id === entry.id).state, 'changed'); assert.equal(state.memoryScope.selections.find(item => item.id === l3.id).state, 'disabled'); assert.equal(state.memoryScope.selections.find(item => item.id === entry.id).version, entry.version); });
  const invalidSave = await scopeSet({ sessionId: session, version: 1, enabled: true, selections: chosen });
  check('Old selected source versions cannot be silently saved as new authority', () => assert(!invalidSave.ok));
  await page.getByTestId('pi-memory-clear').click(); await until(async () => (await snap()).memoryScope.version === 2);
  state = await snap(); check('Visible close-and-clear removes selection authority without deleting original facts', () => { assert(!state.memoryScope.enabled); assert.equal(state.memoryScope.selections.length, 0); });
  const beforeIsolation = native(session), historyCount = state.projection.turns.length;
  await send('请给一句新的分数课建议，不要读取记忆或调用工具。'); state = await terminal(session);
  check('Formal continuation emits isolation receipt and excludes raw, derived and compacted old memory', () => { assert.equal(state.projection.turns.at(-1).status, 'completed'); assert(state.projection.turns.at(-1).items.some(item => item.kind === 'memory_isolation')); assert(!nativeContext(session).includes(marker)); assert(native(session).startsWith(beforeIsolation)); assert(state.projection.turns.length > historyCount); assert(JSON.stringify(state.projection.turns).includes(marker)); });
  await page.getByTestId('pi-memory-isolation').waitFor({ state: 'visible' });
  await app.close(); app = undefined; await launch(); await page.getByTestId(`ai-conversation-session-${session}`).click();
  check('Actual restart preserves isolated native branch and visible original conversation', () => { assert(!nativeContext(session).includes(marker)); assert(native(session).includes(marker)); });
  await panel(); await page.getByTestId('pi-memory-source').selectOption('0'); await page.getByTestId('pi-memory-preview').click();
  await page.getByTestId(`pi-memory-select-${entry.id}`).check(); await page.getByTestId('pi-memory-enabled').check(); await page.getByTestId('pi-memory-save').click();
  await until(async () => (await snap()).memoryScope.version === 3);
  const prompt = '帮我准备一份分数课导入，请先问我三年级还是五年级，给这两个选项，等我回答，不操作文件。'; await send(prompt);
  await page.locator('[data-testid="pi-teacher-question"][data-state="pending"]').waitFor({ state: 'visible', timeout: 90000 });
  const staleClear = await scopeSet({ sessionId: session, version: 2, enabled: false, selections: [] }); await panel();
  check('Stale revocation does not stop the actual active teacher question', () => { assert.equal(staleClear.error, 'command_conflict'); });
  assert((await snap()).running);
  assert(await page.getByTestId('pi-memory-save').isDisabled());
  assert(!await page.getByTestId('pi-memory-clear').isDisabled()); await page.getByTestId('pi-memory-clear').click();
  await until(async () => (await snap()).memoryScope.version === 4); state = await terminal(session);
  check('Visible active revocation waits for interruption before saving cleared authority', () => { assert.equal(state.projection.turns.at(-1).status, 'interrupted'); assert(!state.memoryScope.enabled); assert.equal(state.memoryScope.selections.length, 0); });
  await app.close(); app = undefined; await launch(); await page.getByTestId(`ai-conversation-session-${session}`).click(); state = await snap();
  check('Stop/restart retains cleared authority without returning old memory to model context', () => { assert.equal(state.memoryScope.version, 4); assert.equal(state.memoryScope.selections.length, 0); assert(!state.running); assert(!nativeContext(session).includes(marker)); });
  report.success = true;
} catch (error) { report.failure = String(error.stack).slice(0, 2200); process.exitCode = 1; if (page) await page.screenshot({ path: path.join(output, 'failure.png') }).catch(() => undefined); }
finally { await app?.close().catch(() => undefined); fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify({ ...report, report: path.relative(root, path.join(output, 'report.json')) })); }
