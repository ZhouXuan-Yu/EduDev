import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { _electron as electron } from 'playwright';
import { fingerprint } from './acceptance/evidence.mjs';
import { assertIsolatedPiMain } from './acceptance/build-root.mjs';
import { settleWorkspaceTransitions } from './xiaozhi-agent/capture-workspace-metrics.mjs';

const desktop = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = fs.mkdtempSync(path.join(desktop, 'test-results/daily-entry-'));
const main = path.join(desktop, 'out/main/index.js');
const profile = path.join(output, 'profile');
const env = { ...process.env, NODE_ENV: 'development', ELECTRON_RENDERER_URL: 'http://127.0.0.1:9/stale-renderer',
  OMNI_EDU_E2E_DIALOG_MODE: '1', OMNI_EDU_XIAOZHI_PI: '0', OMNI_EDU_E2E_LEGACY_RUNTIME: '1',
  OMNI_EDU_DATA_ROOT: path.join(output, 'data'), OMNI_EDU_REPO_ROOT: path.resolve(desktop, '../..') };
delete env.ELECTRON_RUN_AS_NODE; delete env.NODE_OPTIONS;
const report = { success: false, checks: [], rendererErrors: [], build: fingerprint(path.join(desktop, 'out')).sha256, launches: [], screenshots: [], dailyDataTouched: false, uiGeneration: 'product-five-spaces-v1', reference: 'codex-clipboard-1cd19f53-5c46-40ef-99d6-7391de621202.png', modelRequests: 0 };
let app, page;
const check = name => { report.checks.push({ name, pass: true }); console.log('PASS ' + name); };
function studentFacts() {
  const db = new DatabaseSync(path.join(output, 'data/app.db'), { readOnly: true });
  try { return { students: db.prepare('SELECT id,display_name,grade FROM students ORDER BY id').all(), records: db.prepare('SELECT id,student_id,title,content FROM learning_records ORDER BY id').all() }; }
  finally { db.close(); }
}
async function studentLayout() {
  await page.getByRole('region', { name: '学生目录', exact: true }).waitFor();
  await page.getByTestId('student-profile-readback').getByText('新版入口验收学生', { exact: true }).waitFor();
  assert.equal(await page.getByTestId('student-profile-readback').locator('article.profile-block').count(), 4);
  for (const label of ['当前问题', '阶段目标', '家长关注点']) await page.getByTestId('student-profile-readback').getByRole('heading', { name: label, exact: true }).waitFor();
  await page.getByTestId('student-lifecycle-actions').waitFor();
  await page.getByRole('heading', { name: '证据时间线', exact: true }).waitFor();
  await page.getByText('新版时间线真实记录', { exact: true }).waitFor();
  assert.equal(await page.locator('.app-shell').count(), 0);
}
async function launch() {
  app = await electron.launch({ args: [main, '--user-data-dir=' + profile], cwd: desktop, env, timeout: 60000 });
  report.launches.push(await assertIsolatedPiMain(app, main, profile));
  page = await app.firstWindow(); page.on('pageerror', error => report.rendererErrors.push(String(error)));
  await page.getByTestId('xiaozhi-pi-workspace').waitFor({ timeout: 60000 });
}
try {
  await launch();
  assert.equal(await app.evaluate(({BrowserWindow}) => BrowserWindow.getAllWindows()[0].isVisible()), false);
  check('Owned acceptance window stays in the background and cannot be confused with the daily product');
  assert.equal(page.url(), new URL('file:///' + path.join(desktop, 'out/renderer/index.html').replaceAll('\\', '/')).href);
  assert.equal(await page.evaluate(() => window.omniEdu.isXiaozhiEnabled()), true);
  assert.equal(await page.locator('.app-shell').count(), 0);
  assert(!fs.existsSync(path.join(desktop, 'dist')));
  check('Daily out loads its own current file renderer despite inherited development URL and legacy flags');
  const rail = () => page.locator('[data-testid=product-rail]:visible');
  const labels = ['问小智', '我的资料', '教学内容', '学生', '设置'];
  assert.deepEqual(await rail().locator('button').evaluateAll(items => items.map(x => x.getAttribute('aria-label'))), labels);
  for (const [space, target] of [['materials','materials-workspace'], ['teaching','teaching-artifacts-workspace'], ['students','student-workspace'], ['settings','pi-settings-workspace']]) {
    await rail().getByTestId('product-nav-' + space).click();
    if (space === 'students') await page.getByTestId('product-space-workspace').waitFor();
    else await page.getByTestId(target).waitFor();
  }
  await rail().getByTestId('product-nav-ask').click();
  await page.getByTestId('xiaozhi-pi-workspace').waitFor();
  check('Actual five teacher spaces return to the same sole Pi workspace; no old production shell');
  await rail().getByTestId('product-nav-students').click();
  await page.getByTestId('student-lifecycle-no-student').waitFor();
  assert.deepEqual(studentFacts(), { students: [], records: [] });
  await page.getByTestId('student-create').click();
  await page.getByTestId('student-form-display-name').fill('新版入口验收学生');
  await page.getByTestId('student-form-grade').fill('初二');
  const form = page.getByTestId('student-profile-form');
  await form.getByLabel('科目', { exact: true }).fill('数学、英语');
  await form.getByLabel('当前问题', { exact: true }).fill('函数图像需要结合真实记录核对。');
  await form.getByLabel('阶段目标', { exact: true }).fill('按课堂证据整理两周学习目标。');
  await form.getByLabel('家长关注点', { exact: true }).fill('每周提供已确认进步反馈。');
  await page.getByTestId('student-form-save').click();
  await page.getByTestId('student-lifecycle-feedback-success').waitFor();
  await page.getByRole('button', { name: '添加学习记录', exact: true }).click();
  await page.getByTestId('record-form-subject').fill('数学');
  await page.getByTestId('record-form-title').fill('新版时间线真实记录');
  await page.getByTestId('record-form-content').fill('教师通过界面保存的课堂事实；不自动作为掌握度结论。');
  await page.getByTestId('record-form-save').click();
  await page.waitForFunction(() => !document.querySelector('[data-testid=record-form-title]')?.value);
  await page.getByRole('button', { name: '学生档案', exact: true }).click();
  await studentLayout();
  const before = studentFacts();
  assert.equal(before.students.length, 1); assert.equal(before.records.length, 1);
  assert.equal(before.records[0].student_id, before.students[0].id);
  assert.equal(before.records[0].title, '新版时间线真实记录');
  report.studentReadback = before;
  check('User-confirmed new student layout renders four profile cards and the actual teacher-saved timeline without seeds');
  for (const theme of ['light', 'dark']) for (const [width,height] of [[1366,768],[1920,1080]]) {
    await page.emulateMedia({colorScheme:theme});
    await app.evaluate(({BrowserWindow},size) => BrowserWindow.getAllWindows()[0].setContentSize(size.width,size.height), {width,height});
    await page.waitForFunction(size => innerWidth===size.width && innerHeight===size.height, {width,height});
    await settleWorkspaceTransitions(page);
    await page.getByTestId('product-space-content').evaluate(el => { for (let p=el;p;p=p.parentElement) p.scrollTop=0; });
    await page.evaluate(() => document.activeElement?.blur());
    const geometry = await page.evaluate(() => ({ width:innerWidth, scrollWidth:document.documentElement.scrollWidth, titlebarTop:document.querySelector('[data-testid=desktop-titlebar]').getBoundingClientRect().top }));
    assert(geometry.scrollWidth<=width); assert.equal(geometry.titlebarTop,0);
    const png = `current-students-${theme}-${width}x${height}.png`;
    await page.screenshot({path:path.join(output,png),animations:'disabled'}); report.screenshots.push(png);
  }
  check('New student page fits both target sizes and themes with the current category sidebar and timeline');
  await rail().getByTestId('product-nav-ask').click();
  await page.getByTestId('xiaozhi-pi-workspace').waitFor();
  const session = await page.locator('.office-composer-container').getAttribute('data-session-id');
  const duplicate = spawn(path.join(desktop, 'node_modules/electron/dist/electron.exe'), [main, '--user-data-dir=' + profile], { cwd: desktop, env, stdio: 'ignore', windowsHide: true });
  const code = await new Promise((resolve, reject) => { const timer = setTimeout(() => { duplicate.kill(); reject(new Error('Duplicate launch did not exit')); }, 20000); duplicate.once('error', reject); duplicate.once('exit', code => { clearTimeout(timer); resolve(code); }); });
  assert.equal(code, 0); assert.equal((await app.windows()).length, 1);
  assert.equal(await page.locator('.office-composer-container').getAttribute('data-session-id'), session);
  check('Second actual Electron launch of the same profile exits and preserves one existing current window/session');
  for (const [theme,width,height] of [['light',1366,768],['dark',1920,1080]]) {
    await page.emulateMedia({colorScheme:theme});
    await app.evaluate(({BrowserWindow},size) => BrowserWindow.getAllWindows()[0].setContentSize(size.width,size.height),{width,height});
    await page.waitForFunction(size => innerWidth===size.width && innerHeight===size.height,{width,height});
    await settleWorkspaceTransitions(page);
    const png = `current-${theme}-${width}x${height}.png`; await page.screenshot({path:path.join(output,png)}); report.screenshots.push(png);
  }
  await app.close(); app = undefined; await launch();
  assert.equal(await page.locator('.office-composer-container').getAttribute('data-session-id'), session);
  assert(page.url().startsWith('file:') && page.url().includes('/out/renderer/index.html'));
  check('Cold restart uses the same default build and restores the same owned local session');
  await rail().getByTestId('product-nav-students').click(); await studentLayout();
  assert.deepEqual(studentFacts(), before);
  check('Cold restart preserves the exact student and learning facts in the new page');
  assert.deepEqual(report.rendererErrors, []);
  report.success = true;
} catch (error) { report.error = String(error.stack || error); process.exitCode = 1; }
finally { if (app) await app.close(); fs.writeFileSync(path.join(output,'report.json'), JSON.stringify(report,null,2)); console.log(JSON.stringify({success:report.success,checks:report.checks.length,error:report.error,report:path.relative(desktop,path.join(output,'report.json'))})); }
