import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';import {DatabaseSync} from 'node:sqlite';import {_electron as electron} from 'playwright';import {productEntry} from '../product-navigation.mjs';
import {openPaperHistory} from './paper-ui-disclosure.mjs';
const desktop=path.resolve(import.meta.dirname,'../..'),previous=process.env.PAPER_PRINT_EXISTING_ROOT;
const legacyTitle=process.env.PAPER_PRINT_CONFIRMED_TITLE;
const entry=path.resolve(desktop,process.env.OMNI_EDU_TEST_BUILD_ROOT||'out','main/index.js');
assert(previous,'Explicit owned confirmed-paper root required');
const prior=JSON.parse(fs.readFileSync(path.join(previous,'report.json')));
assert(prior.ok);
const output=fs.mkdtempSync(path.join(os.tmpdir(),'xiaozhi-paper-print-ui-')),data=path.join(output,'data'),profile=path.join(output,'profile'),destination=path.join(output,'delivered');
const savedData=path.join(previous,'data');
fs.cpSync(savedData,data,{recursive:true});
fs.cpSync(path.join(previous,'profile'),profile,{recursive:true});
fs.mkdirSync(destination);
// The owned copy always uses the controlled provider in launch(), never the
// credential sealed by a previous real or synthetic run.
const fixtureDb=new DatabaseSync(path.join(data,'app.db'));
try{
 fixtureDb.prepare("DELETE FROM app_settings WHERE key IN ('deepseek','xiaozhi.provider.v1')").run();
}finally{fixtureDb.close();}
const sha=b=>createHash('sha256').update(b).digest('hex');
const query=(sql,args=[])=>{const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});try{return db.prepare(sql).all(...args);}finally{db.close();}};
if(legacyTitle){
 const {relocateBackupDatabase}=await import('../../src/main/backup/restore-database.ts');
 await relocateBackupDatabase(path.join(data,'app.db'),savedData,data,path.join(previous,'XiaozhiOutputs'),path.join(output,'XiaozhiOutputs'));
 const found=query("SELECT id,session_id FROM ai_confirmation_items WHERE action_type='pi_paper_candidate' AND status='confirmed' AND title=?",[legacyTitle]);
 assert.equal(found.length,1,'The selected confirmed paper must exist exactly once.');
 prior.finalId=found[0].id;
 prior.session=found[0].session_id;
}
assert(prior.finalId&&prior.session&&(legacyTitle||prior.basketId));
const beforeQuestions=query('SELECT * FROM question_bank_items ORDER BY id'),beforePapers=query("SELECT * FROM ai_confirmation_items WHERE action_type='pi_paper_candidate' ORDER BY id");
const readBasket=()=>query('SELECT * FROM paper_baskets WHERE id=?',[prior.basketId??null]);
const beforeBasket=readBasket();
const specs=[['student','paper','docx'],['teacher','paper','docx'],['student','answer_sheet','docx'],['student','paper','pdf'],['teacher','paper','pdf'],['student','answer_sheet','pdf']].map(([audience,template,format])=>({audience,template,format,path:audience+'-'+template+'.'+format}));
const report={ok:false,output,sourceRoot:previous,session:prior.session,paperId:prior.finalId,checks:[],files:[],errors:[],paidRequests:0,boundary:'Existing confirmed paper, six export buttons/composer/Pi/Office/file transactions and cold recovery; controlled local SSE, no Office/WPS UI acceptance.'};let app,page;
const save=()=>fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)),check=n=>{report.checks.push(n);save();console.log('PASS '+n);},until=async(fn,ms=120000)=>{const end=Date.now()+ms;while(Date.now()<end){if(await fn())return;await new Promise(r=>setTimeout(r,100));}throw Error('Print UI deadline');};
async function launch(cold=false){const env={...process.env,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),OMNI_EDU_DATA_ROOT:data,OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_E2E_DIALOG_MODE:'1',OMNI_EDU_SKIP_DOTENV:'1',DEEPSEEK_API_KEY:'synthetic-local-only',DEEPSEEK_MODEL:'deepseek-flash'};for(const k of ['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL'])delete env[k];app=await electron.launch({args:[entry,'--user-data-dir='+profile],cwd:desktop,env,timeout:60000});
 await app.evaluate(({net,dialog},v)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[v.destination]});const state=globalThis.paperPrintWire={requests:[],blocked:[],receipts:[]};net.fetch=async(url,init)=>{url=typeof url==='string'?url:url.url;if(url.includes('/models'))return new Response(JSON.stringify({object:'list',data:[{id:'deepseek-flash',context_window:1048576,max_output_tokens:32768,input_modalities:['text'],effort:{supported_levels:['low','high','max'],default_level:'high'}}]}),{headers:{'content-type':'application/json'}});if(v.cold||!url.includes('/chat/completions')){state.blocked.push(url);throw Error('External request/cold replay blocked');}const index=state.requests.length;if(index>=24)throw Error('Synthetic response ceiling');const body=JSON.parse(init.body),spec=v.specs[Math.floor(index/4)],phase=index%4;let call,content='本次导出结束，请以实际文件回执为准。';
 if(phase===0)call={name:'find_education_tools',arguments:JSON.stringify({query:'education_export_paper 导出已确认试卷'})};
 if(phase===1){const system=body.messages.filter(m=>m.role==='system').map(m=>m.content).join('\n'),line=system.split('\n').findLast(l=>l.startsWith('{"schemaVersion":"xiaozhi.task-plan.v3"')),task=line?JSON.parse(line):{requirementsVersion:1,revision:0};call={name:'update_task_plan',arguments:JSON.stringify({schemaVersion:'xiaozhi.task-plan.v3',requirementsVersion:task.requirementsVersion,expectedRevision:task.revision,reason:'按教师选择导出确切确认卷',steps:[{id:'save',text:'保存当前选择文件',dependsOn:[],reported:'pending',kind:'saved_office',target:spec.path},{id:'review',text:'教师核对导出文件',dependsOn:['save'],reported:'pending',kind:'human'}]})};}
 if(phase===2)call={name:'education_export_paper',arguments:JSON.stringify({...spec,taskStepId:'save'})};if(phase===3)state.receipts.push({spec,tool:body.messages.filter(m=>m.role==='tool').at(-1)?.content});state.requests.push({index,tool:call?.name||null,spec});const chunk=(delta,finish_reason=null)=>'data: '+JSON.stringify({id:'paper-print-'+index,object:'chat.completion.chunk',created:0,model:body.model,choices:[{index:0,delta,finish_reason}]})+'\n\n';return new Response(chunk({role:'assistant',content:''})+chunk(call?{tool_calls:[{index:0,id:'paper-print-'+index,type:'function',function:call}]}:{content})+chunk({},call?'tool_calls':'stop')+'data: [DONE]\n\n',{headers:{'content-type':'text/event-stream'}});};},{cold,destination,specs});page=await app.firstWindow();page.on('pageerror',e=>report.errors.push(String(e)));await page.getByTestId('xiaozhi-pi-workspace').waitFor({timeout:60000});}
