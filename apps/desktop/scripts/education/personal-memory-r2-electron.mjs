import {captureTeacherAction, sizeTeacherJourney} from '../acceptance/teacher-journey-viewport.mjs';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { performance } from 'node:perf_hooks';
import { arch, cpus, release, totalmem } from 'node:os';
import { setTimeout as wait } from 'node:timers/promises';
import { _electron as electron } from 'playwright';
import { testMain, assertIsolatedPiMain } from '../acceptance/build-root.mjs';

const baselineIndex=process.argv.indexOf('--baseline-desktop');
const desktop=baselineIndex<0?path.resolve(import.meta.dirname,'../..'):fs.realpathSync(process.argv[baselineIndex+1]);
const sourceSha=execFileSync('git',['rev-parse','HEAD'],{cwd:desktop,encoding:'utf8'}).trim();
if(baselineIndex>=0)assert.equal(sourceSha,'ca2a51425619dc14412508839e0799338567c399');
const prepareClassPreference=process.argv.includes('--prepare-class-preference');
const evidence = process.env.OMNI_EDU_ACCEPTANCE_ROOT;
const modelKey = process.env.DEEPSEEK_API_KEY;
assert(evidence && modelKey,'Isolated evidence directory and configured DeepSeek are required');
const rejection=process.argv.includes('--reject');
const adoption=prepareClassPreference||rejection||process.argv.includes('--adoption');
const verifyClass=prepareClassPreference||process.argv.includes('--class-scope');
let classFolders;
const verifyUse=process.argv.includes('--use');
const verifyPending=process.argv.includes('--pending');
assert(!(rejection&&verifyPending),'The explicit rejection journey uses the existing settings review');
const cancelJob=process.argv.includes('--cancel-job');
const measureLatency=process.argv.includes('--latency');
const workerUnavailable=process.argv.includes('--worker-unavailable');
const handout=process.argv.includes('--handout');
if(adoption)assert(process.env.OMNI_EDU_R2_PYTHON,'The installed local memory worker interpreter is required');
const main = testMain(desktop);
const root = fs.mkdtempSync(path.join(evidence,workerUnavailable?'r2-worker-unavailable-electron-':cancelJob?'r2-cancel-electron-':
  measureLatency?'r2-latency-electron-':rejection?'r2-reject-electron-':adoption?'r2-adoption-electron-'
  :handout?'r2-handout-electron-':'r2-fast-path-electron-'));
const data = path.join(root,'data');
const profile = path.join(root,'profile');
const sha256 = createHash('sha256').update(fs.readFileSync(main)).digest('hex');
const report = { model:'deepseek-flash', modelRequests:[], checks:[], main, root, sha256, sourceSha };
const prefix = 'xiaozhi.teacher-preference.v1';
let app, page, settingsPage;

async function until(read, timeout=90000, interval=140) {
  const stop=Date.now()+timeout;
  while(Date.now()<stop){
    const value=await read();
    if(value)return value;
    await wait(interval);
  }
  throw Error('The Electron action did not reach the expected state');
}

async function launch() {
  const env={...process.env,OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),
    OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_E2E_DIALOG_MODE:'1',OMNI_EDU_SKIP_DOTENV:'1',
    DEEPSEEK_MODEL:report.model,DEEPSEEK_API_KEY:modelKey};
  for(const key of ['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL','OMNI_EDU_HISTORY_LOOPBACK','OMNI_EDU_HISTORY_TOKEN'])delete env[key];
  if(workerUnavailable)delete env.OMNI_EDU_R2_PYTHON;
  app=await electron.launch({executablePath:path.join(desktop,'node_modules/electron/dist/electron.exe'),args:[main,'--user-data-dir='+profile],env,cwd:desktop,timeout:60000});
  const launchExit={exited:false};
  (report.launches??=[]).push(launchExit);
  app.process().once('exit',(code,signal)=>Object.assign(launchExit,{exited:true,code,signal}));
  await app.evaluate(({net})=>{
    const fetch=net.fetch.bind(net);
    globalThis.r2Wire=[];
    net.fetch=async (input,init)=>{
      const url=new URL(typeof input==='string'?input:input.url);
      if(url.hostname!=='api.deepseek.com'||!url.pathname.endsWith('/chat/completions'))return fetch(input,init);
      if(globalThis.r2Wire.length>=8)throw Error('R2 fast-path run request cap reached');
      const body=JSON.parse(init.body);
      const strings=body.messages.map(m=>typeof m.content==='string'?m.content:Array.isArray(m.content)?m.content.map(c=>c.text).join(' '):'');
      const preference=strings.filter(text=>text.includes('当前教师表达偏好')||text.includes('[教师偏好操作结果]'));
      const personalItems=strings.filter(text=>text.includes('"teacher_confirmed"')).map(text=>text.slice(0,2500));
      const projectedPersonal = strings.flatMap((text,index) => body.messages[index].role === 'user'
        ? [...text.matchAll(/\{"layer":"personal","source":"personal","id":"([a-f0-9]{64})","version":(\d+)\}/g)]
          .map(match=>({id:match[1],version:Number(match[2])})) : []);
      const row={model:body.model,status:0,preference,personalItems,projectedPersonal,startedAt:new Date().toISOString()};
      globalThis.r2Wire.push(row);
      const started=performance.now();
      const response=await fetch(input,init);
      row.status=response.status;
      void response.clone().text().then(output=>{
        for(const line of output.split('\n').filter(v=>v.startsWith('data: {'))){
          const json=JSON.parse(line.slice(6));
          if(json.usage)row.usage=json.usage;
        }
        row.elapsedMs=Math.round(performance.now()-started);
      }).catch(()=>{});
      return response;
    };
  });
  page=await app.firstWindow();
  await sizeTeacherJourney(page);
  await page.getByTestId('office-prompt-input').waitFor();
  await assertIsolatedPiMain(app,main,profile);
}

