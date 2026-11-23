import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {_electron} from 'playwright';
import {assertIsolatedPiMain,testMain} from '../acceptance/build-root.mjs';

const acceptance=process.env.OMNI_EDU_ACCEPTANCE_ROOT;
assert(acceptance);
const root=fs.mkdtempSync(path.join(acceptance,'folder-selection-'));
const data=path.join(root,'data'),profile=path.join(root,'profile'),source=path.join(root,'source');
const desktop=path.resolve(import.meta.dirname,'../..'),main=testMain(desktop);
const schemaVersion='xiaozhi.material-import-batch.v1';
const sha=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const report={ok:false,root,mainSha:sha(main),checks:[],rendererErrors:[]};
fs.mkdirSync(path.join(source,'子目录'),{recursive:true});
for(let i=1;i<=22;i++){
 const dir=i>19?path.join(source,'子目录'):source;
 fs.writeFileSync(path.join(dir,`试读资料${String(i).padStart(2,'0')}.md`),`# 合成教学资料 ${i}\n这是一份用于核对本地批量选择的合成课文。`);
}
fs.writeFileSync(path.join(source,'跳过.zip'),'unsupported test fixture');
let app,page;
const check=name=>{report.checks.push(name);console.log(`PASS ${name}`);};
async function until(read,timeout=60000){
 const deadline=Date.now()+timeout;
 while(Date.now()<deadline){const value=await read();if(value)return value;await new Promise(resolve=>setTimeout(resolve,150));}
 throw Error('Observation deadline');
}
function read(sql,...values){
 const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true,timeout:5000});
 try{return db.prepare(sql).all(...values);}finally{db.close();}
}
const state=id=>read('SELECT status,phase,owner_pid,selection_json FROM material_import_batches WHERE id=?',id)[0];
const entries=id=>read("SELECT relative_path,status FROM material_import_entries WHERE batch_id=? AND kind='file' ORDER BY relative_path",id);
const modal=()=>page.getByTestId('material-import-selection');

async function launch(width,height){
 const env={...process.env,OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_SKIP_DOTENV:'1',OMNI_EDU_E2E_VISIBLE:'0'};
 for(const name of ['DEEPSEEK_API_KEY','NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL'])delete env[name];
 app=await _electron.launch({args:[main,'--user-data-dir='+profile],cwd:desktop,env,timeout:60000});
 await assertIsolatedPiMain(app,main,profile);
 await app.evaluate(({net})=>{
  globalThis.materialExternalCalls=0;
  for(const target of [globalThis,net])target.fetch=async()=>{globalThis.materialExternalCalls++;throw Error('Local material acceptance forbids network');};
 });
 page=await app.firstWindow();page.setDefaultTimeout(60000);
 page.on('pageerror',error=>report.rendererErrors.push(error.message));
 await page.setViewportSize({width,height});
 await page.locator('[data-testid="nav-knowledge"]:visible').click();
 await page.getByTestId('materials-select-folder').waitFor();
}

async function chooseFolder(){
 await app.evaluate(({dialog},dir)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[dir]});},source);
 await page.getByTestId('materials-select-folder').click();
 await modal().getByRole('button',{name:'全选所有文件'}).waitFor();
 return until(()=>read("SELECT id FROM material_import_batches WHERE status='selecting' AND owner_pid=0 ORDER BY created_at DESC LIMIT 1")[0]?.id);
}

async function revealBatches(){
 for(const id of ['materials-queue-toggle','materials-batches']){
  const container=page.getByTestId(id);
  const toggle=id==='materials-batches'?container.getByRole('button',{name:'文件夹批次与恢复'}):container;
  if(await toggle.getAttribute('aria-expanded')!=='true')await toggle.click();
 }
}

