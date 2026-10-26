import fs from 'node:fs';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {setTimeout as delay} from 'node:timers/promises';
import {DatabaseSync} from 'node:sqlite';
import {_electron} from 'playwright';
const desktop=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),output=fs.mkdtempSync(path.join(tmpdir(),'omni-edu-folder-search-'));
const folder=path.join(output,'教师资料'),data=path.join(output,'data'),profile=path.join(output,'profile');fs.mkdirSync(folder);
fs.mkdirSync(path.join(folder,'章节一'));fs.mkdirSync(path.join(folder,'章节二'));
for(let i=0;i<150;i++)fs.writeFileSync(path.join(folder,i%2?'章节一':'章节二','课题-'+i+'.md'),'# 课题'+i+'\n\n一元一次方程。移项时变号，等式两边同时运算。');
fs.writeFileSync(path.join(folder,'长教材.txt'),'教材正文。'.repeat(22000)+'\n末章压轴：二次函数顶点与 x² 的关系。');
fs.writeFileSync(path.join(folder,'跳过.zip'),'not an archive');
let app,page;const report={output,checks:[],rendererErrors:[],scope:'Real teacher folder/SQLite/FTS flow, isolated local synthetic files; no provider or installer run'};
const note=name=>{report.checks.push(name);console.log('PASS '+name);};
async function until(fn,timeout=90000){const end=Date.now()+timeout;while(Date.now()<end){const result=await fn();if(result)return result;await delay(150);}throw Error('Timed out');}
async function launch(){const env={...process.env,OMNI_EDU_DATA_ROOT:data};for(const key of Object.keys(env))if(key.startsWith('OMNI_EDU_E2E_')||['ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL','NODE_OPTIONS'].includes(key))delete env[key];
 env.OMNI_EDU_E2E_DIALOG_MODE='1';env.OMNI_EDU_E2E_VISIBLE='0';env.OMNI_EDU_XIAOZHI_PI='1';
 app=await _electron.launch({args:[path.join(desktop,'out/main/index.js'),'--user-data-dir='+profile],cwd:output,env,timeout:60000});page=await app.firstWindow();page.on('pageerror',e=>report.rendererErrors.push(e.message));await page.setViewportSize({width:1366,height:768});await page.locator('[data-testid="product-nav-materials"]:visible').click();await page.getByTestId('materials-import-folder').waitFor();}
const batches=()=>page.evaluate(()=>window.omniEdu.listMaterialBatches({schemaVersion:'xiaozhi.material-import-batch.v1',offset:0}));
try{
 await launch();await app.evaluate(({dialog},folder)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[folder]});},folder);
 await page.getByTestId('materials-import-folder').click();const batch=await until(async()=>{const p=await batches();return p.batches[0];});
 await page.getByTestId('batch-pause-'+batch.id).click();await until(async()=>(await batches()).batches[0].status==='paused');note('Teacher chooses a nested folder once and pauses its persistent archive batch');
 await app.close();app=undefined;await launch();assert.equal((await batches()).batches[0].status,'paused');note('Manual pause survives app restart');
 await page.getByTestId('batch-resume-'+batch.id).click();await app.close();app=undefined;await launch();
 const done=await until(async()=>{const row=(await batches()).batches[0];return ['completed','partial','failed'].includes(row.status)?row:null;},180000);
 assert.equal(done.status,'completed',JSON.stringify(done));assert.equal(done.archived,151);assert.equal(done.failed,0);assert.equal(done.skipped,1);note('Resume then exit automatically continues after restart; 151 files archived, unsupported file skipped');
 await until(async()=>{const status=await page.evaluate(()=>window.omniEdu.getMaterialIndexStatus());return status.pending===0&&status.indexed>80;},90000);
 if(await page.locator('[data-testid="product-nav-materials"]:visible').getAttribute('aria-current')!=='page')await page.locator('[data-testid="product-nav-materials"]:visible').click();
 await page.getByTestId('materials-text-query').fill('末章压轴');await page.getByTestId('materials-text-submit').click();
 const hit=page.locator('[data-testid^="material-text-hit-"]').first();await hit.waitFor({timeout:90000});await hit.click();
 await page.getByTestId('materials-detail').getByText(/末章压轴/, {exact:false}).waitFor();note('Teacher searches the complete long-text tail and opens its actual saved source');
 await page.screenshot({path:path.join(output,'folder-and-tail-search.png'),fullPage:true});
 const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});try{
  assert.equal(db.prepare('SELECT COUNT(*) n FROM teacher_resources').get().n,151);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM material_import_entries WHERE status='saved'").get().n,151);
  const long=db.prepare("SELECT r.id,COUNT(c.id) chunks FROM teacher_resources r JOIN resource_chunks c ON c.resource_id=r.id WHERE r.original_file_name='长教材.txt' GROUP BY r.id").get();assert(long.chunks>80);
 }finally{db.close();}
 assert.deepEqual(report.rendererErrors,[]);report.success=true;note('SQLite readback has no replay duplicates and retains more than 80 long-text chunks');
}catch(e){report.success=false;report.error=String(e.stack||e);process.exitCode=1;if(page)await page.screenshot({path:path.join(output,'failure.png'),fullPage:true}).catch(()=>{});}
finally{if(app)await app.close();fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
