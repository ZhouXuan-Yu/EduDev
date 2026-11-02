import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {_electron as electron} from 'playwright';

// Narrow regression for a suspected live/cold discrepancy. No teacher profile,
// paid provider, renderer store injection or replay of an existing generation.
const desktop=path.resolve(import.meta.dirname,'../..');
const readRoot=process.argv.includes('--read')?process.argv[process.argv.indexOf('--read')+1]:undefined;
if(readRoot){assert.equal(path.dirname(path.resolve(readRoot)).toLowerCase(),os.tmpdir().toLowerCase());assert(path.basename(readRoot).startsWith('xiaozhi-live-terminal-'));}
const original=readRoot?JSON.parse(fs.readFileSync(path.join(readRoot,'report.json'),'utf8')):undefined;
const save=process.argv.includes('--saved')||Boolean(original?.outputSha256);
const root=readRoot||fs.mkdtempSync(path.join(os.tmpdir(),'xiaozhi-live-terminal-'));
const workspace=path.join(root,'workspace');if(!readRoot)fs.mkdirSync(workspace);
const report={ok:false,root,checks:[],errors:[],requests:0};
const hash=b=>createHash('sha256').update(b).digest('hex');
const until=async(fn)=>{const end=Date.now()+60000;while(Date.now()<end){const value=await fn();if(value)return value;await new Promise(r=>setTimeout(r,60));}throw Error('Terminal condition timed out');};
let app,page,sessionId;
async function boot(cold=false){
 const env={...process.env,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),OMNI_EDU_DATA_ROOT:path.join(root,'data'),OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_E2E_DIALOG_MODE:'1',DEEPSEEK_API_KEY:'synthetic-local-only',DEEPSEEK_MODEL:'deepseek-flash'};
 for(const k of ['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL'])delete env[k];
 app=await electron.launch({args:[path.join(desktop,'out/main/index.js'),'--user-data-dir='+path.join(root,'profile')],cwd:desktop,env,timeout:60000});
 await app.evaluate(({net},{cold,save})=>{
  globalThis.terminalProbe={requests:0};
  net.fetch=async(input,init)=>{
   const url=typeof input==='string'?input:input.url;
   if(url.includes('/models'))return new Response(JSON.stringify({object:'list',data:[{id:'deepseek-flash',context_window:1048576,max_output_tokens:32768,input_modalities:['text']}]}),{headers:{'content-type':'application/json'}});
   if(!url.includes('/chat/completions')||cold)throw Error('External/replayed model request disabled');
   const n=globalThis.terminalProbe.requests++,body=JSON.parse(init.body);
   if(n>(save?2:1))throw Error('Unexpected extra synthetic request');
   const chunk=(delta,finish_reason=null)=>'data: '+JSON.stringify({id:'terminal-probe',object:'chat.completion.chunk',created:0,model:body.model,choices:[{index:0,delta,finish_reason}]})+'\n\n';
   let call;
   if(save&&n===0){
    const system=body.messages.filter(m=>m.role==='system').map(m=>m.content).join('\n'),line=system.split('\n').findLast(l=>l.startsWith('{"schemaVersion":"xiaozhi.task-plan.v3"')),task=JSON.parse(line);
    call={name:'update_task_plan',arguments:JSON.stringify({schemaVersion:'xiaozhi.task-plan.v3',requirementsVersion:task.requirementsVersion,expectedRevision:task.revision,reason:'保存教师要求的课堂说明',steps:[{id:'save',text:'保存课堂说明',dependsOn:[],reported:'pending',kind:'saved_text',target:'课堂说明.html'},{id:'review',text:'教师核对说明',dependsOn:['save'],reported:'pending',kind:'human'}]})};
   }else if(n===(save?1:0))call={name:'office_create_text',arguments:JSON.stringify({path:'课堂说明.html',content:'<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>课堂说明</title><h1>合成课堂说明</h1><p>教师可继续核对。</p></html>',...(save?{taskStepId:'save'}:{})})};
   const delta=call?{tool_calls:[{index:0,id:'save-'+n,type:'function',function:call}]}:{content:'全部完成，所有教学要求和视觉检查都已通过。MODEL-UNVERIFIED-RECAP'};
   // A valid complete reply in a single transport body, no artificial pacing.
   return new Response(chunk({role:'assistant',content:''})+chunk(delta)+chunk({},call?'tool_calls':'stop')+'data: [DONE]\n\n',{headers:{'content-type':'text/event-stream'}});
  };
 },{cold,save});
 page=await app.firstWindow();page.on('pageerror',e=>report.errors.push(String(e)));
 await page.getByTestId('xiaozhi-pi-workspace').waitFor({timeout:60000});
 await page.waitForFunction(()=>{const e=document.querySelector('[data-testid="office-prompt-input"]');return e&&!e.disabled;},undefined,{timeout:60000});
 sessionId=await page.locator('.office-composer-container').getAttribute('data-session-id');
}
const snapshot=()=>page.evaluate(id=>window.omniEdu.getXiaozhiSnapshot(id),sessionId);
try{
 if(readRoot){
  assert(original.ok);await boot(true);await page.getByTestId('agent-reply-body').filter({hasText:'本轮文件结果：'}).waitFor({timeout:12000});
  report.liveBody=await page.getByTestId('agent-reply-body').last().innerText();assert.equal(report.liveBody,original.liveBody);const s=await snapshot();assert.equal(s.projection.turns.at(-1).id,original.runId);assert.equal(s.projection.turns.at(-1).status,'completed');
  report.viewports=[];
  for(const [width,height]of [[1366,768],[1920,1080]]){
   await app.evaluate(({BrowserWindow},{width,height})=>BrowserWindow.getAllWindows()[0].setContentSize(width,height),{width,height});await page.waitForFunction(v=>innerWidth===v.width&&innerHeight===v.height,{width,height});
   const body=page.getByTestId('agent-reply-body').last();await body.scrollIntoViewIfNeeded();assert(await body.isVisible());assert.equal(await body.innerText(),original.liveBody);report.viewports.push(await page.evaluate(()=>({width:innerWidth,height:innerHeight,dpr:devicePixelRatio})));await page.screenshot({path:path.join(root,width+'-readback.png')});
  }
  report.requests=await app.evaluate(()=>globalThis.terminalProbe.requests);assert.equal(report.requests,0);if(save)assert.equal(hash(fs.readFileSync(path.join(workspace,'课堂说明.html'))),original.outputSha256);else assert.deepEqual(fs.readdirSync(workspace),[]);
  report.checks.push('Integrated build cold-reads the same final run and exact no-file/saved-file state at both native viewport sizes with zero model replay');assert.deepEqual(report.errors,[]);report.ok=true;
 }else{
 await boot();
 await app.evaluate(({dialog},dir)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[dir]});},workspace);
 await page.getByTestId('pi-permission-picker').click();await page.getByRole('menuitem',{name:'选择教学工作目录',exact:true}).click();
 await until(async()=>Boolean((await snapshot()).workspace));
 await page.getByTestId('office-prompt-input').fill('保存一份课堂说明.html供我核对。');await page.getByRole('button',{name:'发送消息',exact:true}).click();
 if(save){const card=page.getByTestId('pi-text-change').last();await card.getByTestId('pi-text-approve').waitFor({timeout:60000});await card.getByTestId('pi-text-approve').click();}
 const s=await until(async()=>{const s=await snapshot(),t=s.projection.turns.at(-1);return !s.running&&t?.items.some(i=>i.kind==='tool')&&['completed','failed','interrupted'].includes(t.status)?s:undefined;});report.runId=s.projection.turns.at(-1).id;report.persisted=s.projection.turns.at(-1);
 assert.equal(report.persisted.status,'completed');
 const final=report.persisted.items.find(i=>i.kind==='message'&&i.phase==='final_answer');assert(final?.text.includes('本轮文件结果：'));assert(!final.text.includes('MODEL-UNVERIFIED-RECAP'));
 // Check live before navigation, refresh or restart can hide a hydration defect.
 await page.getByTestId('agent-reply-body').filter({hasText:'本轮文件结果：'}).waitFor({timeout:12000});
 report.liveBody=await page.getByTestId('agent-reply-body').last().innerText();assert(!report.liveBody.includes('MODEL-UNVERIFIED-RECAP'));
 if(save){assert(report.liveBody.includes('课堂说明.html'));report.outputSha256=hash(fs.readFileSync(path.join(workspace,'课堂说明.html')));}
 else{assert(report.liveBody.includes('本操作尚未派发'));assert(report.liveBody.includes('本次操作未执行'));assert.deepEqual(fs.readdirSync(workspace),[]);assert.equal(s.changes.length,0);}
 report.checks.push(save?'Immediate single-body saved-file final shows the truthful summary without navigation/restart':'Pre-draft task admission failure shows the actual reason and no-output state, suppressing the model success claim live');
 report.requests=await app.evaluate(()=>globalThis.terminalProbe.requests);assert.equal(report.requests,save?3:2);
 await page.screenshot({path:path.join(root,'live.png')});await app.close();app=undefined;
 await boot(true);report.coldBody=await page.getByTestId('agent-reply-body').last().innerText();assert.equal(report.coldBody,report.liveBody);if(save)assert.equal(hash(fs.readFileSync(path.join(workspace,'课堂说明.html'))),report.outputSha256);else assert.deepEqual(fs.readdirSync(workspace),[]);assert.equal(await app.evaluate(()=>globalThis.terminalProbe.requests),0);
 report.checks.push('Cold read retains the same summary and exact saved bytes with zero model/publication replay');assert.deepEqual(report.errors,[]);report.ok=true;
 }
}catch(e){report.error=String(e.stack);report.requests=await app?.evaluate(()=>globalThis.terminalProbe.requests).catch(()=>null);report.snapshot=await snapshot().catch(()=>null);await page?.screenshot({path:path.join(root,'failure.png')}).catch(()=>{});process.exitCode=1;}
finally{await app?.close().catch(()=>{});fs.writeFileSync(path.join(root,readRoot?'readback.json':'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({ok:report.ok,root,checks:report.checks,error:report.error},null,2));}
