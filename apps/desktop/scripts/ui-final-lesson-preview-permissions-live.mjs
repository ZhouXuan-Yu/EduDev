/** A14/A18: original saved lesson parser UI + two actual sessions, zero model.
 * One launch / 120 seconds including bounded cleanup. No generation or grant changes.
 * The original full archive is evidence, never silently restored over the source.
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {fingerprint,sha256} from './acceptance/evidence.mjs';
import {assertIsolatedPiMain} from './acceptance/build-root.mjs';
import {continuationBootstrap,continuationGuardRead,closeContinuationRuntime,continuationImmutableInventory} from './acceptance/paper-adaptation-continuation.mjs';
import {productEntry} from './product-navigation.mjs';
import {OWNER,TITLE,readFixture,assertIdleOriginal,fileFact,versionOf,ledger,assertLedger,assertGuard,assertCatalogue,assertVersion,selfCheck} from './acceptance/lesson-preview-permissions.mjs';

const desktop=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2),get=name=>args.filter(a=>a.startsWith('--'+name+'='));
const qaFiles=['scripts/ui-final-lesson-preview-permissions-live.mjs','scripts/acceptance/lesson-preview-permissions.mjs',
  'scripts/acceptance/paper-adaptation-continuation.mjs','scripts/acceptance/evidence.mjs','scripts/acceptance/build-root.mjs','scripts/product-navigation.mjs'];
const qa=()=>qaFiles.map(file=>({file,sha256:sha256(fs.readFileSync(path.join(desktop,file)))}));
function pinsInput(){
  assert.equal(get('pins').length,1,'LESSON_EXACT_CURRENT_PINS_REQUIRED');
  const file=path.resolve(desktop,get('pins')[0].slice(7)),owned=fs.realpathSync(path.join(desktop,'test-results'));
  const own=p=>{const real=fs.realpathSync(p),rel=path.relative(owned,real);assert.equal(real,path.resolve(p));assert(rel&&!path.isAbsolute(rel)&&rel!=='..'&&!rel.startsWith('..'+path.sep),'LESSON_OWNED_PINS_BUILD');return real;};
  own(file);const bytes=fs.readFileSync(file),pins=JSON.parse(bytes);own(pins.buildRoot);
  const beforeQa=qa(),verify=()=>{assert.equal(sha256(fs.readFileSync(file)),sha256(bytes),'LESSON_PINS_CHANGED');assert.equal(fingerprint(path.join(desktop,'src')).sha256,pins.source,'LESSON_SOURCE_CHANGED');assert.equal(fingerprint(pins.buildRoot).sha256,pins.build,'LESSON_BUILD_CHANGED');assert.deepEqual(qa(),beforeQa,'LESSON_QA_CHANGED');};
  verify();return {pins,file,beforeQa,verify};
}
async function main(){
  const pinned=pinsInput(),fixture=readFixture(desktop);assertIdleOriginal(fixture.root);
  const output=fs.mkdtempSync(path.join(desktop,'test-results/ui-final-lesson-preview-permissions-'));
  const report={success:false,actual:'NOT_RUN',output,pins:pinned.pins,qa:pinned.beforeQa,launches:0,checks:[],screens:[],errors:[],
    fixture:{root:fixture.root,dataRoot:fixture.data,profile:fixture.profile,outputDirectory:fixture.directory,sessionId:OWNER,oldReportHash:fixture.oldReportHash,files:fixture.files},
    boundaries:['Original QklMXy full archive before one current-build launch; original absolute data/profile/output paths.',
      'Only explicit domain write: one real UI empty conversation. Existing session rows, sources, approval/usage/command/run/file facts unchanged.',
      'Original PiWorkspaceFiles local parser text; no original Office pagination or natural model quality claim.',
      'No model, HTTP, workspace selection, grant change, OS open, generation, restore or business SQL writes.']};
  const flush=()=>fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
  const before=ledger(fixture.data),nativePath=path.join(fixture.data,'xiaozhi-pi'),nativeBefore=fingerprint(nativePath).sha256;
  const immutableBefore=continuationImmutableInventory(fixture.root).sha256,generatedBefore=fingerprint(fixture.generated).sha256;
  const originalBefore=fingerprint(fixture.root),archive=path.join(output,'original-full-archive');
  let app,page,child,newSession,attemptedNew=false,deadlineAt,closedAt,hardTimer,workflowTimer,workflowPassed=false,archiveVerified=false,phase='ARCHIVE';
  const guardFile=path.join(output,'exit-guard.json'),delay=ms=>new Promise(r=>setTimeout(r,ms));
  const check=(id,details={})=>{report.checks.push({id,pass:true,...details});flush();};
  const diagnostic=e=>{const stack=String(e?.stack||e);return {code:String(e?.message||'').match(/\bLESSON_[A-Z0-9_]+\b/)?.[0]||'LESSON_QA_FAILURE',phase,name:e?.name,
    qaFrames:[...stack.replaceAll('\\','/').matchAll(/(scripts\/(?:acceptance\/lesson-preview-permissions|ui-final-lesson-preview-permissions-live)\.mjs):(\d+):(\d+)/g)].slice(0,6).map(m=>({file:m[1],line:Number(m[2]),column:Number(m[3])})),hash:sha256(stack)};};
  const fail=(code,e)=>{report.errors.push({...diagnostic(e),code});report.success=false;};
  const forceClose=()=>{if(child?.exitCode===null&&child?.signalCode===null){assert(Number.isInteger(child.pid)&&child.pid>0&&child.pid!==process.pid);if(process.platform==='win32'){const killer=spawn('taskkill.exe',['/PID',String(child.pid),'/T','/F'],{stdio:'ignore',windowsHide:true});killer.on('error',e=>fail('OWNED_FORCE_CLOSE_ERROR',e));}else child.kill('SIGKILL');}};
  async function until(fn,label,max=12000){const end=Math.min(Date.now()+max,deadlineAt-12000);while(Date.now()<end){if(await fn())return;await delay(80);}throw Error('LESSON_TIMEOUT_'+label);}
  async function screenshot(name){const file=path.join(output,name+'.png');await page.screenshot({path:file,animations:'disabled',timeout:5000});report.screens.push({file,sha256:sha256(fs.readFileSync(file))});flush();}
  async function viewport(width,height){await app.evaluate(({BrowserWindow},s)=>BrowserWindow.getAllWindows()[0].setContentSize(s.width,s.height),{width,height});await until(()=>page.evaluate(s=>innerWidth===s.width&&innerHeight===s.height,{width,height}),'VIEWPORT');}
  const input=(sessionId,artifactId)=>({schemaVersion:'xiaozhi.office-versions.v1',sessionId,artifactId,action:'view'});
  async function ownerView(f){const result=await page.evaluate(i=>window.omniEdu.officeVersion(i),input(OWNER,f.artifactId));const v=assertVersion(result,OWNER,f.artifactId);assert.equal(v.versions[0].format,f.format);assert.equal(v.versions[0].size,f.bytes);assert.equal(v.versions[0].path,f.name);return v;}
  async function parserProof(f){
    const result=await page.evaluate(async({sessionId,name})=>{
      const listed=await window.omniEdu.listXiaozhiFiles({schemaVersion:'xiaozhi.files.v1',sessionId,path:'.',requestId:'xifile_'+crypto.randomUUID()});
      if(!listed.ok)return {ok:false,error:listed.error};
      const matches=listed.data.entries.filter(e=>e.path===name&&e.kind==='file');if(matches.length!==1)return {ok:false,error:'exact_file_missing'};
      return window.omniEdu.previewXiaozhiFile({schemaVersion:'xiaozhi.files.v1',sessionId,path:name,requestId:'xifile_'+crypto.randomUUID(),workspaceVersion:listed.workspaceVersion,version:matches[0].version});
    },{sessionId:OWNER,name:f.name});
    assert.equal(result.ok,true,'LESSON_ORIGINAL_READER_FAILED');const v=result.data;
    assert.equal(v.path,f.name);assert.equal(v.size,f.bytes);assert.equal(v.version,versionOf(f));assert.equal(v.format,'office');assert.equal(v.document.format,f.format);
    assert.equal(v.document.parser,'hana-anydoc-0.1.2');assert(v.text.trim().length>100&&v.text.replaceAll(/\s/g,'').includes(fixture.title.replaceAll(/\s/g,'')),'LESSON_PARSER_BODY');
    assert.deepEqual(fileFact(f.file),Object.fromEntries(Object.entries(f).filter(([k])=>!['artifactId','format','name','source'].includes(k))),'LESSON_FILE_CHANGED_DURING_PARSE');
    return {artifactId:f.artifactId,fileHash:f.sha256,fileVersion:v.version,format:v.document.format,parser:v.document.parser,bodyHash:sha256(v.text),bodyChars:v.text.length};
  }
  async function uiBody(f){const doc=page.getByTestId('pi-file-document');await doc.waitFor({state:'visible',timeout:18000});const text=await doc.innerText();assert(text.trim().length>100&&text.replaceAll(/\s/g,'').includes(fixture.title.replaceAll(/\s/g,'')),'LESSON_REAL_UI_BODY');assert((await doc.getByTestId('pi-file-document-info').innerText()).startsWith(f.format.toUpperCase()));assert.equal(await page.getByTestId('saved-artifact-preview').count(),0);assert.equal(await page.getByTestId('pi-file-panel').locator('[role="alert"]').count(),0);return {bodyHash:sha256(text),bodyChars:text.length};}
  async function exercise(){
    phase='LAUNCH';const mainFile=path.join(pinned.pins.buildRoot,'main/index.js'),bootstrap=path.join(output,'owned-bootstrap.cjs');
    const exitHook=`process.once('exit',()=>{const state=globalThis.__paperContinuationGuard?.state;require('node:fs').writeFileSync(${JSON.stringify(guardFile)},JSON.stringify({guard:state??null}),{flag:'wx'});});\n`;
    fs.writeFileSync(bootstrap,exitHook+continuationBootstrap({main:mainFile,profile:fixture.profile,diagnosticFile:path.join(output,'bootstrap-state.json')}),{flag:'wx'});
    const env={...process.env};for(const k of Object.keys(env))if(/KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL/i.test(k)||k.startsWith('OMNI_EDU_')||['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL'].includes(k))delete env[k];
    Object.assign(env,{OMNI_EDU_DATA_ROOT:fixture.data,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_E2E_DIALOG_MODE:'1'});
    const { _electron:electron }=await import('playwright');report.launches++;assert.equal(report.launches,1);flush();
    app=await electron.launch({args:[bootstrap,'--user-data-dir='+fixture.profile,'--force-device-scale-factor=1'],cwd:desktop,env,timeout:25000});child=app.process();
    page=await app.firstWindow({timeout:20000});page.setDefaultTimeout(8000);page.on('pageerror',e=>fail('PAGE_ERROR',e));page.on('console',m=>{if(m.type()==='error')fail('CONSOLE_ERROR',m.text());});
    await page.getByTestId('xiaozhi-pi-workspace').waitFor({timeout:20000});phase='ORIGINAL_STORAGE';
    report.main=await assertIsolatedPiMain(app,mainFile,fixture.profile);assert.equal(path.resolve(await page.evaluate(()=>window.omniEdu.getDataRoot())),fixture.data,'LESSON_ACTUAL_DATAROOT');
    const storage=await app.evaluate(({session})=>session.defaultSession.storagePath);assert.equal(path.resolve(storage),fixture.profile,'LESSON_ORIGINAL_SESSION_STORAGE');
    report.guardBefore=await app.evaluate(continuationGuardRead,true);assertGuard(report.guardBefore);
    assertLedger(before,ledger(fixture.data),undefined);check('ORIGINAL_PATH_AND_EARLY_ZERO_HTTP_GUARD');
    await page.emulateMedia({colorScheme:'light'});phase='CATALOGUE';
    const catalogue=await page.evaluate(()=>window.omniEdu.listDocumentArtifacts());assertCatalogue(catalogue,fixture.files);report.catalogue=fixture.files.map(f=>({artifactId:f.artifactId,route:'PiWorkspaceFiles',paperKind:false,officeVersion:false}));
    await productEntry(page,'teaching').click();await page.getByTestId('teaching-page-navigation').getByTestId('hub-entry-artifacts').click();await page.getByTestId('teaching-artifacts-workspace').waitFor();
    check('EXACT_LESSON_CATALOGUE_ORIGINAL_READER');report.previews=[];report.views=[];
    for(const f of fixture.files){
      phase='PREVIEW_'+f.format.toUpperCase();await viewport(1366,768);await page.getByTestId('artifact-'+f.artifactId).getByRole('button').click();await page.getByTestId('artifacts-preview').click();
      const first=await uiBody(f),proof=await parserProof(f),view=await ownerView(f);report.views.push(view);const layouts=[];
      for(const [width,height] of [[800,768],[1366,768],[1920,1080]]){
        await viewport(width,height);const panel=page.getByTestId('pi-file-panel');
        for(const id of ['pi-files-refresh','pi-files-close']){const button=panel.getByTestId(id);await button.scrollIntoViewIfNeeded();await button.focus();assert(await button.evaluate(el=>el===document.activeElement));const box=await button.boundingBox();assert(box&&box.x>=0&&box.y>=0&&box.x+box.width<=width&&box.y+box.height<=height,'LESSON_ACTION_VISIBLE');}
        if(width===800){
          await panel.getByTestId('pi-files-refresh').click();await until(async()=>await panel.getByTestId('pi-file-document').count()===0,'REFRESH_CLEARS_PREVIEW');
          const entry=panel.getByTestId('pi-file-entry-'+f.name);if(!await entry.isVisible())await panel.getByTestId('pi-files-explorer-toggle').click();await entry.click();
          const refreshed=await uiBody(f);assert.equal(refreshed.bodyHash,first.bodyHash,'LESSON_REFRESH_SAME_BODY');
        }
        const geometry=await panel.evaluate(el=>({width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height,pageOverflow:document.documentElement.scrollWidth>innerWidth,bodyWidth:el.querySelector('[data-testid="pi-file-document"]').getBoundingClientRect().width}));
        assert(!geometry.pageOverflow&&geometry.bodyWidth>=200,'LESSON_PREVIEW_LAYOUT');layouts.push({width,height,...geometry});await screenshot('lesson-'+f.format+'-'+width);
      }
      await page.getByTestId('pi-files-close').click();await page.getByTestId('pi-file-panel').waitFor({state:'hidden'});
      report.previews.push({...proof,ui:first,layouts});check('ORIGINAL_'+f.format.toUpperCase()+'_PREVIEW_REFRESH_CLOSE_THREE_WIDTHS');
    }
    phase='NEW_EMPTY_SESSION';await productEntry(page,'ask').click();const nav=page.locator('[data-testid="edu-navigation"]:visible');
    await nav.getByTestId('workbench-new-session').click();const dialog=page.getByTestId('workbench-new-dialog');await dialog.getByPlaceholder('为这次教学任务命名').fill(TITLE);await dialog.getByRole('combobox',{name:'教学空间',exact:true}).selectOption('');
    attemptedNew=true;await dialog.getByRole('button',{name:'创建对话',exact:true}).and(dialog.locator('button[type="submit"]')).click();
    await until(async()=>{const current=await page.locator('.office-composer-container:visible').getAttribute('data-session-id');if(current&&current!==OWNER&&!before.sessions.some(s=>s.id===current)){newSession=current;return true;}return false;},'REAL_NEW_SESSION');
    report.expectedSessionDelta=assertLedger(before,ledger(fixture.data),newSession,true);flush();
    const empty=await page.evaluate(async id=>{const s=await window.omniEdu.getXiaozhiSnapshot(id);return {running:s.running,turns:s.projection.turns.length};},newSession);assert.deepEqual(empty,{running:false,turns:0});
    report.permissions=[];
    for(const f of fixture.files){const denied=await page.evaluate(i=>window.omniEdu.officeVersion(i),input(newSession,f.artifactId));assert.deepEqual(denied,{ok:false,error:'permission_denied'},'LESSON_CROSS_SESSION_DENIAL');report.permissions.push({sessionId:newSession,artifactId:f.artifactId,result:denied});}
    check('TWO_REAL_SESSIONS_EXACT_ARTIFACT_PERMISSION_DENIED');
    await nav.getByTestId('workbench-session-'+OWNER).click();await until(async()=>await page.locator('.office-composer-container:visible').getAttribute('data-session-id')===OWNER,'OWNER_RETURN');
    for(const f of fixture.files)assert.deepEqual(await ownerView(f),report.views.find(v=>v.selectedArtifactId===f.artifactId),'LESSON_OWNER_AFTER_DENIAL');
    check('ORIGINAL_OWNER_STILL_SAME_RESTORE_FALSE');report.guardAfter=await app.evaluate(continuationGuardRead,true);assertGuard(report.guardAfter);assert.equal(report.errors.length,0);workflowPassed=true;
  }
  try{
    flush();fs.cpSync(fixture.root,archive,{recursive:true,force:false,errorOnExist:true});assert.equal(fingerprint(archive).sha256,originalBefore.sha256);assert.equal(fingerprint(fixture.root).sha256,originalBefore.sha256);archiveVerified=true;
    report.archive={path:archive,sha256:originalBefore.sha256};for(const [i,s] of fixture.sources.entries()){const copy=path.join(output,'source-'+i+'.archive');fs.copyFileSync(s.file,copy,fs.constants.COPYFILE_EXCL);assert.equal(sha256(fs.readFileSync(copy)),s.sha256);}
    pinned.verify();assertIdleOriginal(fixture.root);check('FULL_ORIGINAL_ARCHIVE_HASH_VERIFIED');
    deadlineAt=Date.now()+120000;report.startedAt=new Date().toISOString();
    hardTimer=setTimeout(()=>{fail('LESSON_HARD_120_SECOND_DEADLINE',Error('deadline'));forceClose();},120000);
    await Promise.race([exercise(),new Promise((_,reject)=>{workflowTimer=setTimeout(()=>reject(Error('LESSON_UI_108_SECOND_DEADLINE')),108000);})]);
  }catch(e){report.failure=diagnostic(e);if(page&&!page.isClosed())try{await screenshot('failure');}catch{}}
  finally{
    clearTimeout(workflowTimer);phase='CLOSE';
    if(app){report.cleanup=await closeContinuationRuntime({observeGuard:()=>app.evaluate(continuationGuardRead,true),close:()=>app.close(),forceClose,deadlineAt:deadlineAt??Date.now()+8000,cap:4000});if(!report.cleanup.closed)fail('LESSON_CLOSE_FAILED',report.cleanup);try{assertGuard(report.cleanup.guard);}catch(e){fail('LESSON_FINAL_LIVE_GUARD',e);}}
    try{
      if(child){const end=Math.min(Date.now()+4000,deadlineAt);while(child.exitCode===null&&child.signalCode===null&&Date.now()<end)await delay(50);assert(child.exitCode!==null||child.signalCode!==null,'LESSON_PROCESS_NOT_EXITED');closedAt=Date.now();assert.equal(child.exitCode,0,'LESSON_PROCESS_EXIT_CODE');
        const f=fileFact(guardFile);assert(f.bytes<65536);report.exitGuard=JSON.parse(fs.readFileSync(guardFile)).guard;assertGuard(report.exitGuard);}
    }catch(e){fail('LESSON_EXIT_GUARD_OR_PROCESS',e);}finally{clearTimeout(hardTimer);}
    phase='EXIT_INTEGRITY';
    try{
      assert(!child||closedAt,'LESSON_NO_POSTEXIT_CLAIM_WHILE_PROCESS_ACTIVE');
      const after=ledger(fixture.data);report.sessionIdsAfter=after.sessions.map(s=>s.id);
      // If UI timed out after creating the intended session, still identify its
      // exact delta for failure reporting. This never converts the failure to PASS.
      if(!newSession&&attemptedNew){const extra=after.sessions.filter(s=>!before.sessions.some(b=>b.id===s.id));if(extra.length===1&&extra[0].title===TITLE)newSession=extra[0].id;}
      report.sessionDeltaAfterClose=assertLedger(before,after,newSession,workflowPassed);
      report.ledgerBefore=before.tables;report.ledgerAfter=after.tables;
      assert.equal(fingerprint(nativePath).sha256,nativeBefore,'LESSON_NATIVE_CHANGED');assert.equal(fingerprint(fixture.generated).sha256,generatedBefore,'LESSON_OUTPUT_DIRECTORY_CHANGED');
      for(const f of [...fixture.files,...fixture.sources]){const expected=Object.fromEntries(Object.entries(f).filter(([k])=>!['artifactId','format','name','source'].includes(k)));assert.deepEqual(fileFact(f.file),expected,'LESSON_FILE_OR_SOURCE_CHANGED');}
      assert.equal(continuationImmutableInventory(fixture.root).sha256,immutableBefore,'LESSON_ORIGINAL_EVIDENCE_CHANGED');
      if(archiveVerified)assert.equal(fingerprint(archive).sha256,originalBefore.sha256,'LESSON_ARCHIVE_CHANGED');else assert(!report.launches,'LESSON_LAUNCHED_WITHOUT_ARCHIVE');
      pinned.verify();report.exitIntegrity=true;
    }catch(e){report.exitIntegrity=false;fail('LESSON_EXIT_INTEGRITY',e);}
    report.elapsedRuntimeMs=deadlineAt?(closedAt??Date.now())-(deadlineAt-120000):0;
    report.success=workflowPassed&&!report.failure&&report.errors.length===0&&report.exitIntegrity&&report.launches===1;
    report.actual=report.success?'PASS':'FAIL';flush();
  }
  console.log(JSON.stringify({success:report.success,output,checks:report.checks.length,launches:report.launches,exitIntegrity:report.exitIntegrity,failure:report.failure}));if(!report.success)process.exitCode=1;
}
if(args.includes('--self-check'))console.log(JSON.stringify(selfCheck()));
else if(args.includes('--preflight-only')){const p=pinsInput(),f=readFixture(desktop);assertIdleOriginal(f.root);const l=ledger(f.data);console.log(JSON.stringify({prepared:true,launches:0,modelCalls:0,writes:0,pins:p.file,dataRoot:f.data,profile:f.profile,outputDirectory:f.directory,files:f.files.map(({artifactId,format,sha256,bytes})=>({artifactId,format,sha256,bytes})),protectedTables:Object.keys(l.tables),sessions:l.sessions.map(s=>s.id)}));}
else if(args.includes('--help'))console.log('node scripts/ui-final-lesson-preview-permissions-live.mjs --pins=<current-owned-pins.json> [--preflight-only]; --self-check is offline. Exact QklMXy full archive, original data/profile, one launch <=120s, zero HTTP/model, one UI-created empty session.');
else await main();
