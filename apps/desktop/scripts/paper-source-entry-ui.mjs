import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {spawn} from 'node:child_process';
import {_electron as electron} from 'playwright';
import {fingerprint, sha256} from './acceptance/evidence.mjs';
import {assertIsolatedPiMain} from './acceptance/build-root.mjs';
import {continuationBootstrap, continuationGuardRead} from './acceptance/paper-adaptation-continuation.mjs';
import {productEntry} from './product-navigation.mjs';

const desktop = path.resolve(import.meta.dirname, '..');
assert.equal(process.argv.length, 4);
assert.equal(process.argv[2], '--run-ui');
assert(process.argv[3].startsWith('--pins='));
const owned = fs.realpathSync(path.join(desktop, 'test-results'));
const pinFile = fs.realpathSync(path.resolve(desktop, process.argv[3].slice(7)));
assert(pinFile.startsWith(owned + path.sep));
const pins = JSON.parse(fs.readFileSync(pinFile));
assert(fs.realpathSync(pins.buildRoot).startsWith(owned + path.sep));
const output = fs.mkdtempSync(path.join(owned, 'paper-source-entry-'));
const report = {success:false, output, pins, checks:[], screens:[], errors:[], launches:[], scenarios:[],
  scope:'Actual isolated Electron with original host and SQLite. Controlled teacher text and native file-selection input. Lost replies call the real handler first. No fake extraction, provider success or model sends.'};
const save = () => fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
const check = name => {report.checks.push(name); save();};
const verify = () => {
  assert.equal(fingerprint(path.join(desktop, 'src')).sha256, pins.source);
  assert.equal(fingerprint(pins.buildRoot).sha256, pins.build);
};
const env = {...process.env};
for (const name of Object.keys(env)) if (/KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL/i.test(name) || name.startsWith('OMNI_EDU_') ||
  ['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL'].includes(name)) delete env[name];
Object.assign(env, {NODE_ENV:'development', OMNI_EDU_REPO_ROOT:path.resolve(desktop, '../..'), OMNI_EDU_XIAOZHI_PI:'1', OMNI_EDU_E2E_VISIBLE:'1'});
let app, page, context;
const started = Date.now();
const deadline = setTimeout(() => {
  report.budgetExceeded = true; save();
  if (app) spawn('taskkill.exe', ['/PID',String(app.process().pid),'/T','/F'], {windowsHide:true, stdio:'ignore'});
}, 240000);
const read = sql => {
  const db = new DatabaseSync(path.join(context.data, 'app.db'), {readOnly:true});
  try {return db.prepare(sql).all().map(row => ({...row}));} finally {db.close();}
};
const baskets = () => read('SELECT id, session_id, data_json FROM paper_baskets').map(row => ({
  ...JSON.parse(row.data_json), id:row.id, sessionId:row.session_id}));
