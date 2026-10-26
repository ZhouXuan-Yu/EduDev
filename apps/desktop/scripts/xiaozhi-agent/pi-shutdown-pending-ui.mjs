import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {_electron as electron} from 'playwright';
import {testMain,assertIsolatedPiMain} from '../acceptance/build-root.mjs';
import {fingerprint,sha256} from '../acceptance/evidence.mjs';

const output=fs.mkdtempSync(path.resolve('test-results/xiaozhi-agent/pi-shutdown-pending-ui-'));
const main=testMain(process.cwd()),buildRoot=path.dirname(path.dirname(main));
const manifest=JSON.parse(fs.readFileSync(path.join(path.dirname(buildRoot),'build-isolated.json')));
const build=fingerprint(buildRoot);
assert.equal(build.sha256,manifest.sha256);
for(const row of manifest.source)assert.equal(sha256(fs.readFileSync(row.file)),row.sha256,'Source drift: '+row.file);
const report={success:false,checks:[],cases:[],build:{root:buildRoot,sha256:build.sha256,files:build.files.length},sourceCount:manifest.source.length,scriptSha256:sha256(fs.readFileSync(new URL(import.meta.url))),scope:'Owned actual Electron/Pi/Hana/pending teacher approval and SQLite/journal/native; explicitly synthetic SSE and public text. No approval, real provider, daily profile, VPN, curriculum or full Harness acceptance.'};
let app,page;
const check=name=>{report.checks.push({name,pass:true});console.log('PASS '+name);};
async function until(fn,ms=180000){const end=Date.now()+ms;while(Date.now()<end){const result=await fn();if(result)return result;await new Promise(r=>setTimeout(r,80));}throw Error('Pending-close observation timeout');}
const query=(data,sql,args=[])=>{const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});try{return db.prepare(sql).all(...args);}finally{db.close();}};
function readback(data){const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});try{const names=['ai_agent_runs','xiaozhi_pi_text_changes','xiaozhi_pi_goals','xiaozhi_event_owners','xiaozhi_event_runs','xiaozhi_event_journal','xiaozhi_tool_receipts','xiaozhi_native_run_bindings'];return Object.fromEntries(names.map(name=>[name,db.prepare('SELECT * FROM '+name).all()]));}finally{db.close();}}
async function launch(c,phase){
 const env={...process.env,OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_DATA_ROOT:c.data,OMNI_EDU_REPO_ROOT:path.resolve('../..'),OMNI_EDU_E2E_DIALOG_MODE:'1',DEEPSEEK_API_KEY:'owned-synthetic-no-provider',DEEPSEEK_MODEL:'deepseek-flash'};delete env.ELECTRON_RUN_AS_NODE;delete env.NODE_OPTIONS;
 app=await electron.launch({args:[main,`--user-data-dir=${c.profile}`],env,timeout:60000});
 const child=app.process();let finish;c.exit=new Promise(resolve=>finish=resolve);c.process=child;
 child.once('close',(code,signal)=>finish({code,signal,pid:child.pid}));
 for(const stream of[child.stdout,child.stderr])stream?.on('data',bytes=>fs.appendFileSync(path.join(c.root,phase+'-main.log'),bytes));
 c.launches??=[];c.launches.push({phase,...await assertIsolatedPiMain(app,main,c.profile)});
 page=await app.firstWindow();page.on('pageerror',e=>{c.rendererErrors??=[];c.rendererErrors.push(String(e));});
 await page.getByTestId('office-prompt-input').waitFor({timeout:60000});
 await until(async()=>/^aisession_[0-9a-f-]{36}$/i.test(await page.locator('.office-composer-container').getAttribute('data-session-id')||''));
 const id=await page.locator('.office-composer-container').getAttribute('data-session-id');if(c.sessionId)assert.equal(id,c.sessionId);c.sessionId=id;
 await until(async()=>!await page.getByTestId('office-prompt-input').isDisabled());
 await app.evaluate(({net,app},phase)=>{
  globalThis.shutdownFixture={phase,requests:[]};
  const fs=process.getBuiltinModule('fs'),path=process.getBuiltinModule('path'),log=path.join(process.env.OMNI_EDU_DATA_ROOT,'lifecycle.jsonl');
  for(const event of['before-quit','will-quit','quit','window-all-closed'])app.on(event,()=>fs.appendFileSync(log,JSON.stringify({event,time:Date.now(),resources:process.getActiveResourcesInfo()})+'\n'));
  net.fetch=async(input,init)=>{
   const fixture=globalThis.shutdownFixture,url=typeof input==='string'?input:input.url;
   if(!/\/chat\/completions(?:\?|$)/.test(url))throw Error('Fixture blocks external transport');
   fixture.requests.push({number:fixture.requests.length,phase});if(phase==='cold')throw Error('Cold model replay');
   const body=JSON.parse(init.body),n=fixture.requests.length-1,tool=(id,name,args)=>({id,type:'function',function:{name,arguments:JSON.stringify(args)}});
   const tools=body.messages.filter(m=>m.role==='tool').map(m=>typeof m.content==='string'?m.content:JSON.stringify(m.content)).join('\n'),marker=tools.match(/SHUTDOWN-[a-f0-9-]+/i)?.[0];let call;
   if(n===0)call=tool('shutdown_plan','update_task_plan',{schemaVersion:'xiaozhi.task-plan.v3',expectedRevision:0,requirementsVersion:1,reason:'读取公开课堂资料再等待教师确认保存',steps:[{id:'read',text:'读取课堂资料',kind:'file',target:'课堂资料.txt',reported:'in_progress',dependsOn:[]},{id:'lesson',text:'等待确认保存讲义',kind:'saved_text',target:'待确认讲义.md',reported:'pending',dependsOn:['read']},{id:'review',text:'教师检查',kind:'human',reported:'pending',dependsOn:['lesson']}]});
   else if(n===1)call=tool('shutdown_read','office_read_text',{taskStepId:'read',path:'课堂资料.txt'});
   else if(n===2)call=tool('shutdown_save','office_create_text',{taskStepId:'lesson',path:'待确认讲义.md',content:'# 课堂讲义\n'+marker+'\n先观察，再解释。'});
   else throw Error('Unexpected model continuation '+n);
   const make=(delta,finish_reason=null)=>({id:'owned_shutdown_'+n,object:'chat.completion.chunk',created:Math.floor(Date.now()/1000),model:body.model,choices:[{index:0,delta,finish_reason}]}),chunks=[make({role:'assistant'}),make({tool_calls:[{...call,index:0}]}),make({},'tool_calls')];
   return new Response(chunks.map(x=>'data: '+JSON.stringify(x)+'\n\n').join('')+'data: [DONE]\n\n',{status:200,headers:{'content-type':'text/event-stream'}});
  };
 },phase);
}
const snap=c=>page.evaluate(id=>window.omniEdu.getXiaozhiSnapshot(id),c.sessionId);
async function close(c,mode,phase){
 c[phase+'Requests']=await app.evaluate(()=>globalThis.shutdownFixture.requests);
 const start=Date.now(),closed=app.waitForEvent('close',{timeout:20000});
 try{
  if(mode==='window')await app.evaluate(({BrowserWindow})=>{setTimeout(()=>BrowserWindow.getAllWindows()[0].close(),0);});
  else if(mode==='quit')await app.evaluate(({app})=>{setTimeout(()=>app.quit(),0);});
  else await app.close();
 }catch(error){
  // The scheduled close may destroy the inspector context before its reply.
  // Do not dispatch again: require the already observed process to actually exit.
  if(!/Resulting promise was garbage collected|Target page, context or browser has been closed/.test(String(error)))throw error;
  (c.observationErrors??=[]).push(String(error));
 }
 await closed;const exit=await Promise.race([c.exit,new Promise((_,reject)=>setTimeout(()=>reject(Error('Child process exit not observed')),5000))]);
 c[phase+'Exit']={...exit,ms:Date.now()-start};app=undefined;page=undefined;
 c[phase+'AfterExit']=readback(c.data);
 assert.equal(exit.code,0,'Abnormal native process exit');assert.equal(exit.signal,null);assert(c[phase+'Exit'].ms<15000);
 const log=fs.readFileSync(path.join(c.root,phase+'-main.log'),'utf8');assert(!/FATAL ERROR|napi_throw|UnhandledPromiseRejection|local_store_close_failed|Cannot read properties of undefined/.test(log),'Fatal, failed store close or unhandled native teardown');
}
try{
 const modes=process.argv.find(v=>v.startsWith('--modes='))?.slice(8).split(',')||['window','framework'];assert(modes.length&&modes.every(m=>['window','framework','quit'].includes(m)));
 for(const mode of modes){
  const root=path.join(output,mode),c={mode,root,data:path.join(root,'data'),profile:path.join(root,'profile'),workspace:path.join(root,'workspace')};report.cases.push(c);
  fs.mkdirSync(c.workspace,{recursive:true});const marker='SHUTDOWN-'+randomUUID(),source=path.join(c.workspace,'课堂资料.txt'),file=path.join(c.workspace,'待确认讲义.md');fs.writeFileSync(source,'公开合成课堂资料；核验码：'+marker);c.sourceHash=sha256(fs.readFileSync(source));
  const cacheSource=path.resolve('test-results/xiaozhi-agent/pi-task-review-ui-eQdimA/data/xiaozhi-pi/deepseek-capabilities.v1.json'),cache=fs.readFileSync(cacheSource);fs.mkdirSync(path.join(c.data,'xiaozhi-pi'),{recursive:true});fs.writeFileSync(path.join(c.data,'xiaozhi-pi/deepseek-capabilities.v1.json'),cache);c.cache={source:cacheSource,sha256:sha256(cache)};
  await launch(c,'pending');await app.evaluate(({dialog},directory)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[directory]});},c.workspace);
  await page.getByTestId('pi-permission-picker').click();await page.getByRole('menuitem',{name:'选择教学工作目录',exact:true}).click();await until(async()=>Boolean((await snap(c)).workspace));
  await page.getByTestId('pi-goal-open').click();await page.getByTestId('pi-goal-objective').fill('实际读取课堂资料.txt，提出待确认讲义.md的保存审阅，等待我确认。');await page.getByTestId('pi-goal-criteria').fill('讲义保留资料核验码，必须由教师确认保存。');await page.getByTestId('pi-goal-create').click();
  const approval=page.getByTestId('pi-text-change').getByTestId('pi-text-approve');await approval.waitFor({state:'visible',timeout:180000});await until(async()=>!await approval.isDisabled());
  c.beforeSnapshot=await snap(c);c.before=readback(c.data);assert(c.beforeSnapshot.running);assert.equal(c.before.xiaozhi_pi_text_changes.length,1);assert.equal(c.before.xiaozhi_pi_text_changes[0].state,'pending');assert(!fs.existsSync(file));assert.equal(c.before.xiaozhi_tool_receipts.find(r=>r.call_id==='shutdown_read').success,1);assert.notEqual(c.before.xiaozhi_tool_receipts.find(r=>r.call_id==='shutdown_save').phase,'settled');
  c.nativeModules=await app.evaluate(()=>process.report?.getReport().sharedObjects||[]);
  await page.screenshot({path:path.join(root,'pending.png')});check(mode+': actual visible pending approval, successful source read, no approval or output');
  await close(c,mode,'pending');c.after=readback(c.data);assert(!fs.existsSync(file));assert.equal(c.after.xiaozhi_pi_text_changes[0].state,'interrupted');assert(c.after.ai_agent_runs.every(r=>r.status!=='running'));assert(c.after.xiaozhi_event_runs.every(r=>r.status!=='running'));assert(c.after.xiaozhi_event_journal.every(r=>sha256(r.event_json)===r.event_hash));check(mode+': clean bounded process exit, no native fatal or output, durable interrupted approval/run');
  const binding=JSON.parse(c.after.xiaozhi_native_run_bindings[0].binding_json),nativeFile=path.join(c.data,'xiaozhi-pi',binding.file),native=fs.readFileSync(nativeFile);c.native={file:nativeFile,sha256:sha256(native),bytes:native.length};
  await launch(c,'cold');c.coldSnapshot=await snap(c);c.cold=readback(c.data);assert(!c.coldSnapshot.running);assert.equal(c.coldSnapshot.goal.state,'interrupted');assert(c.coldSnapshot.task.state!=='running'&&c.coldSnapshot.task.state!=='completed');assert.equal(c.cold.xiaozhi_pi_text_changes[0].state,'interrupted');assert.equal(c.cold.ai_agent_runs.length,1);assert.equal((await app.evaluate(()=>globalThis.shutdownFixture.requests)).length,0);assert(fs.readFileSync(nativeFile).equals(native));assert(!fs.existsSync(file));assert.equal(sha256(fs.readFileSync(source)),c.sourceHash);assert.deepEqual(c.rendererErrors||[],[]);check(mode+': cold UI and SQLite recover same interrupted task with zero model/native/effect replay');
  await close(c,'window','cold');delete c.process;delete c.exit;
 }
 assert.equal(fingerprint(buildRoot).sha256,build.sha256);for(const row of manifest.source)assert.equal(sha256(fs.readFileSync(row.file)),row.sha256);check('Frozen build and all listed source hashes unchanged');report.success=true;
}catch(e){report.error=String(e.stack||e);process.exitCode=1;if(page)await page.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});}
finally{if(app)await app.close().catch(()=>{});for(const c of report.cases){delete c.process;delete c.exit;}fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({success:report.success,checks:report.checks.length,output,error:report.error}));}
