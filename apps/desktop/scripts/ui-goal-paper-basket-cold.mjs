/** Owned-clone navigation diagnosis only. Does not rerun selection/confirmation/export/model gates. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {_electron as electron} from 'playwright';
import {testMain, assertIsolatedPiMain} from './acceptance/build-root.mjs';
import {fingerprint, sha256} from './acceptance/evidence.mjs';
import {choose, enterPaper, readBasket, ledger, waitForBasketUi} from './acceptance/paper-basket-ui-driver.mjs';
import {installPaperBasketDomTrace} from './acceptance/paper-basket-dom-trace.mjs';

const arg = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const command = 'node scripts/ui-goal-paper-basket-cold.mjs --run-ui --from=test-results/ui-goal-paper-basket-Trfuaj';
if (process.argv.includes('--check')) {
  console.log(JSON.stringify({preparedOnly: true, execution: false, command,
    scope: 'Exact Actual6 build hash; copied data; fresh profile prepared through real owner/basket Select; one cold restart; DOM identity trace; no production instrumentation or model calls'}));
  process.exit(0);
}
assert(process.argv.includes('--run-ui') && arg('from'), 'Nothing launched. ' + command);
const desktop = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const owned = fs.realpathSync(path.join(desktop, 'test-results'));
const original = fs.realpathSync(path.resolve(desktop, arg('from')));
assert(original.startsWith(owned + path.sep), 'Only an owned test-results fixture may be cloned');
const reportPath = path.join(original, 'report.json'), reportHash = sha256(fs.readFileSync(reportPath));
const previous = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
assert(previous.success === false && previous.saved && previous.launches.length === 2, 'Requires preserved failed cold-restore fixture');
const {basketId, uiState} = previous.saved, owner = previous.owner;
assert(/^aisession_[\da-f-]{36}$/i.test(owner) && /^xibasket_[\da-f-]{36}$/i.test(basketId));
const main = testMain(desktop), buildRoot = path.dirname(path.dirname(main)), buildBefore = fingerprint(buildRoot).sha256;
assert.equal(buildBefore, previous.buildBefore, 'Diagnostic must use the exact Actual6 out; do not rebuild or substitute a newer out');
const source = path.join(original, 'data'), sourceBefore = fingerprint(source).sha256;
const output = fs.mkdtempSync(path.join(owned, 'ui-goal-paper-cold-'));
const data = path.join(output, 'data'), profile = path.join(output, 'profile');
fs.cpSync(source, data, {recursive: true, errorOnExist: true, force: false});
assert.equal(fingerprint(data).sha256, sourceBefore);
const before = ledger(data);
const report = {success: false, original, output, reportHash, sourceBefore, buildBefore, owner, basketId,
  checks: [], launches: [], traces: [], errors: [], networkAttempts: [], before,
  profilePolicy: 'Fresh owned profile, prepared only with real UI owner/basket selection. Original profile is neither read nor copied.',
  observation: 'DOM observer and network interception begin after firstWindow on each launch. No hook epoch/route-source instrumentation; DOM node identity separates remount from same-node reset.',
  scope: 'Cold navigation diagnosis only; original seven acceptance checks and Actual6 failure remain unchanged.'};
let app, page, baseline;
const check = name => {report.checks.push({name, pass: true}); console.log('PASS ' + name);};
async function launch() {
  const env = {...process.env, OMNI_EDU_DATA_ROOT: data, OMNI_EDU_REPO_ROOT: path.resolve(desktop, '../..'),
    OMNI_EDU_XIAOZHI_PI: '1', OMNI_EDU_E2E_VISIBLE: '1', DEEPSEEK_API_KEY: '', OPENAI_API_KEY: ''};
  for (const key of ['ELECTRON_RUN_AS_NODE', 'NODE_OPTIONS', 'ELECTRON_RENDERER_URL', 'OMNI_EDU_E2E_LEGACY_AI']) delete env[key];
  app = await electron.launch({args: [main, '--user-data-dir=' + profile, '--force-device-scale-factor=1'], cwd: desktop, env, timeout: 60000});
  page = await app.firstWindow(); page.setDefaultTimeout(30000);
  await page.evaluate(installPaperBasketDomTrace);
  page.on('pageerror', () => report.errors.push('pageerror'));
  page.on('console', message => {if (message.type() === 'error') report.errors.push('console.error');});
  await app.evaluate(() => {
    globalThis.__paperColdNetwork = [];
    const fetch = globalThis.fetch;
    globalThis.fetch = async function(input) {
      const url = typeof input === 'string' ? input : input?.url || String(input);
      if (/^https?:/.test(url)) {globalThis.__paperColdNetwork.push('blocked-main-http'); throw Error('Cold diagnosis forbids model/network calls');}
      return fetch.apply(this, arguments);
    };
  });
  await page.route('**/*', async route => {
    if (/^https?:/.test(route.request().url())) {report.networkAttempts.push('blocked-renderer-http'); await route.abort();}
    else await route.continue();
  });
  report.launches.push(await assertIsolatedPiMain(app, main, profile));
  await page.getByTestId('xiaozhi-pi-workspace').waitFor({timeout: 60000});
  assert.equal(path.resolve(await page.evaluate(() => window.omniEdu.getDataRoot())), data);
}
async function close() {
  if (!app) return;
  const handle = app; app = undefined;
  try {
    if (page && !page.isClosed()) report.traces.push(await page.evaluate(() => window.__paperBasketDomTrace.snapshot()));
    report.networkAttempts.push(...await handle.evaluate(() => globalThis.__paperColdNetwork));
  } finally {await handle.close();}
}
const expected = {stage: uiState.stage, query: uiState.filters.query || ''};
try {
  await launch();
  baseline = await readBasket(page, owner, basketId);
  assert.equal(baseline.revision, previous.saved.revision);
  assert(JSON.stringify(baseline.uiState) === JSON.stringify(uiState), 'Owned fixture must retain the exact saved preferences');
  report.basketBefore = sha256(JSON.stringify(baseline));
  await enterPaper(page);
  await choose(page, page.getByTestId('paper-basket-owner'), owner);
  await choose(page, page.getByTestId('paper-basket-saved'), basketId);
  await waitForBasketUi(page, owner, basketId, expected);
  assert.equal(await page.getByTestId('paper-basket-workspace').getAttribute('data-basket-id'), basketId);
  assert.equal(sha256(JSON.stringify(await readBasket(page, owner, basketId))), report.basketBefore,
    'UI preparation must preserve all basket fields');
  check('Real UI prepares exact saved basket reference without changing basket content or preferences');
  await close();
  await launch();
  await enterPaper(page);
  await waitForBasketUi(page, owner, basketId, expected);
  await page.evaluate(() => window.__paperBasketDomTrace.mark('cold-ready-returned'));
  // Immediate strict readback remains separate. No second wait, sleep or retry can swallow a reset.
  assert.equal(await page.getByTestId('paper-basket-workspace').getAttribute('data-basket-id'), basketId);
  assert.equal(await page.getByTestId('paper-basket-workspace').getAttribute('data-stage'), expected.stage);
  report.basketAfter = sha256(JSON.stringify(await readBasket(page, owner, basketId)));
  assert.equal(report.basketAfter, report.basketBefore, 'Cold readback must preserve all basket fields');
  await page.screenshot({path: path.join(output, 'cold-readback.png')});
  check('Cold restart restores exact existing basket and saved stage; immediate identity readback agrees');
  await close();
  assert(report.traces.every(trace => trace.dropped === 0), 'A truncated DOM trace is incomplete diagnostic evidence');
  report.after = ledger(data); assert.deepEqual(report.after, before);
  assert.deepEqual(report.errors, []); assert.deepEqual(report.networkAttempts, []);
  check('No added model ledger entries or post-firstWindow observed network/renderer errors');
  report.success = true;
} catch (error) {
  const redact = value => String(value).replace(/sk-[\w-]+/g, '[credential]');
  report.error = {name: error.name, message: redact(error.message).slice(0, 1800), stack: redact(error.stack || '').slice(0, 6000)};
  if (page && !page.isClosed()) await page.screenshot({path: path.join(output, 'failure.png')}).catch(() => {});
} finally {
  await close().catch(() => {report.success = false; report.closeFailed = true;});
  report.after ||= ledger(data);
  report.buildAfter = fingerprint(buildRoot).sha256;
  report.sourceAfter = fingerprint(source).sha256;
  report.originalReportAfter = sha256(fs.readFileSync(reportPath));
  if (report.buildAfter !== buildBefore || report.sourceAfter !== sourceBefore || report.originalReportAfter !== reportHash ||
    JSON.stringify(report.after) !== JSON.stringify(before)) {report.success = false; report.integrityFailed = true;}
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({success: report.success, output, checks: report.checks.length}));
  if (!report.success) process.exitCode = 1;
}
