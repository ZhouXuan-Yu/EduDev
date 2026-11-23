import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
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
assert(!fs.existsSync(oldDb+'-wal')||!fs.statSync(oldDb+'-wal').size);
fs.cpSync(original,data,{recursive:true,filter:file=>!/app\.db-(wal|shm)$/u.test(file)});
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
assert.equal(old.engine,'layout-paragraph-question.v17');
assert.equal(oldPages.length,4);
assert(!oldQuestions.some(row=>JSON.parse(row.body_json).number==='20'));
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
async function goToFourth(panel){
  for(let index=1;index<4;index++){
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
  assert.equal(current.engine,'layout-paragraph-question.v18');
  assert.deepEqual(pages(old.generation),oldPages);
  assert.deepEqual(questionRows(old.generation),oldQuestions);
  assert.deepEqual(confirmed(),teacherBefore);
  assert.equal(shaFile(source.local_path),source.content_hash);
  check('The existing UI rebuild publishes v18 while the original scan, previous snapshots and confirmed items stay intact');

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
  await goToFourth(first.panel);
  await first.panel.getByTestId('structure-questions').getByText(/题 20 .*暂缓入库/u).waitFor();
  await first.panel.getByRole('button',{name:'对照原始页图'}).click();
  const image=first.panel.getByTestId('structure-source-image');
  await image.waitFor();
  assert(await image.evaluate(node=>node.complete&&node.naturalWidth>0));
  report.providerCalls+=await app.evaluate(()=>globalThis.testRubricRemoteCalls);
  await app.close();
  app=undefined;

  const cold=await open();
  await goToFourth(cold.panel);
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
