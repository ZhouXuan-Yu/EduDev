import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {_electron as electron} from 'playwright';
import {assertIsolatedPiMain,testMain} from './build-root.mjs';
import {confirmTeachingTarget} from './confirm-teaching-target.mjs';

assert(process.env.OMNI_EDU_ACCEPTANCE_ROOT && process.env.DEEPSEEK_API_KEY);
const desktop=path.resolve(import.meta.dirname,'../..'),main=testMain(desktop);
const root=fs.mkdtempSync(path.join(process.env.OMNI_EDU_ACCEPTANCE_ROOT,'method-history-review-'));
const data=path.join(root,'data'),profile=path.join(root,'profile');
const env={...process.env,OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),
  OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_E2E_DIALOG_MODE:'1',OMNI_EDU_SKIP_DOTENV:'1',DEEPSEEK_MODEL:'deepseek-flash'};
for(const name of ['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL','OMNI_EDU_HISTORY_LOOPBACK','OMNI_EDU_HISTORY_TOKEN'])delete env[name];
const method='题目与答案编号复核';
const scope={classRef:'方法验收',termRef:'2026F',grade:'八年级',subject:'数学'};
const report={root,build:createHash('sha256').update(fs.readFileSync(main)).digest('hex'),
  source:process.env.OMNI_EDU_R3_EVAL_PRODUCT_SHA??null,inputs:[],sources:[],runs:[],ok:false,cost:'UNKNOWN'};
