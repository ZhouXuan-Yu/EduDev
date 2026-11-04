/** X02 transport-only QA seam and cold, read-only source snapshot. No production imports. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import vm from 'node:vm';
import {spawnSync} from 'node:child_process';
import {DatabaseSync,backup} from 'node:sqlite';
import {sha256} from './acceptance/evidence.mjs';

export const contract=Object.freeze({launches:1,totalMs:120000,cleanupMs:12000,http:0,models:0,saveCalls:1,
  schema:'xiaozhi.material-catalog.v1',source:'ui-final-material-catalog-live-K61IFq',
  checks:['GENUINE_TXT_COLD_CLONE','FORMAL_WINDOW_IDENTITY_EARLY_ZERO_HTTP',
    'COMMITTED_ACK_LOSS_UNKNOWN_DRAFT','ORIGINAL_OPERATION_READ_ONLY_RECONCILIATION',
    'LATE_REAL_READ_CANNOT_OVERWRITE_OTHER_OBJECT','FINAL_RECEIPT_REVISION_SOURCE_LEDGER'],
  notRun:['Real operating-system/network outage','Concurrent writers or a second save/retry',
    'Crash/cold persistence after this save (one launch only)','PDF/image parser coverage','Provider/model behavior']});
export const need=(value,code)=>{if(!value)throw Error(code);};
export const hash=value=>sha256(typeof value==='string'||Buffer.isBuffer(value)?value:JSON.stringify(value));
const quote=v=>'"'+v.replaceAll('"','""')+'"';
const sidecar=v=>/(?:-wal|-shm|-journal)$/i.test(v);
export function tree(root){
  need(fs.realpathSync(root)===root&&!fs.lstatSync(root).isSymbolicLink(),'OWNED_REDIRECT');
  const files=[];let bytes=0;
  function walk(dir){for(const name of fs.readdirSync(dir).sort()){
    const file=path.join(dir,name),s=fs.lstatSync(file);
    need(!s.isSymbolicLink()&&fs.realpathSync(file)===file,'OWNED_REDIRECT');
    if(s.isDirectory())walk(file);else{
      need(s.isFile()&&s.nlink===1,'OWNED_FILE_REQUIRED');bytes+=s.size;
      need(files.length<8192&&bytes<512*1024*1024,'INVENTORY_BUDGET');
      files.push({file:path.relative(root,file),bytes:s.size,sha256:hash(fs.readFileSync(file))});
    }
  }}walk(root);return {root,files,bytes,sha256:hash(files)};
}
export function readDb(file,work){
  need(fs.realpathSync(file)===file&&!fs.lstatSync(file).isSymbolicLink(),'DATABASE_REDIRECT');
  const db=new DatabaseSync(file,{readOnly:true});
  try{db.exec('PRAGMA query_only=ON; BEGIN');return work(db);}finally{db.close();}
}
const value=v=>v===null?['null']:typeof v==='bigint'?['integer',String(v)]:v instanceof Uint8Array?['blob',Buffer.from(v).toString('hex')]:[typeof v,v];
export function logical(db){
  const schema=db.prepare('SELECT type,name,tbl_name,sql FROM sqlite_schema ORDER BY type,name').all();
  const tables=schema.filter(v=>v.type==='table').map(({name})=>{
    const statement=db.prepare('SELECT * FROM '+quote(name));statement.setReadBigInts(true);statement.setReturnArrays(true);
    const rows=[...statement.iterate()].map(row=>hash(row.map(value))).sort();
    return {table:name,count:rows.length,sha256:hash(rows)};
  });
  const result={schemaSha256:hash(schema),tables,userVersion:db.prepare('PRAGMA user_version').get().user_version,
    applicationId:db.prepare('PRAGMA application_id').get().application_id};
  return {...result,sha256:hash(result)};
}
export const ledgerTables=Object.freeze(['ai_agent_runs','ai_agent_run_requests','ai_agent_run_actions','ai_agent_events',
  'xiaozhi_event_journal','xiaozhi_pi_commands','xiaozhi_pi_usage','xiaozhi_tool_receipts','xiaozhi_pi_controls',
  'xiaozhi_pi_session_bindings','ai_confirmation_items','ai_conversation_messages','xiaozhi_pi_attachments',
  'xiaozhi_pi_attachment_sends','xiaozhi_pi_attachment_imports','question_bank_items','teacher_resources']);
export function facts(data){return readDb(path.join(data,'app.db'),db=>{
  const result=logical(db),query=q=>db.prepare(q).all();
  for(const table of ledgerTables)need(result.tables.some(t=>t.table===table),'LEDGER_TABLE_MISSING');
  const settled=(table,column,states)=>need(query('SELECT '+column+' FROM '+table).every(r=>states.includes(r[column])),'BASELINE_NOT_QUIESCENT');
  settled('ai_agent_runs','status',['succeeded','failed','blocked','cancelled','interrupted']);
  settled('xiaozhi_pi_commands','status',['finished','interrupted']);
  settled('ai_confirmation_items','status',['confirmed','rejected']);
  settled('xiaozhi_pi_controls','state',['answered','withdrawn','applied','interrupted']);
  settled('xiaozhi_pi_attachment_imports','state',['ready','interrupted']);
  // Real native session bytes are observed only; no replay, import or rebind.
  const native=query('SELECT session_file FROM xiaozhi_pi_session_bindings ORDER BY conversation_id').map(row=>{
    const root=path.join(data,'xiaozhi-pi'),file=path.resolve(root,row.session_file),rel=path.relative(root,file);
    need(rel&&!path.isAbsolute(rel)&&rel!=='..'&&!rel.startsWith('..'+path.sep),'NATIVE_PATH_REDIRECT');
    need(fs.realpathSync(file)===file&&!fs.lstatSync(file).isSymbolicLink(),'NATIVE_PATH_REDIRECT');
    return {file:rel,sha256:hash(fs.readFileSync(file))};
  });
  return {ledger:result.tables.filter(t=>ledgerTables.includes(t.table)),native,
    sourceTables:result.tables.filter(t=>/resource|material|source|asset|image|attachment|question|paper/.test(t.table)&&
      !['material_catalog_metadata_v1','material_catalog_tags_v1'].includes(t.table)),
    resources:query('SELECT * FROM teacher_resources ORDER BY id'),
    metadata:query('SELECT * FROM material_catalog_metadata_v1 ORDER BY resource_id'),
    tags:query('SELECT * FROM material_catalog_tags_v1 ORDER BY resource_id,tag_key')};
});}
export function noSourceProcess(root){
  need(process.platform==='win32','WINDOWS_PROCESS_PROOF_REQUIRED');
  const encoded=Buffer.from(root).toString('base64');
  const command=`$root=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encoded}')); @(Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'electron.exe' -and $_.CommandLine -and $_.CommandLine.IndexOf($root,[StringComparison]::OrdinalIgnoreCase) -ge 0 }).Count`;
  const result=spawnSync('powershell.exe',['-NoProfile','-Command',command],{encoding:'utf8',windowsHide:true,timeout:8000});
  need(result.status===0&&/^0\s*$/.test(result.stdout),'SOURCE_PROCESS_ACTIVE_OR_UNKNOWN');
}
export async function cloneBaseline(source,output,deadlineAt){
  noSourceProcess(source);const before=tree(source),sourceFacts=facts(path.join(source,'data'));
  const inventories={data:tree(path.join(source,'data')),profile:tree(path.join(source,'profile'))};
  const excluded={};
  for(const [kind,inventory]of Object.entries(inventories)){
    const destination=path.join(output,kind);fs.mkdirSync(destination);
    excluded[kind]=inventory.files.filter(v=>sidecar(v.file));
    for(const entry of excluded[kind]){
      // app.db is snapshotted with SQLite backup; every other DB must already be cold.
      need(kind==='data'&&['app.db-wal','app.db-shm'].includes(entry.file)||entry.bytes===0,'OTHER_DATABASE_HOT');
    }
    for(const entry of inventory.files){
      if(sidecar(entry.file)||kind==='data'&&entry.file==='app.db')continue;
      const from=path.join(inventory.root,entry.file),to=path.join(destination,entry.file);
      need(hash(fs.readFileSync(from))===entry.sha256,'SOURCE_CHANGED');
      fs.mkdirSync(path.dirname(to),{recursive:true});fs.copyFileSync(from,to,fs.constants.COPYFILE_EXCL);
      need(hash(fs.readFileSync(to))===entry.sha256,'CLONE_BYTE_MISMATCH');
    }
  }
  need(!fs.existsSync(path.join(output,'profile/xiaozhi-data-selection.v1.json'))&&
    !fs.existsSync(path.join(output,'data/xiaozhi-recovery.v1.json')),'RESTORE_SELECTION_FORBIDDEN');
  const destination=path.join(output,'data/app.db'),db=new DatabaseSync(path.join(source,'data/app.db'),{readOnly:true});
  let original;
  try{
    db.exec('PRAGMA query_only=ON; BEGIN');original=logical(db);
    await backup(db,destination,{rate:128,progress:()=>need(Date.now()<deadlineAt,'SNAPSHOT_DEADLINE')});
    need(logical(db).sha256===original.sha256,'SOURCE_LOGICAL_CHANGED');
  }finally{db.close();}
  // Physical journal choice on NEW backup only; no business rows are written.
  const cold=new DatabaseSync(destination);try{
    need(cold.prepare('PRAGMA journal_mode=DELETE').get().journal_mode==='delete','CLONE_NOT_COLD');
    need(cold.prepare('PRAGMA integrity_check').all().every(r=>r.integrity_check==='ok'),'CLONE_CORRUPT');
  }finally{cold.close();}
  const cloned=readDb(destination,logical),after=readDb(path.join(source,'data/app.db'),logical);
  need(cloned.sha256===original.sha256&&after.sha256===original.sha256,'SNAPSHOT_LOGICAL_MISMATCH');
  for(const [kind,inventory]of Object.entries(inventories)){
    const expected=inventory.files.filter(v=>!sidecar(v.file)&&!(kind==='data'&&v.file==='app.db'));
    const actual=tree(path.join(output,kind)).files.filter(v=>!(kind==='data'&&v.file==='app.db'));
    need(hash(expected)===hash(actual),'CLONE_INVENTORY_MISMATCH');
  }
  assert.deepEqual(facts(path.join(output,'data')),sourceFacts);
  noSourceProcess(source);need(tree(source).sha256===before.sha256,'SOURCE_CHANGED');
  return {sourceInventory:before,sourceFacts,sourceLogical:original,sourceAfter:after,cloneLogical:cloned,excluded,
    method:'node:sqlite.backup(readOnly source, new owned destination); other files copied byte-for-byte',
    sourceReferences:'Persisted absolute source paths remain unchanged and read-only in the original owned K61IFq fixture; no business SQL/path rewrites.'};
}

/** Serialized BEFORE formal main registration. Delegates real handlers once; only transport changes. */
export function installMetadataRecoveryTransport({ipcMain},options){
  const need=(v,c)=>{if(!v)throw Error(c);},clone=v=>JSON.parse(JSON.stringify(v));
  need(!globalThis.__qaMaterialMetadataRecovery,'SEAM_ALREADY_INSTALLED');
  const state={registrations:{save:0,read:0},saveCalls:0,committed:0,ackDropped:0,readCalls:0,
    readArmed:false,readHeld:0,readReleased:0,readDelivered:0,fatal:null,request:null,result:null};
  let release,holdTimer;
  const fail=code=>{state.fatal??=code;return Error(code);};
  const original=ipcMain.handle;
  ipcMain.handle=function(channel,handler){
    if(!['materials:catalog-save','materials:catalog-metadata'].includes(channel))return original.call(this,channel,handler);
    const kind=channel==='materials:catalog-save'?'save':'read';
    need(++state.registrations[kind]===1,'DUPLICATE_FORMAL_HANDLER');
    return original.call(this,channel,async function(event,...args){
      if(kind==='read'){
        state.readCalls++;const target=state.readArmed&&args[0]?.resourceId===options.resourceId;
        if(target)state.readArmed=false;
        const result=await handler.call(this,event,...args); // Genuine original get and original authority checks.
        if(target){
          if(state.readHeld)throw fail('MULTIPLE_READ_HOLDS');state.readHeld++;
          await new Promise((resolve,reject)=>{release=resolve;holdTimer=setTimeout(()=>{
            release=undefined;reject(fail('LATE_READ_HOLD_DEADLINE'));
          },Math.max(1,Math.min(15000,options.deadlineAt-Date.now())));});
          state.readDelivered++;
        }
        return result; // Exact original result, never fabricated or edited.
      }
      state.saveCalls++;
      if(state.saveCalls!==1)throw fail('REPEATED_SAVE_FORBIDDEN');
      const input=args[0];
      if(args.length!==1||input?.schemaVersion!==options.schema||input.resourceId!==options.resourceId||
        input.sourceVersion!==options.sourceVersion||input.expectedRevision!==options.revision||
        !/^catalog_[a-f0-9-]{36}$/.test(input.operationId??'')||
        JSON.stringify(input.metadata)!==JSON.stringify(options.metadata))throw fail('SAVE_SCOPE_REJECTED');
      state.request=clone(input);
      let result;
      try{result=await handler.call(this,event,...args);}catch(error){state.fatal??='FORMAL_SAVE_FAILED';throw error;}
      if(result?.schemaVersion!==options.schema||result.resourceId!==input.resourceId||result.sourceVersion!==input.sourceVersion||
        result.revision!==input.expectedRevision+1||result.receipt?.operationId!==input.operationId||
        result.receipt.baseRevision!==input.expectedRevision||result.receipt.sourceVersion!==input.sourceVersion||
        JSON.stringify(result.metadata)!==JSON.stringify(input.metadata))throw fail('FORMAL_RECEIPT_INVALID');
      state.result=clone(result);state.committed++;state.ackDropped++;
      throw Error('X02_ACK_LOST_AFTER_REAL_COMMIT');
    });
  };
  globalThis.__qaMaterialMetadataRecovery={state,
    armRead(){need(!state.fatal&&state.committed===1&&!state.readArmed&&!state.readHeld,'READ_ARM_INVALID');state.readArmed=true;},
    releaseRead(){need(!state.fatal&&state.readHeld===1&&state.readReleased===0&&release,'READ_RELEASE_INVALID');
      clearTimeout(holdTimer);state.readReleased++;const resolve=release;release=undefined;resolve();}
  };
}

