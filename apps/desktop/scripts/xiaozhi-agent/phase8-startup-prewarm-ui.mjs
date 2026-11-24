import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {startStreamFixture} from './phase8-stream-performance-fixture.mjs';
import {preparationTiming, preparationBreakdown} from './phase8-stream-performance-metrics.mjs';

const args = new Map();
assert.equal((process.argv.length - 2) % 2, 0, 'arguments must be key/value pairs');
for (let i = 2; i < process.argv.length; i += 2) {
  assert(['--build-root', '--label', '--expected-out-hash', '--expected-out-count', '--require-prewarm', '--reopen', '--turns', '--prompt-repeat', '--complete', '--require-compaction', '--context-window'].includes(process.argv[i]), 'unknown argument');
  args.set(process.argv[i], process.argv[i + 1]);
}
const desktop = fs.realpathSync(process.cwd());
assert(args.has('--build-root') && args.has('--expected-out-hash') && args.has('--expected-out-count'));
const buildRoot = fs.realpathSync(args.get('--build-root'));
const relative = path.relative(fs.realpathSync(path.join(desktop, 'test-results')), buildRoot);
assert(relative && relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative), 'build outside test-results');
const label = args.get('--label') || 'unlabeled';
assert(/^[A-Za-z0-9_.-]{1,64}$/.test(label));
assert(['true', 'false'].includes(args.get('--require-prewarm')));
const required = args.get('--require-prewarm') === 'true';
const reopen = args.get('--reopen') ?? 'false';
assert(['true', 'false'].includes(reopen) && (reopen !== 'true' || required), 'cold reopen requires the prewarm candidate');
const turns=Number(args.get('--turns')??2),promptRepeat=Number(args.get('--prompt-repeat')??0);
assert(Number.isSafeInteger(turns)&&turns>=2&&turns<=16);
assert(Number.isSafeInteger(promptRepeat)&&promptRepeat>=0&&promptRepeat<=60);
const complete=args.get('--complete')??'false',requireCompaction=args.get('--require-compaction')??'false';
const contextWindow=args.get('--context-window');
assert([complete,requireCompaction].every(value=>['true','false'].includes(value)));
assert(requireCompaction==='false'||complete==='true','compaction coverage requires completed history');
assert(!contextWindow||(requireCompaction==='true'&&/^\d+$/u.test(contextWindow)&&Number(contextWindow)>=32768&&Number(contextWindow)<=1048576));
const terminalStatus=complete==='true'?'completed':'interrupted';
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'omni-edu-startup-prewarm-'));
const data = path.join(output, 'data'), profile = path.join(output, 'profile');
const main = path.join(buildRoot, 'main/index.js');
const requireDesktop = createRequire(path.join(desktop, 'package.json'));
const { _electron: electron } = requireDesktop('playwright');
const {fingerprint} = await import(pathToFileURL(path.join(desktop, 'scripts/acceptance/evidence.mjs')).href);
const {assertIsolatedPiMain} = await import(pathToFileURL(path.join(desktop, 'scripts/acceptance/build-root.mjs')).href);
const report = {success: false, label, output, buildRoot, requiredPrewarm: required, turns, promptRepeat, terminalStatus, requireCompaction:requireCompaction==='true', errors: [], prompts: [], realModelCalls: 0,
  boundary: 'Hidden isolated Electron, synthetic loopback SSE and UI-dispatched prompts. No physical input or provider performance conclusion.'};
