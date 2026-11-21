import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { _electron as electron } from 'playwright';
import { startMcpFixture } from './fixtures/mcp-server.mjs';
import { fingerprint } from '../acceptance/evidence.mjs';

const desktop = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const repo = path.resolve(desktop, '../..');
assert.equal((process.argv.length - 2) % 2, 0, 'arguments must be key/value pairs');
const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) {
  assert(['--build-root', '--expected-out-hash', '--expected-out-count', '--expected-main-hash'].includes(process.argv[i]), 'unknown argument');
  assert(!args.has(process.argv[i]), 'duplicate argument');
  args.set(process.argv[i], process.argv[i + 1]);
}
for (const key of ['--build-root', '--expected-out-hash', '--expected-out-count', '--expected-main-hash']) assert(args.has(key), 'missing ' + key);
assert(/^[a-f0-9]{64}$/.test(args.get('--expected-out-hash')) && /^[a-f0-9]{64}$/.test(args.get('--expected-main-hash')));
const buildRoot = fs.realpathSync(path.resolve(desktop, args.get('--build-root')));
const standardOut = path.join(fs.realpathSync(desktop), 'out');
if (buildRoot !== standardOut) {
  const relative = path.relative(fs.realpathSync(path.join(desktop, 'test-results')), buildRoot);
  assert(relative && relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative),
    'build outside desktop out or test-results');
}
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'omni-edu-c2-course-')),
  data = path.join(dir, 'data'),
  profile = path.join(dir, 'profile'),
  main = path.join(buildRoot, 'main/index.js'),
  fixture = await startMcpFixture();
fs.mkdirSync(path.join(data, 'xiaozhi-pi'), {
  recursive: true
});
const now = new Date().toISOString();
fs.writeFileSync(path.join(data, 'xiaozhi-pi/deepseek-capabilities.v1.json'), JSON.stringify({
  version: 1,
  endpoint: 'https://api.deepseek.com/v1/models',
  observedAt: now,
  models: [{
    id: 'deepseek-flash',
    name: 'deepseek-flash',
    contextWindow: 1048576,
    maxOutputTokens: 32768,
    inputModalities: ['text'],
    observedAt: now,
    source: 'official'
  }]
}));
const workspace = path.join(dir, 'workspace');
fs.mkdirSync(workspace);
fs.writeFileSync(path.join(workspace, 'local-fact.txt'), '合成课程记录：勾股定理 a² + b² = c²');
let app, p, serverId;
const boot = path.join(dir, 'bootstrap.cjs'),
  modelLog = path.join(dir, 'model.json'),
  control = path.join(dir, 'control.json');
