/** PREPARE ONLY. Two targeted routes after parent final build; no model/new chat.
 * node scripts/ui-goal-targeted-cards-live.mjs --run-after-build
 * Copies the existing owned synthetic run. One synthetic student is created by UI
 * solely to enter the guarded analytics route; no learning facts are seeded.
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {_electron as electron} from 'playwright';
import {testMain,assertIsolatedPiMain} from './acceptance/build-root.mjs';
import {fingerprint,sha256} from './acceptance/evidence.mjs';
import {productEntry} from './product-navigation.mjs';
const desktop=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=path.resolve(desktop,'test-results/ui-goal-20261101/chat-live-misconception/run-hJO4Iy');
const sizes=[[1366,768],[1920,1080]], fixtureName='U5卡片验收合成学生_仅本地';
const errorView=error=>({name:error?.name||'Error',frames:String(error?.stack||'').split('\n').slice(1,5).flatMap(line=>{
  const m=line.match(/([^/\\()\s]+\.(?:mjs|cjs|js)):(\d+):(\d+)\)?$/);return m?[{file:m[1],line:+m[2],column:+m[3]}]:[];
})});
function read(data,sql,args=[]){const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});try{return db.prepare(sql).all(...args);}finally{db.close();}}
function counters(data){return read(data,`SELECT (SELECT COUNT(*) FROM xiaozhi_event_runs) runs,
 (SELECT COUNT(*) FROM xiaozhi_event_journal) events,
 (SELECT COUNT(*) FROM xiaozhi_pi_commands) commands,
 (SELECT COUNT(*) FROM xiaozhi_event_journal WHERE json_extract(event_json,'$.kind')='model_request') requests`)[0];}
async function main(){
  const sourceData=path.join(source,'data'),original=fingerprint(sourceData).sha256;
  const originalReport=sha256(fs.readFileSync(path.join(source,'report.json')));
  const answer=JSON.parse(fs.readFileSync(path.join(source,'attachment-answer.json'),'utf8'));
  const {sessionId,runId}=answer;assert(/^[A-Za-z0-9_-]+$/.test(sessionId)&&/^[A-Za-z0-9_-]+$/.test(runId));
  const mainFile=testMain(desktop),build=fingerprint(path.dirname(path.dirname(mainFile))).sha256;
  const base=path.join(desktop,'test-results/ui-goal-20261101/targeted-cards');fs.mkdirSync(base,{recursive:true});
  const output=fs.mkdtempSync(path.join(base,'run-')),data=path.join(output,'data'),profile=path.join(output,'profile');
  fs.cpSync(sourceData,data,{recursive:true,force:false,errorOnExist:true});assert.equal(fingerprint(data).sha256,original);
  const before=counters(data),learningBefore=read(data,'SELECT COUNT(*) n FROM learning_records')[0].n;
  const report={success:false,output,sourceRun:path.basename(source),sessionId,runId,buildSha256:build,
    scriptSha256:sha256(fs.readFileSync(fileURLToPath(import.meta.url))),checks:[],screens:[],styles:[],consoleErrors:[],humanAccepted:false,
    scope:'Two real UI routes only: normal request record and teacher analytics/diagnostics. Copied synthetic data; one UI-created synthetic student; no new learning/model facts.'};
  let app,page,stage='launch';
  const check=name=>{report.checks.push({name,pass:true});console.log('PASS '+name);};
  const env={...process.env};for(const key of Object.keys(env))if(/KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL/i.test(key)||key.startsWith('OMNI_EDU_')||['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL'].includes(key))delete env[key];
  Object.assign(env,{NODE_ENV:'development',OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_E2E_DIALOG_MODE:'1'});
  const privateGuard=async()=>{assert.equal(await page.locator('[data-testid="agent-raw-reasoning"],[data-testid="model-reasoning"]').count(),0);assert.equal(await page.locator('body').locator('details,summary').count(),0,'Main app must not contain native disclosure UI');};
  async function shot(name){await privateGuard();const file=name+'.png';await page.screenshot({path:path.join(output,file),animations:'disabled'});report.screens.push({file,...await page.evaluate(()=>({width:innerWidth,height:innerHeight,devicePixelRatio}))});}
  async function style(name,target){report.styles.push({name,...await target.evaluate(el=>{
    const css=getComputedStyle(el),r=el.getBoundingClientRect();return {rect:{x:r.x,y:r.y,width:r.width,height:r.height},computed:Object.fromEntries(['display','color','background-color','border-radius','font-family','font-size','outline','box-shadow'].map(k=>[k,css.getPropertyValue(k)])),focus:el===document.activeElement,focusVisible:el.matches(':focus-visible')||el.hasAttribute('data-focus-visible')};
  })});}
  async function card(root,label,onOpen=async()=>{}){
    const trigger=root.locator('[data-slot="disclosure-trigger"]');assert.equal(await trigger.count(),1);
    assert.equal(await trigger.locator('xpath=ancestor::*[@data-slot="card"][1]').count(),1,'Disclosure must use the official Card container');
    assert.equal(await trigger.getAttribute('aria-expanded'),'false',label+' starts collapsed');
    for(const [width,height] of sizes){
      await app.evaluate(({BrowserWindow},size)=>BrowserWindow.getAllWindows()[0].setContentSize(...size),[width,height]);
      await page.waitForFunction(([w,h])=>innerWidth===w&&innerHeight===h,[width,height]);
      await trigger.scrollIntoViewIfNeeded();await shot(label+'-collapsed-'+width);
      await trigger.click();assert.equal(await trigger.getAttribute('aria-expanded'),'true');await onOpen();await shot(label+'-expanded-'+width);
      await trigger.click();assert.equal(await trigger.getAttribute('aria-expanded'),'false');
    }
    await trigger.hover();await style(label+'-hover',trigger);
    await trigger.focus();await page.keyboard.press('Shift+Tab');await page.keyboard.press('Tab');
    assert(await trigger.evaluate(el=>el===document.activeElement&&(el.matches(':focus-visible')||el.hasAttribute('data-focus-visible'))),'Actual keyboard focus must reach official trigger');
    await style(label+'-keyboard-focus',trigger);
    await page.keyboard.press('Enter');assert.equal(await trigger.getAttribute('aria-expanded'),'true');
    await page.keyboard.press('Space');assert.equal(await trigger.getAttribute('aria-expanded'),'false');
    check(label+': official Card/Disclosure collapsed-open, dual viewport, hover and keyboard');
  }
  try{
    app=await electron.launch({args:[mainFile,`--user-data-dir=${profile}`],env,timeout:60000});page=await app.firstWindow();
    page.on('pageerror',()=>report.consoleErrors.push({kind:'pageerror'}));page.on('console',m=>{if(m.type()==='error')report.consoleErrors.push({kind:'console.error'});});
    await page.getByTestId('xiaozhi-pi-workspace').waitFor({state:'visible',timeout:60000});report.runtime=await assertIsolatedPiMain(app,mainFile,profile);
    stage='normal-request-card';
    if(await page.locator('.office-composer-container:visible').getAttribute('data-session-id')!==sessionId)await page.locator('[data-testid="edu-navigation"]:visible').getByTestId(`workbench-session-${sessionId}`).click();
    const state=await page.evaluate(async ({sessionId,runId})=>{const s=await window.omniEdu.getXiaozhiSnapshot(sessionId);const t=s.projection.turns.find(t=>t.id===runId);return {running:s.running,completed:t?.status==='completed',requests:t?.modelRequests?.map(r=>({state:r.state,request:r.request,attempt:r.attempt}))||[]};},{sessionId,runId});
    assert(state.completed&&!state.running&&state.requests.length>1&&state.requests.every(r=>r.state==='accepted'),'Actual source must contain multiple normal accepted requests');
    const turn=page.locator(`.office-turn[data-turn-id="${runId}"]:visible`),request=turn.getByTestId('office-model-requests');
    await request.waitFor({state:'visible',timeout:30000});assert.equal(await request.getAttribute('data-state'),'accepted');
    const requestTrigger=request.locator('[data-slot="disclosure-trigger"]');
    assert.equal((await requestTrigger.innerText()).trim(),`模型请求记录（${state.requests.length}）`,'Normal record title must be factual and neutral');
    assert(!/未完成|失败|拒绝|停止|重试/.test(await requestTrigger.innerText()),'Normal accepted requests must not be labeled a failure or retry');
    check('normal multi-request card has neutral title and actual accepted receipts');
    await card(request,'normal-request',async()=>{
      assert.equal(await request.locator('li[data-request]').count(),state.requests.length);
      assert.equal(await request.locator('li[data-state="accepted"]').count(),state.requests.length);
      assert(await request.getByText('HTTP响应不代表任务完成。用量以本轮实际回执为准，缺少回执的计量和费用仍为未知。',{exact:true}).isVisible());
    });
    stage='analytics-route';await productEntry(page,'students').click();await page.getByTestId('student-workbench-layout').waitFor();
    await page.getByTestId('student-create').click();await page.getByTestId('student-profile-form').waitFor();
    await page.getByTestId('student-form-display-name').fill(fixtureName);await page.getByTestId('student-form-grade').fill('八年级');await page.getByTestId('student-form-save').click();
    await page.getByTestId('student-profile-readback').waitFor();
    const created=read(data,'SELECT id FROM students WHERE display_name=?',[fixtureName]);assert.equal(created.length,1,'Synthetic profile must be saved by the actual UI');
    await page.getByTestId('student-row-'+created[0].id).click();await page.getByTestId('student-page-navigation').getByTestId('hub-entry-analytics').click();
    const teacher=page.getByText('教师工作台概览',{exact:true});await teacher.waitFor({state:'visible'});
    const teacherSection=teacher.locator('xpath=ancestor::section[1]'),metrics=teacherSection.locator('.pro-kpi-card');assert.equal(await metrics.count(),4);
    const facts=read(data,`SELECT (SELECT COUNT(*) FROM students WHERE status='active') students,
      (SELECT COUNT(*) FROM learning_records) records,(SELECT COUNT(*) FROM review_reports) reports,(SELECT COUNT(*) FROM attachments) attachments`)[0];
    const expected=[['在读学生',facts.students],['学习记录',facts.records],['复盘报告',facts.reports],['附件数量',facts.attachments]];
    for(let i=0;i<expected.length;i++){assert.equal(await metrics.nth(i).locator('.pro-kpi-head > span').innerText(),expected[i][0]);assert.equal(await metrics.nth(i).locator(':scope > strong').innerText(),String(expected[i][1]));}
    const diagnostic=page.getByTestId('analytics-runtime-diagnostics');assert.equal(await diagnostic.locator('[data-slot="disclosure-trigger"]').getAttribute('aria-expanded'),'false');
    const hidden=await diagnostic.locator('[data-slot="disclosure-content"]').evaluate(el=>{const css=getComputedStyle(el);return {ariaHidden:el.getAttribute('aria-hidden'),height:el.getBoundingClientRect().height,display:css.display,visibility:css.visibility,contentVisibility:css.contentVisibility};});
    assert.equal(hidden.ariaHidden,'true','Operational diagnostics must be semantically hidden on first screen');
    assert(hidden.height<1||hidden.display==='none'||hidden.visibility==='hidden'||hidden.contentVisibility==='hidden','Operational diagnostics must be visually collapsed, not merely clipped child isVisible heuristics');
    const hierarchy=await teacherSection.evaluate(el=>{const a=el.getBoundingClientRect(),b=document.querySelector('[data-testid="analytics-runtime-diagnostics"]').getBoundingClientRect();return {teacherBottom:a.bottom,diagnosticsTop:b.top};});
    assert(hierarchy.teacherBottom<=hierarchy.diagnosticsTop+2,'Teacher aggregates must precede operational diagnostics');report.teacherHierarchy=hierarchy;report.localAggregates=facts;
    check('teacher aggregates precede collapsed diagnostics and match real local SQLite');
    await card(diagnostic,'teacher-diagnostics',async()=>{assert(await page.getByTestId('ai-observability-workspace').isVisible());});
    assert.equal(read(data,'SELECT COUNT(*) n FROM learning_records')[0].n,learningBefore,'No learning facts or academic statistics may be synthesized');
    assert.deepEqual(counters(data),before,'Targeted navigation must create no chat run, command, event or model request');
    assert.deepEqual(report.consoleErrors,[]);check('no new model/chat work, no learning records and no console errors');
    await app.close();app=undefined;assert.deepEqual(counters(data),before);
    assert.equal(fingerprint(sourceData).sha256,original);assert.equal(sha256(fs.readFileSync(path.join(source,'report.json'))),originalReport);
    assert.equal(fingerprint(path.dirname(path.dirname(mainFile))).sha256,build);check('original evidence and formal build unchanged');report.success=true;
  }catch(error){report.error={stage,...errorView(error)};process.exitCode=1;if(page&&!page.isClosed())try{await shot('failure');}catch{report.failureScreenshot='withheld by privacy guard';}}
  finally{await app?.close().catch(()=>{});report.originalUnchanged=fingerprint(sourceData).sha256===original;fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({success:report.success,checks:report.checks.length,output,error:report.error}));}
}
if(process.argv.includes('--run-after-build'))await main();
else console.log(JSON.stringify({preparedOnly:true,source,usage:'node scripts/ui-goal-targeted-cards-live.mjs --run-after-build',routes:['actual completed chat normal request record','student page navigation analytics'],modelCalls:0}));
