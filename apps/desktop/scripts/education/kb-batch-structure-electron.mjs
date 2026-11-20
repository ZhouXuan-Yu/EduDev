import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {_electron} from 'playwright';
import {productEntry} from '../product-navigation.mjs';
import {openMaterialDisclosure} from './material-disclosure-ui.mjs';

const seed=fs.realpathSync(process.argv[2]),batchId=process.argv[3],baseline=process.argv.includes('--baseline');
assert.match(batchId,/^batch_[a-f0-9-]{36}$/);
const root=fs.mkdtempSync(path.join(os.tmpdir(),'kb-structure-batch-'));
const data=path.join(root,'data'),profile=path.join(root,'profile');
fs.mkdirSync(data);
for(const name of ['teacher_resources','question-ai-assets','question-assets','material-ai-images','word-assets']){
 const source=path.join(seed,name);
 if(fs.existsSync(source))fs.cpSync(source,path.join(data,name),{recursive:true});
}
const office=process.env.EDU_STRUCTURE_OFFICE_COMPONENT;
if(office){
 const target=path.join(profile,'managed-components',path.basename(office));
 fs.cpSync(office,target,{recursive:true});
}
const filename=path.join(data,'app.db'),sourceDb=new DatabaseSync(path.join(seed,'app.db'),{readOnly:true});
try{sourceDb.exec("VACUUM INTO '"+filename.replaceAll("'","''")+"'");}finally{sourceDb.close();}
const {relocateBackupDatabase}=await import('../../src/main/backup/restore-database.ts');
await relocateBackupDatabase(filename,seed,data,path.join(path.dirname(seed),'XiaozhiOutputs'),path.join(root,'XiaozhiOutputs'));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const read=(sql,values=[])=>{
 const db=new DatabaseSync(filename,{readOnly:true,timeout:3000});
 try{return db.prepare(sql).all(...values);}finally{db.close();}
};
const sourceFiles=read(`SELECT DISTINCT r.id,r.content_hash,r.local_path,r.original_file_name
 FROM material_import_entries e JOIN teacher_resources r ON r.id=e.resource_id WHERE e.batch_id=? AND e.kind='file' AND e.status='saved'`,[batchId]);
assert.equal(sourceFiles.length,221);
assert(sourceFiles.every(file=>fs.statSync(file.local_path).isFile()));
const sourceById=new Map(sourceFiles.map(file=>[file.id,file]));
const protectedFacts=()=>read(`SELECT * FROM question_bank_items WHERE json_valid(archive_json)
 AND (json_extract(archive_json,'$.state')='teacher_edited' OR json_extract(archive_json,'$.sourceChecked')=1) ORDER BY id`);
const bills=()=>read('SELECT id,calls,pause_reason,status FROM material_ai_batches ORDER BY id');
const originalFacts=protectedFacts(),originalBills=bills();
assert(originalFacts.length>0);
const entry=path.resolve(process.env.OMNI_EDU_TEST_BUILD_ROOT||'out','main/index.js');
const report={root,baseline,buildSha256:sha(fs.readFileSync(entry)),checks:[],rendererErrors:[],providerRequests:0};
let app,page;
async function launch(width,height){
 const env={...process.env,OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve('../..'),OMNI_EDU_E2E_VISIBLE:'0',OMNI_EDU_SKIP_DOTENV:'1'};
 for(const key of ['ELECTRON_RUN_AS_NODE','NODE_OPTIONS','ELECTRON_RENDERER_URL','DEEPSEEK_API_KEY'])delete env[key];
 app=await _electron.launch({args:[entry,'--user-data-dir='+profile],env,cwd:root,timeout:90000});
 await app.evaluate(({net})=>{
  globalThis.structureProviderRequests=0;
  for(const owner of [globalThis,net]){
   const fetch=owner.fetch.bind(owner);
   owner.fetch=async(input,options)=>{
    const address=new URL(typeof input==='string'?input:input.url??input.href);
    if(address.hostname==='api.deepseek.com'){
     globalThis.structureProviderRequests++;
     throw Error('Model calls are disabled for this local recovery test.');
    }
    return fetch(input,options);
   };
  }
 });
 page=await app.firstWindow();
 page.on('pageerror',e=>report.rendererErrors.push(e.message));
 await page.setViewportSize({width,height});
 await productEntry(page,'materials').click();
 const batches=page.getByTestId('materials-batches').first();
 if(!await batches.isVisible())await page.getByTestId('materials-queue-toggle').click();
 await openMaterialDisclosure(batches);
 const card=page.getByTestId('material-batch-'+batchId);
 await card.waitFor({timeout:30000});
 return card;
}
async function close(){
 if(!app)return;
 report.providerRequests+=await app.evaluate(()=>globalThis.structureProviderRequests);
 await app.close();
 app=undefined;
}
const request=action=>page.evaluate(({batchId,action})=>window.omniEdu.controlMaterialBatch({schemaVersion:'xiaozhi.material-import-batch.v1',batchId,action}),{batchId,action});
const current=async()=>page.evaluate(async batchId=>(await window.omniEdu.listMaterialBatches({schemaVersion:'xiaozhi.material-import-batch.v1',offset:0})).batches.find(batch=>batch.id===batchId),batchId);
const rows=()=>read('SELECT resource_id,version,state,generation,error FROM material_structure_recovery_items WHERE batch_id=? ORDER BY resource_id',[batchId]);
const scheduled=()=>rows().filter(row=>row.generation);
async function until(read,timeout=240000){
 const end=Date.now()+timeout;
 while(Date.now()<end){
  const found=await read();
  if(found)return found;
  await new Promise(resolve=>setTimeout(resolve,500));
 }
 throw Error('Timed out waiting for structure recovery; see isolated SQLite state.');
}

