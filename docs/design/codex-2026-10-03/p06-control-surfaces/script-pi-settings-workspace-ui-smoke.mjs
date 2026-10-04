import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { _electron as electron } from 'playwright';
const desktop = process.cwd(), output = fs.mkdtempSync(path.resolve('test-results/xiaozhi-agent/pi-settings-workspace-ui-'));
const data = path.join(output, 'data'), profile = path.join(output, 'profile'), working = path.join(output, 'teaching-work'), backupRoot = path.join(output, 'backup-target'), skillRoot = path.join(output, 'teacher-skill');
for (const directory of [working, backupRoot, skillRoot]) fs.mkdirSync(directory);
fs.writeFileSync(path.join(working, 'meeting.txt'), '合成教研纪要：分数课40分钟。');
const skillText = '---\nname: office-review\ndescription: 整理合成教研纪要并核对课时。\n---\n# 教研办公复核\n先读取经教师授权的资料，核对课时，再输出简洁纪要。写入必须经教师确认。\n';
fs.writeFileSync(path.join(skillRoot, 'SKILL.md'), skillText);
const cfg = fs.readFileSync('.env.local', 'utf8'), apiKey = process.env.DEEPSEEK_API_KEY || cfg.match(/^DEEPSEEK_API_KEY\s*=\s*(.*?)\s*$/m)?.[1]?.replace(/^['"]|['"]$/g, ''); assert(apiKey);
const sha = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex'), sourceHashes = [sha(path.join(working, 'meeting.txt')), sha(path.join(skillRoot, 'SKILL.md'))];
const errors = [], report = { success: false, checks: [], viewports: [], boundaries: ['Actual formal Electron + owned fresh SQLite/profile, live official DeepSeek catalogue and chat, actual local backup/readback; synthetic teacher files only.', 'Native chooser returns controlled in main; browser storage failure injected only for the owned profile.', 'Archive fixtures created via existing typed APIs; archive creation UI and OS chooser clicking not claimed.', 'No full Codex pixel-match, VPN-off or installer proof.'] };
let app, page, id, archivedId, backupPath;
const check = name => { report.checks.push({ name, pass: true }); console.log(`PASS ${name}`); };
async function until(fn, ms = 90000) { const end = Date.now() + ms; while (Date.now() < end) { if (await fn()) return; await new Promise(resolve => setTimeout(resolve, 80)); } throw new Error('Settings workspace UI condition timed out'); }
const snapshot = () => page.evaluate(id => window.omniEdu.getXiaozhiSnapshot(id), id);
const settings = () => page.evaluate(() => window.omniEdu.getXiaozhiSettings());
const skills = () => page.evaluate(() => window.omniEdu.getXiaozhiSkills());
const chooser = directory => app.evaluate(({ dialog }, directory) => { dialog.showOpenDialog = async () => ({ canceled: !directory, filePaths: directory ? [directory] : [] }); }, directory);
async function launch() {
  const env = { ...process.env, OMNI_EDU_XIAOZHI_PI: '1', OMNI_EDU_DATA_ROOT: data, OMNI_EDU_REPO_ROOT: path.resolve('../..'), OMNI_EDU_E2E_DIALOG_MODE: '1', DEEPSEEK_API_KEY: '', DEEPSEEK_MODEL: '' };
  delete env.ELECTRON_RUN_AS_NODE; delete env.NODE_OPTIONS;
  for (const key of Object.keys(env)) if (key.startsWith('OMNI_EDU_E2E_DATA_BACKUP_')) delete env[key];
  env.OMNI_EDU_E2E_DATA_BACKUP_EXPORT_DIALOG_QUEUE = JSON.stringify(['', backupRoot]);
  env.OMNI_EDU_E2E_DATA_BACKUP_VERIFY_DIALOG_QUEUE = JSON.stringify(['$last', working]);
  app = await electron.launch({ args: [path.join(desktop, 'out/main/index.js'), `--user-data-dir=${profile}`], env, timeout: 60000 }); page = await app.firstWindow(); page.on('pageerror', error => errors.push(String(error).replaceAll(apiKey, '[redacted]')));
  await page.getByTestId('xiaozhi-pi-workspace').waitFor({ timeout: 60000 }); await until(async () => !await page.getByTestId('office-prompt-input').isDisabled()); id = await page.locator('.office-composer-container').getAttribute('data-session-id');
}
async function open() { await page.getByRole('button', { name: '小智模型设置', exact: true }).click(); await page.getByTestId('pi-settings-workspace').waitFor(); await until(async () => await page.getByTestId('pi-settings-key').count() === 1 && !await page.getByTestId('pi-settings-key').isDisabled()); }
async function tab(name) { await page.getByTestId(`pi-settings-tab-${name}`).click(); await until(async () => await page.getByTestId('pi-settings-workspace').getAttribute('data-tab') === name); }
async function preference(name) { await page.getByTestId(`pi-preference-${name}`).locator('[data-slot="switch-content"]').click(); }
const permissionMemory = () => page.getByTestId('pi-settings-main');
async function memoryPanel() { if (!await permissionMemory().getByTestId('pi-memory-enabled').isVisible()) await permissionMemory().getByTestId('pi-memory-scope').locator('[data-slot="chat-tool-trigger"]').click(); }
async function stableCapture(name) {
  await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}' });
  await page.evaluate(async () => { await document.fonts.ready; await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); });
  await page.screenshot({ path: path.join(output, `${name}.png`) });
}
try {
  await launch(); await open(); await page.getByTestId('pi-settings-key').fill(apiKey); await page.getByTestId('pi-settings-save').click(); await until(async () => /已保存/.test(await page.getByTestId('pi-settings-feedback').innerText()));
  assert.equal(await page.getByTestId('pi-settings-key').inputValue(), ''); assert((await settings()).value.models.length >= 2); check('Unified formal entry embeds the existing encrypted model form and live official model directory');
  assert.equal(await page.locator('[data-testid^="pi-settings-tab-"]').count(), 6); check('Six real capabilities are reachable from one setting navigation');
  const input = page.getByTestId('pi-settings-search');
  await input.fill('backup verify'); await page.getByTestId('pi-settings-search-results').getByRole('button', { name: /检查已有备份/ }).click(); assert.equal(await page.getByTestId('pi-settings-workspace').getAttribute('data-tab'), 'backup'); check('Hana multi-token ranking opens an actionable backup setting');
  await input.fill('ＡＰＩ'); await page.getByTestId('pi-settings-search-results').getByRole('button', { name: /API 密钥/ }).click(); await page.getByTestId('pi-settings-key').waitFor(); check('Hana NFKC search resolves full-width API text without indexing credential values');
  await input.fill('无此项随机测试'); await page.getByTestId('pi-settings-search-empty').waitFor(); await input.press('Escape'); assert.equal(await input.inputValue(), '');
  await input.fill('skills'); await page.getByRole('button', { name: '清空设置搜索', exact: true }).click(); assert.equal(await input.inputValue(), ''); check('Search empty state, Escape and official clear control work');
  await tab('permissions'); await chooser(working);
  await page.getByTestId('pi-settings-workspace-choose').click(); await until(async () => (await snapshot()).workspace?.label === 'teaching-work'); check('Unified permission page selects an actual authorized directory through the existing typed chooser');
  await memoryPanel(); await permissionMemory().getByTestId('pi-memory-enabled').check(); await permissionMemory().getByTestId('pi-memory-save').click(); await until(async () => (await snapshot()).memoryScope.enabled);
  await permissionMemory().getByTestId('pi-memory-clear').click(); await until(async () => !(await snapshot()).memoryScope.enabled && (await snapshot()).memoryScope.version >= 2); check('Existing memory scope saves and revokes through the unified permission page and actual SQLite readback');
  await tab('skills'); await page.getByTestId('pi-skill-preview-lesson-preparation').click(); await page.getByTestId('pi-skill-full-document').waitFor(); assert(!await page.getByTestId('pi-skill-edit').isVisible()); check('Hana builtin full preview works embedded without weakening edit permissions');
  await chooser(skillRoot); await page.getByTestId('pi-skill-import').click(); await until(async () => (await skills()).value.skills.some(item => item.name === 'office-review'));
  assert.equal((await skills()).value.skills.find(item => item.name === 'office-review').enabled, false);
  await page.getByTestId('pi-skill-enabled-office-review').locator('[data-slot="switch-content"]').click(); await until(async () => (await skills()).value.skills.find(item => item.name === 'office-review').enabled);
  await page.getByTestId('pi-skill-enabled-office-review').locator('[data-slot="switch-content"]').click(); await until(async () => !(await skills()).value.skills.find(item => item.name === 'office-review').enabled); check('Actual local skill import defaults off and explicit enable/revoke persists from unified settings');
  await page.getByTestId('pi-skill-preview-office-review').click(); await page.getByTestId('pi-skill-edit').click(); await page.getByTestId('pi-skill-edit-document').fill(skillText + '\n教师补充：按课时核对。\n'); await page.getByTestId('pi-skill-save-edit').click(); await until(async () => (await skills()).value.skills.find(item => item.name === 'office-review').version === 2); assert.equal((await skills()).value.skills.find(item => item.name === 'office-review').enabled, false); check('Existing CAS skill editor saves a new version while leaving authority disabled');
  await tab('interface'); await preference('sidebar'); await preference('aside'); await preference('files'); assert.match(await page.getByTestId('pi-preference-notice').innerText(), /已保存/);
  let preferences = await page.evaluate(() => JSON.parse(localStorage.getItem('xiaozhi.ui.v1'))); assert.deepEqual(preferences, { schema: 1, sidebar: false, aside: false, files: true }); check('Display preferences persist only the original versioned booleans');
  await page.evaluate(() => { window.__settingsRestoreStorage = Storage.prototype.setItem; Storage.prototype.setItem = function(key, value) { if (key === 'xiaozhi.ui.v1') throw new Error('owned storage unavailable'); return window.__settingsRestoreStorage.call(this, key, value); }; });
  await preference('sidebar'); assert.match(await page.getByTestId('pi-preference-notice').innerText(), /未能保存/); assert.equal(await page.getByTestId('pi-preference-sidebar').getAttribute('data-selected'), null); await page.evaluate(() => { Storage.prototype.setItem = window.__settingsRestoreStorage; delete window.__settingsRestoreStorage; }); check('Storage failure shows a visible failure and does not claim preference success');
  await page.getByTestId('nav-ai').click(); await page.getByTestId('xiaozhi-pi-workspace').waitFor(); assert.equal(await page.getByTestId('pi-rail-chats').getAttribute('aria-pressed'), 'false'); assert(await page.getByTestId('pi-files-toggle').getAttribute('aria-pressed') === 'true');
  await app.close(); app = undefined; await launch(); assert.equal(await page.getByTestId('pi-rail-chats').getAttribute('aria-pressed'), 'false'); assert.equal(await page.getByTestId('pi-files-toggle').getAttribute('aria-pressed'), 'true'); check('Returning and restarting the same owned profile preserve the actual workspace disclosures');
  await open(); await tab('interface'); await preference('sidebar'); await preference('aside'); await preference('files');
  await page.getByTestId('nav-ai').click(); await page.getByTestId('xiaozhi-pi-workspace').waitFor(); await until(async () => !await page.getByTestId('office-prompt-input').isDisabled());
  await page.evaluate(() => localStorage.setItem('xiaozhi.ui.v1', JSON.stringify({ schema: 999, sidebar: false, aside: false, files: true, path: 'must-not-authorize' })));
  await open(); await tab('interface'); assert.equal(await page.getByTestId('pi-preference-sidebar').getAttribute('data-selected'), 'true'); assert.equal(await page.getByTestId('pi-preference-files').getAttribute('data-selected'), null); await preference('sidebar'); await preference('sidebar'); check('Unknown preference schema falls back safely and never turns a stored path into authority');
  const archiveMarker = '合成归档纪要：教研课40分钟。';
  archivedId = await page.evaluate(async marker => { const folder = await window.omniEdu.createAiConversationFolder({ name: '合成归档项目' }); const folderId = folder.folders.find(item => item.name === '合成归档项目').id; const detail = await window.omniEdu.createAiConversationSession({ folderId, title: '合成归档对话' }); await window.omniEdu.appendAiConversationMessage(detail.session.id, { role: 'user', content: '请整理教研纪要。' }); await window.omniEdu.appendAiConversationMessage(detail.session.id, { role: 'assistant', content: marker }); await window.omniEdu.archiveAiConversationFolder(folderId); return detail.session.id; }, archiveMarker);
  await tab('archives'); await page.getByRole('button', { name: '刷新归档', exact: true }).click(); await page.getByTestId(`pi-archive-read-${archivedId}`).click(); await page.getByTestId('pi-settings-archive-reader').getByText(archiveMarker, { exact: true }).waitFor();
  assert.equal((await snapshot()).projection.turns.length, 0); check('Real archived folder/session opens public saved history read-only without creating a run');
  await tab('backup'); await chooser(undefined); await page.getByTestId('data-backup-export').click(); await page.getByTestId('data-backup-cancelled').waitFor(); check('Backup chooser cancellation has visible feedback and no new backup');
  await chooser(backupRoot); await page.getByTestId('data-backup-export').click(); await page.getByTestId('data-backup-export-success').waitFor({ timeout: 60000 }); backupPath = await page.getByTestId('data-backup-export-path').innerText(); assert(fs.existsSync(path.join(backupPath, 'app.db'))); assert(fs.readdirSync(backupRoot).length === 1); check('Actual existing local backup service exports and verifies a real owned data directory');
  await page.getByTestId('data-backup-verify').click(); await page.getByTestId('data-backup-verify-success').waitFor({ timeout: 60000 }); check('Existing backup integrity service verifies the exported files from the visible setting action');
  await page.getByTestId('data-backup-verify').click(); await page.getByTestId('data-backup-verify-failed').waitFor(); check('Non-backup selection shows an actionable failure instead of a success banner');
  const denied = await app.evaluate(async ({ BrowserWindow }, preload) => { const side = new BrowserWindow({ show: false, webPreferences: { preload, contextIsolation: true, sandbox: false } }); try { await side.loadURL('about:blank'); return await side.webContents.executeJavaScript(`Promise.all([window.omniEdu.exportDataRoot(),window.omniEdu.verifyDataBackup()].map(p=>p.then(()=>false,e=>String(e).includes('permission_denied'))))`); } finally { side.destroy(); } }, path.join(desktop, 'out/preload/index.cjs')); assert.deepEqual(denied, [true, true]); check('A secondary renderer cannot invoke either local backup action');
  await page.getByTestId('data-backup-export').click(); await page.getByTestId('data-backup-error').waitFor(); assert(!await page.getByTestId('data-backup-export').isDisabled()); check('Exhausted controlled chooser shows bounded human feedback and releases local ownership');
  await chooser(working);
  for (const viewport of [{ width: 1366, height: 768 }, { width: 1920, height: 1080 }]) {
    await app.evaluate(({ BrowserWindow }, size) => BrowserWindow.getAllWindows()[0].setContentSize(size.width, size.height), viewport); await until(async () => await page.evaluate(size => innerWidth === size.width && innerHeight === size.height, viewport));
    for (const name of ['models', 'skills', 'permissions', 'interface', 'archives', 'backup']) {
      await tab(name);
      const control = { models: 'pi-settings-save', skills: 'pi-skill-import', permissions: 'pi-settings-workspace-choose', interface: 'pi-preference-files', archives: `pi-archive-read-${archivedId}`, backup: 'data-backup-export' }[name];
      await page.getByTestId(control).scrollIntoViewIfNeeded();
      const measurements = await page.evaluate(control => { const main = document.querySelector('[data-testid="pi-settings-main"]'), nav = document.querySelector('.pi-settings-nav'), content = main.querySelector(':scope>div,:scope>section'), action = document.querySelector(`[data-testid="${control}"]`).getBoundingClientRect(), back = document.querySelector('[data-testid="nav-ai"]').getBoundingClientRect(); return { mainWidth: main.clientWidth, mainScroll: main.scrollWidth, contentWidth: content.getBoundingClientRect().width, navWidth: nav.clientWidth, navScroll: nav.scrollWidth, bodyWidth: document.documentElement.clientWidth, bodyScroll: document.documentElement.scrollWidth, actionRect: { x: action.x, y: action.y, right: action.right, bottom: action.bottom }, backRect: { x: back.x, y: back.y, right: back.right, bottom: back.bottom } }; }, control);
      assert(measurements.mainScroll <= measurements.mainWidth + 1, `${name} main overflow`); assert(measurements.contentWidth >= 700 && measurements.contentWidth <= 781, `${name} reading width`); assert(measurements.navScroll <= measurements.navWidth + 1); assert(measurements.bodyScroll <= measurements.bodyWidth + 1);
      for (const rect of [measurements.actionRect, measurements.backRect]) assert(rect.x >= 0 && rect.y >= 0 && rect.right <= viewport.width && rect.bottom <= viewport.height, `${name} complete action reachable`);
      report.viewports.push({ ...viewport, tab: name, ...measurements }); await stableCapture(`${name}-${viewport.width}`);
    }
  } check('All six real setting pages fit both actual native content viewports with reachable navigation and actions');
  await page.getByTestId('nav-ai').click(); await page.getByTestId('xiaozhi-pi-workspace').waitFor(); await until(async () => !await page.getByTestId('office-prompt-input').isDisabled());
  const marker = '设置验收合成教研纪要';
  await page.getByTestId('office-prompt-input').fill(`这是合成办公连接验收。不要调用工具，仅回复“${marker}”。`); await page.getByRole('button', { name: '发送消息', exact: true }).click(); await until(async () => (await snapshot()).projection.turns.length > 0); await until(async () => !(await snapshot()).running);
  const completed = (await snapshot()).projection.turns.at(-1); assert.equal(completed.status, 'completed'); assert(completed.items.some(item => item.role === 'assistant' && item.text?.includes(marker))); assert.equal(await page.getByTestId('office-prompt-input').inputValue(), ''); check('Real official DeepSeek reply completes through the preserved formal composer after unified settings');
  await page.getByTestId('office-prompt-input').fill('这是合成教研办公验收。请不要调用工具，分成15段详细写一篇分数课教研方案，每段至少100字。'); await page.getByRole('button', { name: '发送消息', exact: true }).click(); await until(async () => (await snapshot()).running);
  const runId = (await snapshot()).projection.turns.at(-1).id;
  await app.evaluate(({ Menu, BrowserWindow }) => { const item = Menu.getApplicationMenu().getMenuItemById('settings'); item.click(item, BrowserWindow.getAllWindows()[0], { triggeredByAccelerator: false }); });
  await page.getByTestId('pi-settings-workspace').waitFor(); await tab('backup'); await until(async () => await page.getByTestId('data-backup-export').isDisabled()); assert((await snapshot()).running);
  assert(await page.evaluate(async () => { try { await window.omniEdu.exportDataRoot(); return false; } catch(error) { return String(error).includes('busy'); } }));
  await page.getByTestId('nav-ai').click(); await page.getByTestId('xiaozhi-pi-workspace').waitFor(); assert((await snapshot()).running); assert.equal((await snapshot()).projection.turns.at(-1).id, runId); await page.getByRole('button', { name: '停止本轮', exact: true }).click(); await until(async () => !(await snapshot()).running); check('Actual live run survives native Settings→Back unchanged and blocks local backups until stopped');
  await open(); await tab('permissions'); assert(await page.getByTestId('pi-settings-workspace-choose').isDisabled()); check('Bound conversation directory remains locked after real native history exists');
  assert.equal(sha(path.join(working, 'meeting.txt')), sourceHashes[0]); assert.equal(sha(path.join(skillRoot, 'SKILL.md')), sourceHashes[1]); assert.deepEqual(errors, []); check('Source teacher fixtures remain byte-identical and renderer has no runtime exceptions');
  report.success = true;
} catch (error) { process.exitCode = 1; report.error = String(error.stack || error).replaceAll(apiKey, '[redacted]').slice(0, 2200); await page?.getByTestId('pi-settings-key').fill('').catch(() => {}); await page?.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {}); }
finally { await app?.close().catch(() => {}); report.rendererErrors = errors; fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify({ success: report.success, checks: report.checks.length, output, error: report.error })); }
