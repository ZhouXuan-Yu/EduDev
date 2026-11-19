import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {_electron as electron} from 'playwright';
import {productEntry} from '../product-navigation.mjs';

const runtime=path.resolve(process.argv[2]??'out'), data=fs.realpathSync(process.env.EDU_NOTEBOOK_TEST_DATA);
const baseline=process.argv.includes('--baseline');
assert.equal(path.basename(data),'data');
assert.equal(path.basename(path.dirname(data)),'flow-1gb-20261111');
const reportDir=fs.mkdtempSync(path.resolve('test-results','notebook-rank-'));
const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});
const batch='aibatch_905bfe20-82d3-42c8-8cad-3c393f2e227e';
const target=db.prepare("SELECT q.id,q.stem FROM material_ai_members m JOIN question_bank_items q ON q.id=m.question_id WHERE m.batch_id=? AND m.ordinal=1 AND m.number='2'").get(batch);
assert(target?.stem);
const query=target.stem.slice(0,24);
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const signature=()=>hash(JSON.stringify(db.prepare('SELECT * FROM question_bank_items ORDER BY id').all()));
const paid=()=>db.prepare('SELECT SUM(calls) n FROM material_ai_batches').get().n;
assert.equal(db.prepare("SELECT count(*) n FROM material_ai_batches WHERE status IN ('running','pending')").get().n,0);
assert.equal(db.prepare("SELECT count(*) n FROM material_folder_ai WHERE status='running'").get().n,0);
const before=signature(), paidBefore=paid();
const env={...process.env,OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve('../..'),OMNI_EDU_E2E_DIALOG_MODE:'1',OMNI_EDU_E2E_VISIBLE:'0',OMNI_EDU_XIAOZHI_PI:'1'};
for(const key of ['DEEPSEEK_API_KEY','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL','NODE_OPTIONS'])delete env[key];
const entry=path.join(runtime,'main','index.js');
let app;
try {
 app=await electron.launch({args:[entry,'--user-data-dir='+path.join(reportDir,'profile')],env,cwd:process.cwd(),timeout:90000});
 const page=await app.firstWindow();
 const errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 const measured=await page.evaluate(async ({query,target})=>{
   const fetch=(offset=0)=>window.omniEdu.listQuestionNotebook({query,showSourceCandidates:true,limit:20,offset});
   const first=await fetch(),second=await fetch(20);
   const timings=[];
   for(let i=0;i<30;i++){const time=performance.now();await fetch();timings.push(performance.now()-time);}
   timings.sort((a,b)=>a-b);
   let rank;
   for(let offset=0;offset<first.total&&!rank;offset+=20){const current=offset===0?first:offset===20?second:await fetch(offset);const item=current.items.findIndex(q=>q.id===target);if(item>=0)rank=offset+item+1;}
   return {rank,total:first.total,first:first.items.map(x=>x.id),second:second.items.map(x=>x.id),p50:timings[14],p95:timings[28]};
 },{query,target:target.id});
 assert(measured.rank,'The true result must be in the recall set');
 assert(measured.total>20);
 assert.equal(new Set([...measured.first,...measured.second]).size,Math.min(40,measured.total));
 if(baseline)assert(measured.rank>20);
 else{
  assert(measured.rank<=3);
  await productEntry(page,'teaching').click();
  await page.getByRole('button',{name:'题本',exact:true}).click();
  await page.getByTestId('question-notebook-filter-toggle').click();
  await page.getByTestId('question-notebook-source-candidates').check();
  await page.getByTestId('question-notebook-search').fill(query);
  const item=page.getByTestId('question-notebook-card-'+target.id);
  await item.waitFor({timeout:45000});
  await item.getByTestId('question-original-open').click();
  const gallery=item.getByTestId('question-original-image');
  await gallery.nth(1).waitFor({timeout:45000});
 }
 let syntheticChecks=0;
 if(!baseline){
  // Exercise public IPC independently of the historic natural fixture.
  await app.close();app=undefined;
  const syntheticData=path.join(reportDir,'synthetic-data');
  fs.mkdirSync(syntheticData);
  app=await electron.launch({args:[entry,'--user-data-dir='+path.join(reportDir,'synthetic-profile')],env:{...env,OMNI_EDU_DATA_ROOT:syntheticData},cwd:process.cwd(),timeout:90000});
  const testPage=await app.firstWindow();testPage.on('pageerror',error=>errors.push(error.message));
  const fixture=await testPage.evaluate(async()=>{
   const api=window.omniEdu;
   const phrase='比较同一物体两次测得的加速度 1.5 m/s²';
   const seed={subject:'物理',grade:'初二',knowledgePoint:'加速度',questionType:'计算题',difficulty:'medium',answer:'自行计算',sourceTitle:'验收样例'};
   const exact=await api.createQuestionBankItem({...seed,stem:phrase+'，求速度差。'});
   const distractor=await api.createQuestionBankItem({...seed,stem:'比较两次测量中的加速度 1．5 m/s²。',analysis:phrase});
   const other=await api.createQuestionBankItem({...seed,subject:'数学',stem:phrase});
   await api.setQuestionNotebookBookmark({questionId:distractor.id,bookmarked:true});
   const category=await api.createQuestionNotebookCategory({name:'排名测试'});
   await api.addQuestionNotebookCategory(distractor.id,category.id);
   const filtered={query:phrase,subject:'物理',limit:1};
   const [first,second,short,browse,foreign,categorized]=await Promise.all([
    api.listQuestionNotebook(filtered),
    api.listQuestionNotebook({...filtered,offset:1}),
    api.listQuestionNotebook({query:'加速',subject:'物理',bookmarked:true}),
    api.listQuestionNotebook({subject:'物理'}),
    api.listQuestionNotebook({query:phrase,subject:'数学'}),
    api.listQuestionNotebook({query:phrase,categoryId:category.id})
   ]);
   return {exact:exact.id,distractor:distractor.id,other:other.id,first:first.items[0]?.id,second:second.items[0]?.id,total:first.total,short:short.items.map(q=>q.id),browse:browse.items[0]?.id,foreign:foreign.items.map(q=>q.id),categorized:categorized.items.map(q=>q.id)};
  });
  assert.equal(fixture.first,fixture.exact,'Exact stem precedes a newer bookmark and analysis-only phrase');
  assert.equal(fixture.total,2);
  assert.equal(fixture.second,fixture.distractor);
  assert.deepEqual(fixture.short,[fixture.distractor]);
  assert.equal(fixture.browse,fixture.distractor);
  assert.deepEqual(fixture.foreign,[fixture.other]);
  assert.deepEqual(fixture.categorized,[fixture.distractor]);
  syntheticChecks=7;
 }
 assert.deepEqual(errors,[]);
 assert.equal(signature(),before);
 assert.equal(paid(),paidBefore);
 const {first,second,...results}=measured;
 const report={ok:true,baseline,mainSha256:hash(fs.readFileSync(entry)),...results,samples:30,syntheticChecks,visibleOriginalGallery:!baseline,addedCalls:0};
 fs.writeFileSync(path.join(reportDir,'summary.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify(report));
}finally{await app?.close();db.close();}
