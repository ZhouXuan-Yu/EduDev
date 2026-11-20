import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {_electron as electron} from 'playwright';
import {productEntry} from '../product-navigation.mjs';
import {openMaterialDisclosure} from './material-disclosure-ui.mjs';

assert(process.env.EDU_GRADE_SEED, 'Set EDU_GRADE_SEED to an existing local knowledge-base data directory');
const seed=fs.realpathSync(process.env.EDU_GRADE_SEED);
const root=fs.mkdtempSync(path.join(os.tmpdir(),'edudev-grade-search-'));
const data=path.join(root,'data');
fs.mkdirSync(data);
for(const name of ['teacher_resources','material-ai-images','question-ai-assets','question-assets','word-assets','cache/semantic-v1']){
  const source=path.join(seed,name);
  if(fs.existsSync(source))fs.cpSync(source,path.join(data,name),{recursive:true,filter:file=>!path.basename(file).endsWith('.lock')});
}
const file=path.join(data,'app.db');
const old=new DatabaseSync(path.join(seed,'app.db'),{readOnly:true});
try {old.exec("VACUUM INTO '"+file.replaceAll("'","''")+"'");} finally {old.close();}
const writer=new DatabaseSync(file);
const readCalls=db=>db.prepare('SELECT COALESCE(SUM(calls),0) n FROM material_ai_batches').get().n;
const snapshots=[];
try {
  assert.equal(writer.prepare("SELECT count(*) n FROM material_ai_batches WHERE status='running'").get().n,0);
  const setPath=writer.prepare('UPDATE teacher_resources SET local_path=? WHERE id=?');
  for(const row of writer.prepare('SELECT id,local_path FROM teacher_resources').all()){
    const relative=path.relative(seed,row.local_path);
    assert(relative && !relative.startsWith('..')&&!path.isAbsolute(relative));
    setPath.run(path.join(data,relative),row.id);
  }
  const find=writer.prepare(`SELECT id,grade,source_title,stem,answer,analysis
    FROM question_bank_items WHERE subject='物理' AND grade='高三' AND knowledge_point=?`);
  for(const term of ['光子能量与光的频率','静电场中的等势面']){
    const [row]=find.all(term);
    assert(row);
    snapshots.push({term,row:{...row}});
  }
} finally {writer.close();}
const read=new DatabaseSync(file,{readOnly:true});
const calls=readCalls(read);
const baseline=process.argv.includes('--baseline');
const build=path.resolve(process.env.OMNI_EDU_TEST_BUILD_ROOT||'out');
const env={...process.env,OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve('../..'),
  OMNI_EDU_E2E_DIALOG_MODE:'1',DEEPSEEK_API_KEY:''};
for(const key of ['ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL','NODE_OPTIONS'])delete env[key];
let app;
try {
  app=await electron.launch({args:[path.join(build,'main/index.js'),'--user-data-dir='+path.join(root,'profile')],env,timeout:90000});
  const page=await app.firstWindow();
  page.setDefaultTimeout(20000);
  await productEntry(page,'teaching').click();
  await page.getByRole('button',{name:'题本',exact:true}).click();
  await page.getByTestId('question-notebook-filter-toggle').click();
  await page.getByTestId('question-notebook-filter-subject').fill('物理');
  const grade=page.getByTestId('question-notebook-filter-grade');
  const results=[];
  for(const {term,row} of snapshots){
    const card=page.getByTestId('question-notebook-card-'+row.id);
    await page.getByTestId('question-notebook-filter-knowledgePoint').fill(term);
    await page.getByTestId('question-notebook-search').fill(term);
    await grade.fill('高三');
    await card.waitFor();
    const begin=performance.now();
    await grade.fill('高中三年级');
    if(baseline)await page.getByTestId('question-notebook-no-results').waitFor();
    else await card.waitFor();
    const keyword=await page.evaluate(({term})=>window.omniEdu.listQuestionNotebook({query:term,subject:'物理',grade:'高中三年级',knowledgePoint:term}),{term});
    assert.equal(keyword.items.some(item=>item.id===row.id),!baseline);
    const keywordMs=Math.round(performance.now()-begin);
    await grade.fill('高二');
    await page.getByTestId('question-notebook-no-results').waitFor();
    await grade.fill('高中三年级');
    const panel=page.getByTestId('question-notebook-semantic-toggle');
    await openMaterialDisclosure(panel);
    await panel.getByTestId('question-semantic-query').fill(term);
    const hybridBegin=performance.now();
    await panel.getByTestId('question-semantic-submit').click();
    await panel.getByTestId('question-semantic-coverage').waitFor({timeout:60000});
    const hybridMs=Math.round(performance.now()-hybridBegin);
    if(baseline)assert(await panel.getByText('当前没有找到可用候选，请调整条件或等待整理完成。').isVisible());
    else await panel.getByTestId('question-semantic-hit').filter({hasText:row.source_title}).first().waitFor();
    const explicit=await page.evaluate(term=>window.omniEdu.searchQuestionsByMeaning({query:term,subject:'物理',grade:'高3',knowledgePoint:term,limit:10}),term);
    assert.equal(explicit.questions.some(item=>item.id===row.id),!baseline);
    assert(explicit.semantic?.available,'Use the real local semantic runtime');
    const nativeCandidate=explicit.questions.some(item=>item.id===row.id&&item.matchReason.startsWith('按题意'));
    assert.equal(nativeCandidate,!baseline);
    results.push({term,keywordReturned:keyword.items.length,hybridReturned:explicit.questions.length,keywordMs,hybridMs,
      semanticAvailable:true,nativeCandidate});
  }
  assert.equal(readCalls(read),calls);
  const rowById=read.prepare('SELECT id,grade,source_title,stem,answer,analysis FROM question_bank_items WHERE id=?');
  for(const {row} of snapshots)assert.deepEqual({...rowById.get(row.id)},row);
  console.log(JSON.stringify({ok:true,baseline,results,paidCalls:0,root}));
} finally {
  read.close();
  await app?.close();
}
