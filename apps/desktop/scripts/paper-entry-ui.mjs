import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {spawn} from 'node:child_process';
import {_electron as electron} from 'playwright';
import {fingerprint, sha256} from './acceptance/evidence.mjs';
import {assertIsolatedPiMain} from './acceptance/build-root.mjs';
import {continuationBootstrap, continuationGuardRead} from './acceptance/paper-adaptation-continuation.mjs';
import {productEntry} from './product-navigation.mjs';

const desktop = fileURLToPath(new URL('..', import.meta.url));
const args = process.argv.slice(2);
assert.equal(args.length, 2);
assert(args.includes('--run-ui'));
const argument = args.find(value => value.startsWith('--pins='));
assert(argument);
const owned = fs.realpathSync(path.join(desktop, 'test-results'));
const pinFile = fs.realpathSync(path.resolve(desktop, argument.slice(7)));
assert(pinFile.startsWith(owned + path.sep));
const pins = JSON.parse(fs.readFileSync(pinFile));
assert(fs.realpathSync(pins.buildRoot).startsWith(owned + path.sep));
const output = fs.mkdtempSync(path.join(owned, 'paper-first-entry-'));
const data = path.join(output, 'data'), profile = path.join(output, 'profile');
fs.mkdirSync(data);
fs.mkdirSync(profile);
const main = path.join(pins.buildRoot, 'main/index.js');
const bootstrap = path.join(output, 'bootstrap.cjs');
fs.writeFileSync(bootstrap, continuationBootstrap({main, profile}));
const report = {success:false, output, pins, checks:[], screens:[], errors:[], launches:[],
  budget:{launches:2,totalMs:180000,http:0,models:0},
  scope:'Manual synthetic teacher question entered through formal UI; actual SQLite, canonical read-only browsing, official create dialog, original basket writes and cold restart. Zero model requests.'};
const save = () => fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
const check = name => {report.checks.push(name); save();};
const read = (query, values=[]) => {
  const db = new DatabaseSync(path.join(data, 'app.db'), {readOnly:true});
  try {return db.prepare(query).all(...values).map(row=>({...row}));}
  finally {db.close();}
};
const verify = () => {
  assert.equal(fingerprint(path.join(desktop, 'src')).sha256, pins.source);
  assert.equal(fingerprint(pins.buildRoot).sha256, pins.build);
};
const env = {...process.env};
for (const key of Object.keys(env)) {
  if (/KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL/i.test(key) || key.startsWith('OMNI_EDU_') ||
      ['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL'].includes(key)) delete env[key];
}
Object.assign(env, {NODE_ENV:'development', OMNI_EDU_DATA_ROOT:data,
  OMNI_EDU_REPO_ROOT:path.resolve(desktop, '../..'), OMNI_EDU_XIAOZHI_PI:'1', OMNI_EDU_E2E_VISIBLE:'1'});
