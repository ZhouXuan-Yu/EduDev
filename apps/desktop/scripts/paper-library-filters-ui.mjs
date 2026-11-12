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
const output = fs.mkdtempSync(path.join(owned, 'paper-library-filters-'));
const data = path.join(output, 'data'), profile = path.join(output, 'profile');
fs.mkdirSync(data); fs.mkdirSync(profile);
const main = path.join(pins.buildRoot, 'main/index.js');
const bootstrap = path.join(output, 'bootstrap.cjs');
fs.writeFileSync(bootstrap, continuationBootstrap({main, profile}));
const key = 'edudev.paper-library-view.v1';
const report = {success:false, output, pins, checks:[], screens:[], errors:[], launches:[],
  scope:'Actual isolated Electron, manual synthetic teacher input and an owned numbered TXT through the original importer, real SQLite readback and optional preference fault injection. Native chooser selects only that owned fixture. No fake OCR/AI or model requests.'};
const save = () => fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
const check = name => {report.checks.push(name); save();};
const read = (query, values=[]) => {
  const db = new DatabaseSync(path.join(data, 'app.db'), {readOnly:true});
  try {return db.prepare(query).all(...values).map(row=>({...row}));} finally {db.close();}
};
const verify = () => {
  assert.equal(fingerprint(path.join(desktop, 'src')).sha256, pins.source);
  assert.equal(fingerprint(pins.buildRoot).sha256, pins.build);
};
const env = {...process.env};
for (const name of Object.keys(env)) {
  if (/KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL/i.test(name) || name.startsWith('OMNI_EDU_') ||
      ['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL'].includes(name)) delete env[name];
}
Object.assign(env, {NODE_ENV:'development', OMNI_EDU_DATA_ROOT:data,
  OMNI_EDU_REPO_ROOT:path.resolve(desktop, '../..'), OMNI_EDU_XIAOZHI_PI:'1', OMNI_EDU_E2E_VISIBLE:'1'});
