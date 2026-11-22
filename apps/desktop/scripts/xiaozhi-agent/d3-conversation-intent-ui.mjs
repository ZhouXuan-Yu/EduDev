import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {once} from 'node:events';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {pathToFileURL} from 'node:url';
import {_electron as electron} from 'playwright';
import {testMain,assertIsolatedPiMain} from '../acceptance/build-root.mjs';

const root=process.env.OMNI_EDU_ACCEPTANCE_ROOT;
assert(root,'Use a dedicated acceptance directory');
const output=fs.mkdtempSync(path.join(root,'phase1-intent-'));
const desktop=process.cwd(),main=testMain(desktop);
const data=path.join(output,'data'),profile=path.join(output,'profile');
const requests=[],checks=[],rendererErrors=[];
let holdNextReply=false,askNextReply=false;
const fixture=http.createServer(async(request,response)=>{
  if(request.url==='/v1/models'){
    response.setHeader('content-type','application/json');
    return response.end(JSON.stringify({object:'list',data:[{id:'deepseek-flash',context_window:1048576,max_output_tokens:32768,
      input_modalities:['text'],effort:{supported_levels:['low','high','max'],default_level:'low'}}]}));
  }
  if(request.url!=='/v1/chat/completions'||request.headers.authorization!=='Bearer owned-d3-acceptance'){
    response.writeHead(404);return response.end();
  }
  let raw='';for await(const part of request)raw+=part;
  const body=JSON.parse(raw);
  const toolNames=body.tools?.map(tool=>tool.function?.name).filter(Boolean)??[];
  requests.push({tools:toolNames,messages:body.messages.length,
    teacherAnswer:body.messages.some(message=>message.role==='tool'&&typeof message.content==='string'&&message.content.includes('五年级')),
    recoveredTeacherAnswer:body.messages.some(message=>message.role==='user'&&/教师回答:\s*五年级/u.test(JSON.stringify(message.content??'').normalize('NFKC')))});
  response.setHeader('content-type','text/event-stream');
  const chunk=(delta,finish_reason)=>'data: '+JSON.stringify({id:'owned-d3',object:'chat.completion.chunk',created:1,
    model:'deepseek-flash',choices:[{index:0,delta,finish_reason}]})+'\n\n';
  if(askNextReply&&toolNames.includes('ask_teacher')){
    askNextReply=false;
    const call={index:0,id:'call_'+requests.length,type:'function',function:{name:'ask_teacher',arguments:JSON.stringify({question:'这份课堂导入给哪个年级？',options:['三年级','五年级']})}};
    return response.end(chunk({role:'assistant'},null)+chunk({tool_calls:[call]},null)+chunk({},'tool_calls')+'data: [DONE]\n\n');
  }
  response.write(chunk({role:'assistant',content:'已完成这轮合成验收回复。'},null));
  const finish=()=>response.end(chunk({},'stop')+'data: [DONE]\n\n');
  if(!holdNextReply)return finish();
  holdNextReply=false;
  const timer=setTimeout(finish,30_000);
  response.once('close',()=>clearTimeout(timer));
});
fixture.listen(0,'127.0.0.1');await once(fixture,'listening');
const boot=path.join(output,'bootstrap.cjs');
fs.writeFileSync(boot,`const {app,net}=require('electron');
app.setPath('userData',${JSON.stringify(profile)});
net.fetch=(input,init)=>{const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
if(url.origin!=='https://api.deepseek.com'||!['/v1/models','/v1/chat/completions'].includes(url.pathname))throw Error('fixture_network_blocked');
return globalThis.fetch('http://127.0.0.1:${fixture.address().port}'+url.pathname,{...init,redirect:'error'});};
app.whenReady().then(()=>import(${JSON.stringify(pathToFileURL(main).href)})).catch(error=>{console.error(error.message);app.exit(1)});`);
const env={...process.env};
for(const key of Object.keys(env))if(/(API_KEY|ACCESS_TOKEN|SECRET|PASSWORD)$/i.test(key)||key.startsWith('OMNI_EDU_E2E_'))delete env[key];
for(const key of ['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL'])delete env[key];
Object.assign(env,{OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),OMNI_EDU_E2E_DIALOG_MODE:'1',
  OMNI_EDU_E2E_VISIBLE:'0',OMNI_EDU_XIAOZHI_PI:'1',DEEPSEEK_API_KEY:'owned-d3-acceptance',DEEPSEEK_MODEL:'deepseek-flash'});
