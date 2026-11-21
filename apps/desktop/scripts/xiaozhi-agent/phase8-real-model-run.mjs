import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {openBudgetLedger} from './phase8-budget-ledger.mjs';
import {startCountingProxy} from './phase8-counting-proxy.mjs';
import {actualDatabasePath, providerPaths, syntheticFiles, schedule, validateManifest, preparePlan, fingerprint, sha256} from './phase8-real-model-plan.mjs';
import {readFrozenQuestionSeed} from './phase8-question-seed.mjs';
import {correctionBudget, loadCorrectionPlan} from './phase8-correction-plan.mjs';
import {confirmSyntheticArtifact} from './phase8-correction-artifacts.mjs';
import {readOriginalRecords, verifiedRunBinding, collectFiles, inspectOfficeArtifacts, exportBlindBundle,
  q5ContinuationDecision, verifyQ5ApprovalConsumption, verifyQ5ActiveApproval, readQ5SourceEvidence} from './phase8-real-model-readback.mjs';

export function rendererObservation(sessionId) {
  const point = () => performance.now();
  const data = {clock: {timeOrigin: performance.timeOrigin, dateCalibrationMs: Date.now() - (performance.timeOrigin + point())},
    submissions: [], continuations: [], events: [], runId: null, runIds: [], terminalAt: null};
  const terminalRuns = new Set();
  let continuationArmed = false;
  function submitted(event) {
    if (event.type === 'click' && event.target?.closest('[data-phase8-real-submit="true"]') || event.type === 'keydown' && event.key === 'Enter'
        && !event.shiftKey && event.target?.matches('[data-testid="office-prompt-input"]')) {
      data.submissions.push({at: point(), trusted: event.isTrusted});
    }
  }
  document.addEventListener('click', submitted, true); document.addEventListener('keydown', submitted, true);
  const unsubscribe = window.omniEdu.onXiaozhiEvent(event => {
    if (!data.submissions.length || sessionId && event.sessionId !== sessionId) return;
    if (event.kind === 'status' && event.status === 'running') data.runId ??= event.runId;
    if (event.kind === 'status' && event.status === 'running' && !data.runIds.includes(event.runId)) {
      if (data.runIds.length && !continuationArmed) return;
      data.runIds.push(event.runId);continuationArmed=false;
    }
    if (!data.runIds.includes(event.runId)) return;
    const row = {at: point(), kind: event.kind, runId: event.runId, sequence: event.sequence};
    if (event.kind === 'status') {
      row.status = event.status;
      if (event.status !== 'running') { terminalRuns.add(event.runId); data.terminalAt = point(); }
    }
    if (['tool_start', 'tool_end'].includes(event.kind)) {row.tool = event.tool; row.callId = event.callId;
      if (event.kind === 'tool_end') {row.success = event.success; row.durationMs = event.durationMs;}}
    if (event.kind === 'model_request') row.request = {state: event.request.state, attempt: event.request.attempt, status: event.request.status};
    if (['status', 'tool_start', 'tool_end', 'model_request', 'approval'].includes(event.kind)) data.events.push(row);
  });
  window.phase8RealObservation = {snapshot: () => structuredClone(data), runSignal(previousRunId) {
    const runId = data.runIds.find(id => id !== previousRunId);
    return runId ? {runId, terminal: terminalRuns.has(runId)} : null;
  }, expectContinuation() {
    if (data.runIds.length !== 1 || continuationArmed) throw Error('phase8_continuation_limit');
    continuationArmed=true;data.continuations.push({at:point(),entry:'same_task_workbench'});
  }, dispose() {
    unsubscribe(); document.removeEventListener('click', submitted, true); document.removeEventListener('keydown', submitted, true);
  }};
}

/** Only the existing visible same-task action may admit the one authorized continuation. */
export async function continueApprovedQ5({task,original,webpageHttpTiming,page,record,beforeDispatch}) {
  if (record.attempted) return record;
  const decision=q5ContinuationDecision({task,binding:original.binding,records:original.records,webpageHttpTiming});
  Object.assign(record,decision,{attempted:false});
  if(decision.status!=='eligible')return record;
  const unavailable=reason=>Object.assign(record,{status:'unavailable',reason});
  const open=page.getByTestId('pi-workbench-open');
  if(await open.count()!==1)return unavailable('workbench_entry_missing');
  await open.click();
  const row=page.locator(`[data-testid="pi-task-overview-row"][data-task-id="${original.binding.taskId}"]`);
  try{await row.waitFor({timeout:5000});}catch{return unavailable('same_task_row_missing');}
  const control=row.getByTestId('pi-task-overview-continue');
  if(await row.count()!==1||await control.count()!==1||!await control.isEnabled())return unavailable('same_task_continuation_missing');
  record.attempted=true;record.fromRunId=original.binding.runId;record.startedAt=performance.now();
  await beforeDispatch();await control.click();record.status='dispatched';return record;
}

