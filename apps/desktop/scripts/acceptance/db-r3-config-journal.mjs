import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdirSync,mkdtempSync,writeFileSync,existsSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {DatabaseSync} from 'node:sqlite';

const defaultDesktop=resolve(import.meta.dirname,'../..');
const desktop=process.env.OMNI_EDU_R3_SOURCE ? resolve(process.env.OMNI_EDU_R3_SOURCE,'apps/desktop') : defaultDesktop;
await import(pathToFileURL(join(desktop,'scripts/office-agent/register-source.mjs')));
const source=name=>pathToFileURL(join(desktop,'src/main/xiaozhi-agent',name+'.ts'));
const {createModelSettingsState}=await import(source('model-settings-state'));
const root=resolve(process.env.OMNI_EDU_ACCEPTANCE_ROOT||join(defaultDesktop,'test-results'));
mkdirSync(root,{recursive:true});
const fixture=mkdtempSync(join(root,'r3-config-state-'));
const db=new DatabaseSync(join(fixture,'app.db'));
const row=(stmt,params=[])=>db.prepare(stmt).get(...params);
const sql={
  all:async(stmt,params=[])=>db.prepare(stmt).all(...params),
  run:async(stmt,params=[])=>db.prepare(stmt).run(...params),
  change:async(stmt,params=[])=>Number(db.prepare(stmt).run(...params).changes),
  transaction:async action=>{
    db.exec('BEGIN IMMEDIATE');
    try{const result=await action(sql);db.exec('COMMIT');return result;}
    catch(error){db.exec('ROLLBACK');throw error;}
  },
  readTransaction: async action=>action(sql),
};
db.exec('PRAGMA foreign_keys=ON; CREATE TABLE app_settings(key TEXT PRIMARY KEY,value_json TEXT NOT NULL,updated_at TEXT NOT NULL); CREATE TABLE ai_conversation_sessions(id TEXT PRIMARY KEY, archived_at TEXT);');
const settings=createModelSettingsState(sql);
const implPath=source('ordinary-config-journal');
const modern=existsSync(implPath)?await import(implPath):null;
if(modern)db.exec(modern.ordinaryConfigSchema);
const journal=modern?.createOrdinaryConfigJournal(sql);
const modes=new Set(process.argv.slice(2));
const checks=[];
const test=async (id,body)=>{
  if(modes.size&&!modes.has(id))return;
  try{checks.push({id,status:'PASS',observed:await body()});}
  catch(error){checks.push({id,status:'FAIL',error:error.message});process.exitCode=1;}
};
const change=(field,value,expectedVersion,extra={})=>({operationId:randomUUID(),field,value,expectedVersion,...extra});
const count=table=>row('SELECT count(*) AS n FROM '+table).n;
const stored=()=>JSON.parse(row('SELECT value_json FROM app_settings WHERE key=?',['xiaozhi.provider.v1']).value_json);
const globalCommit=async input=>{
  if(journal)return journal.write(input);
  await settings.saveThinking(undefined,input.expectedVersion,input.value);
  return {outcome:'committed',version:(await settings.thinking()).version};
};
const ids={a:'aisession_00000000-0000-4000-8000-000000000001',b:'aisession_00000000-0000-4000-8000-000000000002'};
db.prepare('INSERT INTO ai_conversation_sessions VALUES(?,null),(?,null)').run(ids.a,ids.b);

