import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { _electron as electron } from 'playwright';
import {testMain,assertIsolatedPiMain} from '../acceptance/build-root.mjs';
import {fingerprint,sha256} from '../acceptance/evidence.mjs';
import {assertWorkspaceChrome,measureTextContrast} from './capture-workspace-metrics.mjs';
const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const testRoot = fs.realpathSync(path.join(appRoot, 'test-results/xiaozhi-agent'));
const freshSeed=process.argv[2]==='--fresh-seed';
const source = freshSeed ? null : fs.realpathSync(path.resolve(appRoot, process.argv[2] || 'missing'));
if(source){const relative=path.relative(testRoot,source);assert(!relative.startsWith('..')&&!path.isAbsolute(relative)&&path.basename(source)==='data');}
const output = fs.mkdtempSync(path.join(testRoot, 'pi-auto-ui-')), dataRoot = path.join(output, 'data');
if(source)fs.cpSync(source,dataRoot,{recursive:true,errorOnExist:true,force:false});else fs.mkdirSync(dataRoot);
const cfg = fs.readFileSync(path.join(appRoot, '.env.local'), 'utf8'), pick = name => cfg.match(new RegExp(`^${name}\\s*=\\s*["']?([^\\r\\n"']+)`, 'm'))?.[1]?.trim();
const key = pick('DEEPSEEK_API_KEY'), model = pick('DEEPSEEK_MODEL') || 'deepseek-flash'; assert(key);
let binding,original,marker=randomUUID().slice(0,8);
if(source){const db=new DatabaseSync(path.join(dataRoot,'app.db'),{readOnly:true});binding=db.prepare('SELECT * FROM xiaozhi_pi_session_bindings').all().find(value=>{const file=path.join(dataRoot,'xiaozhi-pi',value.session_file);return fs.existsSync(file)&&fs.readFileSync(file,'utf8').includes('"type":"compaction"');});db.close();assert(binding);original=fs.readFileSync(path.join(source,'xiaozhi-pi',binding.session_file),'utf8');marker=original.match(/教育验收码([a-f0-9]{8})/)?.[1];assert(marker);}
const checks = [], report = { suite: 'pi-auto-compaction-formal-ui', success: false, model, checks,
  boundaries: [freshSeed?'Real DeepSeek and actual Electron; new synthetic teacher seed through visible UI':'Real DeepSeek and actual Electron; copied isolated teacher test data only', 'Official provider window retained; 131072 early-compaction acceptance policy only', 'Private JSONL readback is local test evidence, never public UI'] };
