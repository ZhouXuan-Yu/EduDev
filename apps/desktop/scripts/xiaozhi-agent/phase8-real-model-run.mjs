import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {openBudgetLedger} from './phase8-budget-ledger.mjs';
import {startCountingProxy} from './phase8-counting-proxy.mjs';
import {actualDatabasePath, providerPaths, syntheticFiles, schedule, validateManifest, preparePlan, fingerprint, sha256} from './phase8-real-model-plan.mjs';
import {readOriginalRecords, verifiedRunBinding, collectFiles, inspectOfficeArtifacts, exportBlindBundle} from './phase8-real-model-readback.mjs';

function rendererObservation() {
  const point = () => performance.now();
  const data = {clock: {timeOrigin: performance.timeOrigin, dateCalibrationMs: Date.now() - (performance.timeOrigin + point())},
    submissions: [], events: [], runId: null, terminalAt: null};
  function submitted(event) {
    if (event.target?.closest('[data-testid="office-prompt-send"]') || event.type === 'keydown' && event.key === 'Enter'
        && !event.shiftKey && event.target?.matches('[data-testid="office-prompt-input"]')) {
      data.submissions.push({at: point(), trusted: event.isTrusted});
    }
  }
  document.addEventListener('click', submitted, true); document.addEventListener('keydown', submitted, true);
  const unsubscribe = window.omniEdu.onXiaozhiEvent(event => {
    if (!data.submissions.length) return;
    if (event.kind === 'status' && event.status === 'running') data.runId ??= event.runId;
    if (data.runId && event.runId !== data.runId) return;
    const row = {at: point(), kind: event.kind, runId: event.runId, sequence: event.sequence};
    if (event.kind === 'status') {row.status = event.status; if (event.status !== 'running') data.terminalAt = point();}
    if (['tool_start', 'tool_end'].includes(event.kind)) {row.tool = event.tool; row.callId = event.callId;
      if (event.kind === 'tool_end') {row.success = event.success; row.durationMs = event.durationMs;}}
    if (event.kind === 'model_request') row.request = {state: event.request.state, attempt: event.request.attempt, status: event.request.status};
    if (['status', 'tool_start', 'tool_end', 'model_request', 'approval'].includes(event.kind)) data.events.push(row);
  });
  window.phase8RealObservation = {snapshot: () => structuredClone(data), dispose() {
    unsubscribe(); document.removeEventListener('click', submitted, true); document.removeEventListener('keydown', submitted, true);
  }};
}

