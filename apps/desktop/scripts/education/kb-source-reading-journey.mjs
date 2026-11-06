import '../office-agent/register-source.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {_electron} from 'playwright';
import {productEntry} from '../product-navigation.mjs';
import {openMaterialDisclosure} from './material-disclosure-ui.mjs';
const {questionVersion}=await import('../../src/main/education/question-context-provider.ts');

// One new batch against an existing authorized, visually inspected one-page
// development fixture. Never alter/replay old paid receipts or retry this run.
const [root]=process.argv.slice(2),desktop=process.cwd(),contentMode=process.argv.includes('--source-content'),literalMode=process.argv.includes('--literal');
assert(root&&path.isAbsolute(root));
const relative=path.relative(fs.realpathSync(os.tmpdir()),fs.realpathSync(root));
assert(relative&&!relative.startsWith('..')&&!path.isAbsolute(relative));
const output=fs.mkdtempSync(path.join(root,contentMode?'source-content-natural-':'source-reading-'));
const data=path.join(root,'data'),ledger=path.join(output,'cloud-ledger.json'),reportFile=path.join(output,'report.json');
const sha=b=>createHash('sha256').update(b).digest('hex');
const sql=(s,p=[])=>{const d=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});try{return d.prepare(s).all(...p);}finally{d.close();}};
const oldIds=sql('SELECT id FROM material_ai_batches ORDER BY id').map(r=>r.id);
assert(oldIds.length&&sql("SELECT 1 FROM material_ai_units WHERE status IN ('pending','first_saved','dispatched')").length===0);
const slots=oldIds.map(()=>'?').join(',');
const fingerprint=()=>sha(JSON.stringify({units:sql(`SELECT * FROM material_ai_units WHERE batch_id IN (${slots}) ORDER BY batch_id,ordinal`,oldIds),crops:sql(`SELECT * FROM material_ai_page_crops WHERE batch_id IN (${slots}) ORDER BY batch_id,ordinal,number`,oldIds),verifications:sql(`SELECT * FROM material_ai_page_verifications WHERE batch_id IN (${slots}) ORDER BY batch_id,ordinal`,oldIds),questions:sql(`SELECT q.* FROM question_bank_items q JOIN material_ai_members m ON m.question_id=q.id WHERE m.batch_id IN (${slots}) ORDER BY q.id`,oldIds)}));
const before=fingerprint(),oldLedger=fs.readFileSync(path.join(root,'cloud-ledger.json'),'utf8');
const resource=sql("SELECT id,title,content_hash FROM teacher_resources WHERE original_file_name='主书.pdf'")[0];assert(resource);
const report={buildSha256:sha(fs.readFileSync('out/main/index.js')),checks:[],rendererErrors:[],qualitySuccess:false,scope:'One authorized unchanged natural main-book page, new three-request source-reading batch, actual UI and cold read. Not held-out quality, whole-book/40GiB, final mathematics, paper, installer or migration acceptance.'};
let app,page,batchId;
const flush=()=>fs.writeFileSync(reportFile,JSON.stringify(report,null,2));
const until=async(fn,ms=120000)=>{const end=Date.now()+ms;while(Date.now()<end){const value=await fn();if(value)return value;await new Promise(r=>setTimeout(r,700));}throw Error('Inspect retained source-reading receipts; never silently repeat paid requests');};
async function launch(cold=false){
 const env={...process.env,OMNI_EDU_DATA_ROOT:data,OMNI_EDU_E2E_VISIBLE:'0',OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_AI_LITERAL_READING:process.argv.includes('--literal')?'1':'0',OMNI_EDU_AI_SOURCE_READING:'1',...(contentMode?{OMNI_EDU_AI_SOURCE_CONTENT_ROLES:'1'}:{}),OMNI_EDU_AI_CORRECTION_REVIEW:'1',OMNI_EDU_AI_BLIND_ANSWERS:'1',OMNI_EDU_AI_CROP_BODY_TEXT:'1',OMNI_EDU_AI_CHOICE_CONCORDANCE:'1',OMNI_EDU_AI_OWNED_CROP_MARGINS:'1',OMNI_EDU_AI_CROP_IMAGES:'1',OMNI_EDU_AI_PRINTED_CHOICE_COUNT:'1'};
 for(const key of ['ELECTRON_RUN_AS_NODE','NODE_OPTIONS','ELECTRON_RENDERER_URL','DEEPSEEK_API_KEY'])delete env[key];
 app=await _electron.launch({args:[path.join(desktop,'out/main/index.js'),'--user-data-dir='+path.join(root,'profile')],cwd:output,env,timeout:60000});
 await app.evaluate(({net},{cold,ledger,output,contentMode,literalMode})=>{
  const fs=process.getBuiltinModule('fs'),crypto=process.getBuiltinModule('crypto'),ordinary=net.fetch.bind(net);
  const load=()=>fs.existsSync(ledger)?JSON.parse(fs.readFileSync(ledger,'utf8')):[];
  for(const owner of [net,globalThis])owner.fetch=async(url,options)=>{
   if(cold)throw Error('Cold read forbids network');
   const target=new URL(String(url));
   if(target.protocol!=='https:'||target.hostname!=='api.deepseek.com'||target.port||target.username||target.password||!['/chat/completions','/models'].includes(target.pathname))throw Error('Unexpected test endpoint');
   if(target.pathname==='/models')return ordinary(url,options);
   const rows=load();if(rows.length>=3)throw Error('Three-request source-reading sample limit; no retry');
   const body=JSON.parse(options.body),payload=JSON.parse(body.messages[1].content[0].text);
   if(payload.pageContext?.sourceReadingPolicy!=='crop-source-reading.v1'||payload.answerContext)throw Error('Unexpected source-reading scope');
   if(contentMode&&payload.pageContext.sourceContentPolicy!=='source-content-roles.v1')throw Error('Expected current source-content policy');
   if(literalMode&&payload.pageContext.literalReadingPolicy!=='host-independent-literal.v2')throw Error('Expected frozen independent literal v2');
   if(literalMode&&payload.firstDraft){if(Object.hasOwn(payload,'material')||Object.hasOwn(payload.pageContext,'blockTexts')||Object.hasOwn(payload,'localReview')||payload.cropReview.questions.some(q=>Object.hasOwn(q,'sourceFound')||q.crops.some(c=>Object.hasOwn(c,'text'))))throw Error('Original OCR leaked into independent reading');if(payload.phase==='仅转录原图来源，不解题'&&payload.firstDraft.questions.some(q=>Object.keys(q).join(',')!=='number'))throw Error('First-draft prose leaked into independent source phase');}
   const row={independentLiteralPolicy:payload.pageContext.literalReadingPolicy,ocrHidden:!!payload.firstDraft&&!Object.hasOwn(payload,'material'),sourceContentPolicy:payload.pageContext.sourceContentPolicy,ordinal:rows.length+1,startedAt:new Date().toISOString(),phase:payload.phase,images:body.messages[1].content.filter(c=>c.type==='image_url').length,sourceReadingPolicy:payload.pageContext.sourceReadingPolicy,sourceOnlyDraft:!!payload.firstDraft&&!('pageText'in payload.firstDraft),model:body.model};
   rows.push(row);fs.writeFileSync(ledger,JSON.stringify(rows,null,2));const start=performance.now();
   try{const response=await ordinary(url,{...options,credentials:'omit',redirect:'error'}),raw=await response.clone().text();fs.writeFileSync(output+'/response-'+row.ordinal+'.json',raw);let parsed;try{parsed=JSON.parse(raw);}catch{}Object.assign(row,{status:response.status,elapsedMs:performance.now()-start,responseSha256:crypto.createHash('sha256').update(raw).digest('hex'),usage:parsed?.usage,finishReason:parsed?.choices?.[0]?.finish_reason});const current=load();current[row.ordinal-1]=row;fs.writeFileSync(ledger,JSON.stringify(current,null,2));return response;}
   catch(error){const current=load();current[row.ordinal-1]={...row,elapsedMs:performance.now()-start,error:String(error?.name||'network_error')};fs.writeFileSync(ledger,JSON.stringify(current,null,2));throw error;}
  };
 },{cold,ledger,output,contentMode,literalMode});
 page=await app.firstWindow();page.setDefaultTimeout(60000);page.on('pageerror',e=>report.rendererErrors.push(e.message));await productEntry(page,'materials').waitFor();
}
async function openBatch(){
 await productEntry(page,'materials').click();await page.getByTestId('materials-search').fill(resource.title);
 const open=page.getByTestId('material-'+resource.id).getByRole('button');await open.waitFor();assert.equal(await open.count(),1);await open.click();
 if(await page.getByTestId('materials-section-questions').isVisible())await page.getByTestId('materials-section-questions').click();
 const panel=page.getByTestId('material-ai-panel');await openMaterialDisclosure(panel);return panel;
}
async function inspect(){
 const panel=await openBatch();
 // Select by the article's own attribute; descendant matching would miss it.
 const article=panel.locator(`[data-testid="material-ai-batch"][data-batch-id="${batchId}"]`);
 await article.getByTestId('material-ai-page-open').click();
 const comparison=article.getByTestId('material-source-readings');await comparison.waitFor();await openMaterialDisclosure(comparison);
 assert(await comparison.getByTestId('material-source-reading-crop').count()>0);
 for(const [width,height]of [[1366,768],[1920,1080]]){const win=await app.browserWindow(page);await win.evaluate((w,s)=>w.setContentSize(s.width,s.height),{width,height});await page.waitForFunction(s=>innerWidth===s.width&&innerHeight===s.height,{width,height});await comparison.scrollIntoViewIfNeeded();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(output,'reading-'+width+'-'+report.checks.length+'.png')});}
 return comparison.getByTestId('material-source-reading-crop').count();
}
try{
 console.log('OUTPUT '+output);flush();await launch();const panel=await openBatch();await panel.getByTestId('material-ai-refresh-settings').click();
 await panel.getByTestId('material-ai-start').fill('1');await panel.getByTestId('material-ai-count').fill('1');await panel.getByTestId('material-ai-budget').fill('3');
 for(const key of ['images','public','consent'])await panel.getByTestId('material-ai-'+key).check();await panel.getByTestId('material-ai-create').click();
 batchId=await until(()=>sql('SELECT id FROM material_ai_batches WHERE resource_id=? ORDER BY created_at DESC',[resource.id]).find(r=>!oldIds.includes(r.id))?.id);report.batchId=batchId;flush();
 await until(()=>{const b=sql('SELECT status,calls FROM material_ai_batches WHERE id=?',[batchId])[0],units=sql('SELECT ordinal,status,error FROM material_ai_units WHERE batch_id=?',[batchId]);fs.writeFileSync(path.join(output,'progress.json'),JSON.stringify({batch:b,units}));return b.status!=='running'&&units.length&&units.every(u=>!['pending','dispatched','first_saved'].includes(u.status));},1200000);
 const units=sql('SELECT * FROM material_ai_units WHERE batch_id=?',[batchId]);report.units=units.map(u=>({status:u.status,error:u.error,first:!!u.first_json,final:!!u.final_json}));
 report.cloudRequests=JSON.parse(fs.readFileSync(ledger,'utf8'));assert.equal(units.length,1);assert(units[0].final_json,JSON.stringify(report.units));assert.equal(report.cloudRequests.length,3);assert(report.cloudRequests.every(r=>r.status===200));assert(report.cloudRequests[1].sourceOnlyDraft);report.checks.push('Visible teacher action creates one new batch and the production provider completes three versioned source-reading requests');
 const questions=sql('SELECT q.*,m.number FROM question_bank_items q JOIN material_ai_members m ON m.question_id=q.id WHERE m.batch_id=? ORDER BY CAST(m.number AS INTEGER)',[batchId]);
 report.questions=questions.map(q=>({number:q.number,state:JSON.parse(q.archive_json).state,issues:JSON.parse(q.archive_json).issues,document:!!q.document_json}));
 report.completeDocuments=questions.filter(q=>q.document_json).length;report.eligible=questions.filter(q=>JSON.parse(q.archive_json).state==='ai_final').length;report.held=questions.length-report.eligible;
 assert(questions.length>0);report.cropsShown=await inspect();report.checks.push('Actual teacher UI opens raw OCR and AI literal readings at both desktop sizes');
 const eligible=questions.filter(q=>JSON.parse(q.archive_json).state==='ai_final');
 for(const q of eligible){const full=await page.evaluate(id=>window.omniEdu.getQuestionNotebookEntry(id),q.id),source=await page.evaluate(input=>window.omniEdu.getQuestionContextSource(input),{schemaVersion:'xiaozhi.education.question-context.v1',questionId:q.id,version:questionVersion(full)});assert(source.ok);}
 if(eligible.length)report.checks.push('Every automatically eligible question passes the actual typed question-source entrypoint; held questions remain separate');else report.notRun=['Natural positive Pi/source entrypoint: no eligible questions'];
 assert.equal(fingerprint(),before);assert.equal(fs.readFileSync(path.join(root,'cloud-ledger.json'),'utf8'),oldLedger);
 const fresh=sha(JSON.stringify(sql('SELECT * FROM material_ai_units WHERE batch_id=?',[batchId])));await app.close();app=undefined;await launch(true);assert.equal(await inspect(),report.cropsShown);assert.equal(sha(JSON.stringify(sql('SELECT * FROM material_ai_units WHERE batch_id=?',[batchId]))),fresh);assert.equal(fingerprint(),before);report.checks.push('Cold launch reopens the saved comparison and preserves both new and historical paid receipts without another request');
 // Archive eligibility is not an independent transcription/math evaluation.
 report.automaticArchiveSuccess=report.eligible===questions.length;assert.equal(report.rendererErrors.length,0);report.success=true;
}catch(error){report.success=false;report.error=String(error?.stack||error);if(page)try{await page.screenshot({path:path.join(output,'failure.png')});}catch{}process.exitCode=1;}
finally{if(app)await app.close();if(fs.existsSync(ledger))report.cloudRequests=JSON.parse(fs.readFileSync(ledger,'utf8'));report.historicalReceiptsUnchanged=fingerprint()===before;flush();console.log(JSON.stringify({output,success:report.success,qualitySuccess:report.qualitySuccess,checks:report.checks.length,eligible:report.eligible,held:report.held,calls:report.cloudRequests?.length,error:report.error}));}
