import '../office-agent/register-source.mjs';
import {presentationFixture} from './presentation-fixture.mjs';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {_electron as electron} from 'playwright';
const resumeRoot=process.argv.find(a=>a.startsWith('--resume='))?.slice(9);
const desktop=path.resolve(import.meta.dirname,'../..'),output=resumeRoot||fs.mkdtempSync(path.join(os.tmpdir(),'xiaozhi-output-backup-ui-'));
const rejectMode=false;
let paused=!!resumeRoot;
const backupRoot=path.join(output,'backups'),legacyRoot=path.join(output,'legacy-backup');fs.mkdirSync(backupRoot,{recursive:true});fs.mkdirSync(legacyRoot,{recursive:true});
const partialMode=false;
const data=path.join(output,'data'),profile=path.join(output,'profile');
const report={ok:false,checks:[],errors:[],boundary:'Actual formal Electron/settings/Pi, synthetic SSE only, real HTML/PPT/SQLite backup, tamper/legacy verification and pause cold restart. No new-directory restore, real-provider quality, installer or complete C03 acceptance.'};
const html='<!doctype html><html lang="zh-CN"><title>浮力探究</title><body><label>排液体积<input id="volume" type="range" min="1" max="10" value="1"></label><output id="force">10 N</output><script>volume.oninput=()=>force.textContent=volume.value*10+" N";</script></body></html>';
let application,page,sessionId;
const query=(sql)=>{const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});try{return db.prepare(sql).all();}finally{db.close();}};
const until=async(action,ms=45000)=>{const deadline=Date.now()+ms;while(Date.now()<deadline){const value=await action();if(value)return value;await new Promise(resolve=>setTimeout(resolve,70));}throw Error('UI operation timed out');};
const check=name=>{report.checks.push(name);console.log('PASS '+name);};
async function launch(){
 const env={...process.env,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),OMNI_EDU_DATA_ROOT:data,OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_E2E_DIALOG_MODE:'1',OMNI_EDU_XIAOZHI_FILE_WRITES:paused?'0':'1',OMNI_EDU_E2E_DATA_BACKUP_EXPORT_DIALOG_QUEUE:JSON.stringify([backupRoot]),OMNI_EDU_E2E_DATA_BACKUP_VERIFY_DIALOG_QUEUE:JSON.stringify(['$last','$last',legacyRoot]),DEEPSEEK_API_KEY:'synthetic-local-only',DEEPSEEK_MODEL:'deepseek-flash'};
 for(const key of ['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL'])delete env[key];
 application=await electron.launch({args:[path.join(desktop,'out/main/index.js'),'--user-data-dir='+profile],cwd:desktop,env,timeout:60000});
 await application.evaluate(({net},fixture)=>{
  const {html,draft,partialMode,paused}=fixture;
  const state=globalThis.defaultDelivery={index:0,requests:[],blocked:[],html,draft,readStarted:false,readText:[],partialMode,paused,intent:paused?'read':'generate',resumeStarted:false,bundleId:null};
  net.fetch=async(input,init)=>{
   const url=typeof input==='string'?input:input.url;
   if(url.includes('/models'))return new Response(JSON.stringify({object:'list',data:[{id:'deepseek-flash',context_window:1048576,max_output_tokens:32768,input_modalities:['text']}]}),{headers:{'content-type':'application/json'}});
   if(!url.includes('/chat/completions')){state.blocked.push(url);throw Error('External network disabled');}
   const body=JSON.parse(init.body),tools=body.tools?.map(t=>t.function.name)||[],index=state.index++;
   state.requests.push({index,tools});
   const planned=tools.includes('update_task_plan'),stage=index-(planned?1:0);let call;
   const user=body.messages.filter(m=>m.role==='user').at(-1)?.content;
   const text=typeof user==='string'?user:JSON.stringify(user);const userText=text.split('[教师本次请求]').at(-1);
   const latestTool=body.messages.filter(m=>m.role==='tool').at(-1);let actual;try{actual=JSON.parse(latestTool?.content?.split('\n')[0]||'');}catch{}if(typeof actual?.text==='string')state.readText.push(actual.text);
   if(paused&&state.intent==='read'&&index===0)call={name:'find_education_tools',arguments:JSON.stringify({query:'office_read_document'})};
   else if(paused&&state.intent==='read'&&index===1)call={name:'office_read_document',arguments:JSON.stringify({path:'浮力讲解.pptx',startLine:1,lineCount:100})};
   else if(paused&&state.intent==='read'){}
   else if(index===0&&planned){const system=body.messages.filter(m=>m.role==='system').map(m=>m.content).join('\n');const version=Number([...system.matchAll(/"requirementsVersion":(\d+)/g)].at(-1)?.[1]||1);call={name:'update_task_plan',arguments:JSON.stringify({schemaVersion:'xiaozhi.task-plan.v3',requirementsVersion:version,expectedRevision:0,reason:'整包保存合成教学文件',steps:[{id:'deliver',text:'整包保存HTML与PPT',dependsOn:[],reported:'pending',kind:'saved_bundle',target:'current'},{id:'review',text:'教师核对教学内容',dependsOn:['deliver'],reported:'pending',kind:'human'}]})};}
   else if(stage===0)call={name:'office_deliver_files',arguments:JSON.stringify({files:[{fileId:'html',kind:'text',path:'浮力演示.html',content:state.html},{fileId:'ppt',kind:'office',path:'浮力讲解.pptx',format:'pptx',sources:[],draft:state.draft}],...(planned?{taskStepId:'deliver'}:{})})};
   const delta=call?{tool_calls:[{index:0,id:'default-delivery-'+index,type:'function',function:call}]}:{content:paused?'自动文件生成已暂停，已有文件仍可读取。':'两份文件已保存，请核对教学内容。'};
   const chunk=(d,reason=null)=>'data: '+JSON.stringify({id:'local-only',object:'chat.completion.chunk',created:0,model:body.model,choices:[{index:0,delta:d,finish_reason:reason}]})+'\n\n';
   return new Response(chunk({role:'assistant',content:''})+chunk(delta)+chunk({},call?'tool_calls':'stop')+'data: [DONE]\n\n',{headers:{'content-type':'text/event-stream'}});
  };
 },{html,draft:presentationFixture,partialMode,paused});
 page=await application.firstWindow();page.on('pageerror',e=>report.errors.push(String(e)));page.on('console',m=>{if(m.text().includes('snapshot-')){(report.diagnostics??=[]).push(m.text());console.log(m.text());}});await page.getByTestId('xiaozhi-pi-workspace').waitFor({timeout:60000});
 await page.waitForFunction(()=>{const input=document.querySelector('[data-testid="office-prompt-input"]');return input&&!input.disabled&&!document.querySelector('[data-testid="pi-workspace-loading"]');},null,{timeout:60000});
 sessionId=await page.locator('.office-composer-container').getAttribute('data-session-id');
}
try{
 await launch();assert(sessionId);
 if(resumeRoot){
 const outputFile=query('SELECT file_path FROM document_artifacts')[0].file_path,htmlFile=path.join(path.dirname(outputFile),'浮力演示.html'),originalHtml=fs.readFileSync(htmlFile),originalPpt=fs.readFileSync(outputFile),binding=query('SELECT session_file FROM xiaozhi_pi_session_bindings')[0];await page.getByTestId('pi-file-writes-paused').waitFor();
 async function send(text){const previous=query('SELECT id FROM ai_agent_runs ORDER BY created_at DESC LIMIT 1')[0]?.id;await page.getByTestId('office-prompt-input').fill(text);await page.getByRole('button',{name:'发送消息',exact:true}).click();await until(()=>{const r=query('SELECT id,status,error_message FROM ai_agent_runs ORDER BY created_at DESC LIMIT 1')[0];if(!r||r.id===previous)return false;if(r.status==='failed')throw Error(r.error_message);return r.status==='succeeded';});}
 const before={text:query('SELECT count(*) n FROM xiaozhi_pi_text_changes')[0].n,office:query('SELECT count(*) n FROM xiaozhi_pi_office_drafts')[0].n,bundles:query('SELECT count(*) n FROM xiaozhi_delivery_bundles')[0].n};
 await application.evaluate(()=>{globalThis.defaultDelivery.index=0;globalThis.defaultDelivery.intent='write';});await send('生成一组新的HTML和PPT教学文件');
 assert.deepEqual({text:query('SELECT count(*) n FROM xiaozhi_pi_text_changes')[0].n,office:query('SELECT count(*) n FROM xiaozhi_pi_office_drafts')[0].n,bundles:query('SELECT count(*) n FROM xiaozhi_delivery_bundles')[0].n},before);assert(fs.readFileSync(htmlFile).equals(originalHtml));assert(fs.readFileSync(outputFile).equals(originalPpt));
 const denied=query("SELECT success FROM xiaozhi_tool_receipts WHERE tool='office_deliver_files' ORDER BY updated_at DESC LIMIT 1")[0];assert.equal(denied.success,0);const native=fs.readFileSync(path.join(data,'xiaozhi-pi',binding.session_file),'utf8');assert(native.includes('file_writes_disabled'));check('Even an attempted real Pi write is refused before creating a new draft or file; old saved outputs retain exact bytes');
 await until(async()=>!(await page.locator('body').textContent()).includes('过程记录暂时无法核对'),10000);await page.screenshot({path:path.join(output,'paused-read.png')});

 }else{

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
 const binding=query('SELECT session_file FROM xiaozhi_pi_session_bindings')[0];
 const outputFile=query('SELECT file_path FROM document_artifacts')[0].file_path,root=path.dirname(outputFile),htmlFile=path.join(root,'浮力演示.html');
 const originalHtml=fs.readFileSync(htmlFile),originalPpt=fs.readFileSync(outputFile);
 await page.getByRole('button',{name:'设置',exact:true}).click();await page.getByTestId('pi-settings-workspace').waitFor();await page.getByTestId('pi-settings-tab-backup').click();
 await page.getByTestId('data-backup-export').click();await page.getByTestId('data-backup-export-success').waitFor({timeout:60000});
 const backup=await page.getByTestId('data-backup-export-path').innerText(),manifestFile=path.join(backup,'omni-edu-backup-manifest.v1.json'),manifest=JSON.parse(fs.readFileSync(manifestFile,'utf8'));
 assert.equal(manifest.conversationOutputs.fileCount,2);assert((await page.getByTestId('data-backup-generated-count').innerText()).includes('2'));
 const prefix=manifest.conversationOutputs.backupPrefix;
 assert(fs.readFileSync(path.join(backup,prefix,sessionId,'浮力演示.html')).equals(originalHtml));assert(fs.readFileSync(path.join(backup,prefix,sessionId,'浮力讲解.pptx')).equals(originalPpt));
 const savedDb=new DatabaseSync(path.join(backup,'app.db'),{readOnly:true});try{assert.equal(savedDb.prepare('SELECT count(*) n FROM xiaozhi_delivery_bundles').get().n,1);assert.equal(savedDb.prepare('SELECT state FROM xiaozhi_pi_office_drafts').get().state,'saved');}finally{savedDb.close();}
 report.backup={path:backup,manifest};check('Settings backup includes exact HTML/PPT bytes, original SQLite bundle/Office facts and a versioned generated-output manifest');
 await page.getByTestId('data-backup-verify').click();await page.getByTestId('data-backup-verify-success').waitFor({timeout:60000});
 fs.appendFileSync(path.join(backup,prefix,sessionId,'浮力演示.html'),'changed');await page.getByTestId('data-backup-verify').click();await page.getByTestId('data-backup-verify-failed').waitFor({timeout:60000});check('The original visible verifier detects a changed generated file rather than reporting a complete backup');
 const legacy={...manifest,files:manifest.files.filter(f=>!f.path.startsWith(prefix+'/'))};delete legacy.conversationOutputs;legacy.fileCount=legacy.files.length;
 for(const f of legacy.files){const to=path.join(legacyRoot,f.path);fs.mkdirSync(path.dirname(to),{recursive:true});fs.copyFileSync(path.join(backup,f.path),to);}fs.writeFileSync(path.join(legacyRoot,'omni-edu-backup-manifest.v1.json'),JSON.stringify(legacy));
 await page.getByTestId('data-backup-verify').click();await page.getByTestId('data-backup-verify-success').waitFor({timeout:60000});check('The unchanged v1 backup format without output metadata remains verifiable through settings');
 await page.screenshot({path:path.join(output,'backup-settings.png')});await page.getByTestId('nav-ai').click();
 await application.close();application=undefined;paused=true;await launch();await page.getByTestId('pi-file-writes-paused').waitFor();assert.equal(query('SELECT session_file FROM xiaozhi_pi_session_bindings')[0].session_file,binding.session_file);
 const snapPaused=await page.evaluate(id=>window.omniEdu.getXiaozhiSnapshot(id),sessionId);assert.equal(snapPaused.fileWritesEnabled,false);assert(snapPaused.deliveries[0].state==='saved');
 await page.getByTestId('pi-text-open').last().click();const frame=page.frameLocator('[data-testid="pi-file-preview"] [data-testid="pi-science-demo"]');await frame.locator('#volume').fill('4');await frame.locator('#volume').dispatchEvent('input');assert.equal(await frame.locator('#force').textContent(),'40 N');
 await page.getByTestId('pi-office-open').last().click();await until(async()=>(await page.getByTestId('pi-file-document').textContent()).includes('整包教师讲解备注'));check('Cold startup with automatic writes disabled preserves native identity, interactive HTML and actual PPT/notes reading');
 async function send(text){const previous=query('SELECT id FROM ai_agent_runs ORDER BY created_at DESC LIMIT 1')[0]?.id;await page.getByTestId('office-prompt-input').fill(text);await page.getByRole('button',{name:'发送消息',exact:true}).click();await until(()=>{const r=query('SELECT id,status,error_message FROM ai_agent_runs ORDER BY created_at DESC LIMIT 1')[0];if(!r||r.id===previous)return false;if(r.status==='failed')throw Error(r.error_message);return r.status==='succeeded';});}
 await send('读取之前保存的PPT讲解文件并简要说明');
 const read=await application.evaluate(()=>({requests:globalThis.defaultDelivery.requests,text:globalThis.defaultDelivery.readText}));assert(read.requests.length>=3);assert(read.text.join('\n').includes('浮力'));assert(query("SELECT success FROM xiaozhi_tool_receipts WHERE tool='office_read_document' ORDER BY updated_at DESC LIMIT 1")[0].success===1);check('A real continued Pi turn reads saved output under the pause switch without native capability reconfiguration');
 const before={text:query('SELECT count(*) n FROM xiaozhi_pi_text_changes')[0].n,office:query('SELECT count(*) n FROM xiaozhi_pi_office_drafts')[0].n,bundles:query('SELECT count(*) n FROM xiaozhi_delivery_bundles')[0].n};
 await application.evaluate(()=>{globalThis.defaultDelivery.index=0;globalThis.defaultDelivery.intent='write';});await send('生成一组新的HTML和PPT教学文件');
 assert.deepEqual({text:query('SELECT count(*) n FROM xiaozhi_pi_text_changes')[0].n,office:query('SELECT count(*) n FROM xiaozhi_pi_office_drafts')[0].n,bundles:query('SELECT count(*) n FROM xiaozhi_delivery_bundles')[0].n},before);assert(fs.readFileSync(htmlFile).equals(originalHtml));assert(fs.readFileSync(outputFile).equals(originalPpt));
 const denied=query("SELECT success FROM xiaozhi_tool_receipts WHERE tool='office_deliver_files' ORDER BY updated_at DESC LIMIT 1")[0];assert.equal(denied.success,0);const native=fs.readFileSync(path.join(data,'xiaozhi-pi',binding.session_file),'utf8');assert(native.includes('file_writes_disabled'));check('Even an attempted real Pi write is refused before creating a new draft or file; old saved outputs retain exact bytes');
 await until(async()=>!(await page.locator('body').textContent()).includes('过程记录暂时无法核对'),10000);await page.screenshot({path:path.join(output,'paused-read.png')});
 }
 assert.deepEqual(report.errors,[]);report.ok=true;
}catch(error){report.error=String(error.stack);process.exitCode=1;console.error(report.error);if(page)await page.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});}
finally{await application?.close();fs.writeFileSync(path.join(output,resumeRoot?'resume-report.json':'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({ok:report.ok,checks:report.checks.length,output}));}
