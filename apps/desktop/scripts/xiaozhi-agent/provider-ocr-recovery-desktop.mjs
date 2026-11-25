import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {setTimeout as delay} from 'node:timers/promises';
import {_electron as electron} from 'playwright';
import {assertIsolatedPiMain} from '../acceptance/build-root.mjs';

const [build, fixture, acceptance] = process.argv.slice(2);
assert([build, fixture, acceptance].every(value => value && path.isAbsolute(value)), 'Pass the actual build, scan and acceptance root');
const main = fs.realpathSync(path.join(build, 'main/index.js'));
const desktop = path.resolve(build, '../..');
const root = fs.mkdtempSync(path.join(fs.realpathSync(acceptance), 'provider-ocr-recovery-'));
const data = path.join(root, 'data'), profile = path.join(root, 'profile'), database = path.join(data, 'app.db');
const hash = value => createHash('sha256').update(value).digest('hex');
const sourceHash = hash(fs.readFileSync(fixture));
const report = {root, main, mainHash:hash(fs.readFileSync(main)), sourceHash, success:false, paidCalls:0, checks:[]};
let app, page, resourceId;

async function until(label, read, timeout = 45000) {
  const deadline = performance.now() + timeout;
  do {
    const value = await read();
    if (value) return value;
    await delay(40);
  } while (performance.now() < deadline);
  throw Error('Timed out waiting for '+label);
}
function read(action) {
  const db = new DatabaseSync(database, {readOnly:true});
  try {return action(db);} finally {db.close();}
}
function live() {
  return read(db => {
    const source = db.prepare('SELECT id,local_path,content_hash,parse_status FROM teacher_resources WHERE original_file_name=?').get(path.basename(fixture));
    if (!source) return {};
    resourceId = source.id;
    const task = db.prepare("SELECT id,status,error_message,payload_json FROM ai_tasks WHERE task_type='resource_parse' AND json_extract(payload_json,'$.resourceId')=?").get(resourceId);
    const job = db.prepare('SELECT generation,version,worker,state,total,owner_nonce,owner_pid FROM material_pdf_jobs WHERE resource_id=?').get(resourceId);
    const pages = job ? db.prepare('SELECT page,status,attempts,result_json FROM material_pdf_pages WHERE generation=? ORDER BY page').all(job.generation)
      .map(({result_json, ...row}) => ({...row, digest:result_json ? hash(result_json) : null, text:result_json ? Boolean(JSON.parse(result_json).text?.trim()) : false})) : [];
    return {source, task:task && {id:task.id, state:task.status, error:task.error_message, attempt:JSON.parse(task.payload_json).attempt}, job, pages};
  });
}
function gone(pid) {
  try {process.kill(pid, 0);return false;} catch (error) {if (error.code === 'ESRCH') return true;throw error;}
}

