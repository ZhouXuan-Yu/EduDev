import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {copyFile,mkdir,mkdtemp,readFile,stat,writeFile} from 'node:fs/promises';
import {dirname,isAbsolute,join,relative,resolve} from 'node:path';
import {backup,DatabaseSync} from 'node:sqlite';
import {_electron as electron} from 'playwright';
import {assertIsolatedPiMain,testMain} from '../acceptance/build-root.mjs';

const {readMemoryRestoreLedger}=await import('../../src/main/backup/memory-restore.ts');
const {relocateBackupDatabase}=await import('../../src/main/backup/restore-database.ts');
const {verifyRestoredMemoryAuthority}=await import('../../src/main/backup/restore.ts');
const {selectedBackupRoot}=await import('../../src/main/backup/activation.ts');
const {recoveryReceiptName}=await import('../../src/main/backup/restore-plan.ts');
const {applyPendingUpdateRollback,readPendingRollback,stageUpdateRollback}=await import('../../src/main/updates/pending-rollback.ts');
const {BACKUP_RESTORE_SCHEMA}=await import('../../src/shared/backup-restore.ts');
const {createPersonalMemoryRecordState}=await import('../../src/main/education/personal-memory/record-state.ts');
const {createPersonalMemorySourceAuthority}=await import('../../src/main/education/personal-memory/source-authority.ts');
const {createPiMemoryScopeState}=await import('../../src/main/xiaozhi-agent/memory-scope-state.ts');

const evidence=resolve(process.env.OMNI_EDU_ACCEPTANCE_ROOT??'.');
const fixture=resolve(process.env.OMNI_EDU_R2_BACKUP_FIXTURE??'missing');
assert(fixture.startsWith(evidence+'\\')||fixture.startsWith(evidence+'/'),'An owned acceptance fixture is required');
assert(fixture.endsWith('app.db'));
const root=await mkdtemp(join(evidence,'r2-memory-restore-'));
const hash=async file=>createHash('sha256').update(await readFile(file)).digest('hex');
const originalHash=await hash(fixture);
async function snapshot(name,source=fixture){
  const directory=join(root,name);
  await mkdir(directory);
  const db=new DatabaseSync(source,{readOnly:true});
  try{await backup(db,join(directory,'app.db'));}
  finally{db.close();}
  return directory;
}
function withDatabase(directory,operation){
  const db=new DatabaseSync(join(directory,'app.db'),{readOnly:true});
  try{return operation(db);}
  finally{db.close();}
}
const settings=directory=>withDatabase(directory,db=>({
  record:db.prepare('SELECT v.state,v.revision FROM personal_memory_records r JOIN personal_memory_versions v ON v.memory_id=r.memory_id AND v.revision=r.current_revision').get(),
  scope:JSON.parse(db.prepare('SELECT payload_json FROM xiaozhi_pi_memory_scopes').get().payload_json),
  allowed:db.prepare('SELECT extract_allowed FROM personal_memory_extract_grants').get().extract_allowed,
  enabled:db.prepare('SELECT enabled FROM personal_memory_processing WHERE id=1').get().enabled,
  conversations:db.prepare('SELECT COUNT(*) AS count FROM ai_conversation_messages').get().count,
  integrity:db.prepare('PRAGMA quick_check').get().quick_check,
}));
const live=await snapshot('live');
const preceding=await readMemoryRestoreLedger(live);
assert(preceding?.records.size===1&&preceding.scopes.size===1);
const initial=settings(live);
assert.equal(initial.record.state,'active');
assert.equal(initial.allowed,1);
assert.equal(initial.scope.enabled,true);

async function restore(name,ledger){
  const output=await snapshot(name);
  const warnings=await relocateBackupDatabase(join(output,'app.db'),live,output,join(live,'outputs'),join(output,'outputs'),[],ledger);
  return {output,warnings,state:settings(output)};
}
const matching=await restore('matching',preceding);
assert.equal(matching.state.record.state,'active');
assert.equal(matching.state.allowed,1);
assert.equal(matching.state.scope.enabled,true);
assert.equal(matching.state.enabled,0);
console.log('PASS matching current authority preserves a valid record and active selection while pausing background work');

