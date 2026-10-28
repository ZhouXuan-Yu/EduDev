import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {setTimeout as delay} from 'node:timers/promises';
import {_electron} from 'playwright';

// Prepare writes a local PDF preview and copies only the sealed shared credential.
// Run requires explicit inspected sample names and a durable four-call ceiling.
const [mode,output,credentialDb,imageName,pdfName,requestedLimit]=process.argv.slice(2);
if(!['prepare','run','diagnose','verify-fix','recheck','inspect'].includes(mode)||!path.isAbsolute(output)||!imageName||!pdfName)throw Error('prepare|run|diagnose|verify-fix|recheck|inspect ABS_OUTPUT ABS_CREDENTIAL_DB IMAGE_NAME PDF_NAME [AUTHORIZED_TOTAL]');
// verify-fix is a separately authorized continuation: three spent + four new calls.
const callLimit=mode==='recheck'?Number(requestedLimit):mode==='verify-fix'?7:4;
if(!Number.isSafeInteger(callLimit)||callLimit<2)throw Error('An explicit bounded authorized total is required');
const desktop=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),data=path.join(output,'data'),profile=path.join(output,'profile');
if(!fs.existsSync(path.join(output,'report.json')))throw Error('Run the local folder journey first');
const ledger=path.join(output,'real-cloud-ledger.json');
const report={output,mode,callLimit,checks:[],rendererErrors:[],batches:[],scope:'Actual authorized DeepSeek requests; no response substitution. Image and PDF page 1 only. Durable total call ceiling.'};
let app,page;
try{
 if(mode==='prepare'){
  if(!path.isAbsolute(credentialDb)||path.resolve(credentialDb)===path.resolve(path.join(data,'app.db')))throw Error('Separate source credential database required');
  const source=new DatabaseSync(credentialDb,{readOnly:true});let row;try{row=source.prepare("SELECT value_json FROM app_settings WHERE key='xiaozhi.provider.v1'").get();}finally{source.close();}
  const config=JSON.parse(row?.value_json||'{}');if(!config.sealedKey)throw Error('Shared encrypted DeepSeek credential missing');
  // Chromium's sealed credential is bound to this OS user's profile encryption key.
  // Copy only that sealed key metadata, never cookies, sessions or the source database.
  const sourceState=JSON.parse(fs.readFileSync(path.join(path.dirname(path.dirname(credentialDb)),'Local State'),'utf8'));
  if(!sourceState.os_crypt?.encrypted_key)throw Error('Source profile encryption metadata missing');
  const localStatePath=path.join(profile,'Local State'),localState=JSON.parse(fs.readFileSync(localStatePath,'utf8'));
  localState.os_crypt=sourceState.os_crypt;fs.writeFileSync(localStatePath,JSON.stringify(localState));
  const db=new DatabaseSync(path.join(data,'app.db'));try{db.prepare('INSERT OR REPLACE INTO app_settings(key,value_json,updated_at) VALUES(?,?,?)').run('xiaozhi.provider.v1',JSON.stringify(config),new Date().toISOString());}finally{db.close();}
 }
 const env={...process.env,OMNI_EDU_DATA_ROOT:data};for(const key of Object.keys(env))if(key.startsWith('OMNI_EDU_E2E_')||['ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL','NODE_OPTIONS','DEEPSEEK_API_KEY'].includes(key))delete env[key];
 Object.assign(env,{OMNI_EDU_E2E_DIALOG_MODE:'1',OMNI_EDU_E2E_VISIBLE:'0',OMNI_EDU_XIAOZHI_PI:'1'});
 app=await _electron.launch({args:[path.join(desktop,'out/main/index.js'),'--user-data-dir='+profile],cwd:output,env,timeout:60000});
 await app.evaluate(({net},{ledger,mode,callLimit})=>{
  const fs=process.getBuiltinModule('fs'),crypto=process.getBuiltinModule('crypto');globalThis.__realAuthorizedSample=null;
  for(const owner of [globalThis,net]){const ordinary=owner.fetch.bind(owner);owner.fetch=async(url,options)=>{
   if(!/chat\/completions/.test(String(url)))return ordinary(url,options);
   if(!['run','diagnose','verify-fix','recheck'].includes(mode)||String(url)!=='https://api.deepseek.com/chat/completions'||!globalThis.__realAuthorizedSample)throw Error('Unauthorized request');
   const body=JSON.parse(options.body);if(body.model!=='deepseek-flash')throw Error('Unauthorized model');
   const current=fs.existsSync(ledger)?JSON.parse(fs.readFileSync(ledger,'utf8')):[];
   if(current.length>=callLimit)throw Error('Total call authorization exhausted');
   const content=body.messages[1].content,images=content.filter(c=>c.type==='image_url');if(images.length!==1)throw Error('Exactly one inspected image/page required');
   const sample=globalThis.__realAuthorizedSample;
   const entry={call:current.length+1,sample,at:new Date().toISOString(),imageSha256:crypto.createHash('sha256').update(images[0].image_url.url).digest('hex'),textBytes:Buffer.byteLength(content.filter(c=>c.type==='text').map(c=>c.text).join(''))};
   current.push(entry);fs.writeFileSync(ledger,JSON.stringify(current,null,2));
   const response=await ordinary(url,options);entry.status=response.status;fs.writeFileSync(ledger,JSON.stringify(current,null,2));
   fs.writeFileSync(ledger+'.response-'+entry.call+'.json',(await response.clone().text()).slice(0,256*1024));return response;
  };}
 },{ledger,mode,callLimit});
 page=await app.firstWindow();page.on('pageerror',e=>report.rendererErrors.push(e.message));await page.setViewportSize({width:1366,height:768});
 await page.locator('[data-testid="product-nav-materials"]:visible').click();await page.getByTestId('materials-import-folder').waitFor();
 const rows=await page.evaluate(()=>window.omniEdu.listMaterials({schemaVersion:'xiaozhi.materials.v1',query:'',offset:0}));
 const image=rows.resources.find(r=>r.originalFileName===imageName),pdf=rows.resources.find(r=>r.originalFileName===pdfName);if(!image||!pdf)throw Error('Selected resources missing');
 report.settings=await page.evaluate(()=>window.omniEdu.getMaterialAiSettings());if(!report.settings.configured)throw Error('Shared credential unavailable');
 if(mode==='prepare'){
  const preview=await page.evaluate(input=>window.omniEdu.getMaterialPagePreview(input),{schemaVersion:'xiaozhi.material-page-preview.v1',requestId:randomUUID(),resourceId:pdf.id,version:pdf.contentHash,page:1,box:[0,0,1,1]});
  if(!preview.ok)throw Error('PDF preview: '+preview.error);fs.writeFileSync(path.join(output,'selected-pdf-page1.png'),Buffer.from(preview.dataUrl.split(',')[1],'base64'));report.checks.push('Prepared encrypted configuration and local page preview without cloud calls');
 }else{
  if(mode==='diagnose'&&(!fs.existsSync(ledger)||JSON.parse(fs.readFileSync(ledger,'utf8')).length!==2))throw Error('Diagnostic phase requires exactly two remaining authorized calls');
  if(mode==='verify-fix'&&(!fs.existsSync(ledger)||JSON.parse(fs.readFileSync(ledger,'utf8')).length!==3))throw Error('Fix verification requires the separate total-seven authorization and exactly three previous calls');
  if(mode==='recheck'&&(!fs.existsSync(ledger)||JSON.parse(fs.readFileSync(ledger,'utf8')).length+2>callLimit))throw Error('Recheck needs room for exactly two fresh calls');
  for(const resource of mode==='inspect'?[]:['diagnose','recheck'].includes(mode)?[pdf]:[image,pdf]){
   const old=await page.evaluate(id=>window.omniEdu.getMaterialAiBatches(id),resource.id),unstarted=mode==='diagnose'?old.find(b=>b.calls===0&&b.pending===1):undefined;
   if(mode!=='recheck'&&old.length&&(!['diagnose','verify-fix'].includes(mode)||old.some(b=>b.id!==unstarted?.id&&(b.questions||b.units.some(u=>u.error!=='invalid_response')))))throw Error('Sample already has a batch; inspect persisted results instead of silently repeating');
   await page.getByTestId('material-'+resource.id).click();const ai=page.locator('[data-testid="material-ai-panel"]:visible');await ai.locator('summary').click();
   await ai.getByTestId('material-ai-count').fill('1');await ai.getByTestId('material-ai-start').fill('1');await ai.getByTestId('material-ai-budget').fill('2');await ai.getByTestId('material-ai-images').check();
   await ai.getByTestId('material-ai-public').check();await ai.getByTestId('material-ai-consent').check();
   await app.evaluate((_,name)=>{globalThis.__realAuthorizedSample=name;},resource.originalFileName);
   if(unstarted)await ai.getByTestId('material-ai-batch').filter({hasText:'等待1'}).getByRole('button',{name:'继续本批次授权范围'}).click();
   else await ai.getByTestId('material-ai-create').click();
   const deadline=Date.now()+6*60*1000;let batch;
   while(Date.now()<deadline){const rows=await page.evaluate(id=>window.omniEdu.getMaterialAiBatches(id),resource.id);batch=unstarted?rows.find(b=>b.id===unstarted.id):rows.find(b=>!old.some(p=>p.id===b.id));if(batch&&['complete','attention','configuration_changed'].includes(batch.status))break;await delay(2500);}
   await app.evaluate(()=>{globalThis.__realAuthorizedSample=null;});report.batches.push({name:resource.originalFileName,batch});console.log(JSON.stringify(report.batches.at(-1)));
   if(!batch)throw Error('No AI batch created: '+await ai.innerText());if(!['complete','attention','configuration_changed'].includes(batch.status))throw Error('Batch did not settle; do not automatically retry');
   await page.screenshot({path:path.join(output,resource===image?'real-image-ai.png':'real-pdf-ai.png'),fullPage:true});
   await page.locator('[data-testid="product-nav-materials"]:visible').click();
  }
  report.questions=await page.evaluate(()=>window.omniEdu.listQuestionNotebook({limit:30}));
  report.aiQuestions=report.questions.items.filter(q=>q.archive?.ai).map(q=>({id:q.id,state:q.archive.state,issues:q.archive.issues}));
  report.search=await page.evaluate(()=>window.omniEdu.searchQuestionsByMeaning({query:'洛埃镜 光的干涉',limit:10})).catch(e=>({error:String(e)}));
  const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});try{report.units=db.prepare('SELECT * FROM material_ai_units').all();}finally{db.close();}
  if(mode==='inspect'){
   await page.locator('[data-testid="product-nav-teaching"]:visible').click();await page.locator('[data-testid="nav-question_notebook"]:visible').click();
   await page.getByTestId('question-notebook-search').fill('洛埃镜');await delay(1500);
   report.notebookSearchCount=await page.locator('[data-testid^="question-notebook-card-"]').count();await page.screenshot({path:path.join(output,'real-question-search.png'),fullPage:true});
   await page.getByTestId('question-semantic-query').fill('光的折射');await page.getByTestId('question-semantic-submit').click();await page.getByTestId('question-semantic-coverage').waitFor({timeout:90000});
   report.physicsSemanticHits=await page.getByTestId('question-semantic-hit').count();report.physicsSemanticCoverage=await page.getByTestId('question-semantic-coverage').innerText();await page.screenshot({path:path.join(output,'real-physics-semantic.png'),fullPage:true});
   const ready=report.questions.items.find(q=>q.archive?.state==='ai_final'&&q.subject==='物理');
   const count=ready?Math.min(2,report.questions.items.filter(q=>q.archive?.state==='ai_final'&&q.subject==='物理'&&q.grade===ready.grade&&q.questionType===ready.questionType).length):1;
   await page.locator('[data-testid="nav-paper"]:visible').click();await page.getByTestId('paper-subject').fill('物理');await page.getByTestId('paper-grade').fill(ready?.grade||'九年级');await page.getByTestId('paper-title').fill('真实资料物理流程核对');
   await page.getByRole('button',{name:'移除此部分',exact:true}).nth(2).click();await page.getByRole('button',{name:'移除此部分',exact:true}).nth(1).click();
   await page.getByTestId('paper-section-type').fill(ready?.questionType||'填空/选择');await page.getByTestId('paper-section-kp').fill('');await page.getByTestId('paper-section-count').fill(String(count));await page.getByTestId('paper-section-points').fill('5');await page.getByTestId('paper-total').fill(String(count*5));
   report.paperBlueprint={subject:await page.getByTestId('paper-subject').inputValue(),grade:await page.getByTestId('paper-grade').inputValue(),type:await page.getByTestId('paper-section-type').inputValue()};
   await page.getByTestId('paper-generate').click();await delay(2500);report.paperText=await page.getByTestId('paper-workspace').innerText().catch(()=>page.locator('main').innerText());
   report.paperQuestionCount=await page.getByTestId('paper-question').count();await page.screenshot({path:path.join(output,'real-paper-readiness.png'),fullPage:true});
   report.checks.push('Restart, actual notebook search and paper generation attempted through production UI; no teacher confirmation fabricated');
  }
 }
 report.success=true;
}catch(e){report.success=false;report.error=String(e.stack||e);process.exitCode=1;if(page)await page.screenshot({path:path.join(output,'ai-failure.png'),fullPage:true}).catch(()=>{});}
finally{if(app)await app.close();report.calls=fs.existsSync(ledger)?JSON.parse(fs.readFileSync(ledger,'utf8')):[];fs.writeFileSync(path.join(output,'ai-'+mode+'-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({output,mode,success:report.success,error:report.error,calls:report.calls.length}));}
