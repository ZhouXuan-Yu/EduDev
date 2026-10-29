import '../office-agent/register-source.mjs';
import {presentationFixture} from './presentation-fixture.mjs';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {_electron as electron} from 'playwright';
const desktop=path.resolve(import.meta.dirname,'../..'),output=fs.mkdtempSync(path.join(os.tmpdir(),'xiaozhi-bundle-ui-'));
const rejectMode=process.argv.includes('--reject');
const partialMode=process.argv.includes('--partial');
const data=path.join(output,'data'),profile=path.join(output,'profile');
const report={ok:false,checks:[],errors:[],boundary:'Actual formal Electron main/preload/page/Pi, synthetic SSE only, real approvals, HTML/PPT bytes and restart. No real-provider quality, WPS/Office or complete AT acceptance.'};
const html='<!doctype html><html lang="zh-CN"><title>浮力探究</title><body><label>排液体积<input id="volume" type="range" min="1" max="10" value="1"></label><output id="force">10 N</output><script>volume.oninput=()=>force.textContent=volume.value*10+" N";</script></body></html>';
let application,page,sessionId;
const query=(sql)=>{const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});try{return db.prepare(sql).all();}finally{db.close();}};
const until=async(action,ms=45000)=>{const deadline=Date.now()+ms;while(Date.now()<deadline){const value=await action();if(value)return value;await new Promise(resolve=>setTimeout(resolve,70));}throw Error('UI operation timed out');};
const check=name=>{report.checks.push(name);console.log('PASS '+name);};
async function launch(){
 const env={...process.env,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),OMNI_EDU_DATA_ROOT:data,OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_E2E_DIALOG_MODE:'1',DEEPSEEK_API_KEY:'synthetic-local-only',DEEPSEEK_MODEL:'deepseek-flash'};
 for(const key of ['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL'])delete env[key];
 application=await electron.launch({args:[path.join(desktop,'out/main/index.js'),'--user-data-dir='+profile],cwd:desktop,env,timeout:60000});
 await application.evaluate(({net},fixture)=>{
  const {html,draft,partialMode}=fixture;
  const state=globalThis.defaultDelivery={index:0,requests:[],blocked:[],html,draft,readStarted:false,readText:[],partialMode,resumeStarted:false,bundleId:null};
  net.fetch=async(input,init)=>{
   const url=typeof input==='string'?input:input.url;
   if(url.includes('/models'))return new Response(JSON.stringify({object:'list',data:[{id:'deepseek-flash',context_window:1048576,max_output_tokens:32768,input_modalities:['text']}]}),{headers:{'content-type':'application/json'}});
   if(!url.includes('/chat/completions')){state.blocked.push(url);throw Error('External network disabled');}
   const body=JSON.parse(init.body),tools=body.tools?.map(t=>t.function.name)||[],index=state.index++;
   state.requests.push({index,tools});
   const planned=tools.includes('update_task_plan'),stage=index-(planned?1:0);let call;
   const user=body.messages.filter(m=>m.role==='user').at(-1)?.content;
   const text=typeof user==='string'?user:JSON.stringify(user);
   if(index===0&&planned){const system=body.messages.filter(m=>m.role==='system').map(m=>m.content).join('\n');const version=Number([...system.matchAll(/"requirementsVersion":(\d+)/g)].at(-1)?.[1]||1);call={name:'update_task_plan',arguments:JSON.stringify({schemaVersion:'xiaozhi.task-plan.v3',requirementsVersion:version,expectedRevision:0,reason:'整包保存合成教学文件',steps:[{id:'deliver',text:'整包保存HTML与PPT',dependsOn:[],reported:'pending',kind:'saved_bundle',target:'current'},{id:'review',text:'教师核对教学内容',dependsOn:['deliver'],reported:'pending',kind:'human'}]})};}
   else if(text.includes('继续交付')&&!state.resumeStarted){
    if(planned&&!state.resumePlan){state.resumePlan=true;const system=body.messages.filter(m=>m.role==='system').map(m=>m.content).join('\n');const version=Number([...system.matchAll(/"requirementsVersion":(\d+)/g)].at(-1)?.[1]||1);call={name:'update_task_plan',arguments:JSON.stringify({schemaVersion:'xiaozhi.task-plan.v3',requirementsVersion:version,expectedRevision:0,reason:'续做未完成教学文件',steps:[{id:'deliver',text:'整包交付未完成部分',dependsOn:[],reported:'pending',kind:'saved_bundle',target:'current'},{id:'review',text:'教师核对教学内容',dependsOn:['deliver'],reported:'pending',kind:'human'}]})};}
    else{state.resumeStarted=true;const bundleId=JSON.stringify(body.messages).match(/xidelivery_[a-f0-9]{64}/)?.[0];if(!bundleId)throw Error('Missing bundle id');
    call={name:'office_deliver_files',arguments:JSON.stringify({resumeBundleId:bundleId,...(planned?{taskStepId:'deliver'}:{})})};}
   }
   else if(stage===0)call={name:'office_deliver_files',arguments:JSON.stringify({files:[{fileId:'html',kind:'text',path:'浮力演示.html',content:state.html},{fileId:'ppt',kind:'office',path:'浮力讲解.pptx',format:'pptx',sources:[],draft:state.draft}],...(planned?{taskStepId:'deliver'}:{})})};
   const delta=call?{tool_calls:[{index:0,id:'default-delivery-'+index,type:'function',function:call}]}:{content:'两份文件已保存，请核对教学内容。'};
   const chunk=(d,reason=null)=>'data: '+JSON.stringify({id:'local-only',object:'chat.completion.chunk',created:0,model:body.model,choices:[{index:0,delta:d,finish_reason:reason}]})+'\n\n';
   return new Response(chunk({role:'assistant',content:''})+chunk(delta)+chunk({},call?'tool_calls':'stop')+'data: [DONE]\n\n',{headers:{'content-type':'text/event-stream'}});
  };
 },{html,draft:presentationFixture,partialMode});
 page=await application.firstWindow();page.on('pageerror',e=>report.errors.push(String(e)));page.on('console',m=>{if(m.text().includes('snapshot-')){(report.diagnostics??=[]).push(m.text());console.log(m.text());}});await page.getByTestId('xiaozhi-pi-workspace').waitFor({timeout:60000});
 await page.waitForFunction(()=>{const input=document.querySelector('[data-testid="office-prompt-input"]');return input&&!input.disabled&&!document.querySelector('[data-testid="pi-workspace-loading"]');},null,{timeout:60000});
 sessionId=await page.locator('.office-composer-container').getAttribute('data-session-id');
}
try{
 await launch();assert(sessionId);
 await page.getByTestId('office-prompt-input').fill('为八年级生成浮力HTML演示和8页可编辑PPT，每页有教师讲解备注。整包审阅后交付实际文件。');
 await page.getByRole('button',{name:'发送消息',exact:true}).click();
 await page.getByTestId('pi-delivery-bundle').waitFor({timeout:45000});
 const bundle=page.getByTestId('pi-delivery-bundle').last();
 await until(async()=>!await bundle.getByTestId('pi-delivery-approve').isDisabled());
 assert.equal(await bundle.getByTestId('pi-office-approve').count(),0);assert.equal(await bundle.getByTestId('pi-text-approve').count(),0);
 const meta=JSON.parse(query('SELECT value_json FROM xiaozhi_delivery_bundles')[0].value_json);const child=meta.files.find(f=>f.kind==='office');
 const bypass=await page.evaluate(v=>window.omniEdu.decideXiaozhiOffice(v),{schemaVersion:'xiaozhi.office-artifact.v1',sessionId,draftId:child.draftId,revision:0,action:'approve'});assert.equal(bypass.ok,false);
 check('Formal composer produces one grouped review with two real previews; individual approval cannot bypass it');
 if(rejectMode){
  await bundle.getByTestId('pi-delivery-reject').click();await until(()=>query('SELECT status FROM ai_agent_runs ORDER BY created_at DESC LIMIT 1')[0]?.status!=='running');
  const value=JSON.parse(query('SELECT value_json FROM xiaozhi_delivery_bundles')[0].value_json);assert.equal(value.state,'rejected');assert.equal(query('SELECT count(*) n FROM document_artifacts')[0].n,0);assert.equal(query("SELECT count(*) n FROM xiaozhi_pi_text_changes WHERE state='applied'")[0].n,0);check('One rejection leaves both formal output files unwritten');
 }else{
  await bundle.getByRole('tab',{name:'修改拟内容',exact:true}).click();await bundle.getByTestId('pi-office-heading-3').fill('教师整包修订：排液体积');await bundle.getByTestId('pi-office-note-3-0').fill('整包教师讲解备注');
  assert(await bundle.getByTestId('pi-delivery-approve').isDisabled());await bundle.getByTestId('pi-office-save-draft').click();await until(async()=>!await bundle.getByTestId('pi-delivery-approve').isDisabled());
  check('Unsaved teacher edits disable bundle confirmation; saving the edited PPT refreshes the whole approval version');
  let collision,watch;
  if(partialMode){
   const textRow=query('SELECT workspace_hash FROM xiaozhi_pi_text_changes')[0];assert(textRow);
   const paths=fs.readdirSync(path.join(output,'XiaozhiOutputs'));const root=path.join(output,'XiaozhiOutputs',paths[0],sessionId);collision=path.join(root,'浮力讲解.pptx');
   watch=setInterval(()=>{if(query("SELECT state FROM xiaozhi_pi_text_changes")[0]?.state==='applied'&&!fs.existsSync(collision))fs.mkdirSync(collision);},2);
  }
  await bundle.getByTestId('pi-delivery-approve').click();
  await until(()=>query('SELECT status FROM ai_agent_runs ORDER BY created_at DESC LIMIT 1')[0]?.status!=='running');if(watch)clearInterval(watch);
  let value=JSON.parse(query('SELECT value_json FROM xiaozhi_delivery_bundles')[0].value_json);
  if(partialMode){
   assert.equal(value.state,'partial');assert(fs.statSync(collision).isDirectory());
   const root=path.dirname(collision),htmlPath=path.join(root,'浮力演示.html'),before=fs.statSync(htmlPath);assert(fs.readFileSync(htmlPath,'utf8').includes('xiaozhi.html-artifact.v1'));check('A real target conflict after HTML save displays partial delivery and preserves the HTML');
   fs.rmdirSync(collision);await bundle.getByTestId('pi-delivery-resume').click();
   const resumed=page.getByTestId('pi-delivery-bundle').last();await until(async()=>await resumed.getAttribute('data-bundle-id')!==value.id&&await resumed.getAttribute('data-state')==='pending');
   await until(async()=>!await resumed.getByTestId('pi-delivery-approve').isDisabled());assert(await resumed.getByText(/已保存并核验，续做时保留/).count());await resumed.getByTestId('pi-delivery-approve').click();
   await until(()=>query('SELECT status FROM ai_agent_runs ORDER BY created_at DESC LIMIT 1')[0]?.status!=='running');
   value=JSON.parse(query('SELECT value_json FROM xiaozhi_delivery_bundles ORDER BY created_at DESC LIMIT 1')[0].value_json);assert.equal(value.state,'saved');assert.equal(query('SELECT count(*) n FROM xiaozhi_pi_text_changes')[0].n,1);assert.equal(fs.statSync(htmlPath).mtimeMs,before.mtimeMs);check('The visible resume action starts a new turn, carries the saved HTML and confirms only unfinished PPT without rewriting HTML');
  }
  assert.equal(value.state,'saved');const fact=query('SELECT file_path FROM document_artifacts')[0];assert(fact&&fs.existsSync(fact.file_path));
  const {readPresentationNotes}=await import('./presentation-readback.ts');const notes=await readPresentationNotes(fs.readFileSync(fact.file_path));assert.equal(notes.length,8);assert(notes[3].text.includes('整包教师讲解备注'));
  const row=query('SELECT metadata_json FROM ai_conversation_messages WHERE role=\'assistant\' ORDER BY created_at DESC LIMIT 1')[0];
  const proof=JSON.parse(row.metadata_json).verification;assert(proof.checks.some(c=>c.id.startsWith('saved_bundle:')&&c.state==='passed'));check('Saved PPT has eight actual pages and teacher notes; task verification independently confirms every bundled file');
 }
 const snap=await page.evaluate(id=>window.omniEdu.getXiaozhiSnapshot(id),sessionId);report.snapshot={running:snap.running,cursors:snap.eventCursors,eventPersistence:snap.eventPersistence,turns:snap.projection.turns.map(t=>({id:t.id,status:t.status})),deliveries:snap.deliveries?.map(d=>({id:d.id,state:d.state}))};
 await until(async()=>!(await page.locator('body').textContent()).includes('过程记录暂时无法核对'),10000);
 await page.screenshot({path:path.join(output,'bundle-result.png')});
 const binding=query('SELECT session_file FROM xiaozhi_pi_session_bindings')[0];await application.close();application=undefined;await launch();assert.equal(query('SELECT session_file FROM xiaozhi_pi_session_bindings')[0].session_file,binding.session_file);await page.getByTestId('pi-delivery-bundle').first().waitFor({timeout:30000});check('Cold restart restores bundle cards, original ledger facts and native session identity without replay');
 assert.deepEqual(report.errors,[]);report.ok=true;
}catch(error){report.error=String(error.stack);process.exitCode=1;console.error(report.error);if(page)await page.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});}
finally{await application?.close();fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({ok:report.ok,checks:report.checks.length,output}));}