const rollbackProfile=join(root,'rollback-profile');
const rollbackInstance=join(root,'rollback-instance');
const rollbackData=join(rollbackInstance,'OmniEduData');
await mkdir(rollbackProfile);
await mkdir(rollbackData,{recursive:true});
const rollbackFile=join(rollbackData,'app.db');
await copyFile(join(matching.output,'app.db'),rollbackFile);
const rollbackReceipt={
  schemaVersion:BACKUP_RESTORE_SCHEMA,id:'restore_'+randomUUID(),dataRoot:rollbackData,
  backupPath:fixture,fileCount:1,generatedFiles:0,warnings:[],memoryAuthority:preceding.hash,
  rollback:{sourceVersion:'0.1.0',targetVersion:'0.1.1',preparedAt:new Date().toISOString()},
};
await writeFile(join(rollbackData,recoveryReceiptName),JSON.stringify(rollbackReceipt));
await writeFile(join(rollbackInstance,'restoration-files.v1.json'),JSON.stringify({
  schemaVersion:BACKUP_RESTORE_SCHEMA,id:rollbackReceipt.id,
  files:[{file:rollbackFile,size:(await stat(rollbackFile)).size,sha256:await hash(rollbackFile)}],
}));
await stageUpdateRollback(rollbackProfile,live,live,'0.1.1',rollbackReceipt,()=>{});
const matchingProfile=join(root,'matching-rollback-profile');
await mkdir(matchingProfile);
await stageUpdateRollback(matchingProfile,live,live,'0.1.1',rollbackReceipt,()=>{});
await applyPendingUpdateRollback(matchingProfile,live,'0.1.0');
assert.equal((await selectedBackupRoot(matchingProfile,live,'0.1.0')).dataRoot,rollbackData);
assert.equal(await readPendingRollback(matchingProfile,live),undefined);

const db=new DatabaseSync(join(live,'app.db'));
try {
  const sql={
    all:async(q,values=[])=>db.prepare(q).all(...values),
    run:async(q,values=[])=>db.prepare(q).run(...values),
    change:async(q,values=[])=>Number(db.prepare(q).run(...values).changes),
    transaction:async operation=>{
      db.exec('BEGIN IMMEDIATE');
      try {const result=await operation(sql);db.exec('COMMIT');return result;}
      catch(error){db.exec('ROLLBACK');throw error;}
    },
  };
  const id=[...preceding.records.keys()][0];
  const records=createPersonalMemoryRecordState(sql,createPersonalMemorySourceAuthority(sql,async text=>text));
  await records.edit({operationId:randomUUID(),id,action:'forget',revision:initial.record.revision});
  const [sessionId]=preceding.scopes.keys();
  const scopes=createPiMemoryScopeState(sql);
  const current=await scopes.memoryScope(sessionId);
  assert.equal(await scopes.saveMemoryScope(sessionId,current.version,{enabled:false,selections:[]}),true);
} finally {db.close();}

const latest=await readMemoryRestoreLedger(live);
assert(latest&&latest.hash!==preceding.hash);
await assert.rejects(verifyRestoredMemoryAuthority({memoryAuthority:preceding.hash},live),/准备后有变化/);
await assert.rejects(applyPendingUpdateRollback(rollbackProfile,live,'0.1.0'),/准备后有变化/,
  'Starting the older application must reject a scheduled rollback after memory authority changes');
assert.equal((await selectedBackupRoot(rollbackProfile,live)).dataRoot,live);
assert.equal((await readPendingRollback(rollbackProfile,live)).restoreId,rollbackReceipt.id);
console.log('PASS a scheduled rollback rechecks the live grant after restart and cannot select stale authority');
const reconciled=await restore('reconciled',latest);
assert.equal(reconciled.state.record.state,'forgotten');
assert.equal(reconciled.state.allowed,0);
assert.deepEqual(reconciled.state.scope,{enabled:false,selections:[]});
assert.equal(reconciled.state.enabled,0);
assert.equal(reconciled.state.conversations,initial.conversations);
assert.equal(reconciled.state.integrity,'ok');
assert(reconciled.warnings.some(warning=>warning.includes('已停用')));
console.log('PASS a later teacher forget and scope revocation fence activation and survive restore to a separate root');

