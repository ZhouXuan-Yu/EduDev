import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {backup,DatabaseSync} from 'node:sqlite';
import {_electron} from 'playwright';
import {productEntry} from '../product-navigation.mjs';
import {assertIsolatedPiMain,testMain} from '../acceptance/build-root.mjs';
import {openMaterialDisclosure} from './material-disclosure-ui.mjs';

const acceptance=process.env.OMNI_EDU_ACCEPTANCE_ROOT;
const fixture=process.env.OMNI_EDU_MOCK_EXAM_FIXTURE;
assert(acceptance&&fixture,'Use the fixed acceptance directory and verified scan fixture');
const original=path.resolve(fixture,'data'),oldDb=path.join(original,'app.db');
const output=fs.mkdtempSync(path.join(acceptance,'yangpu-rubrics-'));
const data=path.join(output,'data'),profile=path.join(output,'profile');
// Keep the source PDF and page caches while each acceptance profile starts its own live stores.
fs.cpSync(original,data,{recursive:true,filter:file=>{
  const relative=path.relative(original,file);
  return !/^app\.db(?:-wal|-shm)?$/u.test(relative)&&
    relative!==path.join('cache','semantic-v1')&&relative!=='xiaozhi-pi';
}});
const fixtureDb=new DatabaseSync(oldDb,{readOnly:true,timeout:5000});
try{await backup(fixtureDb,path.join(data,'app.db'));}
finally{fixtureDb.close();}
const desktop=path.resolve(import.meta.dirname,'../..');
const main=testMain(desktop),sha=value=>createHash('sha256').update(value).digest('hex');
const shaFile=file=>sha(fs.readFileSync(file));
const report={ok:false,output,main,mainSha256:shaFile(main),checks:[],providerCalls:0};
let app;

function sql(query,args=[],write=false){
  const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:!write,timeout:5000});
  try{return write?db.prepare(query).run(...args):db.prepare(query).all(...args);}
  finally{db.close();}
}
for(const row of sql('SELECT id,local_path,content_hash FROM teacher_resources')){
  const relative=path.relative(original,row.local_path),file=path.join(data,relative);
  assert(relative.startsWith('teacher_resources'+path.sep));
  assert.equal(shaFile(file),row.content_hash);
  sql('UPDATE teacher_resources SET local_path=? WHERE id=?',[file,row.id],true);
}
const [source]=sql("SELECT id,title,content_hash,local_path FROM teacher_resources WHERE content_hash='c05eb0867d2ca3cdeeee8e6dd73fdd6e20c617cd43f4e89be304601f938d87f6'");
assert(source);
report.resourceId=source.id;
report.sourceSha256=source.content_hash;
const job=()=>sql('SELECT * FROM material_structure_jobs WHERE resource_id=?',[source.id])[0];
const pages=generation=>sql('SELECT * FROM material_structure_pages WHERE generation=? ORDER BY page',[generation]);
const questionRows=generation=>sql('SELECT * FROM material_structure_questions WHERE generation=? ORDER BY rowid',[generation]);
const old=job(),oldPages=pages(old.generation),oldQuestions=questionRows(old.generation);
assert(['layout-paragraph-question.v17','layout-paragraph-question.v18','layout-paragraph-question.v19'].includes(old.engine));
assert.equal(oldPages.length,4);
const oldList=oldQuestions.map(row=>JSON.parse(row.body_json));
const baseline=oldList.find(q=>q.number==='15');
const oldChoices=old.engine.endsWith('v19')?baseline.options:baseline.subquestions
  .flatMap(part=>part.children??[]).flatMap(part=>part.options);
assert.deepEqual(oldChoices.map(option=>option.text),['(C) 2','(D) 3']);
assert.equal(baseline.formulaSources,undefined);
if(old.engine.endsWith('v17'))assert(!oldList.some(q=>q.number==='20'));
const confirmed=()=>sql("SELECT id,archive_json FROM question_bank_items WHERE json_valid(archive_json) AND (json_extract(archive_json,'$.state')='teacher_edited' OR json_extract(archive_json,'$.sourceChecked')=1) ORDER BY id");
const teacherBefore=confirmed();
const check=name=>{report.checks.push(name);console.log('PASS '+name);};

