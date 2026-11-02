/** U4-B real UI only. Parent serial execution; no model or Office file request. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {_electron as electron} from 'playwright';
import {testMain, assertIsolatedPiMain} from './acceptance/build-root.mjs';
import {fingerprint, sha256} from './acceptance/evidence.mjs';
import {ledger} from './acceptance/paper-basket-ui-driver.mjs';
import {installPaperBasketDomTrace} from './acceptance/paper-basket-dom-trace.mjs';
import {readInstanceBasket} from './acceptance/paper-instance-ui-driver.mjs';
import {instanceDomainEvidence, assertInstanceDomainUnchanged, storedPaperDigest} from './acceptance/paper-instance-ui-evidence.mjs';
import {prepareInstanceUi, editReviewAndPreview, replaceRestoreAndColdInput, verifyColdInstanceUi} from './acceptance/paper-instance-ui-journey.mjs';

const arg = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const command = 'node scripts/ui-goal-paper-instance.mjs --run-ui --from=test-results/ui-goal-paper-9G2OGc --owner=aisession_7a4a1a6c-ad0d-4614-bef7-33b9be2322b2 --witness-owner=aisession_8b649d13-87fc-4285-b1a1-e8e69e942300 --questions=question_d0ed2e88-704b-4b96-90f1-d4f880ab7e10,question_5326992e-9786-418b-829e-8be64ee8e237';
const scope = 'Real V2 UI create/add/edit/save/review/student-teacher preview/confirmed snapshot/replace/restore/cold saved-edit and local-input recovery; two sizes; immutable bank/witness/history; no model or actual Office files.';
if (process.argv.includes('--check')) {
  assert(!process.argv.includes('--run-ui'), 'Choose preparation or explicit execution, not both');
  console.log(JSON.stringify({preparedOnly: true, execution: false, command, scope,
    requires: 'Frozen B renderer + six real V2 APIs in formal out; original owned real 20-question/two-session fixture.',
    notCovered: ['Six actual Office files/readback are a separate Goodall runner and require their real approval flow.',
      'Injected source-change/denial/quota/conflict cases remain deterministic host/renderer gates.'], modelCalls: 0}));
  process.exit(0);
}
assert(process.argv.includes('--run-ui'), 'Nothing launched: use --check or explicit --run-ui. ' + command);
const known = ['--run-ui', '--from=', '--owner=', '--witness-owner=', '--questions='];
assert(process.argv.slice(2).every(value => known.some(flag => flag.endsWith('=') ? value.startsWith(flag) : value === flag)), 'Unknown CLI flag');
const desktop = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const owned = fs.realpathSync(path.join(desktop, 'test-results'));
assert(arg('from') && arg('owner') && arg('witness-owner') && arg('questions'), command);
const original = fs.realpathSync(path.resolve(desktop, arg('from')));
assert(original.startsWith(owned + path.sep), 'Only an owned test-results source fixture is allowed');
const owner = arg('owner'), witnessOwner = arg('witness-owner'), questionIds = arg('questions').split(',');
for (const id of [owner, witnessOwner]) assert(/^aisession_[\da-f-]{36}$/i.test(id), 'Real session IDs required');
assert.notEqual(owner, witnessOwner); assert.equal(questionIds.length, 2); assert.notEqual(questionIds[0], questionIds[1]);
for (const id of questionIds) assert(/^question_[\da-f-]{36}$/i.test(id), 'Real question IDs required');
const sourceData = path.join(original, 'data');
assert(fs.existsSync(path.join(sourceData, 'app.db')), 'Owned fixture must contain data/app.db');
const sourceHash = fingerprint(sourceData).sha256;
const main = testMain(desktop), buildRoot = path.dirname(path.dirname(main)), buildHash = fingerprint(buildRoot).sha256;
const output = fs.mkdtempSync(path.join(owned, 'ui-goal-paper-instance-'));
const data = path.join(output, 'data'), profile = path.join(output, 'profile');
fs.cpSync(sourceData, data, {recursive: true, errorOnExist: true, force: false});
assert.equal(fingerprint(data).sha256, sourceHash);
const before = ledger(data), domainBefore = instanceDomainEvidence(data);
const scriptPaths = ['ui-goal-paper-instance.mjs', 'acceptance/paper-instance-ui-driver.mjs',
  'acceptance/paper-instance-ui-evidence.mjs', 'acceptance/paper-instance-ui-journey.mjs', 'acceptance/paper-instance-ui-form.mjs', 'acceptance/paper-instance-ui-wait.mjs',
  'acceptance/build-root.mjs', 'acceptance/evidence.mjs', 'acceptance/paper-basket-ui-driver.mjs',
  'acceptance/paper-basket-ui-locators.mjs', 'acceptance/paper-basket-dom-trace.mjs', 'product-navigation.mjs',
  'xiaozhi-agent/capture-workspace-metrics.mjs'];
const scriptHashes = () => Object.fromEntries(scriptPaths.map(file => [file, sha256(fs.readFileSync(path.join(desktop, 'scripts', file)))]));
const report = {success: false, scenario: 'U4-B-real-instance-UI', scope, original, output, owner, witnessOwner, questionIds,
  buildBefore: buildHash, sourceBefore: sourceHash, scriptsBefore: scriptHashes(), before, domainBefore,
  checks: [], screens: [], contrast: [], errors: [], networkAttempts: [], launches: [], domTraces: [],
  fixturePolicy: 'Byte-copy real owned data only; fresh profile. No SQL writes, synthesized questions/receipts, profile credential reads or authorization-root rewriting.',
  networkObservation: 'Interception starts after firstWindow per launch; earlier startup traffic is not observed. Durable model-ledger hashes/counts independently check no added runs or requests.',
  coverageBoundaries: ['This scenario awaits completed session selection before switching modules. Rapid switching is not tested here; this paper scenario does not claim overall desktop navigation acceptance.'],
  notCovered: ['Office file creation/readback and Pi approvals are separate; six visible choices here do not prove files.',
    'Host failure injection and image-source fixture coverage stay in their independent tests.']};
const ctx = {desktop, output, data, profile, owner, witnessOwner, questionIds, report,
  marker: path.basename(output).replace('ui-goal-paper-instance-', ''),
  check(name) {report.checks.push({name, pass: true}); console.log('PASS ' + name);}};
async function launch() {
  const env = {...process.env, OMNI_EDU_DATA_ROOT: data, OMNI_EDU_REPO_ROOT: path.resolve(desktop, '../..'),
    OMNI_EDU_XIAOZHI_PI: '1', OMNI_EDU_E2E_VISIBLE: '1'};
  for (const key of Object.keys(env)) if (/_API_KEY$/.test(key)) env[key] = '';
  for (const key of ['ELECTRON_RUN_AS_NODE', 'NODE_OPTIONS', 'ELECTRON_RENDERER_URL', 'OMNI_EDU_E2E_LEGACY_AI']) delete env[key];
  ctx.app = await electron.launch({args: [main, '--user-data-dir=' + profile, '--force-device-scale-factor=1'], cwd: desktop, env, timeout: 60000});
  ctx.page = await ctx.app.firstWindow(); ctx.page.setDefaultTimeout(30000);
  await ctx.page.evaluate(installPaperBasketDomTrace);
  ctx.page.on('pageerror', () => report.errors.push('pageerror'));
  ctx.page.on('console', message => {if (message.type() === 'error') report.errors.push('console.error');});
  await ctx.app.evaluate(() => {
    globalThis.__paperInstanceNetwork = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async function(input) {
      const url = typeof input === 'string' ? input : input?.url || String(input);
      if (/^https?:/.test(url)) {globalThis.__paperInstanceNetwork.push({kind: 'blocked-main-http'}); throw Error('U4-B UI forbids model/network calls');}
      return originalFetch.apply(this, arguments);
    };
  });
  await ctx.page.route('**/*', async route => {
    if (/^https?:/.test(route.request().url())) {report.networkAttempts.push({kind: 'blocked-renderer-http'}); await route.abort();}
    else await route.continue();
  });
  report.launches.push(await assertIsolatedPiMain(ctx.app, main, profile));
  await ctx.page.getByTestId('xiaozhi-pi-workspace').waitFor({timeout: 60000});
  assert.equal(path.resolve(await ctx.page.evaluate(() => window.omniEdu.getDataRoot())), data);
  const apis = await ctx.page.evaluate(() => ['listPaperBasketsV2', 'readPaperBasketV2', 'readPaperBasketCandidateV2',
    'createPaperBasketV2', 'mutatePaperBasketV2', 'createPaperFromBasketV2'].map(name => ({name, available: typeof window.omniEdu[name] === 'function'})));
  assert(apis.every(api => api.available), 'All six real V2 preload APIs must be present');
  report.v2Apis = apis;
}
async function close() {
  if (!ctx.app) return;
  const handle = ctx.app; ctx.app = undefined;
  try {
    if (ctx.page && !ctx.page.isClosed()) report.domTraces.push(await ctx.page.evaluate(() => window.__paperBasketDomTrace.snapshot()));
    const attempts = await handle.evaluate(() => globalThis.__paperInstanceNetwork);
    if (Array.isArray(attempts)) report.networkAttempts.push(...attempts);
  } finally {await handle.close();}
}
try {
  report.phase = 'first-launch';
  await launch();
  report.phase = 'real-owner-baskets';
  await prepareInstanceUi(ctx);
  report.phase = 'edit-save-review-preview-snapshot';
  await editReviewAndPreview(ctx);
  report.phase = 'replace-restore-saved-edit-local-input';
  await replaceRestoreAndColdInput(ctx);
  const witness = await readInstanceBasket(ctx.page, witnessOwner, ctx.witness.id);
  for (const key of ['revision', 'entries', 'blueprint', 'state']) assert.deepEqual(witness[key], ctx.witness[key], 'Other-owner same-question basket remains unchanged');
  report.phase = 'cold-launch';
  await close(); await launch();
  report.phase = 'cold-readback';
  await verifyColdInstanceUi(ctx);
  const coldWitness = await readInstanceBasket(ctx.page, witnessOwner, ctx.witness.id);
  for (const key of ['revision', 'entries', 'blueprint', 'state']) assert.deepEqual(coldWitness[key], ctx.witness[key]);
  assert.equal(storedPaperDigest(data, ctx.paperId), ctx.paperDigest);
  await close();
  report.domainAfter = instanceDomainEvidence(data); assertInstanceDomainUnchanged(domainBefore, report.domainAfter);
  ctx.check('Actual SQLite readback preserves the entire bank, the other owner basket, every old paper receipt and the newly confirmed pre-replacement snapshot');
  report.after = ledger(data); assert.deepEqual(report.after, before);
  assert.deepEqual(report.errors, []); assert.deepEqual(report.networkAttempts, []);
  ctx.check('No new durable model runs/requests/events; clean renderer/console and no observed post-firstWindow HTTP attempts');
  assert.equal(report.checks.length, 9, 'All nine UI phases must complete');
  assert.equal(new Set(report.checks.map(check => check.name)).size, 9);
  assert.equal(report.launches.length, 2, 'Actual cold launch is required');
  assert.equal(report.screens.length, 12, 'Six evidence states at both viewport sizes are required');
  report.phase = 'complete';
  report.success = true;
} catch (error) {
  report.error = {name: error.name, message: String(error.message).replace(/sk-[\w-]+/g, '[credential]').slice(0, 1800),
    stack: String(error.stack || '').replace(/sk-[\w-]+/g, '[credential]').slice(0, 6000)};
  if (ctx.page && !ctx.page.isClosed()) await ctx.page.screenshot({path: path.join(output, 'failure.png')}).catch(() => {});
} finally {
  await close().catch(() => {report.success = false; report.closeFailed = true;});
  report.buildAfter = fingerprint(buildRoot).sha256; report.sourceAfter = fingerprint(sourceData).sha256;
  report.scriptsAfter = scriptHashes();
  if (report.buildAfter !== buildHash || report.sourceAfter !== sourceHash || JSON.stringify(report.scriptsAfter) !== JSON.stringify(report.scriptsBefore)) {
    report.success = false; report.integrityFailed = true;
  }
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({success: report.success, output, checks: report.checks.length}));
  if (!report.success) process.exitCode = 1;
}
