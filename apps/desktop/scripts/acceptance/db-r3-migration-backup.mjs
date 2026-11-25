import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {cpSync,existsSync,mkdirSync,mkdtempSync,readFileSync,readdirSync,realpathSync,writeFileSync} from 'node:fs';
import {isAbsolute,join,relative,resolve} from 'node:path';
import {_electron as electron} from 'playwright';
import {backup as snapshotDatabase,DatabaseSync} from 'node:sqlite';
import {assertIsolatedPiMain,testMain} from './build-root.mjs';
import {withSql} from './db-foundation-r1-task-fixture.mjs';

const desktop=resolve(import.meta.dirname,'../..'),main=testMain(desktop);
const output=resolve(process.env.OMNI_EDU_ACCEPTANCE_ROOT||join(desktop,'test-results','xiaozhi-db-r3'));
const fixture=realpathSync(process.env.OMNI_EDU_R3_V6_DATA);
const files=['fixtures','evidence','logs'];
for(const folder of files)mkdirSync(join(output,folder),{recursive:true});
const root=mkdtempSync(join(output,'fixtures','R3-migration-backup-'));
const data=join(root,'data'),profile=join(root,'profile');
const a='deepseek-flash',b='deepseek-v4-pro',c='deepseek-r3-synthetic-ambient';
const key='r3-migration-portable-synthetic-key';
const digest=file=>createHash('sha256').update(readFileSync(file)).digest('hex');
const report={success:false,root,mainSha256:digest(main),suiteSha256:digest(import.meta.filename),sourceFixture:fixture,checks:[]};
const rows=(directory,sql,...values)=>withSql(directory,false,db=>db.prepare(sql).all(...values).map(row=>({...row})));
const version=directory=>rows(directory,'PRAGMA user_version')[0].user_version;
const migrations=directory=>rows(directory,'SELECT * FROM xiaozhi_schema_migrations ORDER BY to_version');
const journal=directory=>Object.fromEntries(['changes','heads','operations'].map(table=>[table,
  rows(directory,'SELECT * FROM xiaozhi_config_'+table+'_v1 ORDER BY 1')]));
const safeFacts=directory=>({
  prepared:rows(directory,'SELECT run_id,session_id,payload_json FROM xiaozhi_prepared_runs_v1 ORDER BY run_id'),
  sessions:rows(directory,'SELECT conversation_id,session_file,model FROM xiaozhi_pi_session_bindings ORDER BY conversation_id'),
  tasks:rows(directory,"SELECT key,value_json FROM app_settings WHERE key GLOB 'xiaozhi.task.v1:*' ORDER BY key"),
});
const jsonls=(directory,facts)=>facts.sessions.map(row=>({sessionId:row.conversation_id,
  sha256:digest(join(directory,'xiaozhi-pi',row.session_file))}));
const provider=directory=>JSON.parse(rows(directory,"SELECT value_json FROM app_settings WHERE key='xiaozhi.provider.v1'")[0].value_json);
const value=result=>{assert.equal(result.ok,true,JSON.stringify(result));return result.value;};
let app,page,stage='fixture',envModel=a;
const env={...process.env,OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:resolve(desktop,'../..'),OMNI_EDU_XIAOZHI_PI:'1',
  OMNI_EDU_E2E_DIALOG_MODE:'1',OMNI_EDU_E2E_RESTORE_RELAUNCH:'manual',DEEPSEEK_API_KEY:key,GLM_API_KEY:''};
for(const name of ['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL','OMNI_EDU_E2E_RESTORE_SOURCE_QUEUE',
  'OMNI_EDU_E2E_RESTORE_TARGET_QUEUE','OMNI_EDU_E2E_DATA_BACKUP_EXPORT_DIALOG_QUEUE'])delete env[name];

