import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {setTimeout as delay} from 'node:timers/promises';
import {_electron} from 'playwright';
import {productEntry} from '../product-navigation.mjs';

const from=fs.realpathSync(process.argv[2]);
const buildRoot=path.resolve(process.env.OMNI_EDU_TEST_BUILD_ROOT||'out');
const mainEntry=path.join(buildRoot,'main/index.js');
const baselinePreface=process.argv.includes('--baseline-preface');
assert.equal(path.basename(from),'data');
assert.equal(path.basename(path.dirname(from)),'flow-1gb-20261111');
const output=fs.mkdtempSync(path.resolve('test-results','native-printed-body-ui-'));
console.log('OUTPUT '+output);
const folder=path.join(output,'materials'),data=path.join(output,'data'),profile=path.join(output,'profile');
fs.mkdirSync(folder);
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const source=new DatabaseSync(path.join(from,'app.db'),{readOnly:true});
const fixtures=[
 {pattern:'gh-physics-7-%circuit_3.pdf',file:'可核对的物理电路.pdf',status:'complete'},
 {pattern:'gh-physics-5-%circuit_2.pdf',file:'含分式的物理电路.pdf',status:'needs_review'},
 {pattern:'gh-physics-16-%pressure2.pdf',file:'液体压强练习.pdf',status:'needs_review',sourcePage:3},
];
try{
 for(const fixture of fixtures){
  const original=source.prepare('SELECT id,local_path,content_hash FROM teacher_resources WHERE original_file_name LIKE ?').get(fixture.pattern);
  assert.equal(sha(fs.readFileSync(original.local_path)),original.content_hash);
  fixture.sourcePage??=2;
  const old=source.prepare('SELECT p.status FROM material_pdf_pages p JOIN material_pdf_jobs j ON p.generation=j.generation WHERE j.resource_id=? AND p.page=?').get(original.id,fixture.sourcePage);
  assert.equal(old.status,'needs_review');
  fs.copyFileSync(original.local_path,path.join(folder,fixture.file));
  fixture.hash=original.content_hash;
 }
}finally{source.close();}
function read(sql,args=[]){
 const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});
 try{return db.prepare(sql).all(...args);}finally{db.close();}
}
async function until(get,limit=180000){
 const end=Date.now()+limit;
 while(Date.now()<end){const result=await get();if(result)return result;await delay(350);}
 throw Error('Timed out waiting for persisted import');
}