const unknown=await restore('unverified',null);
assert.equal(unknown.state.record.state,'disabled');
assert.equal(unknown.state.allowed,0);
assert.equal(unknown.state.scope.enabled,false);
assert.equal(unknown.state.enabled,0);
assert.equal(unknown.state.conversations,initial.conversations);
assert.equal(await hash(fixture),originalHash);
console.log('PASS without a current ledger the copy opens with old authority withheld and the original fixture remains byte-identical');

const editedSource=await snapshot('source-changed');
const changedDb=new DatabaseSync(join(editedSource,'app.db'));
try{
  changedDb.exec(`UPDATE ai_conversation_messages SET content=content||'（源已修订）'
    WHERE id IN (SELECT record_id FROM memory_source_access WHERE kind='history_request')`);
}finally{changedDb.close();}
const sourceChanged=await readMemoryRestoreLedger(editedSource);
assert(sourceChanged&&sourceChanged.hash!==preceding.hash);
const stale=await restore('source-changed-restore',sourceChanged);
assert.equal(stale.state.allowed,0);
assert.equal(stale.state.enabled,0);
assert.equal(stale.state.conversations,initial.conversations);
console.log('PASS an unchanged grant row cannot restore permission after the canonical teacher source was edited');

async function electronRestore() {
  const desktop=resolve(import.meta.dirname,'../..');
  const main=testMain(desktop);
  const data=await snapshot('desktop-original');
  const originalNative=join(dirname(fixture),'xiaozhi-pi');
  for(const {session_file} of withDatabase(data,db=>db.prepare('SELECT session_file FROM xiaozhi_pi_session_bindings').all())){
    const from=resolve(originalNative,session_file);
    const entry=relative(originalNative,from);
    assert(!entry.startsWith('..')&&!isAbsolute(entry)&&entry.endsWith('.jsonl'));
    const to=join(data,'xiaozhi-pi',entry);
    await mkdir(dirname(to),{recursive:true});
    await copyFile(from,to);
  }
  const profile=join(root,'desktop-profile'),exportsRoot=join(root,'desktop-exports'),target=join(root,'desktop-restored');
  for (const directory of [profile,exportsRoot,target]) await mkdir(directory);
  let backupPath='',app,page,settingsPage;
  try {
    async function launch(){
      const env={...process.env,OMNI_EDU_REPO_ROOT:resolve(desktop,'../..'),OMNI_EDU_DATA_ROOT:data,
        OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_E2E_DIALOG_MODE:'1',OMNI_EDU_E2E_RESTORE_RELAUNCH:'manual',OMNI_EDU_SKIP_DOTENV:'1',
        OMNI_EDU_E2E_DATA_BACKUP_EXPORT_DIALOG_QUEUE:JSON.stringify([exportsRoot]),OMNI_EDU_E2E_RESTORE_SOURCE_QUEUE:JSON.stringify([backupPath]),
        OMNI_EDU_E2E_RESTORE_TARGET_QUEUE:JSON.stringify([target]),DEEPSEEK_API_KEY:''};
      for(const key of ['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL','OMNI_EDU_R2_PYTHON'])delete env[key];
      app=await electron.launch({args:[main,'--user-data-dir='+profile],cwd:desktop,env,timeout:60000});
      page=await app.firstWindow({timeout:45000});
      await page.getByTestId('office-prompt-input').waitFor();
      await assertIsolatedPiMain(app,main,profile);
    }
    async function settings(tab) {
      if(!settingsPage||settingsPage.isClosed()){
        const opening=app.waitForEvent('window');
        await page.getByRole('button',{name:'设置',exact:true}).click();
        settingsPage=await opening;
      }
      await settingsPage.getByTestId('pi-settings-tab-'+tab).click();
    }
    await launch();
    await settings('backup');
    const readiness=await settingsPage.evaluate(async()=>{
      const api=window.omniEdu;
      const scope=window.settingsWindow?.getScope();
      const calls={
        settings:()=>api.getXiaozhiSettings().then(result=>result.ok?{ok:true,locked:result.value.locked}:{ok:false,error:result.error}),
        data:()=>api.getDataRoot().then(value=>({available:Boolean(value)})),
        conversations:()=>api.listAiConversations().then(value=>({count:value.sessions.length})),
        snapshot:()=>scope?.sessionId?api.getXiaozhiSnapshot(scope.sessionId).then(value=>({running:value.running})):Promise.resolve({none:true}),
      };
      return Object.fromEntries(await Promise.all(Object.entries(calls).map(async([name,call])=>{
        try{return [name,await call()];}
        catch(error){return [name,{error:String(error?.message??'unavailable').slice(0,200)}];}
      })));
    });
    await writeFile(join(root,'backup-settings-readiness.json'),JSON.stringify(readiness,null,2));
    await settingsPage.getByTestId('data-backup-export').click();
    const exported=await Promise.race([
      settingsPage.getByTestId('data-backup-export-success').waitFor({timeout:60000}).then(()=>true),
      settingsPage.getByText('备份未完成。',{exact:false}).waitFor({timeout:60000}).then(()=>false),
    ]);
    assert(exported,'The formal backup export reported failure');
    backupPath=await settingsPage.getByTestId('data-backup-export-path').innerText();
    assert.equal(settingsRead().record.state,'active');
    await app.close();
    settingsPage=undefined;
    await launch();
    await settings('teacher-memory');
    const memory=settingsPage.getByTestId('pi-personal-memory-settings');
    await memory.getByRole('button',{name:'自动记忆',exact:true}).click();
    const record=memory.getByTestId('personal-memory-record-'+[...preceding.records.keys()][0]);
    await record.getByRole('button',{name:'遗忘',exact:true}).click();
    await record.getByRole('button',{name:'确认遗忘',exact:true}).click();
    await memory.getByText('已停止使用这条记忆。',{exact:true}).waitFor();
    assert.equal(settingsRead().record.state,'forgotten');
    await settingsPage.getByTestId('pi-settings-tab-backup').click();
    await settingsPage.getByTestId('data-backup-restore').click();
    await settingsPage.getByTestId('data-backup-restore-prepare').click();
    await settingsPage.getByTestId('data-backup-restore-ready').waitFor({timeout:60000});
    await settingsPage.getByTestId('data-backup-restore-activate').click();
    await settingsPage.getByTestId('data-backup-restore-revert').waitFor({timeout:30000});
    await app.close();
    const hashAfterForget=await hash(join(data,'app.db'));
    await launch();
    const restored=await page.evaluate(()=>window.omniEdu.getDataRoot());
    assert.notEqual(restored,data);
    const view=await page.evaluate(()=>window.omniEdu.personalMemory.view());
    assert(view.ok&&view.value.records[0].state==='forgotten'&&!view.value.policy.enabled);
    assert.equal(withDatabase(restored,sql=>sql.prepare('SELECT extract_allowed FROM personal_memory_extract_grants').get().extract_allowed),0);
    assert.equal(await hash(join(data,'app.db')),hashAfterForget);
    await page.screenshot({path:join(root,'restored-shell.png')});
    console.log(JSON.stringify({electron:true,mainSha256:await hash(main),restored,backupPath}));
  } catch(error) {
    await page?.screenshot({path:join(root,'failure.png')}).catch(()=>{});
    throw error;
  } finally {await app?.close().catch(()=>{});}
  function settingsRead(){return withDatabase(data,sql=>({record:sql.prepare('SELECT v.state FROM personal_memory_records r JOIN personal_memory_versions v ON v.memory_id=r.memory_id AND v.revision=r.current_revision').get()}));}
}

const desktopCheck=process.argv.includes('--electron');
if(desktopCheck)await electronRestore();
console.log(JSON.stringify({passed:desktopCheck?6:5,root,originalHash}));