fs.writeFileSync(control, JSON.stringify({
  stage: 'first',
  step: 0,
  log: []
}));
const r = {
  checks: [],
  errors: [],
  paidCalls: 0,
  modelCalls: 0,
  fixture: 'Actual UI-created synthetic MCP service and revocation, loopback only.',
  mainSha256: crypto.createHash('sha256').update(fs.readFileSync(main)).digest('hex')
};
const env = {
  ...process.env,
  OMNI_EDU_DATA_ROOT: data,
  OMNI_EDU_REPO_ROOT: repo,
  OMNI_EDU_E2E_DIALOG_MODE: '1',
  OMNI_EDU_E2E_VISIBLE: '0',
  OMNI_EDU_XIAOZHI_PI: '1'
};
for (const k of Object.keys(env)) if (/API_KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL/i.test(k)) delete env[k];
for (const key of ['NODE_OPTIONS', 'ELECTRON_RUN_AS_NODE', 'ELECTRON_RENDERER_URL', 'HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'NO_PROXY']) delete env[key];
env.DEEPSEEK_API_KEY = 'synthetic-c2-only';
env.DEEPSEEK_MODEL = 'deepseek-flash';
fs.writeFileSync(boot, `const{app,net}=require('electron');
const fs=require('node:fs');
app.setPath('userData',${JSON.stringify(profile)});
let n=0;
net.fetch=async(input,init)=>{const u=new URL(typeof input==='string'?input:input.url);
if(u.origin===${JSON.stringify(new URL(fixture.url).origin)})return fetch(u.href,init);
if(u.origin!=='https://api.deepseek.com')throw Error('fixture external network denied');
let b=JSON.parse(init.body);
let names=(b.tools||[]).map(x=>x.function?.name).filter(Boolean),name=names.find(x=>x.startsWith('mcp_')&&x.endsWith('_lookup_lesson'));
let c=JSON.parse(fs.readFileSync(${JSON.stringify(control)},'utf8'));
if(name&&!c.oldName)c.oldName=name;
let chosen,args;
if(c.stage==='first'&&c.step===0){chosen=name;
args={topic:'合成公开课程'};
}else if(c.stage==='retry'&&c.step===0&&!name){chosen='find_education_tools';
args={query:c.oldName||'lookup_lesson'};
}else if(c.stage==='retry'&&name&&(c.step===0||c.step===1)){chosen=name;
args={topic:'合成公开课程'};
}else if(c.stage==='revoked'&&c.step===0){chosen=c.oldName;
args={topic:'合成公开课程'};
}else if(c.stage==='revoked'&&c.step===1){chosen='education_search_materials';
args={query:'勾股定理'};
}else if(c.stage==='revoked'&&c.step===2){let hit;
fs.writeFileSync(${JSON.stringify(path.join(dir, 'search-request.json'))},JSON.stringify(b,null,2));
for(const m of b.messages||[]){const parts=typeof m.content==='string'?[m.content]:Array.isArray(m.content)?m.content.map(x=>x.text||''):[];
for(const part of parts){for(const candidate of [part,...part.split('\\n')])try{const x=JSON.parse(candidate);
if(x.success&&x.hits?.length)hit=x.hits[0]}catch{}}}if(!hit)throw Error('fixture_missing_real_search_hit');
chosen='office_read_material';
args={resourceId:hit.resourceId,offset:hit.offset};
c.source=hit.source;
c.citation=hit.citation;
}c.log.push({stage:c.stage,step:c.step,names,chosen,messages:b.messages});
c.step++;
fs.writeFileSync(${JSON.stringify(control)},JSON.stringify(c));
fs.writeFileSync(${JSON.stringify(modelLog)},JSON.stringify(c.log));
const base={id:'owned-c2',object:'chat.completion.chunk',created:1,model:'deepseek-flash'};
let delta=chosen?{role:'assistant',tool_calls:[{index:0,id:'synthetic_'+c.stage+'_'+c.step,type:'function',function:{name:chosen,arguments:JSON.stringify(args)}}]}:{role:'assistant',content:JSON.stringify(b.messages).includes('勾股定理')?'依据本地资料 粘贴题目.txt：勾股定理 a² + b² = c²。':'依据实际工具回执完成核对。'};
let finish=delta.tool_calls?'tool_calls':'stop';
return new Response('data: '+JSON.stringify({...base,choices:[{index:0,delta,finish_reason:null}]})+'\\n\\ndata: '+JSON.stringify({...base,choices:[{index:0,delta:{},finish_reason:finish}]})+'\\n\\ndata: [DONE]\\n\\n',{status:200,headers:{'content-type':'text/event-stream'}})};
app.whenReady().then(()=>import(${JSON.stringify(pathToFileURL(main).href)}));
`);
const cat = () => p.evaluate(() => window.omniEdu.getXiaozhiMcpCatalog());
async function until(fn, ms = 45000) {
  let end = Date.now() + ms;
  while (Date.now() < end) {
    let x = await fn();
    if (x) return x;
    await p.waitForTimeout(100);
  }
  throw Error('condition timeout');
}
;
async function launch() {
  const start = performance.now();
  app = await electron.launch({
    args: [boot, '--user-data-dir=' + profile],
    env,
    timeout: 120000
  });
  app.process().stdout?.on('data', x => fs.appendFileSync(path.join(dir, 'electron.log'), x));
  app.process().stderr?.on('data', x => fs.appendFileSync(path.join(dir, 'electron.log'), x));
  p = await app.firstWindow({
    timeout: 120000
  });
  const firstWindowMs = performance.now() - start;
  p.on('pageerror', e => r.errors.push(e.message));
  await p.getByTestId('xiaozhi-pi-workspace').waitFor({
    timeout: 120000
  });
  await p.getByTestId('office-prompt-input').waitFor({timeout: 120000});
  await p.waitForFunction(() => {const input = document.querySelector('[data-testid=office-prompt-input]'); return !!input && !input.disabled;}, null, {
    timeout: 120000
  });
  (r.startup ??= []).push({
    firstWindowMs,
    workspaceUsableMs: performance.now() - start
  });
  assert.equal(await app.evaluate(({
    BrowserWindow
  }) => BrowserWindow.getAllWindows()[0].isVisible()), false);
  r.runtime = await app.evaluate(({
    app
  }) => ({
    packaged: app.isPackaged,
    userData: app.getPath('userData')
  }));
  assert.equal(path.resolve(r.runtime.userData), path.resolve(profile));
  r.dataRoot = await p.evaluate(() => window.omniEdu.getDataRoot());
  assert.equal(path.resolve(r.dataRoot), path.resolve(data));
}
;
async function tools() {
  await p.getByRole('button', {
    name: '设置',
    exact: true
  }).click();
  await p.getByTestId('pi-settings-advanced-toggle').click();
  await p.getByTestId('pi-settings-tab-tools').click();
  await p.getByTestId('pi-mcp-add').waitFor();
  await until(async () => (await cat()).ok);
}
;
async function action(id) {
  await p.getByTestId(id).click();
  await until(async () => !(await p.getByTestId('pi-mcp-refresh').isDisabled()));
}
;
function stored() {
  const d = new DatabaseSync(path.join(data, 'app.db'), {
    readOnly: true
  });
  try {
    return d.prepare('select value_json from app_settings where key=?').get('xiaozhi.mcp.v1').value_json;
  } finally {
    d.close();
  }
}
try {
  const full = fingerprint(buildRoot);
  r.build = {
    sha256: full.sha256,
    files: full.files.length
  };
  assert.equal(full.sha256, args.get('--expected-out-hash'));
  assert.equal(full.files.length, Number(args.get('--expected-out-count')));
  assert.equal(r.mainSha256, args.get('--expected-main-hash'));
  await launch();
  const text = '学科：数学\n年级：初二\n知识点：勾股定理\n题型：选择题\n难度：easy\n1. 判断合成课程：勾股定理 a² + b² = c² 是否正确？\nA. 错误\nB. 正确\n答案：B\n解析：直角三角形两直角边平方之和等于斜边平方。';
  const seed = await p.evaluate(async text => {
    const input = {
      schemaVersion: 'xiaozhi.material-paste.v1',
      text
    };
    const preview = await window.omniEdu.previewPastedMaterial(input);
    return window.omniEdu.importPastedMaterial({
      ...input,
      expectedDigest: preview.digest
    });
  }, text);
  r.seed = seed;
  assert(seed.resources?.length);
  await until(async () => {
    const x = await p.evaluate(resourceId => window.omniEdu.getMaterialBody({
      schemaVersion: 'xiaozhi.materials.v1',
      resourceId,
      offset: 0
    }), seed.resources[0].id);
    return x.chunks?.some(y => y.contentMd.includes('勾股定理'));
  }, 120000);
  await app.evaluate(({
    dialog
  }, folder) => {
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [folder]
    });
  }, workspace);
  await p.getByTestId('pi-permission-picker').click();
  await p.getByRole('menuitem', {
    name: '选择教学工作目录',
    exact: true
  }).click();
  await until(async () => Boolean((await p.evaluate(async () => window.omniEdu.getXiaozhiSnapshot(document.querySelector('.office-composer-container').getAttribute('data-session-id')))).workspace));
  await tools();
  await p.getByTestId('pi-mcp-name').fill('合成课程连接');
  await p.getByTestId('pi-mcp-address').fill(fixture.url);
  await p.getByTestId('pi-mcp-ack').locator('[data-slot="checkbox-control"]').click();
  await action('pi-mcp-add');
  let c = (await cat()).value;
  serverId = c.servers.find(x => x.name === '合成课程连接').id;
  await action('pi-mcp-inspect-' + serverId);
  await p.getByTestId(`pi-mcp-tool-${serverId}-lookup_lesson`).locator('[data-slot="checkbox-control"]').click();
  await action('pi-mcp-trust-' + serverId);
  c = (await cat()).value;
  let trusted = c.servers.find(x => x.id === serverId);
  assert.equal(trusted.status, 'ready');
  assert.equal(trusted.trustedSchemaHash, trusted.schemaHash);
  assert(trusted.tools.some(x => x.name === 'lookup_lesson' && x.selected));
  r.trusted = trusted;
  assert.equal(fixture.state.calls, 0);
  await p.getByTestId('nav-ai').click();
  const sessionId = await p.locator('.office-composer-container').getAttribute('data-session-id');
  await p.getByTestId('office-prompt-input').fill('请查询合成课程并按回执回答；不能使用外部服务时读取本地 local-fact.txt。');
  await p.getByRole('button', {
    name: '发送消息',
    exact: true
  }).click();
  await until(() => fs.existsSync(modelLog), 60000);
  r.model = JSON.parse(fs.readFileSync(modelLog, 'utf8'));
  assert(r.model[0]?.chosen?.startsWith('mcp_'), 'MCP tool is not registered in actual model request');
  await until(async () => {
    let x = await p.evaluate(id => window.omniEdu.getXiaozhiSnapshot(id), sessionId);
    return !x.running && x.task?.state === 'review_required';
  }, 90000);
  let first = await p.evaluate(id => window.omniEdu.getXiaozhiSnapshot(id), sessionId);
  r.firstTask = first.task;
  await p.getByRole('button', {
    name: '设置',
    exact: true
  }).click();
  await p.getByTestId('pi-settings-tab-permissions').click();
  let req = p.getByTestId('pi-permission-request').filter({
    hasText: '合成课程连接'
  });
  if ((await req.count()) !== 1) req = p.getByTestId('pi-permission-request').first();
  await req.waitFor();
  r.permissionText = await req.innerText();
  await req.getByRole('button', {
    name: '授权当前任务',
    exact: true
  }).click();
  await req.waitFor({
    state: 'detached'
  });
  await p.getByTestId('nav-ai').click();
  await p.getByTestId('pi-workbench-open').click();
  await p.getByTestId('pi-workbench-tasks').click();
  let row = p.locator(`[data-testid="pi-task-overview-row"][data-task-id="${first.task.id}"]`);
  await row.waitFor();
  let controlData = JSON.parse(fs.readFileSync(control, 'utf8'));
  controlData.stage = 'retry';
  controlData.step = 0;
  fs.writeFileSync(control, JSON.stringify(controlData));
  await row.getByTestId('pi-task-overview-continue').click();
  await until(() => fixture.state.calls > 0, 60000);
  r.fixtureRequests = fixture.state.requests;
  r.fixtureCalls = fixture.state.calls;
  await until(async () => !(await p.evaluate(id => window.omniEdu.getXiaozhiSnapshot(id), sessionId)).running, 60000);
  r.after = await p.evaluate(id => window.omniEdu.getXiaozhiSnapshot(id), sessionId);
  await p.screenshot({
    path: path.join(dir, 'successful-first-call.png')
  });
  r.checks.push({
    name: 'actual_registered_tool_reaches_owned_mcp',
    status: 'PASS'
  });
  await tools();
  await action('pi-mcp-revoke-' + serverId);
  let revoked = (await cat()).value.servers.find(x => x.id === serverId);
  assert.equal(revoked.status, 'revoked');
  r.revoked = revoked;
  let savedCalls = fixture.state.calls;
  controlData = JSON.parse(fs.readFileSync(control, 'utf8'));
  controlData.stage = 'revoked';
  controlData.step = 0;
  fs.writeFileSync(control, JSON.stringify(controlData));
  await p.getByTestId('nav-ai').click();
  await until(async () => (await p.locator('.office-composer-container').getAttribute('data-session-id')) === sessionId);
  await p.getByTestId('pi-workbench-open').click();
  await p.getByTestId('pi-workbench-tasks').click();
  row = p.locator('[data-testid=pi-task-overview-row]').filter({
    hasText: '请查询合成课程'
  });
  await row.getByTestId('pi-task-overview-continue').click();
  await until(async () => {
    let c = JSON.parse(fs.readFileSync(control, 'utf8'));
    return c.stage === 'revoked' && c.step >= 4;
  }, 60000);
  await until(async () => {
    const snapshot = await p.evaluate(id => window.omniEdu.getXiaozhiSnapshot(id), sessionId);
    return !snapshot.running && snapshot.projection.turns.at(-1)?.status !== 'running';
  }, 90000);
  r.afterRevocation = await p.evaluate(id => window.omniEdu.getXiaozhiSnapshot(id), sessionId);
  r.control = JSON.parse(fs.readFileSync(control, 'utf8'));
  assert.equal(fixture.state.calls, savedCalls);
  r.callsAfterRevoke = fixture.state.calls;
  await p.screenshot({
    path: path.join(dir, 'after-revoke.png')
  });
  assert.equal(r.afterRevocation.task.id, first.task.id);
  assert((await p.locator('body').innerText()).includes('依据本地资料 粘贴题目.txt：勾股定理 a² + b² = c²'));
  const db = new DatabaseSync(path.join(data, 'app.db'), {
    readOnly: true
  });
  try {
    r.receipts = db.prepare('select run_id,call_id,tool,admitted,success,native_state,effect_state from xiaozhi_tool_receipts').all();
    r.runs = db.prepare('select id,session_id,status from ai_agent_runs where session_id=?').all(sessionId);
  } finally {
    db.close();
  }
  assert(!r.receipts.some(x => x.call_id === 'synthetic_revoked_1'));
  const nativeDb = new DatabaseSync(path.join(data, 'app.db'), {
    readOnly: true
  });
  let binding;
  try {
    binding = nativeDb.prepare('select session_file from xiaozhi_pi_session_bindings where conversation_id=?').get(sessionId);
  } finally {
    nativeDb.close();
  }
  assert(binding);
  const nativePath = path.join(data, 'xiaozhi-pi', binding.session_file);
  const nativeRows = fs.readFileSync(nativePath, 'utf8').trim().split('\n').map(JSON.parse);
  r.nativeDenied = nativeRows.find(x => x.message?.role === 'toolResult' && x.message.toolCallId === 'synthetic_revoked_1')?.message;
  assert(r.nativeDenied?.isError && r.nativeDenied.toolName === r.control.oldName);
  assert(r.control.log.some(x => x.stage === 'revoked' && x.step === 0 && x.chosen === r.control.oldName && !x.names.includes(r.control.oldName)));
  assert(r.receipts.some(x => x.call_id === 'synthetic_revoked_2' && x.tool === 'education_search_materials' && x.success === 1));
  assert(r.receipts.some(x => x.call_id === 'synthetic_revoked_3' && x.tool === 'office_read_material' && x.success === 1));
  assert(r.control.source && r.control.source.resourceId === seed.resources[0].id && r.control.citation);
  r.materialSource = await p.evaluate(source => window.omniEdu.getMaterialSource(source), r.control.source);
  assert(JSON.stringify(r.materialSource).includes('勾股定理'));
  const workbenchToggle = p.getByTestId('pi-workbench-open');
  if (await workbenchToggle.getAttribute('aria-expanded') === 'true') await workbenchToggle.click();
  const sources = p.getByTestId('reply-sources').last();
  await sources.waitFor({state: 'visible'});
  await sources.getByRole('button', {name: /本轮读取的资料/}).click();
  const sourceButton = sources.getByTestId('pi-material-source-open').filter({hasText: r.control.citation});
  await sourceButton.waitFor({state: 'visible'});
  await sourceButton.click();
  const detail = p.getByTestId('materials-detail');
  await detail.waitFor({state: 'visible'});
  await p.getByTestId('materials-body-location').waitFor({state: 'visible'});
  assert.equal(await detail.getAttribute('data-resource-id'), r.control.source.resourceId);
  assert.equal(await detail.getAttribute('data-resource-version'), r.control.source.version);
  assert((await detail.innerText()).includes('勾股定理'));
  assert((await p.getByTestId('materials-body-location').innerText()).includes('已打开小智引用来源'));
  r.rendererSource = {citation: r.control.citation, resourceId: r.control.source.resourceId,
    version: r.control.source.version, location: await p.getByTestId('materials-body-location').innerText()};
  await p.screenshot({path: path.join(dir, 'material-source-open.png')});
  r.checks.push({name: 'reply_source_opens_actual_material_version_and_text', status: 'PASS'});
  await p.getByRole('button', {name: '问小智', exact: true}).click();
  await until(async () => (await p.locator('.office-composer-container').getAttribute('data-session-id')) === sessionId);
  r.checks.push({
    name: 'same_task_revoked_tool_denied_and_local_fact_read',
    status: 'PASS'
  });
  const before = JSON.stringify(r.receipts),
    calls = fixture.state.calls,
    controlBefore = fs.readFileSync(control, 'utf8');
  await app.close();
  app = undefined;
  await launch();
  await until(async () => (await p.locator('.office-composer-container').getAttribute('data-session-id')) === sessionId);
  assert((await p.locator('body').innerText()).includes('依据本地资料 粘贴题目.txt：勾股定理 a² + b² = c²'));
  const coldDb = new DatabaseSync(path.join(data, 'app.db'), {
    readOnly: true
  });
  let cold;
  try {
    cold = coldDb.prepare('select run_id,call_id,tool,admitted,success,native_state,effect_state from xiaozhi_tool_receipts').all();
  } finally {
    coldDb.close();
  }
  assert.equal(JSON.stringify(cold), before);
  const coldNative = fs.readFileSync(nativePath, 'utf8').trim().split('\n').map(JSON.parse).find(x => x.message?.role === 'toolResult' && x.message.toolCallId === 'synthetic_revoked_1')?.message;
  assert.deepEqual(coldNative, r.nativeDenied);
  r.coldSource = await p.evaluate(source => window.omniEdu.getMaterialSource(source), r.control.source);
  assert(JSON.stringify(r.coldSource).includes('勾股定理'));
  assert.equal(fixture.state.calls, calls);
  assert.equal(fs.readFileSync(control, 'utf8'), controlBefore);
  r.checks.push({
    name: 'cold_same_fact_no_replay',
    status: 'PASS'
  });
  r.status = 'PASS_SCOPED';
} catch (e) {
  r.error = String(e.stack);
  r.status = 'FAIL';
  process.exitCode = 1;
  await p?.screenshot({
    path: path.join(dir, 'failure.png')
  }).catch(() => {});
} finally {
  await app?.close().catch(() => {});
  await fixture.close();
  const after = fingerprint(buildRoot);
  r.buildAfter = {
    sha256: after.sha256,
    files: after.files.length
  };
  if (after.sha256 !== r.build?.sha256) {
    r.status = 'FAIL';
    process.exitCode = 1;
  }
  fs.writeFileSync(path.join(dir, 'report.json'), JSON.stringify(r, null, 2));
  console.log(JSON.stringify({
    status: r.status,
    checks: r.checks,
    error: r.error,
    requests: fixture.state.requests,
    calls: fixture.state.calls
  }));
}