let application, page, fixture, before;
const now = () => performance.timeOrigin + performance.now();
const snapshot = sessionId => page.evaluate(id => window.omniEdu.getXiaozhiSnapshot(id),sessionId);
async function waitForSnapshot(sessionId, select, timeoutMs) {
  const deadline=performance.now()+timeoutMs;
  do{
    const selected=select(await snapshot(sessionId));
    if(selected)return selected;
    await new Promise(resolve=>setTimeout(resolve,100));
  }while(performance.now()<deadline);
  throw Error('Persisted workspace snapshot did not reach the expected state');
}
function readDb() {
  const db = new DatabaseSync(path.join(data, 'app.db'), {readOnly: true});
  try {
    const names = new Set(db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(x => x.name));
    const result = {registry: null, versionCount: null, runs: [], events: []};
    if (names.has('xiaozhi_capability_registry_v1')) {
      const row = db.prepare('SELECT revision,document_json,document_hash FROM xiaozhi_capability_registry_v1 WHERE id=1').get();
      if (row) {const value = JSON.parse(row.document_json); result.registry = {revision: row.revision, hash: row.document_hash,
        definitions: value.definitions.length, providers: value.providers.length, bindings: value.bindings.length};}
    }
    if (names.has('xiaozhi_capability_provider_versions_v1')) result.versionCount = db.prepare('SELECT count(*) AS count FROM xiaozhi_capability_provider_versions_v1').get().count;
    if (names.has('ai_agent_runs')) result.runs = db.prepare('SELECT id,session_id,status FROM ai_agent_runs').all();
    if (names.has('xiaozhi_event_runs')) result.events = db.prepare('SELECT run_id,generation,status,sequence FROM xiaozhi_event_runs').all();
    return result;
  } finally {db.close();}
}
async function openWorkspace(bootstrap, env) {
  const launchEpochMs = now();
  application = await electron.launch({executablePath:requireDesktop('electron'),args:[bootstrap,'--force-device-scale-factor=1'],cwd:desktop,env,timeout:60000});
  page = await application.firstWindow();
  page.on('pageerror', error => report.errors.push(error.message));
  await page.getByTestId('xiaozhi-pi-workspace').waitFor({timeout:60000});
  await page.waitForFunction(() => {
    const input = document.querySelector('[data-testid="office-prompt-input"]');
    return input instanceof HTMLTextAreaElement && !input.disabled && !input.readOnly;
  });
  const workspaceUsableEpochMs = now();
  assert.equal(await application.evaluate(({BrowserWindow}) => BrowserWindow.getAllWindows()[0].isVisible()), false);
  const isolation = await assertIsolatedPiMain(application, main, profile);
  return {launchEpochMs,workspaceUsableEpochMs,isolation,pid:application.process().pid};
}

