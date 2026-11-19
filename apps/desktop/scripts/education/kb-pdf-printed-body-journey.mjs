import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {setTimeout as delay} from 'node:timers/promises';
import {_electron} from 'playwright';
import {productEntry} from '../product-navigation.mjs';
import {openMaterialDisclosure} from './material-disclosure-ui.mjs';

const from=fs.realpathSync(process.argv[2]);
const buildRoot=path.resolve(process.env.OMNI_EDU_TEST_BUILD_ROOT||'out');
const mainEntry=path.join(buildRoot,'main/index.js');
const baselinePreface=process.argv.includes('--baseline-preface');
const baselineFigure=process.argv.includes('--baseline-figure');
const nextPageFigure=!baselinePreface&&!baselineFigure;
const graphicChoices=nextPageFigure&&!process.argv.includes('--baseline-graphic-choices');
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
const optionSource=nextPageFigure&&process.argv[3]&&!process.argv[3].startsWith('--')?
 new DatabaseSync(path.join(fs.realpathSync(process.argv[3]),'app.db'),{readOnly:true}):undefined;
if(optionSource)fixtures.push({pattern:'%ep-102-%2013%.pdf',file:'图形选项跨页练习.pdf',status:'needs_review'});
try{
 for(const fixture of fixtures){
  const database=fixture===fixtures[3]?optionSource:source;
  const original=database.prepare('SELECT id,local_path,content_hash FROM teacher_resources WHERE original_file_name LIKE ?').get(fixture.pattern);
  assert.equal(sha(fs.readFileSync(original.local_path)),original.content_hash);
  fixture.sourcePage??=2;
  const old=database.prepare('SELECT p.status FROM material_pdf_pages p JOIN material_pdf_jobs j ON p.generation=j.generation WHERE j.resource_id=? AND p.page=?').get(original.id,fixture.sourcePage);
  assert.equal(old.status,'needs_review');
  fs.copyFileSync(original.local_path,path.join(folder,fixture.file));
  fixture.hash=original.content_hash;
  if(fixture===fixtures[3])assert.equal(fixture.hash,'beec4f0618675159e91a559d54bb61cd369537299213ad2bdcb0a6ff824e00fc');
 }
}finally{source.close();optionSource?.close();}
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
async function reviewFromOriginal(fixture,candidate,pages){
  await productEntry(page,'materials').click();
  const original=fixture.file.replace(/\.pdf$/i,'');
  await page.getByTestId('materials-search').fill(original);
  await page.getByTestId('materials-refresh').click();
  await page.getByTestId('material-'+fixture.id).getByRole('button').click();
  await page.getByRole('button',{name:'题目与校正',exact:true}).click();
  const panel=page.getByTestId('material-structure-panel');
  await openMaterialDisclosure(panel);
  for(let n=1;n<pages[0];n++)await panel.getByTestId('structure-next').click();
  const review=panel.getByTestId('structure-review-'+candidate.id);
  await review.getByTestId('structure-review-open').click();
  const preview=review.getByTestId('structure-review-source-image');
  for(const target of pages){
   await review.getByTestId('structure-review-source-page-'+target).click();
   await until(async()=>await preview.getAttribute('alt')==='第'+target+'页结构来源');
   await preview.evaluate(img=>img.decode());
  }
  await review.getByTestId('structure-review-difficulty').selectOption('medium');
  assert(await review.getByTestId('structure-review-save').isDisabled());
  await review.getByTestId('structure-review-checked').check();
  await review.getByTestId('structure-review-save').click();
  await panel.getByTestId('structure-reviewed-'+candidate.id).waitFor();
  const reviewed=read('SELECT * FROM material_structure_reviews WHERE candidate_id=?',[candidate.id])[0];
  const archived=read('SELECT * FROM question_bank_items WHERE id=?',[reviewed.question_id])[0];
  assert.equal(JSON.parse(archived.archive_json).sourceChecked,true);
  return { reviewed, archived };
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
   if(fixture===fixtures[1])assert(receipt.nativeText.includes('1\n2')&&receipt.ocrText.includes('D. 1R'));
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
  const terminal=tail.questions.find(q=>q.number==='7');
  assert(terminal&&!terminal.stem.includes('第 3 页共 4 页'));
  if(nextPageFigure){
   assert.equal(terminal.status,'needs_review');
   assert.deepEqual(terminal.pageRange,[3,4]);
   assert(terminal.issues.includes('ambiguous_asset')&&!terminal.issues.includes('missing_figure'));
   assert(!terminal.stem.includes('容器 1,2,3'));
   assert.deepEqual(terminal.assets.map(a=>[a.page,a.regionId]),[[4,'block-1']]);
   const next=await page.evaluate(input=>window.omniEdu.getMaterialStructure(input),{resourceId:pressure.id,version:pressure.hash,page:4});
   assert.deepEqual(next.questions.find(q=>q.number==='8').assets.map(a=>a.regionId),['block-3','block-5','block-7']);
  }else assert(terminal.issues.includes('missing_figure'));

 }
 assert(tail.questions.some(q=>q.number==='6'&&q.status==='needs_review'));
 const pressureBank=read("SELECT json_extract(archive_json,'$.number') number FROM question_bank_items WHERE source_title=?",[pressure.file]);
 assert.equal(pressureBank.some(q=>q.number==='3'),!baselinePreface);
 assert(!pressureBank.some(q=>['6','7'].includes(q.number)));
 capture(baselinePreface?'Baseline global preface blocks the independent pressure question':'An independent later-page question keeps its own source and diagram, while the missing figure and formula conflicts stay held');
 let reviewed, graphArchive;
 if(nextPageFigure){
  const negative=fixtures[3];
  if(negative){
   const data=await page.evaluate(input=>window.omniEdu.getMaterialStructure(input),{resourceId:negative.id,version:negative.hash,page:3});
   const figures=data.page.regions.filter(region=>region.kind==='image'&&region.box[3]<0.4);
   assert(figures.length>=4);
   const previous=await page.evaluate(input=>window.omniEdu.getMaterialStructure(input),{resourceId:negative.id,version:negative.hash,page:2});
   const figureChoices=previous.questions.find(q=>q.number==='13');
   assert(figureChoices&&figureChoices.status==='needs_review');
   if (graphicChoices) {
    assert.deepEqual(figureChoices.pageRange,[2,3]);
    assert.deepEqual(figureChoices.options.map(o=>o.label),['A','B','C','D']);
    assert.deepEqual(figureChoices.assets.map(a=>[a.page,a.regionId,a.choiceLabel]),[
      [2,'block-14',undefined],[3,'block-1','A'],[3,'block-3','B'],[3,'block-5','C'],[3,'block-7','D'],
    ]);
    const next=data.questions.find(q=>q.number==='14');
    assert(next&&!next.assets.some(a=>figureChoices.assets.some(b=>b.page===a.page&&b.regionId===a.regionId)));
    assert(!read("SELECT id FROM question_bank_items WHERE source_title=? AND json_extract(archive_json,'$.number')='13'",[negative.file]).length);
    ({archived:graphArchive}=await reviewFromOriginal(negative,figureChoices,[2,3]));
    const document=JSON.parse(graphArchive.document_json);
    const choices=document.blocks.find(b=>b.kind==='choices');
    assert.deepEqual(choices.options.map(o=>o.label),['A','B','C','D']);
    assert(document.blocks.some(b=>b.kind==='image'&&b.anchors[0].page===2));
    assert(choices.options.every(o=>o.blocks.length===1&&o.blocks[0].kind==='image'&&
      o.blocks[0].anchors[0].page===3&&o.blocks[0].anchors[0].box[3]<0.253));
    assert.equal(new Set(choices.options.map(o=>o.blocks[0].sha256)).size,4);
    capture('Four graphics map to their actual A–D captions and are archived only after source review');
   } else {
    assert(!figureChoices.assets.some(a=>a.page===3&&figures.some(f=>f.id===a.regionId)));
    capture('Baseline keeps the four figures outside the solitary figure path');
   }

  }
  const held=tail.questions.find(q=>q.number==='7');
  ({reviewed}=await reviewFromOriginal(pressure,held,[3,4]));
  const document=JSON.parse(reviewed.body_json).document;
  const images=document.blocks.filter(b=>b.kind==='image');
  assert.deepEqual(images.map(b=>b.anchors[0].page),[3,4]);
  assert(images[1].anchors[0].box[3]<0.274);
  const archived=read('SELECT archive_json FROM question_bank_items WHERE id=?',[reviewed.question_id])[0];
  assert.equal(JSON.parse(archived.archive_json).sourceChecked,true);
  capture('Teacher compares both original pages and saves a draft containing the isolated page-four crop');
 }
 await app.close();app=undefined;
 await launch();
 for(const fixture of fixtures){
  const current=await page.evaluate(id=>window.omniEdu.getMaterialPdfStatus(id),fixture.id);
  assert.equal(current.generation,fixture.generation);
  assert.equal(sha(read('SELECT result_json FROM material_pdf_pages WHERE generation=? AND page=?',[current.generation,fixture.sourcePage])[0].result_json),fixture.receipt);
 }
 if(reviewed){
  const reopened=read('SELECT body_json FROM material_structure_reviews WHERE question_id=?',[reviewed.question_id])[0];
  assert.equal(reopened.body_json,reviewed.body_json);
  assert(JSON.parse(reopened.body_json).document.blocks.some(b=>b.kind==='image'&&b.anchors[0].page===4));
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
 if(graphArchive){
  await productEntry(page,'teaching').click();
  await page.getByRole('button',{name:'题本',exact:true}).click();
  await page.getByTestId('question-notebook-search').fill(graphArchive.stem.slice(0,32));
  const card=page.getByTestId('question-notebook-card-'+graphArchive.id);
  await card.getByTestId('question-original-open').click();
  const stored=JSON.parse(graphArchive.document_json).blocks.find(b=>b.kind==='choices');
  for(const option of stored.options){
   const image=card.getByRole('img',{name:'选项 '+option.label+' 原图',exact:true});
   await image.evaluate(node=>node.decode());
   const uri=await image.getAttribute('src');
   assert(sha(Buffer.from(uri.split(',')[1],'base64'))===option.blocks[0].sha256);
  }
  capture('The restarted notebook displays four labeled original crops with the archived image hashes');
 }

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
