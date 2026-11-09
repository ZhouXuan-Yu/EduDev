/** A03/X01: original Electron UI, owned state, no intentional send/model/approval. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {_electron as electron} from 'playwright';
import {fingerprint} from './acceptance/evidence.mjs';
import {assertIsolatedPiMain} from './acceptance/build-root.mjs';
import {composerJourney} from './acceptance/ui-final-composer-journey.mjs';
import {zeroNetworkBootstrap} from './acceptance/zero-network-bootstrap.mjs';

const desktop=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2),pinArgs=args.filter(value=>value.startsWith('--pins=')),catalogueArgs=args.filter(value=>value.startsWith('--catalogue-from='));
const localSettings=args.includes('--local-settings');
assert(args.length===2+Number(localSettings)+catalogueArgs.length&&args.includes('--run-ui')&&pinArgs.length===1&&catalogueArgs.length<=1&&(!catalogueArgs.length||localSettings)&&
  args.every(v=>v==='--run-ui'||v==='--local-settings'||v.startsWith('--pins=')||v.startsWith('--catalogue-from=')),
  'Use --run-ui --pins=<owned JSON> [--local-settings [--catalogue-from=<owned test-results directory>]], only after parent freeze');
const owned=fs.realpathSync(path.join(desktop,'test-results'));
const ownedPath=value=>{
  const resolved=fs.realpathSync(path.resolve(desktop,value)),relative=path.relative(owned,resolved);
  assert(relative&&!path.isAbsolute(relative)&&relative!=='..'&&!relative.startsWith('..'+path.sep),'Expected path inside owned test-results');
  return resolved;
};
const catalogueRelative=path.join('data','xiaozhi-pi','deepseek-capabilities.v1.json');
const catalogueRoot=catalogueArgs.length?ownedPath(catalogueArgs[0].slice('--catalogue-from='.length)):undefined;
const sourceCatalogueFile=()=>{
  assert.equal(ownedPath(catalogueArgs[0].slice('--catalogue-from='.length)),catalogueRoot,'Catalogue source directory changed');
  assert(fs.statSync(catalogueRoot).isDirectory(),'Catalogue source must be an owned run directory');
  const file=ownedPath(path.join(catalogueRoot,catalogueRelative));
  assert.equal(file,path.join(catalogueRoot,catalogueRelative),'Fixed catalogue path must not redirect through a symlink/junction');
  const stat=fs.statSync(file);assert(stat.isFile()&&stat.size>0&&stat.size<=65536,'Expected a bounded real capability cache file');
  return {file,stamp:{dev:stat.dev,ino:stat.ino,size:stat.size,mtimeMs:stat.mtimeMs}};
};
const catalogueSource=catalogueRoot?sourceCatalogueFile():undefined;
const catalogueBytes=catalogueSource?fs.readFileSync(catalogueSource.file):undefined;
const catalogueSha256=catalogueBytes?createHash('sha256').update(catalogueBytes).digest('hex'):undefined;
let catalogueMetadata;
if(catalogueBytes){
  const saved=JSON.parse(catalogueBytes.toString('utf8'));
  assert(saved.version===1&&saved.endpoint==='https://api.deepseek.com/v1/models'&&Number.isFinite(Date.parse(saved.observedAt)),'Expected original official catalogue metadata');
  assert(Array.isArray(saved.models)&&saved.models.length>0&&saved.models.length<=32&&saved.models.every(model=>model.source==='official'&&typeof model.id==='string'&&/^[a-zA-Z0-9._-]{1,120}$/.test(model.id)),'Expected observed official model entries, not invented capabilities');
  catalogueMetadata={version:saved.version,endpoint:saved.endpoint,observedAt:saved.observedAt,modelIds:saved.models.map(model=>model.id)};
}
const pinsPath=ownedPath(pinArgs[0].slice('--pins='.length));
assert.equal(path.extname(pinsPath).toLowerCase(),'.json');
const pins=JSON.parse(fs.readFileSync(pinsPath,'utf8')),build=ownedPath(pins.buildRoot);
for(const key of ['source','build'])assert.match(pins[key],/^[a-f0-9]{64}$/);
const main=path.join(build,'main/index.js');assert(fs.statSync(main).isFile());
const output=fs.mkdtempSync(path.join(owned,'ui-final-composer-'));
const data=path.join(output,'data'),profile=path.join(output,'profile');
const catalogueDestination=path.join(output,catalogueRelative);
const testFiles=[fileURLToPath(import.meta.url),path.join(desktop,'scripts/acceptance/ui-final-composer-journey.mjs')];
const testHashes=()=>testFiles.map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}));
const report={suite:'A03-X01-composer-zero-model-subset',success:false,fullAcceptance:false,status:'RUNNING',output,pinsPath,pins,
  configurationSource:localSettings?
    `Original application loader; inherited DEEPSEEK_API_KEY ${process.env.DEEPSEEK_API_KEY?'present and retained':'absent or empty'}; desktop .env.local ${fs.existsSync(path.join(desktop,'.env.local'))?'present (contents not inspected)':'absent'}; no credential values recorded`:
    'Fresh isolated configuration; inherited credentials stripped and repository-local loader bypassed',
  ...(catalogueSource?{catalogue:{sourceRoot:catalogueRoot,sourceFile:catalogueSource.file,sourceStamp:catalogueSource.stamp,sha256:catalogueSha256,bytes:catalogueBytes.length,metadata:catalogueMetadata,destination:catalogueDestination,copied:false}}:{}),
  checks:[],launches:[],errors:[],ledgerReadbacks:[],scriptBefore:testHashes(),
  sourceReferences:['OfficeComposer.tsx','OfficeComposerState.tsx','composer-drafts.ts','PiThinkingPicker.tsx','prompt-input.tsx'],
  reusedEvidencePatterns:['pi-composer-menus-ui-smoke.mjs: original trigger/menu selectors','pi-composer-layout-ui-smoke.mjs: draft/session and geometry checks','ui-final-settings-live.mjs: owned pins, fingerprint and isolated main checks'],
  seams:['Composition/keyCode events dispatched to the actual textarea; no OS IME engine claim.','Attachment chooser intercepted by Playwright and given an empty FileList; no native OS Escape claim.','Menu keyboard checks open/navigate/Escape only; no permission/model/config selection.','All business mutations arise only from original UI session creation; test API calls are reads only.'],
  notRun:['Nonempty ordinary Enter/send, attachment-only send and idempotent admission','Sending/submitted/stopping/waiting approval and queue/steer/followUp states','Sync-write block, failed send/retry and recovery under real in-flight requests','OS IME candidate engine and native file chooser Escape','Same-environment before/after visual and configuration parity; teacher visual acceptance','Real attachment import/OCR, workspace grants, approval writes, provider/model/tool execution'],
  budget:{modelCalls:0,automaticRetries:0}};
let app,page,baseline;
const persist=()=>fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
const verify=()=>{
  assert.equal(ownedPath(pins.buildRoot),build);
  assert.equal(fingerprint(build).sha256,pins.build,'Frozen build changed');
  assert.equal(fingerprint(path.join(desktop,'src')).sha256,pins.source,'Frozen source changed');
  assert.deepEqual(testHashes(),report.scriptBefore,'QA scripts changed during execution');
  if(catalogueSource){
    report.catalogue.sourceUnchanged=false;
    const current=sourceCatalogueFile();assert.deepEqual(current,catalogueSource,'Original catalogue identity/stamp changed');
    assert.equal(createHash('sha256').update(fs.readFileSync(current.file)).digest('hex'),catalogueSha256,'Original catalogue bytes changed');
    if(report.catalogue.copied){
      assert.equal(ownedPath(catalogueDestination),catalogueDestination,'Owned catalogue destination redirected');
      assert.equal(createHash('sha256').update(fs.readFileSync(catalogueDestination)).digest('hex'),catalogueSha256,'Owned catalogue bytes changed');
    }
    report.catalogue.sourceUnchanged=true;
  }
};
const ledger=()=>{
  const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});
  try{return Object.fromEntries(['ai_agent_runs','ai_agent_run_requests','ai_agent_run_actions','ai_agent_events','xiaozhi_event_journal'].map(table=>[table,db.prepare(`SELECT count(*) AS n FROM ${table}`).get().n]));}
  finally{db.close();}
};
const assertNoAdmission=async label=>{
  const network=await app.evaluate(()=>globalThis.__composerHttp);
  assert.deepEqual(network,[],'Composer must remain zero HTTP');
  report.networkAttempts=network;
  const value=ledger();report.ledgerReadbacks.push({label,value});assert.deepEqual(value,baseline,'Unexpected run/admission/event ledger mutation');
  const sessions=await page.evaluate(async()=>{
    const list=await window.omniEdu.listAiConversations();
    return Promise.all(list.sessions.map(async session=>{const snapshot=await window.omniEdu.getXiaozhiSnapshot(session.id);return {id:session.id,running:snapshot.running,turns:snapshot.projection.turns.length,approvals:snapshot.approvals.length};}));
  });
  assert(sessions.every(session=>!session.running&&session.turns===0&&session.approvals===0),'Unexpected pending/committed turn or approval');
};
const digest=(kind,message)=>({kind,length:String(message).length,sha256:createHash('sha256').update(String(message)).digest('hex')});
async function launch(){
  verify();
  const env={...process.env};
  for(const key of Object.keys(env)){
    if(localSettings&&key==='DEEPSEEK_API_KEY')continue;
    if(/KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL/i.test(key)||key.startsWith('OMNI_EDU_')||['ELECTRON_RUN_AS_NODE','NODE_OPTIONS','ELECTRON_RENDERER_URL'].includes(key))delete env[key];
  }
  Object.assign(env,{OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_E2E_VISIBLE:'1',
    ...(localSettings?{}:{OMNI_EDU_E2E_DIALOG_MODE:'1'})});
  // Default skips local settings; explicit local mode retains only an existing
  // DeepSeek key and uses the original loader. Send/model admission stays forbidden.
  const bootstrap=zeroNetworkBootstrap({output,main,profile,counter:'__composerHttp'});
  app=await electron.launch({args:[bootstrap,'--force-device-scale-factor=1'],cwd:localSettings?desktop:output,env,timeout:60000});
  page=await app.firstWindow();page.setDefaultTimeout(12000);
  page.on('pageerror',error=>report.errors.push(digest('pageerror',error.message)));
  page.on('console',message=>{if(message.type()==='error')report.errors.push(digest('console.error',message.text()));});
  report.launches.push({pid:app.process().pid,...await assertIsolatedPiMain(app,main,profile)});
  await page.getByTestId('xiaozhi-pi-workspace').waitFor({timeout:60000});
  await page.waitForFunction(()=>{const input=document.querySelector('[data-testid="office-prompt-input"]');return input&&!input.disabled;});
  assert.equal(path.resolve(await page.evaluate(()=>window.omniEdu.getDataRoot())),data);
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setContentSize(1366,768));
  return page;
}
const check=async(id,name,work)=>{
  report.active=id;persist();
  try{await work();await assertNoAdmission(id);report.checks.push({id,name,status:'PASS'});persist();}
  catch(error){
    report.checks.push({id,name,status:'FAIL',message:String(error.message)});
    await page?.screenshot({path:path.join(output,id+'-failure.png')}).catch(()=>{});
    fs.writeFileSync(path.join(output,id+'-stack.txt'),String(error.stack));persist();throw error; // No downstream actions after admission/focus failure.
  }
};
const notRun=(id,reason)=>{report.checks.push({id,status:'NOT_RUN',reason});persist();};
try{
  persist();verify();report.sourceBefore=fingerprint(path.join(desktop,'src')).sha256;report.buildBefore=fingerprint(build).sha256;
  if(catalogueBytes){
    fs.mkdirSync(path.dirname(catalogueDestination),{recursive:true});
    assert.equal(ownedPath(path.dirname(catalogueDestination)),path.dirname(catalogueDestination),'Catalogue destination must stay in fresh owned data');
    fs.writeFileSync(catalogueDestination,catalogueBytes,{flag:'wx'});report.catalogue.copied=true;
    report.seams.push('Explicit local-settings catalogue: original owned official cache copied byte-for-byte only; no DB/profile/credential copied or capability fabricated.');
    verify();persist();
  }
  await launch();baseline=ledger();report.modelLedgerBefore=baseline;
  for(const table of ['ai_agent_runs','ai_agent_run_requests','ai_agent_run_actions','ai_agent_events'])assert.equal(baseline[table],0,'Fresh profile must have a zero run ledger');
  await assertNoAdmission('initial');
  await composerJourney({getPage:()=>page,output,report,check,notRun,assertNoAdmission,
    resize:async(width,height)=>{await app.evaluate(({BrowserWindow},size)=>BrowserWindow.getAllWindows()[0].setContentSize(size.width,size.height),{width,height});await page.waitForFunction(size=>innerWidth===size.width&&innerHeight===size.height,{width,height});},
    relaunch:async()=>{await app.close();app=undefined;return launch();}});
  await assertNoAdmission('final');report.modelLedgerAfter=ledger();assert.deepEqual(report.errors,[]);
  report.success=report.checks.length>0&&report.checks.every(item=>item.status==='PASS');
  report.status=report.success?'PASS_SUBSET':'PARTIAL';
}catch(error){report.status='FAIL';report.fatal={message:String(error.message),stack:String(error.stack)};}
finally{
  await app?.close().catch(error=>{report.success=false;report.status='FAIL';report.closeError=String(error.message);});
  try{if(baseline){report.modelLedgerAfterClose=ledger();assert.deepEqual(report.modelLedgerAfterClose,baseline);}verify();report.sourceAfter=fingerprint(path.join(desktop,'src')).sha256;report.buildAfter=fingerprint(build).sha256;report.integrityVerified=true;}
  catch(error){report.success=false;report.status='FAIL';report.integrityError=String(error.stack);}
  // Keep only this run's owned evidence. No recursive deletes, global restart paths or process-name cleanup.
  persist();console.log(JSON.stringify({status:report.status,success:report.success,fullAcceptance:false,output,counts:report.checks.reduce((counts,item)=>(counts[item.status]=(counts[item.status]||0)+1,counts),{})}));
}
if(!report.success)process.exitCode=report.status==='PARTIAL'?2:1;