export function assertReceipt(before,after,state,resourceId,metadata){
  need(!state.fatal&&state.saveCalls===1&&state.committed===1&&state.ackDropped===1,'SAVE_OBSERVATION_INVALID');
  need(state.request.resourceId===resourceId&&state.request.expectedRevision===before.revision,'ORIGINAL_REQUEST_MISMATCH');
  need(after.revision===before.revision+1&&after.resourceId===resourceId&&after.sourceVersion===before.sourceVersion,'REVISION_SOURCE_MISMATCH');
  assert.deepEqual(after,state.result);assert.deepEqual(after.metadata,metadata);
  need(after.receipt.operationId===state.request.operationId&&after.receipt.baseRevision===before.revision&&
    after.receipt.sourceVersion===before.sourceVersion&&after.receipt.patchDigest===hash(JSON.stringify(metadata)),'ORIGINAL_RECEIPT_MISMATCH');
}

export async function selfTest(){
  const checks=[],options={resourceId:'resource_test',sourceVersion:'a'.repeat(64),revision:2,
    schema:contract.schema,metadata:{directory:'QA X02',tags:['QA recovery']},deadlineAt:Date.now()+10000};
  const input={schemaVersion:options.schema,resourceId:options.resourceId,sourceVersion:options.sourceVersion,
    expectedRevision:2,operationId:'catalog_00000000-0000-0000-0000-000000000000',metadata:options.metadata};
  const genuine={schemaVersion:options.schema,resourceId:options.resourceId,sourceVersion:options.sourceVersion,
    revision:3,metadata:options.metadata,receipt:{operationId:input.operationId,baseRevision:2,
      sourceVersion:options.sourceVersion,patchDigest:hash(JSON.stringify(options.metadata))}};
  function setup(save){
    const handlers=new Map(),context=vm.createContext({setTimeout,clearTimeout});
    const ipcMain={handle:(name,handler)=>handlers.set(name,handler)};
    vm.runInContext('('+installMetadataRecoveryTransport.toString()+')',context)({ipcMain},options);
    ipcMain.handle('materials:catalog-save',save);ipcMain.handle('materials:catalog-metadata',async()=>genuine);
    return {handlers,seam:context.__qaMaterialMetadataRecovery};
  }
  let mutations=0;const {handlers,seam}=setup(async()=>{mutations++;return genuine;});
  await assert.rejects(handlers.get('materials:catalog-save')({},input),/X02_ACK_LOST_AFTER_REAL_COMMIT/);
  assert.equal(mutations,1);assert.equal(seam.state.committed,1);checks.push('ACK_DROPPED_ONLY_AFTER_GENUINE_SUCCESS');
  const before={...genuine,revision:2};assertReceipt(before,genuine,JSON.parse(JSON.stringify(seam.state)),options.resourceId,options.metadata);
  const validState=JSON.parse(JSON.stringify(seam.state));
  checks.push('ORIGINAL_OPERATION_REVISION_AND_PATCH_DIGEST');
  seam.armRead();let delivered=false;const pending=handlers.get('materials:catalog-metadata')({},input).then(r=>{delivered=true;return r;});
  await new Promise(r=>setImmediate(r));assert(!delivered);seam.releaseRead();assert.equal(await pending,genuine);
  assert.equal(seam.state.readDelivered,1);checks.push('LATE_READ_RETAINS_EXACT_REAL_RESULT');
  await assert.rejects(handlers.get('materials:catalog-save')({},input),/REPEATED_SAVE_FORBIDDEN/);
  assert.equal(mutations,1);checks.push('REPEATED_SAVE_REJECTED_BEFORE_SECOND_MUTATION');
  const denied=setup(async()=>{throw Error('formal denial');});
  await assert.rejects(denied.handlers.get('materials:catalog-save')({},input),/formal denial/);
  assert.equal(denied.seam.state.committed,0);assert.equal(denied.seam.state.ackDropped,0);checks.push('REAL_SAVE_FAILURE_NEVER_CLAIMED_COMMITTED');
  const wrong=setup(async()=>assert.fail('Wrong target must not reach handler'));
  await assert.rejects(wrong.handlers.get('materials:catalog-save')({},{...input,resourceId:'other'}),/SAVE_SCOPE_REJECTED/);
  checks.push('WRONG_RESOURCE_FAILS_CLOSED');
  assert.throws(()=>assertReceipt(before,{...genuine,revision:4},validState,options.resourceId,options.metadata),/REVISION_SOURCE_MISMATCH/);
  checks.push('REVISION_DRIFT_REJECTED');
  assert.throws(()=>assertReceipt(before,{...genuine,receipt:{...genuine.receipt,operationId:'other'}},validState,options.resourceId,options.metadata));
  checks.push('DIFFERENT_OPERATION_RECEIPT_REJECTED');
  const badReceipt=setup(async()=>({...genuine,revision:4}));
  await assert.rejects(badReceipt.handlers.get('materials:catalog-save')({},input),/FORMAL_RECEIPT_INVALID/);
  assert.equal(badReceipt.seam.state.ackDropped,0);checks.push('INVALID_FORMAL_RECEIPT_NEVER_LABELLED_ACK_LOSS');
  const originalEvent={sender:'genuine UI marker'};let originalCalls=0;
  const preserved=setup(async(event,request)=>{assert.equal(event,originalEvent);assert.equal(request,input);originalCalls++;return genuine;});
  await assert.rejects(preserved.handlers.get('materials:catalog-save')(originalEvent,input),/X02_ACK_LOST_AFTER_REAL_COMMIT/);
  assert.equal(originalCalls,1);checks.push('FORMAL_EVENT_AND_INPUT_PASSED_THROUGH_UNCHANGED');
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'edudev-x02-metadata-selftest-')),source=path.join(root,'source.db'),dest=path.join(root,'clone.db');
  const writer=new DatabaseSync(source);writer.exec("CREATE TABLE sample(id INTEGER PRIMARY KEY,text TEXT); INSERT INTO sample VALUES(1,'genuine fixture'); CREATE VIRTUAL TABLE body USING fts5(text); INSERT INTO body VALUES('real text');");writer.close();
  const bytes=hash(fs.readFileSync(source)),db=new DatabaseSync(source,{readOnly:true});let sourceLogical;
  try{db.exec('BEGIN');sourceLogical=logical(db);await backup(db,dest);assert.equal(logical(db).sha256,sourceLogical.sha256);}finally{db.close();}
  assert.equal(readDb(dest,logical).sha256,sourceLogical.sha256);assert.equal(hash(fs.readFileSync(source)),bytes);
  checks.push('REAL_SQLITE_BACKUP_ALL_TABLE_LOGICAL_HASH_UNCHANGED');
  const mutate=new DatabaseSync(dest);mutate.exec("UPDATE sample SET text='changed'");mutate.close();
  assert.notEqual(readDb(dest,logical).sha256,sourceLogical.sha256);checks.push('LOGICAL_HASH_DETECTS_BUSINESS_MUTATION');
  const link=path.join(root,'hardlink');fs.linkSync(source,link);assert.throws(()=>tree(root),/OWNED_FILE_REQUIRED/);
  checks.push('HARDLINK_SOURCE_INVENTORY_REJECTED');
  return {code:'X02_SELF_TEST_PASS',checks,launches:0,models:0,http:0,productAcceptance:false,fixture:root};
}
