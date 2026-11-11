/** A11 bounded actual Electron UI subset. Parent supplies new frozen pins.
 * Business writes arise exclusively from the original import/editor UI.
 * Native picker seam selects three owned, explicitly synthetic QA TXT files.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import {_electron as electron} from 'playwright';
import {fingerprint,sha256} from './acceptance/evidence.mjs';
import {assertIsolatedPiMain} from './acceptance/build-root.mjs';
import {
  ownedExact,continuationBootstrap,continuationGuardRead,waitContinuationBootstrap,
  readContinuationBootstrapFile,closeContinuationRuntime
} from './acceptance/paper-adaptation-continuation.mjs';

const desktop=path.resolve(fileURLToPath(new URL('..',import.meta.url)));
const args=process.argv.slice(2);
assert(args.length===2&&args.includes('--run-ui')&&
  args.filter(a=>a.startsWith('--pins=')).length===1,
  'Use --run-ui --pins=<parent owned pins.json>');
const owned=fs.realpathSync(path.join(desktop,'test-results'));
const own=p=>ownedExact(path.resolve(desktop,p),owned);
const pinsFile=own(args.find(a=>a.startsWith('--pins=')).slice(7));
assert.equal(path.extname(pinsFile).toLowerCase(),'.json');
const pins=JSON.parse(fs.readFileSync(pinsFile,'utf8'));
for(const key of ['source','build'])assert.match(pins[key]??'',/^[a-f0-9]{64}$/);
const build=own(pins.buildRoot),main=own(path.join(build,'main/index.js'));
const output=fs.mkdtempSync(path.join(owned,'ui-final-material-catalog-live-'));
const data=path.join(output,'data'),profile=path.join(output,'profile');
const fixtures=path.join(output,'fixtures');
for(const dir of [data,profile,fixtures])fs.mkdirSync(dir);
assert.deepEqual(fs.readdirSync(data),[]);
assert.deepEqual(fs.readdirSync(profile),[]);
const schema='xiaozhi.material-catalog.v1',token='QACATALOGSCOPE';
const specifications=[
  {name:'QA-catalog-alpha.txt',marker:'ALPHAQA',directory:'QA教学目录甲',tags:['QA物理','QA实验']},
  {name:'QA-catalog-beta.txt',marker:'BETAQA',directory:'QA教学目录甲',tags:['QA物理']},
  {name:'QA-catalog-gamma.txt',marker:'GAMMAQA',directory:'QA教学目录乙',tags:['QA物理','QA实验']}
];
for(const spec of specifications){
  spec.file=path.join(fixtures,spec.name);
  fs.writeFileSync(spec.file,
    `明确的自动验收合成资料，非真实教材或学生内容。\n${token} ${spec.marker}\n`+
    '浮力实验：记录排开水的体积，对照弹簧测力计示数。\n仅供本机目录标签及正文检索验收。\n',
    {flag:'wx'});
  spec.sha256=sha256(fs.readFileSync(spec.file));
}
const codes=[
  'FRESH_OWNED_IMPORT_REAL_TXT_PARSER','UI_METADATA_SAVE_SOURCE_REVISION_RECEIPTS',
  'SEQUENTIAL_SOURCE_BOUND_CAS_RECEIPT','DIRECTORY_AND_TWO_TAGS_FORMAT_READY',
  'SCOPED_KEYWORD_REAL_EXCERPT_AND_SOURCE','CLEAR_RESTORES_ALL_THREE',
  'LAYOUT_KEYBOARD_DIRTY_GUARDS_1366','LAYOUT_KEYBOARD_DIRTY_GUARDS_800',
  'LAYOUT_KEYBOARD_DIRTY_GUARDS_1920','COLD_METADATA_SOURCE_AND_LEDGER',
  'COLD_SCOPED_BODY_AND_CLEAR','FINAL_ZERO_HTTP_MODEL_AND_INTEGRITY'
];
const report={
  suite:'A11-material-catalog-actual-bounded-subset',success:false,status:'RUNNING',
  output,data,profile,phase:'PREFLIGHT',pins:{file:pinsFile,...pins},
  budget:{launches:2,totalSeconds:180,models:0,http:0,automaticRetries:0},
  checks:codes.map(code=>({code,status:'NOT_RUN'})),errors:[],launches:[],guards:[],
  fixtures:specifications,geometry:[],ledgers:[],
  seams:[
    'One-shot Electron dialog.showOpenDialog seam, limited to this app main window and the three owned TXT paths; no OS dialog interaction claim.',
    'Original UI background import, actual native parser/SQLite/FTS and original metadata editor; no seeded DB rows or business write API calls.',
    'Typed IPC and read-only SQLite observe results only; no response substitution.',
    'Shared continuation bootstrap publishes one terminal state; unchanged zero-HTTP/model guard runs before formal main import; original frame policy remains composed.'
  ],
  limits:[
    'Three genuine synthetic TXT fixtures only; no PDF, mixed-format or global multi-page UI acceptance claim.',
    'Sequential UI source-bound revision receipts and cold persistence; negative concurrent CAS/unknown-result/three-page/Lance cases remain historical focused evidence, not this UI run.',
    'No teacher content, credentials, production DB/profile or existing run data is borrowed.'
  ]
};
const dependencyFiles=new Set();
function dependency(file){
  const real=fs.realpathSync(file);
  assert(real.startsWith(desktop+path.sep));
  if(dependencyFiles.has(real))return;
  dependencyFiles.add(real);
  for(const m of fs.readFileSync(real,'utf8').matchAll(/from\s*['"](\.[^'"]+\.mjs)['"]/g)){
    dependency(path.resolve(path.dirname(real),m[1]));
  }
}
dependency(fileURLToPath(import.meta.url));
const qaHashes=()=>[...dependencyFiles].sort().map(file=>({
  file:path.relative(desktop,file).replaceAll('\\','/'),sha256:sha256(fs.readFileSync(file))
}));
report.qaBefore=qaHashes();
const pinsHash=sha256(fs.readFileSync(pinsFile));
let app,page,child,baseline,materialBaseline,metadataBaseline,bodyReadback;
let timedOut=false,deadlineAt,hardTimer,terminationRequested=false;
const persist=()=>fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
const phase=name=>{
  report.phase=name;report.phaseHistory??=[];
  report.phaseHistory.push({phase:name,at:Date.now()});persist();
};
function diagnostic(error){
  const known=['GLOBAL_DEADLINE','WAIT_DEADLINE','NETWORK_OR_RENDERER_ERROR','UNEXPECTED_JS_DIALOG',
    'BOOTSTRAP_CHILD_EXITED','BOOTSTRAP_STATE_REDIRECTED','BOOTSTRAP_STATE_INVALID',
    'BOOTSTRAP_FAILED','BOOTSTRAP_READY_DEADLINE'];
  const message=String(error?.message||''),stack=String(error?.stack||error);
  const code=known.includes(message)?message:error?.code==='ERR_ASSERTION'?'QA_ASSERTION':
    error?.name==='TimeoutError'?'QA_TIMEOUT':error?.code==='SQLITE_BUSY'?'SQLITE_BUSY':'QA_UNKNOWN';
  return {code,phase:report.phase,hash:sha256(stack),qaFrames:[...stack.matchAll(
    /ui-final-material-catalog-live\.mjs:(\d+):(\d+)/g
  )].slice(0,8).map(m=>({file:'scripts/ui-final-material-catalog-live.mjs',line:+m[1],column:+m[2]}))};
}
function remaining(cap=10000){
  // Reserve failure capture, bounded close and final read-only integrity inside 180s.
  if(timedOut||Date.now()>=deadlineAt-12000)throw Error('GLOBAL_DEADLINE');
  return Math.min(cap,deadlineAt-Date.now()-12000);
}
function verify(){
  assert.equal(own(pins.buildRoot),build);
  assert.equal(sha256(fs.readFileSync(pinsFile)),pinsHash);
  assert.equal(fingerprint(build).sha256,pins.build,'Frozen build changed');
  assert.equal(fingerprint(path.join(desktop,'src')).sha256,pins.source,'Frozen source changed');
  assert.deepEqual(qaHashes(),report.qaBefore,'Own QA dependency closure changed');
  for(const spec of specifications){
    assert.equal(fs.realpathSync(spec.file),spec.file);
    assert.equal(sha256(fs.readFileSync(spec.file)),spec.sha256);
  }
}
function read(sql,values=[]){
  assert(/^SELECT\s/i.test(sql),'Read-only observations only');
  const file=path.join(data,'app.db');assert.equal(own(file),file);
  const db=new DatabaseSync(file,{readOnly:true});
  try{return JSON.parse(JSON.stringify(db.prepare(sql).all(...values)));}
  finally{db.close();}
}
const rows=()=>read('SELECT * FROM teacher_resources ORDER BY id');
function ledger(){
  return Object.fromEntries([
    'ai_agent_runs','ai_agent_run_requests','ai_agent_run_actions','ai_agent_events',
    'xiaozhi_event_journal','xiaozhi_pi_commands','xiaozhi_pi_usage',
    'ai_confirmation_items','question_bank_items'
  ].map(table=>{
    const values=read(`SELECT * FROM ${table} ORDER BY rowid`);
    return [table,{count:values.length,sha256:sha256(JSON.stringify(values))}];
  }));
}
function auditLedger(label){
  const value=ledger();report.ledgers.push({label,value});
  if(baseline)assert.deepEqual(value,baseline,'No run/model/tool/approval/question ledger mutation');
  for(const table of ['ai_agent_runs','ai_agent_run_requests','xiaozhi_pi_commands','xiaozhi_pi_usage']){
    assert.equal(value[table].count,0);
  }
}
function importedIntegrity(){
  const current=rows();assert.equal(current.length,3);
  for(const spec of specifications){
    const row=current.find(r=>r.original_file_name===spec.name);assert(row);
    assert.equal(row.id,spec.id);assert.equal(row.content_hash,spec.sha256);
    const local=own(row.local_path);assert(local.startsWith(data+path.sep));
    assert.equal(sha256(fs.readFileSync(local)),spec.sha256);
    assert.equal(row.file_size,fs.statSync(spec.file).size);
  }
  if(materialBaseline)assert.deepEqual(current,materialBaseline,'Organization must not change source/status rows');
}
async function guard(){
  remaining();
  const state=await app.evaluate(continuationGuardRead);
  report.guards[report.launches.length-1]=state;
  assert.equal(state.networkAttempts,0);assert.equal(state.modelAttempts,0);
  assert.equal(state.rendererErrors,0);assert.deepEqual(report.errors,[]);
}
async function unique(locator,enabled=true){
  const target=locator.filter({visible:true});
  await target.waitFor({state:'visible',timeout:remaining()});
  assert.equal(await target.count(),1,'Exact unique visible control');
  assert(await target.isVisible());
  if(enabled){
    await wait(()=>target.isEnabled(),10000);
    assert(await target.isEnabled(),'Original control enabled');
  }
  return target;
}
const tid=id=>page.getByTestId(id);
const nav=id=>page.locator(`[data-testid="edu-navigation"]:visible [data-testid="${id}"]:visible`);
async function click(locator){await guard();await (await unique(locator)).click({timeout:remaining()});}
async function wait(predicate,cap=20000){
  const end=Date.now()+remaining(cap);
  while(Date.now()<end){await guard();if(await predicate())return;await new Promise(r=>setTimeout(r,150));}
  throw Error('WAIT_DEADLINE');
}
async function step(code,action){
  phase(code);const check=report.checks.find(c=>c.code===code);
  try{await action();await guard();auditLedger(code);check.status='PASS';persist();}
  catch(error){check.status='FAIL';check.failure=diagnostic(error);persist();throw error;}
}
function terminateOwned(){
  if(terminationRequested||!child||child.exitCode!==null||child.signalCode!==null)return;
  const pid=child.pid;assert(Number.isInteger(pid)&&pid>0&&pid!==process.pid);
  terminationRequested=true;report.ownedTermination={pid,code:'OWNED_TREE_TERMINATION'};persist();
  if(process.platform==='win32'){
    const kill=spawn('taskkill.exe',['/PID',String(pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});
    kill.on('error',e=>report.errors.push(diagnostic(e)));kill.unref();
  }else child.kill('SIGKILL');
}
function observeBootstrapWindow(value){
  page=value;page.setDefaultTimeout(8000);
  page.on('pageerror',e=>report.errors.push({code:'PAGE_ERROR',phase:report.phase,hash:sha256(String(e))}));
  page.on('console',m=>{if(m.type()==='error')report.errors.push({
    code:'CONSOLE_ERROR',phase:report.phase,hash:sha256(m.text())
  });});
  page.on('dialog',dialog=>{
    report.errors.push({code:'UNEXPECTED_JS_DIALOG',phase:report.phase,hash:sha256(dialog.message())});
    void dialog.dismiss();
  });
}
async function launch(){
  verify();assert(report.launches.length<2);terminationRequested=false;
  const number=report.launches.length+1;
  phase('LAUNCH_'+number);
  const bootstrap=path.join(output,`bootstrap-${number}.cjs`);
  const stateFile=path.join(output,`bootstrap-state-${number}.json`);
  fs.writeFileSync(bootstrap,continuationBootstrap({main,profile,diagnosticFile:stateFile}),{flag:'wx'});
  const env={...process.env};
  for(const key of Object.keys(env)){
    if(/KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL/i.test(key)||key.startsWith('OMNI_EDU_')||
      ['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL'].includes(key))delete env[key];
  }
  Object.assign(env,{
    OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),
    OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_E2E_DIALOG_MODE:'1',OMNI_EDU_E2E_VISIBLE:'1'
  });
  report.launches.push({number,phase:'REQUESTED',stateFile,
    bootstrapObservationSource:'OWNED_TERMINAL_BOOTSTRAP_STATE_FILE'});persist();
  app=await electron.launch({args:[bootstrap,'--user-data-dir='+profile,
    '--force-device-scale-factor=1'],cwd:output,env,timeout:remaining(45000)});
  child=app.process();report.launches.at(-1).pid=child.pid;
  for(const stream of [child.stdout,child.stderr])stream?.on('data',chunk=>{
    report.runtimeOutput??=[];
    if(report.runtimeOutput.length<32)report.runtimeOutput.push({
      phase:report.phase,code:'RUNTIME_OUTPUT',hash:sha256(chunk)
    });
    if(/uncaught|unhandledrejection|unhandled rejection/i.test(String(chunk))){
      report.errors.push({code:'MAIN_RUNTIME_FATAL',phase:report.phase,hash:sha256(chunk)});
    }
  });
  phase('BOOTSTRAP_'+number);
  await waitContinuationBootstrap(app,{
    timeout:remaining(20000),readState:()=>readContinuationBootstrapFile(stateFile,child),
    observeWindow:true,onWindow:observeBootstrapWindow,
    onObservation:value=>{report.launches.at(-1).bootstrap=value;}
  });
  phase('MAIN_IDENTITY_'+number);
  report.launches.at(-1).identity=await assertIsolatedPiMain(app,main,profile);
  assert.equal(await app.evaluate(({session})=>session.defaultSession.storagePath),profile);
  phase('WINDOW_READY_'+number);
  assert(page&&!page.isClosed(),'Owned bootstrap window observed');
  const state=await app.evaluate(continuationGuardRead,true);
  assert.equal(state.policyProbe,'FORMAL_FRAME_AND_ZERO_HTTP_VERIFIED');
  await tid('xiaozhi-pi-workspace').waitFor({timeout:remaining(20000)});
  assert.equal(path.resolve(await page.evaluate(()=>window.omniEdu.getDataRoot())),data);
  await guard();report.launches.at(-1).phase='READY';persist();
}
async function close(){
  if(!app)return;
  const cleanup=await closeContinuationRuntime({
    observeGuard:async()=>{
      const state=await app.evaluate(continuationGuardRead);
      assert.equal(state.networkAttempts,0);assert.equal(state.modelAttempts,0);
      assert.equal(state.rendererErrors,0);report.guards[report.launches.length-1]=state;
      return state;
    },close:()=>app.close(),forceClose:terminateOwned,deadlineAt,cap:4000
  });
  report.launches.at(-1).cleanup=cleanup;
  if(cleanup.closed){app=undefined;child=undefined;}
  assert(cleanup.closed&&!cleanup.guardError&&!cleanup.closeError,'Owned close/guard verified');
}
async function home(){
  await click(nav('nav-knowledge'));
  await tid('materials-workspace').filter({visible:true}).waitFor({timeout:remaining()});
  await wait(async()=>!String(await tid('materials-count').innerText()).includes('正在读取'));
}
async function showNavigationFacets(){
  const toggle=tid('materials-navigation-toggle');
  if(await toggle.isVisible()&&await toggle.getAttribute('aria-expanded')==='false')await click(toggle);
}
async function selectDirectory(directory){
  await showNavigationFacets();
  const group=tid('materials-filter-directory');
  await click(directory===null?tid('materials-directory-all'):group.getByRole('button',{name:directory||'未整理',exact:true}));
}
async function selectTags(values){
  await showNavigationFacets();
  const checkboxes=tid('materials-filter-tags').getByRole('checkbox');
  for(const checkbox of await checkboxes.all()){
    await checkbox.setChecked(values.includes(await checkbox.inputValue()),{timeout:remaining()});
  }
  assert.deepEqual((await selectedTags()).sort(),[...values].sort());
}
async function selectedTags(){
  return tid('materials-filter-tags').locator('input:checked').evaluateAll(elements=>elements.map(element=>element.value));
}
async function select(spec){
  await click(page.locator(`[data-testid="material-${spec.id}"] button`));
  await wait(async()=>await tid('material-catalog-editor').getAttribute('data-resource-id')===spec.id&&
    await tid('material-catalog-directory').isEnabled());
  const metadata=tid('materials-metadata').getByRole('button',{name:'编辑目录、标签与元数据',exact:true});
  if(await metadata.getAttribute('aria-expanded')==='false')await click(metadata);
  assert.equal(await metadata.getAttribute('aria-expanded'),'true');
}
async function save(spec,revision,tags=spec.tags){
  await select(spec);
  const before=await page.evaluate(q=>window.omniEdu.getMaterialCatalogMetadata(q),{
    schemaVersion:schema,resourceId:spec.id,sourceVersion:spec.sha256
  });
  assert.equal(before.revision,revision-1);
  await (await unique(tid('material-catalog-directory'))).fill(spec.directory,{timeout:remaining()});
  await (await unique(tid('material-catalog-tags'))).fill(tags.join(', '),{timeout:remaining()});
  await click(tid('material-catalog-save'));
  await wait(()=>read('SELECT revision FROM material_catalog_metadata_v1 WHERE resource_id=?',[spec.id])[0]?.revision===revision);
  await wait(async()=>await tid('material-catalog-directory').isEnabled()&&
    await tid('materials-directory-all').isEnabled());
  const view=await page.evaluate(q=>window.omniEdu.getMaterialCatalogMetadata(q),{
    schemaVersion:schema,resourceId:spec.id,sourceVersion:spec.sha256
  });
  assert.equal(view.revision,revision);assert.equal(view.sourceVersion,spec.sha256);
  assert.equal(view.metadata.directory,spec.directory);
  assert.deepEqual([...view.metadata.tags].sort(),[...tags].sort());
  assert.equal(view.receipt.baseRevision,revision-1);
  assert.equal(view.receipt.sourceVersion,spec.sha256);
  assert.match(view.receipt.operationId,/^catalog_[a-f0-9-]{36}$/);
  assert.equal(view.receipt.patchDigest,sha256(JSON.stringify(view.metadata)));
  if(before.receipt)assert.notEqual(view.receipt.operationId,before.receipt.operationId);
  report.saved??=[];report.saved.push(view);importedIntegrity();
}
async function clear(){
  if(await tid('materials-filter-clear').isEnabled())await click(tid('materials-filter-clear'));
  if(await tid('materials-mode-catalog').getAttribute('aria-pressed')!=='true'){
    await click(tid('materials-mode-catalog'));
  }
  await wait(async()=>/^3 份资料/.test(await tid('materials-count').innerText()));
  assert.equal(await tid('materials-search').inputValue(),'');
  assert.equal(await tid('materials-directory-all').getAttribute('aria-pressed'),'true');
  assert.deepEqual(await selectedTags(),[]);
  assert.equal(await tid('materials-filter-format').inputValue(),'');
  assert.equal(await tid('materials-filter-state').inputValue(),'');
  assert.equal(await page.locator('[data-testid^="material-resource_"]').count(),3);
}
async function filterAndBody(){
  await clear();
  await selectDirectory(specifications[0].directory);
  await selectTags(['qa物理']);
  await wait(async()=>/^2 份资料/.test(await tid('materials-count').innerText()));
  await selectTags(['qa物理','qa实验']);
  await tid('materials-filter-format').selectOption('TXT');
  await tid('materials-filter-state').selectOption('ready');
  await wait(async()=>/^1 份资料/.test(await tid('materials-count').innerText()));
  assert.equal(await page.locator('[data-testid^="material-resource_"]').count(),1);
  assert(await tid('material-'+specifications[0].id).isVisible());
  await click(tid('materials-mode-text'));
  await tid('materials-search-mode').selectOption('keyword');
  await tid('materials-text-query').fill(token,{timeout:remaining()});
  await click(tid('materials-text-submit'));
  await wait(async()=>await tid('materials-text-results').count()===1&&
    (await tid('materials-text-results').innerText()).includes('ALPHAQA'));
  const text=await tid('materials-text-results').innerText();
  assert(!text.includes('BETAQA')&&!text.includes('GAMMAQA'));
  assert.match(await tid('materials-text-actual-mode').innerText(),/关键词/);
  const query={schemaVersion:schema,query:token,offset:0,mode:'keyword',scope:{
    directory:specifications[0].directory,tags:['qa物理','qa实验'],format:'TXT',state:'ready'
  }};
  const result=await page.evaluate(q=>window.omniEdu.searchMaterialCatalogBody(q),query);
  assert.equal(result.actualMode,'keyword');assert.equal(result.hits.length,1);
  assert.equal(await tid('materials-text-results').locator('[data-testid^="material-text-hit-"]').count(),1);
  assert.equal(result.hits[0].source.resourceId,specifications[0].id);
  assert.equal(result.hits[0].source.version,specifications[0].sha256);
  assert(result.hits[0].excerpt.includes(token)&&result.hits[0].excerpt.includes('ALPHAQA'));
  const source=result.hits[0].source;
  const actual=await page.evaluate(s=>window.omniEdu.getMaterialSource(s),source);
  assert.equal(actual.body.resource.id,source.resourceId);
  assert.equal(actual.body.resource.contentHash,source.version);
  assert(actual.body.chunks.some(c=>c.id===source.chunkId&&c.contentMd.includes(token)));
  const hit=tid('material-text-hit-'+source.chunkId);await unique(hit);
  assert.equal(await hit.innerText(),result.hits[0].citation);
  await click(hit);
  await wait(async()=>await tid('materials-detail').getAttribute('data-resource-id')===source.resourceId);
  await wait(async()=>await tid('materials-body-location').isVisible());
  assert((await tid('materials-detail').innerText()).includes('ALPHAQA'));
  await page.screenshot({path:path.join(output,`body-source-launch-${report.launches.length}.png`)});
  bodyReadback={query,result,source};report.bodyReadbacks??=[];report.bodyReadbacks.push(bodyReadback);
}
async function resize(width){
  const height=width===1920?1080:768;
  const handle=await app.browserWindow(page);
  await handle.evaluate((window,size)=>window.setContentSize(size.width,size.height),{width,height});
  await wait(()=>page.evaluate(size=>innerWidth===size.width&&innerHeight===size.height,{width,height}));
}
async function footerFocus(id){
  const target=await unique(tid(id));
  await target.scrollIntoViewIfNeeded({timeout:remaining()});await target.focus({timeout:remaining()});
  assert.equal(await page.locator(':focus').getAttribute('data-testid'),id);
  const value=await target.evaluate(el=>{
    const r=el.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
    return {x:r.x,y:r.y,width:r.width,height:r.height,viewportWidth:innerWidth,
      viewportHeight:innerHeight,hit:!!hit&&(el===hit||el.contains(hit))};
  });
  assert(value.x>=-1&&value.y>=-1&&value.x+value.width<=value.viewportWidth+1&&
    value.y+value.height<=value.viewportHeight+1&&value.hit);
  return value;
}
async function layout(width){
  await resize(width);await clear();await select(specifications[0]);
  await tid('material-catalog-directory').focus();
  await page.keyboard.press('Control+A');await page.keyboard.type('QA未保存目录');
  assert(await tid('materials-search').isDisabled());
  assert(await tid('materials-directory-all').isDisabled());
  assert.notEqual(await tid('materials-filter-directory').getAttribute('disabled'),null);
  assert(await page.locator(`[data-testid="material-${specifications[1].id}"] button`).isDisabled());
  assert(await tid('materials-mode-text').isDisabled(),'Dirty metadata blocks switching to content search');
  assert.equal(await tid('materials-mode-catalog').getAttribute('aria-pressed'),'true');
  await click(nav('nav-settings'));
  assert(await tid('materials-workspace').isVisible());
  assert.equal(await tid('material-catalog-directory').inputValue(),'QA未保存目录');
  const saveGeometry=await footerFocus('material-catalog-save');
  await page.screenshot({path:path.join(output,`dirty-footer-${width}.png`)});
  const cancelGeometry=await footerFocus('material-catalog-cancel');
  await page.keyboard.press('Space');
  await wait(async()=>await tid('materials-directory-all').isEnabled());
  assert.equal(await tid('material-catalog-directory').inputValue(),specifications[0].directory);
  const geometry=await tid('materials-workspace').evaluate(el=>{
    const r=el.getBoundingClientRect();return {viewport:innerWidth,scroll:document.documentElement.scrollWidth,
      x:r.x,right:r.right,width:r.width};
  });
  assert(geometry.scroll<=geometry.viewport+1&&geometry.x>=-1&&geometry.right<=geometry.viewport+1);
  report.geometry.push({width,...geometry,saveGeometry,cancelGeometry});
  await click(nav('nav-settings'));
  await tid('pi-settings-workspace').filter({visible:true}).waitFor({timeout:remaining()});
  await home();await select(specifications[0]);
  assert.equal(await tid('material-catalog-directory').inputValue(),specifications[0].directory);
  await page.screenshot({path:path.join(output,`materials-${width}.png`)});
  assert.deepEqual(read('SELECT * FROM material_catalog_metadata_v1 ORDER BY resource_id'),metadataBaseline);
}

persist();
try{
  verify();deadlineAt=Date.now()+180000;
  hardTimer=setTimeout(()=>{timedOut=true;report.failure??=diagnostic(Error('GLOBAL_DEADLINE'));
    report.success=false;persist();terminateOwned();},180000);
  await launch();await resize(1366);await home();
  assert.equal(rows().length,0);baseline=ledger();auditLedger('fresh-owned-baseline');
  await step('FRESH_OWNED_IMPORT_REAL_TXT_PARSER',async()=>{
    await app.evaluate(({dialog,BrowserWindow},files)=>{
      const fs=process.getBuiltinModule('fs'),path=process.getBuiltinModule('path');
      const main=BrowserWindow.getAllWindows()[0];
      const original=dialog.showOpenDialog;
      const root=fs.realpathSync(path.dirname(files[0]));
      if(files.length!==3||files.some(file=>fs.realpathSync(file)!==file||
        path.dirname(file)!==root||!file.endsWith('.txt')))throw Error('CHOOSER_PATH_REJECTED');
      dialog.showOpenDialog=async(window,options)=>{
        dialog.showOpenDialog=original;
        if(window!==main||options?.title!=='选择教学资料'||
          JSON.stringify(options.properties)!==JSON.stringify(['openFile','multiSelections'])){
          throw Error('CHOOSER_OWNER_REJECTED');
        }
        globalThis.__qaCatalogChooserCount=(globalThis.__qaCatalogChooserCount||0)+1;
        return {canceled:false,filePaths:files};
      };
    },specifications.map(s=>s.file));
    await click(tid('materials-import'));
    await wait(async()=>{
      const current=rows();
      if(current.length!==3)return false;
      return current.every(r=>['ready','parsed','chunked','indexed','graph_extracted'].includes(r.parse_status)&&
        read('SELECT COUNT(*) n FROM resource_chunks WHERE resource_id=?',[r.id])[0].n>0);
    },35000);
    await wait(async()=>{
      const state=await page.evaluate(()=>window.omniEdu.getMaterialIndexStatus());
      return state.available&&state.pending===0&&state.indexed>=3;
    },15000);
    assert.equal(await app.evaluate(()=>globalThis.__qaCatalogChooserCount),1);
    for(const spec of specifications)spec.id=rows().find(r=>r.original_file_name===spec.name).id;
    await wait(async()=>/^3 份资料/.test(await tid('materials-count').innerText()));
    materialBaseline=rows();importedIntegrity();
    report.parserReadback=read('SELECT id,parse_status,parse_engine FROM teacher_resources ORDER BY id');
  });
  await step('UI_METADATA_SAVE_SOURCE_REVISION_RECEIPTS',async()=>{
    for(const spec of specifications)await save(spec,1,spec===specifications[0]?[...spec.tags,'QA临时标签']:spec.tags);
  });
  await step('SEQUENTIAL_SOURCE_BOUND_CAS_RECEIPT',async()=>{
    await save(specifications[0],2);
    metadataBaseline=read('SELECT * FROM material_catalog_metadata_v1 ORDER BY resource_id');
    report.metadataBaseline=metadataBaseline;
  });
  await step('DIRECTORY_AND_TWO_TAGS_FORMAT_READY',async()=>{
    await clear();
    await selectDirectory(specifications[0].directory);
    await selectTags(['qa物理']);
    await wait(async()=>/^2 份资料/.test(await tid('materials-count').innerText()));
    await selectTags(['qa物理','qa实验']);
    await tid('materials-filter-format').selectOption('TXT');
    await tid('materials-filter-state').selectOption('ready');
    await wait(async()=>/^1 份资料/.test(await tid('materials-count').innerText()));
    assert.equal(await page.locator('[data-testid^="material-resource_"]').count(),1);
    assert(await tid('material-'+specifications[0].id).isVisible());
  });
  await step('SCOPED_KEYWORD_REAL_EXCERPT_AND_SOURCE',filterAndBody);
  await step('CLEAR_RESTORES_ALL_THREE',async()=>{
    await clear();assert.equal(await tid('materials-text-query').inputValue(),'');
    assert.equal(await tid('materials-text-results').count(),0);
  });
  for(const width of [1366,800,1920]){
    await step('LAYOUT_KEYBOARD_DIRTY_GUARDS_'+width,()=>layout(width));
  }
  importedIntegrity();auditLedger('before-cold');await close();auditLedger('closed-first-process');
  await launch();await resize(1366);await home();
  await step('COLD_METADATA_SOURCE_AND_LEDGER',async()=>{
    importedIntegrity();assert.deepEqual(read('SELECT * FROM material_catalog_metadata_v1 ORDER BY resource_id'),metadataBaseline);
    for(const spec of specifications){
      await select(spec);assert.equal(await tid('material-catalog-directory').inputValue(),spec.directory);
      const tags=(await tid('material-catalog-tags').inputValue()).split(',').map(s=>s.trim()).sort();
      assert.deepEqual(tags,[...spec.tags].sort());
    }
  });
  await step('COLD_SCOPED_BODY_AND_CLEAR',async()=>{await filterAndBody();await clear();});
  await step('FINAL_ZERO_HTTP_MODEL_AND_INTEGRITY',async()=>{
    importedIntegrity();verify();assert.deepEqual(report.errors,[]);
  });
  report.success=true;
}catch(error){
  report.failure=diagnostic(error);report.success=false;
  const active=report.checks.find(c=>c.code===report.phase);
  if(active?.status==='NOT_RUN')active.status='FAIL';
  if(page&&!page.isClosed()){
    await page.screenshot({path:path.join(output,'failure.png'),timeout:3000}).catch(()=>{});
    await page.locator('[data-testid="materials-workspace"], [data-testid="material-catalog-editor"], '+
      '[data-testid="materials-count"], [data-testid="materials-text-results"], '+
      '[data-testid="edu-navigation"]').evaluateAll(elements=>elements.map(el=>{
      const r=el.getBoundingClientRect();
      return {testid:el.getAttribute('data-testid'),resourceId:el.getAttribute('data-resource-id'),
        hidden:el.hidden,unknown:el.getAttribute('data-unknown'),
        display:getComputedStyle(el).display,rect:{x:r.x,y:r.y,width:r.width,height:r.height}};
    })).then(value=>{
      fs.writeFileSync(path.join(output,'failure-dom-structure.json'),JSON.stringify(value,null,2));
    }).catch(()=>{});
  }
}finally{
  if(app){try{await close();}catch(error){report.closeFailure=diagnostic(error);report.success=false;terminateOwned();}}
  clearTimeout(hardTimer);
  try{
    verify();if(baseline)auditLedger('after-final-close');if(materialBaseline)importedIntegrity();
    assert(!timedOut);assert.deepEqual(report.errors,[]);
    assert.equal(report.launches.length,2);
    assert(report.launches.every(l=>l.cleanup?.closed&&!l.cleanup.guardError));
    report.integrityVerified=true;
  }catch(error){report.integrityFailure=diagnostic(error);report.success=false;}
  report.status=report.success?'PASS':'FAIL';
  const observed=report.launches.length>0&&report.guards.length===report.launches.length&&
    Array.from({length:report.launches.length},(_,i)=>report.guards[i]).every(g=>g?.modelAttempts===0);
  report.modelCalls=observed?0:null;
  report.elapsedMs=deadlineAt?Date.now()-(deadlineAt-180000):0;
  persist();console.log(JSON.stringify({code:'A11_CATALOG_'+report.status,output,
    launches:report.launches.length,modelCalls:report.modelCalls,
    counts:report.checks.reduce((value,c)=>(value[c.status]=(value[c.status]||0)+1,value),{}),
    integrityVerified:report.integrityVerified===true}));
  if(!report.success)process.exitCode=1;
}
