import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {setTimeout as delay} from 'node:timers/promises';
import {_electron as electron} from 'playwright';
import {relocateBackupDatabase} from '../../src/main/backup/restore-database.ts';
import {productEntry} from '../product-navigation.mjs';
import {openMaterialDisclosure} from './material-disclosure-ui.mjs';

const seed=process.argv[2];
assert(seed && path.isAbsolute(seed));
assert(fs.existsSync(path.join(seed,'report.json')));
const seedData=fs.realpathSync(path.join(seed,'data'));
const root=fs.mkdtempSync(path.join(os.tmpdir(),'edudev-folder-structure-wait-'));
const data=path.join(root,'data'),folder=path.join(root,'public-sample'),file=path.join(data,'app.db');
fs.cpSync(seedData,data,{recursive:true,filter:f=>!/(^app\.db(?:-wal|-shm)?$|\.lock$)/.test(path.basename(f))});
const snapshot=new DatabaseSync(path.join(seedData,'app.db'),{readOnly:true});
try{snapshot.exec("VACUUM INTO '"+file.replaceAll("'","''")+"'");}finally{snapshot.close();}
await relocateBackupDatabase(file,seedData,data,path.join(seed,'outputs'),path.join(root,'outputs'));
const sql=(statement,params=[],write=false)=>{
  const db=new DatabaseSync(file,{readOnly:!write});
  try{return write?db.prepare(statement).run(...params):db.prepare(statement).all(...params);}
  finally{db.close();}
};
const sample=sql("SELECT r.id,r.local_path,r.original_file_name,r.content_hash,j.status,j.generation FROM teacher_resources r JOIN material_structure_jobs j ON j.resource_id=r.id WHERE r.original_file_name='native-recovery-two-column.pdf'")[0];
assert.equal(sample.status,'complete');
assert.equal(path.dirname(path.resolve(sample.local_path)),path.join(data,'teacher_resources'));
assert.equal(createHash('sha256').update(fs.readFileSync(sample.local_path)).digest('hex'),sample.content_hash);
const originalPage=sql('SELECT * FROM material_structure_pages WHERE generation=? AND page=1',[sample.generation])[0];
assert(originalPage);
fs.mkdirSync(folder);
fs.copyFileSync(sample.local_path,path.join(folder,sample.original_file_name));

