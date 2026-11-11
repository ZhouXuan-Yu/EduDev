/** Real production Electron workbench acceptance. No build, preload mocks or model sends.
 * Run AFTER the owner freezes out (or OMNI_EDU_TEST_BUILD_ROOT):
 *   node apps/desktop/scripts/workbench-ui.mjs
 * Artifacts: apps/desktop/test-results/workbench-<unique>/report.json and PNGs.
 * The owned OS profile/data are retained for failure investigation; never uses user data.
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { _electron as electron } from 'playwright';
import { testMain, assertIsolatedPiMain } from './acceptance/build-root.mjs';
import { fingerprint } from './acceptance/evidence.mjs';

const desktop = path.resolve(import.meta.dirname, '..');
fs.mkdirSync(path.join(desktop, 'test-results'), { recursive: true });
const output = fs.mkdtempSync(path.join(desktop, 'test-results/workbench-'));
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'xiaozhi-workbench-'));
const profile = path.join(temp, 'electron-profile'), data = path.join(temp, 'data');
const osProfile = path.join(temp, 'os-profile'), workspace = path.join(temp, 'teaching-files');
for (const dir of [profile, data, workspace, osProfile, path.join(osProfile, 'AppData/Roaming'), path.join(osProfile, 'AppData/Local'), path.join(temp, 'tmp')]) fs.mkdirSync(dir, { recursive: true });
const token = path.basename(output);
const folderName = `专项空间-${token}`;
const titleA = `Workbench 分组标题 A ${token}`, titleB = `Workbench 未分组标题 B ${token}`;
const draftA = `会话A独立草稿 ${token}`, draftB = `会话B独立草稿 ${token}`;
const fileName = 'workbench-owned-preview.txt', fileText = `真实文件预览 ${token}\n等式两边同时加同一个数，等式仍成立。\n`;
const fixture = path.join(workspace, fileName);
const importName = `workbench-knowledge-${token}.txt`, importFile = path.join(temp, importName);
fs.writeFileSync(fixture, fileText);
fs.writeFileSync(importFile, `知识库专项导入 ${token}\n等式的性质：等式两边同时加上同一个数，等式仍成立。\n`);
const digest = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const reportFile = path.join(output, 'report.json');
const report = {
  success: false, layer: 'isolated_formal_ui', startedAt: new Date().toISOString(),
  command: 'node apps/desktop/scripts/workbench-ui.mjs', output, temp, profile, data,
  checks: [], failed: [], errors: [], notRun: [], screenshots: [], viewports: [], launches: [],
  fixtures: { fixture, importFile, previewSha256: digest(fixture), importSha256: digest(importFile) },
  modelTasksSubmitted: null, networkAttempts: [], dialogSelections: [],
};
let app, page, main, buildRoot, baseline, sessionA, sessionB, imported;
const observedPages = new WeakSet();
const shell = () => page.locator('.edu-shell:visible');
const nav = () => shell().getByTestId('edu-navigation');
const ui = id => shell().getByTestId(id);
const dialog = kind => page.getByTestId(`workbench-${kind}-dialog`).filter({ visible: true });
const recentSession = id => nav().locator(`.wb-conversations > [data-testid="workbench-session-${id}"]`);
const composer = () => ui('office-prompt-input');
const teaching = ['artifacts', 'notebook', 'book', 'question_notebook', 'paper'];
const students = ['students', 'search', 'intake', 'mistakes', 'mastery', 'review', 'analytics'];
const originalViews = ['ai', 'knowledge', ...teaching, ...students, 'settings'];
const planned = [
  'isolated formal production launch', 'first home and input-first layout 1366', 'first home and input-first layout 1920',
  'home tasks and suggestions prepare drafts only', 'simple main navigation and all original pages',
  'both hubs and all domain entries', 'history restores domain route and main navigation highlight', 'fixed settings footer and independent scroll',
  'real folder and titled sessions through forms and SQLite', 'title search empty results grouped results and click',
  'original history management retained', 'session drafts isolated and survive hub navigation',
  'sidebar collapse expand and keyboard focus', 'modal initial focus Tab trap Escape return focus',
  'right tasks files tabs keyboard close reopen', 'owned file native authorization and actual text preview',
  'real knowledge txt import and SQLite readback', '840 viewport controls reachable without overlap',
  'reduced motion', 'cold restart SQLite sessions folders and imported resource',
  'cold restart UI sessions titles folders drafts and knowledge import', 'zero model tasks and unchanged fixtures',
];
const attempted = new Set();
function writeReport() { fs.writeFileSync(reportFile, JSON.stringify(report, null, 2)); }
async function shot(name) {
  const file = path.join(output, `${name}.png`);
  await page.screenshot({ path: file });
  report.screenshots.push({ name, file, sha256: digest(file) });
}
async function test(name, action) {
  attempted.add(name);
  const start = Date.now();
  try {
    const evidence = await action();
    report.checks.push({ name, pass: true, ms: Date.now() - start, ...(evidence === undefined ? {} : { evidence }) });
    console.log(`PASS ${name}`);
    return true;
  } catch (error) {
    report.failed.push({ name, pass: false, ms: Date.now() - start, error: String(error.stack || error) });
    if (page && !page.isClosed()) await shot(`failure-${report.failed.length}`).catch(e => report.errors.push({ kind: 'screenshot', message: String(e) }));
    console.error(`FAIL ${name}: ${error.message}`);
    return false;
  } finally { writeReport(); }
}
async function poll(read, predicate, message, timeout = 15000) {
  const start = Date.now(); let value;
  while (Date.now() - start < timeout) {
    value = await read();
    if (predicate(value)) return value;
    await new Promise(resolve => setTimeout(resolve, 80));
  }
  assert.fail(`${message}: ${JSON.stringify(value)}`);
}
const attr = (locator, key, value) => poll(() => locator.getAttribute(key), actual => actual === value, `${key} should be ${value}`);
const valueIs = (locator, value) => poll(() => locator.inputValue(), actual => actual === value, 'draft mismatch');
async function active(view) {
  await page.locator(`.edu-shell[data-view="${view}"]:visible`).waitFor();
  assert.equal(await shell().count(), 1, 'exactly one visible product shell');
  await attr(nav().getByTestId(navId(view)), 'aria-current', 'page');
}
const navId = view => view === 'ai' ? 'nav-ai-workspace' : students.includes(view) || view === 'student_workbench' ? 'nav-student-workbench' : teaching.includes(view) ? 'nav-teaching' : `nav-${view}`;
async function selectStudentContext() {
  const rows = shell().locator('[data-testid^="student-row-"]').filter({ has: page.locator('.student-row-name') });
  if (!await rows.count()) {
    await ui('student-create').click();
    await ui('student-form-display-name').fill(`UI验收学生-${token}`);
    await ui('student-form-grade').fill('八年级');
    await ui('student-profile-form').getByRole('button', {name:'创建学生',exact:true}).click();
    await rows.waitFor();
    // Creation uses the original full-profile route. Return through the visible
    // workbench entry before selecting the student in its local context.
    await nav().getByTestId('nav-student-workbench').click();
    await active('student_workbench');
  }
  assert.equal(await rows.count(), 1, 'The owned workbench fixture has exactly one UI-created student');
  await rows.click();
  await ui('student-context-tab-profile').waitFor();
  await ui('student-workbench-layout').getByRole('heading', {name:`UI验收学生-${token}`,exact:true}).waitFor();
}
async function navigate(view) {
  if (await nav().getAttribute('data-collapsed') === 'true') await nav().getByTestId('workbench-sidebar-toggle').click();
  if (teaching.includes(view) || students.includes(view)) {
    const hub = teaching.includes(view) ? 'teaching' : 'student_workbench';
    await nav().getByTestId(navId(hub)).click(); await active(hub);
    if (hub === 'student_workbench') await selectStudentContext();
    if (view === 'search' || view === 'intake') await ui('student-context-tab-records').click();
    if (view === 'students') await revealFullStudentProfile();
    await ui(`hub-entry-${view}`).click();
  } else await nav().getByTestId(navId(view)).click();
  await active(view);
}

async function revealFullStudentProfile() {
  const trigger = ui('student-profile-more');
  if (await trigger.getAttribute('aria-expanded') === 'false') await trigger.click();
  await attr(trigger, 'aria-expanded', 'true');
  await ui('hub-entry-students').waitFor();
}

function dbRead(read) {
  const db = new DatabaseSync(path.join(data, 'app.db'), { readOnly: true });
  try { return read(db); } finally { db.close(); }
}
function readSessions() {
  return dbRead(db => db.prepare(`SELECT s.id,s.title,s.folder_id,s.message_count,s.archived_at,f.name AS folder_name
    FROM ai_conversation_sessions s LEFT JOIN ai_conversation_folders f ON f.id=s.folder_id
    WHERE s.title IN (?,?) ORDER BY s.title`).all(titleA, titleB));
}
function readImport() {
  return dbRead(db => db.prepare('SELECT * FROM teacher_resources WHERE original_file_name = ?').all(importName));
}
function verifyImportedBytes(row) {
  assert(row, 'imported SQLite resource required');
  assert.equal(row.original_file_name, importName);
  const local = fs.realpathSync(row.local_path);
  assert(local.startsWith(fs.realpathSync(data) + path.sep), 'knowledge original must live in owned data root');
  assert.equal(row.content_hash, report.fixtures.importSha256);
  assert.equal(digest(local), report.fixtures.importSha256, 'stored knowledge bytes match selected txt');
  assert.equal(row.file_size, fs.statSync(importFile).size);
  return { id: row.id, local, sha256: digest(local) };
}
function observe(window) {
  if (observedPages.has(window)) return;
  observedPages.add(window);
  window.on('pageerror', error => report.errors.push({ kind: 'pageerror', launch: report.launches.length, message: String(error) }));
  window.on('console', message => { if (message.type() === 'error') report.errors.push({ kind: 'console.error', message: message.text() }); });
  window.on('crash', () => report.errors.push({ kind: 'renderer-crash' }));
}
async function launch() {
  const env = { ...process.env };
  // No inherited E2E switches, provider credentials, dev renderer, or real OS profile.
  for (const key of Object.keys(env)) {
    if (key.startsWith('OMNI_EDU_E2E_') || /API[_-]?KEY|ACCESS[_-]?TOKEN|AUTH[_-]?TOKEN|SECRET/i.test(key) ||
        ['ELECTRON_RUN_AS_NODE', 'NODE_OPTIONS', 'ELECTRON_RENDERER_URL', 'DEEPSEEK_MODEL'].includes(key)) delete env[key];
  }
  Object.assign(env, { OMNI_EDU_DATA_ROOT: data, OMNI_EDU_REPO_ROOT: path.resolve(desktop, '../..'), OMNI_EDU_XIAOZHI_PI: '1',
    NODE_ENV: 'production', DEEPSEEK_API_KEY: '', USERPROFILE: osProfile, HOME: osProfile,
    APPDATA: path.join(osProfile, 'AppData/Roaming'), LOCALAPPDATA: path.join(osProfile, 'AppData/Local'),
    TEMP: path.join(temp, 'tmp'), TMP: path.join(temp, 'tmp') });
  app = await electron.launch({ args: [main, '--force-device-scale-factor=1', `--user-data-dir=${profile}`], env, cwd: desktop, timeout: 60000 });
  app.on('window', observe);
  page = await app.firstWindow();
  // firstWindow may predate the listener above.
  observe(page);
  const ownedWindow = await app.browserWindow(page);
  await ownedWindow.evaluate(window => { window.setTitle('小智 · UI 自动验收（隔离数据）'); window.showInactive(); });
  await ownedWindow.dispose();
  page.setDefaultTimeout(20000);
  await app.context().route(/^https?:\/\//, async route => {
    report.networkAttempts.push({ method: route.request().method(), url: route.request().url().split('?')[0] });
    await route.abort('blockedbyclient');
  });
  const isolation = await assertIsolatedPiMain(app, main, profile);
  const runtime = await app.evaluate(() => ({ data: process.env.OMNI_EDU_DATA_ROOT, pi: process.env.OMNI_EDU_XIAOZHI_PI, nodeEnv: process.env.NODE_ENV }));
  assert.equal(runtime.data, data); assert.equal(runtime.pi, '1'); assert.equal(runtime.nodeEnv, 'production');
  await page.locator('.edu-shell:visible [data-testid="edu-navigation"]').waitFor({ timeout: 90000 });
  assert(page.url().startsWith('file:'), 'must load production renderer from disk');
  const renderer = fs.realpathSync(fileURLToPath(new URL(page.url())));
  assert(renderer.startsWith(buildRoot + path.sep), 'renderer and main must belong to the same frozen build');
  report.launches.push({ at: new Date().toISOString(), isolation, runtime, url: page.url(), renderer });
  await poll(() => nav().getByTestId('workbench-new-session').isEnabled(), Boolean, 'real Pi bridge readiness', 90000);
}
async function close() {
  if (!app) return;
  const current = app;
  await current.close();
  app = undefined;
}
async function size(width, height) {
  // This handle belongs to THIS page. Never index BrowserWindow.getAllWindows().
  const win = await app.browserWindow(page);
  const native = await win.evaluate((window, dimensions) => {
    if (window.isFullScreen()) window.setFullScreen(false);
    if (window.isMaximized()) window.unmaximize();
    window.setMinimumSize(640, 480);
    window.webContents.setZoomFactor(1);
    window.setContentSize(dimensions.width, dimensions.height);
    return { id: window.id, webContentsId: window.webContents.id, content: window.getContentBounds(), bounds: window.getBounds() };
  }, { width, height });
  await page.waitForFunction(dimensions => innerWidth === dimensions.width && innerHeight === dimensions.height, { width, height });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const css = await page.evaluate(() => ({ width: innerWidth, height: innerHeight, dpr: devicePixelRatio }));
  report.viewports.push({ requested: { width, height }, native, css });
  await win.dispose();
}
async function assertTarget(locator) {
  await locator.waitFor({ state: 'visible' });
  await locator.scrollIntoViewIfNeeded();
  const disabled = await locator.isDisabled();
  const geometry = await locator.evaluate(el => {
    const r = el.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    const hit = document.elementFromPoint(x, y);
    return { x: r.x, y: r.y, width: r.width, height: r.height,
      inViewport: r.left >= -1 && r.top >= -1 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1,
      hit: !!hit && (el === hit || el.contains(hit)), hitElement: hit ? `${hit.tagName}.${hit.className}` : null };
  });
  // Native disabled controls deliberately use pointer-events:none; still check their bounds.
  assert(geometry.width > 0 && geometry.height > 0 && geometry.inViewport && (disabled || geometry.hit), `control clipped/covered: ${JSON.stringify(geometry)}`);
  return {...geometry, disabled};
}
async function noOverflow() {
  const dimensions = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
  assert(dimensions.document <= dimensions.viewport + 1 && dimensions.body <= dimensions.viewport + 1, JSON.stringify(dimensions));
}
async function openSession(row) {
  assert(row, 'session must have been created by the real form');
  await navigate('ai');
  assert.equal(await recentSession(row.id).count(), 1, 'Exactly one recent-list session, separate from its folder entry');
  await recentSession(row.id).click();
  await attr(recentSession(row.id), 'aria-current', 'page');
  await poll(() => shell().locator('.edu-session-title').textContent(), text => text === row.title, 'active session header');
  await poll(() => composer().isEnabled(), Boolean, 'session composer ready');
}
async function show(kind, trigger) {
  await nav().getByTestId(trigger).click();
  await dialog(kind).waitFor();
  return dialog(kind);
}
async function escape(kind, trigger) {
  await page.keyboard.press('Escape');
  await dialog(kind).waitFor({ state: 'hidden' });
  await poll(() => nav().getByTestId(trigger).evaluate(el => el === document.activeElement), Boolean, 'Escape returns focus to original trigger');
}
async function nativeSelection(file, kind) {
  report.dialogSelections.push({ file, kind });
  // Only replace the OS dialog. All permissions, IPC, listing, import and preview remain real.
  await app.evaluate(({ dialog }, selection) => {
    const original = dialog.showOpenDialog.bind(dialog);
    dialog.showOpenDialog = async (...args) => {
      dialog.showOpenDialog = original;
      const options = args.at(-1);
      const actual = options?.properties?.includes('openDirectory') ? 'directory' : 'file';
      if (actual !== selection.kind) throw Error(`Unexpected native selection: ${actual}`);
      return { canceled: false, filePaths: [selection.file] };
    };
  }, { file, kind });
}

try {
  main = testMain(desktop); buildRoot = path.dirname(path.dirname(main));
  baseline = fingerprint(buildRoot);
  report.fingerprint = { root: buildRoot, main, before: baseline, scriptSha256: digest(fileURLToPath(import.meta.url)) };
  if (!await test(planned[0], launch)) throw Error('Cannot proceed without isolated formal production UI');
  for (const [index, width, height] of [[1, 1366, 768], [2, 1920, 1080]]) {
    await test(planned[index], async () => {
      await size(width, height); await active('ai');
      const home = ui('workbench-home'); await home.waitFor();
      const heading = await home.locator('h1').boundingBox();
      assert(heading.y >= 100 && heading.y < height - 240, 'home title visible on initial paint without scrolling');
      assert.equal(await shell().locator('[data-testid^="home-task-"]').count(), 3);
      assert.deepEqual(await shell().locator('.wb-start-shortcut span').allTextContents(), ['智能备课', '智能组卷', '学情分析']);
      const boxes = [];
      for (const id of ['notebook', 'paper', 'analytics']) boxes.push(await assertTarget(ui(`home-task-${id}`)));
      assert(Math.max(...boxes.map(b => b.y)) - Math.min(...boxes.map(b => b.y)) <= 2, 'three lightweight shortcuts in one row');
      const columns = await Promise.all([nav().boundingBox(), shell().locator('.edu-chat-main').boundingBox()]);
      assert(columns.every(Boolean), 'navigation and chat present');
      assert.equal(await ui('edu-context-panel').count(), 0, 'blank chat must not restore an open right panel');
      assert(columns[0].x + columns[0].width <= columns[1].x + 1, 'main columns must not overlap');
      const inputBox=await composer().boundingBox();
      assert(inputBox.y > heading.y && inputBox.y < boxes[0].y, 'original input sits between welcome and shortcuts');
      await noOverflow(); await shot(`home-input-first-${width}`);
      await composer().fill('仅验证发送按钮可达，不提交');
      await assertTarget(page.getByRole('button', { name: '发送消息', exact: true }));
      await composer().fill('');
      return { cards: boxes, columns };
    });
  }
  await test(planned[3], async () => {
    for (const id of ['home-task-notebook', 'home-task-paper', 'home-task-analytics', 'home-suggestion-1']) {
      await composer().fill(''); await ui(id).click();
      await poll(() => composer().inputValue(), text => text.length > 10, `${id} should seed draft`);
      assert.equal(dbRead(db => db.prepare('SELECT COUNT(*) n FROM ai_conversation_messages').get().n), 0);
    }
    await composer().fill('');
  });
  await test(planned[4], async () => {
    assert.equal(await nav().locator('[data-testid^="nav-group-"]').count(), 0, 'domain subnavigation belongs inside workbenches');
    for (const target of ['teaching', 'student_workbench']) {
      await nav().getByTestId(navId(target)).focus(); await page.keyboard.press('Enter'); await active(target);
      await nav().getByTestId('nav-ai-workspace').focus(); await page.keyboard.press('Space'); await active('ai');
    }
    for (const view of originalViews) {
      await navigate(view);
      assert.equal(await nav().locator('[data-testid^="nav-"][aria-current="page"]').count(), 1);
      await assertTarget(nav().getByTestId(navId(view)));
    }
    return { visited: originalViews };
  });
  await test(planned[5], async () => {
    for (const [view, kind, entries] of [['teaching', 'teaching', teaching], ['student_workbench', 'students', students]]) {
      await navigate(view); await ui(`workbench-hub-${kind}`).waitFor();
      for (const [width, height] of [[1366,768],[1920,1080]]) { await size(width,height); await shot(`hub-${kind}-${width}`); }
      await size(1366,768);
      if (kind === 'students') await selectStudentContext();
      const navigation = ui(`${kind === 'students' ? 'student' : 'teaching'}-page-navigation`);
      if (kind === 'students') {
        assert.equal(await navigation.locator('[data-testid^="hub-entry-"]').count(), 4);
        assert.equal(await navigation.locator('[data-testid^="student-context-tab-"]').count(), 2);
        await revealFullStudentProfile();
        assert.equal(await ui('hub-entry-students').isVisible(), true);
        await ui('student-context-tab-records').click();
        assert.equal(await ui('hub-entry-search').isVisible(), true);
        assert.equal(await ui('hub-entry-intake').isVisible(), true);
      } else assert.equal(await navigation.locator('[data-testid^="hub-entry-"]').count(), entries.length);
      for (const child of entries) {
        await navigate(child); await active(child);
        if (kind === 'teaching' && child !== 'paper') {
          const heading = ui('teaching-page-heading');
          await heading.waitFor();
          assert.equal(await ui('teaching-page-actions').getByRole('button').count(), 1, 'One original primary action occupies the page heading');
          assert.equal(await shell().getByRole('heading', {level:1}).count(), 1, 'One teaching workspace h1');
        }
        await attr(nav().getByTestId(navId(child)), 'aria-current', 'page');
        await attr(ui(`hub-entry-${child}`), 'aria-current', 'page');
      }
      await navigate(kind === 'teaching' ? 'notebook' : 'students');
      await active(kind === 'teaching' ? 'notebook' : 'students');
    }
    await shot('hub-domain-navigation');
  });
  await test(planned[6], async () => {
    for (const [child, next, kind] of [['notebook', 'book', 'teaching'], ['analytics', 'students', 'students']]) {
      await navigate(child); await ui(`hub-entry-${next}`).click(); await active(next);
      await page.getByTestId('desktop-back').click(); await active(child);
      await attr(ui(`hub-entry-${child}`), 'aria-current', 'page');
      await assertTarget(nav().getByTestId(navId(child)));
    }
  });
  await test(planned[7], async () => {
    await navigate('ai'); await size(1366, 480);
    const rail = ui('product-rail'), footer = ui('edu-navigation-footer');
    assert.equal(await rail.getByTestId('nav-settings').count(), 0);
    assert.equal(await footer.locator('xpath=ancestor::nav').count(), 0, 'settings footer cannot have a nav ancestor');
    assert.equal(await footer.getByTestId('nav-settings').count(), 1);
    const before = await footer.boundingBox();
    const geometry = await rail.evaluate(el => ({ overflow: getComputedStyle(el).overflowY, parentOverflow: getComputedStyle(el.parentElement).overflowY, client: el.clientHeight, scroll: el.scrollHeight }));
    assert.equal(geometry.overflow, 'auto'); assert.equal(geometry.parentOverflow, 'hidden'); assert(geometry.scroll > geometry.client);
    await rail.evaluate(el => { el.scrollTop = el.scrollHeight; });
    assert.deepEqual(await footer.boundingBox(), before); await assertTarget(footer.getByTestId('nav-settings'));
    await shot('independent-nav-scroll-footer');
    await size(1366,768); return geometry;
  });
  const created = await test(planned[8], async () => {
    await navigate('ai');
    let form = await show('folder', 'workbench-new-folder');
    await form.getByLabel('空间名称').fill(folderName); await form.getByRole('button', { name: '创建空间', exact: true }).click();
    await form.waitFor({ state: 'hidden' });
    const folders = dbRead(db => db.prepare('SELECT id,name FROM ai_conversation_folders WHERE name=?').all(folderName));
    assert.equal(folders.length, 1); report.folder = folders[0];
    for (const [title, folder] of [[titleA, folders[0].id], [titleB, '']]) {
      form = await show('new', 'workbench-new-session');
      await form.getByLabel('对话标题（可选）').fill(title); await form.getByLabel('教学空间', { exact: true }).selectOption(folder);
      await form.getByRole('button', { name: '创建对话', exact: true }).click(); await form.waitFor({ state: 'hidden' });
      await active('ai');
      await poll(readSessions, rows => rows.some(row => row.title === title), 'created title SQLite readback');
    }
    const rows = readSessions(); assert.equal(rows.length, 2);
    sessionA = rows.find(row => row.title === titleA); sessionB = rows.find(row => row.title === titleB);
    assert.equal(sessionA.folder_id, folders[0].id); assert.equal(sessionA.folder_name, folderName); assert.equal(sessionB.folder_id, null);
    report.sessions = rows; return rows;
  });
  if (created) {
    await test(planned[9], async () => {
      const search = await show('search', 'workbench-search');
      const input = search.getByLabel('对话标题', { exact: true });
      await input.fill(`no-such-title-${token}`);
      await search.getByText('没有匹配的对话，试试其他标题。', { exact: true }).waitFor();
      assert.equal(await search.locator('[data-testid^="workbench-session-"]').count(), 0);
      await shot('search-no-results'); await input.fill('Workbench');
      for (const [heading, row] of [[folderName, sessionA], ['未分组对话', sessionB]]) {
        const section = search.locator('section').filter({ has: page.getByRole('heading', { name: heading, exact: true }) });
        assert.equal(await section.count(), 1); await section.getByTestId(`workbench-session-${row.id}`).waitFor();
      }
      await shot('search-title-groups');
      await search.getByTestId(`workbench-session-${sessionA.id}`).click(); await search.waitFor({ state: 'hidden' });
      await active('ai'); await attr(recentSession(sessionA.id), 'aria-current', 'page');
    });
    await test(planned[10], async () => {
      const history = await show('history', 'workbench-manage-history');
      await history.getByTestId('ai-conversation-sidebar').waitFor();
      await history.getByTestId(`ai-conversation-folder-${report.folder.id}`).waitFor();
      await history.getByTestId(`ai-conversation-session-${sessionA.id}`).waitFor();
      await history.getByTestId(`ai-conversation-session-${sessionB.id}`).waitFor();
      await history.getByTestId(`ai-conversation-session-${sessionA.id}`).click({ button: 'right' });
      await page.getByTestId('ai-conversation-context-rename').waitFor();
      await page.getByTestId('ai-conversation-context-archive').waitFor();
      await page.keyboard.press('Escape');
      await page.getByTestId('ai-conversation-context-menu').waitFor({ state: 'hidden' });
      const rowA = history.getByTestId(`ai-conversation-session-${sessionA.id}`);
      const readA = () => dbRead(db => db.prepare('SELECT id,title,folder_id,message_count,archived_at FROM ai_conversation_sessions WHERE id=?').get(sessionA.id));
      const beforeRename = readA();
      for (const title of [titleA + ' 重命名核对', titleA]) {
        await rowA.click({button: 'right'});
        await page.getByTestId('ai-conversation-context-rename').click();
        const input = history.getByLabel('对话名称', {exact: true});
        assert.equal(await input.count(), 1, 'Exact history inline rename input');
        await input.fill(title); await input.press('Enter');
        await input.waitFor({state: 'hidden'});
        await poll(readA, row => row.title === title, 'Rename persisted for the same exact session');
        assert.equal(readA().folder_id, beforeRename.folder_id);
        assert.equal(readA().message_count, 0);
      }
      await rowA.click({button: 'right'});
      await page.getByTestId('ai-conversation-context-archive').click();
      const cancel = page.getByTestId('ai-conversation-archive-cancel');
      await cancel.waitFor(); await cancel.click();
      await cancel.waitFor({state: 'hidden'});
      assert.deepEqual(readA(), beforeRename, 'Cancelling archive preserves original session identity, folder, title and messages');
      await shot('original-history-management');
      await history.getByRole('button', { name: '关闭', exact: true }).click(); await history.waitFor({ state: 'hidden' });
      await navigate('teaching');
      const fromHub = await show('history', 'workbench-manage-history');
      await fromHub.getByTestId(`ai-conversation-session-${sessionB.id}`).click();
      await active('ai'); await fromHub.waitFor({state:'hidden'});
      assert.equal(await shell().locator('.edu-session-title').textContent(), sessionB.title);
    });
    await test(planned[11], async () => {
      await openSession(sessionA); await composer().fill(draftA);
      await openSession(sessionB); await valueIs(composer(), ''); await composer().fill(draftB);
      await openSession(sessionA); await valueIs(composer(), draftA);
      for (const hub of ['teaching', 'student_workbench']) { await navigate(hub); await navigate('ai'); await valueIs(composer(), draftA); }
      await openSession(sessionB); await valueIs(composer(), draftB); await openSession(sessionA); await valueIs(composer(), draftA);
    });
  }
  await test(planned[12], async () => {
    await navigate('ai'); const toggle = nav().getByTestId('workbench-sidebar-toggle');
    const expanded = await nav().boundingBox(); await toggle.focus(); await page.keyboard.press('Enter');
    await attr(nav(), 'data-collapsed', 'true'); const collapsed = await nav().boundingBox();
    assert(collapsed.width < expanded.width, 'collapse reduces actual sidebar width'); await assertTarget(toggle);
    await shot('sidebar-collapsed'); await toggle.focus(); await page.keyboard.press('Space'); await attr(nav(), 'data-collapsed', 'false');
    await toggle.focus(); await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab');
    assert(await toggle.evaluate(el => el === document.activeElement && el.matches(':focus-visible')));
  });
  await test(planned[13], async () => {
    for (const [kind, trigger] of [['new', 'workbench-new-session'], ['folder', 'workbench-new-folder'], ['search', 'workbench-search']]) {
      const modal = await show(kind, trigger);
      await poll(() => modal.locator('input').evaluate(el => el === document.activeElement), Boolean, 'modal initial input focus');
      const count = await modal.locator('button,input,select').count();
      for (const key of ['Tab', 'Shift+Tab']) for (let i = 0; i < count + 3; i++) {
        await page.keyboard.press(key);
        assert(await modal.evaluate(el => el.contains(document.activeElement)), `${kind}: ${key} escaped modal`);
      }
      await escape(kind, trigger);
    }
  });
  await test(planned[14], async () => {
    await navigate('ai');
    if (!await ui('edu-context-panel').isVisible()) await ui('pi-aside-toggle').click();
    await ui('workbench-tab-tasks').click(); await attr(ui('workbench-tab-tasks'), 'aria-selected', 'true');
    await ui('workbench-tab-files').click(); await attr(ui('workbench-tab-files'), 'aria-selected', 'true');
    await ui('pi-file-panel').waitFor();
    await ui('workbench-tab-files').focus(); await page.keyboard.press('ArrowLeft');
    await attr(ui('workbench-tab-tasks'), 'aria-selected', 'true');
    assert(await ui('workbench-tab-tasks').evaluate(el => el === document.activeElement));
    await page.keyboard.press('End'); await attr(ui('workbench-tab-files'), 'aria-selected', 'true');
    await ui('workbench-panel-close').click(); await ui('edu-context-panel').waitFor({ state: 'hidden' });
    await ui('pi-aside-toggle').click(); await attr(ui('workbench-tab-tasks'), 'aria-selected', 'true');
    await ui('workbench-tab-tasks').focus(); await page.keyboard.press('Escape'); await ui('edu-context-panel').waitFor({ state: 'hidden' });
    assert(await ui('pi-aside-toggle').evaluate(el => el === document.activeElement), 'panel Escape returns focus');
    await ui('pi-files-toggle').click(); await attr(ui('workbench-tab-files'), 'aria-selected', 'true');
    await shot('right-panel-files-reopened');
  });
  await test(planned[15], async () => {
    await navigate('ai'); if (!await ui('workbench-tab-files').isVisible()) await ui('pi-files-toggle').click();
    await ui('workbench-tab-files').click();
    await ui('pi-files-choose').waitFor();
    await nativeSelection(workspace, 'directory'); await ui('pi-files-choose').click();
    const entry = ui('pi-file-panel').getByTestId(`pi-file-entry-${fileName}`);
    await entry.waitFor(); await entry.click();
    await poll(() => ui('pi-file-text').textContent(), text => text === fileText, 'real preview must contain owned txt bytes', 30000);
    assert.equal(await ui('pi-file-error').count(), 0); await shot('owned-txt-actual-preview');
    await ui('workbench-panel-close').click(); await ui('pi-files-toggle').click();
    await ui('pi-files-refresh').click();
    await ui('pi-file-panel').getByTestId(`pi-file-entry-${fileName}`).click();
    await poll(() => ui('pi-file-text').textContent(), text => text === fileText, 'real preview after panel reopen');
    return { path: fixture, text: fileText, sha256: digest(fixture) };
  });
  await test(planned[16], async () => {
    await navigate('knowledge'); await nativeSelection(importFile, 'file'); await ui('materials-import').click();
    imported = await poll(readImport, rows => rows.length === 1, 'teacher_resources exact original_file_name', 60000);
    await ui(`material-${imported[0].id}`).waitFor({timeout: 60000});
    report.importedResources = imported; report.importedBytes = verifyImportedBytes(imported[0]);
    await shot('knowledge-real-txt-import'); return imported;
  });
  await test(planned[17], async () => {
    await navigate('ai'); await size(840, 768);
    if (await ui('edu-context-panel').isVisible()) await ui('workbench-panel-close').click();
    await noOverflow();
    const controls = [];
    for (const id of ['workbench-sidebar-toggle', 'workbench-new-session', 'workbench-search', 'nav-settings']) controls.push({ id, box: await assertTarget(nav().getByTestId(id)) });
    for (const id of ['office-prompt-input', 'pi-aside-toggle', 'pi-files-toggle', 'pi-workspace-more']) controls.push({ id, box: await assertTarget(ui(id)) });
    await shot('narrow-840-composer-controls');
    await ui('pi-aside-toggle').click();
    for (const id of ['workbench-tab-tasks', 'workbench-tab-files', 'workbench-panel-close']) await assertTarget(ui(id));
    await noOverflow(); await shot('narrow-840-right-panel');
    await ui('workbench-panel-close').click(); await assertTarget(composer());
    for (const [kind, trigger] of [['new', 'workbench-new-session'], ['folder', 'workbench-new-folder'], ['search', 'workbench-search']]) {
      const modal = await show(kind, trigger);
      for (const input of await modal.locator('input,select,button').all()) if (await input.isVisible()) await assertTarget(input);
      await shot(`narrow-840-${kind}-dialog`); await escape(kind, trigger);
    }
    await size(1366, 768); return controls;
  });
  await test(planned[18], async () => {
    await navigate('ai'); await page.emulateMedia({ reducedMotion: 'reduce' });
    assert(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches));
    const folder = nav().getByRole('button',{name:folderName,exact:true});
    await folder.click(); await folder.click();
    const chevron = folder.locator('.wb-chevron');
    assert.equal(await chevron.evaluate(el => getComputedStyle(el).transitionDuration), '0s');
    await ui('workbench-home').waitFor();
    assert.equal(await shell().locator('.wb-start-shortcut').count(), 3);
    for (const element of await shell().locator('.wb-start-shortcut,.wb-start-example').all()) assert.equal(await element.evaluate(el => getComputedStyle(el).transitionDuration), '0s');
    await navigate('teaching');
    assert.equal(await ui('teaching-page-navigation').locator('[data-testid^="hub-entry-"]').count(),teaching.length);
    for (const element of await ui('teaching-page-navigation').getByRole('button').all()) await assertTarget(element);
    await shot('reduced-motion-hub'); await navigate('ai');
  });
  await test('sidebar states and 700px effective collapse', async () => {
    await size(1366,768); await navigate('ai');
    const target=nav().getByTestId('workbench-search');
    const read=()=>target.evaluate(el=>{const c=getComputedStyle(el);return {background:c.backgroundColor,outline:c.outlineStyle,width:c.outlineWidth};});
    await page.mouse.move(1000,40); const idle=await read();
    await target.hover(); const hover=await read();
    await target.focus(); await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab');
    const focused=await read(); assert.equal(focused.outline,'solid');
    await target.hover(); await page.mouse.down(); const pressed=await read(); await page.mouse.up();
    assert.notEqual(idle.background,hover.background); assert.notEqual(hover.background,pressed.background);
    await dialog('search').waitFor(); await escape('search','workbench-search');
    await size(700,768); await attr(nav(),'data-collapsed','true');
    await nav().getByTestId('workbench-sidebar-toggle').click(); await attr(nav(),'data-collapsed','false');
    assert((await nav().boundingBox()).width > 200); await assertTarget(nav().getByTestId('workbench-search'));
    await shot('narrow-700-navigation-expanded');
    await nav().getByTestId('nav-teaching').click(); await active('teaching'); await attr(nav(),'data-collapsed','true');
    await nav().getByTestId('workbench-sidebar-toggle').click(); await assertTarget(nav().getByTestId('nav-settings'));
    await size(1366,768); await navigate('ai'); return {idle,hover,focused,pressed};
  });
  // Restart even if an earlier independent UI scenario failed; do not manufacture missing fixtures.
  await close();
  await test(planned[19], async () => {
    assert(sessionA && sessionB && imported?.length === 1, 'requires successful real form creation and knowledge import');
    assert.deepEqual(readSessions(), report.sessions);
    const resources = readImport(); assert.equal(resources.length, 1); assert.equal(resources[0].id, imported[0].id);
    verifyImportedBytes(resources[0]);
    return { sessions: readSessions(), folder: dbRead(db => db.prepare('SELECT id,name FROM ai_conversation_folders WHERE id=?').get(report.folder.id)), resources };
  });
  await launch();
  await test(planned[20], async () => {
    assert(sessionA && sessionB && imported?.length === 1, 'requires successful real form creation and knowledge import');
    await size(1366, 768);
    await openSession(sessionA); await valueIs(composer(), draftA);
    const folder = nav().getByRole('button', { name: folderName, exact: true }); await folder.waitFor();
    if (await folder.getAttribute('aria-expanded') !== 'true') await folder.click();
    const panel = await folder.getAttribute('aria-controls');
    await page.locator(`[id=${JSON.stringify(panel)}]`).getByTestId(`workbench-session-${sessionA.id}`).waitFor();
    await openSession(sessionB); await valueIs(composer(), draftB);
    await navigate('knowledge'); await ui(`material-${imported[0].id}`).waitFor({timeout: 60000});
    assert.equal(readImport()[0].id, imported[0].id); verifyImportedBytes(readImport()[0]); await shot('cold-knowledge-import');
    await openSession(sessionA); await valueIs(composer(), draftA); await shot('cold-session-folder-title-draft');
    assert.deepEqual(readSessions(), report.sessions);
  });
  await test(planned[21], async () => {
    const facts = dbRead(db => ({ messages: db.prepare('SELECT COUNT(*) n FROM ai_conversation_messages').get().n,
      sessionsWithMessages: db.prepare('SELECT COUNT(*) n FROM ai_conversation_sessions WHERE message_count<>0').get().n }));
    assert.equal(facts.messages, 0); assert.equal(facts.sessionsWithMessages, 0);
    report.modelTasksSubmitted = 0;
    assert.deepEqual(report.networkAttempts, [], 'no HTTP/model traffic permitted');
    assert.equal(digest(fixture), report.fixtures.previewSha256); assert.equal(digest(importFile), report.fixtures.importSha256);
    return facts;
  });
} catch (error) {
  report.failed.push({ name: 'suite infrastructure', pass: false, error: String(error.stack || error) });
  if (page && !page.isClosed()) await shot('fatal-failure').catch(() => {});
} finally {
  await close().catch(error => report.failed.push({ name: 'Electron cleanup', pass: false, error: String(error) }));
  await test('zero renderer errors across both launches including shutdown', async () => assert.deepEqual(report.errors, []));
  if (baseline) await test('frozen production build and test script unchanged', async () => {
    report.fingerprint.after = fingerprint(buildRoot);
    assert.deepEqual(report.fingerprint.after, baseline);
    assert.equal(digest(fileURLToPath(import.meta.url)), report.fingerprint.scriptSha256);
  });
  report.notRun = planned.filter(name => !attempted.has(name));
  report.success = report.failed.length === 0 && report.errors.length === 0 && report.notRun.length === 0;
  report.finishedAt = new Date().toISOString();
  report.summary = { passed: report.checks.length, failed: report.failed.length, errors: report.errors.length, notRun: report.notRun.length };
  writeReport(); console.log(`REPORT ${reportFile}`);
  if (!report.success) process.exitCode = 1;
}
