import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import {_electron as electron} from 'playwright';
import {testMain,assertIsolatedPiMain} from '../acceptance/build-root.mjs';

const desktop=path.resolve(import.meta.dirname,'../..'),main=testMain(desktop);
const root=fs.mkdtempSync(path.join(process.env.OMNI_EDU_ACCEPTANCE_ROOT||os.tmpdir(),'d3-memory-scope-'));
const report={root,main,sha256:createHash('sha256').update(fs.readFileSync(main)).digest('hex'),checks:[],paidRequests:0};
const mark=(name,details)=>{report.checks.push({name,...details});console.log('PASS '+name);};
const errors=[];
let active;

async function until(read,timeout=60000) {
 const deadline=Date.now()+timeout;
 while(Date.now()<deadline){
  const result=await read();
  if(result)return result;
  await new Promise(resolve=>setTimeout(resolve,100));
 }
 throw Error('Teacher preference readback timed out');
}

async function open(name) {
 const data=path.join(root,name,'data'),profile=path.join(root,name,'profile');
 fs.mkdirSync(data,{recursive:true});
 const env={...process.env,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),OMNI_EDU_DATA_ROOT:data,
  OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_E2E_DIALOG_MODE:'1',DEEPSEEK_API_KEY:'synthetic-preference-scope',DEEPSEEK_MODEL:'deepseek-flash'};
 for(const key of ['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL'])delete env[key];
 const app=await electron.launch({args:[main,'--user-data-dir='+profile],env,cwd:desktop});
 active=app;
 await app.evaluate(({net})=>{
  globalThis.preferenceScopeRequests=[];
  net.fetch=async(input,init)=>{
   const url=new URL(typeof input==='string'?input:input.url);
   if(url.origin!=='https://api.deepseek.com')throw Error('Unexpected external request');
   if(url.pathname==='/v1/models')return new Response(JSON.stringify({object:'list',data:[
    {id:'deepseek-flash',context_window:1048576,max_output_tokens:32768,input_modalities:['text'],
     effort:{supported_levels:['low','high','max'],default_level:'high'}},
   ]}),{headers:{'content-type':'application/json'}});
   if(url.pathname!=='/v1/chat/completions')throw Error('Unexpected model route');
   const body=JSON.parse(init.body);
   const text=body.messages.flatMap(message=>typeof message.content==='string'?[message.content]:
    Array.isArray(message.content)?message.content.map(part=>part.text||''):[]).join('\n');
   globalThis.preferenceScopeRequests.push({
    patches:[...text.matchAll(/\{"version":\d+,"preferences":\[.*?\],"latestAction":"[^"]+"\}/g)].map(match=>JSON.parse(match[0]).preferences),
    currentReceipt:text.includes('[教师偏好操作结果]'),versions:text.match(/\[当前教师表达偏好/g)?.length||0,
    tools:body.tools?.length||0,
   });
   const chunk=(delta,finish_reason=null)=>'data: '+JSON.stringify({id:'d3-preference-scope',object:'chat.completion.chunk',created:0,
    model:body.model,choices:[{index:0,delta,finish_reason}]})+'\n\n';
   return new Response(chunk({role:'assistant'})+chunk({content:'<xiaozhi_answer>这是一条本地验收答复。'})+chunk({},'stop')+'data: [DONE]\n\n',
    {headers:{'content-type':'text/event-stream'}});
  };
 });
 const page=await app.firstWindow(),input=page.getByTestId('office-prompt-input');
 page.on('pageerror',error=>errors.push(String(error)));
 await input.waitFor();
 await assertIsolatedPiMain(app,main,profile);
 const session=()=>page.locator('.office-composer-container').getAttribute('data-session-id');
 const snap=async()=>page.evaluate(id=>window.omniEdu.getXiaozhiSnapshot(id),await session());
 const wire=()=>app.evaluate(()=>globalThis.preferenceScopeRequests);
 async function send(prompt){
  await until(async()=>!await input.isDisabled());
  const previous=(await snap()).projection.turns.at(-1)?.id,before=(await wire()).length;
  await input.fill(prompt);await input.press('Enter');
  await until(async()=>{
   const current=await snap(),turn=current.projection.turns.at(-1);
   return turn?.id!==previous&&turn?.status==='completed'&&!current.running;
  });
  const requests=(await wire()).slice(before);
  assert.equal(requests.length,1);
  return requests[0];
 }
 async function fresh(){
  const previous=await session(),button=page.getByTestId('ai-conversation-new');
  if(!await button.isVisible())await page.getByTestId('pi-sidebar-toggle').click();
  await button.click();
  await until(async()=>await session()!==previous&&!await input.isDisabled());
 }
 function revisions(){
  const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});
  try{return db.prepare("SELECT key,value_json,updated_at FROM app_settings WHERE key LIKE 'xiaozhi.teacher-preference.v1:version:%' ORDER BY key").all();}
  finally{db.close();}
 }
 return {app,page,data,session,send,fresh,revisions};
}

