import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {setTimeout as delay} from 'node:timers/promises';
import {startWorkbenchFixture} from './phase7-workbench-fixture.mjs';

const size = process.argv[2] ?? '1366x768';
assert(['1366x768','1920x1080'].includes(size), 'Use a supported acceptance viewport');
const [width,height] = size.split('x').map(Number);
let fixture = await startWorkbenchFixture({background:true});
let page = fixture.page;
const {root,output,main} = fixture;
const report = {success:false,root,viewport:{width,height},checks:[],pageErrors:[],paidCalls:0,
  mainSha256:createHash('sha256').update(fs.readFileSync(main)).digest('hex')};
async function attachViewport() {
  page.on('pageerror',error=>report.pageErrors.push(error.message));
  await fixture.application.evaluate(({BrowserWindow},size)=>{
    BrowserWindow.getAllWindows()[0].setContentSize(size.width,size.height);
  },{width,height});
  await page.setViewportSize({width,height});
  assert.deepEqual(await page.evaluate(()=>({width:innerWidth,height:innerHeight})),{width,height});
}
const testId = id => page.getByTestId(id);
const input = () => testId('office-prompt-input');
const activeId = () => page.locator('.office-composer-container').getAttribute('data-session-id');
const snapshot = id => page.evaluate(id=>window.omniEdu.getXiaozhiSnapshot(id),id);
function read(query, ...values) {
  const db = new DatabaseSync(path.join(root,'data/app.db'),{readOnly:true});
  try { return db.prepare(query).all(...values); }
  finally { db.close(); }
}
async function until(fn, message, timeout=25000) {
  const stop=Date.now()+timeout;
  while(Date.now()<stop){const result=await fn();if(result)return result;await delay(75);}
  throw Error(message);
}
async function newSession() {
  const prior=await activeId();
  await testId('pi-new-session').click();
  const id=await until(async()=>{const id=await activeId();return id && id!==prior && id;},'New session not visible');
  await until(()=>input().isEnabled(),'New composer not ready');
  return id;
}
async function closeWorkbench() {
  const toggle = testId('pi-workbench-open');
  if(await toggle.getAttribute('aria-expanded')==='true') await toggle.click();
  await testId('pi-workbench').waitFor({state:'hidden'});
}
async function select(id) {
  if(await activeId()===id)return;
  await closeWorkbench();
  const history = testId('edu-history-panel');
  const toggle = testId('pi-sidebar-toggle');
  if(await toggle.getAttribute('aria-expanded')!=='true') await toggle.click();
  await history.waitFor();
  await history.getByTestId('ai-conversation-session-'+id).click();
  await until(async()=>await activeId()===id && await input().isVisible(),'Selected session failed to hydrate');
}
async function send(text) {
  await input().fill(text);
  await page.getByRole('button',{name:'发送消息',exact:true}).click();
}
const stopButton=()=>page.getByRole('button',{name:'停止本轮',exact:true});
const check = (name,details={}) => {report.checks.push({name,...details});console.log('PASS '+name);};
async function save(title,answer,session,run) {
  await page.getByText(answer,{exact:true}).waitFor();
  await testId('reply-save').last().click();
  await testId('reply-save-title').fill(title);
  await testId('reply-save-confirm').click();
  await testId('reply-dialog').waitFor({state:'hidden'});
  const rows=read("SELECT * FROM document_artifacts WHERE session_id=? AND title=?",session,title);
  assert.equal(rows.length,1);
  const item=rows[0];
  const messages=read("SELECT id FROM ai_conversation_messages WHERE session_id=? AND json_extract(metadata_json,'$.agentRunId')=? AND role='assistant'",session,run);
  assert(messages.some(message=>message.id===item.message_id),'Artifact must link to the assistant message from its exact Run');
  assert(fs.readFileSync(item.file_path,'utf8').includes(answer));
  return {artifact:item.id,session,run,hash:createHash('sha256').update(fs.readFileSync(item.file_path)).digest('hex')};
}

