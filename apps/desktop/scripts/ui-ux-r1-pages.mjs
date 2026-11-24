import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {_electron as electron} from 'playwright';
import {fingerprint} from './acceptance/evidence.mjs';
import {zeroNetworkBootstrap} from './acceptance/zero-network-bootstrap.mjs';
import {assertIsolatedPiMain} from './acceptance/build-root.mjs';

const desktop = path.resolve(import.meta.dirname, '..');
const mode = process.argv[2];
assert(['baseline', 'verification'].includes(mode));
const delivery = path.resolve(desktop, '../../acceptance/ui-ux-r1-20261124');
const output = fs.mkdtempSync(path.join(delivery, 'evidence', mode + '-pages-'));
const data = path.join(desktop, 'test-results', path.basename(output), 'data');
const profile = path.join(desktop, 'test-results', path.basename(output), 'profile');
for (const directory of [data, profile]) fs.mkdirSync(directory, {recursive: true});
const main = path.join(desktop, 'out/main/index.js');
const before = fingerprint(path.join(desktop, 'src'));
const build = fingerprint(path.join(desktop, 'out'));
const bootstrap = zeroNetworkBootstrap({output, main, profile, counter: '__uiRoneHttp'});
const env = {...process.env, OMNI_EDU_DATA_ROOT: data, OMNI_EDU_REPO_ROOT: path.resolve(desktop, '../..'), NODE_ENV: 'development'};
for (const key of Object.keys(env)) if (/KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL/i.test(key) || key.startsWith('OMNI_EDU_E2E_') || ['ELECTRON_RUN_AS_NODE', 'ELECTRON_RENDERER_URL', 'NODE_OPTIONS'].includes(key)) delete env[key];
const report = {success: false, mode, output, data, profile, main, source: before.sha256, build: build.sha256,
  scope: 'Real production Electron with own npm-ci dependencies, clean isolated profile and fictional student created by UI. HTTP forbidden. No provider responses or teaching outputs are simulated.',
  pages: [], errors: [], settings: [], cssom: [], unavailable: []};
