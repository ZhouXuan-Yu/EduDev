import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { _electron as electron } from 'playwright';
import { SessionManager } from '@earendil-works/pi-coding-agent';
const desktop = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const tests = fs.realpathSync(path.join(desktop, 'test-results/xiaozhi-agent'));
const source = fs.realpathSync(path.resolve(desktop, process.argv[2] || 'missing'));
const relative = path.relative(tests, source);
assert(!relative.startsWith('..') && !path.isAbsolute(relative) && path.basename(source) === 'data', 'Explicit isolated test data required');
const hash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const sourceHashes = () => fs.readdirSync(source, { recursive: true }).filter(name => fs.statSync(path.join(source, name)).isFile()).map(name => [name, hash(path.join(source, name))]);
const originalHashes = sourceHashes(), output = fs.mkdtempSync(path.join(tests, 'pi-skill-existing-ui-')), data = path.join(output, 'data');
fs.cpSync(source, data, { recursive: true, force: false, errorOnExist: true });
const query = fn => { const db = new DatabaseSync(path.join(data, 'app.db'), { readOnly: true }); try { return fn(db); } finally { db.close(); } };
const binding = query(db => db.prepare('SELECT * FROM xiaozhi_pi_session_bindings').all().find(row => row.schema_version === 3));
assert(binding, 'P05-A binding v3 fixture required');
const session = binding.conversation_id, file = path.join(data, 'xiaozhi-pi', binding.session_file), original = fs.readFileSync(file, 'utf8');
assert(original.includes('xiaozhi.education.skills.v1') && !original.includes('xiaozhi.education.skills.v2'));
const messages = () => query(db => db.prepare('SELECT role,content FROM ai_conversation_messages WHERE session_id=? ORDER BY created_at').all(session));
const marker = messages().find(row => row.role === 'assistant' && /教研[a-f0-9]{8}/.test(row.content))?.content.match(/教研[a-f0-9]{8}/)?.[0];
assert(marker);
const config = fs.readFileSync(path.join(desktop, '.env.local'), 'utf8');
const pick = name => config.match(new RegExp(`^${name}\\s*=\\s*(.*?)\\s*$`, 'm'))?.[1]?.replace(/^['"]|['"]$/g, '');
const key = process.env.DEEPSEEK_API_KEY || pick('DEEPSEEK_API_KEY'), model = process.env.DEEPSEEK_MODEL || pick('DEEPSEEK_MODEL') || 'deepseek-chat';
assert(key);
const checks = [], report = { suite: 'pi-skill-existing-formal-ui', success: false, model, checks, boundaries: [
  'Actual Electron/DeepSeek continuation of explicit isolated P05-A v3/v1 copy',
  'Upgrade preserves original catalog authority; management UI and revocation acceptance remain P05-B3',
] };
let app, page;
const check = (name, fn) => { fn(); checks.push({ name, pass: true }); console.log(`PASS ${name}`); };
const raw = () => fs.readFileSync(file, 'utf8'), entries = () => raw().trim().split('\n').map(JSON.parse);
const snap = () => page.evaluate(id => window.omniEdu.getXiaozhiSnapshot(id), session);
async function until(fn) { const end = Date.now() + 120000; while (Date.now() < end) { if (await fn()) return; await new Promise(resolve => setTimeout(resolve, 100)); } throw new Error('Existing skills UI condition timed out'); }
async function launch() {
  const env = { ...process.env, DEEPSEEK_API_KEY: key, DEEPSEEK_MODEL: model, OMNI_EDU_XIAOZHI_PI: '1', OMNI_EDU_DATA_ROOT: data, OMNI_EDU_REPO_ROOT: path.resolve(desktop, '../..'), OMNI_EDU_E2E_DIALOG_MODE: '1' };
  delete env.ELECTRON_RUN_AS_NODE; delete env.NODE_OPTIONS;
  app = await electron.launch({ args: [path.join(desktop, 'out/main/index.js')], env, timeout: 60000 }); page = await app.firstWindow();
  await page.getByTestId('xiaozhi-pi-workspace').waitFor({ state: 'visible', timeout: 60000 });
  await page.getByTestId(`ai-conversation-session-${session}`).click();
  await page.waitForFunction(() => !document.querySelector('[data-testid="office-prompt-input"]')?.disabled);
}
async function send(text) {
  const before = (await snap()).projection.turns.length, input = page.getByTestId('office-prompt-input');
  await input.fill(text); await input.press('Enter'); assert.equal(await input.inputValue(), '');
  await until(async () => (await snap()).projection.turns.length > before);
  await until(async () => !(await snap()).running); return snap();
}
try {
  await launch(); const previous = await snap();
  check('Old conversation opens through actual navigation without rewriting native history', () => { assert.equal(raw(), original); assert.equal(previous.skills.length, 4); assert(previous.projection.turns.length >= 3); });
  const result = await send('仅依据本会话已核实的分数加法教研资料，用一行回复之前资料的核验代号与课时分钟数；不调用工具，不加入新事实。');
  check('Real provider continues old v1 history without receiving expected marker in new prompt', () => { assert.equal(result.projection.turns.at(-1).status, 'completed', JSON.stringify(result.projection.turns.at(-1))); const answer = messages().filter(row => row.role === 'assistant').at(-1).content.replace(/\s/g, ''); assert(answer.includes(marker)); assert(answer.includes('37')); });
  check('Upgrade appends managed v2 identity and provable first host-run taint; existing bytes remain intact', () => {
    assert(raw().startsWith(original));
    const native = entries(), taint = native.find(row => row.type === 'custom' && row.customType === 'xiaozhi.skills.taint.v1');
    const firstRun = native.find(row => row.type === 'custom' && row.customType === 'xiaozhi.memory.run.v1');
    assert.equal(taint.data.safeLeaf, firstRun.parentId); assert.equal(taint.data.runId, firstRun.data.runId);
    assert(native.some(row => row.type === 'custom' && row.customType === 'xiaozhi.education.skills.v2'));
    assert.equal(query(db => db.prepare('SELECT schema_version FROM xiaozhi_pi_session_bindings WHERE conversation_id=?').get(session).schema_version), 4);
    assert(!native.some(row => row.type === 'custom' && row.customType === 'xiaozhi.skills.isolation.v1'));
  });
  check('Public catalog excludes paths and secrets while native current branch retains original facts', () => { assert(!JSON.stringify(result.skills).includes(data)); assert(!JSON.stringify(result).includes(key)); assert(JSON.stringify(SessionManager.open(file).buildSessionContext().messages).includes(marker)); });
  const prefix = raw(); await app.close(); app = undefined; await launch(); const restored = await snap();
  check('Actual restart retains upgraded authority and public history without duplicate messages', () => { assert.equal(raw(), prefix); assert.equal(restored.projection.turns.length, previous.projection.turns.length + 1); assert.equal(restored.skills.length, 4); });
  const resumed = await send('继续用一行确认此前核验代号与课时分钟数；不调用工具。');
  check('Upgraded native session survives another real provider continuation and shared run is recorded once', () => { assert.equal(resumed.projection.turns.at(-1).status, 'completed'); assert(messages().filter(row => row.role === 'assistant').at(-1).content.includes(marker)); const ids = entries().filter(row => row.type === 'custom' && row.customType === 'xiaozhi.memory.run.v1').map(row => row.data.runId); assert.equal(new Set(ids).size, ids.length); assert(raw().startsWith(prefix)); });
  check('Original named test fixture and every original source file remain byte-for-byte unchanged', () => assert.deepEqual(sourceHashes(), originalHashes));
  report.success = true;
} catch (error) { report.error = String(error.stack || error).replaceAll(key, '[credential]').slice(0, 2600); process.exitCode = 1; if (page) await page.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {}); }
finally { await app?.close().catch(() => {}); fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify({ success: report.success, checks: checks.length, error: report.error, report: path.relative(desktop, path.join(output, 'report.json')) })); }