function isolatedEnvironment(desktop, dataRoot, model) {
  const environment = {};
  for (const name of Object.keys(process.env)) {
    if (/(KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL)/i.test(name) || name.startsWith('OMNI_EDU_E2E_')
        || ['NODE_OPTIONS', 'ELECTRON_RUN_AS_NODE', 'ELECTRON_RENDERER_URL', 'HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'NO_PROXY'].includes(name)) continue;
    environment[name] = process.env[name];
  }
  return {...environment, OMNI_EDU_DATA_ROOT: dataRoot, OMNI_EDU_REPO_ROOT: path.resolve(desktop, '../..'),
    OMNI_EDU_XIAOZHI_PI: '1', OMNI_EDU_E2E_VISIBLE: '1', DEEPSEEK_MODEL: model};
}

function verifyVersion(item) {
  const desktop = fs.realpathSync(item.desktopRoot);
  const commit = execFileSync('git', ['rev-parse', 'HEAD'], {cwd: desktop, encoding: 'utf8'}).trim();
  const out = fingerprint(path.join(desktop, 'out'));
  if (commit !== item.commit || out.sha256 !== item.outSha256 || out.files.length !== item.outCount) throw Error('phase8_build_freeze_mismatch');
  for (const [directory, expected] of [[item.dataSnapshot, item.dataSha256], [item.profileSnapshot, item.profileSha256]]) {
    if (fingerprint(directory).sha256 !== expected) throw Error('phase8_snapshot_freeze_mismatch');
  }
  const dependencies = [];
  for (const name of ['electron', 'playwright', 'openai', 'jszip', '@earendil-works/pi-ai', '@earendil-works/pi-agent-core', '@earendil-works/pi-coding-agent']) {
    const source = path.join(desktop, 'node_modules', name, 'package.json');
    const bytes = fs.readFileSync(source), definition = JSON.parse(bytes); dependencies.push({name, version: definition.version, packageSha256: sha256(bytes)});
  }
  const repo = execFileSync('git', ['rev-parse', '--show-toplevel'], {cwd: desktop, encoding: 'utf8'}).trim();
  const lockfiles = [];
  for (const source of [path.join(desktop, 'package-lock.json'), path.join(repo, 'package-lock.json'), path.join(repo, 'pnpm-lock.yaml')]) {
    if (fs.existsSync(source)) lockfiles.push({path: source, sha256: sha256(fs.readFileSync(source))});
  }
  return {desktop, commit, out, dependencies, lockfiles};
}

async function handleVisibleApproval(page, task, decisions) {
  const pending = page.locator('[data-testid="pi-permission-approval"][data-state="pending"], [data-testid="pi-copy-approval"][data-state="pending"]');
  if (!await pending.count()) return;
  const card = pending.first(); await card.scrollIntoViewIfNeeded();
  const id = await card.getAttribute('data-approval-id');
  if (decisions.some(item => item.id === id)) return;
  const decision = task === 'Q8' ? 'reject' : 'approve';
  const button = card.locator(`[data-testid="pi-permission-${decision}"], [data-testid="pi-copy-${decision}"]`).first();
  if (!await button.count()) throw Error('phase8_visible_approval_control_missing');
  const startedAt = performance.now(); await button.click();
  decisions.push({id, decision, startedAt, completedAt: performance.now(), clock: 'outer Node performance.now'});
}

async function collectRun(row, manifest, version, ledger, output) {
  const root = path.join(output, row.id); fs.mkdirSync(root);
  const dataRoot = path.join(root, 'data'), profile = path.join(root, 'profile'), workspace = path.join(root, 'workspace');
  fs.cpSync(manifest.versions[row.version].dataSnapshot, dataRoot, {recursive: true, errorOnExist: true, force: false});
  fs.cpSync(manifest.versions[row.version].profileSnapshot, profile, {recursive: true, errorOnExist: true, force: false});
  fs.mkdirSync(workspace);
  for (const [name, contents] of Object.entries(syntheticFiles)) fs.writeFileSync(path.join(workspace, name), contents);
  const beforeFiles = collectFiles(workspace), beforeBudget = ledger.summary();
  const evidenceRef = 'phase8-real/' + path.basename(output) + '/' + row.id;
  const context = {task: row.task, version: row.version, round: row.round, evidenceRef};
  const proxies = [], routes = {};
  let application, page, snapshot, sessionId, runId;
  const result = {...row, collectionStatus: 'FAIL', qualityStatus: 'NOT_TESTED', output: root, decisions: [], beforeBudget, beforeFiles,
    requestTimingBoundary: 'Main monotonic clock measures request/body consumption. Renderer clock measures trusted submission and terminal UI. Cross-process epoch differences are estimates with recorded calibration.',
    webpageHttpTiming: 'N/A unless independently observed in original source-tool evidence', failureRecoveryScenarios: 'NOT_TESTED_SEPARATE_PLANNED_SCENARIOS'};
  try {
    result.stage = 'proxy_setup';
    for (const providerPath of providerPaths) {
      const proxy = await startCountingProxy({ledger, providerEndpoint: 'https://api.deepseek.com' + providerPath,
        context, requestTimeoutMs: manifest.requestTimeoutMs});
      proxies.push(proxy); routes[providerPath] = proxy.url;
    }
    const bootstrap = path.join(root, 'bootstrap.cjs');
    const transportModule = pathToFileURL(path.join(import.meta.dirname, 'phase8-real-model-transport.mjs')).href;
    fs.writeFileSync(bootstrap, `const {app,net}=require('electron');app.setPath('userData',${JSON.stringify(profile)});
app.whenReady().then(async()=>{const {installProviderBridge}=await import(${JSON.stringify(transportModule)});
globalThis.phase8RealBridge=installProviderBridge(net,${JSON.stringify({chatRoutes: routes})});
await import(${JSON.stringify(pathToFileURL(path.join(version.desktop, 'out/main/index.js')).href)});});`);
    result.stage = 'electron_launch';
    const require = createRequire(path.join(version.desktop, 'package.json'));
    const {_electron: electron} = require('playwright');
    application = await electron.launch({executablePath: require('electron'), cwd: version.desktop,
      args: [bootstrap, '--force-device-scale-factor=1'], env: isolatedEnvironment(version.desktop, dataRoot, manifest.model.id), timeout: 60000});
    page = await application.firstWindow(); await page.getByTestId('xiaozhi-pi-workspace').waitFor({timeout: 60000});
    await page.waitForFunction(() => !document.querySelector('[data-testid="office-prompt-input"]')?.disabled);
    await application.evaluate(({BrowserWindow}) => {const window = BrowserWindow.getAllWindows()[0]; window.setContentSize(1366, 768); window.show(); window.focus();});
    result.geometry = {main: await application.evaluate(({BrowserWindow}) => {
      const window = BrowserWindow.getAllWindows()[0]; return {bounds: window.getBounds(), contentBounds: window.getContentBounds()};
    }), renderer: await page.evaluate(() => ({innerWidth, innerHeight, devicePixelRatio}))};
    const previousSession = await page.locator('.office-composer-container').getAttribute('data-session-id');
    await page.getByTestId('pi-new-session').click();
    await page.waitForFunction(previous => {
      const id = document.querySelector('.office-composer-container')?.getAttribute('data-session-id'); return id && id !== previous;
    }, previousSession);
    result.stage = 'workspace_selection';
    await application.evaluate(({dialog}, selected) => {globalThis.phase8OriginalPicker = dialog.showOpenDialog;
      dialog.showOpenDialog = async () => ({canceled: false, filePaths: [selected]});}, workspace);
    await page.getByTestId('pi-permission-picker').click(); await page.getByRole('menuitem', {name: '选择教学工作目录', exact: true}).click();
    sessionId = await page.locator('.office-composer-container').getAttribute('data-session-id');
    await page.waitForFunction(async id => Boolean((await window.omniEdu.getXiaozhiSnapshot(id)).workspace), sessionId);
    await application.evaluate(({dialog}) => {dialog.showOpenDialog = globalThis.phase8OriginalPicker; delete globalThis.phase8OriginalPicker;});
    await page.evaluate(rendererObservation);
    result.stage = 'ui_submission';
    await page.getByTestId('office-prompt-input').fill(row.input);
    result.outerSubmitStartedAt = performance.now(); await page.getByTestId('office-prompt-send').click();
    const deadline = performance.now() + manifest.runTimeoutMs;
    result.stage = 'terminal_wait';
    while (performance.now() < deadline) {
      await handleVisibleApproval(page, row.task, result.decisions);
      const observation = await page.evaluate(() => window.phase8RealObservation.snapshot());
      runId = observation.runId || runId;
      snapshot = await page.evaluate(id => window.omniEdu.getXiaozhiSnapshot(id), sessionId);
      if (runId && !snapshot.running && snapshot.projection.turns.some(turn => turn.id === runId && turn.status !== 'running')) break;
      await page.waitForTimeout(100);
    }
    if (!runId || snapshot.running) {
      const stop = page.getByRole('button', {name: '停止本轮', exact: true});
      if (await stop.isVisible()) await stop.click();
      throw Error('phase8_run_deadline');
    }
    result.stage = 'readback';
    result.observation = await page.evaluate(() => window.phase8RealObservation.snapshot());
    result.transport = await application.evaluate(() => globalThis.phase8RealBridge.snapshot());
    result.records = readOriginalRecords(path.join(dataRoot, 'app.db'), sessionId, runId);
    result.binding = verifiedRunBinding({sessionId, runId, snapshot, records: result.records});
    const turn = snapshot.projection.turns.find(item => item.id === runId);
    result.terminal = turn.status;
    result.answer = turn.items.filter(item => item.role === 'assistant').map(item => item.text || '').join('\n');
    result.artifacts = collectFiles(workspace);
    result.officeReadback = await inspectOfficeArtifacts(result.artifacts, version.desktop);
    result.outerReadbackCompletedAt = performance.now();
    const submittedAt = result.observation.submissions[0]?.at;
    const firstRequest = result.transport.chats[0];
    result.timings = {rendererSubmitToTerminalMs: Number.isFinite(submittedAt) && result.observation.terminalAt !== null
      ? result.observation.terminalAt - submittedAt : null,
    outerAutomationAndReadbackMs: result.outerReadbackCompletedAt - result.outerSubmitStartedAt,
    preparationCrossClockEstimateMs: Number.isFinite(submittedAt) && firstRequest
      ? result.transport.clock.timeOrigin + firstRequest.at - result.observation.clock.timeOrigin - submittedAt : null,
    exactUpstreamRequestSentAt: 'N/A_DURABLE_PROXY_DISPATCH_MARK_PRECEDES_HTTP_REQUEST_CONSTRUCTION',
    exactProviderFirstBodyByteAt: 'N/A_MAIN_FIRST_BYTE_INCLUDES_LOOPBACK_PROXY_TRANSIT',
    requestIntervals: result.transport.chats.map(request => ({index: request.index,
      proxyCallToHeadersMs: request.headersAt === null ? null : request.headersAt - request.dispatchAt,
      proxyCallToObservedFirstByteMs: request.firstByteAt === null ? null : request.firstByteAt - request.dispatchAt,
      proxyCallToConsumerEndMs: request.endAt === null ? null : request.endAt - request.dispatchAt})),
    limitation: 'Request intervals share main performance.now. UI terminal interval shares renderer performance.now. Epoch-based preparation is an estimate with both calibrations retained. Outer duration includes automation and polling. No product latency PASS.'};
    result.snapshot = snapshot;
    result.explicitChecks = {scoresUnchanged: result.artifacts.find(item => item.relativePath === 'scores.csv')?.sha256 === beforeFiles.find(item => item.relativePath === 'scores.csv')?.sha256,
      practiceBytesExact: fs.existsSync(path.join(workspace, 'practice.txt')) ? fs.readFileSync(path.join(workspace, 'practice.txt'), 'utf8') === '合成练习：3/4 + 1/4 = 1' : false,
      copyAbsent: !fs.existsSync(path.join(workspace, 'copy.txt')), refusalObserved: result.decisions.some(item => item.decision === 'reject')};
    await page.screenshot({path: path.join(root, 'terminal.png'), fullPage: true});
    result.collectionStatus = 'PASS';
  } catch (error) {
    result.error = /^phase8_[a-z_]+$/.test(error.message) ? error.message : 'phase8_collection_failed';
    if (application) result.transport = await application.evaluate(() => globalThis.phase8RealBridge?.snapshot()).catch(() => undefined);
    if (page) await page.screenshot({path: path.join(root, 'failure.png'), fullPage: true}).catch(() => {});
  } finally {
    if (application) {
      await page?.evaluate(() => window.phase8RealObservation?.dispose()).catch(() => {});
      await application.evaluate(({dialog}) => {if (globalThis.phase8OriginalPicker) dialog.showOpenDialog = globalThis.phase8OriginalPicker;
        globalThis.phase8RealBridge?.restore();}).catch(() => {result.cleanupError = 'phase8_restore_failed';});
      await application.close().catch(() => {result.cleanupError = 'phase8_close_failed';});
    }
    for (const proxy of proxies) await proxy.close().catch(() => {result.cleanupError = 'phase8_proxy_close_failed';});
    try {
      result.attempts = ledger.attempts().filter(attempt => attempt.context.evidenceRef === evidenceRef);
      if (result.binding) {
        for (const attempt of result.attempts) ledger.bindRun(attempt.reservationId, result.binding.runId);
        result.attempts = ledger.attempts().filter(attempt => attempt.context.evidenceRef === evidenceRef);
        result.coldRecords = readOriginalRecords(path.join(dataRoot, 'app.db'), sessionId, runId);
      }
      result.afterBudget = ledger.summary();
    } catch {result.bindingError = 'phase8_attempt_binding_or_readback_failed';}
    if (result.cleanupError || result.bindingError) result.collectionStatus = 'FAIL';
    result.httpAttemptCount = result.attempts?.length ?? null;
    result.wireComparison = (result.transport?.chats || []).map(request => ({index: request.index,
      modelMatches: request.configuration.model === manifest.model.id,
      expectedFieldsMatch: Object.entries(manifest.model.expectedWire || {}).every(([key, value]) => JSON.stringify(request.configuration[key]) === JSON.stringify(value))}));
    if (result.collectionStatus === 'PASS') result.stage = 'collected';
    fs.writeFileSync(path.join(root, 'report.json'), JSON.stringify(result, null, 2));
  }
  return result;
}

export async function executePlan(manifestPath, output) {
  const manifest = validateManifest(JSON.parse(fs.readFileSync(manifestPath, 'utf8')));
  if (!fs.existsSync(actualDatabasePath)) throw Error('phase8_actual_goal_ledger_missing');
  if (!fs.existsSync(manifest.questionSeedEvidence)) throw Error('phase8_question_seed_evidence_missing');
  const versions = {A: verifyVersion(manifest.versions.A), B: verifyVersion(manifest.versions.B)};
  fs.mkdirSync(output, {recursive: true});
  fs.copyFileSync(manifestPath, path.join(output, 'execution-manifest.json'));
  fs.writeFileSync(path.join(output, 'builds.json'), JSON.stringify(versions, null, 2));
  fs.writeFileSync(path.join(output, 'machine.json'), JSON.stringify({node: process.version, platform: os.platform(), release: os.release(), arch: os.arch(),
    cpus: os.cpus().map(cpu => cpu.model), totalMemory: os.totalmem(), conditions: manifest.conditions,
    launchMode: 'fresh Electron process and cloned synthetic snapshot per run'}, null, 2));
  const ledger = openBudgetLedger({databasePath: actualDatabasePath});
  const results = [];
  try {
    for (const row of schedule) {
      if (!ledger.summary().remaining) {results.push({...row, collectionStatus: 'NOT_TESTED', reason: 'budget_exhausted'}); continue;}
      results.push(await collectRun(row, manifest, versions[row.version], ledger, output));
    }
    exportBlindBundle(path.join(output, 'blind-samples'), results.filter(row => row.collectionStatus === 'PASS'));
    const buildsAfter = {A: verifyVersion(manifest.versions.A), B: verifyVersion(manifest.versions.B)};
    fs.writeFileSync(path.join(output, 'builds-after.json'), JSON.stringify(buildsAfter, null, 2));
    fs.writeFileSync(path.join(output, 'summary.json'), JSON.stringify({qualityStatus: 'NOT_TESTED_INDEPENDENT_BLIND_REVIEW',
      budget: ledger.summary(), results: results.map(row => ({id: row.id, collectionStatus: row.collectionStatus, terminal: row.terminal,
        error: row.error, httpAttemptCount: row.httpAttemptCount, output: row.output})),
      limits: ['Q3 interactive HTML browser tests and all quality scoring remain independent.',
        'Q5 webpage request clock and exact-once file writes require original source/receipt review.',
        'The separately planned cancel/reject/network failure runs are outside this fixed32 collector.']}, null, 2));
  } finally {ledger.close();}
  return {output, collected: results.length};
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const [action, manifest] = process.argv.slice(2);
  const output = fs.mkdtempSync(path.join(os.tmpdir(), 'xiaozhi-phase8-real-model-'));
  try {
    if (action === 'prepare') console.log(JSON.stringify(preparePlan(output)));
    else if (action === 'execute' && manifest) console.log(JSON.stringify(await executePlan(manifest, output)));
    else throw Error('phase8_usage_prepare_or_execute_manifest');
  } catch (error) {console.error(JSON.stringify({status: 'NOT_TESTED', output,
    code: /^phase8_[a-z_]+$/.test(error.message) ? error.message : 'phase8_preparation_failed'})); process.exitCode = 1;}
}
