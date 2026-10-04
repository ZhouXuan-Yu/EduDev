import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { _electron as electron } from 'playwright';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const config = fs.readFileSync(path.join(root, '.env.local'), 'utf8');
const pick = name => config.match(new RegExp(`^${name}\\s*=\\s*(.*?)\\s*$`, 'm'))?.[1]?.replace(/^['"]|['"]$/g, '');
const key = process.env.DEEPSEEK_API_KEY || pick('DEEPSEEK_API_KEY'), model = process.env.DEEPSEEK_MODEL || pick('DEEPSEEK_MODEL') || 'deepseek-chat';
assert(key);
const output = fs.mkdtempSync(path.join(root, 'test-results/xiaozhi-agent/pi-skills-ui-')), data = path.join(output, 'data');
const marker = `教研${randomUUID().slice(0, 8)}`, fixture = path.join(output, '技能教研资料.md');
fs.writeFileSync(fixture, `# 分数加法教研\n五年级数学，核验代号${marker}，课时37分钟。\n导入10分钟、图示探究15分钟、巩固10分钟、总结2分钟。同分母分数相加保持分母不变，异分母先通分。以图示帮助理解相同单位。\n`);
const checks = [], report = { suite: 'pi-education-skills-formal-ui', success: false, model, checks,
  boundaries: ['Formal Electron UI/main/typed preload and real official DeepSeek; synthetic teacher material only', 'P05-A builtins only; import/edit/enable management and complete Codex visual match pending', 'Actual VPN-off and installer not verified'] };
let app, page;
const check = (name, fn) => { fn(); checks.push({ name, pass: true }); };
function rows() { const db = new DatabaseSync(path.join(data, 'app.db'), { readOnly: true }); try { return { messages: db.prepare('SELECT role,content FROM ai_conversation_messages ORDER BY created_at').all(), bindings: db.prepare('SELECT * FROM xiaozhi_pi_session_bindings').all() }; } finally { db.close(); } }
async function launch() {
  const env = { ...process.env, DEEPSEEK_API_KEY: key, DEEPSEEK_MODEL: model, OMNI_EDU_XIAOZHI_PI: '1', OMNI_EDU_DATA_ROOT: data, OMNI_EDU_REPO_ROOT: path.resolve(root, '../..'), OMNI_EDU_E2E_DIALOG_MODE: '1' };
  delete env.ELECTRON_RUN_AS_NODE; delete env.NODE_OPTIONS;
  app = await electron.launch({ args: [path.join(root, 'out/main/index.js')], env, timeout: 60000 }); page = await app.firstWindow();
  await page.getByTestId('xiaozhi-pi-workspace').waitFor({ state: 'visible', timeout: 30000 });
  await page.waitForFunction(() => !document.querySelector('[data-testid="office-prompt-input"]')?.disabled);
}
async function watch() { await page.evaluate(() => { window.skillTestEvents = []; window.omniEdu.onXiaozhiEvent(event => window.skillTestEvents.push(event)); }); }
async function finish() { await page.waitForFunction(() => window.skillTestEvents.some(event => event.kind === 'status' && event.status !== 'running'), undefined, { timeout: 120000 }); return page.evaluate(() => window.skillTestEvents); }
async function nativeEntries() {
  const files = fs.readdirSync(path.join(data, 'xiaozhi-pi'), { recursive: true }).filter(name => String(name).endsWith('.jsonl'));
  assert.equal(files.length, 1); return fs.readFileSync(path.join(data, 'xiaozhi-pi', files[0]), 'utf8').trim().split('\n').map(line => JSON.parse(line));
}
try {
  await launch(); await page.getByTestId('ai-return-workspace').click();
  await app.evaluate(({ dialog }, file) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] }); }, fixture);
  await page.getByTestId('nav-knowledge').click(); await page.getByRole('button', { name: '导入知识资源', exact: true }).click();
  await page.getByText('技能教研资料.md', { exact: true }).first().waitFor({ state: 'visible' });
  await page.getByTestId('nav-ai').click(); await page.getByTestId('pi-skill-picker').waitFor({ state: 'visible' });
  await page.getByTestId('pi-skill-picker').click(); await page.getByRole('menuitemradio', { name: '备课资料整理', exact: true }).click();
  await page.getByTestId('pi-skill-view').click();
  const preview = await page.getByTestId('pi-skill-preview').innerText();
  check('Teacher selects builtin skill and sees full instructions and truthful support', () => { assert(preview.includes('备课流程')); assert(preview.includes('没有 DOCX/PDF 生成工具')); });
  for (const [width, height] of [[1366, 768], [1920, 1080]]) {
    await page.setViewportSize({ width, height });
    const input = await page.getByTestId('office-prompt-input').boundingBox(), picker = await page.getByTestId('pi-skill-picker').boundingBox();
    check(`Skill picker and composer reachable at ${width}x${height}`, () => { assert(input && picker && input.y + input.height <= height && picker.y + picker.height <= height && picker.x + picker.width <= width); });
    await page.screenshot({ path: path.join(output, `preview-${width}x${height}.png`), fullPage: true });
  }
  await page.getByRole('button', { name: '关闭说明', exact: true }).click(); await watch();
  const input = page.getByTestId('office-prompt-input');
  await input.fill('请从教师知识库查找分数加法教研资料，依据材料写一份简短教案草稿。保留资料的核验代号与37分钟课时分配，注明资料标题。'); await input.press('Enter');
  assert.equal(await input.inputValue(), ''); const events = await finish();
  check('Explicit skill runs through real DeepSeek and actual teacher knowledge retrieval', () => { assert.equal(events.filter(e => e.kind === 'status').at(-1).status, 'completed', JSON.stringify(events.filter(e => e.kind === 'status').at(-1))); assert(events.some(e => e.kind === 'tool_end' && e.tool === 'search_teacher_knowledge' && e.success)); });
  const saved = rows();
  check('One accepted send clears skill selection and persists actual teacher result', () => { assert.equal(saved.messages.filter(m => m.role === 'user').length, 1); assert(saved.messages.find(m => m.role === 'user').content.startsWith('/skill:lesson-preparation ')); const answer = saved.messages.find(m => m.role === 'assistant').content.replace(/\s/g, ''); assert(answer.includes(marker)); assert(answer.includes('37')); assert.equal(saved.bindings[0].schema_version, 4); });
  await page.waitForFunction(() => document.querySelector('[data-testid="pi-skill-picker"]')?.textContent === '技能');
  const entries = await nativeEntries();
  check('Native full skill expansion is private; public snapshot has no host paths or secrets', () => { const nativeUser = entries.filter(e => e.type === 'message' && e.message.role === 'user').at(-1).message.content.map(p => p.text || '').join(''); assert(nativeUser.includes('<skill name="lesson-preparation"')); assert(nativeUser.includes('备课流程')); assert(!JSON.stringify(saved).includes(key)); });
  const session = saved.bindings[0].conversation_id, snapshot = await page.evaluate(id => window.omniEdu.getXiaozhiSnapshot(id), session);
  check('Typed public catalog contains four education skills with no private pointers', () => { assert.equal(snapshot.skills.length, 4); assert(!JSON.stringify(snapshot.skills).includes(data)); assert(!JSON.stringify(snapshot.skills).includes('filePath')); });
  // Auto selection on a fresh prompt uses native progressive disclosure, not a UI-only flag.
  await watch(); await input.fill('使用“教学办公文稿”技能先加载其完整说明，再依据刚才的资料起草三行教研纪要；先核实技能当前支持范围，勿生成文件。'); await input.press('Enter');
  const auto = await finish();
  check('Automatic catalog selection loads a real registered SKILL.md via restricted read', () => { assert.equal(auto.filter(e => e.kind === 'status').at(-1).status, 'completed'); assert(auto.some(e => e.kind === 'tool_end' && e.tool === 'read' && e.success && e.source === '教育技能：教学办公文稿')); });
  const after = await nativeEntries(), actualRead = after.filter(e => e.type === 'message' && e.message.role === 'toolResult' && e.message.toolName === 'read').at(-1);
  check('Tool result contains actual office instructions and source receipt excludes paths', () => { assert(JSON.stringify(actualRead.message.content).includes('办公流程')); assert(!JSON.stringify(auto).includes(data)); });
  await app.close(); app = undefined; await launch();
  await page.waitForFunction(marker => document.querySelector('[data-testid="office-conversation"]')?.textContent?.replace(/\s/g, '').includes(marker), marker);
  const restored = await page.evaluate(id => window.omniEdu.getXiaozhiSnapshot(id), session);
  check('Actual restart preserves skill-enabled history, two turns and catalog', () => { assert.equal(restored.projection.turns.length, 2); assert.equal(restored.skills.length, 4); assert.equal(restored.projection.model, model); });
  // Restart real API continuation exercises the native skills + memory snapshot compatibility.
  await watch(); await page.getByTestId('office-prompt-input').fill('仅依据本会话已核实资料，用一行回复核验代号与课时分钟数。'); await page.getByTestId('office-prompt-input').press('Enter');
  const resumed = await finish();
  check('Restarted native context continues with real DeepSeek and earlier facts', () => { assert.equal(resumed.filter(e => e.kind === 'status').at(-1).status, 'completed'); assert(rows().messages.filter(m => m.role === 'assistant').at(-1).content.replace(/\s/g, '').includes(marker)); });
  const catalogDb = new DatabaseSync(path.join(data, 'app.db'), { readOnly: true });
  let selected;
  try { selected = JSON.parse(catalogDb.prepare('SELECT payload_json FROM xiaozhi_pi_skill_catalog WHERE singleton=1').get().payload_json).skills.find(item => item.name === 'lesson-preparation'); } finally { catalogDb.close(); }
  assert(selected); const source = path.join(data, 'xiaozhi-pi/skills', selected.directory, 'SKILL.md'), originalSource = fs.readFileSync(source);
  fs.appendFileSync(source, '\nchanged isolated source'); await watch();
  await page.getByTestId('office-prompt-input').fill('检查技能变更后的失败状态'); await page.getByTestId('office-prompt-input').press('Enter');
  const invalid = await finish(), invalidSnapshot = await page.evaluate(id => window.omniEdu.getXiaozhiSnapshot(id), session);
  check('Changed skill fails in formal UI before provider request and does not overwrite source', () => { const terminal = invalid.filter(e => e.kind === 'status').at(-1); assert.equal(terminal.status, 'failed'); assert.equal(terminal.error, 'skill_source_changed'); assert.equal(invalidSnapshot.usage.at(-1).modelCalls, 0); assert(fs.readFileSync(source, 'utf8').endsWith('changed isolated source')); });
  await page.getByTestId('office-conversation').getByText('当前启用的技能文件已变更或不可用，后续调用已停止。请检查本地技能文件，或在技能管理中关闭该项后继续；原对话和已完成操作保留。', { exact: true }).waitFor({ state: 'visible' });
  fs.writeFileSync(source, originalSource);
  report.success = true;
} catch (error) { report.error = String(error?.stack || error).replaceAll(key, '[REDACTED]').slice(0, 2000); process.exitCode = 1; }
finally { await app?.close().catch(() => {}); fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify({ success: report.success, checks: checks.length, error: report.error, report: path.relative(root, path.join(output, 'report.json')) })); }
