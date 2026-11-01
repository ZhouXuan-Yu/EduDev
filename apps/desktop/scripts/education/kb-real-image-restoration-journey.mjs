import {openMaterialDisclosure} from './material-disclosure-ui.mjs';
import '../office-agent/register-source.mjs';
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import assert from 'node:assert/strict';import {createHash,randomUUID} from 'node:crypto';import {DatabaseSync} from 'node:sqlite';import {_electron} from 'playwright';
const {prepareModelImage}=await import('../../src/main/xiaozhi-agent/model-image-worker.ts');
// This one previously inspected page already has explicit cloud authorization. Never expand to the source folder.
const [authorizedRoot,receiptTag='']=process.argv.slice(2);assert(authorizedRoot&&path.isAbsolute(authorizedRoot));assert(!receiptTag||/^[a-z0-9-]{1,40}$/.test(receiptTag));
const sample=path.join(authorizedRoot,'selected-pdf-page1.png'),ledger=path.join(authorizedRoot,'real-image-page-restoration-ledger'+(receiptTag?'-'+receiptTag:'')+'.json');
assert(fs.existsSync(sample));assert(!fs.existsSync(ledger),'Inspect the durable previous result before another paid run');
const desktop=process.cwd(),output=fs.mkdtempSync(path.join(os.tmpdir(),'omni-real-image-page-')),data=path.join(output,'data'),profile=path.join(output,'profile'),folder=path.join(output,'授权图片','子目录');
for(const dir of [data,profile,folder])fs.mkdirSync(dir,{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex'),bytes=fs.readFileSync(sample),sourceSha=sha(bytes),localState=JSON.parse(fs.readFileSync(path.join(authorizedRoot,'profile','Local State'),'utf8'));assert(localState.os_crypt?.encrypted_key);
fs.writeFileSync(path.join(profile,'Local State'),JSON.stringify({os_crypt:localState.os_crypt}));fs.writeFileSync(path.join(folder,'已授权物理原页.png'),bytes);
const previous=new DatabaseSync(path.join(authorizedRoot,'data','app.db'),{readOnly:true});let setting;try{setting=previous.prepare("SELECT value_json FROM app_settings WHERE key='xiaozhi.provider.v1'").get()?.value_json;}finally{previous.close();}assert(setting&&JSON.parse(setting).sealedKey);
const seed=new DatabaseSync(path.join(data,'app.db'));try{seed.exec('CREATE TABLE app_settings(key TEXT PRIMARY KEY,value_json TEXT NOT NULL,updated_at TEXT NOT NULL)');seed.prepare("INSERT INTO app_settings VALUES('xiaozhi.provider.v1',?,?)").run(setting,new Date().toISOString());}finally{seed.close();}
const prepared=await prepareModelImage({schemaVersion:'xiaozhi.model-image.v1',requestId:'xiimage_'+randomUUID(),bytes,mime:'image/png'});assert(prepared.ok);const expectedImageSha=sha(Buffer.from(prepared.data.image.data,'base64'));
const report={output,sourceSha,expectedImageSha,scope:'One recursively imported, previously approved PNG page; actual local OCR, two real DeepSeek page calls, real bank/archive/source UI and restart. No OCR fault or synthetic model response. Not full-folder natural quality, mathematical zero-error, 40GB or installer acceptance',checks:[],rendererErrors:[]};
let app,page,batchId;
const sql=(s,p=[])=>{const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});try{return db.prepare(s).all(...p);}finally{db.close();}};
const until=async(fn,ms=360000)=>{const end=Date.now()+ms;while(Date.now()<end){const v=await fn();if(v)return v;await new Promise(r=>setTimeout(r,500));}throw Error('Actual image flow did not settle; inspect ledger before any paid retry');};
async function launch(){
 const env={...process.env,OMNI_EDU_DATA_ROOT:data,OMNI_EDU_E2E_DIALOG_MODE:'1',OMNI_EDU_E2E_VISIBLE:'0',OMNI_EDU_XIAOZHI_PI:'1'};for(const k of ['ELECTRON_RUN_AS_NODE','NODE_OPTIONS','ELECTRON_RENDERER_URL','DEEPSEEK_API_KEY'])delete env[k];
 app=await _electron.launch({args:[path.join(desktop,'out/main/index.js'),'--user-data-dir='+profile],cwd:output,env,timeout:60000});
 await app.evaluate(({net},{ledger,expectedImageSha,output})=>{
  const fs=process.getBuiltinModule('fs'),crypto=process.getBuiltinModule('crypto');
  for(const owner of [globalThis,net]){const fetch=owner.fetch.bind(owner);owner.fetch=async(url,options)=>{
   if(!/chat\/completions/.test(String(url)))return fetch(url,options);
   if(String(url)!=='https://api.deepseek.com/chat/completions')throw Error('Unapproved endpoint');
   const body=JSON.parse(options.body),images=body.messages[1].content.filter(c=>c.type==='image_url');
   if(body.model!=='deepseek-flash'||images.length!==1||!body.messages[0].content.includes('xiaozhi.material-ai-page-response.v1'))throw Error('Unapproved model/scope');
   const imageSha=crypto.createHash('sha256').update(Buffer.from(images[0].image_url.url.split(',')[1],'base64')).digest('hex');if(imageSha!==expectedImageSha)throw Error('Unapproved pixels');
   const calls=fs.existsSync(ledger)?JSON.parse(fs.readFileSync(ledger,'utf8')):[];if(calls.length>=2)throw Error('Two-call local test ceiling exhausted');
   const entry={call:calls.length+1,imageSha,at:new Date().toISOString(),output};calls.push(entry);fs.writeFileSync(ledger,JSON.stringify(calls));const response=await fetch(url,options);entry.status=response.status;fs.writeFileSync(ledger,JSON.stringify(calls));fs.writeFileSync(output+'/response-'+entry.call+'.json',(await response.clone().text()).slice(0,262144));return response;
  };}
 },{ledger,expectedImageSha,output});
 page=await app.firstWindow();page.on('pageerror',e=>report.rendererErrors.push(e.message));await page.setViewportSize({width:1366,height:768});await page.locator('[data-testid="nav-knowledge"]:visible').click();
}
try{
 await launch();const settings=await page.evaluate(()=>window.omniEdu.getMaterialAiSettings());assert(settings.configured&&settings.secureStorage);
 await app.evaluate(({dialog},folder)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[folder]});},path.dirname(folder));await page.getByTestId('materials-import-folder').click();batchId=await until(()=>sql('SELECT id FROM material_import_batches WHERE root_path=?',[path.dirname(folder)])[0]?.id);report.batchId=batchId;
 const card=page.getByTestId('folder-ai-'+batchId);await openMaterialDisclosure(card);await card.getByTestId('folder-ai-open-authorization').click();await card.getByTestId('folder-ai-budget').fill('2');await card.getByTestId('folder-ai-public').check();await card.getByTestId('folder-ai-consent').check();await until(async()=>!await card.getByTestId('folder-ai-authorize').isDisabled());await card.getByTestId('folder-ai-authorize').click();
 report.result=await until(async()=>{const v=await page.evaluate(batchId=>window.omniEdu.getMaterialFolderAi({schemaVersion:'xiaozhi.material-folder-ai.v1',batchId}),batchId);return ['complete','attention','configuration_changed'].includes(v?.status)?v:undefined;});
 assert.equal(report.result.calls,2,JSON.stringify(report.result));const resource=sql('SELECT r.id,r.content_hash FROM teacher_resources r JOIN material_import_entries e ON e.resource_id=r.id WHERE e.batch_id=?',[batchId])[0];assert.equal(resource.content_hash,sourceSha);
 const local=sql('SELECT * FROM material_image_ocr_receipts WHERE resource_id=?',[resource.id])[0];assert.equal(local.status,'complete');report.ocrBytes=Buffer.byteLength(JSON.parse(local.receipt_json).text);report.ocrReceiptSha=sha(JSON.stringify(local));
 const child=sql('SELECT batch_id FROM material_ai_task_keys WHERE folder_id=?',[batchId]);assert.equal(child.length,1);const unit=sql('SELECT first_json,final_json,status,error FROM material_ai_units WHERE batch_id=?',[child[0].batch_id])[0];
 report.finalStatus=unit.status;report.finalError=unit.error;const first=JSON.parse(unit.first_json),final=JSON.parse(unit.final_json);assert.equal(first.schemaVersion,'xiaozhi.material-ai-page-response.v1');assert.equal(final.schemaVersion,first.schemaVersion);report.transcriptionEqual=first.pageText.normalize('NFC').replace(/\s/g,'')===final.pageText.normalize('NFC').replace(/\s/g,'');
 assert.equal(final.questions.length,4);report.numbers=final.questions.map(q=>q.number);assert.deepEqual(report.numbers,['1','2','3','4']);report.numericConditions=['1.5','2.8','0.5'].map(value=>({value,present:final.pageText.includes(value)}));assert(report.numericConditions.every(v=>v.present));
 report.questions=sql('SELECT q.id,q.stem,q.answer,q.analysis,q.archive_json FROM question_bank_items q JOIN material_ai_members m ON m.question_id=q.id WHERE m.batch_id=?',[child[0].batch_id]).map(q=>({id:q.id,number:JSON.parse(q.archive_json).number,state:JSON.parse(q.archive_json).state,issues:JSON.parse(q.archive_json).issues,stemBytes:Buffer.byteLength(q.stem),answerBytes:Buffer.byteLength(q.answer),analysisBytes:Buffer.byteLength(q.analysis)}));assert.equal(report.questions.length,4);
 report.checks.push('Actual recursive import and local OCR reach exactly one child and two original-image DeepSeek page passes; four numbers and inspected numeric conditions survive with full bank receipts');
 await page.evaluate(batchId=>window.omniEdu.getMaterialAiPage({schemaVersion:'xiaozhi.material-ai-page.v1',batchId,ordinal:1,includeImage:true}),child[0].batch_id).then(v=>{assert.equal(v.source.schemaVersion,'xiaozhi.material-image-source.v1');assert(v.inputImage.dataUrl);});
 await page.locator('[data-testid="nav-artifacts"]:visible').click();await page.locator('[data-testid="nav-question_notebook"]:visible').click();
 const questionCard=page.getByTestId('question-notebook-card-'+report.questions[0].id);await questionCard.waitFor();await questionCard.getByTestId('material-ai-page-open').click();await until(async()=>(await questionCard.getByTestId('material-ai-page-text').textContent().catch(()=>''))===final.pageText);await questionCard.getByTestId('material-ai-page-image-open').click();await questionCard.getByTestId('material-ai-page-image').waitFor({state:'visible'});await page.screenshot({path:path.join(output,'actual-image-page-1366.png'),fullPage:true});
 report.checks.push('Teacher opens the actual imported question in the notebook, reads the restored page and displays the exact AI input image through the existing typed interface');
 await app.close();app=undefined;await launch();await page.setViewportSize({width:1920,height:1080});const restored=await page.evaluate(batchId=>window.omniEdu.getMaterialAiPage({schemaVersion:'xiaozhi.material-ai-page.v1',batchId,ordinal:1}),child[0].batch_id);assert.equal(restored.text,final.pageText);assert(!('inputImage'in restored));assert.equal(sha(JSON.stringify(sql('SELECT * FROM material_image_ocr_receipts WHERE resource_id=?',[resource.id])[0])),report.ocrReceiptSha);assert.equal(JSON.parse(fs.readFileSync(ledger,'utf8')).length,2);assert.deepEqual(report.rendererErrors,[]);
 report.checks.push('Native restart preserves original OCR, both page receipts and four source-backed bank records with zero paid replay and no image on ordinary text reads');report.success=true;
}catch(error){report.success=false;report.error=String(error.stack||error);process.exitCode=1;await page?.screenshot({path:path.join(output,'failure.png'),fullPage:true}).catch(()=>{});}
finally{await app?.close();report.calls=fs.existsSync(ledger)?JSON.parse(fs.readFileSync(ledger,'utf8')):[];fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