async function open(){
  const env={...process.env,OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),
    OMNI_EDU_SKIP_DOTENV:'1',OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_E2E_VISIBLE:'0'};
  for(const key of ['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL','DEEPSEEK_API_KEY'])delete env[key];
  app=await _electron.launch({args:[main,'--user-data-dir='+profile],cwd:desktop,env,timeout:60_000});
  await assertIsolatedPiMain(app,main,profile);
  await app.evaluate(({net})=>{
    globalThis.testRubricRemoteCalls=0;
    for(const owner of [globalThis,net]){
      const fetch=owner.fetch.bind(owner);
      owner.fetch=async(input,options)=>{
        const address=new URL(typeof input==='string'?input:input.url??input.href);
        if(address.hostname==='api.deepseek.com'){
          globalThis.testRubricRemoteCalls++;
          throw Error('Only local structure work is authorized');
        }
        return fetch(input,options);
      };
    }
  });
  const page=await app.firstWindow();
  await productEntry(page,'materials').click();
  await page.getByTestId('materials-search').fill(source.title);
  await page.getByTestId('material-'+source.id).getByRole('button').click();
  await page.getByTestId('materials-section-questions').click();
  const panel=page.getByTestId('material-structure-panel');
  await openMaterialDisclosure(panel);
  return {page,panel};
}
async function goToPage(panel,number){
  for(let index=1;index<number;index++){
    await panel.getByTestId('structure-next').click();
    await panel.getByText('第 '+(index+1)+' 页',{exact:true}).waitFor();
  }
}
async function waitForPublish(){
  const deadline=Date.now()+240_000;
  while(Date.now()<deadline){
    const current=job();
    if(current&&current.generation!==old.generation){
      if(['failed','cancelled'].includes(current.status))throw Error(current.status+': '+current.error);
      if(['partial','complete'].includes(current.status)){
        assert.equal(current.processed,4);
        return current;
      }
    }
    await new Promise(resolve=>setTimeout(resolve,500));
  }
  throw Error('Structure rebuild did not publish: '+JSON.stringify(job()));
}

