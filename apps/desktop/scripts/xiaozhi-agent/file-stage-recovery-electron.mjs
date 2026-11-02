import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import {_electron as electron} from 'playwright';
const desktop=path.resolve(import.meta.dirname,'../..'),baseline=process.argv.includes('--baseline');
const readRoot=process.argv.includes('--read')?path.resolve(process.argv[process.argv.indexOf('--read')+1]):undefined;
if(readRoot){assert.equal(path.dirname(readRoot).toLowerCase(),os.tmpdir().toLowerCase());assert(path.basename(readRoot).startsWith('xiaozhi-stage-ui-'));}
const root=readRoot||fs.mkdtempSync(path.join(os.tmpdir(),'xiaozhi-stage-ui-')),data=path.join(root,'data'),profile=path.join(root,'profile'),marker=path.join(root,'cut.json');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const query=(sql)=>{const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});try{return db.prepare(sql).all();}finally{db.close();}};
const until=async(action,ms=60000)=>{const end=Date.now()+ms;while(Date.now()<end){const v=await action();if(v)return v;await new Promise(r=>setTimeout(r,80));}throw Error('Stage recovery condition timed out');};
const report={ok:false,baseline,checks:[],boundary:'Original Pi/UI/local synthetic SSE; owned main force termination while installing actual DOCX. No paid model, teacher data, power loss or full AT acceptance.'};
const check=name=>{report.checks.push(name);console.log('PASS '+name);};let app,page,session;
async function launch(){
 const env={...process.env,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),OMNI_EDU_DATA_ROOT:data,OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_E2E_DIALOG_MODE:'1',DEEPSEEK_API_KEY:'synthetic-local-only',DEEPSEEK_MODEL:'deepseek-flash'};
 for(const k of ['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL'])delete env[k];
 app=await electron.launch({args:[path.join(desktop,'out/main/index.js'),'--user-data-dir='+profile],cwd:desktop,env,timeout:60000});
 await app.evaluate(({net},input)=>{
  const state=globalThis.stageTest={requests:0,blocked:[]};
  net.fetch=async(url,init)=>{
   url=typeof url==='string'?url:url.url;
   if(url.includes('/models'))return new Response(JSON.stringify({object:'list',data:[{id:'deepseek-flash',context_window:1048576,max_output_tokens:32768,input_modalities:['text']}]}),{headers:{'content-type':'application/json'}});
   if(!url.includes('/chat/completions')){state.blocked.push(url);throw Error('External network forbidden');}
   const body=JSON.parse(init.body),i=state.requests++,planned=body.tools?.some(t=>t.function.name==='update_task_plan');let call;
   if(i===0&&planned){const system=body.messages.filter(m=>m.role==='system').map(m=>m.content).join('\n'),task=JSON.parse(system.split('\n').findLast(l=>l.startsWith('{"schemaVersion":"xiaozhi.task-plan.v3"'))),requirementsVersion=task.requirementsVersion;call={name:'update_task_plan',arguments:JSON.stringify({schemaVersion:'xiaozhi.task-plan.v3',requirementsVersion,expectedRevision:task.revision,reason:'保存两份教学文件',steps:[{id:'deliver',text:'保存教学文件',dependsOn:[],reported:'pending',kind:'saved_bundle',target:'current'},{id:'review',text:'教师核对内容',dependsOn:['deliver'],reported:'pending',kind:'human'}]})};}
   else if(i===(planned?1:0))call={name:'office_deliver_files',arguments:JSON.stringify({files:[{fileId:'html',kind:'text',path:'保留演示.html',content:'<!doctype html><html lang="zh-CN"><title>浮力</title><body><h1>排液体积与浮力</h1></body></html>'},{fileId:'doc',kind:'office',path:'未完成讲解.docx',format:'docx',sources:[],draft:{schemaVersion:'xiaozhi.office-draft.v1',title:'浮力讲解',sections:[{heading:'探究问题',paragraphs:['排液体积改变时浮力怎样变化？']}]}}],...(planned?{taskStepId:'deliver'}:{})})};
   const delta=call?{tool_calls:[{index:0,id:'stage-'+i,type:'function',function:call}]}:{content:'文件已保存。'};
   const chunk=(delta,finish_reason=null)=>'data: '+JSON.stringify({id:'local-stage',object:'chat.completion.chunk',created:0,model:body.model,choices:[{index:0,delta,finish_reason}]})+'\n\n';
   return new Response(chunk({role:'assistant',content:''})+chunk(delta)+chunk({},call?'tool_calls':'stop')+'data: [DONE]\n\n',{headers:{'content-type':'text/event-stream'}});
  };
 },{});
 page=await app.firstWindow();await page.getByTestId('xiaozhi-pi-workspace').waitFor({timeout:60000});await until(async()=>!await page.getByTestId('office-prompt-input').isDisabled());
 const id=await page.locator('.office-composer-container').getAttribute('data-session-id');if(session)assert.equal(id,session);session=id;
}
try{
 await launch();const identity=await app.evaluate(({app})=>({pid:process.pid,userData:app.getPath('userData')}));assert.equal(identity.userData,path.resolve(profile));report.identity=identity;
 if(readRoot){
  const original=JSON.parse(fs.readFileSync(path.join(root,'report.json'),'utf8'));assert(original.ok);assert.equal(query('SELECT state FROM xiaozhi_pi_office_drafts')[0].state,'interrupted');
  assert.equal(sha(fs.readFileSync(original.cut.formal)),original.finalFormalSha256);assert.equal(fs.existsSync(original.cut.temporary),original.baseline);
  assert.equal((await app.evaluate(()=>globalThis.stageTest)).requests,0);assert.equal(fs.readFileSync(path.join(path.dirname(original.cut.formal),'.xiaozhi-office-unrelated.tmp'),'utf8'),'other task sentinel');
  for(const [width,height]of[[1366,768],[1920,1080]]){await page.setViewportSize({width,height});await page.getByTestId('pi-delivery-bundle').last().waitFor();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:path.join(root,'readback-'+width+'.png')});}
  check('Final-build dual-viewport readback keeps exact saved bytes and unrelated/legacy temporaries, zero model replay');report.ok=true;
 }else{
 await page.getByTestId('office-prompt-input').fill('保存一份浮力HTML演示与一份讲解DOCX，整包审阅后交付。');await page.getByRole('button',{name:'发送消息',exact:true}).click();
 const bundle=page.getByTestId('pi-delivery-bundle').last();await bundle.waitFor({timeout:120000});await until(async()=>!await bundle.getByTestId('pi-delivery-approve').isDisabled());
 report.syntheticRequests=(await app.evaluate(()=>globalThis.stageTest)).requests;
 await app.evaluate((_,marker)=>{const fs=process.getBuiltinModule('fs'),path=process.getBuiltinModule('path'),link=fs.linkSync;fs.linkSync=function(from,to,...args){if(path.basename(to)==='未完成讲解.docx'){fs.writeFileSync(marker,JSON.stringify({pid:process.pid,temporary:from,destination:to}));Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,60000);throw Error('Owned cut was not terminated');}return link.call(this,from,to,...args);};},marker);
 const click=bundle.getByTestId('pi-delivery-approve').click();void click.catch(()=>{});await until(()=>fs.existsSync(marker));assert.equal(JSON.parse(fs.readFileSync(marker)).pid,identity.pid);execFileSync('taskkill',['/PID',String(identity.pid),'/T','/F'],{windowsHide:true,stdio:'pipe'});await click.catch(()=>{});await app.close().catch(()=>{});app=undefined;
 const cut=JSON.parse(fs.readFileSync(marker));assert.equal(cut.pid,identity.pid);assert(fs.existsSync(cut.temporary));assert(!fs.existsSync(cut.destination));const formal=path.join(path.dirname(cut.destination),'保留演示.html'),before=fs.readFileSync(formal),beforeHash=sha(before),beforeMtime=fs.statSync(formal).mtimeMs;report.cut={...cut,formal,formalSha256:beforeHash,tempSha256:sha(fs.readFileSync(cut.temporary))};
 const unrelated=path.join(path.dirname(formal),'.xiaozhi-office-unrelated.tmp');fs.writeFileSync(unrelated,'other task sentinel');check('Actual owned main exited between temporary write/fsync and exclusive DOCX install; prior HTML remains saved');
 await launch();assert.equal((await app.evaluate(()=>globalThis.stageTest)).requests,0);
 const office=await until(()=>query('SELECT * FROM xiaozhi_pi_office_drafts')[0]);assert.equal(office.state,'uncertain');assert.equal(query('SELECT state FROM xiaozhi_pi_text_changes')[0].state,'applied');
 const verify=page.getByTestId('pi-office-verify').last();await verify.waitFor();assert(await verify.isEnabled());await page.screenshot({path:path.join(root,'cold-partial.png')});check('Cold original UI exposes uncertain child verification and retained saved sibling with zero model replay');
 await verify.click();await until(()=>query('SELECT state FROM xiaozhi_pi_office_drafts')[0].state==='interrupted');
 assert.equal(sha(fs.readFileSync(formal)),beforeHash);assert.equal(fs.statSync(formal).mtimeMs,beforeMtime);assert.equal(fs.readFileSync(unrelated,'utf8'),'other task sentinel');assert(!fs.existsSync(cut.destination));
 assert.equal(fs.existsSync(cut.temporary),baseline);assert.equal((await app.evaluate(()=>globalThis.stageTest)).requests,0);assert.deepEqual((await app.evaluate(()=>globalThis.stageTest)).blocked,[]);
 report.after=query('SELECT * FROM xiaozhi_pi_office_drafts').map(({output_bytes,draft_json,...row})=>row);report.finalFormalSha256=sha(fs.readFileSync(formal));
 check(baseline?'Baseline reproduced: original verify leaves written orphan temporary file':'Original verify removes only recorded owned temporary file; no formal rewrite or unrelated deletion');
 for(const [width,height]of[[1366,768],[1920,1080]]){await page.setViewportSize({width,height});await verify.count();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:path.join(root,'verified-'+width+'.png')});}
 await app.close();app=undefined;await launch();assert.equal((await app.evaluate(()=>globalThis.stageTest)).requests,0);assert.equal(fs.existsSync(cut.temporary),baseline);assert.equal(sha(fs.readFileSync(formal)),beforeHash);check('Second cold read preserves recovery and saved bytes without model or file replay');report.ok=true;
 }
}catch(error){report.error=String(error.stack);report.probe=await app?.evaluate(()=>globalThis.stageTest).catch(()=>undefined);process.exitCode=1;await page?.screenshot({path:path.join(root,'failure.png')}).catch(()=>{});}finally{await app?.close().catch(()=>{});fs.writeFileSync(path.join(root,readRoot?'readback-report.json':'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({ok:report.ok,baseline,root,checks:report.checks.length,error:report.error}));}
