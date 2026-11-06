/** Parent-launched, one-instance CSSOM evidence. Never builds or supplies credentials. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {_electron as electron} from 'playwright';
import {fingerprint} from './acceptance/evidence.mjs';
import {assertIsolatedPiMain} from './acceptance/build-root.mjs';
import {createCssomCollector,inspectCssomElement,observesState,PROPERTIES} from './acceptance/ui-final-cssom.mjs';
import {createDevtoolsCascadeCollector} from './acceptance/ui-final-devtools-cascade.mjs';
import {continuationBootstrap,continuationGuardRead} from './acceptance/paper-adaptation-continuation.mjs';

const desktop=fileURLToPath(new URL('../',import.meta.url));
const args=process.argv.slice(2),pinArgs=args.filter(a=>a.startsWith('--pins='));
const native=args.includes('--native-devtools');
assert(args.length===(native?3:2)&&args.includes('--run-ui')&&pinArgs.length===1,'Use --run-ui --pins=<owned JSON> [--native-devtools]; parent holds launch');
const owned=fs.realpathSync(path.join(desktop,'test-results'));
const ownedPath=value=>{
  const resolved=fs.realpathSync(path.resolve(desktop,value)),relative=path.relative(owned,resolved);
  assert(relative&&!path.isAbsolute(relative)&&relative!=='..'&&!relative.startsWith('..'+path.sep),'Expected an owned test-results path');return resolved;
};
const pinsPath=ownedPath(pinArgs[0].slice('--pins='.length));assert.equal(path.extname(pinsPath).toLowerCase(),'.json');
const pins=JSON.parse(fs.readFileSync(pinsPath,'utf8')),build=ownedPath(pins.buildRoot),main=path.join(build,'main/index.js');
for(const key of ['source','build'])assert.match(pins[key],/^[a-f0-9]{64}$/);
assert(fs.statSync(main).isFile());
const hash=value=>createHash('sha256').update(value).digest('hex');
const scriptFiles=[fileURLToPath(import.meta.url),path.join(desktop,'scripts/acceptance/ui-final-cssom.mjs'),
  path.join(desktop,'scripts/acceptance/ui-final-devtools-cascade.mjs'),path.join(desktop,'scripts/acceptance/paper-adaptation-continuation.mjs'),
  path.join(desktop,'scripts/acceptance/ui-final-css-source.mjs'),
  path.join(desktop,'scripts/acceptance/build-root.mjs'),path.join(desktop,'scripts/acceptance/evidence.mjs')];
const scriptHashes=()=>scriptFiles.map(file=>({file,sha256:hash(fs.readFileSync(file))}));
const output=fs.mkdtempSync(path.join(owned,'ui-final-cssom-')),data=path.join(output,'data'),profile=path.join(output,'profile');
const tables=['ai_agent_runs','ai_agent_run_requests','ai_agent_run_actions','ai_agent_events','xiaozhi_event_journal'];
const report={schema:'ui-final-cssom/v1',status:'PREPARED',success:false,captureComplete:false,fullAcceptance:false,
  nativeDevtools:native,
  output,pinsPath,pins,properties:PROPERTIES,samples:[],errors:[],ledgerReadbacks:[],scriptBefore:scriptHashes(),
  budget:{electronLaunches:1,ownedProfiles:1,modelCalls:0,businessRetries:0},
  method:{winner:'Restricted literal normal cascade from full CDP matched rules; never selected by computed-value similarity',
    basis:'https://github.com/ChromeDevTools/devtools-frontend/blob/main/front_end/core/sdk/CSSMatchedStyles.ts',
    sourceLocations:'Generated stylesheet URLs and one-based locations, not original-source-map attribution',
    unresolved:'inherit/default origin, var/env/attr/currentColor/CSS-wide values, important, native nesting, scope/container, unknown origins/layers, animation or unstable snapshots'},
  seams:['Light media environment only. Real pointer/keyboard states; no forcePseudoState, injected CSS, attributes or vendor edits.',
    'Mouse-down is held during pressed evidence; pointer moves off the control before release to cancel activation.',
    'Native home-task-paper button is reported as native, never relabelled HeroUI.',
    'Fresh owned data and profile; stripped credential environment; HTTP(S) blocked in the owned session after launch.'],
  notRun:['Dark theme','Real send/model/queue/approval','Native Office or populated paper workflow',
    'Full cascade/token provenance for unresolved cases','Reviewed official-versus-shell CSS ownership and whole A04/A27 acceptance']};
let app,page,collector,baseline,authorityBefore;
const digest=(kind,error)=>({kind,sha256:hash(String(error?.message??error)),length:String(error?.message??error).length});
const persist=()=>fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
const identity=()=>({source:fingerprint(path.join(desktop,'src')).sha256,build:fingerprint(build).sha256});
const verify=()=>{
  assert.equal(ownedPath(pins.buildRoot),build);const now=identity();assert.equal(now.source,pins.source);assert.equal(now.build,pins.build);
  assert.deepEqual(scriptHashes(),report.scriptBefore,'QA/import changed during run');return now;
};
const ledger=()=>{
  const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});
  try{
    db.exec('BEGIN');
    return Object.fromEntries(tables.map(table=>{
      const sql=db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name=?").get(table)?.sql;assert(sql,'Ledger schema missing');
      const columns=db.prepare(`PRAGMA table_info("${table}")`).all(),query=db.prepare(`SELECT * FROM "${table}"`);query.setReadBigInts(true);
      const rows=query.all().map(row=>JSON.stringify(columns.map(c=>row[c.name]),(_k,v)=>typeof v==='bigint'?{integer:v.toString()}:v instanceof Uint8Array?{blob:Buffer.from(v).toString('hex')}:v)).sort();
      return [table,{count:rows.length,schemaSha256:hash(JSON.stringify({sql,columns})),rowsSha256:hash(JSON.stringify(rows))}];
    }));
  }finally{db.close();}
};
const authority=()=>page.evaluate(async()=>{
  const list=await window.omniEdu.listAiConversations();
  const sessions=await Promise.all(list.sessions.map(async s=>{const v=await window.omniEdu.getXiaozhiSnapshot(s.id);return {
    id:s.id,turns:v.projection.turns.length,running:v.running,approvals:v.approvals,
    workspace:v.workspace??null,memoryScope:v.memoryScope??null,fileWritesEnabled:v.fileWritesEnabled??null};}));
  return {sessions,permission:localStorage.getItem('xiaozhi.permissionMode.v1')};
});
async function audit(label){
  assert.equal(fs.realpathSync(await page.evaluate(()=>window.omniEdu.getDataRoot())),fs.realpathSync(data),'Unexpected active root');
  const value=ledger();report.ledgerReadbacks.push({label,value});assert.deepEqual(value,baseline,'Five ledger schemas/contents/counts must remain unchanged');
  assert.deepEqual(await authority(),authorityBefore,'Menu/control sampling changed authority or admitted a turn');
}
const composer=()=>page.locator('.office-composer-container:visible');
const input=()=>composer().getByTestId('office-prompt-input');
const permission=()=>composer().getByTestId('pi-permission-picker');
const menu=()=>page.locator('.pi-permission-menu:visible').getByRole('menu');
const frame=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
async function unique(locator){await locator.waitFor();assert.equal(await locator.count(),1,'Exact visible CSSOM target required');return locator;}
async function settle(locator){
  const deadline=Date.now()+3500;
  while(true){const value=await locator.evaluate(inspectCssomElement);if(!value.animations.length)break;if(Date.now()>=deadline)break;await frame();}
  await frame();
}
async function openMenu(){
  await page.keyboard.press('Escape');await unique(permission());await permission().focus();await page.keyboard.press('Enter');await unique(menu());
  assert.equal(await permission().getAttribute('aria-expanded'),'true');
}
async function sample(target,state,width){
  const id=`${target.id}-${width}-${state}`;report.active=id;persist();
  let locator;
  const draft=await input().inputValue();
  try{
    await page.mouse.move(5,5);await page.keyboard.press('Escape');
    if(target.inMenu)await openMenu();
    locator=await unique(target.locator());await locator.scrollIntoViewIfNeeded();
    if(target.inMenu)await menu().getByTestId('pi-permission-acceptEdits').focus();else await input().focus();
    await page.mouse.move(5,5);
    if(state==='hover')await locator.hover();
    if(state==='focus'){
      if(target.inMenu){await page.keyboard.press('ArrowDown');await locator.focus();}
      else{await locator.focus();await page.keyboard.press('Tab');await page.keyboard.press('Shift+Tab');}
    }
    if(state==='pressed'){await locator.hover();await page.mouse.down();}
    if(state==='disabled')assert(await locator.isDisabled(),'Use a real disabled control; never set disabled');
    await settle(locator);
    const value=await collector.capture(locator,state);
    assert(observesState(state,value.before.state)&&observesState(state,value.after.state),'Requested actual state was not observed');
    assert(value.before.rect.width>0&&value.before.rect.height>0&&value.before.rect.x>=0&&value.before.rect.y>=0&&
      value.before.rect.x+value.before.rect.width<=width+1&&value.before.rect.y+value.before.rect.height<=value.before.environment.height+1,'Target must be visible inside the viewport');
    const rawFile=id+'-cdp.json',screenshot=id+'.png';
    fs.writeFileSync(path.join(output,rawFile),JSON.stringify(value.raw,null,2));
    await page.screenshot({path:path.join(output,screenshot)});
    const afterShot=await locator.evaluate(inspectCssomElement);
    assert(observesState(state,afterShot.state),'Screenshot no longer represents the sampled state');
    if(JSON.stringify(afterShot)!==JSON.stringify(value.after)){
      value.hazards.push('state-or-style-changed-before-screenshot');
      for(const property of Object.values(value.properties))Object.assign(property,{status:'unresolved',winner:null,reason:'state-or-style-changed-before-screenshot'});
    }
    report.samples.push({id,target:target.id,component:target.component,sourceEvidence:target.sourceEvidence,state,width,
      before:value.before,after:value.after,hazards:value.hazards,properties:value.properties,rawFile,screenshot,
      rawSha256:hash(fs.readFileSync(path.join(output,rawFile))),screenshotSha256:hash(fs.readFileSync(path.join(output,screenshot)))});
  }finally{
    // Cancel pointer activation on this owned window, even after a capture failure.
    await page.mouse.move(5,5);await page.mouse.up();await page.keyboard.press('Escape');
  }
  assert.equal(await input().inputValue(),draft,'Sampling must not activate a shortcut or change the unsent draft');
  await audit(id);persist();
}
try{
  report.before=verify();persist();
  const env={...process.env};
  for(const key of Object.keys(env))if(/KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL/i.test(key)||key.startsWith('OMNI_EDU_')||['ELECTRON_RUN_AS_NODE','NODE_OPTIONS','ELECTRON_RENDERER_URL'].includes(key))delete env[key];
  Object.assign(env,{OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_E2E_DIALOG_MODE:'1'});
  let entry=main;
  if(native){entry=path.join(output,'bootstrap.cjs');fs.writeFileSync(entry,continuationBootstrap({main,profile}),{flag:'wx'});}
  app=await electron.launch({args:[entry,'--user-data-dir='+profile,'--force-device-scale-factor=1'],cwd:output,env,timeout:60000});
  page=await app.firstWindow();page.setDefaultTimeout(12000);
  page.on('pageerror',e=>report.errors.push(digest('pageerror',e)));
  page.on('console',m=>{if(m.type()==='error')report.errors.push(digest('console.error',m.text()));});
  report.launch={pid:app.process().pid,...await assertIsolatedPiMain(app,main,profile)};
  if(!native)await app.evaluate(({session})=>session.defaultSession.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*']},(_details,callback)=>callback({cancel:true})));
  await page.emulateMedia({colorScheme:'light'});
  await page.getByTestId('xiaozhi-pi-workspace').waitFor({timeout:60000});await unique(input());
  await page.waitForFunction(()=>{const e=document.querySelector('[data-testid="office-prompt-input"]');return e&&!e.disabled;});
  assert.equal(await input().inputValue(),'','Fresh instance must have no seeded draft');
  baseline=ledger();report.modelLedgerBefore=baseline;for(const table of tables)assert.equal(baseline[table].count,0,'Fresh zero ledger required');
  authorityBefore=await authority();assert(authorityBefore.sessions.every(s=>!s.running&&s.turns===0&&s.approvals.length===0));await audit('initial');
  collector=native?await createDevtoolsCascadeCollector(app,page,{buildRoot:build,sourceRoot:path.join(desktop,'src/renderer')}):await createCssomCollector(page);
  if(native){
    report.method.winner='Electron bundled DevTools CSSMatchedStyles.propertyState; fresh native cascade per sample';
    report.method.unresolved='Ambiguous Active properties, animation, unstable snapshot or absent generated source remain failures';
    report.method.originalSources='Vendor mapping requires unique whole-file unchanged embedding and exact CDP UTF-16 range translation; other generated locations retain not-embedded status';
    report.notRun=report.notRun.filter(value=>value!=='Full cascade/token provenance for unresolved cases');
    report.seams.push('Early zero-HTTP bootstrap active. DevTools console is separately scoped; original guard total preserved.');
  }
  const targets=[
    {id:'composer-permission',component:'HeroUI Button',locator:permission,sourceEvidence:'OfficeComposer.tsx: @heroui/react Button / pi-permission-picker'},
    {id:'home-paper',component:'Native button (not HeroUI)',locator:()=>page.getByTestId('home-task-paper'),sourceEvidence:'WorkbenchHome.tsx: home-task-paper / native button / unsent suggestion only'},
    {id:'permission-item',component:'HeroUI Dropdown.Item',inMenu:true,locator:()=>menu().getByTestId('pi-permission-request'),sourceEvidence:'OfficeComposer.tsx: Dropdown.Item / pi-permission-request'},
  ];
  for(const [width,height] of [[1366,768],[1920,1080]]){
    await app.evaluate(({BrowserWindow},size)=>{const windows=BrowserWindow.getAllWindows().filter(w=>!w.webContents.getURL().startsWith('devtools:'));if(windows.length!==1)throw Error('One product window required');windows[0].setContentSize(size.width,size.height);}, {width,height});
    await page.waitForFunction(size=>innerWidth===size.width&&innerHeight===size.height,{width,height});
    for(const target of targets)for(const state of ['normal','hover','focus','pressed'])await sample(target,state,width);
    await sample({id:'composer-send',component:'Original PromptInput.Send',locator:()=>composer().getByRole('button',{name:'发送消息',exact:true}),sourceEvidence:'OfficeComposer.tsx: blank draft disables original send'},'disabled',width);
    await sample({id:'permission-write-policy',component:'HeroUI Dropdown.Item',inMenu:true,locator:()=>menu().getByRole('menuitem',{name:'文件写入逐次由教师确认',exact:true}),sourceEvidence:'OfficeComposer.tsx: write-policy isDisabled'},'disabled',width);
  }
  await audit('final');assert.deepEqual(report.errors,[],'Renderer errors: see hash-only evidence');
  report.captureComplete=true;
}catch(error){report.fatal={...digest('fatal',error),stack:String(error.stack)};report.status='FAIL';}
finally{
  if(native&&app&&collector){
    try{
      report.devtoolsConsole=await collector.diagnostics();
      report.earlyGuard=await app.evaluate(continuationGuardRead);
      assert.equal(report.earlyGuard.networkAttempts,0);assert.equal(report.earlyGuard.modelAttempts,0);
      const known=new Set([`Request Autofill.enable failed. {"code":-32601,"message":"'Autofill.enable' wasn't found"}`,`Request Autofill.setAddresses failed. {"code":-32601,"message":"'Autofill.setAddresses' wasn't found"}`]);
      assert(report.devtoolsConsole.every(e=>e.scope==='devtools'&&e.source==='devtools://devtools/bundled/core/protocol_client/protocol_client.js'&&known.has(e.message)),'Unexpected console error');
      assert.equal(report.earlyGuard.rendererErrors,report.devtoolsConsole.length,'Unattributed early console error');
      assert.deepEqual(report.earlyGuard.events.filter(e=>e.code==='EARLY_CONSOLE_ERROR').map(e=>e.hash).sort(),report.devtoolsConsole.map(e=>hash(e.message)).sort());
    }catch(error){report.errors.push(digest('native-guard',error));}
  }
  try{await collector?.close();}catch(error){report.errors.push(digest('cdp-close',error));}
  try{await app?.close();}catch(error){report.errors.push(digest('app-close',error));}
  try{
    if(baseline){report.modelLedgerAfter=ledger();assert.deepEqual(report.modelLedgerAfter,baseline);report.ledgerReadbacks.push({label:'after-close',value:report.modelLedgerAfter});}
    report.after=verify();report.integrityVerified=true;
  }catch(error){report.integrityError=digest('integrity-or-ledger',error);}
  const properties=report.samples.flatMap(s=>Object.values(s.properties));
  report.attribution={resolved:properties.filter(p=>p.status==='resolved'||p.status==='active-declaration').length,
    noActiveDeclaration:properties.filter(p=>p.status==='no-active-declaration').length,unresolved:properties.filter(p=>p.status==='unresolved').length};
  report.success=report.captureComplete&&!report.fatal&&!report.integrityError&&!report.errors.length&&report.attribution.unresolved===0&&report.attribution.resolved>0;
  report.status=report.fatal||report.integrityError||report.errors.length?'FAIL':report.success?(native?'CAPTURED_NATIVE_CASCADE':'CAPTURED_LITERAL_SUBSET'):'PARTIAL';
  persist();console.log(JSON.stringify({output,status:report.status,captureComplete:report.captureComplete,fullAcceptance:false,samples:report.samples.length,attribution:report.attribution}));
}
if(!report.success)process.exitCode=report.status==='PARTIAL'?2:1;
