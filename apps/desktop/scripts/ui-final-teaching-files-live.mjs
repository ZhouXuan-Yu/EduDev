/** Read the already approved real six Office outputs through Teaching Files.
 * The complete original is archived before its actual absolute-path profile opens.
 * No generation, approval, restore, OS opening or source change is requested.
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {_electron as electron} from 'playwright';
import {fingerprint,sha256} from './acceptance/evidence.mjs';
import {assertIsolatedPiMain} from './acceptance/build-root.mjs';
import {continuationBootstrap,continuationGuardRead} from './acceptance/paper-adaptation-continuation.mjs';
import {productEntry} from './product-navigation.mjs';

const desktop=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const arg=process.argv.find(x=>x.startsWith('--pins='));assert(arg,'--pins=<current frozen build> required');
const pins=JSON.parse(fs.readFileSync(path.resolve(desktop,arg.slice(7))));
assert.equal(fingerprint(path.join(desktop,'src')).sha256,pins.source);assert.equal(fingerprint(pins.buildRoot).sha256,pins.build);
const original=fs.realpathSync(path.join(desktop,'test-results/ui-final-c2-office-live-AkJuza'));
const data=path.join(original,'data'),profile=path.join(original,'profile'),workspace=path.join(original,'workspace');
const fixture=JSON.parse(fs.readFileSync(path.join(original,'current-c2-office-fixture.json')));
const old=JSON.parse(fs.readFileSync(path.join(original,'pi-office-six.json')));
assert.equal(old.success,false,'Retain original full-run failure, use separate exact-file proof');assert.equal(old.deliveries.length,6);
const proven=JSON.parse(fs.readFileSync(path.join(desktop,'test-results/ui-final-office-continuation-FOrMfO/verified-six-facts.json')));
assert.equal(proven.success,true);assert.equal(proven.files.length,6);
for(const f of proven.files){assert(old.deliveries.some(d=>d.artifactId===f.artifactId&&d.path===f.path));assert.equal(sha256(fs.readFileSync(f.path)),f.sha256);}
const output=fs.mkdtempSync(path.join(desktop,'test-results/ui-final-teaching-files-')),archive=path.join(output,'original-archive');
const originalBefore=fingerprint(original),workspaceBefore=fingerprint(workspace).sha256,report={success:false,output,pins,checks:[],screens:[],errors:[],launches:0,
  originalReportSuccess:false,files:proven.files.map(f=>({artifactId:f.artifactId,sha256:f.sha256})),
  boundaries:['Existing actual approved six files; old failure is not converted to PASS. Original full archive precedes launch.',
    'Teaching Files search/select/current preview/source conversation/return and narrow file actions only.',
    'No model, new generation, restore, OS open, approval, file edit or teacher correctness claim. Version mutations require their own evidence.']};
const deadline=Date.now()+180000,flush=()=>fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn,label,max=15000){const end=Math.min(Date.now()+max,deadline);while(Date.now()<end){if(await fn())return;await delay(100);}throw Error('Timed out: '+label);}
function ledger(){const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});try{return Object.fromEntries(['ai_agent_runs','ai_agent_run_requests','xiaozhi_pi_commands','xiaozhi_pi_usage','xiaozhi_tool_receipts','xiaozhi_pi_office_drafts','document_artifacts','document_artifact_paper_sources','question_bank_items','ai_confirmation_items','paper_template_versions','paper_template_receipts'].map(t=>[t,sha256(JSON.stringify(db.prepare('SELECT * FROM '+t+' ORDER BY rowid').all()))]));}finally{db.close();}}
const before=ledger();let app,page,child;
async function capture(label){const file=label+'.png';await page.screenshot({path:path.join(output,file),animations:'disabled'});report.screens.push({file,sha256:sha256(fs.readFileSync(path.join(output,file)))});flush();}
async function size(width,height){await app.evaluate(({BrowserWindow},s)=>BrowserWindow.getAllWindows()[0].setContentSize(s.width,s.height),{width,height});await until(()=>page.evaluate(s=>innerWidth===s.width&&innerHeight===s.height,{width,height}),'viewport');}
async function files(){await productEntry(page,'teaching').click();await page.getByTestId('teaching-page-navigation').getByTestId('hub-entry-artifacts').click();await page.getByTestId('teaching-artifacts-workspace').waitFor();}
try{
  flush();fs.cpSync(original,archive,{recursive:true,force:false,errorOnExist:true});assert.equal(fingerprint(archive).sha256,originalBefore.sha256);assert.equal(fingerprint(original).sha256,originalBefore.sha256);
  report.archive={path:archive,sha256:originalBefore.sha256};report.checks.push({id:'ARCHIVE_EXACT',status:'pass'});flush();
  const bootstrap=path.join(output,'bootstrap.cjs');fs.writeFileSync(bootstrap,continuationBootstrap({main:path.join(pins.buildRoot,'main/index.js'),profile,diagnosticFile:path.join(output,'bootstrap-state.json')}));
  const env={...process.env};for(const k of Object.keys(env))if(/KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL/i.test(k)||k.startsWith('OMNI_EDU_')||['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL'].includes(k))delete env[k];
  Object.assign(env,{NODE_ENV:'development',OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),OMNI_EDU_XIAOZHI_PI:'1'});
  app=await electron.launch({args:[bootstrap,'--force-device-scale-factor=1'],cwd:desktop,env,timeout:30000});child=app.process();report.launches++;
  page=await app.firstWindow({timeout:25000});page.setDefaultTimeout(12000);page.on('pageerror',e=>report.errors.push({code:'PAGE_ERROR',hash:sha256(e.stack||e.message)}));page.on('console',m=>{if(m.type()==='error')report.errors.push({code:'CONSOLE_ERROR',hash:sha256(m.text())});});
  await page.getByTestId('xiaozhi-pi-workspace').waitFor({timeout:25000});report.main=await assertIsolatedPiMain(app,path.join(pins.buildRoot,'main/index.js'),profile);
  assert.equal(path.resolve(await page.evaluate(()=>window.omniEdu.getDataRoot())),path.resolve(data));report.guardBefore=await app.evaluate(continuationGuardRead,true);await page.emulateMedia({colorScheme:'light'});
  const catalogue=await page.evaluate(()=>window.omniEdu.listDocumentArtifacts());
  const currentRows=catalogue.filter(row=>!row.officeVersion||row.officeVersion.currentArtifactId===row.id);
  const targets=new Set(proven.files.map(f=>f.artifactId));for(const id of targets)assert(currentRows.some(row=>row.id===id),'Every exact approved target remains in the true current catalogue');
  const currentIds=currentRows.map(r=>r.id).sort();report.catalogue={currentIds,targets:[...targets]};
  const ids=()=>page.locator('table[aria-label="教学文件列表"] tbody tr').evaluateAll(rows=>rows.map(r=>r.dataset.testid.slice('artifact-'.length)).sort());
  await files();const search=page.getByTestId('artifacts-search');
  for(const format of ['docx','pdf']){await search.fill(format);const expected=currentRows.filter(r=>[r.title,r.fileName,r.type].some(value=>value.toLowerCase().includes(format))).map(r=>r.id).sort();await until(async()=>JSON.stringify(await ids())===JSON.stringify(expected),'exact real format membership');}
  await search.fill('');await until(async()=>JSON.stringify(await ids())===JSON.stringify(currentIds),'clear restores actual current catalogue');
  report.checks.push({id:'REAL_FILE_SEARCH_CLEAR',status:'pass'});
  for(const f of proven.files){
    const row=page.getByTestId('artifact-'+f.artifactId);await row.getByRole('button').click();await page.getByTestId('artifacts-preview').click();
    const panel=page.getByTestId('pi-file-panel');await panel.waitFor();await panel.getByTestId('pi-file-document').waitFor({timeout:30000});
    assert((await panel.getByTestId('pi-file-document').innerText()).trim().length>25,'Actual local Office text reader');assert.equal(await panel.locator('[role="alert"]').count(),0);
    report.checks.push({id:'SAVED_FILE_PREVIEW',status:'pass',artifactId:f.artifactId});
    await panel.getByTestId('pi-files-close').click();await panel.waitFor({state:'hidden'});
  }
  const target=proven.files[0];await page.getByTestId('artifact-'+target.artifactId).getByRole('button').click();await page.getByTestId('artifacts-preview').click();await page.getByTestId('pi-file-document').waitFor({timeout:30000});
  for(const [width,height] of [[800,768],[1366,768],[1920,1080]]){await size(width,height);for(const id of ['pi-files-refresh','pi-files-explorer-toggle','pi-files-close']){const button=page.getByTestId(id);await button.scrollIntoViewIfNeeded();await button.focus();const b=await button.boundingBox();assert(b&&b.x>=0&&b.x+b.width<=width&&b.y>=0&&b.y+b.height<=height,'File action within viewport');}assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await capture('files-preview-'+width);}
  await page.getByTestId('pi-files-close').click();await page.getByTestId('artifacts-conversation').click();await until(()=>page.locator('.office-composer-container:visible').getAttribute('data-session-id').then(x=>x===fixture.sessionId),'original source conversation binding');
  await files();await until(async()=>JSON.stringify(await ids())===JSON.stringify(currentIds),'return to same saved catalogue');
  report.checks.push({id:'FILE_ACTIONS_RESPONSIVE_SOURCE_RETURN',status:'pass'});report.guardAfter=await app.evaluate(continuationGuardRead,true);
  assert.equal(report.guardAfter.networkAttempts,0);assert.equal(report.guardAfter.modelAttempts,0);assert.equal(report.guardAfter.rendererErrors,0);assert.equal(report.errors.length,0);
  await app.close();app=undefined;await until(()=>child.exitCode!==null||child.signalCode!==null,'owned Electron exited');assert.deepEqual(ledger(),before);
  assert.equal(fingerprint(workspace).sha256,workspaceBefore);assert.equal(fingerprint(archive).sha256,originalBefore.sha256);for(const f of proven.files)assert.equal(sha256(fs.readFileSync(f.path)),f.sha256);
  assert.equal(fingerprint(path.join(desktop,'src')).sha256,pins.source);assert.equal(fingerprint(pins.buildRoot).sha256,pins.build);report.checks.push({id:'NO_MODEL_OR_DOMAIN_MUTATION',status:'pass'});report.success=true;
}catch(error){report.failure={name:error.name,message:String(error.message).replace(/sk-[\w-]+/g,'[credential]').slice(0,900),hash:sha256(error.stack||String(error))};if(page&&!page.isClosed())try{await capture('failure');}catch{}}
finally{if(app)try{await app.close();}catch(error){report.errors.push({code:'CLOSE',hash:sha256(error.stack||String(error))});}
  try{assert.deepEqual(ledger(),before);assert.equal(fingerprint(workspace).sha256,workspaceBefore);if(fs.existsSync(archive))assert.equal(fingerprint(archive).sha256,originalBefore.sha256);for(const f of proven.files)assert.equal(sha256(fs.readFileSync(f.path)),f.sha256);assert.equal(fingerprint(path.join(desktop,'src')).sha256,pins.source);assert.equal(fingerprint(pins.buildRoot).sha256,pins.build);report.exitIntegrity=true;}
  catch(error){report.exitIntegrity=false;report.success=false;report.errors.push({code:'EXIT_INTEGRITY',hash:sha256(error.stack||String(error))});}flush();}
console.log(JSON.stringify({output,success:report.success,checks:report.checks.length,failure:report.failure}));if(!report.success)process.exitCode=1;
