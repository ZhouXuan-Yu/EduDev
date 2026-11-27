import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {_electron as electron} from 'playwright';
import {assertIsolatedPiMain,testMain} from './build-root.mjs';

const desktop=path.resolve(import.meta.dirname,'../..'), main=testMain(desktop);
const acceptance=process.env.OMNI_EDU_ACCEPTANCE_ROOT;
const exclusion=process.argv.includes('--task-exclusion');
const receiptFailure=process.argv.includes('--receipt-failure');
const receiptVerified=process.argv.includes('--receipt-verified');
const keyboardHistory=process.argv.includes('--keyboard-history');
const compactionMemory=process.argv.includes('--compaction-memory');
const vagueChoice=process.argv.includes('--vague-choice');
const namedHistory=receiptFailure||receiptVerified||keyboardHistory||compactionMemory||process.argv.includes('--named-history');
const declaredTitle='温度计实验观察档案';
assert(acceptance&&process.env.DEEPSEEK_API_KEY,'Use an isolated acceptance root and a configured DeepSeek account.');
const lane=vagueChoice?'history-vague-choice-':receiptFailure?'history-receipt-failure-':receiptVerified?'history-receipt-verified-'
  :keyboardHistory?'history-keyboard-':compactionMemory?'history-compaction-'
  :namedHistory?'history-named-':exclusion?'history-exclusion-':'history-task-';
const root=fs.mkdtempSync(path.join(acceptance,lane));
const data=path.join(root,'data'),profile=path.join(root,'profile');
const marker='星桥读数法先蓝后绿';
const source='这是合成教师教学记录。温度计实验的固定复核口令：'+marker+'。请简短回复收到。';
const search='温度计实验 固定复核口令 星桥读数法';
const alternateMarker='冬砂比对先橙后红';
const alternateSource='这是另一条合成教师教学记录。温度计实验的固定复核口令：'+alternateMarker+'。请简短回复收到。';
const taskRequest='请整理温度计实验复核要点成三条清单。只在聊天中回复，引用已选的老师原话。';
const question='请简述之前的温度计实验采用什么复核口令？';
const report={root,buildHash:createHash('sha256').update(fs.readFileSync(main)).digest('hex'),checks:[],provider:[],ok:false};
let app,page;

function read(sql,...args){
  const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});
  try{return db.prepare(sql).all(...args);}finally{db.close();}
}
async function until(work,timeout=100000){
  const end=Date.now()+timeout;
  while(Date.now()<end){
    const value=await work();
    if(value)return value;
    await new Promise(r=>setTimeout(r,160));
  }
  throw Error('History task journey timed out');
}
function pass(name,evidence={}){
  report.checks.push({name,...evidence});
  console.log('PASS '+name);
}
const bindings=id=>read("SELECT value_json FROM app_settings WHERE key GLOB 'xiaozhi.memory-use.task.v1:*' AND json_extract(value_json,'$.sessionId')=?",id)
  .map(row=>JSON.parse(row.value_json));
