import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { _electron as electron } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.resolve(root, process.env.UI_EVIDENCE_DIR || 'test-results/ui-goal-20261101/baseline');
fs.mkdirSync(output, { recursive: true });
if (fs.existsSync(path.join(output, 'report.json'))) fs.copyFileSync(path.join(output, 'report.json'), path.join(output, `report-prior-${Date.now()}.json`));
const env = { ...process.env, OMNI_EDU_XIAOZHI_PI: '1', OMNI_EDU_DATA_ROOT: path.join(output, 'data'), OMNI_EDU_REPO_ROOT: path.resolve(root, '../..'), OMNI_EDU_E2E_DIALOG_MODE: '1' };
delete env.ELECTRON_RUN_AS_NODE;
delete env.NODE_OPTIONS;
const launchStarted = performance.now();
const app = await electron.launch({ args: [path.join(root, 'out/main/index.js'), `--user-data-dir=${path.join(output, 'profile')}`], env, timeout: 60000 });
const report = { source: path.resolve(root, '../..'), output, consoleErrors: [], samples: [] };
try {
  const page = await app.firstWindow();
  // A locked/background desktop otherwise clamps rAF to ~1fps. Control only this
  // owned measurement window; this is not a production behavior change.
  await app.evaluate(({BrowserWindow}) => BrowserWindow.getAllWindows()[0].webContents.setBackgroundThrottling(false));
  page.on('pageerror', error => report.consoleErrors.push(error.message));
  await page.getByTestId('xiaozhi-pi-workspace').waitFor({ state: 'visible', timeout: 60000 });
  await page.waitForFunction(() => document.querySelector('[data-testid="office-prompt-input"]')?.disabled === false, undefined, { timeout: 60000 });
  report.readyMs = performance.now() - launchStarted;
  report.frameSchedulingMs = await page.getByTestId('office-prompt-input').evaluate(async element => {
    const samples = [];
    for (let index = 0; index < 20; index++) {
      const started = performance.now();
      element.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
      await new Promise(resolve => requestAnimationFrame(() => resolve()));
      samples.push(performance.now() - started);
    }
    return samples;
  });
  report.performanceBoundary = '20 synthetic ArrowLeft-to-rAF samples, owned window background throttling disabled; not native typing latency or model latency';
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
  async function sample(name, locator) {
    if (!await locator.count()) return;
    const styles = await locator.first().evaluate(element => {
      const computed = getComputedStyle(element);
      const names = ['font-family','font-size','font-weight','line-height','color','background-color','border-radius','box-shadow','outline','padding','height','transition-duration'];
      return { tag: element.tagName, className: element.className, rect: element.getBoundingClientRect().toJSON(), computed: Object.fromEntries(names.map(name => [name, computed.getPropertyValue(name)])) };
    });
    const token = `probe-${report.samples.length}`;
    await locator.first().evaluate((element, token) => element.setAttribute('data-ui-probe', token), token);
    const { root: documentRoot } = await cdp.send('DOM.getDocument');
    const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: documentRoot.nodeId, selector: `[data-ui-probe="${token}"]` });
    const matched = await cdp.send('CSS.getMatchedStylesForNode', { nodeId });
    report.samples.push({ name, ...styles, matched: matched.matchedCSSRules.map(({rule, matchingSelectors}) => ({ selectors: matchingSelectors.map(index => rule.selectorList.selectors[index]?.text), origin: rule.origin, source: rule.styleSheetId, layers: rule.layers, declarations: rule.style.cssProperties.filter(property => property.value && !property.disabled).map(({name,value,important,implicit,range}) => ({name,value,important,implicit,range})) })) });
  }
  const sheets = [];
  cdp.on('CSS.styleSheetAdded', ({ header }) => sheets.push({ id: header.styleSheetId, url: header.sourceURL, origin: header.origin }));
  await cdp.send('CSS.disable'); await cdp.send('CSS.enable');
  for (const [width,height] of [[1366,768],[1920,1080]]) {
    await page.setViewportSize({ width, height });
    await page.getByTestId('office-prompt-input').focus();
    await page.keyboard.press('Tab');
    await page.screenshot({ path: path.join(output, `home-${width}.png`), fullPage: true });
    const input = page.getByTestId('office-prompt-input');
    await sample(`input-${width}`, input);
    await sample(`body-${width}`, page.locator('body'));
    await sample(`navigation-${width}`, page.getByTestId('edu-navigation'));
    const button = page.getByTestId('pi-aside-toggle');
    await sample(`button-default-${width}`, button);
    await button.hover(); await page.waitForTimeout(300); await sample(`button-hover-${width}`, button);
    await button.focus(); await sample(`button-focus-${width}`, button);
    await page.screenshot({ path: path.join(output, `focus-${width}.png`), fullPage: true });
  }
  for (const [id,view] of [['nav-knowledge','knowledge'],['nav-teaching','teaching'],['nav-student-workbench','student_workbench'],['nav-settings','settings']]) {
    await page.locator('[data-testid="edu-navigation"]:visible').getByTestId(id).click();
    await page.locator(`[data-edu-ui][data-view="${view}"]:visible`).waitFor({ state: 'visible' });
    for (const [width,height] of [[1366,768],[1920,1080]]) {
      await page.setViewportSize({width,height});
      await page.screenshot({path:path.join(output, `${view}-${width}.png`),fullPage:true});
    }
  }
  report.sheets = sheets;
  report.runtime = await app.evaluate(({ app }) => ({ appPath: app.getAppPath(), version: app.getVersion(), packaged: app.isPackaged }));
  report.success = report.consoleErrors.length === 0;
} catch(error) { report.failure = String(error.stack); process.exitCode = 1; }
finally { await app.close(); fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify({ success: report.success, failure: report.failure, samples: report.samples.length, consoleErrors: report.consoleErrors, output })); }