const resources = () => read('SELECT * FROM teacher_resources ORDER BY id');
const dialog = () => page.getByTestId('paper-basket-create-dialog');
async function launch(name, restart = false) {
  assert(report.launches.length < 7);
  if (!restart) {
    const root = path.join(output, name); fs.mkdirSync(root);
    context = {name, root, data:path.join(root, 'data'), profile:path.join(root, 'profile')};
    fs.mkdirSync(context.data); fs.mkdirSync(context.profile);
    context.bootstrap = path.join(root, 'bootstrap.cjs');
    fs.writeFileSync(context.bootstrap, continuationBootstrap({main:path.join(pins.buildRoot, 'main/index.js'), profile:context.profile}));
    report.scenarios.push(context);
  }
  app = await electron.launch({args:[context.bootstrap,'--user-data-dir='+context.profile,'--force-device-scale-factor=1'],
    cwd:context.root, env:{...env, OMNI_EDU_DATA_ROOT:context.data}, timeout:30000});
  page = await app.firstWindow({timeout:30000}); page.setDefaultTimeout(12000);
  page.on('pageerror', error => report.errors.push({scenario:name, type:'page', hash:sha256(String(error))}));
  page.on('console', message => {if (message.type() === 'error') report.errors.push({scenario:name, type:'console', hash:sha256(message.text())});});
  await page.getByTestId('xiaozhi-pi-workspace').waitFor({state:'attached'});
  report.launches.push({scenario:name, pid:app.process().pid,
    identity:await assertIsolatedPiMain(app, path.join(pins.buildRoot, 'main/index.js'), context.profile)});
  await size(1366,768);
}
async function close() {
  const guard = await app.evaluate(continuationGuardRead, true);
  for (const key of ['networkAttempts','modelAttempts','rendererErrors']) assert.equal(guard[key],0);
  report.launches.at(-1).guard = guard;
  await app.close(); app = undefined;
}
async function size(width, height) {
  await app.evaluate(({BrowserWindow}, value) => BrowserWindow.getAllWindows()[0].setContentSize(value.width,value.height), {width,height});
  await page.waitForFunction(value => innerWidth === value.width && innerHeight === value.height, {width,height});
}
async function paper() {
  await productEntry(page,'teaching').click();
  await page.getByTestId('teaching-page-navigation').getByTestId('hub-entry-paper').click();
  await page.getByTestId('paper-basket-stage-select').and(page.locator(':enabled')).waitFor();
}
async function shot(name) {
  const file = path.join(context.root, name+'.png'); await page.screenshot({path:file});
  report.screens.push({scenario:context.name, file, sha256:sha256(fs.readFileSync(file))});
}
async function visible(control, width, height) {
  await control.scrollIntoViewIfNeeded(); const box = await control.boundingBox();
  assert(box && box.x >= 0 && box.y >= 0 && box.x+box.width <= width+1 && box.y+box.height <= height+1);
}
async function configure(title) {
  await dialog().waitFor();
  for (const [key,value] of Object.entries({title,subject:'数学',grade:'初二'})) {
    await dialog().getByTestId('paper-practice-'+key).fill(value);
  }
}
async function loseReply(channel) {
  await app.evaluate(({ipcMain}, channel) => {
    const original = ipcMain._invokeHandlers.get(channel); if (!original) throw Error('Missing original channel');
    const fault = {channel, original, once:true, requests:[]}; globalThis.__paperSourceFault = fault;
    ipcMain.removeHandler(channel);
    ipcMain.handle(channel, async (...args) => {
      const result = await original(...args);
      const input = args[1]; fault.requests.push({requestId:input.requestId, digest:input.expectedDigest, ok:result?.ok});
      if (fault.once && (result?.ok || result?.resources)) {fault.once=false; throw Error('QA_REAL_COMMIT_REPLY_LOST_ONCE');}
      return result;
    });
  }, channel);
}
async function faultRequests(key) {
  const requests = await app.evaluate(() => globalThis.__paperSourceFault.requests);
  assert.equal(requests.length,2); assert(requests[0][key]); assert.equal(requests[0][key],requests[1][key]);
  context.requests = requests; save();
}
async function chooseUpload(file) {
  await app.evaluate(({dialog}, file) => {
    globalThis.__paperSourceChooser = {original:dialog.showOpenDialog, calls:0};
    dialog.showOpenDialog = async function (...args) {
      const original = globalThis.__paperSourceChooser.original, options = args.at(-1);
      if (options?.title !== '选择教学资料' || !options.properties?.includes('openFile')) return original.apply(this,args);
      globalThis.__paperSourceChooser.calls++;
      dialog.showOpenDialog = original;
      return {canceled:!file, filePaths:file ? [file] : []};
    };
  }, file);
  try {
    await page.getByTestId('materials-import').click();
    await page.getByTestId('materials-import').and(page.locator(':enabled')).waitFor();
    assert.equal(await app.evaluate(() => globalThis.__paperSourceChooser.calls),1);
  } finally {
    await app.evaluate(({dialog}) => {dialog.showOpenDialog=globalThis.__paperSourceChooser.original; delete globalThis.__paperSourceChooser;});
  }
}
try {
  verify(); await launch('normal'); await paper();
  const ownerCount = read('SELECT COUNT(*) AS n FROM ai_conversation_sessions')[0].n;
  assert.equal(baskets().length,0);
  for (const [width,height] of [[1366,768],[1920,1080],[800,768]]) {
    await size(width,height);
    for (const id of ['paper-paste-open','paper-basket-requirements','paper-basket-reference']) {
      const control=page.getByTestId(id); assert(await control.isEnabled()); await visible(control,width,height);
    }
    await shot('source-actions-'+width);
    await page.getByTestId('paper-paste-open').focus(); await page.keyboard.press('Enter');
    await page.getByTestId('paper-paste-text').fill('尚未保存的教师原文');
    assert.equal(await page.getByTestId('paper-basket-new').isDisabled(),true);
    assert.equal(await page.getByTestId('paper-basket-reference').isDisabled(),true);
    await productEntry(page,'materials').click();
    await page.getByTestId('desktop-navigation-notice').waitFor();
    await page.getByTestId('paper-paste-text').waitFor();
    await visible(page.getByTestId('paper-paste-cancel'),width,height); await shot('paste-review-'+width);
    await page.getByTestId('paper-paste-text').focus(); await page.keyboard.press('Escape');
    await page.getByTestId('paper-paste-panel').waitFor({state:'hidden'});
    await page.waitForFunction(() => document.activeElement?.getAttribute('data-testid') === 'paper-paste-open');
  }
  assert.equal(resources().length,0); assert.equal(baskets().length,0);
  assert.equal(read('SELECT COUNT(*) AS n FROM ai_conversation_sessions')[0].n,ownerCount);
  check('All source entries and keyboard paste/cancel are reachable at three sizes; unsaved paste guards creation/navigation and writes nothing');
  await size(1366,768);
  await page.getByTestId('paper-basket-reference').click(); await configure('首屏教师创建草稿');
  await page.keyboard.press('Escape'); await dialog().waitFor({state:'hidden'});
  assert.equal(baskets().length,0);
  await page.getByTestId('paper-basket-requirements').and(page.locator(':enabled')).waitFor();
  await page.getByTestId('paper-basket-requirements').click();
  assert.equal(await dialog().getByTestId('paper-practice-title').inputValue(),'首屏教师创建草稿');
  assert.match(await dialog().getByTestId('paper-source-creation-context').textContent(),/编辑出题方案/);
  await dialog().getByTestId('paper-basket-create').click(); await dialog().waitFor({state:'hidden'});
  await page.getByTestId('paper-plan-save').waitFor();
  assert.equal(baskets().length,1); assert.equal(baskets()[0].purpose,'practice'); assert.equal(baskets()[0].entries.length,0);
  await page.getByTestId('paper-plan-save').click(); await page.getByTestId('paper-plan-status').waitFor();
  assert.equal(baskets()[0].fulfillment.status,'draft'); assert.equal(baskets()[0].entries.length,0);
  await shot('requirements-real-empty-practice');
  check('Cancel preserves teacher creation fields and a new source intent; confirmed empty practice opens and saves the real requirement plan');
  await close();

  await launch('paste'); await paper();
  await page.getByTestId('paper-library-query').fill('首屏粘贴');
  await page.getByTestId('paper-paste-open').click();
  const text='学科：数学\n年级：初二\n知识点：有理数\n题型：选择题\n难度：easy\n2. 首屏粘贴，计算 $2+3$。\nA. 4\nB. 5\n答案：B\n解析：两数相加得5。\n12. 计算 $3+4$。\nA. 6\nB. 7\n答案：B\n解析：两数相加得7。';
  await page.getByTestId('paper-paste-text').fill(text);
  await page.getByTestId('paper-paste-preview').click(); await page.getByTestId('paper-paste-preview-list').waitFor();
  assert.equal(await page.getByTestId('paper-paste-question').count(),2);
  assert.equal(await page.getByTestId('paper-paste-save').isDisabled(),true);
  const confirmation = page.getByTestId('paper-paste-check');
  const checkbox = confirmation.getByRole('checkbox');
  assert.equal(await checkbox.evaluate(node => node.tagName === 'INPUT' && node.type === 'checkbox'),true);
  await confirmation.locator('[data-slot="checkbox-control"]').click();
  assert.equal(await checkbox.isChecked(),true);
  await checkbox.focus(); await page.keyboard.press('Space'); assert.equal(await checkbox.isChecked(),false);
  await page.keyboard.press('Space'); assert.equal(await checkbox.isChecked(),true);
  await loseReply('materials:paste-import'); await page.getByTestId('paper-paste-save').click();
  await page.getByTestId('paper-paste-error').waitFor(); assert.equal(resources().length,1);
  assert.equal(await page.getByTestId('paper-paste-cancel').isDisabled(),true);
  await page.getByTestId('paper-paste-save').click(); await page.getByTestId('paper-paste-saved').waitFor();
  await faultRequests('digest'); assert.equal(resources().length,1); assert.equal(baskets().length,0);
  const resource = resources()[0]; assert.equal(fs.readFileSync(resource.local_path,'utf8'),text);
  await shot('paste-import-real-receipt');
  await page.getByTestId('paper-paste-materials').click(); await page.getByTestId('materials-workspace').waitFor();
  await page.getByTestId('desktop-back').click(); await page.getByTestId('paper-library-query').waitFor();
  assert.equal(await page.getByTestId('paper-library-query').inputValue(),'首屏粘贴');
  assert.equal(baskets().length,0); assert.equal(resources().length,1);
  check('Before any basket, real paste preview/teacher check/import survives one lost commit reply, deduplicates, and returns from materials with filters');
  await close(); await launch('paste',true); await paper();
  assert.equal(await page.getByTestId('paper-paste-panel').count(),0); assert.equal(await dialog().count(),0);
  assert.equal(resources().length,1); assert.equal(fs.readFileSync(resources()[0].local_path,'utf8'),text);
  assert.equal(baskets().length,0);
  check('Cold startup preserves real pasted material and never replays a transient source panel or creates a basket'); await close();

  await launch('reference'); await paper();
  await page.getByTestId('paper-library-query').fill('参考首屏');
  await page.getByTestId('paper-paste-open').click(); await page.getByTestId('paper-source-upload').click();
  await page.getByTestId('materials-workspace').waitFor(); await chooseUpload(''); assert.equal(resources().length,0);
  await page.getByTestId('desktop-back').click(); await page.getByTestId('paper-library-query').waitFor();
  assert.equal(await page.getByTestId('paper-library-query').inputValue(),'参考首屏'); assert.equal(baskets().length,0);
  check('Upload entry uses original materials navigation and native picker; picker cancel writes no material or basket and preserves browsing');
  await page.getByTestId('paper-paste-open').click(); await page.getByTestId('paper-source-upload').click();
  await page.getByTestId('materials-workspace').waitFor();
  const file=path.join(context.root,'source-reference.txt');
  const original='试卷名称：首屏参考卷\n学科：数学\n年级：初二\n考试时间：45分钟\n满分：10分\n一、选择题（共2题，每题5分）\n1. 计算2+3。\nA.4\nB.5\n答案：B\n解析：2+3=5。\n2. 计算3+4。\nA.6\nB.7\n答案：B\n解析：3+4=7。';
  fs.writeFileSync(file,original); context.sourceSha256=sha256(fs.readFileSync(file));
  await chooseUpload(file);
  await page.waitForFunction(async () => {
    const result=await window.omniEdu.listMaterials({schemaVersion:'xiaozhi.materials.v1',query:'',offset:0});
    return result.resources.some(row=>row.chunkCount>0);
  });
  await page.getByTestId('desktop-back').click(); await page.getByTestId('paper-basket-reference').and(page.locator(':enabled')).waitFor();
  await page.getByTestId('paper-basket-reference').click(); await configure('首屏参考练习');
  await dialog().getByTestId('paper-basket-create').click(); await dialog().waitFor({state:'hidden'});
  await page.getByTestId('paper-reference-source').waitFor();
  assert.equal(baskets().length,1); assert.equal(baskets()[0].entries.length,0);
  await page.getByTestId('paper-reference-source').getByRole('button',{name:'提取并核对',exact:true}).click();
  await page.getByTestId('paper-reference-coverage').waitFor();
  assert.match(await page.getByTestId('paper-reference-input-title').inputValue(),/首屏参考卷/);
  assert.equal(baskets()[0].entries.length,0); assert.equal(resources().length,1);
  assert.equal(sha256(fs.readFileSync(file)),context.sourceSha256);
  await shot('reference-extracted-with-empty-practice');
  await page.getByTestId('paper-reference-cancel').click(); await page.getByTestId('paper-reference-panel').waitFor({state:'hidden'});
  await page.waitForFunction(() => document.activeElement?.getAttribute('data-testid') === 'paper-basket-reference');
  check('An empty real practice can read and extract an actual imported reference, retain its exact original, cancel and restore trigger focus'); await close();

  await launch('unknown-create'); await paper(); await page.getByTestId('paper-basket-requirements').click(); await configure('来源未知回复练习');
  await loseReply('education:paper-basket-v2-create'); await dialog().getByTestId('paper-basket-create').click();
  await dialog().getByTestId('paper-basket-create-error').waitFor(); assert.equal(baskets().length,1);
  await dialog().getByRole('button',{name:'重试同一请求',exact:true}).click(); await dialog().waitFor({state:'hidden'});
  await page.getByTestId('paper-plan-save').waitFor(); await faultRequests('requestId');
  assert.equal(baskets().length,1); assert.equal(baskets()[0].entries.length,0);
  check('A lost real creation reply recovers the same request and opens the intended requirement workflow exactly once'); await close();

  await launch('cancel-unknown'); await paper(); await page.getByTestId('paper-basket-reference').click(); await configure('取消来源交接练习');
  await loseReply('education:paper-basket-v2-create'); await dialog().getByTestId('paper-basket-create').click();
  await dialog().getByTestId('paper-basket-create-error').waitFor();
  context.unknownFocus = await page.evaluate(() => ({tag:document.activeElement?.tagName,
    testId:document.activeElement?.getAttribute('data-testid'), withinDialog:!!document.activeElement?.closest('[role="dialog"]')}));
  assert.equal(context.unknownFocus.withinDialog,true,'Unknown-result recovery must retain keyboard focus in the actual modal');
  assert.equal(context.unknownFocus.tag,'BUTTON');
  await page.keyboard.press('Escape'); await dialog().waitFor({state:'hidden'});
  await page.getByTestId('paper-basket-error').getByRole('button',{name:'重试同一请求',exact:true}).click();
  await page.getByTestId('paper-basket-summary').waitFor(); await faultRequests('requestId');
  assert.equal(await page.getByTestId('paper-reference-panel').count(),0);
  assert.equal(await page.getByTestId('paper-plan-save').isVisible(),false);
  assert.equal(baskets().length,1); assert.equal(baskets()[0].entries.length,0);
  check('Canceling the source handoff before unknown-create recovery keeps the committed empty practice and does not reopen any canceled source'); await close();
  await launch('cancel-unknown',true); await paper();
  assert.equal(await page.getByTestId('paper-reference-panel').count(),0);
  assert.equal(await page.getByTestId('paper-plan-save').isVisible(),false);
  assert.equal(await dialog().count(),0); assert.equal(baskets().length,1); assert.equal(baskets()[0].entries.length,0);
  check('Cold recovery retains the verified empty practice without replaying the canceled source intent'); await close();
  assert.deepEqual(report.errors,[]); verify(); report.success=true;
} catch (error) {
  report.failure={message:error.message,stack:String(error.stack)};
  if (page && !page.isClosed()) await shot('failure').catch(()=>{});
  process.exitCode=1;
} finally {
  clearTimeout(deadline);
  try {await app?.close(); report.closed=true;} catch (error) {report.success=false;report.closeFailure=String(error);process.exitCode=1;}
  report.elapsedMs=Date.now()-started;
  if (report.elapsedMs>240000) {report.success=false;report.budgetExceeded=true;process.exitCode=1;}
  save(); console.log(JSON.stringify({success:report.success, output, checks:report.checks.length, failure:report.failure}));
}