const save = () => fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
let app, page;
async function nav(space) {
  const ids = {ai: 'nav-ai-workspace', knowledge: 'nav-knowledge', teaching: 'nav-teaching', student_workbench: 'nav-student-workbench', my_tasks: 'nav-my_tasks', settings: 'nav-settings'};
  await page.locator('[data-testid="edu-navigation"]:visible').getByTestId(ids[space]).click();
  await page.locator(`.edu-shell[data-view="${space}"]:visible`).waitFor();
}
async function capture(id, state = 'current') {
  for (const [width, height] of [[1366, 768], [1920, 1080], [800, 768]]) {
    await app.evaluate(({BrowserWindow}, size) => BrowserWindow.getAllWindows()[0].setContentSize(...size), [width, height]);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const viewport = await page.evaluate(() => ({width: innerWidth, height: innerHeight, dpr: devicePixelRatio,
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1}));
    const filename = `${id}-${width}-${state}.png`;
    await page.screenshot({path: path.join(output, filename)});
    const sample = {id, state, viewport, screenshot: filename,
      headings: await page.locator('.edu-shell:visible h1,.edu-shell:visible h2').allTextContents()};
    report.pages.push(sample); save();
  }
}
try {
  app = await electron.launch({args: [bootstrap, '--user-data-dir=' + profile], env, cwd: desktop, timeout: 60000});
  page = await app.firstWindow(); page.setDefaultTimeout(15000);
  page.on('pageerror', error => {report.errors.push(String(error)); save();});
  await page.getByTestId('office-prompt-input').waitFor({timeout: 60000});
  report.identity = await assertIsolatedPiMain(app, main, profile);
  report.pid = app.process().pid;
  report.url = page.url();
  for (const id of ['ai', 'my_tasks', 'knowledge', 'teaching']) {await nav(id); await capture(id);}
  for (const id of ['artifacts', 'notebook', 'book', 'question_notebook', 'paper']) {
    await nav('teaching'); await page.getByTestId('hub-entry-' + id).click();
    await page.locator(`.edu-shell[data-view="${id}"]:visible`).waitFor(); await capture(id);
  }
  await nav('student_workbench'); await capture('student_workbench', 'empty');
  await page.getByTestId('student-create').click();
  await page.getByTestId('student-form-display-name').fill('UI验收学生甲');
  await page.getByTestId('student-form-save').click();
  await page.getByTestId('student-profile-form').waitFor({state: 'hidden'});
  await page.locator('[data-testid^="student-row-"]').filter({hasText: 'UI验收学生甲'}).first().click();
  await capture('student_workbench', 'selected');
  await page.getByTestId('hub-entry-students').click();
  await page.locator('.edu-shell[data-view="students"]:visible').waitFor(); await capture('students');
  for (const id of ['search', 'intake', 'mistakes', 'mastery', 'review', 'analytics']) {
    await page.getByTestId('student-page-navigation').getByTestId('hub-entry-' + id).click();
    await page.locator(`.edu-shell[data-view="${id}"]:visible`).waitFor(); await capture(id);
  }
  await nav('settings'); await capture('settings');
  const sheetMap = new Map();
  const cdp = await page.context().newCDPSession(page);
  cdp.on('CSS.styleSheetAdded', ({header}) => sheetMap.set(header.styleSheetId, header.sourceURL));
  await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
  await page.getByTestId('pi-settings-advanced-toggle').click();
  for (const id of ['interface', 'teacher-memory', 'permissions', 'backup', 'skills', 'tools', 'diagnostics', 'capabilities', 'models']) {
    await page.getByTestId('pi-settings-tab-' + id).click();
    await page.locator(`[data-testid="pi-settings-workspace"][data-tab="${id}"]`).waitFor();
    await app.evaluate(({BrowserWindow}) => BrowserWindow.getAllWindows()[0].setContentSize(1366, 768));
    await page.screenshot({path: path.join(output, `settings-${id}.png`)});
    report.settings.push({id, screenshot: `settings-${id}.png`, text: (await page.getByTestId('pi-settings-main').innerText()).slice(0, 1800)});
    save();
  }
  for (const state of ['normal', 'hover', 'focus']) {
    const target = page.getByTestId('pi-settings-tab-interface');
    await page.mouse.move(1, 1); await target.evaluate(element => element.blur());
    if (state === 'hover') await target.hover();
    if (state === 'focus') await target.focus();
    const computed = await target.evaluate(element => {
      const css = getComputedStyle(element);
      return {background: css.backgroundColor, color: css.color, outline: css.outline, font: css.font, selected: element.getAttribute('aria-current')};
    });
    const {root} = await cdp.send('DOM.getDocument');
    const {nodeId} = await cdp.send('DOM.querySelector', {nodeId: root.nodeId, selector: '[data-testid="pi-settings-tab-interface"]'});
    const matched = await cdp.send('CSS.getMatchedStylesForNode', {nodeId});
    report.cssom.push({state, computed, rules: matched.matchedCSSRules.map(({rule}) => ({selector: rule.selectorList.text,
      origin: rule.origin, source: sheetMap.get(rule.styleSheetId), layers: rule.layers, properties: rule.style.cssProperties.filter(p => /color|background|outline|font/.test(p.name))}))});
  }
  report.spacing = await page.locator('[data-settings-page="models"], [data-testid="pi-settings-main"]').first().evaluate(element => {
    const style = getComputedStyle(element); return {space24: style.getPropertyValue('--space-24'), space40: style.getPropertyValue('--space-40')};
  });
  report.httpAttempts = await app.evaluate(() => globalThis.__uiRoneHttp);
  assert.equal(fingerprint(path.join(desktop, 'src')).sha256, before.sha256);
  assert.equal(fingerprint(path.join(desktop, 'out')).sha256, build.sha256);
  report.success = true;
} catch (error) {
  report.failure = String(error.stack || error); process.exitCode = 1;
  if (page && !page.isClosed()) {await page.screenshot({path: path.join(output, 'failure.png')}).catch(() => {});
    fs.writeFileSync(path.join(output, 'failure-body.txt'), await page.locator('body').innerText().catch(() => 'unavailable'));}
} finally {
  if (app) await app.close(); save(); console.log(JSON.stringify({success: report.success, output, pages: report.pages.length, failure: report.failure}));
}
