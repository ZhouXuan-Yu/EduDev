/** Continue the unsaved original bundle after a selector-only test failure; never recreate its teaching content. */
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';import {DatabaseSync} from 'node:sqlite';import {_electron} from 'playwright';
const output=path.resolve(process.argv[2]||''),data=path.join(output,'data'),profile=path.join(output,'profile'),desktop=path.resolve(import.meta.dirname,'../..');
assert(fs.existsSync(path.join(output,'report.json')),'Provide the retained failed test output');
const report={ok:false,output,checks:[],errors:[],boundary:'Same saved drafts and reports. Original visible resume and single review; synthetic local SSE supplies only resumeBundleId, no replacement teaching content. Cold readback has zero model calls.'};
const hash=b=>createHash('sha256').update(b).digest('hex'),query=(sql,args=[])=>{const d=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});try{return d.prepare(sql).all(...args);}finally{d.close();}};
const until=async fn=>{const end=Date.now()+180000;while(Date.now()<end){const v=await fn();if(v)return v;await new Promise(r=>setTimeout(r,120));}throw Error('Resume observation timed out');},check=s=>{report.checks.push(s);console.log('PASS '+s);};
const env={...process.env,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),OMNI_EDU_DATA_ROOT:data,OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_E2E_DIALOG_MODE:'1',DEEPSEEK_API_KEY:'synthetic-local-only',DEEPSEEK_MODEL:'deepseek-flash'};for(const k of ['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL'])delete env[k];let app,page;
const original=query('SELECT report_json FROM xiaozhi_delivery_inspections ORDER BY created_at').map(r=>JSON.parse(r.report_json)),drafts=query('SELECT id,relative_path,draft_json FROM xiaozhi_pi_office_drafts ORDER BY created_at');
const parent=JSON.parse(query('SELECT value_json FROM xiaozhi_delivery_bundles ORDER BY created_at DESC LIMIT 1')[0].value_json);
async function launch(cold=false){
 app=await _electron.launch({args:[path.join(desktop,'out/main/index.js'),'--user-data-dir='+profile],cwd:desktop,env,timeout:60000});
 await app.evaluate(({net},{cold,parentId})=>{
  const s=globalThis.teacherResume={stage:0,requests:[],cold};
  net.fetch=async(input,init)=>{
   const url=typeof input==='string'?input:input.url;if(url.includes('/models'))return new Response(JSON.stringify({object:'list',data:[{id:'deepseek-flash',context_window:1048576,max_output_tokens:32768}]}),{headers:{'content-type':'application/json'}});
   if(!url.includes('/chat/completions')||cold)throw Error('External network and cold replay disabled');
   const body=JSON.parse(init.body),n=s.stage++;let call;
   if(n===0){const sys=body.messages.filter(m=>m.role==='system').map(m=>m.content).join('\n'),v=Number([...sys.matchAll(/"requirementsVersion":(\d+)/g)].at(-1)?.[1]||1);call={name:'update_task_plan',arguments:JSON.stringify({schemaVersion:'xiaozhi.task-plan.v3',requirementsVersion:v,expectedRevision:0,reason:'沿原未保存草稿恢复整包，原教学内容不重做',steps:[{id:'deliver',text:'续交原未保存的课件及说明',dependsOn:[],reported:'pending',kind:'saved_bundle',target:'current'},{id:'review',text:'教师核对最终教学成果',dependsOn:['deliver'],reported:'pending',kind:'human'}]})};}
   else if(n===1)call={name:'office_deliver_files',arguments:JSON.stringify({resumeBundleId:parentId,taskStepId:'deliver'})};
   s.requests.push({stage:n,tool:call?.name||null,arguments:call?JSON.parse(call.arguments):null});
   const chunk=(delta,finish_reason=null)=>'data: '+JSON.stringify({id:'teacher-resume',object:'chat.completion.chunk',created:0,model:body.model,choices:[{index:0,delta,finish_reason}]})+'\n\n';
   return new Response(chunk({role:'assistant',content:''})+chunk(call?{tool_calls:[{index:0,id:'teacher-resume-'+n,type:'function',function:call}]}:{content:'原草稿经教师确认已保存；明确的页数、备注和题数检查通过，完整语义与视觉质量仍未核验。'})+chunk({},call?'tool_calls':'stop')+'data: [DONE]\n\n',{headers:{'content-type':'text/event-stream'}});
  };
 },{cold,parentId:parent.id});
 page=await app.firstWindow();page.on('pageerror',e=>report.errors.push(String(e)));await page.getByTestId('xiaozhi-pi-workspace').waitFor({timeout:60000});
}
try{
 assert(original.length>=2);assert.equal(original[0].state,'failed');assert.equal(original[1].files[0].rules.questions,3);assert.equal(query('SELECT count(*) n FROM document_artifacts')[0].n,0);
 await launch();await page.getByTestId('pi-delivery-bundle').last().getByTestId('pi-delivery-resume').click();
 const bundle=page.getByTestId('pi-delivery-bundle').last();await until(async()=>{const r=query('SELECT status,error_message FROM ai_agent_runs ORDER BY rowid DESC LIMIT 1')[0];if(r?.status==='failed')throw Error(r.error_message);return await bundle.getAttribute('data-bundle-id')!==parent.id&&await bundle.getByTestId('pi-delivery-approve').isVisible()&&!await bundle.getByTestId('pi-delivery-approve').isDisabled();});
 const panel=bundle.getByTestId('pi-delivery-check').first(),disclosure=panel.locator(':scope > [data-slot="disclosure-heading"] > button[data-slot="disclosure-trigger"]');await disclosure.click();await bundle.getByTestId('pi-file-check-result').first().waitFor();await panel.getByRole('button',{name:'逐项结果与版本',exact:true}).click();assert((await bundle.innerText()).includes('题项'));
 assert.deepEqual(query('SELECT id,relative_path,draft_json FROM xiaozhi_pi_office_drafts ORDER BY created_at').slice(0,drafts.length),drafts);
 const newestDraft=query('SELECT draft_json FROM xiaozhi_pi_office_drafts ORDER BY created_at DESC LIMIT 1')[0];assert.equal(newestDraft.draft_json,drafts.at(-1).draft_json);
 check('Visible original resume reuses exact retained teaching draft and linked 8-page/notes/3-question rules; original failed inspections stay byte-identical');
 await bundle.getByTestId('pi-delivery-approve').click();await until(()=>{const r=query('SELECT status,error_message FROM ai_agent_runs ORDER BY rowid DESC LIMIT 1')[0];if(r?.status==='failed')throw Error(r.error_message);return r?.status==='succeeded';});
 const artifact=query("SELECT file_path,content_hash FROM document_artifacts WHERE artifact_type='pptx'")[0],reports=query('SELECT report_json FROM xiaozhi_delivery_inspections ORDER BY created_at').map(r=>JSON.parse(r.report_json)),latest=reports.at(-1);
 assert.deepEqual(reports.slice(0,original.length),original);assert.equal(hash(fs.readFileSync(artifact.file_path)),artifact.content_hash);assert.equal(latest.files[0].sha256,artifact.content_hash);
 assert.equal(latest.files[0].pageCount,8);assert(latest.files[0].checks.some(c=>c.checkId==='questions'&&c.state==='passed'));assert.equal(query('SELECT count(*) n FROM document_artifacts')[0].n,1);
 report.wire=await app.evaluate(()=>globalThis.teacherResume);assert(report.wire.requests.every(r=>!r.arguments||!('files'in r.arguments)));
 check('Original single grouped approval saves actual inspected PPT and HTML, with retained original failure and zero new teaching-content generation');
 report.viewports=[];for(const viewport of [{width:1366,height:768},{width:1920,height:1080}]){await page.setViewportSize(viewport);report.viewports.push(await page.evaluate(()=>({width:innerWidth,height:innerHeight,dpr:devicePixelRatio})));await page.screenshot({path:path.join(output,'resume-'+viewport.width+'.png')});}
 report.inspections=reports;report.artifact=artifact;const snapshot=JSON.stringify({reports,drafts:query('SELECT id,state,output_hash FROM xiaozhi_pi_office_drafts ORDER BY created_at'),artifact});
 await app.close();app=null;await launch(true);
 assert.equal(JSON.stringify({reports:query('SELECT report_json FROM xiaozhi_delivery_inspections ORDER BY created_at').map(r=>JSON.parse(r.report_json)),drafts:query('SELECT id,state,output_hash FROM xiaozhi_pi_office_drafts ORDER BY created_at'),artifact:query("SELECT file_path,content_hash FROM document_artifacts WHERE artifact_type='pptx'")[0]}),snapshot);
 assert.equal(hash(fs.readFileSync(artifact.file_path)),artifact.content_hash);assert.equal((await app.evaluate(()=>globalThis.teacherResume.requests)).length,0);assert.equal(query("SELECT count(*) n FROM ai_agent_runs WHERE status IN ('running','pending')")[0].n,0);assert.deepEqual(report.errors,[]);
 check('Same-data cold restart preserves actual file hash, failed drafts and inspection versions with zero model replay or running tasks');report.ok=true;
}catch(e){report.error=String(e.stack||e);report.wire=await app?.evaluate(()=>globalThis.teacherResume).catch(()=>null);process.exitCode=1;await page?.screenshot({path:path.join(output,'resume-failure.png')}).catch(()=>{});}
finally{await app?.close();const name=process.argv[3]||'resume-report.json';assert(/^[a-z0-9-]+\.json$/.test(name));assert(!fs.existsSync(path.join(output,name)),'Preserve the previous failure report');fs.writeFileSync(path.join(output,name),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({ok:report.ok,output,checks:report.checks,error:report.error},null,2));}