const read=(query,...args)=>{
  const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});
  try{return db.prepare(query).all(...args);}finally{db.close();}
};
async function until(observe,timeout=90000){
  const deadline=Date.now()+timeout;
  while(Date.now()<deadline){
    const value=await observe();
    if(value)return value;
    await new Promise(resolve=>setTimeout(resolve,150));
  }
  throw Error('Observable desktop state did not arrive');
}
let app,page;
try{
  app=await electron.launch({args:[main,'--user-data-dir='+profile],cwd:desktop,env,timeout:60000});
  page=await app.firstWindow();
  const input=page.getByTestId('office-prompt-input');
  await input.waitFor();await assertIsolatedPiMain(app,main,profile);
  await app.evaluate(({net})=>{
    const fetch=net.fetch.bind(net);
    globalThis.methodHistoryTraffic={phase:'setup',requests:[]};
    net.fetch=async(request,init)=>{
      const url=new URL(typeof request==='string'?request:request.url);
      if(url.origin!=='https://api.deepseek.com'||url.pathname!=='/v1/chat/completions')return fetch(request,init);
      const payload=JSON.parse(init.body),traffic=globalThis.methodHistoryTraffic;
      if(traffic.requests.length>=16)throw Error('method_review_fixture_budget');
      const text=JSON.stringify(payload.messages),started=Date.now();
      const row={phase:traffic.phase,model:payload.model,maxTokens:payload.max_tokens,effort:payload.reasoning_effort,
        sample: /获准的独立发现任务 (\d+) 项/u.exec(text)?.[1]??null,
        holdout: /获准的留出核验任务 (\d+) 项/u.exec(text)?.[1]??null,
        staleHoldout: text.includes('教师答案写 4、6') || /获准的留出核验任务 [1-9]/u.test(text),
        publish:payload.tools?.some(tool=>tool.function?.name==='skill_create')??false};
      traffic.requests.push(row);
      const response=await fetch(request,init);
      row.status=response.status;row.headersMs=Date.now()-started;
      return response;
    };
  });
  const snapshot=id=>page.evaluate(sessionId=>window.omniEdu.getXiaozhiSnapshot(sessionId),id);
  const currentSession=()=>page.locator('.office-composer-container').getAttribute('data-session-id');
  async function newScopedSession(){
    const previous=await currentSession();
    await page.getByTestId('pi-new-session').click();
    const id=await until(async()=>{
      const value=await currentSession();return value?.startsWith('aisession_')&&value!==previous?value:null;
    });
    await confirmTeachingTarget(until,app,page,id,scope);
    return id;
  }
  async function send(id,prompt,phase){
    report.inputs.push({phase,prompt});
    await input.fill(prompt);
    await app.evaluate((_electron,next)=>{globalThis.methodHistoryTraffic.phase=next;},phase);
    await page.getByRole('button',{name:'发送消息',exact:true}).click();
    const teacher=await until(()=>read("SELECT id,metadata_json->>'$.agentRunId' AS runId FROM ai_conversation_messages WHERE session_id=? AND role='user' AND content=?",id,prompt)[0]);
    const turn=await until(async()=>{
      const state=await snapshot(id);
      const found=state.projection.turns.find(row=>row.id===teacher.runId);
      return !state.running&&found&&['completed','failed','interrupted'].includes(found.status)?found:null;
    });
    const [reply]=read("SELECT content FROM ai_conversation_messages WHERE session_id=? AND role='assistant' AND metadata_json->>'$.agentRunId'=?",id,teacher.runId);
    report.runs.push({id,phase,teacher,turn:turn.status,reply:reply?.content});
    assert.equal(turn.status,'completed');
    return teacher;
  }
  for(const [role,example] of [['发现样本','学生版题号为 1、3，教师答案写 1、2'],['留出验证','学生版题号为 4、5，教师答案写 4、6']]){
    const id=await newScopedSession();
    const prompt='核对以下题目与答案编号，指出唯一错配并给出改正的编号。只在聊天中交付，不新建文件。'+example+'。\n验证方法：'+method+'\n证据用途：'+role;
    const teacher=await send(id,prompt,role);
    const expected = role==='发现样本' ? /1\s*[、，,和]\s*3/u : /4\s*[、，,和]\s*5/u;
    assert.match(report.runs.at(-1).reply,expected,'Teacher should confirm only the actual corrected result');
    const task=await until(async()=>{const state=await snapshot(id);return state.task?.state==='review_required'?state.task:null;});
    const review=page.locator('[data-testid="pi-task-review"][data-task-id="'+task.id+'"]');
    await review.getByTestId('pi-task-review-toggle').click();
    await until(()=>review.getByTestId('pi-task-review-refresh').isEnabled());
    const checkboxes=await review.getByTestId('pi-task-review-check').locator('input').all();
    assert(checkboxes.length>0);
    for(const box of checkboxes)if(!await box.isChecked())await box.press('Space');
    await review.getByTestId('pi-task-review-accept').click();
    const completed=await until(async()=>{const state=await snapshot(id);return state.task?.state==='completed'?state.task:null;});
    assert(completed.checks.some(check=>check.authority==='teacher'&&check.state==='passed'));
    report.sources.push({role,sessionId:id,messageId:teacher.id,taskId:task.id,confirmed:completed.checks});
  }
  const reviewId=await newScopedSession();
  const opening=app.waitForEvent('window');
  await page.getByRole('button',{name:'设置',exact:true}).click();
  const settings=await opening;
  await settings.getByTestId('pi-settings-tab-teacher-memory').click();
  for(const source of report.sources){
    await settings.getByTestId('history-settings-session').selectOption(source.sessionId);
    const entry=settings.getByTestId('history-settings-source-'+source.messageId);
    await entry.getByRole('button',{name:'查看来源'}).click();
    await entry.getByTestId('history-settings-allow').click();
    await settings.getByTestId('history-settings-notice').getByText(/已允许查找/).waitFor();
  }
  await Promise.all([settings.waitForEvent('close'),settings.getByTestId('settings-window-close').click()]);
  const prompt='评估方法：'+method+'\n请分别检查发现样本和留出验证。只评估这个候选方法，先不要发布技能。';
  async function stage(source){
    await page.getByTestId('history-lookup-open').click();
    await page.getByTestId('history-lookup-query').fill(method);
    await page.getByTestId('history-lookup-search').click();
    await page.getByTestId('history-candidate-'+source.messageId).click();
    await page.getByTestId('history-lookup-preview').getByText(new RegExp(source.role)).waitFor();
    await page.getByTestId('history-lookup-use').click();
  }
  await input.fill(prompt);
  for(const source of report.sources)await stage(source);
  const skills=()=>read('SELECT id,payload_hash FROM xiaozhi_skill_versions_v1 ORDER BY id');
  const grants=()=>read('SELECT * FROM xiaozhi_permission_grants_v1 ORDER BY rowid');
  const before={skills:skills(),grants:grants()};
  const review=await send(reviewId,prompt,'review');
  const signals=await app.evaluate(()=>globalThis.methodHistoryTraffic.requests);
  report.requests=signals;
  const reviewRequests=signals.filter(row=>row.phase==='review');
  assert(reviewRequests.some(row=>row.status===200&&row.sample==='1'&&row.holdout==='1'),'Independent original Task proof did not reach the actual model');
  assert(reviewRequests.every(row=>!row.publish));
  assert.deepEqual({skills:skills(),grants:grants()},before);
  const deliveries=read('SELECT source_id FROM xiaozhi_memory_reference_deliveries WHERE run_id=?',review.runId);
  const selected=report.sources.flatMap(source=>read('SELECT source_id FROM memory_source_access WHERE session_id=? AND record_id=?',source.sessionId,source.messageId));
  assert.deepEqual(deliveries.map(row=>row.source_id).sort(),selected.map(row=>row.source_id).sort());
  report.deliveries=deliveries;
  await page.screenshot({path:path.join(root,'review.png')});

  const oldTask=(await snapshot(reviewId)).task;
  const reviewCard=page.locator('[data-testid="pi-task-review"][data-task-id="'+oldTask.id+'"]');
  await reviewCard.getByTestId('pi-task-review-toggle').click();
  await reviewCard.getByTestId('pi-task-cancel').click();
  await reviewCard.getByTestId('pi-task-confirm-cancel').click();
  await until(async()=>(await snapshot(reviewId)).task?.state==='ended');
  const holdout=report.sources.find(source=>source.role==='留出验证');
  const reopening=app.waitForEvent('window');
  await page.getByRole('button',{name:'设置',exact:true}).click();
  const revokeSettings=await reopening;
  await revokeSettings.getByTestId('pi-settings-tab-teacher-memory').click();
  await revokeSettings.getByTestId('history-settings-session').selectOption(holdout.sessionId);
  await revokeSettings.getByTestId('history-settings-source-'+holdout.messageId).getByRole('button',{name:'暂停参考'}).click();
  await until(()=>read('SELECT memory_state FROM memory_source_access WHERE session_id=? AND record_id=?',holdout.sessionId,holdout.messageId)[0]?.memory_state==='disabled');
  await Promise.all([revokeSettings.waitForEvent('close'),revokeSettings.getByTestId('settings-window-close').click()]);
  const afterPrompt='评估方法：'+method+'\n按当前可核对依据重新评估候选方法，先不要发布技能。';
  await input.fill(afterPrompt);
  await stage(report.sources.find(source=>source.role==='发现样本'));
  await send(reviewId,afterPrompt,'after-revoke');
  report.requests=await app.evaluate(()=>globalThis.methodHistoryTraffic.requests);
  const afterRequests=report.requests.filter(row=>row.phase==='after-revoke');
  assert(afterRequests.some(row=>row.status===200&&row.sample==='1'&&row.holdout==='0'));
  assert(afterRequests.every(row=>!row.staleHoldout&&!row.publish));
  assert.deepEqual({skills:skills(),grants:grants()},before);
  report.ok=true;
  await page.screenshot({path:path.join(root,'after-revoke.png')});
}catch(error){
  report.error=String(error.stack||error);
  if(app)report.requests=await app.evaluate(()=>globalThis.methodHistoryTraffic?.requests).catch(()=>undefined);
  if(page)await page.screenshot({path:path.join(root,'failure.png')}).catch(()=>undefined);
  process.exitCode=1;
}finally{
  await app?.close().catch(()=>undefined);
  fs.writeFileSync(path.join(root,'report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({root,ok:report.ok,error:report.error}));
}