try{
  const first=await open();
  const begin=Date.now();
  await first.panel.getByTestId('structure-rebuild').click();
  const current=await waitForPublish();
  report.publishMs=Date.now()-begin;
  report.generation=current.generation;
  assert.equal(current.engine,'layout-paragraph-question.v20');
  assert.deepEqual(pages(old.generation),oldPages);
  assert.deepEqual(questionRows(old.generation),oldQuestions);
  assert.deepEqual(confirmed(),teacherBefore);
  assert.equal(shaFile(source.local_path),source.content_hash);
  check('The existing UI rebuild publishes v20 while the original scan, previous snapshots and confirmed items stay intact');

  const list=questionRows(current.generation).map(row=>JSON.parse(row.body_json));
  const numbered=list.map(q=>q.number).filter(number=>number!=='0');
  assert.deepEqual(numbered,Array.from({length:21},(_,i)=>String(i+1)));
  const p4=JSON.parse(pages(current.generation).find(row=>row.page===4).body_json);
  for(const number of ['20','21']){
    const q=list.find(q=>q.number===number);
    const rubric=p4.paragraphs.find(paragraph=>paragraph.marker?.kind==='parent'&&paragraph.marker.label===number);
    assert.equal(q.status,'needs_review');
    assert.deepEqual(q.subquestions.map(item=>item.label),['1','2','3']);
    assert.doesNotMatch(q.stem,/本题满分18分/u);
    assert(q.anchors.every(anchor=>anchor.page===4));
    assert(q.paragraphIds.includes(rubric.id));
    assert.match(rubric.rawText,/\n8分/u);
    assert(rubric.lineIds.every(id=>p4.lines.some(line=>line.id===id)));
  }
  check('All 21 printed numbers and the six subquestions of questions 20 and 21 retain page-four source anchors and review status');
  const choice=list.find(q=>q.number==='15');
  const p2=JSON.parse(pages(current.generation).find(row=>row.page===2).body_json);
  assert.equal(choice.stem,baseline.stem);
  assert.deepEqual(choice.anchors,baseline.anchors);
  assert.deepEqual(choice.subquestions,[]);
  assert.deepEqual(choice.options.map(option=>option.text),['(C) 2','(D) 3']);
  assert(choice.issues.includes('missing_choice_options')&&choice.status==='needs_review');
  assert(choice.options.every(option=>option.paragraphIds.every(id=>p2.paragraphs.some(part=>part.id===id))));
  if(!old.engine.endsWith('v17'))for(const number of ['14','16'])
    assert.deepEqual(list.find(q=>q.number===number),oldList.find(q=>q.number===number));
  check('Q15 C and D become whole-question options, A and B remain held, and neighboring choices stay unchanged');
  const formula=choice.formulaSources?.[0];
  assert.equal(choice.formulaSources?.length,1);
  assert(choice.issues.includes('formula_text_unconfirmed') && formula.page===2);
  assert.equal(formula.rasterSha256,p2.rasterSha256);
  assert.deepEqual(formula.lineIds.map(id=>p2.lines.find(line=>line.id===id).text),
    ['当人迎风行走时，人体总的淋雨量为T=','pwD','ν','ZｉZz']);
  assert(formula.box[0]<.487&&formula.box[2]>.73&&formula.box[1]<.51&&formula.box[3]>.543);
  const proof=list.find(q=>q.number==='21').formulaSources;
  assert(proof?.some(entry=>entry.page===4&&entry.rasterSha256===p4.rasterSha256));
  report.formulaSource=formula;
  check('The Q15 and Q21 formula references bind the original line and page identities without rewriting their stems');
  await goToPage(first.panel,2);
  const q15=first.panel.getByTestId('structure-questions').locator('article').filter({hasText:/题 15 .*暂缓入库/u});
  await q15.getByText(/2 个选项 · 0 个小问/u).waitFor();
  await q15.getByTestId('structure-review-open').click();
  const evidence=q15.getByTestId('structure-review-choice-evidence');
  await evidence.getByText('待核对选项 A、B',{exact:true}).waitFor();
  assert.deepEqual(await evidence.getByRole('listitem').allTextContents(),['(C) 2','(D) 3']);
  await q15.getByTestId('structure-review-source-page-2').click();
  const q15Source=q15.getByTestId('structure-review-source-image');
  await q15Source.waitFor();
  await q15Source.evaluate(node=>node.decode());
  for(const [width,height] of [[1366,768],[1920,1080]]){
    await first.page.setViewportSize({width,height});
    await evidence.scrollIntoViewIfNeeded();
    await first.page.screenshot({path:path.join(output,'q15-review-'+width+'.png'),animations:'disabled'});
  }
  const formulaButton=q15.getByTestId('structure-review-formula-0');
  await formulaButton.click();
  const formulaDialog=first.page.getByTestId('structure-formula-dialog');
  const formulaImage=formulaDialog.getByTestId('structure-formula-image');
  await formulaImage.waitFor();
  assert(await first.page.evaluate(async bounds=>{
    const original=document.querySelector('[data-testid="structure-review-source-image"]');
    const crop=document.querySelector('[data-testid="structure-formula-image"]');
    await Promise.all([original.decode(),crop.decode()]);
    const [left,top,right,bottom]=bounds;
    const x=Math.floor(original.naturalWidth*left),y=Math.floor(original.naturalHeight*top);
    const width=Math.ceil(original.naturalWidth*right)-x,height=Math.ceil(original.naturalHeight*bottom)-y;
    if(crop.naturalWidth!==width||crop.naturalHeight!==height)return false;
    const canvas=document.createElement('canvas');
    canvas.width=width;canvas.height=height;
    const ctx=canvas.getContext('2d');
    ctx.drawImage(original,x,y,width,height,0,0,width,height);
    const pixels=ctx.getImageData(0,0,width,height).data;
    ctx.clearRect(0,0,width,height);ctx.drawImage(crop,0,0);
    const actual=ctx.getImageData(0,0,width,height).data;
    return pixels.every((value,index)=>value===actual[index]);
  },formula.box));
  for(const [width,height] of [[1366,768],[1920,1080]]){
    await first.page.setViewportSize({width,height});
    await first.page.screenshot({path:path.join(output,'q15-formula-'+width+'.png'),animations:'disabled'});
  }
  await first.page.keyboard.press('Escape');
  await formulaDialog.waitFor({state:'hidden'});
  await first.page.waitForFunction(()=>document.activeElement?.getAttribute('data-testid')==='structure-review-formula-0');
  const wrongRaster=await first.page.evaluate(async({resourceId,version})=>{
    try { await window.omniEdu.getMaterialStructureImage({resourceId,version,page:2,rasterSha256:'0'.repeat(64)}); }
    catch(error){return String(error);}
  },{resourceId:source.id,version:source.content_hash});
  assert.match(wrongRaster,/source_changed/u);
  check('The formula modal renders the exact original pixels, returns keyboard focus and rejects a mismatched raster');
  await q15.getByTestId('structure-review-cancel').click();
  assert.deepEqual(confirmed(),teacherBefore);
  check('The Q15 teacher review shows the actual C and D values and opens the second original page');
  await first.panel.getByTestId('structure-previous').click();
  await first.panel.getByText('第 1 页',{exact:true}).waitFor();
  await goToPage(first.panel,4);
  await first.panel.getByTestId('structure-questions').getByText(/题 20 .*暂缓入库/u).waitFor();
  await first.panel.getByRole('button',{name:'对照原始页图'}).click();
  const image=first.panel.getByTestId('structure-source-image');
  await image.waitFor();
  assert(await image.evaluate(node=>node.complete&&node.naturalWidth>0));
  report.providerCalls+=await app.evaluate(()=>globalThis.testRubricRemoteCalls);
  await app.close();
  app=undefined;

  const cold=await open();
  await goToPage(cold.panel,2);
  const held=cold.panel.getByTestId('structure-questions').locator('article').filter({hasText:/题 15 .*暂缓入库/u});
  await held.getByTestId('structure-review-open').click();
  await held.getByTestId('structure-review-formula-0').click();
  const restoredFormula=cold.page.getByTestId('structure-formula-dialog');
  await restoredFormula.getByTestId('structure-formula-image').evaluate(node=>node.decode());
  await restoredFormula.getByRole('button',{name:'关闭',exact:true}).click();
  await restoredFormula.waitFor({state:'hidden',timeout:5000});
  await held.getByTestId('structure-review-cancel').click();
  await cold.panel.getByTestId('structure-previous').click();
  await cold.panel.getByText('第 1 页',{exact:true}).waitFor();
  await goToPage(cold.panel,4);
  const row=cold.panel.getByTestId('structure-questions').getByText(/题 21 .*暂缓入库/u);
  for(const [width,height] of [[1366,768],[1920,1080]]){
    await cold.page.setViewportSize({width,height});
    await row.scrollIntoViewIfNeeded();
    await cold.page.screenshot({path:path.join(output,'cold-'+width+'.png'),animations:'disabled'});
  }
  assert.equal(job().generation,current.generation);
  report.providerCalls+=await app.evaluate(()=>globalThis.testRubricRemoteCalls);
  assert.equal(report.providerCalls,0);
  check('The real fourth-page image opens and a cold restart shows the same held question without provider calls');
  report.ok=true;
}catch(error){
  report.error=String(error?.stack||error);
  const page=await app?.firstWindow().catch(()=>null);
  await page?.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});
  throw error;
}finally{
  await app?.close().catch(()=>{});
  fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
  console.log(output);
}