try{
 const first=await launch(1366,768);
 const button=first.getByTestId('batch-structure-start-'+batchId);
 if(baseline){
  assert.equal(await button.count(),0);
  await assert.rejects(()=>request('structure_start'),/invalid_input/);
  report.checks.push('Old desktop never schedules an existing directory through its public batch action');
 }else{
  const snapshot=await current();
  assert.equal(snapshot.structureAvailable,221);
  assert(!snapshot.structureRecovery);
  await button.click();
  await until(()=>scheduled().length>0);
  assert.equal(rows().length,221);
  assert(rows().every(row=>row.version===sourceById.get(row.resource_id).content_hash));
  await first.getByTestId('batch-structure-pause-'+batchId).click();
  await until(async()=>(await current()).structureRecovery?.state==='paused');
  const firstWave=scheduled();
  const initialGenerations=new Map(firstWave.map(row=>[row.resource_id,row.generation]));
  report.firstWave=firstWave.length;
  assert(firstWave.length>=1&&firstWave.length<sourceFiles.length);
  assert(firstWave.filter(row=>row.state==='active').length<=4);
  await request('structure_start');
  assert.deepEqual(scheduled().map(row=>row.generation),firstWave.map(row=>row.generation));
  await page.screenshot({path:path.join(root,'paused-1366.png'),fullPage:true});
  report.checks.push('Teacher stages 221 distinct originals, pauses after bounded admission and repeated start preserves generations');
  await close();
  const cold=await launch(1920,1080);
  assert.equal((await current()).structureRecovery.state,'paused');
  assert.equal(scheduled().length,firstWave.length);
  await cold.getByTestId('batch-structure-resume-'+batchId).click();
  const began=Date.now();
  await until(()=>{
   const records=scheduled();
   return records.length>firstWave.length&&records.some(row=>['complete','partial'].includes(row.state));
  });
  report.firstPublishedAfterResumeMs=Date.now()-began;
  await cold.getByTestId('batch-structure-pause-'+batchId).click();
  await until(async()=>(await current()).structureRecovery?.state==='paused');
  const final=scheduled();
  for(const [id,generation] of initialGenerations)assert.equal(final.find(row=>row.resource_id===id).generation,generation);
  const published=final.filter(row=>['complete','partial'].includes(row.state));
  for(const row of published){
   assert.equal(sha(fs.readFileSync(sourceById.get(row.resource_id).local_path)),row.version);
   assert(read('SELECT COUNT(*) n FROM material_structure_pages WHERE generation=?',[row.generation])[0].n>0);
  }
  assert.deepEqual(protectedFacts(),originalFacts);
  assert.deepEqual(bills(),originalBills);
  report.progress=(await current()).structureRecovery;
  report.formats=Object.groupBy(published,row=>path.extname(sourceById.get(row.resource_id).original_file_name).toLowerCase());
  report.formats=Object.fromEntries(Object.entries(report.formats).map(([format,items])=>[format,items.length]));
  await page.screenshot({path:path.join(root,'resumed-1920.png'),fullPage:true});
  report.checks.push('Cold restart preserves pause; resume uses the existing parser on actual originals and publishes versioned structure');
 }
 await close();
 assert.equal(report.providerRequests,0);
 assert.deepEqual(report.rendererErrors,[]);
 report.ok=true;
}catch(error){
 report.error=error.stack;process.exitCode=1;
 if(page)await page.screenshot({path:path.join(root,'failure.png'),fullPage:true}).catch(()=>{});
}finally{
 await close();
 fs.writeFileSync(path.join(root,'report.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify(report));
}