const snapshot=()=>page.evaluate(id=>window.omniEdu.getXiaozhiSnapshot(id),prior.session);
async function basket(){
 await productEntry(page,'teaching').click();await page.getByTestId('hub-entry-paper').click();
 if(legacyTitle){
  if(!await page.getByTestId('paper-history').isVisible()){
   const automatic=page.getByTestId('paper-entry-automatic');
   if(!await automatic.isVisible())await page.getByRole('button',{name:'更多筛选',exact:true}).click();
   await automatic.click();
  }
  await openPaperHistory(page);
  await page.locator(`[data-testid="paper-saved"][data-paper-id="${prior.finalId}"]`).click();
  await page.getByTestId('paper-to-delivery').click();
 }else{
  await page.getByTestId('paper-basket-stage-preview').click();
 }
 await page.getByTestId('paper-export-entry').waitFor();
}
async function shots(prefix){for(const[width,height]of[[1366,768],[1920,1080]]){await page.setViewportSize({width,height});await page.getByTestId('paper-print-template').scrollIntoViewIfNeeded();assert(!await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1));await page.screenshot({path:path.join(output,prefix+'-'+width+'.png')});}}
try{
 await launch();
 report.bundleSha=sha(fs.readFileSync(entry));
 await basket();
 assert((await page.getByTestId('paper-print-template').innerText()).includes('20 毫米'));
 await shots('entry');
 await page.getByTestId('paper-output-choose').click();
 await until(async()=>!(await page.getByTestId('paper-output-label').innerText()).includes('首次'));
 check('The confirmed paper exposes all six export choices and the A4 template at both sizes');
 for(const spec of specs){
  if(report.files.length)await basket();
  const choice=spec.template==='answer_sheet'?'answer_sheet':spec.audience;
  await page.getByTestId('paper-export-'+choice+'-'+spec.format).click();
  await page.getByTestId('office-prompt-input').waitFor();
  assert((await page.getByTestId('office-prompt-input').inputValue()).includes('education_export_paper'));
  await page.locator('[data-testid=office-composer] [data-slot="prompt-input-send"]').click();
  let row;
  await until(async()=>{row=(await snapshot()).officeArtifacts?.find(r=>r.path===spec.path&&r.state==='pending');return !!row;});
  const review=await page.evaluate(i=>window.omniEdu.reviewXiaozhiOffice(i),{schemaVersion:'xiaozhi.office-artifact.v1',sessionId:prior.session,draftId:row.id});
  assert(review.ok);
  const {draft}=review.value,figures=draft.sections.flatMap(s=>s.figures||[]);
  assert.equal(draft.paperSource.paperId,prior.finalId);
  assert.equal(draft.paperSource.printLayout,'xiaozhi.paper-print.a4.v1');
  assert.equal(draft.paperSource.audience,spec.audience);
  if(spec.audience==='student')assert(figures.every(f=>f.role==='question'));
  if(spec.template==='answer_sheet')assert.equal(figures.length,0);
  if(legacyTitle&&spec.template==='paper')assert(figures.length>0,'The selected confirmation must contain real source figures.');
  const card=page.locator(`[data-testid="pi-office-artifact"][data-office-id="${row.id}"]`);
  if(figures.length){
   const checked=card.getByTestId('pi-office-images-reviewed');
   await until(async()=>await checked.isVisible()&&await checked.isEnabled()&&await card.getByTestId('pi-office-source-image').count()===figures.length);
   await checked.click();
  }
  await until(async()=>!await card.getByTestId('pi-office-approve').isDisabled());
  const file=path.join(destination,spec.path);
  assert(!fs.existsSync(file));
  await card.getByTestId('pi-office-approve').click();
  await until(async()=>!(await snapshot()).running);
  const saved=(await snapshot()).officeArtifacts.find(r=>r.id===row.id);
  assert.equal(saved.state,'saved',JSON.stringify(saved));
  const bytes=fs.readFileSync(file);
  const [lineage]=query('SELECT * FROM document_artifact_paper_sources WHERE artifact_id=?',[saved.artifactId]);
  assert.equal(lineage.paper_id,prior.finalId);
  assert.equal(lineage.paper_digest,draft.paperSource.digest);
  assert.equal(lineage.audience,spec.audience);
  report.files.push({...spec,artifactId:saved.artifactId,file,sha256:sha(bytes),bytes:bytes.length,figures:figures.map(f=>({sha256:f.sha256,role:f.role}))});
  check('Confirmed '+choice+'/'+spec.format+' saves the exact paper through the existing Office approval');
 }
 report.warmWire=await app.evaluate(()=>globalThis.paperPrintWire);
 assert.equal(report.warmWire.requests.length,24);
 assert.deepEqual(query('SELECT * FROM question_bank_items ORDER BY id'),beforeQuestions);
 assert.deepEqual(query("SELECT * FROM ai_confirmation_items WHERE action_type='pi_paper_candidate' ORDER BY id"),beforePapers);
 assert.deepEqual(readBasket(),beforeBasket);
 const drafts=query('SELECT * FROM xiaozhi_pi_office_drafts ORDER BY id');
 await app.close();app=null;
 await launch(true);await basket();await shots('cold');
 assert.deepEqual(query('SELECT * FROM xiaozhi_pi_office_drafts ORDER BY id'),drafts);
 for(const f of report.files)assert.equal(sha(fs.readFileSync(f.file)),f.sha256);
 report.coldWire=await app.evaluate(()=>globalThis.paperPrintWire);
 assert.equal(report.coldWire.requests.length,0);
 assert.equal(report.errors.length,0);
 check('Cold restart preserves six file hashes, original paper, questions and Office receipts without replay');
 report.ok=true;
}catch(e){report.error=String(e.stack);if(page)await page.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});process.exitCode=1;}finally{if(app){report.lastWire=await app.evaluate(()=>globalThis.paperPrintWire).catch(()=>null);await app.close().catch(()=>{});}save();console.log(JSON.stringify({ok:report.ok,checks:report.checks.length,output,error:report.error?.split('\n').slice(0,2).join(' ')}));}