async function waitForPrewarm() {
  const warm = await application.evaluate(async () => {
    const end = performance.now() + 120000;
    while (performance.now() < end) {
      const result = observation.rows.find(row => row.operation === 'startup_registry_prewarm');
      if (result) return result;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    return null;
  });
  assert(warm, 'startup prewarm event missing');
  assert.equal(warm.outcome, 'success');
  assert(Number.isSafeInteger(warm.registrationCount) && warm.registrationCount >= 0, 'invalid prewarm registrationCount');
  return warm;
}

try {
  before = fingerprint(buildRoot);
  report.buildBefore = {sha256: before.sha256, files: before.files.length};
  assert.equal(before.sha256, args.get('--expected-out-hash'));
  assert.equal(before.files.length, Number(args.get('--expected-out-count')));
  fs.mkdirSync(data); fs.mkdirSync(profile);
  fixture = await startStreamFixture({intervalMs: complete==='true'?20:100,shortReplies:complete==='true'});
  const bootstrap = path.join(output, 'bootstrap.cjs');
  fs.writeFileSync(bootstrap, `const {app,net}=require('electron');
app.setPath('userData',${JSON.stringify(profile)});
const channel=require('node:diagnostics_channel').channel('omni-edu.xiaozhi.lifecycle.v1');
globalThis.observation={version:1,rows:[],dropped:0,invalid:0,limit:8192};
const listener=row=>{if(!row||row.version!==1||!/^[a-z0-9_]{1,80}$/.test(row.operation)||!['success','cancelled','timeout','error'].includes(row.outcome)||![row.startedEpochMs,row.endedEpochMs,row.durationMs].every(Number.isFinite)||row.runId!==undefined&&!/^run_[a-z0-9-]{1,80}$/i.test(row.runId)){observation.invalid++;return;} if(observation.rows.length>=observation.limit){observation.dropped++;return;} observation.rows.push({version:1,operation:row.operation,outcome:row.outcome,startedEpochMs:row.startedEpochMs,endedEpochMs:row.endedEpochMs,durationMs:row.durationMs,...(row.runId?{runId:row.runId}:{}),...(row.registrationCount!==undefined?{registrationCount:row.registrationCount}:{})});};
channel.subscribe(listener); const originalFetch=net.fetch;
globalThis.transport={calls:[],blocked:0};
net.fetch=async(input,init)=>{const u=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url); if(u.protocol!=='https:'||u.hostname!=='api.deepseek.com'||u.port||!['/v1/models','/v1/chat/completions'].includes(u.pathname)){transport.blocked++;throw Error('fixture_network_blocked');} const row={path:u.pathname,epochMs:performance.timeOrigin+performance.now()};transport.calls.push(row);const response=await globalThis.fetch(${JSON.stringify(fixture.origin)}+u.pathname,{...init,redirect:'error'});row.httpStatus=response.status;return response;};
globalThis.restoreFixture=()=>{net.fetch=originalFetch;channel.unsubscribe(listener);};
app.whenReady().then(()=>import(${JSON.stringify(pathToFileURL(main).href)}));`);
  const env = {...process.env};
  for (const key of Object.keys(env)) if (/(API_KEY|ACCESS_TOKEN|SECRET|PASSWORD)$/i.test(key) || key.startsWith('OMNI_EDU_E2E_')) delete env[key];
  for (const key of ['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL','HTTP_PROXY','HTTPS_PROXY','ALL_PROXY','NO_PROXY']) delete env[key];
  Object.assign(env, {OMNI_EDU_DATA_ROOT:data, OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'), OMNI_EDU_XIAOZHI_PI:'1', OMNI_EDU_E2E_VISIBLE:'0', OMNI_EDU_E2E_DIALOG_MODE:'1', DEEPSEEK_API_KEY:'synthetic-stream-fixture-only', DEEPSEEK_MODEL:'deepseek-flash'});
  if(requireCompaction==='true')env.OMNI_EDU_E2E_PI_AUTO_COMPACTION='1';
  if(contextWindow)env.OMNI_EDU_E2E_PI_CONTEXT_WINDOW=contextWindow;
  Object.assign(report, await openWorkspace(bootstrap, env));
  report.registryAtWorkspace = readDb();
  report.prewarm = required ? await waitForPrewarm() : null;
  report.beforeFirstPrompt = readDb();
  await page.evaluate(() => {window.__prewarmSubmissions=[];document.addEventListener('keydown',e=>{if(e.key==='Enter' && e.target?.matches('[data-testid="office-prompt-input"]')) window.__prewarmSubmissions.push({epochMs:performance.timeOrigin+performance.now(),trusted:e.isTrusted});},true);});
  for (let index=0; index<turns; index++) {
    const input = page.getByTestId('office-prompt-input');
    const sessionId = await page.locator('.office-composer-container').getAttribute('data-session-id');
    const previousCount = (await snapshot(sessionId)).projection.turns.length;
    const text=`合成测量 ${index+1}：请简要说明课堂练习，不调用工具。`+
      '教师要求内容来自本地示例；先概括知识点，再保留明确的练习条件和课后核对。'.repeat(promptRepeat);
    await input.fill(text);
    await input.press('Enter');
    await page.waitForFunction(expected => window.__prewarmSubmissions.length >= expected, index+1);
    const submit = (await page.evaluate(() => window.__prewarmSubmissions))[index];
    assert(submit.trusted);
    const runId = await waitForSnapshot(sessionId,({projection})=>projection.turns.length>previousCount&&projection.turns.at(-1)?.id,30000);
    if(terminalStatus==='interrupted'){
      await page.getByTestId('model-reasoning').nth(index).waitFor({timeout:120000});
      await page.getByRole('button',{name:'停止本轮',exact:true}).click();
    }
    const turn = await waitForSnapshot(sessionId,s=>!s.running&&s.projection.turns
      .find(turn=>turn.id===runId&&['completed','interrupted','failed'].includes(turn.status)),120000);
    const {contextPolicy,modelCapabilities}=await snapshot(sessionId);
    report.contextPolicy=contextPolicy;
    report.modelCapabilities=modelCapabilities;
    assert.equal(turn.status,terminalStatus,JSON.stringify({status:turn.status,error:turn.error}));
    await application.evaluate(async (_e,id)=>{const end=performance.now()+10000;while(!observation.rows.some(x=>x.operation==='host_execute'&&x.runId===id)&&performance.now()<end) await new Promise(r=>setTimeout(r,50));},turn.id);
    const transport = await application.evaluate(() => transport);
    const lifecycle = await application.evaluate(() => observation);
    const req = fixture.requests.filter(request=>request.kind==='reply')[index];
    const fetch = transport.calls.filter(x=>x.path==='/v1/chat/completions')[req?.index-1];
    assert(fetch && req && req.authSynthetic);
    const timing = preparationTiming({submitEpochMs:submit.epochMs,mainFetchEpochMs:fetch.epochMs,fixtureEpochMs:req.epochMs});
    timing.breakdown = preparationBreakdown({lifecycle,runId:turn.id,submitEpochMs:submit.epochMs,mainFetchEpochMs:fetch.epochMs,fixtureEpochMs:req.epochMs});
    let readback = readDb();
    const settlementDeadline = performance.now() + 10000;
    while (!readback.runs.some(row=>row.id===turn.id && row.status!=='running') && performance.now()<settlementDeadline) {
      await new Promise(resolve=>setTimeout(resolve,50)); readback = readDb();
    }
    report.prompts.push({sessionId,runId:turn.id,status:turn.status,submit,timing,readback,
      promptLength:text.length,providerBodyBytes:req.requestBytes,compactions:turn.items.filter(item=>item.kind==='compaction').map(item=>({id:item.id,status:item.status}))});
    assert(timing.breakdown.complete, JSON.stringify(timing.breakdown.reasons));
  }
  report.lifecycle = await application.evaluate(() => observation);
  report.transport = await application.evaluate(() => transport);
  assert.equal(report.lifecycle.dropped,0); assert.equal(report.lifecycle.invalid,0); assert.equal(report.transport.blocked,0);
  assert.equal(fixture.requests.filter(request=>request.kind==='reply').length,turns); assert.equal(report.errors.length,0);
  if(requireCompaction==='true'){
    const completed=report.prompts.flatMap(prompt=>prompt.compactions).filter(item=>item.status==='completed');
    assert(completed.length>0,'no completed compaction in the continuous conversation');
    assert(fixture.requests.some(request=>request.kind==='summary'&&request.finalSent===1),'the loopback provider did not receive a summary request');
  }
  assert.equal(new Set(report.prompts.map(prompt=>prompt.sessionId)).size,1);
  assert(report.prompts.every(p=>p.readback.runs.some(row=>row.id===p.runId && row.status!=='running') && p.readback.events.some(row=>row.run_id===p.runId && row.status===terminalStatus)));
  if (reopen === 'true') {
    await application.close();
    application = undefined;
    const beforeReopen = readDb();
    const cold = {before:beforeReopen};
    report.reopen = cold;
    Object.assign(cold, await openWorkspace(bootstrap, env));
    assert.notEqual(cold.pid, report.pid, 'reopen must start a new process');
    cold.prewarm = await waitForPrewarm();
    cold.restored = [];
    for (const {sessionId,runId} of report.prompts) {
      const restored = await page.evaluate(async ({sessionId,runId}) => {
        const snapshot = await window.omniEdu.getXiaozhiSnapshot(sessionId);
        return {running:snapshot.running,status:snapshot.projection.turns.find(turn => turn.id === runId)?.status};
      }, {sessionId,runId});
      cold.restored.push({sessionId,runId,...restored});
      assert.deepEqual(restored, {running:false,status:terminalStatus});
    }
    cold.after = readDb();
    cold.transport = await application.evaluate(() => transport);
    assert.equal(cold.prewarm.registrationCount, 0, 'reopen must reuse the existing registry');
    assert.deepEqual(cold.after.registry, beforeReopen.registry);
    assert.equal(cold.after.versionCount, beforeReopen.versionCount);
    assert.deepEqual(cold.after.runs, beforeReopen.runs);
    assert.deepEqual(cold.after.events, beforeReopen.events);
    assert.equal(cold.transport.blocked, 0);
    assert.equal(cold.transport.calls.filter(call => call.path === '/v1/chat/completions').length, 0);
    assert.equal(fixture.requests.filter(request=>request.kind==='reply').length,turns);
    assert.equal(report.errors.length, 0);
  }
  report.success = true;
} catch(error) {report.error=String(error.stack || error);}
finally {
  if (application) {
    report.lifecycle ??= await application.evaluate(() => observation).catch(()=>undefined);
    report.transport ??= await application.evaluate(() => transport).catch(()=>undefined);
    await application.evaluate(() => globalThis.restoreFixture?.()).catch(()=>undefined);
    await application.close().catch(error=>{report.cleanupError=String(error);report.success=false;});
  }
  await fixture?.close().catch(error=>{report.cleanupError=String(error);report.success=false;});
  report.fixtureRequests=fixture?.requests;
  if(before){const after=fingerprint(buildRoot);report.buildAfter={sha256:after.sha256,files:after.files.length};report.buildUnchanged=before.sha256===after.sha256;if(!report.buildUnchanged)report.success=false;}
  fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({success:report.success,output,error:report.error}));
  if(!report.success) process.exitCode=1;
}
