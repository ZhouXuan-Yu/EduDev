import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {_electron as electron} from 'playwright';
import {presentationFixture} from './presentation-fixture.mjs';

const desktop=path.resolve(import.meta.dirname,'../..'),output=fs.mkdtempSync(path.join(os.tmpdir(),'xiaozhi-teacher-ui-'));
const data=path.join(output,'data'),profile=path.join(output,'profile');fs.mkdirSync(data);fs.mkdirSync(profile);
const report={ok:false,output,checks:[],errors:[],boundary:'Formal Pi composer, actual PPT inspection, original teacher review, SQLite/files and cold readback. Local synthetic SSE, no paid provider. Quantity evidence does not prove semantic/visual teaching quality.'};
const hash=b=>createHash('sha256').update(b).digest('hex');
const query=(sql,args=[])=>{const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});try{return db.prepare(sql).all(...args);}finally{db.close();}};
const until=async(fn,ms=180000)=>{const end=Date.now()+ms;while(Date.now()<end){const value=await fn();if(value)return value;await new Promise(r=>setTimeout(r,120));}throw Error('Teacher-rule UI observation timed out');};
const check=name=>{report.checks.push(name);console.log('PASS '+name);};
const env={...process.env,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),OMNI_EDU_DATA_ROOT:data,OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_E2E_DIALOG_MODE:'1',DEEPSEEK_API_KEY:'synthetic-local-only',DEEPSEEK_MODEL:'deepseek-flash'};
for(const key of ['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL'])delete env[key];
let app,page;
async function launch(cold=false){
 app=await electron.launch({args:[path.join(desktop,'out/main/index.js'),'--user-data-dir='+profile],cwd:desktop,env,timeout:60000});
 await app.evaluate(({net},{fixture,cold})=>{
  const state=globalThis.teacherRuleTest={requests:[],receipts:[],cold,stage:0};
  const repaired=structuredClone(fixture);repaired.sections[6].heading='三道理解检查';repaired.sections[6].paragraphs.push('③ 解释木块密度不变而液体密度增大时，浸入深度如何变化？');
  repaired.sections[6].speakerNotes.push({kind:'answer',text:'检查③：漂浮时浮力等于重力；液体密度增大时排液体积减小，因此浸入更浅。'});
  const broken=structuredClone(fixture);broken.sections.pop();
  net.fetch=async(input,init)=>{
   const url=typeof input==='string'?input:input.url;
   if(url.includes('/models'))return new Response(JSON.stringify({object:'list',data:[{id:'deepseek-flash',context_window:1048576,max_output_tokens:32768,input_modalities:['text']}]}),{headers:{'content-type':'application/json'}});
   if(!url.includes('/chat/completions')||cold)throw Error('External network and cold replay disabled');
   const body=JSON.parse(init.body),stage=state.stage++;let call;
   const raw=body.messages.filter(m=>m.role==='tool').at(-1)?.content;
   const text=typeof raw==='string'?raw:raw?.filter(c=>c.type==='text').map(c=>c.text).join('\n');
   const receipt=text?.split('\n').map(line=>{try{return JSON.parse(line);}catch{return null;}}).find(v=>v&&'success'in v);
   if(receipt)state.receipts.push(receipt);
   if(stage===0){
    const system=body.messages.filter(m=>m.role==='system').map(m=>m.content).join('\n');
    const version=Number([...system.matchAll(/"requirementsVersion":(\d+)/g)].at(-1)?.[1]||1);
    call={name:'update_task_plan',arguments:JSON.stringify({schemaVersion:'xiaozhi.task-plan.v3',requirementsVersion:version,expectedRevision:0,reason:'读取当前教师要求，真实生成并核验后统一审阅',steps:[{id:'deliver',text:'交付八页课件及教师备注和三道理解检查',dependsOn:[],reported:'pending',kind:'saved_bundle',target:'current'},{id:'review',text:'教师核对最终教学成果',dependsOn:['deliver'],reported:'pending',kind:'human'}]})};
   }else if(stage===1||stage===2){
    if(stage===2&&receipt?.error!=='delivery_check_failed')throw Error('Actual failed candidate was not returned to Pi: '+JSON.stringify(receipt));
    call={name:'office_deliver_files',arguments:JSON.stringify({files:[{fileId:'slides',kind:'office',path:'八页课件.pptx',format:'pptx',draft:stage===1?broken:repaired,sources:[]},{fileId:'handout',kind:'text',path:'配套说明.html',content:'<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>浮力说明</title><h1>浮力课堂使用说明</h1><p>课件用于解释漂浮受力，讲解备注和检查题均在PPT中。</p></html>'}],checks:[{path:'八页课件.pptx',rules:{pages:7,notes:false,questions:1}},{path:'配套说明.html',rules:{}}],taskStepId:'deliver'})};
   }else if(!receipt?.success)throw Error('Original approved publication failed: '+JSON.stringify(receipt));
   state.requests.push({stage,tool:call?.name||null,at:Date.now()});
   const chunk=(delta,finish_reason=null)=>'data: '+JSON.stringify({id:'teacher-check',object:'chat.completion.chunk',created:0,model:body.model,choices:[{index:0,delta,finish_reason}]})+'\n\n';
   return new Response(chunk({role:'assistant',content:''})+chunk(call?{tool_calls:[{index:0,id:'teacher-check-'+stage,type:'function',function:call}]}:{content:'课件已按教师确认保存。实际八页、逐页备注、三道带编号题项已核对；完整教学质量和视觉审阅仍需教师判断。'})+chunk({},call?'tool_calls':'stop')+'data: [DONE]\n\n',{headers:{'content-type':'text/event-stream'}});
  };
 },{fixture:presentationFixture,cold});
 page=await app.firstWindow();page.on('pageerror',e=>report.errors.push(String(e)));await page.getByTestId('xiaozhi-pi-workspace').waitFor({timeout:60000});
}
try{
 await launch();
 await page.getByTestId('office-prompt-input').fill('新任务：制作八页课件.pptx及配套说明.html，PPT必须为8页，每页有教师讲解备注，PPT中包含3道理解检查题。HTML是一份离线课堂使用说明。使用本次合成浮力内容，先核验并修复后统一交付。');
 await page.getByRole('button',{name:'发送消息',exact:true}).click();
 const bundle=page.getByTestId('pi-delivery-bundle').last();await until(async()=>{const run=query('SELECT status,error_message FROM ai_agent_runs ORDER BY rowid DESC LIMIT 1')[0];if(run?.status==='failed')throw Error(run.error_message);const button=bundle.getByTestId('pi-delivery-approve');return await button.isVisible()&&!await button.isDisabled();});
 let inspections=query('SELECT report_json FROM xiaozhi_delivery_inspections ORDER BY created_at').map(r=>JSON.parse(r.report_json));
 assert.equal(inspections.length,2);const bad=inspections[0],good=inspections[1],rules=good.files[0].rules;
 assert.equal(bad.state,'failed');assert.equal(bad.files[0].pageCount,7);
 for(const id of ['pages','questions'])assert(bad.files[0].checks.some(c=>c.checkId===id&&c.state==='failed'),id);
 assert.equal(rules.pages,8);assert.equal(rules.notes,true);assert.equal(rules.questions,3);
 assert.equal(good.files[1].rules.pages,undefined);assert.equal(good.files[1].rules.questions,undefined);
 assert(rules.bindings.some(b=>b.checks.includes('pages')&&b.checks.includes('questions')&&b.checks.includes('notes')));
 assert(good.requirements.criteria.some(c=>c.teacher===true));assert.equal(good.repairAttempts.content,1);
 assert(good.requirementCoverage.some(c=>c.state==='checks_passed'&&c.semantics==='unchecked'));
 for(const id of ['pages','questions'])assert(good.files[0].checks.some(c=>c.checkId===id&&c.state==='passed'));
 assert.equal(good.files[0].checks.filter(c=>c.code==='speaker_notes'&&c.state==='passed').length,8);
 assert.equal(query('SELECT count(*) n FROM document_artifacts')[0].n,0);
 check('Teacher 8/pages/notes/3 questions override both weak model candidates; actual 7-page/2-question failure reaches Pi and one repair passes before formal publication');
 await bundle.getByTestId('pi-delivery-check').first().locator(':scope > [data-slot="disclosure-heading"] > button[data-slot="disclosure-trigger"]').click();
 await bundle.getByTestId('pi-file-check-result').first().waitFor();
 await bundle.getByTestId('pi-delivery-check').first().getByRole('button',{name:'逐项结果与版本',exact:true}).click();
 assert((await bundle.innerText()).includes('题项'));
 await bundle.getByTestId('pi-delivery-approve').click();
 await until(()=>{const r=query('SELECT status,error_message FROM ai_agent_runs ORDER BY rowid DESC LIMIT 1')[0];if(r?.status==='failed')throw Error(r.error_message);return r?.status==='succeeded';});
 const artifact=query("SELECT file_path,content_hash FROM document_artifacts WHERE artifact_type='pptx'")[0];
 inspections=query('SELECT report_json FROM xiaozhi_delivery_inspections ORDER BY created_at').map(r=>JSON.parse(r.report_json));
 const latest=inspections.at(-1);assert.equal(hash(fs.readFileSync(artifact.file_path)),artifact.content_hash);assert.equal(latest.files[0].sha256,artifact.content_hash);
 assert.equal(query('SELECT count(*) n FROM document_artifacts')[0].n,1);
 const drafts=query('SELECT id,state,relative_path,output_hash FROM xiaozhi_pi_office_drafts ORDER BY created_at');assert(drafts.some(d=>d.state==='interrupted'));
 const native=query('SELECT session_file FROM xiaozhi_pi_session_bindings')[0].session_file;
 assert(fs.readFileSync(path.isAbsolute(native)?native:path.join(data,'xiaozhi-pi',native),'utf8').includes('deliveryInspection'));
 check('Original single teacher confirmation publishes exactly inspected PPT bytes; failed draft and native inspection evidence remain retained');
 report.viewports=[];
 for(const viewport of [{width:1366,height:768},{width:1920,height:1080}]){await page.setViewportSize(viewport);report.viewports.push(await page.evaluate(()=>({width:innerWidth,height:innerHeight,dpr:devicePixelRatio})));await page.screenshot({path:path.join(output,viewport.width+'.png')});}
 report.wire=await app.evaluate(()=>globalThis.teacherRuleTest);report.inspections=inspections;report.drafts=drafts;report.artifact=artifact;
 const snapshot=JSON.stringify({drafts,inspections,artifact});await app.close();app=null;await launch(true);
 assert.equal(JSON.stringify({drafts:query('SELECT id,state,relative_path,output_hash FROM xiaozhi_pi_office_drafts ORDER BY created_at'),inspections:query('SELECT report_json FROM xiaozhi_delivery_inspections ORDER BY created_at').map(r=>JSON.parse(r.report_json)),artifact:query("SELECT file_path,content_hash FROM document_artifacts WHERE artifact_type='pptx'")[0]}),snapshot);
 assert.equal(hash(fs.readFileSync(artifact.file_path)),artifact.content_hash);assert.equal((await app.evaluate(()=>globalThis.teacherRuleTest.requests)).length,0);
 assert.equal(query("SELECT count(*) n FROM ai_agent_runs WHERE status IN ('running','pending')")[0].n,0);
 check('Same-data cold restart preserves file hash, failed draft and requirement/check versions with zero model replay and zero running tasks');
 assert.deepEqual(report.errors,[]);report.ok=true;
}catch(error){report.error=String(error.stack||error);report.wire=await app?.evaluate(()=>globalThis.teacherRuleTest).catch(()=>null);process.exitCode=1;await page?.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});}
finally{await app?.close();fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({ok:report.ok,checks:report.checks,output,error:report.error},null,2));}