async function capture(mode, barrierPage) {
  await app.evaluate((_electron, {mode, barrierPage}) => {
    const cp = process.getBuiltinModule('node:child_process'), modules = process.getBuiltinModule('node:module'), original = cp.spawn;
    const trace = globalThis.providerOcrTrace = {mode, spawned:false, closed:false, killRequested:false, outputClosed:false, events:[]};
    cp.spawn = function (...parameters) {
      if (!String(parameters[0]).endsWith('omni-edu-ocr.exe')) return original.apply(this, parameters);
      cp.spawn = original;
      modules.syncBuiltinESMExports();
      const child = original.apply(this, parameters);
      const kill = child.kill.bind(child), write = child.stdin.write.bind(child.stdin), push = child.stdout.push.bind(child.stdout);
      let holding = false, buffered = [], decoded = '', ack;
      const decode = new (process.getBuiltinModule('node:string_decoder').StringDecoder)('utf8');
      trace.pid = child.pid;
      child.once('spawn', () => {trace.spawned = true;});
      child.stdout.once('close', () => {trace.outputClosed = true;});
      const watchdog = setTimeout(() => kill(), 75000);
      child.once('close', (code, signal) => {clearTimeout(watchdog);Object.assign(trace, {closed:true, code, signal});});
      globalThis.releaseProviderOcr = () => {if (!trace.closed) kill();};
      if (mode === 'hold-cancel') child.kill = () => {trace.killRequested = true;return true;};
      child.stdout.push = (chunk, ...rest) => {
        if (!chunk) return push(chunk, ...rest);
        decoded += decode.write(chunk);
        let at;
        while ((at = decoded.indexOf('\n')) >= 0) {
          const line = decoded.slice(0, at);
          decoded = decoded.slice(at+1);
          try {
            const event = JSON.parse(line);
            trace.events.push({kind:event.kind, page:event.page, requestId:event.requestId, held:holding});
          } catch {trace.events.push({kind:'unreadable', held:holding});}
        }
        if (!holding) return push(chunk, ...rest);
        buffered.push([chunk, rest]);
        return true;
      };
      child.stdin.write = (raw, ...rest) => {
        let value;
        try {value = JSON.parse(raw.toString());} catch {return write(raw, ...rest);}
        if (value.operation) Object.assign(trace, {operation:value.operation, requestId:value.requestId, skipPages:value.skipPages});
        if (value.ack === true && value.page === barrierPage) {
          trace.checkpointAck = value.page;
          if (mode === 'abnormal') {queueMicrotask(() => kill());return true;}
          if (mode === 'hold-cancel') {holding = true;ack = [raw, rest];return true;}
        }
        return write(raw, ...rest);
      };
      globalThis.sendProviderOcrAck = () => {if (!ack) throw Error('Missing owned page ack');write(ack[0], ...ack[1]);ack = undefined;};
      globalThis.deliverLateProviderOcr = () => {
        if (!holding || !buffered.length) throw Error('Missing actual output from the old worker');
        holding = false;
        trace.forwarded = buffered.reduce((sum, [chunk]) => sum + chunk.length, 0);
        for (const [chunk, rest] of buffered) push(chunk, ...rest);
        buffered = [];
      };
      return child;
    };
    modules.syncBuiltinESMExports();
  }, {mode, barrierPage});
}
const trace = async () => JSON.parse(await app.evaluate(() => JSON.stringify(globalThis.providerOcrTrace)));
async function retry() {
  return page.evaluate(async id => {
    const queue = await window.omniEdu.getMaterialQueue(id);
    const task = queue.tasks.find(item => item.resourceId === id);
    if (!task) throw Error('Missing original queue task');
    return window.omniEdu.controlMaterialTask({schemaVersion:queue.schemaVersion, resourceId:id, version:task.version, action:'retry'});
  }, resourceId);
}

async function observeLeaseScheduler(ownerFile) {
  const source = fs.readFileSync(ownerFile,'utf8');
  const reserveExport = source.match(/\breserveHostStage as (\w+)/u)?.[1];
  assert(reserveExport);
  await app.evaluate(async (_electron, {ownerFile, reserveExport}) => {
    const {Session} = process.getBuiltinModule('node:inspector');
    const req = process.getBuiltinModule('node:module').createRequire(ownerFile);
    const session = new Session();
    session.connect();
    const post = (method, params = {}) => new Promise((resolve,reject) => session.post(method,params,(error,result) => error ? reject(error) : resolve(result)));
    const group = 'provider-ocr-lease-observation';
    const properties = objectId => post('Runtime.getProperties',{objectId,ownProperties:true});
    try {
      globalThis.providerOcrLeaseEntry = req(ownerFile)[reserveExport];
      const entry = await post('Runtime.evaluate',{expression:'globalThis.providerOcrLeaseEntry',objectGroup:group});
      const scopes = (await properties(entry.result.objectId)).internalProperties.find(property => property.name === '[[Scopes]]')?.value.objectId;
      if (!scopes) throw Error('Missing production module scope');
      const entries = (await properties(scopes)).result;
      let scheduler;
      for (const scope of entries.filter(item => item.value?.description === 'Module' || item.value?.description === 'Closure')) {
        scheduler = (await properties(scope.value.objectId)).result.find(property => property.name === 'coordinator')?.value.objectId;
        if (scheduler) break;
      }
      if (!scheduler) throw Error('Missing the real host lease coordinator');
      globalThis.readProviderOcrLease = async () => {
        const snapshot = await post('Runtime.callFunctionOn',{objectId:scheduler,returnByValue:true,
          functionDeclaration:'function() { return {...this.snapshot(), events:this.recentEvents()}; }'});
        if (snapshot.exceptionDetails) throw Error('Failed to read the real lease coordinator');
        return snapshot.result.value;
      };
      globalThis.closeProviderOcrLeaseObservation = () => session.disconnect();
    } catch(error) {session.disconnect();throw error;}
    finally {delete globalThis.providerOcrLeaseEntry;}
  }, {ownerFile, reserveExport});
}