await test('AC-04',async()=>{
  const before=await settings.thinking();
  if(journal)db.exec("CREATE TRIGGER reject_history BEFORE INSERT ON xiaozhi_config_changes_v1 BEGIN SELECT RAISE(ABORT,'owned_history_failure'); END;");
  let failure;
  try{await globalCommit(change('global_thinking','high',before.version));}
  catch(e){failure=e.message;}
  finally{if(journal)db.exec('DROP TRIGGER reject_history');}
  const after=await settings.thinking();
  assert.deepEqual(after,before,'Behind a settings write there must be an atomic journal; an absent or failed append must not leave a committed revision');
  assert.match(failure,/owned_history_failure/);
  return {before,after,historyRows:count('xiaozhi_config_changes_v1'),receipts:count('xiaozhi_config_operations_v1')};
});
await test('AC-05',async()=>{
  const input=change('global_thinking','high',(await settings.thinking()).version);
  const first=await globalCommit(input),before=await settings.thinking();
  const retry=await globalCommit(change('global_thinking','high',before.version)),after=await settings.thinking();
  assert.deepEqual(after,before,'Equal persisted choice increased revision');
  assert.equal(retry.outcome,'no_change');assert.equal(retry.changeId,null);
  return {first,retry,after};
});
await test('AC-06',async()=>{
  const input=change('global_thinking','low',(await settings.thinking()).version);
  const first=await globalCommit(input);
  let repeat,error;
  try{repeat=await globalCommit(input);}catch(e){error=e.message;}
  assert.deepEqual(repeat,first,'Same operation ID after loss of reply must return first durable result, observed '+String(error));
  await assert.rejects(globalCommit({...input,value:'auto'}),/invalid_input/);
  return {first,repeat};
});
await test('AC-08',async()=>{
  const before=await settings.thinking();
  const first=await globalCommit(change('global_thinking','auto',before.version));
  await assert.rejects(globalCommit(change('global_thinking','max',before.version)),/conflict/);
  assert.equal((await settings.thinking()).version,first.version);
  return {first,staleRejected:true};
});
await test('AC-09',async()=>{
  await settings.saveConfiguration(0,{schema:1,defaultModel:null,sealedKey:'synthetic-credential-first'});
  const input=change('default_model','deepseek-flash',1);
  const first=await journal.write(input,{expectedModelVersion:1});
  await settings.saveConfiguration(2,{schema:1,defaultModel:'deepseek-flash',sealedKey:'synthetic-credential-latest'});
  const receipt=await journal.write({operationId:randomUUID(),field:'default_model',changeId:first.changeId,changeVersion:first.version});
  assert.equal(stored().defaultModel,null);
  assert.equal(stored().sealedKey,'synthetic-credential-latest');
  const history=await journal.history({field:'default_model'});
  assert.equal(history.items[0].kind,'undo');assert.equal(history.items[1].undone,true);
  assert(!/synthetic-credential|sealedKey|apiKey/.test(JSON.stringify(history)));
  return {version:receipt.version,oldSecretRestored:false,projectedChanges:history.items.length};
});
await test('AC-17',async()=>{
  const high=await globalCommit(change('global_thinking','high',(await settings.thinking()).version));
  const low=await globalCommit(change('global_thinking','low',high.version));
  const input={operationId:randomUUID(),field:'global_thinking',changeId:low.changeId,changeVersion:low.version};
  const undo=await journal.write(input);
  assert.equal((await settings.thinking()).choice,'high');
  const history=await journal.history({field:'global_thinking'});
  assert.equal(history.items[0].kind,'undo');assert.equal(history.items[1].undone,true);
  assert.equal(history.undo,null);
  assert.deepEqual(await journal.write(input),undo);
  await assert.rejects(journal.write({...input,operationId:randomUUID(),changeId:undo.changeId,changeVersion:undo.version}),/stale_change/);
  return {high,low,undo,noFurtherUndo:true};
});
await test('AC-19',async()=>{
  const first=await journal.write(change('session_thinking','auto',0,{sessionId:ids.a}));
  await journal.write({operationId:randomUUID(),field:'session_thinking',sessionId:ids.a,changeId:first.changeId,changeVersion:first.version});
  assert.equal((await settings.thinking(ids.a)).choice,null);
  return {stored:(await settings.thinking(ids.a)).choice};
});
await test('AC-21',async()=>{
  let version=(await settings.thinking()).version;
  const auto=await globalCommit(change('global_thinking','auto',version));
  const first=await globalCommit(change('global_thinking','high',auto.version));
  const low=await globalCommit(change('global_thinking','low',first.version));
  const current=await globalCommit(change('global_thinking','high',low.version));
  const intent={operationId:randomUUID(),field:'global_thinking',changeId:first.changeId,changeVersion:first.version};
  await assert.rejects(journal.write(intent),/stale_change/);
  assert.equal((await settings.thinking()).choice,'high');
  const undo=await journal.write({...intent,operationId:randomUUID(),changeId:current.changeId,changeVersion:current.version});
  assert.equal((await settings.thinking()).choice,'low');
  return {first,current,undo};
});
await test('AC-16',async()=>{
  const id=ids.b;
  let version=0;
  for(let n=0;n<23;n++)version=(await journal.write(change('session_thinking',n%2?'high':'auto',version,{sessionId:id}))).version;
  const first=await journal.history({field:'session_thinking',sessionId:id});
  assert.equal(first.items.length,20);
  const next=await journal.history({field:'session_thinking',sessionId:id,cursor:first.cursor});
  assert.equal(next.items.length,3);
  assert.equal(next.cursor,null);
  await assert.rejects(journal.history({field:'session_thinking',sessionId:ids.a,cursor:first.cursor}),/invalid_input/);
  await assert.rejects(journal.history({field:'session_thinking',sessionId:id,cursor:first.cursor+'x'}),/invalid_input/);
  return {first:first.items.length,next:next.items.length,noCrossScope:true};
});

db.close();
const report={ok:!process.exitCode,desktop,fixture,node:process.version,checks};
writeFileSync(join(fixture,'report.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report));
