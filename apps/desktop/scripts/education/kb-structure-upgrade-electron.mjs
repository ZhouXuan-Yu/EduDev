import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {_electron as electron} from 'playwright';
import {DOCUMENT_STRUCTURE_ENGINE} from '../../src/shared/material-document-structure.ts';
import {relocateBackupDatabase} from '../../src/main/backup/restore-database.ts';
import {productEntry} from '../product-navigation.mjs';
import {openMaterialDisclosure} from './material-disclosure-ui.mjs';

const original=fs.realpathSync(process.argv[2]);
assert(path.basename(original).startsWith('kb-section-replay-'));
const source=path.join(original,'data');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'kb-batch-upgrade-'));
const data=path.join(root,'data'),profile=path.join(root,'profile');
const hash=value=>createHash('sha256').update(value).digest('hex');
const file=path.join(data,'app.db');
fs.mkdirSync(data);
for(const name of ['teacher_resources','question-assets','cache']){
  const folder=path.join(source,name);
  if(fs.existsSync(folder))fs.cpSync(folder,path.join(data,name),{recursive:true});
}
const seed=new DatabaseSync(path.join(source,'app.db'),{readOnly:true});
try{seed.exec("VACUUM INTO '"+file.replaceAll("'","''")+"'");}finally{seed.close();}
await relocateBackupDatabase(file,source,data,path.join(original,'XiaozhiOutputs'),path.join(root,'XiaozhiOutputs'));

function read(sql,...args){
  const db=new DatabaseSync(file,{readOnly:true,timeout:5000});
  try{return db.prepare(sql).all(...args);}finally{db.close();}
}
const resources=read('SELECT id,content_hash,local_path,original_file_name FROM teacher_resources');
assert.equal(resources.length,1);
const [resource]=resources;
assert.equal(hash(fs.readFileSync(resource.local_path)),resource.content_hash);
const job=()=>read('SELECT * FROM material_structure_jobs WHERE resource_id=?',resource.id)[0];
const before=job();
assert.equal(before.engine,'layout-paragraph-question.v14');
assert.equal(before.status,'partial');
const oldPages=()=>read('SELECT page,body_json,image_json,sha256 FROM material_structure_pages WHERE generation=? ORDER BY page',before.generation);
const archivedPages=oldPages();
assert(archivedPages.length>1);
const question=(number,available=true)=>read("SELECT * FROM question_bank_items q WHERE json_extract(archive_json,'$.number')=? "+
  (available?'AND NOT EXISTS(SELECT 1 FROM material_structure_hidden_questions h WHERE h.question_id=q.id) ':'')+
  'ORDER BY rowid DESC LIMIT 1',number)[0];
