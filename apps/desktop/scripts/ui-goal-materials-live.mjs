/** Parent runs AFTER its unified build: node scripts/ui-goal-materials-live.mjs
 * No build, model calls, credentials, seeded SQLite or replacement preview/OCR host.
 * Only the native file-picker is substituted, as in golden-teacher-journeys.
 * A failed/unavailable local parser is a recorded failure, never mocked success.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {_electron as electron} from 'playwright';
import {testMain,assertIsolatedPiMain} from './acceptance/build-root.mjs';
import {fingerprint,sha256} from './acceptance/evidence.mjs';
import {productEntry} from './product-navigation.mjs';

const desktop=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const fixture=path.resolve(process.env.OMNI_EDU_MATERIALS_FIXTURE||'D:/WorkProject/小智智能体借鉴项目/_ui-review-runtime/20261101/buoyancy-review.pdf');
const base=path.join(desktop,'test-results/ui-goal-20261101/materials-live');
fs.mkdirSync(base,{recursive:true});
const output=fs.mkdtempSync(path.join(base,'run-'));
const isolated=fs.mkdtempSync(path.join(os.tmpdir(),'edudev-materials-live-'));
const data=path.join(isolated,'data'),profile=path.join(isolated,'profile');
fs.mkdirSync(data);fs.mkdirSync(profile);
const control=path.join(output,'catalog-control.txt');
fs.writeFileSync(control,'Synthetic catalogue control only. edudevcontrolbody identifies the TXT body. No student facts.\n');
const started=Date.now(),deadline=started+160000;
const report={suite:'U2-materials-real-isolated-UI',success:false,command:'node scripts/ui-goal-materials-live.mjs',
  maxWorkMs:160000,checks:[],screens:[],launches:[],console_errors:[],page_errors:[],errors:[],dialogSelections:[],
  fixture:{file:fixture},isolated:{data,profile},output,humanAccepted:false,
  boundaries:['UI import/save only; SQLite read-only. No fake resource/chunk/reading rows.',
    'Native picker substitution only; real typed IPC, original PNG host, parser, local index and reading persistence.',
    'Keyword search only; no semantic/model request or AI restoration is started.',
    'No scan/OCR quality claim: record actual parser engine/status; an unavailable PDF body fails dependent checks.',
    'Two actual formats exercise the global catalogue scope; unloaded-page and large-library coverage belongs to the separate catalogue suite.',
    'Light theme only; both native content sizes, real hover/focus captures; not human visual acceptance.']};
let app,page,mainFile,buildBefore,resource,chunks=[],stage='bootstrap',aborted=false,timer;
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const redact=value=>String(value).replace(/sk-[A-Za-z0-9_-]+/g,'[credential]').replace(/Bearer\s+\S+/gi,'Bearer [credential]').slice(0,1600);
const flush=()=>fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
const remaining=()=>{if(aborted||Date.now()>=deadline)throw Error('160-second work budget exhausted');return deadline-Date.now();};
const timeout=(max=10000)=>Math.max(1,Math.min(max,remaining()));
const tid=id=>page.getByTestId(id);
const visible=id=>page.locator(`[data-testid="${id}"]:visible`);
function read(query,args=[]){
  assert(/^\s*SELECT\b/i.test(query),'SQL must be SELECT-only');
  const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});
  try{return db.prepare(query).all(...args);}finally{db.close();}
}
async function until(predicate,label,max=10000){
  const end=Date.now()+Math.min(max,remaining());
  while(Date.now()<end){remaining();if(await predicate())return;await delay(100);}
  throw Error('Timed out: '+label);
}
async function click(id){await visible(id).click({timeout:timeout()});}
async function capture(label){
  const file=String(report.screens.length+1).padStart(2,'0')+'-'+label+'.png';
  await page.screenshot({path:path.join(output,file),animations:'disabled',timeout:timeout(5000)});
  const viewport=await page.evaluate(()=>({width:innerWidth,height:innerHeight}));
  report.screens.push({file,label,viewport,elapsedMs:Date.now()-started});flush();
}
async function step(name,run,available=true){
  if(aborted)return false;
  stage=name;
  if(!available){report.checks.push({name,status:'not_run',reason:'Required PDF body/previous UI step unavailable'});flush();return false;}
  try{remaining();await run();report.checks.push({name,status:'pass'});flush();return true;}
  catch(error){
    report.checks.push({name,status:'fail',message:redact(error)});report.errors.push({stage,message:redact(error)});flush();
    if(!aborted&&page&&!page.isClosed()&&deadline-Date.now()>3000){
      try{await capture('failure-'+name);}catch(captureError){report.errors.push({stage:'failure-capture',message:redact(captureError)});}
    }
    return false;
  }
}
const env={...process.env};
for(const key of Object.keys(env))if(/KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL/i.test(key)||key.startsWith('OMNI_EDU_')||['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL'].includes(key))delete env[key];
Object.assign(env,{NODE_ENV:'development',OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_E2E_DIALOG_MODE:'1'});

async function launch(){
  app=await electron.launch({args:[mainFile,'--user-data-dir='+profile,'--force-device-scale-factor=1'],cwd:desktop,env,timeout:timeout(25000)});
  page=await app.firstWindow({timeout:timeout(20000)});page.setDefaultTimeout(10000);
  page.on('pageerror',error=>report.page_errors.push({stage,message:redact(error.message)}));
  page.on('console',message=>{if(message.type()==='error')report.console_errors.push({stage,message:redact(message.text())});});
  // Never auto-accept an unexpected destructive confirmation.
  page.on('dialog',dialog=>{report.errors.push({stage,message:'Unexpected JS dialog: '+redact(dialog.message())});void dialog.dismiss();});
  await tid('xiaozhi-pi-workspace').waitFor({state:'visible',timeout:timeout(25000)});
  const evidence=await assertIsolatedPiMain(app,mainFile,profile);
  assert.equal(path.resolve(await page.evaluate(()=>window.omniEdu.getDataRoot())),path.resolve(data));
  report.launches.push({pid:app.process().pid,...evidence});
  await page.emulateMedia({colorScheme:'light'});
  await resize(1366,768);
}
async function close(){
  const owned=app;if(!owned)return;app=undefined;
  let closeTimer;
  try{await Promise.race([owned.close(),new Promise((_,reject)=>{closeTimer=setTimeout(()=>reject(Error('Owned Electron close timeout')),5000);})]);}
  catch(error){report.errors.push({stage:'close',message:redact(error)});if(owned.process().exitCode===null)owned.process().kill();}
  finally{clearTimeout(closeTimer);}
}
async function resize(width,height){
  const win=await app.browserWindow(page);
  await win.evaluate((browserWindow,size)=>{browserWindow.setContentSize(size.width,size.height);browserWindow.webContents.setBackgroundThrottling(false);},{width,height});
  await until(async()=>page.evaluate(size=>innerWidth===size.width&&innerHeight===size.height,{width,height}),'native content size');
}
async function home(){await productEntry(page,'materials').click({timeout:timeout()});await tid('materials-workspace').waitFor({state:'visible',timeout:timeout()});}
async function importFile(file){
  // The same one-shot OS selection seam as workbench-ui/nativeSelection and golden journeys.
  await app.evaluate(({dialog},selected)=>{
    const original=dialog.showOpenDialog.bind(dialog);
    dialog.showOpenDialog=async(...args)=>{
      dialog.showOpenDialog=original;
      if(args.at(-1)?.properties?.includes('openDirectory'))throw Error('Expected file picker, got folder picker');
      return {canceled:false,filePaths:[selected]};
    };
  },file);
  report.dialogSelections.push({file,kind:'file'});
  await click('materials-import');
  await until(()=>read('SELECT id FROM teacher_resources WHERE original_file_name=?',[path.basename(file)]).length===1,'real import resource row',15000);
  await until(()=>visible('materials-import').isEnabled(),'import UI unlock',10000);
}
async function selectPdf(){
  await click('materials-mode-catalog');
  await tid('materials-search').fill('',{timeout:timeout()});
  await tid('materials-filters').getByTestId('materials-filter-format').selectOption('',{timeout:timeout()});
  await tid('materials-filters').getByTestId('materials-filter-state').selectOption('',{timeout:timeout()});
  await until(async()=>(await tid('materials-count').innerText()).startsWith('2 份资料'),'cleared global catalogue contains both imported files');
  await click('material-'+resource.id);
  await until(()=>tid('materials-detail').getAttribute('data-resource-id').then(id=>id===resource.id),'selected PDF detail');
}
async function section(id){await click('materials-section-'+id);assert.equal(await tid('materials-section-'+id).getAttribute('aria-pressed'),'true');}
function importedBytes(row,file){
  const local=fs.realpathSync(row.local_path);
  assert(local.startsWith(fs.realpathSync(data)+path.sep),'Imported copy must stay in owned data root');
  const expected=sha256(fs.readFileSync(file));assert.equal(row.content_hash,expected);assert.equal(sha256(fs.readFileSync(local)),expected);
  assert.equal(row.file_size,fs.statSync(file).size);return {resourceId:row.id,sha256:expected};
}
function bodyToken(){
  const text=chunks.map(chunk=>chunk.content_md).join('\n');
  const names=read('SELECT title,original_file_name FROM teacher_resources').map(row=>row.title+' '+row.original_file_name).join(' ').toLowerCase();
  const candidates=['density','displaced','pressure','Archimedes','浮力','测力计','浸没','示数','排开','密度','阿基米德',...(text.match(/[A-Za-z]{4,}/g)||[])];
  const token=candidates.find(word=>text.toLowerCase().includes(word.toLowerCase())&&!names.includes(word.toLowerCase()));
  assert(token,'Real PDF body must contain a searchable token absent from catalog names');return token;
}
async function work(){
  const boot=await step('isolated-formal-launch',async()=>{
    assert(fs.existsSync(fixture),'Missing synthetic PDF fixture: '+fixture);
    assert(fs.readFileSync(fixture).subarray(0,5).toString()==='%PDF-','Fixture must be real PDF bytes');
    report.fixture.sha256=sha256(fs.readFileSync(fixture));
    mainFile=testMain(desktop);buildBefore=fingerprint(path.dirname(path.dirname(mainFile)));
    report.build={mainFile,sha256:buildBefore.sha256};report.scriptSha256=sha256(fs.readFileSync(fileURLToPath(import.meta.url)));
    await launch();await home();assert.equal(read('SELECT count(*) n FROM teacher_resources')[0].n,0);
  });
  if(!boot)return;
  const imported=await step('UI-import-PDF-and-format-control',async()=>{
    await importFile(fixture);await importFile(control);
    resource=read('SELECT * FROM teacher_resources WHERE original_file_name=?',[path.basename(fixture)])[0];
    report.imported=[importedBytes(resource,fixture),importedBytes(read('SELECT * FROM teacher_resources WHERE original_file_name=?',[path.basename(control)])[0],control)];
    assert.equal(read('SELECT count(*) n FROM teacher_resources')[0].n,2);
  });
  if(!imported)return;
  const parsed=await step('actual-local-PDF-parsing',async()=>{
    try{
      await until(()=>{
        resource=read('SELECT * FROM teacher_resources WHERE id=?',[resource.id])[0];
        chunks=read('SELECT * FROM resource_chunks WHERE resource_id=? ORDER BY chunk_index,id',[resource.id]);
        if(resource.parse_status==='failed')throw Error('Real PDF parser failed: '+JSON.stringify(resource));
        return ['ready','partial'].includes(resource.parse_status)&&chunks.some(chunk=>chunk.content_md?.trim());
      },'real local PDF text, without cloud/model',55000);
    }finally{report.localParse={resource,chunks:chunks.length,actualEngine:resource.parse_engine||null};}
    await click('materials-refresh');await selectPdf();
  });
  await step('current-page-format-filter',async()=>{
    await selectPdf();const filter=tid('materials-filters').getByTestId('materials-filter-format');
    const txt=read('SELECT id FROM teacher_resources WHERE original_file_name=?',[path.basename(control)])[0];
    await until(()=>tid('material-'+txt.id).isVisible(),'both formats on same catalog page');
    await filter.selectOption('PDF',{timeout:timeout()});
    await until(async()=>await tid('material-'+resource.id).isVisible()&&await tid('material-'+txt.id).count()===0
      &&(await tid('materials-count').innerText()).startsWith('1 份资料'),'global PDF scope completed');
    assert((await tid('materials-count').innerText()).includes('1 / 1'));
    await filter.selectOption('TXT',{timeout:timeout()});
    await until(async()=>await tid('material-'+txt.id).isVisible()&&await tid('material-'+resource.id).count()===0
      &&(await tid('materials-count').innerText()).startsWith('1 份资料'),'global TXT scope completed');
    await filter.selectOption('',{timeout:timeout()});
    await until(async()=>(await tid('materials-count').innerText()).startsWith('2 份资料'),'global clear restores both files');
    assert.equal(read('SELECT count(*) n FROM teacher_resources')[0].n,2,'Filtering must not remove source records');
    await click('material-'+resource.id);
  });
  await step('catalog-vs-body-keyword-search',async()=>{
    await selectPdf();const token=bodyToken();report.searchToken=token;
    await tid('materials-search').fill(token,{timeout:timeout()});
    await until(async()=>{const text=await tid('materials-count').innerText();return text.startsWith('0 份资料')&&!text.includes('读取');},'catalog does not search body text');
    assert.equal(await tid('material-'+resource.id).count(),0);
    await click('materials-mode-text');await tid('materials-search-mode').selectOption('keyword',{timeout:timeout()});
    await tid('materials-text-query').fill(token,{timeout:timeout()});
    await until(async()=>{
      await click('materials-text-submit');await tid('materials-text-results').waitFor({timeout:timeout(3000)});
      return await page.locator('[data-testid^="material-text-hit-"]:visible').count()>0;
    },'actual local FTS index catches up',12000);
    const hitIds=await page.locator('[data-testid^="material-text-hit-"]:visible').evaluateAll(nodes=>nodes.map(node=>node.dataset.testid));
    assert(hitIds.some(id=>chunks.some(chunk=>id==='material-text-hit-'+chunk.id)),'Search result must reference this real PDF chunk');
    report.searchHitIds=hitIds;await selectPdf();
  },parsed);
  const sections=await step('six-detail-sections-and-visited-panels',async()=>{
    await selectPdf();
    const destinations={overview:'materials-overview',original:null,content:parsed?'materials-body-location':null,questions:'materials-question-detail',notes:parsed?'material-study':null,advanced:'materials-processing-detail'};
    for(const [id,marker] of Object.entries(destinations)){await section(id);if(marker)await visible(marker).waitFor({timeout:timeout()});}
    const node=await tid('materials-question-detail').elementHandle();await section('overview');
    assert(await node.evaluate(el=>el.isConnected&&el.hidden),'Visited question panel must remain mounted and hidden');
    if(parsed){await section('notes');const note=await tid('material-study-note').elementHandle();await section('overview');assert(await note.evaluate(el=>el.isConnected),'Visited reading panel stays mounted');}
  });
  const preview=await step('real-original-page-PNG-host',async()=>{
    await selectPdf();await section('original');
    if(await visible('materials-original-open').count())await click('materials-original-open');
    await until(async()=>{
      if(await visible('materials-original-error').count())throw Error(await visible('materials-original-error').innerText());
      return tid('materials-original-image').evaluateAll(nodes=>nodes.some(node=>node.complete&&node.naturalWidth>0));
    },'real host PNG loads',15000);
    report.originalImage=await tid('materials-original-image').evaluate(img=>({width:img.naturalWidth,height:img.naturalHeight,protocol:img.src.split(':')[0]}));
    await capture('original-page-1366');
  },sections);
  await step('two-size-native-hover-focus',async()=>{
    for(const [width,height] of [[1366,768],[1920,1080]]){
      await resize(width,height);await section('overview');
      const item=visible('materials-section-content');await item.hover({timeout:timeout()});await capture('section-hover-'+width);
      await item.focus({timeout:timeout()});assert(await item.evaluate(el=>document.activeElement===el));await capture('section-focus-'+width);
      if(preview){await section('original');await capture('original-page-'+width);}
    }
    await resize(1366,768);
  },sections);
  const note='合成验收阅读笔记：先核对浮力、排水体积和单位。本条仅用于隔离 UI 冷启动验收。';
  const saved=await step('unsaved-note-switch-and-native-settings-guard',async()=>{
    await section('notes');await tid('material-study-note').waitFor({state:'visible',timeout:timeout()});
    await until(()=>tid('material-study-note').isEnabled(),'actual reading loads');
    await tid('material-study-note').fill(note,{timeout:timeout()});
    await until(()=>tid('materials-section-overview').isDisabled(),'reading dirty disables detail switch');
    const before=read('SELECT * FROM material_reading_entries WHERE resource_id=?',[resource.id]);assert.equal(before.length,0);
    // Unforced DOM click is captured by the real reading guard, then real native IPC bypasses DOM.
    await productEntry(page,'settings').click({timeout:timeout()});
    assert(await tid('materials-workspace').isVisible());assert((await tid('material-study-error').innerText()).includes('尚未保存'));
    // Invoke the real registered native menu item, including its production send closure.
    // No synthetic renderer event or replacement IPC handler.
    await app.evaluate(({Menu})=>{const item=Menu.getApplicationMenu()?.getMenuItemById('settings');if(!item?.enabled)throw Error('Real native Settings menu unavailable');item.click();});
    await until(()=>tid('desktop-navigation-notice').isVisible(),'native settings visibly blocked');
    assert(await tid('materials-workspace').isVisible());assert.equal(await tid('material-study-note').inputValue(),note);
    for(const [width,height] of [[1366,768],[1920,1080]]){await resize(width,height);await tid('material-study-note').focus({timeout:timeout()});await capture('unsaved-note-'+width);}
    await click('material-study-save');
    await until(()=>read('SELECT * FROM material_reading_entries WHERE resource_id=?',[resource.id]).length===1,'real UI note persistence');
    report.savedReading=read('SELECT * FROM material_reading_entries WHERE resource_id=?',[resource.id])[0];assert.equal(report.savedReading.note,note);
    await until(()=>tid('materials-section-overview').isEnabled(),'save releases dirty protection');
  },parsed&&sections);
  await step('cold-restart-saved-note-readback',async()=>{
    const before=read('SELECT * FROM resource_chunks WHERE resource_id=? ORDER BY chunk_index,id',[resource.id]);
    await close();await launch();await home();await selectPdf();await section('notes');
    await until(()=>tid('material-study-note').inputValue().then(value=>value===note),'saved note visible after real process restart',15000);
    assert.equal(report.launches.length,2);assert.notEqual(report.launches[0].pid,report.launches[1].pid);
    assert.deepEqual(read('SELECT * FROM material_reading_entries WHERE resource_id=?',[resource.id]),[report.savedReading]);
    assert.deepEqual(read('SELECT * FROM resource_chunks WHERE resource_id=? ORDER BY chunk_index,id',[resource.id]),before,'Note save/restart must not rewrite parsed PDF text');
    importedBytes(read('SELECT * FROM teacher_resources WHERE id=?',[resource.id])[0],fixture);
    await capture('cold-saved-note-1366');await resize(1920,1080);await capture('cold-saved-note-1920');
  },saved);
  await step('no-model-runs-or-source-mutation',async()=>{
    assert.equal(sha256(fs.readFileSync(fixture)),report.fixture.sha256);
    const tables=read('SELECT name FROM sqlite_master WHERE type=?',['table']).map(row=>row.name);
    report.noModelReadback={};
    for(const table of ['ai_agent_runs','xiaozhi_runs','material_ai_batches'])if(tables.includes(table)){
      const count=read(`SELECT count(*) n FROM ${table}`)[0].n;report.noModelReadback[table]=count;assert.equal(count,0,table+' must stay empty');
    }
    assert.equal(read('SELECT count(*) n FROM teacher_resources')[0].n,2);
  });
}

try{
  await Promise.race([work(),new Promise((_,reject)=>{timer=setTimeout(()=>{aborted=true;reject(Error('Live material acceptance reached 160-second budget'));},160000);})]);
}catch(error){report.errors.push({stage,message:redact(error)});}
finally{
  clearTimeout(timer);
  await close();
  if(buildBefore){
    try{report.buildUnchanged=fingerprint(path.dirname(path.dirname(mainFile))).sha256===buildBefore.sha256;assert(report.buildUnchanged,'Build changed during acceptance');}
    catch(error){report.errors.push({stage:'build-fingerprint',message:redact(error)});}
  }
  report.durationMs=Date.now()-started;
  report.success=report.checks.length===11&&report.checks.every(check=>check.status==='pass')&&report.errors.length===0&&report.console_errors.length===0&&report.page_errors.length===0&&report.durationMs<180000&&report.buildUnchanged===true;
  flush();console.log(JSON.stringify({success:report.success,durationMs:report.durationMs,checks:report.checks,report:path.join(output,'report.json')}));
  if(!report.success)process.exitCode=1;
}