const composer=()=>page.getByTestId('office-prompt-input');
const session=()=>page.locator('.office-composer-container').getAttribute('data-session-id');
const snapshot=id=>page.evaluate(id=>window.omniEdu.getXiaozhiSnapshot(id),id);
const provider=()=>app.evaluate(()=>globalThis.historyTaskWire);
async function send(id,text,{answer,expectedStatus='completed'}={}){
  const prior=(await snapshot(id)).projection.turns.at(-1)?.id;
  const offset=(await provider()).length;
  await composer().fill(text);
  await page.getByRole('button',{name:'发送消息',exact:true}).click();
  let submitted;
  const turn=await until(async()=>{
    const state=await snapshot(id),last=state.projection.turns.at(-1);
    if(!state.running&&last?.id&&last.id!==prior&&['completed','failed','interrupted'].includes(last.status))return last;
    const question=state.controls?.find(item=>item.kind==='question'&&item.state==='pending'&&item.runId===last?.id);
    if(question&&answer&&!submitted){
      const card=page.getByTestId('pi-composer-pending-panel').locator(`[data-control-id="${question.id}"]`);
      await card.getByTestId('pi-question-answer').fill(answer);
      await card.getByTestId('pi-question-submit').click();
      submitted=question.id;
    }
  });
  if(submitted){
    const control=(await snapshot(id)).controls?.find(item=>item.id===submitted);
    assert.equal(control?.state,'answered');
    report.teacherAnswer={runId:turn.id,controlId:submitted};
  }
  assert.equal(turn.status,expectedStatus,turn.error);
  const sent=(await provider()).slice(offset);
  assert(sent.length,'A real provider request is required');
  return {runId:turn.id,sent,answerUsed:turn.items.some(item=>item.role==='assistant'&&item.text?.includes(marker))};
}
async function stage(recordId,text){
  await composer().fill(text);
  await page.getByTestId('history-lookup-open').click();
  await page.getByTestId('history-lookup-query').fill(search);
  await page.getByTestId('history-lookup-search').click();
  await page.getByTestId('history-candidate-'+recordId).click();
  await page.getByTestId('history-lookup-preview').getByText(source,{exact:true}).waitFor();
  await page.getByTestId('history-lookup-use').click();
  await page.getByTestId('history-intent-pending').waitFor();
  assert.equal(await composer().inputValue(),text);
}
async function revokeThenCompact(target,sourceSession,sourceRecord,initialGrant){
  const material=Array.from({length:120},(_,index)=>
    `合成教研段落 ${index+1}。先观察相同液体的温度变化，再比较不同试管的刻度。课堂演示由教师复核，课后只保留合成练习和脱敏记录。`).join('\n');
  for(let batch=1;batch<=3;batch++){
    await send(target,`请通读第 ${batch} 批合成教学资料。只回复一句已阅读，不要文件或工具。
${material}`);
  }
  const jsonl=()=>path.join(data,'xiaozhi-pi',read(
    'SELECT session_file FROM xiaozhi_pi_session_bindings WHERE conversation_id=?',target)[0].session_file);
  const originalFile=jsonl(),oldBytes=fs.readFileSync(originalFile);
  assert(oldBytes.includes(Buffer.from(marker)),'Before revocation the native branch must contain the prior authorized result');
  const countCompactions=file=>fs.readFileSync(file,'utf8').split('\n').filter(line=>line.includes('"type":"compaction"')).length;
  const beforeCount=countCompactions(originalFile);
  const opening=app.waitForEvent('window');
  await page.getByRole('button',{name:'设置',exact:true}).click();
  const settings=await opening;
  await settings.getByTestId('pi-settings-tab-teacher-memory').click();
  await settings.getByTestId('history-settings-session').selectOption(sourceSession);
  const entry=settings.getByTestId('history-settings-source-'+sourceRecord);
  await entry.getByRole('button',{name:'暂停参考',exact:true}).click();
  const revoked=await until(()=>read(`SELECT generation,index_allowed,memory_state FROM memory_source_access WHERE record_id=?
    AND index_allowed=0 AND memory_state='disabled'`,sourceRecord)[0]);
  assert(revoked.generation>initialGrant.generation);
  await Promise.all([settings.waitForEvent('close'),settings.getByTestId('settings-window-close').click()]);
  const previous=(await snapshot(target)).projection.turns.at(-1).id;
  const offset=(await provider()).length;
  await composer().fill('/compact');
  await composer().press('Enter');
  const compact=await until(async()=>{
    const state=await snapshot(target),turn=state.projection.turns.at(-1);
    return !state.running&&turn?.id!==previous&&['completed','failed','interrupted'].includes(turn?.status)?turn:null;
  });
  assert.equal(compact.status,'completed',compact.error);
  const calls=(await provider()).slice(offset);
  assert(calls.some(call=>call.status===200),'Actual manual compaction must have run through DeepSeek');
  assert(calls.every(call=>call.sourceRoles.length===0),'Revoked source leaked into a compaction model request');
  assert(fs.readFileSync(originalFile).subarray(0,oldBytes.length).equals(oldBytes));
  assert(countCompactions(jsonl())>(jsonl()===originalFile?beforeCount:0));
  assert(!JSON.stringify(compact.items).includes(marker));
  pass('Revocation fences all actual compaction model requests without changing the old native bytes',
    {runId:compact.id,generation:revoked.generation,priorSha256:createHash('sha256').update(oldBytes).digest('hex')});
  await close();
  await launch();
  if(await session()!==target)await page.getByTestId('workbench-session-'+target).click();
  await until(async()=>await session()===target);
  assert(fs.readFileSync(originalFile).subarray(0,oldBytes.length).equals(oldBytes));
  const resumed=await send(target,'请说明刚才的合成观察记录安排了哪个实验主题，只在聊天中回答。');
  assert(resumed.sent.every(call=>call.sourceRoles.length===0));
  assert.equal(resumed.answerUsed,false);
  assert.deepEqual(read('SELECT generation,index_allowed,memory_state FROM memory_source_access WHERE record_id=?',sourceRecord),[revoked]);
  pass('Post-compaction cold startup and actual model continuation retain the revocation',{runId:resumed.runId});
}