const oldDraft=question('6');
assert.equal(oldDraft.answer,'');
const incoming=path.join(root,'2022年上海中考数学');
const subdir=path.join(incoming,'同一原件');
fs.mkdirSync(subdir,{recursive:true});
fs.copyFileSync(resource.local_path,path.join(incoming,resource.original_file_name));
fs.copyFileSync(resource.local_path,path.join(subdir,resource.original_file_name));
const main=path.resolve(process.env.OMNI_EDU_TEST_BUILD_ROOT||'out','main/index.js');
const report={root,buildSha:hash(fs.readFileSync(main)),rendererErrors:[],networkRequests:0};
let app,page;
async function launch(width,height){
  const env={...process.env};
  for(const key of Object.keys(env))if(/KEY|TOKEN|SECRET|CREDENTIAL/i.test(key)||key.startsWith('OMNI_EDU_')||['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL'].includes(key))delete env[key];
  Object.assign(env,{OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve('../..'),OMNI_EDU_E2E_DIALOG_MODE:'1',OMNI_EDU_E2E_VISIBLE:'0',OMNI_EDU_SKIP_DOTENV:'1'});
  app=await electron.launch({args:[main,'--user-data-dir='+profile,'--host-resolver-rules=MAP * ~NOTFOUND'],env,cwd:root,timeout:90000});
  await app.evaluate(({net})=>{
    globalThis.upgradeNetworkRequests=0;
    globalThis.fetch=net.fetch=async()=>{globalThis.upgradeNetworkRequests++;throw Error('Local-only upgrade test');};
  });
  page=await app.firstWindow();
  page.setDefaultTimeout(45000);
  page.on('pageerror',error=>report.rendererErrors.push(error.message));
  await page.setViewportSize({width,height});
}
async function close(){
  if(!app)return;
  report.networkRequests+=await app.evaluate(()=>globalThis.upgradeNetworkRequests);
  await app.close();
  app=undefined;
}
async function until(resolve,timeout=240000){
  const end=Date.now()+timeout;
  while(Date.now()<end){
    const result=await resolve();
    if(result)return result;
    await new Promise(next=>setTimeout(next,300));
  }
  throw Error('The local batch upgrade did not reach its expected state');
}
async function questionCard(id,query){
  await productEntry(page,'teaching').click();
  await page.getByRole('button',{name:'题本',exact:true}).filter({visible:true}).click();
  await page.getByTestId('question-notebook-search').fill(query);
  const card=page.getByTestId('question-notebook-card-'+id);
  await card.waitFor();
  return card;
}
async function batchCard(id){
  await productEntry(page,'materials').click();
  const queue=page.getByTestId('materials-batches').first();
  if(!await queue.isVisible())await page.getByTestId('materials-queue-toggle').click();
  await openMaterialDisclosure(queue);
  const card=page.getByTestId('material-batch-'+id);
  await card.waitFor();
  return card;
}
try{
  await launch(1366,768);
  const teacher=question('5');
  const card=await questionCard(teacher.id,'逆命题');
  await card.getByTestId('question-archive-edit-'+teacher.id).click();
  await card.getByTestId('question-archive-answer').fill('A');
  await card.getByTestId('question-archive-analysis').fill('按定义交换命题的题设和结论，可以写出它的逆命题。');
  await card.getByTestId('question-archive-difficulty').selectOption('medium');
  await card.getByTestId('question-archive-source-checked').check();
  await card.getByTestId('question-archive-save').click();
  await card.getByTestId('question-archive-form').waitFor({state:'hidden'});
  const protectedRow=question('5');
  assert.equal(protectedRow.id,teacher.id);
  assert.equal(JSON.parse(protectedRow.archive_json).sourceChecked,true);
  assert.equal(protectedRow.answer,'A');
  await productEntry(page,'materials').click();
  await app.evaluate(({dialog},folder)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[folder]});},incoming);
  await page.getByTestId('materials-import-folder').click();
  const batch=await until(()=>read("SELECT id FROM material_import_batches WHERE root_path=? AND status='completed'",incoming)[0]);
  const members=read("SELECT resource_id FROM material_import_entries WHERE batch_id=? AND kind='file' AND status='saved'",batch.id);
  assert.equal(members.length,2);
  assert(members.every(row=>row.resource_id===resource.id));
  const directory=await batchCard(batch.id);
  const upgrade=directory.getByTestId('batch-structure-upgrade-'+batch.id);
  await upgrade.getByText('升级 1 份旧版结构',{exact:true}).waitFor();
  assert.equal(job().generation,before.generation);
  await page.screenshot({path:path.join(root,'upgrade-1366.png')});
  const began=Date.now();
  await upgrade.click();
  const completed=await until(()=>{
    const active=job();
    const recovery=read('SELECT * FROM material_structure_recovery_items WHERE batch_id=?',batch.id)[0];
    if(recovery?.state==='failed')throw Error('Upgrade failed: '+recovery.error);
    const draft=question('6');
    if(active?.engine===DOCUMENT_STRUCTURE_ENGINE&&recovery?.state==='partial'&&draft?.answer==='C')
      return {generation:active.generation,draftId:draft.id};
  });
  report.publishMs=Date.now()-began;
  assert.notEqual(completed.generation,before.generation);
  assert.notEqual(completed.draftId,oldDraft.id);
  assert.deepEqual(question('5'),protectedRow);
  assert.equal(read('SELECT answer FROM question_bank_items WHERE id=?',oldDraft.id)[0].answer,'');
  assert.deepEqual(oldPages(),archivedPages);
  assert.equal(hash(fs.readFileSync(resource.local_path)),resource.content_hash);
  await upgrade.waitFor({state:'hidden'});
  await close();

  await launch(1920,1080);
  const after=await batchCard(batch.id);
  await after.getByTestId('batch-structure-counts-'+batch.id).getByText(/部分完成 1/).waitFor();
  assert.equal(await after.getByTestId('batch-structure-upgrade-'+batch.id).count(),0);
  assert.deepEqual(question('5'),protectedRow);
  await page.screenshot({path:path.join(root,'complete-1920.png')});
  const restored=await questionCard(completed.draftId,'自身重合');
  await restored.getByTestId('question-original-open').click();
  await restored.getByText(/第 7 页 · 答案出处/).waitFor();
  await close();
  assert.deepEqual(report.rendererErrors,[]);
  assert.equal(report.networkRequests,0);
  Object.assign(report,{ok:true,physicalFiles:members.length,distinctOriginals:1,oldEngine:before.engine,
    newEngine:DOCUMENT_STRUCTURE_ENGINE,protectedQuestion:protectedRow.id,preservedOldPages:archivedPages.length,...completed});
}catch(error){
  report.error=String(error.stack||error);
  if(page)await page.screenshot({path:path.join(root,'failure.png')}).catch(()=>{});
  process.exitCode=1;
}finally{
  await close();
  fs.writeFileSync(path.join(root,'report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report));
}