function isolatedEnvironment(desktop, dataRoot, model, background) {
  const environment = {};
  for (const name of Object.keys(process.env)) {
    if (/(KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL)/i.test(name) || name.startsWith('OMNI_EDU_E2E_')
        || ['NODE_OPTIONS', 'ELECTRON_RUN_AS_NODE', 'ELECTRON_RENDERER_URL', 'HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'NO_PROXY'].includes(name)) continue;
    environment[name] = process.env[name];
  }
  return {...environment, OMNI_EDU_DATA_ROOT: dataRoot, OMNI_EDU_REPO_ROOT: path.resolve(desktop, '../..'),
    OMNI_EDU_XIAOZHI_PI: '1', ...(background ? {OMNI_EDU_E2E_DIALOG_MODE: '1'} : {OMNI_EDU_E2E_VISIBLE: '1'}),
    DEEPSEEK_MODEL: model};
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

async function handleVisibleApproval(page, task, decisions, authorize) {
  const pending = page.locator('[data-testid="pi-permission-approval"][data-state="pending"], [data-testid="pi-copy-approval"][data-state="pending"]');
  if (!await pending.count()) return;
  const card = pending.first();
  if (authorize && !await card.isVisible()) return;
  await card.scrollIntoViewIfNeeded();
  const id = await card.getAttribute('data-approval-id');
  if (decisions.some(item => item.id === id)) return;
  const authorization = authorize ? await authorize(card, id) : null;
  const decision = authorization?.decision ?? (task === 'Q8' ? 'reject' : 'approve');
  const button = card.locator(`[data-testid="pi-permission-${decision}"], [data-testid="pi-copy-${decision}"]`).first();
  if (!await button.count()) throw Error('phase8_visible_approval_control_missing');
  const startedAt = performance.now(); await button.click();
  await page.waitForFunction(id => {
    const node=[...document.querySelectorAll('[data-approval-id]')].find(node=>node.getAttribute('data-approval-id')===id);
    return !node || node.getAttribute('data-state') !== 'pending';
  },id,{timeout:10000});
  decisions.push({id, decision, ...authorization, startedAt, completedAt: performance.now(), clock: 'outer Node performance.now'});
}

function compareWire(transport, manifest) {
  return (transport?.chats || []).map(request => ({index: request.index,
    modelMatches: request.configuration?.model === manifest.model.id,
    expectedFieldsMatch: Object.entries(manifest.model.expectedWire || {}).every(([key, value]) =>
      JSON.stringify(request.configuration?.[key]) === JSON.stringify(value))}));
}

export function streamTransportComplete(request) {
  if (!Number.isInteger(request.httpStatus) || request.httpStatus < 200 || request.httpStatus > 299) return false;
  if (request.state === 'completed') return true;
  // A client may abort its body reader after consuming the provider's complete SSE terminal event.
  return ['client_cancelled', 'stream_failed'].includes(request.state)
    && Number.isFinite(request.terminalFrameAt) && Number.isFinite(request.firstByteAt) && Number.isFinite(request.endAt)
    && request.firstByteAt <= request.terminalFrameAt && request.terminalFrameAt <= request.endAt;
}

/** Group by the acknowledged proxy dispatch boundary; request array positions carry no identity. */
export function bindDispatchAttempts({ledger,evidenceRef,segments,transport}) {
  const attempts=ledger.attempts().filter(item=>item.context.evidenceRef===evidenceRef||item.context.evidenceRef===evidenceRef+'/continuation');
  const requests=transport?.chats || [];
  for(const segment of segments){
    const boundary=transport?.boundaries?.find(item=>item.id===segment.id);
    const group=requests.filter(item=>item.dispatchBoundary===segment.id);
    const reservations=attempts.filter(item=>item.context.evidenceRef===segment.evidenceRef);
    const stoppedBeforeModel = ['failed','interrupted'].includes(segment.terminal) && Number.isFinite(boundary?.terminalAt);
    if(boundary?.runId!==segment.binding.runId||boundary.conflict||(!group.length&&!stoppedBeforeModel)||group.length!==reservations.length
      ||group.some(item=>item.runId!==segment.binding.runId))throw Error('phase8_attempt_binding_unverified');
  }
  if(attempts.some(item=>!segments.some(segment=>segment.evidenceRef===item.context.evidenceRef))
    ||requests.some(item=>!segments.some(segment=>segment.id===item.dispatchBoundary)))throw Error('phase8_attempt_binding_unverified');
  for(const segment of segments)for(const attempt of attempts.filter(item=>item.context.evidenceRef===segment.evidenceRef))ledger.bindRun(attempt.reservationId,segment.binding.runId);
  return ledger.attempts().filter(item=>item.context.evidenceRef===evidenceRef||item.context.evidenceRef===evidenceRef+'/continuation');
}

function verifyCollection(result, row, manifest, ledger, thinkingBaseline) {
  if (result.cleanupError || result.bindingError) throw Error(result.cleanupError || result.bindingError);
  if (result.collectionStatus !== 'PASS') throw Error(result.error || 'phase8_collection_failed');
  if (!result.binding || !result.coldRecords) throw Error('phase8_run_binding_unverified');
  for (const records of [result.records, result.coldRecords]) {
    const checked = verifiedRunBinding({sessionId: result.binding.sessionId, runId: result.binding.runId,
      snapshot: result.snapshot, records});
    if (checked.taskId !== result.binding.taskId) throw Error('phase8_task_binding_unverified');
  }
  const segments=result.runSegments;
  if(segments){
    if(!segments.length||segments.length>2||segments[0].id!=='original'
      ||segments.length===2&&(row.task!=='Q5'||segments[1].id!=='continuation'||result.continuation?.status!=='completed'
        ||segments[1].binding.taskId!==segments[0].binding.taskId||segments[1].binding.runId===segments[0].binding.runId)
      ||segments.at(-1).binding.runId!==result.binding.runId)throw Error('phase8_run_segments_unverified');
    for(const segment of segments)for(const records of [segment.records,segment.coldRecords]){
      const checked=verifiedRunBinding({...segment.binding,snapshot:segment.snapshot,records});
      if(checked.taskId!==segment.binding.taskId)throw Error('phase8_task_binding_unverified');
    }
    if(segments.length===2){
      verifyQ5ApprovalConsumption(segments[0].records,segments[1].records,segments[1].binding);
      verifyQ5ApprovalConsumption(segments[0].records,segments[1].coldRecords,segments[1].binding);
    }
  }
  if (row.correctionReason && row.task === 'Q5' && row.version === 'B') {
    if (segments?.length !== 1 || !result.q5FixedSourceRead || !segments[0].q5SourceEvidence ||
        segments[0].q5SourceEvidence.status !== 'read') throw Error('phase8_corrected_web_source_unverified');
    if (result.decisions.length !== 1) throw Error('phase8_active_approval_consumption_unverified');
    for (const records of [result.records, result.coldRecords]) verifyQ5ActiveApproval(records, result.binding, result.decisions[0]);
  }
  if (result.transport?.rejected?.length) throw Error('phase8_provider_route_rejected');
  const chats = result.transport?.chats;
  if (!chats?.length) throw Error('phase8_provider_wire_missing');
  if (chats.some(request => request.method !== 'POST' || !providerPaths.includes(request.path))) throw Error('phase8_provider_route_rejected');
  result.wireComparison = compareWire(result.transport, manifest);
  if (result.wireComparison.some(request => !request.modelMatches)) throw Error('phase8_wire_model_mismatch');
  if (result.wireComparison.some(request => !request.expectedFieldsMatch)) throw Error('phase8_wire_configuration_mismatch');
  if (chats.some(request => !streamTransportComplete(request))) throw Error('phase8_provider_transport_incomplete');
  const evidenceRef = 'phase8-real/' + path.basename(path.dirname(result.output)) + '/' + row.id;
  const attempts = ledger.attempts().filter(attempt => attempt.context.evidenceRef === evidenceRef || attempt.context.evidenceRef === evidenceRef+'/continuation');
  if (!attempts.length || attempts.length !== chats.length || attempts.length !== result.attempts?.length) throw Error('phase8_metered_attempts_missing');
  for (const attempt of result.attempts) {
    const recorded = attempts.find(item => item.reservationId === attempt.reservationId);
    const owner=segments?.find(segment=>segment.evidenceRef===attempt.context.evidenceRef)?.binding || (!segments?result.binding:null);
    if (!recorded || JSON.stringify(recorded) !== JSON.stringify(attempt) || !owner || attempt.context.runId !== owner.runId
        || attempt.context.task !== row.task || attempt.context.version !== row.version || attempt.context.round !== row.round) throw Error('phase8_attempt_binding_unverified');
    if (attempt.state !== 'completed') throw Error('phase8_provider_transport_incomplete');
  }
  if(segments)for(const segment of segments){
    const requests=chats.filter(request=>request.dispatchBoundary===segment.id);
    const group=attempts.filter(attempt=>attempt.context.evidenceRef===segment.evidenceRef);
    if(!requests.length||requests.length!==group.length||requests.some(request=>request.runId!==segment.binding.runId))throw Error('phase8_attempt_binding_unverified');
  }
  for (const request of chats) {
    const thinking = JSON.stringify({thinking: request.configuration.thinking ?? null, reasoning_effort: request.configuration.reasoning_effort ?? null});
    if (thinkingBaseline !== undefined && thinking !== thinkingBaseline) throw Error('phase8_wire_thinking_mismatch');
    thinkingBaseline ??= thinking;
  }
  return thinkingBaseline;
}

async function collectRun(row, manifest, version, ledger, output, {background}) {
  const root = path.join(output, row.id); fs.mkdirSync(root);
  const dataRoot = path.join(root, 'data'), profile = path.join(root, 'profile'), workspace = path.join(root, 'workspace');
  fs.cpSync(manifest.versions[row.version].dataSnapshot, dataRoot, {recursive: true, errorOnExist: true, force: false});
  fs.cpSync(manifest.versions[row.version].profileSnapshot, profile, {recursive: true, errorOnExist: true, force: false});
  fs.mkdirSync(workspace);
  for (const [name, contents] of Object.entries(syntheticFiles)) fs.writeFileSync(path.join(workspace, name), contents);
  const beforeFiles = collectFiles(workspace), beforeBudget = ledger.summary();
  const evidenceRef = 'phase8-real/' + path.basename(output) + '/' + row.id;
  const context = {task: row.task, version: row.version, round: row.round, evidenceRef};
  const proxies = [], routes = {}, dispatchGroups = [{id:'original',evidenceRef}];
  let application, page, snapshot, sessionId, runId;
  const result = {...row, collectionStatus: 'FAIL', qualityStatus: 'NOT_TESTED', output: root, decisions: [], beforeBudget, beforeFiles,
    runSegments: [],
    requestTimingBoundary: 'Main monotonic clock measures request/body consumption. Renderer clock measures trusted submission and terminal UI. Each request captures its Run at the original main event-send and explicit proxy dispatch boundary. Cross-process epoch differences are estimates with recorded calibration.',
    webpageHttpTiming: null, failureRecoveryScenarios: 'NOT_TESTED_SEPARATE_PLANNED_SCENARIOS'};
  const exactActiveWebApproval = row.correctionReason && row.task === 'Q5' && row.version === 'B';
  const syntheticDraftCorrection = row.correctionReason && ['Q3','Q7'].includes(row.task);
  if (syntheticDraftCorrection) result.draftDecisions = [];
  try {
    result.stage = 'proxy_setup';
    for (const providerPath of providerPaths) {
      const proxy = await startCountingProxy({ledger, providerEndpoint: 'https://api.deepseek.com' + providerPath,
        context, requestTimeoutMs: manifest.requestTimeoutMs});
      proxies.push(proxy); routes[providerPath] = proxy.url;
    }
    const bootstrap = path.join(root, 'bootstrap.cjs');
    const transportModule = pathToFileURL(path.join(import.meta.dirname, 'phase8-real-model-transport.mjs')).href;
    const webTimingModule = pathToFileURL(path.join(import.meta.dirname, 'phase8-web-timing.mjs')).href;
    fs.writeFileSync(bootstrap, `const {app,net}=require('electron');app.setPath('userData',${JSON.stringify(profile)});
app.whenReady().then(async()=>{const {installProviderBridge}=await import(${JSON.stringify(transportModule)});
globalThis.phase8RealBridge=installProviderBridge(net,${JSON.stringify({chatRoutes: routes})});
const observed=[];const watch=(_event,contents)=>{const original=contents.send;const wrapped=function(channel,event,...rest){if(channel==='xiaozhi:event')globalThis.phase8RealBridge.observeRun(event);return original.call(this,channel,event,...rest);};contents.send=wrapped;observed.push({contents,original,wrapped});};
app.on('web-contents-created',watch);globalThis.phase8RestoreRunObservation=()=>{app.removeListener('web-contents-created',watch);for(const item of observed)if(!item.contents.isDestroyed()&&item.contents.send===item.wrapped)item.contents.send=item.original;};
${row.task === 'Q5' ? `const {observeQ5WebTiming}=await import(${JSON.stringify(webTimingModule)});globalThis.phase8WebTiming=observeQ5WebTiming();` : ''}
await import(${JSON.stringify(pathToFileURL(path.join(version.desktop, 'out/main/index.js')).href)});});`);
    result.stage = 'electron_launch';
    const require = createRequire(path.join(version.desktop, 'package.json'));
    const {_electron: electron} = require('playwright');
    application = await electron.launch({executablePath: require('electron'), cwd: version.desktop,
      args: [bootstrap, '--force-device-scale-factor=1'], env: isolatedEnvironment(version.desktop, dataRoot, manifest.model.id, background), timeout: 60000});
    page = await application.firstWindow(); await page.getByTestId('xiaozhi-pi-workspace').waitFor({timeout: 60000});
    await page.waitForFunction(() => !document.querySelector('[data-testid="office-prompt-input"]')?.disabled);
    await application.evaluate(({BrowserWindow}, hidden) => {
      const window = BrowserWindow.getAllWindows()[0];
      if (hidden && window.isVisible()) throw Error('phase8_background_window_visible');
      window.setContentSize(1366, 768);
      if (!hidden) {window.show(); window.focus();}
    }, background);
    result.geometry = {main: await application.evaluate(({BrowserWindow}) => {
      const window = BrowserWindow.getAllWindows()[0];
      return {bounds: window.getBounds(), contentBounds: window.getContentBounds(), visible: window.isVisible()};
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
    await page.evaluate(rendererObservation,sessionId);
    await application.evaluate((_electron,id)=>globalThis.phase8RealBridge.beginDispatch({id:'original',sessionId:id}),sessionId);
    result.stage = 'ui_submission';
    await page.getByTestId('office-prompt-input').fill(row.input);
    const submit = page.getByRole('button', {name: '发送消息', exact: true});
    await submit.evaluate(node => node.setAttribute('data-phase8-real-submit', 'true'));
    result.outerSubmitStartedAt = performance.now(); await submit.click();
    async function terminal(previousRunId) {
      const deadline = performance.now() + manifest.runTimeoutMs;
      // A snapshot reads the entire session. Use the live Run event as the prompt
      // to confirm it, with a bounded fallback for a missed terminal event.
      let nextFallback = performance.now() + 5000, nextTerminalRead = 0;
      const reads = {terminal: 0, fallback: 0};
      (result.terminalSnapshotReads ??= []).push(reads);
      result.stage = 'terminal_wait';
      while (performance.now() < deadline) {
        const signal = await page.evaluate(id => window.phase8RealObservation.runSignal(id), previousRunId);
        if (!row.correctionReason || signal?.runId) await handleVisibleApproval(page, row.task, result.decisions,
          row.correctionReason ? async (card, id) => {
            const records = readOriginalRecords(path.join(dataRoot, 'app.db'), sessionId, signal.runId, {workspace});
            const match = records.approvals.find(item => item.id === id && item.state === 'pending'
              && item.owner.sessionId === sessionId && item.owner.runId === signal.runId);
            const digest = await card.getAttribute('data-request-digest');
            const revision = await card.getAttribute('data-revision');
            const exact = match && match.requestDigest === digest && String(match.revision) === revision;
            if (exactActiveWebApproval) {
              if (!exact || !match.fixedQ5Get || result.decisions.length) throw Error('phase8_unexpected_correction_approval');
              return {requestDigest: match.requestDigest, revision: match.revision};
            }
            const allowed = row.task === 'Q3' ? ['office_create_text','office_edit_text','office_create_document','office_deliver_files']
              : row.task === 'Q7' ? ['office_create_text'] : [];
            return {decision: exact && match.syntheticFileScope && allowed.includes(match.action) ? 'approve' : 'reject'};
          } : undefined);
        if (syntheticDraftCorrection) await confirmSyntheticArtifact(page, row.task, workspace, result.draftDecisions);
        const now = performance.now();
        const readKind = signal?.terminal ? (now >= nextTerminalRead ? 'terminal' : null)
          : (signal && now >= nextFallback ? 'fallback' : null);
        if (readKind) {
          reads[readKind]++;
          snapshot = await page.evaluate(id => window.omniEdu.getXiaozhiSnapshot(id), sessionId);
          if (!snapshot.running && snapshot.projection.turns.some(turn => turn.id === signal.runId && turn.status !== 'running')) {
            runId = signal.runId;
            return;
          }
          nextTerminalRead = performance.now() + 500;
          nextFallback = performance.now() + 5000;
        }
        await page.waitForTimeout(100);
      }
      const stop = page.getByRole('button', {name: '停止本轮', exact: true});
      if (await stop.isVisible()) await stop.click();throw Error('phase8_run_deadline');
    }
    async function capture(dispatch) {
      const records=readOriginalRecords(path.join(dataRoot,'app.db'),sessionId,runId);
      const binding=verifiedRunBinding({sessionId,runId,snapshot,records});
      const turn=snapshot.projection.turns.find(item=>item.id===runId);
      const observation=await page.evaluate(()=>window.phase8RealObservation.snapshot());
      const segment={...dispatch,binding,snapshot,records,terminal:turn.status,rendererEvents:observation.events.filter(event=>event.runId===runId),
        answer:turn.items.filter(item=>item.role==='assistant').map(item=>item.text||'').join('\n')};
      if(row.task==='Q5'){
        const web=await application.evaluate((_electron,id)=>({timing:globalThis.phase8WebTiming?.snapshot(),
          boundary:globalThis.phase8RealBridge.snapshot().boundaries.find(item=>item.id===id),observedAt:performance.now()}),dispatch.id);
        segment.webpageHttpTiming={clock:web.timing?.clock || null,interval:{from:web.boundary?.at ?? null,through:web.observedAt,
          definition:'Main performance.now; fixed-URL request creation belongs to this acknowledged dispatch interval'},
          rows:(web.timing?.rows || []).filter(item=>Number.isFinite(web.boundary?.at)&&item.createdAt>=web.boundary.at&&item.createdAt<=web.observedAt),dropped:web.timing?.dropped ?? null};
        segment.q5SourceEvidence=readQ5SourceEvidence({databasePath:path.join(dataRoot,'app.db'),binding,records,
          events:segment.rendererEvents,webpageHttpTiming:segment.webpageHttpTiming});
      }
      result.runSegments.push(segment);return segment;
    }
    await terminal();
    const original=await capture(dispatchGroups[0]);
    const originalWebTiming=row.task==='Q5'?await application.evaluate(()=>globalThis.phase8WebTiming?.snapshot()):null;
    result.continuation={};
    if (!exactActiveWebApproval) await continueApprovedQ5({task:row.task,original,webpageHttpTiming:originalWebTiming,page,record:result.continuation,beforeDispatch:async()=>{
      const continuationRoutes={},group={id:'continuation',evidenceRef:evidenceRef+'/continuation'};
      // A distinct fixed proxy context is the durable grouping, not request position.
      for(const providerPath of providerPaths){
        const proxy=await startCountingProxy({ledger,providerEndpoint:'https://api.deepseek.com'+providerPath,
          context:{...context,evidenceRef:group.evidenceRef},requestTimeoutMs:manifest.requestTimeoutMs});
        proxies.push(proxy);continuationRoutes[providerPath]=proxy.url;
      }
      await application.evaluate((_electron,input)=>globalThis.phase8RealBridge.beginDispatch(input),
        {id:group.id,sessionId,previousRunId:original.binding.runId,chatRoutes:continuationRoutes});
      dispatchGroups.push(group);await page.evaluate(()=>window.phase8RealObservation.expectContinuation());
    }});
    if(result.continuation.attempted){
      await terminal(original.binding.runId);const continued=await capture(dispatchGroups[1]);
      if(continued.binding.taskId!==original.binding.taskId)throw Error('phase8_continuation_task_changed');
      result.continuation.toRunId=continued.binding.runId;
      if(continued.terminal!=='completed'){
        result.continuation.status='run_failed';
        result.continuation.terminal=continued.terminal;
        result.continuation.errorCode=continued.snapshot.projection.turns.find(turn=>turn.id===continued.binding.runId)?.errorCode ?? null;
        throw Error('phase8_approval_continuation_run_failed');
      }
      result.stage='continuation_readback';
      result.continuation.consumedApprovalIds=verifyQ5ApprovalConsumption(original.records,continued.records,continued.binding);
      result.continuation.status='completed';
    }
    result.stage = 'readback';
    result.observation = await page.evaluate(() => window.phase8RealObservation.snapshot());
    result.transport = await application.evaluate(() => globalThis.phase8RealBridge.snapshot());
    if (row.task === 'Q5') result.webpageHttpTiming = await application.evaluate(() => globalThis.phase8WebTiming?.snapshot());
    result.records = readOriginalRecords(path.join(dataRoot, 'app.db'), sessionId, runId);
    result.binding = verifiedRunBinding({sessionId, runId, snapshot, records: result.records});
    const turn = snapshot.projection.turns.find(item => item.id === runId);
    result.terminal = turn.status;
    result.answer = turn.items.filter(item => item.role === 'assistant').map(item => item.text || '').join('\n');
    result.artifacts = collectFiles(workspace);
    result.officeReadback = await inspectOfficeArtifacts(result.artifacts, version.desktop);
    result.outerReadbackCompletedAt = performance.now();
    const submittedAt = result.observation.submissions[0]?.at;
    const terminalAt = result.observation.events.findLast(event => event.kind === 'status'
      && event.runId === result.binding.runId && event.status !== 'running')?.at;
    const firstRequest = result.transport.chats[0];
    result.timings = {rendererSubmitToTerminalMs: Number.isFinite(submittedAt) && Number.isFinite(terminalAt)
      ? terminalAt - submittedAt : null,
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
    if (!background) await page.screenshot({path: path.join(root, 'terminal.png'), fullPage: true});
    result.collectionStatus = 'PASS';
  } catch (error) {
    result.error = /^phase8_[a-z_]+$/.test(error.message) ? error.message : 'phase8_collection_failed';
    if (application) result.transport = await application.evaluate(() => globalThis.phase8RealBridge?.snapshot()).catch(() => undefined);
    if (application && row.task === 'Q5') {
      result.webpageHttpTiming = await application.evaluate(() => globalThis.phase8WebTiming?.snapshot()).catch(() => undefined);
    }
    if (page && !background) await page.screenshot({path: path.join(root, 'failure.png'), fullPage: true}).catch(() => {});
  } finally {
    if (application) {
      await page?.evaluate(() => window.phase8RealObservation?.dispose()).catch(() => {});
      await application.evaluate(({dialog}) => {if (globalThis.phase8OriginalPicker) dialog.showOpenDialog = globalThis.phase8OriginalPicker;
        globalThis.phase8RestoreRunObservation?.();globalThis.phase8RealBridge?.restore();globalThis.phase8WebTiming?.dispose();}).catch(() => {result.cleanupError = 'phase8_restore_failed';});
      await application.close().catch(() => {result.cleanupError = 'phase8_close_failed';});
    }
    for (const proxy of proxies) await proxy.close().catch(() => {result.cleanupError = 'phase8_proxy_close_failed';});
    result.afterBudget = ledger.summary();
    try {
      result.attempts = bindDispatchAttempts({ledger,evidenceRef,segments:result.runSegments,transport:result.transport});
    } catch {result.bindingError = 'phase8_attempt_binding_unverified';}
    try {
      for(const segment of result.runSegments){
        segment.coldRecords=readOriginalRecords(path.join(dataRoot,'app.db'),segment.binding.sessionId,segment.binding.runId);
        verifiedRunBinding({...segment.binding,snapshot:segment.snapshot,records:segment.coldRecords});
        if(row.task==='Q5')segment.coldQ5SourceEvidence=readQ5SourceEvidence({databasePath:path.join(dataRoot,'app.db'),binding:segment.binding,
          records:segment.coldRecords,events:segment.rendererEvents,webpageHttpTiming:segment.webpageHttpTiming});
      }
      if(result.binding)result.coldRecords=result.runSegments.at(-1)?.coldRecords;
      if(row.task==='Q5')result.q5FixedSourceRead=result.runSegments.some(segment=>segment.coldQ5SourceEvidence?.status==='read');
    } catch {result.bindingError ??= 'phase8_cold_readback_failed';}
    if (result.cleanupError || result.bindingError) result.collectionStatus = 'FAIL';
    result.httpAttemptCount = result.attempts?.length ?? null;
    result.wireComparison = compareWire(result.transport, manifest);
    if (result.collectionStatus === 'PASS') result.stage = 'collected';
    fs.writeFileSync(path.join(root, 'report.json'), JSON.stringify(result, null, 2));
  }
  return result;
}

/** The CLI and Node protocol regression share this exact serial dispatch loop. */
export async function collectScheduledRuns({mode = 'execute', manifest, versions, ledger, output, collect, correction}) {
  if (!['execute', 'preflight', 'correct'].includes(mode) || (mode === 'correct') !== Boolean(correction)) throw Error('phase8_invalid_collection_mode');
  if (typeof collect !== 'function') throw Error('phase8_collector_required');
  const rows = correction?.rows ?? (mode === 'preflight' ? schedule.filter(row => row.task === 'Q1' && row.round === 1) : schedule);
  fs.mkdirSync(output, {recursive: true});
  const results = [];
  let stoppedAt = null, thinkingBaseline;
  for (const [index, row] of rows.entries()) {
    if (!ledger.summary().remaining || ledger.correctionUsage?.().remaining === 0) {
      stoppedAt = {id: row.id, code: 'phase8_budget_exhausted'};
      results.push(...rows.slice(index).map(pending => ({...pending, collectionStatus: 'NOT_TESTED', reason: stoppedAt.code, receiptSha256: null})));
      break;
    }
    const root = path.join(output, row.id);
    let result;
    try {
      result = {...await collect(row, manifest, versions[row.version], ledger, output), ...row, output: root};
      if (ledger.correctionUsage?.().rejected) throw Error('phase8_correction_budget_exhausted');
      thinkingBaseline = verifyCollection(result, row, manifest, ledger, thinkingBaseline);
    } catch (error) {
      const code = /^phase8_[a-z_]+$/.test(error.message) ? error.message : 'phase8_collection_failed';
      result = {...row, qualityStatus: 'NOT_TESTED', ...result, output: root,
        collectionStatus: 'FAIL', infrastructureFailure: {code}, error: result?.error || code};
      stoppedAt = {id: row.id, code};
    }
    fs.mkdirSync(root, {recursive: true});
    const receipt = JSON.stringify(result, null, 2);
    fs.writeFileSync(path.join(root, 'report.json'), receipt);
    results.push({...result, receiptSha256: sha256(receipt)});
    if (stoppedAt) {
      results.push(...rows.slice(index + 1).map(pending => ({...pending, collectionStatus: 'NOT_TESTED', reason: 'phase8_collection_stopped', receiptSha256: null})));
      break;
    }
    fs.writeFileSync(path.join(output, 'progress.json'), JSON.stringify({mode, stoppedAt, budget: ledger.summary(), results}, null, 2));
  }
  const collection = {mode, stoppedAt, plannedRunIds: rows.map(row => row.id), results};
  fs.writeFileSync(path.join(output, 'progress.json'), JSON.stringify({...collection, budget: ledger.summary()}, null, 2));
  return collection;
}

function loadFrozenPlan(manifestPath) {
  const manifest = validateManifest(JSON.parse(fs.readFileSync(manifestPath, 'utf8')));
  if (fs.realpathSync(manifest.versions.A.desktopRoot) === fs.realpathSync(manifest.versions.B.desktopRoot)) {
    throw Error('phase8_comparison_worktrees_not_independent');
  }
  const versions = {A: verifyVersion(manifest.versions.A), B: verifyVersion(manifest.versions.B)};
  const questionSeed = readFrozenQuestionSeed(manifest);
  return {manifest, versions, questionSeed};
}

export function verifyFrozenPlan(manifestPath) {
  const {manifest, versions, questionSeed} = loadFrozenPlan(manifestPath);
  return {
    status:'VERIFIED_LOCAL_INPUTS', planned:schedule.length, paidRequests:0, actualGoalLedgerOpened:false, questionSeed,
    versions:Object.fromEntries(Object.entries(versions).map(([side,item])=>[side,{
      commit:item.commit, outSha256:item.out.sha256, outCount:item.out.files.length,
      dataSha256:manifest.versions[side].dataSha256, profileSha256:manifest.versions[side].profileSha256,
    }])),
  };
}

export async function executePlan(manifestPath, output, mode = 'execute', {background = false, rowIds, maxRequests} = {}) {
  if (!['execute', 'preflight', 'correct'].includes(mode)) throw Error('phase8_invalid_collection_mode');
  if (background && (mode !== 'preflight' || !path.basename(output).startsWith('omni-edu-xiaozhi-phase8-real-model-')
      || fs.realpathSync(path.dirname(path.resolve(output))) !== fs.realpathSync(os.tmpdir()))) {
    throw Error('phase8_background_preflight_only');
  }
  if (!fs.existsSync(actualDatabasePath)) throw Error('phase8_actual_goal_ledger_missing');
  const {manifest, versions, questionSeed} = loadFrozenPlan(manifestPath);
  const correction = mode === 'correct' ? loadCorrectionPlan(manifest, rowIds, maxRequests) : undefined;
  fs.mkdirSync(output, {recursive: true});
  if (correction && fs.readdirSync(output).length) throw Error('phase8_correction_output_not_empty');
  fs.copyFileSync(manifestPath, path.join(output, 'execution-manifest.json'));
  fs.writeFileSync(path.join(output, 'builds.json'), JSON.stringify(versions, null, 2));
  fs.writeFileSync(path.join(output, 'question-seed-readback.json'), JSON.stringify(questionSeed, null, 2));
  fs.writeFileSync(path.join(output, 'machine.json'), JSON.stringify({node: process.version, platform: os.platform(), release: os.release(), arch: os.arch(),
    cpus: os.cpus().map(cpu => cpu.model), totalMemory: os.totalmem(), conditions: manifest.conditions,
    launchMode: background ? 'hidden automated preflight, fresh Electron and cloned synthetic snapshots'
      : 'visible Electron and cloned synthetic snapshots per run'}, null, 2));
  const goalLedger = openBudgetLedger({databasePath: actualDatabasePath});
  let collection;
  try {
    const ledger = correction ? correctionBudget(goalLedger, maxRequests) : goalLedger;
    if (correction) fs.writeFileSync(path.join(output, 'correction-selection.json'),
      JSON.stringify({ ...correction, budgetBefore: ledger.summary() }, null, 2), {flag: 'wx'});
    collection = await collectScheduledRuns({mode, manifest, versions, ledger, output, correction,
      collect: (...args) => collectRun(...args, {background})});
    const {results} = collection;
    const blind = exportBlindBundle(path.join(output, 'blind-samples'), results.filter(row => row.collectionStatus === 'PASS'));
    const buildsAfter = {A: verifyVersion(manifest.versions.A), B: verifyVersion(manifest.versions.B)};
    fs.writeFileSync(path.join(output, 'builds-after.json'), JSON.stringify(buildsAfter, null, 2));
    fs.writeFileSync(path.join(output, 'summary.json'), JSON.stringify({mode, collectionStatus: collection.stoppedAt ? 'FAIL' : 'PASS',
      stoppedAt: collection.stoppedAt, plannedRunIds: collection.plannedRunIds,
      identityMapSha256: blind.identityMapSha256, qualityStatus: 'NOT_TESTED_INDEPENDENT_BLIND_REVIEW',
      budget: ledger.summary(), correctionUsage: ledger.correctionUsage?.(), results: results.map(row => ({id: row.id, collectionStatus: row.collectionStatus, terminal: row.terminal,
        qualityStatus: row.qualityStatus, error: row.error, infrastructureFailure: row.infrastructureFailure,
        reason: row.reason, httpAttemptCount: row.httpAttemptCount, output: row.output, receiptSha256: row.receiptSha256})),
      limits: ['Q3 interactive HTML browser tests and all quality scoring remain independent.',
        'Q5 exact URL transport timings, renderer tool events and exact-once file writes require original source/receipt review.',
        'The separately planned cancel/reject/network failure runs are outside this fixed32 collector.']}, null, 2));
  } finally {goalLedger.close();}
  return {output, mode, collectionStatus: collection.stoppedAt ? 'FAIL' : 'PASS', stoppedAt: collection.stoppedAt,
    collected: collection.results.filter(row => row.collectionStatus === 'PASS').length, planned: collection.plannedRunIds.length};
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const [action, manifest, option, ...extra] = process.argv.slice(2);
  const background = option === '--background';
  let output;
  try {
    if (['correct', 'verify-correction'].includes(action) && manifest && /^[1-9][0-9]{0,2}$/.test(option ?? '') && extra.length === 1) {
      const maxRequests = Number(option);
      const rowIds = extra[0].split(',');
      if (action === 'verify-correction') {
        const {manifest: plan} = loadFrozenPlan(manifest);
        console.log(JSON.stringify(loadCorrectionPlan(plan, rowIds, maxRequests)));
      } else {
        output = fs.mkdtempSync(path.join(os.tmpdir(), 'xiaozhi-phase8-correction-'));
        const result = await executePlan(manifest, output, 'correct', {rowIds, maxRequests});
        console.log(JSON.stringify(result));
        if (result.collectionStatus === 'FAIL') process.exitCode = 1;
      }
    } else if (extra.length || option && !background || background && action !== 'preflight') throw Error('phase8_invalid_collection_mode');
    else if (action === 'verify' && manifest) {
      console.log(JSON.stringify(verifyFrozenPlan(manifest)));
    } else if (action === 'prepare' || ['execute', 'preflight'].includes(action) && manifest) {
      output = fs.mkdtempSync(path.join(os.tmpdir(), background ? 'omni-edu-xiaozhi-phase8-real-model-' : 'xiaozhi-phase8-real-model-'));
      if (action === 'prepare') console.log(JSON.stringify(preparePlan(output)));
      else {
        const result = await executePlan(manifest, output, action, {background}); console.log(JSON.stringify(result));
        if (result.collectionStatus === 'FAIL') process.exitCode = 1;
      }
    } else throw Error('phase8_usage_prepare_or_verify_or_preflight_or_execute_manifest');
  } catch (error) {console.error(JSON.stringify({status: 'NOT_TESTED', output,
    code: /^phase8_[a-z_]+$/.test(error.message) ? error.message : 'phase8_preparation_failed'})); process.exitCode = 1;}
}