let app,page,sessionId,failure;
const check=name=>{checks.push(name);console.log('PASS '+name);};
const activeSession=()=>page.locator('.office-composer-container').getAttribute('data-session-id');
const snapshot=()=>page.evaluate(id=>window.omniEdu.getXiaozhiSnapshot(id),sessionId);
async function launch(){
  app=await electron.launch({args:[boot],cwd:desktop,env,timeout:60_000});
  page=await app.firstWindow({timeout:60_000});
  page.on('pageerror',error=>rendererErrors.push(error.message));
  await page.getByTestId('office-prompt-input').waitFor({state:'visible'});
  await page.waitForFunction(()=>document.querySelector('.office-composer-container')?.getAttribute('data-session-id')?.startsWith('aisession_'));
  await assertIsolatedPiMain(app,main,profile);
}
async function submit(text){
  const input=page.getByTestId('office-prompt-input');
  await input.fill(text);await input.press('Enter');
}
async function terminal(previous){
  const deadline=Date.now()+45_000;
  while(Date.now()<deadline){
    const state=await snapshot(),turn=state.projection.turns.at(-1);
    if(state.projection.turns.length>previous&&!state.running&&['completed','failed','interrupted'].includes(turn?.status))return {state,turn};
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  throw Error('The submitted turn did not reach persisted terminal status');
}
async function send(text){
  const previous=(await snapshot()).projection.turns.length;
  await submit(text);return terminal(previous);
}
async function restart(crash=false){
  if(crash){
    await assertIsolatedPiMain(app,main,profile);
    execFileSync('taskkill',['/PID',String(app.process().pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});
    await app.close().catch(()=>undefined);
  }else await app.close();
  app=undefined;await launch();
  if(await activeSession()===sessionId)return;
  if(!await page.getByTestId('edu-history-panel').isVisible())await page.getByTestId('pi-sidebar-toggle').click();
  await page.getByTestId('ai-conversation-session-'+sessionId).click();
  await page.waitForFunction(id=>document.querySelector('.office-composer-container')?.getAttribute('data-session-id')===id,sessionId);
}
async function freshConversation(){
  if(!await page.getByTestId('ai-conversation-new').isVisible())await page.getByTestId('pi-sidebar-toggle').click();
  await page.getByTestId('ai-conversation-new').click();
  await page.waitForFunction(id=>{
    const visible=document.querySelector('.office-composer-container')?.getAttribute('data-session-id');
    return visible?.startsWith('aisession_')&&visible!==id;
  },sessionId);
  sessionId=await activeSession();
}
function taskRecords(){
  const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});
  try{return db.prepare(`SELECT value_json FROM app_settings
    WHERE key GLOB 'xiaozhi.task.v1:xitask_*' AND json_valid(value_json)
      AND key = 'xiaozhi.task.v1:' || json_extract(value_json,'$.view.id')
      AND json_extract(value_json,'$.view.sessionId')=?`)
    .all(sessionId).map(row=>JSON.parse(row.value_json).view);}
  finally{db.close();}
}
function runAuthority(){
  const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});
  try{return {
    owner:db.prepare('SELECT run_id,generation FROM xiaozhi_event_owners WHERE session_id=?').get(sessionId),
    runs:db.prepare('SELECT run_id,status,generation FROM xiaozhi_event_runs WHERE session_id=? ORDER BY generation').all(sessionId)
  };}finally{db.close();}
}
try{
  await launch();sessionId=await activeSession();
  const first=await send('什么是等值分数？');
  assert.equal(first.turn.status,'completed',first.turn.error);
  assert(!first.turn.task);
  assert.deepEqual(taskRecords(),[]);
  assert.deepEqual(requests[0].tools,[]);
  check('普通知识问答真实返回并持久化，模型请求不含工具，SQLite 没有创建任务');

  const task=await send('请制作一份五年级等值分数讲义，包含例题、练习和答案，先给教学草稿。');
  assert.equal(task.turn.status,'completed',task.turn.error);
  assert(task.turn.task?.id);
  const created=taskRecords();
  assert.equal(created.length,1);
  assert.equal(created[0].id,task.turn.task.id);
  assert(requests[1].tools.length>0);
  check('明确成果目标经相同对话建立原 Task，工具与检查点链路正常');

  const second=await send('为什么分母变大时单位分数变小？');
  assert.equal(second.turn.status,'completed',second.turn.error);
  assert.deepEqual(requests[2].tools,[]);
  const kept=taskRecords();
  assert.equal(kept.length,1);
  assert.equal(kept[0].id,created[0].id);
  assert.equal(kept[0].requirementsVersion,created[0].requirementsVersion);
  assert.equal(kept[0].state,created[0].state);
  check('插入独立问答保留原任务 ID、要求版本和业务状态');

  await restart();
  assert((await snapshot()).projection.turns.some(turn=>turn.id===first.turn.id&&turn.status==='completed'));
  const resumed=await send('继续');
  assert.equal(resumed.turn.status,'completed',resumed.turn.error);
  assert.equal(resumed.turn.task?.id,created[0].id);
  assert.equal(taskRecords().length,1);
  assert.deepEqual(rendererErrors,[]);
  await page.screenshot({path:path.join(output,'conversation-after-restart.png')});
  check('重启后普通问答可读，教师继续时恢复原任务');
  if(process.argv.includes('--amend')){
    const amended=await send('请把刚才的讲义改为八年级，其他要求照旧。');
    assert.equal(amended.turn.status,'completed',amended.turn.error);
    const updated=taskRecords();
    assert.equal(updated.length,1);
    assert.equal(updated[0].id,created[0].id);
    assert.equal(updated[0].requirementsVersion,created[0].requirementsVersion+1);
    assert.equal(updated[0].origin.messageId,created[0].origin.messageId);
    assert(updated[0].criteria.some(c=>c.text.includes('八年级')&&updated[0].sources.some(s=>s.messageId===c.sourceId&&s.version===c.sourceVersion)));
    check('自然语言修订保留任务与原始消息，按新教师来源递增要求版本');

    const separate=await send('新建另一项任务，请制作六年级小数复习教案。');
    assert.equal(separate.turn.status,'completed',separate.turn.error);
    assert.notEqual(separate.turn.task?.id,created[0].id);
    assert.equal(taskRecords().length,2);
    check('明确新建目标生成独立任务，不覆盖旧任务');
  }
  if(process.argv.includes('--control')){
    const before=(await snapshot()).projection.turns.length;
    holdNextReply=true;
    await submit('另开一个任务，帮我制作六年级小数复习讲义，包含示范例题。');
    const pause=page.getByTestId('pi-task-pause');
    await pause.waitFor({state:'visible',timeout:30_000});
    const card=page.getByTestId('pi-task-review').filter({has:pause});
    const taskId=await card.getAttribute('data-task-id');
    const target=taskRecords().find(item=>item.id===taskId);
    assert.equal(target?.state,'active');assert(target.binding);
    const oldOwner={schema:target.schema,sessionId,taskId,requirementsVersion:target.requirementsVersion,owner:{...target.binding,generation:target.binding.generation+1},action:'pause'};
    const rejected=await page.evaluate(input=>window.omniEdu.controlXiaozhiTask(input),oldOwner);
    assert.deepEqual(rejected,{ok:false,error:'changed'});
    const invalid=await page.evaluate(input=>window.omniEdu.controlXiaozhiTask(input),{...oldOwner,owner:target.binding,action:['cancel']});
    assert.deepEqual(invalid,{ok:false,error:'invalid_input'});
    assert.equal(taskRecords().find(item=>item.id===taskId).state,'active');
    const window=await app.browserWindow(page);
    for(const [width,height] of [[1366,768],[1920,1080]]){
      await window.evaluate((win,size)=>win.setContentSize(...size),[width,height]);
      await page.waitForFunction(size=>innerWidth===size.width&&innerHeight===size.height,{width,height});
      for(const control of [pause,card.getByTestId('pi-task-cancel')]){
        await control.scrollIntoViewIfNeeded();
        const box=await control.boundingBox();
        assert(box&&box.x>=0&&box.y>=0&&box.x+box.width<=width+1&&box.y+box.height<=height+1);
      }
    }
    await pause.click();
    const paused=await terminal(before);
    assert.equal(paused.turn.status,'interrupted');
    assert.equal(taskRecords().find(item=>item.id===taskId).state,'paused');
    await page.screenshot({path:path.join(output,'task-paused.png')});
    check('暂停和取消在两个桌面尺寸可达，过期所有者及非法动作被拒绝，暂停写入原任务');

    const requestCount=requests.length;
    await restart();assert.equal(requests.length,requestCount);
    const pausedCard=page.locator(`[data-testid="pi-task-review"][data-task-id="${taskId}"]`);
    await pausedCard.getByTestId('pi-task-review-toggle').click();
    const beforeResume=(await snapshot()).projection.turns.length;
    await pausedCard.getByTestId('pi-task-resume').click({timeout:20_000});
    const continued=await terminal(beforeResume);
    assert.equal(continued.turn.task?.id,taskId);
    assert.equal(continued.turn.task?.requirementsVersion,target.requirementsVersion);
    check('冷启不重放模型，从任务卡恢复原 Task 和要求版本');

    const beforeCancel=(await snapshot()).projection.turns.length;
    holdNextReply=true;await submit('继续');
    await page.getByTestId('pi-task-pause').waitFor({state:'visible',timeout:30_000});
    await pausedCard.getByTestId('pi-task-cancel').click();
    assert.equal(taskRecords().find(item=>item.id===taskId).state,'active');
    await pausedCard.getByTestId('pi-task-confirm-cancel').click();
    const cancelled=await terminal(beforeCancel);
    assert.equal(cancelled.turn.status,'interrupted');
    assert.equal(taskRecords().find(item=>item.id===taskId).state,'ended');
    check('运行中取消须再次确认，原任务落盘结束');

    const cancelledRequests=requests.length;
    await restart();
    assert.equal(taskRecords().find(item=>item.id===taskId).state,'ended');
    await submit('继续');
    await page.getByRole('alert').filter({hasText:'这项任务已结束'}).waitFor({state:'visible'});
    assert.equal(requests.length,cancelledRequests);
    check('取消状态冷启保留，继续不会新建替代任务或提交模型请求');

    const idle=await send('新建一个教案任务，请写小学数学课堂提纲并等待我确认。');
    const idleId=idle.turn.task?.id;
    assert(idleId&&idleId!==taskId);
    const idleCard=page.locator(`[data-testid="pi-task-review"][data-task-id="${idleId}"]`);
    await idleCard.getByTestId('pi-task-review-toggle').click();
    await idleCard.getByTestId('pi-task-cancel').click();
    await idleCard.getByTestId('pi-task-confirm-cancel').click();
    await idleCard.getByTestId('pi-task-control-notice').filter({hasText:'任务已取消'}).waitFor({state:'visible'});
    assert.equal(taskRecords().find(item=>item.id===idleId).state,'ended');
    assert.equal(requests.length,cancelledRequests+1);
    await page.screenshot({path:path.join(output,'task-cancelled.png')});
    check('静止待核对任务也能取消，未增加模型请求');
  }
  if(process.argv.includes('--teacher-wait')){
    const before=(await snapshot()).projection.turns.length,count=requests.length;
    askNextReply=true;
    await submit('请新建一个分数课教案任务，我还没确定年级，请先问我再写导入。');
    const question=page.locator('[data-testid="pi-teacher-question"][data-state="pending"]');
    await question.waitFor({state:'visible',timeout:30_000});
    const waiting=await snapshot(),turn=waiting.projection.turns.at(-1);
    assert.equal(turn.status,'waiting_input');assert(waiting.task?.id);
    const controlId=await question.getAttribute('data-control-id');
    assert.equal(requests.length,count+1);
    const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});
    try{assert.equal(db.prepare('SELECT state FROM xiaozhi_pi_controls WHERE id=?').get(controlId).state,'pending');}
    finally{db.close();}
    await question.getByTestId('pi-question-option-1').click();
    await question.getByTestId('pi-question-submit').click();
    const answered=await terminal(before);
    assert.equal(answered.turn.status,'completed',answered.turn.error);
    assert.equal(answered.turn.id,turn.id);
    assert.equal(answered.turn.task?.id,waiting.task.id);
    assert(requests.at(-1).teacherAnswer);
    assert.equal(answered.state.controls.find(item=>item.id===controlId).state,'answered');
    check('真实澄清卡等待教师输入，选择答案后同一 Run 和 Task 继续，请求携带经过宿主记录的回答');
  }
  if(process.argv.includes('--teacher-cold')){
    const sameConversation=process.argv.includes('--same-teacher-conversation');
    const abrupt=!process.argv.includes('--teacher-graceful-shutdown');
    async function interruptedQuestion(prompt){
      askNextReply=true;await submit(prompt);
      const pending=page.locator('[data-testid="pi-teacher-question"][data-state="pending"]');
      await pending.waitFor({state:'visible',timeout:30_000});
      const controlId=await pending.getAttribute('data-control-id'),task=(await snapshot()).task;
      assert(task?.id&&controlId);
      const count=requests.length;await restart(abrupt);
      assert.equal(requests.length,count);
      const question=page.locator(`[data-testid="pi-teacher-question"][data-control-id="${controlId}"][data-state="interrupted"]`);
      await question.getByTestId('pi-question-option-1').waitFor({state:'visible',timeout:15_000});
      return{task,controlId,question,count};
    }
    if(!sameConversation)await freshConversation();
    const recovered=await interruptedQuestion('请新建一个分数教学任务，先问我年级再给导入方案。');
    const ids=taskRecords().map(task=>task.id),before=(await snapshot()).projection.turns.length;
    await recovered.question.getByTestId('pi-question-option-1').click();
    await recovered.question.getByTestId('pi-question-submit').click();
    const result=await terminal(before);
    assert.equal(result.turn.status,'completed',result.turn.error);
    assert.equal(result.turn.task?.id,recovered.task.id);
    assert.equal(result.turn.task?.requirementsVersion,recovered.task.requirementsVersion);
    assert.notEqual(result.turn.id,recovered.task.origin.runId);
    assert.deepEqual(taskRecords().map(task=>task.id),ids);
    const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});
    try{
      const latest=db.prepare("SELECT id,content FROM ai_conversation_messages WHERE role='user' AND json_extract(metadata_json,'$.agentRunId')=?").get(result.turn.id);
      assert(latest?.content.includes('教师回答：五年级'));
      assert(taskRecords().find(task=>task.id===recovered.task.id).sources.some(source=>source.messageId===latest.id));
    }finally{db.close();}
    assert.equal(requests.length,recovered.count+1);assert(requests.at(-1).recoveredTeacherAnswer);
    const repeat=await page.evaluate(input=>window.omniEdu.answerXiaozhi(input),{sessionId,controlId:recovered.controlId,answer:'五年级'});
    assert.deepEqual(repeat,{ok:true});assert.equal(requests.length,recovered.count+1);
    check(`${abrupt?'意外关闭':'正常退出'}后回答原澄清卡，回到原 Task，重复回答保持零新增请求`);

    if(!sameConversation)await freshConversation();
    const cancelled=await interruptedQuestion('新建另一个教案任务，请先询问教师目标年级。');
    const frozenAuthority=runAuthority();
    if(abrupt)assert.equal(frozenAuthority.owner.run_id,'');
    const cancelledCard=page.locator(`[data-testid="pi-task-review"][data-task-id="${cancelled.task.id}"]`);
    await cancelledCard.getByTestId('pi-task-review-toggle').click();
    await cancelledCard.getByTestId('pi-task-cancel').click();
    await cancelledCard.getByTestId('pi-task-confirm-cancel').click();
    await cancelledCard.getByTestId('pi-task-control-notice').filter({hasText:'任务已取消'}).waitFor({state:'visible'});
    await cancelled.question.getByTestId('pi-question-option-1').click();
    await cancelled.question.getByTestId('pi-question-submit').click();
    await cancelled.question.getByRole('alert').filter({hasText:'这项任务已结束'}).waitFor({state:'visible'});
    assert.equal(requests.length,cancelled.count);
    assert.equal(taskRecords().find(task=>task.id===cancelled.task.id).state,'ended');
    assert.deepEqual(runAuthority(),frozenAuthority);
    check('已取消任务的历史澄清卡保留，回复无法启动任何新模型请求');

    const newer=await send('另开一个新任务，给我一个五年级分数导入方案。');
    assert(newer.turn.task?.id&&newer.turn.task.id!==cancelled.task.id);
    const latestCount=requests.length;
    await cancelled.question.getByTestId('pi-question-submit').click();
    await cancelled.question.getByRole('alert').filter({hasText:'原任务或要求已变化'}).waitFor({state:'visible'});
    assert.equal(requests.length,latestCount);
    assert.equal(taskRecords().find(task=>task.id===cancelled.task.id).state,'ended');
    check('原任务被替换后，历史问题不能串到当前任务');

    if(!abrupt){
      await freshConversation();
      const beforeStop=(await snapshot()).projection.turns.length;
      askNextReply=true;await submit('新建一项讲义任务，请先询问目标年级。');
      const pending=page.locator('[data-testid="pi-teacher-question"][data-state="pending"]');
      await pending.waitFor({state:'visible',timeout:30_000});
      const controlId=await pending.getAttribute('data-control-id'),count=requests.length;
      await page.getByRole('button',{name:'停止本轮',exact:true}).click();
      assert.equal((await terminal(beforeStop)).turn.status,'interrupted');
      await restart();
      const stopped=page.locator(`[data-testid="pi-teacher-question"][data-control-id="${controlId}"][data-state="interrupted"]`);
      await stopped.waitFor({state:'visible',timeout:15_000});
      assert.equal(await stopped.getByTestId('pi-question-submit').count(),0);
      assert.deepEqual(await page.evaluate(input=>window.omniEdu.answerXiaozhi(input),{sessionId,controlId,answer:'五年级'}),{ok:false,error:'permission_denied'});
      assert.equal(requests.length,count);
      check('教师主动停止后，正常重启保留旧题卡且禁止其恢复执行');
    }
  }
  assert.deepEqual(rendererErrors,[]);
}catch(error){
  failure=error;process.exitCode=1;console.error(error.stack);
  if(page){
    console.error(await page.getByTestId('pi-task-review').allTextContents().catch(()=>[]));
    await page.screenshot({path:path.join(output,'failure.png')}).catch(()=>undefined);
  }
}
finally{
  await app?.close().catch(()=>undefined);
  fixture.closeAllConnections();await new Promise(resolve=>fixture.close(resolve));
  const report={success:!failure,checks,requests,rendererErrors,main,output,error:failure?.message};
  fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report));
}