try {
  assert(fs.existsSync(path.join(desktop,'package.json')), 'The build belongs to a desktop workspace');
  const ownerFile = fs.readdirSync(path.dirname(main)).filter(name => name.endsWith('.js')).map(name => path.join(path.dirname(main),name))
    .find(file => fs.readFileSync(file,'utf8').includes('function reserveHostStage('));
  assert(ownerFile, 'Use the actual Host Resource Scheduling R1 build');
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL|NODE_OPTIONS|ELECTRON_RUN_AS_NODE|ELECTRON_RENDERER_URL/iu.test(key)));
  Object.assign(env, {OMNI_EDU_DATA_ROOT:data, OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'), OMNI_EDU_SKIP_DOTENV:'1',
    OMNI_EDU_E2E_DIALOG_MODE:'1', OMNI_EDU_XIAOZHI_PI:'1', TEMP:root, TMP:root});
  app = await electron.launch({args:[main,'--user-data-dir='+profile], cwd:root, env, timeout:60000});
  await assertIsolatedPiMain(app, main, profile);
  report.runtime = await app.evaluate(() => ({electron:process.versions.electron, node:process.versions.node, platform:process.platform}));
  await observeLeaseScheduler(ownerFile);
  const leaseSnapshot = () => app.evaluate(() => globalThis.readProviderOcrLease());
  const forTask = (snapshot, id) => snapshot.events.filter(event => event.owner === id && event.phase === 'parse');
  page = await app.firstWindow();
  await page.locator('[data-testid="nav-knowledge"]:visible').click();
  await capture('abnormal',1);
  await app.evaluate(({dialog}, selected) => {dialog.showOpenDialog = async () => ({canceled:false,filePaths:[selected]});}, fixture);
  await page.getByTestId('materials-import').click();
  const interrupted = await until('actual failed attempt after page one', () => {
    const state = live();
    return state.task?.state === 'failed' && state.job?.owner_pid === 0 && state;
  });
  const first = await trace();
  assert(first.spawned && first.closed && first.checkpointAck === 1 && gone(first.pid));
  assert(first.code !== 0);
  assert.equal(interrupted.job.state,'interrupted');
  assert.deepEqual(interrupted.pages.map(p => [p.page,p.status,p.attempts,p.text]), [[1,'complete',1,true]]);
  assert.equal(interrupted.source.content_hash,sourceHash);
  assert.equal(hash(fs.readFileSync(interrupted.source.local_path)),sourceHash);
  report.abnormal = {trace:first, snapshot:interrupted};
  report.checks.push('A real unexpected exit clears only its owner after the first page was durably saved');

  await capture('hold-cancel',2);
  await retry();
  const held = await until('durable second page waiting for its ACK', async () => {
    const t = await trace();
    return t.checkpointAck === 2 && !t.closed && t;
  });
  const heldState = live();
  assert.deepEqual(held.skipPages,[1]);
  assert.equal(heldState.task.id,interrupted.task.id);
  assert.equal(heldState.job.generation,interrupted.job.generation);
  assert(heldState.job.owner_nonce && heldState.job.owner_pid > 0 && held.pid !== first.pid);
  assert.notEqual(held.requestId,first.requestId);
  assert.equal(heldState.pages[1].status,'complete');
  const queue = page.getByTestId('materials-queue-toggle');
  if (await queue.getAttribute('aria-expanded') !== 'true') await queue.click();
  await page.getByTestId('materials-stop').click();
  await page.getByTestId('materials-queue').getByText('正在停止',{exact:true}).waitFor();
  const stopping = await trace();
  assert(stopping.killRequested && !stopping.closed && !gone(stopping.pid));
  const beforeClose = await leaseSnapshot();
  const cancelling = forTask(beforeClose, heldState.task.id).findLast(event => event.state === 'cancel_requested');
  assert(cancelling && cancelling.demand.processes === 1 && beforeClose.used.processes >= 1);
  assert(!beforeClose.events.some(event => event.lease === cancelling.lease && event.state === 'actual_settled'),
    'A cancellation acknowledgement must not return the active physical process slot');
  await app.evaluate(() => globalThis.sendProviderOcrAck());
  const late = await until('actual late third page from the cancelled native worker', async () => {
    const t = await trace();
    return t.events.find(e => e.kind === 'page' && e.held && e.page === 3 && e.requestId === held.requestId);
  });
  await app.evaluate(() => globalThis.deliverLateProviderOcr());
  const blocked = await until('the production reader rejects late bytes', async () => {
    const t = await trace();
    return t.forwarded > 0 && t.outputClosed && !t.closed && t;
  });
  assert(!gone(held.pid));
  assert.deepEqual(live().pages,heldState.pages);
  assert.equal(live().job.owner_nonce,heldState.job.owner_nonce);
  assert.equal(live().task.state,'cancelled');
  const saved = await page.evaluate(() => window.omniEdu.createQuestionBankItem({subject:'物理',grade:'初二',knowledgePoint:'光学',
    questionType:'解答题',difficulty:'medium',stem:'故障隔离验收，写出平面镜成像特点。',answer:'等大虚像。',analysis:'根据光的反射规律分析。',
    sourceTitle:'合成验收数据',tags:[]}));
  assert.equal(read(db => db.prepare('SELECT stem FROM question_bank_items WHERE id=?').get(saved.id)?.stem),saved.stem);
  assert(!gone(held.pid),'The separate teacher save must complete while the old physical process survives cancellation');
  await app.evaluate(() => globalThis.releaseProviderOcr());
  const cancelled = await until('actual close before fresh capacity and retry', async () => {
    const t = await trace(), state = live();
    return t.closed && gone(t.pid) && state.job?.owner_pid === 0 && {trace:t, snapshot:state};
  });
  const afterClose = await leaseSnapshot();
  assert.equal(afterClose.events.filter(event => event.lease === cancelling.lease && event.state === 'actual_settled').length,1,
    'The same physical lease settles once after its process close');
  assert.deepEqual(cancelled.snapshot.pages,heldState.pages);
  assert.equal(cancelled.snapshot.task.state,'cancelled');
  report.cancel = {held, late, blocked, saved:{id:saved.id}, beforeClose, afterClose, lease:cancelling.lease, after:cancelled};
  report.checks.push('Actual cancel acknowledgement holds capacity and fences the old real page while an independent save succeeds');

  await capture('observe');
  await retry();
  const completed = await until('the same source and generation publish all six pages', () => {
    const state = live();
    return state.job?.state === 'complete' && state.job.owner_pid === 0 && state;
  }, 120000);
  const resumed = await trace();
  assert(resumed.spawned && resumed.closed && gone(resumed.pid));
  assert.notEqual(resumed.requestId,held.requestId);
  assert.deepEqual(resumed.skipPages,[1,2]);
  assert.deepEqual(resumed.events.filter(e => e.kind === 'page').map(e => e.page),[3,4,5,6]);
  assert.equal(completed.task.id,interrupted.task.id);
  assert.equal(completed.job.generation,interrupted.job.generation);
  assert.equal(completed.job.worker,interrupted.job.worker);
  assert.equal(completed.job.version,sourceHash);
  const resumeTiming = forTask(await leaseSnapshot(),completed.task.id);
  const freshLease = resumeTiming.findLast(event => event.state === 'started');
  assert(freshLease && freshLease.lease !== cancelling.lease);
  assert.equal(resumeTiming.filter(event => event.lease === freshLease.lease && event.state === 'actual_settled').length,1);
  assert.equal(hash(fs.readFileSync(fixture)),sourceHash);
  assert.equal(hash(fs.readFileSync(completed.source.local_path)),sourceHash);
  assert.deepEqual(completed.pages.slice(0,2),heldState.pages);
  assert.deepEqual(completed.pages.map(p => [p.page,p.status,p.attempts,p.text]), [1,2,3,4,5,6].map(p => [p,'complete',1,true]));
  report.resume = {trace:resumed, snapshot:completed, lease:freshLease.lease, leaseEvents:resumeTiming};
  report.checks.push('An explicit original-owner retry launches a new physical request and processes only the four missing pages');
  const terminal = await until('original material ingestion reaches a persistent terminal state', () => {
    const state = live();
    return ['succeeded','failed','cancelled'].includes(state.task?.state) && state;
  }, 120000);
  report.materialTerminal = terminal;
  assert.equal(terminal.task.id,interrupted.task.id);
  assert.equal(terminal.task.state,'succeeded', terminal.task.error);
  await page.getByTestId('materials-queue').getByText('正文已收录',{exact:true}).waitFor();
  assert.deepEqual(terminal.pages,completed.pages);
  report.checks.push('The original material queue and its visible success agree with persistent six-page evidence');
  report.success = true;
} catch (error) {
  report.error = String(error.stack ?? error);
  process.exitCode = 1;
  if (app) report.lastTrace = await trace().catch(() => undefined);
  if (fs.existsSync(database)) {
    try {report.lastState = live();} catch (readError) {report.readError = String(readError.message ?? readError);}
  }
} finally {
  if (app) {
    await app.evaluate(() => globalThis.releaseProviderOcr?.()).catch(() => undefined);
    await app.evaluate(() => globalThis.closeProviderOcrLeaseObservation?.()).catch(() => undefined);
    await app.close().catch(() => undefined);
  }
  fs.writeFileSync(path.join(root,'report.json'),JSON.stringify(report,null,2),{flag:'wx'});
  console.log(JSON.stringify({success:report.success, root, checks:report.checks, mainHash:report.mainHash, error:report.error}));
}
