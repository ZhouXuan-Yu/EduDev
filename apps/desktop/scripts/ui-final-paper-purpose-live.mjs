/** Two isolated actual launches, zero model calls. No build or automatic retry. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {_electron as electron} from 'playwright';
import {testMain, assertIsolatedPiMain} from './acceptance/build-root.mjs';
import {fingerprint} from './acceptance/evidence.mjs';
import {copyC2OfficeBaseline} from './ui-final-resume-c2-office.mjs';
import {exercisePracticePurpose} from './acceptance/paper-purpose-live-ui.mjs';
import {exerciseStrictFulfillment} from './acceptance/paper-fulfillment-live-ui.mjs';
import {openBasket} from './acceptance/paper-export-intent-ui.mjs';
import {readPort, jsonEqual} from './acceptance/paper-export-intent-evidence.mjs';
import {ledger} from './acceptance/paper-basket-ui-driver.mjs';
import {zeroNetworkBootstrap} from './acceptance/zero-network-bootstrap.mjs';

const desktop = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2), pinArg = argv.find(a => a.startsWith('--pins='))?.slice(7);
if (!argv.includes('--run-ui')) {
  assert(argv.every(a => a === '--check'));
  console.log(JSON.stringify({preparedOnly: true, execution: false, budget: {launches: 2, modelCalls: 0, retries: 0}, command: 'node scripts/ui-final-paper-purpose-live.mjs --run-ui --pins=<owned-freeze-json>'}));
} else {
  assert(argv.every(a => a === '--run-ui' || a.startsWith('--pins=')) && pinArg);
  const owned = fs.realpathSync(path.join(desktop, 'test-results'));
  const pinFile = fs.realpathSync(pinArg); assert(pinFile.startsWith(owned + path.sep));
  const pins = JSON.parse(fs.readFileSync(pinFile, 'utf8'));
  const main = testMain(desktop), buildRoot = path.dirname(path.dirname(main));
  assert.equal(fs.realpathSync(buildRoot), fs.realpathSync(pins.buildRoot));
  const verify = () => {assert.equal(fingerprint(buildRoot).sha256, pins.build); assert.equal(fingerprint(path.join(desktop, 'src')).sha256, pins.source);};
  verify();
  const output = fs.mkdtempSync(path.join(owned, 'ui-final-paper-purpose-live-'));
  const proof = copyC2OfficeBaseline({output}), data = proof.data, profile = path.join(output, 'profile');
  const report = {success: false, scope: 'A24-real-practice-cold-restore-and-A26-plan-fill-scarcity', pins, output, budget: {launches: 2, modelCalls: 0, retries: 0}, checks: [], errors: [], launches: []};
  const beforeModel = ledger(data);
  const persist = () => fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  const check = name => {report.checks.push({name, pass: true}); persist(); console.log('PASS ' + name);};
  const read = readPort(path.join(data, 'app.db'));
  const stored = id => {const row = read('SELECT data_json FROM paper_baskets WHERE id=?', [id])[0]; const result = JSON.parse(row.data_json); delete result.uiState; return result;};
  let app, page;
  async function assertNoNetwork() {
    const attempts = await app.evaluate(() => globalThis.__purposeHttp);
    assert(Array.isArray(attempts));
    (report.networkObservations ??= []).push(attempts);
    assert.deepEqual(attempts, [], 'No network before or during actual purpose operations');
  }
  async function launch() {
    verify();
    const env = {...process.env};
    for (const key of Object.keys(env)) if (/KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL/i.test(key) || key.startsWith('OMNI_EDU_') || ['ELECTRON_RUN_AS_NODE', 'NODE_OPTIONS', 'ELECTRON_RENDERER_URL'].includes(key)) delete env[key];
    Object.assign(env, {OMNI_EDU_DATA_ROOT: data, OMNI_EDU_REPO_ROOT: path.resolve(desktop, '../..'), OMNI_EDU_XIAOZHI_PI: '1', OMNI_EDU_E2E_VISIBLE: '1', OMNI_EDU_E2E_DIALOG_MODE: '1', OMNI_EDU_SKIP_DOTENV: '1', DEEPSEEK_API_KEY: ''});
    const launchOutput = path.join(output, 'launch-' + (report.launches.length + 1)); fs.mkdirSync(launchOutput);
    const bootstrap = zeroNetworkBootstrap({output: launchOutput, main, profile, counter: '__purposeHttp'});
    app = await electron.launch({args: [bootstrap, '--user-data-dir=' + profile, '--force-device-scale-factor=1'], cwd: desktop, env, timeout: 60000});
    page = await app.firstWindow(); page.setDefaultTimeout(20000);
    report.launches.push(await assertIsolatedPiMain(app, main, profile));
    page.on('pageerror', error => {report.errors.push({kind: 'pageerror', message: String(error.message).slice(0, 1200)}); persist();});
    page.on('console', message => {if (message.type() === 'error') {report.errors.push({kind: 'console.error', message: message.text().slice(0, 1200)}); persist();}});
    await page.getByTestId('xiaozhi-pi-workspace').waitFor({timeout: 60000});
  }
  try {
    persist(); await launch();
    const result = await exercisePracticePurpose({page, app, data, output, report, check});
    const before = stored(result.basketId); report.fixture = {owner: result.owner, basketId: result.basketId};
    await assertNoNetwork(); await app.close(); app = undefined;
    await launch(); await openBasket(page, result.owner, result.basketId);
    jsonEqual(stored(result.basketId), before, 'Cold startup restores the exact practice purpose/members/instances/reviews');
    assert.equal(await page.getByTestId('paper-basket-preview-entry').count(), 3);
    await page.screenshot({path: path.join(output, 'practice-cold-restored.png')});
    check('Second real launch preserves exact three-question practice without model replay');
    await exerciseStrictFulfillment({page, app, data, output, report, check, owner: result.owner, basketId: result.basketId});
    await assertNoNetwork(); jsonEqual(ledger(data), beforeModel); assert.deepEqual(report.errors, []); verify(); report.success = true;
  } catch (error) {
    report.error = {name: error.name, message: String(error.message).slice(0, 2000)};
    if (page && !page.isClosed()) await page.screenshot({path: path.join(output, 'failure.png')}).catch(() => {});
  } finally {
    await app?.close().catch(() => {});
    try {verify(); assert.equal(fingerprint(proof.original).sha256, proof.originalBefore); jsonEqual(ledger(data), beforeModel); report.integrityVerified = true;}
    catch (error) {report.success = false; report.integrityError = String(error.message).slice(0, 2000);}
    persist(); console.log(JSON.stringify({success: report.success, output, checks: report.checks.length}));
  }
  if (!report.success) process.exitCode = 1;
}
