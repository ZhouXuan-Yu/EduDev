import '../office-agent/register-source.mjs';
import {openMaterialDisclosure} from './material-disclosure-ui.mjs';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {_electron} from 'playwright';
import {productEntry} from '../product-navigation.mjs';

// Explicitly selected, visually inspected unchanged PDF pages only. No automatic retries.
const [output,account]=process.argv.slice(2),desktop=process.cwd(),coldOnly=process.argv.includes('--cold-read'),resume=coldOnly||process.argv.includes('--resume-source'),rematchSaved=process.argv.includes('--rematch-saved');assert(!rematchSaved||coldOnly,'Saved matching cannot trigger paid or OCR recovery');
for(const root of [output,account]){assert(root&&path.isAbsolute(root));const rel=path.relative(fs.realpathSync(os.tmpdir()),fs.realpathSync(root));assert(rel&&!rel.startsWith('..')&&!path.isAbsolute(rel));}
const data=path.join(output,'data'),profile=path.join(output,'profile'),folder=path.join(output,'资料'),ledger=path.join(output,'cloud-ledger.json'),reportFile=path.join(output,'natural-pair-report.json');
assert(fs.existsSync(path.join(output,'fixture.json')),'Require extracted-page provenance and pixel equality receipt');
if(!resume){
assert(!fs.existsSync(ledger)&&!fs.existsSync(data),'Inspect previous run instead of silently repeating billable calls');
fs.mkdirSync(data);fs.mkdirSync(profile);
const state=JSON.parse(fs.readFileSync(path.join(account,'profile','Local State'),'utf8'));fs.writeFileSync(path.join(profile,'Local State'),JSON.stringify({os_crypt:state.os_crypt}));
const original=new DatabaseSync(path.join(account,'data','app.db'),{readOnly:true});let settings;
try{settings=original.prepare("SELECT value_json FROM app_settings WHERE key='xiaozhi.provider.v1'").get().value_json;}finally{original.close();}
assert(JSON.parse(settings).sealedKey);const seed=new DatabaseSync(path.join(data,'app.db'));seed.exec('CREATE TABLE app_settings(key TEXT PRIMARY KEY,value_json TEXT NOT NULL,updated_at TEXT NOT NULL)');seed.prepare('INSERT INTO app_settings VALUES(?,?,?)').run('xiaozhi.provider.v1',settings,new Date().toISOString());seed.close();
}else{assert(fs.existsSync(ledger)&&JSON.parse(fs.readFileSync(ledger,'utf8')).length===(coldOnly?5:1),'Inspect the retained ledger before resuming');assert(fs.existsSync(reportFile));const preserved=rematchSaved?path.join(fs.mkdtempSync(path.join(output,'saved-rematch-')),'prior-report.json'):path.join(output,coldOnly?'natural-harness-failure.json':'natural-first-failure.json');assert(!fs.existsSync(preserved),'Do not silently retry a failed recovery');fs.copyFileSync(reportFile,preserved);}
const sha=b=>createHash('sha256').update(b).digest('hex');
const sql=(s,p=[])=>{const d=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});try{return d.prepare(s).all(...p);}finally{d.close();}};
const until=async(fn,ms=900000)=>{const end=Date.now()+ms;while(Date.now()<end){const result=await fn();if(result)return result;await new Promise(r=>setTimeout(r,1000));}throw Error('Natural journey timed out; retained receipts must be inspected before retry');};
const report={buildSha256:sha(fs.readFileSync('out/main/index.js')),checks:[],rendererErrors:[],scope:'Development sample: actual unchanged user mainPDF page4 and answerPDF page3, recursive import, real local OCR and real DeepSeek, automatic matching and cold read. Not 120 held-out questions, whole-book, 40GiB, teacher math, installer or migration acceptance.'};
if(resume){const previous=JSON.parse(fs.readFileSync(reportFile,'utf8'));report.initialBuildSha256=previous.buildSha256;report.resumedSourceFailure=true;}
if(coldOnly){const previous=JSON.parse(fs.readFileSync(reportFile,'utf8'));Object.assign(report,previous,{success:false,error:undefined,coldReadContinuation:true,paidBuildSha256:previous.buildSha256,buildSha256:sha(fs.readFileSync('out/main/index.js')),newCloudRequests:0});}
let app,page,folderId,main,known;
const flush=()=>fs.writeFileSync(reportFile,JSON.stringify(report,null,2));
async function launch(cold=false){
 const env={...process.env,OMNI_EDU_DATA_ROOT:data,OMNI_EDU_E2E_DIALOG_MODE:'1',OMNI_EDU_E2E_VISIBLE:'0',OMNI_EDU_XIAOZHI_PI:'1'};
 for(const key of ['ELECTRON_RUN_AS_NODE','NODE_OPTIONS','ELECTRON_RENDERER_URL','DEEPSEEK_API_KEY'])delete env[key];
 app=await _electron.launch({args:[path.join(desktop,'out/main/index.js'),'--user-data-dir='+profile],cwd:output,env,timeout:60000});
 await app.evaluate(({net},{cold,ledger})=>{
  const fs=process.getBuiltinModule('fs'),crypto=process.getBuiltinModule('crypto'),ordinary=net.fetch.bind(net);
  const load=()=>fs.existsSync(ledger)?JSON.parse(fs.readFileSync(ledger,'utf8')):[];
  for(const owner of [globalThis,net])owner.fetch=async(url,options)=>{
   if(cold)throw Error('Cold readback forbids network');
   const target=new URL(String(url));if(target.protocol!=='https:'||target.hostname!=='api.deepseek.com'||target.port||target.username||target.password||!['/chat/completions','/models'].includes(target.pathname))throw Error('Unexpected natural-test endpoint');
   if(target.pathname==='/models')return ordinary(url,options);
   const body=JSON.parse(options.body),payload=JSON.parse(body.messages[1].content[0].text),rows=load();if(rows.length>=5)throw Error('Five-request development ceiling; no retry');
   const row={ordinal:rows.length+1,startedAt:new Date().toISOString(),phase:payload.phase,book:!!payload.answerContext&&payload.answerContext.policy!=='source-bound-answers.v1',bound:payload.answerContext?.policy==='source-bound-answers.v1',bookReferencePolicy:payload.pageContext?.bookReferencePolicy,blockEngine:payload.pageContext?.blocks?.engine,knownAnswers:payload.knownAnswers?{schemaVersion:payload.knownAnswers.schemaVersion,sourceSha256:payload.knownAnswers.sourceSha256,available:payload.knownAnswers.entries.filter(e=>e.state==='available').length,entries:payload.knownAnswers.entries.map(e=>({number:e.number,state:e.state}))}:null,printedChoicePolicy:payload.pageContext?.printedChoicePolicy,images:body.messages[1].content.filter(c=>c.type==='image_url').length,model:body.model};
   rows.push(row);fs.writeFileSync(ledger,JSON.stringify(rows,null,2));const start=performance.now();
   try{const response=await ordinary(url,{...options,credentials:'omit',redirect:'error'}),text=await response.clone().text();let parsed;try{parsed=JSON.parse(text);}catch{}Object.assign(row,{status:response.status,elapsedMs:performance.now()-start,responseSha256:crypto.createHash('sha256').update(text).digest('hex'),usage:parsed?.usage,finishReason:parsed?.choices?.[0]?.finish_reason});const current=load();current[row.ordinal-1]=row;fs.writeFileSync(ledger,JSON.stringify(current,null,2));return response;}
   catch(error){const current=load();current[row.ordinal-1]={...row,elapsedMs:performance.now()-start,error:String(error?.name||'network_error')};fs.writeFileSync(ledger,JSON.stringify(current,null,2));throw error;}
  };
 },{cold,ledger});
 page=await app.firstWindow();page.setDefaultTimeout(60000);page.on('pageerror',e=>report.rendererErrors.push(e.message));const win=await app.browserWindow(page);await win.evaluate(w=>{if(w.isMaximized())w.unmaximize();if(w.isFullScreen())w.setFullScreen(false);w.setContentSize(1366,768);});await page.waitForFunction(()=>innerWidth===1366&&innerHeight===768);await productEntry(page,'materials').click();await page.getByTestId('materials-import-folder').waitFor();
}
async function close(){if(app){await app.close();app=undefined;}}
const units=()=>sql('SELECT u.batch_id,u.ordinal,u.status,u.error,u.input_json,u.first_json,u.final_json FROM material_ai_units u JOIN material_ai_batches b ON b.id=u.batch_id ORDER BY u.batch_id,u.ordinal');
try{
 console.log('OUTPUT '+output);await launch(coldOnly);const configured=await page.evaluate(()=>window.omniEdu.getMaterialAiSettings());assert(configured.configured&&configured.secureStorage);
 if(!resume){await app.evaluate(({dialog},folder)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[folder]});},folder);await page.getByTestId('materials-import-folder').click();}
 await until(()=>{main=sql("SELECT id,original_file_name FROM teacher_resources WHERE original_file_name='主书.pdf'")[0];known=sql("SELECT id,original_file_name FROM teacher_resources WHERE original_file_name='答案.pdf'")[0];return main&&known&&sql("SELECT COUNT(*) n FROM material_pdf_jobs WHERE state='complete'")[0].n===2;},240000);
 folderId=sql('SELECT id FROM material_import_batches WHERE root_path=?',[folder])[0].id;report.folderId=folderId;
 if(!coldOnly){await openMaterialDisclosure(page.getByTestId('materials-batches'));const card=page.getByTestId('folder-ai-'+folderId);await openMaterialDisclosure(card);await card.getByTestId('folder-ai-open-authorization').click();
 if(!resume){await card.getByTestId('folder-ai-has-answer-books').check();await card.getByTestId('folder-books-query').fill('主书');await card.getByTestId('folder-book').filter({hasText:'主书.pdf'}).getByTestId('folder-book-question').click();
 await until(async()=>!await card.getByTestId('folder-books-query').isDisabled()&&!(await card.getByTestId('folder-books').innerText()).includes('正在读取或保存关联'));
 await card.getByTestId('folder-books-query').fill('答案');await card.getByTestId('folder-book').filter({hasText:'答案.pdf'}).getByTestId('folder-book-answer').click();await card.getByTestId('folder-books-save').click();await card.getByTestId('folder-books-linked').waitFor();
 await card.getByTestId('folder-ai-mode').selectOption('quality');}await card.getByTestId('folder-ai-budget').fill('6');await card.getByTestId('folder-ai-public').check();await card.getByTestId('folder-ai-consent').check();await until(async()=>!await card.getByTestId('folder-ai-authorize').isDisabled());await card.getByTestId('folder-ai-authorize').click();
 if(resume){
  const original=units()[0],crops=sql('SELECT number,image_json,quality_json FROM material_ai_page_crops WHERE batch_id=? ORDER BY number',[original.batch_id]);
  report.reusedBatchId=original.batch_id;report.retainedFirstSha256=sha(original.first_json);report.retainedCropsSha256=sha(JSON.stringify(crops));
  await page.getByTestId('material-'+main.id).getByRole('button').click();await page.getByTestId('materials-section-questions').click();await openMaterialDisclosure(page.getByTestId('material-ai-panel'));await page.getByTestId('material-ai-retry-source').click();
  report.checks.push('Teacher explicitly retries the same failed source through the visible button, retaining paid first and crop receipts within the frozen original per-unit budget');
 }else report.checks.push('Teacher imports nested unchanged natural PDF pair, saves both roles and authorizes quality mode through existing UI');flush();}
 report.folderResult=await until(async()=>{const view=await page.evaluate(batchId=>window.omniEdu.getMaterialFolderAi({schemaVersion:'xiaozhi.material-folder-ai.v1',batchId}),folderId);const pending=units().some(u=>['pending','dispatched','first_saved','running'].includes(u.status));return view&&['complete','attention','configuration_changed','budget_exhausted'].includes(view.status)&&!pending?view:undefined;});
 if(resume&&!coldOnly){const original=units().find(u=>u.batch_id===report.reusedBatchId);assert.equal(sha(original.first_json),report.retainedFirstSha256);assert.equal(sha(JSON.stringify(sql('SELECT number,image_json,quality_json FROM material_ai_page_crops WHERE batch_id=? ORDER BY number',[original.batch_id]))),report.retainedCropsSha256);}
 const saved=units();report.units=saved.map(u=>({status:u.status,error:u.error,first:!!u.first_json,final:!!u.final_json,printedChoicePolicy:JSON.parse(u.input_json).pagePrompt?.printedChoicePolicy}));
 report.cloudRequests=fs.existsSync(ledger)?JSON.parse(fs.readFileSync(ledger,'utf8')):[];assert.equal(saved.length,2);assert.equal(report.cloudRequests.length,5);assert(report.cloudRequests.every(r=>r.status===200));assert(report.cloudRequests.filter(r=>!r.book).every(r=>r.printedChoicePolicy==='printed-choice-count.v1'));
 assert(report.cloudRequests.slice(0,2).every(r=>r.book),'Paired answers must be processed before the main-book model work');const informed=report.cloudRequests.filter(r=>r.knownAnswers);assert.equal(informed.length,1);assert.equal(informed[0].bookReferencePolicy,'book-final-reference.v1');assert(informed[0].knownAnswers.available>0,'A real paired run must find at least one authenticated book reference');report.savedReferences=sql("SELECT COUNT(*) n FROM material_ai_book_references WHERE final_sha<>''")[0].n;assert.equal(report.savedReferences,1);report.knownAnswerCandidates=informed[0].knownAnswers.available;
 report.checks.push('Original executor completes all five real provider requests; question source freezes printed cardinality and answer book retains its own two-pass policy');
 if(rematchSaved){
  const paidBefore=sha(JSON.stringify(saved)),callsBefore=fs.readFileSync(ledger,'utf8'),mainUnit=saved.find(u=>JSON.parse(u.input_json).pageSource?.resourceId===main.id);assert(mainUnit);const pair=await page.evaluate(id=>window.omniEdu.getMaterialBookPair(id),main.id),input={schemaVersion:'xiaozhi.material-book-match.v1',batchId:mainUnit.batch_id,ordinal:mainUnit.ordinal,revision:pair.revision};assert(pair.current);
  await until(async()=>{const v=await page.evaluate(input=>window.omniEdu.getMaterialBookMatches(input),input);return !v.indexPending&&!v.automaticPending;},120000);await page.getByTestId('materials-search').fill('主书');const open=page.getByTestId('material-'+main.id).getByRole('button');await open.waitFor();assert.equal(await open.count(),1);await open.click();if(await page.getByTestId('materials-section-questions').isVisible())await page.getByTestId('materials-section-questions').click();await openMaterialDisclosure(page.getByTestId('material-ai-panel'));const article=page.locator('[data-testid="material-ai-batch"][data-batch-id="'+mainUnit.batch_id+'"]');await article.getByTestId('material-ai-page-open').click();const match=article.getByTestId('material-book-match');await match.click();await until(async()=>{const v=await page.evaluate(input=>window.omniEdu.getMaterialBookMatches(input),input);return !await match.isDisabled()&&!v.indexPending&&!v.automaticPending&&v.rows.length===12&&v.rows.some(r=>r.state==='applied')?v:undefined;},120000);report.appliedBookQuestions=sql("SELECT COUNT(*) n FROM question_bank_items WHERE json_extract(archive_json,'$.state')='book_enriched'")[0].n;assert(report.appliedBookQuestions>0);assert.equal(sha(JSON.stringify(units())),paidBefore);assert.equal(fs.readFileSync(ledger,'utf8'),callsBefore);report.rematchedSaved=true;report.checks.push('Actual teacher matching of retained natural sources writes authenticated book roles, preserves held conflicts and changes no paid response or reference input; no model/OCR replay');
 }
 const rows=sql('SELECT q.* FROM question_bank_items q JOIN material_ai_members m ON m.question_id=q.id JOIN material_ai_batches b ON b.id=m.batch_id WHERE b.resource_id=? ORDER BY CAST(m.number AS INTEGER)',[main.id]);
 const expected=['D','B','B','D','B','C','C','D','BD','BC'];
 report.questions=rows.map(r=>{const archive=JSON.parse(r.archive_json),answer=r.answer.replace(/[\s、，,;；]/gu,'');return{number:archive.number,state:archive.state,issues:archive.issues,hasDocument:!!r.document_json,answerMatchesPrintedBook:Number(archive.number)<=10?answer===expected[Number(archive.number)-1]:null};});
 report.questionCount=rows.length;report.documents=rows.filter(r=>r.document_json).length;report.bookJournals=sql("SELECT json_extract(payload_json,'$.state') state,json_extract(payload_json,'$.reason') reason,COUNT(*) n FROM material_book_answer_journal_v1 GROUP BY state,reason");flush();
 assert.equal(rows.length,12,'Development source has twelve questions; omissions are a product failure');
 await productEntry(page,'materials').click();for(const [width,height]of [[1366,768],[1920,1080]]){const win=await app.browserWindow(page);await win.evaluate((w,s)=>{if(w.isMaximized())w.unmaximize();if(w.isFullScreen())w.setFullScreen(false);w.setContentSize(s.width,s.height);},{width,height});await page.waitForFunction(s=>innerWidth===s.width&&innerHeight===s.height,{width,height});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(output,'natural-folder-'+width+'.png'),fullPage:true});}
 report.checks.push('SQLite retains twelve natural question rows with per-question held reasons; actual folder UI has no horizontal overflow at both desktop sizes');
 const before=sha(JSON.stringify(units())),calls=fs.readFileSync(ledger,'utf8');await close();await launch(true);assert.equal(sha(JSON.stringify(units())),before);assert.equal(fs.readFileSync(ledger,'utf8'),calls);
 const pair=await page.evaluate(id=>window.omniEdu.getMaterialBookPair(id),main.id);assert(pair);report.checks.push('Cold launch preserves paid source receipts, printed policy and local book pairing without another provider request');
 assert.equal(report.rendererErrors.length,0);report.checks=[...new Set(report.checks)];report.integrationSuccess=true;report.developmentPageSuccess=report.questions.every(q=>q.hasDocument&&['ai_final','book_enriched'].includes(q.state)&&q.answerMatchesPrintedBook!==false);report.qualitySuccess=false;report.qualityNotAccepted='This development check compares only ten printed-choice answers and archive/document states; it is not independent full literal/math or 120-question held-out acceptance.';report.success=report.integrationSuccess&&report.developmentPageSuccess;flush();if(!report.success)process.exitCode=1;
}catch(error){report.success=false;report.error=String(error?.stack||error);if(app&&page)try{await page.screenshot({path:path.join(output,'natural-failure.png'),fullPage:true});}catch{}flush();console.error(error?.stack||error);process.exitCode=1;}
finally{await close();flush();console.log(JSON.stringify({output,success:report.success,integrationSuccess:report.integrationSuccess,qualitySuccess:report.qualitySuccess,questions:report.questionCount,checks:report.checks.length,requests:report.cloudRequests?.length}));}