function currentHead(){
  const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});
  try {
    const row=db.prepare('SELECT value_json FROM app_settings WHERE key=?').get(prefix+':head');
    return row?JSON.parse(row.value_json):null;
  }finally{db.close();}
}

function currentPreference() {
  const head=currentHead();
  const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});
  try{
    const row=db.prepare('SELECT value_json FROM app_settings WHERE key=?').get(prefix+':version:'+head?.revision);
    return row?JSON.parse(row.value_json):null;
  }finally{db.close();}
}

const snapshot=id=>page.evaluate(id=>window.omniEdu.getXiaozhiSnapshot(id),id);
const session=()=>page.locator('.office-composer-container').getAttribute('data-session-id');
const active=()=>until(async()=>{const id=await session();return id?.startsWith('aisession_')?id:null;});
const input=()=>page.getByTestId('office-prompt-input');
const wire=()=>app.evaluate(()=>globalThis.r2Wire);
async function send(text,{answer}={}){
  const id=await active();
  const prior=(await snapshot(id)).projection.turns.at(-1)?.id;
  await input().fill(text);
  await page.getByRole('button',{name:'发送消息',exact:true}).click();
  let answered;
  const turn=await until(async()=>{
    const value=await snapshot(id);
    const current=value.projection.turns.at(-1);
    if(current?.id===prior)return null;
    const request=value.controls?.find(item=>item.kind==='question'&&item.state==='pending'&&item.runId===current?.id);
    if(answer&&request&&!answered){
      const panel=page.getByTestId('pi-composer-pending-panel').locator(`[data-control-id="${request.id}"]`);
      await panel.getByTestId('pi-question-answer').fill(answer);
      await panel.getByTestId('pi-question-submit').click();
      answered=request.id;
    }
    return !value.running&&['completed','failed','interrupted'].includes(current?.status)?current:null;
  });
  assert.equal(turn.status,'completed',turn.error);
  if(answered){
    assert.equal((await snapshot(id)).controls?.find(item=>item.id===answered)?.state,'answered');
    report.teacherAnswer={runId:turn.id,controlId:answered};
  }
  return turn;
}
async function fresh(){
  const old=await active();
  await page.getByTestId('pi-new-session').click();
  await until(async()=>{const id=await session();return id?.startsWith('aisession_')&&id!==old?id:null;});
}
function check(name,value){
  report.checks.push({name,value});
  console.log('PASS '+name);
}
async function close(){
  report.modelRequests.push(...await wire());
  await app.close();
  app=undefined;
  settingsPage=undefined;
}
async function fastPath(){
  assert.equal(currentHead(),null);
  const explicit='请记住，以后讲解先提示再给答案。请简单确认。';
  const initial=await send(explicit);
  const head=currentHead();
  assert(head?.revision===1);
  const actualAfterSave=(await wire()).flatMap(r=>r.preference);
  assert(actualAfterSave.some(message=>message.includes('宿主已保存本次明确的长期表达偏好')));
  check('Pi receives the host save receipt after the durable preference is committed',{revision:head.revision,runId:initial.id});
  await fresh();
  const before=(await wire()).length;
  const follow=await send('请讲解为什么凸透镜能在纸上形成太阳的像。');
  assert((await wire()).slice(before).some(r=>r.preference.some(message=>message.includes('先给提示，再给答案'))));
  await captureTeacherAction(page,page.getByTestId('office-prompt-input'),root,'after-cross-session-use',report);
  check('a separate teaching conversation receives the committed preference',{runId:follow.id});
  await fresh();
  const narrow=await send('以后高一三班的讲义优先用表格并先给答案。请简单回应。');
  assert.deepEqual(currentHead(),head);
  const reply=narrow.items.filter(i=>i.role==='assistant').map(i=>i.text??'').join('\n');
  assert(!/已(?:经)?(?:记住|保存|记录)/.test(reply),'The assistant claimed a scoped preference was persisted');
  check('a class-specific request does not alter the app-wide SQLite head',{runId:narrow.id,revision:head.revision,response:reply});
  await send('请撤销上次记住的教学偏好。');
  const after=currentHead();
  assert(after?.revision>head.revision);
  await close();
  await launch();
  assert.deepEqual(currentHead(),after);
  check('the explicit rollback persists across a fresh Electron process',{revision:after.revision});
}