async function launch(){
  app=await electron.launch({args:[main,'--user-data-dir='+profile],cwd:desktop,env:{...env,DEEPSEEK_MODEL:envModel},timeout:60000});
  await app.evaluate(({net},models)=>{
    net.fetch=async(input)=>{
      const url=String(typeof input==='string'?input:input.url);
      assertEqualModels(url);
      return new Response(JSON.stringify({object:'list',data:models.map(id=>({id,context_window:1048576,max_output_tokens:32768,
        input_modalities:['text'],effort:{supported_levels:['low','high','max'],default_level:'high'}}))}));
    };
    function assertEqualModels(url){if(!url.endsWith('/models'))throw Error('Backup fixture only permits catalogue');}
  },[a,b,c]);
  page=await app.firstWindow();
  await assertIsolatedPiMain(app,main,profile);
  await page.getByTestId('xiaozhi-pi-workspace').waitFor({timeout:60000});
  await page.waitForFunction(()=>Boolean(window.omniEdu));
}
async function close(){if(app){await app.close();app=undefined;page=undefined;}}
function record(id,facts){
  const result={id,fixture:root,mainSha256:report.mainSha256,...facts};
  report.checks.push(result);
  writeFileSync(join(output,'evidence',id+'-observations.json'),JSON.stringify(result,null,2));
  console.log(JSON.stringify(result));
}
const history=()=>page.evaluate(()=>window.omniEdu.getXiaozhiConfigHistory({field:'default_model'})).then(value);
const active=()=>page.evaluate(()=>window.omniEdu.getXiaozhiResolvedAgentConfig()).then(value);
const edit=(expectedVersion,next,extra={})=>page.evaluate(args=>window.omniEdu.commitXiaozhiConfig(args),
  {operationId:randomUUID(),field:'default_model',expectedVersion,value:next,...extra}).then(value);
async function backup(kind){
  const result=await page.evaluate(kind=>window.omniEdu.exportDataRoot(kind),kind);
  assert(result?.exportPath);assert(existsSync(join(result.exportPath,'app.db')));
  return result.exportPath;
}

