import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {installRendererProbe} from './phase8-stream-performance-probe.mjs';
import {startStreamFixture, streamWorkload} from './phase8-stream-performance-fixture.mjs';
import {summarizeProbe, preparationTiming, preparationBreakdown} from './phase8-stream-performance-metrics.mjs';

const argumentsMap = new Map();
for (let index = 2; index < process.argv.length; index += 2) argumentsMap.set(process.argv[index], process.argv[index + 1]);
for (const key of argumentsMap.keys()) {
  if (!['--desktop-root', '--build-root', '--label', '--expected-out-hash', '--expected-out-count', '--background', '--require-lifecycle'].includes(key)) throw Error('unknown_argument');
}
const desktop = fs.realpathSync(argumentsMap.get('--desktop-root') || process.cwd());
const buildRoot = fs.realpathSync(argumentsMap.get('--build-root') || path.join(desktop, 'out'));
if (argumentsMap.has('--build-root')) {
  const testResults = fs.realpathSync(path.join(desktop, 'test-results'));
  const relative = path.relative(testResults, buildRoot);
  if (!relative || relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) {
    throw Error('Explicit build root must be inside desktop test-results.');
  }
}
const label = argumentsMap.get('--label') || 'unlabeled';
assert(/^[A-Za-z0-9_.-]{1,64}$/.test(label));
const background = argumentsMap.get('--background') === 'true';
const requireLifecycle = argumentsMap.get('--require-lifecycle') === 'true';
const workload = {...streamWorkload, intervalMs: background ? 100 : streamWorkload.intervalMs};
const output = fs.mkdtempSync(path.join(os.tmpdir(), background ? 'omni-edu-xiaozhi-stream-' : 'xiaozhi-phase8-stream-performance-'));
const dataRoot = path.join(output, 'data');
const profile = path.join(output, 'profile');
const main = path.join(buildRoot, 'main/index.js');
const packageRequire = createRequire(path.join(desktop, 'package.json'));
const { _electron: electron } = packageRequire('playwright');
const {fingerprint} = await import(pathToFileURL(path.join(desktop, 'scripts/acceptance/evidence.mjs')).href);
const {assertIsolatedPiMain} = await import(pathToFileURL(path.join(desktop, 'scripts/acceptance/build-root.mjs')).href);
const checks = [];
const report = {success: false, measurementStatus: 'SINGLE_SYNTHETIC_SAMPLE', label, desktop, buildRoot, output, checks,
  realModelCalls: 0, workload, errors: [], automationRoundtrips: [], displayMode: background ? 'background' : 'visible',
  boundary: 'Actual original Electron main/preload/Pi/UI. Fixed net.fetch hook to loopback, synthetic key and empty DB/profile. Single run stops during final output. No product SLA or provider performance conclusion.'};
let application, page, fixture, buildBefore;
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const input = () => page.getByTestId('office-prompt-input');

function check(name, assertion) {assertion(); checks.push({name, pass: true});}
async function waitPhase(phase) {
  await page.waitForFunction(expected => window.phase8StreamProbe.snapshot().phaseChanges.at(-1).phase === expected, phase, {timeout: 45000});
}
async function measure(id, kind, locator, action, extra = {}) {
  await locator.evaluate((node, marker) => node.setAttribute('data-phase8-action', marker), id);
  const selector = `[data-phase8-action="${id}"]`;
  await page.evaluate(value => window.phase8StreamProbe.arm(value), {id, kind, selector, ...extra});
  const started = performance.now();
  await action();
  await page.waitForFunction(marker => window.phase8StreamProbe.snapshot().interactions.some(item => item.id === marker && item.complete), id, {timeout: 12000});
  report.automationRoundtrips.push({id, milliseconds: performance.now() - started,
    clock: 'Outer Node performance.now; includes Playwright transport/actionability/waiting'});
}
async function typeDuring(phase) {
  await input().click();
  await measure(phase + '-input', 'input', input(), () => input().pressSequentially('stream-' + phase, {delay: 25}));
}
async function togglePanel(phase) {
  const panel = page.getByTestId('pi-aside-toggle');
  const expected = await panel.getAttribute('aria-pressed') === 'true' ? 'false' : 'true';
  await measure(phase + '-expand', 'expand', panel, () => panel.click(),
    {expected, attribute: 'aria-pressed', control: 'Original Task and Sources side panel'});
  await panel.click();
}
async function scrollDuring(phase) {
  const selected = await page.evaluate(marker => {
    const nodes = [...document.querySelectorAll('[data-testid="office-conversation"], [data-testid="office-conversation"] *')];
    const candidates = nodes.filter(node => {
      const box = node.getBoundingClientRect();
      return /auto|scroll/.test(getComputedStyle(node).overflowY) && node.scrollHeight > node.clientHeight + 30
        && box.width > 100 && box.height > 80 && box.top >= 0 && box.bottom <= innerHeight;
    }).sort((left, right) => left.clientHeight - right.clientHeight);
    const node = candidates[0];
    if (!node) return null;
    node.setAttribute('data-phase8-scroll', marker);
    return {before: node.scrollTop, maximum: node.scrollHeight - node.clientHeight,
      direction: node.scrollTop > 100 ? -360 : 360};
  }, phase);
  assert(selected, 'No visible scrollable stream surface');
  const target = page.locator(`[data-phase8-scroll="${phase}"]`);
  await target.hover();
  await measure(phase + '-scroll', 'scroll', target, () => page.mouse.wheel(0, selected.direction), {beforeScrollTop: selected.before});
}