function sectionTitle(line) {
  return line.trim().replace(/^#{1,6}\s+/, '').replace(/^(?:\*\*|__)(.*)(?:\*\*|__)$/, '$1')
    .replace(/^[一二三四五六七八九十\d]+[、.．]\s*/, '').replace(/[：:]$/, '').trim();
}

function verifyHandoutLayout(text) {
  // Compare section headings. A sentence after the answers may also mention exercises.
  const lines = text.split(/\r?\n/);
  const headings = lines.map(sectionTitle);
  const exercise = headings.findLastIndex(title => /^(?:随堂|课堂|巩固|课后|小)?练习(?:题|小节)?$/.test(title));
  const answers = headings.indexOf('参考答案');
  assert(exercise >= 0 && answers > exercise && headings.lastIndexOf('参考答案') === answers, text);
  const numbered = lines => lines.filter(line => /^\s*\d+[.、．)）]\s*\S/.test(line));
  assert.equal(numbered(lines.slice(exercise+1, answers)).length, 2, text);
  assert.equal(numbered(lines.slice(answers+1)).length, 2, text);
}

async function handoutPreference(){
  const requirement='以后我的讲义答案统一放最后。';
  const taught=await send(requirement);
  const head=currentHead();
  assert.equal(head.revision,1);
  const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});
  try{
    const {value_json:raw}=db.prepare('SELECT value_json FROM app_settings WHERE key=?').get(prefix+':version:'+head.revision);
    const saved=JSON.parse(raw);
    assert.equal(saved.values.handoutAnswerPlacement,'at_end');
    assert.equal(saved.evidence.runId,taught.id);
    assert.equal(head.sha256,createHash('sha256').update(raw).digest('hex'));
    const original=db.prepare('SELECT role,content FROM ai_conversation_messages WHERE id=?').get(saved.evidence.messageId);
    assert.equal(original.role,'user');
    assert.equal(original.content,requirement);
    assert.equal(saved.evidence.sha256,createHash('sha256').update(original.content).digest('hex'));
  } finally{db.close();}
  assert((await wire()).some(row=>row.preference.some(text=>text.includes('宿主已保存本次明确的长期表达偏好'))));
  check('the handout layout is saved immediately with the original teacher message and revision',{revision:head.revision,runId:taught.id});

  await fresh();
  let offset=(await wire()).length;
  const applied=await send('请制作一份关于光的反射的科学小讲义。练习小节列两道短题，答案小节标题为参考答案。本次仅在对话用短文本给出，不需要导出。');
  const appliedWire=(await wire()).slice(offset).flatMap(row=>row.preference);
  assert(appliedWire.some(text=>text.includes('将答案集中放在讲义末尾')));
  const appliedText=applied.items.filter(item=>item.role==='assistant').map(item=>item.text??'').join('\n');
  verifyHandoutLayout(appliedText);
  check('a new handout receives the saved layout and places its answer section after the exercises',{runId:applied.id});

  offset=(await wire()).length;
  const student=await send('这次重新制作小讲义，只做学生版，不要答案。只在此对话给出两道练习，不需要导出。');
  assert(!(await wire()).slice(offset).flatMap(row=>row.preference).some(text=>text.includes('将答案集中放在讲义末尾')));
  assert.deepEqual(currentHead(),head);
  const studentText=student.items.filter(item=>item.role==='assistant').map(item=>item.text??'').join('\n');
  assert(!studentText.split(/\r?\n/).map(sectionTitle).some(title => /^(?:参考)?答案$/.test(title)),studentText);
  await close();
  await launch();
  assert.deepEqual(currentHead(),head);
  check('the student-only request leaves the long-term version unchanged across restart',{runId:student.id,revision:head.revision});

  await fresh();
  const nextSession=await active();
  const callsBefore=(await wire()).length;
  const next=await send('制作一份声音传播的科学小讲义。练习小节列两道短题，答案小节标题为参考答案。只在对话里给出，不导出。');
  assert((await wire()).slice(callsBefore).some(row=>row.status===200 && row.preference.some(text=>text.includes('将答案集中放在讲义末尾'))));
  const nextText=next.items.filter(item=>item.role==='assistant').map(item=>item.text??'').join('\n');
  verifyHandoutLayout(nextText);
  assert.deepEqual(currentHead(),head);
  const readback=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});
  try{
    const replies=readback.prepare("SELECT content FROM ai_conversation_messages WHERE session_id=? AND role='assistant' AND json_extract(metadata_json,'$.agentRunId')=?").all(nextSession,next.id);
    assert(replies.some(row=>row.content.trim()===nextText.trim()));
  }finally{readback.close();}
  check('A fresh task after cold restart applies the original answer layout and its persisted reply matches the actual output',
    {sessionId:nextSession,runId:next.id,revision:head.revision,text:nextText});
}

