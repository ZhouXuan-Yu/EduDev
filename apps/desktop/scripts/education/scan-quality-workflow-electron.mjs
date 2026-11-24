import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {_electron} from 'playwright';
import {productEntry} from '../product-navigation.mjs';
import {assertIsolatedPiMain,testMain} from '../acceptance/build-root.mjs';
import {openMaterialDisclosure} from './material-disclosure-ui.mjs';
import {windowsOcrMetrics} from '../acceptance/windows-ocr-metrics.mjs';

const root=process.env.OMNI_EDU_ACCEPTANCE_ROOT;
const files=JSON.parse(process.env.OMNI_EDU_SCAN_WORKFLOW_FILES??'[]');
const multiRow=process.argv.includes('--multiple-choice-rows');
assert(root&&files.length===(multiRow?3:2)&&files.every(file=>path.isAbsolute(file)&&fs.statSync(file).isFile()));
const output=fs.mkdtempSync(path.join(root,'mixed-workflow-'));
const data=path.join(output,'data');
const profile=path.join(output,'profile');
const desktop=path.resolve(import.meta.dirname,'../..');
const main=testMain(desktop);
const sha=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const report={ok:false,output,mainSha256:sha(main),documents:files.map(file=>({name:path.basename(file),sha256:sha(file)})),checks:[],providerCalls:0};
const check=text=>{report.checks.push(text);console.log('PASS '+text);};
let app;
const measureResources=process.argv.includes('--measure-resources');

function sql(query,args=[]){
  const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true,timeout:5000});
  try{return db.prepare(query).all(...args);}finally{db.close();}
}
async function launch(){
  const env={...process.env,OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),
    OMNI_EDU_E2E_VISIBLE:'0',OMNI_EDU_SKIP_DOTENV:'1',OMNI_EDU_XIAOZHI_PI:'1'};
  for(const key of ['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL','DEEPSEEK_API_KEY'])delete env[key];
  app=await _electron.launch({args:[main,'--user-data-dir='+profile],cwd:desktop,env,timeout:60000});
  await assertIsolatedPiMain(app,main,profile);
  await app.evaluate(({net})=>{
    globalThis.scanProviderCalls=0;
    for(const owner of [globalThis,net]){
      const fetch=owner.fetch.bind(owner);
      owner.fetch=async(input,options)=>{
        const address=new URL(typeof input==='string'?input:input.url??input.href);
        if(address.hostname==='api.deepseek.com'){
          globalThis.scanProviderCalls++;
          throw Error('This test uses local OCR only');
        }
        return fetch(input,options);
      };
    }
  });
  const page=await app.firstWindow();
  await productEntry(page,'materials').click();
  return page;
}
async function close(){
  if(!app)return;
  report.providerCalls+=await app.evaluate(()=>globalThis.scanProviderCalls);
  await app.close();
  app=undefined;
}
async function waitForJobs(){
  const end=Date.now()+420000;
  let jobs=[];
  let nextSample=0;
  while(Date.now()<end){
    jobs=sql('SELECT * FROM material_structure_jobs ORDER BY resource_id');
    if(jobs.some(job=>['failed','cancelled'].includes(job.status)))throw Error(JSON.stringify(jobs));
    if(jobs.length===files.length&&jobs.every(job=>['complete','partial'].includes(job.status)))return jobs;
    if(measureResources&&Date.now()>=nextSample){
      const at=Date.now();
      const processes=await app.evaluate(({app})=>app.getAppMetrics().map(m=>({pid:m.pid,type:m.type,workingSetKiB:m.memory.workingSetSize})));
      const native=await windowsOcrMetrics(processes.map(process=>process.pid));
      report.resources.samples.push({at,processes,native,jobStates:jobs.map(job=>job.status)});
      nextSample=at+4000;
    }
    await new Promise(resolve=>setTimeout(resolve,1000));
  }
  throw Error('Background import did not publish all sources: '+JSON.stringify(jobs));
}
async function panel(page,source){
  await page.getByTestId('materials-search').fill(source.title);
  await page.getByTestId('material-'+source.id).getByRole('button').click();
  await page.getByTestId('materials-section-questions').click();
  const target=page.getByTestId('material-structure-panel');
  await openMaterialDisclosure(target);
  return target;
}