try {
  assert(!fs.existsSync(path.join(dataRoot, 'app.db')));
  buildBefore = fingerprint(buildRoot);
  report.buildBefore = {sha256: buildBefore.sha256, files: buildBefore.files.length};
  fs.writeFileSync(path.join(output, 'out-before.json'), JSON.stringify(buildBefore, null, 2));
  if (argumentsMap.has('--expected-out-hash')) assert.equal(buildBefore.sha256, argumentsMap.get('--expected-out-hash'));
  if (argumentsMap.has('--expected-out-count')) assert.equal(buildBefore.files.length, Number(argumentsMap.get('--expected-out-count')));
  fixture = await startStreamFixture({intervalMs: workload.intervalMs});
  const bootstrap = path.join(output, 'bootstrap.cjs');
  fs.writeFileSync(bootstrap, `const {app,net}=require('electron');
app.setPath('userData',${JSON.stringify(profile)});
const originalFetch=net.fetch;
const lifecycleChannel=require('node:diagnostics_channel').channel('omni-edu.xiaozhi.lifecycle.v1');
globalThis.phase8Lifecycle={version:1,rows:[],dropped:0,invalid:0,limit:4096};
const observeLifecycle=row=>{
 if(!row||row.version!==1||!/^[a-z0-9_]{1,80}$/.test(row.operation)||!['success','cancelled','timeout','error'].includes(row.outcome)
  ||![row.startedEpochMs,row.endedEpochMs,row.durationMs].every(Number.isFinite)
  ||row.runId!==undefined&&!/^run_[a-z0-9-]{1,80}$/i.test(row.runId)){phase8Lifecycle.invalid++;return;}
 if(phase8Lifecycle.rows.length>=phase8Lifecycle.limit){phase8Lifecycle.dropped++;return;}
 phase8Lifecycle.rows.push({version:1,operation:row.operation,...(row.runId?{runId:row.runId}:{}),
  startedEpochMs:row.startedEpochMs,endedEpochMs:row.endedEpochMs,durationMs:row.durationMs,outcome:row.outcome});
};
lifecycleChannel.subscribe(observeLifecycle);
globalThis.phase8Transport={calls:[],blocked:0,timeOrigin:performance.timeOrigin,dateCalibrationMs:Date.now()-(performance.timeOrigin+performance.now())};
globalThis.phase8RestoreTransport=()=>{net.fetch=originalFetch;lifecycleChannel.unsubscribe(observeLifecycle);};
net.fetch=async(input,init)=>{
 const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
 if(url.protocol!=='https:'||url.hostname!=='api.deepseek.com'||url.port||!['/v1/models','/v1/chat/completions'].includes(url.pathname)){
  phase8Transport.blocked++;throw Error('phase8_fixture_network_blocked');
 }
 const row={path:url.pathname,epochMs:performance.timeOrigin+performance.now(),method:init?.method||'GET'};
 phase8Transport.calls.push(row);
 try{const response=await globalThis.fetch(${JSON.stringify(fixture.origin)}+url.pathname,{...init,redirect:'error'});row.httpStatus=response.status;return response;}
 catch{row.error='fixture_transport_closed';throw Error('phase8_fixture_transport_closed');}
};
app.whenReady().then(()=>import(${JSON.stringify(pathToFileURL(main).href)}));`);
  const environment = {...process.env};
  for (const key of Object.keys(environment)) {
    if (/(API_KEY|ACCESS_TOKEN|SECRET|PASSWORD)$/i.test(key) || key.startsWith('OMNI_EDU_E2E_')) delete environment[key];
  }
  for (const key of ['NODE_OPTIONS', 'ELECTRON_RUN_AS_NODE', 'ELECTRON_RENDERER_URL', 'HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'NO_PROXY']) delete environment[key];
  Object.assign(environment, {OMNI_EDU_DATA_ROOT: dataRoot, OMNI_EDU_REPO_ROOT: path.resolve(desktop, '../..'),
    OMNI_EDU_XIAOZHI_PI: '1', OMNI_EDU_E2E_VISIBLE: '1', DEEPSEEK_API_KEY: 'synthetic-stream-fixture-only', DEEPSEEK_MODEL: 'deepseek-flash'});
  if (background) {
    fs.mkdirSync(dataRoot);
    fs.mkdirSync(profile);
    Object.assign(environment, {OMNI_EDU_E2E_DIALOG_MODE: '1', OMNI_EDU_E2E_VISIBLE: '0'});
  }
  application = await electron.launch({executablePath: packageRequire('electron'),
    args: [bootstrap, '--force-device-scale-factor=1'], cwd: desktop, env: environment, timeout: 60000});
  page = await application.firstWindow();
  page.on('pageerror', error => report.errors.push(error.message));
  await page.getByTestId('xiaozhi-pi-workspace').waitFor({timeout: 60000});
  await page.waitForFunction(() => !document.querySelector('[data-testid="office-prompt-input"]')?.disabled);
  const visible = await application.evaluate(({BrowserWindow}, hidden) => {
    const window = BrowserWindow.getAllWindows()[0];
    window.setContentSize(1366, 768);
    if (!hidden) { window.show(); window.focus(); }
    return window.isVisible();
  }, background);
  assert.equal(visible, !background);
  report.geometry = {main: await application.evaluate(({BrowserWindow}) => {
    const window = BrowserWindow.getAllWindows()[0];
    return {bounds: window.getBounds(), contentBounds: window.getContentBounds()};
  }), renderer: await page.evaluate(() => ({innerWidth, innerHeight, devicePixelRatio})),
    launchSwitch: '--force-device-scale-factor=1'};
  report.isolation = await assertIsolatedPiMain(application, main, profile);
  report.clocks = {main: await application.evaluate(() => ({timeOrigin: performance.timeOrigin,
    epochMs: performance.timeOrigin + performance.now(), dateCalibrationMs: Date.now() - (performance.timeOrigin + performance.now())})),
    renderer: await page.evaluate(() => ({timeOrigin: performance.timeOrigin,
      epochMs: performance.timeOrigin + performance.now(), dateCalibrationMs: Date.now() - (performance.timeOrigin + performance.now())})),
    outerNode: {timeOrigin: performance.timeOrigin, epochMs: performance.timeOrigin + performance.now()},
    limitation: 'Epoch anchors share the host wall clock with process-specific initialization/calibration uncertainty. RAF measures callback opportunities; physical display presentation is unobserved.'};
  await page.evaluate(installRendererProbe);
  await input().pressSequentially('请直接逐段输出合成课堂说明，不调用工具。', {delay: 5});
  await measure('submit', 'submit', input(), () => input().press('Enter'));
  await waitPhase('reasoning');
  if (background) {
    const reasoning = page.getByTestId('model-reasoning').first();
    await reasoning.waitFor({state: 'visible'});
    const first = (await reasoning.innerText()).length;
    await page.waitForFunction(length => (document.querySelector('[data-testid="model-reasoning"]')?.innerText.length || 0) > length, first);
    const later = (await reasoning.innerText()).length;
    const phase = await page.evaluate(() => window.phase8StreamProbe.snapshot().phaseChanges.at(-1).phase);
    check('Provider reasoning grows visibly before terminal state', () => {
      assert.equal(phase, 'reasoning');
      assert(first > 0 && later > first);
    });
    report.visibleReasoning = {first, later};
  }
  await typeDuring('reasoning');
  await togglePanel('reasoning');
  await scrollDuring('reasoning');
  await page.screenshot({path: path.join(output, 'reasoning.png')});
  await waitPhase('final');
  await typeDuring('final');
  await togglePanel('final');
  await scrollDuring('final');
  await page.screenshot({path: path.join(output, 'final-stream.png')});
  const stop = page.getByRole('button', {name: '停止本轮', exact: true});
  await measure('final-stop', 'stop', stop, () => stop.click());
  const sessionId = await page.locator('.office-composer-container').getAttribute('data-session-id');
  await page.waitForFunction(async id => !(await window.omniEdu.getXiaozhiSnapshot(id)).running, sessionId);
  const snapshot = await page.evaluate(id => window.omniEdu.getXiaozhiSnapshot(id), sessionId);
  const turn = snapshot.projection.turns.at(-1);
  report.turn = {sessionId, runId: turn.id, status: turn.status, reasoningBlocks: turn.modelReasoning?.length,
    finalChars: turn.items.filter(item => item.role === 'assistant').reduce((sum, item) => sum + (item.text?.length || 0), 0),
    observedAssistantPhases: [...new Set(turn.items.filter(item => item.role === 'assistant').map(item => item.phase ?? 'unclassified'))]};
  // Public terminal projection can precede the existing post-terminal audit/route seal.
  // Wait only for its correlated observation; do not alter host settlement semantics.
  await application.evaluate(async (_electron, runId) => {
    if (!runId.required && !globalThis.phase8Lifecycle.rows.length) return;
    const deadline = performance.now() + 5000;
    while (!globalThis.phase8Lifecycle.rows.some(row => row.operation === 'host_execute' && row.runId === runId.id)
      && performance.now() < deadline) await new Promise(resolve => setTimeout(resolve, 25));
  }, {id: turn.id, required: requireLifecycle});
  report.transport = await application.evaluate(() => globalThis.phase8Transport);
  report.lifecycle = await application.evaluate(() => globalThis.phase8Lifecycle);
  report.rendererRaw = await page.evaluate(() => window.phase8StreamProbe.dispose());
  report.metrics = summarizeProbe(report.rendererRaw);
  const submit = report.rendererRaw.submissions[0];
  const modelFetch = report.transport.calls.find(row => row.path === '/v1/chat/completions');
  report.preparation = preparationTiming({submitEpochMs: submit.epochMs,
    mainFetchEpochMs: modelFetch.epochMs, fixtureEpochMs: fixture.requests[0].epochMs});
  report.preparation.breakdown = preparationBreakdown({lifecycle: report.lifecycle, runId: turn.id,
    submitEpochMs: submit.epochMs, mainFetchEpochMs: modelFetch.epochMs, fixtureEpochMs: fixture.requests[0].epochMs});
  report.preparation.lifecycleRequired = requireLifecycle;
  report.preparation.instrumentation = report.lifecycle.rows.length ? 'observed' : 'unavailable';
  if (requireLifecycle || report.lifecycle.rows.length || report.lifecycle.dropped || report.lifecycle.invalid) {
    check('First request preparation has complete bounded correlated spans and ordered boundaries', () => {
      assert.equal(report.preparation.breakdown.complete, true, JSON.stringify(report.preparation.breakdown.reasons));
      assert(Math.abs(report.preparation.breakdown.accountedMs - report.preparation.submitToFixtureMs) < 0.05);
    });
  }
  check('Actual original Pi UI handles one fixture run and terminal stop', () => {assert.equal(turn.status, 'interrupted'); assert(report.turn.finalChars > 0);});
  check('Reasoning and final have live renderer RAF samples and trusted input expansion scroll events', () => {
    for (const phase of ['reasoning', 'final']) {
      assert(report.metrics.phases[phase].raf.count > 0);
      for (const kind of ['input', 'expand', 'scroll']) {
        const action = report.metrics.interactions.find(item => item.id === phase + '-' + kind);
        assert(action.complete && action.trusted && action.eventPhase === phase);
      }
    }
    assert(report.rendererRaw.supportedLongTasks);
    assert(report.rendererRaw.inputSamples.every(sample => sample.trusted));
  });
  check('Fixture transport remains loopback with a synthetic credential and no hidden retry', () => {
    assert.equal(fixture.requests.length, 1); assert(fixture.requests[0].authSynthetic); assert.equal(report.transport.blocked, 0);
    assert.equal(report.transport.calls.filter(row => row.path === '/v1/chat/completions').length, 1);
  });
  const database = new DatabaseSync(path.join(dataRoot, 'app.db'), {readOnly: true});
  try {
    report.readback = {runs: database.prepare('SELECT id,status FROM ai_agent_runs').all(),
      eventRuns: database.prepare('SELECT run_id,generation,status,sequence FROM xiaozhi_event_runs').all(),
      nativeBindings: database.prepare('SELECT conversation_id,session_file FROM xiaozhi_pi_session_bindings').all()};
    const savedMetrics = database.prepare("SELECT metadata_json FROM ai_conversation_messages WHERE session_id=? AND role='assistant'").all(sessionId)
      .map(row => {try {return JSON.parse(row.metadata_json);} catch {return null;}})
      .find(metadata => metadata?.agentRunId === turn.id)?.answerQuality;
    const storedPreparationMs = Number.isFinite(savedMetrics?.preparationMs) ? savedMetrics.preparationMs : null;
    const observedPreparationMs = report.preparation.breakdown.complete ? report.preparation.breakdown.hostPreparationMs : null;
    report.preparation.alignment = {storedPreparationMs, observedPreparationMs,
      differenceMs: storedPreparationMs === null || observedPreparationMs === null ? null : observedPreparationMs - storedPreparationMs,
      boundary: 'Existing persisted execute-entry to pre-prompt duration versus the enclosing observation boundaries; tiny observer-call overhead remains.'};
    if (storedPreparationMs !== null && observedPreparationMs !== null) check('Observed preparation agrees with the existing persisted boundary', () => {
      assert(Math.abs(report.preparation.alignment.differenceMs) < 10, 'preparation_boundary_alignment_mismatch');
    });
  } finally {database.close();}
  check('SQLite run identity and renderer error evidence are retained', () => {
    assert(report.readback.runs.some(row => row.id === turn.id && row.status !== 'running')); assert.deepEqual(report.errors, []);
  });
  if (!background) await page.screenshot({path: path.join(output, 'stopped.png')});
  report.success = true;
} catch (error) {
  report.error = error.stack;
  if (page) {
    report.rendererRaw ??= await page.evaluate(() => window.phase8StreamProbe?.snapshot()).catch(() => undefined);
    report.transport ??= await application.evaluate(() => globalThis.phase8Transport).catch(() => undefined);
    report.lifecycle ??= await application.evaluate(() => globalThis.phase8Lifecycle).catch(() => undefined);
    await page.screenshot({path: path.join(output, 'failure.png')}).catch(() => undefined);
  }
} finally {
  if (application) {
    await page?.evaluate(() => window.phase8StreamProbe?.dispose()).catch(() => undefined);
    await application.evaluate(() => globalThis.phase8RestoreTransport?.()).catch(() => undefined);
    await application.close().catch(error => {report.cleanupError = error.message; report.success = false;});
  }
  await fixture?.close();
  report.fixtureRequests = fixture?.requests;
  if (report.rendererRaw) {
    report.metrics ??= summarizeProbe(report.rendererRaw);
    const submit = report.rendererRaw.submissions[0];
    const request = report.transport?.calls.find(row => row.path === '/v1/chat/completions');
    if (submit && request && fixture.requests[0]) report.preparation ??= preparationTiming({submitEpochMs: submit.epochMs,
      mainFetchEpochMs: request.epochMs, fixtureEpochMs: fixture.requests[0].epochMs});
  }
  if (buildBefore) {
    const after = fingerprint(buildRoot);
    report.buildAfter = {sha256: after.sha256, files: after.files.length};
    report.buildUnchanged = after.sha256 === buildBefore.sha256;
    if (!report.buildUnchanged) report.success = false;
  }
  report.scriptHashes = fs.readdirSync(import.meta.dirname).filter(name => name.startsWith('phase8-stream-performance-'))
    .map(name => ({name, sha256: sha(fs.readFileSync(path.join(import.meta.dirname, name)))}));
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({success: report.success, output, label, metrics: report.metrics,
    preparation: report.preparation, error: report.error}));
  if (!report.success) process.exitCode = 1;
}