let app, page;
const started = Date.now();
const deadline = setTimeout(() => {
  report.budgetExceeded = true;
  save();
  if (app) spawn('taskkill.exe', ['/PID',String(app.process().pid),'/T','/F'], {windowsHide:true,stdio:'ignore'});
}, 180000);
async function launch() {
  assert(report.launches.length < 2);
  app = await electron.launch({args:[bootstrap, '--user-data-dir=' + profile, '--force-device-scale-factor=1'],
    cwd:output, env, timeout:30000});
  page = await app.firstWindow({timeout:30000});
  page.setDefaultTimeout(12000);
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
async function paper() {
  await productEntry(page,'teaching').click();
  await page.getByTestId('teaching-page-navigation').getByTestId('hub-entry-paper').click();
  await page.getByTestId('paper-basket-workspace').waitFor();
}
async function shot(name) {
  const file = path.join(output,name+'.png');
  await page.screenshot({path:file});
  report.screens.push({file,sha256:sha256(fs.readFileSync(file))});
}
async function guard() {
  const result = await app.evaluate(continuationGuardRead,true);
  for (const key of ['networkAttempts','modelAttempts','rendererErrors']) assert.equal(result[key],0);
  report.launches.at(-1).guard = result;
}
try {
  verify();
  await launch();
  await productEntry(page,'teaching').click();
  await page.getByTestId('teaching-page-navigation').getByTestId('hub-entry-question_notebook').click();
  await page.getByTestId('question-notebook-new').click();
  await page.getByTestId('question-notebook-new-grade').fill('初二');
  await page.getByTestId('question-notebook-new-knowledge-point').fill('加法');
  const stem = 'UI 首次组卷验收：计算 2 + 3。';
  await page.getByTestId('question-notebook-new-stem').fill(stem);
  await page.getByTestId('question-notebook-new-answer').fill('5');
  await page.getByTestId('question-notebook-new-analysis').fill('2 + 3 = 5。人工合成验收文字。');
  await page.getByTestId('question-notebook-create-question').click();
  await page.getByTestId('question-notebook-stem').filter({hasText:stem}).waitFor();
  const questions = read('SELECT * FROM question_bank_items');
  assert.equal(questions.length,1);
  const question = questions[0];
  assert.equal(question.stem,stem);
  assert.equal(question.source_kind,'local_bank');
  report.questionId = question.id;
  check('Canonical question is created once through the existing teacher UI');
  await paper();
  await page.getByTestId('paper-library-results').waitFor();
  const selectTab = page.getByTestId('paper-basket-stage-select');
  assert.equal(await selectTab.isEnabled(), true);
  assert.equal(await selectTab.getAttribute('aria-selected'), 'true');
  await selectTab.focus();
  await page.keyboard.press('ArrowRight');
  await page.getByTestId('paper-basket-stage-saved').waitFor();
  await page.keyboard.press('Home');
  assert.equal(await selectTab.evaluate(element => document.activeElement === element), true);
  assert.equal(await selectTab.getAttribute('aria-selected'), 'true');
  await page.getByTestId('paper-library-results').waitFor();
  const tabStyle = () => selectTab.evaluate(element => {
    const style = getComputedStyle(element);
    return {color:style.color, background:style.backgroundColor, outline:style.outline,
      focusVisible:element.matches(':focus-visible'), selected:element.getAttribute('aria-selected')};
  });
  report.tabStates = {keyboardFocus:await tabStyle()};
  await selectTab.hover();
  report.tabStates.hover = await tabStyle();
  await shot('first-entry-tab-keyboard-hover');
  check('First-entry select tab is enabled and keyboard navigation returns to the real question browser');
  const row = page.getByTestId('paper-library-question').filter({has:page.getByTestId('paper-basket-question-stem').filter({hasText:stem})});
  await row.waitFor();
  assert.equal(await row.getAttribute('data-question-id'),question.id);
  assert.equal(read('SELECT COUNT(*) AS count FROM paper_baskets')[0].count,0);
  assert.equal(await page.getByTestId('paper-basket-create-dialog').count(),0);
  check('First entry reads complete real questions without creating a basket or opening configuration');
  const query = page.getByTestId('paper-library-query');
  await query.fill('ui-entry-definitely-no-match-742');
  await page.getByRole('heading',{name:'没有匹配的题目',exact:true}).waitFor();
  await query.fill('');
  await row.waitFor();
  check('Actual read-only search and clear restore the same canonical question');
  report.libraryLayouts = [];
  for (const [width, height] of [[1366,768], [1920,1080], [800,768]]) {
    await size(width, height);
    const knowledgePoint = page.getByTestId('paper-library-knowledge-point');
    assert(await knowledgePoint.isVisible(), 'Knowledge point filter must remain reachable at ' + width);
    const bounds = await knowledgePoint.boundingBox();
    assert(bounds && bounds.x >= 0 && bounds.y >= 0 &&
      bounds.x + bounds.width <= width && bounds.y + bounds.height <= height);
    await knowledgePoint.fill('ui-entry-no-such-knowledge-point-742');
    await page.getByRole('heading', {name:'没有匹配的题目', exact:true}).waitFor();
    await knowledgePoint.fill('加法');
    await row.waitFor();
    await knowledgePoint.fill('');
    await row.waitFor();
    const layout = await page.getByTestId('paper-library-browser').evaluate(element => {
      const css = getComputedStyle(element);
      const rectangles = [...element.children].map(child => {
        const rect = child.getBoundingClientRect();
        return {x:rect.x, y:rect.y, width:rect.width, height:rect.height};
      });
      return {columns:css.gridTemplateColumns, rectangles,
        scrollWidth:element.scrollWidth, clientWidth:element.clientWidth};
    });
    assert(layout.scrollWidth <= layout.clientWidth);
    assert.equal(layout.rectangles[0].width, width === 1920 ? 210 : width === 800 ? 135 : 170);
    if (width === 800) {
      assert(layout.rectangles[2].y >= layout.rectangles[1].y + layout.rectangles[1].height - 1);
      assert(layout.rectangles[2].height <= 125);
    } else {
      assert.equal(layout.rectangles[2].width, width === 1920 ? 270 : 230);
    }
    report.libraryLayouts.push({width, height, ...layout});
    assert.equal(read('SELECT COUNT(*) AS count FROM paper_baskets')[0].count, 0);
    await shot('library-browse-' + width);
  }
  check('Responsive knowledge point filtering preserves the same source question and never creates a basket');
  await size(1366,768);
  await page.getByTestId('paper-library-create').click();
  const dialog = page.getByTestId('paper-basket-create-dialog');
  await dialog.waitFor();
  await dialog.getByTestId('paper-practice-title').fill('UI 保留输入练习');
  for (const [width,height] of [[1366,768],[1920,1080],[800,768]]) {
    await size(width,height);
    const button = await dialog.getByTestId('paper-basket-create').boundingBox();
    assert(button && button.x >= 0 && button.y >= 0 && button.x+button.width <= width && button.y+button.height <= height);
    await shot('create-dialog-'+width);
  }
  await page.keyboard.press('Escape');
  await dialog.waitFor({state:'hidden'});
  assert.equal(read('SELECT COUNT(*) AS count FROM paper_baskets')[0].count,0);
  check('Official dialog footer is reachable at all sizes and Escape creates no business records');
  await size(1366,768);
  await page.getByTestId('paper-basket-new').click();
  await dialog.waitFor();
  assert.equal(await dialog.getByTestId('paper-practice-title').inputValue(),'UI 保留输入练习');
  check('Closing and reopening preserves the unfinished create input');
  await dialog.getByTestId('paper-basket-create').click();
  await dialog.waitFor({state:'hidden'});
  await page.getByTestId('paper-candidate-browser').waitFor();
  const candidate = page.getByTestId('paper-basket-candidate').filter({has:page.getByTestId('paper-basket-question-stem').filter({hasText:stem})});
  await candidate.waitFor();
  await candidate.getByTestId('paper-basket-add').click();
  await page.waitForFunction(() => document.querySelector('[data-testid="paper-basket-add"]')?.textContent.includes('已加入题篮'));
  const baskets = read('SELECT id,data_json FROM paper_baskets');
  assert.equal(baskets.length,1);
  const basket = JSON.parse(baskets[0].data_json);
  assert.equal(basket.entries.length,1);
  assert.equal(basket.entries[0].questionId,question.id);
  assert.deepEqual(read('SELECT * FROM question_bank_items'),questions);
  report.basketId = baskets[0].id;
  check('Explicit save and the original Add action persist exactly one member without changing its source');
  await shot('basket-with-canonical-question');
  await guard();
  await app.close(); app=undefined;
  await launch();
  await paper();
  await page.waitForFunction(id=>document.querySelector('[data-testid="paper-basket-workspace"]')?.getAttribute('data-basket-id')===id,report.basketId);
  const restored = JSON.parse(read('SELECT data_json FROM paper_baskets WHERE id=?',[report.basketId])[0].data_json);
  assert.equal(restored.entries.length,1);
  assert.equal(restored.entries[0].questionId,question.id);
  assert.deepEqual(read('SELECT * FROM question_bank_items'),questions);
  assert.equal(read('SELECT COUNT(*) AS count FROM ai_agent_runs')[0].count,0);
  await guard();
  check('Cold startup restores the same basket and source without model replay');
  assert.deepEqual(report.errors,[]);
  verify();
  report.success=true;
} catch (error) {
  report.failure={message:error.message,stack:String(error.stack)};
  if (page && !page.isClosed()) await shot('failure').catch(()=>{});
  process.exitCode=1;
} finally {
  clearTimeout(deadline);
  try {await app?.close();report.closed=true;}
  catch (error) {report.success=false;report.closeFailure=String(error);process.exitCode=1;}
  report.elapsedMs=Date.now()-started;
  if(report.elapsedMs>180000){report.success=false;report.budgetExceeded=true;process.exitCode=1;}
  save();
  console.log(JSON.stringify({success:report.success,output,checks:report.checks.length,failure:report.failure}));
}