const buildRoot=path.dirname(path.dirname(testMain(appRoot))),fixed=fingerprint(buildRoot),errors=[];
Object.assign(report,{layer:'C isolated formal Electron',humanAccepted:false,build:{root:buildRoot,files:fixed.files.length,sha256:fixed.sha256},scriptSha256:sha256(fs.readFileSync(fileURLToPath(import.meta.url))),layout:[],contrast:[]});
let app, page;
const until = async (fn, ms = 120000) => { const end = Date.now() + ms; while (Date.now() < end) { if (await fn()) return; await new Promise(resolve => setTimeout(resolve, 100)); } throw new Error('Automatic compaction condition timed out'); };
const check = (name, fn) => { fn(); checks.push({ name, pass: true }); console.log(`PASS ${name}`); };
const read = session => {
  const db = new DatabaseSync(path.join(dataRoot, 'app.db'), { readOnly: true });
  try { const binding = db.prepare('SELECT * FROM xiaozhi_pi_session_bindings WHERE conversation_id=?').get(session);
    const raw = binding ? fs.readFileSync(path.join(dataRoot, 'xiaozhi-pi', binding.session_file), 'utf8') : '';
    return { raw, entries: raw.trim() ? raw.trim().split('\n').map(JSON.parse) : [] };
  } finally { db.close(); }
};
const id = () => page.locator('.office-composer-container').getAttribute('data-session-id');
const snap = async session => page.evaluate(id => window.omniEdu.getXiaozhiSnapshot(id), session || await id());
async function ready() { await page.waitForFunction(() => !document.querySelector('[data-testid="office-prompt-input"]')?.disabled); }
async function launch(delay = 0, reject = false) {
  const env = { ...process.env, OMNI_EDU_DATA_ROOT: dataRoot, OMNI_EDU_REPO_ROOT: path.resolve(appRoot, '../..'), OMNI_EDU_E2E_DIALOG_MODE: '1', OMNI_EDU_XIAOZHI_PI: '1',
    OMNI_EDU_E2E_PI_AUTO_COMPACTION: '1', OMNI_EDU_E2E_PI_CONTEXT_WINDOW: '131072', OMNI_EDU_E2E_PI_AUTO_COMMIT_DELAY_MS: String(delay), OMNI_EDU_E2E_PI_AUTO_COMPACT_REJECT: reject ? '1' : '0', DEEPSEEK_API_KEY: key, DEEPSEEK_MODEL: model };
  delete env.ELECTRON_RUN_AS_NODE; delete env.NODE_OPTIONS;
  app = await electron.launch({ args: [testMain(appRoot),`--user-data-dir=${path.join(output,'profile')}`], env, timeout: 60000 }); page = await app.firstWindow();page.on('pageerror',error=>errors.push(String(error).replaceAll(key,'[credential]')));
  await page.getByTestId('xiaozhi-pi-workspace').waitFor({ state: 'visible', timeout: 30000 }); await ready();
  (report.launches||=[]).push(await assertIsolatedPiMain(app,testMain(appRoot),path.join(output,'profile')));
  assert.equal((await snap()).limitsEnforced,false);
}
async function open(session) { await page.getByTestId(`ai-conversation-session-${session}`).click(); await ready(); }
async function send(text) { const session = await id(), count = (await snap(session)).projection.turns.length; await page.getByTestId('office-prompt-input').fill(text); await page.getByTestId('office-prompt-input').press('Enter'); await until(async () => (await snap(session)).projection.turns.length > count); return session; }
async function terminal(session) { await until(async () => !(await snap(session)).running); return snap(session); }
async function fresh() { const previous = await id(); await page.getByTestId('ai-conversation-new').click(); await page.waitForFunction(value => document.querySelector('.office-composer-container')?.getAttribute('data-session-id') !== value, previous); await ready(); }
const batch = '合成教学资料：理解分数单位之后比较分数大小，教师复核答案与来源，文件尚未提交。'.repeat(160);
async function fillHistory(session, n = 3) {
  for (let i = 0; i < n; i++) { await send('请阅读本批合成备课资料，只回复一句已阅读，不要工具或长摘要。\n' + batch); const state = await terminal(session); assert.equal(state.projection.turns.at(-1).status, 'completed', JSON.stringify({status:state.projection.turns.at(-1).status,error:state.projection.turns.at(-1).error})); }
}
try {
  await launch();
  if(freshSeed){
    const seed=await id(),folder=path.join(output,'备课资料');fs.mkdirSync(folder);fs.writeFileSync(path.join(folder,'分数课.md'),'来源：合成教师资料。先理解分数单位，再通过纸条比较分数大小。');
    await app.evaluate(({dialog},directory)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[directory]});},folder);
    await page.getByTestId('pi-permission-picker').click();await page.getByRole('menuitem',{name:'选择教学工作目录',exact:true}).click();await until(async()=>Boolean((await snap()).workspace));
    await send('本任务的重要事实：教育验收码'+marker+'，五年级。先用 update_plan 公布两步读取分数资料、整理教案草稿。读取分数课.md，再请求复制为分数课草稿.md，等我确认；不要只给文字，不重试被拒绝复制。');
    await page.locator('[data-testid="pi-copy-approval"][data-state="pending"]').waitFor({state:'visible',timeout:90000});await page.getByTestId('pi-copy-reject').click();assert.equal((await terminal(seed)).projection.turns.at(-1).status,'completed');
    await fillHistory(seed,3);await page.getByTestId('pi-task-details-expand').click();await page.getByTestId('pi-compact').click();assert.equal((await terminal(seed)).projection.turns.at(-1).status,'completed');
    const db=new DatabaseSync(path.join(dataRoot,'app.db'),{readOnly:true});binding=db.prepare('SELECT * FROM xiaozhi_pi_session_bindings WHERE conversation_id=?').get(seed);db.close();
    check('Current-version seed uses real teacher plan/read/rejection and native manual summary without a run budget',()=>{assert(read(seed).entries.some(e=>e.type==='compaction'));assert.equal((fs.existsSync(path.join(folder,'分数课草稿.md'))),false);});
  }else await open(binding.conversation_id);
  const session=binding.conversation_id,before=read(session),previousRunIds=new Set((await snap(session)).projection.turns.map(turn=>turn.id));
  for(let n=0;n<8;n++){await fillHistory(session,1);if(read(session).entries.filter(e=>e.type==='compaction').length>before.entries.filter(e=>e.type==='compaction').length)break;} let state = await snap(session), after = read(session);
  const autoTurns = state.projection.turns.filter(turn => !previousRunIds.has(turn.id)&&turn.items.some(item => item.kind === 'compaction' && item.id.match(/:compaction:\d+$/)));
  check('Official capacity and early local policy are distinct in formal snapshot and UI', () => { assert.equal(state.modelCapabilities.contextWindow, 1048576); assert.equal(state.contextPolicy.window, 131072); assert.equal(state.contextPolicy.auto, true); assert(state.contextPolicy.testPolicy); });
  if(!await page.getByTestId('pi-model-capabilities').isVisible())await page.getByTestId('pi-task-details-expand').click();
  assert((await page.getByTestId('pi-model-capabilities').innerText()).includes('1,048,576'));
  check('Real long conversation automatically compacts and continues the same task', () => { assert(after.raw.startsWith(before.raw)); assert(after.entries.filter(entry => entry.type === 'compaction').length > before.entries.filter(entry => entry.type === 'compaction').length); assert(autoTurns.length > 0); assert(autoTurns.every(turn => turn.status === 'completed' && turn.items.filter(item => item.kind === 'compaction').every(item => item.status === 'completed'))); });
  check('Auto-summary preserves exact rejected approval/source version and plan privately', () => { const summary = after.entries.filter(entry => entry.type === 'compaction').at(-1).summary; assert(summary.includes('sourceSha256') && summary.includes('rejected') && summary.includes('整理教案草稿')); assert(!JSON.stringify(state).includes(summary)); });
  check('Compaction usage and assistant usage share the original public run ledger', () => { for (const turn of autoTurns) { const usage = state.usage.find(value => value.runId === turn.id); assert(usage.modelCalls >= 2); assert(usage.tokens.total > 0); assert.equal(usage.state, 'completed'); assert.equal(usage.cost, null); } });
  await send('请回答原任务的教育验收码和年级，不要工具或新文件。'); state = await terminal(session);
  check('Original task facts survive automatic history replacement', () => { const text = state.projection.turns.at(-1).items.filter(item => item.role === 'assistant').map(item => item.text).join(''); assert(text.includes(marker) && text.includes('五年级')); });
  for (const theme of ['light','dark'])for(const [width,height] of [[1366,768],[1920,1080]]) {
    await page.emulateMedia({colorScheme:theme});await app.browserWindow(page).then(window=>window.evaluate((win,size)=>win.setContentSize(...size),[width,height]));
    await page.waitForFunction(size=>innerWidth===size.width&&innerHeight===size.height,{width,height});
    const compactCard=page.locator('[data-testid="pi-compaction-card"]').last();await compactCard.scrollIntoViewIfNeeded();assert(await compactCard.isVisible());
    report.layout.push({theme,width,height,...await assertWorkspaceChrome(page)});
    await page.screenshot({path:path.join(output,`auto-${theme}-${width}x${height}.png`),animations:'disabled'});
  }
  await page.emulateMedia({colorScheme:'light'});
  check('Actual light/dark dual viewport captures show persisted compaction card with stable header/input',()=>{});
  const count=after.entries.filter(entry=>entry.type==='compaction').length;for(let n=0;n<8;n++){await fillHistory(session,1);if(read(session).entries.filter(e=>e.type==='compaction').length>count)break;}after=read(session);
  check('Later requests can compact again without trusting stale pre-compaction usage', () => assert(after.entries.filter(entry => entry.type === 'compaction').length > count));
  // New authorized synthetic sources. Follow-on name only appears inside the first file.
  await fresh(); const mid = await id(), folder = path.join(output, '轮次资料'); fs.mkdirSync(folder);
  const nextName = `后续资料-${randomUUID().slice(0, 8)}.md`, code = randomUUID().slice(0, 8);
  fs.writeFileSync(path.join(folder, '首份资料.md'), '第一份教学内容，纸条比较分数大小。'.repeat(650) + `\n继续读取授权目录中的 ${nextName}，然后综合两份材料。`);
  fs.writeFileSync(path.join(folder, nextName), '第二份教学内容，课堂练习要有来源并经教师复核。'.repeat(550) + `\n最后验收编号：${code}`);
  await app.evaluate(({ dialog }, directory) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [directory] }); }, folder);
  await page.getByTestId('pi-permission-picker').click();await page.getByRole('menuitem',{name:'选择教学工作目录',exact:true}).click(); await until(async () => Boolean((await snap(mid)).workspace));
  await send('请记住本轮只是合成教研验收，先阅读材料并回复已阅读，不执行工具。\n' + batch.slice(0, 400)); await terminal(mid);
  await send('请读取首份资料.md，按里面的提示继续读取下一份资料，再用两句话说明教学要点和最后验收编号，不创建或复制文件。'); state = await terminal(mid); after = read(mid);
  check('Hana turn seam performs real mid-tool-loop compaction and continues', () => { assert.equal(state.projection.turns.at(-1).status, 'completed'); const readIndexes=after.entries.flatMap((entry,index)=>entry.message?.role==='toolResult'&&entry.message.toolName==='office_read_text'&&!entry.message.isError?[index]:[]);const compactIndex=after.entries.findLastIndex(entry=>entry.type==='compaction');const finalIndex=after.entries.findLastIndex(entry=>entry.message?.role==='assistant'&&entry.message.content.some(part=>part.type==='text'&&part.text.includes(code)));assert(readIndexes.length>=2&&compactIndex>readIndexes.at(-1)&&finalIndex>compactIndex);assert(state.projection.turns.at(-1).items.some(item=>item.kind==='compaction'&&item.status==='completed')); assert(state.projection.turns.at(-1).items.filter(item => item.kind === 'tool' && item.label === '读取授权资料' && item.status === 'completed').length >= 2); assert(state.projection.turns.at(-1).items.some(item => item.role === 'assistant' && item.text.includes(code))); });
  check('Real split-turn summaries account for both parallel native requests', () => { const run = state.projection.turns.at(-1), receipt = state.usage.find(value => value.runId === run.id), native = after.entries.filter(entry => entry.type === 'custom' && entry.customType === 'xiaozhi.compaction.usage.v1'); assert(native.some(entry => native.filter(value => value.data.compactionId === entry.data.compactionId).length >= 2)); assert(receipt.modelCalls >= 5); assert.equal(receipt.completeness, 'reported'); const cumulative = native.at(-1).data.usage.total; assert(receipt.tokens.total >= cumulative); });
  // Stop at actual summarizer lifecycle, before native commit.
  await open(session); const prefix = read(session), summaries = prefix.entries.filter(entry => entry.type === 'compaction').length;
  let waiting;
  for (let n = 0; n < 8; n++) { await send('阅读合成资料只回复已阅读。\n' + batch); const result = await Promise.race([until(async () => (await snap(session)).projection.turns.at(-1).items.some(item => item.kind === 'compaction' && item.status === 'inProgress'), 10000).then(() => 'compact').catch(() => 'none'), terminal(session).then(() => 'ended')]); if (result === 'compact') { waiting = true; break; } }
  assert(waiting, 'Must reach a real active native summarizer');
  await page.waitForFunction(()=>document.querySelector('[data-testid="pi-workspace-activity"]')?.getAttribute('data-state')==='compacting');
  assert(await page.getByTestId('pi-workspace-activity').isVisible());assert.equal(await page.getByTestId('pi-workspace-activity').locator('[data-slot="spinner"]').count(),1);
  await page.screenshot({path:path.join(output,'live-compacting.png'),animations:'disabled'});
  check('Actual native summarizer drives resident compacting status before native commit',()=>{});
  await page.getByRole('button', { name: '停止本轮', exact: true }).click(); state = await terminal(session);await page.getByTestId('pi-workspace-activity').waitFor({state:'hidden'});
  check('Stopping real automatic summarizer interrupts run without committing or replaying writes', () => { assert.equal(state.projection.turns.at(-1).status, 'interrupted'); assert.equal(read(session).entries.filter(entry => entry.type === 'compaction').length, summaries); });
  await app.close(); app = undefined; await launch(); await open(session); state = await snap(session);
  check('Restart retains stopped state and does not auto-resume or change the original test source', () => { assert.equal(state.projection.turns.at(-1).status, 'interrupted'); assert.equal(state.running, false); if(source)assert.equal(fs.readFileSync(path.join(source,'xiaozhi-pi',binding.session_file),'utf8'),original); });
  await app.close(); app = undefined; await launch(0, true); await open(session);
  const failureBefore = read(session), failureCount = failureBefore.entries.filter(entry => entry.type === 'compaction').length;
  for (let n = 0; n < 8; n++) { await send('阅读合成资料后只回复已阅读。\n' + batch); state = await terminal(session); if (state.projection.turns.at(-1).status === 'failed') break; }
  check('Injected pre-commit failure after real summary response retains history and accurate usage', () => { assert.equal(state.projection.turns.at(-1).status, 'failed'); assert(state.projection.turns.at(-1).error.includes('上下文整理')); assert.equal(read(session).entries.filter(entry => entry.type === 'compaction').length, failureCount); assert(read(session).raw.startsWith(failureBefore.raw)); assert(state.usage.at(-1).modelCalls > 0); assert(state.usage.at(-1).tokens.total > 0); });
  await app.close(); app = undefined;
  const markerPath = path.join(dataRoot, '.e2e-pi-auto-compaction-committed'); if (fs.existsSync(markerPath)) fs.unlinkSync(markerPath);
  await launch(20000); await open(session); const crashBefore = read(session), crashCount = crashBefore.entries.filter(entry => entry.type === 'compaction').length;
  for (let n = 0; n < 8; n++) { await send('阅读合成资料后只回复已阅读。\n' + batch); await Promise.race([until(() => fs.existsSync(markerPath)).then(() => 'commit'), terminal(session).then(() => 'ended')]); if (fs.existsSync(markerPath)) break; }
  assert(fs.existsSync(markerPath)); const crashed = await snap(session), crashRun = crashed.projection.turns.at(-1).id;
  check('Native auto summary commits before public terminal without marking task completed', () => { assert(crashed.running); assert.equal(crashed.usage.find(value => value.runId === crashRun).state, 'running'); assert.equal(read(session).entries.filter(entry => entry.type === 'compaction').length, crashCount + 1); });
  await page.waitForFunction(()=>document.querySelector('[data-testid="pi-workspace-activity"]')?.getAttribute('data-state')==='running');
  for(const theme of ['light','dark'])for(const [width,height] of [[1366,768],[1920,1080]]){
    await page.emulateMedia({colorScheme:theme});await app.browserWindow(page).then(window=>window.evaluate((win,size)=>win.setContentSize(...size),[width,height]));await page.waitForFunction(size=>innerWidth===size.width&&innerHeight===size.height,{width,height});
    const activity=page.getByTestId('pi-workspace-activity');assert(await activity.isVisible());const contrast=await measureTextContrast(activity);assert(contrast.ratio>=4.5);report.contrast.push({theme,width,height,...contrast});report.layout.push({theme,width,height,...await assertWorkspaceChrome(page)});
    await page.screenshot({path:path.join(output,`live-working-${theme}-${width}x${height}.png`),animations:'disabled'});
  }
  check('Committed summary switches to working status until actual task settlement in light/dark dual viewport',()=>{});
  execFileSync('taskkill', ['/PID', String(app.process().pid), '/T', '/F'], { stdio: 'ignore' }); app = undefined;
  await launch(); await open(session); state = await snap(session);
  check('Owned-process crash after native commit retains entry and recovers interrupted usage', () => { assert.equal(state.running, false); assert.equal(state.projection.turns.at(-1).status, 'interrupted'); assert.equal(state.usage.find(value => value.runId === crashRun).state, 'interrupted'); assert.equal(read(session).entries.filter(entry => entry.type === 'compaction').length, crashCount + 1); assert(read(session).raw.startsWith(crashBefore.raw)); });
  const replayDb = new DatabaseSync(path.join(dataRoot, 'app.db'), { readOnly: true }); const command = replayDb.prepare('SELECT * FROM xiaozhi_pi_commands WHERE run_id=?').get(crashRun); replayDb.close();
  const replay = await page.evaluate(value => window.omniEdu.startXiaozhi(value), { sessionId: session, commandId: command.command_id, prompt: state.projection.turns.at(-1).items.find(item => item.role === 'user').text });
  check('Interrupted durable command returns original run and never repeats compaction', () => { assert(replay.ok && replay.runId === crashRun); assert.equal(read(session).entries.filter(entry => entry.type === 'compaction').length, crashCount + 1); });
  await send('请回答原任务的教育验收码和年级，不要工具或文件操作。'); state = await terminal(session);
  check('Explicit new user request resumes committed auto-summary task facts', () => { assert.equal(state.projection.turns.at(-1).status, 'completed'); const text = state.projection.turns.at(-1).items.filter(item => item.role === 'assistant').map(item => item.text).join(''); assert(text.includes(marker) && text.includes('五年级')); });
  await fresh(); const large = await id();
  await app.evaluate(({dialog},directory)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[directory]});},folder);
  await page.getByTestId('pi-permission-picker').click();await page.getByRole('menuitem',{name:'选择教学工作目录',exact:true}).click();await until(async()=>Boolean((await snap(large)).workspace));
  await send('只阅读本次合成资料。\n' + '教'.repeat(30000)); state = await terminal(large);
  check('First oversized local-policy input rejects before model call instead of summarizing away the task', () => { assert.equal(state.projection.turns.at(-1).status, 'failed'); assert(state.projection.turns.at(-1).error.includes('上下文')); assert.equal(state.usage.at(-1).modelCalls, 0); assert.equal(read(large).entries.filter(entry => entry.type === 'compaction').length, 0); });
  check('New conversation contains no foreign plan, approval, private summary or usage', () => { assert.equal(state.controls.length, 0); assert.equal(state.approvals.length, 0); assert.equal(state.usage.length, 1); assert(!JSON.stringify(state).includes(marker)); });
  assert.deepEqual(errors,[]);assert.equal(fingerprint(buildRoot).sha256,fixed.sha256);report.rendererErrors=errors;report.success = true;
} catch (error) { report.error = String(error.stack).replaceAll(key, '[credential]').slice(0, 5000); if (page) { await page.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {}); report.snapshot = await snap().catch(() => undefined); } }
finally { await app?.close().catch(() => {}); fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify({ success: report.success, checks: checks.length, error: report.error, report: path.relative(appRoot, path.join(output, 'report.json')) })); }
if (!report.success) process.exitCode = 1;
