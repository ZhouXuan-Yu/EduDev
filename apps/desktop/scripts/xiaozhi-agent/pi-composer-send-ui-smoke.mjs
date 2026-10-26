import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { _electron as electron } from 'playwright';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const config = fs.readFileSync(path.join(appRoot, '.env.local'), 'utf8');
const pick = name => config.match(new RegExp(`^${name}\\s*=\\s*(.*?)\\s*$`, 'm'))?.[1]?.replace(/^['"]|['"]$/g, '');
const key = process.env.DEEPSEEK_API_KEY || pick('DEEPSEEK_API_KEY');
const model = process.env.DEEPSEEK_MODEL || pick('DEEPSEEK_MODEL') || 'deepseek-flash';
assert(key, 'Local test credential required');
const output = fs.mkdtempSync(path.join(appRoot, 'test-results/xiaozhi-agent/pi-composer-send-'));
const dataRoot = path.join(output, 'data');
const report = { suite: 'pi-composer-send-ui', success: false, checks: [], model,
  boundaries: ['Real formal Electron composer, real DeepSeek, synthetic two-turn prompt', 'No attachment/provider-network fault injection in this suite'] };
let application, page;
const until = async (fn, timeout = 120000) => { const end = Date.now() + timeout; while (Date.now() < end) { if (await fn()) return; await new Promise(resolve => setTimeout(resolve, 100)); } throw new Error('Composer send condition timed out'); };
const check = name => { report.checks.push({ name, pass: true }); console.log(`PASS ${name}`); };
const input = () => page.getByTestId('office-prompt-input');
const send = () => page.getByRole('button', { name: '发送消息', exact: true });
const id = () => page.locator('.office-composer-container').getAttribute('data-session-id');
const snapshot = async session => page.evaluate(value => window.omniEdu.getXiaozhiSnapshot(value), session || await id());
async function launch() {
  const env = { ...process.env, OMNI_EDU_DATA_ROOT: dataRoot, OMNI_EDU_REPO_ROOT: path.resolve(appRoot, '../..'),
    OMNI_EDU_XIAOZHI_PI: '1', OMNI_EDU_E2E_DIALOG_MODE: '1', OMNI_EDU_E2E_VISIBLE: '1',
    DEEPSEEK_API_KEY: key, DEEPSEEK_MODEL: model };
  delete env.ELECTRON_RUN_AS_NODE; delete env.NODE_OPTIONS;
  application = await electron.launch({ args: [path.join(appRoot, 'out/main/index.js'), `--user-data-dir=${path.join(output, 'profile')}`], env, timeout: 60000 });
  page = await application.firstWindow();
  await page.getByTestId('xiaozhi-pi-workspace').waitFor({ state: 'visible', timeout: 60000 });
  await page.waitForFunction(() => !document.querySelector('[data-testid="office-prompt-input"]')?.disabled);
}
async function sendAndWait(text) {
  const session = await id();
  const before = (await snapshot(session)).projection.turns.length;
  await input().fill(text);
  assert(!await send().isDisabled());
  await input().press('Enter');
  await until(async () => await input().inputValue() === '');
  await until(async () => (await snapshot(session)).projection.turns.length > before);
  assert.equal(await input().inputValue(), '');
  await until(async () => !(await snapshot(session)).running);
  const turn = (await snapshot(session)).projection.turns.at(-1);
  const assistant = turn.items.filter(item => item.role === 'assistant' && item.text?.trim()).map(item => item.text).join('\n');
  assert(assistant.trim().length > 0);
  return { session, turn, assistant };
}
try {
  await launch();
  assert(await send().isDisabled());
  check('Empty composer disables send before any provider request');
  const first = await sendAndWait('只回复两个字：收到');
  check('First real text send clears the draft and persists an assistant answer');
  const second = await sendAndWait('再回复两个字：继续');
  const snapshotAfter = await snapshot(first.session);
  assert.equal(snapshotAfter.projection.turns.length, 2);
  assert(snapshotAfter.projection.turns.every(turn => turn.status === 'completed' || turn.status === 'failed' || turn.status === 'interrupted'));
  check('Consecutive real text send creates a second turn in the same conversation');
  for (const [width, height] of [[1366, 768], [1920, 1080]]) {
    await application.evaluate(({ BrowserWindow }, size) => BrowserWindow.getAllWindows()[0].setContentSize(size.width, size.height), { width, height });
    await page.waitForFunction(size => innerWidth === size.width && innerHeight === size.height, { width, height });
    const box = await input().boundingBox(); const sendBox = await send().boundingBox();
    assert(box && box.y + box.height <= height && box.x >= 0);
    assert(sendBox && sendBox.y + sendBox.height <= height && sendBox.x + sendBox.width <= width);
    check(`Composer input and send remain reachable at ${width}x${height}`);
  }
  report.success = true;
} catch (error) {
  report.error = String(error.stack || error).replaceAll(key, '[credential]').slice(0, 3000);
  process.exitCode = 1;
  await page?.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {});
} finally {
  await application?.close().catch(() => {});
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ success: report.success, checks: report.checks.length, error: report.error, report: path.relative(appRoot, path.join(output, 'report.json')) }));
}