try {
  await attachViewport();
  const a=await newSession();
  fs.writeFileSync(path.join(root,'stream-delay-ms.txt'),'3000');
  await send('W3 原运行 合成课堂资料，请输出供教师核对。');
  await page.getByText('已核对合成要求。',{exact:true}).waitFor();
  const active=await snapshot(a);
  const old=active.projection.turns.at(-1).id;
  await fixture.application.evaluate(({BrowserWindow},{sessionId,runId})=>{
    const sender=BrowserWindow.getAllWindows()[0].webContents;
    const send=sender.send.bind(sender);
    const held=[];
    globalThis.delayedWorkBench={held,send};
    sender.send=(channel,...args)=>{
      const e=args[0];
      if(channel==='xiaozhi:event' && e?.sessionId===sessionId && e.runId===runId &&
        (e.kind==='task'||e.kind==='status'&&e.status==='interrupted')) {
        held.push(structuredClone(e));
        return;
      }
      send(channel,...args);
    };
  },{sessionId:a,runId:old});
  await stopButton().click();
  const stopped=await until(async()=>{const view=await snapshot(a);return !view.running&&view.task?.state==='interrupted'&&view;},'Original Task not interrupted');
  const held=await until(async()=>{const list=await fixture.application.evaluate(()=>globalThis.delayedWorkBench.held);return list.some(e=>e.kind==='status')&&list.some(e=>e.kind==='task')&&list;},'No original terminal status and task captured');
  for(const event of held) {
    const [persisted]=read('SELECT event_json,event_hash FROM xiaozhi_event_journal WHERE run_id=? AND sequence=?',old,event.sequence);
    assert(persisted,'Captured notification must be persisted');
    assert.deepEqual(JSON.parse(persisted.event_json),event);
    assert.equal(createHash('sha256').update(persisted.event_json).digest('hex'),persisted.event_hash);
  }
  check('The held status and task are genuine generation 1 events from the original durable journal',{old,held:held.map(e=>[e.kind,e.sequence,e.generation])});

  await fixture.application.evaluate(({net})=>{
    const fallback=net.fetch.bind(net);
    const queue=new Map();
    globalThis.workbenchHolds=queue;
    net.fetch=async(input,init)=>{
      const url=typeof input==='string'?input:input instanceof URL?input.href:input.url;
      if(!url.endsWith('/chat/completions'))return fallback(input,init);
      const body=JSON.parse(init.body);
      const messages=JSON.stringify(body.messages);
      const key=messages.includes('W3-B-ISOLATED')?'B':'A';
      return new Promise(resolve=>queue.set(key,answer=>{
        const event={id:'fixture-'+key,object:'chat.completion.chunk',created:1,model:body.model};
        const parts=[{delta:{role:'assistant',content:answer},finish_reason:null},{delta:{},finish_reason:'stop'}];
        const text=parts.map(item=>'data: '+JSON.stringify({...event,choices:[{index:0,...item}]})+'\n\n').join('')+'data: [DONE]\n\n';
        resolve(new Response(text,{status:200,headers:{'content-type':'text/event-stream'}}));
      }));
    };
  });
  const pending=key=>fixture.application.evaluate((_,key)=>globalThis.workbenchHolds.has(key),key);
  const release=(key,answer)=>fixture.application.evaluate((_,input)=>{const queue=globalThis.workbenchHolds;const done=queue.get(input.key);if(!done)throw Error('Model not suspended');queue.delete(input.key);done(input.answer);},{key,answer});
  const b=await newSession();
  await send('W3-B-ISOLATED 请给另外一个合成课堂答案。');
  await until(()=>pending('B'),'B did not start its own model request');
  await select(a);
  await testId('pi-workbench-open').click();
  const row=page.locator('[data-testid="pi-task-overview-row"][data-task-id="'+stopped.task.id+'"]');
  await row.getByTestId('pi-task-overview-continue').click();
  await until(()=>pending('A'),'Same Task did not start a new model request');
  const resumed=await snapshot(a);
  assert(resumed.running);
  assert.equal(resumed.task.id,stopped.task.id);
  const newRun=resumed.task.binding.runId;
  assert.notEqual(newRun,old);
  const owner=(id,run)=>read('SELECT run_id,generation FROM xiaozhi_event_runs WHERE session_id=? AND run_id=?',id,run)[0];
  assert(owner(a,newRun).generation>owner(a,old).generation);
  assert.equal(read('SELECT run_id FROM xiaozhi_event_owners WHERE session_id=?',a)[0].run_id,newRun);
  await closeWorkbench();
  await stopButton().waitFor();
  await page.evaluate(runId=>{
    window.observedLateSequences=[];
    window.omniEdu.onXiaozhiEvent(event=>{
      if(event.runId===runId)window.observedLateSequences.push(event.sequence);
    });
  },old);
  await fixture.application.evaluate(()=>{
    const {held,send}=globalThis.delayedWorkBench;
    send('xiaozhi:event',held.find(e=>e.kind==='status'));
  });
  const lateStatusSequence=held.find(event=>event.kind==='status').sequence;
  await page.waitForFunction(sequence=>window.observedLateSequences.includes(sequence),lateStatusSequence);
  await delay(250);
  assert(await stopButton().isVisible(),'Old terminal status must not stop new Run UI');
  const current=await snapshot(a);
  assert(current.running);
  assert.equal(current.task.binding.runId,newRun);
  assert.equal(current.task.revision,resumed.task.revision);
  await page.screenshot({path:path.join(output,'new-generation-after-old-status.png')});
  check('Old interrupted status delivered in A while its newer generation is running; current binding, revision, and stop control remain');

  await select(b);
  await stopButton().waitFor();
  const bRunning=await snapshot(b);
  const bRun=bRunning.projection.turns.at(-1).id;
  await fixture.application.evaluate(()=>{
    const {held,send}=globalThis.delayedWorkBench;
    for(const event of held.filter(e=>e.kind==='task'))send('xiaozhi:event',event);
  });
  const lateTaskSequences=held.filter(event=>event.kind==='task').map(event=>event.sequence);
  await page.waitForFunction(sequences=>sequences.every(sequence=>window.observedLateSequences.includes(sequence)),lateTaskSequences);
  await delay(250);
  assert(await stopButton().isVisible(),'Other session must stay on its active response');
  assert.equal(await activeId(),b);
  assert.equal(await page.locator('.ai-conversation-frame').getByText('W3 原运行',{exact:false}).count(),0);
  const bAfter=await snapshot(b);
  assert.deepEqual(bAfter.projection.turns.map(turn=>turn.id),[bRun]);
  assert.notEqual(bAfter.task.id,stopped.task.id);
  await page.screenshot({path:path.join(output,'other-session-after-late-task.png')});
  check('Old task notification delivered with session B foreground and active; no task or turn changed');

  const exports=path.join(root,'teacher-exports');
  fs.mkdirSync(exports);
  await fixture.application.evaluate(({dialog},destination)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[destination]});},exports);
  const answerB='ONLY-B-TEACHING-ANSWER';
  const answerA='ONLY-A-GENERATION-TWO';
  await release('B',answerB);
  await until(async()=>!(await snapshot(b)).running,'B did not settle');
  const artifactB=await save('W3会话B讲义',answerB,b,bRun);
  await select(a);
  await release('A',answerA);
  await until(async()=>!(await snapshot(a)).running,'A did not settle');
  const artifactA=await save('W3恢复讲义',answerA,a,newRun);
  assert.notEqual(artifactA.artifact,artifactB.artifact);
  assert.notEqual(artifactA.hash,artifactB.hash);
  check('Teacher saves separate artifacts through their actual reply menus',{artifactA,artifactB});
  const original=read("SELECT id,session_id,message_id,title,file_path FROM document_artifacts WHERE title IN ('W3会话B讲义','W3恢复讲义') ORDER BY id");
  await fixture.close();
  fixture = undefined;

  fixture = await startWorkbenchFixture({root,background:true});
  page = fixture.page;
  await attachViewport();
  await select(a);
  await page.getByText(answerA,{exact:true}).waitFor();
  assert(!(await page.getByText(answerB,{exact:true}).isVisible()));
  assert.equal((await snapshot(a)).task.id,stopped.task.id);
  await select(b);
  await page.getByText(answerB,{exact:true}).waitFor();
  assert(!(await page.getByText(answerA,{exact:true}).isVisible()));
  assert.deepEqual(read("SELECT id,session_id,message_id,title,file_path FROM document_artifacts WHERE title IN ('W3会话B讲义','W3恢复讲义') ORDER BY id"),original);
  for (const artifact of [artifactA,artifactB]) {
    const row=original.find(row=>row.id===artifact.artifact);
    assert(row);
    assert.equal(createHash('sha256').update(fs.readFileSync(row.file_path)).digest('hex'),artifact.hash);
  }
  assert.equal(fixture.requests.length,0);
  assert.deepEqual(report.pageErrors,[]);
  await page.screenshot({path:path.join(output,'other-session-after-cold-open.png')});
  check('Cold reopen retains both conversations, original Task and artifact links, with zero model replay');
  report.success=true;
} catch(error) {
  report.error=String(error.stack||error);
  await page.screenshot({path:path.join(output,'delayed-events-failure.png')}).catch(()=>{});
} finally {
  if(fixture)await fixture.close().catch(error=>{report.closeError=String(error);report.success=false;});
  fs.writeFileSync(path.join(output,'delayed-events-report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report));
  if(!report.success)process.exitCode=1;
}
