/** Eight bounded native-FS/serialized-bootstrap checks. No Electron or model launch.
 * The VM supplies an unused Electron lifecycle fixture and replaces only main import.
 * Actual publisher, guard, diagnostic and reader execute against owned native files.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {fingerprint,sha256} from '../acceptance/evidence.mjs';
import {publishContinuationBootstrap} from '../acceptance/paper-adaptation-continuation.mjs';
import {bootstrapSource,readQueueRecoveryBootstrap,queueBootstrapDiagnostic,installQueueRecoveryGuard,
 contract,safeDiagnostic} from '../acceptance/ui-final-queue-recovery.mjs';

const desktop=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const output=fs.mkdtempSync(path.join(desktop,'test-results/ui-final-x01-bootstrap-focused-'));
const original=path.join(desktop,'test-results/ui-final-queue-recovery-wotqCk');
const legacyFile=path.join(original,'owned-bootstrap.cjs'),legacyReport=path.join(original,'report.json');
const pinsFile=path.join(desktop,'test-results/ui-final-resumed-c5Lt4A-pins.json');
const pins=JSON.parse(fs.readFileSync(pinsFile)),sourceBefore=fingerprint(path.join(desktop,'src')).sha256;
const tracked=[legacyFile,legacyReport,path.join(desktop,'scripts/acceptance/paper-adaptation-continuation.mjs')];
const before=tracked.map(file=>({file,sha256:sha256(fs.readFileSync(file))}));
const names=['FROZEN_SOURCE_GUARD_AND_CONTRACT','LEGACY_NATIVE_RENAME_EPERM',
 'REAL_BOOTSTRAP_SUCCESS_WITH_LOCKED_PROGRESS','IMPORT_ERROR_BEFORE_CHILD_EXIT',
 'PUBLICATION_ERRORS_HAVE_SEPARATE_TERMINALS','READER_REJECTS_STALE_PARTIAL_INVALID',
 'DIAGNOSTICS_ALLOWLIST_ONLY','SOURCE_AND_HISTORICAL_EVIDENCE_UNCHANGED'];
const report={success:false,output,checks:names.map(code=>({code,status:'NOT_RUN'})),electronLaunches:0,
 modelCalls:0,nativeWire:0,productAcceptance:false,sourceBefore,tracked:before,nativeObservations:[],
 boundary:'Real native files; VM lifecycle/main-import seams only. Historical wotqCk EPERM remains unconfirmed.'};
const require=createRequire(path.join(desktop,'package.json')),ts=require('typescript');
const oldSource=fs.readFileSync(legacyFile,'utf8'),tree=ts.createSourceFile(legacyFile,oldSource,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
const saveNodes=[],guardNodes=[];
function visit(node){
 if(ts.isVariableDeclaration(node)&&node.name.getText(tree)==='save')saveNodes.push(node.initializer.getText(tree));
 if(ts.isFunctionExpression(node)&&node.name?.text==='installQueueRecoveryGuard')guardNodes.push(node.getText(tree));
 ts.forEachChild(node,visit);
}visit(tree);
const alive={exitCode:null,signalCode:null},dead={exitCode:1,signalCode:null};
const check=async(code,work)=>{const result=report.checks.find(c=>c.code===code);
 try{await work();result.status='PASS';}catch(error){result.status='FAIL';throw error;}};
function directory(name){const root=path.join(output,name);fs.mkdirSync(root);return root;}
function nativeWrite(file,value){fs.writeFileSync(file,typeof value==='string'?value:JSON.stringify(value));}
function harness(name,{ready=()=>{},importMain=()=>{},prepare=()=>{}}={}){
 const root=directory(name),stateFile=path.join(root,'state.json'),profile=path.join(root,'profile');
 const exits=[],stderr=[],native={calls:0};
 const host={app:{setPath:(_key,value)=>assert.equal(value,profile),whenReady:async()=>ready(stateFile),
  on:()=>{},exit:code=>exits.push(code)},
  net:{fetch:()=>{native.calls++;assert.fail('No native transport');}},
  session:{defaultSession:{webRequest:{onBeforeRequest:()=>{}}}}};
 const context=vm.createContext({Buffer,URL,Request,setTimeout,clearTimeout,
  process:{getBuiltinModule:process.getBuiltinModule,stderr:{write:bytes=>stderr.push(String(bytes))}},
  require:name=>name==='electron'?host:require(name),__focusedImport:async()=>importMain(stateFile)});
 const actual=bootstrapSource({profile,main:path.join(root,'unused-main.js'),stateFile,model:'official-test',deadlineAt:Date.now()+5000});
 const needle="await import(require('node:url').pathToFileURL("+JSON.stringify(path.join(root,'unused-main.js'))+").href)";
 assert.equal(actual.split(needle).length,2,'Exactly one explicit main-import seam');
 const tested=actual.replace(needle,'await globalThis.__focusedImport()');
 prepare(stateFile);
 return {stateFile,exits,stderr,native,context,run:async()=>{await vm.runInContext(tested,context);assert.equal(native.calls,0);}};
}

try{
 await check(names[0],()=>{
  assert.equal(process.platform,'win32');assert.equal(sourceBefore,pins.source);
  assert.equal(saveNodes.length,1);assert.equal(guardNodes.length,1);
  assert.equal(sha256(oldSource),JSON.parse(fs.readFileSync(legacyReport)).bootstrapHash);
  const normalize=text=>text.replaceAll('\r\n','\n');
  assert.equal(sha256(normalize(guardNodes[0])),sha256(normalize(installQueueRecoveryGuard.toString())));
  assert.deepEqual(contract,JSON.parse(fs.readFileSync(legacyReport)).contract);
  report.guardSha256=sha256(normalize(installQueueRecoveryGuard.toString()));
 });
 await check(names[1],()=>{
  const root=directory('native-legacy');
  for(let iteration=0;iteration<3;iteration++){
   const f=path.join(root,iteration+'.json'),s={phase:'BOOT'};
   const save=vm.runInNewContext('('+saveNodes[0]+')',{fs,f,s});save();
   const fd=fs.openSync(f,'r');let failure;
   try{s.phase='MAIN_IMPORT';try{save();}catch(error){failure=error;}
    assert.equal(failure?.code,'EPERM');assert.equal(failure.syscall,'rename');
    assert.equal(JSON.parse(fs.readFileSync(f)).phase,'BOOT');
    assert.equal(JSON.parse(fs.readFileSync(f+'.tmp')).phase,'MAIN_IMPORT');
   }finally{fs.closeSync(fd);}
   save();assert.equal(JSON.parse(fs.readFileSync(f)).phase,'MAIN_IMPORT');
   report.nativeObservations.push(queueBootstrapDiagnostic(failure,'MAIN_IMPORT','IMPORT_PROGRESS_PUBLISH'));
  }
 });
 await check(names[2],async()=>{
  const handles=[];
  const h=harness('success',{ready:f=>handles.push(fs.openSync(f+'.phase-01.json','r')),
   importMain:f=>handles.push(fs.openSync(f+'.phase-02.json','r'))});
  try{await h.run();assert.deepEqual(h.exits,[]);assert(h.context.__queueRecoveryGuard);
   const state=readQueueRecoveryBootstrap(h.stateFile,alive);
   assert.equal(state.phase,'MAIN_IMPORTED');assert.equal(state.operation,'SUCCESS_TERMINAL_PUBLISH');
   assert.equal(JSON.parse(fs.readFileSync(h.stateFile+'.phase-01.json')).phase,'BOOT');
   assert.equal(JSON.parse(fs.readFileSync(h.stateFile+'.phase-02.json')).phase,'MAIN_IMPORT');
   const fd=fs.openSync(h.stateFile,'r');
   try{assert.throws(()=>publishContinuationBootstrap(fs,path,h.stateFile,state),/BOOTSTRAP_STATE_EXISTS/);}
   finally{fs.closeSync(fd);}
   assert.equal(h.stderr.length,0);
  }finally{for(const fd of handles)fs.closeSync(fd);}
 });
 await check(names[3],async()=>{
  for(const known of [true,false]){
   const h=harness('import-failure-'+known,{importMain:()=>{
    throw Object.assign(Error('private secret import sentinel'),{code:known?'EPERM':'PRIVATE_CODE',syscall:known?'open':'private'});
   }});await h.run();assert.deepEqual(h.exits,[1]);assert(!fs.existsSync(h.stateFile));
   const failure=readQueueRecoveryBootstrap(h.stateFile,dead);
   assert.equal(failure.failed,true);assert.equal(failure.operation,'FORMAL_MAIN_IMPORT');
   assert.equal(failure.error.code,known?'EPERM':'UNCLASSIFIED_BOOTSTRAP_FAILURE');
   assert(!JSON.stringify(failure).includes('secret'));assert(h.context.__queueRecoveryGuard);
  }
 });
 await check(names[4],async()=>{
  for(const [name,suffix,phase,operation] of [
   ['boot','.phase-01.json','BOOT','BOOT_PROGRESS_PUBLISH'],
   ['import','.phase-02.json','MAIN_IMPORT','IMPORT_PROGRESS_PUBLISH'],
   ['terminal','.tmp','MAIN_IMPORTED','SUCCESS_TERMINAL_PUBLISH']]){
   const h=harness('publication-'+name,{prepare:f=>nativeWrite(f+suffix,'retained collision sentinel')});
   await h.run();assert.deepEqual(h.exits,[1]);assert(!fs.existsSync(h.stateFile));
   const failure=readQueueRecoveryBootstrap(h.stateFile,dead);
   assert.equal(failure.phase,phase);assert.equal(failure.operation,operation);
   assert.equal(failure.error.code,'BOOTSTRAP_STATE_EXISTS');
   assert.equal(fs.readFileSync(h.stateFile+suffix,'utf8'),'retained collision sentinel');
  }
 });
 await check(names[5],()=>{
  const root=directory('reader'),file=path.join(root,'state.json');
  nativeWrite(file+'.tmp','{');nativeWrite(file+'.phase-02.json',{phase:'MAIN_IMPORTED'});
  assert.equal(readQueueRecoveryBootstrap(file,alive),null);
  assert.throws(()=>readQueueRecoveryBootstrap(file,dead),/BOOTSTRAP_CHILD_EXITED/);
  nativeWrite(file,{phase:'MAIN_IMPORTED',operation:'SUCCESS_TERMINAL_PUBLISH'});
  assert.throws(()=>readQueueRecoveryBootstrap(file,dead),/BOOTSTRAP_CHILD_EXITED/);
  for(const value of ['x'.repeat(65537),'{',{phase:'MAIN_IMPORT',operation:'FORMAL_MAIN_IMPORT'},
   {phase:'MAIN_IMPORTED',operation:'SUCCESS_TERMINAL_PUBLISH',raw:'must never be returned'}]){
   nativeWrite(file,value);assert.throws(()=>readQueueRecoveryBootstrap(file,alive));
  }
 });
 await check(names[6],()=>{
  const root=directory('safe-error'),file=path.join(root,'state.json');
  const error=queueBootstrapDiagnostic(Object.assign(Error('private sk-fixture sentinel'),{
   name:'PrivateName',code:'PRIVATE_CODE',syscall:'private'}),'MAIN_IMPORT','FORMAL_MAIN_IMPORT');
  assert.equal(error.code,'UNCLASSIFIED_BOOTSTRAP_FAILURE');assert.equal(error.name,'Error');
  assert(!JSON.stringify(error).includes('private'));assert.equal(error.syscall,undefined);
  const failure={phase:'MAIN_IMPORT',operation:'FORMAL_MAIN_IMPORT',failed:true,error};
  nativeWrite(file+'.error.json',failure);assert.deepEqual(readQueueRecoveryBootstrap(file,dead),failure);
  for(const changed of [{...error,code:'private secret'},{...error,operation:'private'},
   {...error,raw:'private'},{...error,hash:'not-a-digest'}]){
   nativeWrite(file+'.error.json',{...failure,error:changed});
   assert.throws(()=>readQueueRecoveryBootstrap(file,dead),/BOOTSTRAP_STATE_INVALID/);
  }
  assert.equal(queueBootstrapDiagnostic(Error('private'),'private','private').operation,'UNKNOWN');
 });
 await check(names[7],()=>{
  assert.deepEqual(tracked.map(file=>({file,sha256:sha256(fs.readFileSync(file))})),before);
  report.sourceAfter=fingerprint(path.join(desktop,'src')).sha256;assert.equal(report.sourceAfter,sourceBefore);
 });
 report.success=true;
}catch(error){report.failure=safeDiagnostic(error,'PREPARE');process.exitCode=1;}
finally{
 report.files=['scripts/acceptance/ui-final-queue-recovery.mjs','scripts/ui-final-queue-recovery-live.mjs',
  'scripts/xiaozhi-agent/queue-recovery-bootstrap-focused-test.mjs'].map(file=>({file,sha256:sha256(fs.readFileSync(path.join(desktop,file)))}));
 fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({success:report.success,pass:report.checks.filter(c=>c.status==='PASS').length,
  fail:report.checks.filter(c=>c.status==='FAIL').length,output,electronLaunches:0,modelCalls:0}));
}
