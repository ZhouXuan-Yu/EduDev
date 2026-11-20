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

const seed=fs.realpathSync(process.argv[2]),baseline=process.argv.includes('--baseline');
const destination=fs.mkdtempSync(path.join(os.tmpdir(),'edudev-page-first-'));
const data=path.join(destination,'data');
fs.mkdirSync(data);
for(const name of ['teacher_resources','question-ai-assets','question-assets','material-ai-images','word-assets']){
 const original=path.join(seed,name);
 if(fs.existsSync(original))fs.cpSync(original,path.join(data,name),{recursive:true});
}
const filename=path.join(data,'app.db'),seedDb=new DatabaseSync(path.join(seed,'app.db'),{readOnly:true});
try{seedDb.exec("VACUUM INTO '"+filename.replaceAll("'","''")+"'");}finally{seedDb.close();}
const {relocateBackupDatabase}=await import('../../src/main/backup/restore-database.ts');
await relocateBackupDatabase(filename,seed,data,path.join(path.dirname(seed),'XiaozhiOutputs'),path.join(destination,'XiaozhiOutputs'));
const {parseAiPageResponse}=await import('../../src/shared/material-ai-page.ts');
const sha=value=>createHash('sha256').update(value).digest('hex');
const read=(sql,params=[])=>{
 const db=new DatabaseSync(filename,{readOnly:true,timeout:3000});
 try{return db.prepare(sql).all(...params);}finally{db.close();}
};
const interrupted=read(`SELECT u.*,a.resource_id,s.title,s.local_path,r.phase,r.id response_id FROM material_ai_units u
 JOIN material_ai_batches a ON a.id=u.batch_id JOIN teacher_resources s ON s.id=a.resource_id
 JOIN material_ai_response_receipts r ON r.rowid=(SELECT MAX(l.rowid) FROM material_ai_response_receipts l WHERE l.batch_id=u.batch_id AND l.ordinal=u.ordinal)
 WHERE u.status='outcome_unknown' AND u.error='invalid_response' AND r.received_at<>'' AND json_extract(u.input_json,'$.pageSource') IS NOT NULL
 ORDER BY u.batch_id,u.ordinal`);
const first=interrupted.filter(row=>row.phase==='first'),final=interrupted.filter(row=>row.phase==='final');
const expected=new Map([['1aa21140',3],['5656418c',4],['dd8970e8',4]]);
const possible=first.filter(row=>expected.has(row.batch_id.slice(8,16)));
assert.equal(first.length,10);
assert.equal(final.length,5);
assert.equal(possible.length,3);
const [visual]=possible;
const balances=()=>read('SELECT id,calls,config_json FROM material_ai_batches ORDER BY id');
const receipts=()=>read('SELECT * FROM material_ai_response_receipts ORDER BY rowid');
const members=()=>read('SELECT * FROM material_ai_members ORDER BY batch_id,ordinal,number');
const audits=()=>read("SELECT * FROM material_ai_response_recoveries WHERE policy='page-first-response-recovery.v1' ORDER BY response_id");
const storedUnit=row=>read('SELECT * FROM material_ai_units WHERE batch_id=? AND ordinal=?',[row.batch_id,row.ordinal])[0];
const original={balances:balances(),receipts:receipts(),members:members()};
const entry=path.resolve(process.env.OMNI_EDU_TEST_BUILD_ROOT||'out','main/index.js');
const report={destination,baseline,buildSha256:sha(fs.readFileSync(entry)),checks:[],requests:0,rendererErrors:[]};
let app,page;
async function launch(){
 const env={...process.env,OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve('../..'),OMNI_EDU_E2E_VISIBLE:'0',OMNI_EDU_SKIP_DOTENV:'1'};
 for(const name of ['ELECTRON_RUN_AS_NODE','NODE_OPTIONS','ELECTRON_RENDERER_URL','DEEPSEEK_API_KEY'])delete env[name];
 app=await _electron.launch({args:[entry,'--user-data-dir='+path.join(destination,'profile')],env,cwd:destination,timeout:90000});
 await app.evaluate(({net})=>{globalThis.pageProviderAttempts=0;net.fetch=globalThis.fetch=async()=>{
  globalThis.pageProviderAttempts++;throw Error('Receipt recovery must stay on this computer.');
 };});
 page=await app.firstWindow();
 page.setDefaultTimeout(30000);
 page.on('pageerror',error=>report.rendererErrors.push(error.message));
}
async function close(){
 if(!app)return;
 report.requests+=await app.evaluate(()=>globalThis.pageProviderAttempts);
 await app.close();app=undefined;
}
const act=row=>page.evaluate(batchId=>window.omniEdu.controlMaterialAiBatch({schemaVersion:'xiaozhi.material-ai.v1',batchId,action:'recover_response'}),row.batch_id);
const views=row=>page.evaluate(id=>window.omniEdu.getMaterialAiBatches(id,0),row.resource_id);
async function openBatch(row){
 await productEntry(page,'materials').click();
 await page.getByTestId('materials-search').fill(row.title);
 await page.getByTestId('material-'+row.resource_id).getByRole('button').click();
 await page.getByTestId('materials-section-questions').click();
 const panel=page.getByTestId('material-ai-panel');
 await openMaterialDisclosure(panel);
 const batch=panel.locator(`[data-batch-id="${row.batch_id}"]`);
 await batch.waitFor();
 return batch;
}