async function openSettings() {
  if(!settingsPage||settingsPage.isClosed()) {
    const opened=app.waitForEvent('window');
    await page.getByRole('button',{name:'设置',exact:true}).click();
    settingsPage=await opened;
    await settingsPage.getByTestId('pi-settings-workspace').waitFor();
    assert(settingsPage.url().endsWith('/settings.html'));
  }
  return settingsPage;
}

async function returnToConversation() {
  if(settingsPage&&!settingsPage.isClosed()){
    const closed=settingsPage.waitForEvent('close');
    await settingsPage.getByTestId('settings-window-close').click();
    await closed;
  }
  settingsPage=undefined;
  await input().waitFor();
}

async function memorySettings(){
  const settings=await openSettings();
  await settings.getByTestId('pi-settings-tab-teacher-memory').click();
  const memory=settings.getByTestId('pi-personal-memory-settings');
  const heading=memory.getByRole('button',{name:'自动记忆',exact:true});
  if(await heading.getAttribute('aria-expanded')!=='true')await heading.click();
  await memory.getByTestId('personal-memory-auto').waitFor();
  return memory;
}

const memoryRead = async()=> {
  const view=await (settingsPage??page).evaluate(()=>window.omniEdu.personalMemory.view());
  assert(view.ok,JSON.stringify(view));
  return view.value;
};

function latestBackgroundJob(){
  const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});
  try{return db.prepare(`SELECT id,status,error_message,result_json,json_extract(payload_json,'$.dispatch') AS dispatch
    FROM ai_tasks WHERE task_type='personal_memory' ORDER BY created_at DESC LIMIT 1`).get();}
  finally{db.close();}
}

function backgroundReceipt(){
    const row=latestBackgroundJob();
    if(!row||row.status==='pending'||row.status==='running')return null;
    assert.equal(row.status,'succeeded',row.error_message);
    const result=JSON.parse(row.result_json);
    assert(result.modelCalls>=1 && result.modelCalls<=2);
    assert.equal(result.saved,1);
    return result;
}

async function verifyJobCancellation(memory) {
  const running=await until(()=>{
    if(app.process().exitCode!==null)throw Error('Electron exited before the worker reached dispatch.');
    const job=latestBackgroundJob();
    if(job?.status==='running'&&job.dispatch)return job;
    if(job&&!['pending','running'].includes(job.status))throw Error('Background job completed before cancellation was requested.');
    return null;
  },180000,150);
  await memory.getByRole('button',{name:'刷新记忆',exact:true}).click();
  await memory.getByRole('button',{name:'后台任务',exact:true}).click();
  await memory.getByTestId('personal-memory-cancel-'+running.id).click({timeout:12000});
  const feedback=memory.getByTestId('personal-memory-feedback');
  await feedback.waitFor({timeout:15000});
  const message=await feedback.textContent();
  assert.match(message,/^已取消此任务。.*后续结果不会保存/);
  await until(()=>latestBackgroundJob()?.status==='cancelled');
  assert.deepEqual((await memoryRead()).candidates,[]);
  check('the teacher cancels an active real worker from the settings page',{jobId:running.id,message});
  await close();
  await launch();
  assert.equal(latestBackgroundJob()?.status,'cancelled');
  assert.deepEqual((await memoryRead()).candidates,[]);
  check('the cancelled job and no candidate persist after a real cold restart',{jobId:running.id});
}

