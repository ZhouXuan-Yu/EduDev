/** Optional real-provider acceptance. Explicit credential file, owned synthetic data only.
 * node scripts/workbench-live.mjs --env-file D:/path/to/.env.local
 * Two copy requests (reject/approve), then stop a third request. Never prints credentials.
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { _electron as electron } from 'playwright';
import { fingerprint } from './acceptance/evidence.mjs';
import { testMain, assertIsolatedPiMain } from './acceptance/build-root.mjs';
import { DatabaseSync } from 'node:sqlite';

const desktop=path.resolve(import.meta.dirname,'..');
const envFile=process.argv[process.argv.indexOf('--env-file')+1];
assert(process.argv.includes('--env-file') && envFile,'Explicit --env-file required');
const cfg=fs.readFileSync(envFile,'utf8');
const pick=name=>cfg.match(new RegExp(`^${name}\\s*=\\s*(.*?)\\s*$`,'m'))?.[1]?.replace(/^['"]|['"]$/g,'');
const key=pick('DEEPSEEK_API_KEY'); assert(key,'Provider credential unavailable');
const output=fs.mkdtempSync(path.join(desktop,'test-results/workbench-live-'));
const owned=fs.mkdtempSync(path.join(os.tmpdir(),'xiaozhi-workbench-live-'));
const data=path.join(owned,'data'),profile=path.join(owned,'profile'),workspace=path.join(owned,'files');
const readOnly=process.argv.includes('--read-only'),osProfile=path.join(owned,'os-profile');
for(const dir of [osProfile,path.join(osProfile,'AppData/Roaming'),path.join(osProfile,'AppData/Local'),path.join(owned,'tmp')])fs.mkdirSync(dir,{recursive:true});
fs.mkdirSync(workspace); const source=path.join(workspace,'教学资料.txt');
const bytes=Buffer.from('合成验收资料：分数课先图示，再讨论；教师确认后使用。');fs.writeFileSync(source,bytes);
const main=testMain(desktop),before=fingerprint(path.dirname(path.dirname(main)));
const report={success:false,layer:'real_provider_isolated_electron',output,owned,checks:[],errors:[],screenshots:[],
  model:pick('DEEPSEEK_MODEL')||'deepseek-flash',fingerprint:before,scope:'Real provider + original Pi + real owned files; OS chooser return controlled. No user data.'};
let app,page,session;
const check=name=>{report.checks.push(name);console.log('PASS '+name);};
const ui=id=>page.locator('.edu-shell:visible').getByTestId(id);
const snapshot=()=>page.evaluate(id=>window.omniEdu.getXiaozhiSnapshot(id),session);
async function until(read,test,message,timeout=120000){const end=Date.now()+timeout;while(Date.now()<end){const value=await read();if(test(value))return value;await new Promise(resolve=>setTimeout(resolve,100));}throw Error(message);}
async function shot(name,width=1366,height=768){
  const win=await app.browserWindow(page);await win.evaluate((w,size)=>{w.setContentSize(size.width,size.height);w.showInactive();},{width,height});await win.dispose();
  await page.waitForFunction(size=>innerWidth===size.width&&innerHeight===size.height,{width,height});
  const file=path.join(output,name+'.png');await page.screenshot({path:file,animations:'disabled'});report.screenshots.push(file);
}
async function launch(){
  const env={...process.env};
  for(const name of Object.keys(env))if(name.startsWith('OMNI_EDU_E2E_')||['ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL','NODE_OPTIONS'].includes(name))delete env[name];
  Object.assign(env,{OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),OMNI_EDU_XIAOZHI_PI:'1',NODE_ENV:'production',DEEPSEEK_API_KEY:key,DEEPSEEK_MODEL:report.model,
    USERPROFILE:osProfile,HOME:osProfile,APPDATA:path.join(osProfile,'AppData/Roaming'),LOCALAPPDATA:path.join(osProfile,'AppData/Local'),TEMP:path.join(owned,'tmp'),TMP:path.join(owned,'tmp')});
  app=await electron.launch({args:[main,`--user-data-dir=${profile}`],cwd:desktop,env,timeout:60000});
  page=await app.firstWindow();page.on('pageerror',e=>report.errors.push(String(e)));
  report.isolation=await assertIsolatedPiMain(app,main,profile);
  const win=await app.browserWindow(page);await win.evaluate((w,title)=>w.setTitle(title),'小智 · 隔离模型验收 '+path.basename(output));await win.dispose();
  await ui('office-prompt-input').waitFor({timeout:60000});
  await until(()=>ui('office-prompt-input').isEnabled(),Boolean,'Pi not ready');
  session=await page.locator('.office-composer-container').getAttribute('data-session-id');
}
try{
  await launch();
  const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});
  try{for(const table of ['teacher_resources','students','ai_conversation_folders','ai_agent_runs'])assert.equal(db.prepare('SELECT COUNT(*) n FROM '+table).get().n,0,`${table} must start empty`);}finally{db.close();}
  await ui('pi-files-toggle').click();
  await app.evaluate(({dialog},directory)=>{const previous=dialog.showOpenDialog.bind(dialog);dialog.showOpenDialog=async()=>{dialog.showOpenDialog=previous;return {canceled:false,filePaths:[directory]};};},workspace);
  await ui('pi-files-choose').click();await until(snapshot,s=>!!s.workspace,'Directory not authorized');
  await ui('workbench-panel-close').click();check('Directory selection follows original authorization');
  if(readOnly){
    report.scope+=' Read-only mode: approval is explicitly NOT tested.';
    await ui('office-prompt-input').fill('请实际读取已授权工作目录里的教学资料.txt，用一句简短的话概括内容。不需要创建、复制、修改任何文件或记录。');
    await page.getByRole('button',{name:'发送消息',exact:true}).click();await ui('agent-trace').last().waitFor({timeout:30000});
    assert.equal(await ui('agent-trace').last().getAttribute('data-mode'),'live-prose');await shot('real-reading-running');
    const done=await until(snapshot,s=>!s.running,'Read-only provider turn did not finish');const turn=done.projection.turns.at(-1);
    assert.equal(turn.status,'completed');assert(turn.items.some(i=>i.kind==='tool'&&i.status==='completed'),'Actual completed tool required');
    report.realRun={runId:turn.id,elapsedMs:turn.elapsedMs,tools:turn.items.filter(i=>i.kind==='tool').map(i=>({label:i.label,status:i.status}))};
    const trace=ui('agent-trace').last();await until(()=>trace.getAttribute('data-mode'),v=>v==='sealed-disclosure','Trace not sealed');
    assert.equal(await trace.getByTestId('agent-trace-toggle').getAttribute('aria-expanded'),'false');await ui('agent-reply-body').last().waitFor();
    for(const [width,height] of [[1366,768],[1920,1080]])await shot(`real-reading-complete-${width}`,width,height);
    await trace.getByTestId('agent-trace-toggle').click();await trace.getByTestId('agent-trace-content').waitFor();await shot('real-tools-expanded');
    await trace.getByTestId('agent-trace-toggle').click();check('Real read tool streams public process, collapses and displays final answer');
  }
  for(const [decision,target] of readOnly?[]:[['reject','拒绝的草稿.txt'],['approve','确认的草稿.txt']]){
    await ui('office-prompt-input').fill(`这是合成文件的界面验收。请先用一句简短的公开工作说明介绍接下来要做的事，然后读取已授权目录的教学资料.txt，再实际发起复制为${target}的工具操作，等待我确认，不要只说明方法，不要覆盖其他文件。最后简短说明真实结果。`);
    await page.getByRole('button',{name:'发送消息',exact:true}).click();
    await ui('agent-trace').last().waitFor({timeout:30000});
    report.checks.push({name:'Initial real process mode',mode:await ui('agent-trace').last().getAttribute('data-mode')});
    await shot(`running-${decision}`);
    const card=page.locator('[data-testid="pi-copy-approval"][data-state="pending"]').last();
    await card.waitFor({state:'visible',timeout:120000});assert(!fs.existsSync(path.join(workspace,target)));
    const run=(await snapshot()).projection.turns.at(-1);
    report.checks.push({name:'Real run before decision',runId:run.id,kinds:run.items.map(i=>i.kind),status:run.status});
    assert(run.items.some(i=>i.kind==='tool'),'Expected real tool events');
    await card.scrollIntoViewIfNeeded();await shot(`pending-${decision}`);
    await card.getByTestId(`pi-copy-${decision}`).click();
    const complete=await until(snapshot,s=>!s.running,'Provider did not finish after decision');
    assert.equal(complete.projection.turns.at(-1).status,'completed');
    assert(complete.approvals.some(a=>a.target===target&&a.state===(decision==='reject'?'rejected':'executed')));
    if(decision==='reject')assert(!fs.existsSync(path.join(workspace,target)));else assert.deepEqual(fs.readFileSync(path.join(workspace,target)),bytes);
    const trace=ui('agent-trace').last();await until(()=>trace.getAttribute('data-mode'),v=>v==='sealed-disclosure','Trace not sealed');
    await until(()=>trace.getByTestId('agent-trace-toggle').getAttribute('aria-expanded'),v=>v==='false','Trace not collapsed');
    await ui('agent-reply-body').last().waitFor();await shot(`completed-${decision}`);
    await trace.getByTestId('agent-trace-toggle').click();await trace.getByTestId('agent-trace-content').waitFor();
    await shot(`expanded-tools-${decision}`);await trace.getByTestId('agent-trace-toggle').click();
    check(`${decision}: real tool decision, file readback, process collapsed and final body visible`);
  }
  const count=(await snapshot()).projection.turns.length;
  await ui('office-prompt-input').fill('合成界面验收：写一份较长的备课说明，约3000字，不调用工具，不创建文件。');
  await page.getByRole('button',{name:'发送消息',exact:true}).click();
  await until(snapshot,s=>s.running&&s.projection.turns.length>count,'Run never started');
  await page.getByRole('button',{name:'停止本轮',exact:true}).click();
  const stopped=await until(snapshot,s=>!s.running,'Stop not acknowledged');assert.equal(stopped.projection.turns.at(-1).status,'interrupted');check('Actual active run stops through original composer');
  const prior=stopped.approvals,priorSession=session;await app.close();app=undefined;await launch();
  assert.equal(session,priorSession);assert.equal((await snapshot()).projection.threadId,priorSession);assert.deepEqual((await snapshot()).approvals,prior);
  assert.deepEqual(fs.readFileSync(source),bytes);if(!readOnly)assert.deepEqual(fs.readFileSync(path.join(workspace,'确认的草稿.txt')),bytes);
  assert(!fs.existsSync(path.join(workspace,'拒绝的草稿.txt')));check('Cold restart preserves decisions without replaying writes');
  assert.deepEqual(report.errors,[]);assert.deepEqual(fingerprint(path.dirname(path.dirname(main))),before);report.success=true;
}catch(error){report.error=String(error.stack||error).replaceAll(key,'[credential]');process.exitCode=1;await page?.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});}
finally{await app?.close().catch(()=>{});fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({success:report.success,report:path.join(output,'report.json'),error:report.error}));}