try{
  const sourceFile=join(fixture,'app.db'),dbDigest=digest(sourceFile);
  cpSync(fixture,data,{recursive:true,errorOnExist:true,force:false,
    filter:file=>!['app.db','app.db-wal','app.db-shm','app.db-journal'].some(name=>file===join(fixture,name))});
  const source=new DatabaseSync(sourceFile,{readOnly:true});
  try{await snapshotDatabase(source,join(data,'app.db'));}finally{source.close();}
  assert.equal(version(data),6);
  const old=migrations(data),originalFacts=safeFacts(data);
  assert.equal(old.length,6);
  assert(originalFacts.sessions.length>0);
  const originals=jsonls(data,originalFacts);

  stage='AC-25 update v6';
  await launch();
  assert.equal(version(data),7);
  const upgraded=migrations(data);
  assert.deepEqual(upgraded.slice(0,6),old);
  assert.deepEqual([upgraded[6].migration_id,upgraded[6].from_version,upgraded[6].to_version],['r3.ordinary_config_history.v7',6,7]);
  const recoveryParent=join(root,'XiaozhiUpgradeRecovery');
  const recovery=readdirSync(recoveryParent).map(name=>join(recoveryParent,name)).find(path=>existsSync(join(path,'app.db')));
  assert(recovery);
  assert.equal(version(recovery),6);assert.deepEqual(migrations(recovery),old);
  assert.deepEqual(safeFacts(recovery),originalFacts);
  assert.deepEqual(jsonls(recovery,originalFacts),originals);
  assert.deepEqual(safeFacts(data),originalFacts);

  stage='AC-03 first edit and ambient inherit';
  const first=await history();
  assert.deepEqual(first,{value:null,version:0,items:[],undo:null,cursor:null});
  assert.deepEqual((await active()).model,{value:a,source:'environment',revision:null,status:'valid'});
  const committed=await edit(first.version,b);
  assert.equal((await history()).items[0].previous,null);
  await close();envModel=c;await launch();
  assert.deepEqual(migrations(data),upgraded);
  const beforeUndo=await history();
  assert.equal(beforeUndo.value,b);assert.equal(beforeUndo.items.length,1);
  const receipt=await page.evaluate(input=>window.omniEdu.undoXiaozhiConfig(input),{
    operationId:randomUUID(),field:'default_model',changeId:beforeUndo.undo.changeId,changeVersion:beforeUndo.undo.version,
  }).then(value);
  assert.deepEqual((await active()).model,{value:c,source:'environment',revision:null,status:'valid'});
  assert.equal((await history()).value,null);
  assert.equal(digest(join(fixture,'app.db')),dbDigest);
  record('AC-03',{legacyModel:a,firstHistory:[],commit:committed,undo:receipt,updatedAmbientModel:c,sourceUnchanged:true});
  record('AC-25',{old,upgraded,preUpgradeRecovery:recovery,coldLedgerUnchanged:true,sourceSha256:dbDigest,nativeFilesPreserved:true});

  stage='AC-02 persisted null with encrypted credential';
  const ticket=await page.evaluate(apiKey=>window.omniEdu.stageXiaozhiCredential({schemaVersion:'xiaozhi.settings.v1',apiKey}),key).then(value);
  const firstCredential=await edit((await history()).version,b,ticket);
  const ciphertext=provider(data).sealedKey;
  assert(ciphertext&&ciphertext!==key);
  const clear=await edit(firstCredential.version,null);
  assert.equal(provider(data).sealedKey,ciphertext);
  await close();await launch();
  assert.equal((await history()).value,null);
  assert.equal((await active()).model.value,c);
  assert.equal(provider(data).sealedKey,ciphertext);
  const verified=await app.evaluate(({safeStorage},{cipher,key})=>safeStorage.isEncryptionAvailable()&&safeStorage.decryptString(Buffer.from(cipher,'base64'))===key,{cipher:ciphertext,key});
  assert.equal(verified,true);
  record('AC-02',{clear,coldStoredNull:true,ambient:c,credentialRetained:true});

  stage='AC-26 full and portable';
  await edit(clear.version,b);
  const expected=journal(data),expectedFacts=safeFacts(data),expectedFiles=jsonls(data,expectedFacts);
  assert(expected.heads.some(row=>row.field==='default_model'));
  const session=await page.evaluate(async()=> (await window.omniEdu.createAiConversationSession({title:'R3 仿权限记录'})).session.id);
  const mode=await page.evaluate(id=>window.omniEdu.getXiaozhiPermissions(id),session).then(value);
  const permissions=await page.evaluate(input=>window.omniEdu.setXiaozhiPermissionMode(input),
    {sessionId:session,revision:mode.profile.revision,mode:'acceptEdits'}).then(value);
  assert(permissions.grants.some(grant=>!grant.revokedAt));
  const destinations=[join(root,'full'),join(root,'portable')];
  for(const destination of destinations)mkdirSync(destination);
  await app.evaluate((_,folders)=>{process.env.OMNI_EDU_E2E_DATA_BACKUP_EXPORT_DIALOG_QUEUE=JSON.stringify(folders);},destinations);
  const full=await backup('full'),portable=await backup('portable');
  for(const copy of [full,portable]){
    assert.equal(version(copy),7);
    assert.deepEqual(journal(copy),expected);
    assert.deepEqual(safeFacts(copy),expectedFacts);
    assert.deepEqual(jsonls(copy,expectedFacts),expectedFiles);
    const bytes=readFileSync(join(copy,'app.db'));
    assert(!bytes.includes(Buffer.from(key)));
    if(copy===portable){
      assert.equal(provider(copy).sealedKey,undefined);assert(!bytes.includes(Buffer.from(ciphertext)));
      assert.equal(rows(copy,'SELECT count(*) AS count FROM xiaozhi_permission_grants_v1 WHERE revoked=0')[0].count,0);
    }else assert.equal(provider(copy).sealedKey,ciphertext);
  }
  const restoredParent=join(root,'restored');mkdirSync(restoredParent);
  await app.evaluate((_,{portable,restoredParent})=>{
    process.env.OMNI_EDU_E2E_RESTORE_SOURCE_QUEUE=JSON.stringify([portable]);
    process.env.OMNI_EDU_E2E_RESTORE_TARGET_QUEUE=JSON.stringify([restoredParent]);
  },{portable,restoredParent});
  const prepared=await page.evaluate(()=>window.omniEdu.prepareBackupRestore());
  assert.equal(prepared.purpose,'portable');
  const relativeTarget=relative(restoredParent,prepared.dataRoot);
  assert(relativeTarget&&!relativeTarget.startsWith('..')&&!isAbsolute(relativeTarget));
  await page.evaluate(id=>window.omniEdu.activateBackupRestore({schemaVersion:'xiaozhi.backup-restore.v1',action:'activate',id}),prepared.id);
  await close();await launch();
  assert.equal(await page.evaluate(()=>window.omniEdu.getDataRoot()),prepared.dataRoot);
  assert.deepEqual(journal(prepared.dataRoot),expected);
  assert.equal((await history()).value,b);
  assert((await history()).undo);
  assert.deepEqual(safeFacts(prepared.dataRoot),expectedFacts);
  assert.deepEqual(journal(data),expected);
  assert.equal(provider(data).sealedKey,ciphertext);
  record('AC-26',{full,portable,restored:prepared.dataRoot,ordinaryRecords:expected.changes.length,
    fullKeptCredential:true,portableRemovedSecretsAndGrants:true,coldHistoryReadback:true,taskAndNativePreserved:true});
  report.success=true;
}catch(error){
  report.failedAt=stage;report.error=String(error.stack??error);
  process.exitCode=1;
}finally{
  await close();
  writeFileSync(join(root,'report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({success:report.success,failedAt:report.failedAt,error:report.error,report:join(root,'report.json')}));
}