async function measureWhileProcessing() {
  const pressKey=async(samples,activeExpected)=>{
    for(let i=0;i<50;i++){
      const activeBefore=latestBackgroundJob()?.status==='running';
      const begin=performance.now();
      await input().press('x');
      const current=await input().inputValue();
      const ms=performance.now()-begin;
      const activeAfter=latestBackgroundJob()?.status==='running';
      assert.equal(current.length,samples.length+1);
      samples.push({ms,activeBefore,activeAfter});
      assert.equal(activeBefore,activeExpected,'Worker state before the input did not match the sample group.');
      assert.equal(activeAfter,activeExpected,'Worker state changed while this input was being measured.');
    }
  };
  report.latency={idle:[],running:[],hardware:{cpu:cpus()[0]?.model,threads:cpus().length,ramBytes:totalmem(),os:release(),arch:arch()},
    metric:'Playwright key press to rendered value readback; includes driver latency'};
  await returnToConversation();
  await input().fill('');
  await pressKey(report.latency.idle,false);
  await input().fill('');
  await until(()=>{
    const job=latestBackgroundJob();
    if(job?.status==='running'&&job.dispatch)return job;
    if(job&&!['pending','running'].includes(job.status))throw Error('Background job ended before foreground latency capture.');
    return null;
  },180000,40);
  await pressKey(report.latency.running,true);
  const p95=values=>[...values].sort((a,b)=>a.ms-b.ms)[Math.ceil(values.length*0.95)-1].ms;
  const idleP95=p95(report.latency.idle),runningP95=p95(report.latency.running);
  report.latency.percentile={idleP95,runningP95};
  report.background=await until(backgroundReceipt,130000,125);
  assert(idleP95<=200 && runningP95<=200,JSON.stringify(report.latency.percentile));
  check('100 real composer inputs meet the local P95 threshold in idle and dispatched worker windows',{idleP95,runningP95});
}

async function verifyUnavailableWorker() {
  let memory=await memorySettings();
  await memory.getByTestId('personal-memory-auto').click();
  await memory.getByText('自动记忆组件暂不可用。仍可查看和管理已有记忆。',{exact:true}).waitFor();
  assert.equal((await memoryRead()).workerAvailable,false);
  check('missing worker is visible with automatic processing enabled',{workerAvailable:false});
  await returnToConversation();
  await send('请记住，以后讲解先提示再给答案。');
  assert.equal(currentPreference().values.answerOrder,'hint_first');
  await close();
  await launch();
  memory=await memorySettings();
  await memory.getByText('自动记忆组件暂不可用。仍可查看和管理已有记忆。',{exact:true}).waitFor();
  assert.equal(currentPreference().values.answerOrder,'hint_first');
  check('original explicit saving remains available and persists without the new worker',{revision:currentHead().revision});
}

async function openSessionMemory() {
  const settings=await openSettings();
  await settings.getByTestId('pi-settings-tab-permissions').click();
  const panel=settings.getByTestId('pi-settings-main').getByTestId('pi-memory-scope');
  if(!await panel.getByTestId('pi-memory-enabled').isVisible())await panel.locator('[data-slot="chat-tool-trigger"]').click();
  return panel;
}

// Create and move synthetic sessions via public workspace operations. Only visible controls confirm memory use.
async function confirmClass(sessionId,folderId,season) {
  await page.evaluate(([session,folder])=>window.omniEdu.moveAiConversationSession(session,folder),[sessionId,folderId]);
  const panel=await openSessionMemory();
  await panel.getByRole('button',{name:'本会话的班级和学期'}).click();
  await panel.getByLabel('学期年份',{exact:true}).fill('2026');
  await panel.getByLabel('学期',{exact:true}).selectOption(season);
  await panel.getByTestId('pi-memory-confirm-class').click();
  await panel.getByText('已确认班级和学期，可重新选择本会话的记忆。',{exact:true}).waitFor();
  await until(async()=>{const scope=(await snapshot(sessionId)).memoryScope;
    return scope.teachingTarget?.folderId===folderId&&scope.teachingTarget.term==='2026-'+season;});
  return panel;
}