const build=path.resolve(process.env.OMNI_EDU_TEST_BUILD_ROOT||'out'),baseline=process.argv.includes('--baseline');
const env={...process.env,OMNI_EDU_DATA_ROOT:data,OMNI_EDU_E2E_DIALOG_MODE:'1',OMNI_EDU_REPO_ROOT:path.resolve('../..')};
for(const name of ['DEEPSEEK_API_KEY','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL','NODE_OPTIONS'])delete env[name];
let app,page,card,batchId;
const until=async(action,ms=120000)=>{
  const deadline=Date.now()+ms;
  while(Date.now()<deadline){const result=await action();if(result)return result;await delay(300);}
  throw Error('Timed out waiting for the folder queue');
};
async function launch(){
  app=await electron.launch({args:[path.join(build,'main/index.js'),'--user-data-dir='+path.join(root,'profile')],env,timeout:90000});
  await app.evaluate(({net,dialog},dir)=>{
    globalThis.__folderStructureRequests=[];
    const fetch=net.fetch.bind(net);
    net.fetch=async(url,options)=>{
      const target=new URL(String(url));
      if(target.hostname!=='api.deepseek.com')return fetch(url,options);
      if(target.pathname==='/v1/models')return Response.json({object:'list',data:[{
        id:'deepseek-flash',context_window:65536,max_output_tokens:8192,input_modalities:['text','image']
      }]});
      if(target.pathname!=='/chat/completions')throw Error('Unexpected provider route in offline test');
      const payload=JSON.parse(String(options.body));
      globalThis.__folderStructureRequests.push({model:payload.model});
      // Observe the real dispatch boundary locally without sending the PDF or the request.
      return new Response('{"error":{"message":"controlled local response"}}',{status:401});
    };
    dialog.showOpenDialog=async()=>({canceled:false,filePaths:[dir]});
  },folder);
  page=await app.firstWindow();
  await productEntry(page,'materials').click();
}
const view=()=>page.evaluate(id=>window.omniEdu.getMaterialFolderAi({schemaVersion:'xiaozhi.material-folder-ai.v1',batchId:id}),batchId);
const requests=()=>app.evaluate(()=>globalThis.__folderStructureRequests);
async function openCard(){
  const queue=page.getByTestId('materials-queue-toggle');
  if(await queue.getAttribute('aria-expanded')==='false')await queue.click();
  const batches=page.getByRole('button',{name:'文件夹批次与恢复',exact:true});
  if(await batches.getAttribute('aria-expanded')==='false')await batches.click();
  card=page.getByTestId('folder-ai-'+batchId);
  await openMaterialDisclosure(card);
}
try{
  await launch();
  const saved=sql("SELECT value_json FROM app_settings WHERE key='xiaozhi.provider.v1'")[0];
  const settings=await page.evaluate(version=>window.omniEdu.saveXiaozhiSettings({schemaVersion:'xiaozhi.settings.v1',version,defaultModel:'deepseek-flash',apiKey:'offline-folder-structure-fixture'}),saved?JSON.parse(saved.value_json).revision:0);
  assert(settings.ok&&settings.value.configured,settings.error);
  await page.getByTestId('materials-import-folder').click();
  const batch=await until(()=>sql("SELECT id FROM material_import_batches WHERE root_path=? AND status='completed'",[folder])[0]);
  batchId=batch.id;
  const entries=sql("SELECT resource_id FROM material_import_entries WHERE batch_id=? AND status='saved' AND kind='file'",[batchId]);
  assert.deepEqual(entries.map(e=>e.resource_id),[sample.id]);
  assert.equal(sql("UPDATE material_structure_jobs SET status='running' WHERE resource_id=? AND generation=?",[sample.id,sample.generation],true).changes,1);
  await openCard();
  await card.getByTestId('folder-ai-open-authorization').click();
  await card.getByTestId('folder-ai-budget').fill('3');
  await card.getByTestId('folder-ai-public').check();
  await card.getByTestId('folder-ai-consent').check();
  await card.getByTestId('folder-ai-authorize').click();
  const waiting=await until(async()=>{const v=await view();return v&&(v.waiting||v.review)?v:undefined;});
  if(baseline){
    assert.equal(waiting.review,1);assert.equal(waiting.waiting,0);
    assert.equal(waiting.issues[0].error,'source_incomplete');
  }else{
    assert.equal(waiting.status,'running');assert.equal(waiting.waiting,1);assert.equal(waiting.review,0);
    await until(async()=>/1 等待或处理中/.test(await card.getByTestId('folder-ai-counts').textContent()));
    const materialSettings=await page.evaluate(()=>window.omniEdu.getMaterialAiSettings());
    await assert.rejects(page.evaluate(input=>window.omniEdu.createMaterialAiBatch(input),{
      schemaVersion:'xiaozhi.material-ai.v1',resourceId:sample.id,version:sample.content_hash,
      start:1,count:1,maxCalls:3,settingsRevision:materialSettings.revision,
      images:true,cloudConsent:true,publicMaterial:true,processingMode:'quality'
    }),/structure_pending/);
  }
  assert.equal(waiting.calls,0);assert.equal(waiting.reserved,0);assert.equal((await requests()).length,0);
  if(!baseline)await card.getByTestId('folder-ai-pause').click();
  if(!baseline)await until(async()=>(await view())?.status==='paused');
  await app.close();app=undefined;
  assert.equal(sql("UPDATE material_structure_jobs SET status='complete' WHERE resource_id=? AND generation=?",[sample.id,sample.generation],true).changes,1);
  await launch();
  if(!baseline){
    const cold=await view();
    assert.equal(cold.status,'paused');assert.equal(cold.waiting,1);assert.equal(cold.reserved,0);
    await openCard();
    await card.getByTestId('folder-ai-resume').click();
    await until(async()=>(await requests()).length===1);
    const plan=sql('SELECT b.config_json,u.input_json FROM material_ai_task_keys k JOIN material_ai_batches b ON b.id=k.batch_id JOIN material_ai_units u ON u.batch_id=b.id WHERE k.folder_id=?',[batchId]);
    assert.equal(plan.length,1);
    const input=JSON.parse(plan[0].input_json),config=JSON.parse(plan[0].config_json);
    assert.equal(config.start,1);assert.equal(input.pageSource.version,sample.content_hash);
    assert.equal(input.pagePrompt.structureContext.reference.generation,sample.generation);
    assert.equal(input.pagePrompt.structureContext.supplemental.length,1);
    assert.deepEqual(await requests(),[{model:'deepseek-flash'}]);
  }else{
    await delay(3000);
    assert.equal((await view()).review,1);
    assert.equal((await requests()).length,0);
  }
  assert.deepEqual(sql('SELECT * FROM material_structure_pages WHERE generation=? AND page=1',[sample.generation])[0],originalPage);
  console.log(JSON.stringify({ok:true,baseline,root,waiting:waiting.waiting,review:waiting.review,
    coldResume:!baseline,localIntercepts:(await requests()).length,externalRequests:0}));
}catch(error){
  console.error(JSON.stringify({ok:false,baseline,root,batchId,error:String(error)}));
  await page?.screenshot({path:path.join(root,'failure.png')}).catch(()=>{});
  throw error;
}finally{await app?.close();}