function nativeFiles(root){
 return fs.readdirSync(root,{recursive:true,withFileTypes:true}).filter(entry=>entry.isFile()&&entry.name.endsWith('.jsonl'))
  .map(entry=>path.join(entry.parentPath,entry.name));
}
function nativeLog(root){
 return nativeFiles(root).map(file=>fs.readFileSync(file,'utf8')).join('\n');
}

try{
 const first=await open('teacher-a');
 const save=await first.send('以后讲解详细些，分步骤，先给提示再给答案。');
 assert(save.currentReceipt);assert.equal(save.versions,0);
 const [saved]=first.revisions();
 assert.deepEqual(JSON.parse(saved.value_json).values,{length:'detailed',structure:'step_by_step',answerOrder:'hint_first'});
 await first.fresh();
 const greeting=await first.send('你好，打个招呼。');
 assert.equal(greeting.versions,0);
 const lesson=await first.send('为什么会下雨？');
 assert.deepEqual(lesson.patches,[['讲解详细','分步骤讲解','先给提示，再给答案']]);
 assert.equal(lesson.tools,0);
 mark('A saved preference crosses conversations only into a relevant teaching answer, including the tool-free path',{greeting,lesson});

 const brief=await first.send('这次只要一句话，说清楚水为什么会结冰。');
 const explicit=await first.send('请详细解释雾和云的区别，先给结论。');
 assert.equal(brief.versions,0);assert.deepEqual(explicit.patches,[['分步骤讲解']]);
 assert.deepEqual(first.revisions(),[saved]);
 const log=nativeLog(path.join(first.data,'xiaozhi-pi'));
 assert(!log.includes('[当前教师表达偏好：')&&!log.includes('[教师偏好操作结果]'));
 assert(log.includes('为什么会下雨？'));
 mark('Explicit guidance suppresses only conflicting preferences and native session history retains no injected block',{brief,explicit});

 const revoke=await first.send('撤销上次记住的教学偏好');
 assert(revoke.currentReceipt);assert.equal(revoke.versions,0);
 assert.deepEqual(JSON.parse(first.revisions().at(-1).value_json).values,{});
 const retained=first.revisions();
 const id=await first.session();
 await first.app.close();active=undefined;
 const cold=await open('teacher-a');
 assert.equal(await cold.session(),id);
 const after=await cold.send('为什么水结冰会膨胀？');
 assert.equal(after.versions,0);assert.deepEqual(cold.revisions(),retained);
 mark('Explicit rollback and cold restart retain versions without reintroducing old model guidance',{after});
 await cold.app.close();active=undefined;

 const second=await open('teacher-b');
 const isolated=await second.send('为什么会下雨？');
 assert.equal(isolated.versions,0);assert.deepEqual(second.revisions(),[]);
 mark('A separate teacher data root receives no preference from the first',{isolated});
 await second.app.close();active=undefined;

 const old=process.env.OMNI_EDU_LEGACY_PREFERENCE_FIXTURE;
 if(old){
  const cloned=path.join(root,'legacy','data');
  fs.mkdirSync(path.dirname(cloned),{recursive:true});
  fs.cpSync(old,cloned,{recursive:true});
  const before=nativeFiles(path.join(cloned,'xiaozhi-pi')).map(file=>[file,fs.readFileSync(file,'utf8')]);
  assert(before.some(([,bytes])=>bytes.includes('[当前教师表达偏好：')));
  const compatible=await open('legacy');
  const greeting=await compatible.send('你好，和我打个招呼。');
  assert.equal(greeting.versions,0);
  const lesson=await compatible.send('为什么水会变成水蒸气？');
  assert.equal(lesson.versions,1);
  assert(lesson.patches[0].includes('分步骤讲解'));
  for(const [file,bytes] of before)assert(fs.readFileSync(file,'utf8').startsWith(bytes));
  mark('An actual older native transcript remains on disk while its preference blocks are removed from new model requests',{greeting,lesson});
  await compatible.app.close();active=undefined;
 }
 assert.deepEqual(errors,[]);
 report.ok=true;
}catch(error){
 report.ok=false;report.error=String(error.stack);process.exitCode=1;
 if(active)await (await active.firstWindow()).screenshot({path:path.join(root,'failure.png')}).catch(()=>undefined);
}finally{
 if(active)await active.close().catch(()=>undefined);
 fs.writeFileSync(path.join(root,'report.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify(report));
}