async function useAdoptedMemory(record,source){
  await returnToConversation();
  await fresh();
  const sessionId=await active();
  let panel;
  if (verifyClass) {
    for (const [folder,season] of [[classFolders[1],'fall'],[classFolders[0],'spring']]) {
      panel=await confirmClass(sessionId,folder,season);
      await panel.getByTestId('pi-memory-source').selectOption({label:'教师确认的记忆'});
      await panel.getByTestId('pi-personal-memory-catalog').getByText('暂无可选的教师记忆。').waitFor();
      assert.equal(await panel.getByTestId('pi-memory-select-'+record.id).count(),0);
      await returnToConversation();
    }
    panel=await confirmClass(sessionId,classFolders[0],'fall');
    check('another class and another term reveal no confirmed source in the session picker',{sessionId,checks:2});
  } else panel=await openSessionMemory();
  await panel.getByTestId('pi-memory-source').selectOption({label:'教师确认的记忆'});
  await panel.getByTestId('pi-memory-select-'+record.id).check();
  await panel.getByTestId('pi-memory-enabled').check();
  await panel.getByTestId('pi-memory-save').click();
  await until(async()=> {
    const settings=(await snapshot(sessionId)).memoryScope;
    return settings.enabled && settings.selections.some(item=>item.id===record.id && item.version===1 && item.state==='ready');
  });
  await returnToConversation();
  const offset=(await wire()).length;
  const follow=await send('请先调用 read_education_memory 读取本会话已选任教自述，再说明我负责哪一年级的哪门课程。');
  const requests=(await wire()).slice(offset);
  assert.deepEqual(requests[0].projectedPersonal,[{id:record.id,version:record.revision}]);
  assert.deepEqual(requests[0].personalItems,[]);
  const delivered=requests.flatMap(row=>row.personalItems);
  assert(delivered.some(text=>text.includes('四年级科学')&&text.includes(record.sourceVersion)));
  const outcome=follow.items.filter(item=>item.role==='assistant').map(item=>item.text??'').join('\n');
  assert(outcome.includes('四年级')&&outcome.includes('科学'),outcome);
  check('the chosen formal revision is read via the existing Pi memory tool and reaches the real model',
    {runId:follow.id,id:record.id,sourceContainsFact:source.includes('四年级科学')});
  return sessionId;
}

async function reviewInConversation(sessionId,candidateId,draft,source){
  const open=()=>page.getByTestId('personal-memory-review-open');
  const pending=()=>page.getByTestId('pi-composer-pending-panel').getByTestId('personal-memory-conversation-review');
  const candidate=()=>pending().getByTestId('personal-memory-candidate-'+candidateId);
  const review=await page.evaluate(key=>window.omniEdu.personalMemory.preview({key,revision:1}),candidateId);
  assert(review.ok && source.includes(review.value.quote) && review.value.quote.includes(prepareClassPreference?'验算':'四年级科学'));
  for (const [width,height] of [[1366,768],[1920,1080]]) {
    await app.evaluate(({BrowserWindow},size)=>{
      const window=BrowserWindow.getAllWindows().find(win=>win.isVisible());
      window.unmaximize();
      window.setContentSize(...size);
    },[width,height]);
    await until(async()=>page.evaluate(([w,h])=>innerWidth===w&&innerHeight===h,[width,height]),10000);
    await open().click();
    await candidate().getByRole('button',{name:'查看来源',exact:true}).click();
    await candidate().getByTestId('personal-memory-reviewed-quote').waitFor();
  assert.equal(await candidate().getByTestId('personal-memory-reviewed-quote').textContent(),review.value.quote);
    assert.equal(await input().inputValue(),draft);
    await page.screenshot({path:path.join(root,`conversation-review-${width}x${height}.png`)});
    await pending().getByRole('button',{name:'关闭核对',exact:true}).click();
    await pending().waitFor({state:'hidden'});
    assert(await open().evaluate(element=>element===document.activeElement));
  }
  await fresh();
  await open().click();
  await pending().getByText('暂无待核对的建议。',{exact:true}).waitFor();
  await close();
  await launch();
  if(await active()!==sessionId){
    const toggle=page.getByTestId('pi-sidebar-toggle');
    if(await toggle.getAttribute('aria-expanded')!=='true')await toggle.click();
    await page.getByTestId('ai-conversation-session-'+sessionId).click();
    await until(async()=>await session()===sessionId);
  }
  await open().click();
  await candidate().getByRole('button',{name:'查看来源',exact:true}).click();
  await candidate().getByTestId('personal-memory-reviewed-quote').waitFor();
  assert.equal(await candidate().getByTestId('personal-memory-reviewed-quote').textContent(),review.value.quote);
  assert.equal(await input().inputValue(),draft);
  await candidate().getByRole('button',{name:'确认采用',exact:true}).click();
  await pending().getByText('已保存为正式记忆。',{exact:true}).waitFor();
  check('the existing pending panel isolates sessions and resumes source review after restart, keeping the draft',
    {sessionId,candidateId,windowContentSizes:[[1366,768],[1920,1080]],restoredDraft:true});
}