try{
 await launch(1366,768);
 const id=await chooseFolder();
 assert.equal(await modal().getByRole('checkbox').count(),20);
 assert.match(await modal().textContent(),/已选 22 \/ 22/);
 assert.equal(await modal().getByRole('checkbox').first().evaluate(input=>getComputedStyle(input.parentElement).display),'grid');
 assert(await modal().getByRole('button',{name:'导入 22 个文件'}).evaluate(button=>button.getBoundingClientRect().bottom<=innerHeight));
 assert.equal(read('SELECT COUNT(*) n FROM teacher_resources')[0].n,0);
 assert(entries(id).some(row=>row.status==='skipped'&&row.relative_path==='跳过.zip'));
 const forge={schemaVersion,batchId:id,mode:'only',paths:['不存在.pdf']};
 assert.match(await page.evaluate(async request=>{
  try{await window.omniEdu.selectMaterialBatch(request);return 'accepted';}catch(e){return String(e);}
 },forge),/selection_changed/);
 assert.equal(state(id).status,'selecting');
 check('Folder preview enumerates nested supported files without archiving or accepting an unknown path');
 await page.screenshot({path:path.join(root,'selection-1366x768.png')});
 await modal().getByRole('button',{name:'稍后选择'}).click();
 await app.close();app=undefined;

 await launch(1920,1080);
 assert.equal(state(id).status,'selecting');
 assert.equal(read('SELECT COUNT(*) n FROM teacher_resources')[0].n,0);
 await revealBatches();await page.getByTestId(`batch-choose-${id}`).click();
 await modal().getByRole('button',{name:'清空选择'}).click();
 assert(await modal().getByRole('button',{name:'导入 0 个文件'}).isDisabled());
 const selected=[];
 for(const pageNumber of [0,1]){
  if(pageNumber)await modal().getByRole('button',{name:'下一页'}).click();
  const checkbox=modal().getByRole('checkbox').first();
  await checkbox.check();
  selected.push(await checkbox.locator('xpath=..').locator('span').textContent());
 }
 assert.equal(new Set(selected).size,2);
 await page.screenshot({path:path.join(root,'selection-1920x1080.png')});
 await modal().getByRole('button',{name:'导入 2 个文件'}).click();
 await until(()=>['completed','partial'].includes(state(id)?.status));
 assert.deepEqual(JSON.parse(state(id).selection_json).sort(),selected.sort());
 assert.deepEqual(entries(id).filter(row=>row.status==='saved').map(row=>row.relative_path).sort(),selected);
 assert.equal(read('SELECT COUNT(*) n FROM teacher_resources')[0].n,2);
 check('Cold start resumes selection, and confirmation archives only two checked files across pages');

 const second=await chooseFolder();
 await modal().getByRole('button',{name:'放弃本批'}).click();
 await until(()=>state(second)?.status==='canceled');
 assert.equal(read('SELECT COUNT(*) n FROM teacher_resources')[0].n,2);
 assert(entries(second).every(row=>row.status!=='saved'));
 check('Discarding the second import leaves its originals outside the library');

 const [row]=read('SELECT id FROM teacher_resources ORDER BY id');
 await page.getByTestId(`material-${row.id}`).getByRole('button').click();
 await page.getByTestId('materials-organize').click();
 const panel=page.getByTestId('material-ai-panel');
 await panel.getByTestId('material-ai-create').waitFor({state:'visible'});
 assert(await panel.getByTestId('material-ai-create').isDisabled());
 assert.equal(await panel.getByTestId('material-ai-consent').isChecked(),false);
 assert.equal(await app.evaluate(()=>globalThis.materialExternalCalls),0);
 check('The single-document start button opens the existing scoped form without submitting or calling AI');
 await page.screenshot({path:path.join(root,'manual-ai-entry.png')});
 assert.deepEqual(report.rendererErrors,[]);
 report.ok=true;
}catch(error){
 report.error=error.stack;console.error(error);
 await page?.screenshot({path:path.join(root,'failure.png')}).catch(()=>{});
 process.exitCode=1;
}finally{
 await app?.close();
 fs.writeFileSync(path.join(root,'report.json'),JSON.stringify(report,null,2));
 console.log(root);
}