try{
 await launch();
 const button=(await openBatch(visual)).getByTestId('material-ai-recover-response');
 if(baseline){
  assert.equal(await button.count(),0);
  for(const row of first){await act(row);assert.equal(storedUnit(row).first_json,'');}
  assert.deepEqual(audits(),[]);
  report.checks.push('The old build has no page recovery entry and recovers none of the received first readings');
 }else{
  await button.waitFor();
  const blocked=possible[1],owned=fs.realpathSync(blocked.local_path),relative=path.relative(data,owned);
  assert(relative&&!path.isAbsolute(relative)&&!relative.split(path.sep).includes('..'));
  const bytes=fs.readFileSync(owned),altered=Buffer.from(bytes);
  altered[altered.length-1]^=1;
  try{
   fs.writeFileSync(owned,altered);
   await assert.rejects(()=>act(blocked),/source_changed/);
   assert.equal(storedUnit(blocked).first_json,'');
   assert.deepEqual(audits(),[]);
  }finally{fs.writeFileSync(owned,bytes);}
  await button.click();
  const status=page.locator(`[data-batch-id="${visual.batch_id}"]`).getByTestId('material-ai-recovered-first');
  await status.waitFor();
  assert.match(await status.textContent(),/恢复首稿.*尚待原图复核/);
  let questions=0;
  for(const row of first){
   if(row!==visual)await act(row);
   const count=expected.get(row.batch_id.slice(8,16)),saved=storedUnit(row);
   const audit=audits().find(item=>item.response_id===row.response_id);
   assert(audit);
   if(count){
    assert.equal(saved.status,'first_saved');
    assert.equal(saved.error,'');
    assert.equal(saved.final_json,'');
    assert.equal(saved.input_json,row.input_json);
    assert.equal(parseAiPageResponse(saved.first_json).questions.length,count);
    assert.equal(audit.normalized_sha,sha(saved.first_json));
    const batch=(await views(row)).find(view=>view.id===row.batch_id);
    assert.equal(batch.status,'paused');
    assert(batch.units.find(unit=>unit.ordinal===row.ordinal).responseRecoveredFirst);
    assert.deepEqual(read('SELECT state,error FROM material_folder_ai_units WHERE ai_batch_id=?',[row.batch_id]).map(item=>({...item})),[{state:'review',error:'teacher_paused'}]);
    questions+=count;
   }else{
    assert.equal(saved.status,'failed');
    assert.equal(saved.error,'invalid_response');
    assert.equal(saved.first_json,'');
    assert.equal(audit.error,'invalid_response');
   }
  }
  report.recovered=possible.length;report.held=first.length-possible.length;report.candidates=questions;
  report.checks.push('Real PDF first receipts recover to paused first_saved via the teacher entry; malformed content remains held');
  for(const row of final){await act(row);const after=storedUnit(row);assert.deepEqual({...after},Object.fromEntries(Object.keys(after).map(key=>[key,row[key]])));}
  const written=audits();
  assert.equal(written.length,first.length);
  for(const row of first)await act(row);
  assert.deepEqual(audits(),written);
  await close();await launch();
  for(const row of possible){
   assert.equal(storedUnit(row).status,'first_saved');
   const batch=(await views(row)).find(view=>view.id===row.batch_id);
   assert(batch.units.some(unit=>unit.responseRecoveredFirst));
  }
  assert.deepEqual(audits(),written);
  report.checks.push('Repeat and restart preserve recovery journals, stage boundaries and checks against edits to original files');
 }
 assert.deepEqual(balances(),original.balances);
 assert.deepEqual(receipts(),original.receipts);
 assert.deepEqual(members(),original.members);
 await close();
 assert.equal(report.requests,0);assert.deepEqual(report.rendererErrors,[]);
 report.ok=true;
}catch(error){report.error=error.stack;process.exitCode=1;}
finally{
 await close();fs.writeFileSync(path.join(destination,'report.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify(report));
}
