/** QA only: immutable source -> official SQLite backup -> strict zero-launch preflight. */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {DatabaseSync,backup} from 'node:sqlite';
import {hash,need,boundedTree,captureFacts,assertQuiescent,validateCatalogue} from './acceptance/ui-final-queue-recovery.mjs';

const script=fileURLToPath(import.meta.url),desktop=path.resolve(path.dirname(script),'..');
const quote=value=>'"'+value.replaceAll('"','""')+'"';
const sidecar=file=>/(?:-wal|-shm|-journal)$/i.test(file);
const canonical=value=>value===null?['null']:typeof value==='bigint'?['integer',String(value)]:value instanceof Uint8Array?['blob',Buffer.from(value).toString('hex')]:[typeof value,value];

// All ordinary, virtual, shadow and SQLite-owned tables, not just the 15 run ledgers.
function logical(db){
  const schema=db.prepare('SELECT type,name,tbl_name,sql FROM sqlite_schema ORDER BY type,name').all();
  const tables=[];
  for(const {name} of schema.filter(row=>row.type==='table')){
    const statement=db.prepare('SELECT * FROM '+quote(name));statement.setReadBigInts(true);statement.setReturnArrays(true);
    const rows=[];for(const row of statement.iterate())rows.push(hash(row.map(canonical)));
    rows.sort();tables.push({table:name,count:rows.length,sha256:hash(rows)});
  }
  const facts={schemaSha256:hash(schema),userVersion:db.prepare('PRAGMA user_version').get().user_version,
    applicationId:db.prepare('PRAGMA application_id').get().application_id,tables};
  return {...facts,sha256:hash(facts)};
}
function readLogical(file){const db=new DatabaseSync(file,{readOnly:true});try{db.exec('PRAGMA query_only=ON; BEGIN');return logical(db);}finally{db.close();}}
async function snapshot(source,destination,deadline){
  need(typeof backup==='function','SQLITE_BACKUP_UNAVAILABLE');need(!fs.existsSync(destination),'SNAPSHOT_EXISTS');
  const db=new DatabaseSync(source,{readOnly:true});let before,pages;
  try{
    db.exec('PRAGMA query_only=ON; BEGIN');before=logical(db);
    pages=await backup(db,destination,{rate:128,progress:()=>need(Date.now()<deadline,'BACKUP_DEADLINE')});
    need(logical(db).sha256===before.sha256,'SOURCE_TRANSACTION_CHANGED');
  }finally{db.close();}
  // Only NEW owned backup: change physical journal mode, never business rows.
  const cold=new DatabaseSync(destination);
  try{need(cold.prepare('PRAGMA journal_mode=DELETE').get().journal_mode==='delete','CLONE_NOT_COLD');
    need(cold.prepare('PRAGMA integrity_check').all().every(row=>row.integrity_check==='ok'),'CLONE_INTEGRITY_FAILED');
  }finally{cold.close();}
  const clone=readLogical(destination);need(clone.sha256===before.sha256,'CLONE_LOGICAL_MISMATCH');
  return {method:'node:sqlite.backup(readOnly source, new owned destination)',pages,sourceBefore:before,clone};
}
function noElectron(roots){
  need(process.platform==='win32','WINDOWS_PROCESS_PROOF_REQUIRED');
  const encoded=Buffer.from(JSON.stringify(roots)).toString('base64');
  const command=`$roots=ConvertFrom-Json ([Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encoded}'))); $hits=@(Get-CimInstance Win32_Process | Where-Object { if($_.Name -ne 'electron.exe' -or -not $_.CommandLine){return $false}; $cmd=$_.CommandLine; @($roots | Where-Object {$cmd.IndexOf($_,[StringComparison]::OrdinalIgnoreCase) -ge 0}).Count -gt 0 }); $hits.Count`;
  const result=spawnSync('powershell.exe',['-NoProfile','-Command',command],{encoding:'utf8',windowsHide:true,timeout:8000});
  need(result.status===0&&/^0\s*$/.test(result.stdout),'SOURCE_PROCESS_NOT_QUIESCENT');
}
function copyExceptDatabase(tree,destination,data=true){
  fs.mkdirSync(destination,{recursive:true});
  for(const entry of tree.files){
    if(sidecar(entry.file)||(data&&entry.file==='app.db'))continue;
    const from=path.join(tree.root,entry.file),to=path.join(destination,entry.file);
    need(hash(fs.readFileSync(from))===entry.sha256,'SOURCE_FILE_CHANGED');fs.mkdirSync(path.dirname(to),{recursive:true});
    fs.copyFileSync(from,to,fs.constants.COPYFILE_EXCL);need(hash(fs.readFileSync(to))===entry.sha256,'CLONE_BYTE_MISMATCH');
  }
}
function assertCopy(tree,target,data){
  const expected=tree.files.filter(entry=>!sidecar(entry.file)&&(!data||entry.file!=='app.db'));
  const actual=boundedTree(target).files.filter(entry=>!data||entry.file!=='app.db');
  need(hash(actual)===hash(expected),'CLONE_INVENTORY_CHANGED');
}
async function selfTest(){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'edudev-x01-snapshot-'));
  const source=path.join(root,'source.db'),target=path.join(root,'clone.db');
  const db=new DatabaseSync(source);db.exec('CREATE TABLE sample(id INTEGER PRIMARY KEY, txt TEXT, blob BLOB); CREATE VIRTUAL TABLE search USING fts5(text);');
  db.prepare('INSERT INTO sample VALUES(?,?,?)').run(9007199254740993n,'private fixture',Buffer.from([0,255]));db.exec("INSERT INTO search VALUES('fixture')");db.close();
  const before=hash(fs.readFileSync(source)),result=await snapshot(source,target,Date.now()+10000);
  assert.equal(result.sourceBefore.sha256,result.clone.sha256);assert.equal(hash(fs.readFileSync(source)),before);
  assert(result.clone.tables.some(t=>t.table==='search_data'));assert.equal(result.clone.tables.find(t=>t.table==='sample').count,1);
  const changed=new DatabaseSync(target);changed.exec("UPDATE sample SET txt='changed'");changed.close();assert.notEqual(readLogical(target).sha256,result.clone.sha256);
  assert(sidecar('nested/app.db-wal'));assert(!sidecar('deepseek-capabilities.v1.json'));
  const walSource=path.join(root,'wal-source.db'),writer=new DatabaseSync(walSource);
  try{writer.exec("PRAGMA journal_mode=WAL; CREATE TABLE queued(id INTEGER PRIMARY KEY, text TEXT); INSERT INTO queued VALUES(1,'uncheckpointed fixture');");
    assert(fs.statSync(walSource+'-wal').size>0);
    const walSnapshot=await snapshot(walSource,path.join(root,'wal-clone.db'),Date.now()+10000);
    assert.equal(walSnapshot.clone.tables.find(t=>t.table==='queued').count,1);assert.equal(walSnapshot.clone.sha256,logical(writer).sha256);
  }finally{writer.close();}
  // Deliberately retain owned diagnostic fixtures; no recursive cleanup.
  return {code:'X01_COLD_BASELINE_SELF_TEST_PASS',checks:5,launches:0,nativeWire:0,fixture:root};
}
let output,report,sourceRoot,sourceBefore;
try{
  const args=process.argv.slice(2);
  if(args.length===1&&args[0]==='--self-test')console.log(JSON.stringify(await selfTest()));
  else{
    need(args.length===3&&new Set(args.map(v=>v.split('=')[0])).size===3&&args.every(v=>/^--(?:source|pins|model)=.+/.test(v)),'ARGS_INVALID');
    const value=name=>args.find(v=>v.startsWith('--'+name+'='))?.slice(name.length+3),owned=fs.realpathSync(path.join(desktop,'test-results'));
    const own=value=>{const file=path.resolve(desktop,value),relative=path.relative(owned,file);need(relative&&!path.isAbsolute(relative)&&relative!=='..'&&!relative.startsWith('..'+path.sep)&&fs.realpathSync(file)===file&&!fs.lstatSync(file).isSymbolicLink(),'OWNED_PATH_REQUIRED');return file;};
    sourceRoot=own(value('source'));const pins=own(value('pins')),model=value('model');need(/^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/.test(model??''),'ARGS_INVALID');
    const data=own(path.join(sourceRoot,'data')),profile=own(path.join(sourceRoot,'profile'));
    noElectron([sourceRoot,data,profile]);sourceBefore=boundedTree(sourceRoot);
    const dataTree=boundedTree(data),profileTree=boundedTree(profile);
    // Only app.db gets a backup. Never discard another DB's nonempty WAL/journal.
    for(const entry of dataTree.files.filter(v=>sidecar(v.file)&&!['app.db-wal','app.db-shm'].includes(v.file)))need(entry.bytes===0,'OTHER_DATABASE_SIDECAR_NEEDS_SNAPSHOT');
    for(const entry of profileTree.files.filter(v=>sidecar(v.file)))need(entry.bytes===0,'PROFILE_SIDECAR_NEEDS_SNAPSHOT');
    need(!fs.existsSync(path.join(profile,'xiaozhi-data-selection.v1.json'))&&!fs.existsSync(path.join(data,'xiaozhi-recovery.v1.json')),'RESTORE_SELECTION_FORBIDDEN');
    const catalogueFile=path.join(data,'xiaozhi-pi/deepseek-capabilities.v1.json');
    const catalogue=validateCatalogue(fs.readFileSync(catalogueFile),model);
    assertQuiescent(captureFacts(data));
    need(boundedTree(sourceRoot).sha256===sourceBefore.sha256,'SOURCE_FINGERPRINT_CHANGED');
    output=fs.mkdtempSync(path.join(owned,'ui-final-queue-recovery-baseline-'));
    const cloneData=path.join(output,'data'),cloneProfile=path.join(output,'profile');
    report={suite:'X01-official-readonly-cold-baseline',success:false,launches:0,nativeWire:0,productAcceptance:false,
      source:{root:sourceRoot,reportSha256:hash(fs.readFileSync(path.join(sourceRoot,'report.json'))),fullInventory:sourceBefore},
      pins:{file:pins,sha256:hash(fs.readFileSync(pins))},scriptSha256:hash(fs.readFileSync(script)),catalogue:{...catalogue,sourceFile:catalogueFile},baseline:output};
    copyExceptDatabase(dataTree,cloneData);
    // Profile credentials/config copied verbatim; derived SQLite sidecars excluded.
    copyExceptDatabase(profileTree,cloneProfile,false);
    report.snapshot=await snapshot(path.join(data,'app.db'),path.join(cloneData,'app.db'),Date.now()+30000);
    const after=readLogical(path.join(data,'app.db'));need(after.sha256===report.snapshot.sourceBefore.sha256,'SOURCE_LOGICAL_CHANGED');report.snapshot.sourceAfter=after;
    assertQuiescent(captureFacts(data));assertQuiescent(captureFacts(cloneData));
    assertCopy(dataTree,cloneData,true);assertCopy(profileTree,cloneProfile,false);
    noElectron([sourceRoot,data,profile]);need(boundedTree(sourceRoot).sha256===sourceBefore.sha256,'SOURCE_FINGERPRINT_CHANGED');
    report.excludedDerivedSidecars={data:dataTree.files.filter(entry=>sidecar(entry.file)),profile:profileTree.files.filter(entry=>sidecar(entry.file))};
    report.cloneBeforePreflight={data:boundedTree(cloneData),profile:boundedTree(cloneProfile)};
    const command=['scripts/ui-final-queue-recovery-live.mjs','--preflight','--baseline='+output,'--model='+model,'--pins='+pins];
    const preflight=spawnSync(process.execPath,command,{cwd:desktop,encoding:'utf8',windowsHide:true,timeout:60000,maxBuffer:1048576});
    // Existing runner emits only allowlisted codes/hashes; raw exceptions are never published here.
    let parsed;try{parsed=JSON.parse(preflight.stdout.trim());}catch{throw Error('PREFLIGHT_OUTPUT_INVALID');}
    report.preflight={exit:preflight.status,command:[process.execPath,...command],result:parsed,stderrSha256:hash(preflight.stderr??'')};
    need(preflight.status===0&&parsed.code==='X01_READ_ONLY_PREFLIGHT_PASS'&&parsed.launches===0&&parsed.nativeWire===0,'PREFLIGHT_FAILED');
    need(boundedTree(cloneData).sha256===report.cloneBeforePreflight.data.sha256&&boundedTree(cloneProfile).sha256===report.cloneBeforePreflight.profile.sha256,'PREFLIGHT_MUTATED_CLONE');
    report.sourceAfter=boundedTree(sourceRoot);need(report.sourceAfter.sha256===sourceBefore.sha256,'SOURCE_FINGERPRINT_CHANGED');
    need(readLogical(path.join(cloneData,'app.db')).sha256===after.sha256,'CLONE_LOGICAL_CHANGED');
    need(boundedTree(cloneData).sha256===report.cloneBeforePreflight.data.sha256,'FINAL_READ_MUTATED_CLONE');
    noElectron([sourceRoot,data,profile,output]);need(boundedTree(sourceRoot).sha256===sourceBefore.sha256,'SOURCE_FINGERPRINT_CHANGED');
    report.actualCommand=['node','scripts/ui-final-queue-recovery-live.mjs','--run-ui','--baseline='+output,'--model='+model,'--pins='+pins];
    report.success=true;report.code='X01_COLD_BASELINE_AND_PREFLIGHT_PASS';
    fs.writeFileSync(path.join(output,'baseline-report.json'),JSON.stringify(report,null,2),{flag:'wx'});
    console.log(JSON.stringify({code:report.code,baseline:output,report:path.join(output,'baseline-report.json'),tables:after.tables.length,logicalSha256:after.sha256,sourceUnchanged:true,launches:0,nativeWire:0,actualCommand:report.actualCommand}));
  }
}catch(error){
  const code=/^[A-Z][A-Z0-9_]{2,80}$/.test(error.message??'')?error.message:'BASELINE_PREPARATION_FAILED';
  const failure={code,errorHash:hash(String(error)),qaFrames:String(error.stack??'').split('\n').filter(line=>line.includes(path.basename(script))).map(line=>line.replaceAll(desktop,'<desktop>')),launches:0,nativeWire:0};
  if(sourceRoot&&sourceBefore){try{failure.sourceUnchanged=boundedTree(sourceRoot).sha256===sourceBefore.sha256;}catch{failure.sourceUnchanged=false;}}
  if(output)fs.writeFileSync(path.join(output,'baseline-failure.json'),JSON.stringify({...report,...failure},null,2),{flag:'wx'});
  console.error(JSON.stringify({...failure,output}));process.exitCode=1;
}
