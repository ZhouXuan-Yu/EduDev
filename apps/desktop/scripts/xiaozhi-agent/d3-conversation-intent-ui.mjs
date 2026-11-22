import assert from 'node:assert/strict';
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
  requests.push({tools:body.tools?.map(tool=>tool.function?.name).filter(Boolean)??[],messages:body.messages.length});
  response.setHeader('content-type','text/event-stream');
  const chunk=(delta,finish_reason)=>'data: '+JSON.stringify({id:'owned-d3',object:'chat.completion.chunk',created:1,
    model:'deepseek-flash',choices:[{index:0,delta,finish_reason}]})+'\n\n';
  response.write(chunk({role:'assistant',content:'已完成这轮合成验收回复。'},null));
  response.end(chunk({},'stop')+'data: [DONE]\n\n');
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
async function send(text){
  const previous=(await snapshot()).projection.turns.length;
  const input=page.getByTestId('office-prompt-input');
  await input.fill(text);await input.press('Enter');
  const deadline=Date.now()+45_000;
  while(Date.now()<deadline){
    const state=await snapshot(),turn=state.projection.turns.at(-1);
    if(state.projection.turns.length>previous&&!state.running&&['completed','failed','interrupted'].includes(turn?.status))return {state,turn};
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  throw Error('The submitted turn did not reach persisted terminal status');
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

  await app.close();app=undefined;await launch();
  if(await activeSession()!==sessionId){
    if(!await page.getByTestId('edu-history-panel').isVisible())await page.getByTestId('pi-sidebar-toggle').click();
    await page.getByTestId('ai-conversation-session-'+sessionId).click();
    await page.waitForFunction(id=>document.querySelector('.office-composer-container')?.getAttribute('data-session-id')===id,sessionId);
  }
  assert((await snapshot()).projection.turns.some(turn=>turn.id===first.turn.id&&turn.status==='completed'));
  const resumed=await send('继续');
  assert.equal(resumed.turn.status,'completed',resumed.turn.error);
  assert.equal(resumed.turn.task?.id,created[0].id);
  assert.equal(taskRecords().length,1);
  assert.deepEqual(rendererErrors,[]);
  await page.screenshot({path:path.join(output,'conversation-after-restart.png')});
  check('重启后普通问答可读，教师继续时恢复原任务');
}catch(error){failure=error;process.exitCode=1;console.error(error.stack);}
finally{
  await app?.close().catch(()=>undefined);
  fixture.closeAllConnections();await new Promise(resolve=>fixture.close(resolve));
  const report={success:!failure,checks,requests,rendererErrors,main,output,error:failure?.message};
  fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report));
}
