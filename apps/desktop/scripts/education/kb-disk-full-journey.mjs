import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {_electron} from 'playwright';

const desktop=process.cwd(),output=fs.mkdtempSync(path.join(os.tmpdir(),'omni-disk-full-ui-'));
const folder=path.join(output,'教师资料'),data=path.join(output,'data'),profile=path.join(output,'profile');
fs.mkdirSync(folder);for(let i=0;i<129;i++)fs.writeFileSync(path.join(folder,`${i}.txt`),`第${i}份资料：光在同种均匀介质中沿直线传播。`);
const report={output,checks:[],rendererErrors:[],cloudRequests:0,buildSha256:createHash('sha256').update(fs.readFileSync(path.join(desktop,'out/main/index.js'))).digest('hex'),scope:'Production Electron folder UI, typed preload, actual archive statfs guard, SQLite/files and native restart. Controlled zero-space observation only for this owned resource directory; never fills the real disk. Synthetic text, no cloud, semantic-quality or installer claim.'};
let app,page,batchId;
const sql=(q,p=[])=>{const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});try{return db.prepare(q).all(...p);}finally{db.close();}};
const until=async(fn,ms=180000)=>{const end=Date.now()+ms;while(Date.now()<end){const v=await fn();if(v)return v;await new Promise(r=>setTimeout(r,200));}throw Error('Disk-full UI deadline exceeded');};
async function launch(fault){
  const env={...process.env,OMNI_EDU_DATA_ROOT:data,OMNI_EDU_E2E_DIALOG_MODE:'1',OMNI_EDU_E2E_VISIBLE:'0',OMNI_EDU_XIAOZHI_PI:'1'};
  for(const k of ['ELECTRON_RUN_AS_NODE','NODE_OPTIONS','ELECTRON_RENDERER_URL','DEEPSEEK_API_KEY'])delete env[k];
  app=await _electron.launch({args:[path.join(desktop,'out/main/index.js'),'--user-data-dir='+profile],cwd:output,env,timeout:60000});
  await app.evaluate(({net},{fault,archiveRoot})=>{
    globalThis.diskFullCloud=0;
    for(const object of [globalThis,net])object.fetch=async()=>{globalThis.diskFullCloud++;throw Error('Disk-full fixture blocks cloud');};
    if(fault){const fs=process.getBuiltinModule('node:fs/promises'),statfs=fs.statfs;fs.statfs=async function(target,...args){const info=await statfs.call(this,target,...args);return String(target)===archiveRoot?{...info,bavail:0}:info;};}
  },{fault,archiveRoot:path.join(data,'teacher_resources')});
  page=await app.firstWindow();page.setDefaultTimeout(30000);page.on('pageerror',e=>report.rendererErrors.push(e.message));
  await page.locator('[data-testid="product-nav-materials"]:visible').click();
}
async function close(){if(app){report.cloudRequests+=await app.evaluate(()=>globalThis.diskFullCloud||0);await app.close();app=undefined;}}
async function visual(width,height,name){await app.evaluate(({BrowserWindow},s)=>BrowserWindow.getAllWindows()[0].setContentSize(s.width,s.height),{width,height});await page.waitForFunction(s=>innerWidth===s.width&&innerHeight===s.height,{width,height});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(output,name),fullPage:true});}
try{
  await launch(true);
  await app.evaluate(({dialog},folder)=>{dialog.showOpenDialog=async(_win,options)=>{if(!options.properties.includes('openDirectory'))throw Error('Expected native directory dialog');return{canceled:false,filePaths:[folder]};};},folder);
  await page.getByTestId('materials-import-folder').click();
  const failed=await until(()=>{const row=sql('SELECT * FROM material_import_batches')[0];return row?.status==='failed'?row:undefined;});batchId=failed.id;
  const row=page.getByTestId('material-batch-'+batchId);await row.getByText(/磁盘空间不足/).waitFor();
  assert.equal(await page.getByTestId('batch-resume-'+batchId).count(),0,'Failed batch should offer retry; resume alone skips its failed file');
  await page.getByTestId('batch-retry-'+batchId).waitFor();await page.getByTestId('batch-files-'+batchId).click();
  assert.equal(sql('SELECT COUNT(*) n FROM teacher_resources')[0].n,0);
  assert.equal(sql("SELECT COUNT(*) n FROM material_import_entries WHERE kind='file' AND status='pending'")[0].n,127);
  assert.equal(fs.readdirSync(path.join(data,'teacher_resources')).length,0);
  await visual(1366,768,'disk-full-1366.png');report.checks.push('Native folder action reports disk full, preserves 127 pending entries, creates no original and offers explicit retry');
  await close();await launch(false);assert.equal(sql('SELECT status FROM material_import_batches WHERE id=?',[batchId])[0].status,'failed');
  await page.getByTestId('material-batch-'+batchId).getByText(/磁盘空间不足/).waitFor();
  await page.getByTestId('batch-retry-'+batchId).click();
  await until(()=>sql('SELECT status FROM material_import_batches WHERE id=?',[batchId])[0].status==='completed');
  await until(()=>sql("SELECT COUNT(*) n FROM teacher_resources WHERE parse_status='ready'")[0].n===129);
  for(const r of sql('SELECT original_file_name,local_path,content_hash FROM teacher_resources')){
    const original=fs.readFileSync(path.join(folder,r.original_file_name));assert(original.equals(fs.readFileSync(r.local_path)));assert.equal(createHash('sha256').update(original).digest('hex'),r.content_hash);
  }
  report.checks.push('After real application restart with space restored, the visible retry button completes all 129 original copies and local text parsing');
  await visual(1920,1080,'disk-recovered-1920.png');const before=sql('SELECT id,content_hash,parse_status FROM teacher_resources ORDER BY id');
  await close();await launch(false);assert.deepEqual(sql('SELECT id,content_hash,parse_status FROM teacher_resources ORDER BY id'),before);assert.equal(sql('PRAGMA integrity_check')[0].integrity_check,'ok');
  report.checks.push('Second native restart retains exact 129 resource facts with SQLite integrity ok; both viewport sizes remain reachable');
  assert.equal(report.rendererErrors.length,0);report.success=true;
}catch(error){report.success=false;report.error=String(error.stack||error);process.exitCode=1;}
finally{await close();if(report.cloudRequests){report.success=false;process.exitCode=1;}fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