const report={checks:[],errors:[],buildSha256:sha(fs.readFileSync(mainEntry))};
const capture=message=>{report.checks.push(message);console.log('PASS '+message);};
let app,page;
async function launch(){
 const env={...process.env,OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve('../..')};
 for(const key of Object.keys(env))if(key.startsWith('OMNI_EDU_E2E_')||['DEEPSEEK_API_KEY','ELECTRON_RUN_AS_NODE','NODE_OPTIONS','ELECTRON_RENDERER_URL'].includes(key))delete env[key];
 Object.assign(env,{OMNI_EDU_E2E_DIALOG_MODE:'1',OMNI_EDU_E2E_VISIBLE:'0'});
 app=await _electron.launch({args:[mainEntry,'--user-data-dir='+profile],env,cwd:process.cwd(),timeout:90000});
 page=await app.firstWindow();page.setDefaultTimeout(60000);
 page.on('pageerror',error=>report.errors.push(error.message));
 await productEntry(page,'materials').click();
}
try{
 await launch();
 await app.evaluate(({dialog},selected)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[selected]});},folder);
 await page.getByTestId('materials-import-folder').click();
 const resources=await until(()=>{const rows=read('SELECT * FROM teacher_resources');return rows.length===fixtures.length&&rows;});
 for(const fixture of fixtures){
  const resource=resources.find(row=>row.original_file_name===fixture.file);
  assert(resource&&resource.content_hash===fixture.hash);
  fixture.id=resource.id;
  const job=await until(()=>read("SELECT * FROM material_pdf_jobs WHERE resource_id=? AND state IN ('complete','partial')",[resource.id])[0]);
  const row=read('SELECT * FROM material_pdf_pages WHERE generation=? AND page=?',[job.generation,fixture.sourcePage])[0];
  const receipt=JSON.parse(row.result_json),parts=read('SELECT content_md FROM material_pdf_chunks WHERE generation=? AND page=?',[job.generation,fixture.sourcePage]);
  assert.equal(row.status,fixture.status);
  assert.equal((await page.evaluate(id=>window.omniEdu.getMaterialPdfStatus(id),fixture.id)).generation,job.generation);
  if(fixture.status==='complete'){
   assert.equal(receipt.method,'native');assert.equal(receipt.text,receipt.nativeText);
   assert(receipt.ocrText.split('\n').includes('Ro')&&!receipt.nativeText.includes('Ro'));
   assert(parts.some(chunk=>chunk.content_md.includes('保护电表'))&&!parts.some(chunk=>chunk.content_md.includes('Ro')));
  }else{
   assert.equal(receipt.error,'text_conflict');assert.equal(receipt.method,'ocr');assert.equal(parts.length,0);
   if(fixture.sourcePage===2)assert(receipt.nativeText.includes('1\n2')&&receipt.ocrText.includes('D. 1R'));
  }
  fixture.generation=job.generation;
  fixture.receipt=sha(row.result_json);
 }
 await until(()=>read("SELECT COUNT(*) n FROM material_structure_jobs WHERE status IN ('complete','partial')")[0].n===fixtures.length);
 const [verified]=fixtures;
 const paragraphs=read("SELECT p.body_json FROM material_structure_pages p JOIN material_structure_jobs j ON j.generation=p.generation WHERE j.resource_id=? AND p.page=2",[verified.id]);
 assert(JSON.parse(paragraphs[0].body_json).paragraphs.some(part=>part.role==='figure'&&part.text==='Ro'));
 const questions=read("SELECT q.body_json FROM material_structure_questions q JOIN material_structure_jobs j ON j.generation=q.generation WHERE j.resource_id=? AND q.first_page=2",[verified.id]).map(row=>JSON.parse(row.body_json));
 assert(questions.some(q=>q.number==='4'&&q.stem.includes('保护电表'))&&!questions.some(q=>q.stem.includes('Ro')));
 assert(read("SELECT content_md FROM resource_chunks WHERE resource_id=? AND page_number=2",[verified.id]).some(chunk=>chunk.content_md.includes('保护电表')));
 capture('Folder import publishes verified body and question candidates and preserves diagram labels in figure roles');
 const conflicted=fixtures[1];
 const held=await page.evaluate(input=>window.omniEdu.getMaterialStructure(input),{resourceId:conflicted.id,version:conflicted.hash,page:2});
 assert(held.questions.some(q=>q.number==='3'&&q.status==='candidate'));
 assert(held.questions.some(q=>q.number==='4'&&q.status==='needs_review'&&q.issues.includes('pdf_text_conflict')));
 await until(()=>read("SELECT count(*) n FROM material_question_jobs WHERE status='complete'")[0].n===fixtures.length);
 const admitted=read("SELECT json_extract(archive_json,'$.number') number FROM question_bank_items WHERE source_title=?",[conflicted.file]);
 assert(admitted.some(q=>q.number==='3')&&!admitted.some(q=>q.number==='4'));
 capture('Independent same-page question 3 is archived while question 4 with the missing denominator remains in review');
 const pressure=fixtures[2];
 const tail=await page.evaluate(input=>window.omniEdu.getMaterialStructure(input),{resourceId:pressure.id,version:pressure.hash,page:3});
 const standalone=await page.evaluate(input=>window.omniEdu.getMaterialStructure(input),{resourceId:pressure.id,version:pressure.hash,page:2});
 const restored=standalone.questions.find(q=>q.number==='3');
 assert(restored&&restored.pageRange[0]===(baselinePreface?1:2)&&restored.pageRange[1]===2);
 assert.equal(restored.status,baselinePreface?'needs_review':'candidate');
 assert.equal(!!restored.sharedMaterialIds.length,baselinePreface);
 if(!baselinePreface){
  assert(restored.assets.some(a=>a.page===2&&a.kind==='image'));
  assert(restored.stem.includes('灌入多少水')&&!restored.stem.includes('帕斯卡定律'));
  assert(tail.page.paragraphs.some(p=>p.role==='footer'&&p.rawText.includes('第 3 页共 4 页')));
  assert(tail.questions.some(q=>q.number==='7'&&q.issues.includes('missing_figure')&&!q.stem.includes('第 3 页共 4 页')));
 }
 assert(tail.questions.some(q=>q.number==='6'&&q.status==='needs_review'));
 const pressureBank=read("SELECT json_extract(archive_json,'$.number') number FROM question_bank_items WHERE source_title=?",[pressure.file]);
 assert.equal(pressureBank.some(q=>q.number==='3'),!baselinePreface);
 assert(!pressureBank.some(q=>['6','7'].includes(q.number)));
 capture(baselinePreface?'Baseline global preface blocks the independent pressure question':'An independent later-page question keeps its own source and diagram, while the missing figure and formula conflicts stay held');
 await app.close();app=undefined;
 await launch();
 for(const fixture of fixtures){
  const current=await page.evaluate(id=>window.omniEdu.getMaterialPdfStatus(id),fixture.id);
  assert.equal(current.generation,fixture.generation);
  assert.equal(sha(read('SELECT result_json FROM material_pdf_pages WHERE generation=? AND page=?',[current.generation,fixture.sourcePage])[0].result_json),fixture.receipt);
 }
 capture('Cold read keeps both original transcriptions, their source generation and the held page');
 await until(async()=>!(await page.evaluate(()=>window.omniEdu.getMaterialIndexStatus())).pending);
 await page.getByTestId('materials-mode-text').click();
 await page.getByTestId('materials-search-mode').selectOption('keyword');
 await page.getByTestId('materials-text-query').fill('保护电表');
 await page.getByTestId('materials-text-submit').click();
 const hit=page.locator('[data-testid^="material-text-hit-"]').filter({hasText:'可核对的物理电路'}).first();
 await hit.click();
 await page.getByTestId('materials-original-open').click();
 const preview=page.locator('[data-testid="materials-original-image"][alt*="2"]');
 await preview.waitFor();
 await preview.evaluate(image=>image.decode());
 capture('The indexed question page is found by local search and opens its original diagram-bearing page');
 assert.deepEqual(report.errors,[]);
 report.success=true;
}catch(error){
 report.success=false;report.error=String(error.stack||error);process.exitCode=1;
 if(page)await page.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});
}finally{
 await app?.close();
 fs.writeFileSync(path.join(output,'summary.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify(report));
}