let app, page;
const started = Date.now();
const deadline = setTimeout(() => {
  report.budgetExceeded = true; save();
  if (app) spawn('taskkill.exe', ['/PID',String(app.process().pid),'/T','/F'], {windowsHide:true,stdio:'ignore'});
}, 240000);
async function launch() {
  assert(report.launches.length < 2);
  app = await electron.launch({args:[bootstrap, '--user-data-dir=' + profile, '--force-device-scale-factor=1'], cwd:output, env, timeout:30000});
  page = await app.firstWindow({timeout:30000}); page.setDefaultTimeout(12000);
  page.on('pageerror', error => report.errors.push({kind:'page',hash:sha256(String(error))}));
  page.on('console', message => {if (message.type() === 'error') report.errors.push({kind:'console',hash:sha256(message.text())});});
  await page.getByTestId('xiaozhi-pi-workspace').waitFor({state:'attached'});
  report.launches.push({pid:app.process().pid, identity:await assertIsolatedPiMain(app, main, profile)});
  await size(1366,768);
}
async function size(width,height) {
  await app.evaluate(({BrowserWindow}, value) => BrowserWindow.getAllWindows()[0].setContentSize(value.width,value.height), {width,height});
  await page.waitForFunction(value=>innerWidth===value.width&&innerHeight===value.height, {width,height});
}
async function tab(name) {
  await productEntry(page,'teaching').click();
  await page.getByTestId('teaching-page-navigation').getByTestId('hub-entry-' + name).click();
}
async function paper() {await tab('paper'); await settled();}
async function settled() {
  await page.getByTestId('paper-library-results').waitFor();
  await page.waitForFunction(() => document.querySelector('[data-testid="paper-library-results"]')?.getAttribute('aria-busy') === 'false');
}
async function count(expected) {
  await page.waitForFunction(n => document.querySelectorAll('[data-testid="paper-library-question"]').length === n &&
    document.querySelector('[data-testid="paper-library-results"]')?.getAttribute('aria-busy') === 'false', expected);
}
async function select(testId, label) {
  await page.getByTestId(testId).click(); await page.getByRole('option', {name:label,exact:true}).click(); await settled();
}
async function advanced() {
  const root = page.getByTestId('paper-library-advanced');
  if (await root.getByRole('button').getAttribute('aria-expanded') !== 'true') await root.getByRole('button').click();
  await page.getByTestId('paper-library-question-number').waitFor();
}
async function reset() {await page.getByTestId('paper-library-reset').click(); await count(12);}
async function shot(name) {
  const file = path.join(output,name+'.png'); await page.screenshot({path:file});
  report.screens.push({file,sha256:sha256(fs.readFileSync(file))});
}
async function guard() {
  const result = await app.evaluate(continuationGuardRead,true);
  for (const name of ['networkAttempts','modelAttempts','rendererErrors']) assert.equal(result[name],0);
  report.launches.at(-1).guard = result;
}
try {
  verify(); await launch(); await tab('question_notebook');
  for (let index=0; index<13; index++) {
    await page.getByTestId('question-notebook-new').click();
    await page.getByTestId('question-notebook-new-grade').fill('初二');
    await page.getByTestId('question-notebook-new-knowledge-point').fill(index === 0 ? '加法' : '减法');
    await page.getByTestId('question-notebook-new-type').fill(index === 0 ? '填空题' : '选择题');
    await page.getByTestId('question-notebook-new-difficulty').selectOption(index === 0 ? 'hard' : 'easy');
    await page.getByTestId('question-notebook-new-source-kind').selectOption(index === 0 ? 'teacher_resource' : 'local_bank');
    await page.getByTestId('question-notebook-new-stem').fill(`筛选验收 ${String(index).padStart(2,'0')}：计算 2 + 3。${index === 0 ? '苹果' : index === 1 ? '香蕉' : '梨子'}`);
    await page.getByTestId('question-notebook-new-answer').fill('5');
    await page.getByTestId('question-notebook-new-analysis').fill('合成教师验收输入，2 + 3 = 5。');
    await page.getByTestId('question-notebook-create-question').click();
    await page.getByTestId('question-notebook-stem').filter({hasText:`筛选验收 ${String(index).padStart(2,'0')}`}).waitFor();
  }
  const manual = read('SELECT * FROM question_bank_items ORDER BY id');
  assert.equal(manual.length,13);
  const target = manual.find(row=>row.stem.includes('筛选验收 00'));
  report.target = target.id;
  check('Thirteen canonical questions entered through the unchanged teacher creation UI');
  await page.getByTestId('question-notebook-category-toggle').getByRole('button', {name:'分类管理',exact:true}).click();
  await page.getByTestId('question-notebook-category-name').fill('验收分类');
  await page.getByTestId('question-notebook-create-category').click();
  await page.getByTestId('question-notebook-search').fill('筛选验收 00');
  await page.getByTestId('question-notebook-stem').filter({hasText:'筛选验收 00'}).waitFor();
  const chip = page.locator(`[data-testid^="question-notebook-category-${target.id}-"]`).filter({hasText:'验收分类'});
  await chip.click();
  await page.waitForFunction(id=>document.querySelector(`[data-testid^="question-notebook-category-${id}-"]`)?.classList.contains('active'), target.id);
  const category = await chip.getAttribute('data-testid');
  const categoryId = category.slice(`question-notebook-category-${target.id}-`.length);
  report.categoryId = categoryId;
  await paper(); await count(12);
  await page.getByTestId('paper-library-next').click(); await count(1);
  assert.equal(await page.getByTestId('paper-library-question').getAttribute('data-question-id'),target.id);
  check('Real total and twelve-item pagination expose the oldest matching question on page two');
  await page.getByTestId('paper-library-query').fill('苹果'); await count(1);
  assert(await page.getByTestId('paper-library-next').count() === 0);
  await select('paper-library-type','填空题'); await count(1);
  await select('paper-library-difficulty','较难'); await count(1);
  await advanced(); await select('paper-library-source-kind','教师资料'); await count(1);
  await page.getByTestId('paper-library-knowledge-point').fill('加法'); await count(1);
  await page.getByTestId('paper-library-facet-knowledge').focus(); await page.keyboard.press('End');
  assert.equal(await page.getByTestId('paper-library-facet-categories').getAttribute('aria-selected'),'true');
  await page.locator(`[data-testid="paper-library-category"][data-category-id="${categoryId}"]`).click(); await count(1);
  assert.equal(await page.getByTestId('paper-library-question').getAttribute('data-question-id'),target.id);
  check('Query, type, difficulty, source, knowledge and actual category combine through the real query before LIMIT');
  await page.getByTestId('paper-library-question-number').fill('99999'); await count(0);
  assert(await page.getByRole('heading',{name:'没有匹配的题目',exact:true}).isVisible());
  await page.getByTestId('paper-library-question-number').fill(''); await count(1);
  check('An absent original number yields a distinct empty state and clearing it restores the same real question');
  for (const [width,height] of [[1366,768],[1920,1080],[800,768]]) {
    await size(width,height); await count(1);
    const layout = await page.getByTestId('paper-library-browser').evaluate(element=>({
      overflow:element.scrollWidth-element.clientWidth,
      controls:[...element.querySelectorAll('input,button')].filter(el=>el.getClientRects().length).map(el=>{
        const r=el.getBoundingClientRect(); return {id:el.getAttribute('data-testid'),x:r.x,y:r.y,width:r.width,height:r.height};
      })}));
    assert(layout.overflow<=1);
    for (const control of layout.controls) assert(control.x>=0&&control.x+control.width<=width+1);
    report.layouts ??= []; report.layouts.push({width,...layout}); await shot('filters-'+width);
  }
  check('Expanded official filters and category selection remain reachable in three actual Electron sizes');
  await size(1366,768); await tab('notebook'); await paper(); await count(1);
  assert.equal(await page.getByTestId('paper-library-query').inputValue(),'苹果');
  assert.equal(await page.getByTestId('paper-library-facet-categories').getAttribute('aria-selected'),'true');
  assert.equal(await page.locator(`[data-testid="paper-library-category"][data-category-id="${categoryId}"]`).getAttribute('aria-pressed'),'true');
  check('Leaving the page and returning restores all UI preferences without creating a basket');
  await reset();
  const results = page.getByTestId('paper-library-results');
  await results.hover(); await page.mouse.wheel(0,450);
  await page.waitForFunction(storageKey=>JSON.parse(localStorage.getItem(storageKey)).ui.scrollTop>100,key);
  const savedScroll = await page.evaluate(storageKey=>JSON.parse(localStorage.getItem(storageKey)).ui.scrollTop,key);
  await tab('notebook'); await paper(); await count(12);
  await page.waitForFunction(top=>Math.abs(document.querySelector('[data-testid="paper-library-results"]').scrollTop-top)<=1,savedScroll);
  check('User scroll is restored after returning with the same real results');
  await page.getByTestId('paper-library-next').click(); await count(1);
  await guard(); await app.close(); app=undefined; await launch(); await paper(); await count(1);
  assert.equal(await page.getByTestId('paper-library-question').getAttribute('data-question-id'),target.id);
  check('Cold restart restores page two using the owned profile and real SQLite data');
  await page.evaluate(storageKey=>{
    const original=Storage.prototype.setItem;
    window.__paperPreferenceRestore=()=>{Storage.prototype.setItem=original;};
    Storage.prototype.setItem=function(name,value){if(name===storageKey)throw new DOMException('QA quota','QuotaExceededError');return original.call(this,name,value);};
  },key);
  await page.getByTestId('paper-library-query').fill('苹果'); await count(1);
  await page.getByTestId('paper-library-preference-error').waitFor(); await shot('preference-failure');
  await page.evaluate(()=>{window.__paperPreferenceRestore();delete window.__paperPreferenceRestore;});
  await page.getByTestId('paper-library-preference-retry').click();
  await page.getByTestId('paper-library-preference-error').waitFor({state:'hidden'});
  check('Optional preference write failure keeps filtering usable and supports explicit verified retry');
  await reset();
  await page.getByTestId('paper-library-query').fill('苹果');
  await page.getByTestId('paper-library-query').fill('香蕉');
  await page.waitForFunction(()=>document.querySelector('[data-testid="paper-library-question"]')?.textContent.includes('筛选验收 01') &&
    document.querySelector('[data-testid="paper-library-results"]')?.getAttribute('aria-busy') === 'false');
  await count(1);
  check('Rapid changes end on the latest real query without stale result replacement');
  await reset();
  assert.deepEqual(read('SELECT * FROM question_bank_items ORDER BY id'),manual);
  assert.equal(read('SELECT COUNT(*) AS count FROM paper_baskets')[0].count,0);
  assert.equal(read('SELECT COUNT(*) AS count FROM ai_agent_runs')[0].count,0);
  await guard(); assert.deepEqual(report.errors,[]); verify();
  check('Browsing and preference recovery preserve all canonical questions and create no basket or model run');
  const numbered = path.join(output, 'numbered-source.txt');
  const sourceText = '学科：数学\n年级：初二\n知识点：运算\n题型：填空题\n难度：easy\n\n第37题：编号核对，计算 7 + 8，写出结果。\n答案：15\n解析：7 + 8 = 15。\n\n第38题：编号核对，计算 4 + 6，写出结果。\n答案：10\n解析：4 + 6 = 10。\n';
  fs.writeFileSync(numbered, sourceText);
  await productEntry(page,'materials').click();
  await app.evaluate(({dialog},file)=>{
    const original=dialog.showOpenDialog;
    globalThis.__paperNumberChooser={original,calls:0};
    dialog.showOpenDialog=async function(...args){
      const options=args.at(-1);
      if(options?.title!=='选择教学资料'||!options.properties?.includes('openFile'))return original.apply(this,args);
      if(globalThis.__paperNumberChooser.calls++)throw Error('Repeated import chooser');
      dialog.showOpenDialog=original;
      return {canceled:false,filePaths:[file]};
    };
  },numbered);
  try {
    await page.getByTestId('materials-import').click();
    await page.getByTestId('materials-import').and(page.locator(':enabled')).waitFor();
    assert.equal(await app.evaluate(()=>globalThis.__paperNumberChooser.calls),1);
  } finally {
    await app.evaluate(({dialog})=>{dialog.showOpenDialog=globalThis.__paperNumberChooser.original;delete globalThis.__paperNumberChooser;});
  }
  const archiveDeadline=Date.now()+12000;
  let sourceReady=false;
  while(Date.now()<archiveDeadline) {
    sourceReady=await page.evaluate(async()=>{
      const status=await window.omniEdu.getMaterialQuestionStatus();
      const result=await window.omniEdu.listQuestionNotebook({query:'编号核对',questionNumber:'37',limit:20});
      return status.questions>=2 && result.total===1;
    });
    if(sourceReady)break;
    await page.waitForTimeout(100);
  }
  assert.equal(sourceReady,true,'Actual source archive must be published before opening its consumer');
  await tab('question_notebook');
  await page.waitForFunction(()=>document.querySelector('[data-testid="question-notebook-summary"]')?.textContent.includes('共 15 道题'));
  await page.getByTestId('question-notebook-search').fill('编号核对');
  await page.getByTestId('question-notebook-stem').filter({hasText:'计算 7 + 8'}).waitFor();
  const extracted = read("SELECT * FROM question_bank_items WHERE json_valid(archive_json) AND json_extract(archive_json,'$.number')='37'");
  assert.equal(extracted.length,1);
  const sourceQuestion = extracted[0];
  assert.equal(sourceQuestion.source_kind,'teacher_resource');
  assert.equal(JSON.parse(sourceQuestion.archive_json).number,'37');
  report.sourceQuestion = {id:sourceQuestion.id, originalNumber:'37', fileSha256:sha256(fs.readFileSync(numbered))};
  check('Original importer and local text parser preserve a genuine printed question number');
  await page.getByTestId('question-archive-edit-' + sourceQuestion.id).click();
  const editor = page.getByTestId('question-archive-form');
  await editor.getByTestId('question-archive-subject').fill('数学');
  await editor.getByTestId('question-archive-grade').fill('初二');
  await editor.getByTestId('question-archive-knowledgePoint').fill('运算');
  await editor.getByTestId('question-archive-questionType').fill('填空题');
  await editor.getByLabel('难度').selectOption('easy');
  await editor.getByTestId('question-archive-answer').fill('15');
  await editor.getByTestId('question-archive-analysis').fill('7 + 8 = 15。人工核对该验收文本。');
  await editor.getByTestId('question-archive-source-checked').check();
  await editor.getByTestId('question-archive-save').click();
  await editor.waitFor({state:'hidden'});
  const verifiedSource = read('SELECT * FROM question_bank_items WHERE id=?',[sourceQuestion.id])[0];
  assert.equal(JSON.parse(verifiedSource.archive_json).number,'37');
  assert.equal(JSON.parse(verifiedSource.archive_json).sourceChecked,true);
  await paper(); await advanced();
  await page.getByTestId('paper-library-question-number').fill('37'); await count(1);
  await select('paper-library-source-kind','教师资料'); await count(1);
  assert.equal(await page.getByTestId('paper-library-question').getAttribute('data-question-id'),sourceQuestion.id);
  await shot('original-number-positive');
  await select('paper-library-source-kind','本地题库'); await count(0);
  await select('paper-library-source-kind','教师资料'); await count(1);
  check('Exact original number and source kind filter the actual teacher-verified source with positive and negative matches');
  await page.getByTestId('paper-library-reset').click(); await count(12);
  await page.getByTestId('paper-library-query').fill('bad\u0001value');
  await page.getByTestId('paper-library-results').getByRole('alert').waitFor();
  await shot('real-query-error');
  await page.getByTestId('paper-library-reset').click(); await count(12);
  check('Real server validation rejection has a visible error and reset recovers the canonical query');
  assert.deepEqual(read('SELECT * FROM question_bank_items WHERE id=?',[sourceQuestion.id])[0],verifiedSource);
  assert.deepEqual(read('SELECT * FROM question_bank_items ORDER BY id').filter(row=>manual.some(item=>item.id===row.id)),manual);
  assert.equal(fs.readFileSync(numbered,'utf8'),sourceText);
  assert.equal(read('SELECT COUNT(*) AS count FROM paper_baskets')[0].count,0);
  await guard(); assert.deepEqual(report.errors,[]); verify();
  check('Source browse and rejected query preserve the verified question, original file and every manual record');
  report.success=true;
} catch (error) {
  report.failure={message:error.message,stack:String(error.stack)};
  if(page&&!page.isClosed()) {
    report.sourceDiagnostic=await page.evaluate(async()=>({
      actual:await window.omniEdu.listQuestionNotebook({query:'编号核对',limit:20}).then(result=>({total:result.total,ids:result.items.map(row=>row.id)})),
      fields:[...document.querySelectorAll('[data-testid^="question-notebook-"]')].filter(el=>el instanceof HTMLInputElement||el instanceof HTMLSelectElement).map(el=>({id:el.dataset.testid,value:el.value,checked:el.checked})),
      summary:document.querySelector('[data-testid="question-notebook-summary"]')?.textContent,
    })).catch(()=>({unavailable:true}));
  }
  if(page&&!page.isClosed())await shot('failure').catch(()=>{});
  process.exitCode=1;
} finally {
  clearTimeout(deadline);
  try {await app?.close(); report.closed=true;} catch(error){report.success=false;report.closeFailure=String(error);process.exitCode=1;}
  report.elapsedMs=Date.now()-started;
  if(report.elapsedMs>240000){report.success=false;report.budgetExceeded=true;process.exitCode=1;}
  save(); console.log(JSON.stringify({success:report.success,output,checks:report.checks.length,failure:report.failure}));
}
