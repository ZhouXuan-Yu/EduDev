import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {_electron as electron} from 'playwright';
import {assertIsolatedPiMain,testMain} from './build-root.mjs';

const desktop=path.resolve(import.meta.dirname,'../..'), main=testMain(desktop);
const acceptance=process.env.OMNI_EDU_ACCEPTANCE_ROOT;
assert(acceptance&&process.env.DEEPSEEK_API_KEY,'Use an isolated acceptance root and a configured DeepSeek account.');
const root=fs.mkdtempSync(path.join(acceptance,'history-task-'));
const data=path.join(root,'data'),profile=path.join(root,'profile');
const marker='星桥读数法先蓝后绿';
const source='这是合成教师教学记录。温度计实验的固定复核口令：'+marker+'。请简短回复收到。';
const search='温度计实验 固定复核口令 星桥读数法';
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
async function send(id,text,{answer}={}){
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
  assert.equal(turn.status,'completed',turn.error);
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
  await app.evaluate(({net},{marker,spent})=>{
    const actual=net.fetch.bind(net);
    globalThis.historyTaskWire=[];
    net.fetch=async(input,init)=>{
      const url=new URL(typeof input==='string'?input:input.url);
      if(url.origin!=='https://api.deepseek.com'||url.pathname!=='/v1/chat/completions')return actual(input,init);
      if(spent+globalThis.historyTaskWire.length>=12)throw Error('Frozen history task evaluation exceeds 12 provider calls');
      const body=JSON.parse(init.body);
      const hasMarker=content=>JSON.stringify(content??'').includes(marker);
      const record={model:body.model,effort:body.reasoning_effort,maxTokens:body.max_tokens,status:0,
        sourceRoles:body.messages.filter(m=>hasMarker(m.content)).map(m=>m.role)};
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
      return response;
    };
  },{marker,spent:report.provider.length});
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
  await send(sourceSession,source);
  const row=read("SELECT id FROM ai_conversation_messages WHERE session_id=? AND role='user' AND content=?",sourceSession,source)[0];
  assert(row?.id);
  await page.getByTestId('pi-new-session').click();
  const target=await until(async()=>{const id=await session();return id?.startsWith('aisession_')&&id!==sourceSession?id:null;});
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
  await Promise.all([settings.waitForEvent('close'),settings.getByTestId('settings-window-close').click()]);
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
