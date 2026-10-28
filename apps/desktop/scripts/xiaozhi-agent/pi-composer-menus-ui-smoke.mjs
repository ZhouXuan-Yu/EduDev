import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { _electron as electron } from 'playwright';

const desktop = process.cwd();
const output = fs.mkdtempSync(path.resolve('test-results/xiaozhi-agent/pi-composer-menus-ui-'));
// Production rejects private developer roots; the declared synthetic teacher
// workspace and Pi state must live outside the global .codex directory.
const runtimeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'edu-composer-menus-'));
const data = path.join(runtimeRoot, 'data');
const profile = path.join(runtimeRoot, 'profile');
const workspace = path.join(runtimeRoot, 'workspace');
fs.mkdirSync(workspace, { recursive: true });
fs.writeFileSync(path.join(workspace, '备课.md'), '# 备课');
const report = { success: false, checks: [], output, runtimeRoot };
const errors = [];
let app, page;

const check = (name) => { report.checks.push({ name, pass: true }); console.log(`PASS ${name}`); };
const until = async (fn, timeout = 30000) => {
  const end = Date.now() + timeout;
  while (Date.now() < end) { if (await fn()) return; await new Promise(resolve => setTimeout(resolve, 100)); }
  throw new Error('Composer menu condition timed out');
};
async function launch() {
  const env = {
    ...process.env,
    OMNI_EDU_DATA_ROOT: data,
    OMNI_EDU_REPO_ROOT: path.resolve(desktop, '../..'),
    OMNI_EDU_XIAOZHI_PI: '1',
    OMNI_EDU_E2E_DIALOG_MODE: '1',
    OMNI_EDU_E2E_VISIBLE: '1',
  };
  delete env.ELECTRON_RUN_AS_NODE;
  delete env.NODE_OPTIONS;
  delete env.DEEPSEEK_API_KEY;
  app = await electron.launch({ args: [path.join(desktop, 'out/main/index.js'), `--user-data-dir=${profile}`], env, timeout: 60000 });
  page = await app.firstWindow();
  page.on('pageerror', error => errors.push(String(error)));
  await page.getByTestId('xiaozhi-pi-workspace').waitFor({ state: 'visible', timeout: 60000 });
  await page.waitForFunction(() => !document.querySelector('[data-testid="office-prompt-input"]')?.disabled);
}
async function command(id) {
  await page.getByTestId('pi-command-picker').click();
  await page.waitForTimeout(120);
  await page.getByTestId(`pi-command-${id}`).click();
  await page.waitForTimeout(300);
}
try {
  await launch();

  const border = await page.locator('[data-testid="office-composer"] [data-slot="prompt-input-shell"]').evaluate((el) => {
    const s = getComputedStyle(el);
    return { style: s.borderStyle, width: parseFloat(s.borderWidth) };
  });
  assert.equal(border.style, 'solid');
  assert(border.width > 0);
  assert.equal(await page.locator('.office-composer-container').getByTestId('pi-goal-open').count(), 0);
  check('Composer has a visible solid border and no persistent goal button above the input');

  await page.getByTestId('pi-permission-picker').click();
  await page.waitForTimeout(150);
  const permissionText = await page.locator('.pi-permission-menu').innerText();
  for (const text of ['请求批准', '接受编辑', '替我批准', '完全访问', '在设置未允许的编辑和命令前询问', '编辑或运行命令前从不询问']) assert(permissionText.includes(text), text);
  await page.getByTestId('pi-permission-acceptEdits').click();
  await until(async () => (await page.getByTestId('pi-permission-picker').innerText()).includes('接受编辑'));
  assert.equal(await page.evaluate(() => localStorage.getItem('xiaozhi.permissionMode.v1')), 'acceptEdits');
  check('Permission menu exposes all four teacher-readable modes and stores the selected label');

  const sessionForWorkspace = await page.locator('.office-composer-container').getAttribute('data-session-id');
  await app.evaluate(({ dialog }, directory) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [directory] });
  }, workspace);
  await page.getByTestId('pi-permission-picker').click();
  await page.getByRole('menuitem', { name: '选择教学工作目录', exact: true }).click();
  await until(async () => Boolean((await page.evaluate(id => window.omniEdu.getXiaozhiSnapshot(id), sessionForWorkspace)).workspace));
  check('Permission menu preserves the native working-directory chooser and grants the selected folder');

  await page.getByTestId('pi-command-picker').click();
  await page.waitForTimeout(150);
  const commandText = await page.locator('.pi-command-menu').innerText();
  for (const text of ['/clear', '/goal', '/compact', '/permissions', '/skills', '清除对话上下文', '设置并跟踪一个教学目标']) assert(commandText.includes(text), text);
  check('Command menu exposes common slash commands with descriptions');

  await page.keyboard.press('Escape');
  await command('goal');
  assert(await page.getByTestId('pi-goal-dialog').isVisible());
  await page.getByTestId('pi-goal-dialog').getByRole('button', { name: '取消' }).click();
  await page.waitForTimeout(250);
  check('/goal opens the real persistent goal dialog');

  await command('skills');
  assert(await page.getByTestId('pi-skills-settings').isVisible());
  await page.getByTestId('pi-skills-close').click();
  await page.waitForTimeout(200);
  check('/skills opens the real skill settings surface');

  const firstSession = await page.locator('.office-composer-container').getAttribute('data-session-id');
  await command('clear');
  await until(async () => await page.locator('.office-composer-container').getAttribute('data-session-id') !== firstSession);
  assert(await page.getByTestId('office-prompt-input').isVisible());
  check('/clear starts a new conversation without removing the previous session');

  await page.getByTestId('pi-command-picker').click();
  await page.waitForTimeout(150);
  await page.getByTestId('pi-command-permissions').click();
  await page.waitForTimeout(400);
  assert(await page.getByText('工作目录与权限', { exact: true }).first().isVisible());
  check('/permissions reaches the real workspace and permission settings');

  assert.deepEqual(errors, []);
  report.success = true;
} catch (error) {
  report.error = String(error.stack || error);
  report.lastAlerts = await page?.getByRole('alert').allTextContents().catch(()=>[]);
  report.lastSession = await page?.locator('.office-composer-container').getAttribute('data-session-id').catch(()=>undefined);
  process.exitCode = 1;
  await page?.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {});
} finally {
  await app?.close().catch(() => {});
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ success: report.success, checks: report.checks.length, error: report.error, output }, null, 2));
}
