import '../office-agent/register-source.mjs';
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import assert from 'node:assert/strict';import {pathToFileURL} from 'node:url';import {DatabaseSync} from 'node:sqlite';import {_electron as electron} from 'playwright';
const desktop=path.resolve(import.meta.dirname,'../..'),output=fs.mkdtempSync(path.join(os.tmpdir(),'omni-edu-managed-version-ui-')),data=path.join(output,'data'),profile=path.join(output,'profile'),bootstrap=path.join(output,'bootstrap.cjs'),wire=path.join(output,'wire.json');
fs.mkdirSync(data);fs.mkdirSync(profile);fs.writeFileSync(bootstrap,`globalThis.managedFs=require('node:fs');import(${JSON.stringify(pathToFileURL(path.join(desktop,'out/main/index.js')).href)});`);
const report={ok:false,checks:[],errors:[],output,boundary:'Formal Electron/Pi/real official component download and actual QuickJS child, synthetic provider SSE; no paid requests or full E04/E05 AT acceptance.'};
let app,page,session;
const until=async(fn,ms=60000)=>{const end=Date.now()+ms;while(Date.now()<end){const value=await fn();if(value)return value;await new Promise(r=>setTimeout(r,80));}throw Error('Managed tool UI condition timed out');};
const check=name=>{report.checks.push(name);console.log('PASS '+name);};
const query=sql=>{const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});try{return db.prepare(sql).all();}finally{db.close();}};
async function launch(){
 const env={...process.env,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),OMNI_EDU_DATA_ROOT:data,OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_E2E_DIALOG_MODE:'1',OMNI_EDU_E2E_MANAGED_TOOLS_NO_BUILTIN:'1',DEEPSEEK_API_KEY:'synthetic-local-only',DEEPSEEK_MODEL:'deepseek-flash'};for(const k of ['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL','OMNI_EDU_E2E_VISIBLE'])delete env[k];
 app=await electron.launch({args:[bootstrap,'--user-data-dir='+profile],cwd:desktop,env,timeout:60000});
 await app.evaluate(({net},wire)=>{
  const fs=globalThis.managedFs,state=globalThis.managedTest={requests:[],downloads:[],stage:0};const originalFetch=globalThis.fetch;
  globalThis.fetch=async(input,init)=>{const url=String(typeof input==='string'?input:input.url);if(!['3.6.1','3.6.2'].some(v=>url===`https://registry.npmjs.org/quickjs-wasi/-/quickjs-wasi-${v}.tgz`))throw Error('Unapproved external fetch');state.downloads.push(url);fs.writeFileSync(wire,JSON.stringify(state));return originalFetch(input,init);};
  net.fetch=async(input,init)=>{
   const url=typeof input==='string'?input:input.url;
   if(url.includes('/models'))return new Response(JSON.stringify({object:'list',data:[{id:'deepseek-flash',context_window:1048576,max_output_tokens:32768,input_modalities:['text'],effort:{supported_levels:['low','high','max'],default_level:'high'}}]}),{headers:{'content-type':'application/json'}});
   if(!url.includes('/chat/completions'))throw Error('Unapproved provider fetch');const body=JSON.parse(init.body);let call;
   const stage=state.stage++;
   if(stage===0)call={name:'ask_teacher',arguments:JSON.stringify({question:'计算完成后用于课堂还是课后？',options:['课堂演示','课后练习']})};
   else if(stage===1||stage===3)call={name:'education_compute',arguments:JSON.stringify({code:'return input.reduce((sum,v)=>sum+v,0);',input:[60,80,100]})};
   else if(stage===2||stage===4){const message=body.messages.filter(m=>m.role==='tool').at(-1),text=typeof message.content==='string'?message.content:message.content.filter(i=>i.type==='text').map(i=>i.text).join('\n');const parsed=text.split('\n').map(s=>{try{return JSON.parse(s);}catch{return null;}}).find(v=>v&&'success'in v);if(!parsed?.success||parsed.data.value!==240||parsed.data.runtime!==(stage===2?'3.6.1':'3.6.2'))throw Error('Frozen actual runtime receipt mismatch');state[stage===2?'oldReceipt':'newReceipt']=parsed.data;}
   else throw Error('Unexpected model request');
   state.requests.push({model:body.model,tool:call?.name||null});fs.writeFileSync(wire,JSON.stringify(state));
   const chunk=(delta,finish_reason=null)=>'data: '+JSON.stringify({id:'managed-local',object:'chat.completion.chunk',created:0,model:body.model,choices:[{index:0,delta,finish_reason}]})+'\n\n';
   return new Response(chunk({role:'assistant',content:''})+chunk(call?{tool_calls:[{index:0,id:'compute-local-'+stage,type:'function',function:call}]}:{content:stage===2?'旧任务使用原版本3.6.1实际计算合计240。':'新任务使用当前版本3.6.2实际计算合计240。'})+chunk({},call?'tool_calls':'stop')+'data: [DONE]\n\n',{headers:{'content-type':'text/event-stream'}});
  };
  fs.writeFileSync(wire,JSON.stringify(state));
 },wire);
 page=await app.firstWindow();page.on('pageerror',error=>report.errors.push(String(error)));await page.getByTestId('xiaozhi-pi-workspace').waitFor({timeout:60000});await until(async()=>!await page.getByTestId('office-prompt-input').isDisabled());session=await page.locator('.office-composer-container').getAttribute('data-session-id');
}
async function settings(){await page.getByRole('button',{name:'设置',exact:true}).click();await page.getByTestId('pi-settings-tab-tools').click();await page.getByTestId('pi-managed-tools').waitFor();}
const send=async text=>{await page.getByTestId('office-prompt-input').fill(text);await page.getByRole('button',{name:'发送消息',exact:true}).click();};
const settled=async count=>{await until(()=>query('SELECT count(*) n FROM ai_agent_runs')[0].n>=count);await until(()=>query('SELECT status FROM ai_agent_runs ORDER BY rowid DESC LIMIT 1')[0].status!=='running',120000);assert.equal(query('SELECT status FROM ai_agent_runs ORDER BY rowid DESC LIMIT 1')[0].status,'succeeded');};
try{
 await launch();await settings();await page.locator('[data-testid="pi-managed-tool"][data-status="missing_dependency"]').waitFor();await page.getByTestId('pi-managed-versions').locator('summary').click();await page.getByTestId('pi-managed-use-3.6.1').click();await until(async()=>(await page.getByTestId('pi-managed-tool').textContent()).includes('本地 JavaScript 计算 · 3.6.1'));await until(async()=>!await page.getByTestId('pi-managed-tool-upgrade').isDisabled());check('Teacher selects the real reviewed 3.6.1 package through version UI and actual typed IPC');
 await page.getByTestId('nav-ai').click();await send('请先问我计算用于课堂还是课后，再实际计算60、80、100的合计。');const question=page.locator('[data-testid="pi-teacher-question"][data-state="pending"]').last();await question.waitFor({timeout:60000});
 await settings();await page.getByTestId('pi-managed-tool-upgrade').click();await until(async()=>(await page.getByTestId('pi-managed-tool').textContent()).includes('本地 JavaScript 计算 · 3.6.2'));await until(async()=>!await page.getByTestId('pi-managed-tool-rollback').isDisabled());
 if(!await page.getByTestId('pi-managed-version-remove-3.6.1').isVisible())await page.getByTestId('pi-managed-versions').locator('summary').click();assert(await page.getByTestId('pi-managed-version-remove-3.6.1').isDisabled());check('Settings can upgrade while real Pi waits for teacher; original task pin keeps old-version uninstall disabled');
 await page.getByTestId('nav-ai').click();await question.getByTestId('pi-question-option-0').click();await question.getByTestId('pi-question-submit').click();await settled(1);const oldState=JSON.parse(fs.readFileSync(wire));assert.equal(oldState.oldReceipt.runtime,'3.6.1');assert.equal(oldState.oldReceipt.value,240);check('Original pending Pi task resumes with actual frozen3.6.1 child after component upgrade');
 await send('新的独立计算任务，请直接运行代码计算60、80、100之和。');await settled(2);const state=JSON.parse(fs.readFileSync(wire));assert.equal(state.newReceipt.runtime,'3.6.2');assert.equal(state.newReceipt.value,240);assert.equal(state.downloads.length,2);assert.equal(state.requests.length,5);report.wire=state;check('Next prompt in existing native session uses actual3.6.2 without recreating conflicting tools or re-downloading');
 await settings();await page.getByTestId('pi-managed-tool-rollback').click();await until(async()=>(await page.getByTestId('pi-managed-tool').textContent()).includes('本地 JavaScript 计算 · 3.6.1'));await until(async()=>!await page.getByTestId('pi-managed-tool-rollback').isDisabled());
 await page.setViewportSize({width:1366,height:768});await page.screenshot({path:path.join(output,'versions-1366.png')});await page.setViewportSize({width:1920,height:1080});await page.screenshot({path:path.join(output,'versions-1920.png')});assert.deepEqual(report.errors,[]);await app.close();app=undefined;await launch();await settings();await until(async()=>(await page.getByTestId('pi-managed-tool').textContent()).includes('本地 JavaScript 计算 · 3.6.1'));assert.equal(JSON.parse(fs.readFileSync(wire)).downloads.length,0);assert.equal(JSON.parse(fs.readFileSync(wire)).requests.length,0);check('UI rollback persists across real Electron cold start with zero download/model request/replay');report.ok=true;
}catch(error){report.failure=String(error.stack);process.exitCode=1;if(page)await page.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});}
finally{await app?.close();fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}