async function launch(){
  const env={...process.env,OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),
    OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_E2E_DIALOG_MODE:'1',OMNI_EDU_SKIP_DOTENV:'1',DEEPSEEK_MODEL:process.env.DEEPSEEK_MODEL||'deepseek-flash'};
  for(const k of ['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL','OMNI_EDU_HISTORY_LOOPBACK','OMNI_EDU_HISTORY_TOKEN'])delete env[k];
  app=await electron.launch({args:[main,'--user-data-dir='+profile],env,cwd:desktop,timeout:60000});
  // Main produces bounded journal failure codes. Keep these with the failing SQLite copy.
  app.process().stderr?.on('data',chunk=>{
    for(const line of String(chunk).split(/\r?\n/u)){
      if(/^\[xiaozhi-(journal|cancel)\] /u.test(line))fs.appendFileSync(path.join(root,'journal-failure.log'),line+'\n');
    }
  });
  await app.evaluate(({net},{marker,alternateMarker,spent})=>{
    const actual=net.fetch.bind(net);
    globalThis.historyTaskWire=[];
    net.fetch=async(input,init)=>{
      const url=new URL(typeof input==='string'?input:input.url);
      if(url.origin!=='https://api.deepseek.com'||url.pathname!=='/v1/chat/completions')return actual(input,init);
      if(spent+globalThis.historyTaskWire.length>=12)throw Error('Frozen history task evaluation exceeds 12 provider calls');
      const body=JSON.parse(init.body);
      const hasMarker=content=>JSON.stringify(content??'').includes(marker);
      const record={model:body.model,effort:body.reasoning_effort,maxTokens:body.max_tokens,status:0,
        sourceRoles:body.messages.filter(m=>hasMarker(m.content)).map(m=>m.role),
        alternateRoles:body.messages.filter(m=>JSON.stringify(m.content??'').includes(alternateMarker)).map(m=>m.role)};
      globalThis.historyTaskWire.push(record);
      const started=Date.now();
      const response=await actual(input,init);
      record.status=response.status;
      void response.clone().text().then(stream=>{
        for(const line of stream.split('\n').filter(x=>x.startsWith('data: {'))){
          const item=JSON.parse(line.slice(6));
          if(item.usage)record.usage=item.usage;
        }
        record.elapsedMs=Date.now()-started;
      }).catch(()=>{});
      if(globalThis.failHistoryTaskAfterAcknowledgement&&response.ok&&record.sourceRoles.includes('user')){
        globalThis.failHistoryTaskAfterAcknowledgement=false;
        record.controlledStreamFailure=true;
        const body=new ReadableStream({start(controller){controller.error(Error('controlled post-acknowledgement stream interruption'));}});
        return new Response(body,{status:response.status,headers:response.headers});
      }
      return response;
    };
  },{marker,alternateMarker,spent:report.provider.length});
  page=await app.firstWindow();
  await composer().waitFor();
  await assertIsolatedPiMain(app,main,profile);
}
async function close(){
  if(!app)return;
  report.provider.push(...await provider().catch(()=>[]));
  await app.close();
  app=undefined;
}
try{
  await launch();
  const sourceSession=await until(async()=>{const id=await session();return id?.startsWith('aisession_')?id:null;});
  if(keyboardHistory){
    const saved='这是按键打开查找时保留的合成草稿。';
    await composer().fill(saved);
    const open=page.getByTestId('history-lookup-open');
    await open.press('Enter');
    const query=page.getByTestId('history-lookup-query');
    await query.waitFor();
    assert.equal(await query.evaluate(el=>document.activeElement===el),true,'The search input must receive keyboard focus when opened');
    await query.press('Escape');
    await page.getByTestId('history-lookup').waitFor({state:'hidden'});
    await until(()=>open.evaluate(el=>document.activeElement===el));
    assert.equal(await composer().inputValue(),saved);
    pass('Keyboard opening and cancellation restore lookup focus and preserve the draft');
  }
  if(namedHistory){
    await page.getByTestId('workbench-manage-history').click();
    const manage=page.getByTestId('workbench-history-dialog');
    await manage.getByTestId('ai-conversation-session-'+sourceSession).click({button:'right'});
    await page.getByTestId('ai-conversation-context-rename').click();
    const name=manage.getByTestId('ai-conversation-rename-session-'+sourceSession);
    await name.fill(declaredTitle);
    await name.press('Enter');
    await until(()=>read('SELECT title FROM ai_conversation_sessions WHERE id=?',sourceSession)[0]?.title===declaredTitle);
    await manage.getByRole('button',{name:'关闭',exact:true}).click();
  }
  await send(sourceSession,source,{answer:'请简短确认这条温度计实验合成记录。这是记录，不需要把句子当成长期偏好。'});
  const row=read("SELECT id FROM ai_conversation_messages WHERE session_id=? AND role='user' AND content=?",sourceSession,source)[0];
  assert(row?.id);
  let alternative;
  if(vagueChoice){
    await page.getByTestId('pi-new-session').click();
    const id=await until(async()=>{const id=await session();return id?.startsWith('aisession_')&&id!==sourceSession?id:null;});
    await send(id,alternateSource,{answer:'这是合成记录，请简单确认收到。'});
    const candidate=read("SELECT id FROM ai_conversation_messages WHERE session_id=? AND role='user' AND content=?",id,alternateSource)[0];
    assert(candidate?.id);
    alternative={sessionId:id,recordId:candidate.id};
  }
  await page.getByTestId('pi-new-session').click();
  const target=await until(async()=>{const id=await session();return id?.startsWith('aisession_')&&id!==sourceSession&&id!==alternative?.sessionId?id:null;});
  const opening=app.waitForEvent('window');
  await page.getByRole('button',{name:'设置',exact:true}).click();
  const settings=await opening;
  await settings.getByTestId('pi-settings-tab-teacher-memory').click();
  await settings.getByTestId('history-settings-session').selectOption(sourceSession);
  const entry=settings.getByTestId('history-settings-source-'+row.id);
  await entry.getByRole('button',{name:'查看来源'}).click();
  await entry.getByTestId('history-settings-allow').click();
  await settings.getByTestId('history-settings-notice').getByText(/已允许查找/).waitFor();
  const allowed=read('SELECT source_id,generation FROM memory_source_access WHERE record_id=?',row.id)[0];
  assert(allowed.source_id);
  if(alternative){
    await settings.getByTestId('history-settings-session').selectOption(alternative.sessionId);
    const other=settings.getByTestId('history-settings-source-'+alternative.recordId);
    await other.getByRole('button',{name:'查看来源'}).click();
    await other.getByTestId('history-settings-allow').click();
    await until(()=>read('SELECT source_id FROM memory_source_access WHERE record_id=? AND discover_allowed=1',alternative.recordId)[0]);
  }
  await Promise.all([settings.waitForEvent('close'),settings.getByTestId('settings-window-close').click()]);

  if(vagueChoice){
    const vague='照上次那份继续。请在聊天里给出温度计实验记录里的复核口令。';
    const requests=(await provider()).length;
    await composer().fill(vague);
    await page.getByRole('button',{name:'发送消息',exact:true}).click();
    const pending=page.getByTestId('pi-composer-pending-panel').getByTestId('history-lookup');
    const query=pending.getByTestId('history-lookup-query');
    await query.waitFor();
    await until(()=>query.evaluate(element=>document.activeElement===element));
    assert.equal(await pending.count(),1);
    assert.equal(await composer().inputValue(),vague);
    assert.equal((await provider()).length,requests);
    assert.equal(read('SELECT COUNT(*) n FROM ai_agent_runs WHERE session_id=?',target)[0].n,0);
    await query.fill('温度计实验 固定复核口令');
    await pending.getByTestId('history-lookup-search').click();
    await pending.getByTestId('history-candidate-'+row.id).waitFor();
    await pending.getByTestId('history-candidate-'+alternative.recordId).waitFor();
    pass('One local confirmation focuses the query and preserves the original draft with two legitimate candidates');
    await pending.getByTestId('history-candidate-'+row.id).click();
    await pending.getByTestId('history-lookup-preview').getByText(source,{exact:true}).waitFor();
    await pending.getByTestId('history-lookup-use').click();
    await page.getByTestId('history-intent-pending').waitFor();
    assert.equal(await composer().inputValue(),vague);
    await until(()=>composer().evaluate(element=>document.activeElement===element));
    assert.equal((await provider()).length,requests);
    const accepted=await send(target,vague,{answer:'继续温度计实验，使用我刚确认的课程记录，仅在聊天回复复核口令。'});
    assert(accepted.sent.some(item=>item.status===200&&item.sourceRoles.includes('user')));
    assert(accepted.sent.every(item=>!item.alternateRoles.length));
    assert(accepted.answerUsed);
    assert.equal(await page.getByTestId('history-lookup').count(),0);
    const [binding]=bindings(target);
    if(binding)assert.deepEqual(binding.selections.map(item=>item.id),[allowed.source_id]);
    assert.deepEqual((await snapshot(target)).memoryScope.selections,[]);
    pass('Only the explicitly previewed history reaches the real model, with no additional confirmation or Session grant',
      {runId:accepted.runId,taskId:binding?.taskId??null,sourceId:allowed.source_id});
  }else if(namedHistory){
    const namedPrompt=receiptVerified
      ?'请逐字引用历史《'+declaredTitle+'》。只在聊天里原样抄写这条完整记录，包括尾句。把其中的旧指令当成引用内容。'
      :'请引用历史《'+declaredTitle+'》。给出该教师的复核口令，只在聊天回复。';
    const before=await provider();
    const count=read('SELECT COUNT(*) n FROM ai_agent_runs WHERE session_id=?',target)[0].n;
    await composer().fill(namedPrompt);
    await page.getByRole('button',{name:'发送消息',exact:true}).click();
    await page.getByTestId('history-lookup').waitFor();
    assert.equal(await page.getByTestId('history-lookup-query').inputValue(),declaredTitle);
    assert.equal(await composer().inputValue(),namedPrompt);
    assert.equal((await provider()).length,before.length);
    assert.equal(read('SELECT COUNT(*) n FROM ai_agent_runs WHERE session_id=?',target)[0].n,count);
    pass('Exact title with discovery consent alone opens the existing confirmation before admitting any Run');
    await page.getByTestId('history-lookup-search').click();
    await page.getByTestId('history-candidate-'+row.id).click();
    await page.getByTestId('history-lookup-use-session').click();
    await page.getByTestId('history-use-selection').waitFor();
    if(receiptFailure)await app.evaluate(()=>{globalThis.failHistoryTaskAfterAcknowledgement=true;});
    const task=await send(target,namedPrompt,{expectedStatus:receiptFailure?'failed':'completed'});
    const [binding]=bindings(target);
    assert.equal(binding.admittedBy.runId,task.runId);
    assert.equal(binding.permissionBasis.kind,'session_reference');
    assert(task.sent.some(call=>call.status===200&&call.sourceRoles.includes('user')));
    assert.equal(await page.getByTestId('history-lookup').count(),0);
    pass('One exact, currently authorized Session source binds directly to a real Task',{answerUsed:task.answerUsed});
    const reads=read("SELECT value_json FROM app_settings WHERE key GLOB ?",
      'xiaozhi.memory.reference-readback.v1:'+task.runId+':*').map(row=>JSON.parse(row.value_json));
    assert.deepEqual(reads.map(item=>[item.id,item.reason]),[[binding.selections[0].id,'task']]);
    assert.deepEqual(Object.keys(reads[0]).sort(),['estimatedTokens','fingerprint','id','reason','scopeVersion','version']);
    const historyPanel=page.getByTestId('history-task-selection');
    if(receiptVerified){
      const results=read("SELECT content FROM ai_conversation_messages WHERE session_id=? AND role='assistant' AND json_extract(metadata_json,'$.agentRunId')=?",target,task.runId);
      assert.equal(results.length,1);
      assert(results[0].content.includes(source),'The committed reply must independently contain the exact complete authorized source');
      await historyPanel.getByText(/已核对回复中的原文/).waitFor();
      pass('Persisted reply independently verifies the explicit complete verbatim-source requirement',{runId:task.runId});
    }else{
      await historyPanel.getByText(/已提供给模型，仍待核验成果/).waitFor();
      pass('The real desktop distinguishes source readback and acknowledged delivery from verified use',{runId:task.runId});
    }
    if(receiptFailure){
      const request=task.sent.find(call=>call.controlledStreamFailure);
      assert.equal(request?.status,200,'The provider must acknowledge the actual request before the controlled fault');
      assert.equal(read('SELECT status FROM ai_agent_runs WHERE id=?',task.runId)[0].status,'failed');
      await page.getByTestId('history-task-run-failed').waitFor();
      pass('A failed Run retains its specific provider delivery while exposing the durable failure state',{runId:task.runId});
    }
    if(compactionMemory){
      assert.equal(task.answerUsed,true,'The first full Task must actually use the authorized source before testing revocation');
      await revokeThenCompact(target,sourceSession,row.id,allowed);
    }else{
      const calls=(await provider()).length;
      const vague='照上次那份继续。';
      await composer().fill(vague);
      await page.getByRole('button',{name:'发送消息',exact:true}).click();
      await page.getByTestId('history-lookup').waitFor();
      assert.equal(await composer().inputValue(),vague);
      const query=page.getByTestId('history-lookup-query');
      if(keyboardHistory)await until(()=>query.evaluate(el=>document.activeElement===el));
      await query.fill(declaredTitle);
      if(keyboardHistory)await query.press('Enter');
      else await page.getByTestId('history-lookup-search').click();
      await page.getByTestId('history-candidate-'+row.id).waitFor();
      assert.equal((await provider()).length,calls);
      assert.deepEqual(bindings(target),[binding]);
      pass('Vague history opens one local confirmation with the preserved draft and no prompt delivery');
      if(keyboardHistory){
        const searchInput=page.getByTestId('history-lookup-query');
        await searchInput.press('Escape');
        await page.getByTestId('history-lookup').waitFor({state:'hidden'});
        await until(()=>composer().evaluate(el=>document.activeElement===el));
        const sessionSelections=(await snapshot(target)).memoryScope.selections;
        assert(sessionSelections.some(item=>item.layer==='history'&&item.id===binding.selections[0].id));
        await page.getByTestId('history-task-selection').getByRole('button',{name:/停止引用/}).press('Enter');
        await page.getByTestId('history-task-selection').waitFor({state:'hidden'});
        const remaining=(await snapshot(target)).memoryScope.selections;
        assert.deepEqual(remaining,sessionSelections);
        assert.equal(await composer().inputValue(),vague);
        await page.getByTestId('pi-new-session').click();
        const next=await until(async()=>{const id=await session();return id?.startsWith('aisession_')&&id!==target?id:null;});
        await until(async()=>!(await snapshot(next)).taskHistory);
        assert.equal(await page.getByTestId('history-lookup').count(),0);
        assert.equal((await provider()).length,calls);
        pass('Keyboard stops Task use while preserving Session use, drafts and conversation isolation');
      }
    }
  }else if(exclusion){
    await composer().fill(taskRequest);
    await page.getByTestId('history-lookup-open').click();
    await page.getByTestId('history-lookup-query').fill(search);
    await page.getByTestId('history-lookup-search').click();
    await page.getByTestId('history-candidate-'+row.id).click();
    await page.getByTestId('history-lookup-preview').getByText(source,{exact:true}).waitFor();
    await page.getByTestId('history-lookup-use-session').click();
    await page.getByTestId('history-use-selection').waitFor();
    const sessionScope=(await snapshot(target)).memoryScope;
    assert.equal(sessionScope.selections[0].id,allowed.source_id);
    const excluded=await send(target,'本任务不用历史。请制作一份温度计实验检查表标题，标题为《实验检查表》。仅在聊天中给出标题。');
    assert(excluded.sent.every(call=>!call.sourceRoles.length));
    const [binding]=bindings(target);
    assert.equal(binding.excludeSessionHistory,true);
    assert.equal(binding.admittedBy.runId,excluded.runId);
    await page.getByTestId('history-task-selection').getByText(/当前任务已停用会话历史/).waitFor();
    pass('Teacher exclusion applies to the admitted Task with a live Session selection');
    await close();
    await launch();
    if(await session()!==target)await page.getByTestId('workbench-session-'+target).click();
    await until(async()=>await session()===target);
    await page.getByTestId('history-task-selection').getByText(/当前任务已停用会话历史/).waitFor();
    const follow=await send(target,'只改刚才标题的末尾标点为句号，其他照旧。标题已指定为《实验检查表》，只在聊天里给出标题。',{
      answer:'标题为《实验检查表》，只修改标题末尾标点为句号。'
    });
    assert(follow.sent.every(call=>!call.sourceRoles.length));
    assert.equal((await snapshot(target)).task.id,binding.taskId);
    assert.deepEqual((await snapshot(target)).memoryScope,sessionScope);
    pass('Cold restart and a same-Task amendment still exclude the Session source');
    const another=await send(target,'请读取本会话已选的教学记忆，找到温度计实验的复核口令。先调用 read_education_memory，再用原话回答。');
    assert(another.sent.some(call=>call.status===200&&call.sourceRoles.includes('tool')));
    assert.notEqual((await snapshot(target)).task.id,binding.taskId);
    assert.deepEqual((await snapshot(target)).memoryScope,sessionScope);
    pass('A separate new Task can still use the original explicit Session source');
  }else{
    const earlier=await send(target,'请整理三个课堂观察步骤，只用聊天回复。');
    assert(earlier.sent.every(r=>!r.sourceRoles.length));
    const initial=(await snapshot(target)).memoryScope;
    const checkpoint=(await provider()).length;
    await stage(row.id,taskRequest);
    assert.equal((await provider()).length,checkpoint);
    assert.deepEqual((await snapshot(target)).memoryScope,initial);
    assert.equal(bindings(target).length,0);
    await page.screenshot({path:path.join(root,'draft-reference.png')});
    pass('Staging with a previous task writes neither a Task binding nor a Session grant');
    const task=await send(target,taskRequest);
    const [binding]=bindings(target);
    assert.equal(bindings(target).length,1);
    assert.equal(binding.admittedBy.runId,task.runId);
    assert.notEqual(binding.admittedBy.runId,earlier.runId);
    assert.equal(binding.selections[0].id,allowed.source_id);
    assert.equal(binding.selections[0].version,allowed.generation);
    assert(task.sent.some(r=>r.status===200&&r.sourceRoles.includes('user')));
    const taskReceipt=read("SELECT reason,source_id,scope_version FROM xiaozhi_memory_reference_deliveries WHERE run_id=?",task.runId);
    assert.deepEqual(taskReceipt.map(row=>[row.reason,row.source_id,row.scope_version]),[['task',allowed.source_id,0]]);
    assert.deepEqual((await snapshot(target)).memoryScope,initial);
    pass('A new actual Task owns the binding and the source reached DeepSeek', {taskId:binding.taskId,runId:task.runId,sourceId:allowed.source_id,answerUsed:task.answerUsed});
    await page.getByTestId('history-task-selection').waitFor();
    const followup=await send(target,'只改刚才清单的标题为《实验复核》，其他内容照旧。核对教师已授权的历史。');
    assert(followup.sent.some(r=>r.status===200&&r.sourceRoles.includes('user')));
    assert.equal((await snapshot(target)).task.id,binding.taskId);
    assert.equal(bindings(target).length,1);
    pass('A requirements amendment preserves the existing Task source',{runId:followup.runId,taskId:binding.taskId});
    const nextAmendment=await send(target,'继续修改刚才清单，只把第一个要点改为一句简短的提醒，保留老师的原话和其余要点。请直接在对话中给出修改后的清单。');
    assert(nextAmendment.sent.some(call=>call.status===200 && call.sourceRoles.includes('user')));
    assert.equal((await snapshot(target)).task.id,binding.taskId);
    assert.deepEqual(bindings(target),[binding]);
    pass('Two consecutive amendments use the same granted source and Task without asking for another reference',
      {taskId:binding.taskId,runIds:[followup.runId,nextAmendment.runId]});
    await stage(row.id,question);
    await page.getByRole('button',{name:'移除待发送历史 1'}).click();
    await page.getByTestId('history-intent-pending').waitFor({state:'hidden'});
    assert.equal(await composer().inputValue(),question);
    assert.equal(bindings(target).length,1);
    pass('Removing pending history preserves the draft and existing binding');
    await stage(row.id,question);
    const turn=await send(target,question);
    assert(turn.sent.some(r=>r.status===200&&r.sourceRoles.includes('user')));
    assert.deepEqual(read('SELECT reason,source_id FROM xiaozhi_memory_reference_deliveries WHERE run_id=?',turn.runId)
      .map(row=>[row.reason,row.source_id]),[['turn',allowed.source_id]]);
    assert.deepEqual(bindings(target),[binding]);
    pass('Ordinary question receives the Turn reference with no durable grant',{runId:turn.runId,answerUsed:turn.answerUsed});
    const next=await send(target,'请简述物态变化中的凝固是什么？');
    assert(next.sent.every(r=>!r.sourceRoles.length));
    assert.deepEqual(bindings(target),[binding]);
    assert.deepEqual((await snapshot(target)).memoryScope,initial);
    pass('Following unrelated question sends no former Task or Turn source',{runId:next.runId});
    const journal=read('SELECT session_file FROM xiaozhi_pi_session_bindings WHERE conversation_id=?',target)[0]?.session_file;
    assert(journal);
    const native=path.join(data,'xiaozhi-pi',journal),prefix=fs.readFileSync(native);
    await close();
    await launch();
    if(await session()!==target)await page.getByTestId('workbench-session-'+target).click();
    await until(async()=>await session()===target);
    const taskPanel=page.getByTestId('history-task-selection');
    await taskPanel.waitFor();
    assert.deepEqual(bindings(target),[binding]);
    assert.equal((await snapshot(target)).task.id,binding.taskId);
    assert(fs.readFileSync(native).subarray(0,prefix.length).equals(prefix));
    pass('Cold Electron restart restores the Task and preserves the prior Pi JSONL bytes',{prefixHash:createHash('sha256').update(prefix).digest('hex')});
    await composer().fill('请保留这句未发送草稿。');
    await taskPanel.getByRole('button',{name:/停止引用/}).click();
    await taskPanel.waitFor({state:'hidden'});
    assert.equal(await composer().inputValue(),'请保留这句未发送草稿。');
    const [removed]=bindings(target);
    assert.equal(removed.revision,binding.revision+1);
    assert.deepEqual(removed.selections,[]);
    assert.deepEqual((await snapshot(target)).memoryScope,initial);
    assert.equal(read('SELECT index_allowed FROM memory_source_access WHERE source_id=?',allowed.source_id)[0].index_allowed,1);
    const after=await send(target,'只改刚才标题的标点，其他不变。请基于当前任务说明。',{
      answer:'标题是《实验复核》。把标题末尾标点改为全角句号，其他内容不变。只在聊天中给出新标题。'
    });
    assert(after.sent.every(r=>!r.sourceRoles.length));
    pass('Teacher removes one Task reference, preserving the draft, Session scope and discovery permission',{runId:after.runId});
  }
  report.ok=true;
}catch(error){
  report.failure=String(error?.stack??error);
  const startup=path.join(profile,'xiaozhi-database-startup.json');
  if(fs.existsSync(startup))report.databaseStartup=JSON.parse(fs.readFileSync(startup,'utf8'));
  if(page)await page.screenshot({path:path.join(root,'failure.png')}).catch(()=>{});
  throw error;
}finally{
  await close().catch(()=>{});
  fs.writeFileSync(path.join(root,'report.json'),JSON.stringify(report,null,2)+'\n');
  console.log(root);
}
