/** Bounded settings-only actual Electron acceptance. No build, seed, model or retry. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {_electron as electron} from 'playwright';
import {fingerprint} from './acceptance/evidence.mjs';
import {assertIsolatedPiMain} from './acceptance/build-root.mjs';
import {settingsJourney} from './acceptance/ui-final-settings-journey.mjs';

const desktop=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2),pinArgs=args.filter(v=>v.startsWith('--pins='));
assert(args.includes('--run-ui')&&pinArgs.length===1&&args.length===(args.includes('--restore-activation')?3:2),'Use --run-ui --pins=<owned JSON> [--restore-activation]');
assert(args.every(v=>v==='--run-ui'||v==='--restore-activation'||v.startsWith('--pins=')),'Unknown argument');
const restoreActivation=args.includes('--restore-activation');
const owned=fs.realpathSync(path.join(desktop,'test-results'));
const ownedPath=value=>{const resolved=fs.realpathSync(path.resolve(desktop,value)),relative=path.relative(owned,resolved);assert(relative&&!path.isAbsolute(relative)&&relative!=='..'&&!relative.startsWith('..'+path.sep),'Path must resolve inside owned test-results');return resolved;};
const pinsPath=ownedPath(pinArgs[0].slice('--pins='.length));
assert.equal(path.extname(pinsPath).toLowerCase(),'.json');
const pins=JSON.parse(fs.readFileSync(pinsPath,'utf8'));
const build=ownedPath(pins.buildRoot);
assert(fs.statSync(build).isDirectory());
for(const key of ['source','build'])assert.match(pins[key],/^[a-f0-9]{64}$/);
const output=fs.mkdtempSync(path.join(owned,'ui-final-settings-'));
const main=path.join(build,'main/index.js'),data=path.join(output,'data'),profile=path.join(output,'profile');
const report={success:false,output,pins,checks:[],launches:[],errors:[],seams:['Original unpackaged app native chooser queues; owned paths only, no OS chooser clicks claimed.','Owned renderer Storage.setItem failure injection; restored in finally.'],notRun:['A17 full model/skill/tool configuration and online validation','A18 actual file/source grants, revocation and write approvals','X02 all business drafts, late requests and uncertain commits','X07 restore activation/revert and cold boot on activated restored data; Office exports']};
let app,page,baseline;
report.qaRevision=5;
report.pinsPath=pinsPath;report.restoreActivation=restoreActivation;
report.budget={automaticRetries:0,modelCalls:0,repairPolicy:'User revised failures are diagnosed and repaired; no global two-repair maximum.'};
report.seams.push('Console/page errors retain only SHA-256 and length, never raw messages or arguments.','Optional activation uses the original UI and app-scoped manual relaunch contract; no global restart path.');
report.history=[{output:'ui-final-settings-h2narb',exit:1,pass:5,fail:6,classification:'QA hidden destination locator plus downstream missing settings route'},{output:'ui-final-settings-DjJGdJ',exit:1,pass:10,fail:1,classification:'QA restore container mistaken for nested UI data root'}];
report.history.push({output:'ui-final-settings-W7trL3',exit:1,pass:10,fail:1,classification:'UNRESOLVED A18 navigation visibility; missing route synchronization corrected but product defect not excluded until frozen rerun.'});
report.history.forEach(h=>h.classificationStatus='Historical diagnosis; not evidence that current revision passes');
if(restoreActivation)report.notRun=report.notRun.map(v=>v.startsWith('X07 restore')?'X07 actual OS chooser interaction and Office exports':v);
report.notRun=report.notRun.map(name=>({name,status:'NOT_RUN',reason:'Outside bounded executed subitems; no whole A17/A18/X02/X07 PASS claimed.'}));
const persist=()=>fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
const verify=()=>{assert.equal(build,ownedPath(pins.buildRoot));assert.equal(fingerprint(build).sha256,pins.build);assert.equal(fingerprint(path.join(desktop,'src')).sha256,pins.source);};
const ledgerTables=['ai_agent_runs','ai_agent_run_requests','ai_agent_run_actions','ai_agent_events','xiaozhi_event_journal'];
const ledgerRoots=new Map();
report.ledgerEvidence={tables:ledgerTables,roots:[],readbacks:[]};
const hash=value=>createHash('sha256').update(value).digest('hex');
const ledger=(root)=>{
  const db=new DatabaseSync(path.join(root,'app.db'),{readOnly:true});
  try{
    db.exec('BEGIN'); // One consistent read snapshot, including schema, counts and all row bytes.
    const counts={},tables={};
    for(const table of ledgerTables){
      const schema=db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name=?").get(table);
      assert(schema?.sql,'Missing ledger table: '+table);
      const columns=db.prepare(`PRAGMA table_info("${table}")`).all();
      const statement=db.prepare(`SELECT * FROM "${table}"`);statement.setReadBigInts(true);
      const rows=statement.all().map(row=>JSON.stringify(columns.map(column=>row[column.name]),(_key,value)=>
        typeof value==='bigint'?{sqliteInteger:value.toString()}:value instanceof Uint8Array?{sqliteBlob:Buffer.from(value).toString('hex')}:value)).sort();
      counts[table]=db.prepare(`SELECT count(*) AS n FROM "${table}"`).get().n;
      assert.equal(rows.length,counts[table]);
      tables[table]={schemaSha256:hash(JSON.stringify({sql:schema.sql,columns})),rowsSha256:hash(JSON.stringify(rows))};
    }
    return {counts,tables};
  }finally{db.close();} // Closing rolls back the read transaction; no DB writes.
};
const runOwnedRoot=value=>{
  const root=fs.realpathSync(value),relative=path.relative(output,root);
  assert(relative&&!path.isAbsolute(relative)&&relative!=='..'&&!relative.startsWith('..'+path.sep),'Ledger root must be inside this run output');
  return root;
};
const registerLedgerRoot=(role,value,derivedFrom)=>{
  const root=runOwnedRoot(value);assert(!ledgerRoots.has(root),'Ledger root already registered');
  const before=ledger(root);
  const entry={role,root,derivedFrom:derivedFrom??null,before,after:null};
  report.ledgerEvidence.roots.push(entry);
  if(derivedFrom){const anchor=ledgerRoots.get(runOwnedRoot(derivedFrom));assert(anchor,'Missing source ledger baseline');assert.deepEqual(before,anchor.before,'Copied ledger differs from its source baseline (schema/content/counts)');}
  for(const table of ledgerTables)assert.equal(before.counts[table],0,'Zero-model ledger baseline required: '+table);
  ledgerRoots.set(root,entry);return before;
};
const auditStoredLedgers=label=>{
  const failures=[];
  for(const entry of ledgerRoots.values()){
    try{
      const snapshot=ledger(entry.root);entry.after=snapshot;
      report.ledgerEvidence.readbacks.push({label,root:entry.root,snapshot});
      assert.deepEqual(snapshot,entry.before,'Ledger changed at '+entry.role+': '+entry.root);
    }catch(error){failures.push({label,root:entry.root,role:entry.role,error:String(error.message)});}
  }
  if(failures.length){report.ledgerEvidence.failures??=[];report.ledgerEvidence.failures.push(...failures);}
  assert.equal(failures.length,0,'Ledger verification failed; see ledgerEvidence.failures');
};
let expectedActiveRoot=data;
const auditLedgers=async(label)=>{
  const activeRoot=runOwnedRoot(await page.evaluate(()=>window.omniEdu.getDataRoot()));
  report.ledgerEvidence.activeRoot=activeRoot;
  assert.equal(activeRoot,runOwnedRoot(expectedActiveRoot),'Unexpected active data root');
  assert(ledgerRoots.has(activeRoot),'Active root has no independently verified ledger baseline');
  auditStoredLedgers(label);
  report.modelLedgerActiveAfter={root:activeRoot,counts:ledger(activeRoot).counts};
};
const captureBackupLedger=async root=>{
  await auditLedgers('before-backup-baseline');registerLedgerRoot('backup',root,data);await auditLedgers('backup-captured');
};
const captureRestoreLedger=async(root,backup)=>{
  await auditLedgers('before-restore-baseline');registerLedgerRoot('restore',root,backup);await auditLedgers('restore-preactivation');
};
// Hash-only capture avoids leaking provider credentials, URLs, students or console arguments.
const errorDigest=(kind,message)=>({kind,sha256:createHash('sha256').update(String(message)).digest('hex'),length:String(message).length});
const navigationDiagnostics=()=>page.locator('[data-testid="nav-knowledge"], [data-testid="nav-student-workbench"], [data-testid="nav-settings"]').evaluateAll(elements=>elements.map(element=>{
  const chain=[];
  for(let node=element;node;node=node.parentElement){const rect=node.getBoundingClientRect(),style=getComputedStyle(node);chain.push({tag:node.tagName,hidden:node.hidden,inert:node.inert,display:style.display,visibility:style.visibility,rect:{x:rect.x,y:rect.y,width:rect.width,height:rect.height},scroll:{top:node.scrollTop,left:node.scrollLeft}});}
  return {entry:element.getAttribute('data-testid'),current:element.getAttribute('aria-current'),chain};
}));
async function launch(expectedRoot=data){
  verify();
  const env={...process.env};
  for(const key of Object.keys(env))if(/KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL/i.test(key)||key.startsWith('OMNI_EDU_')||['ELECTRON_RUN_AS_NODE','NODE_OPTIONS','ELECTRON_RENDERER_URL'].includes(key))delete env[key];
  Object.assign(env,{OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_E2E_DIALOG_MODE:'1',OMNI_EDU_E2E_DATA_BACKUP_EXPORT_DIALOG_QUEUE:JSON.stringify(['',path.join(output,'backup')]),OMNI_EDU_E2E_DATA_BACKUP_VERIFY_DIALOG_QUEUE:JSON.stringify(['$last',path.join(output,'invalid')])});
  if(restoreActivation)env.OMNI_EDU_E2E_RESTORE_RELAUNCH='manual';
  app=await electron.launch({args:[main,'--user-data-dir='+profile,'--force-device-scale-factor=1'],cwd:desktop,env,timeout:60000});
  report.launches.push({pid:app.process().pid,...await assertIsolatedPiMain(app,main,profile)});
  // No network capability is needed by this zero-model journey.
  await app.evaluate(({session})=>{session.defaultSession.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*']},(_d,cb)=>cb({cancel:true}));});
  page=await app.firstWindow();page.setDefaultTimeout(12000);
  page.on('pageerror',e=>report.errors.push(errorDigest('pageerror',e.message)));
  page.on('console',message=>{if(message.type()==='error')report.errors.push(errorDigest('console.error',message.text()));});
  await page.getByTestId('xiaozhi-pi-workspace').waitFor({timeout:60000});
  assert.equal(path.resolve(await page.evaluate(()=>window.omniEdu.getDataRoot())),expectedRoot);
  expectedActiveRoot=expectedRoot;
  if(ledgerRoots.size)await auditLedgers('launch');
  await app.evaluate(({BrowserWindow})=>{BrowserWindow.getAllWindows()[0].setContentSize(1366,768);});
  return {app,page};
}
const check=async(id,name,work)=>{
  report.active=id;persist();
  try{await work();await auditLedgers(id);report.checks.push({id,name,status:'PASS'});console.log('PASS '+id+' '+name);}
  catch(e){const stem=id.replaceAll(/[^a-zA-Z0-9-]/g,'-');await page?.screenshot({path:path.join(output,stem+'-failure.png')}).catch(()=>{});fs.writeFileSync(path.join(output,stem+'-stack.txt'),String(e.stack));const navigation=page?await navigationDiagnostics().catch(()=>null):null;report.checks.push({id,name,status:'FAIL',error:String(e.message),stack:stem+'-stack.txt',navigation});console.log('FAIL '+id+' '+String(e.message).slice(0,250));}
  persist();
};
try{
  persist();verify();report.before={source:pins.source,build:pins.build};
  for(const dir of ['backup','invalid','restore'])fs.mkdirSync(path.join(output,dir));
  await launch();baseline=registerLedgerRoot('original',data);report.modelLedgerBefore=baseline.counts;
  await auditLedgers('initial');
  await settingsJourney({get:()=>({app,page}),output,data,profile,restoreActivation,report,check,captureBackupLedger,captureRestoreLedger,relaunch:async(expectedRoot=data)=>{await auditLedgers('before-close');await app.close();app=undefined;return launch(expectedRoot);}});
  await auditLedgers('final');report.modelLedgerAfter=ledger(data).counts;assert.deepEqual(report.modelLedgerAfter,report.modelLedgerBefore);assert.equal(report.modelLedgerBefore.ai_agent_runs,0);assert.equal(report.modelLedgerBefore.ai_agent_run_requests,0);
  assert.deepEqual(report.errors,[]);
  report.success=report.checks.length>0&&report.checks.every(c=>c.status==='PASS');
}catch(e){report.fatal={message:String(e.message),stack:String(e.stack)};await page?.screenshot({path:path.join(output,'fatal.png')}).catch(()=>{});}
finally{
  await app?.close().catch(e=>{report.closeError=String(e.message);report.success=false;});
  try{auditStoredLedgers('after-close');if(baseline){report.modelLedgerAfter=ledger(data).counts;assert.deepEqual(report.modelLedgerAfter,report.modelLedgerBefore);}}catch(e){report.ledgerError=String(e.stack);report.success=false;}
  try{verify();report.integrityVerified=true;report.after={source:fingerprint(path.join(desktop,'src')).sha256,build:fingerprint(build).sha256};}catch(e){report.integrityError=String(e.stack);report.success=false;}
  persist();console.log(JSON.stringify({success:report.success,output,counts:report.checks.reduce((r,c)=>(r[c.status]=(r[c.status]||0)+1,r),{})}));
}
if(!report.success)process.exitCode=1;
