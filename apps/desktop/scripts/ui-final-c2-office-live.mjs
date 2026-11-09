/** Parent-only actual C2 Office acceptance. No build, implicit retry or SQL writes. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {_electron as electron} from 'playwright';
import {testMain, assertIsolatedPiMain} from './acceptance/build-root.mjs';
import {fingerprint} from './acceptance/evidence.mjs';
import {parentImageReviewGate} from './acceptance/parent-image-review-gate.mjs';
import {captureRuntimeDiagnostics} from './acceptance/runtime-diagnostics.mjs';
import {readC2OfficeMatrixGate} from './acceptance/paper-template-office-ui.mjs';
import {copyC2OfficeBaseline, prepareCurrentC2PaperUi, runCurrentC2OfficeUi,
  assertCurrentC2SourceRefusalUi, c2OfficeContractHash, c2OfficeBudget} from './ui-final-resume-c2-office.mjs';

const desktop = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const value = name => argv.find(arg => arg.startsWith('--' + name + '='))?.slice(name.length + 3);
if (!argv.includes('--run-ui')) {
  assert(argv.every(arg => arg === '--check'));
  console.log(JSON.stringify({preparedOnly: true, execution: false, budget: c2OfficeBudget,
    parentLaunches: 1, retries: 0, command: 'node scripts/ui-final-c2-office-live.mjs --run-ui --live --pins=<owned-json> --matrix=<current-C2b-report>'}));
} else {
  assert(argv.includes('--live') && process.env.DEEPSEEK_API_KEY, 'Explicit live opt-in and inherited provider key required');
  assert(argv.every(arg => ['--run-ui', '--live'].includes(arg) || /^--(?:pins|matrix)=.+/.test(arg)));
  const owned = fs.realpathSync(path.join(desktop, 'test-results'));
  const readOwned = file => {
    const resolved = fs.realpathSync(file);
    assert(resolved.startsWith(owned + path.sep));
    return JSON.parse(fs.readFileSync(resolved, 'utf8'));
  };
  const pins = readOwned(value('pins'));
  const matrixFile = fs.realpathSync(value('matrix'));
  const matrix = readOwned(matrixFile);
  assert(matrix.success && matrix.integrityVerified, 'Full current C2b matrix must precede paid submissions');
  assert.equal(matrix.pins.build, pins.build); assert.equal(matrix.pins.source, pins.source);
  const main = testMain(desktop), buildRoot = path.dirname(path.dirname(main));
  assert.equal(fs.realpathSync(buildRoot), fs.realpathSync(pins.buildRoot));
  const verify = () => {
    assert.equal(fingerprint(buildRoot).sha256, pins.build);
    assert.equal(fingerprint(path.join(desktop, 'src')).sha256, pins.source);
    assert.equal(c2OfficeContractHash(), pins.contract);
  };
  verify();
  readC2OfficeMatrixGate(matrixFile, pins);
  const output = fs.mkdtempSync(path.join(owned, 'ui-final-c2-office-live-'));
  const proof = copyC2OfficeBaseline({output});
  const {data} = proof, profile = path.join(output, 'profile');
  const report = {success: false, scope: 'actual-current-C2-v7-six-exports', pins,
    budget: {...c2OfficeBudget, parentLaunches: 1}, checks: [], errors: [], launches: [], output};
  const redact = value => String(value).split(process.env.DEEPSEEK_API_KEY).join('[credential]').slice(0, 2000);
  const persist = () => fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  const check = name => {report.checks.push({name, pass: true}); persist(); console.log('PASS ' + name);};
  let app, page;
  try {
    const env = {...process.env};
    for (const key of Object.keys(env)) if ((key!=='DEEPSEEK_API_KEY'&&/KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL/i.test(key)) || key.startsWith('OMNI_EDU_') || ['ELECTRON_RUN_AS_NODE', 'NODE_OPTIONS', 'ELECTRON_RENDERER_URL'].includes(key)) delete env[key];
    Object.assign(env, {OMNI_EDU_DATA_ROOT: data, OMNI_EDU_REPO_ROOT: path.resolve(desktop, '../..'), OMNI_EDU_XIAOZHI_PI: '1', OMNI_EDU_E2E_DIALOG_MODE:'1', OMNI_EDU_E2E_VISIBLE: '1'});
    console.log(JSON.stringify({phase: 'predeclared-live-budget', output, budget: report.budget})); persist();
    app = await electron.launch({args: [main, '--user-data-dir=' + profile, '--force-device-scale-factor=1'], cwd: desktop, env, timeout: 60000});
    captureRuntimeDiagnostics(app, report, persist);
    page = await app.firstWindow(); page.setDefaultTimeout(30000);
    report.launches.push(await assertIsolatedPiMain(app, main, profile));
    page.on('pageerror', error => {report.errors.push({kind: 'pageerror', message: redact(error.message)}); persist();});
    page.on('console', message => {if (message.type() === 'error') {report.errors.push({kind: 'console.error', message: redact(message.text())}); persist();}});
    await page.getByTestId('xiaozhi-pi-workspace').waitFor({timeout: 60000});
    const fixture = await prepareCurrentC2PaperUi({page, app, data, output, report, pins, check});
    const workspace = path.join(output, 'workspace'); fs.mkdirSync(workspace);
    const exportReport = await runCurrentC2OfficeUi({page, app, output, workspace, pins,
      ...fixture, baselineProof: proof, matrixReportPath: matrixFile, argv,
      inspectImages: parentImageReviewGate(output), onCheck: check,
      sourceFiles: [fileURLToPath(import.meta.url), fileURLToPath(new URL('./acceptance/parent-image-review-gate.mjs', import.meta.url)), fileURLToPath(new URL('./acceptance/runtime-diagnostics.mjs', import.meta.url))],
      buildFiles: [main, path.join(buildRoot, 'preload/index.cjs')]});
    report.exports = {success: exportReport.success, deliveries: exportReport.deliveries};
    report.sourceRefusal = await assertCurrentC2SourceRefusalUi({page, app, data, output, fixture, exportReport, pins});
    assert(report.sourceRefusal.success); verify(); assert.deepEqual(report.errors, []);
    report.success = true;
  } catch (error) {
    report.error = {name: error.name, message: redact(error.message)};
    if (page && !page.isClosed()) await page.screenshot({path: path.join(output, 'failure.png')}).catch(() => {});
  } finally {
    await app?.close().catch(() => {});
    try {verify(); assert.equal(fingerprint(proof.original).sha256, proof.originalBefore); report.integrityVerified = true;}
    catch (error) {report.success = false; report.integrityError = redact(error.message);}
    persist(); console.log(JSON.stringify({success: report.success, output, checks: report.checks.length}));
  }
  if (!report.success) process.exitCode = 1;
}