async function candidateAdoption(){
  const sessionId=await active();
  if (verifyClass) {
    classFolders=await page.evaluate(async names=>{
      const folders=[];
      for (const name of names) {
        const workspace=await window.omniEdu.createAiConversationFolder({name});
        folders.push(workspace.folders.find(row=>row.name===name).id);
      }
      return folders;
    },prepareClassPreference?['B 班','A 班']:['物理一班（合成）','物理二班（合成）']);
    await confirmClass(sessionId,classFolders[0],'fall');
    await returnToConversation();
  }
  const source=prepareClassPreference?'我在 B 班这学期的数学练习中习惯让学生用读题、列式、验算三个小标题分步写解法。':'我本学期负责四年级科学。';
  const turn=await send(source,{answer:prepareClassPreference?'这是本学期 B 班数学练习的习惯。这一步只核对原话。':'请简短确认这条四年级科学任教记录。这一步只确认原话，不替我采用记忆建议。'});
  let memory=await memorySettings();
  const auto=memory.getByTestId('personal-memory-auto');
  await auto.click();
  await memory.getByText('已开启自动处理。',{exact:true}).waitFor();
  const history=settingsPage.getByRole('region',{name:'可参考的历史'});
  await history.getByTestId('history-settings-session').selectOption(sessionId);
  const database=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});
  let originalId;
  try{
    originalId=database.prepare("SELECT id FROM ai_conversation_messages WHERE session_id=? AND role='user' AND content=?").get(sessionId,source)?.id;
  }finally{database.close();}
  assert(originalId);
  await history.getByTestId('history-settings-source-'+originalId).getByRole('button',{name:'查看来源',exact:true}).click();
  const sourcePreview=history.getByTestId('history-settings-preview');
  assert((await sourcePreview.textContent()).includes(source));
  if(verifyClass) assert(await sourcePreview.getByRole('checkbox',{name:/仅用于此来源会话已确认的班级和学期/}).isChecked());
  await sourcePreview.getByTestId('personal-memory-source-consent').click();
  await sourcePreview.getByText('已允许从这条原话提取记忆建议。',{exact:true}).waitFor();
  assert.equal((await memoryRead()).workerAvailable,true);
  if(cancelJob)return verifyJobCancellation(memory);
  if(measureLatency)return measureWhileProcessing();
  const draft='这段是尚未发送的新任务草稿。';
  if(verifyPending){
    await returnToConversation();
    await input().fill(draft);
    assert(await input().evaluate(element=>element===document.activeElement));
  }
  const background=await until(backgroundReceipt,210000,1000);
  report.background=background;
  const {candidates,records}=await memoryRead();
  assert.deepEqual(records,[]);
  assert.equal(candidates.length,1);
  const candidateId=candidates[0].key;
  check('real Pi source, separate teacher extraction consent and a durable real model job create a pending candidate',
    {runId:turn.id,candidateId,modelCalls:background.modelCalls,usage:background.usage});
  if(verifyPending){
    assert(await input().evaluate(element=>element===document.activeElement));
    assert(!await page.getByTestId('personal-memory-conversation-review').isVisible());
    check('background completion does not open a panel or move focus from the unsent draft',{candidateId});
    await reviewInConversation(sessionId,candidateId,draft,source);
    memory=await memorySettings();
  }
  await memory.getByRole('button',{name:'刷新记忆',exact:true}).click();
  if(process.argv.includes('--jobs')){
    await memory.getByRole('button',{name:'后台任务',exact:true}).click();
    await memory.getByText('提取建议 · 已完成 · 已生成 1 条建议',{exact:true}).waitFor();
    check('the settings page reads the durable background task result',{saved:background.saved,modelCalls:background.modelCalls});
  }
  if(!verifyPending){
    const candidate=memory.getByTestId('personal-memory-candidate-'+candidateId);
    await candidate.getByRole('button',{name:'查看来源',exact:true}).click();
    const review=await settingsPage.evaluate(key=>window.omniEdu.personalMemory.preview({key,revision:1}),candidateId);
    assert(review.ok && source.includes(review.value.quote) && review.value.quote.includes(prepareClassPreference?'验算':'四年级科学'));
    await candidate.getByTestId('personal-memory-reviewed-quote').waitFor();
    assert.equal(await candidate.getByTestId('personal-memory-reviewed-quote').textContent(),review.value.quote);
    await settingsPage.screenshot({path:path.join(root,'review-candidate.png')});
    if(rejection){
      assert.deepEqual((await memoryRead()).records,[]);
      check('Opening and inspecting a candidate does not grant or promote memory',{candidateId});
      await candidate.getByRole('button',{name:'拒绝',exact:true}).click();
      await memory.getByText('已拒绝建议。',{exact:true}).waitFor();
      await close();
      await launch();
      await memorySettings();
      const after=await memoryRead();
      assert.deepEqual(after.records,[]);
      assert.deepEqual(after.candidates,[]);
      const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});
      try{
        const row=db.prepare('SELECT state,revision FROM personal_memory_pending WHERE draft_key=?').get(candidateId);
        assert.equal(row?.state,'rejected');
        assert.equal(row?.revision,2);
      }finally{db.close();}
      check('Explicit rejection persists after cold restart without creating a formal memory',{candidateId});
      return;
    }
    await candidate.getByRole('button',{name:'确认采用',exact:true}).click();
    await memory.getByText('已保存为正式记忆。',{exact:true}).waitFor();
  }
  const adopted=(await memoryRead()).records[0];
  assert.equal(adopted.id,candidateId);
  if(verifyClass){assert.deepEqual(adopted.scope,{kind:'class',id:classFolders[0]});assert.equal(adopted.term,'2026-fall');}
  assert.equal(adopted.revision,1);
  assert.equal(adopted.sourceCurrent,true);
  check('the teacher reviews a real source and adopts a formal memory through typed preload',{id:adopted.id,revision:adopted.revision});
  if(prepareClassPreference){
    assert.equal(adopted.kind,'preference');
    assert(adopted.value.includes('验算'));
    report.classPreference={sessionId,source,folder:classFolders[0],id:adopted.id,revision:adopted.revision,
      term:adopted.term,value:adopted.value,sourceVersion:adopted.sourceVersion};
    return;
  }
  let useSession;
  if(verifyUse){
    useSession=await useAdoptedMemory(adopted,source);
    memory=await memorySettings();
  }

  const record=memory.getByTestId('personal-memory-record-'+adopted.id);
  await record.getByRole('button',{name:'修订',exact:true}).click();
  const privateEdit='学生姓名：合成丙，成绩 92 分。';
  await record.getByLabel('修订内容',{exact:true}).fill(privateEdit);
  await record.getByRole('button',{name:'保存修订',exact:true}).click();
  await memory.getByRole('alert').filter({hasText:'个人记忆不能保存学生个人记录或凭据'}).waitFor();
  const stored=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});
  try{
    const rows=stored.prepare('SELECT value,revision FROM personal_memory_versions WHERE memory_id=? ORDER BY revision').all(adopted.id);
    assert.deepEqual(rows.map(row=>[row.revision,row.value]),[[adopted.revision,adopted.value]]);
  }finally{stored.close();}
  check('An identified student record is refused in the teacher editor and no new version is persisted');
  await record.getByLabel('修订内容',{exact:true}).fill('本学期负责四年级两个科学班。');
  await record.getByRole('button',{name:'保存修订',exact:true}).click();
  await memory.getByText('已保存修订。',{exact:true}).waitFor();
  assert.equal((await memoryRead()).records[0].value,'本学期负责四年级两个科学班。');
  await record.getByRole('button',{name:'停用',exact:true}).click();
  await memory.getByText('已停用。',{exact:true}).waitFor();
  assert.equal((await memoryRead()).records[0].state,'disabled');
  await record.getByRole('button',{name:'恢复',exact:true}).click();
  await memory.getByText('已恢复。',{exact:true}).waitFor();
  await record.getByRole('button',{name:'遗忘',exact:true}).click();
  await record.getByRole('button',{name:'确认遗忘',exact:true}).click();
  await memory.getByText('已停止使用这条记忆。',{exact:true}).waitFor();
  await memory.getByTestId('personal-memory-auto').click();
  await memory.getByText('已关闭自动处理。',{exact:true}).waitFor();
  await close();
  await launch();
  memory=await memorySettings();
  const after=await memoryRead();
  assert.equal(after.policy.enabled,false);
  assert.equal(after.records[0].state,'forgotten');
  assert.equal(after.records[0].revision,5);
  assert.equal(after.records[0].value,'');
  assert.deepEqual(after.candidates,[]);
  if(useSession) {
    const scope=(await snapshot(useSession)).memoryScope;
    assert.equal(scope.selections.find(item=>item.id===adopted.id)?.state,'changed');
  }
  check('teacher correction, disable, re-enable and forgetting survive a real Electron restart',{revision:after.records[0].revision});
}

try{
  await launch();
  if(workerUnavailable)await verifyUnavailableWorker();
  else if(adoption)await candidateAdoption();
  else if(handout)await handoutPreference();
  else await fastPath();
  await page.screenshot({path:path.join(root,'restart.png')});
  report.ok=true;
}catch(error){
  report.error=String(error.stack);
  process.exitCode=1;
  if(page)await page.screenshot({path:path.join(root,'failure.png')}).catch(()=>{});
}finally{
  if(app)await close().catch(()=>{});
  fs.writeFileSync(path.join(root,'report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({ok:report.ok??false,root,checks:report.checks.length,requests:report.modelRequests.length,error:report.error}));
}
