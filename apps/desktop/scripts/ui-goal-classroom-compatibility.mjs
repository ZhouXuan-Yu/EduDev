/** PREPARE ONLY by default. Parent serializes --run-after-settings against builds.
 * Cross-build read-only compatibility of copied U6 evidence, NOT build parity.
 * Original DB is never opened. No model, confirmation, export or repair actions.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {_electron as electron} from 'playwright';
import {testMain, assertIsolatedPiMain} from './acceptance/build-root.mjs';
import {fingerprint, sha256} from './acceptance/evidence.mjs';
import {inside, originalEvidence, copyFixture, copiedFacts, copiedBinding, copiedExport} from './acceptance/classroom-compatibility-fixture.mjs';

const desktop = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.realpathSync(path.join(desktop, 'test-results/ui-goal-20261101/classroom-live/run-QleUZj'));
const original = JSON.parse(fs.readFileSync(path.join(source, 'report.json'), 'utf8'));
assert.equal(original.success, true, 'Preserve the original successful U6 report');
const main = testMain(desktop), buildRoot = path.dirname(path.dirname(main)), build = fingerprint(buildRoot);
const expectedRenderer = process.env.UI_COMPAT_EXPECT_RENDERER || 'index-CoygKxo3.js';
assert(/index-[A-Za-z0-9_-]+\.js$/.test(expectedRenderer));
assert(build.files.some(file => file.file === 'renderer/assets/' + expectedRenderer), 'Latest integrated renderer fingerprint differs from the requested build');
assert.notEqual(build.sha256, original.build.sha256, 'This runner requires a distinct integrated build; old same-build readback is unchanged');
const target = path.join(desktop, 'test-results/ui-goal-20261101/classroom-compatibility');
const scope = 'copied-owned-U6 cross-build read-only compatibility; not paired parity or fresh generation acceptance';

async function run() {
  fs.mkdirSync(target, {recursive: true});
  const output = fs.mkdtempSync(path.join(target, 'run-'));
  assert(inside(target, output));assert(!inside(source, output));
  const report = {success: false, status: 'running', scope, output, originalRun: source,
    builds: {original: {sha256: original.build.sha256, mainSha256: original.build.files.find(file => file.file === 'main/index.js')?.sha256},
      integrated: {sha256: build.sha256, mainSha256: sha256(fs.readFileSync(main)), renderer: expectedRenderer}, parityClaimed: false},
    scriptSha256: sha256(fs.readFileSync(fileURLToPath(import.meta.url))),
    fixtureHelperSha256: sha256(fs.readFileSync(new URL('./acceptance/classroom-compatibility-fixture.mjs', import.meta.url))),
    checks: [], stages: [], screens: [], errors: [], boundaries: []};
  const check = name => {report.checks.push({name, pass: true});console.log('PASS ' + name);};
  let app, baseline, binding, originalBefore;
  const immutable = () => assert.deepEqual(originalEvidence(source, original), originalBefore, 'Original report/data/profile/source export must remain byte-identical');
  const safeError = error => ({name: error instanceof assert.AssertionError ? 'AssertionError' : 'Error',
    code: /^[A-Z_]+$/.test(error?.code || '') ? error.code : 'compatibility_check_failed'});
  async function stage(name) {
    const env = {...process.env};
    for (const key of Object.keys(env)) if (/KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL/i.test(key) || /^OMNI_EDU_/i.test(key)
      || ['NODE_OPTIONS', 'ELECTRON_RUN_AS_NODE', 'ELECTRON_RENDERER_URL'].includes(key.toUpperCase())) delete env[key];
    Object.assign(env, {OMNI_EDU_DATA_ROOT: path.join(output, 'data'), OMNI_EDU_REPO_ROOT: path.resolve(desktop, '../..'), OMNI_EDU_XIAOZHI_PI: '1'});
    app = await electron.launch({args: [main, '--user-data-dir=' + path.join(output, 'profile')], env, timeout: 60000});
    // Deny HTTP(S)/WS: no paid calls or external resources even if copied
    // preferences retain a provider. No URL/body is exported into evidence.
    await app.evaluate(({session}) => {
      // Provider HTTP uses Node rather than Chromium. Block Node TCP connects
      // too; the copied ledger is terminal and no model/start action is invoked.
      process.getBuiltinModule('net').Socket.prototype.connect = function () {
        throw Object.assign(new Error('Compatibility QA disables Node network connections'), {code: 'COMPAT_NETWORK_DISABLED'});
      };
      session.defaultSession.webRequest.onBeforeRequest({urls: ['http://*/*', 'https://*/*', 'ws://*/*', 'wss://*/*']}, (_request, done) => done({cancel: true}));
    });
    const page = await app.firstWindow();page.setDefaultTimeout(15000);
    page.on('pageerror', () => report.errors.push({stage: name, kind: 'pageerror'}));
    page.on('console', message => {if (message.type() === 'error') report.errors.push({stage: name, kind: 'console.error'});});
    await page.getByTestId('xiaozhi-pi-workspace').waitFor({state: 'visible', timeout: 60000});
    const runtime = await assertIsolatedPiMain(app, main, path.join(output, 'profile'));
    assert.equal(path.resolve(await page.evaluate(() => window.omniEdu.getDataRoot())), path.join(output, 'data'));
    const publicState = await page.evaluate(async binding => {
      const plans = await window.omniEdu.listClassroomPlans();
      const classes = await window.omniEdu.listClassrooms();
      if (!plans.ok || !classes.ok) return {ok: false};
      const plan = plans.data.find(item => item.id === binding.planId);
      const classroom = classes.data.find(item => item.id === binding.classroomId);
      const snapshot = await window.omniEdu.getXiaozhiSnapshot(binding.sessionId);
      const saved = snapshot.officeArtifacts?.find(item => item.id === binding.draftId);
      // This DTO includes only public classroom content required for digesting,
      // never private reasoning or an unfiltered runtime snapshot.
      return {ok: true, plan: plan && {status: plan.status, classroomId: plan.classroomId,
        document: plan.document, checkpoints: plan.checkpoints}, classroom: classroom && {status: classroom.status,
        version: classroom.version, scenes: classroom.document.scenes.length}, sceneTypes: classroom?.document.scenes.map(scene => scene.type), running: snapshot.running,
        saved: saved && {state: saved.state, artifactId: saved.artifactId}};
    }, binding);
    assert(publicState.ok);assert.equal(publicState.plan?.status, 'ready');assert.equal(publicState.plan?.classroomId, binding.classroomId);
    assert.equal(publicState.plan.checkpoints.length, 3);assert.equal(sha256(JSON.stringify(publicState.plan.document)), binding.planDocumentSha256);
    assert.equal(sha256(JSON.stringify(publicState.plan.checkpoints)), binding.checkpointsSha256);
    assert.deepEqual(publicState.classroom, {status: 'confirmed', version: binding.classroomVersion, scenes: 3});
    assert.equal(publicState.sceneTypes.filter(type => type === 'slide').length, 2);
    assert.equal(publicState.sceneTypes.filter(type => type === 'quiz').length, 1);
    assert.equal(publicState.running, false);assert.deepEqual(publicState.saved, {state: 'saved', artifactId: binding.artifactId});
    await page.locator('[data-testid="edu-navigation"]:visible').getByTestId('nav-teaching').click();
    await page.getByTestId('teaching-classrooms-tab').click();await page.getByTestId('classroom-' + binding.classroomId).click();
    await page.frameLocator('[data-testid="classroom-slide-preview"]').locator('.classroom-canvas').waitFor({timeout: 30000});
    assert.equal(await page.locator('[data-testid^="classroom-page-"]').count(), 3);
    for (const [index, type] of publicState.sceneTypes.entries()) {
      await page.getByTestId('classroom-page-' + index).click();
      if (type === 'slide') await page.frameLocator('[data-testid="classroom-slide-preview"]').locator('.classroom-canvas').waitFor({state: 'visible'});
      else await page.getByTestId('classroom-check-answer').waitFor({state: 'visible'});
    }
    await page.getByTestId('classroom-page-0').click();
    for (const [width, height] of [[1366, 768], [1920, 1080]]) {
      await app.evaluate(({BrowserWindow}, size) => BrowserWindow.getAllWindows()[0].setContentSize(...size), [width, height]);
      await page.waitForFunction(size => innerWidth === size[0] && innerHeight === size[1], [width, height]);
      assert.equal(await page.locator('[data-testid="agent-raw-reasoning"],[data-testid="model-reasoning"]').count(), 0);
      const file = `${name}-confirmed-${width}.png`;
      await page.screenshot({path: path.join(output, file), animations: 'disabled'});report.screens.push({file, width, height});
    }
    const host = await page.evaluate(async binding => {
      const address = {sessionId: binding.sessionId, artifactId: binding.artifactId};
      const version = typeof window.omniEdu.officeVersion === 'function'
        ? await window.omniEdu.officeVersion({schemaVersion: 'xiaozhi.office-versions.v1', ...address, action: 'view'}) : null;
      const sources = {available: typeof window.omniEdu.artifactSources === 'function', ok: true, count: 0, classroom: 0, total: null};
      if (!sources.available) sources.ok = false;
      let offset = 0;const seen = new Set();
      while (sources.available) {
        if (seen.has(offset) || seen.size >= 100) {sources.ok = false;sources.error = 'pagination_boundary';break;}
        seen.add(offset);
        const result = await window.omniEdu.artifactSources({schemaVersion: 'xiaozhi.artifact-sources.v1', ...address, offset});
        if (!result.ok) {sources.ok = false;sources.error = result.error;break;}
        if (sources.total !== null && sources.total !== result.value.total) {sources.ok = false;break;}
        sources.total = result.value.total;sources.count += result.value.items.length;
        sources.classroom += result.value.items.filter(item => item.relation === 'classroom').length;
        if (result.value.nextOffset === null) break;
        offset = result.value.nextOffset;
      }
      sources.ok = sources.ok && sources.count === sources.total;
      return {version: version ? version.ok ? {ok: true, integrity: version.value.integrity,
        selectedMatches: version.value.selectedArtifactId === binding.artifactId, versions: version.value.versions.length} : {ok: false, error: version.error} : {ok: false, error: 'API_unavailable'}, sources};
    }, binding);
    const exportProof = await copiedExport(output, original, binding);
    report.stages.push({name, runtime, networkGuard: 'Node TCP + Chromium HTTP/WS denied before readback',
      restored: {ready: true, pages: 3, allPagesNavigated: true, confirmed: true, saved: true}, host, export: exportProof});
    if (host.version.error === 'unsupported')
      report.boundaries.push({stage: name, kind: 'ordinary_Office_version_API_excludes_classroom_schema',
        expectedProductBoundary: true, severity: 'informational', outsideClassroomContract: true});
    else if (!host.version.ok || host.version.integrity !== 'same' || !host.version.selectedMatches)
      report.boundaries.push({stage: name, kind: 'host_Office_file_read_not_fully_verified', result: host.version});
    if (!host.sources.ok || host.sources.classroom < 1)
      report.boundaries.push({stage: name, kind: 'host_classroom_artifact_sources_not_fully_verified', result: host.sources});
    if (!exportProof.receipt.verified) report.boundaries.push({stage: name, kind: exportProof.receipt.boundary});
    await app.close();app = undefined;
    assert.deepEqual(copiedFacts(output), baseline, 'Read-only navigation must create zero runs/student facts or change classroom/export ledgers');
    immutable();check(name + ': same ready 3-page classroom, confirmed/saved export and unchanged run/student facts');
  }
  try {
    originalBefore = originalEvidence(source, original);
    copyFixture(source, output);immutable();
    binding = copiedBinding(output);baseline = copiedFacts(output);
    report.fixture = {original: originalBefore, copyVerifiedBeforeOpen: true, authorityRewritten: false};
    const proof = await copiedExport(output, original, binding);report.copiedExport = proof;
    check('Independent byte copy verified before opening only copied SQLite; copied PPTX hash and ZIP CRC match original');
    await stage('integrated-first');await stage('integrated-cold');
    assert.deepEqual(report.errors, []);assert.equal(fingerprint(buildRoot).sha256, build.sha256, 'Integrated out must remain frozen');
    // Only this explicitly reviewed ordinary-Office exclusion is informational.
    // Receipt authority, classroom sources and all unexpected failures still gate.
    const blocking = report.boundaries.filter(boundary => !(boundary.expectedProductBoundary === true
      && boundary.kind === 'ordinary_Office_version_API_excludes_classroom_schema'
      && boundary.outsideClassroomContract === true));
    report.boundarySummary = {blocking: blocking.length, informational: report.boundaries.length - blocking.length};
    report.status = blocking.length ? 'incomplete_compatibility_boundary' : 'compatible';
    report.success = blocking.length === 0;
    if (!report.success) process.exitCode = 1;
  } catch (error) {report.status = 'failed';report.failure = safeError(error);process.exitCode = 1;}
  finally {
    try {await app?.close();} catch {report.errors.push({kind: 'close_failed'});process.exitCode = 1;report.success = false;}
    try {if (baseline) assert.deepEqual(copiedFacts(output), baseline);
      if (binding && report.copiedExport) assert.deepEqual(await copiedExport(output, original, binding), report.copiedExport);
      if (originalBefore) immutable();
      assert.equal(fingerprint(buildRoot).sha256, build.sha256);report.immutabilityVerified = true;
    } catch {report.success = false;report.status = 'failed_immutability';process.exitCode = 1;}
    fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify({success: report.success, status: report.status, output, checks: report.checks.length, boundaries: report.boundaries.length, boundarySummary: report.boundarySummary}));
  }
}
if (!process.argv.includes('--run-after-settings') || process.argv.includes('--check') || process.argv.includes('--help')) {
  console.log(JSON.stringify({preparedOnly: true, scope, source, outputBase: target,
    originalBuildSha256: original.build.sha256, integratedBuildSha256: build.sha256, integratedRenderer: expectedRenderer,
    originalSQLiteOpened: false, copied: false, electronStarted: false,
    boundary: 'Absolute receipt/workspace authorities remain unchanged; blocked copy host readback is incomplete, never parity',
    informationalOnly: 'Expected ordinary Office unsupported for classroom schema; console errors and classroom/receipt/source/cold/immutability checks remain blocking',
    usage: 'Parent serially runs node scripts/ui-goal-classroom-compatibility.mjs --run-after-settings after closing settings QA; --check is read-only and launches nothing.'}));
} else await run();