try{
  const page=await launch();
  await app.evaluate(({dialog},paths)=>{
    const saved=dialog.showOpenDialog;
    dialog.showOpenDialog=async()=>{dialog.showOpenDialog=saved;return {canceled:false,filePaths:paths};};
  },files);
  const started=Date.now();
  if(measureResources)report.resources={started,samples:[],sampleIntervalMs:4000};
  await page.getByTestId('materials-import').click();
  const jobs=await waitForJobs();
  report.importMs=Date.now()-started;
  const sources=sql('SELECT id,title,local_path,content_hash FROM teacher_resources');
  assert.equal(sources.length,files.length);
  assert(jobs.every(job=>job.engine==='layout-paragraph-question.v30'&&job.processed===job.pages));
  assert.deepEqual(sources.map(source=>sha(source.local_path)).sort(),report.documents.map(doc=>doc.sha256).sort());
  check('One file-picker action stages the scans and the regular background parser publishes versioned results');

  const [real,controlled,multi]=report.documents.map(doc=>sources.find(source=>source.content_hash===doc.sha256));
  const job=source=>jobs.find(entry=>entry.resource_id===source.id);
  const questions=source=>sql('SELECT body_json FROM material_structure_questions WHERE generation=? ORDER BY rowid',[job(source).generation])
    .map(row=>JSON.parse(row.body_json));
  const realQuestions=questions(real);
  assert.equal(realQuestions.filter(q=>q.kind==='question'&&q.number!=='0').length,21);
  assert.deepEqual(realQuestions.filter(q=>q.formulaSources?.length).map(q=>q.number),['15','21']);
  const table=realQuestions.find(q=>q.number==='15').tableSources?.[0];
  assert.deepEqual(table?.rows.map(row=>row.length),[8,8]);
  const realRecheck=realQuestions.find(q=>q.number==='15')?.choiceRecheck;
  assert.deepEqual(realRecheck?.choices,[
    {label:'A',status:'single_read',readings:['0']},
    {label:'B',status:'unreadable',readings:[]},
  ]);
  const alternate=questions(controlled);
  report.jobs=jobs.map(({resource_id,generation,engine,status,processed,questions,held})=>({resource_id,generation,engine,status,processed,questions,held}));
  report.alternate=alternate.map(({number,section,options,expectedChoiceCount,issues,status})=>({number,section,
    choices:options.map(option=>option.label),expectedChoiceCount,issues,status}));
  assert(alternate.find(q=>q.number==='7')?.issues.includes('missing_choice_options'));
  assert(alternate.find(q=>q.number==='8')?.issues.includes('missing_choice_options'));
  const clipped=alternate.find(q=>q.number==='7').choiceRecheck;
  assert.deepEqual(clipped?.choices,[
    {label:'C',status:'unreadable',readings:[]},
    {label:'D',status:'unreadable',readings:[]},
  ]);
  assert(alternate.filter(q=>q.number!=='7').every(q=>!q.choiceRecheck));
  report.choiceRechecks={real:realRecheck,negativeControl:clipped};
  const intact=alternate.find(q=>q.number==='9');
  assert.deepEqual(intact?.options.map(option=>option.label),[...'ABCD']);
  assert(!intact.issues.includes('missing_choice_options'));
  assert(alternate.filter(q=>['10','11'].includes(q.number)).every(q=>!q.issues.includes('missing_choice_options')));
  const secondTable=alternate.find(q=>q.number==='10')?.tableSources?.[0];
  assert.deepEqual(secondTable?.rows.map(row=>row.map(cell=>cell.text)),
    [['第一天','第二天','第三天'],['123','456','789']]);
  assert(secondTable.rows.flat().every(cell=>!cell.needsReview));
  report.tables={original:{rows:table.rows.length,columns:table.rows[0].length},
    independent:{rows:secondTable.rows.length,columns:secondTable.rows[0].length}};
  check('The new source independently detects trailing omissions and skipped labels while retaining the complete choice and free-response items');

  if(multiRow){
    const rows=questions(multi);
    report.multipleRows=rows.map(({number,issues,status,choiceRecheck})=>({number,issues,status,choiceRecheck}));
    assert.deepEqual(rows.filter(row=>row.issues.includes('missing_choice_options')).map(row=>row.number),['1','2','3']);
    assert.deepEqual(rows.filter(row=>row.choiceRecheck).map(row=>row.number),['1','2']);
    for(const row of rows.filter(row=>row.choiceRecheck)){
      assert.equal(row.status,'needs_review');
      assert.deepEqual(row.choiceRecheck.choices.map(item=>[item.label,item.status]),[['A','unreadable'],['B','unreadable']]);
    }
    assert.deepEqual(rows.find(row=>row.number==='4')?.options.map(option=>option.label),[...'ABCD']);
    assert.equal(rows.find(row=>row.number==='4')?.status,'candidate');
    check('The actual local OCR rechecks both earlier eligible rows within one scanned page while a complete item is admitted normally');
  }

  await page.setViewportSize({width:1366,height:768});
  const realPanel=await panel(page,real);
  await realPanel.getByTestId('structure-review-overview-toggle').click();
  let formula=realPanel.getByTestId('structure-review-overview-formulas');
  assert.match(await formula.textContent(),/公式 2 题 · 第 2 页/u);
  await formula.click();
  await realPanel.getByText('第 2 页',{exact:true}).waitFor();
  formula=realPanel.getByTestId('structure-review-overview-formulas');
  assert.match(await formula.textContent(),/第 4 页/u);
  await formula.scrollIntoViewIfNeeded();
  await page.screenshot({path:path.join(output,'formula-overview-1366.png'),animations:'disabled'});
  await formula.click();
  await realPanel.getByText('第 4 页',{exact:true}).waitFor();
  check('Whole-document review routes to two distinct formula pages without manual paging');
  await close();

  const cold=await launch();
  await cold.setViewportSize({width:1920,height:1080});
  const scan=await panel(cold,controlled);
  await scan.getByTestId('structure-review-overview-toggle').click();
  await scan.getByTestId('structure-review-overview').getByRole('button',{name:/选项 2 题/u}).waitFor();
  const short=scan.getByTestId('structure-questions').locator('article').filter({hasText:/题 7 .*暂缓入库/u});
  await short.getByTestId('structure-review-open').click();
  await short.getByTestId('structure-review-choice-evidence').getByText('待核对选项 C、D',{exact:true}).waitFor();
  assert.deepEqual(await short.getByTestId('structure-review-choice-recheck').getByRole('listitem').allTextContents(),['C 未读清','D 未读清']);
  if(multiRow){
    await short.getByTestId('structure-review-cancel').click();
    const multiple=await panel(cold,multi);
    const second=multiple.getByTestId('structure-questions').locator('article').filter({hasText:/题 2 .*暂缓入库/u});
    await second.getByTestId('structure-review-open').click();
    const readings=second.getByTestId('structure-review-choice-recheck').getByRole('listitem');
    await readings.first().waitFor();
    assert.deepEqual(await readings.allTextContents(),['A 未读清','B 未读清']);
    await cold.screenshot({path:path.join(output,'second-recheck-1920.png'),animations:'disabled'});
  }
  assert.equal(sql('SELECT COUNT(*) n FROM material_structure_reviews')[0].n,0);
  assert.deepEqual(sql('SELECT generation FROM material_structure_jobs ORDER BY resource_id').map(row=>row.generation),jobs.map(job=>job.generation));
  await close();
  assert.equal(report.providerCalls,0);
  check('Cold start shows the same typed review reasons and never records a teacher confirmation or calls a model');
  report.ok=true;
}catch(error){
  report.error=String(error?.stack??error);
  const page=await app?.firstWindow().catch(()=>null);
  await page?.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});
  throw error;
}finally{
  await close().catch(()=>{});
  fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
  console.log(output);
}
