import '../office-agent/register-source.mjs';
import {presentationFixture} from './presentation-fixture.mjs';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {_electron as electron} from 'playwright';
const desktop=path.resolve(import.meta.dirname,'../..'),output=fs.mkdtempSync(path.join(os.tmpdir(),'xiaozhi-default-ui-'));
const presentationMode=process.argv.includes('--presentation');
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
  const {html,draft}=fixture;
  const state=globalThis.defaultDelivery={index:0,requests:[],blocked:[],html,draft,readStarted:false,readText:[]};
  net.fetch=async(input,init)=>{
   const url=typeof input==='string'?input:input.url;
   if(url.includes('/models'))return new Response(JSON.stringify({object:'list',data:[{id:'deepseek-flash',context_window:1048576,max_output_tokens:32768,input_modalities:['text']}]}),{headers:{'content-type':'application/json'}});
   if(!url.includes('/chat/completions')){state.blocked.push(url);throw Error('External network disabled');}
   const body=JSON.parse(init.body),tools=body.tools?.map(t=>t.function.name)||[],index=state.index++;
   state.requests.push({index,tools});
   const planned=tools.includes('update_task_plan'),stage=index-(planned?1:0);let call;
   if(index===0&&planned){const system=body.messages.filter(m=>m.role==='system').map(m=>m.content).join('\n');const version=Number([...system.matchAll(/"requirementsVersion":(\d+)/g)].at(-1)?.[1]||1);call={name:'update_task_plan',arguments:JSON.stringify({schemaVersion:'xiaozhi.task-plan.v3',requirementsVersion:version,expectedRevision:0,reason:'保存两份合成教学文件',steps:[{id:'html',text:'保存HTML演示',dependsOn:[],reported:'pending',kind:'saved_text',target:'浮力演示.html'},{id:'ppt',text:'保存PPT讲解',dependsOn:[],reported:'pending',kind:'saved_office',target:'浮力讲解.pptx'},{id:'review',text:'教师核对教学内容',dependsOn:['html','ppt'],reported:'pending',kind:'human'}]})};}
   else if(stage===0)call={name:'office_create_text',arguments:JSON.stringify({path:'浮力演示.html',content:state.html,...(planned?{taskStepId:'html'}:{})})};
   else if(stage===1)call={name:'office_create_document',arguments:JSON.stringify({path:'浮力讲解.pptx',format:'pptx',sources:[],draft:state.draft||{schemaVersion:'xiaozhi.office-draft.v1',title:'浮力讲解',sections:[{heading:'浮力实验',paragraphs:['F浮=ρ液gV排。这里是合成教学内容，科学正确性仍待核对。']}]},...(planned?{taskStepId:'ppt'}:{})})};
   else if(stage>=2&&state.draft){
    const tool=body.messages.filter(m=>m.role==='tool').at(-1);let result;try{result=JSON.parse(typeof tool?.content==='string'?tool.content.split('\n')[0]:'');}catch{}
    if(result?.format==='pptx'&&typeof result.text==='string')state.readText.push(result.text);
    if(!tools.includes('office_read_document'))call={name:'find_education_tools',arguments:JSON.stringify({query:'office_read_document'})};
    else if(!state.readStarted||result?.format==='pptx'&&result.source.locator.end<result.totalLines){call={name:'office_read_document',arguments:JSON.stringify({path:'浮力讲解.pptx',startLine:!state.readStarted?1:result.source.locator.end+1,lineCount:100})};state.readStarted=true;}
    if(index>8)throw Error('Unexpected controlled presentation request loop');
   }
   const delta=call?{tool_calls:[{index:0,id:'default-delivery-'+index,type:'function',function:call}]}:{content:'两份文件已保存，请核对教学内容。'};
   const chunk=(d,reason=null)=>'data: '+JSON.stringify({id:'local-only',object:'chat.completion.chunk',created:0,model:body.model,choices:[{index:0,delta:d,finish_reason:reason}]})+'\n\n';
   return new Response(chunk({role:'assistant',content:''})+chunk(delta)+chunk({},call?'tool_calls':'stop')+'data: [DONE]\n\n',{headers:{'content-type':'text/event-stream'}});
  };
 },{html,draft:presentationMode?presentationFixture:undefined});
 page=await application.firstWindow();page.on('pageerror',e=>report.errors.push(String(e)));await page.getByTestId('xiaozhi-pi-workspace').waitFor({timeout:60000});
 await page.waitForFunction(()=>{const input=document.querySelector('[data-testid="office-prompt-input"]');return input&&!input.disabled&&!document.querySelector('[data-testid="pi-workspace-loading"]');},null,{timeout:60000});
 sessionId=await page.locator('.office-composer-container').getAttribute('data-session-id');
}
try{
 await launch();assert(sessionId);assert.equal(query('SELECT count(*) n FROM xiaozhi_pi_workspaces')[0].n,0);
 await page.getByTestId('office-prompt-input').fill(presentationMode?'为八年级生成一份浮力HTML演示和8页可编辑PPT，每页有教师讲解备注，学生投影不直接显示检查题答案。保存实际文件。':'生成一份浮力HTML演示和一份PPT讲解文件，存到小智生成文件区。');await page.getByRole('button',{name:'发送消息',exact:true}).click();
 await page.getByTestId('pi-text-approve').waitFor({timeout:45000});await page.getByTestId('pi-text-approve').click();
 await page.getByTestId('pi-office-approve').waitFor({timeout:45000});
 if(presentationMode){
  await page.getByTestId('pi-presentation-notes').waitFor();await page.getByRole('tab',{name:'修改拟内容',exact:true}).click();
  await page.getByTestId('pi-office-note-3-0').fill('教师修订讲解：先预测排液体积变化。');await page.getByTestId('pi-office-heading-3').fill('排液体积');
  await page.getByTestId('pi-office-save-draft').click();await until(()=>query('SELECT revision FROM xiaozhi_pi_office_drafts')[0]?.revision===1);
  await page.waitForFunction(()=>!document.querySelector('[data-testid="pi-office-approve"]')?.disabled);check('Teacher edits page four title and private notes through the existing revision approval card');
 }
 await page.getByTestId('pi-office-approve').click();
 await until(()=>{const run=query('SELECT status,error_message FROM ai_agent_runs ORDER BY created_at DESC LIMIT 1')[0];if(run?.status==='failed')throw Error('Actual run: '+run.error_message);return run?.status==='succeeded';});
 const rows=query('SELECT file_path FROM document_artifacts'),ppt=rows.find(r=>r.file_path.endsWith('.pptx'));assert(ppt&&fs.existsSync(ppt.file_path));assert(fs.readFileSync(ppt.file_path).subarray(0,2).equals(Buffer.from('PK')));
 const htmlPath=path.join(path.dirname(ppt.file_path),'浮力演示.html');assert(fs.readFileSync(htmlPath,'utf8').includes('xiaozhi.html-artifact.v1'));assert.equal(query('SELECT count(*) n FROM xiaozhi_pi_workspaces')[0].n,0);check('No selected directory: formal composer → Pi → two approval cards → actual HTML/PPT files');
 await page.getByTestId('pi-text-open').click();const frame=page.frameLocator('[data-testid="pi-file-preview"] [data-testid="pi-science-demo"]');await frame.locator('#volume').fill('4');await frame.locator('#volume').dispatchEvent('input');assert.equal(await frame.locator('#force').textContent(),'40 N');check('Saved generic HTML opens in the existing file panel with working interaction');
 if(presentationMode){
  const {readPresentationNotes}=await import('./presentation-readback.ts');const notes=await readPresentationNotes(fs.readFileSync(ppt.file_path));assert.equal(notes.length,8);assert(notes[3].text.includes('教师修订讲解：先预测排液体积变化。'));
  await page.getByTestId('pi-office-open').click();await until(async()=>(await page.getByTestId('pi-file-document').textContent()).includes('教师修订讲解：先预测排液体积变化。'));
  const transport=await application.evaluate(()=>globalThis.defaultDelivery);assert(transport.readText.join('\n').includes('教师修订讲解：先预测排液体积变化。'));assert(transport.readText.join('\n').includes('检查①参考答案6N'));check('Real document utility and model read tool both read actual saved private notes after teacher revision');
 }
 const binding=query('SELECT session_file FROM xiaozhi_pi_session_bindings')[0];assert(binding);const model=await application.evaluate(()=>globalThis.defaultDelivery);assert(model.requests.every(r=>r.tools.includes('office_create_text')&&r.tools.includes('office_create_document')));report.transport=model;
 await page.screenshot({path:path.join(output,'saved-preview.png')});
 await application.close();application=undefined;await launch();
 assert.equal(query('SELECT session_file FROM xiaozhi_pi_session_bindings')[0].session_file,binding.session_file);assert.equal(fs.readFileSync(htmlPath,'utf8').includes('浮力探究'),true);assert(query('SELECT state FROM xiaozhi_pi_office_drafts').some(r=>r.state==='saved'));check('Restart retains native binding, saved Office fact and actual output files');
 assert.deepEqual(report.errors,[]);report.ok=true;
}catch(error){report.error=String(error.stack);process.exitCode=1;console.error(report.error);if(page)await page.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});}
finally{await application?.close();fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({ok:report.ok,checks:report.checks.length,output}));}
